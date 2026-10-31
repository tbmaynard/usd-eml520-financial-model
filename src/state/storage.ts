// Browser-local persistence. Everything lives in this browser's localStorage;
// there is no server. Every access is wrapped because storage can be disabled,
// full, or cleared at any time.

import type { ModelKind, Project } from '../engine/types';

const INDEX = 'vfm.index.v1';
const CURRENT = 'vfm.current.v1';
const proj = (id: string) => `vfm.project.v1.${id}`;

export interface IndexEntry {
  id: string;
  name: string;
  kind: ModelKind;
  updatedAt: string;
}

export function storageAvailable(): boolean {
  try {
    const k = 'vfm.test';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function loadIndex(): IndexEntry[] {
  try {
    const raw = localStorage.getItem(INDEX);
    const list = raw ? (JSON.parse(raw) as IndexEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeIndex(list: IndexEntry[]) {
  localStorage.setItem(INDEX, JSON.stringify(list));
}

/** Returns false when the browser refused to save. */
export function saveProject(p: Project): boolean {
  try {
    localStorage.setItem(proj(p.id), JSON.stringify(p));
    const list = loadIndex().filter((e) => e.id !== p.id);
    list.unshift({ id: p.id, name: p.setup.name || 'Untitled venture', kind: p.streams[0]?.kind ?? 'software', updatedAt: p.updatedAt });
    writeIndex(list);
    localStorage.setItem(CURRENT, p.id);
    return true;
  } catch {
    return false;
  }
}

export function loadProject(id: string): unknown | null {
  try {
    const raw = localStorage.getItem(proj(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadCurrentId(): string | null {
  try {
    return localStorage.getItem(CURRENT);
  } catch {
    return null;
  }
}

export function deleteStored(id: string): void {
  try {
    localStorage.removeItem(proj(id));
    writeIndex(loadIndex().filter((e) => e.id !== id));
  } catch {
    /* ignore */
  }
}

export function getFlag(key: string): string | null {
  try {
    return localStorage.getItem(`vfm.flag.${key}`);
  } catch {
    return null;
  }
}

export function setFlag(key: string, value: string): void {
  try {
    localStorage.setItem(`vfm.flag.${key}`, value);
  } catch {
    /* ignore */
  }
}
