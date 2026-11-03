// Exit Strategy (bonus): a simple cap table, a liquidation waterfall, and what
// founders would take home under different kinds of exit. Illustrative only:
// not financial, legal or tax advice.

import type { Funding, ModelKind, Project, ProjectResult } from './types';

export interface CapFounder { id: string; name: string; pct: number }
export interface CapRound {
  id: string;
  name: string;
  /** SAFE: valuation is the post-money cap. Priced: valuation is the pre-money valuation. */
  kind: 'safe' | 'priced';
  amount: number;
  valuation: number;
}

export type ExitKind = 'strategic' | 'pe' | 'ipo' | 'acquihire' | 'lifestyle';

export interface ExitSettings {
  founders: CapFounder[];
  /** Option pool as a percent of the company at founding. */
  poolPct: number;
  /** Later rounds, after the projection. Equity funding inside the projection
   *  comes from the project's funding list (see fundingRounds). */
  rounds: CapRound[];
  prefMultiple: number;
  participating: boolean;
  /** Years after the start of the projection. */
  exitYear: number;
  /** Annual revenue growth after the projection ends. */
  growthPct: number;
  /** EBITDA as a percent of revenue in the exit year. */
  exitMarginPct: number;
  /** Cash minus debt on the balance sheet at exit. */
  netCashAtExit: number;
  feesPct: number;
  /** Combined federal + California long-term capital gains rate. */
  capGainsFedPct: number;
  capGainsStatePct: number;
  ordinaryRatePct: number;
  qsbs: boolean;
  strategic: { multiple: number; cashPct: number; escrowPct: number; earnoutPct: number; earnoutProbPct: number };
  pe: { multiple: number; rolloverPct: number; secondBiteMultiple: number };
  ipo: { multiple: number; sellAtIpoPct: number; underwritingPct: number; afterLockupChangePct: number };
  acquihire: { price: number; retentionPerFounder: number };
  lifestyle: { payoutPct: number; years: number };
  /** Founder id, or 'all' for all founders combined. */
  focus: string;
}

export const MULTIPLES: Record<ModelKind, { revenue: [number, number, number]; ebitda: [number, number, number] }> = {
  software: { revenue: [3, 6, 12], ebitda: [12, 20, 30] },
  enterprise: { revenue: [3, 5, 10], ebitda: [12, 18, 28] },
  manufacturing: { revenue: [0.8, 1.5, 3], ebitda: [5, 8, 12] },
  services: { revenue: [0.6, 1.2, 2], ebitda: [4, 7, 10] },
  ecommerce: { revenue: [0.7, 1.5, 3], ebitda: [6, 10, 15] },
  marketplace: { revenue: [1.5, 3, 6], ebitda: [10, 15, 25] },
  licensing: { revenue: [2, 4, 8], ebitda: [8, 15, 22] },
};

export const FOUNDER_SHARES = 10_000_000;

// ---------------------------------------------------------------------------
// Cap table

export interface Holder {
  id: string;
  name: string;
  group: 'founder' | 'pool' | 'investor';
  shares: number;
  invested: number;
  /** Liquidation preference owed before common (investors only). */
  pref: number;
}

export interface CapStep { label: string; founderPct: number; investorPct: number; poolPct: number; postMoney?: number; pricePerShare?: number }

export interface CapTable { holders: Holder[]; steps: CapStep[]; totalShares: number }

export const DEFAULT_EQUITY_PCT = 12.5;

/** The valuation implied by selling `pct` percent of the company for `amount`.
 *  SAFE: the post-money cap. Priced round: the pre-money valuation. */
export function valuationFromPct(amount: number, pct: number, kind: CapRound['kind']): number {
  const f = Math.min(0.95, Math.max(0.001, pct / 100));
  const post = amount / f;
  return kind === 'safe' ? post : post - amount;
}

/** Percent of the company a round's investors own right after it closes. */
export function pctFromValuation(amount: number, valuation: number, kind: CapRound['kind']): number {
  const post = kind === 'safe' ? valuation : valuation + amount;
  return post > 0 ? (amount / post) * 100 : 0;
}

