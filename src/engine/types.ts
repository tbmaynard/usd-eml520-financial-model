import type { ExitSettings } from './exit';

// Core data types shared by the calculation engine, the UI and the file format.
// Everything the student types lives in `Project`. Everything the engine
// produces lives in `ProjectResult`. The engine never mutates a Project.

export type Confidence = 'evidence' | 'benchmark' | 'speculative' | 'unset';

/** One numeric assumption with its justification. Percentages are stored as
 *  whole percents (3 means 3%). */
export interface Assumption {
  v: number;
  basis: string;
  conf: Confidence;
  /** True while the value is an illustrative default nobody has reviewed. */
  example: boolean;
}

export type ModelKind =
  | 'software'
  | 'manufacturing'
  | 'services'
  | 'ecommerce'
  | 'marketplace'
  | 'licensing'
  | 'enterprise';

export type Unit =
  | 'usd'
  | 'pct'
  | 'count'
  | 'months'
  | 'days'
  | 'hours'
  | 'month' // a projection month number (1 = first month)
  | 'ratio';

export interface Stream {
  id: string;
  kind: ModelKind;
  name: string;
  inputs: Record<string, Assumption>;
  options: Record<string, string | boolean>;
}

/** Justification fields carried by every row-style input (roles, expenses...). */
export interface Justified {
  basis: string;
  conf: Confidence;
  example: boolean;
}

export type RoleDept = 'delivery' | 'sales' | 'product' | 'admin';

export interface Role extends Justified {
  id: string;
  title: string;
  count: number;
  monthlyComp: number;
  burdenPct: number;
  startMonth: number;
  endMonth: number | null;
  annualRaisePct: number;
  /** delivery staff are a direct cost (cost of service); others are operating expenses. */
  dept: RoleDept;
}

export type OpexCategory = 'sm' | 'rd' | 'ga' | 'other';

export interface Expense extends Justified {
  id: string;
  name: string;
  category: OpexCategory;
  kind: 'recurring' | 'one-time';
  amount: number;
  startMonth: number;
  endMonth: number | null;
  annualGrowthPct: number;
  payDelayDays: number;
}

export interface CapexItem extends Justified {
  id: string;
  name: string;
  amount: number;
  month: number;
  usefulLifeMonths: number;
}

export interface Funding extends Justified {
  id: string;
  name: string;
  kind: 'equity' | 'loan' | 'grant';
  amount: number;
  month: number;
  annualRatePct: number;
  termMonths: number;
}

export interface TaxSettings {
  enabled: boolean;
  entity: 'c_corp' | 'pass_through';
  rate: Assumption;
  payment: 'quarterly' | 'annual';
  /** For pass-through entities: include owners' estimated tax as a cash distribution. */
  includeOwnerDistributions: boolean;
}

export interface Setup {
  name: string;
  description: string;
  industry: string;
  /** 'YYYY-MM' */
  startMonth: string;
  months: number;
  startingCash: Assumption;
  founderInvestment: Assumption;
  minCashCushion: Assumption;
  /** Used by models that do not track individual customers. */
  largestCustomerSharePct: Assumption;
}

export type ScenarioId = 'base' | 'downside' | 'upside';

export interface ScenarioAdjustments {
  /** Months to delay every planned hire (roles starting after month 1). */
  hiringDelayMonths: number;
  /** Extra days customers take to pay, added to every collection term. */
  extraCollectionDays: number;
  /** Percent change applied to all compensation (e.g. 10 means +10%). */
  compChangePct: number;
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  /** Override values keyed by assumption path (see engine/paths.ts). */
  overrides: Record<string, number>;
  adjustments: ScenarioAdjustments;
  notes: string;
}

export interface Project {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  setup: Setup;
  streams: Stream[];
  roles: Role[];
  expenses: Expense[];
  capex: CapexItem[];
  funding: Funding[];
  tax: TaxSettings;
  scenarios: Record<ScenarioId, Scenario>;
  /** Student responses to model-review prompts, keyed by prompt id. */
  reviewResponses: Record<string, string>;
  /** Free-text reflection shown on the instructor summary. */
  reflection: string;
  /** Exit Strategy (bonus, ungraded). */
  exit: ExitSettings;
}

