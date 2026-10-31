// The shared monthly financial engine. Every business model feeds into this
// one function, which produces a simplified income statement, a cash-flow
// projection, balances (receivables, payables, deferred revenue, inventory,
// debt) and summary metrics.

import { getModule } from './models';
import { clone, setValue } from './paths';
import {
  addInto,
  applyDelay,
  cumulative,
  depreciationSeries,
  loanPayment,
  monthLabel,
  sum,
  zeros,
} from './timing';
import type {
  CapexItem,
  Issue,
  Line,
  MonthRow,
  OpexLine,
  Project,
  ProjectResult,
  ScenarioId,
  StreamResult,
  Summary,
} from './types';
import { OPEX_LABELS } from './types';

/** Apply a scenario's overrides and adjustments to a copy of the project. */
export function effectiveProject(p: Project, scenarioId: ScenarioId): Project {
  const q = clone(p);
  if (scenarioId === 'base') return q;
  const sc = p.scenarios[scenarioId];
  if (!sc) return q;
  for (const [path, v] of Object.entries(sc.overrides)) {
    if (Number.isFinite(v)) setValue(q, path, v);
  }
  const { hiringDelayMonths, compChangePct } = sc.adjustments;
  if (hiringDelayMonths) {
    for (const r of q.roles) if (r.startMonth > 1) r.startMonth += hiringDelayMonths;
    for (const s of q.streams) {
      if (s.kind === 'services' && s.inputs.consultantsAddedMonth && s.inputs.consultantsAddedMonth.v > 1) {
        s.inputs.consultantsAddedMonth.v += hiringDelayMonths;
      }
    }
  }
  if (compChangePct) {
    const f = 1 + compChangePct / 100;
    for (const r of q.roles) r.monthlyComp *= f;
    for (const s of q.streams) {
      if (s.kind === 'services') {
        if (s.inputs.consultantSalary) s.inputs.consultantSalary.v *= f;
        if (s.inputs.adminSalary) s.inputs.adminSalary.v *= f;
      }
    }
  }
  return q;
}

export function runScenario(p: Project, scenarioId: ScenarioId): ProjectResult {
  const extra = scenarioId === 'base' ? 0 : p.scenarios[scenarioId]?.adjustments.extraCollectionDays ?? 0;
  return computeProject(effectiveProject(p, scenarioId), extra);
}

