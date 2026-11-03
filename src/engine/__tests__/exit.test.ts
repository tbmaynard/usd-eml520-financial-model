import { describe, expect, it } from 'vitest';
import { timesceneProject } from '../../data/timescene';
import { runScenario } from '../engine';
import {
  buildCapTable, capitalGainsTax, defaultExit, evaluateAll, evaluateExit, priceNeeded, waterfall, type ExitBase, type ExitSettings, type Holder,
} from '../exit';

function settings(over: Partial<ExitSettings> = {}): ExitSettings {
  return {
    ...defaultExit({ streams: [] }),
    founders: [{ id: 'a', name: 'A', pct: 50 }, { id: 'b', name: 'B', pct: 50 }],
    poolPct: 10,
    rounds: [],
    ...over,
  };
}

describe('cap table', () => {
  it('a 10% pool on 10M founder shares leaves founders 90%', () => {
    const t = buildCapTable(settings());
    expect(t.totalShares).toBeCloseTo(10_000_000 / 0.9, 0);
    expect(t.steps[0].founderPct).toBeCloseTo(0.9, 6);
  });
  it('a post-money SAFE owns amount ÷ cap before the next round; a priced round owns amount ÷ post-money', () => {
    const t = buildCapTable(settings({ rounds: [
      { id: 's', name: 'SAFE', kind: 'safe', amount: 1_000_000, valuation: 10_000_000 },
      { id: 'p', name: 'Seed', kind: 'priced', amount: 2_000_000, valuation: 8_000_000 },
    ] }));
    const share = (id: string) => t.holders.find((h) => h.id === id)!.shares / t.totalShares;
    expect(share('p')).toBeCloseTo(0.2, 6); // $2M of $10M post-money
    expect(share('s')).toBeCloseTo(0.1 * 0.8, 6); // 10%, then diluted 20% by the seed
    expect(t.steps[t.steps.length - 1].founderPct).toBeCloseTo(0.9 * 0.9 * 0.8, 6);
  });
  it('a SAFE with no later priced round converts at exit', () => {
    const t = buildCapTable(settings({ rounds: [{ id: 's', name: 'SAFE', kind: 'safe', amount: 500_000, valuation: 5_000_000 }] }));
    expect(t.holders.find((h) => h.id === 's')!.shares / t.totalShares).toBeCloseTo(0.1, 6);
  });
});

