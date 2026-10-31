import type { Unit } from '../engine/types';

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function money(x: number | null | undefined, opts: { compact?: boolean; cents?: boolean } = {}): string {
  if (x == null || !Number.isFinite(x)) return '—';
  if (opts.compact && Math.abs(x) >= 1000) {
    const abs = Math.abs(x);
    const sign = x < 0 ? '−' : '';
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M`;
    return `${sign}$${(abs / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}k`;
  }
  const s = (opts.cents || (Math.abs(x) < 10 && x % 1 !== 0) ? usd2 : usd0).format(Math.abs(x));
  return x < 0 ? `−${s}` : s;
}

export function pct(x: number | null | undefined, digits = 0): string {
  if (x == null || !Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}

export function num(x: number | null | undefined, digits?: number): string {
  if (x == null || !Number.isFinite(x)) return '—';
  const d = digits ?? (Math.abs(x) >= 100 || Number.isInteger(x) ? 0 : 1);
  const s = Math.abs(x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  return x < 0 ? `−${s}` : s;
}

/** Format an assumption value in its unit (percents are stored as whole percents). */
export function formatUnit(v: number, unit: Unit): string {
  switch (unit) {
    case 'usd': return money(v, { cents: Math.abs(v) < 100 && v % 1 !== 0 });
    case 'pct': return `${num(v, 2)}%`;
    case 'ratio': return pct(v, 0);
    case 'days': return `${num(v)} days`;
    case 'months': return `${num(v)} mo`;
    case 'month': return `month ${num(v)}`;
    case 'hours': return `${num(v)} h`;
    default: return num(v);
  }
}

/** Format an engine output value (ratios are 0..1). */
export function formatMetric(v: number, unit: Unit): string {
  if (unit === 'pct' || unit === 'ratio') return pct(v, 0);
  return formatUnit(v, unit);
}

export const UNIT_ADORN: Partial<Record<Unit, { start?: string; end?: string }>> = {
  usd: { start: '$' },
  pct: { end: '%' },
  days: { end: 'days' },
  months: { end: 'months' },
  month: { start: 'Month' },
  hours: { end: 'hours' },
};
