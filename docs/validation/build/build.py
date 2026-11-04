"""Build docs/validation/validation-tests.xlsx and the case specs used for project files.

    python build.py

Writes the workbook (formulas only, no cached values) and build/cases.json.
Recalculate afterwards so the expected values are stored in the file.
"""

import json
import os

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from cases import ALL, CONVENTIONS
from framework import BLACK, BOLD, GREY, H2, HEAD_FILL, SUB_FILL, TITLE, WRAP, YELLOW, CONV_FILL, BOX, write_case

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'validation-tests.xlsx')


def main():
    wb = Workbook()
    ov = wb.active
    ov.title = 'Overview'
    cases = [f() for f in ALL]
    conv_index: dict[str, list[str]] = {}
    for c in cases:
        write_case(wb, c, conv_index)
    write_overview(ov, cases)
    write_conventions(wb.create_sheet('Conventions', 1), conv_index)
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for cell in row:
                if cell.font is None or cell.font.name != 'Arial':
                    f = cell.font
                    cell.font = Font(name='Arial', bold=f.bold, italic=f.italic, color=f.color, size=f.size)
    wb.save(OUT)

    spec = []
    for c in cases:
        checks = []
        for heading, group in [('', c.checks)] + c.blocks:
            for ch in group:
                checks.append({'row': ch.row, 'where': ch.where, 'line': ch.line, 'month': ch.month, 'unit': ch.unit,
                               'conv': ch.conv, 'src': list(ch.src)})
        spec.append({'sheet': c.sheet, 'file': file_name(c), 'project': c.project, 'checks': checks})
    with open(os.path.join(HERE, 'cases.json'), 'w', encoding='utf-8') as f:
        json.dump(spec, f, indent=2)
    print('wrote', os.path.abspath(OUT))


def file_name(c):
    n = c.sheet.split(' ', 1)
    slug = n[1].lower().replace(' (bonus)', '').replace(' ', '-').replace('/', '-')
    return f'{n[0]}-{slug}.vfm.json'


