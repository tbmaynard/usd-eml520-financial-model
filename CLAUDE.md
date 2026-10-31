# CLAUDE.md

Context for Claude Code sessions in this repository.

## What this is

A browser-only venture financial modeling app for EML 520 (graduate technology entrepreneurship, University of San Diego). Trevor Maynard is the **instructor**. Students use it in week 5 of a 7-week course; they already have a business idea and some research. It is a class tool, not a commercial product. TimeScene appears only as the illustrative demonstration project.

- Live: https://tbmaynard.github.io/usd-eml520-financial-model/ (`?example` opens the TimeScene demo)
- Deploys automatically: every push to `main` runs the tests, builds, and publishes to GitHub Pages (`.github/workflows/deploy.yml`). A failing test blocks the deploy.
- The original specification is the brief Trevor wrote; the README covers features, architecture, limitations and the hand-calculated test cases.

## Commands

```bash
npm run dev       # http://localhost:5280/usd-eml520-financial-model/
npm test          # Vitest, engine and export tests
npm run build     # tsc + vite build
npm run preview   # http://localhost:4280/usd-eml520-financial-model/
```

**Never use ports 5173 or 8000**: they are reserved for another local project. Ports here are fixed with `strictPort`.

## Architecture in one paragraph

`src/engine/` is pure TypeScript with no UI and carries all the math. Each business model in `src/engine/models/` turns its own drivers into a common `StreamResult`; `engine.ts` adds team, expenses, equipment, funding, loans and tax and builds the monthly income statement, cash flow and balances. Scenarios override assumptions by path (`paths.ts`), never totals. `sensitivity.ts`, `review.ts` and `exit.ts` (bonus page) build on the engine. `src/state/` holds browser storage, project files (`.vfm.json`) and the React store; `src/export/` holds CSV, the Excel workbook and the rubric; `src/ui/` holds the MUI pages. Keep calculation out of components, and cover engine changes with tests (hand-calculated where possible, plus the reconciliation identities in `engine.test.ts`).

## Decisions already made

- Dark mode only. USD brand colors and fonts (Sofia Sans for UI, Spectral for explanatory prose), no logos. Chart colors are USD hues stepped into a validated dark-mode palette; see the comment in `src/ui/theme.ts` before changing them.
- Seven business models, including a combined Software model (subscriptions + licenses with support contracts + projects) and Enterprise/Government with stage delays. Enterprise and licensing deals count as **whole deals** by default.
- Students may add more revenue streams; team, expenses, funding and taxes are shared.
- A coarse income tax module is included (combined rate, losses carried forward, quarterly or annual payment, C corp or pass-through).
- Every assumption has a value, a basis and a confidence (Evidence-based / Benchmark-based / Speculative). Template values are flagged "Example" until changed or confirmed.
- Review prompts are questions, never verdicts. The tool never says whether a business is good.
- No accounts or server. Work autosaves in the browser; students download project files. Instructors use the Excel export (opens on an Instructor Summary sheet, includes a suggested rubric) or open a project file in the app.
- Exit Strategy is a fun, ungraded bonus page: simple cap table, liquidation waterfall, five exit types, California founder taxes, federal QSBS (post July 4, 2025 rules; California does not conform). Excluded from progress and the instructor summary; included in Excel.
- The TimeScene demo (`src/data/timescene.ts`) uses invented, illustrative numbers. Trevor will review and edit them; never present them as real TimeScene figures.
- The rubric (`src/export/rubric.ts`, mirrored in `docs/RUBRIC.md`) is a draft for Trevor to adjust. Keep the two in step.

## Writing style (Trevor's preferences)

- No em dashes anywhere: chat, code comments, UI copy, docs.
- American spelling (color, not colour).
- No monospace fonts in the UI; numbers use the regular font with tabular figures.
- Plain language in the UI: students are not finance specialists.

## Open items

- Trevor has not yet clicked through the app as a student (typing inputs, adding rows, downloading and reopening a project file, Excel export). Automated checks cover the engine, exports and page rendering only.
- TimeScene numbers and the rubric await Trevor's review.
- GitHub reported that the standard Actions used in the workflow are moving to a newer Node version; harmless for now, worth bumping eventually.