/** Equity funding in the projection, as cap-table rounds in the order received. */
export function fundingRounds(funding: Funding[]): CapRound[] {
  return funding
    .filter((f) => f.kind === 'equity' && f.amount > 0)
    .slice()
    .sort((a, b) => a.month - b.month)
    .map((f) => {
      const kind = f.instrument ?? 'safe';
      return { id: `fund_${f.id}`, name: f.name, kind, amount: f.amount, valuation: valuationFromPct(f.amount, f.equityPct ?? DEFAULT_EQUITY_PCT, kind) };
    });
}

/** `before` holds rounds that come ahead of the later rounds in `s.rounds`
 *  (equity funding from the projection). */
export function buildCapTable(s: ExitSettings, before: CapRound[] = []): CapTable {
  const totalPct = s.founders.reduce((a, f) => a + Math.max(0, f.pct), 0) || 1;
  const holders: Holder[] = s.founders.map((f) => ({ id: f.id, name: f.name || 'Founder', group: 'founder', shares: (FOUNDER_SHARES * Math.max(0, f.pct)) / totalPct, invested: 0, pref: 0 }));
  const pool = Math.min(0.9, Math.max(0, s.poolPct / 100));
  if (pool > 0) holders.push({ id: 'pool', name: 'Employee option pool', group: 'pool', shares: (FOUNDER_SHARES * pool) / (1 - pool), invested: 0, pref: 0 });
  const total = () => holders.reduce((a, h) => a + h.shares, 0);
  const steps: CapStep[] = [];
  const snap = (label: string, extra: Partial<CapStep> = {}) => {
    const t = total();
    const sum = (g: Holder['group']) => holders.filter((h) => h.group === g).reduce((a, h) => a + h.shares, 0) / t;
    steps.push({ label, founderPct: sum('founder'), investorPct: sum('investor'), poolPct: sum('pool'), ...extra });
  };
  snap('Founding');

  // Post-money SAFEs convert at the next priced round (or at exit): each owns
  // amount ÷ cap of the company just before the new money comes in.
  let pending: CapRound[] = [];
  const convertSafes = () => {
    if (!pending.length) return;
    const f = pending.reduce((a, r) => a + (r.valuation > 0 ? r.amount / r.valuation : 0), 0);
    const fClamped = Math.min(0.95, f);
    const base = total();
    const newShares = (base * fClamped) / (1 - fClamped);
    for (const r of pending) {
      const share = f > 0 && r.valuation > 0 ? (r.amount / r.valuation) / f : 0;
      holders.push({ id: r.id, name: r.name, group: 'investor', shares: newShares * share, invested: r.amount, pref: r.amount * s.prefMultiple });
    }
    pending = [];
  };
  for (const r of [...before, ...s.rounds]) {
    if (!(r.amount > 0)) continue;
    if (r.kind === 'safe') {
      pending.push(r);
      // Show the expected ownership after the SAFE, for the dilution chart.
      continue;
    }
    convertSafes();
    const pre = total();
    const price = r.valuation > 0 ? r.valuation / pre : 0;
    const newShares = price > 0 ? r.amount / price : 0;
    holders.push({ id: r.id, name: r.name, group: 'investor', shares: newShares, invested: r.amount, pref: r.amount * s.prefMultiple });
    snap(r.name, { postMoney: r.valuation + r.amount, pricePerShare: price });
  }
  if (pending.length) {
    const names = pending.map((r) => r.name).join(', ');
    convertSafes();
    snap(`${names} (converted at exit)`);
  }
  return { holders, steps, totalShares: total() };
}

// ---------------------------------------------------------------------------
// Liquidation waterfall

/**
 * Split `equity` among holders. Non-participating preferred takes the greater
 * of its preference or its as-converted share; participating preferred takes
 * its preference and then shares the rest. All preferences rank equally.
 * `convertAll` treats every share as common (an IPO converts preferred).
 */
