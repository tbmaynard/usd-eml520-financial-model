import { describe, expect, it } from 'vitest';
import { newProject, uid } from '../../data/defaults';
import { timesceneProject } from '../../data/timescene';
import { computeProject, effectiveProject, runScenario } from '../engine';
import { MODEL_ORDER } from '../models';
import { sum } from '../timing';
import type { ModelKind, Project } from '../types';
import { bare } from './helpers';

const allKinds: ModelKind[] = MODEL_ORDER;

function withEverything(kind: ModelKind, salesStart = 1): Project {
  const p = newProject(kind, 'Everything on');
  const s = p.streams[0];
  s.inputs.salesStartMonth.v = salesStart;
  for (const k of Object.keys(s.options)) if (typeof s.options[k] === 'boolean') s.options[k] = true;
  p.funding.push({ id: uid(), name: 'Bank loan', kind: 'loan', amount: 50000, month: 3, annualRatePct: 9, termMonths: 36, basis: '', conf: 'unset', example: true });
  p.capex.push({ id: uid(), name: 'Computers', amount: 6000, month: 2, usefulLifeMonths: 36, basis: '', conf: 'unset', example: true });
  return p;
}

describe.each(allKinds.flatMap((k) => [[k, 1], [k, 7]] as [ModelKind, number][]))('accounting identities hold for %s with sales starting in month %i', (kind, salesStart) => {
  const p = withEverything(kind, salesStart);
  const r = computeProject(p);
  const last = r.rows[r.rows.length - 1];

  it('produces finite numbers in every row', () => {
    for (const row of r.rows) for (const [k, v] of Object.entries(row)) if (typeof v === 'number') expect(Number.isFinite(v), `${k} m${row.month}`).toBe(true);
  });
  it('ending cash = starting cash + all net cash changes', () => {
    expect(last.endingCash).toBeCloseTo(p.setup.startingCash.v + sum(r.rows.map((x) => x.netCashChange)), 4);
  });
  it('invoices = cash collected + money still owed by customers', () => {
    expect(sum(r.rows.map((x) => x.billings))).toBeCloseTo(sum(r.rows.map((x) => x.collections)) + last.receivables, 4);
  });
  it('revenue = invoices − deferred revenue', () => {
    expect(sum(r.rows.map((x) => x.revenue))).toBeCloseTo(sum(r.rows.map((x) => x.billings)) - last.deferredRevenue, 4);
  });
  it('costs incurred + inventory bought = cash paid + bills still owed', () => {
    const incurred = sum(r.rows.map((x) => x.direct + x.opex)) + last.inventory;
    const paid = sum(r.rows.map((x) => x.paidDirect + x.paidOpex + x.paidPersonnel)) + last.payables;
    expect(incurred).toBeCloseTo(paid, 4);
  });
  it('gross profit − operating expenses = EBITDA; EBITDA − depreciation = operating profit', () => {
    for (const row of r.rows) {
      expect(row.grossProfit - row.opex).toBeCloseTo(row.ebitda, 6);
      expect(row.ebitda - row.depreciation).toBeCloseTo(row.operatingProfit, 6);
    }
  });
  it('loan is repaid on schedule and principal reduces debt', () => {
    const repaid = sum(r.rows.map((x) => x.principalPaid));
    expect(last.debt).toBeCloseTo(50000 - repaid, 4);
  });
});

describe('team plan and hiring', () => {
  it('a hire adds cost only from the hiring month, not retroactively', () => {
    const p = bare('software', {}, { subscription: false }, 6);
    p.roles.push({ id: 'r1', title: 'Engineer', count: 1, monthlyComp: 10000, burdenPct: 20, startMonth: 4, endMonth: null, annualRaisePct: 0, dept: 'product', basis: '', conf: 'unset', example: false });
    const r = computeProject(p);
    expect(r.rows.map((x) => x.personnel)).toEqual([0, 0, 0, 12000, 12000, 12000]);
  });
  it('delivery staff count as direct costs, not operating expenses', () => {
    const p = bare('software', {}, { subscription: false }, 2);
    p.roles.push({ id: 'r1', title: 'Implementer', count: 2, monthlyComp: 5000, burdenPct: 0, startMonth: 1, endMonth: null, annualRaisePct: 0, dept: 'delivery', basis: '', conf: 'unset', example: false });
    const r = computeProject(p);
    expect(r.rows[0].direct).toBe(10000);
    expect(r.rows[0].opex).toBe(0);
  });
  it('one-time expenses hit once; recurring ones every month from their start', () => {
    const p = bare('software', {}, { subscription: false }, 4);
    p.expenses.push({ id: 'e1', name: 'Setup', category: 'ga', kind: 'one-time', amount: 3000, startMonth: 2, endMonth: null, annualGrowthPct: 0, payDelayDays: 0, basis: '', conf: 'unset', example: false });
    p.expenses.push({ id: 'e2', name: 'Rent', category: 'ga', kind: 'recurring', amount: 1000, startMonth: 3, endMonth: null, annualGrowthPct: 0, payDelayDays: 30, basis: '', conf: 'unset', example: false });
    const r = computeProject(p);
    expect(r.rows.map((x) => x.ga)).toEqual([0, 3000, 1000, 1000]);
    expect(r.rows.map((x) => x.paidOpex)).toEqual([0, 3000, 0, 1000]); // rent paid 30 days late
  });
});

