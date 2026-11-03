import type { CapexItem, StreamResult } from '../types';
import { cumulative, pct, sum, val, zeros } from '../timing';
import type { ModelModule } from './moduleTypes';

export const manufacturing: ModelModule = {
  kind: 'manufacturing',
  label: 'Manufacturing / physical products',
  short: 'Manufacturing',
  description:
    'Makes and sells physical products. Each unit carries material, labor and shipping cost; production needs equipment and is limited by capacity; materials must be bought before products can be sold.',
  examples: 'A hardware device maker, a specialty food producer, a company making sensors for industrial customers.',
  defaultOptions: { capSales: true },
  options: [
    { key: 'capSales', label: 'Limit sales to production capacity', help: 'When on, you cannot sell more units than you can make. Turn off to see unconstrained demand (the model will still warn you).', group: 'Production', type: 'boolean' },
  ],
  fields: [
    { key: 'price', label: 'Selling price per unit', unit: 'usd', help: 'Average price customers pay per unit, after discounts.', group: 'Sales', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'unitsStart', label: 'Units demanded in the first month of sales', unit: 'count', help: 'How many units customers will order in the first month you sell.', group: 'Sales', min: 0, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'unitGrowthPct', label: 'Monthly growth in unit demand', unit: 'pct', help: 'Month-over-month growth in units demanded.', group: 'Sales', min: -50, max: 100, sensitivity: true, scenario: true, worseWhen: 'lower' },
    { key: 'marketingFixed', label: 'Marketing and sales spend per month', unit: 'usd', help: 'Advertising, trade shows, distributor support.', group: 'Sales', min: 0, sensitivity: true },
    { key: 'materialCost', label: 'Material cost per unit', unit: 'usd', help: 'Raw materials and components for one unit.', group: 'Unit costs', min: 0, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'laborCost', label: 'Direct labor cost per unit', unit: 'usd', help: 'Assembly and production labor for one unit. Paid when the unit is made.', group: 'Unit costs', min: 0, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'packShipCost', label: 'Packaging and shipping per unit', unit: 'usd', help: 'Packaging and outbound freight for one unit.', group: 'Unit costs', min: 0, sensitivity: true },
    { key: 'overheadMonthly', label: 'Manufacturing overhead per month', unit: 'usd', help: 'Fixed production costs: factory utilities, maintenance, quality control.', group: 'Production', min: 0, sensitivity: true },
    { key: 'capacity', label: 'Production capacity (units per month)', unit: 'count', help: 'Most units you can make in a month with your starting equipment.', group: 'Production', min: 0, sensitivity: true },
    { key: 'equipmentCost', label: 'Initial equipment and tooling', unit: 'usd', help: 'One-time investment in machines, molds and tooling.', group: 'Production', min: 0 },
    { key: 'equipmentMonth', label: 'Month equipment is purchased', unit: 'month', help: 'Projection month of the equipment purchase.', group: 'Production', min: 1 },
    { key: 'equipmentLife', label: 'Equipment useful life', unit: 'months', help: 'Months over which the equipment is depreciated.', group: 'Production', min: 1, max: 360 },
    { key: 'expansionMonth', label: 'Capacity expansion month', unit: 'month', help: 'Month added capacity comes online. Set extra capacity to 0 if you do not plan to expand.', group: 'Production', min: 1 },
    { key: 'expansionCapacity', label: 'Extra capacity from expansion', unit: 'count', help: 'Additional units per month after the expansion.', group: 'Production', min: 0 },
    { key: 'expansionCost', label: 'Expansion equipment cost', unit: 'usd', help: 'Capital cost of the expansion.', group: 'Production', min: 0 },
    { key: 'rndMonthly', label: 'Product research and development per month', unit: 'usd', help: 'Design, prototyping and testing that is not tied to individual units.', group: 'Production', min: 0 },
    { key: 'inventoryLeadMonths', label: 'Months materials are bought ahead of sale', unit: 'months', help: 'How far ahead you must buy materials. 2 means materials for a March sale are bought in January.', group: 'Payment timing', min: 0, max: 6, sensitivity: true, worseWhen: 'higher' },
    { key: 'collectionDays', label: 'Days for customers to pay', unit: 'days', help: 'Average days between shipping and getting paid. Retailers and distributors often take 30 to 60 days.', group: 'Payment timing', min: 0, max: 365, sensitivity: true, scenario: true, worseWhen: 'higher' },
    { key: 'supplierDays', label: 'Days to pay suppliers', unit: 'days', help: 'Average days you take to pay for materials, overhead and shipping. Labor is paid immediately.', group: 'Payment timing', min: 0, max: 120, sensitivity: true, worseWhen: 'lower' },
  ],
  defaults: {
    price: 180,
    unitsStart: 150,
    unitGrowthPct: 8,
    marketingFixed: 4000,
    materialCost: 48,
    laborCost: 22,
    packShipCost: 12,
    overheadMonthly: 6000,
    capacity: 600,
    equipmentCost: 85000,
    equipmentMonth: 1,
    equipmentLife: 60,
    expansionMonth: 13,
    expansionCapacity: 0,
    expansionCost: 0,
    rndMonthly: 2500,
    inventoryLeadMonths: 1,
    collectionDays: 30,
    supplierDays: 30,
  },
  formulas: [
    {
      id: 'mf.units', title: 'Units sold', definition: 'Units shipped to customers in the month.',
      expression: 'Units sold = min(Units demanded, Production capacity)  (when sales are limited to capacity)',
      result: { kind: 'metric', key: 'unitsSold' },
      terms: [{ kind: 'metric', key: 'demand' }, { kind: 'metric', key: 'capacity' }],
      limitations: 'Assumes you make what you sell in the same month and keep no finished-goods stock.',
    },
    {
      id: 'mf.demand', title: 'Units demanded', definition: 'Units customers want to buy.',
      expression: 'Units demanded (month t) = Month-1 demand × (1 + monthly growth)^(t − 1)',
      result: { kind: 'metric', key: 'demand' },
      terms: [{ kind: 'input', key: 'unitsStart' }, { kind: 'input', key: 'unitGrowthPct' }],
    },
    {
      id: 'mf.revenue', title: 'Product revenue', definition: 'Sales value of units shipped.',
      expression: 'Revenue = Units sold × Selling price',
      result: { kind: 'revenue', key: 'product' },
      terms: [{ kind: 'metric', key: 'unitsSold' }, { kind: 'input', key: 'price' }],
    },
    {
      id: 'mf.varcost', title: 'Variable cost per unit', definition: 'Costs that are incurred for every unit made and shipped.',
      expression: 'Variable cost per unit = Material + Direct labor + Packaging and shipping',
      result: { kind: 'metric', key: 'varCostPerUnit' },
      terms: [{ kind: 'input', key: 'materialCost' }, { kind: 'input', key: 'laborCost' }, { kind: 'input', key: 'packShipCost' }],
    },
    {
      id: 'mf.cogs', title: 'Cost of goods sold', definition: 'Variable costs of the units sold plus fixed manufacturing overhead.',
      expression: 'COGS = Units sold × Variable cost per unit + Manufacturing overhead',
      result: { kind: 'metric', key: 'cogs' },
      terms: [{ kind: 'metric', key: 'unitsSold' }, { kind: 'metric', key: 'varCostPerUnit' }, { kind: 'input', key: 'overheadMonthly' }],
    },
    {
      id: 'mf.gp', title: 'Product gross profit', definition: 'Revenue left after the cost of making and shipping the products.',
      expression: 'Gross profit = Units sold × (Selling price − Variable cost per unit) − Manufacturing overhead',
      result: { kind: 'metric', key: 'grossProfit' },
      terms: [{ kind: 'metric', key: 'unitsSold' }, { kind: 'input', key: 'price' }, { kind: 'metric', key: 'varCostPerUnit' }, { kind: 'input', key: 'overheadMonthly' }],
    },
    {
      id: 'mf.util', title: 'Capacity utilization', definition: 'How much of your production capacity is used.',
      expression: 'Utilization = Units sold ÷ Production capacity',
      result: { kind: 'metric', key: 'utilization' },
      terms: [{ kind: 'metric', key: 'unitsSold' }, { kind: 'metric', key: 'capacity' }],
    },
    {
      id: 'mf.inventory', title: 'Cash tied up in inventory', definition: 'Materials bought but not yet sold. This is cash that has left the business but has not yet become revenue.',
      expression: 'Inventory = Total materials purchased − Total material cost of units sold.  Purchases (month t) = Units sold in month (t + lead) × Material cost',
      result: { kind: 'metric', key: 'inventory' },
      terms: [{ kind: 'metric', key: 'purchases' }, { kind: 'input', key: 'inventoryLeadMonths' }, { kind: 'input', key: 'materialCost' }],
      limitations: 'Only materials are held as inventory. Month 1 purchases cover month 1 sales plus the lead period, as startup stock.',
    },
  ],

  compute(inputs, options, ctx) {
    const n = ctx.months;
    const lead = Math.max(0, Math.round(val(inputs, 'inventoryLeadMonths')));
    const horizon = n + lead;
    const g = pct(inputs, 'unitGrowthPct');
    const baseCap = Math.max(0, val(inputs, 'capacity'));
    const expMonth = Math.max(1, Math.round(val(inputs, 'expansionMonth')));
    const expCap = Math.max(0, val(inputs, 'expansionCapacity'));
    const cap = (i: number) => baseCap + (expCap > 0 && i + 1 >= expMonth ? expCap : 0);
    const capSales = options.capSales !== false;

    const demandAll: number[] = [];
    const soldAll: number[] = [];
    for (let i = 0; i < horizon; i++) {
      const d = Math.max(0, val(inputs, 'unitsStart') * Math.pow(1 + g, i));
      demandAll.push(d);
      soldAll.push(capSales ? Math.min(d, cap(i)) : d);
    }
    const demand = demandAll.slice(0, n);
    const sold = soldAll.slice(0, n);
    const capacity = demand.map((_, i) => cap(i));

    const price = val(inputs, 'price');
    const mat = val(inputs, 'materialCost');
    const lab = val(inputs, 'laborCost');
    const ship = val(inputs, 'packShipCost');
    const overhead = Math.max(0, val(inputs, 'overheadMonthly'));

    const revenue = sold.map((u) => u * price);
    const material = sold.map((u) => u * mat);
    const labor = sold.map((u) => u * lab);
    const shipping = sold.map((u) => u * ship);
    const overheadLine = sold.map(() => overhead);

    const purchases = zeros(n);
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        for (let k = 0; k <= lead; k++) purchases[0] += soldAll[k] * mat;
      } else if (i + lead < horizon) {
        purchases[i] += soldAll[i + lead] * mat;
      }
    }
    const cumMaterial = cumulative(material);
    const inventory = cumulative(purchases).map((p, i) => p - cumMaterial[i]);

    const issues: StreamResult['issues'] = [];
    const over = demand.map((d, i) => (d > capacity[i] + 1e-9 ? i + 1 : 0)).filter(Boolean);
    if (over.length) {
      issues.push({
        id: 'mf.capacity', level: 'warn', months: over,
        message: capSales
          ? `Demand exceeds production capacity in ${over.length} month(s), starting month ${over[0]}. Sales are limited to capacity, so some demand goes unserved.`
          : `Demand exceeds production capacity in ${over.length} month(s), starting month ${over[0]}. Sales are not limited, so the model is selling units you cannot make.`,
      });
    }
    if (price > 0 && mat + lab + ship >= price) {
      issues.push({ id: 'mf.negUnit', level: 'warn', message: 'Variable cost per unit is at or above the selling price, so each unit sold loses money before overhead.' });
    }

    const capex: CapexItem[] = [];
    const eqCost = Math.max(0, val(inputs, 'equipmentCost'));
    if (eqCost > 0) capex.push({ id: 'mf.eq', name: 'Initial equipment and tooling', amount: eqCost, month: Math.max(1, Math.round(val(inputs, 'equipmentMonth'))), usefulLifeMonths: val(inputs, 'equipmentLife') || 60, basis: '', conf: 'unset', example: false });
    const expCost = Math.max(0, val(inputs, 'expansionCost'));
    if (expCost > 0 && expCap > 0) capex.push({ id: 'mf.exp', name: 'Capacity expansion', amount: expCost, month: expMonth, usefulLifeMonths: val(inputs, 'equipmentLife') || 60, basis: '', conf: 'unset', example: false });

    const marketing = sold.map(() => Math.max(0, val(inputs, 'marketingFixed')));
    const rnd = sold.map(() => Math.max(0, val(inputs, 'rndMonthly')));
    const supplierDays = val(inputs, 'supplierDays');
    const cogs = sold.map((_, i) => material[i] + labor[i] + shipping[i] + overheadLine[i]);
    const varPerUnit = mat + lab + ship;

    return {
      revenue: [{ key: 'product', label: 'Product sales', values: revenue }],
      direct: [
        { key: 'material', label: 'Materials', values: material },
        { key: 'labor', label: 'Direct labor', values: labor },
        { key: 'shipping', label: 'Packaging and shipping', values: shipping },
        { key: 'overhead', label: 'Manufacturing overhead', values: overheadLine },
      ],
      opex: [
        ...(sum(marketing) > 0 ? [{ key: 'marketing', label: 'Marketing and sales', category: 'sm' as const, values: marketing }] : []),
        ...(sum(rnd) > 0 ? [{ key: 'rnd', label: 'Product R&D', category: 'rd' as const, values: rnd }] : []),
      ],
      billings: [{ label: 'Customer invoices', values: revenue, days: val(inputs, 'collectionDays') + ctx.extraCollectionDays }],
      payables: [
        { label: 'Material purchases', values: purchases, days: supplierDays, kind: 'direct' },
        { label: 'Direct labor (paid when worked)', values: labor, days: 0, kind: 'direct' },
        { label: 'Shipping and overhead', values: sold.map((_, i) => shipping[i] + overheadLine[i]), days: supplierDays, kind: 'direct' },
        { label: 'Marketing and R&D vendors', values: sold.map((_, i) => marketing[i] + rnd[i]), days: supplierDays, kind: 'opex' },
      ],
      capex,
      inventory,
      issues,
      metrics: [
        { key: 'demand', label: 'Units demanded', unit: 'count', values: demand, total: 'sum' },
        { key: 'unitsSold', label: 'Units sold', unit: 'count', values: sold, total: 'sum' },
        { key: 'unmet', label: 'Unserved demand (units)', unit: 'count', values: demand.map((d, i) => Math.max(0, d - sold[i])), total: 'sum' },
        { key: 'capacity', label: 'Production capacity', unit: 'count', values: capacity, total: 'last' },
        { key: 'utilization', label: 'Capacity utilization', unit: 'ratio', values: sold.map((s, i) => (capacity[i] > 0 ? s / capacity[i] : 0)), total: 'avg' },
        { key: 'varCostPerUnit', label: 'Variable cost per unit', unit: 'usd', values: sold.map(() => varPerUnit), total: 'last' },
        { key: 'cogs', label: 'Cost of goods sold', unit: 'usd', values: cogs, total: 'sum' },
        { key: 'grossProfit', label: 'Product gross profit', unit: 'usd', values: revenue.map((r, i) => r - cogs[i]), total: 'sum' },
        { key: 'purchases', label: 'Material purchases', unit: 'usd', values: purchases, total: 'sum' },
        { key: 'inventory', label: 'Inventory on hand (materials)', unit: 'usd', values: inventory, total: 'last' },
      ],
    };
  },
};
