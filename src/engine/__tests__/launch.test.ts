import { describe, expect, it } from 'vitest';
import { newProject } from '../../data/defaults';
import { computeProject, runScenario } from '../engine';
import { MODEL_ORDER } from '../models';
import { bare, line } from './helpers';

// Kinds whose default drivers include no calendar-month inputs, so a later
// launch is an exact shift of the whole stream.
const PURE_SHIFT = MODEL_ORDER.filter((k) => !['enterprise', 'licensing', 'manufacturing', 'services'].includes(k));

describe('first month of sales', () => {
  it.each(PURE_SHIFT)('moves every %s revenue, cost and invoice later by the delay', (kind) => {
    const p = newProject(kind);
    p.roles = []; p.expenses = []; p.funding = [];
    const early = computeProject(p);
    p.streams[0].inputs.salesStartMonth.v = 4;
    const late = computeProject(p);
    for (const key of ['revenue', 'direct', 'billings'] as const) {
      const a = early.rows.map((r) => r[key]);
      const b = late.rows.map((r) => r[key]);
      expect(b.slice(0, 3)).toEqual([0, 0, 0]);
      for (let i = 0; i < a.length - 3; i++) expect(b[i + 3]).toBeCloseTo(a[i], 6);
    }
  });

  it('hand-calculated: 10 orders a month at $50, launching in month 3', () => {
    const p = bare('ecommerce', { salesStartMonth: 3, ordersStart: 10, aov: 50 }, {}, 5);
    const r = computeProject(p);
    expect(r.rows.map((x) => x.revenue)).toEqual([0, 0, 500, 500, 500]);
  });

  it('keeps month-number inputs on the calendar: no licensing deal signs before its earliest month', () => {
    const p = newProject('licensing');
    const s = p.streams[0];
    s.inputs.firstDealMonth.v = 9;
    s.inputs.initialLicensees.v = 0;
    s.inputs.salesStartMonth.v = 6;
    const r = computeProject(p);
    const rev = r.rows.map((x) => x.revenue);
    expect(rev.slice(0, 8).every((v) => v === 0)).toBe(true);
    expect(rev.some((v) => v > 0)).toBe(true);
  });

  it('warns and produces nothing when sales start after the projection ends', () => {
    const p = bare('ecommerce', { salesStartMonth: 10, ordersStart: 100, aov: 50 }, {}, 6);
    const r = computeProject(p);
    expect(r.summary.totalRevenue).toBe(0);
    expect(r.issues.some((i) => i.id.endsWith('launch.after'))).toBe(true);
  });

  it('can be delayed in a scenario through its assumption path', () => {
    const p = newProject('software');
    const id = p.streams[0].id;
    p.scenarios.downside.overrides = { [`stream:${id}:salesStartMonth`]: 7 };
    p.scenarios.downside.adjustments.extraCollectionDays = 0;
    const r = runScenario(p, 'downside');
    expect(r.rows.slice(0, 6).every((x) => x.revenue === 0)).toBe(true);
    expect(line(r.revenueLines, r.revenueLines[0].key).slice(6).some((v) => v > 0)).toBe(true);
  });
});
