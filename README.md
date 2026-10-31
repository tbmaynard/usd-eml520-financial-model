# Venture Financial Model

A browser-based financial modeling tool for graduate technology-entrepreneurship students (EML 520). Students pick a business model, enter the assumptions behind it with a basis and a confidence level for each, and see a monthly projection of revenue, costs and cash that updates as they type. It includes scenarios, a sensitivity analysis, model-review prompts and an instructor summary.

> A financial model is not a prediction. It is a structured representation of what you believe must be true for your business to work.

This is an educational tool, not accounting software. Its statements are simplified and are not audited financial statements or tax advice.

## Running it locally

Requires Node.js 20 or later.

```bash
npm install
npm run dev        # http://localhost:5280/usd-eml520-financial-model/
npm test           # calculation test suite (Vitest)
npm run build      # production build into dist/
npm run preview    # serve the build at http://localhost:4280/usd-eml520-financial-model/
```

Ports are fixed (5280 and 4280, `strictPort`) so they never collide with other local projects on 5173 or 8000.

Add `?example` to the URL to open the TimeScene demonstration directly, for example `http://localhost:5280/usd-eml520-financial-model/?example`.

## Hosting (GitHub Pages, free)

The site is static. All calculation runs in the browser, and there is no server, database or account. `.github/workflows/deploy.yml` runs the tests, builds the site and publishes it to GitHub Pages on every push to `main`.

One-time setup: in the repository on GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**. After the next push the site is at:

`https://tbmaynard.github.io/usd-eml520-financial-model/`

GitHub Pages sites are public. Nothing students type is sent anywhere, so a public URL exposes no student data.

## How students save their work

- Work saves automatically to the browser's local storage on every change. Several ventures can be kept side by side (**⋮ → Projects in this browser**).
- A notice on every page explains that there is no server and that clearing browser data erases the work. **Download project file** saves a `.vfm.json` file that can be reopened on any computer (**⋮ → Open a project file**).
- For grading, students submit the project file, the Excel export, or both.

## For the instructor

- **⋮ → Export Excel workbook** opens on an **Instructor Summary** sheet: venture description, results for all three scenarios, how well the assumptions are supported, the most influential assumptions, every assumption with its value, confidence and basis, the review prompts with the student's answers, and their reflection. Further sheets: a suggested **Rubric** (with blank Score and Comments columns), the full monthly projection for each scenario, and all assumptions with their scenario values.
- Alternatively, open a student's `.vfm.json` file in the app. It opens straight to **Model Review → One-page summary**, which shows the same content on one screen and prints cleanly (**Print or save as PDF**).
- Suggested rubric: [`docs/RUBRIC.md`](docs/RUBRIC.md).

## What is in the app

| Section | What students do |
|---|---|
| Venture Setup | Name, description, industry, start month, 12/24/36-month horizon, starting cash, founder investment, minimum cash cushion, other funding |
| Business Model | Choose one of seven models (with explanations); optionally add more revenue streams of any type |
| Assumptions | Model-specific revenue and direct-cost drivers; team plan with hiring months; operating expenses (recurring and one-time, with payment delays); equipment; funding and loans; a coarse income-tax estimate; the assumption register |
| Financial Projections | Dashboard (KPIs and four charts), income statement, cash flow with balances, business metrics, and a Calculations tab that explains every formula |
| Scenarios | Base, downside and upside cases that override specific drivers, plus hiring delays, slower customer payments and pay changes; side-by-side comparison; one-at-a-time sensitivity analysis with a tornado chart |
| Model Review | Review prompts (questions, not verdicts) with space for responses; a "what must be true" reflection; the one-page instructor summary |

Every headline number has an **ƒ** button that opens its definition, formula, the values used in any chosen month, the student's assumptions behind it (with basis and confidence), links to trace further back, and the simplifications involved.

## Calculation architecture

```
src/engine/            pure TypeScript, no UI; fully unit tested
  types.ts             Project (inputs) and ProjectResult (outputs)
  models/*.ts          one module per business model: fields, defaults, formulas, compute()
  engine.ts            the shared monthly engine
  timing.ts            payment delays, whole-deal counting, depreciation, loans
  paths.ts             addressing any assumption by a path (used by scenarios, sensitivity, register)
  formulas.ts          documentation for the shared engine's calculations
  sensitivity.ts       one-at-a-time sensitivity analysis
  review.ts            model-review prompts
src/state/             browser storage, project files, React store
src/export/            CSV and Excel exports, rubric
src/ui/                React + MUI pages and components
```

1. **Business-model modules** (`models/*.ts`) each turn their own drivers into a common `StreamResult`: revenue lines, direct-cost lines, operating-expense lines, invoices (each with a collection delay), vendor bills (each with a payment delay), capital purchases, inventory and model-specific metrics. Each model has its own economics; none is the same calculation with different labels.
2. **The shared engine** (`engine.ts`) adds the team plan, operating expenses, equipment, funding, loans and taxes, then builds every month's income statement and cash flow. Revenue and costs are recorded when earned or incurred; cash moves only when invoices are collected and bills are paid. The engine tracks receivables, payables, deferred revenue, inventory and debt, and the tests check that these always reconcile.
3. **Scenarios** change underlying assumptions (by path) and recalculate everything. They never scale totals.
4. **Sensitivity** moves one assumption at a time (±20% by default; ±15 days or ±2 months for timing assumptions) and reruns the full model.

### The seven models

