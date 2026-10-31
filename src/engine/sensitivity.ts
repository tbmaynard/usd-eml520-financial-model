// One-at-a-time sensitivity analysis. Each driver is moved down and up while
// everything else stays at the base case, and the model is fully recalculated.

import { computeProject } from './engine';
import { clone, listAssumptions, setValue, type AssumptionRef } from './paths';
import type { Project, Unit } from './types';

export type SensMetric = 'endingCash' | 'minCash' | 'fundingRequired' | 'breakEven';

export const SENS_METRICS: { key: SensMetric; label: string; better: 'higher' | 'lower' }[] = [
  { key: 'minCash', label: 'Lowest cash balance', better: 'higher' },
  { key: 'endingCash', label: 'Ending cash', better: 'higher' },
  { key: 'fundingRequired', label: 'Additional funding required', better: 'lower' },
  { key: 'breakEven', label: 'Break-even month', better: 'lower' },
];

export interface SensOutcome {
  endingCash: number;
  minCash: number;
  fundingRequired: number;
  /** null = no sustained break-even within the projection */
  breakEven: number | null;
}

export interface SensRow {
  id: string;
  label: string;
  group: string;
  unit: Unit;
  base: number;
  low: number;
  high: number;
  lowLabel: string;
  highLabel: string;
  lowResult: SensOutcome;
  highResult: SensOutcome;
  assumption?: AssumptionRef;
  why: string;
}

function outcome(p: Project, extraDays = 0): SensOutcome {
  const r = computeProject(p, extraDays);
  return {
    endingCash: r.summary.endingCash,
    minCash: r.summary.minCash,
    fundingRequired: r.summary.fundingRequired,
    breakEven: r.summary.operatingBreakEvenMonth,
  };
}

export function metricValue(o: SensOutcome, m: SensMetric, months: number): number {
  if (m === 'breakEven') return o.breakEven ?? months + 1;
  return o[m];
}

function step(unit: Unit, v: number, pct: number): [number, number, string, string] {
  if (unit === 'days') return [Math.max(0, v - 15), v + 15, '−15 days', '+15 days'];
  if (unit === 'months') return [Math.max(0, v - 2), v + 2, '−2 months', '+2 months'];
  if (unit === 'month') return [Math.max(1, v - 2), v + 2, '2 months earlier', '2 months later'];
  const f = pct / 100;
  if (unit === 'pct' && Math.abs(v) < 1e-9) return [0, pct / 10, '0', `+${pct / 10} pts`];
  return [v * (1 - f), v * (1 + f), `−${pct}%`, `+${pct}%`];
}

const WHY: Partial<Record<Unit, string>> = {
  days: 'Payment timing changes when cash arrives or leaves, not how much. Longer delays mean you must fund the gap.',
  months: 'Timing assumptions move revenue and costs earlier or later, which changes how long you must fund losses.',
  month: 'Timing assumptions move revenue and costs earlier or later, which changes how long you must fund losses.',
};

function whyFor(a: AssumptionRef): string {
  if (WHY[a.unit]) return WHY[a.unit]!;
  const l = a.label.toLowerCase();
  if (l.includes('price') || l.includes('rate per hour') || l.includes('fee') || l.includes('take rate') || l.includes('order value')) return 'Price changes flow almost entirely to gross profit, because most costs do not change when price does.';
  if (l.includes('churn') || l.includes('renewal')) return 'Retention compounds: small changes in how many customers stay add up month after month.';
  if (l.includes('growth') || l.includes('new ') || l.includes('prospect') || l.includes('per month') || l.includes('demand')) return 'Volume drives revenue and the costs that scale with it. Growth assumptions compound over the projection.';
  if (l.includes('conversion') || l.includes('to pilot') || l.includes('qualified')) return 'Conversion rates multiply through each stage of the sales process.';
  if (l.includes('acquisition') || l.includes('cac') || l.includes('marketing')) return 'Acquisition spending is paid up front, long before a customer pays back what it cost to win them.';
  if (l.includes('cost') || l.includes('salary')) return 'Cost changes reduce profit and cash one for one.';
  return 'Shows how much the outcome depends on this single assumption.';
}

export function runSensitivity(p: Project, pct = 20): { base: SensOutcome; rows: SensRow[] } {
  const base = outcome(p);
  const rows: SensRow[] = [];
  for (const a of listAssumptions(p)) {
    if (!a.sensitivity) continue;
    const [lo, hi, lowLabel, highLabel] = step(a.unit, a.value, pct);
    const pl = clone(p); setValue(pl, a.path, lo);
    const ph = clone(p); setValue(ph, a.path, hi);
    rows.push({ id: a.path, label: a.label, group: a.group, unit: a.unit, base: a.value, low: lo, high: hi, lowLabel, highLabel, lowResult: outcome(pl), highResult: outcome(ph), assumption: a, why: whyFor(a) });
  }

  // Cross-cutting drivers
  if (p.roles.length || p.streams.some((s) => s.kind === 'services')) {
    const comp = (f: number) => {
      const q = clone(p);
      for (const r of q.roles) r.monthlyComp *= f;
      for (const s of q.streams) if (s.kind === 'services') {
        if (s.inputs.consultantSalary) s.inputs.consultantSalary.v *= f;
        if (s.inputs.adminSalary) s.inputs.adminSalary.v *= f;
      }
      return q;
    };
    rows.push({ id: 'x:comp', label: 'All pay and salaries', group: 'Team plan', unit: 'pct', base: 0, low: -pct, high: pct, lowLabel: `−${pct}%`, highLabel: `+${pct}%`, lowResult: outcome(comp(1 - pct / 100)), highResult: outcome(comp(1 + pct / 100)), why: 'Payroll is usually the largest cost of an early venture and is paid every month regardless of revenue.' });
  }
  if (p.roles.some((r) => r.startMonth > 1)) {
    const shift = (d: number) => {
      const q = clone(p);
      for (const r of q.roles) if (r.startMonth > 1) r.startMonth = Math.max(2, r.startMonth + d);
      return q;
    };
    rows.push({ id: 'x:hiring', label: 'Timing of planned hires', group: 'Team plan', unit: 'months', base: 0, low: -3, high: 3, lowLabel: '3 months earlier', highLabel: '3 months later', lowResult: outcome(shift(-3)), highResult: outcome(shift(3)), why: 'Hiring earlier raises costs before the revenue the new person supports arrives.' });
  }
  rows.push({ id: 'x:collect', label: 'Customer payment delay (all business lines)', group: 'Payment timing', unit: 'days', base: 0, low: 0, high: 30, lowLabel: 'as entered', highLabel: '+30 days', lowResult: base, highResult: outcome(p, 30), why: 'Slower customer payments do not change revenue, but the business must carry the unpaid invoices with its own cash.' });

  return { base, rows };
}

/** Rows sorted by the size of their effect on a metric, largest first. */
export function rankSensitivity(rows: SensRow[], metric: SensMetric, months: number): (SensRow & { swing: number })[] {
  return rows
    .map((r) => ({ ...r, swing: Math.abs(metricValue(r.highResult, metric, months) - metricValue(r.lowResult, metric, months)) }))
    .sort((a, b) => b.swing - a.swing);
}
