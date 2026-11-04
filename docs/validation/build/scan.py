"""List formula errors and empty results in the recalculated workbook."""
import sys

from openpyxl import load_workbook

path = sys.argv[1]
wf = load_workbook(path)
wv = load_workbook(path, data_only=True)
bad = 0
missing = 0
for ws in wf.worksheets:
    v = wv[ws.title]
    for row in ws.iter_rows():
        for c in row:
            if isinstance(c.value, str) and c.value.startswith('='):
                val = v[c.coordinate].value
                if isinstance(val, str) and val.startswith('#'):
                    bad += 1
                    if bad <= 30:
                        print(f'{ws.title}!{c.coordinate}: {val}  {c.value[:160]}')
                elif val is None and 'IF(E' not in c.value:
                    missing += 1
print('errors', bad, 'uncalculated', missing)
