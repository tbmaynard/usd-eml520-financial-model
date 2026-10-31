import PrintIcon from '@mui/icons-material/Print';
import HelpOutline from '@mui/icons-material/HelpOutline';
import { Box, Button, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useMemo } from 'react';
import { getModule } from '../../engine/models';
import { listAssumptions } from '../../engine/paths';
import { reviewModel, type ReviewPrompt } from '../../engine/review';
import { rankSensitivity } from '../../engine/sensitivity';
import type { ScenarioId } from '../../engine/types';
import { CONFIDENCE_LABELS } from '../../engine/types';
import { exportExcel } from '../../export/excel';
import { useStore } from '../../state/store';
import { CashChart } from '../components/charts';
import { Callout, PageHeader, Panel, PRINCIPLE, SectionTabs, useTab } from '../components/common';
import { ConfidenceDot } from '../components/inputs';
import { formatUnit, money, pct } from '../format';
import { useSensitivity } from '../streamMetrics';
import { SURFACE, USD } from '../theme';

const TABS = [
  { id: 'prompts', label: 'Review prompts' },
  { id: 'summary', label: 'One-page summary (instructor view)' },
];

const AREA_LABEL: Record<ReviewPrompt['area'], string> = { cash: 'Cash', revenue: 'Revenue', costs: 'Costs', assumptions: 'Assumptions', scenarios: 'Scenarios', capacity: 'Capacity' };

export function useReview() {
  const { project, results } = useStore();
  const sens = useSensitivity();
  return useMemo(() => reviewModel(project, results, sens.rows), [project, results, sens]);
}

export function ReviewPage() {
  const tab = useTab(TABS);
  return (
    <Box>
      <PageHeader title="Model Review" lead="Questions worth asking about your model. These are prompts, not verdicts: the tool cannot tell whether a business is good, only where its assumptions deserve a closer look." />
      <Box className="no-print"><SectionTabs section="review" tabs={TABS} /></Box>
      {tab === 'prompts' && <Prompts />}
      {tab === 'summary' && <InstructorSummary />}
    </Box>
  );
}

