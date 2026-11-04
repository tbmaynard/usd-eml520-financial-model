"""Copy typed "App shows" entries (saved by sheet, line and month) back into a rebuilt workbook."""
import json
import sys

from openpyxl import load_workbook

path, saved_path = sys.argv[1], sys.argv[2]
saved = json.load(open(saved_path, encoding='utf-8'))
wb = load_workbook(path)
done = 0
for e in saved:
    ws = wb[e['sheet']]
    for r in range(1, ws.max_row + 1):
        if ws.cell(r, 2).value == e['line'] and ws.cell(r, 3).value == e['month'] and ws.cell(r, 5).fill.fgColor.rgb in ('00FFFF00', 'FFFFFF00'):
            ws.cell(r, 5).value = e['value']
            done += 1
            break
    else:
        print('not found:', e['sheet'], e['line'], e['month'])
wb.save(path)
print(f'restored {done} of {len(saved)} entries')
