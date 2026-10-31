import ExpandMore from '@mui/icons-material/ExpandMore';
import WarningAmber from '@mui/icons-material/WarningAmber';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { useState } from 'react';
import { exportProjectionCsv, lineTotal, projectionTable, type TableLine } from '../../export/csv';
import { useStore } from '../../state/store';
import { CashChart, GrossVsOpexChart, RevenueBySourceChart, RevenueExpensesChart } from '../components/charts';
import { Callout, Grid, Kpi, PageHeader, Panel, Principle, SectionTabs, useTab } from '../components/common';
import { allFormulas, FormulaDetail, useExplain } from '../components/explain';
import { money, num, pct } from '../format';
import { SURFACE, USD } from '../theme';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'income', label: 'Income statement' },
  { id: 'cash', label: 'Cash flow' },
  { id: 'metrics', label: 'Business metrics' },
  { id: 'calculations', label: 'Calculations' },
];

export function ProjectionsPage() {
  const tab = useTab(TABS);
  const { project, current, scenario } = useStore();
  const label = project.scenarios[scenario].label;
  return (
    <Box>
      <PageHeader title="Financial Projections" lead={<>Showing the <b>{label}</b>. Every number is calculated from your assumptions; select the <b>ƒ</b> next to a result to see how.</>}>
        <Button variant="outlined" onClick={() => exportProjectionCsv(project, current, label)}>Download projection (CSV)</Button>
      </PageHeader>
      <SectionTabs section="projections" tabs={TABS} />
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'income' && <LinesTable lines={projectionTable(current).slice(0, projectionTable(current).findIndex((l) => l.label === 'CASH FLOW'))} note="Earned basis: revenue when delivered, costs when incurred, regardless of when cash moves." />}
      {tab === 'cash' && <CashTab />}
      {tab === 'metrics' && <MetricsTab />}
      {tab === 'calculations' && <CalculationsTab />}
    </Box>
  );
}