describe('taxes', () => {
  it('a C corporation pays tax on profit after using earlier losses, the month after each quarter', () => {
    const p = bare('services', { newClientsPerMonth: 1, projectDurationMonths: 12, hoursPerClientMonth: 100, billingRate: 100, consultantsStart: 5, hoursPerPerson: 160, utilizationPct: 100 }, {}, 6);
    p.expenses.push({ id: 'e1', name: 'Launch', category: 'sm', kind: 'one-time', amount: 25000, startMonth: 1, endMonth: null, annualGrowthPct: 0, payDelayDays: 0, basis: '', conf: 'unset', example: false });
    p.tax = { ...p.tax, enabled: true, entity: 'c_corp', payment: 'quarterly' };
    p.tax.rate.v = 20;
    const r = computeProject(p);
    // Revenue: 10k, 20k, 30k, 40k, 50k, 60k. Month 1 pretax = 10k − 25k = −15k.
    expect(r.rows[0].tax).toBe(0);
    expect(r.rows[1].tax).toBeCloseTo(1000); // 20k profit, 15k of carried loss used → 5k × 20%
    expect(r.rows[2].tax).toBeCloseTo(6000); // 30k × 20%
    expect(r.rows[3].taxPaid).toBeCloseTo(7000); // Q1 taxes paid in month 4
  });
});

describe('scenarios change underlying assumptions', () => {
  it('downside overrides change the driver, not the totals', () => {
    const p = newProject('software');
    const eff = effectiveProject(p, 'downside');
    const key = 'subNewPerMonth';
    expect(eff.streams[0].inputs[key].v).toBeLessThan(p.streams[0].inputs[key].v);
    expect(runScenario(p, 'downside').summary.totalRevenue).toBeLessThan(runScenario(p, 'base').summary.totalRevenue);
    expect(runScenario(p, 'upside').summary.totalRevenue).toBeGreaterThan(runScenario(p, 'base').summary.totalRevenue);
  });
  it('hiring delay moves planned hires later and lowers personnel cost', () => {
    const p = newProject('software');
    p.scenarios.downside.overrides = {};
    p.scenarios.downside.adjustments = { hiringDelayMonths: 3, extraCollectionDays: 0, compChangePct: 0 };
    const base = runScenario(p, 'base').rows.reduce((s, r) => s + r.personnel, 0);
    const delayed = runScenario(p, 'downside').rows.reduce((s, r) => s + r.personnel, 0);
    expect(delayed).toBeLessThan(base);
  });
});

describe('cash outcomes', () => {
  it('flags a cash shortfall even when ending cash is positive', () => {
    const p = bare('software', { subNewPerMonth: 20, subPrice: 100, subCac: 50, collectionDays: 0 }, { subscription: true }, 12);
    p.roles.push({ id: 'r', title: 'Team', count: 1, monthlyComp: 6000, burdenPct: 0, startMonth: 1, endMonth: null, annualRaisePct: 0, dept: 'admin', basis: '', conf: 'unset', example: false });
    p.funding.push({ id: 'f', name: 'Late investment', kind: 'equity', amount: 50000, month: 6, annualRatePct: 0, termMonths: 0, basis: '', conf: 'unset', example: false });
    const r = computeProject(p);
    expect(r.summary.minCash).toBeLessThan(0);
    expect(r.summary.endingCash).toBeGreaterThan(0);
    expect(r.summary.hiddenShortfall).toBe(true);
    expect(r.summary.fundingRequired).toBeCloseTo(-r.summary.minCash);
  });
  it('reports sustained break-even when revenue exceeds all costs', () => {
    const p = bare('services', { newClientsPerMonth: 2, projectDurationMonths: 6, hoursPerClientMonth: 80, billingRate: 150, consultantsStart: 3, hoursPerPerson: 160, utilizationPct: 75, consultantSalary: 7000, burdenPct: 20 }, {}, 12);
    const r = computeProject(p);
    expect(r.summary.operatingBreakEvenMonth).not.toBeNull();
    const after = r.rows.filter((x) => x.month >= (r.summary.operatingBreakEvenMonth ?? 99));
    expect(after.every((x) => x.revenue > x.direct + x.opex)).toBe(true);
  });
});

describe('TimeScene demonstration', () => {
  it('runs all three public-sector scenarios with the expected ordering', () => {
    const p = timesceneProject();
    const [down, base, up] = (['downside', 'base', 'upside'] as const).map((s) => runScenario(p, s).summary);
    expect(down.totalRevenue).toBeLessThan(base.totalRevenue);
    expect(base.totalRevenue).toBeLessThan(up.totalRevenue);
    expect(down.minCash).toBeLessThanOrEqual(base.minCash);
  });
  it('shows a long sales cycle before the first contract revenue', () => {
    const r = runScenario(timesceneProject(), 'base');
    const firstSoftware = r.revenueLines.find((l) => l.key.endsWith('.software'))!.values.findIndex((v) => v > 0);
    expect(firstSoftware).toBeGreaterThanOrEqual(6);
  });
});
