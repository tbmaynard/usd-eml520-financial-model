import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { COMMON_FORMULAS } from '../../engine/formulas';
import { getModule, type FormulaDoc, type Ref } from '../../engine/models';
import type { MonthRow, Project, ProjectResult, Unit } from '../../engine/types';
import { CONFIDENCE_LABELS } from '../../engine/types';
import { useStore } from '../../state/store';
import { formatMetric, formatUnit, money } from '../format';
import { SURFACE, USD } from '../theme';
import { ConfidenceDot } from './inputs';

export interface FormulaEntry {
  doc: FormulaDoc;
  streamId: string | null;
  streamName: string | null;
}

export function allFormulas(p: Project): FormulaEntry[] {
  const out: FormulaEntry[] = COMMON_FORMULAS.map((doc) => ({ doc, streamId: null, streamName: null }));
  for (const s of p.streams) {
    const mod = getModule(s.kind);
    const opts = { ...mod.defaultOptions, ...s.options };
    for (const doc of mod.formulas) {
      if (doc.showIf && !doc.showIf(opts)) continue;
      out.push({ doc, streamId: s.id, streamName: s.name });
    }
  }
  return out;
}

const ROW_LABELS: Partial<Record<keyof MonthRow, string>> = {
  revenue: 'Total revenue', direct: 'Direct costs', grossProfit: 'Gross profit', personnel: 'Personnel', sm: 'Sales and marketing',
  rd: 'Research and development', ga: 'General and administrative', other: 'Other operating expenses', opex: 'Operating expenses',
  ebitda: 'EBITDA', depreciation: 'Depreciation', operatingProfit: 'Operating profit', interest: 'Interest', pretax: 'Pretax profit',
  tax: 'Income tax', netIncome: 'Net income', beginningCash: 'Beginning cash', collections: 'Cash collected from customers',
  founder: 'Founder investment', equity: 'Investment and grants', loanProceeds: 'Loan proceeds', paidDirect: 'Cash paid for direct costs',
  paidOpex: 'Cash paid for operating expenses', paidPersonnel: 'Cash paid for salaries', capexPaid: 'Equipment purchases',
  interestPaid: 'Interest paid', principalPaid: 'Loan repayments', taxPaid: 'Taxes paid', operatingCashFlow: 'Operating cash flow',
  endingCash: 'Ending cash', billings: 'Invoices issued', receivables: 'Money customers still owe', payables: 'Bills not yet paid',
  deferredRevenue: 'Deferred revenue', burn: 'Burn', inventory: 'Inventory',
};

interface Resolved {
  label: string;
  value: string;
  unit?: Unit;
  basis?: string;
  conf?: import('../../engine/types').Confidence;
  example?: boolean;
  isInput: boolean;
}

export function resolveRef(ref: Ref, entry: FormulaEntry, p: Project, r: ProjectResult, month: number): Resolved | null {
  const i = month - 1;
  if (ref.kind === 'row') {
    const row = r.rows[i];
    if (!row) return null;
    const v = row[ref.key as keyof MonthRow] as number;
    return { label: ref.label ?? ROW_LABELS[ref.key as keyof MonthRow] ?? ref.key, value: money(v), isInput: false };
  }
  const stream = p.streams.find((s) => s.id === entry.streamId);
  const sr = r.streams.find((s) => s.stream.id === entry.streamId)?.result;
  if (!stream || !sr) return null;
  const mod = getModule(stream.kind);
  if (ref.kind === 'input') {
    const f = mod.fields.find((x) => x.key === ref.key);
    const a = stream.inputs[ref.key];
    if (!f || !a) return null;
    return { label: ref.label ?? f.label, value: formatUnit(a.v, f.unit), unit: f.unit, basis: a.basis, conf: a.conf, example: a.example, isInput: true };
  }
  if (ref.kind === 'metric') {
    const m = sr.metrics.find((x) => x.key === ref.key);
    if (!m) return null;
    return { label: ref.label ?? m.label, value: formatMetric(m.values[i], m.unit), isInput: false };
  }
  const lines = ref.kind === 'revenue' ? sr.revenue : ref.kind === 'direct' ? sr.direct : sr.opex;
  const l = lines.find((x) => x.key === ref.key);
  if (!l) return null;
  return { label: ref.label ?? l.label, value: money(l.values[i]), isInput: false };
}

interface ExplainApi {
  explain: (id: string, streamId?: string | null) => void;
}
const ExplainCtx = createContext<ExplainApi>({ explain: () => {} });
export const useExplain = () => useContext(ExplainCtx);

export function ExplainProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ id: string; streamId: string | null } | null>(null);
  const explain = useCallback((id: string, streamId: string | null = null) => setState({ id, streamId }), []);
  return (
    <ExplainCtx.Provider value={{ explain }}>
      {children}
      <Drawer anchor="right" open={!!state} onClose={() => setState(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, bgcolor: SURFACE.panel } }}>
        {state && <ExplainPanel id={state.id} streamId={state.streamId} onClose={() => setState(null)} onOpen={(id, s) => setState({ id, streamId: s })} />}
      </Drawer>
    </ExplainCtx.Provider>
  );
}

