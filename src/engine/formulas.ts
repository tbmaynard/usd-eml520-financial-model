// Formula documentation for the shared engine. Business-model formulas live
// with each module; these cover the income statement, cash flow and metrics
// that every model shares.

import type { FormulaDoc } from './models/moduleTypes';

export const COMMON_FORMULAS: FormulaDoc[] = [
  {
    id: 'c.revenue', title: 'Total revenue',
    definition: 'Revenue earned in the month from every business line. Earned means the product or service was delivered, whether or not the customer has paid.',
    expression: 'Total revenue = Σ revenue from each source',
    result: { kind: 'row', key: 'revenue' }, terms: [],
    reference: 'Accrual basis: revenue is recognized when earned (ASC 606 / IFRS 15, simplified).',
  },
  {
    id: 'c.gross', title: 'Gross profit and gross margin',
    definition: 'What is left of revenue after the direct costs of delivering it. Gross margin is gross profit as a share of revenue.',
    expression: 'Gross profit = Revenue − Direct costs;  Gross margin = Gross profit ÷ Revenue',
    result: { kind: 'row', key: 'grossProfit' }, terms: [{ kind: 'row', key: 'revenue' }, { kind: 'row', key: 'direct' }],
    limitations: 'Delivery staff in the team plan count as direct costs; everyone else is an operating expense.',
  },
  {
    id: 'c.opex', title: 'Operating expenses',
    definition: 'Costs of running the business that are not direct costs of delivery.',
    expression: 'Operating expenses = Personnel + Sales and marketing + Research and development + General and administrative + Other',
    result: { kind: 'row', key: 'opex' }, terms: [{ kind: 'row', key: 'personnel' }, { kind: 'row', key: 'sm' }, { kind: 'row', key: 'rd' }, { kind: 'row', key: 'ga' }, { kind: 'row', key: 'other' }],
  },
  {
    id: 'c.personnel', title: 'Personnel cost',
    definition: 'Pay plus benefits and payroll taxes for each role, starting in its hiring month.',
    expression: 'Personnel (role, month) = Headcount × Monthly pay × (1 + Annual raise)^(years since hire) × (1 + Benefits and payroll taxes %), only from the start month',
    result: { kind: 'row', key: 'personnel' }, terms: [],
    limitations: 'Raises apply on each hiring anniversary. Salaries are paid in the month they are earned.',
  },
  {
    id: 'c.ebitda', title: 'EBITDA (simplified)',
    definition: 'Earnings before interest, taxes, depreciation and amortization: a simplified measure of operating performance before financing and equipment costs are spread over time.',
    expression: 'EBITDA = Gross profit − Operating expenses',
    result: { kind: 'row', key: 'ebitda' }, terms: [{ kind: 'row', key: 'grossProfit' }, { kind: 'row', key: 'opex' }],
    limitations: 'EBITDA is not cash flow and not profit. It ignores equipment purchases, debt payments, taxes and payment timing.',
  },
  {
    id: 'c.operating', title: 'Operating profit (loss)',
    definition: 'Profit from operations after spreading the cost of equipment over its useful life.',
    expression: 'Operating profit = EBITDA − Depreciation;  Depreciation = Equipment cost ÷ Useful life, each month',
    result: { kind: 'row', key: 'operatingProfit' }, terms: [{ kind: 'row', key: 'ebitda' }, { kind: 'row', key: 'depreciation' }],
    reference: 'Straight-line depreciation.',
  },
  {
    id: 'c.net', title: 'Net income',
    definition: 'Profit after interest and income tax.',
    expression: 'Net income = Operating profit − Interest − Income tax',
    result: { kind: 'row', key: 'netIncome' }, terms: [{ kind: 'row', key: 'operatingProfit' }, { kind: 'row', key: 'interest' }, { kind: 'row', key: 'tax' }],
  },
  {
    id: 'c.tax', title: 'Income tax (coarse estimate)',
    definition: 'A rough estimate of income tax on profit, after using up earlier losses.',
    expression: 'Tax (month) = max(0, Pretax profit − Losses carried forward) × Combined tax rate',
    result: { kind: 'row', key: 'tax' }, terms: [{ kind: 'row', key: 'pretax' }],
    limitations: 'Not tax advice. Uses one combined rate, applies losses in full with no annual limit, ignores credits, deductions and state differences. Pass-through entities owe no entity tax; owners pay instead, shown as an optional cash distribution.',
  },
  {
    id: 'c.collections', title: 'Cash collected from customers',
    definition: 'Cash received from customers. Invoices are collected after the payment delay, so cash usually trails revenue.',
    expression: 'Cash collected (month t) = Invoices due in month t after the delay;  a d-day delay lands (1 − f) of an invoice m months later and f of it m + 1 months later, where m = floor(d ÷ 30), f = (d mod 30) ÷ 30',
    result: { kind: 'row', key: 'collections' }, terms: [{ kind: 'row', key: 'billings' }, { kind: 'row', key: 'receivables' }],
    limitations: 'Assumes every customer pays eventually and on the average schedule. Uses 30-day months.',
  },
  {
    id: 'c.receivables', title: 'Money customers still owe (receivables)',
    definition: 'Invoices issued but not yet paid.',
    expression: 'Receivables = Total invoices to date − Total cash collected to date',
    result: { kind: 'row', key: 'receivables' }, terms: [{ kind: 'row', key: 'billings' }, { kind: 'row', key: 'collections' }],
  },
  {
    id: 'c.deferred', title: 'Deferred revenue',
    definition: 'Money customers have been invoiced for service you have not yet delivered, such as the rest of a prepaid annual contract.',
    expression: 'Deferred revenue = Total invoices to date − Total revenue earned to date',
    result: { kind: 'row', key: 'deferredRevenue' }, terms: [{ kind: 'row', key: 'billings' }, { kind: 'row', key: 'revenue' }],
  },
  {
    id: 'c.paid', title: 'Cash paid for costs',
    definition: 'Cash leaving the business for direct costs, operating expenses and salaries. Vendor bills are paid after your payment delay; salaries are paid immediately.',
    expression: 'Cash paid = Costs due in the month after each cost’s payment delay;  Payables = Costs incurred to date − Cash paid to date',
    result: { kind: 'row', key: 'paidDirect' }, terms: [{ kind: 'row', key: 'paidOpex' }, { kind: 'row', key: 'paidPersonnel' }, { kind: 'row', key: 'payables' }],
  },
  {
    id: 'c.cash', title: 'Ending cash balance',
    definition: 'Cash in the bank at the end of the month.',
    expression: 'Ending cash = Beginning cash + Cash collected + Founder and investor funding + Loans − Cash paid for costs − Equipment − Interest − Loan repayments − Taxes paid',
    result: { kind: 'row', key: 'endingCash' },
    terms: [{ kind: 'row', key: 'beginningCash' }, { kind: 'row', key: 'collections' }, { kind: 'row', key: 'founder' }, { kind: 'row', key: 'equity' }, { kind: 'row', key: 'loanProceeds' }, { kind: 'row', key: 'paidDirect' }, { kind: 'row', key: 'paidOpex' }, { kind: 'row', key: 'paidPersonnel' }, { kind: 'row', key: 'capexPaid' }, { kind: 'row', key: 'interestPaid' }, { kind: 'row', key: 'principalPaid' }, { kind: 'row', key: 'taxPaid' }],
  },
  {
    id: 'c.burn', title: 'Monthly burn rate',
    definition: 'Net cash the business uses each month from operations and equipment purchases, before any funding comes in.',
    expression: 'Burn = −(Operating cash flow − Equipment purchases);  positive means cash is being used',
    result: { kind: 'row', key: 'burn' }, terms: [{ kind: 'row', key: 'operatingCashFlow' }, { kind: 'row', key: 'capexPaid' }],
    limitations: 'The dashboard shows the average of the last three months.',
  },
  {
    id: 'c.runway', title: 'Runway',
    definition: 'How long the cash lasts. If cash goes below zero during the projection, runway is the month it runs out. Otherwise it is the ending cash divided by the current burn.',
    expression: 'Runway (months beyond the projection) = Ending cash ÷ Average burn of the last three months',
    terms: [{ kind: 'row', key: 'endingCash' }, { kind: 'row', key: 'burn' }],
    limitations: 'Assumes the current burn continues unchanged.',
  },
  {
    id: 'c.breakeven', title: 'Break-even month',
    definition: 'The first month after which operating profit stays at or above zero for the rest of the projection. A single good month followed by losses does not count.',
    expression: 'Break-even month = first month m where Operating profit ≥ 0 in every month from m to the end',
    terms: [{ kind: 'row', key: 'operatingProfit' }],
  },
  {
    id: 'c.funding', title: 'Additional funding required',
    definition: 'Extra cash needed so the balance never falls below the minimum cash you want to keep on hand.',
    expression: 'Funding required = max(0, Minimum cash cushion − Lowest projected cash balance)',
    terms: [{ kind: 'row', key: 'endingCash' }],
    limitations: 'Assumes the money arrives before the low point. Raising money takes months in practice.',
  },
];
