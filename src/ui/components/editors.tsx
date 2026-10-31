import AddIcon from '@mui/icons-material/Add';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { Box, Button, Collapse, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';
import { uid } from '../../data/defaults';
import type { CapexItem, Expense, Funding, Justified, Project, Role } from '../../engine/types';
import { OPEX_LABELS } from '../../engine/types';
import { useStore } from '../../state/store';
import { money } from '../format';
import { SURFACE, USD } from '../theme';
import { AssumptionField, ConfidenceDot, InfoTip, JustifyFields, NumberField } from './inputs';

type Patch<T> = (patch: Partial<T>) => void;

/** One editable row with a details area for basis/confidence. */
function RowShell({ head, details, onRemove, item, removeLabel, onJustify }: { head: ReactNode; details?: ReactNode; onRemove: () => void; item: Justified; removeLabel: string; onJustify: (p: Partial<Justified>) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ borderBottom: `1px solid ${SURFACE.lineSoft}`, py: 1.25 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ flex: 1, minWidth: 0 }}>{head}</Box>
        <Stack direction="row" alignItems="center" sx={{ pt: 0.5 }}>
          {item.example && <Typography variant="caption" sx={{ color: USD.yarrow, mr: 1 }}>Example</Typography>}
          <Tooltip title={open ? 'Hide details' : 'Basis, confidence and more settings'}>
            <Button size="small" onClick={() => setOpen((o) => !o)} startIcon={<ConfidenceDot conf={item.conf} />} endIcon={open ? <ExpandLess /> : <ExpandMore />} sx={{ color: 'text.secondary', minWidth: 0 }} aria-expanded={open}>
              {item.basis ? 'Basis' : 'Add basis'}
            </Button>
          </Tooltip>
          <Tooltip title={removeLabel}>
            <IconButton onClick={onRemove} aria-label={removeLabel} size="small"><DeleteOutline fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pt: 1.5, pl: { md: 1 } }}>
          {details}
          <Box sx={{ mt: details ? 1.5 : 0 }}>
            <JustifyFields basis={item.basis} conf={item.conf} onBasis={(basis) => onJustify({ basis })} onConf={(conf) => onJustify({ conf, example: false })} />
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

const DEPTS: { value: Role['dept']; label: string; help: string }[] = [
  { value: 'delivery', label: 'Delivery (direct cost)', help: 'Delivers the product or service to customers. Counted in direct costs.' },
  { value: 'sales', label: 'Sales and marketing', help: '' },
  { value: 'product', label: 'Product and engineering', help: '' },
  { value: 'admin', label: 'Leadership and administration', help: '' },
];