function ExplainPanel({ id, streamId, onClose, onOpen }: { id: string; streamId: string | null; onClose: () => void; onOpen: (id: string, streamId: string | null) => void }) {
  const { project, current, go } = useStore();
  const n = current.rows.length;
  const firstRevenue = current.rows.findIndex((r) => r.revenue > 0);
  const [month, setMonth] = useState(Math.min(n, Math.max(1, firstRevenue >= 0 ? firstRevenue + 1 : 1) + 5));
  const formulas = allFormulas(project);
  const entry = formulas.find((f) => f.doc.id === id && (streamId == null || f.streamId === streamId)) ?? formulas.find((f) => f.doc.id === id);
  if (!entry) return <Box sx={{ p: 3 }}>This calculation is not used in the current model.</Box>;
  return <FormulaDetail entry={entry} month={month} setMonth={setMonth} onClose={onClose} onOpen={onOpen} onEdit={() => { onClose(); go('assumptions', 'revenue'); }} formulas={formulas} project={project} result={current} />;
}

export function FormulaDetail({ entry, month, setMonth, onClose, onOpen, onEdit, formulas, project, result }: {
  entry: FormulaEntry; month: number; setMonth: (m: number) => void; onClose?: () => void; onOpen?: (id: string, streamId: string | null) => void; onEdit?: () => void;
  formulas: FormulaEntry[]; project: Project; result: ProjectResult;
}) {
  const { doc } = entry;
  const res = doc.result ? resolveRef(doc.result, entry, project, result, month) : null;
  const terms = doc.terms.map((t) => resolveRef(t, entry, project, result, month)).filter((x): x is Resolved => !!x);
  const inputs = terms.filter((t) => t.isInput);
  const termKeys = new Set(doc.terms.filter((t) => t.kind !== 'input').map((t) => `${t.kind}:${t.key}`));
  const related = formulas.filter((f) => f.doc.id !== doc.id && f.streamId === entry.streamId && f.doc.result && termKeys.has(`${f.doc.result.kind}:${f.doc.result.key}`));
  const rowLabel = result.rows[month - 1]?.label ?? '';

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box>
          <Typography variant="overline" color="text.secondary">{entry.streamName ?? 'Shared financial engine'}</Typography>
          <Typography variant="h2" sx={{ mt: 0.25 }}>{doc.title}</Typography>
        </Box>
        {onClose && <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>}
      </Stack>
      <Typography className="prose" sx={{ mt: 1.5 }}>{doc.definition}</Typography>

      <Box sx={{ mt: 2.5, p: 2, borderRadius: 2, bgcolor: SURFACE.bg, border: `1px solid ${SURFACE.line}` }}>
        <Typography variant="overline" color="text.secondary">Formula</Typography>
        <Typography sx={{ mt: 0.5, fontSize: '1.02rem', lineHeight: 1.55 }}>{doc.expression}</Typography>
      </Box>

      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 3, mb: 1 }}>
        <Typography variant="h4">Values used</Typography>
        <TextField select value={month} onChange={(e) => setMonth(Number(e.target.value))} size="small" sx={{ width: 170 }} inputProps={{ 'aria-label': 'Month' }}>
          {result.rows.map((r) => <MenuItem key={r.month} value={r.month}>Month {r.month} · {r.label}</MenuItem>)}
        </TextField>
      </Stack>
      <Table size="small">
        <TableBody>
          {terms.map((t, i) => (
            <TableRow key={i}>
              <TableCell sx={{ color: 'text.secondary', pl: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {t.isInput && t.conf && <ConfidenceDot conf={t.conf} />}
                  <span>{t.label}</span>
                  {t.isInput && <Chip label="your assumption" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                </Stack>
              </TableCell>
              <TableCell align="right" sx={{ pr: 0 }}>{t.value}</TableCell>
            </TableRow>
          ))}
          {res && (
            <TableRow>
              <TableCell sx={{ pl: 0, fontWeight: 700, borderBottom: 'none' }}>{res.label} ({rowLabel})</TableCell>
              <TableCell align="right" sx={{ pr: 0, fontWeight: 700, color: USD.toreroBlue, borderBottom: 'none' }}>{res.value}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {related.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Trace further back:</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {related.map((f) => <Chip key={f.doc.id} label={f.doc.title} onClick={() => onOpen?.(f.doc.id, f.streamId)} clickable color="primary" variant="outlined" />)}
          </Stack>
        </Box>
      )}

      {inputs.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h4" sx={{ mb: 1 }}>Your assumptions behind this</Typography>
          <Stack spacing={1.25}>
            {inputs.map((t, i) => (
              <Box key={i} sx={{ p: 1.5, borderRadius: 2, bgcolor: SURFACE.bg }}>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" sx={{ fontWeight: 600 }}>{t.label}</Typography><Typography variant="body2">{t.value}</Typography></Stack>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <ConfidenceDot conf={t.conf ?? 'unset'} withLabel />
                  {t.example && <Typography variant="caption" sx={{ color: USD.yarrow }}>Example value</Typography>}
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.5, color: t.basis ? 'text.primary' : 'text.secondary', fontStyle: t.basis ? 'normal' : 'italic' }}>
                  {t.basis || 'No basis given yet.'}
                </Typography>
              </Box>
            ))}
          </Stack>
          {onEdit && <Button sx={{ mt: 1.5 }} onClick={onEdit}>Edit these assumptions</Button>}
        </Box>
      )}

      {(doc.limitations || doc.reference) && <Divider sx={{ my: 3 }} />}
      {doc.limitations && (
        <Box>
          <Typography variant="h4">Simplifications and limits</Typography>
          <Typography className="prose" sx={{ mt: 0.75 }}>{doc.limitations}</Typography>
        </Box>
      )}
      {doc.reference && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Reference: {doc.reference}</Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
        Confidence levels: {(['evidence', 'benchmark', 'speculative'] as const).map((c) => CONFIDENCE_LABELS[c]).join(', ')}.
      </Typography>
    </Box>
  );
}
