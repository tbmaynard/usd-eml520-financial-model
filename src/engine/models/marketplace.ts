import { pct, sum, val } from '../timing';
import type { ModelModule } from './moduleTypes';

export const marketplace: ModelModule = {
  kind: 'marketplace',
  label: 'Marketplace / transaction platform',
  short: 'Marketplace',
  description:
    'Connects buyers and sellers and keeps a fee on each transaction. The platform does not own what is sold, so its revenue is only its cut of the transaction value, while some costs (like payment processing) scale with the full value.',
  examples: 'A platform matching homeowners with contractors, an online equipment-rental exchange, a freelance marketplace.',
  defaultOptions: {},
  options: [],
  fields: [
    { key: 'buyersStart', label: 'Active buyers at start', unit: 'count', help: 'Buyers using the platform at the start of the projection.', group: 'Buyers and sellers', min: 0, sensitivity: true },
    { key: 'buyerGrowthPct', label: 'Monthly buyer growth', unit: 'pct', help: 'Month-over-month growth in active buyers.', group: 'Buyers and sellers', min: -50, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'sellersStart', label: 'Active sellers or providers at start', unit: 'count', help: 'Sellers or service providers on the platform at the start.', group: 'Buyers and sellers', min: 0 },
    { key: 'sellerGrowthPct', label: 'Monthly seller growth', unit: 'pct', help: 'Month-over-month growth in active sellers.', group: 'Buyers and sellers', min: -50, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'maxTxPerSeller', label: 'Most transactions one seller can handle per month', unit: 'count', help: 'Limits transactions when there are too few sellers. Enter 0 for no limit.', group: 'Buyers and sellers', min: 0 },
    { key: 'txPerBuyer', label: 'Transactions per buyer per month', unit: 'count', help: 'Average purchases one active buyer makes each month.', group: 'Transactions', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'avgTxValue', label: 'Average transaction value', unit: 'usd', help: 'Average amount the buyer pays per transaction (the full price, not your fee).', group: 'Transactions', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'takeRatePct', label: 'Platform take rate', unit: 'pct', help: 'Your fee as a percent of each transaction. This is your revenue.', group: 'Transactions', min: 0, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'processingPctOfGmv', label: 'Payment processing (% of transaction value)', unit: 'pct', help: 'Processor fees charged on the full transaction value, which you pay out of your fee.', group: 'Transaction costs', min: 0, max: 20 },
    { key: 'supportPerTx', label: 'Support cost per transaction', unit: 'usd', help: 'Customer support, trust and safety per transaction.', group: 'Transaction costs', min: 0 },
    { key: 'disputeRatePct', label: 'Transactions that end in a dispute', unit: 'pct', help: 'Share of transactions needing dispute resolution.', group: 'Transaction costs', min: 0, max: 100 },
    { key: 'disputeCost', label: 'Cost to resolve one dispute', unit: 'usd', help: 'Staff time and refunds you absorb per dispute.', group: 'Transaction costs', min: 0 },
    { key: 'buyerCac', label: 'Acquisition cost per new buyer', unit: 'usd', help: 'Marketing spend to win one new buyer.', group: 'Customer acquisition', min: 0, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'sellerCac', label: 'Acquisition cost per new seller', unit: 'usd', help: 'Cost to recruit and onboard one new seller.', group: 'Customer acquisition', min: 0, sensitivity: true },
    { key: 'marketingFixed', label: 'Brand marketing per month', unit: 'usd', help: 'Marketing not tied to individual sign-ups.', group: 'Customer acquisition', min: 0 },
    { key: 'collectionDays', label: 'Days to receive your fees', unit: 'days', help: 'Days between a transaction and your fee reaching your bank.', group: 'Payment timing', min: 0, max: 90 },
    { key: 'supplierDays', label: 'Days to pay vendors', unit: 'days', help: 'Average days you take to pay support vendors and marketing.', group: 'Payment timing', min: 0, max: 120 },
  ],
  defaults: {
    buyersStart: 300,
    buyerGrowthPct: 10,
    sellersStart: 40,
    sellerGrowthPct: 8,
    maxTxPerSeller: 25,
    txPerBuyer: 1.2,
    avgTxValue: 140,
    takeRatePct: 12,
    processingPctOfGmv: 2.9,
    supportPerTx: 1.5,
    disputeRatePct: 2,
    disputeCost: 40,
    buyerCac: 30,
    sellerCac: 120,
    marketingFixed: 3000,
    collectionDays: 3,
    supplierDays: 15,
  },
  formulas: [
    {
      id: 'mp.tx', title: 'Transactions', definition: 'Completed purchases on the platform, limited by how many sellers can serve them.',
      expression: 'Transactions = min(Buyers × Transactions per buyer, Sellers × Most transactions per seller)',
      result: { kind: 'metric', key: 'transactions' }, terms: [{ kind: 'metric', key: 'buyers' }, { kind: 'input', key: 'txPerBuyer' }, { kind: 'metric', key: 'sellers' }, { kind: 'input', key: 'maxTxPerSeller' }],
    },
    {
      id: 'mp.gmv', title: 'Gross merchandise value (GMV)', definition: 'The total value of everything bought on the platform. GMV is not your revenue: most of it belongs to the sellers.',
      expression: 'GMV = Transactions × Average transaction value',
      result: { kind: 'metric', key: 'gmv' }, terms: [{ kind: 'metric', key: 'transactions' }, { kind: 'input', key: 'avgTxValue' }],
    },
    {
      id: 'mp.revenue', title: 'Platform revenue', definition: 'The fees the platform keeps.',
      expression: 'Platform revenue = GMV × Take rate',
      result: { kind: 'revenue', key: 'fees' }, terms: [{ kind: 'metric', key: 'gmv' }, { kind: 'input', key: 'takeRatePct' }],
      reference: 'Net (agent) revenue presentation: a platform that does not control the goods reports only its fee.',
    },
    {
      id: 'mp.revPerTx', title: 'Revenue per transaction', definition: 'Average fee the platform keeps per transaction.',
      expression: 'Revenue per transaction = Average transaction value × Take rate',
      result: { kind: 'metric', key: 'revPerTx' }, terms: [{ kind: 'input', key: 'avgTxValue' }, { kind: 'input', key: 'takeRatePct' }],
    },
    {
      id: 'mp.txCost', title: 'Transaction costs', definition: 'Costs that scale with transactions. Processing is charged on the full GMV, not just your fee.',
      expression: 'Transaction costs = GMV × Processing % + Transactions × (Support per transaction + Dispute rate × Dispute cost)',
      result: { kind: 'metric', key: 'txCosts' }, terms: [{ kind: 'metric', key: 'gmv' }, { kind: 'input', key: 'processingPctOfGmv' }, { kind: 'metric', key: 'transactions' }, { kind: 'input', key: 'supportPerTx' }, { kind: 'input', key: 'disputeRatePct' }, { kind: 'input', key: 'disputeCost' }],
    },
    {
      id: 'mp.contribution', title: 'Contribution margin', definition: 'Platform revenue left after transaction costs and acquisition spending.',
      expression: 'Contribution margin = Platform revenue − Transaction costs − Buyer and seller acquisition',
      result: { kind: 'metric', key: 'contribution' }, terms: [{ kind: 'revenue', key: 'fees' }, { kind: 'metric', key: 'txCosts' }, { kind: 'opex', key: 'buyerAcq' }, { kind: 'opex', key: 'sellerAcq' }],
    },
  ],

  compute(inputs, _options, ctx) {
    const n = ctx.months;
    const bg = pct(inputs, 'buyerGrowthPct');
    const sg = pct(inputs, 'sellerGrowthPct');
    const buyers = Array.from({ length: n }, (_, i) => Math.max(0, val(inputs, 'buyersStart') * Math.pow(1 + bg, i)));
    const sellers = Array.from({ length: n }, (_, i) => Math.max(0, val(inputs, 'sellersStart') * Math.pow(1 + sg, i)));
    const newBuyers = buyers.map((b, i) => (i === 0 ? 0 : Math.max(0, b - buyers[i - 1])));
    const newSellers = sellers.map((s, i) => (i === 0 ? 0 : Math.max(0, s - sellers[i - 1])));
    const cap = val(inputs, 'maxTxPerSeller');
    const wanted = buyers.map((b) => b * Math.max(0, val(inputs, 'txPerBuyer')));
    const supply = sellers.map((s) => (cap > 0 ? s * cap : Infinity));
    const tx = wanted.map((w, i) => Math.min(w, supply[i]));
    const value = val(inputs, 'avgTxValue');
    const take = Math.min(1, Math.max(0, pct(inputs, 'takeRatePct')));
    const gmv = tx.map((t) => t * value);
    const rev = gmv.map((g) => g * take);
    const proc = gmv.map((g) => g * pct(inputs, 'processingPctOfGmv'));
    const support = tx.map((t) => t * (val(inputs, 'supportPerTx') + pct(inputs, 'disputeRatePct') * val(inputs, 'disputeCost')));
    const buyerAcq = newBuyers.map((b) => b * val(inputs, 'buyerCac'));
    const sellerAcq = newSellers.map((s) => s * val(inputs, 'sellerCac'));
    const brand = tx.map(() => Math.max(0, val(inputs, 'marketingFixed')));
    const txCosts = proc.map((p, i) => p + support[i]);
    const contribution = rev.map((r, i) => r - txCosts[i] - buyerAcq[i] - sellerAcq[i]);

    const issues = [];
    const limited = wanted.map((w, i) => (w > supply[i] + 1e-9 ? i + 1 : 0)).filter(Boolean);
    if (limited.length) {
      issues.push({ id: 'mp.supply', level: 'warn' as const, months: limited, message: `Buyers want more transactions than sellers can handle in ${limited.length} month(s), starting month ${limited[0]}. Seller supply is limiting growth.` });
    }
    if (take > 0 && pct(inputs, 'processingPctOfGmv') >= take) {
      issues.push({ id: 'mp.takeVsProcessing', level: 'warn' as const, message: 'Payment processing (charged on the full transaction value) is at or above your take rate, so every transaction loses money.' });
    }

    return {
      revenue: [{ key: 'fees', label: 'Platform fees', values: rev }],
      direct: [
        { key: 'processing', label: 'Payment processing', values: proc },
        { key: 'support', label: 'Support and disputes', values: support },
      ],
      opex: [
        { key: 'buyerAcq', label: 'Buyer acquisition', category: 'sm', values: buyerAcq },
        { key: 'sellerAcq', label: 'Seller acquisition', category: 'sm', values: sellerAcq },
        ...(sum(brand) > 0 ? [{ key: 'brand', label: 'Brand marketing', category: 'sm' as const, values: brand }] : []),
      ],
      billings: [{ label: 'Platform fees received', values: rev, days: val(inputs, 'collectionDays') + ctx.extraCollectionDays }],
      payables: [
        { label: 'Processing fees', values: proc, days: val(inputs, 'collectionDays') + ctx.extraCollectionDays, kind: 'direct' },
        { label: 'Support and disputes', values: support, days: val(inputs, 'supplierDays'), kind: 'direct' },
        { label: 'Acquisition and marketing', values: support.map((_, i) => buyerAcq[i] + sellerAcq[i] + brand[i]), days: val(inputs, 'supplierDays'), kind: 'opex' },
      ],
      capex: [],
      issues,
      metrics: [
        { key: 'buyers', label: 'Active buyers', unit: 'count', values: buyers, total: 'last' },
        { key: 'newBuyers', label: 'New buyers', unit: 'count', values: newBuyers, total: 'sum' },
        { key: 'sellers', label: 'Active sellers', unit: 'count', values: sellers, total: 'last' },
        { key: 'newSellers', label: 'New sellers', unit: 'count', values: newSellers, total: 'sum' },
        { key: 'transactions', label: 'Transactions', unit: 'count', values: tx, total: 'sum' },
        { key: 'gmv', label: 'Gross merchandise value (not revenue)', unit: 'usd', values: gmv, total: 'sum' },
        { key: 'revPerTx', label: 'Revenue per transaction', unit: 'usd', values: tx.map(() => value * take), total: 'last' },
        { key: 'txCosts', label: 'Transaction costs', unit: 'usd', values: txCosts, total: 'sum' },
        { key: 'contribution', label: 'Contribution margin', unit: 'usd', values: contribution, total: 'sum' },
      ],
    };
  },
};
