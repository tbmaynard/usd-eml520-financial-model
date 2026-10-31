import { Autocomplete, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useStore } from '../../state/store';
import { getModule } from '../../engine/models';
import { Callout, PageHeader, Panel, Principle } from '../components/common';
import { FundingEditor } from '../components/editors';
import { AssumptionField } from '../components/inputs';

const INDUSTRIES = [
  'Software and information technology', 'Government and public-safety software', 'Health care and medical devices', 'Energy and clean technology',
  'Manufacturing and industrial', 'Consumer products', 'Food and beverage', 'Education', 'Financial services', 'Transportation and logistics',
  'Construction and real estate', 'Media and entertainment', 'Professional and business services', 'Agriculture', 'Aerospace and defense', 'Biotechnology', 'Retail and e-commerce', 'Other',
];

export function SetupPage() {
  const { project, update, go } = useStore();
  const s = project.setup;
  const set = (patch: Partial<typeof s>) => update((d) => { Object.assign(d.setup, patch); });
  const primary = project.streams[0];
  return (
    <Box>
      <PageHeader title="Venture Setup" lead="Start with the basics: what the venture is, when the projection starts, and how much cash it begins with." />
      <Principle />
      <Panel title="About the venture">
        <Stack spacing={2.5} sx={{ maxWidth: 760 }}>
          <TextField label="Venture name" value={s.name} onChange={(e) => set({ name: e.target.value })} required fullWidth />
          <TextField label="Short description" value={s.description} onChange={(e) => set({ description: e.target.value })} multiline minRows={3} fullWidth
            helperText="In two or three sentences: who is the customer, what problem do you solve, and how do you get paid?" inputProps={{ maxLength: 1200 }} />
          <Autocomplete freeSolo options={INDUSTRIES} value={s.industry} onInputChange={(_, v) => set({ industry: v })}
            renderInput={(params) => <TextField {...params} label="Industry" />} sx={{ maxWidth: 420 }} />
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Box>
              <Typography variant="body2" color="text.secondary">Business model</Typography>
              <Typography variant="subtitle1">{getModule(primary.kind).label}{project.streams.length > 1 ? ` + ${project.streams.length - 1} more` : ''}</Typography>
            </Box>
            <Button variant="outlined" onClick={() => go('model')}>Choose or change the business model</Button>
          </Stack>
        </Stack>
      </Panel>

      <Panel title="Projection period">
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <TextField type="month" label="First month of the projection" value={s.startMonth} onChange={(e) => /^\d{4}-\d{2}$/.test(e.target.value) && set({ startMonth: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 240 }} />
          <TextField select label="Length" value={s.months} onChange={(e) => set({ months: Number(e.target.value) })} sx={{ width: 180 }}>
            <MenuItem value={12}>12 months</MenuItem>
            <MenuItem value={24}>24 months</MenuItem>
            <MenuItem value={36}>36 months</MenuItem>
          </TextField>
        </Stack>
      </Panel>

      <Panel title="Starting cash and funding" subtitle="Cash the venture starts with, and money expected to come in later. Funding is not revenue: it is cash you must eventually account for to investors or lenders.">
        <Box sx={{ maxWidth: 900 }}>
          <AssumptionField label="Cash in the bank at the start" unit="usd" min={0} a={s.startingCash} onChange={(p) => update((d) => { Object.assign(d.setup.startingCash, p); })}
            help="Cash the venture already holds on the first day of the projection." />
          <AssumptionField label="Founder investment in month 1" unit="usd" min={0} a={s.founderInvestment} onChange={(p) => update((d) => { Object.assign(d.setup.founderInvestment, p); })}
            help="Money the founders put in at the start, in addition to starting cash." />
          <AssumptionField label="Minimum cash you want to keep on hand" unit="usd" min={0} a={s.minCashCushion} onChange={(p) => update((d) => { Object.assign(d.setup.minCashCushion, p); })}
            help="A safety cushion. Funding required is calculated to keep cash above this amount, not just above zero." />
        </Box>
        <Typography variant="h4" sx={{ mt: 3, mb: 0.5 }}>Other funding</Typography>
        <FundingEditor />
      </Panel>
      <Callout>
        Your work saves automatically in this browser only. Use <b>Download project file</b> in the top bar to keep a copy you can reopen anywhere or submit.
      </Callout>
    </Box>
  );
}