function Prompts() {
  const { project, update, go } = useStore();
  const prompts = useReview();
  const answered = prompts.filter((p) => (project.reviewResponses[p.id] ?? '').trim()).length;
  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{prompts.length} prompts · {answered} answered. Your answers are saved with the project and appear on the instructor summary.</Typography>
      <Stack spacing={2}>
        {prompts.map((p) => (
          <Card key={p.id}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <HelpOutline sx={{ color: USD.toreroBlue, mt: 0.25 }} />
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="h4">{p.title}</Typography>
                    <Chip size="small" label={AREA_LABEL[p.area]} variant="outlined" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{p.detail}</Typography>
                  <Typography className="prose" sx={{ mt: 1, color: 'text.primary' }}>{p.question}</Typography>
                  <TextField sx={{ mt: 1.5 }} fullWidth multiline minRows={2} placeholder="Your response" value={project.reviewResponses[p.id] ?? ''}
                    onChange={(e) => update((d) => { d.reviewResponses[p.id] = e.target.value; })} inputProps={{ 'aria-label': `Response to: ${p.title}`, maxLength: 2000 }} />
                  <Button size="small" sx={{ mt: 1 }} onClick={() => go(p.link, p.link === 'assumptions' ? 'revenue' : undefined)}>Go to the related section</Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {prompts.length === 0 && <Typography color="text.secondary">No prompts right now.</Typography>}
      </Stack>
      <Panel title="Reflection: what must be true?" subtitle={PRINCIPLE}>
        <TextField fullWidth multiline minRows={4} value={project.reflection} onChange={(e) => update((d) => { d.reflection = e.target.value; })}
          placeholder="In a few sentences: which three things must be true for this venture to work, and how will you test them?" inputProps={{ maxLength: 4000 }} />
      </Panel>
    </Box>
  );
}

export function InstructorSummary() {
  const { project, results } = useStore();
  const prompts = useReview();
  const sens = useSensitivity();
  const all = listAssumptions(project);
  const n = project.setup.months;
  const top = rankSensitivity(sens.rows, 'minCash', n).slice(0, 5);
  const ids: ScenarioId[] = ['downside', 'base', 'upside'];
  const confCount = (c: string) => all.filter((a) => a.conf === c).length;
  const s = results.base.summary;
  return (
    <Box className="print-area">
      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mb: 2 }} className="no-print">
        <Button variant="outlined" onClick={() => exportExcel(project, results)}>Download Excel workbook</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print or save as PDF</Button>
      </Stack>
      <Callout>
        This page summarizes every input and decision on one screen, so an instructor can review the model without opening each tab. The Excel workbook opens on the same summary.
      </Callout>
      <Panel>
        <Typography variant="overline" color="text.secondary">Venture financial model · {new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</Typography>
        <Typography variant="h2">{project.setup.name || 'Untitled venture'}</Typography>
        <Typography variant="body2" color="text.secondary">{project.setup.industry || 'Industry not given'} · {project.streams.map((x) => `${x.name} (${getModule(x.kind).label})`).join(' + ')}</Typography>
        <Typography sx={{ mt: 1.5 }}>{project.setup.description || <i style={{ color: SURFACE.textMuted }}>No description given.</i>}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {n}-month projection from {project.setup.startMonth} · starting cash {money(project.setup.startingCash.v)} · founder investment {money(project.setup.founderInvestment.v)} · outside funding {money(project.funding.reduce((x, f) => x + f.amount, 0))} · tax {project.tax.enabled ? `${project.tax.rate.v}% (${project.tax.entity === 'c_corp' ? 'C corporation' : 'pass-through'})` : 'not modeled'}
        </Typography>
      </Panel>

      <Panel title="Results by scenario" pad={false}>
        <Table size="small">
          <TableHead><TableRow><TableCell /> {ids.map((id) => <TableCell key={id} align="right" sx={{ fontWeight: 700 }}>{project.scenarios[id].label}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {[
              ['Total revenue', (x: typeof s) => money(x.totalRevenue)],
              ['Gross margin', (x: typeof s) => pct(x.grossMargin)],
              ['Operating profit (loss)', (x: typeof s) => money(x.totalOperatingProfit)],
              ['Ending cash', (x: typeof s) => money(x.endingCash)],
              ['Lowest cash (month)', (x: typeof s) => `${money(x.minCash)} (M${x.minCashMonth})`],
              ['Cash runs out', (x: typeof s) => (x.firstNegativeCashMonth ? `Month ${x.firstNegativeCashMonth}` : 'No')],
              ['Break-even month', (x: typeof s) => (x.operatingBreakEvenMonth ? `Month ${x.operatingBreakEvenMonth}` : 'Not reached')],
              ['Funding required', (x: typeof s) => money(x.fundingRequired)],
            ].map(([label, f]) => (
              <TableRow key={label as string}>
                <TableCell sx={{ color: 'text.secondary' }}>{label as string}</TableCell>
                {ids.map((id) => <TableCell key={id} align="right">{(f as (x: typeof s) => string)(results[id].summary)}</TableCell>)}
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ color: 'text.secondary' }}>What the scenario represents</TableCell>
              {ids.map((id) => <TableCell key={id} align="right" sx={{ fontSize: '0.8rem', color: 'text.secondary', maxWidth: 220 }}>{id === 'base' ? 'Inputs as entered' : project.scenarios[id].notes || '(not explained)'}</TableCell>)}
            </TableRow>
          </TableBody>
        </Table>
      </Panel>

      <Panel><CashChart r={results.base} cushion={project.setup.minCashCushion.v} /></Panel>

      <Panel title="Quality of support for the assumptions">
        <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
          {(['evidence', 'benchmark', 'speculative', 'unset'] as const).map((c) => (
            <Stack key={c} direction="row" spacing={1} alignItems="center"><ConfidenceDot conf={c} /><Typography variant="body2">{CONFIDENCE_LABELS[c]}: <b>{confCount(c)}</b></Typography></Stack>
          ))}
          <Typography variant="body2">Still example values: <b>{all.filter((a) => a.example).length}</b></Typography>
          <Typography variant="body2">Without a basis: <b>{all.filter((a) => !a.basis.trim()).length}</b></Typography>
        </Stack>
        <Typography variant="h4" sx={{ mt: 2, mb: 0.5 }}>Most influential assumptions (effect on lowest cash)</Typography>
        {top.map((r) => (
          <Typography key={r.id} variant="body2">· {r.label}: lowest cash moves {money(r.swing)} · {r.assumption ? CONFIDENCE_LABELS[r.assumption.conf] : 'cross-cutting'}{r.assumption?.basis ? ` · “${r.assumption.basis}”` : ''}</Typography>
        ))}
      </Panel>

      <Panel title="Assumptions and their basis" pad={false}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Assumption</TableCell><TableCell align="right">Value</TableCell><TableCell>Confidence</TableCell><TableCell>Basis</TableCell></TableRow></TableHead>
          <TableBody>
            {all.map((a) => (
              <TableRow key={a.path}>
                <TableCell><Typography variant="body2">{a.label}</Typography><Typography variant="caption" color="text.secondary">{a.group}</Typography></TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatUnit(a.value, a.unit)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}><ConfidenceDot conf={a.conf} withLabel />{a.example && <Typography variant="caption" sx={{ color: USD.yarrow }}>example</Typography>}</TableCell>
                <TableCell sx={{ color: a.basis ? 'text.primary' : 'text.secondary', fontStyle: a.basis ? 'normal' : 'italic' }}>{a.basis || 'none given'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      <Panel title="Review prompts and the student’s responses">
        <Stack spacing={1.5}>
          {prompts.map((p) => (
            <Box key={p.id}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.title}</Typography>
              <Typography variant="body2" color="text.secondary">{p.question}</Typography>
              <Typography variant="body2" sx={{ mt: 0.25, pl: 1.5, borderLeft: `2px solid ${SURFACE.line}`, fontStyle: project.reviewResponses[p.id] ? 'normal' : 'italic', color: project.reviewResponses[p.id] ? 'text.primary' : 'text.secondary' }}>
                {project.reviewResponses[p.id] || 'No response'}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Panel>
      <Panel title="Reflection: what must be true?">
        <Typography sx={{ whiteSpace: 'pre-wrap', fontStyle: project.reflection ? 'normal' : 'italic', color: project.reflection ? 'text.primary' : 'text.secondary' }}>{project.reflection || 'No reflection written.'}</Typography>
      </Panel>
      <Typography variant="caption" color="text.secondary">Simplified educational projection. Not audited financial statements or tax advice.</Typography>
    </Box>
  );
}
