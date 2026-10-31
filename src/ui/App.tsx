import CheckCircle from '@mui/icons-material/CheckCircle';
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined';
import FolderOpen from '@mui/icons-material/FolderOpen';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVert from '@mui/icons-material/MoreVert';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import SaveAlt from '@mui/icons-material/SaveAlt';
import {
  Alert, AppBar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, IconButton, LinearProgress, List, ListItemButton,
  ListItemIcon, ListItemText, Menu, MenuItem, Snackbar, Stack, TextField, ToggleButton, ToggleButtonGroup, Toolbar, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { getModule, MODEL_ORDER } from '../engine/models';
import { listAssumptions } from '../engine/paths';
import type { ModelKind, ScenarioId } from '../engine/types';
import { exportProjectionCsv, exportRegisterCsv } from '../export/csv';
import { exportExcel } from '../export/excel';
import { downloadProject, FILE_EXT, readProjectFile } from '../state/fileio';
import { getFlag, setFlag } from '../state/storage';
import { SECTIONS, useStore, type Section } from '../state/store';
import { PRINCIPLE } from './components/common';
import { money } from './format';
import { AssumptionsPage } from './pages/AssumptionsPage';
import { ModelPage } from './pages/ModelPage';
import { ProjectionsPage } from './pages/ProjectionsPage';
import { ReviewPage, useReview } from './pages/ReviewPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { SetupPage } from './pages/SetupPage';
import { FONT_STAT, SURFACE, USD } from './theme';

const NAV_W = 264;

export function App() {
  const store = useStore();
  const { section, go, project } = store;
  const wide = useMediaQuery('(min-width:1000px)');
  const [navOpen, setNavOpen] = useState(false);
  const [welcome, setWelcome] = useState(store.firstVisit);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openFile = async (file: File) => {
    try {
      const p = await readProjectFile(file);
      store.replace(p);
      setToast(`Opened “${p.setup.name}”.`);
      setWelcome(false);
      setProjectsOpen(false);
      go('review', 'summary');
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const nav = <Nav onNavigate={() => setNavOpen(false)} />;
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} className="no-print" sx={{ bgcolor: SURFACE.bg, borderBottom: `1px solid ${SURFACE.line}`, zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1.5, minHeight: 64 }}>
          {!wide && <IconButton onClick={() => setNavOpen(true)} aria-label="Open navigation"><MenuIcon /></IconButton>}
          <Box sx={{ minWidth: 0, flexShrink: 1 }}>
            <Typography variant="overline" sx={{ color: USD.toreroBlue, lineHeight: 1.2, display: 'block' }}>Venture Financial Model</Typography>
            <Typography variant="subtitle1" noWrap sx={{ lineHeight: 1.2, maxWidth: { xs: 160, sm: 320 } }}>{project.setup.name || 'Untitled venture'}</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <ScenarioSwitch />
          <SaveStatus />
          <Tooltip title={`Download a project file (${FILE_EXT}) you can reopen or submit`}>
            <Button variant="contained" startIcon={<SaveAlt />} onClick={() => { downloadProject(project); setFlag('downloaded', new Date().toISOString()); setToast('Project file downloaded.'); }} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
              Download project file
            </Button>
          </Tooltip>
          <FileMenu onOpenFile={() => fileRef.current?.click()} onProjects={() => setProjectsOpen(true)} onToast={setToast} />
        </Toolbar>
      </AppBar>

      {wide ? (
        <Drawer variant="permanent" className="no-print" sx={{ width: NAV_W, flexShrink: 0, '& .MuiDrawer-paper': { width: NAV_W, bgcolor: SURFACE.bg, borderRight: `1px solid ${SURFACE.line}` } }}>
          <Toolbar sx={{ minHeight: 64 }} />
          {nav}
        </Drawer>
      ) : (
        <Drawer open={navOpen} onClose={() => setNavOpen(false)} className="no-print" PaperProps={{ sx: { width: NAV_W, bgcolor: SURFACE.bg } }}>{nav}</Drawer>
      )}

      <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 2, md: 4 }, pb: 8 }}>
        <Toolbar sx={{ minHeight: 64 }} className="no-print" />
        <StorageNotice />
        {section !== 'projections' && section !== 'review' && <LiveStrip />}
        <Box sx={{ maxWidth: 1400, mx: 'auto', pt: 3 }}>
          {section === 'setup' && <SetupPage />}
          {section === 'model' && <ModelPage />}
          {section === 'assumptions' && <AssumptionsPage />}
          {section === 'projections' && <ProjectionsPage />}
          {section === 'scenarios' && <ScenariosPage />}
          {section === 'review' && <ReviewPage />}
          <PageNav />
        </Box>
      </Box>

      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ''; }} />
      <WelcomeDialog open={welcome} onClose={() => setWelcome(false)} onOpenFile={() => fileRef.current?.click()} />
      <ProjectsDialog open={projectsOpen} onClose={() => setProjectsOpen(false)} onOpenFile={() => fileRef.current?.click()} />
      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

