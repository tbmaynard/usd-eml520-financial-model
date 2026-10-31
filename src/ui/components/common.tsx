import FunctionsIcon from '@mui/icons-material/Functions';
import { Box, Card, CardContent, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useStore, type Section } from '../../state/store';
import { FONT_STAT, SURFACE, USD } from '../theme';
import { useExplain } from './explain';

export function PageHeader({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-end' }} spacing={2}>
        <Box sx={{ maxWidth: 760 }}>
          <Typography variant="h1">{title}</Typography>
          {lead && <Typography className="prose" sx={{ mt: 1 }}>{lead}</Typography>}
        </Box>
        {children}
      </Stack>
    </Box>
  );
}

export function SectionTabs({ section, tabs }: { section: Section; tabs: { id: string; label: string }[] }) {
  const { tab, go } = useStore();
  const value = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  return (
    <Tabs value={value} onChange={(_, v) => go(section, v)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 3, borderBottom: `1px solid ${SURFACE.line}` }}>
      {tabs.map((t) => <Tab key={t.id} value={t.id} label={t.label} />)}
    </Tabs>
  );
}

export function useTab(tabs: { id: string }[]): string {
  const { tab } = useStore();
  return tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
}

export function Panel({ title, subtitle, action, children, pad = true }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <Card sx={{ mb: 2.5 }}>
      {(title || action) && (
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ px: 2.5, pt: 2.25, pb: subtitle ? 0.5 : 1 }}>
          <Box>
            {title && <Typography variant="h3">{title}</Typography>}
            {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>{subtitle}</Typography>}
          </Box>
          {action}
        </Stack>
      )}
      <CardContent sx={{ p: pad ? 2.5 : 0, pt: title ? 1.5 : 2.5, '&:last-child': { pb: pad ? 2.5 : 0 } }}>{children}</CardContent>
    </Card>
  );
}

export type Tone = 'neutral' | 'good' | 'bad' | 'warn';
const TONE_COLOR: Record<Tone, string> = { neutral: SURFACE.text, good: USD.sagebrush, bad: USD.poppy, warn: USD.yarrow };

/** A headline number. Clicking the formula button opens its calculation. */
export function Kpi({ label, value, sub, tone = 'neutral', formula, streamId, help }: {
  label: string; value: string; sub?: ReactNode; tone?: Tone; formula?: string; streamId?: string | null; help?: string;
}) {
  const { explain } = useExplain();
  return (
    <Card sx={{ height: '100%', borderColor: tone === 'bad' ? 'rgba(245,130,56,0.55)' : undefined }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Tooltip title={help ?? ''}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{label}</Typography>
          </Tooltip>
          {formula && (
            <Tooltip title="Show how this is calculated">
              <Box component="button" type="button" onClick={() => explain(formula, streamId ?? null)} aria-label={`How ${label} is calculated`}
                sx={{ border: 'none', bgcolor: 'transparent', color: 'text.secondary', cursor: 'pointer', p: 0.25, borderRadius: 1, display: 'flex', '&:hover': { color: 'primary.main' }, '&:focus-visible': { outline: `2px solid ${USD.toreroBlue}` } }}>
                <FunctionsIcon sx={{ fontSize: 18 }} />
              </Box>
            </Tooltip>
          )}
        </Stack>
        <Typography sx={{ fontFamily: FONT_STAT, fontWeight: 600, fontSize: '2rem', lineHeight: 1.15, mt: 0.5, color: TONE_COLOR[tone] }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.35 }}>{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

export function Callout({ children, tone = 'info', title }: { children: ReactNode; tone?: 'info' | 'warn' | 'bad'; title?: ReactNode }) {
  const color = tone === 'bad' ? USD.poppy : tone === 'warn' ? USD.yarrow : USD.toreroBlue;
  return (
    <Box sx={{ borderLeft: `3px solid ${color}`, bgcolor: SURFACE.panel, borderRadius: '0 8px 8px 0', px: 2, py: 1.5, mb: 2.5 }}>
      {title && <Typography variant="subtitle1" sx={{ color, mb: 0.5 }}>{title}</Typography>}
      <Box sx={{ color: 'text.secondary', fontSize: '0.92rem' }}>{children}</Box>
    </Box>
  );
}

export const PRINCIPLE = 'A financial model is not a prediction. It is a structured representation of what you believe must be true for your business to work.';

export function Principle() {
  return (
    <Typography className="prose" sx={{ fontStyle: 'italic', color: SURFACE.textMuted, borderLeft: `2px solid ${USD.immaculataBlue}`, pl: 1.75, my: 2 }}>
      {PRINCIPLE}
    </Typography>
  );
}

export function Grid({ min = 220, gap = 2, children }: { min?: number; gap?: number; children: ReactNode }) {
  return <Box sx={{ display: 'grid', gap, gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` }}>{children}</Box>;
}
