// Addressing individual assumptions by a string path, so scenarios and the
// sensitivity analysis can override any of them without knowing where they live.
//
//   stream:<streamId>:<inputKey>
//   setup:<startingCash|founderInvestment|minCashCushion|largestCustomerSharePct>
//   tax:rate
//   role:<roleId>:<count|monthlyComp|burdenPct|startMonth>
//   expense:<expenseId>:<amount|startMonth|payDelayDays>
//   funding:<fundingId>:<amount|month>
//   capex:<capexId>:<amount|month>

import { getModule } from './models';
import type { Unit } from './types';
import type { Assumption, Confidence, Project } from './types';

export interface AssumptionRef {
  path: string;
  label: string;
  group: string;
  unit: Unit;
  value: number;
  basis: string;
  conf: Confidence;
  example: boolean;
  /** Where in the app the student edits it. */
  section: 'setup' | 'revenue' | 'team' | 'expenses' | 'funding';
  streamName?: string;
  sensitivity?: boolean;
  scenario?: boolean;
  worseWhen?: 'higher' | 'lower';
}

const SETUP_FIELDS: { key: 'startingCash' | 'founderInvestment' | 'minCashCushion' | 'largestCustomerSharePct'; label: string; unit: Unit }[] = [
  { key: 'startingCash', label: 'Starting cash balance', unit: 'usd' },
  { key: 'founderInvestment', label: 'Founder investment (month 1)', unit: 'usd' },
  { key: 'minCashCushion', label: 'Minimum cash you want to keep on hand', unit: 'usd' },
  { key: 'largestCustomerSharePct', label: 'Largest customer’s share of revenue', unit: 'pct' },
];

/** Every numeric assumption in the project, in a flat list. */
export function listAssumptions(p: Project): AssumptionRef[] {
  const out: AssumptionRef[] = [];
  const fromA = (a: Assumption) => ({ value: a.v, basis: a.basis, conf: a.conf, example: a.example });

  for (const f of SETUP_FIELDS) {
    if (f.key === 'largestCustomerSharePct' && p.streams.every((s) => s.kind === 'enterprise' || s.kind === 'licensing')) continue;
    out.push({ path: `setup:${f.key}`, label: f.label, group: 'Venture setup', unit: f.unit, section: 'setup', ...fromA(p.setup[f.key]), sensitivity: f.key === 'startingCash' });
  }

  for (const s of p.streams) {
    const mod = getModule(s.kind);
    for (const f of mod.fields) {
      if (f.showIf && !f.showIf(s.options)) continue;
      const a = s.inputs[f.key];
      if (!a) continue;
      out.push({
        path: `stream:${s.id}:${f.key}`, label: f.label, group: `${s.name}: ${f.group}`, unit: f.unit, section: 'revenue', streamName: s.name,
        ...fromA(a), sensitivity: f.sensitivity, scenario: f.scenario, worseWhen: f.worseWhen,
      });
    }
  }

  for (const r of p.roles) {
    const base = { group: 'Team plan', section: 'team' as const, basis: r.basis, conf: r.conf, example: r.example };
    out.push({ ...base, path: `role:${r.id}:monthlyComp`, label: `${r.title}: monthly pay`, unit: 'usd', value: r.monthlyComp, sensitivity: false });
    out.push({ ...base, path: `role:${r.id}:startMonth`, label: `${r.title}: start month`, unit: 'month', value: r.startMonth });
    if (r.count !== 1) out.push({ ...base, path: `role:${r.id}:count`, label: `${r.title}: headcount`, unit: 'count', value: r.count });
  }

  for (const e of p.expenses) {
    out.push({ path: `expense:${e.id}:amount`, label: e.kind === 'one-time' ? `${e.name} (one-time)` : `${e.name} per month`, group: 'Operating expenses', unit: 'usd', value: e.amount, basis: e.basis, conf: e.conf, example: e.example, section: 'expenses' });
  }

  for (const c of p.capex) {
    out.push({ path: `capex:${c.id}:amount`, label: `${c.name} (equipment)`, group: 'Capital spending', unit: 'usd', value: c.amount, basis: c.basis, conf: c.conf, example: c.example, section: 'expenses' });
  }

  for (const f of p.funding) {
    out.push({ path: `funding:${f.id}:amount`, label: `${f.name}: amount`, group: 'Funding', unit: 'usd', value: f.amount, basis: f.basis, conf: f.conf, example: f.example, section: 'funding' });
    out.push({ path: `funding:${f.id}:month`, label: `${f.name}: month received`, group: 'Funding', unit: 'month', value: f.month, basis: f.basis, conf: f.conf, example: f.example, section: 'funding' });
  }

  if (p.tax.enabled) {
    out.push({ path: 'tax:rate', label: 'Combined income tax rate', group: 'Taxes', unit: 'pct', section: 'funding', ...fromA(p.tax.rate) });
  }
  return out;
}