export function waterfall(holders: Holder[], equity: number, prefMultipleParticipating: boolean, convertAll = false): Map<string, number> {
  const out = new Map<string, number>();
  const E = Math.max(0, equity);
  const prefHolders = convertAll ? [] : holders.filter((h) => h.pref > 0);
  if (prefMultipleParticipating) {
    const prefTotal = prefHolders.reduce((a, h) => a + h.pref, 0);
    const paid = Math.min(E, prefTotal);
    for (const h of prefHolders) out.set(h.id, prefTotal > 0 ? (paid * h.pref) / prefTotal : 0);
    const rest = E - paid;
    const shares = holders.reduce((a, h) => a + h.shares, 0);
    for (const h of holders) out.set(h.id, (out.get(h.id) ?? 0) + (shares > 0 ? (rest * h.shares) / shares : 0));
    return out;
  }
  // Non-participating: find which preferred holders take their preference.
  let takesPref = new Set(prefHolders.map((h) => h.id));
  for (let iter = 0; iter < holders.length + 2; iter++) {
    const prefTotal = holders.filter((h) => takesPref.has(h.id)).reduce((a, h) => a + h.pref, 0);
    const paid = Math.min(E, prefTotal);
    const commonShares = holders.filter((h) => !takesPref.has(h.id)).reduce((a, h) => a + h.shares, 0);
    const next = new Set<string>();
    for (const h of holders) {
      if (!takesPref.has(h.id)) continue;
      // Would this holder do better converting? Recompute with its preference removed.
      const restIfConverted = E - Math.min(E, prefTotal - h.pref);
      const asConverted = (restIfConverted * h.shares) / (commonShares + h.shares);
      const asPref = prefTotal > 0 ? (paid * h.pref) / prefTotal : 0;
      if (asPref >= asConverted) next.add(h.id);
    }
    const stable = next.size === takesPref.size;
    takesPref = next;
    if (stable) break;
  }
  const prefTotal = holders.filter((h) => takesPref.has(h.id)).reduce((a, h) => a + h.pref, 0);
  const paid = Math.min(E, prefTotal);
  const rest = E - paid;
  const commonShares = holders.filter((h) => !takesPref.has(h.id)).reduce((a, h) => a + h.shares, 0);
  for (const h of holders) {
    if (takesPref.has(h.id)) out.set(h.id, prefTotal > 0 ? (paid * h.pref) / prefTotal : 0);
    else out.set(h.id, commonShares > 0 ? (rest * h.shares) / commonShares : 0);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Exit-year metrics

export interface ExitBase {
  runRateRevenue: number;
  exitRevenue: number;
  exitEbitda: number;
  yearsBeyond: number;
}

export function exitBase(r: ProjectResult, s: ExitSettings): ExitBase {
  const rows = r.rows;
  const last3 = rows.slice(-3);
  const runRateRevenue = (last3.reduce((a, x) => a + x.revenue, 0) / Math.max(1, last3.length)) * 12;
  const yearsBeyond = Math.max(0, s.exitYear - rows.length / 12);
  const exitRevenue = runRateRevenue * Math.pow(1 + s.growthPct / 100, yearsBeyond);
  return { runRateRevenue, exitRevenue, exitEbitda: exitRevenue * (s.exitMarginPct / 100), yearsBeyond };
}

// ---------------------------------------------------------------------------
// Taxes (California founder)

/** QSBS federal exclusion for stock issued after July 4, 2025: 50% at 3 years, 75% at 4, 100% at 5+. */
export function qsbsFraction(yearsHeld: number): number {
  if (yearsHeld >= 5) return 1;
  if (yearsHeld >= 4) return 0.75;
  if (yearsHeld >= 3) return 0.5;
  return 0;
}
export const QSBS_CAP = 15_000_000;

export function capitalGainsTax(gain: number, s: ExitSettings, cCorp: boolean): { fed: number; state: number; excluded: number } {
  const g = Math.max(0, gain);
  const excluded = s.qsbs && cCorp ? Math.min(g, QSBS_CAP) * qsbsFraction(s.exitYear) : 0;
  return { fed: (g - excluded) * (s.capGainsFedPct / 100), state: g * (s.capGainsStatePct / 100), excluded };
}

// ---------------------------------------------------------------------------
// Outcomes

export interface FounderOutcome {
  /** Founders' share at the headline price, before any deductions or risk. */
  gross: number;
  cashAtClose: number;
  /** Escrow and expected earn-out, received later. */
  cashLater: number;
  /** Buyer or public stock (taxes due when sold). */
  stock: number;
  /** PE rollover expected value at the fund's own exit. */
  rolloverFuture: number;
  retention: number;
  tax: number;
  qsbsExcluded: number;
  /** Expected take-home: cash after tax + stock + rollover future value. */
  net: number;
}

export interface ExitOutcome {
  kind: ExitKind;
  title: string;
  enterpriseValue: number;
  equityValue: number;
  fees: number;
  investorsTake: number;
  poolTake: number;
  foundersTake: number;
  founder: FounderOutcome;
  /** Lines describing where the money went, for the waterfall chart. */
  steps: { label: string; value: number }[];
  notes: string[];
}

export const EXIT_TITLES: Record<ExitKind, string> = {
  strategic: 'Strategic acquisition',
  pe: 'Private equity buyout',
  ipo: 'IPO',
  acquihire: 'Acqui-hire',
  lifestyle: 'Keep the company',
};

function focusIds(cap: CapTable, s: ExitSettings): string[] {
  const founders = cap.holders.filter((h) => h.group === 'founder');
  if (s.focus !== 'all' && founders.some((f) => f.id === s.focus)) return [s.focus];
  return founders.map((f) => f.id);
}

export function evaluateExit(kind: ExitKind, s: ExitSettings, cap: CapTable, base: ExitBase, cCorp: boolean): ExitOutcome {
  const ids = focusIds(cap, s);
  const foundersAll = cap.holders.filter((h) => h.group === 'founder');
  const nFocus = ids.length;
  const sumFor = (m: Map<string, number>, pred: (h: Holder) => boolean) => cap.holders.filter(pred).reduce((a, h) => a + (m.get(h.id) ?? 0), 0);
  const focusShare = (m: Map<string, number>) => ids.reduce((a, id) => a + (m.get(id) ?? 0), 0);
  // Per-founder tax so the QSBS cap applies to each person.
  const taxOn = (m: Map<string, number>, fraction: number) => {
    let tax = 0, excl = 0;
    for (const id of ids) {
      const t = capitalGainsTax((m.get(id) ?? 0) * fraction, s, cCorp);
      tax += t.fed + t.state; excl += t.excluded;
    }
    return { tax, excl };
  };
  const notes: string[] = [];

  if (kind === 'lifestyle') {
    const annual = Math.max(0, base.exitEbitda) * (s.lifestyle.payoutPct / 100);
    const totalShares = cap.totalShares;
    const focusShares = ids.reduce((a, id) => a + (cap.holders.find((h) => h.id === id)?.shares ?? 0), 0);
    const gross = annual * s.lifestyle.years * (focusShares / totalShares);
    const tax = gross * (s.ordinaryRatePct / 100);
    notes.push('No sale. Profits are paid out to all owners in proportion to their shares each year, taxed as income. Investors usually expect an exit, so this path needs their agreement.');
    return {
      kind, title: EXIT_TITLES[kind], enterpriseValue: 0, equityValue: 0, fees: 0, investorsTake: 0, poolTake: 0, foundersTake: gross,
      founder: { gross, cashAtClose: 0, cashLater: gross, stock: 0, rolloverFuture: 0, retention: 0, tax, qsbsExcluded: 0, net: gross - tax },
      steps: [{ label: `Profit paid out over ${s.lifestyle.years} years`, value: annual * s.lifestyle.years }, { label: 'Other owners', value: -(annual * s.lifestyle.years - gross) }, { label: 'Income tax', value: -tax }],
      notes,
    };
  }

  let ev = 0;
  if (kind === 'strategic') ev = base.exitRevenue * s.strategic.multiple;
  if (kind === 'pe') ev = Math.max(0, base.exitEbitda) * s.pe.multiple;
  if (kind === 'ipo') ev = base.exitRevenue * s.ipo.multiple;
  if (kind === 'acquihire') ev = Math.max(0, s.acquihire.price);
  const equity = Math.max(0, ev + s.netCashAtExit);
  const feeRate = kind === 'ipo' ? 0 : s.feesPct / 100;
  const fees = equity * feeRate;

  if (kind === 'ipo') {
    // Preferred converts to common at an IPO. Founders sell a slice at the IPO
    // (paying the underwriting discount) and hold the rest through a lock-up.
    const m = waterfall(cap.holders, equity, false, true);
    const gross = focusShare(m);
    const sold = gross * (s.ipo.sellAtIpoPct / 100);
    const underwriting = sold * (s.ipo.underwritingPct / 100);
    const cash = sold - underwriting;
    const held = (gross - sold) * (1 + s.ipo.afterLockupChangePct / 100);
    const { tax, excl } = taxOn(m, (s.ipo.sellAtIpoPct / 100) * (1 - s.ipo.underwritingPct / 100));
    notes.push('All preferred stock converts to common at an IPO, so preferences do not apply.', 'Most founder shares are locked up (typically 180 days) and are only worth what the stock trades at later. Taxes on held shares are due when they are sold.');
    return {
      kind, title: EXIT_TITLES[kind], enterpriseValue: ev, equityValue: equity, fees: underwriting,
      investorsTake: sumFor(m, (h) => h.group === 'investor'), poolTake: sumFor(m, (h) => h.group === 'pool'), foundersTake: sumFor(m, (h) => h.group === 'founder'),
      founder: { gross, cashAtClose: cash, cashLater: 0, stock: held, rolloverFuture: 0, retention: 0, tax, qsbsExcluded: excl, net: cash - tax + held },
      steps: [
        { label: 'Market value of the company', value: equity },
        { label: 'Investors’ shares', value: -sumFor(m, (h) => h.group === 'investor') },
        { label: 'Employee options', value: -sumFor(m, (h) => h.group === 'pool') },
        ...(nFocus < foundersAll.length ? [{ label: 'Other founders', value: -(sumFor(m, (h) => h.group === 'founder') - gross) }] : []),
        { label: 'Underwriting on shares sold', value: -underwriting },
        { label: 'Price change by end of lock-up', value: held - (gross - sold) },
        { label: 'Tax on shares sold', value: -tax },
      ],
      notes,
    };
  }

  // Sales: strategic, PE, acqui-hire.
  const earnoutShare = kind === 'strategic' ? s.strategic.earnoutPct / 100 : 0;
  const prob = s.strategic.earnoutProbPct / 100;
  // The waterfall runs on the expected amount actually paid.
  const expectedEquity = (equity - fees) * (1 - earnoutShare + earnoutShare * prob);
  const headline = waterfall(cap.holders, equity - fees, s.participating);
  const m = waterfall(cap.holders, expectedEquity, s.participating);
  const fGross = focusShare(headline);
  const fExpected = focusShare(m);
  const investorsTake = sumFor(m, (h) => h.group === 'investor');
  const poolTake = sumFor(m, (h) => h.group === 'pool');
  const foundersTake = sumFor(m, (h) => h.group === 'founder');

  let cashAtClose = fExpected, cashLater = 0, stock = 0, rolloverFuture = 0, retention = 0;
  let taxableFraction = 1;
  if (kind === 'strategic') {
    const upfrontShare = (1 - earnoutShare) / (1 - earnoutShare + earnoutShare * prob || 1);
    const upfront = fExpected * upfrontShare;
    const earnout = fExpected - upfront;
    const escrow = upfront * (s.strategic.escrowPct / 100);
    const cashPart = (upfront - escrow) * (s.strategic.cashPct / 100);
    stock = (upfront - escrow) * (1 - s.strategic.cashPct / 100);
    cashAtClose = cashPart;
    cashLater = escrow + earnout;
    taxableFraction = fExpected > 0 ? (cashAtClose + cashLater) / fExpected : 0;
    notes.push(
      `${s.strategic.earnoutPct}% of the price is an earn-out, paid only if targets are hit; it is counted at ${s.strategic.earnoutProbPct}% likelihood.`,
      `${s.strategic.escrowPct}% of the upfront price is held in escrow (often 12 to 18 months) to cover claims; it is assumed to be released.`,
      'Buyer stock received in a qualifying reorganization is usually taxed only when sold, and its value moves with the buyer’s share price.',
    );
  }
  if (kind === 'pe') {
    const roll = fExpected * (s.pe.rolloverPct / 100);
    cashAtClose = fExpected - roll;
    rolloverFuture = roll * s.pe.secondBiteMultiple;
    taxableFraction = 1 - s.pe.rolloverPct / 100;
    notes.push(`Founders roll ${s.pe.rolloverPct}% of their proceeds into the new company. If the fund later sells at ${s.pe.secondBiteMultiple}× that value (a “second bite”), it is worth ${'$'}${Math.round(rolloverFuture).toLocaleString('en-US')} before tax, years from now and not guaranteed.`);
  }
  if (kind === 'acquihire') {
    retention = s.acquihire.retentionPerFounder * nFocus;
    notes.push('In an acqui-hire the buyer mostly wants the team. The purchase price often goes to investors through their preferences, and founders are paid mainly through retention packages, which are salary-like income taxed at ordinary rates and paid only if they stay.');
  }
  const { tax: cgTax, excl } = taxOn(m, taxableFraction);
  const retentionTax = retention * (s.ordinaryRatePct / 100);
  const tax = cgTax + retentionTax;
  const net = cashAtClose + cashLater + retention - tax + stock + rolloverFuture;

  const steps = [
    { label: kind === 'acquihire' ? 'Purchase price' : 'Enterprise value (price)', value: ev },
    { label: 'Plus cash, minus debt', value: s.netCashAtExit },
    { label: 'Banker and legal fees', value: -fees },
    ...(earnoutShare > 0 ? [{ label: 'Earn-out not expected to be paid', value: -((equity - fees) - expectedEquity) }] : []),
    { label: 'Investors (preferences and shares)', value: -investorsTake },
    { label: 'Employee options', value: -poolTake },
    ...(nFocus < foundersAll.length ? [{ label: 'Other founders', value: -(foundersTake - fExpected) }] : []),
    ...(retention > 0 ? [{ label: 'Retention package', value: retention }] : []),
    ...(rolloverFuture > 0 ? [{ label: 'Rollover growth (second bite)', value: rolloverFuture - fExpected * (s.pe.rolloverPct / 100) }] : []),
    { label: 'Taxes', value: -tax },
  ];
  if (excl > 0) notes.push(`QSBS removes federal tax on ${'$'}${Math.round(excl).toLocaleString('en-US')} of gain. California does not follow QSBS, so state tax still applies.`);
  return {
    kind, title: EXIT_TITLES[kind], enterpriseValue: ev, equityValue: equity, fees, investorsTake, poolTake, foundersTake,
    founder: { gross: fGross, cashAtClose, cashLater, stock, rolloverFuture, retention, tax, qsbsExcluded: excl, net },
    steps, notes,
  };
}

export const EXIT_KINDS: ExitKind[] = ['strategic', 'pe', 'ipo', 'acquihire', 'lifestyle'];

export function evaluateAll(p: Project, r: ProjectResult) {
  const s = p.exit;
  const cap = buildCapTable(s, fundingRounds(p.funding));
  const base = exitBase(r, s);
  const cCorp = p.tax.entity === 'c_corp';
  return { cap, base, outcomes: EXIT_KINDS.map((k) => evaluateExit(k, s, cap, base, cCorp)) };
}

/** Smallest all-cash strategic sale price that leaves the founder(s) `target` after tax. */
export function priceNeeded(target: number, s: ExitSettings, cap: CapTable, cCorp: boolean): number | null {
  const net = (ev: number) => {
    const fake: ExitBase = { runRateRevenue: 0, exitRevenue: ev, exitEbitda: 0, yearsBeyond: 0 };
    const ss: ExitSettings = { ...s, strategic: { ...s.strategic, multiple: 1, cashPct: 100, escrowPct: 0, earnoutPct: 0 } };
    return evaluateExit('strategic', ss, cap, fake, cCorp).founder.net;
  };
  let hi = 1e6;
  while (net(hi) < target) { hi *= 2; if (hi > 1e13) return null; }
  let lo = 0;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (net(mid) >= target) hi = mid; else lo = mid; }
  return hi;
}

export function defaultExit(p: Pick<Project, 'streams'>): ExitSettings {
  const kind = p.streams[0]?.kind ?? 'software';
  const mult = MULTIPLES[kind];
  return {
    founders: [{ id: 'f1', name: 'Founder 1', pct: 50 }, { id: 'f2', name: 'Founder 2', pct: 50 }],
    poolPct: 10,
    rounds: [],
    prefMultiple: 1,
    participating: false,
    exitYear: 5,
    growthPct: 40,
    exitMarginPct: 15,
    netCashAtExit: 0,
    feesPct: 3,
    capGainsFedPct: 23.8,
    capGainsStatePct: 13.3,
    ordinaryRatePct: 50.3,
    qsbs: true,
    strategic: { multiple: mult.revenue[1], cashPct: 70, escrowPct: 10, earnoutPct: 20, earnoutProbPct: 50 },
    pe: { multiple: mult.ebitda[1], rolloverPct: 20, secondBiteMultiple: 2.5 },
    ipo: { multiple: mult.revenue[1] * 1.3, sellAtIpoPct: 10, underwritingPct: 7, afterLockupChangePct: -10 },
    acquihire: { price: 2_000_000, retentionPerFounder: 600_000 },
    lifestyle: { payoutPct: 50, years: 5 },
    focus: 'all',
  };
}
