import { describe, expect, it } from 'vitest';
import { newProject } from '../../data/defaults';
import { timesceneProject } from '../../data/timescene';
import { buildWorkbook } from '../../export/excel';
import { normalizeProject } from '../../state/fileio';
import { runScenario } from '../engine';
import { listAssumptions } from '../paths';
import { reviewModel } from '../review';
import { rankSensitivity, runSensitivity } from '../sensitivity';

const all = (p: ReturnType<typeof timesceneProject>) => ({ base: runScenario(p, 'base'), downside: runScenario(p, 'downside'), upside: runScenario(p, 'upside') });

describe('model review prompts', () => {
  it('asks about the cash shortfall and unreviewed example values in the TimeScene demo', () => {
    const p = timesceneProject();
    const ids = reviewModel(p, all(p)).map((x) => x.id);
    expect(ids).toContain('cash.out');
    expect(ids).toContain('asm.examples');
  });
  it('asks about zero churn', () => {
    const p = newProject('software');
    p.streams[0].inputs.subChurnPct.v = 0;
    expect(reviewModel(p, all(p)).some((x) => x.id.endsWith('.noChurn'))).toBe(true);
  });
  it('never uses verdict language', () => {
    const p = timesceneProject();
    for (const pr of reviewModel(p, all(p))) {
      expect(`${pr.title} ${pr.detail} ${pr.question}`).not.toMatch(/\b(bad business|will fail|not viable|good business)\b/i);
    }
  });
});

describe('sensitivity analysis', () => {
  it('tests every flagged assumption plus the cross-cutting drivers, and ranks them', () => {
    const p = timesceneProject();
    const s = runSensitivity(p);
    const flagged = listAssumptions(p).filter((a) => a.sensitivity).length;
    expect(s.rows.length).toBe(flagged + 3);
    const ranked = rankSensitivity(s.rows, 'minCash', 24);
    expect(ranked[0].swing).toBeGreaterThanOrEqual(ranked[ranked.length - 1].swing);
  });
  it('a higher price improves lowest cash', () => {
    const p = timesceneProject();
    const row = runSensitivity(p).rows.find((r) => r.id.endsWith(':licensePrice'))!;
    expect(row.highResult.minCash).toBeGreaterThan(row.lowResult.minCash);
  });
});

describe('project files', () => {
  it('round-trips a project through JSON without changing results', () => {
    const p = timesceneProject();
    const back = normalizeProject(JSON.parse(JSON.stringify(p)));
    expect(runScenario(back, 'base').summary).toEqual(runScenario(p, 'base').summary);
    expect(back.scenarios.downside.overrides).toEqual(p.scenarios.downside.overrides);
  });
  it('fills in fields missing from older or hand-edited files', () => {
    const p = newProject('manufacturing') as unknown as Record<string, unknown>;
    const stream = (p.streams as { inputs: Record<string, unknown> }[])[0];
    delete stream.inputs.price;
    delete p.tax;
    const back = normalizeProject(p);
    expect(back.streams[0].inputs.price.v).toBeGreaterThan(0);
    expect(back.tax.enabled).toBe(true);
  });
  it('rejects files that are not projects', () => {
    expect(() => normalizeProject({ hello: 'world' })).toThrow(/does not look like/);
  });
});

describe('Excel export', () => {
  it('builds a workbook that opens on the instructor summary', async () => {
    const p = timesceneProject();
    const wb = await buildWorkbook(p, all(p));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Instructor Summary', 'Rubric', 'Projection - Base', 'Projection - Downside', 'Projection - Upside', 'Assumptions', 'Exit (bonus)']);
    expect(String(wb.getWorksheet('Instructor Summary')!.getCell('A1').value)).toContain('TimeScene');
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(10000);
  }, 30000); // loading ExcelJS cold can take several seconds
});
