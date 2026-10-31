import InfoOutlined from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Collapse,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import type { Assumption, Confidence, Unit } from '../../engine/types';
import { CONFIDENCE_LABELS } from '../../engine/types';
import { UNIT_ADORN } from '../format';
import { SURFACE, USD } from '../theme';

export function InfoTip({ text, size = 16 }: { text: ReactNode; size?: number }) {
  return (
    <Tooltip title={text}>
      <IconButton size="small" sx={{ p: 0.25, color: 'text.secondary' }} aria-label="More information">
        <InfoOutlined sx={{ fontSize: size }} />
      </IconButton>
    </Tooltip>
  );
}

interface NumberFieldProps {
  value: number;
  onChange: (v: number) => void;
  unit?: Unit;
  min?: number;
  max?: number;
  integer?: boolean;
  label?: string;
  width?: number | string;
  disabled?: boolean;
  ariaLabel?: string;
  size?: 'small' | 'medium';
}

/** A number input that keeps what the student types, commits only valid
 *  numbers, and explains what is wrong with invalid ones. */
export function NumberField({ value, onChange, unit, min, max, integer, label, width = 170, disabled, ariaLabel }: NumberFieldProps) {
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);

  const parsed = parse(text);
  let error = '';
  if (text.trim() === '') error = 'Enter a number';
  else if (parsed == null) error = 'Not a number';
  else if (min != null && parsed < min) error = `At least ${min}`;
  else if (max != null && parsed > max) error = `At most ${max}`;
  else if (integer && !Number.isInteger(parsed)) error = 'Whole number';

  const adorn = unit ? UNIT_ADORN[unit] : undefined;
  return (
    <TextField
      label={label}
      value={text}
      disabled={disabled}
      error={!!error}
      helperText={error || undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setText(fmt(value)); }}
      onChange={(e) => {
        setText(e.target.value);
        const v = parse(e.target.value);
        if (v != null && (min == null || v >= min) && (max == null || v <= max) && (!integer || Number.isInteger(v))) onChange(v);
      }}
      inputProps={{ inputMode: 'decimal', 'aria-label': ariaLabel ?? label, style: { textAlign: 'right' } }}
      InputProps={{
        startAdornment: adorn?.start ? <InputAdornment position="start">{adorn.start}</InputAdornment> : undefined,
        endAdornment: adorn?.end ? <InputAdornment position="end">{adorn.end}</InputAdornment> : undefined,
      }}
      sx={{ width, '& .MuiFormHelperText-root': { mx: 0.5 } }}
    />
  );
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '';
  return Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(Math.round(v * 1000) / 1000);
}
function parse(s: string): number | null {
  const t = s.replace(/[$,%\s]/g, '').replace(/[−–]/g, '-');
  if (t === '' || t === '-' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const CONF_COLOR: Record<Confidence, string> = {
  evidence: USD.sagebrush,
  benchmark: USD.toreroBlue,
  speculative: USD.poppy,
  unset: SURFACE.textFaint,
};

export const CONF_HELP: Record<Confidence, string> = {
  evidence: 'Based on direct evidence about your venture: quotes, signed letters of intent, pilot results, your own sales data.',
  benchmark: 'Based on published data or comparable companies: industry reports, competitor pricing, public filings.',
  speculative: 'Your best estimate without supporting data yet.',
  unset: 'You have not said how well supported this value is.',
};

export function ConfidenceDot({ conf, withLabel }: { conf: Confidence; withLabel?: boolean }) {
  const shape = conf === 'unset'
    ? { border: `1.5px dashed ${CONF_COLOR.unset}`, bgcolor: 'transparent' }
    : conf === 'speculative'
      ? { border: `1.5px solid ${CONF_COLOR.speculative}`, bgcolor: 'transparent' }
      : { bgcolor: CONF_COLOR[conf] };
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} component="span">
      <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, ...shape }} aria-hidden />
      {withLabel && <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>{CONFIDENCE_LABELS[conf]}</Typography>}
    </Stack>
  );
}