export function computeProject(p: Project, extraCollectionDays = 0): ProjectResult {
  const n = Math.max(1, Math.min(60, Math.round(p.setup.months || 24)));
  const months = Array.from({ length: n }, (_, i) => i + 1);
  const issues: Issue[] = [];

  // ---------------- Business-model streams
  const streams = p.streams.map((stream) => {
    const mod = getModule(stream.kind);
    let result: StreamResult;
    try {
      result = mod.compute(stream.inputs, { ...mod.defaultOptions, ...stream.options }, { months: n, extraCollectionDays });
    } catch (err) {
      result = emptyStream(n);
      result.issues.push({ id: `${stream.id}.error`, level: 'warn', message: `This business line could not be calculated: ${(err as Error).message}` });
    }
    result = sanitize(result, n);
    const prefix = p.streams.length > 1 ? `${stream.name}: ` : '';
    for (const iss of result.issues) issues.push({ ...iss, id: `${stream.id}.${iss.id}`, message: prefix + iss.message });
    return { stream, result };
  });

  const multi = p.streams.length > 1;
  const tag = (name: string, label: string) => (multi ? `${label} (${name})` : label);
  const revenueLines: Line[] = [];
  const directLines: Line[] = [];
  const opexLines: OpexLine[] = [];
  for (const { stream, result } of streams) {
    for (const l of result.revenue) revenueLines.push({ ...l, key: `${stream.id}.${l.key}`, label: tag(stream.name, l.label) });
    for (const l of result.direct) directLines.push({ ...l, key: `${stream.id}.${l.key}`, label: tag(stream.name, l.label) });
    for (const l of result.opex) opexLines.push({ ...l, key: `${stream.id}.${l.key}`, label: tag(stream.name, l.label) });
  }

  // ---------------- Team plan
  const personnelLines: Line[] = [];
  const deliveryPersonnel = zeros(n);
  const operatingPersonnel = zeros(n);
  for (const r of p.roles) {
    const values = months.map((m) => {
      if (m < r.startMonth) return 0;
      if (r.endMonth != null && r.endMonth > 0 && m > r.endMonth) return 0;
      const years = Math.floor((m - r.startMonth) / 12);
      const wages = Math.max(0, r.count) * Math.max(0, r.monthlyComp) * Math.pow(1 + (r.annualRaisePct || 0) / 100, years);
      return wages * (1 + Math.max(0, r.burdenPct || 0) / 100);
    });
    if (r.dept === 'delivery') {
      directLines.push({ key: `role.${r.id}`, label: `${r.title} (delivery staff)`, values });
      addInto(deliveryPersonnel, values);
    } else {
      personnelLines.push({ key: `role.${r.id}`, label: r.title, values });
      addInto(operatingPersonnel, values);
    }
  }

  // ---------------- Operating expenses
  const expensePayables: { values: number[]; days: number }[] = [];
  for (const e of p.expenses) {
    const values = months.map((m) => {
      if (e.kind === 'one-time') return m === e.startMonth ? Math.max(0, e.amount) : 0;
      if (m < e.startMonth) return 0;
      if (e.endMonth != null && e.endMonth > 0 && m > e.endMonth) return 0;
      const years = Math.floor((m - e.startMonth) / 12);
      return Math.max(0, e.amount) * Math.pow(1 + (e.annualGrowthPct || 0) / 100, years);
    });
    opexLines.push({ key: `exp.${e.id}`, label: e.name, category: e.category, values });
    expensePayables.push({ values, days: e.payDelayDays || 0 });
  }

  // ---------------- Capital spending
  const allCapex: CapexItem[] = [...p.capex, ...streams.flatMap((s) => s.result.capex)];
  const capexPaid = zeros(n);
  const depreciation = zeros(n);
  for (const c of allCapex) {
    if (c.month >= 1 && c.month <= n) capexPaid[c.month - 1] += Math.max(0, c.amount);
    addInto(depreciation, depreciationSeries(n, Math.max(0, c.amount), c.month, c.usefulLifeMonths));
  }

  // ---------------- Funding and debt
  const equity = zeros(n);
  const loanProceeds = zeros(n);
  const interest = zeros(n);
  const principal = zeros(n);
  const debt = zeros(n);
  for (const f of p.funding) {
    const m = Math.round(f.month);
    if (m < 1 || m > n || !(f.amount > 0)) continue;
    if (f.kind === 'loan') {
      loanProceeds[m - 1] += f.amount;
      const pay = loanPayment(f.amount, f.annualRatePct, f.termMonths);
      const r = (f.annualRatePct || 0) / 100 / 12;
      let bal = f.amount;
      for (let i = m - 1; i < n; i++) {
        if (i > m - 1 && bal > 1e-6) {
          const int = bal * r;
          const prin = Math.min(bal, pay - int);
          interest[i] += int;
          principal[i] += prin;
          bal -= prin;
        }
        debt[i] += bal;
      }
    } else {
      equity[m - 1] += f.amount;
    }
  }
  const founder = zeros(n);
  founder[0] = Math.max(0, p.setup.founderInvestment.v || 0);

  // ---------------- Income statement
  const revenue = zeros(n);
  const direct = zeros(n);
  for (const l of revenueLines) addInto(revenue, l.values);
  for (const l of directLines) addInto(direct, l.values);
  const cat = { sm: zeros(n), rd: zeros(n), ga: zeros(n), other: zeros(n) };
  for (const l of opexLines) addInto(cat[l.category], l.values);

  const grossProfit = revenue.map((r, i) => r - direct[i]);
  const opex = months.map((_, i) => operatingPersonnel[i] + cat.sm[i] + cat.rd[i] + cat.ga[i] + cat.other[i]);
  const ebitda = grossProfit.map((g, i) => g - opex[i]);
  const operatingProfit = ebitda.map((e, i) => e - depreciation[i]);
  const pretax = operatingProfit.map((o, i) => o - interest[i]);

  // ---------------- Taxes (coarse)
  const taxExpense = zeros(n);
  const ownerTax = zeros(n);
  const taxPaid = zeros(n);
  const ownerDistributions = zeros(n);
  if (p.tax.enabled) {
    const rate = Math.max(0, Math.min(100, p.tax.rate.v || 0)) / 100;
    let lossCarried = 0;
    const accrued = zeros(n);
    for (let i = 0; i < n; i++) {
      const x = pretax[i];
      if (x < 0) { lossCarried += -x; continue; }
      const used = Math.min(lossCarried, x);
      lossCarried -= used;
      accrued[i] = (x - used) * rate;
    }
    const isCorp = p.tax.entity === 'c_corp';
    if (isCorp) addInto(taxExpense, accrued);
    else addInto(ownerTax, accrued);
    const cashOut = isCorp ? taxPaid : ownerDistributions;
    if (isCorp || p.tax.includeOwnerDistributions) {
      if (p.tax.payment === 'quarterly') {
        // Paid the month after each quarter ends.
        for (let i = 0; i < n; i++) {
          const payMonth = Math.floor(i / 3) * 3 + 3; // index of month after quarter end
          if (payMonth < n) cashOut[payMonth] += accrued[i];
        }
      } else {
        // Paid three months after each 12-month tax year ends (like an April filing).
        for (let i = 0; i < n; i++) {
          const payMonth = Math.floor(i / 12) * 12 + 12 + 3;
          if (payMonth < n) cashOut[payMonth] += accrued[i];
        }
      }
    }
  }
  const netIncome = pretax.map((x, i) => x - taxExpense[i]);

  // ---------------- Cash timing
  const collections = zeros(n);
  const receivables = zeros(n);
  const billingsTotal = zeros(n);
  const paidDirect = zeros(n);
  const paidOpex = zeros(n);
  const payablesBal = zeros(n);
  const inventory = zeros(n);
  const deferred = zeros(n);
  for (const { result } of streams) {
    const streamBillings = zeros(n);
    for (const b of result.billings) {
      const { paid, outstanding } = applyDelay(b.values, b.days);
      addInto(collections, paid);
      addInto(receivables, outstanding);
      addInto(streamBillings, b.values);
    }
    addInto(billingsTotal, streamBillings);
    const streamRev = zeros(n);
    for (const l of result.revenue) addInto(streamRev, l.values);
    const cb = cumulative(streamBillings);
    const cr = cumulative(streamRev);
    addInto(deferred, cb.map((b, i) => b - cr[i]));
    for (const pay of result.payables) {
      const { paid, outstanding } = applyDelay(pay.values, pay.days);
      addInto(pay.kind === 'opex' ? paidOpex : paidDirect, paid);
      addInto(payablesBal, outstanding);
    }
    if (result.inventory) addInto(inventory, result.inventory);
  }
  for (const e of expensePayables) {
    const { paid, outstanding } = applyDelay(e.values, e.days);
    addInto(paidOpex, paid);
    addInto(payablesBal, outstanding);
  }
  addInto(paidDirect, deliveryPersonnel); // salaries paid when earned
  const paidPersonnel = operatingPersonnel.slice();

  const rows: MonthRow[] = [];
  let cash = p.setup.startingCash.v || 0;
  let cumBurn = 0;
  for (let i = 0; i < n; i++) {
    const beginningCash = cash;
    const operatingCashFlow = collections[i] - paidDirect[i] - paidOpex[i] - paidPersonnel[i] - interest[i] - taxPaid[i];
    const netCashChange = operatingCashFlow - capexPaid[i] + founder[i] + equity[i] + loanProceeds[i] - principal[i] - ownerDistributions[i];
    cash = beginningCash + netCashChange;
    const burn = -(operatingCashFlow - capexPaid[i]);
    cumBurn += burn;
    rows.push({
      month: i + 1,
      label: monthLabel(p.setup.startMonth, i + 1),
      revenue: revenue[i],
      direct: direct[i],
      grossProfit: grossProfit[i],
      grossMargin: revenue[i] > 0 ? grossProfit[i] / revenue[i] : null,
      personnel: operatingPersonnel[i],
      sm: cat.sm[i],
      rd: cat.rd[i],
      ga: cat.ga[i],
      other: cat.other[i],
      opex: opex[i],
      ebitda: ebitda[i],
      depreciation: depreciation[i],
      operatingProfit: operatingProfit[i],
      interest: interest[i],
      pretax: pretax[i],
      tax: taxExpense[i],
      netIncome: netIncome[i],
      beginningCash,
      collections: collections[i],
      founder: founder[i],
      equity: equity[i],
      loanProceeds: loanProceeds[i],
      paidDirect: paidDirect[i],
      paidOpex: paidOpex[i],
      paidPersonnel: paidPersonnel[i],
      capexPaid: capexPaid[i],
      interestPaid: interest[i],
      principalPaid: principal[i],
      taxPaid: taxPaid[i],
      ownerDistributions: ownerDistributions[i],
      operatingCashFlow,
      netCashChange,
      endingCash: cash,
      billings: billingsTotal[i],
      receivables: receivables[i],
      payables: payablesBal[i],
      deferredRevenue: deferred[i],
      inventory: inventory[i],
      debt: debt[i],
      burn,
      cumulativeBurn: cumBurn,
    });
  }

  // ---------------- Concentration
  const largestCustomerShare = months.map((_, i) => {
    if (revenue[i] <= 0) return 0;
    let largest = 0;
    for (const { result } of streams) {
      const r = sum(result.revenue.map((l) => l.values[i]));
      const share = result.largestCustomerShare ? result.largestCustomerShare[i] : (p.setup.largestCustomerSharePct.v || 0) / 100;
      largest = Math.max(largest, r * share);
    }
    return Math.min(1, largest / revenue[i]);
  });

  const summary = summarize(rows, p, ownerTax);
  if (summary.hiddenShortfall) {
    issues.push({ id: 'cash.hidden', level: 'warn', message: `Cash ends positive, but drops below zero in month ${summary.firstNegativeCashMonth}. A positive ending balance does not mean the plan works: the business would need money it does not have before then.` });
  }

  return {
    rows,
    summary,
    streams,
    revenueLines,
    directLines,
    personnelLines,
    opexLines,
    issues,
    largestCustomerShare,
  };
}

