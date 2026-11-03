import type { MetricLine, StreamResult } from '../types';
import { pct, sum, val, wholeEvents, zeros } from '../timing';
import type { ModelModule } from './moduleTypes';

// Software: any mix of subscriptions (SaaS), perpetual licenses with annual
// maintenance, and contract development projects.

const sub = (o: Record<string, string | boolean>) => o.subscription === true;
const subAnnual = (o: Record<string, string | boolean>) => o.subscription === true && o.annualPlans === true;
const lic = (o: Record<string, string | boolean>) => o.perpetual === true;
const proj = (o: Record<string, string | boolean>) => o.projects === true;

export const software: ModelModule = {
  kind: 'software',
  label: 'Software',
  short: 'Software',
  description:
    'Sells software. Combine any of three revenue streams: subscriptions (SaaS), one-time licenses with annual support contracts, and custom development projects. Use this if you are not yet sure which software model fits.',
  examples: 'A project-management SaaS, a desktop tool sold per seat with yearly maintenance, a studio that builds apps for clients.',
  defaultOptions: { subscription: true, annualPlans: false, perpetual: false, projects: false },
  options: [
    { key: 'subscription', label: 'Subscriptions (SaaS)', help: 'Customers pay a recurring fee to use the software.', group: 'Revenue streams', type: 'boolean' },
    { key: 'annualPlans', label: 'Offer annual prepaid plans', help: 'Some customers pay for a full year up front, usually at a discount. Cash arrives early; revenue is still earned month by month.', group: 'Revenue streams', type: 'boolean', showIf: sub },
    { key: 'perpetual', label: 'One-time licenses with annual support contracts', help: 'Customers buy the software outright, then pay a yearly fee for updates and support.', group: 'Revenue streams', type: 'boolean' },
    { key: 'projects', label: 'Custom development projects', help: 'You are paid to build software for a client. Revenue is earned as the work is delivered.', group: 'Revenue streams', type: 'boolean' },
  ],
  fields: [
    { key: 'subInitialCustomers', label: 'Paying subscribers at start', unit: 'count', help: 'Subscribers already paying when the projection begins.', group: 'Subscriptions', min: 0, showIf: sub },
    { key: 'subNewPerMonth', label: 'New subscribers per month', unit: 'count', help: 'New paying subscribers in the first month of sales.', group: 'Subscriptions', min: 0, showIf: sub, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'subNewGrowthPct', label: 'Monthly growth in new subscribers', unit: 'pct', help: 'How much faster you add subscribers each month. 5% means the second month of sales adds 5% more new subscribers than the first.', group: 'Subscriptions', min: -50, max: 100, showIf: sub, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'subPrice', label: 'Monthly subscription price', unit: 'usd', help: 'Average price per subscriber per month.', group: 'Subscriptions', min: 0, showIf: sub, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'subAnnualSharePct', label: 'Share of new subscribers choosing annual plans', unit: 'pct', help: 'Annual subscribers pay 12 months at once.', group: 'Subscriptions', min: 0, max: 100, showIf: subAnnual },
    { key: 'subAnnualDiscountPct', label: 'Annual plan discount', unit: 'pct', help: 'Discount off the monthly price for paying a year up front.', group: 'Subscriptions', min: 0, max: 90, showIf: subAnnual },
    { key: 'subChurnPct', label: 'Monthly subscriber churn', unit: 'pct', help: 'Share of subscribers who cancel each month. Annual subscribers can only leave at renewal, so for them the model applies 12 months of churn at once on each anniversary.', group: 'Subscriptions', min: 0, max: 100, showIf: sub, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'subOnboardingFee', label: 'Onboarding fee per new subscriber', unit: 'usd', help: 'One-time setup or implementation fee. Leave at 0 if you do not charge one.', group: 'Subscriptions', min: 0, showIf: sub },
    { key: 'subCac', label: 'Acquisition cost per new subscriber', unit: 'usd', help: 'Variable sales and marketing cost to win one subscriber (ads, commissions, trials). Fixed marketing spend is entered separately below.', group: 'Subscriptions', min: 0, showIf: sub, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'subHostingPerCustomer', label: 'Hosting cost per subscriber per month', unit: 'usd', help: 'Cloud and infrastructure cost that grows with each subscriber.', group: 'Subscriptions', min: 0, showIf: sub, sensitivity: true },
    { key: 'subSupportPerCustomer', label: 'Support cost per subscriber per month', unit: 'usd', help: 'Customer support cost that grows with each subscriber.', group: 'Subscriptions', min: 0, showIf: sub },

    { key: 'licNewPerMonth', label: 'Licenses sold per month', unit: 'count', help: 'Average licenses sold per month. Fractions are allowed (0.5 means one sale every two months); the model counts whole sales.', group: 'Licenses and support contracts', min: 0, showIf: lic, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'licGrowthPct', label: 'Monthly growth in license sales', unit: 'pct', help: 'Growth in the monthly sales rate.', group: 'Licenses and support contracts', min: -50, max: 100, showIf: lic },
    { key: 'licPrice', label: 'License price', unit: 'usd', help: 'One-time price per license.', group: 'Licenses and support contracts', min: 0, showIf: lic, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'licMaintPct', label: 'Annual support contract (% of license price)', unit: 'pct', help: 'Yearly maintenance and support fee as a percent of the license price. 20% is a common starting point.', group: 'Licenses and support contracts', min: 0, max: 100, showIf: lic },
    { key: 'licMaintRenewalPct', label: 'Support contract renewal rate', unit: 'pct', help: 'Share of support contracts renewed each year.', group: 'Licenses and support contracts', min: 0, max: 100, showIf: lic, sensitivity: true },
    { key: 'licDeliveryCost', label: 'Delivery cost per license', unit: 'usd', help: 'Direct cost to deliver and install one license.', group: 'Licenses and support contracts', min: 0, showIf: lic },
    { key: 'licSupportCost', label: 'Support cost per contract per month', unit: 'usd', help: 'Monthly cost to support one customer with an active support contract.', group: 'Licenses and support contracts', min: 0, showIf: lic },
    { key: 'licCac', label: 'Acquisition cost per license sale', unit: 'usd', help: 'Variable sales cost (commission, demos) per license sold.', group: 'Licenses and support contracts', min: 0, showIf: lic },

    { key: 'projNewPerMonth', label: 'New projects started per month', unit: 'count', help: 'Average project starts per month. 0.5 means one new project every two months.', group: 'Development projects', min: 0, showIf: proj, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'projValue', label: 'Average project value', unit: 'usd', help: 'Total contract price of one project.', group: 'Development projects', min: 0, showIf: proj, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'projDurationMonths', label: 'Average project length', unit: 'months', help: 'Months to deliver one project. Revenue and billing are spread evenly over this period.', group: 'Development projects', min: 1, max: 36, showIf: proj },
    { key: 'projDeliveryCostPct', label: 'Delivery cost (% of project value)', unit: 'pct', help: 'Contractor or delivery labor cost as a share of project revenue. Leave salaried delivery staff in the team plan instead.', group: 'Development projects', min: 0, max: 100, showIf: proj, sensitivity: true },

    { key: 'marketingFixed', label: 'Fixed marketing spend per month', unit: 'usd', help: 'Marketing that does not scale with each sale: website, content, events.', group: 'Sales, development and payment timing', min: 0, sensitivity: true },
    { key: 'devCostMonthly', label: 'Outside development cost per month', unit: 'usd', help: 'Product development paid to contractors or agencies. Put employees in the team plan.', group: 'Sales, development and payment timing', min: 0, sensitivity: true },
    { key: 'collectionDays', label: 'Days to collect customer payments', unit: 'days', help: 'Average days between invoicing a customer and receiving the cash. Card subscriptions are near 0; business invoices are often 30 to 60.', group: 'Sales, development and payment timing', min: 0, max: 365, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'supplierDays', label: 'Days to pay vendors', unit: 'days', help: 'Average days you take to pay hosting, contractors and other vendors for this business line.', group: 'Sales, development and payment timing', min: 0, max: 120 },
  ],
  defaults: {
    subInitialCustomers: 0,
    subNewPerMonth: 8,
    subNewGrowthPct: 5,
    subPrice: 99,
    subAnnualSharePct: 25,
    subAnnualDiscountPct: 15,
    subChurnPct: 3,
    subOnboardingFee: 0,
    subCac: 400,
    subHostingPerCustomer: 6,
    subSupportPerCustomer: 8,
    licNewPerMonth: 1,
    licGrowthPct: 3,
    licPrice: 5000,
    licMaintPct: 20,
    licMaintRenewalPct: 80,
    licDeliveryCost: 300,
    licSupportCost: 40,
    licCac: 750,
    projNewPerMonth: 0.5,
    projValue: 40000,
    projDurationMonths: 4,
    projDeliveryCostPct: 45,
    marketingFixed: 1500,
    devCostMonthly: 0,
    collectionDays: 5,
    supplierDays: 15,
  },
  formulas: [
    {
      id: 'sw.customers', title: 'Active subscribers', showIf: sub,
      definition: 'Paying subscribers at the end of each month.',
      expression: 'Ending subscribers = Beginning subscribers + New subscribers − Churned subscribers',
      result: { kind: 'metric', key: 'endCustomers' },
      terms: [{ kind: 'metric', key: 'beginCustomers' }, { kind: 'metric', key: 'newCustomers' }, { kind: 'metric', key: 'churned' }],
      limitations: 'Subscriber counts are averages and can be fractional. Monthly subscribers churn every month; annual subscribers churn only at renewal.',
    },
    {
      id: 'sw.newCustomers', title: 'New subscribers', showIf: sub,
      definition: 'Subscribers added during the month.',
      expression: 'New subscribers (month t) = New subscribers per month × (1 + monthly growth)^(t − 1)',
      result: { kind: 'metric', key: 'newCustomers' },
      terms: [{ kind: 'input', key: 'subNewPerMonth' }, { kind: 'input', key: 'subNewGrowthPct' }],
    },
    {
      id: 'sw.churn', title: 'Churned subscribers', showIf: sub,
      definition: 'Subscribers who cancel during the month.',
      expression: 'Churned = Beginning monthly-plan subscribers × Monthly churn (+ annual subscribers lost at renewal)',
      result: { kind: 'metric', key: 'churned' },
      terms: [{ kind: 'metric', key: 'beginCustomers' }, { kind: 'input', key: 'subChurnPct' }],
    },
    {
      id: 'sw.subRevenue', title: 'Subscription revenue', showIf: sub,
      definition: 'Subscription fees earned in the month. Revenue is earned as the service is provided, even if the customer paid for a year in advance.',
      expression: 'Subscription revenue = Monthly-plan subscribers × Price + Annual-plan subscribers × Price × (1 − Annual discount)',
      result: { kind: 'revenue', key: 'subscription' },
      terms: [{ kind: 'metric', key: 'monthlyPlan' }, { kind: 'metric', key: 'annualPlan' }, { kind: 'input', key: 'subPrice' }, { kind: 'input', key: 'subAnnualDiscountPct' }],
      reference: 'Revenue earned over the service period, consistent with ASC 606 / IFRS 15 (simplified).',
    },
    {
      id: 'sw.mrr', title: 'Monthly recurring revenue (MRR)', showIf: sub,
      definition: 'The subscription revenue the business is earning per month at the end of the month.',
      expression: 'MRR = Subscription revenue earned in the month',
      result: { kind: 'metric', key: 'mrr' },
      terms: [{ kind: 'revenue', key: 'subscription' }],
    },
    {
      id: 'sw.arr', title: 'Annual recurring revenue (ARR)', showIf: sub,
      definition: 'ARR is an annualized run rate: what a year would look like if this month repeated twelve times. It is not revenue actually earned during the year.',
      expression: 'ARR = MRR × 12',
      result: { kind: 'metric', key: 'arr' },
      terms: [{ kind: 'metric', key: 'mrr' }],
      limitations: 'A growing business earns less than its ending ARR during the year; a shrinking one earns more.',
    },
    {
      id: 'sw.onboarding', title: 'Onboarding revenue', showIf: sub,
      definition: 'One-time setup fees from new subscribers.',
      expression: 'Onboarding revenue = New subscribers × Onboarding fee',
      result: { kind: 'revenue', key: 'onboarding' },
      terms: [{ kind: 'metric', key: 'newCustomers' }, { kind: 'input', key: 'subOnboardingFee' }],
      limitations: 'Recognized when the customer starts. Under formal revenue rules some setup fees must be spread over the contract.',
    },
    {
      id: 'sw.costToServe', title: 'Cost to serve subscribers', showIf: sub,
      definition: 'Direct monthly cost of hosting and supporting active subscribers.',
      expression: 'Cost to serve = Active subscribers × (Hosting per subscriber + Support per subscriber)',
      result: { kind: 'direct', key: 'serve' },
      terms: [{ kind: 'metric', key: 'endCustomers' }, { kind: 'input', key: 'subHostingPerCustomer' }, { kind: 'input', key: 'subSupportPerCustomer' }],
    },
    {
      id: 'sw.acq', title: 'Customer acquisition spending', showIf: sub,
      definition: 'Variable sales and marketing spent to win new subscribers.',
      expression: 'Acquisition spending = New subscribers × Acquisition cost per subscriber',
      result: { kind: 'opex', key: 'subAcq' },
      terms: [{ kind: 'metric', key: 'newCustomers' }, { kind: 'input', key: 'subCac' }],
    },
    {
      id: 'sw.cac', title: 'Blended customer acquisition cost (CAC)',
      definition: 'Total sales and marketing spend of this business line divided by the new customers it won.',
      expression: 'Blended CAC = (Variable acquisition spend + Fixed marketing) ÷ New customers',
      result: { kind: 'metric', key: 'blendedCac' },
      terms: [{ kind: 'opex', key: 'subAcq' }, { kind: 'opex', key: 'licAcq' }, { kind: 'opex', key: 'marketing' }, { kind: 'metric', key: 'newCustomers' }, { kind: 'metric', key: 'licSales' }],
      limitations: 'Excludes salaried sales staff in the team plan. Include them for a fuller CAC.',
    },
    {
      id: 'sw.ltv', title: 'Customer lifetime value (LTV)', showIf: sub,
      definition: 'Gross profit one subscriber is expected to produce over their lifetime.',
      expression: 'LTV = (Average revenue per subscriber − Cost to serve per subscriber) ÷ Monthly churn',
      result: { kind: 'metric', key: 'ltv' },
      terms: [{ kind: 'metric', key: 'arpu' }, { kind: 'input', key: 'subHostingPerCustomer' }, { kind: 'input', key: 'subSupportPerCustomer' }, { kind: 'input', key: 'subChurnPct' }],
      limitations: 'Assumes churn and price stay constant forever and ignores the time value of money. With 0% churn the formula has no meaningful answer, so none is shown. Treat LTV as a rough comparison against CAC, not a forecast.',
      reference: 'Standard SaaS unit-economics definition (gross-margin LTV, 1 / churn lifetime).',
    },
    {
      id: 'sw.license', title: 'License revenue', showIf: lic,
      definition: 'One-time license sales, earned when the software is delivered.',
      expression: 'License revenue = Licenses sold × License price',
      result: { kind: 'revenue', key: 'license' },
      terms: [{ kind: 'metric', key: 'licSales' }, { kind: 'input', key: 'licPrice' }],
      limitations: 'Fractional sales rates are converted into whole sales: a sale is counted in the month the expected total reaches the next whole sale.',
    },
    {
      id: 'sw.maint', title: 'Support contract revenue', showIf: lic,
      definition: 'Annual support contracts are billed once a year and earned evenly over the 12 months.',
      expression: 'Monthly support revenue = Active support contracts × License price × Support % ÷ 12',
      result: { kind: 'revenue', key: 'maintenance' },
      terms: [{ kind: 'metric', key: 'maintContracts' }, { kind: 'input', key: 'licPrice' }, { kind: 'input', key: 'licMaintPct' }],
      limitations: 'Contracts renew each year at the renewal rate; non-renewing customers stop paying support.',
    },
    {
      id: 'sw.projects', title: 'Development project revenue', showIf: proj,
      definition: 'Project fees earned evenly over the project length.',
      expression: 'Project revenue = Active projects × Project value ÷ Project length',
      result: { kind: 'revenue', key: 'projects' },
      terms: [{ kind: 'metric', key: 'activeProjects' }, { kind: 'input', key: 'projValue' }, { kind: 'input', key: 'projDurationMonths' }],
    },
  ],

  compute(inputs, options, ctx) {
    const n = ctx.months;
    const metrics: MetricLine[] = [];
    const revenue: StreamResult['revenue'] = [];
    const direct: StreamResult['direct'] = [];
    const opex: StreamResult['opex'] = [];
    const billingsAll = zeros(n);
    const issues: StreamResult['issues'] = [];

    let newSubsTotal = zeros(n);
    let licSalesTotal = zeros(n);
    const subAcq = zeros(n);
    const licAcq = zeros(n);

    // ---------------- Subscriptions
    if (sub(options)) {
      const churn = Math.min(1, Math.max(0, pct(inputs, 'subChurnPct')));
      const price = val(inputs, 'subPrice');
      const annualShare = subAnnual(options) ? Math.min(1, Math.max(0, pct(inputs, 'subAnnualSharePct'))) : 0;
      const annualPrice = price * (1 - (subAnnual(options) ? pct(inputs, 'subAnnualDiscountPct') : 0));
      const g = pct(inputs, 'subNewGrowthPct');
      const yearlyRetention = Math.pow(1 - churn, 12);

      const begin = zeros(n), newC = zeros(n), churned = zeros(n), end = zeros(n);
      const monthlyPlan = zeros(n), annualPlan = zeros(n);
      const subRev = zeros(n), onboard = zeros(n), serve = zeros(n);
      const annualCohorts: number[] = []; // size at signup, by month index

      let monthlyPool = Math.max(0, val(inputs, 'subInitialCustomers'));
      let prevAnnual = 0;
      for (let i = 0; i < n; i++) {
        const adds = Math.max(0, val(inputs, 'subNewPerMonth') * Math.pow(1 + g, i));
        newC[i] = adds;
        const monthlyChurn = monthlyPool * churn;
        begin[i] = monthlyPool + prevAnnual;
        monthlyPool = monthlyPool - monthlyChurn + adds * (1 - annualShare);
        annualCohorts[i] = adds * annualShare;

        let annualActive = 0;
        let annualBilled = 0;
        for (let s = 0; s <= i; s++) {
          const size = annualCohorts[s];
          if (!size) continue;
          const years = Math.floor((i - s) / 12);
          const active = size * Math.pow(yearlyRetention, years);
          annualActive += active;
          if ((i - s) % 12 === 0) annualBilled += active * annualPrice * 12;
        }
        // Annual customers lost at renewal this month = previous active + new annual - current active
        const annualLost = Math.max(0, prevAnnual + annualCohorts[i] - annualActive);
        churned[i] = monthlyChurn + annualLost;
        monthlyPlan[i] = monthlyPool;
        annualPlan[i] = annualActive;
        end[i] = monthlyPool + annualActive;
        prevAnnual = annualActive;

        subRev[i] = monthlyPool * price + annualActive * annualPrice;
        onboard[i] = adds * val(inputs, 'subOnboardingFee');
        serve[i] = end[i] * (val(inputs, 'subHostingPerCustomer') + val(inputs, 'subSupportPerCustomer'));
        subAcq[i] = adds * val(inputs, 'subCac');
        billingsAll[i] += monthlyPool * price + annualBilled + onboard[i];
      }
      newSubsTotal = newC;
      revenue.push({ key: 'subscription', label: 'Subscription revenue', values: subRev });
      if (sum(onboard) > 0) revenue.push({ key: 'onboarding', label: 'Onboarding fees', values: onboard });
      direct.push({ key: 'serve', label: 'Hosting and support (cost to serve)', values: serve });
      opex.push({ key: 'subAcq', label: 'Subscriber acquisition', category: 'sm', values: subAcq });

      const mrr = subRev.slice();
      const arpu = subRev.map((r, i) => (end[i] > 0 ? r / end[i] : 0));
      const servePer = val(inputs, 'subHostingPerCustomer') + val(inputs, 'subSupportPerCustomer');
      const ltv = arpu.map((a) => (churn > 0 ? (a - servePer) / churn : NaN));
      if (churn === 0) {
        issues.push({ id: 'sw.noChurn', level: 'warn', message: 'Subscriber churn is 0%. Almost every subscription business loses some customers each month; lifetime value cannot be calculated without churn.' });
      }
      metrics.push(
        { key: 'beginCustomers', label: 'Beginning subscribers', unit: 'count', values: begin, total: 'none' },
        { key: 'newCustomers', label: 'New subscribers', unit: 'count', values: newC, total: 'sum' },
        { key: 'churned', label: 'Churned subscribers', unit: 'count', values: churned, total: 'sum' },
        { key: 'endCustomers', label: 'Ending subscribers', unit: 'count', values: end, total: 'last' },
        { key: 'monthlyPlan', label: 'Monthly-plan subscribers', unit: 'count', values: monthlyPlan, total: 'last' },
        { key: 'annualPlan', label: 'Annual-plan subscribers', unit: 'count', values: annualPlan, total: 'last' },
        { key: 'mrr', label: 'MRR', unit: 'usd', values: mrr, total: 'last' },
        { key: 'arr', label: 'ARR (annualized run rate)', unit: 'usd', values: mrr.map((m) => m * 12), total: 'last', note: 'Run rate, not revenue earned.' },
        { key: 'arpu', label: 'Average revenue per subscriber', unit: 'usd', values: arpu, total: 'last' },
        { key: 'ltv', label: 'Lifetime value per subscriber', unit: 'usd', values: ltv, total: 'last' },
      );
    }

    // ---------------- Perpetual licenses + support contracts
    if (lic(options)) {
      const g = pct(inputs, 'licGrowthPct');
      const expected = Array.from({ length: n }, (_, i) => Math.max(0, val(inputs, 'licNewPerMonth') * Math.pow(1 + g, i)));
      const sales = wholeEvents(expected);
      const price = val(inputs, 'licPrice');
      const maintAnnual = price * pct(inputs, 'licMaintPct');
      const renew = Math.min(1, Math.max(0, pct(inputs, 'licMaintRenewalPct')));
      const licRev = zeros(n), maintRev = zeros(n), contracts = zeros(n), deliv = zeros(n), support = zeros(n);
      for (let i = 0; i < n; i++) {
        licRev[i] = sales[i] * price;
        deliv[i] = sales[i] * val(inputs, 'licDeliveryCost');
        licAcq[i] = sales[i] * val(inputs, 'licCac');
        let active = 0;
        let billed = 0;
        for (let s = 0; s <= i; s++) {
          if (!sales[s]) continue;
          const years = Math.floor((i - s) / 12);
          const a = sales[s] * Math.pow(renew, years);
          active += a;
          if ((i - s) % 12 === 0) billed += a * maintAnnual;
        }
        contracts[i] = active;
        maintRev[i] = active * maintAnnual / 12;
        support[i] = active * val(inputs, 'licSupportCost');
        billingsAll[i] += licRev[i] + billed;
      }
      licSalesTotal = sales;
      revenue.push({ key: 'license', label: 'License sales', values: licRev });
      revenue.push({ key: 'maintenance', label: 'Support contracts', values: maintRev });
      direct.push({ key: 'licDelivery', label: 'License delivery', values: deliv });
      direct.push({ key: 'licSupport', label: 'Support contract servicing', values: support });
      opex.push({ key: 'licAcq', label: 'License sales costs', category: 'sm', values: licAcq });
      metrics.push(
        { key: 'licSales', label: 'Licenses sold', unit: 'count', values: sales, total: 'sum' },
        { key: 'maintContracts', label: 'Active support contracts', unit: 'count', values: contracts, total: 'last' },
      );
    }

    // ---------------- Development projects
    if (proj(options)) {
      const starts = wholeEvents(zeros(n).map(() => Math.max(0, val(inputs, 'projNewPerMonth'))));
      const dur = Math.max(1, Math.round(val(inputs, 'projDurationMonths')));
      const value = val(inputs, 'projValue');
      const active = zeros(n), rev = zeros(n);
      for (let s = 0; s < n; s++) {
        if (!starts[s]) continue;
        for (let k = 0; k < dur && s + k < n; k++) {
          active[s + k] += starts[s];
          rev[s + k] += starts[s] * value / dur;
        }
      }
      const cost = rev.map((r) => r * pct(inputs, 'projDeliveryCostPct'));
      for (let i = 0; i < n; i++) billingsAll[i] += rev[i];
      revenue.push({ key: 'projects', label: 'Development projects', values: rev });
      direct.push({ key: 'projDelivery', label: 'Project delivery', values: cost });
      metrics.push(
        { key: 'projectStarts', label: 'Projects started', unit: 'count', values: starts, total: 'sum' },
        { key: 'activeProjects', label: 'Active projects', unit: 'count', values: active, total: 'last' },
      );
    }

    const marketing = zeros(n).map(() => Math.max(0, val(inputs, 'marketingFixed')));
    const dev = zeros(n).map(() => Math.max(0, val(inputs, 'devCostMonthly')));
    if (sum(marketing) > 0) opex.push({ key: 'marketing', label: 'Fixed marketing', category: 'sm', values: marketing });
    if (sum(dev) > 0) opex.push({ key: 'devOutside', label: 'Outside development', category: 'rd', values: dev });

    const newCustomers = newSubsTotal.map((v, i) => v + licSalesTotal[i]);
    const acqSpend = subAcq.map((v, i) => v + licAcq[i] + marketing[i]);
    metrics.push({
      key: 'blendedCac', label: 'Blended acquisition cost per new customer', unit: 'usd', total: 'avg',
      values: acqSpend.map((s, i) => (newCustomers[i] > 0 ? s / newCustomers[i] : NaN)),
    });

    if (!sub(options) && !lic(options) && !proj(options)) {
      issues.push({ id: 'sw.noStreams', level: 'warn', message: 'No software revenue stream is turned on, so this business line earns nothing.' });
    }

    const supplierDays = val(inputs, 'supplierDays');
    const directCosts = zeros(n);
    const opexCosts = zeros(n);
    for (const l of direct) for (let i = 0; i < n; i++) directCosts[i] += l.values[i];
    for (const l of opex) for (let i = 0; i < n; i++) opexCosts[i] += l.values[i];

    return {
      revenue,
      direct,
      opex,
      billings: [{ label: 'Customer invoices', values: billingsAll, days: val(inputs, 'collectionDays') + ctx.extraCollectionDays }],
      payables: [
        { label: 'Hosting, support and delivery vendors', values: directCosts, days: supplierDays, kind: 'direct' },
        { label: 'Marketing and development vendors', values: opexCosts, days: supplierDays, kind: 'opex' },
      ],
      capex: [],
      metrics,
      issues,
    };
  },
};
