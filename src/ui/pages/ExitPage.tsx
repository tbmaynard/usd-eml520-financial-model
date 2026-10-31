import AddIcon from '@mui/icons-material/Add';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import {
  Box, Button, Card, CardContent, FormControlLabel, IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { uid } from '../../data/defaults';
import { buildCapTable, EXIT_KINDS, evaluateAll, MULTIPLES, priceNeeded, type ExitKind, type ExitOutcome, type ExitSettings } from '../../engine/exit';
import { getModule } from '../../engine/models';
import { useStore } from '../../state/store';
import { Callout, Grid, Kpi, PageHeader, Panel, SectionTabs, useTab } from '../components/common';
import { InfoTip, NumberField } from '../components/inputs';
import { money, pct } from '../format';
import { CHART, FONT_STAT, SURFACE, USD } from '../theme';

const TABS = [
  { id: 'offers', label: 'Exit offers' },
  { id: 'captable', label: 'Cap table' },
  { id: 'target', label: 'What would it take?' },
];

function useExit() {
  const { project, update, results } = useStore();
  const set = (fn: (e: ExitSettings) => void) => update((d) => fn(d.exit));
  const calc = useMemo(() => evaluateAll(project, results.base), [project, results.base]);
  return { s: project.exit, set, calc, project };
}

export function ExitPage() {
  const tab = useTab(TABS);
  return (
    <Box>
      <PageHeader title="Exit Strategy" lead="The fun part. If someone bought your company one day, what would you actually walk away with? Explore different kinds of exits and see how ownership, investor terms, deal structure and taxes change the answer." />
      <Callout tone="warn" title="Bonus: not graded">
        Everything here is illustrative and simplified: not financial, legal or tax advice. Taxes assume a founder living in California. Valuations come from multiples you choose, not from the market.
      </Callout>
      <SectionTabs section="exit" tabs={TABS} />
      {tab === 'offers' && <Offers />}
      {tab === 'captable' && <CapTableTab />}
      {tab === 'target' && <Target />}
    </Box>
  );
}

function FocusSelect() {
  const { s, set } = useExit();
  return (
    <TextField select label="Whose take-home?" value={s.founders.some((f) => f.id === s.focus) ? s.focus : 'all'} onChange={(e) => set((x) => { x.focus = e.target.value; })} sx={{ width: 260 }}>
      <MenuItem value="all">All founders combined</MenuItem>
      {s.founders.map((f) => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
    </TextField>
  );
}

function Offers() {
  const { s, set, calc, project } = useExit();
  const kind = project.streams[0].kind;
  const cCorp = project.tax.entity === 'c_corp';
  const { base, outcomes } = calc;
  const best = outcomes.reduce((a, o) => (o.founder.net > a.founder.net ? o : a), outcomes[0]);
  return (
    <Box>
      <Panel title="The company at exit" subtitle={`Starts from your base case: revenue at the end of the projection, running at ${money(base.runRateRevenue)} a year, grown forward to the exit year.`}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="flex-start">
          <NumberField label="Exit year (from start)" value={s.exitYear} min={1} max={15} integer width={170} onChange={(v) => set((x) => { x.exitYear = v; })} />
          <NumberField label="Revenue growth per year after the projection" unit="pct" value={s.growthPct} min={-50} max={300} width={250} onChange={(v) => set((x) => { x.growthPct = v; })} />
          <NumberField label="EBITDA margin at exit" unit="pct" value={s.exitMarginPct} min={-100} max={80} width={180} onChange={(v) => set((x) => { x.exitMarginPct = v; })} />
          <NumberField label="Cash minus debt at exit" unit="usd" value={s.netCashAtExit} width={200} onChange={(v) => set((x) => { x.netCashAtExit = v; })} />
          <FocusSelect />
        </Stack>
        <Grid min={200} gap={1.5}>
          <Box sx={{ mt: 2 }}><Typography variant="caption" color="text.secondary">Revenue in year {s.exitYear}</Typography><Typography sx={{ fontFamily: FONT_STAT, fontSize: '1.6rem', fontWeight: 600 }}>{money(base.exitRevenue, { compact: true })}</Typography></Box>
          <Box sx={{ mt: 2 }}><Typography variant="caption" color="text.secondary">EBITDA in year {s.exitYear}</Typography><Typography sx={{ fontFamily: FONT_STAT, fontSize: '1.6rem', fontWeight: 600 }}>{money(base.exitEbitda, { compact: true })}</Typography></Box>
          <Box sx={{ mt: 2 }}><Typography variant="caption" color="text.secondary">Best expected take-home</Typography><Typography sx={{ fontFamily: FONT_STAT, fontSize: '1.6rem', fontWeight: 600, color: USD.sagebrush }}>{money(best.founder.net, { compact: true })} · {best.title}</Typography></Box>
        </Grid>
      </Panel>

      <Panel title="Take-home by exit" subtitle="Expected amount after deal terms and taxes, for the founder(s) selected above. Stock and second-bite values are not cash yet.">
        <Box sx={{ height: 260 }} role="img" aria-label="Take-home by exit">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={outcomes.map((o) => ({ name: o.title, cash: Math.max(0, o.founder.cashAtClose + o.founder.cashLater + o.founder.retention - o.founder.tax), paper: o.founder.stock + o.founder.rolloverFuture }))} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickLine={false} />
              <YAxis stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickFormatter={(v: number) => money(v, { compact: true })} width={64} />
              <RTooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: number) => money(v)} contentStyle={{ background: SURFACE.raised, border: `1px solid ${SURFACE.line}`, borderRadius: 8 }} labelStyle={{ color: SURFACE.textMuted }} />
              <Legend wrapperStyle={{ fontSize: 12, color: SURFACE.textMuted }} />
              <Bar isAnimationActive={false} dataKey="cash" name="Cash after tax" stackId="a" fill={CHART.series[0]} stroke={SURFACE.panel} />
              <Bar isAnimationActive={false} dataKey="paper" name="Stock and rollover (not cash yet)" stackId="a" fill={CHART.series[1]} stroke={SURFACE.panel} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Panel>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2.5 }}>
        {EXIT_KINDS.map((k) => <OfferCard key={k} kind={k} o={outcomes.find((o) => o.kind === k)!} modelKind={kind} />)}
      </Box>

      <Panel title="Fees and taxes">
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
          <NumberField label="Banker and legal fees" unit="pct" value={s.feesPct} min={0} max={15} width={180} onChange={(v) => set((x) => { x.feesPct = v; })} />
          <NumberField label="Federal capital gains" unit="pct" value={s.capGainsFedPct} min={0} max={50} width={170} onChange={(v) => set((x) => { x.capGainsFedPct = v; })} />
          <NumberField label="California capital gains" unit="pct" value={s.capGainsStatePct} min={0} max={20} width={180} onChange={(v) => set((x) => { x.capGainsStatePct = v; })} />
          <NumberField label="Income tax (retention, payouts)" unit="pct" value={s.ordinaryRatePct} min={0} max={70} width={220} onChange={(v) => set((x) => { x.ordinaryRatePct = v; })} />
          <FormControlLabel disabled={!cCorp} control={<Switch checked={s.qsbs && cCorp} onChange={(e) => set((x) => { x.qsbs = e.target.checked; })} />} label="Qualified small business stock (QSBS)" />
          <InfoTip text="Federal Section 1202: founders of a qualifying C corporation can exclude gain on stock held long enough. For stock issued after July 4, 2025: 50% excluded after 3 years, 75% after 4, 100% after 5, up to $15 million per person. California does not follow QSBS, so state tax still applies. Only C corporations qualify." />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Defaults: federal 23.8% (20% long-term capital gains plus 3.8% net investment income tax) and California 13.3% (top bracket, which taxes capital gains as ordinary income). {cCorp ? '' : 'Your venture is set up as a pass-through entity in Funding and taxes, so QSBS does not apply.'}
        </Typography>
      </Panel>
    </Box>
  );
}

