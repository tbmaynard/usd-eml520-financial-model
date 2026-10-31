import type { StreamResult } from '../types';
import { pct, sum, val, wholeEvents, zeros } from '../timing';
import type { ModelModule } from './moduleTypes';

const fixedFee = (o: Record<string, string | boolean>) => o.pricing === 'fixed';
const hourly = (o: Record<string, string | boolean>) => o.pricing !== 'fixed';

export const services: ModelModule = {
  kind: 'services',
  label: 'Professional services / consulting',
  short: 'Services',
  description:
    'Sells the time and expertise of people. Revenue is limited by how many billable hours your team can deliver, so hiring, utilization and billing rates drive everything.',
  examples: 'An engineering consultancy, a design agency, an accident reconstruction firm, an IT integrator.',
  defaultOptions: { pricing: 'hourly' },
  options: [
    {
      key: 'pricing', label: 'How you price work', help: 'Hourly billing charges for every hour worked. Fixed-fee projects charge a set price per engagement, spread over its length.',
      group: 'Clients and pricing', type: 'select',
      choices: [{ value: 'hourly', label: 'Hourly billing' }, { value: 'fixed', label: 'Fixed fee per engagement' }],
    },
  ],
  fields: [
    { key: 'newClientsPerMonth', label: 'New client engagements per month', unit: 'count', help: 'Average new engagements started per month. Fractions are allowed; the model counts whole engagements.', group: 'Clients and pricing', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'clientGrowthPct', label: 'Monthly growth in new engagements', unit: 'pct', help: 'Growth in the rate of new engagements as your reputation builds.', group: 'Clients and pricing', min: -50, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'projectDurationMonths', label: 'Average engagement length', unit: 'months', help: 'How many months a typical engagement lasts.', group: 'Clients and pricing', min: 1, max: 36 },
    { key: 'hoursPerClientMonth', label: 'Hours of work per engagement per month', unit: 'hours', help: 'Billable hours one active engagement needs each month.', group: 'Clients and pricing', min: 0, sensitivity: true },
    { key: 'billingRate', label: 'Billing rate per hour', unit: 'usd', help: 'Average hourly rate charged to clients.', group: 'Clients and pricing', min: 0, showIf: hourly, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'projectFee', label: 'Fee per engagement', unit: 'usd', help: 'Total fixed price of one engagement.', group: 'Clients and pricing', min: 0, showIf: fixedFee, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'marketingFixed', label: 'Business development spend per month', unit: 'usd', help: 'Networking, proposals, conferences and marketing.', group: 'Clients and pricing', min: 0 },

    { key: 'consultantsStart', label: 'Billable consultants at start', unit: 'count', help: 'People whose time you bill to clients, including founders who bill.', group: 'Delivery team', min: 0, sensitivity: true },
    { key: 'consultantsAdded', label: 'Billable consultants added later', unit: 'count', help: 'Additional billable hires. Set to 0 if you do not plan to grow the team.', group: 'Delivery team', min: 0 },
    { key: 'consultantsAddedMonth', label: 'Month the added consultants start', unit: 'month', help: 'Costs and capacity begin in this month.', group: 'Delivery team', min: 1, scenario: true, worseWhen: 'lower' },
    { key: 'hoursPerPerson', label: 'Working hours per consultant per month', unit: 'hours', help: 'Total paid working hours. About 160 for a full-time person.', group: 'Delivery team', min: 0, max: 300 },
    { key: 'utilizationPct', label: 'Billable utilization target', unit: 'pct', help: 'Share of working hours that can be billed. The rest goes to admin, sales, training and gaps between projects. 60% to 80% is common.', group: 'Delivery team', min: 0, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'consultantSalary', label: 'Monthly salary per consultant', unit: 'usd', help: 'Gross monthly pay for one billable consultant.', group: 'Delivery team', min: 0, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'burdenPct', label: 'Benefits and payroll taxes', unit: 'pct', help: 'Employer payroll taxes, health insurance and benefits as a percent of salary. 20% to 30% is typical in the US.', group: 'Delivery team', min: 0, max: 100 },
    { key: 'contractorHoursMax', label: 'Contractor hours available per month', unit: 'hours', help: 'Outside contractor hours you can call on when your own team is full.', group: 'Delivery team', min: 0 },
    { key: 'contractorCostPerHour', label: 'Contractor cost per hour', unit: 'usd', help: 'What you pay a contractor per hour.', group: 'Delivery team', min: 0 },
    { key: 'adminStaff', label: 'Non-billable administrative staff', unit: 'count', help: 'Office managers, coordinators and others whose time is not billed.', group: 'Delivery team', min: 0 },
    { key: 'adminSalary', label: 'Monthly salary per admin staff member', unit: 'usd', help: 'Gross monthly pay for one administrative person.', group: 'Delivery team', min: 0 },

    { key: 'collectionDays', label: 'Days for clients to pay', unit: 'days', help: 'Average days from invoice to payment. Many organizations pay in 30 to 60 days.', group: 'Payment timing', min: 0, max: 365, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'supplierDays', label: 'Days to pay contractors and vendors', unit: 'days', help: 'Salaries are paid immediately; this applies to contractors and other vendors.', group: 'Payment timing', min: 0, max: 120 },
  ],
  defaults: {
    newClientsPerMonth: 1.5,
    clientGrowthPct: 4,
    projectDurationMonths: 3,
    hoursPerClientMonth: 90,
    billingRate: 165,
    projectFee: 45000,
    marketingFixed: 2000,
    consultantsStart: 2,
    consultantsAdded: 2,
    consultantsAddedMonth: 9,
    hoursPerPerson: 160,
    utilizationPct: 70,
    consultantSalary: 9500,
    burdenPct: 25,
    contractorHoursMax: 80,
    contractorCostPerHour: 95,
    adminStaff: 1,
    adminSalary: 5000,
    collectionDays: 45,
    supplierDays: 30,
  },
  formulas: [
    {
      id: 'ps.available', title: 'Available working hours', definition: 'Paid working hours of the billable team.',
      expression: 'Available hours = Billable consultants × Working hours per consultant',
      result: { kind: 'metric', key: 'availableHours' },
      terms: [{ kind: 'metric', key: 'consultants' }, { kind: 'input', key: 'hoursPerPerson' }],
    },
    {
      id: 'ps.capacity', title: 'Delivery capacity', definition: 'Hours the team can bill once non-billable time is set aside, plus available contractor hours.',
      expression: 'Delivery capacity = Available hours × Utilization target + Contractor hours available',
      result: { kind: 'metric', key: 'capacityHours' },
      terms: [{ kind: 'metric', key: 'availableHours' }, { kind: 'input', key: 'utilizationPct' }, { kind: 'input', key: 'contractorHoursMax' }],
    },
    {
      id: 'ps.demand', title: 'Hours clients need', definition: 'Hours of work required by active engagements.',
      expression: 'Hours needed = Active engagements × Hours per engagement per month',
      result: { kind: 'metric', key: 'demandHours' },
      terms: [{ kind: 'metric', key: 'activeClients' }, { kind: 'input', key: 'hoursPerClientMonth' }],
      limitations: 'Active engagements are those started within the last engagement length.',
    },
    {
      id: 'ps.billable', title: 'Billable hours', definition: 'Hours actually delivered and billed: the smaller of what clients need and what you can deliver.',
      expression: 'Billable hours = min(Hours needed, Delivery capacity)',
      result: { kind: 'metric', key: 'billableHours' },
      terms: [{ kind: 'metric', key: 'demandHours' }, { kind: 'metric', key: 'capacityHours' }],
    },
    {
      id: 'ps.revenue', title: 'Service revenue', showIf: hourly, definition: 'Fees billed for hours delivered.',
      expression: 'Revenue = Billable hours × Billing rate',
      result: { kind: 'revenue', key: 'services' },
      terms: [{ kind: 'metric', key: 'billableHours' }, { kind: 'input', key: 'billingRate' }],
    },
    {
      id: 'ps.revenueFixed', title: 'Service revenue (fixed fee)', showIf: fixedFee, definition: 'Engagement fees earned evenly over the engagement, reduced if you lack capacity to deliver.',
      expression: 'Revenue = Active engagements × Fee ÷ Engagement length × (Billable hours ÷ Hours needed)',
      result: { kind: 'revenue', key: 'services' },
      terms: [{ kind: 'metric', key: 'activeClients' }, { kind: 'input', key: 'projectFee' }, { kind: 'input', key: 'projectDurationMonths' }, { kind: 'metric', key: 'billableHours' }, { kind: 'metric', key: 'demandHours' }],
    },
    {
      id: 'ps.personnel', title: 'Delivery personnel cost', definition: 'Fully loaded cost of billable consultants. Paid whether or not their time is billed.',
      expression: 'Personnel cost = Consultants × Monthly salary × (1 + Benefits and payroll taxes)',
      result: { kind: 'direct', key: 'consultants' },
      terms: [{ kind: 'metric', key: 'consultants' }, { kind: 'input', key: 'consultantSalary' }, { kind: 'input', key: 'burdenPct' }],
    },
    {
      id: 'ps.util', title: 'Actual utilization', definition: 'Share of the team’s available hours that were billed.',
      expression: 'Utilization = Hours billed by staff ÷ Available hours',
      result: { kind: 'metric', key: 'utilization' },
      terms: [{ kind: 'metric', key: 'staffBillableHours' }, { kind: 'metric', key: 'availableHours' }],
    },
    {
      id: 'ps.revPerEmp', title: 'Revenue per billable employee', definition: 'Monthly revenue divided by billable headcount.',
      expression: 'Revenue per employee = Service revenue ÷ Billable consultants',
      result: { kind: 'metric', key: 'revPerConsultant' },
      terms: [{ kind: 'revenue', key: 'services' }, { kind: 'metric', key: 'consultants' }],
    },
  ],

  compute(inputs, options, ctx) {
    const n = ctx.months;
    const g = pct(inputs, 'clientGrowthPct');
    const starts = wholeEvents(Array.from({ length: n }, (_, i) => Math.max(0, val(inputs, 'newClientsPerMonth') * Math.pow(1 + g, i))));
    const dur = Math.max(1, Math.round(val(inputs, 'projectDurationMonths')));
    const active = zeros(n);
    for (let s = 0; s < n; s++) for (let k = 0; k < dur && s + k < n; k++) active[s + k] += starts[s];

    const addMonth = Math.max(1, Math.round(val(inputs, 'consultantsAddedMonth')));
    const consultants = active.map((_, i) => Math.max(0, val(inputs, 'consultantsStart')) + (i + 1 >= addMonth ? Math.max(0, val(inputs, 'consultantsAdded')) : 0));
    const hpp = Math.max(0, val(inputs, 'hoursPerPerson'));
    const util = Math.min(1, Math.max(0, pct(inputs, 'utilizationPct')));
    const contractorMax = Math.max(0, val(inputs, 'contractorHoursMax'));

    const available = consultants.map((c) => c * hpp);
    const staffCap = available.map((a) => a * util);
    const capacityHours = staffCap.map((s) => s + contractorMax);
    const demand = active.map((a) => a * Math.max(0, val(inputs, 'hoursPerClientMonth')));
    const staffBillable = demand.map((d, i) => Math.min(d, staffCap[i]));
    const contractorHours = demand.map((d, i) => Math.min(Math.max(0, d - staffBillable[i]), contractorMax));
    const billable = staffBillable.map((s, i) => s + contractorHours[i]);
    const unserved = demand.map((d, i) => Math.max(0, d - billable[i]));

    const rev = fixedFee(options)
      ? active.map((a, i) => (demand[i] > 0 ? a * val(inputs, 'projectFee') / dur * (billable[i] / demand[i]) : 0))
      : billable.map((h) => h * val(inputs, 'billingRate'));

    const burden = 1 + pct(inputs, 'burdenPct');
    const consultantCost = consultants.map((c) => c * val(inputs, 'consultantSalary') * burden);
    const contractorCost = contractorHours.map((h) => h * val(inputs, 'contractorCostPerHour'));
    const admin = active.map(() => Math.max(0, val(inputs, 'adminStaff')) * val(inputs, 'adminSalary') * burden);
    const marketing = active.map(() => Math.max(0, val(inputs, 'marketingFixed')));

    const issues: StreamResult['issues'] = [];
    const short = unserved.map((u, i) => (u > 1e-6 ? i + 1 : 0)).filter(Boolean);
    if (short.length) {
      issues.push({ id: 'ps.capacity', level: 'warn', months: short, message: `Client work exceeds your delivery capacity in ${short.length} month(s), starting month ${short[0]}. Revenue is limited to the hours you can deliver.` });
    }

    return {
      revenue: [{ key: 'services', label: 'Service fees', values: rev }],
      direct: [
        { key: 'consultants', label: 'Billable consultants (salary and benefits)', values: consultantCost },
        ...(sum(contractorCost) > 0 ? [{ key: 'contractors', label: 'Contractors', values: contractorCost }] : []),
      ],
      opex: [
        ...(sum(admin) > 0 ? [{ key: 'admin', label: 'Non-billable admin staff', category: 'ga' as const, values: admin }] : []),
        ...(sum(marketing) > 0 ? [{ key: 'bizdev', label: 'Business development', category: 'sm' as const, values: marketing }] : []),
      ],
      billings: [{ label: 'Client invoices', values: rev, days: val(inputs, 'collectionDays') + ctx.extraCollectionDays }],
      payables: [
        { label: 'Consultant salaries (paid when earned)', values: consultantCost, days: 0, kind: 'direct' },
        { label: 'Contractors', values: contractorCost, days: val(inputs, 'supplierDays'), kind: 'direct' },
        { label: 'Admin salaries (paid when earned)', values: admin, days: 0, kind: 'opex' },
        { label: 'Business development vendors', values: marketing, days: val(inputs, 'supplierDays'), kind: 'opex' },
      ],
      capex: [],
      issues,
      metrics: [
        { key: 'newClients', label: 'New engagements', unit: 'count', values: starts, total: 'sum' },
        { key: 'activeClients', label: 'Active engagements', unit: 'count', values: active, total: 'last' },
        { key: 'consultants', label: 'Billable consultants', unit: 'count', values: consultants, total: 'last' },
        { key: 'availableHours', label: 'Available working hours', unit: 'hours', values: available, total: 'sum' },
        { key: 'capacityHours', label: 'Delivery capacity (hours)', unit: 'hours', values: capacityHours, total: 'sum' },
        { key: 'demandHours', label: 'Hours clients need', unit: 'hours', values: demand, total: 'sum' },
        { key: 'staffBillableHours', label: 'Hours billed by staff', unit: 'hours', values: staffBillable, total: 'sum' },
        { key: 'contractorHours', label: 'Hours billed by contractors', unit: 'hours', values: contractorHours, total: 'sum' },
        { key: 'billableHours', label: 'Billable hours', unit: 'hours', values: billable, total: 'sum' },
        { key: 'unservedHours', label: 'Work you could not deliver (hours)', unit: 'hours', values: unserved, total: 'sum' },
        { key: 'utilization', label: 'Actual utilization', unit: 'ratio', values: staffBillable.map((s, i) => (available[i] > 0 ? s / available[i] : 0)), total: 'avg' },
        { key: 'revPerConsultant', label: 'Revenue per billable employee', unit: 'usd', values: rev.map((r, i) => (consultants[i] > 0 ? r / consultants[i] : 0)), total: 'avg' },
      ],
    };
  },
};
