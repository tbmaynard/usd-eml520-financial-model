"""Layout and formula plumbing for the validation workbook.

Each test case is a Case: inputs the tester types into the app, a monthly
calculation grid of live Excel formulas written from the app's documented
behavior (help text, Calculations tab, README), and checkpoints that compare the
grid with what the tester reads off the app.

Formulas are written as Python functions of a column context `c`, so a row can
refer to inputs (c.I), other rows in the same or another month (c.R, c.LAG,
c.LEAD), running totals (c.CUM) and trailing windows (c.WIN).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable

from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

N = 24  # projection months used by every case
FIRST_COL = 3  # column C holds month 1
TOTAL_COL = FIRST_COL + N  # column AA holds the total

FONT = 'Arial'
BLUE = Font(name=FONT, color='0000FF')
BLACK = Font(name=FONT)
BOLD = Font(name=FONT, bold=True)
TITLE = Font(name=FONT, bold=True, size=14)
H2 = Font(name=FONT, bold=True, size=11, color='FFFFFF')
GREY = Font(name=FONT, color='666666', italic=True)
YELLOW = PatternFill('solid', fgColor='FFFF00')
HEAD_FILL = PatternFill('solid', fgColor='003B70')  # USD navy
SUB_FILL = PatternFill('solid', fgColor='DCE6F0')
CONV_FILL = PatternFill('solid', fgColor='FCE4D6')
THIN = Side(style='thin', color='BFBFBF')
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical='top')

FMT = {
    'usd': '#,##0.00;(#,##0.00);-',
    'count': '#,##0.00;(#,##0.00);-',
    'pct': '0.00;(0.00);-',
    'month': '0',
    'days': '0',
    'months': '0',
    'hours': '#,##0.##',
    'text': '@',
}


def col(i: int) -> str:
    return get_column_letter(i)


def mcol(m: int) -> str:
    """Column letter of projection month m (1-based)."""
    return col(FIRST_COL + m - 1)


@dataclass
class Input:
    key: str
    section: str
    label: str
    value: object
    unit: str = 'usd'
    note: str = ''
    row: int = 0


@dataclass
class Row:
    key: str
    label: str
    fn: Callable | None  # fn(c) -> formula string (without '=') ; None for headers
    unit: str = 'usd'
    total: bool = False
    note: str = ''
    row: int = 0


@dataclass
class Scalar:
    key: str
    label: str
    fn: Callable  # fn(s) -> formula string, s has I/ROW/ADDR helpers
    unit: str = 'usd'
    note: str = ''
    row: int = 0


@dataclass
class Check:
    where: str  # where in the app to read it
    line: str  # the exact line label in the app
    target: str  # row key or scalar key
    month: object  # int, 'Total', or None for scalars
    unit: str = 'usd'
    conv: str = ''  # convention id(s) this check depends on, '' if documented
    note: str = ''
    sign: int = 1  # -1 when the app shows the value as a negative (cash outflows)
    src: tuple = ()  # how to find the value in the engine output, for the pre-check
    row: int = 0


class Case:
    def __init__(self, sheet: str, title: str, purpose: str, steps: list[str]):
        self.sheet = sheet
        self.title = title
        self.purpose = purpose
        self.steps = steps
        self.inputs: list[Input] = []
        self.rows: list[Row] = []
        self.scalars: list[Scalar] = []
        self.checks: list[Check] = []
        self.project: dict = {}
        self.conventions: list[str] = []
        self.blocks: list[tuple[str, list]] = []  # optional extra checkpoint blocks: (heading, checks)

    # ---- registration -------------------------------------------------
    def inp(self, key, section, label, value, unit='usd', note=''):
        self.inputs.append(Input(key, section, label, value, unit, note))
        return key

    def head(self, label):
        self.rows.append(Row('_h%d' % len(self.rows), label, None))

    def row(self, key, label, fn, unit='usd', total=False, note=''):
        self.rows.append(Row(key, label, fn, unit, total, note))

    def scalar(self, key, label, fn, unit='usd', note=''):
        self.scalars.append(Scalar(key, label, fn, unit, note))

    def check(self, where, line, target, month, unit='usd', conv='', note='', sign=1, src=()):
        self.checks.append(Check(where, line, target, month, unit, conv, note, sign, src))

    # ---- lookups used while writing ------------------------------------
    def addr_input(self, key):
        for i in self.inputs:
            if i.key == key:
                return f'$C${i.row}'
        raise KeyError(f'{self.sheet}: unknown input {key}')

    def row_of(self, key):
        for r in self.rows:
            if r.key == key:
                return r.row
        raise KeyError(f'{self.sheet}: unknown row {key}')

    def scalar_addr(self, key):
        for s in self.scalars:
            if s.key == key:
                return f'$C${s.row}'
        raise KeyError(f'{self.sheet}: unknown scalar {key}')

    def has_row(self, key):
        return any(r.key == key for r in self.rows)


class Ctx:
    """Formula helpers for one month column."""

    def __init__(self, case: Case, m: int, month_row: int):
        self.case = case
        self.m = m
        self.mrow = month_row

    @property
    def M(self):
        return f'{mcol(self.m)}${self.mrow}'

    def I(self, key):
        return self.case.addr_input(key)

    def S(self, key):
        return self.case.scalar_addr(key)

    def ROW(self, key):
        r = self.case.row_of(key)
        return f'${mcol(1)}${r}:${mcol(N)}${r}'

    def R(self, key, off=0):
        m = self.m + off
        if m < 1 or m > N:
            return '0'
        return f'{mcol(m)}{self.case.row_of(key)}'

    def LAG(self, key, expr):
        """Value of row `key` `expr` months earlier (expr may reference inputs); 0 before month 1."""
        return f'IF({self.M}-({expr})>=1,INDEX({self.ROW(key)},{self.M}-({expr})),0)'

    def LEAD(self, key, expr):
        return f'IF({self.M}+({expr})<={N},INDEX({self.ROW(key)},{self.M}+({expr})),0)'

    def CUM(self, key):
        r = self.case.row_of(key)
        return f'SUM(${mcol(1)}{r}:{mcol(self.m)}{r})'

    def WIN(self, key, n_expr):
        """Sum of row `key` over the last n months including this one."""
        return f'SUM(INDEX({self.ROW(key)},MAX(1,{self.M}-({n_expr})+1)):INDEX({self.ROW(key)},{self.M}))'

    def DELAY(self, key, days):
        """Amount from row `key` landing this month after a delay of `days` (30-day months):
        (1 - f) lands m months later and f lands m + 1 months later, m = INT(d/30), f = MOD(d,30)/30."""
        return (f'({self.LAG(key, f"INT({days}/30)")}*(1-MOD({days},30)/30)'
                f'+{self.LAG(key, f"INT({days}/30)+1")}*MOD({days},30)/30)')

    def WHOLE(self, cum_key):
        """Whole units counted when the running expected total reaches the next whole number."""
        prev = self.R(cum_key, -1)
        return f'INT({self.R(cum_key)}+1E-9)-INT({prev}+1E-9)'


class SCtx:
    """Helpers for scalar (non-monthly) formulas."""

    def __init__(self, case: Case):
        self.case = case

    def I(self, key):
        return self.case.addr_input(key)

    def S(self, key):
        return self.case.scalar_addr(key)

    def ROW(self, key):
        r = self.case.row_of(key)
        return f'${mcol(1)}${r}:${mcol(N)}${r}'

    def AT(self, key, m):
        return f'{mcol(m)}{self.case.row_of(key)}'


# ---------------------------------------------------------------------------
# Writing a case to a worksheet

def tol_formula(unit, exp_cell):
    if unit == 'usd':
        return '1'
    if unit == 'pct':
        return '0.5'
    if unit == 'count':
        return f'IF(ABS({exp_cell})>=10,0.5,0.05)'
    return '0.01'


def write_case(wb, case: Case, conv_index: dict):
    ws = wb.create_sheet(case.sheet)
    ws.sheet_view.showGridLines = False
    ws.column_dimensions['A'].width = 5
    ws.column_dimensions['B'].width = 58
    for i in range(FIRST_COL, TOTAL_COL + 1):
        ws.column_dimensions[col(i)].width = 14
    ws.freeze_panes = 'C1'

    r = 1
    ws.cell(r, 1, case.title).font = TITLE
    r += 1
    ws.cell(r, 2, case.purpose).font = GREY
    ws.cell(r, 2).alignment = WRAP
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=10)
    ws.row_dimensions[r].height = 15 * max(1, len(case.purpose) // 140 + 1)
    r += 2

    def band(text, last=11):
        nonlocal r
        for ci in range(1, last + 1):
            ws.cell(r, ci).fill = HEAD_FILL
        ws.cell(r, 1, text).font = H2
        r += 1

    band('STEP 1. SET UP THE PROJECT IN THE APP')
    for i, s in enumerate(case.steps, 1):
        ws.cell(r, 1, i).font = BLACK
        ws.cell(r, 2, s).font = BLACK
        ws.cell(r, 2).alignment = WRAP
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=10)
        ws.row_dimensions[r].height = 15 * max(1, len(s) // 150 + 1)
        r += 1
    r += 1

    band('STEP 2. TYPE THESE INPUTS (blue values; change one here and every expected value below recalculates)')
    for ci, h in enumerate(['', 'Where in the app  ›  field', 'Value', 'Unit', 'Notes'], 1):
        c_ = ws.cell(r, ci, h)
        c_.font = BOLD
        c_.fill = SUB_FILL
    r += 1
    section = None
    for inp in case.inputs:
        if inp.section != section:
            section = inp.section
            ws.cell(r, 2, section).font = BOLD
            r += 1
        inp.row = r
        ws.cell(r, 2, '    ' + inp.label).font = BLACK
        v = ws.cell(r, 3, inp.value)
        v.font = BLUE
        if isinstance(inp.value, (int, float)):
            v.number_format = '#,##0.####'
        ws.cell(r, 4, {'usd': '$', 'pct': '%', 'count': 'count', 'days': 'days', 'months': 'months', 'month': 'month #',
                       'hours': 'hours', 'text': '', 'ratio': '×'}.get(inp.unit, inp.unit)).font = GREY
        if inp.note:
            ws.cell(r, 5, inp.note).font = GREY
        r += 1
    r += 1

    # Reserve checkpoint rows now (their formulas need grid rows, written later).
    band('STEP 3. READ THESE OFF THE APP AND TYPE THEM IN THE YELLOW COLUMN (type the number exactly as shown, including the minus sign)')
    heads = ['#', 'Where in the app  ›  line', 'Month', 'Expected', 'App shows', 'Difference', 'Tolerance', 'Result', 'Convention', 'Notes']
    for ci, h in enumerate(heads, 1):
        c_ = ws.cell(r, ci, h)
        c_.font = BOLD
        c_.fill = SUB_FILL
    r += 1
    check_rows = []
    groups = [(getattr(case, 'checks_heading', ''), case.checks)] + case.blocks
    n = 0
    for heading, checks in groups:
        if heading:
            ws.cell(r, 2, heading).font = BOLD
            r += 1
        for ch in checks:
            n += 1
            ch.row = r
            check_rows.append((n, ch))
            r += 1
    case.check_first = check_rows[0][1].row if check_rows else r
    case.check_last = check_rows[-1][1].row if check_rows else r
    r += 1

    if case.scalars:
        band('SUMMARY VALUES (expected, computed from the grid below)')
        for s in case.scalars:
            s.row = r
            ws.cell(r, 2, s.label).font = BLACK
            r += 1
        r += 1

    band('EXPECTED MONTHLY CALCULATION (formulas written from the documented behavior; you do not need to edit anything here)', TOTAL_COL)
    month_row = r
    ws.cell(r, 2, 'Month').font = BOLD
    for m in range(1, N + 1):
        c_ = ws.cell(r, FIRST_COL + m - 1, m)
        c_.font = BOLD
        c_.fill = SUB_FILL
    ws.cell(r, TOTAL_COL, 'Total').font = BOLD
    ws.cell(r, TOTAL_COL).fill = SUB_FILL
    r += 1
    for row in case.rows:
        row.row = r
        r += 1

    # grid formulas
    for row in case.rows:
        if row.fn is None:
            ws.cell(row.row, 2, row.label).font = BOLD
            continue
        ws.cell(row.row, 2, row.label).font = BLACK
        if row.note:
            ws.cell(row.row, 2).comment = Comment(row.note, 'validation')
        for m in range(1, N + 1):
            c = Ctx(case, m, month_row)
            f = row.fn(c)
            cell = ws.cell(row.row, FIRST_COL + m - 1, f'={f}' if isinstance(f, str) else f)
            cell.number_format = FMT.get(row.unit, FMT['usd'])
            cell.font = BLACK
        if row.total:
            cell = ws.cell(row.row, TOTAL_COL, f'=SUM({mcol(1)}{row.row}:{mcol(N)}{row.row})')
            cell.number_format = FMT.get(row.unit, FMT['usd'])
            cell.font = BOLD

    sc = SCtx(case)
    for s in case.scalars:
        cell = ws.cell(s.row, 3, '=' + s.fn(sc))
        cell.number_format = FMT.get(s.unit, FMT['usd'])
        if s.note:
            ws.cell(s.row, 4, s.note).font = GREY

    # checkpoint formulas
    for n, ch in check_rows:
        rr = ch.row
        ws.cell(rr, 1, n).font = BLACK
        ws.cell(rr, 2, f'{ch.where}  ›  {ch.line}').font = BLACK
        ws.cell(rr, 2).alignment = Alignment(wrap_text=True, vertical='top')
        if len(ch.where) + len(ch.line) > 60:
            ws.row_dimensions[rr].height = 30
        if ch.month is None:
            ws.cell(rr, 3, '').font = BLACK
            src = case.scalar_addr(ch.target)
            exp = f'={"-" if ch.sign < 0 else ""}{src}'
        else:
            mc = ws.cell(rr, 3, ch.month)
            mc.font = BLUE
            mc.alignment = Alignment(horizontal='center')
            gr = case.row_of(ch.target)
            rng = f'${mcol(1)}${gr}:${mcol(N)}${gr}'
            sign = '-' if ch.sign < 0 else ''
            exp = f'={sign}IF($C{rr}="Total",SUM({rng}),INDEX({rng},$C{rr}))'
        e = ws.cell(rr, 4, exp)
        e.number_format = FMT.get(ch.unit, FMT['usd'])
        e.font = BLACK
        a = ws.cell(rr, 5)
        a.fill = YELLOW
        a.border = BOX
        a.number_format = FMT.get(ch.unit, FMT['usd'])
        ws.cell(rr, 6, f'=IF(E{rr}="","",E{rr}-D{rr})').number_format = FMT.get(ch.unit, FMT['usd'])
        ws.cell(rr, 7, '=' + tol_formula(ch.unit, f'D{rr}')).number_format = '0.00'
        ws.cell(rr, 8, f'=IF(E{rr}="","",IF(ABS(E{rr}-D{rr})<=G{rr},"PASS",IF(I{rr}<>"","CONVENTION","FAIL")))').font = BOLD
        if ch.conv:
            cc = ws.cell(rr, 9, ch.conv)
            cc.fill = CONV_FILL
            cc.font = BLACK
        if ch.note:
            ws.cell(rr, 10, ch.note).font = GREY
        for ci in range(1, 11):
            ws.cell(rr, ci).border = BOX

    # conditional colors for results
    from openpyxl.formatting.rule import CellIsRule
    rng = f'H{case.check_first}:H{case.check_last}'
    ws.conditional_formatting.add(rng, CellIsRule(operator='equal', formula=['"PASS"'], fill=PatternFill('solid', fgColor='C6EFCE')))
    ws.conditional_formatting.add(rng, CellIsRule(operator='equal', formula=['"FAIL"'], fill=PatternFill('solid', fgColor='FFC7CE')))
    ws.conditional_formatting.add(rng, CellIsRule(operator='equal', formula=['"CONVENTION"'], fill=CONV_FILL))

    for cid in {c.strip() for ch in case.checks + [x for _, b in case.blocks for x in b] for c in ch.conv.split(',') if c.strip()}:
        conv_index.setdefault(cid, []).append(case.sheet)
    return ws