export function getValue(p: Project, path: string): number | undefined {
  const [kind, a, b] = path.split(':');
  switch (kind) {
    case 'setup': return (p.setup as unknown as Record<string, Assumption>)[a]?.v;
    case 'stream': return p.streams.find((s) => s.id === a)?.inputs[b]?.v;
    case 'tax': return p.tax.rate.v;
    case 'role': return (p.roles.find((r) => r.id === a) as unknown as Record<string, number> | undefined)?.[b];
    case 'expense': return (p.expenses.find((e) => e.id === a) as unknown as Record<string, number> | undefined)?.[b];
    case 'funding': return (p.funding.find((f) => f.id === a) as unknown as Record<string, number> | undefined)?.[b];
    case 'capex': return (p.capex.find((c) => c.id === a) as unknown as Record<string, number> | undefined)?.[b];
  }
  return undefined;
}

/** Mutates `p` (call on a clone). Unknown paths are ignored. */
export function setValue(p: Project, path: string, value: number): void {
  const [kind, a, b] = path.split(':');
  switch (kind) {
    case 'setup': {
      const s = (p.setup as unknown as Record<string, Assumption>)[a];
      if (s) s.v = value;
      return;
    }
    case 'stream': {
      const inp = p.streams.find((s) => s.id === a)?.inputs[b];
      if (inp) inp.v = value;
      return;
    }
    case 'tax': p.tax.rate.v = value; return;
    case 'role': {
      const r = p.roles.find((x) => x.id === a) as unknown as Record<string, number> | undefined;
      if (r && b in r) r[b] = value;
      return;
    }
    case 'expense': {
      const e = p.expenses.find((x) => x.id === a) as unknown as Record<string, number> | undefined;
      if (e && b in e) e[b] = value;
      return;
    }
    case 'funding': {
      const f = p.funding.find((x) => x.id === a) as unknown as Record<string, number> | undefined;
      if (f && b in f) f[b] = value;
      return;
    }
    case 'capex': {
      const c = p.capex.find((x) => x.id === a) as unknown as Record<string, number> | undefined;
      if (c && b in c) c[b] = value;
      return;
    }
  }
}

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/** Update the basis/confidence (and example flag) behind an assumption path. Mutates `p`. */
export function patchJustification(p: Project, path: string, patch: { basis?: string; conf?: Confidence; example?: boolean }): void {
  const [kind, a, b] = path.split(':');
  let target: { basis: string; conf: Confidence; example: boolean } | undefined;
  switch (kind) {
    case 'setup': target = (p.setup as unknown as Record<string, Assumption>)[a]; break;
    case 'stream': target = p.streams.find((s) => s.id === a)?.inputs[b]; break;
    case 'tax': target = p.tax.rate; break;
    case 'role': target = p.roles.find((x) => x.id === a); break;
    case 'expense': target = p.expenses.find((x) => x.id === a); break;
    case 'funding': target = p.funding.find((x) => x.id === a); break;
    case 'capex': target = p.capex.find((x) => x.id === a); break;
  }
  if (target) Object.assign(target, patch);
}