function useProgress(): Record<Section, number> {
  const { project } = useStore();
  const prompts = useReview();
  const all = listAssumptions(project);
  const s = project.setup;
  const justified = all.filter((a) => !a.example && a.basis.trim() && a.conf !== 'unset').length;
  const notes = (['downside', 'upside'] as const).filter((id) => project.scenarios[id].notes.trim()).length;
  const answered = prompts.filter((p) => (project.reviewResponses[p.id] ?? '').trim()).length;
  const touched = project.streams.some((st) => Object.values(st.inputs).some((a) => !a.example));
  return {
    setup: [s.name.trim(), s.description.trim(), s.industry.trim()].filter(Boolean).length / 3,
    model: touched ? 1 : 0.5,
    assumptions: all.length ? justified / all.length : 0,
    projections: getFlag(`viewed.${project.id}`) ? 1 : 0,
    scenarios: notes / 2,
    review: prompts.length ? (answered + (project.reflection.trim() ? 1 : 0)) / (prompts.length + 1) : 1,
  };
}

function Nav({ onNavigate }: { onNavigate: () => void }) {
  const { section, go, project } = useStore();
  const progress = useProgress();
  useEffect(() => { if (section === 'projections') setFlag(`viewed.${project.id}`, '1'); }, [section, project.id]);
  const overall = SECTIONS.reduce((a, s) => a + progress[s.id], 0) / SECTIONS.length;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1 }}>
        <Typography variant="body2" color="text.secondary">Model progress</Typography>
        <LinearProgress variant="determinate" value={overall * 100} sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: SURFACE.panel }} aria-label="Overall progress" />
        <Typography variant="caption" color="text.secondary">{Math.round(overall * 100)}% complete</Typography>
      </Box>
      <List sx={{ px: 1 }}>
        {SECTIONS.map((s, i) => {
          const p = progress[s.id];
          const active = section === s.id;
          return (
            <ListItemButton key={s.id} selected={active} onClick={() => { go(s.id); onNavigate(); }} sx={{ borderRadius: 2, mb: 0.5, '&.Mui-selected': { bgcolor: SURFACE.raised } }} aria-current={active ? 'page' : undefined}>
              <ListItemIcon sx={{ minWidth: 34 }}>
                {p >= 1 ? <CheckCircle sx={{ color: USD.sagebrush, fontSize: 22 }} aria-label="Complete" /> : (
                  <Box sx={{ position: 'relative', width: 22, height: 22 }}>
                    <RadioButtonUnchecked sx={{ color: active ? USD.toreroBlue : SURFACE.textFaint, fontSize: 22 }} />
                    <Typography component="span" sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: '0.7rem', fontWeight: 700, color: active ? USD.toreroBlue : SURFACE.textMuted }}>{i + 1}</Typography>
                  </Box>
                )}
              </ListItemIcon>
              <ListItemText primary={s.label} secondary={p > 0 && p < 1 ? `${Math.round(p * 100)}% done` : undefined} primaryTypographyProps={{ fontWeight: active ? 700 : 500 }} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ flex: 1 }} />
      <Typography className="prose" sx={{ px: 2.5, pb: 2.5, fontSize: '0.85rem !important', fontStyle: 'italic' }}>{PRINCIPLE}</Typography>
    </Box>
  );
}

function PageNav() {
  const { section, go } = useStore();
  const i = SECTIONS.findIndex((s) => s.id === section);
  const prev = SECTIONS[i - 1];
  const next = SECTIONS[i + 1];
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ mt: 4 }} className="no-print">
      {prev ? <Button onClick={() => go(prev.id)}>← {prev.label}</Button> : <span />}
      {next && <Button variant="outlined" onClick={() => go(next.id)}>Next: {next.label} →</Button>}
    </Stack>
  );
}

