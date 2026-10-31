import type { Workbook, Worksheet } from 'exceljs';
import { EXIT_KINDS, evaluateAll } from '../engine/exit';
import { getModule } from '../engine/models';
import { getValue, listAssumptions } from '../engine/paths';
import { reviewModel } from '../engine/review';
import { rankSensitivity, runSensitivity } from '../engine/sensitivity';
import type { Project, ProjectResult, ScenarioId } from '../engine/types';
import { CONFIDENCE_LABELS } from '../engine/types';
import { downloadBlob, safeFileName } from '../state/fileio';
import { projectionTable } from './csv';
import { RUBRIC } from './rubric';

const NAVY = 'FF003B70';
const BLUE = 'FF0074C8';
const LIGHT = 'FFE8F2FB';
const MONEY = '"$"#,##0;[Red]-"$"#,##0';

function header(ws: Worksheet, row: number, values: (string | number)[]) {
  const r = ws.getRow(row);
  r.values = values;
  r.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    c.alignment = { vertical: 'middle', wrapText: true };
  });
}

function section(ws: Worksheet, row: number, title: string, span = 6) {
  ws.mergeCells(row, 1, row, span);
  const c = ws.getCell(row, 1);
  c.value = title;
  c.font = { bold: true, size: 13, color: { argb: NAVY } };
  c.border = { bottom: { style: 'thin', color: { argb: NAVY } } };
  return row + 1;
}

