import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { newProject } from '../data/defaults';
import { timesceneProject } from '../data/timescene';
import { runScenario } from '../engine/engine';
import { clone } from '../engine/paths';
import type { ModelKind, Project, ProjectResult, ScenarioId } from '../engine/types';
import { normalizeProject } from './fileio';
import { deleteStored, loadCurrentId, loadIndex, loadProject, saveProject, storageAvailable, type IndexEntry } from './storage';

export type Section = 'setup' | 'model' | 'assumptions' | 'projections' | 'scenarios' | 'review' | 'exit';
export const SECTIONS: { id: Section; label: string; short: string }[] = [
  { id: 'setup', label: 'Venture Setup', short: 'Setup' },
  { id: 'model', label: 'Business Model', short: 'Model' },
  { id: 'assumptions', label: 'Assumptions', short: 'Assumptions' },
  { id: 'projections', label: 'Financial Projections', short: 'Projections' },
  { id: 'scenarios', label: 'Scenarios', short: 'Scenarios' },
  { id: 'review', label: 'Model Review', short: 'Review' },
  { id: 'exit', label: 'Exit Strategy', short: 'Exit' },
];
/** Sections that count toward model progress (Exit Strategy is an ungraded bonus). */
export const GRADED: Section[] = ['setup', 'model', 'assumptions', 'projections', 'scenarios', 'review'];

interface Store {
  project: Project;
  update: (fn: (draft: Project) => void) => void;
  replace: (p: Project) => void;
  scenario: ScenarioId;
  setScenario: (s: ScenarioId) => void;
  results: Record<ScenarioId, ProjectResult>;
  current: ProjectResult;
  section: Section;
  tab: string;
  go: (section: Section, tab?: string) => void;
  savedAt: Date | null;
  saveFailed: boolean;
  storageOk: boolean;
  projects: IndexEntry[];
  openProject: (id: string) => void;
  createProject: (kind: ModelKind, name: string) => void;
  loadExample: () => void;
  removeProject: (id: string) => void;
  firstVisit: boolean;
}

const Ctx = createContext<Store | null>(null);

function initialProject(): { project: Project; firstVisit: boolean } {
  // ?example opens the TimeScene demonstration directly (handy as a shared link).
  if (new URLSearchParams(window.location.search).has('example')) return { project: timesceneProject(), firstVisit: false };
  const id = loadCurrentId();
  if (id) {
    const raw = loadProject(id);
    if (raw) {
      try {
        return { project: normalizeProject(raw), firstVisit: false };
      } catch {
        /* fall through */
      }
    }
  }
  return { project: timesceneProject(), firstVisit: loadIndex().length === 0 };
}

function parseHash(): { section: Section; tab: string } {
  const [s, t] = window.location.hash.replace(/^#\/?/, '').split('/');
  const section = (SECTIONS.find((x) => x.id === s)?.id ?? 'setup') as Section;
  return { section, tab: t ?? '' };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const init = useRef(initialProject());
  const [project, setProject] = useState<Project>(init.current.project);
  const [scenario, setScenario] = useState<ScenarioId>('base');
  const [{ section, tab }, setNav] = useState(parseHash);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [projects, setProjects] = useState<IndexEntry[]>(loadIndex);
  const storageOk = useMemo(storageAvailable, []);
  const dirty = useRef(false);

  useEffect(() => {
    const onHash = () => setNav(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((s: Section, t?: string) => {
    const hash = `#/${s}${t ? `/${t}` : ''}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    setNav({ section: s, tab: t ?? '' });
    window.scrollTo({ top: 0 });
  }, []);

  // Autosave shortly after each change.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      const ok = saveProject(project);
      setSaveFailed(!ok);
      if (ok) setSavedAt(new Date());
      setProjects(loadIndex());
    }, 400);
    return () => clearTimeout(t);
  }, [project]);

  const update = useCallback((fn: (draft: Project) => void) => {
    setProject((prev) => {
      const next = clone(prev);
      fn(next);
      next.updatedAt = new Date().toISOString();
      dirty.current = true;
      return next;
    });
  }, []);

  const replace = useCallback((p: Project) => {
    dirty.current = true;
    setProject({ ...p, updatedAt: p.updatedAt || new Date().toISOString() });
    setScenario('base');
  }, []);

  const openProject = useCallback((id: string) => {
    const raw = loadProject(id);
    if (!raw) return;
    try {
      replace(normalizeProject(raw));
    } catch {
      /* ignore broken entries */
    }
  }, [replace]);

  const createProject = useCallback((kind: ModelKind, name: string) => {
    replace(newProject(kind, name));
    go('setup');
  }, [replace, go]);

  const loadExample = useCallback(() => {
    // Keep an existing edited copy of the example if there is one.
    const raw = loadProject('timescene-demo');
    if (raw) {
      try { replace(normalizeProject(raw)); return; } catch { /* fall back */ }
    }
    replace(timesceneProject());
  }, [replace]);

  const removeProject = useCallback((id: string) => {
    deleteStored(id);
    setProjects(loadIndex());
  }, []);

  const results = useMemo(
    () => ({
      base: runScenario(project, 'base'),
      downside: runScenario(project, 'downside'),
      upside: runScenario(project, 'upside'),
    }),
    [project],
  );

  const value: Store = {
    project, update, replace, scenario, setScenario, results, current: results[scenario],
    section, tab, go, savedAt, saveFailed, storageOk, projects, openProject, createProject, loadExample, removeProject,
    firstVisit: init.current.firstVisit,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** Re-export so pages do not need to know where the reset helper lives. */
export function resetExample(): Project {
  return timesceneProject();
}
