// TimeScene demonstration project.
//
// Every number here is an ILLUSTRATIVE assumption written for the class
// demonstration. None of them are actual TimeScene figures, and none should be
// read as a forecast of how TimeScene will perform.

import type { Expense, Project, Role } from '../engine/types';
import { defaultExit } from '../engine/exit';
import { a, emptyScenarios, makeStream, uid } from './defaults';

const NOTE = 'Illustrative value for the demonstration project. Not an actual TimeScene figure.';

export function timesceneProject(): Project {
  const stream = makeStream('enterprise', 'Platform subscriptions', 'ts_enterprise');
  const set = (k: string, v: number) => { stream.inputs[k] = a(v, true, NOTE); };
  const values: Record<string, number> = {
    prospectsPerMonth: 10,
    prospectGrowthPct: 2,
    openOppsAtStart: 4,
    pilotsAtStart: 1,
    qualifyPct: 35,
    monthsToQualify: 1,
    pilotPct: 45,
    evalMonths: 3,
    maxConcurrent: 15,
    salesBdMonthly: 2500,
    costPerProspect: 100,
    pilotMonths: 4,
    pilotCost: 8000,
    paidPilotPct: 40,
    pilotFee: 12000,
    pilotConversionPct: 50,
    decisionMonths: 2,
    procurementMonths: 4,
    startLagMonths: 1,
    licensePrice: 3600,
    licensesPerCustomer: 12,
    termMonths: 12,
    renewalPct: 85,
    priceIncreasePct: 3,
    implementationFee: 7500,
    trainingFee: 5000,
    proServicesMonthly: 500,
    laborRate: 0,
    onboardingHours: 60,
    trainingCost: 2000,
    configCost: 1500,
    supportHours: 4,
    infraPerCustomer: 350,
    csmPerCustomer: 0,
    hostingBase: 1500,
    securityMonthly: 1500,
    certificationCost: 45000,
    certificationMonth: 10,
    legalMonthly: 1500,
    insuranceMonthly: 900,
    collectionDays: 60,
    supplierDays: 30,
  };
  for (const [k, v] of Object.entries(values)) set(k, v);
  stream.options = { counting: 'whole', billing: 'annual', implRecognition: 'start' };

  const role = (title: string, monthlyComp: number, startMonth: number, dept: Role['dept']): Role => ({
    id: uid('role'), title, count: 1, monthlyComp, burdenPct: 22, startMonth, endMonth: null, annualRaisePct: 3, dept,
    basis: NOTE, conf: 'unset', example: true,
  });
  const exp = (name: string, category: Expense['category'], amount: number, kind: Expense['kind'] = 'recurring', startMonth = 1): Expense => ({
    id: uid('exp'), name, category, kind, amount, startMonth, endMonth: null, annualGrowthPct: 0, payDelayDays: 0,
    basis: NOTE, conf: 'unset', example: true,
  });

  const p: Project = {
    schemaVersion: 1,
    id: 'timescene-demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    setup: {
      name: 'TimeScene (demonstration)',
      description:
        'Early-stage enterprise software for complex incident reconstruction, after-action reviews, investigations and litigation support. Customers are public agencies and other organizations that must assemble, reconcile, analyze and preserve complex incident records. All values are illustrative and editable.',
      industries: ['Government and public-safety software'],
      startMonth: '2027-01',
      months: 24,
      startingCash: a(130000, true, NOTE),
      founderInvestment: a(25000, true, NOTE),
      minCashCushion: a(50000, true, NOTE),
      largestCustomerSharePct: a(0, true, NOTE),
    },
    streams: [stream],
    roles: [
      role('Chief executive officer', 6000, 1, 'admin'),
      role('Chief technology officer', 6000, 1, 'product'),
      role('Customer and investigations lead (part-time)', 2000, 1, 'sales'),
      role('Marketing lead (part-time)', 1500, 1, 'sales'),
      role('Senior software engineer', 12500, 7, 'product'),
      role('Implementation and support specialist', 8500, 13, 'delivery'),
    ],
    expenses: [
      exp('Software and development tools', 'rd', 1200),
      exp('Legal and professional services', 'ga', 1500),
      exp('Accounting and bookkeeping', 'ga', 600),
      exp('Coworking space', 'ga', 500),
      exp('Travel to agencies and conferences', 'sm', 1500),
      exp('Marketing and advertising', 'sm', 1000),
      exp('General business insurance', 'ga', 400),
      exp('Office and administrative expenses', 'ga', 200),
      exp('Other expenses', 'other', 300),
      exp('Trademark and patent filings', 'ga', 8000, 'one-time', 3),
    ],
    capex: [],
    funding: [
      {
        id: 'ts_preseed', name: 'Pre-seed investment', kind: 'equity', amount: 750000, month: 5, annualRatePct: 0, termMonths: 0, equityPct: 10, instrument: 'safe',
        basis: NOTE, conf: 'unset', example: true,
      },
    ],
    tax: { enabled: true, entity: 'c_corp', rate: a(25, true, NOTE), payment: 'quarterly', includeOwnerDistributions: true },
    scenarios: emptyScenarios({ downside: 'Conservative public-sector sales', base: 'Base public-sector sales', upside: 'Aggressive public-sector sales' }),
    reviewResponses: {},
    reflection: '',
    // Illustrative cap table and exit settings, invented for the demonstration.
    exit: {
      ...defaultExit({ streams: [stream] }),
      founders: [
        { id: 'ts_ceo', name: 'Chief executive officer', pct: 40 },
        { id: 'ts_cto', name: 'Chief technology officer', pct: 40 },
        { id: 'ts_cco', name: 'Customer and investigations lead', pct: 10 },
        { id: 'ts_cmo', name: 'Marketing lead', pct: 10 },
      ],
      poolPct: 10,
      rounds: [
        { id: 'ts_r2', name: 'Seed round', kind: 'priced', amount: 3000000, valuation: 15000000 },
        { id: 'ts_r3', name: 'Series A', kind: 'priced', amount: 10000000, valuation: 40000000 },
      ],
      exitYear: 7,
      growthPct: 70,
      exitMarginPct: 20,
      netCashAtExit: 2000000,
      strategic: { multiple: 6, cashPct: 70, escrowPct: 10, earnoutPct: 25, earnoutProbPct: 50 },
      pe: { multiple: 16, rolloverPct: 25, secondBiteMultiple: 2.5 },
      ipo: { multiple: 7, sellAtIpoPct: 10, underwritingPct: 7, afterLockupChangePct: -15 },
      acquihire: { price: 6000000, retentionPerFounder: 750000 },
      lifestyle: { payoutPct: 50, years: 5 },
      focus: 'ts_ceo',
    },
  };

  const sid = stream.id;
  p.scenarios.downside.overrides = {
    [`stream:${sid}:prospectsPerMonth`]: 6,
    [`stream:${sid}:pilotConversionPct`]: 30,
    [`stream:${sid}:evalMonths`]: 5,
    [`stream:${sid}:procurementMonths`]: 6,
    [`stream:${sid}:paidPilotPct`]: 20,
    [`stream:${sid}:renewalPct`]: 75,
  };
  p.scenarios.downside.adjustments = { hiringDelayMonths: 0, extraCollectionDays: 30, compChangePct: 0 };
  p.scenarios.downside.notes = 'Agencies take longer to evaluate and buy, fewer pilots are paid, and payments arrive later.';
  p.scenarios.upside.overrides = {
    [`stream:${sid}:prospectsPerMonth`]: 11,
    [`stream:${sid}:pilotConversionPct`]: 60,
    [`stream:${sid}:evalMonths`]: 2,
    [`stream:${sid}:procurementMonths`]: 3,
    [`stream:${sid}:paidPilotPct`]: 60,
    [`stream:${sid}:renewalPct`]: 92,
  };
  p.scenarios.upside.notes = 'Referrals between agencies shorten evaluation, and procurement uses existing purchasing vehicles.';
  return p;
}