// ---------------------------------------------------------------------------
// Results

export interface Line {
  key: string;
  label: string;
  values: number[];
}

export interface OpexLine extends Line {
  category: OpexCategory;
}

export interface MetricLine extends Line {
  unit: Unit;
  /** How to roll the metric up for a projection total. */
  total?: 'sum' | 'last' | 'avg' | 'none';
  note?: string;
}

/** An amount that becomes due each month and is paid (or collected) after a delay. */
export interface TimedFlow {
  label: string;
  values: number[];
  days: number;
  /** For payables: whether this is a direct cost or an operating expense. */
  kind?: 'direct' | 'opex';
}

export type IssueLevel = 'info' | 'warn';

export interface Issue {
  id: string;
  level: IssueLevel;
  message: string;
  /** Month numbers the issue applies to, when relevant. */
  months?: number[];
}

/** What a business-model module returns. The shared engine turns this into
 *  an income statement and cash flow. */
export interface StreamResult {
  revenue: Line[];
  direct: Line[];
  opex: OpexLine[];
  /** Invoices issued to customers, each with its collection delay. */
  billings: TimedFlow[];
  /** Amounts owed to suppliers/vendors for this stream's costs, with payment delay.
   *  Must cover every direct and opex line (inventory purchases may replace
   *  material cost of goods sold). */
  payables: TimedFlow[];
  capex: CapexItem[];
  metrics: MetricLine[];
  issues: Issue[];
  /** Largest single customer's share of this stream's revenue (0..1), per month. */
  largestCustomerShare?: number[];
  /** Inventory held at month end. */
  inventory?: number[];
}

export interface MonthRow {
  month: number;
  label: string;
  revenue: number;
  direct: number;
  grossProfit: number;
  grossMargin: number | null;
  personnel: number;
  sm: number;
  rd: number;
  ga: number;
  other: number;
  opex: number;
  ebitda: number;
  depreciation: number;
  operatingProfit: number;
  interest: number;
  pretax: number;
  tax: number;
  netIncome: number;

  beginningCash: number;
  collections: number;
  founder: number;
  equity: number;
  loanProceeds: number;
  paidDirect: number;
  paidOpex: number;
  paidPersonnel: number;
  capexPaid: number;
  interestPaid: number;
  principalPaid: number;
  taxPaid: number;
  ownerDistributions: number;
  operatingCashFlow: number;
  netCashChange: number;
  endingCash: number;

  billings: number;
  receivables: number;
  payables: number;
  deferredRevenue: number;
  inventory: number;
  debt: number;
  /** Net cash used by operations and capital spending (positive = burning). */
  burn: number;
  cumulativeBurn: number;
}

export interface Summary {
  months: number;
  totalRevenue: number;
  totalDirect: number;
  totalOpex: number;
  totalExpenses: number;
  grossMargin: number | null;
  totalEbitda: number;
  totalOperatingProfit: number;
  totalNetIncome: number;
  endingCash: number;
  minCash: number;
  minCashMonth: number;
  firstNegativeCashMonth: number | null;
  /** Average burn over the last three months (positive = burning). */
  currentBurn: number;
  peakBurn: number;
  runwayMonths: number | null;
  runwayLabel: string;
  operatingBreakEvenMonth: number | null;
  cashBreakEvenMonth: number | null;
  fundingRequired: number;
  totalFundingIn: number;
  revenueGrowthLast6: number | null;
  /** True when ending cash is positive but cash dipped below zero earlier. */
  hiddenShortfall: boolean;
}

export interface ProjectResult {
  rows: MonthRow[];
  summary: Summary;
  streams: { stream: Stream; result: StreamResult }[];
  /** Detail lines for the projection tables. */
  revenueLines: Line[];
  directLines: Line[];
  personnelLines: Line[];
  opexLines: OpexLine[];
  issues: Issue[];
  largestCustomerShare: number[];
}

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  evidence: 'Evidence-based',
  benchmark: 'Benchmark-based',
  speculative: 'Speculative',
  unset: 'Not yet rated',
};

export const OPEX_LABELS: Record<OpexCategory, string> = {
  sm: 'Sales and marketing',
  rd: 'Research and development',
  ga: 'General and administrative',
  other: 'Other operating expenses',
};
