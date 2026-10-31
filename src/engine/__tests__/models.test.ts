import { describe, expect, it } from 'vitest';
import { computeProject } from '../engine';
import { applyDelay, delaySplit, wholeEvents } from '../timing';
import { bare, line } from './helpers';

const close = (actual: number[], expected: number[]) => {
  expect(actual.length).toBeGreaterThanOrEqual(expected.length);
  expected.forEach((e, i) => expect(actual[i]).toBeCloseTo(e, 6));
};

describe('timing helpers', () => {
  it('splits a 45-day delay half into next month and half into the month after', () => {
    expect(delaySplit(45)).toEqual({ months: 1, fraction: 0.5 });
    close(applyDelay([100, 0, 0, 0], 45).paid, [0, 50, 50, 0]);
  });
  it('keeps unpaid amounts outstanding at the end of the projection', () => {
    const r = applyDelay([0, 0, 100], 60);
    close(r.paid, [0, 0, 0]);
    close(r.outstanding, [0, 0, 100]);
  });
  it('counts whole events when the running expected total reaches each whole number', () => {
    expect(wholeEvents([0.4, 0.4, 0.4, 0.4, 0.4, 0.4])).toEqual([0, 0, 1, 0, 1, 0]);
  });
});

describe('software: subscriptions', () => {
  const p = bare('software', {
    subInitialCustomers: 100, subNewPerMonth: 10, subNewGrowthPct: 0, subChurnPct: 5, subPrice: 50,
    subHostingPerCustomer: 2, subSupportPerCustomer: 3, subCac: 100,
  }, { subscription: true, annualPlans: false, perpetual: false, projects: false }, 3);

  it('tracks beginning + new − churned = ending subscribers', () => {
    const r = computeProject(p);
    const m = r.streams[0].result.metrics;
    close(line(m, 'endCustomers'), [105, 109.75]);
    close(line(m, 'churned'), [5, 5.25]);
  });
  it('earns revenue = active subscribers × price, and ARR = MRR × 12', () => {
    const r = computeProject(p);
    close(line(r.revenueLines, 'subscription'), [5250, 5487.5]);
    close(line(r.streams[0].result.metrics, 'arr'), [63000, 65850]);
  });
  it('builds gross profit and EBITDA from cost to serve and acquisition spend', () => {
    const row = computeProject(p).rows[0];
    expect(row.direct).toBeCloseTo(525); // 105 × (2 + 3)
    expect(row.grossProfit).toBeCloseTo(4725);
    expect(row.sm).toBeCloseTo(1000); // 10 × 100
    expect(row.ebitda).toBeCloseTo(3725);
    expect(row.endingCash).toBeCloseTo(3725); // collected immediately
  });
  it('changing price changes revenue, gross profit and cash', () => {
    const q = structuredClone(p);
    q.streams[0].inputs.subPrice.v = 60;
    const row = computeProject(q).rows[0];
    expect(row.revenue).toBeCloseTo(6300);
    expect(row.endingCash).toBeCloseTo(4775);
  });
  it('a 30-day collection delay pushes cash a month later and can make cash negative', () => {
    const q = structuredClone(p);
    q.streams[0].inputs.collectionDays.v = 30;
    const r = computeProject(q);
    expect(r.rows[0].revenue).toBeCloseTo(5250); // revenue unchanged
    expect(r.rows[0].collections).toBe(0);
    expect(r.rows[0].endingCash).toBeCloseTo(-1525);
    expect(r.rows[1].collections).toBeCloseTo(5250);
    expect(r.summary.firstNegativeCashMonth).toBe(1);
    expect(r.rows[2].receivables).toBeCloseTo(r.rows[2].billings);
  });
  it('annual plans bring 12 months of cash up front but earn revenue monthly', () => {
    const q = bare('software', { subNewPerMonth: 1, subPrice: 100, subAnnualSharePct: 100, subAnnualDiscountPct: 10 },
      { subscription: true, annualPlans: true, perpetual: false, projects: false }, 2);
    const r = computeProject(q);
    expect(r.rows[0].revenue).toBeCloseTo(90);
    expect(r.rows[0].collections).toBeCloseTo(1080);
    expect(r.rows[0].deferredRevenue).toBeCloseTo(990);
  });
});

