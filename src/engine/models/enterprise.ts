import type { StreamResult } from '../types';
import { pct, sum, val, zeros } from '../timing';
import type { ModelModule } from './moduleTypes';

// Enterprise and government B2B software.
//
// Simplified monthly cohort model:
//   prospect enters (month s)
//   → qualified opportunity (s + months to qualify)              × qualification rate
//   → pilot starts (qualified + evaluation months)                × pilot rate
//   → pilot ends (pilot start + pilot length)
//   → contract signed (pilot end + decision months + procurement) × pilot conversion
//   → contract starts (signed + start delay)
// Concurrent pursuits (open opportunities + active pilots) are capped by the
// team's capacity; qualified opportunities beyond the cap are not pursued.
// In "whole deals" mode, pilots, paid pilots, wins and renewals are counted as
// whole events: one is counted each time the running expected total reaches
// the next whole number.

const whole = (o: Record<string, string | boolean>) => o.counting !== 'expected';
const recognizeOverYear = (o: Record<string, string | boolean>) => o.implRecognition === 'year';

class WholeCounter {
  private cum = 0;
  private counted = 0;
  constructor(private readonly enabled: boolean) {}
  add(expected: number): number {
    if (!this.enabled) return expected;
    this.cum += Math.max(0, expected);
    const w = Math.floor(this.cum + 1e-9);
    const out = w - this.counted;
    this.counted = w;
    return out;
  }
}

