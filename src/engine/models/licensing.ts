import { pct, sum, val, wholeEvents, zeros } from '../timing';
import type { ModelModule } from './moduleTypes';

// Licensing: whole license deals, each with an upfront fee, an annual fee
// billed each contract year, and optional royalties on the licensee's sales.
// Contracts run for a set term; at term end a share renew for another term.

export const licensing: ModelModule = {
  kind: 'licensing',
  label: 'Licensing / intellectual property',
  short: 'Licensing',
  description:
    'Lets other companies use your technology, patent, brand or content in exchange for fees or royalties. Deals are few and large, revenue often depends on the licensee’s own sales, and payments can arrive months after the activity.',
  examples: 'A university spin-out licensing a patented material, a character brand licensed to toy makers, a software engine licensed to device makers.',
  defaultOptions: {},
  options: [],
  fields: [
    { key: 'initialLicensees', label: 'Licensees at start', unit: 'count', help: 'Licensees already under contract when the projection begins. Their contracts are treated as starting in the first month of sales, with no upfront fee.', group: 'Deals', min: 0 },
    { key: 'newPerQuarter', label: 'New licensees per quarter', unit: 'count', help: 'Average new license deals signed each quarter. Fractions are allowed; the model counts whole deals.', group: 'Deals', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'firstDealMonth', label: 'Earliest month a new deal can sign', unit: 'month', help: 'Licensing deals take time to negotiate. No new deals sign before this month.', group: 'Deals', min: 1, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'upfrontFee', label: 'Upfront license fee per deal', unit: 'usd', help: 'One-time fee paid when the license is signed.', group: 'Fees and royalties', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'annualFee', label: 'Annual license fee', unit: 'usd', help: 'Recurring fee billed at the start of each contract year and earned evenly over it.', group: 'Fees and royalties', min: 0, sensitivity: true },
    { key: 'royaltyPct', label: 'Royalty rate', unit: 'pct', help: 'Percent of the licensee’s sales of licensed products paid to you. Enter 0 if you do not charge royalties.', group: 'Fees and royalties', min: 0, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'licenseeUnits', label: 'Licensed units sold per licensee per month', unit: 'count', help: 'How many licensed products a typical licensee sells each month once ramped.', group: 'Fees and royalties', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'licenseeUnitPrice', label: 'Licensee’s price per unit', unit: 'usd', help: 'The price the licensee charges for one licensed product. Royalties are a share of this.', group: 'Fees and royalties', min: 0 },
    { key: 'rampMonths', label: 'Months for a licensee to reach full sales', unit: 'months', help: 'Licensees take time to launch products. Royalties ramp up evenly over this period.', group: 'Fees and royalties', min: 0, max: 36, sensitivity: true },
    { key: 'termMonths', label: 'Contract term', unit: 'months', help: 'Length of one license contract.', group: 'Contracts', min: 1, max: 120 },
    { key: 'renewalPct', label: 'Renewal rate at term end', unit: 'pct', help: 'Share of licensees who renew for another term.', group: 'Contracts', min: 0, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'commissionPct', label: 'Sales commission', unit: 'pct', help: 'Commission or broker fee paid on upfront and annual fees of new deals.', group: 'Costs', min: 0, max: 100 },
    { key: 'supportPerLicensee', label: 'Support cost per licensee per month', unit: 'usd', help: 'Technical support, quality audits and relationship management for one licensee.', group: 'Costs', min: 0, sensitivity: true },
    { key: 'ipCostMonthly', label: 'Patent and IP maintenance per month', unit: 'usd', help: 'Patent fees, legal protection and enforcement.', group: 'Costs', min: 0 },
    { key: 'collectionDays', label: 'Days to collect license fees', unit: 'days', help: 'Average days to collect upfront and annual fees.', group: 'Payment timing', min: 0, max: 365, scenario: true, worseWhen: 'higher' },
    { key: 'royaltyDays', label: 'Days until royalties are paid', unit: 'days', help: 'Royalties are usually reported and paid quarterly in arrears, often 45 to 90 days after the sales.', group: 'Payment timing', min: 0, max: 365, sensitivity: true, worseWhen: 'higher' },
    { key: 'supplierDays', label: 'Days to pay vendors', unit: 'days', help: 'Average days you take to pay support and legal vendors.', group: 'Payment timing', min: 0, max: 120 },
  ],
  defaults: {
    initialLicensees: 0,
    newPerQuarter: 1,
    firstDealMonth: 4,
    upfrontFee: 25000,
    annualFee: 12000,
    royaltyPct: 4,
    licenseeUnits: 500,
    licenseeUnitPrice: 60,
    rampMonths: 6,
    termMonths: 24,
    renewalPct: 70,
    commissionPct: 8,
    supportPerLicensee: 600,
    ipCostMonthly: 1500,
    collectionDays: 30,
    royaltyDays: 75,
    supplierDays: 30,
  },
  formulas: [
    {
      id: 'li.deals', title: 'New licensees', definition: 'Whole license deals signed in the month.',
      expression: 'Expected deals per month = New licensees per quarter ÷ 3 (from the earliest deal month). A deal is counted when the running expected total reaches the next whole deal.',
      result: { kind: 'metric', key: 'newDeals' }, terms: [{ kind: 'input', key: 'newPerQuarter' }, { kind: 'input', key: 'firstDealMonth' }],
      limitations: 'Real deals are lumpier and less predictable than an even rate.',
    },
    {
      id: 'li.upfront', title: 'Upfront license revenue', definition: 'One-time fees from newly signed licensees.',
      expression: 'Upfront revenue = New licensees × Upfront fee',
      result: { kind: 'revenue', key: 'upfront' }, terms: [{ kind: 'metric', key: 'newDeals' }, { kind: 'input', key: 'upfrontFee' }],
      limitations: 'Recognized at signing. Formal revenue rules sometimes require spreading upfront fees over the license term.',
    },
    {
      id: 'li.recurring', title: 'Recurring license revenue', definition: 'Annual fees from contracts in their first term, earned evenly across each contract year.',
      expression: 'Recurring revenue = Licensees in first term × Annual fee ÷ 12',
      result: { kind: 'revenue', key: 'recurring' }, terms: [{ kind: 'metric', key: 'firstTerm' }, { kind: 'input', key: 'annualFee' }],
    },
    {
      id: 'li.renewal', title: 'Renewal revenue', definition: 'Annual fees from contracts that renewed after their first term.',
      expression: 'Renewal revenue = Renewed licensees × Annual fee ÷ 12;  Renewed licensees = Contracts reaching term end × Renewal rate',
      result: { kind: 'revenue', key: 'renewal' }, terms: [{ kind: 'metric', key: 'renewed' }, { kind: 'input', key: 'annualFee' }, { kind: 'input', key: 'renewalPct' }],
    },
    {
      id: 'li.royalty', title: 'Royalty revenue', definition: 'A share of licensees’ sales of licensed products.',
      expression: 'Royalty revenue = Σ licensees × Units per licensee × Ramp factor × Licensee unit price × Royalty rate',
      result: { kind: 'revenue', key: 'royalty' }, terms: [{ kind: 'metric', key: 'activeLicensees' }, { kind: 'input', key: 'licenseeUnits' }, { kind: 'input', key: 'licenseeUnitPrice' }, { kind: 'input', key: 'royaltyPct' }, { kind: 'input', key: 'rampMonths' }],
      limitations: 'Earned when the licensee sells; collected after the royalty payment delay. You depend on the licensee’s sales effort, which you do not control.',
    },
    {
      id: 'li.commission', title: 'Sales commissions', definition: 'Commission on the fees of newly signed deals.',
      expression: 'Commissions = New licensees × (Upfront fee + Annual fee) × Commission rate',
      result: { kind: 'opex', key: 'commission' }, terms: [{ kind: 'metric', key: 'newDeals' }, { kind: 'input', key: 'upfrontFee' }, { kind: 'input', key: 'annualFee' }, { kind: 'input', key: 'commissionPct' }],
    },
  ],

  compute(inputs, _options, ctx) {
    const n = ctx.months;
    const first = Math.max(1, Math.round(val(inputs, 'firstDealMonth')));
    const expected = Array.from({ length: n }, (_, i) => (i + 1 >= first ? Math.max(0, val(inputs, 'newPerQuarter')) / 3 : 0));
    const deals = wholeEvents(expected);
    const initial = Math.max(0, Math.round(val(inputs, 'initialLicensees')));
    const term = Math.max(1, Math.round(val(inputs, 'termMonths')));
    const renew = Math.min(1, Math.max(0, pct(inputs, 'renewalPct')));
    const annualFee = val(inputs, 'annualFee');
    const ramp = Math.max(0, Math.round(val(inputs, 'rampMonths')));
    const perLicenseeRoyalty = Math.max(0, val(inputs, 'licenseeUnits')) * val(inputs, 'licenseeUnitPrice') * pct(inputs, 'royaltyPct');

    // Cohorts: signing month index, size, whether they pay an upfront fee.
    const cohorts: { s: number; size: number; isInitial: boolean }[] = [];
    if (initial > 0) cohorts.push({ s: 0, size: initial, isInitial: true });
    deals.forEach((d, s) => { if (d > 0) cohorts.push({ s, size: d, isInitial: false }); });

    const upfront = zeros(n), recurring = zeros(n), renewal = zeros(n), royalty = zeros(n);
    const firstTerm = zeros(n), renewed = zeros(n), activeAll = zeros(n), feeBillings = zeros(n);
    // Renewals are whole contracts. Expected renewals (contracts at term end ×
    // renewal rate) feed one running total across all cohorts, and a renewal is
    // counted each time that total reaches the next whole contract. This keeps
    // single-deal cohorts from never renewing because 1 × 70% rounds down.
    const size = cohorts.map((c) => c.size);
    let expectedRenewals = 0;
    let countedRenewals = 0;
    for (let i = 0; i < n; i++) {
      cohorts.forEach((c, ci) => {
        const age = i - c.s;
        if (age > 0 && age % term === 0 && size[ci] > 0) {
          expectedRenewals += size[ci] * renew;
          const whole = Math.floor(expectedRenewals + 1e-9);
          const renewedNow = whole - countedRenewals;
          countedRenewals = whole;
          size[ci] = renewedNow;
        }
      });
      cohorts.forEach((c, ci) => {
        if (i === c.s && !c.isInitial) upfront[i] += c.size * val(inputs, 'upfrontFee');
        if (i < c.s) return;
        const age = i - c.s;
        const k = Math.floor(age / term);
        const contracts = size[ci];
        if (!contracts) return;
        activeAll[i] += contracts;
        if (k === 0) { firstTerm[i] += contracts; recurring[i] += contracts * annualFee / 12; }
        else { renewed[i] += contracts; renewal[i] += contracts * annualFee / 12; }
        // Annual fee billed at the start of each contract year.
        if (age % 12 === 0) feeBillings[i] += contracts * annualFee;
        // Existing licensees are already selling; new ones ramp up.
        const r = c.isInitial || ramp === 0 ? 1 : Math.min(1, (age + 1) / ramp);
        royalty[i] += contracts * perLicenseeRoyalty * r;
      });
    }
    const newDeals = deals;
    const commission = newDeals.map((d) => d * (val(inputs, 'upfrontFee') + annualFee) * pct(inputs, 'commissionPct'));
    const support = activeAll.map((a) => a * val(inputs, 'supportPerLicensee'));
    const ip = activeAll.map(() => Math.max(0, val(inputs, 'ipCostMonthly')));

    const issues = [];
    if (sum(newDeals) === 0 && initial === 0) {
      issues.push({ id: 'li.noDeals', level: 'warn' as const, message: 'No license deals are signed during the projection.' });
    }

    return {
      revenue: [
        { key: 'upfront', label: 'Upfront license fees', values: upfront },
        { key: 'recurring', label: 'Recurring license fees', values: recurring },
        { key: 'renewal', label: 'Renewal fees', values: renewal },
        { key: 'royalty', label: 'Royalties', values: royalty },
      ],
      direct: [{ key: 'support', label: 'Licensee support', values: support }],
      opex: [
        { key: 'commission', label: 'Sales commissions', category: 'sm', values: commission },
        ...(sum(ip) > 0 ? [{ key: 'ip', label: 'Patent and IP maintenance', category: 'ga' as const, values: ip }] : []),
      ],
      billings: [
        { label: 'License fee invoices', values: upfront.map((u, i) => u + feeBillings[i]), days: val(inputs, 'collectionDays') + ctx.extraCollectionDays },
        { label: 'Royalty reports', values: royalty, days: val(inputs, 'royaltyDays') + ctx.extraCollectionDays },
      ],
      payables: [
        { label: 'Licensee support', values: support, days: val(inputs, 'supplierDays'), kind: 'direct' },
        { label: 'Commissions and IP costs', values: support.map((_, i) => commission[i] + ip[i]), days: val(inputs, 'supplierDays'), kind: 'opex' },
      ],
      capex: [],
      issues,
      largestCustomerShare: activeAll.map((a) => (a > 0 ? 1 / a : 0)),
      metrics: [
        { key: 'newDeals', label: 'New licensees signed', unit: 'count', values: newDeals, total: 'sum' },
        { key: 'activeLicensees', label: 'Active licensees', unit: 'count', values: activeAll, total: 'last' },
        { key: 'firstTerm', label: 'Licensees in first term', unit: 'count', values: firstTerm, total: 'last' },
        { key: 'renewed', label: 'Renewed licensees', unit: 'count', values: renewed, total: 'last' },
      ],
    };
  },
};