describe('software: licenses, support contracts and projects', () => {
  it('earns license revenue on whole sales and spreads support contracts over 12 months', () => {
    const p = bare('software', { licNewPerMonth: 0.5, licPrice: 1000, licMaintPct: 20, licMaintRenewalPct: 100 },
      { subscription: false, perpetual: true, projects: false }, 4);
    const r = computeProject(p);
    close(line(r.revenueLines, 'license'), [0, 1000, 0, 1000]);
    close(line(r.revenueLines, 'maintenance'), [0, 200 / 12, 200 / 12, 400 / 12]);
    expect(r.rows[1].billings).toBeCloseTo(1200); // license + first support year billed
  });
  it('spreads project revenue evenly over the project length', () => {
    const p = bare('software', { projNewPerMonth: 1, projValue: 30000, projDurationMonths: 3, projDeliveryCostPct: 50 },
      { subscription: false, perpetual: false, projects: true }, 4);
    const r = computeProject(p);
    close(line(r.revenueLines, 'projects'), [10000, 20000, 30000, 30000]);
    close(line(r.directLines, 'projDelivery'), [5000, 10000, 15000, 15000]);
  });
});

describe('manufacturing', () => {
  const p = bare('manufacturing', {
    price: 100, unitsStart: 10, unitGrowthPct: 0, materialCost: 20, laborCost: 10, packShipCost: 5, overheadMonthly: 100,
    capacity: 8, inventoryLeadMonths: 1, equipmentCost: 1200, equipmentMonth: 1, equipmentLife: 12,
  }, { capSales: true }, 3);

  it('limits units sold to capacity and warns', () => {
    const r = computeProject(p);
    close(line(r.streams[0].result.metrics, 'unitsSold'), [8, 8, 8]);
    expect(r.issues.some((i) => i.id.endsWith('mf.capacity'))).toBe(true);
  });
  it('gross profit = units × (price − variable cost) − overhead', () => {
    const row = computeProject(p).rows[0];
    expect(row.revenue).toBeCloseTo(800);
    expect(row.direct).toBeCloseTo(8 * 35 + 100);
    expect(row.grossProfit).toBeCloseTo(8 * (100 - 35) - 100);
  });
  it('buys materials ahead of sales, tying cash up in inventory', () => {
    const r = computeProject(p);
    close(line(r.streams[0].result.metrics, 'purchases'), [320, 160, 160]);
    expect(r.rows[0].inventory).toBeCloseTo(160);
  });
  it('separates equipment cash (capital spending) from depreciation', () => {
    const r = computeProject(p);
    expect(r.rows[0].capexPaid).toBe(1200);
    expect(r.rows[0].depreciation).toBeCloseTo(100);
    expect(r.rows[0].ebitda - r.rows[0].operatingProfit).toBeCloseTo(100);
  });
});

describe('professional services', () => {
  const p = bare('services', {
    newClientsPerMonth: 1, projectDurationMonths: 2, hoursPerClientMonth: 100, billingRate: 100,
    consultantsStart: 2, hoursPerPerson: 160, utilizationPct: 50, consultantSalary: 5000, burdenPct: 20,
  }, { pricing: 'hourly' }, 3);

  it('revenue = billable hours × rate, capped at delivery capacity', () => {
    const r = computeProject(p);
    const m = r.streams[0].result.metrics;
    close(line(m, 'demandHours'), [100, 200, 200]);
    close(line(m, 'billableHours'), [100, 160, 160]);
    close(line(r.revenueLines, 'services'), [10000, 16000, 16000]);
    expect(r.issues.some((i) => i.id.endsWith('ps.capacity'))).toBe(true);
  });
  it('consultant cost is fully loaded and paid whether or not billed', () => {
    const r = computeProject(p);
    expect(r.rows[0].direct).toBeCloseTo(12000);
    close(line(r.streams[0].result.metrics, 'utilization'), [100 / 320, 0.5, 0.5]);
  });
});

describe('e-commerce', () => {
  const p = bare('ecommerce', {
    aov: 100, ordersStart: 100, returnsPct: 10, productCostPerOrder: 30, fulfillmentPerOrder: 5, shippingSubsidyPerOrder: 5,
    processingPct: 3, processingFixed: 0.3, newCustomerSharePct: 50, cac: 20,
  }, {}, 2);
  it('nets refunds out of revenue and computes contribution per order', () => {
    const r = computeProject(p);
    expect(r.rows[0].revenue).toBeCloseTo(9000);
    expect(r.rows[0].direct).toBeCloseTo(3000 + 500 + 500 + 330);
    expect(r.rows[0].sm).toBeCloseTo(1000);
    close(line(r.streams[0].result.metrics, 'contributionPerOrder'), [36.7]);
  });
});