export const enterprise: ModelModule = {
  kind: 'enterprise',
  label: 'Enterprise / government B2B software',
  short: 'Enterprise / Gov',
  description:
    'Sells software to organizations and public agencies through a long sales process: qualification, evaluation, pilots, security review, procurement and contract approval. Few customers, large annual contracts, and long delays between first contact and first payment.',
  examples: 'Software for police departments or fire agencies, a compliance platform for hospitals, a tool sold to utilities or universities.',
  defaultOptions: { counting: 'whole', billing: 'annual', implRecognition: 'start' },
  options: [
    {
      key: 'counting', label: 'How deals are counted', group: 'Sales pipeline', type: 'select',
      help: 'Whole deals counts a pilot or contract only when the expected total reaches a full deal, which produces realistic lumpy results. Expected value shows the smooth probability-weighted average, including fractions of deals.',
      choices: [{ value: 'whole', label: 'Whole deals' }, { value: 'expected', label: 'Expected value (fractional)' }],
    },
    {
      key: 'billing', label: 'How contracts are billed', group: 'Contracts and revenue', type: 'select',
      help: 'Annual billing brings a full year of cash at the start of each contract year. Revenue is earned monthly either way.',
      choices: [{ value: 'annual', label: 'Annually in advance' }, { value: 'quarterly', label: 'Quarterly in advance' }, { value: 'monthly', label: 'Monthly' }],
    },
    {
      key: 'implRecognition', label: 'When implementation and training revenue is earned', group: 'Contracts and revenue', type: 'select',
      help: 'Earning it at contract start is simpler. Spreading it over the first year is closer to how auditors often treat setup fees tied to a subscription.',
      choices: [{ value: 'start', label: 'At contract start' }, { value: 'year', label: 'Evenly over the first 12 months' }],
    },
  ],
  fields: [
    // Pipeline
    { key: 'prospectsPerMonth', label: 'New prospects entering the pipeline per month', unit: 'count', help: 'Organizations you start talking to each month.', group: 'Sales pipeline', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'prospectGrowthPct', label: 'Monthly growth in new prospects', unit: 'pct', help: 'Growth in the monthly prospect flow as marketing and referrals build.', group: 'Sales pipeline', min: -50, max: 100 },
    { key: 'openOppsAtStart', label: 'Qualified opportunities already open', unit: 'count', help: 'Real opportunities already in your pipeline at the start. They begin the evaluation stage in the first month of sales.', group: 'Sales pipeline', min: 0 },
    { key: 'pilotsAtStart', label: 'Pilots already underway', unit: 'count', help: 'Pilots running when the projection starts. They are treated as starting in the first month of sales.', group: 'Sales pipeline', min: 0 },
    { key: 'qualifyPct', label: 'Prospect to qualified opportunity', unit: 'pct', help: 'Share of prospects with a real need, budget and decision maker.', group: 'Sales pipeline', min: 0, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'monthsToQualify', label: 'Months to qualify a prospect', unit: 'months', help: 'Time from first contact to a qualified opportunity.', group: 'Sales pipeline', min: 0, max: 24 },
    { key: 'pilotPct', label: 'Qualified opportunity to pilot', unit: 'pct', help: 'Share of qualified opportunities that agree to a pilot.', group: 'Sales pipeline', min: 0, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'evalMonths', label: 'Evaluation months before a pilot', unit: 'months', help: 'Demos, technical evaluation and security questionnaires before a pilot begins.', group: 'Sales pipeline', min: 0, max: 36, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'maxConcurrent', label: 'Opportunities your team can pursue at once', unit: 'count', help: 'Open opportunities plus active pilots your team can handle. Qualified opportunities beyond this are not pursued. Enter 0 for no limit.', group: 'Sales pipeline', min: 0, sensitivity: true },
    { key: 'salesBdMonthly', label: 'Sales and business development spend per month', unit: 'usd', help: 'Travel, conferences, proposal writing, CRM and similar costs. Put salaried sales staff in the team plan.', group: 'Sales pipeline', min: 0, sensitivity: true },
    { key: 'costPerProspect', label: 'Marketing cost per new prospect', unit: 'usd', help: 'Lead generation cost per prospect.', group: 'Sales pipeline', min: 0 },

    // Pilots and procurement
    { key: 'pilotMonths', label: 'Pilot length', unit: 'months', help: 'How long a typical pilot runs.', group: 'Pilots and procurement', min: 1, max: 24 },
    { key: 'pilotCost', label: 'Cost to deliver one pilot', unit: 'usd', help: 'Total cost of running one pilot (setup, travel, support, cloud). Spread evenly over the pilot.', group: 'Pilots and procurement', min: 0, sensitivity: true },
    { key: 'paidPilotPct', label: 'Pilots that are paid', unit: 'pct', help: 'Share of pilots where the customer pays a fee. Unpaid pilots are a cost of selling.', group: 'Pilots and procurement', min: 0, max: 100, scenario: true, worseWhen: 'lower' },
    { key: 'pilotFee', label: 'Fee for a paid pilot', unit: 'usd', help: 'What a customer pays for a paid pilot.', group: 'Pilots and procurement', min: 0 },
    { key: 'pilotConversionPct', label: 'Pilot to paid customer', unit: 'pct', help: 'Share of pilots that become contracts.', group: 'Pilots and procurement', min: 0, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'decisionMonths', label: 'Months from pilot end to contract decision', unit: 'months', help: 'Internal review and approval after the pilot ends.', group: 'Pilots and procurement', min: 0, max: 24 },
    { key: 'procurementMonths', label: 'Procurement and approval delay', unit: 'months', help: 'Purchasing, legal review, budget authorization and council or board approval.', group: 'Pilots and procurement', min: 0, max: 36, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'startLagMonths', label: 'Months from signature to contract start', unit: 'months', help: 'Delay between signing and the contract start date, for example waiting for a new fiscal year.', group: 'Pilots and procurement', min: 0, max: 12 },

    // Contracts and revenue
    { key: 'licensePrice', label: 'Annual price per license, user or workspace', unit: 'usd', help: 'Annual software price for one license unit.', group: 'Contracts and revenue', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'licensesPerCustomer', label: 'Licenses per customer', unit: 'count', help: 'Average license units one customer buys.', group: 'Contracts and revenue', min: 0, sensitivity: true },
    { key: 'termMonths', label: 'Contract term', unit: 'months', help: 'Length of one contract. Government contracts are often 12 months with renewal options.', group: 'Contracts and revenue', min: 1, max: 120 },
    { key: 'renewalPct', label: 'Renewal rate at term end', unit: 'pct', help: 'Share of customers who renew when the contract ends.', group: 'Contracts and revenue', min: 0, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'priceIncreasePct', label: 'Annual price increase', unit: 'pct', help: 'Price increase applied each contract year.', group: 'Contracts and revenue', min: 0, max: 50 },
    { key: 'implementationFee', label: 'Implementation and onboarding fee', unit: 'usd', help: 'One-time fee charged to a new customer.', group: 'Contracts and revenue', min: 0 },
    { key: 'trainingFee', label: 'Training fee per new customer', unit: 'usd', help: 'One-time training revenue from a new customer.', group: 'Contracts and revenue', min: 0 },
    { key: 'proServicesMonthly', label: 'Professional services revenue per customer per month', unit: 'usd', help: 'Ongoing consulting, custom reports or analysis billed to active customers.', group: 'Contracts and revenue', min: 0 },

    // Implementation and support
    { key: 'laborRate', label: 'Internal labor cost per hour', unit: 'usd', help: 'Loaded hourly cost of staff who onboard and support customers. If those people are already in your team plan, enter 0 here so they are not counted twice.', group: 'Implementation and support', min: 0 },
    { key: 'onboardingHours', label: 'Staff hours to onboard a customer', unit: 'hours', help: 'Implementation and configuration hours for one new customer.', group: 'Implementation and support', min: 0 },
    { key: 'trainingCost', label: 'Training delivery cost per new customer', unit: 'usd', help: 'Travel, materials and trainer time.', group: 'Implementation and support', min: 0 },
    { key: 'configCost', label: 'Customer-specific configuration cost', unit: 'usd', help: 'Integrations, data migration or custom setup per new customer.', group: 'Implementation and support', min: 0 },
    { key: 'supportHours', label: 'Support hours per customer per month', unit: 'hours', help: 'Ongoing support time one customer needs.', group: 'Implementation and support', min: 0 },
    { key: 'infraPerCustomer', label: 'Infrastructure cost per customer per month', unit: 'usd', help: 'Cloud hosting and data storage that grows with each customer.', group: 'Implementation and support', min: 0, sensitivity: true },
    { key: 'csmPerCustomer', label: 'Customer success cost per customer per month', unit: 'usd', help: 'Account management and customer success effort per customer. Enter 0 if covered by the team plan.', group: 'Implementation and support', min: 0 },

    // Enterprise operating costs
    { key: 'hostingBase', label: 'Base hosting and data management per month', unit: 'usd', help: 'Platform hosting you pay regardless of customer count (environments, backups, monitoring). Counted as a direct cost.', group: 'Enterprise operating costs', min: 0 },
    { key: 'securityMonthly', label: 'Security and compliance per month', unit: 'usd', help: 'Security tools, compliance platforms, penetration testing.', group: 'Enterprise operating costs', min: 0, sensitivity: true },
    { key: 'certificationCost', label: 'Certification and audit cost per year', unit: 'usd', help: 'Annual audits such as SOC 2, or government security authorizations.', group: 'Enterprise operating costs', min: 0 },
    { key: 'certificationMonth', label: 'Month of the first certification audit', unit: 'month', help: 'The audit repeats every 12 months after this.', group: 'Enterprise operating costs', min: 1 },
    { key: 'legalMonthly', label: 'Legal and procurement support per month', unit: 'usd', help: 'Contract review, bid responses and procurement consultants.', group: 'Enterprise operating costs', min: 0 },
    { key: 'insuranceMonthly', label: 'Enterprise insurance per month', unit: 'usd', help: 'Cyber liability and professional liability coverage customers require.', group: 'Enterprise operating costs', min: 0 },

    // Payment timing
    { key: 'collectionDays', label: 'Days for customers to pay', unit: 'days', help: 'Average days from invoice to payment. Public agencies often take 45 to 90 days.', group: 'Payment timing', min: 0, max: 365, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'supplierDays', label: 'Days to pay vendors', unit: 'days', help: 'Average days you take to pay vendors for this business line.', group: 'Payment timing', min: 0, max: 120 },
  ],
  defaults: {
    prospectsPerMonth: 6,
    prospectGrowthPct: 3,
    openOppsAtStart: 3,
    pilotsAtStart: 0,
    qualifyPct: 35,
    monthsToQualify: 1,
    pilotPct: 40,
    evalMonths: 3,
    maxConcurrent: 12,
    salesBdMonthly: 3000,
    costPerProspect: 150,
    pilotMonths: 3,
    pilotCost: 9000,
    paidPilotPct: 50,
    pilotFee: 15000,
    pilotConversionPct: 50,
    decisionMonths: 1,
    procurementMonths: 3,
    startLagMonths: 0,
    licensePrice: 1200,
    licensesPerCustomer: 40,
    termMonths: 12,
    renewalPct: 85,
    priceIncreasePct: 3,
    implementationFee: 10000,
    trainingFee: 5000,
    proServicesMonthly: 0,
    laborRate: 0,
    onboardingHours: 80,
    trainingCost: 2500,
    configCost: 3000,
    supportHours: 6,
    infraPerCustomer: 450,
    csmPerCustomer: 0,
    hostingBase: 1500,
    securityMonthly: 1200,
    certificationCost: 30000,
    certificationMonth: 9,
    legalMonthly: 1000,
    insuranceMonthly: 600,
    collectionDays: 60,
    supplierDays: 30,
  },
  formulas: [
    {
      id: 'en.qualified', title: 'Qualified opportunities', definition: 'Expected prospects who become real opportunities, arriving after the qualification delay.',
      expression: 'Qualified (month t) = Prospects entering in month (t − months to qualify) × Qualification rate',
      result: { kind: 'metric', key: 'qualified' }, terms: [{ kind: 'metric', key: 'prospects', offset: 0 }, { kind: 'input', key: 'qualifyPct' }, { kind: 'input', key: 'monthsToQualify' }],
      limitations: 'These are expected values, not actual organizations. Opportunities beyond your team’s capacity are dropped.',
    },
    {
      id: 'en.pilots', title: 'Pilots started', definition: 'Qualified opportunities that start a pilot after evaluation.',
      expression: 'Pilots (month t) = Qualified opportunities pursued in month (t − evaluation months) × Pilot rate',
      result: { kind: 'metric', key: 'pilotsStarted' }, terms: [{ kind: 'metric', key: 'pursued' }, { kind: 'input', key: 'pilotPct' }, { kind: 'input', key: 'evalMonths' }],
      limitations: 'In whole-deals mode a pilot is counted when the running expected total reaches the next whole pilot.',
    },
    {
      id: 'en.wins', title: 'Contracts signed', definition: 'Pilots that convert to paying customers, after the decision and procurement delays.',
      expression: 'Contracts signed (month t) = Pilots started in month (t − pilot length − decision months − procurement delay) × Pilot conversion',
      result: { kind: 'metric', key: 'wins' }, terms: [{ kind: 'metric', key: 'pilotsStarted' }, { kind: 'input', key: 'pilotConversionPct' }, { kind: 'input', key: 'pilotMonths' }, { kind: 'input', key: 'decisionMonths' }, { kind: 'input', key: 'procurementMonths' }],
      limitations: 'Modeled deals are not real customers. Treat them as what must happen for the plan to work.',
    },
    {
      id: 'en.cycle', title: 'Average sales cycle', definition: 'Months from first contact with a prospect to the contract start.',
      expression: 'Sales cycle = Months to qualify + Evaluation + Pilot length + Decision + Procurement + Start delay',
      result: { kind: 'metric', key: 'salesCycle' }, terms: [{ kind: 'input', key: 'monthsToQualify' }, { kind: 'input', key: 'evalMonths' }, { kind: 'input', key: 'pilotMonths' }, { kind: 'input', key: 'decisionMonths' }, { kind: 'input', key: 'procurementMonths' }, { kind: 'input', key: 'startLagMonths' }],
    },
    {
      id: 'en.acv', title: 'Annual contract value (ACV)', definition: 'Annual software value of one first-year contract.',
      expression: 'ACV = Licenses per customer × Annual price per license',
      result: { kind: 'metric', key: 'acv' }, terms: [{ kind: 'input', key: 'licensesPerCustomer' }, { kind: 'input', key: 'licensePrice' }],
    },
    {
      id: 'en.contractedArr', title: 'Contracted ARR', definition: 'Annual value of all signed contracts, including ones signed but not yet started. Contracted is not the same as earned: revenue is earned month by month after the contract starts.',
      expression: 'Contracted ARR = Σ (signed, unexpired contracts × their current ACV)',
      result: { kind: 'metric', key: 'contractedArr' }, terms: [{ kind: 'metric', key: 'activeCustomers' }, { kind: 'metric', key: 'signedNotStarted' }, { kind: 'metric', key: 'acv' }],
    },
    {
      id: 'en.recurring', title: 'Recurring software revenue (recognized)', definition: 'Software subscription revenue earned in the month.',
      expression: 'Recognized software revenue = Σ active customers × Current ACV ÷ 12',
      result: { kind: 'revenue', key: 'software' }, terms: [{ kind: 'metric', key: 'activeCustomers' }, { kind: 'metric', key: 'acv' }, { kind: 'input', key: 'priceIncreasePct' }],
      reference: 'Subscription revenue recognized ratably over the service period (ASC 606, simplified).',
    },
    {
      id: 'en.implementation', title: 'Implementation and training revenue', definition: 'One-time fees from new customers.',
      expression: 'Implementation revenue = New customers × (Implementation fee + Training fee)  (at start, or spread over 12 months)',
      result: { kind: 'revenue', key: 'implementation' }, terms: [{ kind: 'metric', key: 'newCustomers' }, { kind: 'input', key: 'implementationFee' }, { kind: 'input', key: 'trainingFee' }],
    },
    {
      id: 'en.pilotCosts', title: 'Pilot delivery costs', definition: 'Cost of running pilots. Paid pilots are a direct cost of the pilot revenue; unpaid pilots are a cost of selling.',
      expression: 'Pilot cost (month) = Active pilots × Pilot cost ÷ Pilot length',
      result: { kind: 'metric', key: 'pilotCostTotal' }, terms: [{ kind: 'metric', key: 'activePilots' }, { kind: 'input', key: 'pilotCost' }, { kind: 'input', key: 'pilotMonths' }],
    },
    {
      id: 'en.onboarding', title: 'Customer onboarding costs', definition: 'One-time costs to bring a new customer live.',
      expression: 'Onboarding cost = New customers × (Onboarding hours × Labor rate + Training cost + Configuration cost)',
      result: { kind: 'direct', key: 'onboarding' }, terms: [{ kind: 'metric', key: 'newCustomers' }, { kind: 'input', key: 'onboardingHours' }, { kind: 'input', key: 'laborRate' }, { kind: 'input', key: 'trainingCost' }, { kind: 'input', key: 'configCost' }],
    },
    {
      id: 'en.pipeline', title: 'Sales pipeline value', definition: 'First-year contract value of opportunities still being pursued. Pipeline is not revenue: the weighted value applies the remaining conversion rates.',
      expression: 'Weighted pipeline = Open opportunities × Pilot rate × Conversion × ACV + Active pilots × Conversion × ACV',
      result: { kind: 'metric', key: 'pipelineWeighted' }, terms: [{ kind: 'metric', key: 'openOpps' }, { kind: 'metric', key: 'activePilots' }, { kind: 'input', key: 'pilotPct' }, { kind: 'input', key: 'pilotConversionPct' }, { kind: 'metric', key: 'acv' }],
    },
    {
      id: 'en.cac', title: 'Customer acquisition cost (CAC)', definition: 'Selling spend of this business line divided by contracts won, to date.',
      expression: 'CAC = Cumulative (Sales spend + Prospect marketing + Unpaid pilot cost) ÷ Cumulative contracts signed',
      result: { kind: 'metric', key: 'cac' }, terms: [{ kind: 'metric', key: 'cumSelling' }, { kind: 'metric', key: 'cumWins' }],
      limitations: 'Excludes salaried sales staff in the team plan.',
    },
    {
      id: 'en.concentration', title: 'Revenue concentration', definition: 'Share of software revenue that comes from the single largest customer.',
      expression: 'Concentration = Largest customer’s current ACV ÷ Total ACV of active customers',
      result: { kind: 'metric', key: 'concentration' }, terms: [{ kind: 'metric', key: 'activeCustomers' }],
      limitations: 'All customers are modeled as the same size, so concentration is about 1 ÷ number of customers. Real customers vary.',
    },
  ],

  compute(inputs, options, ctx) {
    const n = ctx.months;
    const isWhole = whole(options);
    const mq = Math.max(0, Math.round(val(inputs, 'monthsToQualify')));
    const ev = Math.max(0, Math.round(val(inputs, 'evalMonths')));
    const pm = Math.max(1, Math.round(val(inputs, 'pilotMonths')));
    const dm = Math.max(0, Math.round(val(inputs, 'decisionMonths')));
    const pr = Math.max(0, Math.round(val(inputs, 'procurementMonths')));
    const sl = Math.max(0, Math.round(val(inputs, 'startLagMonths')));
    const term = Math.max(1, Math.round(val(inputs, 'termMonths')));
    const cap = Math.max(0, val(inputs, 'maxConcurrent'));
    const qualify = Math.min(1, Math.max(0, pct(inputs, 'qualifyPct')));
    const pilotRate = Math.min(1, Math.max(0, pct(inputs, 'pilotPct')));
    const conv = Math.min(1, Math.max(0, pct(inputs, 'pilotConversionPct')));
    const paidShare = Math.min(1, Math.max(0, pct(inputs, 'paidPilotPct')));
    const renew = Math.min(1, Math.max(0, pct(inputs, 'renewalPct')));
    const inc = pct(inputs, 'priceIncreasePct');
    const acv0 = Math.max(0, val(inputs, 'licensesPerCustomer')) * Math.max(0, val(inputs, 'licensePrice'));
    const g = pct(inputs, 'prospectGrowthPct');

    // ---- Stage 1: prospects → qualified → pursued (capacity) → pilots
    const prospects = Array.from({ length: n }, (_, i) => Math.max(0, val(inputs, 'prospectsPerMonth') * Math.pow(1 + g, i)));
    const qualified = zeros(n);
    for (let s = 0; s < n; s++) if (s + mq < n) qualified[s + mq] += prospects[s] * qualify;
    qualified[0] += Math.max(0, val(inputs, 'openOppsAtStart'));

    const pursued = zeros(n);
    const dropped = zeros(n);
    const pilotsStarted = zeros(n);
    const paidPilots = zeros(n);
    const activePilots = zeros(n);
    const openOpps = zeros(n);
    const pilotCounter = new WholeCounter(isWhole);
    const paidCounter = new WholeCounter(isWhole);
    const pilotsAtStart = Math.max(0, Math.round(val(inputs, 'pilotsAtStart')));

    const activeAt = (arr: number[], t: number, from: number, len: number) => {
      // Sum of arr[q] for q in (t - len, t], restricted to q >= from
      let s = 0;
      for (let q = Math.max(from, t - len + 1); q <= t; q++) s += arr[q];
      return s;
    };

    for (let t = 0; t < n; t++) {
      // Pilots begin from opportunities pursued `ev` months ago.
      let starts = t === 0 ? pilotsAtStart : 0;
      if (ev > 0 && t - ev >= 0) starts += pilotCounter.add(pursued[t - ev] * pilotRate);

      // Capacity: opportunities still in evaluation (pursued in the previous
      // ev - 1 months) plus pilots active this month.
      const pilotsActiveNow = activeAt(pilotsStarted, t - 1, 0, pm - 1) + starts;
      const inEval = ev > 1 ? activeAt(pursued, t - 1, 0, ev - 1) : 0;
      const room = cap > 0 ? Math.max(0, cap - inEval - pilotsActiveNow) : Infinity;
      pursued[t] = Math.min(qualified[t], room);
      dropped[t] = qualified[t] - pursued[t];
      openOpps[t] = ev > 0 ? activeAt(pursued, t, 0, ev) : 0;

      // With no evaluation period, pursued opportunities start pilots at once.
      if (ev === 0) starts += pilotCounter.add(pursued[t] * pilotRate);
      pilotsStarted[t] = starts;
      paidPilots[t] = Math.min(starts, paidCounter.add(starts * paidShare));
      activePilots[t] = activeAt(pilotsStarted, t, 0, pm);
    }

    // ---- Stage 2: wins and contract starts
    const signDelay = pm + dm + pr;
    const winCounter = new WholeCounter(isWhole);
    const wins = zeros(n);
    for (let t = 0; t < n; t++) {
      const p = t - signDelay;
      wins[t] = p >= 0 ? winCounter.add(pilotsStarted[p] * conv) : winCounter.add(0);
    }
    const newCustomers = zeros(n);
    for (let t = 0; t < n; t++) if (t + sl < n) newCustomers[t + sl] += wins[t];
    const signedNotStarted = zeros(n);
    for (let t = 0; t < n; t++) for (let k = t - sl + 1; k <= t; k++) if (k >= 0 && sl > 0) signedNotStarted[t] += wins[k];

    // ---- Stage 3: customer cohorts, renewals, billing
    const software = zeros(n), impl = zeros(n), pro = zeros(n), pilotRev = zeros(n);
    const active = zeros(n), billings = zeros(n), contractedArr = zeros(n), largestAcv = zeros(n), totalAcv = zeros(n);
    const renewCounter = new WholeCounter(isWhole);
    const cohortSize = newCustomers.slice();
    const billing = String(options.billing ?? 'annual');
    const implFee = val(inputs, 'implementationFee') + val(inputs, 'trainingFee');

    for (let t = 0; t < n; t++) {
      for (let c = 0; c <= t; c++) {
        const age = t - c;
        if (age > 0 && age % term === 0 && cohortSize[c] > 0) {
          cohortSize[c] = isWhole ? renewCounter.add(cohortSize[c] * renew) : cohortSize[c] * renew;
        }
      }
      for (let c = 0; c <= t; c++) {
        const size = cohortSize[c];
        if (!size) continue;
        const age = t - c;
        const year = Math.floor(age / 12);
        const acv = acv0 * Math.pow(1 + inc, year);
        active[t] += size;
        software[t] += size * acv / 12;
        contractedArr[t] += size * acv;
        totalAcv[t] += size * acv;
        largestAcv[t] = Math.max(largestAcv[t], acv);
        if (billing === 'annual' && age % 12 === 0) billings[t] += size * acv;
        else if (billing === 'quarterly' && age % 3 === 0) billings[t] += size * acv / 4;
        else if (billing === 'monthly') billings[t] += size * acv / 12;
        pro[t] += size * val(inputs, 'proServicesMonthly');
      }
      contractedArr[t] += signedNotStarted[t] * acv0;
      // Implementation and training fees billed at contract start.
      if (newCustomers[t] > 0) {
        billings[t] += newCustomers[t] * implFee;
        if (recognizeOverYear(options)) {
          for (let k = 0; k < 12 && t + k < n; k++) impl[t + k] += newCustomers[t] * implFee / 12;
        } else impl[t] += newCustomers[t] * implFee;
      }
    }
    for (let t = 0; t < n; t++) billings[t] += pro[t];

    // Paid pilots: fee billed at pilot start, earned over the pilot.
    const pilotFee = val(inputs, 'pilotFee');
    for (let t = 0; t < n; t++) {
      if (!paidPilots[t]) continue;
      billings[t] += paidPilots[t] * pilotFee;
      for (let k = 0; k < pm && t + k < n; k++) pilotRev[t + k] += paidPilots[t] * pilotFee / pm;
    }

    // ---- Costs
    const perMonthPilot = Math.max(0, val(inputs, 'pilotCost')) / pm;
    const activePaid = zeros(n);
    for (let t = 0; t < n; t++) activePaid[t] = activeAt(paidPilots, t, 0, pm);
    const paidPilotCost = activePaid.map((a) => a * perMonthPilot);
    const unpaidPilotCost = activePilots.map((a, t) => Math.max(0, a - activePaid[t]) * perMonthPilot);
    const labor = Math.max(0, val(inputs, 'laborRate'));
    const onboarding = newCustomers.map((c) => c * (val(inputs, 'onboardingHours') * labor + val(inputs, 'trainingCost') + val(inputs, 'configCost')));
    const support = active.map((a) => a * (val(inputs, 'supportHours') * labor + val(inputs, 'csmPerCustomer')));
    const infra = active.map((a) => a * val(inputs, 'infraPerCustomer'));
    const hostingBase = active.map(() => Math.max(0, val(inputs, 'hostingBase')));
    const sales = prospects.map((p) => Math.max(0, val(inputs, 'salesBdMonthly')) + p * val(inputs, 'costPerProspect'));
    const security = active.map(() => Math.max(0, val(inputs, 'securityMonthly')));
    const certMonth = Math.max(1, Math.round(val(inputs, 'certificationMonth')));
    const cert = active.map((_, t) => (t + 1 >= certMonth && (t + 1 - certMonth) % 12 === 0 ? Math.max(0, val(inputs, 'certificationCost')) : 0));
    const legal = active.map(() => Math.max(0, val(inputs, 'legalMonthly')));
    const insurance = active.map(() => Math.max(0, val(inputs, 'insuranceMonthly')));

    const selling = sales.map((s, t) => s + unpaidPilotCost[t]);
    let cumSell = 0, cumWin = 0;
    const cumSelling = zeros(n), cumWins = zeros(n), cac = zeros(n);
    for (let t = 0; t < n; t++) {
      cumSell += selling[t]; cumWin += wins[t];
      cumSelling[t] = cumSell; cumWins[t] = cumWin;
      cac[t] = cumWin > 0 ? cumSell / cumWin : NaN;
    }
    const pipelineUnweighted = openOpps.map((o, t) => (o + activePilots[t]) * acv0);
    const pipelineWeighted = openOpps.map((o, t) => (o * pilotRate * conv + activePilots[t] * conv) * acv0);
    const concentration = totalAcv.map((tot, t) => (tot > 0 ? Math.min(1, largestAcv[t] / tot) : 0));
    const salesCycle = mq + ev + pm + dm + pr + sl;

    const issues: StreamResult['issues'] = [];
    const droppedMonths = dropped.map((d, t) => (d > 1e-6 ? t + 1 : 0)).filter(Boolean);
    if (droppedMonths.length) {
      issues.push({ id: 'en.capacity', level: 'warn', months: droppedMonths, message: `Qualified opportunities exceed what your team can pursue in ${droppedMonths.length} month(s), starting month ${droppedMonths[0]}. Those opportunities are not pursued.` });
    }
    if (salesCycle >= n) {
      issues.push({ id: 'en.cycleLong', level: 'warn', message: `The sales cycle (${salesCycle} months) is as long as the projection, so new prospects cannot become customers within it.` });
    }
    if (sum(wins) === 0) {
      issues.push({ id: 'en.noWins', level: 'info', message: 'No contracts are signed within the projection under these assumptions.' });
    }

    const directVendors = zeros(n);
    const opexVendors = zeros(n);
    for (let t = 0; t < n; t++) {
      directVendors[t] = paidPilotCost[t] + onboarding[t] + support[t] + infra[t] + hostingBase[t];
      opexVendors[t] = unpaidPilotCost[t] + sales[t] + security[t] + cert[t] + legal[t] + insurance[t];
    }

    return {
      revenue: [
        { key: 'software', label: 'Recurring software', values: software },
        { key: 'implementation', label: 'Implementation and training', values: impl },
        ...(sum(pro) > 0 ? [{ key: 'proServices', label: 'Professional services', values: pro }] : []),
        { key: 'pilots', label: 'Paid pilots', values: pilotRev },
      ],
      direct: [
        { key: 'paidPilotDelivery', label: 'Paid pilot delivery', values: paidPilotCost },
        { key: 'onboarding', label: 'Customer onboarding', values: onboarding },
        { key: 'support', label: 'Ongoing support and customer success', values: support },
        { key: 'infra', label: 'Infrastructure per customer', values: infra },
        { key: 'hostingBase', label: 'Base hosting and data management', values: hostingBase },
      ],
      opex: [
        { key: 'sales', label: 'Sales and business development', category: 'sm', values: sales },
        { key: 'unpaidPilots', label: 'Unpaid pilot delivery (cost of selling)', category: 'sm', values: unpaidPilotCost },
        { key: 'security', label: 'Security and compliance', category: 'ga', values: security },
        { key: 'certification', label: 'Certification and audits', category: 'ga', values: cert },
        { key: 'legal', label: 'Legal and procurement support', category: 'ga', values: legal },
        { key: 'insurance', label: 'Enterprise insurance', category: 'ga', values: insurance },
      ],
      billings: [{ label: 'Customer invoices', values: billings, days: val(inputs, 'collectionDays') + ctx.extraCollectionDays }],
      payables: [
        { label: 'Delivery vendors', values: directVendors, days: val(inputs, 'supplierDays'), kind: 'direct' },
        { label: 'Selling and compliance vendors', values: opexVendors, days: val(inputs, 'supplierDays'), kind: 'opex' },
      ],
      capex: [],
      issues,
      largestCustomerShare: concentration,
      metrics: [
        { key: 'prospects', label: 'New prospects (expected)', unit: 'count', values: prospects, total: 'sum' },
        { key: 'qualified', label: 'Qualified opportunities (expected)', unit: 'count', values: qualified, total: 'sum' },
        { key: 'pursued', label: 'Opportunities pursued', unit: 'count', values: pursued, total: 'sum' },
        { key: 'dropped', label: 'Opportunities not pursued (capacity)', unit: 'count', values: dropped, total: 'sum' },
        { key: 'openOpps', label: 'Open opportunities in evaluation', unit: 'count', values: openOpps, total: 'last' },
        { key: 'pilotsStarted', label: isWhole ? 'Pilots started (modeled whole deals)' : 'Pilots started (expected)', unit: 'count', values: pilotsStarted, total: 'sum' },
        { key: 'paidPilots', label: 'Paid pilots started', unit: 'count', values: paidPilots, total: 'sum' },
        { key: 'activePilots', label: 'Active pilots', unit: 'count', values: activePilots, total: 'last' },
        { key: 'wins', label: isWhole ? 'Contracts signed (modeled whole deals)' : 'Contracts signed (expected)', unit: 'count', values: wins, total: 'sum' },
        { key: 'newCustomers', label: 'Contracts starting', unit: 'count', values: newCustomers, total: 'sum' },
        { key: 'signedNotStarted', label: 'Signed, not yet started', unit: 'count', values: signedNotStarted, total: 'last' },
        { key: 'activeCustomers', label: 'Active paying customers', unit: 'count', values: active, total: 'last' },
        { key: 'acv', label: 'Annual contract value (first year)', unit: 'usd', values: active.map(() => acv0), total: 'last' },
        { key: 'contractedArr', label: 'Contracted ARR', unit: 'usd', values: contractedArr, total: 'last' },
        { key: 'pipelineUnweighted', label: 'Pipeline value (unweighted)', unit: 'usd', values: pipelineUnweighted, total: 'last' },
        { key: 'pipelineWeighted', label: 'Pipeline value (weighted)', unit: 'usd', values: pipelineWeighted, total: 'last' },
        { key: 'pilotCostTotal', label: 'Pilot delivery cost', unit: 'usd', values: paidPilotCost.map((p, t) => p + unpaidPilotCost[t]), total: 'sum' },
        { key: 'cumSelling', label: 'Cumulative selling spend', unit: 'usd', values: cumSelling, total: 'last' },
        { key: 'cumWins', label: 'Cumulative contracts signed', unit: 'count', values: cumWins, total: 'last' },
        { key: 'cac', label: 'Acquisition cost per contract (to date)', unit: 'usd', values: cac, total: 'last' },
        { key: 'concentration', label: 'Largest customer share of software revenue', unit: 'ratio', values: concentration, total: 'last' },
        { key: 'salesCycle', label: 'Average sales cycle', unit: 'months', values: active.map(() => salesCycle), total: 'last' },
      ],
    };
  },
};