export function RolesEditor() {
  const { project, update } = useStore();
  const n = project.setup.months;
  const patch = (id: string): Patch<Role> => (p) => update((d) => { const r = d.roles.find((x) => x.id === id); if (r) Object.assign(r, p, 'basis' in p || 'conf' in p ? {} : { example: false }); });
  return (
    <Box>
      {project.roles.length === 0 && <Typography color="text.secondary" sx={{ py: 2 }}>No team members yet. Founders who draw no salary still belong here, at zero pay, so the plan is honest about who does the work.</Typography>}
      {project.roles.map((r) => {
        const pr = patch(r.id);
        const loaded = r.count * r.monthlyComp * (1 + r.burdenPct / 100);
        return (
          <Box key={r.id}>
            <RowShell onJustify={pr}
                item={r}
                removeLabel={`Remove ${r.title}`}
                onRemove={() => update((d) => { d.roles = d.roles.filter((x) => x.id !== r.id); })}
                head={
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="flex-start">
                    <TextField label="Role" value={r.title} onChange={(e) => pr({ title: e.target.value })} sx={{ width: 230 }} />
                    <NumberField label="People" value={r.count} onChange={(v) => pr({ count: v })} min={0} width={90} />
                    <NumberField label="Monthly pay each" value={r.monthlyComp} unit="usd" onChange={(v) => pr({ monthlyComp: v })} min={0} width={150} />
                    <NumberField label="Benefits and payroll taxes" value={r.burdenPct} unit="pct" onChange={(v) => pr({ burdenPct: v })} min={0} max={100} width={150} />
                    <NumberField label="Start month" value={r.startMonth} onChange={(v) => pr({ startMonth: v })} min={1} max={n} integer width={110} />
                    <Box sx={{ pt: 1, color: 'text.secondary', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{money(loaded)}/mo loaded</Box>
                  </Stack>
                }
                details={
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <TextField select label="Department" value={r.dept} onChange={(e) => pr({ dept: e.target.value as Role['dept'] })} sx={{ width: 260 }} helperText={DEPTS.find((x) => x.value === r.dept)?.help}>
                      {DEPTS.map((x) => <MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}
                    </TextField>
                    <NumberField label="Annual raise" value={r.annualRaisePct} unit="pct" onChange={(v) => pr({ annualRaisePct: v })} min={0} max={50} width={130} />
                    <NumberField label="Last month (0 = stays)" value={r.endMonth ?? 0} onChange={(v) => pr({ endMonth: v > 0 ? v : null })} min={0} max={n} integer width={170} />
                  </Stack>
                }
              />
          </Box>
        );
      })}
      <Button startIcon={<AddIcon />} sx={{ mt: 1.5 }} onClick={() => update((d) => { d.roles.push({ id: uid('role'), title: 'New role', count: 1, monthlyComp: 6000, burdenPct: 22, startMonth: 1, endMonth: null, annualRaisePct: 3, dept: 'product', basis: '', conf: 'unset', example: false }); })}>
        Add a role
      </Button>
    </Box>
  );
}

const CATS: { value: Expense['category']; label: string }[] = (Object.keys(OPEX_LABELS) as Expense['category'][]).map((k) => ({ value: k, label: OPEX_LABELS[k] }));

export function ExpensesEditor() {
  const { project, update } = useStore();
  const n = project.setup.months;
  const patch = (id: string): Patch<Expense> => (p) => update((d) => { const e = d.expenses.find((x) => x.id === id); if (e) Object.assign(e, p, 'basis' in p || 'conf' in p ? {} : { example: false }); });
  return (
    <Box>
      {project.expenses.map((e) => {
        const pe = patch(e.id);
        return (
          <Box key={e.id}>
            <RowShell onJustify={pe}
                item={e}
                removeLabel={`Remove ${e.name}`}
                onRemove={() => update((d) => { d.expenses = d.expenses.filter((x) => x.id !== e.id); })}
                head={
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <TextField label="Expense" value={e.name} onChange={(ev) => pe({ name: ev.target.value })} sx={{ width: 250 }} />
                    <TextField select label="Type" value={e.kind} onChange={(ev) => pe({ kind: ev.target.value as Expense['kind'] })} sx={{ width: 140 }}>
                      <MenuItem value="recurring">Every month</MenuItem>
                      <MenuItem value="one-time">One time</MenuItem>
                    </TextField>
                    <NumberField label={e.kind === 'one-time' ? 'Amount' : 'Per month'} value={e.amount} unit="usd" onChange={(v) => pe({ amount: v })} min={0} width={140} />
                    <NumberField label={e.kind === 'one-time' ? 'Month' : 'From month'} value={e.startMonth} onChange={(v) => pe({ startMonth: v })} min={1} max={n} integer width={110} />
                    <TextField select label="Category" value={e.category} onChange={(ev) => pe({ category: ev.target.value as Expense['category'] })} sx={{ width: 230 }}>
                      {CATS.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                    </TextField>
                  </Stack>
                }
                details={
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <NumberField label="Days until paid" value={e.payDelayDays} unit="days" onChange={(v) => pe({ payDelayDays: v })} min={0} max={180} width={150} />
                    {e.kind === 'recurring' && <NumberField label="Annual increase" value={e.annualGrowthPct} unit="pct" onChange={(v) => pe({ annualGrowthPct: v })} min={-50} max={100} width={140} />}
                    {e.kind === 'recurring' && <NumberField label="Last month (0 = continues)" value={e.endMonth ?? 0} onChange={(v) => pe({ endMonth: v > 0 ? v : null })} min={0} max={n} integer width={190} />}
                  </Stack>
                }
              />
          </Box>
        );
      })}
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button startIcon={<AddIcon />} onClick={() => update((d) => { d.expenses.push({ id: uid('exp'), name: 'New expense', category: 'ga', kind: 'recurring', amount: 0, startMonth: 1, endMonth: null, annualGrowthPct: 0, payDelayDays: 0, basis: '', conf: 'unset', example: false }); })}>Add a monthly expense</Button>
        <Button startIcon={<AddIcon />} onClick={() => update((d) => { d.expenses.push({ id: uid('exp'), name: 'One-time expense', category: 'ga', kind: 'one-time', amount: 0, startMonth: 1, endMonth: null, annualGrowthPct: 0, payDelayDays: 0, basis: '', conf: 'unset', example: false }); })}>Add a one-time expense</Button>
      </Stack>
    </Box>
  );
}

export function CapexEditor() {
  const { project, update } = useStore();
  const n = project.setup.months;
  const patch = (id: string): Patch<CapexItem> => (p) => update((d) => { const c = d.capex.find((x) => x.id === id); if (c) Object.assign(c, p, 'basis' in p || 'conf' in p ? {} : { example: false }); });
  return (
    <Box>
      {project.capex.length === 0 && <Typography color="text.secondary" sx={{ py: 1 }}>No equipment or other long-lived purchases. Computers, vehicles, lab equipment and tooling belong here.</Typography>}
      {project.capex.map((c) => {
        const pc = patch(c.id);
        return (
          <Box key={c.id}>
            <RowShell onJustify={pc} item={c} removeLabel={`Remove ${c.name}`} onRemove={() => update((d) => { d.capex = d.capex.filter((x) => x.id !== c.id); })}
                head={
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <TextField label="Item" value={c.name} onChange={(e) => pc({ name: e.target.value })} sx={{ width: 250 }} />
                    <NumberField label="Cost" value={c.amount} unit="usd" onChange={(v) => pc({ amount: v })} min={0} width={140} />
                    <NumberField label="Month bought" value={c.month} onChange={(v) => pc({ month: v })} min={1} max={n} integer width={120} />
                    <NumberField label="Useful life" value={c.usefulLifeMonths} unit="months" onChange={(v) => pc({ usefulLifeMonths: v })} min={1} max={360} integer width={150} />
                  </Stack>
                } />
          </Box>
        );
      })}
      <Button startIcon={<AddIcon />} sx={{ mt: 1.5 }} onClick={() => update((d) => { d.capex.push({ id: uid('capex'), name: 'Equipment', amount: 5000, month: 1, usefulLifeMonths: 36, basis: '', conf: 'unset', example: false }); })}>Add equipment</Button>
    </Box>
  );
}

export function FundingEditor() {
  const { project, update } = useStore();
  const n = project.setup.months;
  const patch = (id: string): Patch<Funding> => (p) => update((d) => { const f = d.funding.find((x) => x.id === id); if (f) Object.assign(f, p, 'basis' in p || 'conf' in p ? {} : { example: false }); });
  return (
    <Box>
      {project.funding.length === 0 && <Typography color="text.secondary" sx={{ py: 1 }}>No outside funding planned. Add investment, grants or loans you expect to receive.</Typography>}
      {project.funding.map((f) => {
        const pf = patch(f.id);
        return (
          <Box key={f.id}>
            <RowShell onJustify={pf} item={f} removeLabel={`Remove ${f.name}`} onRemove={() => update((d) => { d.funding = d.funding.filter((x) => x.id !== f.id); })}
                head={
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <TextField label="Source" value={f.name} onChange={(e) => pf({ name: e.target.value })} sx={{ width: 220 }} />
                    <TextField select label="Type" value={f.kind} onChange={(e) => pf({ kind: e.target.value as Funding['kind'] })} sx={{ width: 170 }}>
                      <MenuItem value="equity">Investment (equity)</MenuItem>
                      <MenuItem value="grant">Grant</MenuItem>
                      <MenuItem value="loan">Loan</MenuItem>
                    </TextField>
                    <NumberField label="Amount" value={f.amount} unit="usd" onChange={(v) => pf({ amount: v })} min={0} width={150} />
                    <NumberField label="Month received" value={f.month} onChange={(v) => pf({ month: v })} min={1} max={n} integer width={130} />
                    {f.kind === 'loan' && <NumberField label="Interest rate" value={f.annualRatePct} unit="pct" onChange={(v) => pf({ annualRatePct: v })} min={0} max={40} width={130} />}
                    {f.kind === 'loan' && <NumberField label="Repay over" value={f.termMonths} unit="months" onChange={(v) => pf({ termMonths: v })} min={1} max={360} integer width={140} />}
                  </Stack>
                } />
          </Box>
        );
      })}
      <Button startIcon={<AddIcon />} sx={{ mt: 1.5 }} onClick={() => update((d) => { d.funding.push({ id: uid('fund'), name: 'Seed investment', kind: 'equity', amount: 100000, month: 6, annualRatePct: 8, termMonths: 36, basis: '', conf: 'unset', example: false }); })}>Add funding</Button>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Loans are repaid in equal monthly payments starting the month after they arrive. Interest is shown below operating profit.
      </Typography>
    </Box>
  );
}

export function TaxEditor() {
  const { project, update } = useStore();
  const t = project.tax;
  const set = (p: Partial<Project['tax']>) => update((d) => { Object.assign(d.tax, p); });
  return (
    <Box>
      <FormControlLabel control={<Switch checked={t.enabled} onChange={(e) => set({ enabled: e.target.checked })} />} label="Include a rough income tax estimate" />
      {t.enabled && (
        <Stack spacing={2} sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
            <TextField select label="Legal structure" value={t.entity} onChange={(e) => set({ entity: e.target.value as Project['tax']['entity'] })} sx={{ width: 300 }}>
              <MenuItem value="c_corp">C corporation (company pays tax)</MenuItem>
              <MenuItem value="pass_through">LLC, S corporation or partnership (owners pay)</MenuItem>
            </TextField>
            <TextField select label="When tax is paid" value={t.payment} onChange={(e) => set({ payment: e.target.value as Project['tax']['payment'] })} sx={{ width: 260 }}>
              <MenuItem value="quarterly">Quarterly estimates</MenuItem>
              <MenuItem value="annual">Once a year, after year end</MenuItem>
            </TextField>
            <InfoTip text="Quarterly: taxes for each quarter are paid the month after it ends. Annual: each 12-month year's taxes are paid three months after it ends, like an April filing." />
          </Stack>
          {t.entity === 'pass_through' && (
            <FormControlLabel control={<Switch checked={t.includeOwnerDistributions} onChange={(e) => set({ includeOwnerDistributions: e.target.checked })} />}
              label="Pay owners enough cash to cover the tax they owe on the company's profit" />
          )}
          <AssumptionField label="Combined income tax rate" unit="pct" min={0} max={60} a={t.rate}
            help="Federal plus state rate on profit. A US C corporation pays 21% federal plus state tax; owners of pass-through businesses pay their personal rates, often 25% to 40% combined."
            onChange={(p) => update((d) => { Object.assign(d.tax.rate, p); })} />
          <Typography variant="body2" color="text.secondary">
            This is a coarse estimate, not tax advice. Losses are carried forward and used against later profit. Credits, deductions, self-employment tax and state differences are ignored.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
