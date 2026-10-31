// Project files: a JSON document students download to keep their work and
// instructors open to review it.

import { a, emptyScenarios, makeStream, newProject } from '../data/defaults';
import { getModule, MODULES } from '../engine/models';
import { defaultExit, type ExitSettings } from '../engine/exit';
import type { Assumption, ModelKind, Project, Stream } from '../engine/types';

export const FILE_FORMAT = 'venture-financial-model';
export const FILE_EXT = '.vfm.json';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(name: string): string {
  return (name || 'venture').replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'venture';
}

export function downloadProject(p: Project): void {
  const doc = { format: FILE_FORMAT, version: 1, exportedAt: new Date().toISOString(), project: p };
  downloadBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `${safeFileName(p.setup.name)}${FILE_EXT}`);
}

export async function readProjectFile(file: File): Promise<Project> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not a project file (it could not be read as JSON).');
  }
  const obj = raw as { format?: string; project?: unknown };
  const candidate = obj && obj.format === FILE_FORMAT ? obj.project : raw;
  return normalizeProject(candidate);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function normA(x: unknown, fallback: Assumption): Assumption {
  if (!isObj(x)) return fallback;
  const v = Number(x.v);
  return {
    v: Number.isFinite(v) ? v : fallback.v,
    basis: typeof x.basis === 'string' ? x.basis : '',
    conf: (['evidence', 'benchmark', 'speculative', 'unset'] as const).includes(x.conf as Assumption['conf']) ? (x.conf as Assumption['conf']) : 'unset',
    example: x.example === true,
  };
}

function normStream(x: unknown): Stream | null {
  if (!isObj(x) || typeof x.kind !== 'string' || !(x.kind in MODULES)) return null;
  const kind = x.kind as ModelKind;
  const fresh = makeStream(kind, typeof x.name === 'string' ? x.name : undefined, typeof x.id === 'string' ? x.id : undefined);
  const inputs = isObj(x.inputs) ? x.inputs : {};
  for (const f of getModule(kind).fields) fresh.inputs[f.key] = normA(inputs[f.key], fresh.inputs[f.key]);
  if (isObj(x.options)) fresh.options = { ...fresh.options, ...(x.options as Stream['options']) };
  return fresh;
}

/**
 * Accept a project from a file or from browser storage, filling in anything
 * missing from older versions so the engine never sees undefined values.
 */