function Dashboard() {
  const { project, current } = useStore();
  const s = current.summary;
  const rows = current.rows;
  const cushion = project.setup.minCashCushion.v;
  const months = s.months;
  return (
    <Box>
      {s.firstNegativeCashMonth != null && (
        <Callout tone="bad" title={s.hiddenShortfall ? `Cash goes negative in month ${s.firstNegativeCashMonth}, even though it ends positive` : `Cash runs out in month ${s.firstNegativeCashMonth} (${rows[s.firstNegativeCashMonth - 1].label})`}>
          The lowest balance is <b>{money(s.minCash)}</b> in month {s.minCashMonth}. {s.hiddenShortfall ? 'A positive ending balance does not show the plan works: the business needs money it would not have in the months before.' : ''} Keeping cash above your {money(cushion)} cushion would take about <b>{money(s.fundingRequired)}</b> more funding, arriving before month {s.firstNegativeCashMonth}.
        </Callout>
      )}
      <Grid min={200}>
        <Kpi label={`Revenue (${months} months)`} value={money(s.totalRevenue, { compact: true })} formula="c.revenue" sub={s.revenueGrowthLast6 != null ? `${s.revenueGrowthLast6 >= 0 ? 'Growing' : 'Shrinking'} ${pct(Math.abs(s.revenueGrowthLast6), 1)} a month (last 3 months vs. 6 months earlier)` : undefined} />
        <Kpi label="Total expenses" value={money(s.totalExpenses, { compact: true })} formula="c.opex" sub={`Direct costs ${money(s.totalDirect, { compact: true })} + operating ${money(s.totalOpex, { compact: true })}`} />
        <Kpi label="Gross margin" value={pct(s.grossMargin)} formula="c.gross" sub="Over the whole projection" />
        <Kpi label="EBITDA (simplified)" value={money(s.totalEbitda, { compact: true })} tone={s.totalEbitda < 0 ? 'bad' : 'good'} formula="c.ebitda" sub="Total over the projection" />
        <Kpi label="Operating profit (loss)" value={money(s.totalOperatingProfit, { compact: true })} tone={s.totalOperatingProfit < 0 ? 'bad' : 'good'} formula="c.operating" sub="After depreciation" />
        <Kpi label="Ending cash" value={money(s.endingCash, { compact: true })} tone={s.endingCash < 0 ? 'bad' : 'neutral'} formula="c.cash" sub={s.hiddenShortfall ? 'Ends positive only after a shortfall' : `End of month ${months}`} />
        <Kpi label="Lowest cash balance" value={money(s.minCash, { compact: true })} tone={s.minCash < 0 ? 'bad' : s.minCash < cushion ? 'warn' : 'neutral'} formula="c.cash" sub={`Month ${s.minCashMonth} (${rows[s.minCashMonth - 1].label})`} />
        <Kpi label="Monthly burn" value={s.currentBurn > 0 ? money(s.currentBurn, { compact: true }) : 'None'} formula="c.burn" sub={s.currentBurn > 0 ? `Average of the last 3 months · peak ${money(s.peakBurn, { compact: true })}` : 'Generating cash at the end'} />
        <Kpi label="Runway" value={s.firstNegativeCashMonth != null ? `${s.runwayMonths} mo` : s.currentBurn > 0 ? `${num(Math.floor(s.endingCash / s.currentBurn))} mo more` : 'Not burning'} tone={s.firstNegativeCashMonth != null ? 'bad' : 'neutral'} formula="c.runway" sub={s.runwayLabel} />
        <Kpi label="Break-even month" value={s.operatingBreakEvenMonth ? `Month ${s.operatingBreakEvenMonth}` : 'Not reached'} formula="c.breakeven" sub={s.operatingBreakEvenMonth ? `Operating profit stays positive from ${rows[s.operatingBreakEvenMonth - 1].label}` : `No sustained operating profit within ${months} months`} />
        <Kpi label="Additional funding required" value={s.fundingRequired > 0 ? money(s.fundingRequired, { compact: true }) : 'None'} tone={s.fundingRequired > 0 ? 'bad' : 'good'} formula="c.funding" sub={`To stay above your ${money(cushion, { compact: true })} cushion`} />
      </Grid>
      <Principle />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5 }}>
        <Panel><RevenueExpensesChart r={current} /></Panel>
        <Panel><CashChart r={current} cushion={cushion} /></Panel>
        <Panel><GrossVsOpexChart r={current} /></Panel>
        <Panel><RevenueBySourceChart r={current} /></Panel>
      </Box>
      {current.issues.length > 0 && (
        <Panel title="Things to look at">
          <Stack spacing={1}>
            {current.issues.map((i) => (
              <Stack key={i.id} direction="row" spacing={1} alignItems="flex-start">
                <WarningAmber sx={{ fontSize: 18, color: USD.yarrow, mt: 0.25 }} aria-label="Warning" />
                <Typography variant="body2">{i.message}</Typography>
              </Stack>
            ))}
          </Stack>
        </Panel>
      )}
      <Typography variant="caption" color="text.secondary">
        Simplified educational projection: not audited financial statements and not tax advice. The full table for each chart is on the Income statement and Cash flow tabs.
      </Typography>
    </Box>
  );
}

const LINE_FORMULA: Record<string, string> = {
  'Total revenue': 'c.revenue', 'Gross profit': 'c.gross', 'Total operating expenses': 'c.opex', Personnel: 'c.personnel', 'EBITDA (simplified)': 'c.ebitda',
  'Operating profit (loss)': 'c.operating', 'Net income': 'c.net', 'Income tax (estimate)': 'c.tax', 'Cash collected from customers': 'c.collections',
  'Ending cash': 'c.cash', 'Money customers still owe': 'c.receivables', 'Deferred revenue': 'c.deferred', 'Monthly burn': 'c.burn',
  'Cash paid for direct costs': 'c.paid', 'Cash paid for operating expenses': 'c.paid', 'Bills not yet paid': 'c.paid',
};