const PARAMS: Record<ExitKind, { key: string; label: string; unit: 'pct' | 'usd' | 'ratio' | 'count'; help: string; max?: number }[]> = {
  strategic: [
    { key: 'multiple', label: 'Revenue multiple', unit: 'ratio', help: 'Price as a multiple of exit-year revenue.' },
    { key: 'cashPct', label: 'Paid in cash (rest in buyer stock)', unit: 'pct', help: 'Large buyers often pay partly in their own shares.', max: 100 },
    { key: 'escrowPct', label: 'Held in escrow', unit: 'pct', help: 'Share of the upfront price held back to cover claims, usually released after 12 to 18 months.', max: 50 },
    { key: 'earnoutPct', label: 'Earn-out share of the price', unit: 'pct', help: 'Paid later only if the business hits agreed targets.', max: 80 },
    { key: 'earnoutProbPct', label: 'Chance the earn-out is paid', unit: 'pct', help: 'Many earn-outs pay only partly or not at all.', max: 100 },
  ],
  pe: [
    { key: 'multiple', label: 'EBITDA multiple', unit: 'ratio', help: 'Private equity firms usually price on profit (EBITDA), not revenue.' },
    { key: 'rolloverPct', label: 'Rolled into the new company', unit: 'pct', help: 'Founders often reinvest part of their proceeds alongside the fund.', max: 100 },
    { key: 'secondBiteMultiple', label: 'Second-bite multiple', unit: 'ratio', help: 'What the rolled-over stake might be worth when the fund sells, typically 3 to 7 years later.' },
  ],
  ipo: [
    { key: 'multiple', label: 'Revenue multiple (market value)', unit: 'ratio', help: 'Public market value as a multiple of revenue.' },
    { key: 'sellAtIpoPct', label: 'Founder shares sold at the IPO', unit: 'pct', help: 'Founders usually sell little at the IPO itself.', max: 100 },
    { key: 'underwritingPct', label: 'Underwriting discount', unit: 'pct', help: 'Banks typically take about 7% of shares sold in a mid-size US IPO.', max: 15 },
    { key: 'afterLockupChangePct', label: 'Share price change by end of lock-up', unit: 'pct', help: 'Founder shares are locked up for months. Try negative numbers.' },
  ],
  acquihire: [
    { key: 'price', label: 'Purchase price', unit: 'usd', help: 'Acqui-hires are usually small: the buyer wants the people.' },
    { key: 'retentionPerFounder', label: 'Retention package per founder', unit: 'usd', help: 'Paid over two to four years of employment, taxed as income.' },
  ],
  lifestyle: [
    { key: 'payoutPct', label: 'Profit paid out each year', unit: 'pct', help: 'Share of exit-year EBITDA paid to owners annually instead of reinvested.', max: 100 },
    { key: 'years', label: 'Years', unit: 'count', help: 'How many years of payouts to count.' },
  ],
};