def write_overview(ws, cases):
    ws.sheet_view.showGridLines = False
    ws.column_dimensions['A'].width = 4
    ws.column_dimensions['B'].width = 30
    for c in 'CDEFGH':
        ws.column_dimensions[c].width = 13
    ws.column_dimensions['I'].width = 60
    r = 1
    ws.cell(r, 2, 'Venture Financial Model: end-user validation tests').font = TITLE
    r += 2
    intro = [
        'Purpose. Each numbered sheet is one test project. You type its inputs into the app as a student would, read selected results off the app, and type them into the yellow '
        'column. The sheet compares them with expected values and marks each one PASS, FAIL or CONVENTION.',
        'Independence. The expected values are live Excel formulas written from what the app documents: the help text on every input, the formulas on the Calculations tab and '
        'behind each ƒ button, the README’s list of simplifications, and the help copy on the Team, Expenses, Funding and Tax editors. They were not copied from the app’s calculation '
        'code. Where that documentation leaves a choice open, the check is tagged with a convention (see the Conventions sheet).',
        'Live formulas. Every expected value recalculates if you change a blue input on the sheet, so you can try your own variations; change the same value in the app too.',
        'Project files. docs/validation/projects/ holds a .vfm.json file for every sheet with the same inputs, if you want to skip typing for a case (Open project in the app). '
        'Typing at least a few cases yourself is worthwhile because it tests data entry, adding rows and the stream options as well.',
        'Rounding. The app shows whole dollars, whole percents, and counts of 10 or more as whole numbers, so the tolerances are $1, 0.5 percentage points, and 0.05 (counts under 10) or 0.5 '
        '(counts of 10 or more, which the tables show as whole numbers). Click a number’s ƒ button in the app for more decimals. Tolerances are in column G of each sheet and can be edited.',
        'Signs. Type values exactly as the app shows them. Cash paid out appears as a negative on the Cash flow tab, and those checkpoints already expect a negative number.',
    ]
    for t in intro:
        ws.cell(r, 2, t).alignment = WRAP
        ws.cell(r, 2).font = BLACK
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=9)
        ws.row_dimensions[r].height = 15 * (len(t) // 135 + 1)
        r += 1
    r += 1
    ws.cell(r, 2, 'Legend').font = BOLD
    r += 1
    legend = [('Blue text', 'A test input: type it into the app. You may change it; expected values follow.', None, '0000FF'),
              ('Yellow cell', 'Type what the app shows.', YELLOW, None),
              ('Black text', 'A formula. Leave it alone.', None, None),
              ('Orange cell', 'A convention id: this value depends on a reading of the documentation listed on the Conventions sheet.', CONV_FILL, None)]
    for a, b, fill, color in legend:
        c = ws.cell(r, 2, a)
        c.font = Font(name='Arial', color=color) if color else BLACK
        if fill:
            c.fill = fill
        ws.cell(r, 3, b).font = BLACK
        r += 1
    r += 1
    ws.cell(r, 2, 'Results').font = BOLD
    r += 1
    ws.cell(r, 2, 'PASS: within tolerance.  FAIL: outside tolerance on a documented behavior; worth investigating.  CONVENTION: outside tolerance on a check that depends on '
                  'an open reading; decide which reading the app should follow, then fix either the app, its help text, or this workbook.').alignment = WRAP
    ws.cell(r, 2).font = BLACK
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=9)
    ws.row_dimensions[r].height = 32
    r += 2
    heads = ['Sheet', 'Checks', 'Entered', 'PASS', 'FAIL', 'CONVENTION', 'Still blank', 'What it covers']
    for i, h in enumerate(heads, 2):
        c = ws.cell(r, i, h)
        c.font = Font(name='Arial', bold=True, color='FFFFFF')
        c.fill = HEAD_FILL
    r += 1
    first = r
    for case in cases:
        q = f"'{case.sheet}'!"
        lo, hi = case.check_first, case.check_last
        ws.cell(r, 2, case.sheet).hyperlink = f"#'{case.sheet}'!A1"
        ws.cell(r, 2).font = Font(name='Arial', color='0563C1', underline='single')
        ws.cell(r, 3, f'=COUNTA({q}B{lo}:B{hi})-COUNTBLANK({q}D{lo}:D{hi})+COUNTBLANK({q}D{lo}:D{hi})-COUNTIF({q}B{lo}:B{hi},"")')
        ws.cell(r, 3).value = f'=COUNT({q}A{lo}:A{hi})'
        ws.cell(r, 4, f'=COUNT({q}E{lo}:E{hi})')
        ws.cell(r, 5, f'=COUNTIF({q}H{lo}:H{hi},"PASS")')
        ws.cell(r, 6, f'=COUNTIF({q}H{lo}:H{hi},"FAIL")')
        ws.cell(r, 7, f'=COUNTIF({q}H{lo}:H{hi},"CONVENTION")')
        ws.cell(r, 8, f'=C{r}-D{r}')
        ws.cell(r, 9, case.title.split('. ', 1)[1]).alignment = Alignment(wrap_text=True)
        for ci in range(2, 10):
            ws.cell(r, ci).border = BOX
            if ci != 2:
                ws.cell(r, ci).font = BLACK
        r += 1
    ws.cell(r, 2, 'Total').font = BOLD
    for ci, L in zip(range(3, 9), 'CDEFGH'):
        ws.cell(r, ci, f'=SUM({L}{first}:{L}{r - 1})').font = BOLD
    r += 2
    ws.cell(r, 2, 'Not covered here').font = BOLD
    r += 1
    gaps = [
        'Enterprise: the team capacity limit, paid pilots, quarterly or monthly billing, spreading implementation over 12 months, expected-value counting, open opportunities and pilots at start.',
        'Services: contractor payment delays. Software: growth in license sales. Scenarios: sensitivity analysis and the tornado chart.',
        'Exit: private equity, IPO and keep-the-company outcomes; escrow and earn-outs; participating preferred; "What would it take?".',
        'Review prompts, the instructor summary, the Excel export and project-file round trips (open a downloaded file and confirm the numbers are unchanged; worth doing once by hand).',
    ]
    for g in gaps:
        ws.cell(r, 2, '•  ' + g).font = BLACK
        ws.cell(r, 2).alignment = WRAP
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=9)
        ws.row_dimensions[r].height = 30
        r += 1


def write_conventions(ws, conv_index):
    ws.sheet_view.showGridLines = False
    ws.column_dimensions['A'].width = 7
    ws.column_dimensions['B'].width = 42
    ws.column_dimensions['C'].width = 100
    ws.column_dimensions['D'].width = 30
    ws.cell(1, 1, 'Conventions: where the documentation leaves a choice open').font = TITLE
    ws.cell(2, 1, 'Each reading below is the one the workbook uses. A CONVENTION result means the app chose differently: decide which is intended, '
                  'then align the app, its help text, or the workbook.').font = GREY
    r = 4
    for i, h in enumerate(['Id', 'Topic', 'Reading used in this workbook', 'Sheets'], 1):
        c = ws.cell(r, i, h)
        c.font = Font(name='Arial', bold=True, color='FFFFFF')
        c.fill = HEAD_FILL
    r += 1
    for cid, (topic, text) in sorted(CONVENTIONS.items(), key=lambda kv: int(kv[0][1:])):
        ws.cell(r, 1, cid).font = BOLD
        ws.cell(r, 1).fill = CONV_FILL
        ws.cell(r, 2, topic).font = BLACK
        ws.cell(r, 3, text).font = BLACK
        ws.cell(r, 4, ', '.join(sorted(set(conv_index.get(cid, []))))).font = BLACK
        for ci in range(1, 5):
            ws.cell(r, ci).alignment = WRAP
            ws.cell(r, ci).border = BOX
        ws.row_dimensions[r].height = 15 * (len(text) // 95 + 1)
        r += 1


if __name__ == '__main__':
    main()