function ScenarioSwitch() {
  const { scenario, setScenario, project } = useStore();
  return (
    <Tooltip title="Which scenario the projections show">
      <ToggleButtonGroup size="small" exclusive value={scenario} onChange={(_, v: ScenarioId | null) => v && setScenario(v)} aria-label="Scenario" sx={{ display: { xs: 'none', sm: 'flex' } }}>
        {(['downside', 'base', 'upside'] as const).map((id) => (
          <ToggleButton key={id} value={id} sx={{ px: 1.5, maxWidth: 170 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{project.scenarios[id].label.replace(/ case$/i, '')}</Typography>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Tooltip>
  );
}

function SaveStatus() {
  const { savedAt, saveFailed, storageOk } = useStore();
  if (!storageOk || saveFailed) {
    return <Tooltip title="This browser is not saving your work. Download a project file to keep it."><CloudOffOutlined sx={{ color: USD.poppy }} aria-label="Not saving" /></Tooltip>;
  }
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', lg: 'block' }, whiteSpace: 'nowrap' }}>
      {savedAt ? `Saved in this browser ${savedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Saved in this browser'}
    </Typography>
  );
}

function StorageNotice() {
  const { storageOk, saveFailed, project } = useStore();
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem('vfm.noticeHidden') === '1'; } catch { return false; }
  });
  if (!storageOk || saveFailed) {
    return <Alert severity="error" sx={{ mt: 2 }} className="no-print">Your browser is not allowing this site to save. Your work will be lost when you close the tab unless you <b>download a project file</b>.</Alert>;
  }
  if (hidden) return null;
  return (
    <Alert severity="info" icon={<CloudOffOutlined />} sx={{ mt: 2, bgcolor: SURFACE.panel, color: 'text.secondary', border: `1px solid ${SURFACE.line}` }} className="no-print"
      action={
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => downloadProject(project)}>Download now</Button>
          <Button size="small" color="inherit" onClick={() => { setHidden(true); try { sessionStorage.setItem('vfm.noticeHidden', '1'); } catch { /* ignore */ } }}>Hide</Button>
        </Stack>
      }>
      There is no account and no server: your work is saved only in this browser, and clearing browser data erases it. Download a project file regularly, and submit that file (or the Excel export) for class.
    </Alert>
  );
}

function LiveStrip() {
  const { results, project } = useStore();
  const s = results.base.summary;
  const items = [
    ['Revenue', money(s.totalRevenue, { compact: true }), false],
    ['Operating result', money(s.totalOperatingProfit, { compact: true }), s.totalOperatingProfit < 0],
    ['Lowest cash', money(s.minCash, { compact: true }), s.minCash < 0],
    ['Ending cash', money(s.endingCash, { compact: true }), s.endingCash < 0],
    ['Break-even', s.operatingBreakEvenMonth ? `M${s.operatingBreakEvenMonth}` : 'None', false],
    ['Funding needed', s.fundingRequired > 0 ? money(s.fundingRequired, { compact: true }) : 'None', s.fundingRequired > 0],
  ] as const;
  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', mt: 2, px: 2, py: 1, borderRadius: 2, bgcolor: SURFACE.panel, border: `1px solid ${SURFACE.lineSoft}`, display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 0.5, alignItems: 'baseline' }} className="no-print" aria-live="polite">
      <Typography variant="caption" color="text.secondary">{project.scenarios.base.label}, {project.setup.months} months:</Typography>
      {items.map(([k, v, bad]) => (
        <Stack key={k} direction="row" spacing={0.75} alignItems="baseline">
          <Typography variant="caption" color="text.secondary">{k}</Typography>
          <Typography sx={{ fontFamily: FONT_STAT, fontWeight: 600, fontSize: '1.1rem', color: bad ? USD.poppy : 'text.primary' }}>{v}</Typography>
        </Stack>
      ))}
    </Box>
  );
}

function FileMenu({ onOpenFile, onProjects, onToast }: { onOpenFile: () => void; onProjects: () => void; onToast: (s: string) => void }) {
  const { project, results, current, scenario, go, loadExample } = useStore();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  return (
    <>
      <Tooltip title="Files and exports"><IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Files and exports"><MoreVert /></IconButton></Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close}>
        <MenuItem onClick={() => { close(); downloadProject(project); onToast('Project file downloaded.'); }}>Download project file</MenuItem>
        <MenuItem onClick={() => { close(); onOpenFile(); }}>Open a project file…</MenuItem>
        <MenuItem onClick={() => { close(); onProjects(); }}>Projects in this browser…</MenuItem>
        <Divider />
        <MenuItem onClick={async () => { close(); onToast('Preparing the Excel workbook…'); await exportExcel(project, results); }}>Export Excel workbook (with instructor summary)</MenuItem>
        <MenuItem onClick={() => { close(); exportProjectionCsv(project, current, project.scenarios[scenario].label); }}>Export projection as CSV</MenuItem>
        <MenuItem onClick={() => { close(); exportRegisterCsv(project); }}>Export assumption register as CSV</MenuItem>
        <MenuItem onClick={() => { close(); go('review', 'summary'); setTimeout(() => window.print(), 400); }}>Print summary</MenuItem>
        <Divider />
        <MenuItem onClick={() => { close(); loadExample(); go('projections', 'dashboard'); }}>Open the TimeScene example</MenuItem>
      </Menu>
    </>
  );
}

function NewVenture({ onDone }: { onDone: () => void }) {
  const { createProject } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ModelKind>('software');
  return (
    <Stack spacing={2}>
      <TextField label="Venture name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <TextField select label="Primary business model" value={kind} onChange={(e) => setKind(e.target.value as ModelKind)} helperText={getModule(kind).description}>
        {MODEL_ORDER.map((k) => <MenuItem key={k} value={k}>{getModule(k).label}</MenuItem>)}
      </TextField>
      <Typography variant="body2" color="text.secondary">The new model starts with illustrative example values so it calculates right away. Each is marked “Example” until you replace or confirm it.</Typography>
      <Button variant="contained" onClick={() => { createProject(kind, name.trim() || 'My venture'); onDone(); }}>Create my model</Button>
    </Stack>
  );
}

function WelcomeDialog({ open, onClose, onOpenFile }: { open: boolean; onClose: () => void; onOpenFile: () => void }) {
  const { loadExample, go } = useStore();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Build a financial model for your venture</DialogTitle>
      <DialogContent>
        <Typography className="prose" sx={{ mb: 2 }}>{PRINCIPLE}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          You will choose a business model, enter the assumptions behind it, and see a monthly projection of revenue, costs and cash. Nothing is sent to a server: your work stays in this browser until you download it.
        </Typography>
        <NewVenture onDone={onClose} />
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Button startIcon={<FolderOpen />} onClick={() => { onClose(); onOpenFile(); }}>Open a project file</Button>
        <Button onClick={() => { loadExample(); go('projections', 'dashboard'); onClose(); }}>Explore the TimeScene example first</Button>
      </DialogActions>
    </Dialog>
  );
}

function ProjectsDialog({ open, onClose, onOpenFile }: { open: boolean; onClose: () => void; onOpenFile: () => void }) {
  const { projects, project, openProject, removeProject } = useStore();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Projects in this browser</DialogTitle>
      <DialogContent>
        {creating ? <NewVenture onDone={() => { setCreating(false); onClose(); }} /> : (
          <List>
            {projects.map((p) => (
              <Stack key={p.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
                <ListItemButton selected={p.id === project.id} onClick={() => { openProject(p.id); onClose(); }} sx={{ borderRadius: 2 }}>
                  <ListItemText primary={p.name} secondary={`${getModule(p.kind).short} · last changed ${new Date(p.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`} />
                </ListItemButton>
                {confirm === p.id ? (
                  <Button color="error" size="small" onClick={() => { removeProject(p.id); setConfirm(null); }}>Delete</Button>
                ) : (
                  <Button size="small" color="inherit" disabled={p.id === project.id} onClick={() => setConfirm(p.id)}>Remove</Button>
                )}
              </Stack>
            ))}
            {projects.length === 0 && <Typography color="text.secondary">No saved projects yet.</Typography>}
          </List>
        )}
      </DialogContent>
      {!creating && (
        <DialogActions>
          <Button onClick={() => { onClose(); onOpenFile(); }}>Open a project file</Button>
          <Button variant="contained" onClick={() => setCreating(true)}>New venture</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