function OfferCard({ kind, o, modelKind }: { kind: ExitKind; o: ExitOutcome; modelKind: keyof typeof MULTIPLES }) {
  const { s, set } = useExit();
  const params = s[kind] as Record<string, number>;
  const range = kind === 'pe' ? MULTIPLES[modelKind].ebitda : MULTIPLES[modelKind].revenue;
  const f = o.founder;
  const maxAbs = Math.max(1, ...o.steps.map((x) => Math.abs(x.value)));
  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
          <Typography variant="h3">{o.title}</Typography>
          <Typography sx={{ fontFamily: FONT_STAT, fontSize: '1.7rem', fontWeight: 600, color: f.net > 0 ? USD.sagebrush : SURFACE.textMuted }}>{money(f.net, { compact: true })}</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">Expected take-home{o.enterpriseValue ? ` · headline price ${money(o.enterpriseValue, { compact: true })}` : ''}</Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          {PARAMS[kind].map((p) => (
            <Tooltip key={p.key} title={p.help} placement="top">
              <Box>
                <NumberField label={p.label} value={params[p.key]} unit={p.unit === 'ratio' ? undefined : p.unit === 'count' ? undefined : p.unit} min={p.unit === 'pct' && p.key !== 'afterLockupChangePct' ? 0 : p.key === 'afterLockupChangePct' ? -100 : 0} max={p.max}
                  width={p.label.length > 26 ? 230 : 190} onChange={(v) => set((x) => { (x[kind] as Record<string, number>)[p.key] = v; })} />
              </Box>
            </Tooltip>
          ))}
        </Stack>
        {(kind === 'strategic' || kind === 'pe' || kind === 'ipo') && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Illustrative range for {getModule(modelKind).short.toLowerCase()} businesses: {range[0]}× (low) · {range[1]}× (typical) · {range[2]}× (high). Real multiples swing widely with growth, margins and markets.
          </Typography>
        )}

        <Box sx={{ mt: 2 }}>
          {o.steps.map((st, i) => (
            <Stack key={i} direction="row" alignItems="center" spacing={1.5} sx={{ py: 0.4 }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 230, flexShrink: 0 }}>{st.label}</Typography>
              <Box sx={{ flex: 1, height: 10, position: 'relative' }}>
                <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(Math.abs(st.value) / maxAbs) * 100}%`, bgcolor: st.value >= 0 ? CHART.series[0] : CHART.series[1], borderRadius: 1, minWidth: st.value ? 2 : 0 }} />
              </Box>
              <Typography variant="body2" sx={{ width: 96, textAlign: 'right', flexShrink: 0 }}>{st.value >= 0 ? '' : '−'}{money(Math.abs(st.value), { compact: true })}</Typography>
            </Stack>
          ))}
        </Box>

        <Table size="small" sx={{ mt: 1.5 }}>
          <TableBody>
            {[
              ['Founder share at the headline price (gross)', f.gross],
              ['Cash at closing', f.cashAtClose],
              ['Cash later (escrow, earn-out, payouts)', f.cashLater],
              ['Retention pay', f.retention],
              ['Stock (taxed when sold)', f.stock],
              ['Rollover value at second bite', f.rolloverFuture],
              ['Taxes', -f.tax],
            ].filter(([, v]) => Math.abs(v as number) > 0.5).map(([label, v]) => (
              <TableRow key={label as string}><TableCell sx={{ color: 'text.secondary', pl: 0 }}>{label}</TableCell><TableCell align="right" sx={{ pr: 0 }}>{money(v as number)}</TableCell></TableRow>
            ))}
            <TableRow><TableCell sx={{ pl: 0, fontWeight: 700, borderBottom: 'none' }}>Expected take-home</TableCell><TableCell align="right" sx={{ pr: 0, fontWeight: 700, borderBottom: 'none' }}>{money(f.net)}</TableCell></TableRow>
          </TableBody>
        </Table>
        {o.notes.map((n, i) => <Typography key={i} variant="body2" color="text.secondary" sx={{ mt: 1 }}>{n}</Typography>)}
      </CardContent>
    </Card>
  );
}

function CapTableTab() {
  const { s, set, calc } = useExit();
  const { cap } = calc;
  const foundersPct = s.founders.reduce((a, f) => a + f.pct, 0);
  return (
    <Box>
      <Panel title="Founders" subtitle="How the founders split their shares at the start. The percentages are of founder shares and should add to 100.">
        {s.founders.map((f, i) => (
          <Stack key={f.id} direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <TextField label="Name" value={f.name} onChange={(e) => set((x) => { x.founders[i].name = e.target.value; })} sx={{ width: 280 }} />
            <NumberField label="Share of founder stock" unit="pct" value={f.pct} min={0} max={100} width={200} onChange={(v) => set((x) => { x.founders[i].pct = v; })} />
            <IconButton aria-label={`Remove ${f.name}`} disabled={s.founders.length <= 1} onClick={() => set((x) => { x.founders.splice(i, 1); })}><DeleteOutline /></IconButton>
          </Stack>
        ))}
        {Math.abs(foundersPct - 100) > 0.01 && <Typography variant="body2" sx={{ color: USD.yarrow }}>Founder shares add to {foundersPct}%. The model scales them to 100%.</Typography>}
        <Button startIcon={<AddIcon />} onClick={() => set((x) => { x.founders.push({ id: uid('f'), name: `Founder ${x.founders.length + 1}`, pct: 0 }); })}>Add a founder</Button>
        <Stack direction="row" spacing={1.5} sx={{ mt: 2 }} alignItems="center">
          <NumberField label="Employee option pool" unit="pct" value={s.poolPct} min={0} max={50} width={200} onChange={(v) => set((x) => { x.poolPct = v; })} />
          <InfoTip text="Shares set aside for employees. Investors usually require a pool of 10% to 20%, created before their money comes in, so it dilutes the founders." />
        </Stack>
      </Panel>

      <Panel title="Funding rounds" subtitle="In order. A SAFE converts into shares at the next priced round (or at exit) at its valuation cap. A priced round sells new shares at a pre-money valuation.">
        {s.rounds.map((r, i) => (
          <Stack key={r.id} direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1.25 }}>
            <TextField label="Round" value={r.name} onChange={(e) => set((x) => { x.rounds[i].name = e.target.value; })} sx={{ width: 220 }} />
            <TextField select label="Type" value={r.kind} onChange={(e) => set((x) => { x.rounds[i].kind = e.target.value as 'safe' | 'priced'; })} sx={{ width: 170 }}>
              <MenuItem value="safe">SAFE (post-money cap)</MenuItem>
              <MenuItem value="priced">Priced round</MenuItem>
            </TextField>
            <NumberField label="Amount raised" unit="usd" value={r.amount} min={0} width={170} onChange={(v) => set((x) => { x.rounds[i].amount = v; })} />
            <NumberField label={r.kind === 'safe' ? 'Valuation cap (post-money)' : 'Pre-money valuation'} unit="usd" value={r.valuation} min={0} width={220} onChange={(v) => set((x) => { x.rounds[i].valuation = v; })} />
            <IconButton aria-label={`Remove ${r.name}`} onClick={() => set((x) => { x.rounds.splice(i, 1); })}><DeleteOutline /></IconButton>
          </Stack>
        ))}
        <Button startIcon={<AddIcon />} onClick={() => set((x) => { x.rounds.push({ id: uid('r'), name: x.rounds.length ? 'Series A' : 'Seed round', kind: 'priced', amount: 2_000_000, valuation: 8_000_000 }); })}>Add a round</Button>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          <NumberField label="Liquidation preference" value={s.prefMultiple} min={0} max={3} width={190} onChange={(v) => set((x) => { x.prefMultiple = v; })} />
          <FormControlLabel control={<Switch checked={s.participating} onChange={(e) => set((x) => { x.participating = e.target.checked; })} />} label="Participating preferred" />
          <InfoTip text="A 1× preference means investors get their money back first in a sale. Non-participating (the most common) investors choose either that or their ownership share, whichever is larger. Participating investors get both: their money back, then their share of what is left." />
        </Stack>
      </Panel>

      <Panel title="Ownership after each round">
        <Box sx={{ height: 240 }} role="img" aria-label="Ownership after each round">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cap.steps.map((st) => ({ name: st.label, founders: st.founderPct * 100, investors: st.investorPct * 100, pool: st.poolPct * 100 }))} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickLine={false} />
              <YAxis stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} width={44} />
              <RTooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ background: SURFACE.raised, border: `1px solid ${SURFACE.line}`, borderRadius: 8 }} labelStyle={{ color: SURFACE.textMuted }} />
              <Legend wrapperStyle={{ fontSize: 12, color: SURFACE.textMuted }} />
              <Bar isAnimationActive={false} dataKey="founders" name="Founders" stackId="o" fill={CHART.series[0]} stroke={SURFACE.panel} />
              <Bar isAnimationActive={false} dataKey="investors" name="Investors" stackId="o" fill={CHART.series[1]} stroke={SURFACE.panel} />
              <Bar isAnimationActive={false} dataKey="pool" name="Option pool" stackId="o" fill={CHART.series[2]} stroke={SURFACE.panel} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Panel>

      <Panel title="Fully diluted cap table at exit" pad={false}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Holder</TableCell><TableCell align="right">Shares</TableCell><TableCell align="right">Ownership</TableCell><TableCell align="right">Invested</TableCell><TableCell align="right">Preference</TableCell></TableRow></TableHead>
          <TableBody>
            {cap.holders.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{h.name}</TableCell>
                <TableCell align="right">{Math.round(h.shares).toLocaleString('en-US')}</TableCell>
                <TableCell align="right">{pct(h.shares / cap.totalShares, 1)}</TableCell>
                <TableCell align="right">{h.invested ? money(h.invested) : ''}</TableCell>
                <TableCell align="right">{h.pref ? money(h.pref) : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </Box>
  );
}

function Target() {
  const { s, calc, project } = useExit();
  const [target, setTarget] = useState(5_000_000);
  const cCorp = project.tax.entity === 'c_corp';
  const cap = useMemo(() => buildCapTable(s), [s]);
  const price = useMemo(() => priceNeeded(target, s, cap, cCorp), [target, s, cap, cCorp]);
  const rev = calc.base.exitRevenue;
  const mult = MULTIPLES[project.streams[0].kind].revenue[1];
  const who = s.focus === 'all' || !s.founders.some((f) => f.id === s.focus) ? 'all founders combined' : s.founders.find((f) => f.id === s.focus)!.name;
  return (
    <Box>
      <Panel title="Work backwards from the number you want" subtitle="Assumes an all-cash strategic sale with your cap table, preferences, fees and taxes.">
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <NumberField label="Take-home after tax" unit="usd" value={target} min={0} width={220} onChange={setTarget} />
          <FocusSelect />
        </Stack>
      </Panel>
      {price != null && (
        <Grid min={240}>
          <Kpi label={`Sale price needed (${who})`} value={money(price, { compact: true })} sub="Enterprise value, all cash" />
          <Kpi label={`Revenue multiple needed in year ${s.exitYear}`} value={rev > 0 ? `${(price / rev).toFixed(1)}×` : 'No revenue'} sub={`On ${money(rev, { compact: true })} of exit-year revenue`} />
          <Kpi label={`Revenue needed at a ${mult}× multiple`} value={money(price / mult, { compact: true })} sub={`A typical multiple for a ${getModule(project.streams[0].kind).short.toLowerCase()} business (illustrative)`} />
          <Kpi label="Compared with your projection" value={rev > 0 ? `${(price / mult / rev).toFixed(1)}×` : '—'} sub="Revenue needed ÷ your exit-year revenue" tone={rev > 0 && price / mult > rev ? 'warn' : 'good'} />
        </Grid>
      )}
      <Typography className="prose" sx={{ mt: 3 }}>
        Try raising the option pool, adding a round, or turning on participating preferred in the cap table, and watch the price you need go up. That gap between the headline price and what founders keep is the point of this page.
      </Typography>
    </Box>
  );
}
