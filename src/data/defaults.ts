import { getModule, MODULES } from '../engine/models';
import { defaultExit } from '../engine/exit';
import type { Assumption, Expense, ModelKind, Project, Role, Scenario, ScenarioId, Stream } from '../engine/types';

export const EXAMPLE_BASIS = '';

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${counter}`;
}

export function a(v: number, example = true, basis = '', conf: Assumption['conf'] = 'unset'): Assumption {
  return { v, basis, conf, example };
}

export function makeStream(kind: ModelKind, name?: string, id?: string): Stream {
  const mod = getModule(kind);
  const inputs: Record<string, Assumption> = {};
  for (const f of mod.fields) inputs[f.key] = a(mod.defaults[f.key] ?? 0);
  return { id: id ?? uid('stream'), kind, name: name ?? mod.short, inputs, options: { ...mod.defaultOptions } };
}

/** Starting expense categories. Amounts are illustrative examples. */
export function defaultExpenses(): Expense[] {
  const e = (name: string, category: Expense['category'], amount: number, kind: Expense['kind'] = 'recurring', startMonth = 1): Expense => ({
    id: uid('exp'), name, category, kind, amount, startMonth, endMonth: null, annualGrowthPct: 0, payDelayDays: 0,
    basis: '', conf: 'unset', example: true,
  });
  return [
    e('Rent and facilities', 'ga', 1500),
    e('Software and technology', 'ga', 600),
    e('Insurance', 'ga', 300),
    e('Legal and professional services', 'ga', 800),
    e('Accounting and bookkeeping', 'ga', 400),
    e('Marketing and advertising', 'sm', 1000),
    e('Travel and entertainment', 'other', 400),
    e('Office and administrative expenses', 'ga', 250),
    e('Research and development', 'rd', 0),
    e('Other expenses', 'other', 200),
    e('Company formation and legal setup', 'ga', 3000, 'one-time', 1),
  ];
}

export function defaultRoles(): Role[] {
  return [
    {
      id: uid('role'), title: 'Founder', count: 1, monthlyComp: 5000, burdenPct: 20, startMonth: 1, endMonth: null, annualRaisePct: 0, dept: 'admin',
      basis: '', conf: 'unset', example: true,
    },
    {
      id: uid('role'), title: 'First employee', count: 1, monthlyComp: 7000, burdenPct: 22, startMonth: 7, endMonth: null, annualRaisePct: 3, dept: 'product',
      basis: '', conf: 'unset', example: true,
    },
  ];
}

const DEFAULT_LABELS: Record<ScenarioId, string> = { base: 'Base case', downside: 'Downside case', upside: 'Upside case' };

export function emptyScenarios(labels: Partial<Record<ScenarioId, string>> = {}): Record<ScenarioId, Scenario> {
  const mk = (id: ScenarioId): Scenario => ({
    id, label: labels[id] ?? DEFAULT_LABELS[id], overrides: {}, notes: '',
    adjustments: { hiringDelayMonths: 0, extraCollectionDays: 0, compChangePct: 0 },
  });
  return { base: mk('base'), downside: mk('downside'), upside: mk('upside') };
}

/**
 * Starting points for downside and upside: each key driver moved 20% in the
 * harmful (or helpful) direction, and timing drivers moved by whole months or
 * days. These are placeholders the student is expected to replace with their
 * own reasoning.
 */
export function suggestOverrides(p: Project, which: 'downside' | 'upside'): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of p.streams) {
    const mod = MODULES[s.kind];
    for (const f of mod.fields) {
      if (!f.scenario || (f.showIf && !f.showIf(s.options))) continue;
      const v = s.inputs[f.key]?.v ?? 0;
      const worse = which === 'downside';
      const up = (f.worseWhen === 'higher') === worse; // move value up?
      let next: number;
      if (f.unit === 'days') next = Math.max(0, v + (up ? 15 : -15));
      else if (f.unit === 'months' || f.unit === 'month') next = Math.max(f.min ?? 0, v + (up ? 1 : -1));
      else if (f.unit === 'pct' && f.key.toLowerCase().includes('growth')) next = v + (up ? Math.max(1, Math.abs(v) * 0.4) : -Math.max(1, Math.abs(v) * 0.4));
      else next = v * (up ? 1.2 : 0.8);
      if (f.max != null) next = Math.min(f.max, next);
      out[`stream:${s.id}:${f.key}`] = round(next);
    }
  }
  return out;
}

function round(x: number): number {
  if (Math.abs(x) >= 100) return Math.round(x);
  return Math.round(x * 10) / 10;
}

export function newProject(kind: ModelKind, name = 'My venture'): Project {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const start = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  const p: Project = {
    schemaVersion: 1,
    id: uid('proj'),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    setup: {
      name,
      description: '',
      industries: [],
      startMonth: start,
      months: 24,
      startingCash: a(10000),
      founderInvestment: a(25000),
      minCashCushion: a(10000),
      largestCustomerSharePct: a(10),
    },
    streams: [makeStream(kind)],
    roles: defaultRoles(),
    expenses: defaultExpenses(),
    capex: [],
    funding: [],
    tax: { enabled: true, entity: 'c_corp', rate: a(25), payment: 'quarterly', includeOwnerDistributions: true },
    scenarios: emptyScenarios(),
    reviewResponses: {},
    reflection: '',
    exit: defaultExit({ streams: [] }),
  };
  p.exit = defaultExit(p);
  p.scenarios.downside.overrides = suggestOverrides(p, 'downside');
  p.scenarios.downside.adjustments.extraCollectionDays = 15;
  p.scenarios.upside.overrides = suggestOverrides(p, 'upside');
  return p;
}