function summarySheet(wb: Workbook, p: Project, results: Record<ScenarioId, ProjectResult>) {
  const ws = wb.addWorksheet('Instructor Summary', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 38 }, { width: 18 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 70 }];
  const ids: ScenarioId[] = ['downside', 'base', 'upside'];
  const all = listAssumptions(p);
  const sens = runSensitivity(p);
  const top = rankSensitivity(sens.rows, 'minCash', p.setup.months).slice(0, 5);
  const prompts = reviewModel(p, results, sens.rows);

  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = p.setup.name || 'Untitled venture';
  ws.getCell('A1').font = { bold: true, size: 18, color: { argb: NAVY } };
  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = `Venture financial model · exported ${new Date().toLocaleString('en-US')} · simplified educational projection, not audited statements or tax advice`;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };

  let r = 4;
  r = section(ws, r, 'Venture');
  const info: [string, string][] = [
    ['Description', p.setup.description || '(none)'],
    ['Industry', p.setup.industry || '(none)'],
    ['Business model', p.streams.map((s) => `${s.name}: ${getModule(s.kind).label}`).join('; ')],
    ['Projection', `${p.setup.months} months from ${p.setup.startMonth}`],
    ['Starting cash / founder investment', `${fmt(p.setup.startingCash.v)} / ${fmt(p.setup.founderInvestment.v)}`],
    ['Outside funding', p.funding.length ? p.funding.map((f) => `${f.name} (${f.kind}) ${fmt(f.amount)} in month ${f.month}`).join('; ') : 'None'],
    ['Minimum cash cushion', fmt(p.setup.minCashCushion.v)],
    ['Taxes', p.tax.enabled ? `${p.tax.rate.v}%, ${p.tax.entity === 'c_corp' ? 'C corporation' : 'pass-through'}, paid ${p.tax.payment}` : 'Not modeled'],
    ['Team', p.roles.map((x) => `${x.title} ×${x.count} from M${x.startMonth} at ${fmt(x.monthlyComp)}/mo`).join('; ') || 'None'],
  ];
  for (const [k, v] of info) {
    ws.getCell(r, 1).value = k; ws.getCell(r, 1).font = { bold: true };
    ws.mergeCells(r, 2, r, 6); ws.getCell(r, 2).value = v; ws.getCell(r, 2).alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(r).height = Math.max(15, Math.ceil(v.length / 110) * 15);
    r++;
  }

  r = section(ws, r + 1, 'Results by scenario');
  header(ws, r, ['Measure', '', ...ids.map((id) => p.scenarios[id].label), '']);
  r++;
  const rows: [string, (s: ProjectResult['summary']) => number | string, string?][] = [
    ['Total revenue', (s) => s.totalRevenue, MONEY],
    ['Gross margin', (s) => s.grossMargin ?? '', '0%'],
    ['Operating profit (loss)', (s) => s.totalOperatingProfit, MONEY],
    ['Ending cash', (s) => s.endingCash, MONEY],
    ['Lowest cash', (s) => s.minCash, MONEY],
    ['Month of lowest cash', (s) => s.minCashMonth],
    ['Month cash runs out', (s) => s.firstNegativeCashMonth ?? 'Does not'],
    ['Break-even month (sustained)', (s) => s.operatingBreakEvenMonth ?? 'Not reached'],
    ['Additional funding required', (s) => s.fundingRequired, MONEY],
  ];
  for (const [label, f, numFmt] of rows) {
    ws.getCell(r, 1).value = label;
    ids.forEach((id, k) => { const c = ws.getCell(r, 3 + k); c.value = f(results[id].summary); if (numFmt) c.numFmt = numFmt; });
    r++;
  }
  ws.getCell(r, 1).value = 'What the scenario represents';
  ids.forEach((id, k) => { const c = ws.getCell(r, 3 + k); c.value = id === 'base' ? 'Inputs as entered' : p.scenarios[id].notes || '(not explained)'; c.alignment = { wrapText: true, vertical: 'top' }; });
  ws.getRow(r).height = 45;
  r++;

  r = section(ws, r + 1, 'Support for the assumptions');
  const count = (c: string) => all.filter((a) => a.conf === c).length;
  for (const [k, v] of [
    ['Evidence-based', count('evidence')], ['Benchmark-based', count('benchmark')], ['Speculative', count('speculative')], ['Not yet rated', count('unset')],
    ['Still illustrative example values', all.filter((a) => a.example).length], ['Without a stated basis', all.filter((a) => !a.basis.trim()).length],
  ] as [string, number][]) {
    ws.getCell(r, 1).value = k; ws.getCell(r, 2).value = v; r++;
  }
  r++;
  ws.getCell(r, 1).value = 'Most influential assumptions (effect on lowest cash)'; ws.getCell(r, 1).font = { bold: true }; r++;
  for (const t of top) {
    ws.getCell(r, 1).value = t.label;
    ws.getCell(r, 2).value = t.swing; ws.getCell(r, 2).numFmt = MONEY;
    ws.getCell(r, 3).value = t.assumption ? CONFIDENCE_LABELS[t.assumption.conf] : 'cross-cutting';
    ws.mergeCells(r, 4, r, 6); ws.getCell(r, 4).value = t.assumption?.basis || ''; ws.getCell(r, 4).alignment = { wrapText: true };
    r++;
  }

  r = section(ws, r + 1, 'All assumptions with basis and confidence');
  header(ws, r, ['Assumption', 'Value', 'Group', 'Confidence', 'Example value?', 'Basis']);
  r++;
  for (const a of all) {
    ws.getRow(r).values = [a.label, a.unit === 'pct' ? `${a.value}%` : a.value, a.group, CONFIDENCE_LABELS[a.conf], a.example ? 'yes' : '', a.basis || '(none)'];
    if (a.unit === 'usd') ws.getCell(r, 2).numFmt = MONEY;
    ws.getCell(r, 6).alignment = { wrapText: true, vertical: 'top' };
    if (a.conf === 'speculative' || a.conf === 'unset') ws.getCell(r, 4).font = { color: { argb: 'FFC0504D' } };
    if (r % 2 === 0) ws.getRow(r).eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }; });
    r++;
  }

  r = section(ws, r + 1, 'Review prompts and responses');
  header(ws, r, ['Prompt', '', 'Question', '', '', 'Student response']);
  r++;
  for (const pr of prompts) {
    ws.getCell(r, 1).value = pr.title; ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' };
    ws.mergeCells(r, 1, r, 2);
    ws.mergeCells(r, 3, r, 5); ws.getCell(r, 3).value = pr.question; ws.getCell(r, 3).alignment = { wrapText: true, vertical: 'top' };
    ws.getCell(r, 6).value = p.reviewResponses[pr.id] || '(no response)'; ws.getCell(r, 6).alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(r).height = 48;
    r++;
  }
  r = section(ws, r + 1, 'Reflection: what must be true?');
  ws.mergeCells(r, 1, r + 3, 6);
  ws.getCell(r, 1).value = p.reflection || '(none)';
  ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' };
}

