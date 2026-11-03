import AddIcon from '@mui/icons-material/Add';
import CheckCircle from '@mui/icons-material/CheckCircle';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import {
  Box, Button, Card, CardActionArea, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { useState } from 'react';
import { makeStream, suggestOverrides } from '../../data/defaults';
import { getModule, MODEL_ORDER, SALES_START_KEY } from '../../engine/models';
import { SALES_START_FIELD } from '../../engine/models/launch';
import type { ModelKind, Project } from '../../engine/types';
import { useStore } from '../../state/store';
import { Callout, Grid, PageHeader, Panel } from '../components/common';
import { InfoTip, NumberField } from '../components/inputs';
import { SURFACE, USD } from '../theme';

function dropStreamOverrides(d: Project, streamId: string) {
  for (const sc of Object.values(d.scenarios)) {
    for (const k of Object.keys(sc.overrides)) if (k.startsWith(`stream:${streamId}:`)) delete sc.overrides[k];
  }
}

export function ModelPage() {
  const { project, update, go } = useStore();
  const primary = project.streams[0];
  const [pending, setPending] = useState<ModelKind | null>(null);
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState<ModelKind>('services');
  const [newName, setNewName] = useState('');

  const changePrimary = (kind: ModelKind) => {
    update((d) => {
      const old = d.streams[0];
      dropStreamOverrides(d, old.id);
      const s = makeStream(kind);
      d.streams[0] = s;
      // Seed the new stream's scenario drivers.
      Object.assign(d.scenarios.downside.overrides, suggestOverrides({ ...d, streams: [s] }, 'downside'));
      Object.assign(d.scenarios.upside.overrides, suggestOverrides({ ...d, streams: [s] }, 'upside'));
    });
    setPending(null);
  };

  return (
    <Box>
      <PageHeader title="Business Model" lead="How does the venture make money? Different businesses have different economics, so each model below asks for different drivers and calculates revenue and direct costs its own way." />
      <Panel title="Primary business model" subtitle="Choose the one that best describes how most of your revenue will be earned. You can add a second revenue stream below.">
        <Grid min={300}>
          {MODEL_ORDER.map((k) => {
            const m = getModule(k);
            const selected = primary.kind === k;
            return (
              <Card key={k} sx={{ borderColor: selected ? USD.toreroBlue : undefined, borderWidth: selected ? 2 : 1, bgcolor: selected ? SURFACE.raised : undefined }}>
                <CardActionArea onClick={() => !selected && setPending(k)} sx={{ height: '100%', alignItems: 'flex-start' }} aria-pressed={selected}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h3">{m.label}</Typography>
                      {selected && <CheckCircle sx={{ color: USD.toreroBlue }} aria-label="Selected" />}
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1 }}>{m.description}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>For example: {m.examples}</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Grid>
      </Panel>

      <Panel title="Revenue streams in this model" subtitle="Each stream has its own revenue and direct-cost drivers, which you enter on the Assumptions page. Team, operating expenses, funding and taxes are shared across all streams. If you need time for research and development before you can sell, set a later first month of sales."
        action={<Button startIcon={<AddIcon />} variant="outlined" onClick={() => { setAdding(true); setNewName(''); }}>Add a revenue stream</Button>}>
        <Stack spacing={1.5}>
          {project.streams.map((s, i) => (
            <Stack key={s.id} direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ p: 1.5, borderRadius: 2, bgcolor: SURFACE.bg }}>
              <Typography variant="overline" sx={{ width: 90, color: i === 0 ? USD.toreroBlue : 'text.secondary' }}>{i === 0 ? 'Primary' : 'Additional'}</Typography>
              <TextField label="Stream name" value={s.name} onChange={(e) => update((d) => { d.streams[i].name = e.target.value; })} sx={{ width: 260 }} />
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{getModule(s.kind).label}</Typography>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <NumberField label="First month of sales" value={s.inputs[SALES_START_KEY]?.v ?? 1} min={1} max={project.setup.months} integer width={170}
                  onChange={(v) => update((d) => { const a = d.streams[i].inputs[SALES_START_KEY]; if (a) Object.assign(a, { v, example: false }); })} />
                <InfoTip text={SALES_START_FIELD.help} />
              </Stack>
              {i > 0 && (
                <Tooltip title="Remove this stream">
                  <IconButton aria-label={`Remove ${s.name}`} onClick={() => update((d) => { dropStreamOverrides(d, s.id); d.streams = d.streams.filter((x) => x.id !== s.id); })}><DeleteOutline /></IconButton>
                </Tooltip>
              )}
            </Stack>
          ))}
        </Stack>
        {project.streams.length > 1 && (
          <Callout title="How multiple streams combine">
            Revenue, direct costs and cash timing are calculated separately for each stream, then added together. Your team, operating expenses, funding and taxes are entered once and apply to the whole venture. Avoid entering the same cost twice: for example, if a stream has its own salary inputs, leave those people out of the team plan.
          </Callout>
        )}
      </Panel>

      <Dialog open={!!pending} onClose={() => setPending(null)}>
        <DialogTitle>Switch the primary model?</DialogTitle>
        <DialogContent>
          <Typography>
            Switching from <b>{getModule(primary.kind).label}</b> to <b>{pending ? getModule(pending).label : ''}</b> replaces this stream’s revenue drivers with new illustrative examples. Your team, expenses, funding and other streams stay as they are.
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1.5 }}>If you want to keep the current drivers, download a project file first, or add the new model as an additional stream instead.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>Cancel</Button>
          <Button onClick={() => { if (pending) { update((d) => { const s = makeStream(pending); d.streams.push(s); }); setPending(null); } }}>Add as another stream</Button>
          <Button variant="contained" onClick={() => pending && changePrimary(pending)}>Switch model</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={adding} onClose={() => setAdding(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add a revenue stream</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Business model for this stream" value={newKind} onChange={(e) => setNewKind(e.target.value as ModelKind)}>
              {MODEL_ORDER.map((k) => <MenuItem key={k} value={k}>{getModule(k).label}</MenuItem>)}
            </TextField>
            <Typography variant="body2" color="text.secondary">{getModule(newKind).description}</Typography>
            <TextField label="Stream name" placeholder={getModule(newKind).short} value={newName} onChange={(e) => setNewName(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdding(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => {
            const s = makeStream(newKind, newName.trim() || getModule(newKind).short);
            update((d) => {
              d.streams.push(s);
              Object.assign(d.scenarios.downside.overrides, suggestOverrides({ ...d, streams: [s] }, 'downside'));
              Object.assign(d.scenarios.upside.overrides, suggestOverrides({ ...d, streams: [s] }, 'upside'));
            });
            setAdding(false);
            go('assumptions', `revenue-${s.id}`);
          }}>Add stream</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
