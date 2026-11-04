# End-user validation tests

`validation-tests.xlsx` holds thirteen test projects: one per business model, a mixed case (three streams, one launching in month 4), shared costs and funding (including a sales role), income tax (three variants), scenarios, a new project with the starting example values left in, and the Exit Strategy page.

For each sheet:

1. Type the blue inputs into the app, or open the matching file from `projects/`.
2. Read the listed results off the app and type them into the yellow column.
3. Each row then shows PASS, FAIL or CONVENTION, and the Overview sheet adds them up.

The expected values are live Excel formulas written from the app's documentation: input help text, the Calculations tab, the README's simplifications, and the help copy on the editors. They are not taken from the engine code. Where the documentation leaves a choice open, the check carries a convention id. The Conventions sheet states the reading the workbook uses.

## Rebuilding

The workbook and project files are generated, so edit the generator rather than the files:

```bash
cd docs/validation/build
python build.py                                   # writes ../validation-tests.xlsx and cases.json
powershell -File recalc.ps1 -Path ../validation-tests.xlsx   # Excel recalculates and stores the values
python scan.py ../validation-tests.xlsx           # lists any formula errors
cd ../../..
npx vite-node docs/validation/build/make-projects.ts             # writes projects/*.vfm.json
npx vite-node docs/validation/build/make-projects.ts --precheck  # also writes build/precheck.json with the engine's values
```

- Rebuilding overwrites the yellow entries. Save them first and copy them back afterwards (entries are matched by sheet, line and month):
  `python restore.py ../validation-tests.xlsx saved-entries.json`. `saved-entries.json` currently holds the first Software run.
- `cases.py` defines the test cases. `framework.py` handles layout and the formula helpers.
- `app-spec.txt` is a dump of the in-app documentation (help text and formula descriptions) that the formulas were written from. If that documentation changes, regenerate this file and review the affected cases.
