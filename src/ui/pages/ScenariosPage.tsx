import AddIcon from '@mui/icons-material/Add';
import RestartAlt from '@mui/icons-material/RestartAlt';
import {
  Autocomplete, Box, Button, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { suggestOverrides } from '../../data/defaults';
import { getValue, listAssumptions } from '../../engine/paths';
import { metricValue, rankSensitivity, runSensitivity, SENS_METRICS, type SensMetric } from '../../engine/sensitivity';
import type { ScenarioId, Summary } from '../../engine/types';
import { useStore } from '../../state/store';
import { ScenarioCashChart } from '../components/charts';
import { Callout, PageHeader, Panel, SectionTabs, useTab } from '../components/common';
import { NumberField } from '../components/inputs';
import { formatUnit, money, num, pct } from '../format';
import { CHART, SURFACE, USD } from '../theme';

const TABS = [
  { id: 'compare', label: 'Compare scenarios' },
  { id: 'edit', label: 'Set up scenarios' },
  { id: 'sensitivity', label: 'Sensitivity analysis' },
];
const IDS: ScenarioId[] = ['downside', 'base', 'upside'];

export function ScenariosPage() {
  const tab = useTab(TABS);
  return (
    <Box>
      <PageHeader title="Scenarios" lead="What happens when important assumptions are wrong? Scenarios change the underlying drivers (not the totals) and recalculate the whole model." />
      <SectionTabs section="scenarios" tabs={TABS} />
      {tab === 'compare' && <Compare />}
      {tab === 'edit' && <EditScenarios />}
      {tab === 'sensitivity' && <Sensitivity />}
    </Box>
  );
}

function Compare() {
  const { project, results, setScenario, go } = useStore();
  const labels = { downside: project.scenarios.downside.label, base: project.scenarios.base.label, upside: project.scenarios.upside.label };
  const rows: { label: string; get: (s: Summary) => string; bad?: (s: Summary) => boolean }[] = [
    { label: 'Total revenue', get: (s) => money(s.totalRevenue) },
    { label: 'Gross margin', get: (s) => pct(s.grossMargin) },
    { label: 'EBITDA (simplified)', get: (s) => money(s.totalEbitda), bad: (s) => s.totalEbitda < 0 },
    { label: 'Operating profit (loss)', get: (s) => money(s.totalOperatingProfit), bad: (s) => s.totalOperatingProfit < 0 },
    { label: 'Ending cash', get: (s) => money(s.endingCash), bad: (s) => s.endingCash < 0 },
    { label: 'Lowest cash balance', get: (s) => `${money(s.minCash)} (M${s.minCashMonth})`, bad: (s) => s.minCash < 0 },
    { label: 'Runway', get: (s) => (s.firstNegativeCashMonth != null ? `Runs out in month ${s.firstNegativeCashMonth}` : s.currentBurn > 0 ? `${num(Math.floor(s.endingCash / s.currentBurn))} months past the end` : 'Not burning cash'), bad: (s) => s.firstNegativeCashMonth != null },
    { label: 'Break-even month', get: (s) => (s.operatingBreakEvenMonth ? `Month ${s.operatingBreakEvenMonth}` : 'Not reached') },
    { label: 'Additional funding required', get: (s) => (s.fundingRequired > 0 ? money(s.fundingRequired) : 'None'), bad: (s) => s.fundingRequired > 0 },
  ];
  return (
    <Box>
      <Panel pad={false}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell />
                {IDS.map((id) => (
                  <TableCell key={id} align="right">
                    <Stack alignItems="flex-end">
                      <Stack direction="row" spacing={0.75} alignItems="center"><Box sx={{ width: 12, height: 3, bgcolor: CHART.scenario[id], borderRadius: 1 }} /><Typography sx={{ fontWeight: 700 }}>{labels[id]}</Typography></Stack>
                      <Button size="small" onClick={() => { setScenario(id); go('projections', 'dashboard'); }}>View projections</Button>
                    </Stack>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.label} hover>
                  <TableCell sx={{ color: 'text.secondary' }}>{r.label}</TableCell>
                  {IDS.map((id) => <TableCell key={id} align="right" sx={{ color: r.bad?.(results[id].summary) ? USD.poppy : undefined, fontWeight: 600 }}>{r.get(results[id].summary)}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
      <Panel><ScenarioCashChart results={results} labels={labels} /></Panel>
      <Panel title="What each scenario represents">
        <Stack spacing={1.5}>
          {(['downside', 'upside'] as const).map((id) => (
            <Box key={id}>
              <Typography variant="subtitle1">{labels[id]}</Typography>
              <Typography variant="body2" color={project.scenarios[id].notes ? 'text.primary' : 'text.secondary'} sx={{ fontStyle: project.scenarios[id].notes ? 'normal' : 'italic' }}>
                {project.scenarios[id].notes || 'No explanation yet. Describe the events that would produce this case on the Set up scenarios tab.'}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Panel>
    </Box>
  );
}

function EditScenarios() {
  const { project, update } = useStore();
  const all = useMemo(() => listAssumptions(project), [project]);
  const overridden = new Set([...Object.keys(project.scenarios.downside.overrides), ...Object.keys(project.scenarios.upside.overrides)]);
  const drivers = all.filter((a) => a.scenario || overridden.has(a.path));
  const others = all.filter((a) => !drivers.includes(a));
  const [adding, setAdding] = useState<string | null>(null);

  const setOverride = (id: 'downside' | 'upside', path: string, v: number | null) => update((d) => {
    if (v == null) delete d.scenarios[id].overrides[path];
    else d.scenarios[id].overrides[path] = v;
  });

  return (
    <Box>
      <Callout>
        The base case is your assumptions exactly as entered. For the downside and upside, change only the drivers you have a reason to change, and write down the situation each case represents. The suggested values (each driver moved about 20%) are only starting points.
      </Callout>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5 }}>
        {(['downside', 'upside'] as const).map((id) => {
          const sc = project.scenarios[id];
          return (
            <Panel key={id} title={<Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 12, height: 3, bgcolor: CHART.scenario[id], borderRadius: 1 }} /><span>{sc.label}</span></Stack>}>
              <Stack spacing={2}>
                <TextField label="Scenario name" value={sc.label} onChange={(e) => update((d) => { d.scenarios[id].label = e.target.value; })} />
                <TextField label="What situation does this represent?" value={sc.notes} onChange={(e) => update((d) => { d.scenarios[id].notes = e.target.value; })} multiline minRows={2}
                  placeholder={id === 'downside' ? 'e.g. “The anchor customer delays its purchase by six months and a competitor cuts prices.”' : 'e.g. “A distribution partner signs in month 6.”'} />
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  <NumberField label="Delay planned hires" unit="months" value={sc.adjustments.hiringDelayMonths} min={-12} max={24} integer width={170} onChange={(v) => update((d) => { d.scenarios[id].adjustments.hiringDelayMonths = v; })} />
                  <NumberField label="Customers pay later by" unit="days" value={sc.adjustments.extraCollectionDays} min={-60} max={180} width={170} onChange={(v) => update((d) => { d.scenarios[id].adjustments.extraCollectionDays = v; })} />
                  <NumberField label="Change in all pay" unit="pct" value={sc.adjustments.compChangePct} min={-50} max={100} width={150} onChange={(v) => update((d) => { d.scenarios[id].adjustments.compChangePct = v; })} />
                </Stack>
              </Stack>
            </Panel>
          );
        })}
      </Box>

      <Panel title="Driver values by scenario" subtitle="A blank cell means the scenario uses the base value."
        action={
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RestartAlt />} onClick={() => update((d) => { d.scenarios.downside.overrides = suggestOverrides(d, 'downside'); d.scenarios.upside.overrides = suggestOverrides(d, 'upside'); })}>Reset to suggested values</Button>
          </Stack>
        } pad={false}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 260 }}>Driver</TableCell>
                <TableCell align="right">Base (your input)</TableCell>
                <TableCell align="right">{project.scenarios.downside.label}</TableCell>
                <TableCell align="right">{project.scenarios.upside.label}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {drivers.map((a) => (
                <TableRow key={a.path} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{a.group}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatUnit(getValue(project, a.path) ?? 0, a.unit)}</TableCell>
                  {(['downside', 'upside'] as const).map((id) => {
                    const ov = project.scenarios[id].overrides[a.path];
                    return (
                      <TableCell key={id} align="right">
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                          {ov == null ? (
                            <Button size="small" onClick={() => setOverride(id, a.path, a.value)} sx={{ color: 'text.secondary' }}>Same as base</Button>
                          ) : (
                            <>
                              <NumberField value={ov} unit={a.unit} width={150} onChange={(v) => setOverride(id, a.path, v)} ariaLabel={`${a.label} in ${id}`} />
                              <Tooltip title="Use the base value"><IconButton size="small" onClick={() => setOverride(id, a.path, null)} aria-label="Use the base value"><RestartAlt fontSize="small" /></IconButton></Tooltip>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2 }}>
          <Autocomplete options={others} getOptionLabel={(o) => `${o.label} · ${o.group}`} value={others.find((o) => o.path === adding) ?? null}
            onChange={(_, v) => setAdding(v?.path ?? null)} renderInput={(params) => <TextField {...params} label="Add another assumption to the scenarios" />} sx={{ width: 460, maxWidth: '100%' }} />
          <Button startIcon={<AddIcon />} disabled={!adding} onClick={() => {
            const a = others.find((o) => o.path === adding);
            if (a) update((d) => { d.scenarios.downside.overrides[a.path] = a.value; d.scenarios.upside.overrides[a.path] = a.value; });
            setAdding(null);
          }}>Add</Button>
        </Stack>
      </Panel>
    </Box>
  );
}

function Sensitivity() {
  const { project } = useStore();
  const [range, setRange] = useState(20);
  const [metric, setMetric] = useState<SensMetric>('minCash');
  const sens = useMemo(() => runSensitivity(project, range), [project, range]);
  const n = project.setup.months;
  const ranked = useMemo(() => rankSensitivity(sens.rows, metric, n), [sens, metric, n]);
  const baseV = metricValue(sens.base, metric, n);
  const meta = SENS_METRICS.find((m) => m.key === metric)!;
  const isMonths = metric === 'breakEven';
  const fmt = (v: number) => (isMonths ? (v > n ? 'not reached' : `month ${num(v)}`) : money(v));
  const fmtDelta = (v: number) => (isMonths ? `${v > 0 ? '+' : ''}${num(v)} mo` : money(v, { compact: true }));
  const top = ranked.slice(0, 12);
  const data = top.map((r) => ({ name: r.label, low: metricValue(r.lowResult, metric, n) - baseV, high: metricValue(r.highResult, metric, n) - baseV, lowLabel: r.lowLabel, highLabel: r.highLabel }));

  return (
    <Box>
      <Callout>
        Each assumption is tested on its own: moved down and up while everything else stays at the base case. The longest bars are the assumptions your venture depends on most. Those deserve the best evidence.
      </Callout>
      <Stack direction="row" spacing={2} sx={{ mb: 2.5 }} flexWrap="wrap" useFlexGap>
        <TextField select label="Measure the effect on" value={metric} onChange={(e) => setMetric(e.target.value as SensMetric)} sx={{ width: 280 }}>
          {SENS_METRICS.map((m) => <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>)}
        </TextField>
        <TextField select label="Change each assumption by" value={range} onChange={(e) => setRange(Number(e.target.value))} sx={{ width: 240 }}>
          {[10, 20, 30, 50].map((v) => <MenuItem key={v} value={v}>±{v}%</MenuItem>)}
        </TextField>
      </Stack>
      <Panel title={`Effect on ${meta.label.toLowerCase()}`} subtitle={`Base case: ${fmt(baseV)}. Bars show the change from the base case. ${meta.better === 'higher' ? 'Right is better.' : 'Left is better.'} Timing assumptions move by days or months rather than percent.`}>
        <Box sx={{ height: Math.max(240, top.length * 34 + 60) }} role="img" aria-label="Sensitivity chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }} barGap={2} barCategoryGap="25%">
              <CartesianGrid stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickFormatter={fmtDelta} />
              <YAxis type="category" dataKey="name" width={260} stroke={CHART.axis} tick={{ fill: SURFACE.textMuted, fontSize: 12 }} tickLine={false} />
              <ReferenceLine x={0} stroke={CHART.axis} />
              <RTooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <Box sx={{ bgcolor: SURFACE.raised, border: `1px solid ${SURFACE.line}`, borderRadius: 1.5, px: 1.5, py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{d.lowLabel}: {fmtDelta(d.low)} → {fmt(baseV + d.low)}</Typography>
                    <Typography variant="body2" color="text.secondary">{d.highLabel}: {fmtDelta(d.high)} → {fmt(baseV + d.high)}</Typography>
                  </Box>
                );
              }} />
              <Legend wrapperStyle={{ fontSize: 12, color: SURFACE.textMuted }} />
              <Bar isAnimationActive={false} dataKey="low" name="Assumption lower (or earlier)" fill={CHART.series[0]} radius={4} />
              <Bar isAnimationActive={false} dataKey="high" name="Assumption higher (or later)" fill={CHART.series[1]} radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Panel>
      <Panel title="All tested assumptions" pad={false}>
        <TableContainer sx={{ maxHeight: 560 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: SURFACE.panel, minWidth: 240 }}>Assumption</TableCell>
                <TableCell sx={{ bgcolor: SURFACE.panel }}>Tested</TableCell>
                {SENS_METRICS.map((m) => <TableCell key={m.key} align="right" sx={{ bgcolor: SURFACE.panel, whiteSpace: 'nowrap' }}>{m.label}<br /><span style={{ color: SURFACE.textFaint }}>lower / higher</span></TableCell>)}
                <TableCell sx={{ bgcolor: SURFACE.panel, minWidth: 260 }}>Why it matters</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ranked.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{r.label}</Typography><Typography variant="caption" color="text.secondary">{r.group} · {r.id.startsWith('x:') ? 'as entered' : `base ${formatUnit(r.base, r.unit)}`}</Typography></TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{r.lowLabel} / {r.highLabel}</TableCell>
                  {SENS_METRICS.map((m) => {
                    const f = (o: typeof r.lowResult) => (m.key === 'breakEven' ? (o.breakEven ? `M${o.breakEven}` : '—') : money(metricValue(o, m.key, n), { compact: true }));
                    return <TableCell key={m.key} align="right" sx={{ whiteSpace: 'nowrap' }}>{f(r.lowResult)} / {f(r.highResult)}</TableCell>;
                  })}
                  <TableCell><Typography variant="body2" color="text.secondary">{r.why}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
    </Box>
  );
}