function summarize(rows: MonthRow[], p: Project, _ownerTax: number[]): Summary {
  const n = rows.length;
  const s = (k: keyof MonthRow) => rows.reduce((a, r) => a + (r[k] as number), 0);
  const totalRevenue = s('revenue');
  const totalDirect = s('direct');
  const totalOpex = s('opex');
  let minCash = rows[0].endingCash;
  let minCashMonth = 1;
  let firstNeg: number | null = null;
  for (const r of rows) {
    if (r.endingCash < minCash) { minCash = r.endingCash; minCashMonth = r.month; }
    if (firstNeg == null && r.endingCash < 0) firstNeg = r.month;
  }
  const last3 = rows.slice(-3);
  const currentBurn = last3.reduce((a, r) => a + r.burn, 0) / last3.length;
  const peakBurn = Math.max(...rows.map((r) => r.burn));
  const endingCash = rows[n - 1].endingCash;

  let runwayMonths: number | null = null;
  let runwayLabel: string;
  if (firstNeg != null) {
    runwayMonths = firstNeg - 1;
    runwayLabel = `Cash runs out in month ${firstNeg} (${rows[firstNeg - 1].label})`;
  } else if (currentBurn > 0) {
    runwayMonths = n + endingCash / currentBurn;
    runwayLabel = `About ${Math.floor(endingCash / currentBurn)} months beyond the projection at the current burn`;
  } else {
    runwayLabel = 'Not burning cash at the end of the projection';
  }

  const sustained = (pred: (r: MonthRow) => boolean): number | null => {
    if (!pred(rows[n - 1])) return null;
    let m = n;
    for (let i = n - 1; i >= 0; i--) {
      if (pred(rows[i])) m = rows[i].month;
      else break;
    }
    return m;
  };
  const operatingBreakEvenMonth = sustained((r) => r.operatingProfit >= 0 && r.revenue > 0);
  const cashBreakEvenMonth = sustained((r) => r.burn <= 0 && r.revenue > 0);
  const cushion = Math.max(0, p.setup.minCashCushion.v || 0);
  const fundingRequired = Math.max(0, cushion - minCash);
  const totalFundingIn = s('founder') + s('equity') + s('loanProceeds');
  // Compare 3-month averages six months apart, so lumpy months do not dominate.
  const avg3 = (end: number) => (end >= 3 ? rows.slice(end - 3, end).reduce((a, r) => a + r.revenue, 0) / 3 : 0);
  const recent = avg3(n);
  const earlier = n >= 9 ? avg3(n - 6) : 0;
  const revenueGrowthLast6 = earlier > 0 && recent > 0 ? Math.pow(recent / earlier, 1 / 6) - 1 : null;

  return {
    months: n,
    totalRevenue,
    totalDirect,
    totalOpex,
    totalExpenses: totalDirect + totalOpex,
    grossMargin: totalRevenue > 0 ? (totalRevenue - totalDirect) / totalRevenue : null,
    totalEbitda: s('ebitda'),
    totalOperatingProfit: s('operatingProfit'),
    totalNetIncome: s('netIncome'),
    endingCash,
    minCash,
    minCashMonth,
    firstNegativeCashMonth: firstNeg,
    currentBurn,
    peakBurn,
    runwayMonths,
    runwayLabel,
    operatingBreakEvenMonth,
    cashBreakEvenMonth,
    fundingRequired,
    totalFundingIn,
    revenueGrowthLast6,
    hiddenShortfall: endingCash >= 0 && minCash < 0,
  };
}

function emptyStream(n: number): StreamResult {
  return { revenue: [], direct: [], opex: [], billings: [], payables: [], capex: [], metrics: [], issues: [], inventory: zeros(n) };
}

/** Replace NaN/Infinity in money lines with 0 so one bad input cannot poison the totals. */
function sanitize(r: StreamResult, n: number): StreamResult {
  const fix = (v: number[]) => Array.from({ length: n }, (_, i) => (Number.isFinite(v[i]) ? v[i] : 0));
  const fixLines = <T extends { values: number[] }>(ls: T[]) => ls.map((l) => ({ ...l, values: fix(l.values) }));
  return {
    ...r,
    revenue: fixLines(r.revenue),
    direct: fixLines(r.direct),
    opex: fixLines(r.opex),
    billings: fixLines(r.billings),
    payables: fixLines(r.payables),
    inventory: r.inventory ? fix(r.inventory) : undefined,
  };
}

export { OPEX_LABELS };
