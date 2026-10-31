import { Box, Stack, Typography } from '@mui/material';
import {
  Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipProps,
} from 'recharts';
import type { ProjectResult } from '../../engine/types';
import { money } from '../format';
import { CHART, SURFACE, USD } from '../theme';

const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: CHART.grid },
};

function ChartTip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: SURFACE.raised, border: `1px solid ${SURFACE.line}`, borderRadius: 1.5, px: 1.5, py: 1, minWidth: 180 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      {payload.filter((p) => p.value != null).map((p) => (
        <Stack key={p.dataKey as string} direction="row" justifyContent="space-between" spacing={2} alignItems="center">
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 10, height: 3, bgcolor: p.color, borderRadius: 1 }} />
            <Typography variant="body2" color="text.secondary">{p.name}</Typography>
          </Stack>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{money(p.value as number)}</Typography>
        </Stack>
      ))}
    </Box>
  );
}

const legendStyle = { fontSize: 12, color: SURFACE.textMuted, paddingTop: 8 };
const tick = (v: number) => money(v, { compact: true });

export function ChartFrame({ title, note, children, height = 260 }: { title: string; note?: string; children: React.ReactElement; height?: number }) {
  return (
    <Box>
      <Typography variant="h4">{title}</Typography>
      {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
      <Box sx={{ height, mt: 1 }} role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </Box>
    </Box>
  );
}

const mLabel = (r: ProjectResult) => r.rows.map((x) => `M${x.month} · ${x.label}`);

export function RevenueExpensesChart({ r }: { r: ProjectResult }) {
  const labels = mLabel(r);
  const data = r.rows.map((x, i) => ({ m: labels[i], revenue: x.revenue, expenses: x.direct + x.opex }));
  return (
    <ChartFrame title="Monthly revenue and expenses" note="Expenses are direct costs plus operating expenses, on an earned basis (not cash).">
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="m" {...axisProps} tickFormatter={(v: string) => v.split(' · ')[0]} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} tickFormatter={tick} width={64} />
        <Tooltip content={<ChartTip />} cursor={{ stroke: SURFACE.textFaint, strokeDasharray: '3 3' }} />
        <Legend wrapperStyle={legendStyle} />
        <Line isAnimationActive={false} type="monotone" dataKey="revenue" name="Revenue" stroke={CHART.series[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: SURFACE.panel, strokeWidth: 2 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="expenses" name="Expenses" stroke={CHART.series[1]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: SURFACE.panel, strokeWidth: 2 }} />
      </ComposedChart>
    </ChartFrame>
  );
}

export function CashChart({ r, cushion }: { r: ProjectResult; cushion: number }) {
  const labels = mLabel(r);
  const data = r.rows.map((x, i) => ({ m: labels[i], cash: x.endingCash }));
  const negs = r.rows.filter((x) => x.endingCash < 0);
  const max = Math.max(0, ...r.rows.map((x) => x.endingCash));
  const min = Math.min(0, ...r.rows.map((x) => x.endingCash));
  const zeroOffset = max - min === 0 ? 1 : max / (max - min);
  return (
    <ChartFrame title="Ending cash balance" note={negs.length ? `Cash is below zero in ${negs.length} month(s), from month ${negs[0].month}. The business cannot actually operate there without more funding.` : 'Cash in the bank at the end of each month.'}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset={0} stopColor={CHART.cash} stopOpacity={0.35} />
            <stop offset={zeroOffset} stopColor={CHART.cash} stopOpacity={0.08} />
            <stop offset={zeroOffset} stopColor={CHART.negative} stopOpacity={0.15} />
            <stop offset={1} stopColor={CHART.negative} stopOpacity={0.45} />
          </linearGradient>
          <linearGradient id="cashStroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset={zeroOffset} stopColor={CHART.cash} />
            <stop offset={zeroOffset} stopColor={CHART.negative} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="m" {...axisProps} tickFormatter={(v: string) => v.split(' · ')[0]} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} tickFormatter={tick} width={64} />
        <Tooltip content={<ChartTip />} cursor={{ stroke: SURFACE.textFaint, strokeDasharray: '3 3' }} />
        {negs.length > 0 && <ReferenceArea x1={labels[negs[0].month - 1]} x2={labels[negs[negs.length - 1].month - 1]} fill={USD.poppy} fillOpacity={0.06} />}
        <ReferenceLine y={0} stroke={USD.poppy} strokeWidth={1.5} label={{ value: 'Zero cash', fill: USD.poppy, fontSize: 11, position: 'insideBottomLeft' }} />
        {cushion > 0 && <ReferenceLine y={cushion} stroke={SURFACE.textFaint} strokeDasharray="4 4" label={{ value: 'Your cash cushion', fill: SURFACE.textMuted, fontSize: 11, position: 'insideTopRight' }} />}
        <Area isAnimationActive={false} type="monotone" dataKey="cash" name="Ending cash" stroke="url(#cashStroke)" strokeWidth={2} fill="url(#cashFill)" activeDot={{ r: 4, stroke: SURFACE.panel, strokeWidth: 2 }} />
      </ComposedChart>
    </ChartFrame>
  );
}