function rubricSheet(wb: Workbook) {
  const ws = wb.addWorksheet('Rubric', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 30 }, { width: 9 }, { width: 55 }, { width: 45 }, { width: 30 }, { width: 9 }, { width: 40 }];
  ws.getCell('A1').value = 'Suggested grading rubric (edit freely)';
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } };
  header(ws, 3, ['Criterion', 'Points', 'Strong work', 'Developing work', 'Where to look', 'Score', 'Comments']);
  let r = 4;
  for (const c of RUBRIC) {
    ws.getRow(r).values = [c.criterion, c.points, c.strong, c.developing, c.where, null, null];
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => { cell.alignment = { wrapText: true, vertical: 'top' }; });
    ws.getRow(r).height = 75;
    ws.getCell(r, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
    r++;
  }
  ws.getCell(r, 1).value = 'Total'; ws.getCell(r, 1).font = { bold: true };
  ws.getCell(r, 2).value = { formula: `SUM(B4:B${r - 1})` };
  ws.getCell(r, 6).value = { formula: `SUM(F4:F${r - 1})` };
  ws.getCell(r, 6).font = { bold: true };
}

function projectionSheet(wb: Workbook, sheetName: string, title: string, p: Project, r: ProjectResult) {
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] });
  ws.getCell('A1').value = `${p.setup.name}: ${title}`;
  ws.getCell('A1').font = { bold: true, size: 13, color: { argb: NAVY } };
  header(ws, 3, ['Line', ...r.rows.map((x) => `M${x.month} ${x.label}`), 'Total']);
  ws.getColumn(1).width = 44;
  for (let i = 2; i <= r.rows.length + 2; i++) ws.getColumn(i).width = 13;
  let row = 4;
  for (const l of projectionTable(r)) {
    if (l.section) {
      ws.getCell(row, 1).value = l.label;
      ws.getCell(row, 1).font = { bold: true, color: { argb: NAVY } };
      row++;
      continue;
    }
    const xl = ws.getRow(row);
    xl.values = [l.label, ...l.values.map((v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null))];
    const n = r.rows.length;
    if (!l.noTotal) {
      const col = (k: number) => ws.getColumn(k).letter;
      ws.getCell(row, n + 2).value = { formula: `SUM(${col(2)}${row}:${col(n + 1)}${row})` };
    }
    const fmtStr = l.unit === 'pct' ? '0"%"' : l.unit === 'count' ? '#,##0.0' : MONEY;
    for (let k = 2; k <= n + 2; k++) ws.getCell(row, k).numFmt = fmtStr;
    if (l.bold) xl.font = { bold: true };
    row++;
  }
}