export function ConfidencePicker({ value, onChange }: { value: Confidence; onChange: (c: Confidence) => void }) {
  return (
    <ToggleButtonGroup size="small" exclusive value={value} onChange={(_, v) => v && onChange(v)} aria-label="Confidence">
      {(['evidence', 'benchmark', 'speculative'] as const).map((c) => (
        <Tooltip key={c} title={CONF_HELP[c]}>
          <ToggleButton value={c} sx={{ px: 1.25, py: 0.4, gap: 0.75, fontSize: '0.8rem' }}>
            <ConfidenceDot conf={c} />
            {CONFIDENCE_LABELS[c].replace('-based', '')}
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}

/** Basis + confidence for any justified item. */
export function JustifyFields({ basis, conf, onBasis, onConf, placeholder }: {
  basis: string; conf: Confidence; onBasis: (s: string) => void; onConf: (c: Confidence) => void; placeholder?: string;
}) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ width: '100%' }}>
      <TextField
        value={basis}
        onChange={(e) => onBasis(e.target.value)}
        placeholder={placeholder ?? 'Why this value? e.g. “Three supplier quotes, average $18”'}
        fullWidth
        multiline
        maxRows={4}
        inputProps={{ 'aria-label': 'Basis for this value', maxLength: 600 }}
      />
      <ConfidencePicker value={conf} onChange={onConf} />
    </Stack>
  );
}

/** A labelled assumption input: value, plus a "why" row for basis and confidence. */
export function AssumptionField({ label, help, unit, a, onChange, min, max, integer, highlight }: {
  label: string;
  help?: ReactNode;
  unit: Unit;
  a: Assumption;
  onChange: (patch: Partial<Assumption>) => void;
  min?: number;
  max?: number;
  integer?: boolean;
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const needsWhy = !a.basis.trim();
  return (
    <Box
      sx={{
        py: 1.25, px: 1.5, borderRadius: 2,
        bgcolor: highlight ? 'rgba(117,190,233,0.06)' : 'transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
          {help && <InfoTip text={help} />}
        </Stack>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexShrink: 0 }}>
          <Tooltip title={a.example ? 'Illustrative example value from the template. Replace it with your own, or confirm it below.' : ''}>
            <Typography variant="caption" sx={{ color: USD.yarrow, visibility: a.example ? 'visible' : 'hidden', whiteSpace: 'nowrap' }}>
              Example
            </Typography>
          </Tooltip>
          <NumberField value={a.v} unit={unit} min={min} max={max} integer={integer} ariaLabel={label} onChange={(v) => onChange({ v, example: false })} />
          <Tooltip title={a.basis ? `${a.basis}` : 'Add the basis for this value'}>
            <Box
              component="button"
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={`Basis and confidence for ${label}`}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', border: `1px solid ${SURFACE.line}`, bgcolor: 'transparent',
                color: needsWhy ? 'text.secondary' : 'text.primary', borderRadius: 1.5, px: 1, py: 0.6, font: 'inherit', fontSize: '0.8rem', minWidth: 92,
                '&:hover': { borderColor: 'primary.main' }, '&:focus-visible': { outline: `2px solid ${USD.toreroBlue}` },
              }}
            >
              <ConfidenceDot conf={a.conf} />
              {needsWhy ? 'Add basis' : 'Basis'}
            </Box>
          </Tooltip>
        </Stack>
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pt: 1.25 }}>
          <JustifyFields
            basis={a.basis}
            conf={a.conf}
            onBasis={(basis) => onChange({ basis })}
            onConf={(conf) => onChange({ conf, example: a.example && conf === 'unset' })}
          />
          {a.example && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'text.secondary' }}>
              Rating your confidence confirms you have reviewed this example value.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange, width = 240, help }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; width?: number | string; help?: string;
}) {
  return (
    <TextField select label={label} value={value} onChange={(e) => onChange(e.target.value as T)} sx={{ width }} helperText={help}>
      {options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
    </TextField>
  );
}