describe('liquidation waterfall', () => {
  const holders: Holder[] = [
    { id: 'c', name: 'Common', group: 'founder', shares: 80, invested: 0, pref: 0 },
    { id: 'i', name: 'Investor', group: 'investor', shares: 20, invested: 2_000_000, pref: 2_000_000 },
  ];
  it('non-participating preferred takes its preference in a small exit', () => {
    const m = waterfall(holders, 5_000_000, false);
    expect(m.get('i')).toBeCloseTo(2_000_000);
    expect(m.get('c')).toBeCloseTo(3_000_000);
  });
  it('non-participating preferred converts when its share is worth more', () => {
    const m = waterfall(holders, 20_000_000, false);
    expect(m.get('i')).toBeCloseTo(4_000_000);
    expect(m.get('c')).toBeCloseTo(16_000_000);
  });
  it('preferences can take everything in a very small exit', () => {
    const m = waterfall(holders, 1_000_000, false);
    expect(m.get('i')).toBeCloseTo(1_000_000);
    expect(m.get('c')).toBeCloseTo(0);
  });
  it('participating preferred takes its preference and its share of the rest', () => {
    const m = waterfall(holders, 20_000_000, true);
    expect(m.get('i')).toBeCloseTo(2_000_000 + 0.2 * 18_000_000);
  });
  it('the waterfall always pays out exactly the equity', () => {
    for (const e of [0, 1e6, 3e6, 1e7, 1e8]) {
      for (const part of [false, true]) {
        const m = waterfall(holders, e, part);
        expect([...m.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(e, 2);
      }
    }
  });
});

describe('California founder taxes', () => {
  const s = settings({ exitYear: 5 });
  it('QSBS removes federal tax after five years, but California still taxes the gain', () => {
    const t = capitalGainsTax(1_000_000, s, true);
    expect(t.fed).toBe(0);
    expect(t.state).toBeCloseTo(133_000);
  });
  it('QSBS is capped at $15M per founder', () => {
    const t = capitalGainsTax(20_000_000, s, true);
    expect(t.fed).toBeCloseTo(5_000_000 * 0.238);
  });
  it('no QSBS for pass-through entities or short holding periods', () => {
    expect(capitalGainsTax(1_000_000, s, false).fed).toBeCloseTo(238_000);
    expect(capitalGainsTax(1_000_000, { ...s, exitYear: 2 }, true).fed).toBeCloseTo(238_000);
    expect(capitalGainsTax(1_000_000, { ...s, exitYear: 3 }, true).fed).toBeCloseTo(119_000); // 50% excluded at 3 years
  });
});

describe('exit outcomes', () => {
  const base: ExitBase = { runRateRevenue: 5e6, exitRevenue: 5e6, exitEbitda: 1e6, yearsBeyond: 0 };
  const s = settings({ rounds: [{ id: 'p', name: 'Seed', kind: 'priced', amount: 2e6, valuation: 8e6 }], qsbs: false, netCashAtExit: 0, feesPct: 0 });
  const cap = buildCapTable(s);

  it('an all-cash sale splits the price by ownership after the preference decision', () => {
    const ss = { ...s, strategic: { multiple: 4, cashPct: 100, escrowPct: 0, earnoutPct: 0, earnoutProbPct: 100 } };
    const o = evaluateExit('strategic', ss, cap, base, true);
    expect(o.enterpriseValue).toBe(20e6);
    // Investor owns 20% (> $2M preference), so converts: founders get 72% of $20M.
    expect(o.founder.gross).toBeCloseTo(20e6 * 0.72, 0);
    expect(o.founder.tax).toBeCloseTo(20e6 * 0.72 * 0.371, 0);
    expect(o.founder.net).toBeCloseTo(20e6 * 0.72 * (1 - 0.371), 0);
  });
  it('an earn-out at 50% likelihood lowers the expected take below the headline', () => {
    const ss = { ...s, strategic: { multiple: 4, cashPct: 100, escrowPct: 0, earnoutPct: 40, earnoutProbPct: 50 } };
    const o = evaluateExit('strategic', ss, cap, base, true);
    expect(o.founder.cashAtClose + o.founder.cashLater).toBeCloseTo(o.founder.gross * 0.8, 0);
  });
  it('PE rollover defers part of the proceeds into a later second bite', () => {
    const ss = { ...s, pe: { multiple: 10, rolloverPct: 20, secondBiteMultiple: 2 } };
    const o = evaluateExit('pe', ss, cap, base, true);
    expect(o.enterpriseValue).toBe(10e6);
    expect(o.founder.rolloverFuture).toBeCloseTo(o.founder.gross * 0.2 * 2, 0);
    expect(o.founder.cashAtClose).toBeCloseTo(o.founder.gross * 0.8, 0);
  });
  it('an IPO converts preferred, so a small IPO pays by share count', () => {
    const ss = { ...s, ipo: { multiple: 0.4, sellAtIpoPct: 0, underwritingPct: 7, afterLockupChangePct: 0 } };
    const o = evaluateExit('ipo', ss, cap, base, true);
    expect(o.investorsTake).toBeCloseTo(2e6 * 0.2, 0); // 20% of $2M, not its $2M preference
  });
  it('in an acqui-hire the preference can take the whole price', () => {
    const ss = { ...s, acquihire: { price: 1.5e6, retentionPerFounder: 500_000 } };
    const o = evaluateExit('acquihire', ss, cap, base, true);
    expect(o.investorsTake).toBeCloseTo(1.5e6, 0);
    expect(o.founder.retention).toBe(1e6);
    expect(o.founder.net).toBeCloseTo(1e6 * (1 - 0.503), 0);
  });
  it('the price-needed solver returns a price that delivers the target', () => {
    const target = 3e6;
    const price = priceNeeded(target, s, cap, true)!;
    const o = evaluateExit('strategic', { ...s, strategic: { multiple: 1, cashPct: 100, escrowPct: 0, earnoutPct: 0, earnoutProbPct: 100 } }, cap, { ...base, exitRevenue: price }, true);
    expect(o.founder.net).toBeCloseTo(target, -2);
  });
  it('the TimeScene example produces finite outcomes for every exit', () => {
    const p = timesceneProject();
    const { outcomes } = evaluateAll(p, runScenario(p, 'base'));
    expect(outcomes).toHaveLength(5);
    for (const o of outcomes) expect(Number.isFinite(o.founder.net)).toBe(true);
  });
});