export function normalizeProject(raw: unknown): Project {
  if (!isObj(raw) || !isObj(raw.setup) || !Array.isArray(raw.streams)) {
    throw new Error('This file does not look like a venture financial model project.');
  }
  const streams = (raw.streams as unknown[]).map(normStream).filter((s): s is Stream => !!s);
  if (!streams.length) throw new Error('The project file does not contain a business model this app recognizes.');
  const base = newProject(streams[0].kind);
  const setup = raw.setup as Record<string, unknown>;
  const scen = isObj(raw.scenarios) ? raw.scenarios : {};
  const scenarios = emptyScenarios();
  for (const id of ['base', 'downside', 'upside'] as const) {
    const s = scen[id];
    if (!isObj(s)) continue;
    const adj = isObj(s.adjustments) ? s.adjustments : {};
    scenarios[id] = {
      id,
      label: typeof s.label === 'string' ? s.label : scenarios[id].label,
      overrides: isObj(s.overrides) ? Object.fromEntries(Object.entries(s.overrides).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)])) : {},
      adjustments: {
        hiringDelayMonths: Number(adj.hiringDelayMonths) || 0,
        extraCollectionDays: Number(adj.extraCollectionDays) || 0,
        compChangePct: Number(adj.compChangePct) || 0,
      },
      notes: typeof s.notes === 'string' ? s.notes : '',
    };
  }
  const tax = isObj(raw.tax) ? raw.tax : {};
  const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  return {
    schemaVersion: 1,
    id: typeof raw.id === 'string' ? raw.id : base.id,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
    setup: {
      name: typeof setup.name === 'string' ? setup.name : base.setup.name,
      description: typeof setup.description === 'string' ? setup.description : '',
      industry: typeof setup.industry === 'string' ? setup.industry : '',
      startMonth: typeof setup.startMonth === 'string' && /^\d{4}-\d{2}$/.test(setup.startMonth) ? setup.startMonth : base.setup.startMonth,
      months: [12, 24, 36].includes(Number(setup.months)) ? Number(setup.months) : 24,
      startingCash: normA(setup.startingCash, base.setup.startingCash),
      founderInvestment: normA(setup.founderInvestment, base.setup.founderInvestment),
      minCashCushion: normA(setup.minCashCushion, base.setup.minCashCushion),
      largestCustomerSharePct: normA(setup.largestCustomerSharePct, a(10)),
    },
    streams,
    roles: arr<Project['roles'][number]>(raw.roles).filter(isObj).map((r) => ({ ...base.roles[0], ...r })),
    expenses: arr<Project['expenses'][number]>(raw.expenses).filter(isObj).map((e) => ({ ...base.expenses[0], ...e })),
    capex: arr<Project['capex'][number]>(raw.capex).filter(isObj),
    funding: arr<Project['funding'][number]>(raw.funding).filter(isObj),
    tax: {
      enabled: tax.enabled !== false,
      entity: tax.entity === 'pass_through' ? 'pass_through' : 'c_corp',
      rate: normA(tax.rate, base.tax.rate),
      payment: tax.payment === 'annual' ? 'annual' : 'quarterly',
      includeOwnerDistributions: tax.includeOwnerDistributions !== false,
    },
    scenarios,
    reviewResponses: isObj(raw.reviewResponses) ? (raw.reviewResponses as Record<string, string>) : {},
    reflection: typeof raw.reflection === 'string' ? raw.reflection : '',
    exit: normExit(raw.exit, defaultExit({ streams, funding: [] })),
  };
}

function normExit(x: unknown, d: ExitSettings): ExitSettings {
  if (!isObj(x)) return d;
  const num = (v: unknown, f: number) => (Number.isFinite(Number(v)) ? Number(v) : f);
  const sub = <T extends Record<string, number>>(v: unknown, f: T): T => {
    const o = isObj(v) ? v : {};
    return Object.fromEntries(Object.entries(f).map(([k, fv]) => [k, num(o[k], fv)])) as T;
  };
  const founders = Array.isArray(x.founders) ? (x.founders as unknown[]).filter(isObj).map((f, i) => ({ id: String(f.id ?? `f${i}`), name: String(f.name ?? 'Founder'), pct: num(f.pct, 0) })) : d.founders;
  const rounds = Array.isArray(x.rounds) ? (x.rounds as unknown[]).filter(isObj).map((r, i) => ({ id: String(r.id ?? `r${i}`), name: String(r.name ?? 'Round'), kind: r.kind === 'priced' ? 'priced' as const : 'safe' as const, amount: num(r.amount, 0), valuation: num(r.valuation, 0) })) : d.rounds;
  return {
    ...d,
    founders: founders.length ? founders : d.founders,
    rounds,
    poolPct: num(x.poolPct, d.poolPct), prefMultiple: num(x.prefMultiple, d.prefMultiple), participating: x.participating === true,
    exitYear: num(x.exitYear, d.exitYear), growthPct: num(x.growthPct, d.growthPct), exitMarginPct: num(x.exitMarginPct, d.exitMarginPct),
    netCashAtExit: num(x.netCashAtExit, d.netCashAtExit), feesPct: num(x.feesPct, d.feesPct),
    capGainsFedPct: num(x.capGainsFedPct, d.capGainsFedPct), capGainsStatePct: num(x.capGainsStatePct, d.capGainsStatePct), ordinaryRatePct: num(x.ordinaryRatePct, d.ordinaryRatePct),
    qsbs: x.qsbs !== false,
    strategic: sub(x.strategic, d.strategic), pe: sub(x.pe, d.pe), ipo: sub(x.ipo, d.ipo), acquihire: sub(x.acquihire, d.acquihire), lifestyle: sub(x.lifestyle, d.lifestyle),
    focus: typeof x.focus === 'string' ? x.focus : 'all',
  };
}
