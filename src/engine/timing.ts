// Small, pure helpers shared by every module. Arrays are indexed from 0 for
// month 1. All money is in dollars.

import type { Inputs } from './models/moduleTypes';

export const DAYS_PER_MONTH = 30;

export function zeros(n: number): number[] {
  return new Array(n).fill(0);
}

export function sum(values: number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

export function addInto(target: number[], values: number[], scale = 1): void {
  for (let i = 0; i < target.length; i++) target[i] += (values[i] ?? 0) * scale;
}

export function cumulative(values: number[]): number[] {
  const out: number[] = [];
  let run = 0;
  for (const v of values) {
    run += v;
    out.push(run);
  }
  return out;
}

/** Read an assumption value, falling back to 0 for missing or invalid input. */
export function val(inputs: Inputs, key: string): number {
  const a = inputs[key];
  if (!a) return 0;
  const n = Number(a.v);
  return Number.isFinite(n) ? n : 0;
}

export function pct(inputs: Inputs, key: string): number {
  return val(inputs, key) / 100;
}

/**
 * Split a payment delay in days into whole months.
 * A delay of d days lands (1 - f) of the amount m months later and f of it
 * m + 1 months later, where m = floor(d / 30) and f = (d mod 30) / 30.
 * Net 45 therefore lands half one month later and half two months later.
 */
export function delaySplit(days: number): { months: number; fraction: number } {
  const d = Math.max(0, Number.isFinite(days) ? days : 0);
  const months = Math.floor(d / DAYS_PER_MONTH);
  const fraction = (d - months * DAYS_PER_MONTH) / DAYS_PER_MONTH;
  return { months, fraction };
}

/**
 * Turn amounts that become due each month into amounts paid each month.
 * Anything that would be paid after the projection ends stays outstanding.
 */
export function applyDelay(due: number[], days: number): { paid: number[]; outstanding: number[] } {
  const n = due.length;
  const paid = zeros(n);
  const { months, fraction } = delaySplit(days);
  for (let i = 0; i < n; i++) {
    const a = due[i];
    if (!a) continue;
    const first = i + months;
    if (first < n) paid[first] += a * (1 - fraction);
    if (fraction > 0 && first + 1 < n) paid[first + 1] += a * fraction;
  }
  const cumDue = cumulative(due);
  const cumPaid = cumulative(paid);
  const outstanding = cumDue.map((d, i) => d - cumPaid[i]);
  return { paid, outstanding };
}

/** A series that starts at `start` and grows by `growthPct` each month. */
export function growthSeries(n: number, start: number, growthPct: number): number[] {
  const g = growthPct / 100;
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    out.push(v);
    v = v * (1 + g);
  }
  return out;
}

/**
 * Convert a series of expected (fractional) counts into whole events.
 * An event is counted in the month the cumulative expected count reaches the
 * next whole number. Example: 0.4 per month gives events in months 3, 5, 8...
 */
export function wholeEvents(expected: number[]): number[] {
  const out: number[] = [];
  let cum = 0;
  let counted = 0;
  for (const e of expected) {
    cum += Math.max(0, e);
    const whole = Math.floor(cum + 1e-9);
    out.push(whole - counted);
    counted = whole;
  }
  return out;
}

/** Straight-line depreciation of a capital item, by month. */
export function depreciationSeries(n: number, amount: number, month: number, lifeMonths: number): number[] {
  const out = zeros(n);
  const life = Math.max(1, Math.round(lifeMonths));
  const perMonth = amount / life;
  for (let m = month; m < month + life; m++) {
    if (m >= 1 && m <= n) out[m - 1] += perMonth;
  }
  return out;
}

/** Monthly payment on an amortizing loan. */
export function loanPayment(principal: number, annualRatePct: number, termMonths: number): number {
  const n = Math.max(1, Math.round(termMonths));
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function safeDiv(a: number, b: number): number | null {
  if (!b || !Number.isFinite(b)) return null;
  return a / b;
}

export function monthLabel(startMonth: string, monthNumber: number): string {
  const [y, m] = startMonth.split('-').map(Number);
  if (!y || !m) return `M${monthNumber}`;
  const d = new Date(Date.UTC(y, m - 1 + monthNumber - 1, 1));
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}
