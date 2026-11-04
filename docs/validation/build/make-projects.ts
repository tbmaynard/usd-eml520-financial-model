// Turns build/cases.json into project files the app can open, and (with --precheck)
// runs each project through the app's engine and writes the values it produces for
// every checkpoint to build/precheck.json. The workbook's expected values never come
// from here; this only lets us compare the two.
//
//   npx vite-node docs/validation/build/make-projects.ts [--precheck]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyScenarios, makeStream, newProject } from '../../../src/data/defaults';
import { runScenario } from '../../../src/engine/engine';
import { buildCapTable, defaultExit, evaluateAll, fundingRounds } from '../../../src/engine/exit';
import { projectionTable } from '../../../src/export/csv';
import { FILE_FORMAT } from '../../../src/state/fileio';
import type { Assumption, Project, ScenarioId } from '../../../src/engine/types';

const here = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf-8'));
const BASIS = 'Validation test input';
const A = (v: number): Assumption => ({ v, basis: BASIS, conf: 'benchmark', example: false });
const J = { basis: BASIS, conf: 'benchmark' as const, example: false };

function build(spec: any): Project {
  const sp = spec.project;
  const p = newProject(sp.streams[0].kind, sp.name);
  p.id = 'validation_' + spec.file.replace('.vfm.json', '');
  p.createdAt = p.updatedAt = '2026-11-04T00:00:00.000Z';
  p.setup.startMonth = sp.setup.startMonth;
  p.setup.months = sp.setup.months;
  p.setup.startingCash = A(sp.setup.startingCash);
  p.setup.founderInvestment = A(sp.setup.founderInvestment);
  p.setup.minCashCushion = A(sp.setup.minCashCushion);
  p.streams = sp.streams.map((s: any, i: number) => {
    const st = makeStream(s.kind, s.name, `s${i}`);
    st.options = { ...st.options, ...s.options };
    for (const [k, v] of Object.entries(s.inputs)) st.inputs[k] = A(v as number);
    for (const a of Object.values(st.inputs)) a.example = false;
    return st;
  });
  p.roles = sp.roles.map((r: any) => ({ ...r, ...J }));
  p.expenses = sp.expenses.map((e: any) => ({ ...e, ...J }));
  p.capex = sp.capex.map((c: any) => ({ ...c, ...J }));
  p.funding = sp.funding.map((f: any) => ({ ...f, ...J }));
  p.tax = { enabled: sp.tax.enabled, entity: sp.tax.entity, rate: A(sp.tax.rate), payment: sp.tax.payment, includeOwnerDistributions: sp.tax.includeOwnerDistributions };
  p.scenarios = emptyScenarios();
  for (const id of ['downside', 'upside'] as const) {
    const sc = sp.scenarios[id];
    if (!sc) continue;
    p.scenarios[id].overrides = Object.fromEntries(Object.entries(sc.overrides).map(([k, v]) => [`stream:s0:${k}`, v as number]));
    p.scenarios[id].adjustments = sc.adjustments;
  }
  const ex = defaultExit(p);
  p.exit = { ...ex, ...sp.exit, strategic: { ...ex.strategic, ...(sp.exit.strategic ?? {}) }, acquihire: { ...ex.acquihire, ...(sp.exit.acquihire ?? {}) } };
  return p;
}

function tableValue(p: Project, scenario: ScenarioId, label: string, month: number | 'Total' | null, section?: string): number | null {
  const r = runScenario(p, scenario);
  const lines = projectionTable(r);
  let from = 0;
  if (section) from = lines.findIndex((l) => l.label === `BUSINESS METRICS: ${section}`);
  const line = lines.slice(from).find((l) => l.label === label);
  if (!line) return null;
  if (month === 'Total') return line.values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return line.values[(month ?? p.setup.months) - 1];
}

function precheck(spec: any, p: Project) {
  const out: { row: number; value: number | null; missing?: string }[] = [];
  for (const ch of spec.checks) {
    const [kind, a, b, c] = ch.src;
    let v: number | null = null;
    try {
      if (kind === 'table') v = tableValue(p, 'base', a, ch.month);
      else if (kind === 'stream_metric') v = tableValue(p, 'base', b, ch.month, a);
      else if (kind === 'metric_last') v = tableValue(p, 'base', a, null);
      else if (kind === 'summary') {
        const s = runScenario(p, 'base').summary as any;
        v = s[a] ?? 0;
      } else if (kind === 'compare') {
        const s = runScenario(p, a).summary as any;
        v = b === 'grossMargin' ? s[b] * 100 : (s[b] ?? 0);
      } else if (kind === 'variant') {
        const q = structuredClone(p);
        if (a === 'B') q.tax.payment = 'annual';
        if (a === 'C') { q.tax.entity = 'pass_through'; q.tax.includeOwnerDistributions = true; q.tax.payment = 'quarterly'; }
        v = tableValue(q, 'base', b, ch.month);
      } else if (kind === 'cap') {
        const cap = buildCapTable(p.exit, fundingRounds(p.funding));
        const step = cap.steps[a] as any;
        v = step ? step[b] : null;
        if (v != null && Math.abs(v) <= 1) v *= 100;
      } else if (kind === 'exit' || kind === 'exit3') {
        const q = structuredClone(p);
        if (kind === 'exit3') q.exit.exitYear = 3;
        const all = evaluateAll(q, runScenario(q, 'base')) as any;
        const list = all.outcomes ?? all;
        const o = (Array.isArray(list) ? list : Object.values(list)).find((x: any) => x.kind === a);
        if (o) v = b === 'enterpriseValue' ? o.enterpriseValue : b === 'negtax' ? -o.founder.tax : o.founder[b];
      }
    } catch (e) {
      out.push({ row: ch.row, value: null, missing: String(e) });
      continue;
    }
    out.push({ row: ch.row, value: v, ...(v == null ? { missing: JSON.stringify(ch.src) } : {}) });
  }
  return out;
}

const projDir = join(here, '..', 'projects');
mkdirSync(projDir, { recursive: true });
const pre: Record<string, unknown> = {};
for (const spec of cases) {
  const p = build(spec);
  const doc = { format: FILE_FORMAT, version: 1, exportedAt: '2026-11-04T00:00:00.000Z', project: p };
  writeFileSync(join(projDir, spec.file), JSON.stringify(doc, null, 2) + '\n');
  if (process.argv.includes('--precheck')) pre[spec.sheet] = precheck(spec, p);
}
if (process.argv.includes('--precheck')) writeFileSync(join(here, 'precheck.json'), JSON.stringify(pre, null, 2));
console.log(`wrote ${cases.length} project files to ${projDir}`);
