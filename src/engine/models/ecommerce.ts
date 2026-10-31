import { pct, sum, val } from '../timing';
import type { ModelModule } from './moduleTypes';

export const ecommerce: ModelModule = {
  kind: 'ecommerce',
  label: 'E-commerce / direct-to-consumer',
  short: 'E-commerce',
  description:
    'Sells products online directly to consumers. Every order carries product, fulfillment, shipping and payment-processing costs, and growth usually depends on paid customer acquisition.',
  examples: 'An online apparel brand, a subscription coffee box, a specialty outdoor gear shop.',
  defaultOptions: {},
  options: [],
  fields: [
    { key: 'aov', label: 'Average order value', unit: 'usd', help: 'Average amount a customer pays per order, before returns.', group: 'Orders', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'ordersStart', label: 'Orders in month 1', unit: 'count', help: 'Orders expected in the first month.', group: 'Orders', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'orderGrowthPct', label: 'Monthly order growth', unit: 'pct', help: 'Month-over-month growth in orders.', group: 'Orders', min: -50, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'returnsPct', label: 'Returns and refunds', unit: 'pct', help: 'Share of sales refunded. Apparel often runs 20% or more; consumables far less.', group: 'Orders', min: 0, max: 100, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'productCostPerOrder', label: 'Product cost per order', unit: 'usd', help: 'What the goods in an average order cost you.', group: 'Cost per order', min: 0, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'fulfillmentPerOrder', label: 'Packaging and fulfillment per order', unit: 'usd', help: 'Picking, packing and packaging for one order.', group: 'Cost per order', min: 0 },
    { key: 'shippingSubsidyPerOrder', label: 'Shipping you pay per order', unit: 'usd', help: 'Shipping cost you absorb (free or discounted shipping).', group: 'Cost per order', min: 0, sensitivity: true },
    { key: 'processingPct', label: 'Payment processing fee (% of order)', unit: 'pct', help: 'Card processing percentage, typically about 2.9%.', group: 'Cost per order', min: 0, max: 20 },
    { key: 'processingFixed', label: 'Payment processing fee per order', unit: 'usd', help: 'Fixed per-transaction fee, typically about $0.30.', group: 'Cost per order', min: 0 },
    { key: 'newCustomerSharePct', label: 'Orders from new customers', unit: 'pct', help: 'Share of orders placed by first-time customers. The rest are repeat customers you do not pay to acquire again.', group: 'Customer acquisition', min: 0, max: 100, sensitivity: true },
    { key: 'cac', label: 'Acquisition cost per new customer', unit: 'usd', help: 'Paid marketing needed to win one new customer.', group: 'Customer acquisition', min: 0, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'marketingFixed', label: 'Brand marketing per month', unit: 'usd', help: 'Marketing not tied to individual customers: content, photography, sponsorships.', group: 'Customer acquisition', min: 0 },
    { key: 'collectionDays', label: 'Days for payment processor to pay you', unit: 'days', help: 'Card payouts usually arrive in 2 to 7 days.', group: 'Payment timing', min: 0, max: 90 },
    { key: 'supplierDays', label: 'Days to pay product suppliers', unit: 'days', help: 'Average days you take to pay for products and fulfillment.', group: 'Payment timing', min: 0, max: 120, sensitivity: true, worseWhen: 'lower' },
  ],
  defaults: {
    aov: 72,
    ordersStart: 400,
    orderGrowthPct: 7,
    returnsPct: 8,
    productCostPerOrder: 24,
    fulfillmentPerOrder: 6,
    shippingSubsidyPerOrder: 5,
    processingPct: 2.9,
    processingFixed: 0.3,
    newCustomerSharePct: 60,
    cac: 35,
    marketingFixed: 2500,
    collectionDays: 3,
    supplierDays: 30,
  },
  formulas: [
    {
      id: 'ec.orders', title: 'Orders', definition: 'Orders placed in the month.',
      expression: 'Orders (month t) = Month-1 orders × (1 + monthly growth)^(t − 1)',
      result: { kind: 'metric', key: 'orders' }, terms: [{ kind: 'input', key: 'ordersStart' }, { kind: 'input', key: 'orderGrowthPct' }],
    },
    {
      id: 'ec.revenue', title: 'Net product revenue', definition: 'Sales after refunds.',
      expression: 'Net revenue = Orders × Average order value × (1 − Returns rate)',
      result: { kind: 'metric', key: 'netRevenue' }, terms: [{ kind: 'metric', key: 'orders' }, { kind: 'input', key: 'aov' }, { kind: 'input', key: 'returnsPct' }],
      limitations: 'Refunds are recorded in the month of sale. Returned products are assumed not resellable, so their product cost is still incurred.',
    },
    {
      id: 'ec.processing', title: 'Payment processing fees', definition: 'Fees charged by the card processor on every order.',
      expression: 'Processing fees = Orders × (Average order value × Processing % + Fee per order)',
      result: { kind: 'direct', key: 'processing' }, terms: [{ kind: 'metric', key: 'orders' }, { kind: 'input', key: 'aov' }, { kind: 'input', key: 'processingPct' }, { kind: 'input', key: 'processingFixed' }],
    },
    {
      id: 'ec.acq', title: 'Customer acquisition spending', definition: 'Paid marketing to win new customers.',
      expression: 'Acquisition spending = Orders × New-customer share × Acquisition cost per new customer',
      result: { kind: 'opex', key: 'acquisition' }, terms: [{ kind: 'metric', key: 'orders' }, { kind: 'input', key: 'newCustomerSharePct' }, { kind: 'input', key: 'cac' }],
      limitations: 'Assumes each new customer places one order in the month acquired; repeat orders cost nothing to acquire.',
    },
    {
      id: 'ec.contribution', title: 'Contribution margin per order', definition: 'What one order leaves to cover fixed costs after its direct costs and acquisition spending.',
      expression: 'Contribution per order = (Net revenue − Direct costs − Acquisition spending) ÷ Orders',
      result: { kind: 'metric', key: 'contributionPerOrder' }, terms: [{ kind: 'metric', key: 'netRevenue' }, { kind: 'metric', key: 'directCosts' }, { kind: 'opex', key: 'acquisition' }, { kind: 'metric', key: 'orders' }],
    },
  ],

  compute(inputs, _options, ctx) {
    const n = ctx.months;
    const g = pct(inputs, 'orderGrowthPct');
    const orders = Array.from({ length: n }, (_, i) => Math.max(0, val(inputs, 'ordersStart') * Math.pow(1 + g, i)));
    const aov = val(inputs, 'aov');
    const gross = orders.map((o) => o * aov);
    const refunds = gross.map((s) => -s * Math.min(1, Math.max(0, pct(inputs, 'returnsPct'))));
    const net = gross.map((s, i) => s + refunds[i]);
    const product = orders.map((o) => o * val(inputs, 'productCostPerOrder'));
    const fulfil = orders.map((o) => o * val(inputs, 'fulfillmentPerOrder'));
    const ship = orders.map((o) => o * val(inputs, 'shippingSubsidyPerOrder'));
    const proc = orders.map((o) => o * (aov * pct(inputs, 'processingPct') + val(inputs, 'processingFixed')));
    const acq = orders.map((o) => o * Math.min(1, Math.max(0, pct(inputs, 'newCustomerSharePct'))) * val(inputs, 'cac'));
    const brand = orders.map(() => Math.max(0, val(inputs, 'marketingFixed')));
    const directTotal = orders.map((_, i) => product[i] + fulfil[i] + ship[i] + proc[i]);
    const contribution = orders.map((o, i) => (o > 0 ? (net[i] - directTotal[i] - acq[i]) / o : 0));

    const issues = [];
    if (contribution.some((c) => c < 0)) {
      issues.push({ id: 'ec.negContribution', level: 'warn' as const, message: 'Contribution per order is negative in some months: each order loses money after its own costs and acquisition spending, so more orders make losses larger.' });
    }

    return {
      revenue: [
        { key: 'sales', label: 'Product sales', values: gross },
        { key: 'refunds', label: 'Returns and refunds', values: refunds },
      ],
      direct: [
        { key: 'product', label: 'Product cost', values: product },
        { key: 'fulfillment', label: 'Packaging and fulfillment', values: fulfil },
        { key: 'shipping', label: 'Shipping subsidy', values: ship },
        { key: 'processing', label: 'Payment processing', values: proc },
      ],
      opex: [
        { key: 'acquisition', label: 'Customer acquisition', category: 'sm', values: acq },
        ...(sum(brand) > 0 ? [{ key: 'brand', label: 'Brand marketing', category: 'sm' as const, values: brand }] : []),
      ],
      // Processing fees are deducted from payouts, so they leave with the collection.
      billings: [{ label: 'Card payouts (net of refunds)', values: net, days: val(inputs, 'collectionDays') + ctx.extraCollectionDays }],
      payables: [
        { label: 'Product suppliers and fulfillment', values: orders.map((_, i) => product[i] + fulfil[i] + ship[i]), days: val(inputs, 'supplierDays'), kind: 'direct' },
        { label: 'Processing fees (deducted from payouts)', values: proc, days: val(inputs, 'collectionDays') + ctx.extraCollectionDays, kind: 'direct' },
        { label: 'Marketing', values: acq.map((a, i) => a + brand[i]), days: 0, kind: 'opex' },
      ],
      capex: [],
      issues,
      metrics: [
        { key: 'orders', label: 'Orders', unit: 'count', values: orders, total: 'sum' },
        { key: 'newCustomers', label: 'New customers', unit: 'count', values: orders.map((o) => o * pct(inputs, 'newCustomerSharePct')), total: 'sum' },
        { key: 'grossSales', label: 'Gross sales', unit: 'usd', values: gross, total: 'sum' },
        { key: 'netRevenue', label: 'Net revenue', unit: 'usd', values: net, total: 'sum' },
        { key: 'directCosts', label: 'Direct costs', unit: 'usd', values: directTotal, total: 'sum' },
        { key: 'contributionPerOrder', label: 'Contribution margin per order', unit: 'usd', values: contribution, total: 'avg' },
      ],
    };
  },
};