export function GrossVsOpexChart({ r }: { r: ProjectResult }) {
  const labels = mLabel(r);
  const data = r.rows.map((x, i) => ({ m: labels[i], gross: x.grossProfit, opex: x.opex }));
  return (
    <ChartFrame title="Gross profit and operating expenses" note="When gross profit bars rise above operating expenses, operations cover their own costs.">
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }} barGap={2} barCategoryGap="20%">
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="m" {...axisProps} tickFormatter={(v: string) => v.split(' · ')[0]} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} tickFormatter={tick} width={64} />
        <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend wrapperStyle={legendStyle} />
        <ReferenceLine y={0} stroke={CHART.axis} />
        <Bar isAnimationActive={false} dataKey="gross" name="Gross profit" fill={CHART.series[2]} radius={[4, 4, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="opex" name="Operating expenses" fill={CHART.series[1]} radius={[4, 4, 0, 0]} />
      </ComposedChart>
    </ChartFrame>
  );
}

export function RevenueBySourceChart({ r }: { r: ProjectResult }) {
  const labels = mLabel(r);
  // Positive revenue lines only; at most three named sources plus "Other".
  const lines = r.revenueLines.filter((l) => l.values.some((v) => v > 0)).sort((a, b) => sumOf(b.values) - sumOf(a.values));
  const named = lines.slice(0, lines.length > 4 ? 3 : 4);
  const rest = lines.slice(named.length);
  const negatives = r.revenueLines.filter((l) => l.values.every((v) => v <= 0) && l.values.some((v) => v < 0));
  const data = r.rows.map((_, i) => {
    const d: Record<string, number | string> = { m: labels[i] };
    named.forEach((l, k) => { d[`s${k}`] = l.values[i]; });
    if (rest.length) d.other = rest.reduce((a, l) => a + l.values[i], 0);
    return d;
  });
  return (
    <ChartFrame title="Revenue growth over time, by source" note={negatives.length ? 'Shown before returns and refunds.' : 'Revenue earned each month, stacked by source.'}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="m" {...axisProps} tickFormatter={(v: string) => v.split(' · ')[0]} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} tickFormatter={tick} width={64} />
        <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {named.length + (rest.length ? 1 : 0) > 1 && <Legend wrapperStyle={legendStyle} />}
        {named.map((l, k) => (
          <Bar isAnimationActive={false} key={l.key} dataKey={`s${k}`} name={l.label} stackId="rev" fill={CHART.series[k]} stroke={SURFACE.panel} strokeWidth={1}
            radius={k === named.length - 1 && !rest.length ? [4, 4, 0, 0] : undefined} />
        ))}
        {rest.length > 0 && <Bar isAnimationActive={false} dataKey="other" name="Other" stackId="rev" fill={SURFACE.textFaint} stroke={SURFACE.panel} strokeWidth={1} radius={[4, 4, 0, 0]} />}
      </ComposedChart>
    </ChartFrame>
  );
}

function sumOf(v: number[]) { return v.reduce((a, b) => a + b, 0); }

export function ScenarioCashChart({ results, labels }: { results: Record<'downside' | 'base' | 'upside', ProjectResult>; labels: Record<'downside' | 'base' | 'upside', string> }) {
  const ml = mLabel(results.base);
  const data = results.base.rows.map((_, i) => ({ m: ml[i], downside: results.downside.rows[i].endingCash, base: results.base.rows[i].endingCash, upside: results.upside.rows[i].endingCash }));
  return (
    <ChartFrame title="Ending cash by scenario" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="m" {...axisProps} tickFormatter={(v: string) => v.split(' · ')[0]} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} tickFormatter={tick} width={64} />
        <Tooltip content={<ChartTip />} cursor={{ stroke: SURFACE.textFaint, strokeDasharray: '3 3' }} />
        <Legend wrapperStyle={legendStyle} />
        <ReferenceLine y={0} stroke={USD.poppy} strokeWidth={1.5} />
        {(['downside', 'base', 'upside'] as const).map((s) => (
          <Line isAnimationActive={false} key={s} type="monotone" dataKey={s} name={labels[s]} stroke={CHART.scenario[s]} strokeWidth={2} dot={false}
            strokeDasharray={s === 'downside' ? '6 3' : s === 'upside' ? '2 3' : undefined} activeDot={{ r: 4, stroke: SURFACE.panel, strokeWidth: 2 }} />
        ))}
      </ComposedChart>
    </ChartFrame>
  );
}
