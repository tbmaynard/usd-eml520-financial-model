// "First month of sales": a driver every business model shares. Many ventures
// spend months on research and development, approvals or building inventory
// before they can sell anything. Rather than teach each model about that, the
// stream is calculated as if it launched in month 1 and the whole result is
// then moved later. Month-number inputs inside the stream (for example a first
// certification audit) stay calendar months of the projection.

import { val } from '../timing';
import type { Issue, StreamResult } from '../types';
import type { FieldSpec, Inputs, ModelModule } from './moduleTypes';

export const SALES_START_KEY = 'salesStartMonth';

export const SALES_START_FIELD: FieldSpec = {
  key: SALES_START_KEY,
  label: 'First month of sales',
  unit: 'month',
  help: 'The month this revenue stream starts selling. Use a later month if you first need time for research and development, approvals or building inventory. Everything in this stream, including its own costs and pipeline, starts in this month and its other drivers describe the months after launch. Put spending before launch (engineers, prototypes) in the team plan and operating expenses.',
  group: 'Launch timing',
  min: 1,
  sensitivity: true,
  scenario: true,
  worseWhen: 'higher',
};

/** Months the stream is moved later (0 when it sells from month 1). */
export function launchOffset(inputs: Inputs): number {
  const m = Math.round(val(inputs, SALES_START_KEY));
  return Number.isFinite(m) && m > 1 ? m - 1 : 0;
}

function shiftSeries(values: number[] | undefined, offset: number, n: number): number[] {
  const out = new Array<number>(n).fill(0);
  if (!values) return out;
  for (let i = 0; i + offset < n && i < values.length; i++) out[i + offset] = values[i];
  return out;
}

/** Move every monthly series in a stream result `offset` months later. */
export function shiftResult(r: StreamResult, offset: number, n: number): StreamResult {
  const lines = <T extends { values: number[] }>(ls: T[]) => ls.map((l) => ({ ...l, values: shiftSeries(l.values, offset, n) }));
  return {
    revenue: lines(r.revenue),
    direct: lines(r.direct),
    opex: lines(r.opex),
    billings: lines(r.billings),
    payables: lines(r.payables),
    capex: r.capex.map((c) => ({ ...c, month: c.month + offset })),
    metrics: lines(r.metrics),
    issues: r.issues.map((i): Issue => (i.months ? { ...i, months: i.months.map((m) => m + offset).filter((m) => m <= n) } : i)),
    largestCustomerShare: r.largestCustomerShare ? shiftSeries(r.largestCustomerShare, offset, n) : undefined,
    inventory: r.inventory ? shiftSeries(r.inventory, offset, n) : undefined,
  };
}

/** Add the shared "First month of sales" driver to a business-model module. */
export function withLaunch(mod: ModelModule): ModelModule {
  return {
    ...mod,
    fields: [SALES_START_FIELD, ...mod.fields],
    defaults: { [SALES_START_KEY]: 1, ...mod.defaults },
    compute(inputs, options, ctx) {
      const offset = launchOffset(inputs);
      if (!offset) return mod.compute(inputs, options, ctx);
      const n = ctx.months;
      const len = n - offset;
      if (len <= 0) {
        return {
          revenue: [], direct: [], opex: [], billings: [], payables: [], capex: [], metrics: [],
          issues: [{ id: 'launch.after', level: 'warn', message: `Sales start in month ${offset + 1}, after the projection ends, so this stream has no revenue or costs in the projection.` }],
        };
      }
      // Month-number inputs are calendar months; convert them to months after launch.
      const local = { ...inputs };
      for (const f of mod.fields) {
        if (f.unit === 'month' && local[f.key]) local[f.key] = { ...local[f.key], v: Math.max(1, local[f.key].v - offset) };
      }
      return shiftResult(mod.compute(local, options, { ...ctx, months: len }), offset, n);
    },
  };
}
