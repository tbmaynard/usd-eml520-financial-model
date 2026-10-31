import type { Assumption, ModelKind, StreamResult, Unit } from '../types';

export interface FieldSpec {
  key: string;
  label: string;
  unit: Unit;
  help: string;
  group: string;
  min?: number;
  max?: number;
  step?: number;
  /** Only show (and only compute with) this field when the predicate passes. */
  showIf?: (options: Record<string, string | boolean>) => boolean;
  /** Include in the sensitivity analysis. */
  sensitivity?: boolean;
  /** Offer as a scenario driver by default. */
  scenario?: boolean;
  /** Direction that hurts the business, used to build downside defaults: 1 = higher is worse. */
  worseWhen?: 'higher' | 'lower';
}

export interface OptionSpec {
  key: string;
  label: string;
  help: string;
  group: string;
  type: 'boolean' | 'select';
  choices?: { value: string; label: string }[];
  showIf?: (options: Record<string, string | boolean>) => boolean;
}

/** A reference to a value that a formula explanation can display. */
export type Ref =
  | { kind: 'input'; key: string; label?: string }
  | { kind: 'metric'; key: string; label?: string; offset?: number }
  | { kind: 'revenue' | 'direct' | 'opex'; key: string; label?: string }
  | { kind: 'row'; key: string; label?: string; offset?: number };

export interface FormulaDoc {
  id: string;
  title: string;
  definition: string;
  /** Plain-language formula, e.g. "Revenue = Active customers × Price". */
  expression: string;
  result?: Ref;
  terms: Ref[];
  limitations?: string;
  /** Standard reference for the definition, where one exists. */
  reference?: string;
  /** Only relevant when the predicate passes. */
  showIf?: (options: Record<string, string | boolean>) => boolean;
}

export interface ModelContext {
  months: number;
  /** Days added to every collection term (scenario adjustment). */
  extraCollectionDays: number;
}

export type Inputs = Record<string, Assumption>;
export type Options = Record<string, string | boolean>;

export interface ModelModule {
  kind: ModelKind;
  label: string;
  short: string;
  description: string;
  examples: string;
  fields: FieldSpec[];
  options: OptionSpec[];
  defaultOptions: Options;
  /** Illustrative starting values. */
  defaults: Record<string, number>;
  formulas: FormulaDoc[];
  compute(inputs: Inputs, options: Options, ctx: ModelContext): StreamResult;
}
