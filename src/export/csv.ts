import { listAssumptions } from '../engine/paths';
import type { MonthRow, Project, ProjectResult } from '../engine/types';
import { CONFIDENCE_LABELS } from '../engine/types';
import { downloadBlob, safeFileName } from '../state/fileio';

function cell(v: unknown): string {
  const s = v == null ? '' : typeof v === 'number' ? (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export function registerRows(p: Project): unknown[][] {
  const head = ['Group', 'Assumption', 'Value', 'Unit', 'Basis', 'Confidence', 'Still an example value'];
  return [head, ...listAssumptions(p).map((a) => [a.group, a.label, a.value, a.unit === 'pct' ? '%' : a.unit, a.basis, CONFIDENCE_LABELS[a.conf], a.example ? 'yes' : ''])];
}

export function exportRegisterCsv(p: Project): void {
  downloadBlob(new Blob([toCsv(registerRows(p))], { type: 'text/csv' }), `${safeFileName(p.setup.name)}-assumptions.csv`);
}

/** Line items of the projection, one row per line and one column per month. */
export interface TableLine { label: string; values: number[]; bold?: boolean; section?: boolean; noTotal?: boolean; unit?: 'usd' | 'pct' | 'count' | 'other' }

export function projectionTable(r: ProjectResult): TableLine[] {
  const pick = (k: keyof MonthRow) => r.rows.map((x) => x[k] as number);
  const out: TableLine[] = [];
  const sec = (label: string) => out.push({ label, values: [], section: true });
  sec('INCOME STATEMENT (simplified)');
  for (const l of r.revenueLines) out.push({ label: `  ${l.label}`, values: l.values });
  out.push({ label: 'Total revenue', values: pick('revenue'), bold: true });
  for (const l of r.directLines) out.push({ label: `  ${l.label}`, values: l.values });
  out.push({ label: 'Total direct costs', values: pick('direct'), bold: true });
  out.push({ label: 'Gross profit', values: pick('grossProfit'), bold: true });
  out.push({ label: 'Gross margin %', values: r.rows.map((x) => (x.grossMargin == null ? NaN : x.grossMargin * 100)), noTotal: true, unit: 'pct' });
  out.push({ label: 'Personnel', values: pick('personnel') });
  out.push({ label: 'Sales and marketing', values: pick('sm') });
  out.push({ label: 'Research and development', values: pick('rd') });
  out.push({ label: 'General and administrative', values: pick('ga') });
  out.push({ label: 'Other operating expenses', values: pick('other') });
  out.push({ label: 'Total operating expenses', values: pick('opex'), bold: true });
  out.push({ label: 'EBITDA (simplified)', values: pick('ebitda'), bold: true });
  out.push({ label: 'Depreciation', values: pick('depreciation') });
  out.push({ label: 'Operating profit (loss)', values: pick('operatingProfit'), bold: true });
  out.push({ label: 'Interest', values: pick('interest') });
  out.push({ label: 'Income tax (estimate)', values: pick('tax') });
  out.push({ label: 'Net income', values: pick('netIncome'), bold: true });
  sec('CASH FLOW');
  out.push({ label: 'Beginning cash', values: pick('beginningCash'), noTotal: true });
  out.push({ label: 'Cash collected from customers', values: pick('collections') });
  out.push({ label: 'Founder investment', values: pick('founder') });
  out.push({ label: 'Investment and grants', values: pick('equity') });
  out.push({ label: 'Loan proceeds', values: pick('loanProceeds') });
  out.push({ label: 'Cash paid for direct costs', values: pick('paidDirect').map((v) => -v) });
  out.push({ label: 'Cash paid for operating expenses', values: pick('paidOpex').map((v) => -v) });
  out.push({ label: 'Cash paid for salaries', values: pick('paidPersonnel').map((v) => -v) });
  out.push({ label: 'Equipment purchases', values: pick('capexPaid').map((v) => -v) });
  out.push({ label: 'Interest paid', values: pick('interestPaid').map((v) => -v) });
  out.push({ label: 'Loan repayments', values: pick('principalPaid').map((v) => -v) });
  out.push({ label: 'Income taxes paid', values: pick('taxPaid').map((v) => -v) });
  out.push({ label: 'Owner tax distributions', values: pick('ownerDistributions').map((v) => -v) });
  out.push({ label: 'Net change in cash', values: pick('netCashChange'), bold: true });
  out.push({ label: 'Ending cash', values: pick('endingCash'), bold: true, noTotal: true });
  sec('BALANCES AT MONTH END');
  out.push({ label: 'Invoices issued in the month', values: pick('billings') });
  out.push({ label: 'Money customers still owe', values: pick('receivables'), noTotal: true });
  out.push({ label: 'Deferred revenue', values: pick('deferredRevenue'), noTotal: true });
  out.push({ label: 'Bills not yet paid', values: pick('payables'), noTotal: true });
  out.push({ label: 'Inventory', values: pick('inventory'), noTotal: true });
  out.push({ label: 'Loan balance', values: pick('debt'), noTotal: true });
  out.push({ label: 'Monthly burn', values: pick('burn') });
  for (const { stream, result } of r.streams) {
    sec(`BUSINESS METRICS: ${stream.name}`);
    for (const m of result.metrics) out.push({ label: `${m.label}${m.unit === 'ratio' ? ' %' : ''}`, values: m.unit === 'ratio' ? m.values.map((v) => v * 100) : m.values, noTotal: m.total !== 'sum', unit: m.unit === 'usd' ? 'usd' : m.unit === 'ratio' ? 'pct' : 'count' });
  }
  return out;
}

export function exportProjectionCsv(p: Project, r: ProjectResult, scenarioLabel: string): void {
  const head = ['Line', ...r.rows.map((x) => `M${x.month} ${x.label}`), 'Total'];
  const body = projectionTable(r).map((l) => (l.section ? [l.label] : [l.label, ...l.values, l.noTotal ? '' : lineTotal(l.values)]));
  const rows = [[`${p.setup.name}: ${scenarioLabel}`], ['Simplified educational projection. Not audited financial statements or tax advice.'], head, ...body];
  downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv' }), `${safeFileName(p.setup.name)}-projection-${safeFileName(scenarioLabel)}.csv`);
}

export function lineTotal(values: number[]): number {
  return values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}