function LinesTable({ lines, note, showTotal = true }: { lines: TableLine[]; note?: string; showTotal?: boolean }) {
  const { current } = useStore();
  const { explain } = useExplain();
  return (
    <Panel pad={false}>
      {note && <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pt: 2 }}>{note}</Typography>}
      <TableContainer sx={{ maxHeight: '70vh' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ position: 'sticky', left: 0, zIndex: 3, bgcolor: SURFACE.panel, minWidth: 260 }}>Line</TableCell>
              {current.rows.map((r) => <TableCell key={r.month} align="right" sx={{ bgcolor: SURFACE.panel, whiteSpace: 'nowrap' }}>M{r.month}<br /><span style={{ color: SURFACE.textFaint }}>{r.label}</span></TableCell>)}
              {showTotal && <TableCell align="right" sx={{ bgcolor: SURFACE.panel }}>Total</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((l, i) => l.section ? (
              <TableRow key={i}><TableCell colSpan={current.rows.length + 2} sx={{ position: 'sticky', left: 0, bgcolor: SURFACE.bg, color: USD.toreroBlue, fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.75rem' }}>{l.label}</TableCell></TableRow>
            ) : (
              <TableRow key={i} hover>
                <TableCell sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: SURFACE.panel, fontWeight: l.bold ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {LINE_FORMULA[l.label.trim()] ? (
                    <Box component="button" type="button" onClick={() => explain(LINE_FORMULA[l.label.trim()])} sx={{ all: 'unset', cursor: 'pointer', borderBottom: `1px dotted ${SURFACE.textFaint}`, '&:hover': { color: 'primary.main' }, '&:focus-visible': { outline: `2px solid ${USD.toreroBlue}` } }}>{l.label}</Box>
                  ) : l.label}
                </TableCell>
                {l.values.map((v, k) => <TableCell key={k} align="right" sx={{ whiteSpace: 'nowrap', fontWeight: l.bold ? 700 : 400, color: v < -0.005 ? USD.poppy : undefined }}>{fmtCell(v, l)}</TableCell>)}
                {showTotal && <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{l.noTotal ? '' : fmtCell(lineTotal(l.values), l)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Panel>
  );
}

function fmtCell(v: number, l: TableLine): string {
  if (!Number.isFinite(v)) return '—';
  if (l.unit === 'pct') return `${v.toFixed(0)}%`;
  if (l.unit === 'count') return num(v, Math.abs(v) < 10 ? 1 : 0);
  return money(v);
}

function CashTab() {
  const { current } = useStore();
  const lines = projectionTable(current);
  const start = lines.findIndex((l) => l.label === 'CASH FLOW');
  const end = lines.findIndex((l) => l.label.startsWith('BUSINESS METRICS'));
  return (
    <Box>
      <Callout title="Why cash is different from profit">
        Customers often pay weeks or months after you deliver, you may pay suppliers later than you use their goods, equipment is paid for up front but expensed slowly, and funding brings in cash that is not revenue. The balances section shows where the difference sits: money customers still owe, prepaid revenue not yet earned, unpaid bills and inventory.
      </Callout>
      <LinesTable lines={lines.slice(start, end < 0 ? undefined : end)} />
    </Box>
  );
}

function MetricsTab() {
  const { current } = useStore();
  const lines = projectionTable(current);
  const start = lines.findIndex((l) => l.label.startsWith('BUSINESS METRICS'));
  return <LinesTable lines={start >= 0 ? lines.slice(start) : []} note="Operating drivers behind the revenue and cost lines. Counts may be fractional where they are averages." />;
}

function CalculationsTab() {
  const { project, current, go } = useStore();
  const { explain } = useExplain();
  const formulas = allFormulas(project);
  const groups: { name: string; items: typeof formulas }[] = [];
  for (const f of formulas) {
    const name = f.streamName ? `${f.streamName}` : 'Shared financial engine';
    let g = groups.find((x) => x.name === name);
    if (!g) { g = { name, items: [] }; groups.push(g); }
    g.items.push(f);
  }
  const [month, setMonth] = useState(Math.min(current.rows.length, 12));
  return (
    <Box>
      <Callout title="Every calculation, in plain language">
        Open any calculation to see its definition, formula, the values used in a month you choose, the assumptions behind it, and its simplifications. Standard definitions are used throughout; where the model simplifies, it says so.
      </Callout>
      {groups.map((g) => (
        <Box key={g.name} sx={{ mb: 3 }}>
          <Typography variant="h3" sx={{ mb: 1 }}>{g.name}</Typography>
          {g.items.map((f) => (
            <Accordion key={`${f.streamId}-${f.doc.id}`} disableGutters sx={{ bgcolor: SURFACE.panel, border: `1px solid ${SURFACE.lineSoft}`, '&:before': { display: 'none' }, mb: 0.75, borderRadius: '8px !important' }} TransitionProps={{ unmountOnExit: true }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack>
                  <Typography sx={{ fontWeight: 600 }}>{f.doc.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{f.doc.expression}</Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <FormulaDetail entry={f} month={month} setMonth={setMonth} formulas={formulas} project={project} result={current} onOpen={explain} onEdit={() => go('assumptions', f.streamId ? `revenue-${f.streamId}` : 'revenue')} />
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ))}
    </Box>
  );
}