describe('marketplace', () => {
  const p = bare('marketplace', {
    buyersStart: 1000, sellersStart: 10, maxTxPerSeller: 50, txPerBuyer: 1, avgTxValue: 200, takeRatePct: 10,
    processingPctOfGmv: 3, supportPerTx: 1,
  }, {}, 2);
  it('separates GMV from platform revenue and limits transactions by seller supply', () => {
    const r = computeProject(p);
    const m = r.streams[0].result.metrics;
    close(line(m, 'transactions'), [500]);
    close(line(m, 'gmv'), [100000]);
    expect(r.rows[0].revenue).toBeCloseTo(10000);
    expect(r.rows[0].direct).toBeCloseTo(3000 + 500); // processing on GMV + support
    expect(r.issues.some((i) => i.id.endsWith('mp.supply'))).toBe(true);
  });
});

describe('licensing', () => {
  it('earns an upfront fee, annual fees monthly, and renewals after the term', () => {
    const p = bare('licensing', { newPerQuarter: 3, firstDealMonth: 1, upfrontFee: 10000, annualFee: 12000, termMonths: 12, renewalPct: 100 }, {}, 14);
    const r = computeProject(p);
    expect(r.rows[0].revenue).toBeCloseTo(11000);
    expect(r.rows[0].billings).toBeCloseTo(22000);
    close(line(r.streams[0].result.metrics, 'activeLicensees').slice(11, 13), [12, 13]);
    expect(line(r.revenueLines, 'renewal')[12]).toBeCloseTo(1000);
  });
  it('earns royalties on licensee sales and collects them after the royalty delay', () => {
    const p = bare('licensing', { initialLicensees: 1, royaltyPct: 5, licenseeUnits: 100, licenseeUnitPrice: 10, termMonths: 24, royaltyDays: 60 }, {}, 4);
    const r = computeProject(p);
    close(line(r.revenueLines, 'royalty'), [50, 50, 50, 50]);
    close(r.rows.map((x) => x.collections), [0, 0, 50, 50]);
  });
});

describe('enterprise / government', () => {
  const inputs = {
    prospectsPerMonth: 10, qualifyPct: 50, monthsToQualify: 0, pilotPct: 20, evalMonths: 0, pilotMonths: 1, pilotCost: 3000,
    pilotConversionPct: 50, decisionMonths: 0, procurementMonths: 0, licensePrice: 1200, licensesPerCustomer: 10, termMonths: 12, renewalPct: 100,
  };
  it('moves prospects through stages with delays and counts whole deals', () => {
    const r = computeProject(bare('enterprise', inputs, { counting: 'whole', billing: 'annual' }, 6));
    const m = r.streams[0].result.metrics;
    close(line(m, 'pilotsStarted'), [1, 1, 1, 1, 1, 1]);
    close(line(m, 'wins'), [0, 0, 1, 0, 1, 0]);
    close(line(r.revenueLines, 'software'), [0, 0, 1000, 1000, 2000, 2000]);
    close(r.rows.map((x) => x.billings), [0, 0, 12000, 0, 12000, 0]);
    close(r.rows.map((x) => x.sm), [3000, 3000, 3000, 3000, 3000, 3000]); // unpaid pilots are a selling cost
  });
  it('expected-value mode shows fractional deals', () => {
    const r = computeProject(bare('enterprise', inputs, { counting: 'expected', billing: 'annual' }, 4));
    close(line(r.streams[0].result.metrics, 'wins'), [0, 0.5, 0.5, 0.5]);
  });
  it('a longer procurement delay pushes revenue later', () => {
    const r = computeProject(bare('enterprise', { ...inputs, procurementMonths: 2 }, { counting: 'whole' }, 6));
    close(line(r.revenueLines, 'software'), [0, 0, 0, 0, 1000, 1000]);
  });
  it('distinguishes contracted ARR from recognized revenue and cash', () => {
    const r = computeProject(bare('enterprise', { ...inputs, startLagMonths: 1 }, { counting: 'whole' }, 6));
    const m = r.streams[0].result.metrics;
    expect(line(m, 'contractedArr')[2]).toBeCloseTo(12000); // signed in month 3, not started
    expect(r.rows[2].revenue).toBe(0);
  });
});
