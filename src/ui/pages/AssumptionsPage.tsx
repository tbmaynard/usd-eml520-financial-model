import FunctionsIcon from '@mui/icons-material/Functions';
import WarningAmber from '@mui/icons-material/WarningAmber';
import {
  Box, Button, Chip, FormControlLabel, IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { getModule } from '../../engine/models';
import { listAssumptions, patchJustification } from '../../engine/paths';
import { rankSensitivity } from '../../engine/sensitivity';
import type { Confidence, Stream } from '../../engine/types';
import { CONFIDENCE_LABELS } from '../../engine/types';
import { exportRegisterCsv } from '../../export/csv';
import { useStore } from '../../state/store';
import { Callout, PageHeader, Panel } from '../components/common';
import { CapexEditor, ExpensesEditor, FundingEditor, RolesEditor, TaxEditor } from '../components/editors';
import { useExplain } from '../components/explain';
import { AssumptionField, ConfidenceDot, ConfidencePicker, InfoTip } from '../components/inputs';
import { formatMetric, formatUnit, money, pct } from '../format';
import { KEY_METRICS, useSensitivity } from '../streamMetrics';
import { SURFACE, USD } from '../theme';

const TABS = [
  { id: 'revenue', label: 'Revenue and direct costs' },
  { id: 'team', label: 'Team' },
  { id: 'expenses', label: 'Operating expenses and equipment' },
  { id: 'funding', label: 'Funding and taxes' },
  { id: 'register', label: 'Assumption register' },
];

export function AssumptionsPage() {
  const { tab, go, project } = useStore();
  const main = tab.startsWith('revenue') ? 'revenue' : TABS.some((t) => t.id === tab) ? tab : 'revenue';
  const streamId = tab.startsWith('revenue-') ? tab.slice(8) : project.streams[0].id;
  return (
    <Box>
      <PageHeader title="Assumptions" lead="Every number below is something you believe must be true. Enter a value, then say why you chose it and how well supported it is." />
      <Box sx={{ borderBottom: `1px solid ${SURFACE.line}`, mb: 3, display: 'flex', gap: 0.5, overflowX: 'auto' }} role="tablist">
        {TABS.map((t) => (
          <Button key={t.id} role="tab" aria-selected={main === t.id} onClick={() => go('assumptions', t.id)}
            sx={{ borderRadius: 0, px: 2, py: 1.25, whiteSpace: 'nowrap', color: main === t.id ? 'primary.main' : 'text.secondary', borderBottom: `2px solid ${main === t.id ? USD.toreroBlue : 'transparent'}` }}>
            {t.label}
          </Button>
        ))}
      </Box>
      {main === 'revenue' && <RevenueTab streamId={streamId} />}
      {main === 'team' && (
        <Panel title="Team plan" subtitle="Each role costs money from its start month onward, never before. Delivery staff are a direct cost; everyone else is an operating expense.">
          <RolesEditor />
        </Panel>
      )}
      {main === 'expenses' && (
        <>
          <Panel title="Operating expenses" subtitle="Costs of running the business. Salaries and payroll taxes come from the team plan, so do not enter them here. Starting categories are illustrative; edit, add or remove them.">
            <ExpensesEditor />
          </Panel>
          <Panel title="Equipment and other capital purchases" subtitle="Long-lived purchases are paid in cash when bought, but their cost reaches the income statement gradually as depreciation.">
            <CapexEditor />
          </Panel>
        </>
      )}
      {main === 'funding' && (
        <>
          <Panel title="Funding" subtitle="Investment, grants and loans. These bring cash in but are not revenue."><FundingEditor /></Panel>
          <Panel title="Income taxes"><TaxEditor /></Panel>
        </>
      )}
      {main === 'register' && <RegisterTab />}
    </Box>
  );
}

function RevenueTab({ streamId }: { streamId: string }) {
  const { project, update, go, results } = useStore();
  const stream = project.streams.find((s) => s.id === streamId) ?? project.streams[0];
  const idx = project.streams.indexOf(stream);
  const mod = getModule(stream.kind);
  const opts = { ...mod.defaultOptions, ...stream.options };
  const groups = useMemo(() => {
    const g: string[] = [];
    for (const f of mod.fields) if (!g.includes(f.group)) g.push(f.group);
    for (const o of mod.options) if (!g.includes(o.group)) g.push(o.group);
    return g;
  }, [mod]);
  const setInput = (key: string, patch: object) => update((d) => { Object.assign(d.streams[idx].inputs[key], patch); });
  const setOpt = (key: string, v: string | boolean) => update((d) => { d.streams[idx].options[key] = v; });

  return (
    <Box>
      {project.streams.length > 1 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2.5 }} flexWrap="wrap" useFlexGap>
          {project.streams.map((s, i) => (
            <Chip key={s.id} label={`${s.name} (${getModule(s.kind).short})`} color={s.id === stream.id ? 'primary' : 'default'} variant={s.id === stream.id ? 'filled' : 'outlined'}
              onClick={() => go('assumptions', `revenue-${s.id}`)} aria-pressed={s.id === stream.id} sx={{ fontWeight: i === 0 ? 700 : 500 }} />
          ))}
        </Stack>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' }, gap: 2.5, alignItems: 'start' }}>
        <Box>
          <Callout title={mod.label}>{mod.description}</Callout>
          {groups.map((g) => {
            const fields = mod.fields.filter((f) => f.group === g && (!f.showIf || f.showIf(opts)));
            const options = mod.options.filter((o) => o.group === g && (!o.showIf || o.showIf(opts)));
            if (!fields.length && !options.length) return null;
            return (
              <Panel key={g} title={g} pad={false}>
                {options.length > 0 && (
                  <Stack spacing={1} sx={{ px: 2.5, pb: 1.5 }}>
                    {options.map((o) => o.type === 'boolean' ? (
                      <Stack key={o.key} direction="row" alignItems="center" spacing={0.5}>
                        <FormControlLabel control={<Switch checked={opts[o.key] === true} onChange={(e) => setOpt(o.key, e.target.checked)} />} label={o.label} />
                        <InfoTip text={o.help} />
                      </Stack>
                    ) : (
                      <Stack key={o.key} direction="row" alignItems="center" spacing={1}>
                        <TextField select label={o.label} value={String(opts[o.key])} onChange={(e) => setOpt(o.key, e.target.value)} sx={{ minWidth: 300 }}>
                          {o.choices!.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                        </TextField>
                        <InfoTip text={o.help} />
                      </Stack>
                    ))}
                  </Stack>
                )}
                <Box sx={{ px: 1, pb: 1 }}>
                  {fields.map((f) => (
                    <AssumptionField key={f.key} label={f.label} help={f.help} unit={f.unit} min={f.min} max={f.max}
                      integer={f.unit === 'month'} a={stream.inputs[f.key]} onChange={(p) => setInput(f.key, p)} />
                  ))}
                </Box>
              </Panel>
            );
          })}
        </Box>
        <Box sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
          <StreamLive stream={stream} results={results} />
        </Box>
      </Box>
    </Box>
  );
}

function StreamLive({ stream, results }: { stream: Stream; results: ReturnType<typeof useStore>['results'] }) {
  const { explain } = useExplain();
  const sr = results.base.streams.find((s) => s.stream.id === stream.id)?.result;
  if (!sr) return null;
  const n = results.base.rows.length;
  const rev = sr.revenue.reduce((a, l) => a + l.values.reduce((x, y) => x + y, 0), 0);
  const dir = sr.direct.reduce((a, l) => a + l.values.reduce((x, y) => x + y, 0), 0);
  const first = sr.revenue.length ? Array.from({ length: n }, (_, i) => sr.revenue.reduce((a, l) => a + l.values[i], 0)).findIndex((v) => v > 0) : -1;
  const metrics = KEY_METRICS[stream.kind]
    .map((k) => ({ k, m: sr.metrics.find((x) => x.key === k.key) }))
    .filter((x) => x.m);
  return (
    <Panel title="Live results" subtitle="Base case, updates as you type.">
      <Stack spacing={1.25}>
        <LiveRow label={`Revenue over ${n} months`} value={money(rev)} />
        <LiveRow label="Gross margin of this stream" value={rev > 0 ? pct((rev - dir) / rev) : '—'} />
        <LiveRow label="First month with revenue" value={first >= 0 ? `Month ${first + 1}` : 'None'} />
        {metrics.map(({ k, m }) => {
          const v = k.at === 'sum' ? m!.values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) : m!.values[n - 1];
          return (
            <LiveRow key={k.key} label={`${m!.label}${k.at === 'sum' ? ' (total)' : ' (end)'}`} value={formatMetric(v, m!.unit)}
              onExplain={() => explain(k.formula, stream.id)} />
          );
        })}
      </Stack>
      {sr.issues.length > 0 && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          {sr.issues.map((i) => (
            <Stack key={i.id} direction="row" spacing={1} alignItems="flex-start">
              <WarningAmber sx={{ fontSize: 18, color: USD.yarrow, mt: 0.2 }} />
              <Typography variant="body2" color="text.secondary">{i.message}</Typography>
            </Stack>
          ))}
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Overall cash: lowest {money(results.base.summary.minCash)} · ending {money(results.base.summary.endingCash)}
      </Typography>
    </Panel>
  );
}

function LiveRow({ label, value, onExplain }: { label: string; value: string; onExplain?: () => void }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Stack direction="row" alignItems="center" spacing={0.25}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
        {onExplain && (
          <Tooltip title="How this is calculated">
            <IconButton size="small" onClick={onExplain} aria-label={`How ${label} is calculated`} sx={{ p: 0.25 }}><FunctionsIcon sx={{ fontSize: 16 }} /></IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
}

type Filter = 'all' | 'weak' | 'example' | 'nobasis';

function RegisterTab() {
  const { project, update, go } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const all = useMemo(() => listAssumptions(project), [project]);
  const sens = useSensitivity();
  const n = project.setup.months;
  const top = useMemo(() => rankSensitivity(sens.rows, 'minCash', n).slice(0, 6), [sens, n]);
  const counts = {
    weak: all.filter((a) => a.conf === 'speculative' || a.conf === 'unset').length,
    example: all.filter((a) => a.example).length,
    nobasis: all.filter((a) => !a.basis.trim()).length,
  };
  const rows = all.filter((a) => filter === 'all' || (filter === 'weak' && (a.conf === 'speculative' || a.conf === 'unset')) || (filter === 'example' && a.example) || (filter === 'nobasis' && !a.basis.trim()));
  const setJ = (path: string, patch: { basis?: string; conf?: Confidence; example?: boolean }) => update((d) => patchJustification(d, path, patch));
  const sectionTab: Record<string, string> = { setup: 'setup', revenue: 'revenue', team: 'team', expenses: 'expenses', funding: 'funding' };

  return (
    <Box>
      <Panel title="Assumptions with the greatest influence" subtitle="Each assumption was moved 20% (or 15 days, or 2 months) in both directions with everything else held at the base case. These move your lowest cash balance the most.">
        <Stack spacing={1}>
          {top.map((r) => (
            <Stack key={r.id} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ py: 0.75, borderBottom: `1px solid ${SURFACE.lineSoft}` }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ConfidenceDot conf={r.assumption?.conf ?? 'unset'} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.label}</Typography>
                <Typography variant="body2" color="text.secondary">{r.group}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">Lowest cash moves by {money(r.swing)}{r.assumption ? ` · ${CONFIDENCE_LABELS[r.assumption.conf]}` : ''}</Typography>
            </Stack>
          ))}
        </Stack>
        <Button sx={{ mt: 1.5 }} onClick={() => go('scenarios', 'sensitivity')}>Open the full sensitivity analysis</Button>
      </Panel>

      <Panel title="Assumption register" subtitle="Every assumption in the model with its value, basis and confidence. Fill in the basis here or next to each input."
        action={<Button variant="outlined" onClick={() => exportRegisterCsv(project)}>Download as CSV</Button>}>
        <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, v) => v && setFilter(v)} sx={{ mb: 2, flexWrap: 'wrap' }}>
          <ToggleButton value="all">All ({all.length})</ToggleButton>
          <ToggleButton value="weak">Speculative or unrated ({counts.weak})</ToggleButton>
          <ToggleButton value="example">Still example values ({counts.example})</ToggleButton>
          <ToggleButton value="nobasis">No basis ({counts.nobasis})</ToggleButton>
        </ToggleButtonGroup>
        <TableContainer sx={{ maxHeight: 640 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: SURFACE.panel, minWidth: 220 }}>Assumption</TableCell>
                <TableCell sx={{ bgcolor: SURFACE.panel }} align="right">Value</TableCell>
                <TableCell sx={{ bgcolor: SURFACE.panel, minWidth: 260 }}>Basis</TableCell>
                <TableCell sx={{ bgcolor: SURFACE.panel, minWidth: 300 }}>Confidence</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.path} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'primary.main' } }} onClick={() => go('assumptions', a.section === 'revenue' ? `revenue-${a.path.split(':')[1]}` : sectionTab[a.section])}>{a.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{a.group}</Typography>
                    {a.example && <Typography variant="caption" sx={{ color: USD.yarrow, display: 'block' }}>Example value</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatUnit(a.value, a.unit)}</TableCell>
                  <TableCell>
                    <TextField value={a.basis} onChange={(e) => setJ(a.path, { basis: e.target.value })} placeholder="Why this value?" fullWidth multiline maxRows={3} inputProps={{ 'aria-label': `Basis for ${a.label}` }} />
                  </TableCell>
                  <TableCell><ConfidencePicker value={a.conf} onChange={(conf) => setJ(a.path, { conf, example: false })} /></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={4}><Typography color="text.secondary" sx={{ py: 2 }}>Nothing matches this filter.</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Team, expense and funding rows share one basis for the whole row.
        </Typography>
      </Panel>
    </Box>
  );
}