| Model | How revenue works | Notable mechanics |
|---|---|---|
| Software | Any mix of subscriptions (monthly or annual prepaid), one-time licenses plus annual support contracts, and custom development projects | Churn (annual plans churn only at renewal), MRR/ARR, CAC, LTV with its limitations, deferred revenue from annual prepayment |
| Enterprise / government | Monthly cohorts move prospect → qualified → pilot → contract → start, with a delay at each stage | Whole-deal counting (or expected value), team capacity limit, paid and unpaid pilots, annual/quarterly/monthly billing, renewals, price increases, pipeline value, contracted vs. recognized vs. collected revenue, concentration |
| Manufacturing | Units sold × price, limited by capacity | Materials bought ahead of sale (inventory), equipment and expansions as capital spending, capacity warnings |
| Services | Billable hours × rate (or fixed fee), limited by delivery capacity | Utilization, contractor overflow, salaries paid whether billed or not |
| E-commerce | Orders × order value, net of refunds | Fulfillment, shipping subsidy, processing fees, acquisition cost, contribution per order |
| Marketplace | GMV × take rate (GMV is not revenue) | Processing charged on full GMV, seller-supply limit, buyer and seller acquisition |
| Licensing | Upfront fees, annual fees, renewals and royalties | Whole deals, contract terms and renewals, royalty ramp-up and payment delays |

## Simplifications and limitations

- **Months are 30 days.** A payment delay of *d* days lands part of an amount ⌊d/30⌋ months later and the rest one month after that.
- **Averages, not individuals.** Subscriber, order and transaction counts are averages and can be fractional. Enterprise and licensing deals are whole by default; a deal is counted when the running expected total reaches the next whole deal, which is deterministic, not random.
- **No balance sheet.** Receivables, payables, deferred revenue, inventory and debt are tracked as balances, but there is no full balance sheet or equity accounting.
- **Taxes are coarse.** There is one combined rate, losses carry forward in full with no annual limit, and no credits, deductions, self-employment tax or state detail. Pass-through entities can show owner tax as a cash distribution.
- **Revenue recognition is simplified.** Onboarding, implementation and upfront license fees are recognized at the start (enterprise can spread implementation over 12 months). Formal ASC 606 treatment can differ.
- **Depreciation** is straight-line. Inventory covers materials only.
- **Benchmarks** in review prompts (for example typical gross margins) are broad rules of thumb meant to prompt questions, not standards.
- **Customer concentration** is an input for most models. Enterprise and licensing calculate it from identical-sized customers.
- **Marketplace pass-through cash** (buyer payments forwarded to sellers) is not modeled; only the platform's fee is.
- **Storage** is browser-local. Students must download project files to keep their work safely.

## Tests

`npm test` runs 93 tests (`src/engine/__tests__/`). They include hand-calculated cases for every model:

| Model | Test case (hand-calculated) |
|---|---|
| Software | 100 subscribers, +10/month, 5% churn, $50 → ending 105 then 109.75 subscribers; revenue $5,250 then $5,487.50; ARR = MRR × 12; cost to serve $525; EBITDA $3,725. Raising price to $60 raises revenue to $6,300 and cash to $4,775. Annual plans: $1,080 collected, $90 earned, $990 deferred. Licenses at 0.5/month land as whole sales in months 2 and 4. |
| Software (cash) | A 30-day collection delay leaves revenue unchanged, moves cash a month later, and makes month-1 cash −$1,525. |
| Manufacturing | Demand 10, capacity 8 → 8 sold with a warning; gross profit = 8 × ($100 − $35) − $100 overhead; materials bought a month ahead → $320 then $160, $160 in inventory; $1,200 equipment → $100/month depreciation. |
| Services | 2 consultants × 160 h × 50% → capacity 160 h; demand 100 then 200 h → billable 100 then 160 h, revenue $10k then $16k, capacity warning; loaded cost $12,000. |
| E-commerce | 100 orders × $100, 10% refunds → $9,000; direct costs $4,330; acquisition $1,000; contribution $36.70 per order. |
| Marketplace | 1,000 buyers want 1,000 transactions; 10 sellers × 50 cap → 500; GMV $100,000; revenue $10,000 (not GMV); processing $3,000 on GMV. |
| Licensing | Upfront $10k + $1k/month earned in month 1 with $22k invoiced; renewal at month 13; royalties $50/month collected 60 days later. |
| Enterprise | 10 prospects × 50% × 20% → one pilot a month; 50% conversion → whole contracts in months 3 and 5; software revenue $1k, $1k, $2k, $2k; $12k billed annually at each start; unpaid pilots as selling cost; procurement delay shifts revenue; signed-but-not-started contracts count in contracted ARR but not revenue. |

The suite also checks, for every model with every option on, that ending cash equals starting cash plus every month's change, that invoices equal collections plus receivables, that revenue equals invoices minus deferred revenue, that costs plus inventory equal cash paid plus unpaid bills, and that loan balances reconcile. Further tests cover hiring from the start month only (not retroactively), one-time vs. recurring expenses, tax with loss carryforward paid quarterly, scenarios moving drivers, a cash shortfall hidden by a positive ending balance, a sustained break-even case, the TimeScene scenario ordering, review prompts, sensitivity, project-file round trips and the Excel workbook.

## TimeScene demonstration

**⋮ → Open the TimeScene example** (or `?example`) loads an enterprise/government software example built around TimeScene. Every value is an illustrative assumption written for teaching; none is an actual TimeScene figure. The three scenarios are labeled as conservative, base and aggressive public-sector sales.

## Design

Dark theme only, using the University of San Diego palette (Founders Blue, Immaculata Blue, Torero Blue, and the accent colors for charts) and the brand fonts Sofia Sans and Spectral, without logos. Chart colors are USD hues adjusted to pass colorblind-separation and contrast checks on the dark background.