function assumptionsSheet(wb: Workbook, p: Project) {
  const ws = wb.addWorksheet('Assumptions');
  ws.columns = [{ header: 'Group', width: 36 }, { header: 'Assumption', width: 44 }, { header: 'Base value', width: 14 }, { header: 'Downside', width: 14 }, { header: 'Upside', width: 14 }, { header: 'Unit', width: 9 }, { header: 'Confidence', width: 18 }, { header: 'Example?', width: 10 }, { header: 'Basis', width: 70 }];
  header(ws, 1, ['Group', 'Assumption', 'Base value', p.scenarios.downside.label, p.scenarios.upside.label, 'Unit', 'Confidence', 'Example?', 'Basis']);
  for (const a of listAssumptions(p)) {
    const d = p.scenarios.downside.overrides[a.path];
    const u = p.scenarios.upside.overrides[a.path];
    ws.addRow([a.group, a.label, getValue(p, a.path) ?? a.value, d ?? '', u ?? '', a.unit === 'pct' ? '%' : a.unit, CONFIDENCE_LABELS[a.conf], a.example ? 'yes' : '', a.basis]);
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function exitSheet(wb: Workbook, p: Project, results: Record<ScenarioId, ProjectResult>) {
  const ws = wb.addWorksheet('Exit (bonus)', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 44 }, ...EXIT_KINDS.map(() => ({ width: 20 }))];
  const { cap, base, outcomes } = evaluateAll(p, results.base);
  const s = p.exit;
  ws.getCell('A1').value = 'Exit Strategy (bonus, not graded): illustrative only, not financial, legal or tax advice';
  ws.getCell('A1').font = { bold: true, size: 13, color: { argb: NAVY } };
  const who = s.focus === 'all' || !s.founders.some((f) => f.id === s.focus) ? 'All founders combined' : s.founders.find((f) => f.id === s.focus)!.name;
  ws.getCell('A2').value = `Take-home for: ${who} · exit in year ${s.exitYear} · exit revenue ${fmt(base.exitRevenue)} · EBITDA ${fmt(base.exitEbitda)} · California taxes${s.qsbs && p.tax.entity === 'c_corp' ? ' · QSBS on' : ''}`;
  let r = section(ws, 4, 'Outcomes by exit', 6);
  header(ws, r, ['', ...outcomes.map((o) => o.title)]);
  r++;
  const rows: [string, (o: (typeof outcomes)[number]) => number][] = [
    ['Headline price (enterprise value)', (o) => o.enterpriseValue],
    ['Founder share at headline price (gross)', (o) => o.founder.gross],
    ['Cash at closing', (o) => o.founder.cashAtClose],
    ['Cash later (escrow, earn-out, payouts)', (o) => o.founder.cashLater],
    ['Retention pay', (o) => o.founder.retention],
    ['Stock (taxed when sold)', (o) => o.founder.stock],
    ['Rollover value at second bite', (o) => o.founder.rolloverFuture],
    ['Taxes', (o) => -o.founder.tax],
    ['Expected take-home', (o) => o.founder.net],
  ];
  for (const [label, f] of rows) {
    ws.getCell(r, 1).value = label;
    outcomes.forEach((o, k) => { const c = ws.getCell(r, 2 + k); c.value = Math.round(f(o)); c.numFmt = MONEY; });
    if (label === 'Expected take-home') ws.getRow(r).font = { bold: true };
    r++;
  }
  r = section(ws, r + 1, 'Cap table at exit (fully diluted)', 6);
  header(ws, r, ['Holder', 'Shares', 'Ownership', 'Invested', 'Preference', '']);
  r++;
  for (const h of cap.holders) {
    ws.getRow(r).values = [h.name, Math.round(h.shares), h.shares / cap.totalShares, h.invested || null, h.pref || null];
    ws.getCell(r, 2).numFmt = '#,##0'; ws.getCell(r, 3).numFmt = '0.0%'; ws.getCell(r, 4).numFmt = MONEY; ws.getCell(r, 5).numFmt = MONEY;
    r++;
  }
}

function fmt(x: number) {
  return `$${Math.round(x).toLocaleString('en-US')}`;
}

export async function buildWorkbook(p: Project, results: Record<ScenarioId, ProjectResult>): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Venture Financial Model';
  wb.created = new Date();
  summarySheet(wb, p, results);
  rubricSheet(wb);
  const sheet = { base: 'Projection - Base', downside: 'Projection - Downside', upside: 'Projection - Upside' };
  for (const id of ['base', 'downside', 'upside'] as const) projectionSheet(wb, sheet[id], p.scenarios[id].label, p, results[id]);
  assumptionsSheet(wb, p);
  exitSheet(wb, p, results);
  return wb;
}

export async function exportExcel(p: Project, results: Record<ScenarioId, ProjectResult>): Promise<void> {
  const wb = await buildWorkbook(p, results);
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeFileName(p.setup.name)}-financial-model.xlsx`);
}
