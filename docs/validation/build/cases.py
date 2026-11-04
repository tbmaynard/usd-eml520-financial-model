"""The validation test cases.

Every expected value is an Excel formula written from the app's documented
behavior: the field help text and Calculations-tab formulas (app-spec.txt, a
dump of that documentation), the README's simplifications, and the help copy on
the Team, Expenses, Funding and Tax editors. None of it is taken from the
engine's calculation code. Where the documentation leaves a choice open, the
check carries a convention id (see CONVENTIONS) so a mismatch is reported as
"CONVENTION" rather than "FAIL".
"""

from __future__ import annotations

import os
import re

from framework import Case

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Field labels, read from the documentation dump so the sheet matches the app.

LABELS: dict[str, dict[str, str]] = {}
OPTION_LABELS: dict[str, dict[str, str]] = {}


def _load_labels():
    model = None
    part = None
    with open(os.path.join(HERE, 'app-spec.txt'), encoding='utf-8') as f:
        for line in f:
            m = re.match(r'######## MODEL (\w+):', line)
            if m:
                model = m.group(1)
                LABELS[model] = {}
                OPTION_LABELS[model] = {}
                continue
            if line.startswith('## OPTIONS'):
                part = 'options'
                continue
            if line.startswith('## FIELDS'):
                part = 'fields'
                continue
            if line.startswith('## FORMULAS') or line.startswith('######## COMMON'):
                part = None
                continue
            if model and part == 'fields' and line.startswith('- '):
                key, label = [x.strip() for x in line[2:].split('|')[:2]]
                LABELS[model][key] = label
            if model and part == 'options' and line.startswith('- '):
                m = re.match(r'- (\w+) \[\w+\] "([^"]+)"', line)
                if m:
                    OPTION_LABELS[model][m.group(1)] = m.group(2)


_load_labels()

MODEL_NAMES = {
    'software': 'Software', 'enterprise': 'Enterprise / government B2B software', 'manufacturing': 'Manufacturing / physical products',
    'services': 'Professional services / consulting', 'ecommerce': 'E-commerce / direct-to-consumer',
    'marketplace': 'Marketplace / transaction platform', 'licensing': 'Licensing / intellectual property',
}

UNITS = {}  # key -> unit, filled from app-spec


def _load_units():
    model = None
    with open(os.path.join(HERE, 'app-spec.txt'), encoding='utf-8') as f:
        for line in f:
            m = re.match(r'######## MODEL (\w+):', line)
            if m:
                model = m.group(1)
                UNITS[model] = {}
                continue
            if model and line.startswith('- ') and line.count('|') >= 4:
                parts = [x.strip() for x in line[2:].split('|')]
                UNITS[model][parts[0]] = parts[2]


_load_units()

# ---------------------------------------------------------------------------
# Conventions: places where the documentation does not settle the answer.

CONVENTIONS = {
    'C1': ('Annual-plan churn at renewal',
           'Help text: "the model applies 12 months of churn at once on each anniversary." The workbook compounds it: share lost = 1 − (1 − monthly churn)^12. '
           'The other reading is 12 × monthly churn (36% instead of 30.6% at 3%). Renewal happens in the month 12 months after joining.'),
    'C2': ('Support contracts start with the license sale and renew as an average',
           'Each license sale starts a support contract in the same month, billed for a year in advance and earned over 12 months. At the anniversary the '
           'renewal rate is applied as an average (0.5 of a contract at 50%), not as whole contracts.'),
    'C3': ('Lifetime value uses subscription revenue only',
           'LTV = (subscription revenue ÷ ending subscribers − hosting and support per subscriber) ÷ monthly churn. Onboarding fees are left out of "average revenue per subscriber".'),
    'C4': ('Enterprise renewal pricing and contracted ARR',
           'The annual price increase applies from the second contract year (at renewal). Contracted ARR counts every signed contract that has not expired at its current price, '
           'including ones signed but not yet started.'),
    'C5': ('Enterprise open opportunities in the weighted pipeline',
           'Open opportunities are those qualified within the last "evaluation months" (still being evaluated), as expected values; opportunities that decline a pilot leave the pipeline when the evaluation ends.'),
    'C6': ('Expansion equipment life',
           'The expansion is depreciated over the same useful life as the initial equipment, starting in the expansion month. Depreciation of any equipment starts in the month it is bought.'),
    'C7': ('Which vendor costs wait for the supplier delay',
           'Help text names materials, overhead and shipping (manufacturing) or products and fulfillment (e-commerce). The workbook also delays manufacturing marketing and R&D bills by the supplier days, '
           'and pays e-commerce marketing immediately. Ending cash is affected only through timing.'),
    'C8': ('Services admin staff burden',
           'The "Benefits and payroll taxes" percent is applied to non-billable admin salaries as well as consultants.'),
    'C9': ('E-commerce processing fees and the cash lines',
           'Collections are shown on net revenue, and processing fees are paid on the same delay as the processor payout (they are deducted from payouts). '
           'If the app nets fees out of "Cash collected" instead, the individual cash lines differ but ending cash does not.'),
    'C10': ('Marketplace growth and new buyers',
            'Active buyers in month t = buyers at start × (1 + growth)^(t − 1), so month 1 has the starting count and no new buyers; new buyers = this month − last month. Same for sellers.'),
    'C11': ('Licensing: renewals as averages, royalty ramp, licensees at start',
            'Renewals apply the renewal rate as an average (0.5 of a licensee at 50%). Royalty ramp factor in the k-th month after signing = min(1, k ÷ ramp months), so month 1 earns 1/ramp. '
            'Licensees at start ramp up the same way from the first month of sales.'),
    'C12': ('Annual expense increases',
            'A recurring expense rises by its annual increase every 12 months counted from its own start month (month 13 for an expense starting in month 1).'),
    'C13': ('Delivery staff in the cash lines',
            'Salaries of delivery staff are paid immediately and shown in "Cash paid for salaries", even though their cost is a direct cost on the income statement.'),
    'C14': ('Burn and runway',
            'Burn = cash paid for costs + interest + loan repayments + taxes + equipment − cash collected, i.e. the net change in cash before founder, investor, grant and loan money. '
            'The dashboard averages the last three months.'),
    'C15': ('Pass-through owner distributions',
            'For a pass-through entity the tax is computed exactly as for a C corp (same loss carryforward and payment schedule) but shown as "Owner tax distributions" in cash, with no income tax on the income statement.'),
    'C16': ('Exit: SAFE ownership step and fees',
            'A post-money SAFE converts at the next priced round: SAFE holders get (amount ÷ cap) of the company just before the priced money, then everyone is diluted by the priced round. Banker and legal fees come off the price before the waterfall. The option pool shares in proceeds like common stock.'),
    'C17': ('Exit: "Founder share at the headline price (gross)"',
            'Taken as the founders’ waterfall proceeds after fees. If the app shows founder ownership × headline price before fees, this line differs but take-home should still match.'),
    'C18': ('Exit: acqui-hire fees and retention',
            'Fees apply to the acqui-hire price too, and retention packages are counted at full value, taxed at the income tax rate.'),
    'C20': ('Month the annual tax is paid',
            'Help text: "each 12-month year’s taxes are paid three months after it ends, like an April filing." The workbook follows the April reading: '
            'year 1 (months 1 to 12, January to December) is paid in month 16. Read literally, "three months after" could also mean month 15; worth tightening the help text.'),
    'C21': ('Sales department pay',
            'A role in the Sales and marketing department is counted in the Personnel line (with every non-delivery role), not in the Sales and marketing expense line.'),
    'C22': ('Example team and expense values',
            'The Starting defaults sheet lists the example roles, expenses, cash amounts and tax settings a new project starts with, as of November 2026. If the app’s examples change, update the blue values on that sheet to match.'),
    'C19': ('Exit: run-rate revenue',
            'Exit-year revenue = last projection month revenue × 12 × (1 + growth)^(exit year − projection years). With constant revenue and 0% growth (as in this case) every reading gives the same answer.'),
}


# ---------------------------------------------------------------------------
# Builders that register an input on the sheet AND record it in the project file.

def new_case(sheet, title, purpose, steps):
    c = Case(sheet, title, purpose, steps)
    c.project = {'name': title, 'setup': {}, 'streams': [], 'roles': [], 'expenses': [], 'capex': [], 'funding': [],
                 'tax': {'enabled': False, 'entity': 'c_corp', 'rate': 25, 'payment': 'quarterly', 'includeOwnerDistributions': True},
                 'scenarios': {}, 'exit': {}}
    return c


def setup(c: Case, starting_cash, founder, cushion=10000):
    sec = 'Venture Setup'
    c.inp('setup.start', sec, 'Start month', 'January 2027', 'text', 'Any start month works; month numbers below count from it.')
    c.inp('setup.months', sec, 'Projection length', '24 months', 'text')
    c.inp('startingCash', sec, 'Starting cash balance', starting_cash)
    c.inp('founderInvestment', sec, 'Founder investment (month 1)', founder)
    c.inp('minCashCushion', sec, 'Minimum cash you want to keep on hand', cushion)
    c.project['setup'] = {'startMonth': '2027-01', 'months': 24, 'startingCash': starting_cash,
                          'founderInvestment': founder, 'minCashCushion': cushion}


def stream(c: Case, idx, kind, name, options: dict, values: list):
    """values: list of (key, value) or (key, value, note), in app order."""
    p = f's{idx}.'
    sec = f'Assumptions › Revenue: {name} ({MODEL_NAMES[kind]})'
    for k, v in options.items():
        label = OPTION_LABELS[kind].get(k, k)
        shown = ('On' if v else 'Off') if isinstance(v, bool) else {
            'whole': 'Whole deals', 'expected': 'Expected value (fractional)', 'annual': 'Annually in advance',
            'quarterly': 'Quarterly in advance', 'monthly': 'Monthly', 'start': 'At contract start',
            'year': 'Evenly over the first 12 months', 'hourly': 'Hourly billing', 'fixed': 'Fixed fee per engagement'}.get(v, v)
        c.inp(p + 'opt.' + k, sec, f'Option: {label}', shown, 'text')
    inputs = {}
    for item in values:
        k, v = item[0], item[1]
        note = item[2] if len(item) > 2 else ''
        unit = UNITS[kind].get(k, 'usd')
        c.inp(p + k, sec, LABELS[kind][k], v, unit, note)
        inputs[k] = v
    c.project['streams'].append({'kind': kind, 'name': name, 'options': options, 'inputs': inputs})
    return lambda k: p + k


def role(c: Case, rid, title, count, comp, burden, start, end, raise_, dept):
    dept_label = {'delivery': 'Delivery (direct cost)', 'sales': 'Sales and marketing', 'product': 'Product and engineering', 'admin': 'Leadership and administration'}[dept]
    sec = f'Assumptions › Team › {title}  (Department: {dept_label})'
    c.inp(f'{rid}.count', sec, 'People', count, 'count')
    c.inp(f'{rid}.comp', sec, 'Monthly pay each', comp)
    c.inp(f'{rid}.burden', sec, 'Benefits and payroll taxes', burden, 'pct')
    c.inp(f'{rid}.start', sec, 'Start month', start, 'month')
    c.inp(f'{rid}.raise', sec, 'Annual raise', raise_, 'pct')
    c.inp(f'{rid}.end', sec, 'Last month (0 = stays)', end, 'month')
    c.project['roles'].append({'id': rid, 'title': title, 'count': count, 'monthlyComp': comp, 'burdenPct': burden, 'startMonth': start,
                               'endMonth': end or None, 'annualRaisePct': raise_, 'dept': dept})


def expense(c: Case, eid, name, category, kind, amount, start, end=0, growth=0, delay=0):
    cat_label = {'sm': 'Sales and marketing', 'rd': 'Research and development', 'ga': 'General and administrative', 'other': 'Other'}[category]
    sec = f'Assumptions › Expenses › {name}  ({"one-time" if kind == "one-time" else "monthly"}, {cat_label})'
    c.inp(f'{eid}.amount', sec, 'Amount' if kind == 'one-time' else 'Per month', amount)
    c.inp(f'{eid}.start', sec, 'Month' if kind == 'one-time' else 'From month', start, 'month')
    c.inp(f'{eid}.delay', sec, 'Days until paid', delay, 'days')
    if kind == 'recurring':
        c.inp(f'{eid}.growth', sec, 'Annual increase', growth, 'pct')
        c.inp(f'{eid}.end', sec, 'Last month (0 = continues)', end, 'month')
    c.project['expenses'].append({'id': eid, 'name': name, 'category': category, 'kind': kind, 'amount': amount, 'startMonth': start,
                                  'endMonth': end or None, 'annualGrowthPct': growth, 'payDelayDays': delay})


def capex(c: Case, cid, name, amount, month, life):
    sec = f'Assumptions › Equipment › {name}'
    c.inp(f'{cid}.amount', sec, 'Cost', amount)
    c.inp(f'{cid}.month', sec, 'Month bought', month, 'month')
    c.inp(f'{cid}.life', sec, 'Useful life', life, 'months')
    c.project['capex'].append({'id': cid, 'name': name, 'amount': amount, 'month': month, 'usefulLifeMonths': life})


def funding(c: Case, fid, name, kind, amount, month, rate=0, term=0, equity_pct=None, instrument=None):
    kind_label = {'equity': 'Investment (equity)', 'grant': 'Grant', 'loan': 'Loan'}[kind]
    sec = f'Assumptions › Funding › {name}  (Type: {kind_label})'
    c.inp(f'{fid}.amount', sec, 'Amount', amount)
    c.inp(f'{fid}.month', sec, 'Month received', month, 'month')
    if kind == 'loan':
        c.inp(f'{fid}.rate', sec, 'Interest rate', rate, 'pct')
        c.inp(f'{fid}.term', sec, 'Repay over', term, 'months')
    if kind == 'equity':
        c.inp(f'{fid}.pct', sec, 'Share of company sold', equity_pct, 'pct')
        c.inp(f'{fid}.instrument', sec, 'SAFE or priced round (Exit Strategy › Cap table)', 'SAFE' if instrument == 'safe' else 'Priced round', 'text')
    f = {'id': fid, 'name': name, 'kind': kind, 'amount': amount, 'month': month, 'annualRatePct': rate or 8, 'termMonths': term or 36}
    if kind == 'equity':
        f['equityPct'] = equity_pct
        f['instrument'] = instrument
    c.project['funding'].append(f)


def tax_off(c: Case):
    c.inp('tax.enabled', 'Assumptions › Funding and taxes', 'Include a rough income tax estimate', 'Off', 'text')


def clear_defaults(c: Case):
    sec = 'Remove the example team and expenses (see step 3)'
    c.inp('clear.roles', sec, 'Assumptions › Team: roles', 'None (delete Founder and First employee)', 'text')
    c.inp('clear.expenses', sec, 'Assumptions › Expenses', 'None (delete all 11 examples)', 'text')


MODEL_STEPS = [
    'Start a new project and choose the business model named in the inputs below. (Shortcut: instead of typing, open the matching file in docs/validation/projects/. Typing it yourself also tests data entry.)',
    'Venture Setup: set the start month, 24 months, and the cash amounts below.',
    'IMPORTANT: a new project starts with 2 example team roles, 11 example expenses and the income tax estimate on. Remove all of them: Assumptions › Team (delete both roles), '
    'Assumptions › Expenses (delete all 11), Funding and taxes (turn the tax estimate off). Every expected value below assumes this; if you skip it, Personnel, operating expenses, EBITDA and cash will all differ.',
    'Assumptions › Revenue: set every option and input listed below. Any input not listed is hidden for these options.',
    'Financial Projections, Base case: read each checkpoint. Click a number’s ƒ button if you want more decimals.',
]


def T(label):
    return ('table', label)


def neg_rows(c, keys):
    return '-'.join(['0'] + [c.R(k) for k in keys])


# ---------------------------------------------------------------------------
# Shared tail: income statement totals and a simple cash section for model sheets.

def model_tail(c: Case, rev_keys, direct_keys, sm_keys, rd_keys, ga_keys, other_keys=(), inv_fn=None, coll_fn=None, paid_fn=None, capex_fn=None, dep_fn=None):
    row = c.row
    row('revenue', 'Total revenue', lambda x: '+'.join(x.R(k) for k in rev_keys), total=True)
    row('direct', 'Total direct costs', lambda x: '+'.join(x.R(k) for k in direct_keys), total=True)
    row('gp', 'Gross profit', lambda x: f'{x.R("revenue")}-{x.R("direct")}', total=True)
    row('sm', 'Sales and marketing', lambda x: '+'.join(x.R(k) for k in sm_keys) if sm_keys else '0', total=True)
    row('rd', 'Research and development', lambda x: '+'.join(x.R(k) for k in rd_keys) if rd_keys else '0', total=True)
    row('ga', 'General and administrative', lambda x: '+'.join(x.R(k) for k in ga_keys) if ga_keys else '0', total=True)
    row('other', 'Other operating expenses', lambda x: '+'.join(x.R(k) for k in other_keys) if other_keys else '0', total=True)
    row('opex', 'Total operating expenses', lambda x: f'{x.R("sm")}+{x.R("rd")}+{x.R("ga")}+{x.R("other")}', total=True)
    row('ebitda', 'EBITDA (simplified)', lambda x: f'{x.R("gp")}-{x.R("opex")}', total=True)
    row('dep', 'Depreciation', dep_fn or (lambda x: '0'), total=True)
    row('op', 'Operating profit (loss)', lambda x: f'{x.R("ebitda")}-{x.R("dep")}', total=True)
    c.head('Cash')
    row('inv', 'Invoices issued in the month', inv_fn or (lambda x: x.R('revenue')), total=True)
    row('coll', 'Cash collected from customers', coll_fn, total=True)
    row('paid', 'Cash paid for costs (all lines)', paid_fn, total=True)
    row('capexPaid', 'Equipment purchases', capex_fn or (lambda x: '0'), total=True)
    row('net', 'Net change in cash', lambda x: f'{x.R("coll")}-{x.R("paid")}-{x.R("capexPaid")}+IF({x.M}=1,{x.I("founderInvestment")},0)', total=True)
    row('cash', 'Ending cash', lambda x: f'{x.I("startingCash")}+{x.CUM("net")}')
    row('recv', 'Money customers still owe', lambda x: f'{x.CUM("inv")}-{x.CUM("coll")}')
    row('deferred', 'Deferred revenue', lambda x: f'{x.CUM("inv")}-{x.CUM("revenue")}')


IS = 'Financial Projections › Income statement'
CF = 'Financial Projections › Cash flow'
BM = 'Financial Projections › Business metrics'


def common_checks(c: Case, cash_months=(1, 12, 24), conv_cash=''):
    c.check(IS, 'Total revenue', 'revenue', 'Total', src=T('Total revenue'), note='Total column')
    c.check(IS, 'EBITDA (simplified)', 'ebitda', 'Total', src=T('EBITDA (simplified)'), note='Total column')
    for m in cash_months:
        c.check(CF, 'Ending cash', 'cash', m, conv=conv_cash, src=T('Ending cash'))


# ===========================================================================
# 1. Software

def software():
    c = new_case('1 Software', '1. Software: subscriptions, annual plans, licenses with support, projects',
                 'Every part of the Software model at once: monthly and annual subscribers with churn, onboarding fees, fractional license sales turned into whole sales, '
                 'support contracts with renewals, development projects spread over their length, and a 45-day collection delay that splits cash across two months.',
                 MODEL_STEPS)
    setup(c, 300000, 0)
    tax_off(c)
    clear_defaults(c)
    S = stream(c, 0, 'software', 'Software', {'subscription': True, 'annualPlans': True, 'perpetual': True, 'projects': True}, [
        ('salesStartMonth', 1), ('subInitialCustomers', 200), ('subNewPerMonth', 20), ('subNewGrowthPct', 5), ('subPrice', 50),
        ('subAnnualSharePct', 25), ('subAnnualDiscountPct', 20), ('subChurnPct', 3), ('subOnboardingFee', 100), ('subCac', 300),
        ('subHostingPerCustomer', 4), ('subSupportPerCustomer', 6),
        ('licNewPerMonth', 0.5), ('licGrowthPct', 0), ('licPrice', 6000), ('licMaintPct', 20), ('licMaintRenewalPct', 50),
        ('licDeliveryCost', 400), ('licSupportCost', 50), ('licCac', 1000),
        ('projNewPerMonth', 1), ('projValue', 24000), ('projDurationMonths', 4), ('projDeliveryCostPct', 40),
        ('marketingFixed', 1500), ('devCostMonthly', 2000), ('collectionDays', 45), ('supplierDays', 0)])
    I = lambda x, k: x.I(S(k))
    row = c.row
    c.head('Subscriptions')
    row('new', 'New subscribers', lambda x: f'{I(x,"subNewPerMonth")}*(1+{I(x,"subNewGrowthPct")}/100)^({x.M}-1)', 'count', True)
    row('newA', '  of which annual plans', lambda x: f'{x.R("new")}*{I(x,"subAnnualSharePct")}/100', 'count', True)
    row('newM', '  of which monthly plans', lambda x: f'{x.R("new")}-{x.R("newA")}', 'count', True)
    row('mBeg', 'Monthly-plan subscribers, beginning', lambda x: I(x, 'subInitialCustomers') if x.m == 1 else x.R('mEnd', -1), 'count',
        note='Subscribers at start are assumed to be on monthly plans.')
    row('mChurn', 'Monthly-plan churn (beginning × churn)', lambda x: f'{x.R("mBeg")}*{I(x,"subChurnPct")}/100', 'count', True)
    row('mEnd', 'Monthly-plan subscribers, ending', lambda x: f'{x.R("mBeg")}+{x.R("newM")}-{x.R("mChurn")}', 'count')
    row('aRenew', 'Annual subscribers renewing this month', lambda x: f'{x.LAG("newA", 12)}*(1-{I(x,"subChurnPct")}/100)^12', 'count', True)
    row('aLost', 'Annual subscribers lost at renewal', lambda x: f'{x.LAG("newA", 12)}*(1-(1-{I(x,"subChurnPct")}/100)^12)', 'count', True)
    row('aEnd', 'Annual-plan subscribers, ending', lambda x: f'{x.R("aEnd", -1)}+{x.R("newA")}-{x.R("aLost")}', 'count')
    row('churn', 'Churned subscribers', lambda x: f'{x.R("mChurn")}+{x.R("aLost")}', 'count', True)
    row('end', 'Ending subscribers', lambda x: f'{x.R("mEnd")}+{x.R("aEnd")}', 'count')
    row('subRev', 'Subscription revenue', lambda x: f'{x.R("mEnd")}*{I(x,"subPrice")}+{x.R("aEnd")}*{I(x,"subPrice")}*(1-{I(x,"subAnnualDiscountPct")}/100)', 'usd', True)
    row('onb', 'Onboarding fees', lambda x: f'{x.R("new")}*{I(x,"subOnboardingFee")}', 'usd', True)
    row('serve', 'Hosting and support (cost to serve)', lambda x: f'{x.R("end")}*({I(x,"subHostingPerCustomer")}+{I(x,"subSupportPerCustomer")})', 'usd', True)
    row('subAcq', 'Subscriber acquisition', lambda x: f'{x.R("new")}*{I(x,"subCac")}', 'usd', True)
    row('arr', 'ARR (annualized run rate)', lambda x: f'{x.R("subRev")}*12')
    row('ltv', 'Lifetime value per subscriber', lambda x: f'({x.R("subRev")}/{x.R("end")}-({I(x,"subHostingPerCustomer")}+{I(x,"subSupportPerCustomer")}))/({I(x,"subChurnPct")}/100)')
    c.head('Licenses and support contracts')
    row('licExp', 'Expected license sales', lambda x: f'{I(x,"licNewPerMonth")}*(1+{I(x,"licGrowthPct")}/100)^({x.M}-1)', 'count', True)
    row('licCum', 'Running expected total', lambda x: x.CUM('licExp'), 'count')
    row('lic', 'Licenses sold (whole sales)', lambda x: x.WHOLE('licCum'), 'count', True)
    row('licLag', 'Licenses sold 12 months earlier', lambda x: x.LAG('lic', 12), 'count')
    row('contracts', 'Active support contracts', lambda x: f'{x.WIN("lic", 12)}+{I(x,"licMaintRenewalPct")}/100*{x.WIN("licLag", 12)}', 'count')
    row('licRev', 'License sales', lambda x: f'{x.R("lic")}*{I(x,"licPrice")}', 'usd', True)
    row('maint', 'Support contracts', lambda x: f'{x.R("contracts")}*{I(x,"licPrice")}*{I(x,"licMaintPct")}/100/12', 'usd', True)
    row('maintInv', 'Support contracts invoiced (a year in advance)', lambda x: f'({x.R("lic")}+{I(x,"licMaintRenewalPct")}/100*{x.R("licLag")})*{I(x,"licPrice")}*{I(x,"licMaintPct")}/100', 'usd', True)
    row('licDel', 'License delivery', lambda x: f'{x.R("lic")}*{I(x,"licDeliveryCost")}', 'usd', True)
    row('licSup', 'Support contract servicing', lambda x: f'{x.R("contracts")}*{I(x,"licSupportCost")}', 'usd', True)
    row('licAcq', 'License sales costs', lambda x: f'{x.R("lic")}*{I(x,"licCac")}', 'usd', True)
    c.head('Development projects')
    row('projCum', 'Running expected project starts', lambda x: f'{I(x,"projNewPerMonth")}*{x.M}', 'count')
    row('proj', 'Projects started', lambda x: x.WHOLE('projCum'), 'count', True)
    row('projActive', 'Active projects', lambda x: x.WIN('proj', I(x, 'projDurationMonths')), 'count')
    row('projRev', 'Development projects', lambda x: f'{x.R("projActive")}*{I(x,"projValue")}/{I(x,"projDurationMonths")}', 'usd', True)
    row('projDel', 'Project delivery', lambda x: f'{x.R("projRev")}*{I(x,"projDeliveryCostPct")}/100', 'usd', True)
    c.head('Fixed spending')
    row('mkt', 'Fixed marketing', lambda x: I(x, 'marketingFixed'), 'usd', True)
    row('dev', 'Outside development', lambda x: I(x, 'devCostMonthly'), 'usd', True)
    row('cac', 'Blended acquisition cost per new customer', lambda x: f'({x.R("subAcq")}+{x.R("licAcq")}+{x.R("mkt")})/({x.R("new")}+{x.R("lic")})')
    c.head('Income statement')
    model_tail(c, ['subRev', 'onb', 'licRev', 'maint', 'projRev'], ['serve', 'licDel', 'licSup', 'projDel'], ['subAcq', 'licAcq', 'mkt'], ['dev'], [],
               inv_fn=lambda x: f'{x.R("mEnd")}*{I(x,"subPrice")}+({x.R("newA")}+{x.R("aRenew")})*{I(x,"subPrice")}*(1-{I(x,"subAnnualDiscountPct")}/100)*12+{x.R("onb")}+{x.R("licRev")}+{x.R("maintInv")}+{x.R("projRev")}',
               coll_fn=lambda x: x.DELAY('inv', I(x, 'collectionDays')),
               paid_fn=lambda x: f'{x.R("direct")}+{x.R("opex")}')
    ch = c.check
    ch(BM, 'New subscribers', 'new', 12, 'count', src=T('New subscribers'))
    ch(BM, 'Ending subscribers', 'end', 1, 'count', src=T('Ending subscribers'))
    ch(BM, 'Ending subscribers', 'end', 12, 'count', src=T('Ending subscribers'))
    ch(BM, 'Annual-plan subscribers', 'aEnd', 12, 'count', src=T('Annual-plan subscribers'))
    ch(BM, 'Annual-plan subscribers', 'aEnd', 13, 'count', conv='C1', src=T('Annual-plan subscribers'), note='First renewal: month-1 annual cohort')
    ch(IS, 'Subscription revenue', 'subRev', 1, src=T('  Subscription revenue'))
    ch(IS, 'Subscription revenue', 'subRev', 12, src=T('  Subscription revenue'))
    ch(IS, 'Onboarding fees', 'onb', 3, src=T('  Onboarding fees'))
    ch(IS, 'License sales', 'licRev', 1, src=T('  License sales'), note='0.5 a month: no whole sale yet')
    ch(IS, 'License sales', 'licRev', 2, src=T('  License sales'))
    ch(IS, 'Support contracts', 'maint', 6, src=T('  Support contracts'))
    ch(IS, 'Support contracts', 'maint', 14, conv='C2', src=T('  Support contracts'), note='First renewal at 50%')
    ch(IS, 'Development projects', 'projRev', 2, src=T('  Development projects'))
    ch(IS, 'Development projects', 'projRev', 12, src=T('  Development projects'))
    ch(IS, 'Total direct costs', 'direct', 4, src=T('Total direct costs'))
    ch(IS, 'Sales and marketing', 'sm', 2, src=T('Sales and marketing'))
    ch(BM, 'MRR', 'subRev', 12, src=T('MRR'))
    ch(BM, 'ARR (annualized run rate)', 'arr', 12, src=T('ARR (annualized run rate)'))
    ch(BM, 'Lifetime value per subscriber', 'ltv', 12, conv='C3', src=T('Lifetime value per subscriber'))
    ch(BM, 'Blended acquisition cost per new customer', 'cac', 2, src=T('Blended acquisition cost per new customer'))
    ch(CF, 'Cash collected from customers', 'coll', 1, src=T('Cash collected from customers'), note='45 days: nothing lands in month 1')
    ch(CF, 'Cash collected from customers', 'coll', 2, src=T('Cash collected from customers'), note='Half of month 1')
    ch(CF, 'Cash collected from customers', 'coll', 3, src=T('Cash collected from customers'))
    ch(CF, 'Deferred revenue', 'deferred', 1, conv='C2', src=T('Deferred revenue'), note='Balances section')
    ch(CF, 'Money customers still owe', 'recv', 12, conv='C2', src=T('Money customers still owe'), note='Balances section')
    common_checks(c, conv_cash='C1, C2')
    return c


# ===========================================================================
# 2. Enterprise

def enterprise():
    c = new_case('2 Enterprise', '2. Enterprise / government: pipeline, whole deals, annual billing',
                 'A steady pipeline that produces one pilot a month and half a contract per pilot, counted as whole deals. Tests the stage delays, the start lag, '
                 'unpaid pilots as a selling cost, annual billing in advance, onboarding costs, the yearly certification, a renewal with a price increase, and pipeline metrics. '
                 'Capacity limits (set to 0 = no limit) and paid pilots (0%) are not exercised here.',
                 MODEL_STEPS)
    setup(c, 300000, 0)
    tax_off(c)
    clear_defaults(c)
    S = stream(c, 0, 'enterprise', 'Enterprise', {'counting': 'whole', 'billing': 'annual', 'implRecognition': 'start'}, [
        ('salesStartMonth', 1), ('prospectsPerMonth', 10), ('prospectGrowthPct', 0), ('openOppsAtStart', 0), ('pilotsAtStart', 0),
        ('qualifyPct', 50), ('monthsToQualify', 1), ('pilotPct', 20), ('evalMonths', 1), ('maxConcurrent', 0, '0 = no limit'),
        ('salesBdMonthly', 2000), ('costPerProspect', 100),
        ('pilotMonths', 2), ('pilotCost', 6000), ('paidPilotPct', 0), ('pilotFee', 0), ('pilotConversionPct', 50),
        ('decisionMonths', 1), ('procurementMonths', 2), ('startLagMonths', 1),
        ('licensePrice', 1000), ('licensesPerCustomer', 20), ('termMonths', 12), ('renewalPct', 100), ('priceIncreasePct', 5),
        ('implementationFee', 10000), ('trainingFee', 2000), ('proServicesMonthly', 500),
        ('laborRate', 50), ('onboardingHours', 40), ('trainingCost', 1000), ('configCost', 1500), ('supportHours', 5),
        ('infraPerCustomer', 300), ('csmPerCustomer', 200),
        ('hostingBase', 1000), ('securityMonthly', 500), ('certificationCost', 12000), ('certificationMonth', 6),
        ('legalMonthly', 400), ('insuranceMonthly', 300), ('collectionDays', 30), ('supplierDays', 0)])
    I = lambda x, k: x.I(S(k))
    row = c.row
    c.head('Pipeline')
    row('prospects', 'New prospects (expected)', lambda x: f'{I(x,"prospectsPerMonth")}*(1+{I(x,"prospectGrowthPct")}/100)^({x.M}-1)', 'count', True)
    row('qualified', 'Qualified opportunities (expected)', lambda x: f'{x.LAG("prospects", I(x,"monthsToQualify"))}*{I(x,"qualifyPct")}/100+IF({x.M}=1,{I(x,"openOppsAtStart")},0)', 'count', True)
    row('pilotExp', 'Pilots (expected)', lambda x: f'{x.LAG("qualified", I(x,"evalMonths"))}*{I(x,"pilotPct")}/100+IF({x.M}=1,{I(x,"pilotsAtStart")},0)', 'count', True)
    row('pilotCum', 'Running expected pilots', lambda x: x.CUM('pilotExp'), 'count')
    row('pilots', 'Pilots started (whole)', lambda x: x.WHOLE('pilotCum'), 'count', True)
    row('activePilots', 'Active pilots', lambda x: x.WIN('pilots', I(x, 'pilotMonths')), 'count')
    row('winExp', 'Contracts signed (expected)', lambda x: f'{x.LAG("pilots", I(x,"pilotMonths")+"+"+I(x,"decisionMonths")+"+"+I(x,"procurementMonths"))}*{I(x,"pilotConversionPct")}/100', 'count', True)
    row('winCum', 'Running expected contracts', lambda x: x.CUM('winExp'), 'count')
    row('signed', 'Contracts signed (whole)', lambda x: x.WHOLE('winCum'), 'count', True)
    row('starts', 'Contracts starting', lambda x: x.LAG('signed', I(x, 'startLagMonths')), 'count', True)
    row('notStarted', 'Signed, not yet started', lambda x: f'{x.CUM("signed")}-{x.CUM("starts")}', 'count')
    row('startsLag', 'Contracts that started one term earlier', lambda x: x.LAG('starts', I(x, 'termMonths')), 'count')
    row('yr1', 'Customers in first contract year', lambda x: x.WIN('starts', I(x, 'termMonths')), 'count')
    row('yr2', 'Customers in a renewed year', lambda x: f'{I(x,"renewalPct")}/100*{x.WIN("startsLag", I(x,"termMonths"))}', 'count')
    row('active', 'Active paying customers', lambda x: f'{x.R("yr1")}+{x.R("yr2")}', 'count')
    row('acv', 'Annual contract value (first year)', lambda x: f'{I(x,"licensePrice")}*{I(x,"licensesPerCustomer")}')
    c.head('Revenue and costs')
    row('software', 'Recurring software', lambda x: f'({x.R("yr1")}*{x.R("acv")}+{x.R("yr2")}*{x.R("acv")}*(1+{I(x,"priceIncreasePct")}/100))/12', 'usd', True)
    row('impl', 'Implementation and training', lambda x: f'{x.R("starts")}*({I(x,"implementationFee")}+{I(x,"trainingFee")})', 'usd', True)
    row('pro', 'Professional services', lambda x: f'{x.R("active")}*{I(x,"proServicesMonthly")}', 'usd', True)
    row('onbCost', 'Customer onboarding', lambda x: f'{x.R("starts")}*({I(x,"onboardingHours")}*{I(x,"laborRate")}+{I(x,"trainingCost")}+{I(x,"configCost")})', 'usd', True)
    row('support', 'Ongoing support and customer success', lambda x: f'{x.R("active")}*({I(x,"supportHours")}*{I(x,"laborRate")}+{I(x,"csmPerCustomer")})', 'usd', True)
    row('infra', 'Infrastructure per customer', lambda x: f'{x.R("active")}*{I(x,"infraPerCustomer")}', 'usd', True)
    row('hosting', 'Base hosting and data management', lambda x: I(x, 'hostingBase'), 'usd', True)
    row('sales', 'Sales and business development', lambda x: I(x, 'salesBdMonthly'), 'usd', True)
    row('prospectMkt', 'Marketing cost of new prospects', lambda x: f'{x.R("prospects")}*{I(x,"costPerProspect")}', 'usd', True)
    row('unpaid', 'Unpaid pilot delivery (cost of selling)', lambda x: f'{x.R("activePilots")}*{I(x,"pilotCost")}/{I(x,"pilotMonths")}*(1-{I(x,"paidPilotPct")}/100)', 'usd', True)
    row('security', 'Security and compliance', lambda x: I(x, 'securityMonthly'), 'usd', True)
    row('cert', 'Certification and audits', lambda x: f'IF(AND({x.M}>={I(x,"certificationMonth")},MOD({x.M}-{I(x,"certificationMonth")},12)=0),{I(x,"certificationCost")},0)', 'usd', True)
    row('legal', 'Legal and procurement support', lambda x: I(x, 'legalMonthly'), 'usd', True)
    row('insurance', 'Enterprise insurance', lambda x: I(x, 'insuranceMonthly'), 'usd', True)
    c.head('Metrics')
    row('carr', 'Contracted ARR', lambda x: f'({x.CUM("signed")}-{I(x,"renewalPct")}/100*{x.CUM("startsLag")})*{x.R("acv")}+{I(x,"renewalPct")}/100*{x.CUM("startsLag")}*{x.R("acv")}*(1+{I(x,"priceIncreasePct")}/100)')
    row('openOpps', 'Open opportunities in evaluation', lambda x: x.WIN('qualified', I(x, 'evalMonths')), 'count')
    row('weighted', 'Pipeline value (weighted)', lambda x: f'({x.R("openOpps")}*{I(x,"pilotPct")}/100+{x.R("activePilots")})*{I(x,"pilotConversionPct")}/100*{x.R("acv")}')
    row('cacToDate', 'Acquisition cost per contract (to date)', lambda x: f'IF({x.CUM("signed")}=0,0,({x.CUM("sales")}+{x.CUM("prospectMkt")}+{x.CUM("unpaid")})/{x.CUM("signed")})')
    row('conc', 'Largest customer share of software revenue (%)', lambda x: f'IF({x.R("active")}=0,0,100/{x.R("active")})', 'pct')
    c.head('Income statement')
    model_tail(c, ['software', 'impl', 'pro'], ['onbCost', 'support', 'infra', 'hosting'], ['sales', 'prospectMkt', 'unpaid'], [],
               ['security', 'cert', 'legal', 'insurance'],
               inv_fn=lambda x: f'{x.R("starts")}*{x.R("acv")}+{I(x,"renewalPct")}/100*{x.R("startsLag")}*{x.R("acv")}*(1+{I(x,"priceIncreasePct")}/100)+{x.R("impl")}+{x.R("pro")}',
               coll_fn=lambda x: x.DELAY('inv', I(x, 'collectionDays')),
               paid_fn=lambda x: f'{x.R("direct")}+{x.R("opex")}')
    c.scalar('cycle', 'Average sales cycle (months)', lambda s: '+'.join(s.I(S(k)) for k in ['monthsToQualify', 'evalMonths', 'pilotMonths', 'decisionMonths', 'procurementMonths', 'startLagMonths']), 'months')
    ch = c.check
    ch(BM, 'Qualified opportunities (expected)', 'qualified', 2, 'count', src=T('Qualified opportunities (expected)'))
    ch(BM, 'Paid pilots started / Active pilots', 'activePilots', 4, 'count', src=T('Active pilots'), note='Line "Active pilots"')
    ch(BM, 'Contracts starting', 'starts', 9, 'count', src=T('Contracts starting'), note='Signed in month 9, starts month 10')
    ch(BM, 'Contracts starting', 'starts', 10, 'count', src=T('Contracts starting'))
    ch(BM, 'Signed, not yet started', 'notStarted', 9, 'count', src=T('Signed, not yet started'))
    ch(BM, 'Active paying customers', 'active', 12, 'count', src=T('Active paying customers'))
    ch(BM, 'Active paying customers', 'active', 24, 'count', src=T('Active paying customers'))
    ch(IS, 'Recurring software', 'software', 10, src=T('  Recurring software'))
    ch(IS, 'Recurring software', 'software', 22, conv='C4', src=T('  Recurring software'), note='First customer renews at +5%')
    ch(IS, 'Implementation and training', 'impl', 10, src=T('  Implementation and training'))
    ch(IS, 'Professional services', 'pro', 12, src=T('  Professional services'))
    ch(IS, 'Total revenue', 'revenue', 12, src=T('Total revenue'))
    ch(IS, 'Total direct costs', 'direct', 10, src=T('Total direct costs'))
    ch(IS, 'Sales and marketing', 'sm', 3, src=T('Sales and marketing'), note='First pilot starts')
    ch(IS, 'Sales and marketing', 'sm', 4, src=T('Sales and marketing'))
    ch(IS, 'General and administrative', 'ga', 6, src=T('General and administrative'), note='Certification month')
    ch(IS, 'General and administrative', 'ga', 7, src=T('General and administrative'))
    ch(CF, 'Cash collected from customers', 'coll', 11, src=T('Cash collected from customers'), note='Month-10 invoices, 30 days later')
    ch(CF, 'Deferred revenue', 'deferred', 10, src=T('Deferred revenue'), note='Balances section')
    ch(BM, 'Contracted ARR', 'carr', 9, conv='C4', src=T('Contracted ARR'))
    ch(BM, 'Pipeline value (weighted)', 'weighted', 6, conv='C5', src=T('Pipeline value (weighted)'))
    ch(BM, 'Acquisition cost per contract (to date)', 'cacToDate', 24, src=T('Acquisition cost per contract (to date)'))
    ch(BM, 'Largest customer share of software revenue', 'conc', 12, 'pct', src=T('Largest customer share of software revenue %'))
    ch(BM, 'Average sales cycle', 'cycle', None, 'count', src=('metric_last', 'Average sales cycle'))
    common_checks(c, conv_cash='C4')
    return c


# ===========================================================================
# 3. Manufacturing

def manufacturing():
    c = new_case('3 Manufacturing', '3. Manufacturing: capacity limit, expansion, inventory bought ahead',
                 'Demand grows 10% a month and hits capacity in month 5; an expansion in month 10 adds capacity until demand catches up again in month 11. '
                 'Tests units sold vs. demand, cost of goods, materials bought a month ahead (startup stock in month 1), straight-line depreciation of two equipment purchases, '
                 'and 30-day collection and supplier delays.',
                 MODEL_STEPS)
    setup(c, 200000, 0)
    tax_off(c)
    clear_defaults(c)
    S = stream(c, 0, 'manufacturing', 'Manufacturing', {'capSales': True}, [
        ('salesStartMonth', 1), ('price', 100), ('unitsStart', 400), ('unitGrowthPct', 10), ('marketingFixed', 2000),
        ('materialCost', 30), ('laborCost', 15), ('packShipCost', 5), ('overheadMonthly', 3000), ('capacity', 600),
        ('equipmentCost', 60000), ('equipmentMonth', 1), ('equipmentLife', 60), ('expansionMonth', 10), ('expansionCapacity', 400),
        ('expansionCost', 24000), ('rndMonthly', 1000), ('inventoryLeadMonths', 1), ('collectionDays', 30), ('supplierDays', 30)])
    I = lambda x, k: x.I(S(k))
    row = c.row
    c.head('Units')
    row('demand', 'Units demanded', lambda x: f'{I(x,"unitsStart")}*(1+{I(x,"unitGrowthPct")}/100)^({x.M}-1)', 'count', True)
    row('cap', 'Production capacity', lambda x: f'{I(x,"capacity")}+IF({x.M}>={I(x,"expansionMonth")},{I(x,"expansionCapacity")},0)', 'count')
    row('sold', 'Units sold', lambda x: f'MIN({x.R("demand")},{x.R("cap")})', 'count', True)
    row('unmet', 'Unserved demand (units)', lambda x: f'{x.R("demand")}-{x.R("sold")}', 'count', True)
    row('util', 'Capacity utilization (%)', lambda x: f'{x.R("sold")}/{x.R("cap")}*100', 'pct')
    c.head('Revenue and costs')
    row('product', 'Product sales', lambda x: f'{x.R("sold")}*{I(x,"price")}', 'usd', True)
    row('material', 'Materials', lambda x: f'{x.R("sold")}*{I(x,"materialCost")}', 'usd', True)
    row('labor', 'Direct labor', lambda x: f'{x.R("sold")}*{I(x,"laborCost")}', 'usd', True)
    row('shipping', 'Packaging and shipping', lambda x: f'{x.R("sold")}*{I(x,"packShipCost")}', 'usd', True)
    row('overhead', 'Manufacturing overhead', lambda x: I(x, 'overheadMonthly'), 'usd', True)
    row('marketing', 'Marketing and sales', lambda x: I(x, 'marketingFixed'), 'usd', True)
    row('rnd', 'Product R&D', lambda x: I(x, 'rndMonthly'), 'usd', True)
    c.head('Inventory and equipment')
    row('purchases', 'Material purchases', lambda x: (
        f'IF({x.M}=1,SUM(INDEX({x.ROW("sold")},1):INDEX({x.ROW("sold")},1+{I(x,"inventoryLeadMonths")})),{x.LEAD("sold", I(x,"inventoryLeadMonths"))})*{I(x,"materialCost")}'),
        'usd', True, note='Purchases for sales beyond month 24 are not computed here, so month-24 purchases read 0. No checkpoint depends on them.')
    row('inventory', 'Inventory on hand (materials)', lambda x: f'{x.CUM("purchases")}-{x.CUM("material")}')
    row('capexRow', 'Equipment purchases', lambda x: f'IF({x.M}={I(x,"equipmentMonth")},{I(x,"equipmentCost")},0)+IF({x.M}={I(x,"expansionMonth")},{I(x,"expansionCost")},0)', 'usd', True)
    row('depRow', 'Depreciation', lambda x: f'IF({x.M}>={I(x,"equipmentMonth")},{I(x,"equipmentCost")}/{I(x,"equipmentLife")},0)+IF({x.M}>={I(x,"expansionMonth")},{I(x,"expansionCost")}/{I(x,"equipmentLife")},0)', 'usd', True)
    c.head('Payments')
    row('payMat', 'Material purchases paid', lambda x: x.DELAY('purchases', I(x, 'supplierDays')), 'usd', True)
    row('shipOver', 'Shipping and overhead incurred', lambda x: f'{x.R("shipping")}+{x.R("overhead")}', 'usd', True)
    row('payShip', 'Shipping and overhead paid', lambda x: x.DELAY('shipOver', I(x, 'supplierDays')), 'usd', True)
    row('mktRnd', 'Marketing and R&D incurred', lambda x: f'{x.R("marketing")}+{x.R("rnd")}', 'usd', True)
    row('payMkt', 'Marketing and R&D paid', lambda x: x.DELAY('mktRnd', I(x, 'supplierDays')), 'usd', True)
    row('payDirect', 'Cash paid for direct costs', lambda x: f'{x.R("payMat")}+{x.R("labor")}+{x.R("payShip")}', 'usd', True)
    c.head('Income statement')
    model_tail(c, ['product'], ['material', 'labor', 'shipping', 'overhead'], ['marketing'], ['rnd'], [],
               coll_fn=lambda x: x.DELAY('inv', I(x, 'collectionDays')),
               paid_fn=lambda x: f'{x.R("payDirect")}+{x.R("payMkt")}',
               capex_fn=lambda x: x.R('capexRow'), dep_fn=lambda x: x.R('depRow'))
    ch = c.check
    ch(BM, 'Units demanded', 'demand', 6, 'count', src=T('Units demanded'))
    ch(BM, 'Units sold', 'sold', 6, 'count', src=T('Units sold'))
    ch(BM, 'Unserved demand (units)', 'unmet', 6, 'count', src=T('Unserved demand (units)'))
    ch(BM, 'Production capacity', 'cap', 10, 'count', src=T('Production capacity'))
    ch(BM, 'Units sold', 'sold', 11, 'count', src=T('Units sold'))
    ch(BM, 'Capacity utilization', 'util', 3, 'pct', src=T('Capacity utilization %'))
    ch(IS, 'Product sales', 'product', 1, src=T('  Product sales'))
    ch(IS, 'Product sales', 'product', 6, src=T('  Product sales'))
    ch(IS, 'Total direct costs', 'direct', 1, src=T('Total direct costs'))
    ch(IS, 'Gross profit', 'gp', 6, src=T('Gross profit'))
    ch(IS, 'Depreciation', 'dep', 1, conv='C6', src=T('Depreciation'))
    ch(IS, 'Depreciation', 'dep', 10, conv='C6', src=T('Depreciation'))
    ch(IS, 'Operating profit (loss)', 'op', 6, conv='C6', src=T('Operating profit (loss)'))
    ch(BM, 'Material purchases', 'purchases', 1, src=T('Material purchases'), note='Startup stock: months 1 and 2')
    ch(BM, 'Material purchases', 'purchases', 2, src=T('Material purchases'))
    ch(BM, 'Inventory on hand (materials)', 'inventory', 1, src=T('Inventory on hand (materials)'))
    ch(BM, 'Inventory on hand (materials)', 'inventory', 12, src=T('Inventory on hand (materials)'))
    ch(CF, 'Cash collected from customers', 'coll', 1, src=T('Cash collected from customers'))
    ch(CF, 'Cash collected from customers', 'coll', 2, src=T('Cash collected from customers'))
    ch(CF, 'Cash paid for direct costs', 'payDirect', 1, sign=-1, src=T('Cash paid for direct costs'), note='Shown as a negative')
    ch(CF, 'Cash paid for direct costs', 'payDirect', 2, sign=-1, src=T('Cash paid for direct costs'))
    ch(CF, 'Equipment purchases', 'capexPaid', 10, sign=-1, src=T('Equipment purchases'))
    common_checks(c, conv_cash='C7')
    return c


# ===========================================================================
# 4. Services

def services():
    c = new_case('4 Services', '4. Professional services: hourly billing with a capacity limit',
                 'Two new engagements a month lasting three months. Demand outgrows the team in month 3, contractors fill part of the gap, and two hires in month 7 '
                 'add capacity. Tests active engagements, delivery capacity, staff-before-contractor hours, unserved hours, salaries as direct costs and a 30-day collection delay.',
                 MODEL_STEPS)
    setup(c, 200000, 0)
    tax_off(c)
    clear_defaults(c)
    S = stream(c, 0, 'services', 'Services', {'pricing': 'hourly'}, [
        ('salesStartMonth', 1), ('newClientsPerMonth', 2), ('clientGrowthPct', 0), ('projectDurationMonths', 3), ('hoursPerClientMonth', 100),
        ('billingRate', 150), ('marketingFixed', 1000), ('consultantsStart', 3), ('consultantsAdded', 2), ('consultantsAddedMonth', 7),
        ('hoursPerPerson', 160), ('utilizationPct', 75), ('consultantSalary', 8000), ('burdenPct', 25), ('contractorHoursMax', 100),
        ('contractorCostPerHour', 90), ('adminStaff', 1), ('adminSalary', 4000), ('collectionDays', 30), ('supplierDays', 0)])
    I = lambda x, k: x.I(S(k))
    row = c.row
    row('newExp', 'New engagements (expected)', lambda x: f'{I(x,"newClientsPerMonth")}*(1+{I(x,"clientGrowthPct")}/100)^({x.M}-1)', 'count', True)
    row('newCum', 'Running expected total', lambda x: x.CUM('newExp'), 'count')
    row('newC', 'New engagements (whole)', lambda x: x.WHOLE('newCum'), 'count', True)
    row('activeC', 'Active engagements', lambda x: x.WIN('newC', I(x, 'projectDurationMonths')), 'count')
    row('cons', 'Billable consultants', lambda x: f'{I(x,"consultantsStart")}+IF({x.M}>={I(x,"consultantsAddedMonth")},{I(x,"consultantsAdded")},0)', 'count')
    row('avail', 'Available working hours', lambda x: f'{x.R("cons")}*{I(x,"hoursPerPerson")}', 'hours')
    row('capH', 'Delivery capacity (hours)', lambda x: f'{x.R("avail")}*{I(x,"utilizationPct")}/100+{I(x,"contractorHoursMax")}', 'hours')
    row('demandH', 'Hours clients need', lambda x: f'{x.R("activeC")}*{I(x,"hoursPerClientMonth")}', 'hours', True)
    row('staffH', 'Hours billed by staff', lambda x: f'MIN({x.R("demandH")},{x.R("avail")}*{I(x,"utilizationPct")}/100)', 'hours', True)
    row('contrH', 'Hours billed by contractors', lambda x: f'MIN({x.R("demandH")}-{x.R("staffH")},{I(x,"contractorHoursMax")})', 'hours', True)
    row('billH', 'Billable hours', lambda x: f'{x.R("staffH")}+{x.R("contrH")}', 'hours', True)
    row('unservedH', 'Work you could not deliver (hours)', lambda x: f'{x.R("demandH")}-{x.R("billH")}', 'hours', True)
    row('fees', 'Service fees', lambda x: f'{x.R("billH")}*{I(x,"billingRate")}', 'usd', True)
    row('consCost', 'Billable consultants (salary and benefits)', lambda x: f'{x.R("cons")}*{I(x,"consultantSalary")}*(1+{I(x,"burdenPct")}/100)', 'usd', True)
    row('contrCost', 'Contractors', lambda x: f'{x.R("contrH")}*{I(x,"contractorCostPerHour")}', 'usd', True)
    row('admin', 'Non-billable admin staff', lambda x: f'{I(x,"adminStaff")}*{I(x,"adminSalary")}*(1+{I(x,"burdenPct")}/100)', 'usd', True)
    row('bizdev', 'Business development', lambda x: I(x, 'marketingFixed'), 'usd', True)
    row('utilA', 'Actual utilization (%)', lambda x: f'{x.R("staffH")}/{x.R("avail")}*100', 'pct')
    row('rpe', 'Revenue per billable employee', lambda x: f'{x.R("fees")}/{x.R("cons")}')
    model_tail(c, ['fees'], ['consCost', 'contrCost'], ['bizdev'], [], ['admin'],
               coll_fn=lambda x: x.DELAY('inv', I(x, 'collectionDays')),
               paid_fn=lambda x: f'{x.R("consCost")}+{x.R("admin")}+{x.DELAY("contrCost", I(x,"supplierDays"))}+{x.R("bizdev")}')
    ch = c.check
    ch(BM, 'Active engagements', 'activeC', 1, 'count', src=T('Active engagements'))
    ch(BM, 'Active engagements', 'activeC', 3, 'count', src=T('Active engagements'))
    ch(BM, 'Hours clients need', 'demandH', 3, 'count', src=T('Hours clients need'))
    ch(BM, 'Delivery capacity (hours)', 'capH', 3, 'count', src=T('Delivery capacity (hours)'))
    ch(BM, 'Hours billed by staff', 'staffH', 3, 'count', src=T('Hours billed by staff'))
    ch(BM, 'Hours billed by contractors', 'contrH', 3, 'count', src=T('Hours billed by contractors'))
    ch(BM, 'Work you could not deliver (hours)', 'unservedH', 3, 'count', src=T('Work you could not deliver (hours)'))
    ch(BM, 'Billable consultants', 'cons', 7, 'count', src=T('Billable consultants'))
    ch(IS, 'Service fees', 'fees', 2, src=T('  Service fees'))
    ch(IS, 'Service fees', 'fees', 3, src=T('  Service fees'))
    ch(IS, 'Service fees', 'fees', 7, src=T('  Service fees'))
    ch(IS, 'Billable consultants (salary and benefits)', 'consCost', 1, src=T('  Billable consultants (salary and benefits)'))
    ch(IS, 'Billable consultants (salary and benefits)', 'consCost', 7, src=T('  Billable consultants (salary and benefits)'))
    ch(IS, 'Contractors', 'contrCost', 3, src=T('  Contractors'))
    ch(IS, 'General and administrative', 'ga', 1, conv='C8', src=T('General and administrative'), note='Admin staff')
    ch(IS, 'Gross profit', 'gp', 3, src=T('Gross profit'))
    ch(BM, 'Actual utilization', 'utilA', 1, 'pct', src=T('Actual utilization %'))
    ch(BM, 'Actual utilization', 'utilA', 7, 'pct', src=T('Actual utilization %'))
    ch(BM, 'Revenue per billable employee', 'rpe', 7, src=T('Revenue per billable employee'))
    ch(CF, 'Cash collected from customers', 'coll', 1, src=T('Cash collected from customers'))
    ch(CF, 'Cash collected from customers', 'coll', 2, src=T('Cash collected from customers'))
    common_checks(c, conv_cash='C8')
    return c


# ===========================================================================
# 5. E-commerce

def ecommerce():
    c = new_case('5 E-commerce', '5. E-commerce: orders, refunds, per-order costs, acquisition',
                 'Orders grow 5% a month. Tests net revenue after refunds, the four per-order direct costs (product cost still incurred on returns), '
                 'acquisition spending on new-customer orders only, contribution per order, a 3-day processor payout and 30-day supplier terms.',
                 MODEL_STEPS)
    setup(c, 100000, 0)
    tax_off(c)
    clear_defaults(c)
    S = stream(c, 0, 'ecommerce', 'E-commerce', {}, [
        ('salesStartMonth', 1), ('aov', 80), ('ordersStart', 500), ('orderGrowthPct', 5), ('returnsPct', 10),
        ('productCostPerOrder', 25), ('fulfillmentPerOrder', 5), ('shippingSubsidyPerOrder', 4), ('processingPct', 3), ('processingFixed', 0.3),
        ('newCustomerSharePct', 40), ('cac', 30), ('marketingFixed', 2000), ('collectionDays', 3), ('supplierDays', 30)])
    ecommerce_rows(c, S, 'e', 1)
    I = lambda x, k: x.I(S(k))
    model_tail(c, ['e.net'], ['e.product', 'e.fulfil', 'e.ship', 'e.proc'], ['e.acq', 'e.brand'], [], [],
               coll_fn=lambda x: x.DELAY('inv', I(x, 'collectionDays')),
               paid_fn=lambda x: f'{x.DELAY("e.goods", I(x,"supplierDays"))}+{x.DELAY("e.proc", I(x,"collectionDays"))}+{x.R("e.acq")}+{x.R("e.brand")}')
    c.row('payDirect', 'Cash paid for direct costs', lambda x: f'{x.DELAY("e.goods", I(x,"supplierDays"))}+{x.DELAY("e.proc", I(x,"collectionDays"))}', 'usd', True)
    ch = c.check
    ch(BM, 'Orders', 'e.orders', 1, 'count', src=T('Orders'))
    ch(BM, 'Orders', 'e.orders', 12, 'count', src=T('Orders'))
    ch(BM, 'New customers', 'e.newCust', 1, 'count', src=T('New customers'))
    ch(IS, 'Total revenue', 'revenue', 1, src=T('Total revenue'), note='Net of refunds')
    ch(IS, 'Total revenue', 'revenue', 12, src=T('Total revenue'))
    ch(IS, 'Payment processing', 'e.proc', 1, src=T('  Payment processing'))
    ch(IS, 'Product cost', 'e.product', 1, src=T('  Product cost'))
    ch(IS, 'Total direct costs', 'direct', 1, src=T('Total direct costs'))
    ch(IS, 'Total direct costs', 'direct', 12, src=T('Total direct costs'))
    ch(IS, 'Sales and marketing', 'sm', 1, src=T('Sales and marketing'))
    ch(IS, 'Gross profit', 'gp', 12, src=T('Gross profit'))
    ch(BM, 'Contribution margin per order', 'e.contrib', 1, src=T('Contribution margin per order'))
    ch(BM, 'Net revenue', 'e.net', 6, src=T('Net revenue'))
    ch(CF, 'Cash collected from customers', 'coll', 1, conv='C9', src=T('Cash collected from customers'), note='90% of month 1 (3 days)')
    ch(CF, 'Cash collected from customers', 'coll', 2, conv='C9', src=T('Cash collected from customers'))
    ch(CF, 'Cash paid for direct costs', 'payDirect', 1, conv='C7, C9', sign=-1, src=T('Cash paid for direct costs'), note='Shown as a negative')
    ch(CF, 'Cash paid for direct costs', 'payDirect', 2, conv='C7, C9', sign=-1, src=T('Cash paid for direct costs'))
    common_checks(c, cash_months=(1, 2, 12, 24), conv_cash='C7')
    return c


def ecommerce_rows(c: Case, S, p, start_month_key=None):
    """E-commerce rows with prefix p. Handles a later first month of sales by shifting."""
    I = lambda x, k: x.I(S(k))
    row = c.row
    row(f'{p}.rel', 'Month of sales (0 = before launch)', lambda x: f'MAX(0,{x.M}-{I(x,"salesStartMonth")}+1)', 'month')
    row(f'{p}.orders', 'Orders', lambda x: f'IF({x.R(p + ".rel")}>=1,{I(x,"ordersStart")}*(1+{I(x,"orderGrowthPct")}/100)^({x.R(p + ".rel")}-1),0)', 'count', True)
    row(f'{p}.gross', 'Gross sales', lambda x: f'{x.R(p + ".orders")}*{I(x,"aov")}', 'usd', True)
    row(f'{p}.refunds', 'Returns and refunds', lambda x: f'{x.R(p + ".gross")}*{I(x,"returnsPct")}/100', 'usd', True)
    row(f'{p}.net', 'Net revenue', lambda x: f'{x.R(p + ".gross")}-{x.R(p + ".refunds")}', 'usd', True)
    row(f'{p}.product', 'Product cost', lambda x: f'{x.R(p + ".orders")}*{I(x,"productCostPerOrder")}', 'usd', True)
    row(f'{p}.fulfil', 'Packaging and fulfillment', lambda x: f'{x.R(p + ".orders")}*{I(x,"fulfillmentPerOrder")}', 'usd', True)
    row(f'{p}.ship', 'Shipping subsidy', lambda x: f'{x.R(p + ".orders")}*{I(x,"shippingSubsidyPerOrder")}', 'usd', True)
    row(f'{p}.proc', 'Payment processing', lambda x: f'{x.R(p + ".orders")}*({I(x,"aov")}*{I(x,"processingPct")}/100+{I(x,"processingFixed")})', 'usd', True)
    row(f'{p}.goods', 'Product suppliers and fulfillment (product + fulfillment + shipping)', lambda x: f'{x.R(p + ".product")}+{x.R(p + ".fulfil")}+{x.R(p + ".ship")}', 'usd', True)
    row(f'{p}.newCust', 'New customers', lambda x: f'{x.R(p + ".orders")}*{I(x,"newCustomerSharePct")}/100', 'count', True)
    row(f'{p}.acq', 'Customer acquisition', lambda x: f'{x.R(p + ".newCust")}*{I(x,"cac")}', 'usd', True)
    row(f'{p}.brand', 'Brand marketing', lambda x: f'IF({x.R(p + ".rel")}>=1,{I(x,"marketingFixed")},0)', 'usd', True)
    row(f'{p}.contrib', 'Contribution margin per order',
        lambda x: f'IF({x.R(p + ".orders")}=0,0,({x.R(p + ".net")}-{x.R(p + ".goods")}-{x.R(p + ".proc")}-{x.R(p + ".acq")})/{x.R(p + ".orders")})')


# ===========================================================================
# 6. Marketplace

def marketplace():
    c = new_case('6 Marketplace', '6. Marketplace: take rate on GMV, seller-supply limit',
                 'Buyers grow faster than sellers, so transactions are limited by buyer demand until month 4 and by seller capacity from month 5. '
                 'Tests that revenue is the take rate on GMV (not GMV), processing charged on full GMV, support and dispute costs, and buyer and seller acquisition.',
                 MODEL_STEPS)
    setup(c, 50000, 0)
    tax_off(c)
    clear_defaults(c)
    S = stream(c, 0, 'marketplace', 'Marketplace', {}, [
        ('salesStartMonth', 1), ('buyersStart', 1000), ('buyerGrowthPct', 10), ('sellersStart', 30), ('sellerGrowthPct', 5), ('maxTxPerSeller', 60),
        ('txPerBuyer', 1.5), ('avgTxValue', 50), ('takeRatePct', 15), ('processingPctOfGmv', 3), ('supportPerTx', 0.5),
        ('disputeRatePct', 2), ('disputeCost', 25), ('buyerCac', 20), ('sellerCac', 100), ('marketingFixed', 1500),
        ('collectionDays', 0), ('supplierDays', 0)])
    I = lambda x, k: x.I(S(k))
    row = c.row
    row('buyers', 'Active buyers', lambda x: f'{I(x,"buyersStart")}*(1+{I(x,"buyerGrowthPct")}/100)^({x.M}-1)', 'count')
    row('newBuyers', 'New buyers', lambda x: f'{x.R("buyers")}-{x.R("buyers", -1) if x.m > 1 else x.R("buyers")}', 'count', True)
    row('sellers', 'Active sellers', lambda x: f'{I(x,"sellersStart")}*(1+{I(x,"sellerGrowthPct")}/100)^({x.M}-1)', 'count')
    row('newSellers', 'New sellers', lambda x: f'{x.R("sellers")}-{x.R("sellers", -1) if x.m > 1 else x.R("sellers")}', 'count', True)
    row('demandTx', 'Transactions buyers want', lambda x: f'{x.R("buyers")}*{I(x,"txPerBuyer")}', 'count', True)
    row('supplyTx', 'Transactions sellers can handle', lambda x: f'IF({I(x,"maxTxPerSeller")}=0,1E+99,{x.R("sellers")}*{I(x,"maxTxPerSeller")})', 'count')
    row('tx', 'Transactions', lambda x: f'MIN({x.R("demandTx")},{x.R("supplyTx")})', 'count', True)
    row('gmv', 'Gross merchandise value (not revenue)', lambda x: f'{x.R("tx")}*{I(x,"avgTxValue")}', 'usd', True)
    row('fees', 'Platform fees', lambda x: f'{x.R("gmv")}*{I(x,"takeRatePct")}/100', 'usd', True)
    row('proc', 'Payment processing', lambda x: f'{x.R("gmv")}*{I(x,"processingPctOfGmv")}/100', 'usd', True)
    row('support', 'Support and disputes', lambda x: f'{x.R("tx")}*({I(x,"supportPerTx")}+{I(x,"disputeRatePct")}/100*{I(x,"disputeCost")})', 'usd', True)
    row('buyerAcq', 'Buyer acquisition', lambda x: f'{x.R("newBuyers")}*{I(x,"buyerCac")}', 'usd', True)
    row('sellerAcq', 'Seller acquisition', lambda x: f'{x.R("newSellers")}*{I(x,"sellerCac")}', 'usd', True)
    row('brand', 'Brand marketing', lambda x: I(x, 'marketingFixed'), 'usd', True)
    row('revPerTx', 'Revenue per transaction', lambda x: f'{x.R("fees")}/{x.R("tx")}')
    row('contrib', 'Contribution margin', lambda x: f'{x.R("fees")}-{x.R("proc")}-{x.R("support")}-{x.R("buyerAcq")}-{x.R("sellerAcq")}', 'usd', True)
    model_tail(c, ['fees'], ['proc', 'support'], ['buyerAcq', 'sellerAcq', 'brand'], [], [],
               coll_fn=lambda x: x.DELAY('inv', I(x, 'collectionDays')),
               paid_fn=lambda x: f'{x.DELAY("proc", I(x,"collectionDays"))}+{x.DELAY("support", I(x,"supplierDays"))}+{x.R("buyerAcq")}+{x.R("sellerAcq")}+{x.R("brand")}')
    ch = c.check
    ch(BM, 'Active buyers', 'buyers', 1, 'count', conv='C10', src=T('Active buyers'))
    ch(BM, 'Active buyers', 'buyers', 12, 'count', conv='C10', src=T('Active buyers'))
    ch(BM, 'Transactions', 'tx', 1, 'count', conv='C10', src=T('Transactions'), note='Buyer-limited')
    ch(BM, 'Transactions', 'tx', 4, 'count', conv='C10', src=T('Transactions'), note='Still buyer-limited')
    ch(BM, 'Transactions', 'tx', 5, 'count', conv='C10', src=T('Transactions'), note='Now seller-limited')
    ch(BM, 'Gross merchandise value (not revenue)', 'gmv', 6, conv='C10', src=T('Gross merchandise value (not revenue)'))
    ch(IS, 'Platform fees', 'fees', 1, src=T('  Platform fees'))
    ch(IS, 'Platform fees', 'fees', 12, conv='C10', src=T('  Platform fees'))
    ch(IS, 'Payment processing', 'proc', 1, src=T('  Payment processing'))
    ch(IS, 'Support and disputes', 'support', 1, src=T('  Support and disputes'))
    ch(IS, 'Total direct costs', 'direct', 1, src=T('Total direct costs'))
    ch(IS, 'Sales and marketing', 'sm', 1, conv='C10', src=T('Sales and marketing'), note='No new buyers or sellers in month 1')
    ch(IS, 'Sales and marketing', 'sm', 2, conv='C10', src=T('Sales and marketing'))
    ch(BM, 'Revenue per transaction', 'revPerTx', 1, src=T('Revenue per transaction'))
    ch(BM, 'Contribution margin', 'contrib', 2, conv='C10', src=T('Contribution margin'))
    common_checks(c, conv_cash='C10')
    return c


# ===========================================================================
# 7. Licensing

def licensing():
    c = new_case('7 Licensing', '7. Licensing: whole deals, annual fees, royalties with ramp and delay',
                 'One licensee at start plus 1.5 new deals a quarter from month 3 (a whole deal every other month). Tests upfront fees at signing, annual fees billed '
                 'at the start of each contract year and earned monthly, royalties ramping over four months and paid 60 days late, commissions, and renewals at 50%.',
                 MODEL_STEPS)
    setup(c, 100000, 0)
    tax_off(c)
    clear_defaults(c)
    S = stream(c, 0, 'licensing', 'Licensing', {}, [
        ('salesStartMonth', 1), ('initialLicensees', 1), ('newPerQuarter', 1.5), ('firstDealMonth', 3),
        ('upfrontFee', 20000), ('annualFee', 12000), ('royaltyPct', 5), ('licenseeUnits', 1000), ('licenseeUnitPrice', 20), ('rampMonths', 4),
        ('termMonths', 12), ('renewalPct', 50), ('commissionPct', 10), ('supportPerLicensee', 500), ('ipCostMonthly', 1000),
        ('collectionDays', 30), ('royaltyDays', 60), ('supplierDays', 0)])
    I = lambda x, k: x.I(S(k))
    row = c.row
    row('dealExp', 'Expected new deals', lambda x: f'IF({x.M}>={I(x,"firstDealMonth")},{I(x,"newPerQuarter")}/3,0)', 'count', True)
    row('dealCum', 'Running expected total', lambda x: x.CUM('dealExp'), 'count')
    row('deals', 'New licensees signed', lambda x: x.WHOLE('dealCum'), 'count', True)
    row('starts', 'Contracts starting (new + at start)', lambda x: f'{x.R("deals")}+IF({x.M}=1,{I(x,"initialLicensees")},0)', 'count', True)
    row('startsLag', 'Contracts that started one term earlier', lambda x: x.LAG('starts', I(x, 'termMonths')), 'count')
    row('first', 'Licensees in first term', lambda x: x.WIN('starts', I(x, 'termMonths')), 'count')
    row('renewed', 'Renewed licensees', lambda x: f'{I(x,"renewalPct")}/100*{x.WIN("startsLag", I(x,"termMonths"))}', 'count')
    row('activeL', 'Active licensees', lambda x: f'{x.R("first")}+{x.R("renewed")}', 'count')
    row('upfront', 'Upfront license fees', lambda x: f'{x.R("deals")}*{I(x,"upfrontFee")}', 'usd', True)
    row('recurring', 'Recurring license fees', lambda x: f'{x.R("first")}*{I(x,"annualFee")}/12', 'usd', True)
    row('renewal', 'Renewal fees', lambda x: f'{x.R("renewed")}*{I(x,"annualFee")}/12', 'usd', True)

    def royalty(x):
        mrow = f'INDEX(${"C"}${x.mrow}:$Z${x.mrow},1):INDEX($C${x.mrow}:$Z${x.mrow},{x.M})'
        starts = f'INDEX({x.ROW("starts")},1):INDEX({x.ROW("starts")},{x.M})'
        k = f'({x.M}-{mrow}+1)'
        ramp = f'({k}/{I(x,"rampMonths")}-({k}/{I(x,"rampMonths")}-1)*({k}/{I(x,"rampMonths")}>1))'
        surv = f'(1-(1-{I(x,"renewalPct")}/100)*(({x.M}-{mrow})>={I(x,"termMonths")}))'
        return f'SUMPRODUCT({starts},{ramp},{surv})*{I(x,"licenseeUnits")}*{I(x,"licenseeUnitPrice")}*{I(x,"royaltyPct")}/100'
    row('royalty', 'Royalties', royalty, 'usd', True)
    row('support', 'Licensee support', lambda x: f'{x.R("activeL")}*{I(x,"supportPerLicensee")}', 'usd', True)
    row('commission', 'Sales commissions', lambda x: f'{x.R("deals")}*({I(x,"upfrontFee")}+{I(x,"annualFee")})*{I(x,"commissionPct")}/100', 'usd', True)
    row('ip', 'Patent and IP maintenance', lambda x: I(x, 'ipCostMonthly'), 'usd', True)
    row('feeInv', 'License fees invoiced (upfront + each contract year)', lambda x: f'{x.R("upfront")}+({x.R("starts")}+{I(x,"renewalPct")}/100*{x.R("startsLag")})*{I(x,"annualFee")}', 'usd', True)
    model_tail(c, ['upfront', 'recurring', 'renewal', 'royalty'], ['support'], ['commission'], [], ['ip'],
               inv_fn=lambda x: f'{x.R("feeInv")}+{x.R("royalty")}',
               coll_fn=lambda x: f'{x.DELAY("feeInv", I(x,"collectionDays"))}+{x.DELAY("royalty", I(x,"royaltyDays"))}',
               paid_fn=lambda x: f'{x.R("direct")}+{x.R("opex")}')
    ch = c.check
    ch(BM, 'New licensees signed', 'deals', 3, 'count', src=T('New licensees signed'), note='0.5 expected: not yet a whole deal')
    ch(BM, 'New licensees signed', 'deals', 4, 'count', src=T('New licensees signed'))
    ch(BM, 'New licensees signed', 'deals', 'Total', 'count', src=T('New licensees signed'))
    ch(BM, 'Active licensees', 'activeL', 4, 'count', src=T('Active licensees'))
    ch(BM, 'Active licensees', 'activeL', 13, 'count', conv='C11', src=T('Active licensees'), note='Licensee at start renews at 50%')
    ch(IS, 'Upfront license fees', 'upfront', 4, src=T('  Upfront license fees'))
    ch(IS, 'Recurring license fees', 'recurring', 1, src=T('  Recurring license fees'))
    ch(IS, 'Recurring license fees', 'recurring', 4, src=T('  Recurring license fees'))
    ch(IS, 'Royalties', 'royalty', 1, conv='C11', src=T('  Royalties'))
    ch(IS, 'Royalties', 'royalty', 4, conv='C11', src=T('  Royalties'))
    ch(IS, 'Royalties', 'royalty', 8, conv='C11', src=T('  Royalties'))
    ch(IS, 'Renewal fees', 'renewal', 13, conv='C11', src=T('  Renewal fees'))
    ch(IS, 'Total revenue', 'revenue', 12, conv='C11', src=T('Total revenue'))
    ch(IS, 'Sales and marketing', 'sm', 4, src=T('Sales and marketing'), note='Commission')
    ch(IS, 'Total direct costs', 'direct', 4, src=T('Total direct costs'))
    ch(CF, 'Cash collected from customers', 'coll', 2, src=T('Cash collected from customers'), note='Month-1 annual fee')
    ch(CF, 'Cash collected from customers', 'coll', 3, conv='C11', src=T('Cash collected from customers'), note='Month-1 royalty, 60 days')
    ch(CF, 'Cash collected from customers', 'coll', 5, conv='C11', src=T('Cash collected from customers'))
    ch(CF, 'Deferred revenue', 'deferred', 1, src=T('Deferred revenue'), note='Balances section')
    common_checks(c, conv_cash='C11')
    for x in c.checks[-5:-3]:
        x.conv = 'C11'
    return c


# ===========================================================================
# 8. Mixed

def mixed():
    c = new_case('8 Mixed', '8. Mixed: three revenue streams, one launching in month 4, plus shared costs',
                 'A subscription stream, an online store that only starts selling in month 4, and fixed-fee consulting limited by capacity, with one shared role and one shared expense. '
                 'Tests that streams add up, that each stream’s lines carry its name, that a later first month of sales shifts the whole stream (including its own marketing), '
                 'and the fixed-fee revenue reduction when the team lacks capacity.',
                 ['Start a new project with the Software model. (Shortcut: open docs/validation/projects/8-mixed.vfm.json.)',
                  'Venture Setup: start month, 24 months, cash amounts below.',
                  'Business Model: add a second revenue stream (E-commerce) and a third (Professional services). Rename the streams exactly as below: the app adds the name to each line.',
                  'Assumptions › Team: keep one role as listed, remove the other. Expenses: keep one monthly expense as listed, remove the rest. Turn the income tax estimate off.',
                  'Set every option and input listed below, then read the checkpoints in Financial Projections, Base case.'])
    setup(c, 100000, 0)
    tax_off(c)
    role(c, 'r1', 'Founder', 1, 6000, 0, 1, 0, 0, 'admin')
    expense(c, 'e1', 'Rent and facilities', 'ga', 'recurring', 2000, 1)
    A = stream(c, 0, 'software', 'Subscriptions', {'subscription': True, 'annualPlans': False, 'perpetual': False, 'projects': False}, [
        ('salesStartMonth', 1), ('subInitialCustomers', 50), ('subNewPerMonth', 10), ('subNewGrowthPct', 0), ('subPrice', 60), ('subChurnPct', 4),
        ('subOnboardingFee', 0), ('subCac', 100), ('subHostingPerCustomer', 3), ('subSupportPerCustomer', 2),
        ('marketingFixed', 0), ('devCostMonthly', 0), ('collectionDays', 0), ('supplierDays', 0)])
    B = stream(c, 1, 'ecommerce', 'Online store', {}, [
        ('salesStartMonth', 4), ('aov', 50), ('ordersStart', 200), ('orderGrowthPct', 10), ('returnsPct', 5),
        ('productCostPerOrder', 15), ('fulfillmentPerOrder', 3), ('shippingSubsidyPerOrder', 2), ('processingPct', 2.9), ('processingFixed', 0.3),
        ('newCustomerSharePct', 50), ('cac', 20), ('marketingFixed', 500), ('collectionDays', 0), ('supplierDays', 0)])
    C = stream(c, 2, 'services', 'Consulting', {'pricing': 'fixed'}, [
        ('salesStartMonth', 1), ('newClientsPerMonth', 1), ('clientGrowthPct', 0), ('projectDurationMonths', 4), ('hoursPerClientMonth', 50),
        ('projectFee', 20000), ('marketingFixed', 0), ('consultantsStart', 2), ('consultantsAdded', 0), ('consultantsAddedMonth', 13),
        ('hoursPerPerson', 160), ('utilizationPct', 50), ('consultantSalary', 7000), ('burdenPct', 20), ('contractorHoursMax', 0),
        ('contractorCostPerHour', 0), ('adminStaff', 0), ('adminSalary', 0), ('collectionDays', 30), ('supplierDays', 0)])
    IA = lambda x, k: x.I(A(k))
    IC = lambda x, k: x.I(C(k))
    row = c.row
    c.head('Subscriptions (monthly plans only)')
    row('beg', 'Beginning subscribers', lambda x: IA(x, 'subInitialCustomers') if x.m == 1 else x.R('end', -1), 'count')
    row('new', 'New subscribers', lambda x: f'{IA(x,"subNewPerMonth")}*(1+{IA(x,"subNewGrowthPct")}/100)^({x.M}-1)', 'count', True)
    row('end', 'Ending subscribers', lambda x: f'{x.R("beg")}*(1-{IA(x,"subChurnPct")}/100)+{x.R("new")}', 'count')
    row('subRev', 'Subscription revenue (Subscriptions)', lambda x: f'{x.R("end")}*{IA(x,"subPrice")}', 'usd', True)
    row('serve', 'Hosting and support (cost to serve) (Subscriptions)', lambda x: f'{x.R("end")}*({IA(x,"subHostingPerCustomer")}+{IA(x,"subSupportPerCustomer")})', 'usd', True)
    row('subAcq', 'Subscriber acquisition (Subscriptions)', lambda x: f'{x.R("new")}*{IA(x,"subCac")}', 'usd', True)
    c.head('Online store (launches in its first month of sales)')
    ecommerce_rows(c, B, 'e')
    c.head('Consulting (fixed fee)')
    row('cNew', 'New engagements', lambda x: x.WHOLE('cCum'), 'count', True)
    row('cCum', 'Running expected engagements', lambda x: f'{IC(x,"newClientsPerMonth")}*{x.M}', 'count')
    row('cActive', 'Active engagements', lambda x: x.WIN('cNew', IC(x, 'projectDurationMonths')), 'count')
    row('cDemand', 'Hours clients need', lambda x: f'{x.R("cActive")}*{IC(x,"hoursPerClientMonth")}', 'hours')
    row('cCap', 'Delivery capacity (hours)', lambda x: f'{IC(x,"consultantsStart")}*{IC(x,"hoursPerPerson")}*{IC(x,"utilizationPct")}/100+{IC(x,"contractorHoursMax")}', 'hours')
    row('cBill', 'Billable hours', lambda x: f'MIN({x.R("cDemand")},{x.R("cCap")})', 'hours')
    row('cFees', 'Service fees (Consulting)', lambda x: f'IF({x.R("cDemand")}=0,0,{x.R("cActive")}*{IC(x,"projectFee")}/{IC(x,"projectDurationMonths")}*{x.R("cBill")}/{x.R("cDemand")})', 'usd', True)
    row('cCost', 'Billable consultants (salary and benefits) (Consulting)', lambda x: f'{IC(x,"consultantsStart")}*{IC(x,"consultantSalary")}*(1+{IC(x,"burdenPct")}/100)', 'usd', True)
    c.head('Shared')
    row('founder', 'Personnel (Founder)', lambda x: f'{x.I("r1.count")}*{x.I("r1.comp")}*(1+{x.I("r1.burden")}/100)', 'usd', True)
    row('rent', 'Rent and facilities', lambda x: x.I('e1.amount'), 'usd', True)
    c.head('Income statement')
    model_tail(c, ['subRev', 'e.net', 'cFees'], ['serve', 'e.product', 'e.fulfil', 'e.ship', 'e.proc', 'cCost'], ['subAcq', 'e.acq', 'e.brand'], [], ['rent'],
               coll_fn=lambda x: f'{x.R("subRev")}+{x.R("e.net")}+{x.DELAY("cFees", IC(x,"collectionDays"))}',
               paid_fn=lambda x: f'{x.R("direct")}+{x.R("opex")}')
    # personnel is part of opex: patch the opex and paid rows to include it
    for r in c.rows:
        if r.key == 'opex':
            r.fn = lambda x: f'{x.R("founder")}+{x.R("sm")}+{x.R("rd")}+{x.R("ga")}+{x.R("other")}'
        if r.key == 'paid':
            r.fn = lambda x: f'{x.R("direct")}+{x.R("opex")}'
    ch = c.check
    ch(IS, 'Subscription revenue (Subscriptions)', 'subRev', 1, src=T('  Subscription revenue (Subscriptions)'))
    ch(IS, 'Subscription revenue (Subscriptions)', 'subRev', 12, src=T('  Subscription revenue (Subscriptions)'))
    ch(IS, 'Product sales (Online store)', 'e.gross', 3, src=T('  Product sales (Online store)'), note='Before launch: 0')
    ch(IS, 'Product sales (Online store)', 'e.gross', 4, src=T('  Product sales (Online store)'), note='Gross, before refunds')
    ch(BM, 'Online store › Orders', 'e.orders', 5, 'count', src=('stream_metric', 'Online store', 'Orders'))
    ch(IS, 'Service fees (Consulting)', 'cFees', 3, src=T('  Service fees (Consulting)'))
    ch(IS, 'Service fees (Consulting)', 'cFees', 4, src=T('  Service fees (Consulting)'), note='Capacity 160 h for 200 h of work')
    ch(IS, 'Total revenue', 'revenue', 1, src=T('Total revenue'))
    ch(IS, 'Total revenue', 'revenue', 4, src=T('Total revenue'))
    ch(IS, 'Total revenue', 'revenue', 12, src=T('Total revenue'))
    ch(IS, 'Total direct costs', 'direct', 4, src=T('Total direct costs'))
    ch(IS, 'Personnel', 'founder', 1, src=T('Personnel'))
    ch(IS, 'Sales and marketing', 'sm', 3, src=T('Sales and marketing'), note='Store marketing not yet started')
    ch(IS, 'Sales and marketing', 'sm', 4, src=T('Sales and marketing'))
    ch(IS, 'General and administrative', 'ga', 1, src=T('General and administrative'))
    ch(IS, 'EBITDA (simplified)', 'ebitda', 4, src=T('EBITDA (simplified)'))
    ch(CF, 'Cash collected from customers', 'coll', 2, src=T('Cash collected from customers'))
    common_checks(c)
    return c


# ===========================================================================
# 9. Shared costs and funding

def shared():
    c = new_case('9 Shared costs', '9. Team, expenses, equipment, equity, grant and loan',
                 'A plain store with steady revenue, so every number below comes from the shared engine: raises on hiring anniversaries, a role that ends, a sales role, a delivery role '
                 'counted as a direct cost, expenses with payment delays, an annual increase and an end month, two pieces of equipment, a SAFE, a grant and an amortizing loan.',
                 ['Start a new project with the E-commerce model. (Shortcut: open docs/validation/projects/9-shared-costs.vfm.json.)',
                  'Venture Setup: start month, 24 months, cash amounts below.',
                  'Assumptions › Revenue: set the store inputs below (all other store inputs 0).',
                  'Assumptions › Team: replace the example roles with the four below (open each row’s details for department, raise and last month).',
                  'Assumptions › Expenses: remove the examples and add the four below. Equipment: add the two items. Funding: add the three sources. Turn the income tax estimate off.',
                  'Read the checkpoints in Financial Projections, Base case (Income statement, Cash flow, Dashboard).'])
    setup(c, 20000, 30000, 25000)
    tax_off(c)
    S = stream(c, 0, 'ecommerce', 'E-commerce', {}, [
        ('salesStartMonth', 1), ('aov', 100), ('ordersStart', 300), ('orderGrowthPct', 0), ('returnsPct', 0),
        ('productCostPerOrder', 40), ('fulfillmentPerOrder', 0), ('shippingSubsidyPerOrder', 0), ('processingPct', 0), ('processingFixed', 0),
        ('newCustomerSharePct', 0), ('cac', 0), ('marketingFixed', 0), ('collectionDays', 0), ('supplierDays', 0)])
    role(c, 'r1', 'CEO', 1, 8000, 10, 1, 0, 5, 'admin')
    role(c, 'r2', 'Engineers', 2, 9000, 20, 4, 0, 10, 'product')
    role(c, 'r3', 'Support technician', 1, 4000, 15, 2, 9, 0, 'delivery')
    role(c, 'r4', 'Account executive', 1, 5000, 20, 6, 0, 0, 'sales')
    expense(c, 'e1', 'Rent', 'ga', 'recurring', 3000, 1, 0, 6, 0)
    expense(c, 'e2', 'Online ads', 'sm', 'recurring', 1500, 3, 20, 0, 30)
    expense(c, 'e3', 'Prototype', 'rd', 'one-time', 12000, 2, 0, 0, 45)
    expense(c, 'e4', 'Miscellaneous', 'other', 'recurring', 500, 1, 0, 0, 15)
    capex(c, 'c1', 'Laptops', 9000, 1, 36)
    capex(c, 'c2', 'Lab equipment', 24000, 6, 48)
    funding(c, 'f1', 'Seed SAFE', 'equity', 150000, 3, equity_pct=10, instrument='safe')
    funding(c, 'f2', 'State innovation grant', 'grant', 50000, 5)
    funding(c, 'f3', 'Bank loan', 'loan', 60000, 2, rate=12, term=24)
    I = lambda x, k: x.I(S(k))
    row = c.row

    def role_cost(rid):
        def f(x):
            end = f'IF({x.I(rid + ".end")}=0,9999,{x.I(rid + ".end")})'
            return (f'IF(AND({x.M}>={x.I(rid + ".start")},{x.M}<={end}),{x.I(rid + ".count")}*{x.I(rid + ".comp")}'
                    f'*(1+{x.I(rid + ".raise")}/100)^INT(({x.M}-{x.I(rid + ".start")})/12)*(1+{x.I(rid + ".burden")}/100),0)')
        return f

    def recurring(eid):
        def f(x):
            end = f'IF({x.I(eid + ".end")}=0,9999,{x.I(eid + ".end")})'
            return (f'IF(AND({x.M}>={x.I(eid + ".start")},{x.M}<={end}),{x.I(eid + ".amount")}'
                    f'*(1+{x.I(eid + ".growth")}/100)^INT(({x.M}-{x.I(eid + ".start")})/12),0)')
        return f

    c.head('Revenue')
    row('rev', 'Product sales', lambda x: f'{I(x,"ordersStart")}*{I(x,"aov")}', 'usd', True)
    row('cogs', 'Product cost', lambda x: f'{I(x,"ordersStart")}*{I(x,"productCostPerOrder")}', 'usd', True)
    c.head('Team')
    row('r1', 'CEO', role_cost('r1'), 'usd', True)
    row('r2', 'Engineers', role_cost('r2'), 'usd', True)
    row('r3', 'Support technician (delivery staff)', role_cost('r3'), 'usd', True)
    row('r4', 'Account executive (sales)', role_cost('r4'), 'usd', True)
    row('personnel', 'Personnel (operating expense)', lambda x: f'{x.R("r1")}+{x.R("r2")}+{x.R("r4")}', 'usd', True)
    c.head('Expenses')
    row('e1', 'Rent', recurring('e1'), 'usd', True)
    row('e2', 'Online ads', recurring('e2'), 'usd', True)
    row('e3', 'Prototype', lambda x: f'IF({x.M}={x.I("e3.start")},{x.I("e3.amount")},0)', 'usd', True)
    row('e4', 'Miscellaneous', recurring('e4'), 'usd', True)
    row('expPaid', 'Expenses paid (after each delay)', lambda x: '+'.join(x.DELAY(e, x.I(e + '.delay')) for e in ['e1', 'e2', 'e3', 'e4']), 'usd', True)
    row('expDue', 'Expenses incurred', lambda x: f'{x.R("e1")}+{x.R("e2")}+{x.R("e3")}+{x.R("e4")}', 'usd', True)
    c.head('Equipment')
    row('capexRow', 'Equipment purchases', lambda x: f'IF({x.M}={x.I("c1.month")},{x.I("c1.amount")},0)+IF({x.M}={x.I("c2.month")},{x.I("c2.amount")},0)', 'usd', True)
    row('depRow', 'Depreciation', lambda x: '+'.join(
        f'IF(AND({x.M}>={x.I(k + ".month")},{x.M}<{x.I(k + ".month")}+{x.I(k + ".life")}),{x.I(k + ".amount")}/{x.I(k + ".life")},0)' for k in ['c1', 'c2']), 'usd', True)
    c.head('Funding')
    row('equityIn', 'Investment and grants', lambda x: f'IF({x.M}={x.I("f1.month")},{x.I("f1.amount")},0)+IF({x.M}={x.I("f2.month")},{x.I("f2.amount")},0)', 'usd', True)
    row('loanIn', 'Loan proceeds', lambda x: f'IF({x.M}={x.I("f3.month")},{x.I("f3.amount")},0)', 'usd', True)
    row('loanPmt', 'Loan payment (equal monthly payments from the month after)', lambda x: (
        f'IF(AND({x.M}>{x.I("f3.month")},{x.M}<={x.I("f3.month")}+{x.I("f3.term")}),'
        f'{x.I("f3.amount")}*({x.I("f3.rate")}/1200)/(1-(1+{x.I("f3.rate")}/1200)^(-{x.I("f3.term")})),0)'), 'usd', True)
    row('interest', 'Interest', lambda x: f'IF({x.M}>{x.I("f3.month")},{x.R("loanBal", -1)}*{x.I("f3.rate")}/1200,0)', 'usd', True)
    row('principal', 'Loan repayments (principal)', lambda x: f'{x.R("loanPmt")}-{x.R("interest")}', 'usd', True)
    row('loanBal', 'Loan balance', lambda x: f'{x.R("loanBal", -1)}+{x.R("loanIn")}-{x.R("principal")}')
    c.head('Income statement and cash')
    row('revenue', 'Total revenue', lambda x: x.R('rev'), 'usd', True)
    row('direct', 'Total direct costs', lambda x: f'{x.R("cogs")}+{x.R("r3")}', 'usd', True)
    row('gp', 'Gross profit', lambda x: f'{x.R("revenue")}-{x.R("direct")}', 'usd', True)
    row('opex', 'Total operating expenses', lambda x: f'{x.R("personnel")}+{x.R("expDue")}', 'usd', True)
    row('ebitda', 'EBITDA (simplified)', lambda x: f'{x.R("gp")}-{x.R("opex")}', 'usd', True)
    row('op', 'Operating profit (loss)', lambda x: f'{x.R("ebitda")}-{x.R("depRow")}', 'usd', True)
    row('ni', 'Net income', lambda x: f'{x.R("op")}-{x.R("interest")}', 'usd', True)
    row('salPaid', 'Cash paid for salaries', lambda x: f'{x.R("r1")}+{x.R("r2")}+{x.R("r3")}+{x.R("r4")}', 'usd', True)
    row('founderIn', 'Founder investment', lambda x: f'IF({x.M}=1,{x.I("founderInvestment")},0)', 'usd', True)
    row('net', 'Net change in cash', lambda x: (f'{x.R("revenue")}-{x.R("cogs")}-{x.R("salPaid")}-{x.R("expPaid")}-{x.R("capexRow")}-{x.R("loanPmt")}'
                                                 f'+{x.R("equityIn")}+{x.R("loanIn")}+IF({x.M}=1,{x.I("founderInvestment")},0)'), 'usd', True)
    row('cash', 'Ending cash', lambda x: f'{x.I("startingCash")}+{x.CUM("net")}')
    row('bills', 'Bills not yet paid', lambda x: f'{x.CUM("expDue")}-{x.CUM("expPaid")}')
    row('burn', 'Monthly burn', lambda x: f'-({x.R("net")}-{x.R("equityIn")}-{x.R("loanIn")}-IF({x.M}=1,{x.I("founderInvestment")},0))', 'usd', True)
    row('allPos', 'Operating profit ≥ 0 from here to the end? (1 = yes)', lambda x: f'IF(COUNTIF(INDEX({x.ROW("op")},{x.M}):INDEX({x.ROW("op")},{24}),"<0")=0,1,0)', 'count')
    c.scalar('minCash', 'Lowest cash balance', lambda s: f'MIN({s.ROW("cash")})')
    c.scalar('fundReq', 'Additional funding required', lambda s: f'MAX(0,{s.I("minCashCushion")}-MIN({s.ROW("cash")}))')
    c.scalar('breakeven', 'Break-even month (0 = not reached)', lambda s: f'IFERROR(MATCH(1,{s.ROW("allPos")},0),0)', 'count')
    c.scalar('avgBurn', 'Monthly burn, average of the last three months', lambda s: f'AVERAGE({s.AT("burn", 22)}:{s.AT("burn", 24)})')
    ch = c.check
    ch(IS, 'Personnel', 'personnel', 1, src=T('Personnel'))
    ch(IS, 'Personnel', 'personnel', 4, src=T('Personnel'), note='Engineers start')
    ch(IS, 'Personnel', 'personnel', 5, src=T('Personnel'), note='Before the account executive starts')
    ch(IS, 'Personnel', 'personnel', 6, conv='C21', src=T('Personnel'), note='Account executive starts (sales department)')
    ch(IS, 'Sales and marketing', 'e2', 6, conv='C21', src=T('Sales and marketing'), note='Ads only; sales pay is in Personnel')
    ch(IS, 'Personnel', 'personnel', 13, src=T('Personnel'), note='CEO first raise')
    ch(IS, 'Personnel', 'personnel', 16, src=T('Personnel'), note='Engineers first raise')
    ch(IS, 'Total direct costs', 'direct', 2, src=T('Total direct costs'), note='Support technician starts')
    ch(IS, 'Total direct costs', 'direct', 10, src=T('Total direct costs'), note='Support technician has left')
    ch(IS, 'Sales and marketing', 'e2', 3, src=T('Sales and marketing'))
    ch(IS, 'Sales and marketing', 'e2', 21, src=T('Sales and marketing'), note='Ads ended in month 20')
    ch(IS, 'Research and development', 'e3', 2, src=T('Research and development'))
    ch(IS, 'General and administrative', 'e1', 13, conv='C12', src=T('General and administrative'), note='Rent +6% after 12 months')
    ch(IS, 'Depreciation', 'depRow', 1, src=T('Depreciation'))
    ch(IS, 'Depreciation', 'depRow', 6, src=T('Depreciation'))
    ch(IS, 'Interest', 'interest', 3, src=T('Interest'))
    ch(IS, 'Interest', 'interest', 24, src=T('Interest'))
    ch(IS, 'Net income', 'ni', 3, src=T('Net income'))
    ch(CF, 'Founder investment', 'founderIn', 1, src=T('Founder investment'))
    ch(CF, 'Investment and grants', 'equityIn', 3, src=T('Investment and grants'))
    ch(CF, 'Investment and grants', 'equityIn', 5, src=T('Investment and grants'))
    ch(CF, 'Loan proceeds', 'loanIn', 2, src=T('Loan proceeds'))
    ch(CF, 'Loan repayments', 'principal', 3, sign=-1, src=T('Loan repayments'), note='Shown as a negative')
    ch(CF, 'Cash paid for operating expenses', 'expPaid', 2, sign=-1, src=T('Cash paid for operating expenses'))
    ch(CF, 'Cash paid for operating expenses', 'expPaid', 3, sign=-1, conv='C12', src=T('Cash paid for operating expenses'), note='Half of the prototype (45 days)')
    ch(CF, 'Cash paid for operating expenses', 'expPaid', 4, sign=-1, src=T('Cash paid for operating expenses'))
    ch(CF, 'Cash paid for salaries', 'salPaid', 4, sign=-1, conv='C13', src=T('Cash paid for salaries'))
    ch(CF, 'Equipment purchases', 'capexRow', 6, sign=-1, src=T('Equipment purchases'))
    ch(CF, 'Bills not yet paid', 'bills', 2, src=T('Bills not yet paid'), note='Balances section')
    ch(CF, 'Loan balance', 'loanBal', 24, src=T('Loan balance'), note='Balances section')
    ch(CF, 'Ending cash', 'cash', 1, src=T('Ending cash'))
    ch(CF, 'Ending cash', 'cash', 12, conv='C12', src=T('Ending cash'))
    ch(CF, 'Ending cash', 'cash', 24, conv='C12', src=T('Ending cash'))
    ch('Financial Projections › Dashboard', 'Additional funding required', 'fundReq', None, conv='C12', src=('summary', 'fundingRequired'))
    ch('Financial Projections › Dashboard', 'Break-even month (0 = "Not reached")', 'breakeven', None, 'count', conv='C12', src=('summary', 'operatingBreakEvenMonth'))
    ch('Financial Projections › Dashboard', 'Monthly burn', 'avgBurn', None, conv='C12, C14', src=('summary', 'currentBurn'))
    return c


# ===========================================================================
# 10. Taxes

def taxes():
    c = new_case('10 Taxes', '10. Income tax: loss carryforward, quarterly vs annual, pass-through',
                 'A store that loses money for six months and then grows into profit. Run it three times by changing only the tax settings. Tests that early losses '
                 'shelter later profit, the monthly tax estimate, quarterly payments the month after each quarter, annual payment three months after year end, '
                 'and a pass-through entity showing owner distributions instead of company tax.',
                 ['Start a new project with the E-commerce model. (Shortcut: open docs/validation/projects/10-taxes.vfm.json, which starts as variant A.)',
                  'Venture Setup: start month, 24 months, cash amounts below. Team: remove both roles. Expenses: remove the examples and add the one below.',
                  'Assumptions › Revenue: set the store inputs below.',
                  'Variant A: Funding and taxes › tax on, C corporation, Quarterly estimates, rate 25%. Read block A.',
                  'Variant B: change only "When tax is paid" to "Once a year, after year end". Read block B.',
                  'Variant C: change Legal structure to "LLC, S corporation or partnership", Quarterly estimates, and turn on "Pay owners enough cash to cover the tax". Read block C.'])
    setup(c, 300000, 0)
    S = stream(c, 0, 'ecommerce', 'E-commerce', {}, [
        ('salesStartMonth', 1), ('aov', 100), ('ordersStart', 150), ('orderGrowthPct', 10), ('returnsPct', 0),
        ('productCostPerOrder', 40), ('fulfillmentPerOrder', 0), ('shippingSubsidyPerOrder', 0), ('processingPct', 0), ('processingFixed', 0),
        ('newCustomerSharePct', 0), ('cac', 0), ('marketingFixed', 0), ('collectionDays', 0), ('supplierDays', 0)])
    expense(c, 'e1', 'Overhead', 'ga', 'recurring', 15000, 1)
    c.inp('tax.rate', 'Assumptions › Funding and taxes', 'Combined income tax rate', 25, 'pct')
    c.project['tax'] = {'enabled': True, 'entity': 'c_corp', 'rate': 25, 'payment': 'quarterly', 'includeOwnerDistributions': True}
    I = lambda x, k: x.I(S(k))
    row = c.row
    row('orders', 'Orders', lambda x: f'{I(x,"ordersStart")}*(1+{I(x,"orderGrowthPct")}/100)^({x.M}-1)', 'count', True)
    row('revenue', 'Total revenue', lambda x: f'{x.R("orders")}*{I(x,"aov")}', 'usd', True)
    row('pretax', 'Pretax profit (= operating profit here)', lambda x: f'{x.R("orders")}*({I(x,"aov")}-{I(x,"productCostPerOrder")})-{x.I("e1.amount")}', 'usd', True)
    row('bank', 'Losses carried forward (end of month)', lambda x: f'MAX(0,{x.R("bank", -1)}-{x.R("pretax")})')
    row('tax', 'Income tax (estimate)', lambda x: f'MAX(0,{x.R("pretax")}-{x.R("bank", -1)})*{x.I("tax.rate")}/100', 'usd', True)
    row('ni', 'Net income, C corporation', lambda x: f'{x.R("pretax")}-{x.R("tax")}', 'usd', True)
    row('paidQ', 'Taxes paid, quarterly (month after each quarter)', lambda x: f'IF(AND({x.M}>1,MOD({x.M}-1,3)=0),SUM(INDEX({x.ROW("tax")},{x.M}-3):INDEX({x.ROW("tax")},{x.M}-1)),0)', 'usd', True)
    row('paidA', 'Taxes paid, annual (April after each 12-month year = month 16)', lambda x: f'IF(AND({x.M}>12,MOD({x.M}-16,12)=0),SUM(INDEX({x.ROW("tax")},{x.M}-15):INDEX({x.ROW("tax")},{x.M}-4)),0)', 'usd', True)
    row('cashQ', 'Ending cash, variant A', lambda x: f'{x.I("startingCash")}+{x.CUM("pretax")}-{x.CUM("paidQ")}')
    row('cashA', 'Ending cash, variant B', lambda x: f'{x.I("startingCash")}+{x.CUM("pretax")}-{x.CUM("paidA")}')
    ch = c.check
    ch(IS, 'Operating profit (loss)', 'pretax', 6, src=T('Operating profit (loss)'))
    ch(IS, 'Income tax (estimate)', 'tax', 10, src=T('Income tax (estimate)'), note='Losses still being used up')
    ch(IS, 'Income tax (estimate)', 'tax', 11, src=T('Income tax (estimate)'), note='Last of the losses used')
    ch(IS, 'Income tax (estimate)', 'tax', 12, src=T('Income tax (estimate)'))
    ch(IS, 'Income tax (estimate)', 'tax', 'Total', src=T('Income tax (estimate)'))
    ch(IS, 'Net income', 'ni', 12, src=T('Net income'))
    ch(CF, 'Income taxes paid', 'paidQ', 13, sign=-1, src=T('Income taxes paid'), note='Months 10 to 12')
    ch(CF, 'Income taxes paid', 'paidQ', 16, sign=-1, src=T('Income taxes paid'), note='Months 13 to 15')
    ch(CF, 'Ending cash', 'cashQ', 24, src=T('Ending cash'))
    blockB = [
        _ck(CF, 'Income taxes paid', 'paidA', 13, sign=-1, src=('variant', 'B', 'Income taxes paid'), note='Nothing paid yet'),
        _ck(CF, 'Income taxes paid', 'paidA', 15, sign=-1, conv='C20', src=('variant', 'B', 'Income taxes paid'), note='Not yet paid'),
        _ck(CF, 'Income taxes paid', 'paidA', 16, sign=-1, conv='C20', src=('variant', 'B', 'Income taxes paid'), note='Year 1 tax, paid in month 16 (April)'),
        _ck(IS, 'Income tax (estimate)', 'tax', 12, src=('variant', 'B', 'Income tax (estimate)'), note='Same as variant A'),
        _ck(CF, 'Ending cash', 'cashA', 24, conv='C20', src=('variant', 'B', 'Ending cash')),
    ]
    blockC = [
        _ck(IS, 'Income tax (estimate)', 'zero', 12, src=('variant', 'C', 'Income tax (estimate)'), note='No company tax'),
        _ck(IS, 'Net income', 'pretax', 12, src=('variant', 'C', 'Net income')),
        _ck(CF, 'Owner tax distributions', 'paidQ', 13, conv='C15', sign=-1, src=('variant', 'C', 'Owner tax distributions')),
        _ck(CF, 'Income taxes paid', 'zero', 13, src=('variant', 'C', 'Income taxes paid'), note='Should be 0'),
        _ck(CF, 'Ending cash', 'cashQ', 24, conv='C15', src=('variant', 'C', 'Ending cash'), note='Same as A if distributions mirror tax'),
    ]
    row('zero', 'Zero (for pass-through checks)', lambda x: '0')
    c.blocks = [('Variant B: C corporation, tax paid once a year', blockB), ('Variant C: pass-through with owner distributions', blockC)]
    c.checks_heading = 'Variant A: C corporation, quarterly'
    return c


def _ck(where, line, target, month, unit='usd', conv='', note='', sign=1, src=()):
    from framework import Check
    return Check(where, line, target, month, unit, conv, note, sign, src)


# ===========================================================================
# 11. Scenarios

def scenarios():
    c = new_case('11 Scenarios', '11. Scenarios: driver overrides and the three adjustments',
                 'A subscription business with two hires. The downside lowers price and raises churn and also uses all three adjustments (hiring delay, slower payment, pay change); '
                 'the upside only adds subscribers. Tests that overrides change only what they should and that the base case is untouched.',
                 ['Start a new project with the Software model (subscriptions only). (Shortcut: open docs/validation/projects/11-scenarios.vfm.json.)',
                  'Venture Setup: start month, 24 months, cash amounts below. Expenses: remove all. Turn the income tax estimate off.',
                  'Team: replace the example roles with the two below. Revenue: set the inputs below.',
                  'Scenarios: first clear every suggested downside and upside value (click "Use the base value") and set the downside "Customers pay later by" to 0. '
                  'Then enter only the scenario values below.',
                  'Scenarios › Compare: read the three columns.'])
    setup(c, 50000, 0)
    tax_off(c)
    S = stream(c, 0, 'software', 'Software', {'subscription': True, 'annualPlans': False, 'perpetual': False, 'projects': False}, [
        ('salesStartMonth', 1), ('subInitialCustomers', 100), ('subNewPerMonth', 10), ('subNewGrowthPct', 0), ('subPrice', 50), ('subChurnPct', 5),
        ('subOnboardingFee', 0), ('subCac', 100), ('subHostingPerCustomer', 2), ('subSupportPerCustomer', 3),
        ('marketingFixed', 500), ('devCostMonthly', 0), ('collectionDays', 0), ('supplierDays', 0)])
    role(c, 'r1', 'Founder', 1, 3000, 0, 1, 0, 0, 'admin')
    role(c, 'r2', 'Developer', 1, 6000, 0, 4, 0, 0, 'product')
    sec = 'Scenarios › Driver values by scenario and adjustments'
    c.inp('d.price', sec, 'Downside: Monthly subscription price', 40)
    c.inp('d.churn', sec, 'Downside: Monthly subscriber churn', 8, 'pct')
    c.inp('d.delay', sec, 'Downside: Delay planned hires', 2, 'months')
    c.inp('d.days', sec, 'Downside: Customers pay later by', 30, 'days')
    c.inp('d.comp', sec, 'Downside: Change in all pay', 10, 'pct')
    c.inp('u.new', sec, 'Upside: New subscribers per month', 15, 'count')
    c.inp('u.note', sec, 'Upside: everything else', 'base values, no adjustments', 'text')
    c.project['scenarios'] = {
        'downside': {'overrides': {'subPrice': 40, 'subChurnPct': 8}, 'adjustments': {'hiringDelayMonths': 2, 'extraCollectionDays': 30, 'compChangePct': 10}},
        'upside': {'overrides': {'subNewPerMonth': 15}, 'adjustments': {'hiringDelayMonths': 0, 'extraCollectionDays': 0, 'compChangePct': 0}},
    }
    I = lambda x, k: x.I(S(k))
    row = c.row
    sc = {
        'b': dict(price=lambda x: I(x, 'subPrice'), churn=lambda x: I(x, 'subChurnPct'), new=lambda x: I(x, 'subNewPerMonth'),
                  delay=lambda x: '0', days=lambda x: '0', comp=lambda x: '0'),
        'd': dict(price=lambda x: x.I('d.price'), churn=lambda x: x.I('d.churn'), new=lambda x: I(x, 'subNewPerMonth'),
                  delay=lambda x: x.I('d.delay'), days=lambda x: x.I('d.days'), comp=lambda x: x.I('d.comp')),
        'u': dict(price=lambda x: I(x, 'subPrice'), churn=lambda x: I(x, 'subChurnPct'), new=lambda x: x.I('u.new'),
                  delay=lambda x: '0', days=lambda x: '0', comp=lambda x: '0'),
    }
    names = {'b': 'Base', 'd': 'Downside', 'u': 'Upside'}
    for s, v in sc.items():
        c.head(f'{names[s]} case')
        row(f'{s}.end', 'Ending subscribers', (lambda v, s: lambda x: (
            f'{I(x,"subInitialCustomers") if x.m == 1 else x.R(f"{s}.end", -1)}*(1-{v["churn"](x)}/100)+{v["new"](x)}'))(v, s), 'count')
        row(f'{s}.rev', 'Total revenue', (lambda v, s: lambda x: f'{x.R(f"{s}.end")}*{v["price"](x)}')(v, s), 'usd', True)
        row(f'{s}.direct', 'Total direct costs', (lambda s: lambda x: f'{x.R(f"{s}.end")}*({I(x,"subHostingPerCustomer")}+{I(x,"subSupportPerCustomer")})')(s), 'usd', True)
        row(f'{s}.pers', 'Personnel', (lambda v: lambda x: (
            f'({x.I("r1.comp")}*{x.I("r1.count")}*({x.M}>={x.I("r1.start")})'
            f'+{x.I("r2.comp")}*{x.I("r2.count")}*({x.M}>={x.I("r2.start")}+IF({x.I("r2.start")}>1,{v["delay"](x)},0)))*(1+{v["comp"](x)}/100)'))(v), 'usd', True)
        row(f'{s}.opex', 'Total operating expenses', (lambda v, s: lambda x: f'{x.R(f"{s}.pers")}+{v["new"](x)}*{I(x,"subCac")}+{I(x,"marketingFixed")}')(v, s), 'usd', True)
        row(f'{s}.op', 'Operating profit = EBITDA', (lambda s: lambda x: f'{x.R(f"{s}.rev")}-{x.R(f"{s}.direct")}-{x.R(f"{s}.opex")}')(s), 'usd', True)
        row(f'{s}.coll', 'Cash collected', (lambda v, s: lambda x: x.DELAY(f'{s}.rev', f'({I(x,"collectionDays")}+{v["days"](x)})'))(v, s), 'usd', True)
        row(f'{s}.cash', 'Ending cash', (lambda s: lambda x: f'{x.I("startingCash")}+{x.CUM(f"{s}.coll")}-{x.CUM(f"{s}.direct")}-{x.CUM(f"{s}.opex")}')(s))
        row(f'{s}.allPos', 'Operating profit ≥ 0 from here on (1 = yes)', (lambda s: lambda x: f'IF(COUNTIF(INDEX({x.ROW(f"{s}.op")},{x.M}):INDEX({x.ROW(f"{s}.op")},24),"<0")=0,1,0)')(s), 'count')
    for s in sc:
        n = names[s]
        c.scalar(f'{s}.totRev', f'{n}: Total revenue', (lambda s: lambda q: f'SUM({q.ROW(f"{s}.rev")})')(s))
        c.scalar(f'{s}.gm', f'{n}: Gross margin (%)', (lambda s: lambda q: f'(SUM({q.ROW(f"{s}.rev")})-SUM({q.ROW(f"{s}.direct")}))/SUM({q.ROW(f"{s}.rev")})*100')(s), 'pct')
        c.scalar(f'{s}.ebitda', f'{n}: EBITDA (and operating profit)', (lambda s: lambda q: f'SUM({q.ROW(f"{s}.op")})')(s))
        c.scalar(f'{s}.cash', f'{n}: Ending cash', (lambda s: lambda q: q.AT(f'{s}.cash', 24))(s))
        c.scalar(f'{s}.min', f'{n}: Lowest cash balance', (lambda s: lambda q: f'MIN({q.ROW(f"{s}.cash")})')(s))
        c.scalar(f'{s}.be', f'{n}: Break-even month (0 = not reached)', (lambda s: lambda q: f'IFERROR(MATCH(1,{q.ROW(f"{s}.allPos")},0),0)')(s), 'count')
        c.scalar(f'{s}.fund', f'{n}: Additional funding required', (lambda s: lambda q: f'MAX(0,{q.I("minCashCushion")}-MIN({q.ROW(f"{s}.cash")}))')(s))
    W = 'Scenarios › Compare'
    for s in ['b', 'd', 'u']:
        n = names[s]
        sid = {'b': 'base', 'd': 'downside', 'u': 'upside'}[s]
        c.check(W, f'{n} › Total revenue', f'{s}.totRev', None, src=('compare', sid, 'totalRevenue'))
        c.check(W, f'{n} › Gross margin (%)', f'{s}.gm', None, 'pct', src=('compare', sid, 'grossMargin'))
        c.check(W, f'{n} › EBITDA (simplified)', f'{s}.ebitda', None, src=('compare', sid, 'totalEbitda'))
        c.check(W, f'{n} › Ending cash', f'{s}.cash', None, src=('compare', sid, 'endingCash'))
        c.check(W, f'{n} › Lowest cash balance', f'{s}.min', None, src=('compare', sid, 'minCash'))
        c.check(W, f'{n} › Break-even month (0 = "Not reached")', f'{s}.be', None, 'count', src=('compare', sid, 'operatingBreakEvenMonth'))
        c.check(W, f'{n} › Additional funding required', f'{s}.fund', None, src=('compare', sid, 'fundingRequired'))
    c.check(CF, 'Ending cash (Base case selected): same as the Base column', 'b.cash', 24, src=T('Ending cash'))
    return c


# ===========================================================================
# 12. Starting defaults

def defaults():
    c = new_case('12 Starting defaults', '12. Starting defaults: a new project with the example team, expenses and tax left in',
                 'Many students will leave the example roles, expenses, cash amounts and tax settings in place. This sheet keeps them exactly as a new project creates them '
                 'and changes only the revenue inputs, so it checks those starting values: the founder from month 1, the first employee from month 7 with a raise in month 19, '
                 'ten monthly expenses plus a one-time formation cost, and the tax estimate (on, C corporation, 25%, quarterly) on a small early profit.',
                 ['Start a new project with the E-commerce model. (Shortcut: open docs/validation/projects/12-starting-defaults.vfm.json.)',
                  'Venture Setup: keep the example cash amounts and 24 months. Do NOT change Team, Expenses or Funding and taxes: the blue values listed for them are what '
                  'the app already shows, so just confirm they match.',
                  'Assumptions › Revenue: set the store inputs below.',
                  'Read the checkpoints in Financial Projections, Base case.'])
    setup(c, 10000, 25000, 10000)
    S = stream(c, 0, 'ecommerce', 'E-commerce', {}, [
        ('salesStartMonth', 1), ('aov', 100), ('ordersStart', 200), ('orderGrowthPct', 0), ('returnsPct', 0),
        ('productCostPerOrder', 40), ('fulfillmentPerOrder', 0), ('shippingSubsidyPerOrder', 0), ('processingPct', 0), ('processingFixed', 0),
        ('newCustomerSharePct', 0), ('cac', 0), ('marketingFixed', 0), ('collectionDays', 0), ('supplierDays', 0)])
    role(c, 'r1', 'Founder', 1, 5000, 20, 1, 0, 0, 'admin')
    role(c, 'r2', 'First employee', 1, 7000, 22, 7, 0, 3, 'product')
    ex = [('e1', 'Rent and facilities', 'ga', 1500), ('e2', 'Software and technology', 'ga', 600), ('e3', 'Insurance', 'ga', 300),
          ('e4', 'Legal and professional services', 'ga', 800), ('e5', 'Accounting and bookkeeping', 'ga', 400), ('e6', 'Marketing and advertising', 'sm', 1000),
          ('e7', 'Travel and entertainment', 'other', 400), ('e8', 'Office and administrative expenses', 'ga', 250), ('e9', 'Research and development', 'rd', 0),
          ('e10', 'Other expenses', 'other', 200)]
    for eid, name, cat, amt in ex:
        expense(c, eid, name, cat, 'recurring', amt, 1)
    expense(c, 'e11', 'Company formation and legal setup', 'ga', 'one-time', 3000, 1)
    sec = 'Assumptions › Funding and taxes (leave as the app sets them)'
    c.inp('tax.on', sec, 'Include a rough income tax estimate', 'On', 'text')
    c.inp('tax.entity', sec, 'Legal structure', 'C corporation', 'text')
    c.inp('tax.when', sec, 'When tax is paid', 'Quarterly estimates', 'text')
    c.inp('tax.rate', sec, 'Combined income tax rate', 25, 'pct')
    c.project['tax'] = {'enabled': True, 'entity': 'c_corp', 'rate': 25, 'payment': 'quarterly', 'includeOwnerDistributions': True}
    I = lambda x, k: x.I(S(k))
    row = c.row

    def role_cost(rid):
        def f(x):
            return (f'IF({x.M}>={x.I(rid + ".start")},{x.I(rid + ".count")}*{x.I(rid + ".comp")}'
                    f'*(1+{x.I(rid + ".raise")}/100)^INT(({x.M}-{x.I(rid + ".start")})/12)*(1+{x.I(rid + ".burden")}/100),0)')
        return f

    def cat_sum(cat):
        ids = [e[0] for e in ex if e[2] == cat]

        def f(x):
            base = '+'.join([x.I(i + '.amount') for i in ids] or ['0'])
            if cat == 'ga':
                base += f'+IF({x.M}={x.I("e11.start")},{x.I("e11.amount")},0)'
            return base
        return f

    row('revenue', 'Total revenue', lambda x: f'{I(x,"ordersStart")}*{I(x,"aov")}', 'usd', True)
    row('direct', 'Total direct costs', lambda x: f'{I(x,"ordersStart")}*{I(x,"productCostPerOrder")}', 'usd', True)
    row('r1', 'Founder', role_cost('r1'), 'usd', True)
    row('r2', 'First employee', role_cost('r2'), 'usd', True)
    row('personnel', 'Personnel', lambda x: f'{x.R("r1")}+{x.R("r2")}', 'usd', True)
    row('sm', 'Sales and marketing', cat_sum('sm'), 'usd', True)
    row('rd', 'Research and development', cat_sum('rd'), 'usd', True)
    row('ga', 'General and administrative', cat_sum('ga'), 'usd', True)
    row('other', 'Other operating expenses', cat_sum('other'), 'usd', True)
    row('opex', 'Total operating expenses', lambda x: f'{x.R("personnel")}+{x.R("sm")}+{x.R("rd")}+{x.R("ga")}+{x.R("other")}', 'usd', True)
    row('op', 'Operating profit = EBITDA = pretax profit', lambda x: f'{x.R("revenue")}-{x.R("direct")}-{x.R("opex")}', 'usd', True)
    row('bank', 'Losses carried forward (end of month)', lambda x: f'MAX(0,{x.R("bank", -1)}-{x.R("op")})')
    row('tax', 'Income tax (estimate)', lambda x: f'MAX(0,{x.R("op")}-{x.R("bank", -1)})*{x.I("tax.rate")}/100', 'usd', True)
    row('ni', 'Net income', lambda x: f'{x.R("op")}-{x.R("tax")}', 'usd', True)
    row('taxPaid', 'Income taxes paid (month after each quarter)',
        lambda x: f'IF(AND({x.M}>1,MOD({x.M}-1,3)=0),SUM(INDEX({x.ROW("tax")},{x.M}-3):INDEX({x.ROW("tax")},{x.M}-1)),0)', 'usd', True)
    row('net', 'Net change in cash', lambda x: f'{x.R("op")}-{x.R("taxPaid")}+IF({x.M}=1,{x.I("founderInvestment")},0)', 'usd', True)
    row('cash', 'Ending cash', lambda x: f'{x.I("startingCash")}+{x.CUM("net")}')
    row('neg', 'Cash below zero? (1 = yes)', lambda x: f'IF({x.R("cash")}<0,1,0)', 'count')
    c.scalar('fundReq', 'Additional funding required', lambda s: f'MAX(0,{s.I("minCashCushion")}-MIN({s.ROW("cash")}))')
    c.scalar('firstNeg', 'Month cash first goes below zero (0 = never)', lambda s: f'IFERROR(MATCH(1,{s.ROW("neg")},0),0)', 'count')
    ch = c.check
    D = 'Financial Projections › Dashboard'
    ch(IS, 'Personnel', 'personnel', 1, conv='C22', src=T('Personnel'))
    ch(IS, 'Personnel', 'personnel', 7, conv='C22', src=T('Personnel'), note='First employee starts')
    ch(IS, 'Personnel', 'personnel', 19, conv='C22', src=T('Personnel'), note='First employee’s 3% raise')
    ch(IS, 'Sales and marketing', 'sm', 1, conv='C22', src=T('Sales and marketing'))
    ch(IS, 'General and administrative', 'ga', 1, conv='C22', src=T('General and administrative'), note='Includes the one-time formation cost')
    ch(IS, 'General and administrative', 'ga', 2, conv='C22', src=T('General and administrative'))
    ch(IS, 'Other operating expenses', 'other', 1, conv='C22', src=T('Other operating expenses'))
    ch(IS, 'Total operating expenses', 'opex', 'Total', conv='C22', src=T('Total operating expenses'))
    ch(IS, 'Operating profit (loss)', 'op', 1, conv='C22', src=T('Operating profit (loss)'))
    ch(IS, 'Operating profit (loss)', 'op', 2, conv='C22', src=T('Operating profit (loss)'))
    ch(IS, 'Income tax (estimate)', 'tax', 5, conv='C22', src=T('Income tax (estimate)'), note='Month-1 loss used up')
    ch(IS, 'Income tax (estimate)', 'tax', 6, conv='C22', src=T('Income tax (estimate)'))
    ch(IS, 'Income tax (estimate)', 'tax', 'Total', conv='C22', src=T('Income tax (estimate)'))
    ch(CF, 'Income taxes paid', 'taxPaid', 7, conv='C22', sign=-1, src=T('Income taxes paid'), note='Months 4 to 6')
    ch(IS, 'Net income', 'ni', 'Total', conv='C22', src=T('Net income'))
    ch(CF, 'Ending cash', 'cash', 1, conv='C22', src=T('Ending cash'))
    ch(CF, 'Ending cash', 'cash', 12, conv='C22', src=T('Ending cash'))
    ch(CF, 'Ending cash', 'cash', 24, conv='C22', src=T('Ending cash'))
    ch(D, 'Additional funding required', 'fundReq', None, conv='C22', src=('summary', 'fundingRequired'))
    ch(D, 'Runway: month cash runs out (0 = does not)', 'firstNeg', None, 'count', conv='C22', src=('summary', 'firstNegativeCashMonth'))
    return c


# ===========================================================================
# 13. Exit

def exit_case():
    c = new_case('13 Exit (bonus)', '13. Exit Strategy: cap table, preferences, taxes',
                 'Steady revenue of $100,000 a month, a SAFE and a priced round in the projection, 50/50 founders and a 10% pool. One strategic sale large enough that every '
                 'investor converts to common, and one acqui-hire small enough that every investor takes its 1× preference instead. Taxes with QSBS at 5 years and at 3 years.',
                 ['Start a new project with the E-commerce model. (Shortcut: open docs/validation/projects/13-exit.vfm.json.)',
                  'Venture Setup: start month, 24 months, cash below. Team and Expenses: remove all examples. Tax: leave on, C corporation (QSBS needs a C corp).',
                  'Revenue: set the store inputs below. Funding: add the SAFE and the priced round with their share of company sold.',
                  'Exit Strategy › Cap table: founders 50/50, option pool 10%, 1× preference, not participating. Check the SAFE / priced setting of each funding row.',
                  'Exit Strategy › Exit options: set the company and fee inputs, the strategic sale and the acqui-hire values below. Set "Whose take-home?" to all founders.',
                  'Read block A. Then change Exit year to 3 and read block B.'])
    setup(c, 100000, 0)
    S = stream(c, 0, 'ecommerce', 'E-commerce', {}, [
        ('salesStartMonth', 1), ('aov', 100), ('ordersStart', 1000), ('orderGrowthPct', 0), ('returnsPct', 0),
        ('productCostPerOrder', 0), ('fulfillmentPerOrder', 0), ('shippingSubsidyPerOrder', 0), ('processingPct', 0), ('processingFixed', 0),
        ('newCustomerSharePct', 0), ('cac', 0), ('marketingFixed', 0), ('collectionDays', 0), ('supplierDays', 0)])
    funding(c, 'f1', 'Seed SAFE', 'equity', 500000, 3, equity_pct=10, instrument='safe')
    funding(c, 'f2', 'Series A', 'equity', 2000000, 12, equity_pct=20, instrument='priced')
    sec = 'Exit Strategy › Cap table'
    c.inp('x.f1', sec, 'Founder 1: share of founder stock', 50, 'pct')
    c.inp('x.f2', sec, 'Founder 2: share of founder stock', 50, 'pct')
    c.inp('x.pool', sec, 'Employee option pool', 10, 'pct')
    c.inp('x.pref', sec, 'Liquidation preference (×)', 1, 'ratio')
    c.inp('x.part', sec, 'Participating preferred', 'Off', 'text')
    sec = 'Exit Strategy › The company at exit, fees and taxes'
    c.inp('x.year', sec, 'Exit year (from start)', 5, 'count', 'Block B: change to 3')
    c.inp('x.growth', sec, 'Revenue growth per year after the projection', 0, 'pct')
    c.inp('x.margin', sec, 'EBITDA margin at exit', 15, 'pct', 'Not used by these checks')
    c.inp('x.netCash', sec, 'Cash minus debt at exit', 0)
    c.inp('x.fees', sec, 'Banker and legal fees', 3, 'pct')
    c.inp('x.fed', sec, 'Federal capital gains', 23.8, 'pct')
    c.inp('x.ca', sec, 'California capital gains', 13.3, 'pct')
    c.inp('x.ord', sec, 'Income tax (retention, payouts)', 50.3, 'pct')
    c.inp('x.qsbs', sec, 'Qualified small business stock (QSBS)', 'On', 'text')
    sec = 'Exit Strategy › Strategic acquisition'
    c.inp('x.mult', sec, 'Revenue multiple', 10, 'ratio')
    c.inp('x.cashPct', sec, 'Paid in cash (rest in buyer stock)', 100, 'pct')
    c.inp('x.escrow', sec, 'Held in escrow', 0, 'pct')
    c.inp('x.earnout', sec, 'Earn-out share of the price', 0, 'pct')
    sec = 'Exit Strategy › Acqui-hire'
    c.inp('x.ahPrice', sec, 'Purchase price', 3000000)
    c.inp('x.ret', sec, 'Retention package per founder', 100000)
    c.project['exit'] = {'founders': [{'id': 'f1', 'name': 'Founder 1', 'pct': 50}, {'id': 'f2', 'name': 'Founder 2', 'pct': 50}],
                         'poolPct': 10, 'prefMultiple': 1, 'participating': False, 'exitYear': 5, 'growthPct': 0, 'exitMarginPct': 15,
                         'netCashAtExit': 0, 'feesPct': 3, 'capGainsFedPct': 23.8, 'capGainsStatePct': 13.3, 'ordinaryRatePct': 50.3, 'qsbs': True,
                         'strategic': {'multiple': 10, 'cashPct': 100, 'escrowPct': 0, 'earnoutPct': 0, 'earnoutProbPct': 0},
                         'acquihire': {'price': 3000000, 'retentionPerFounder': 100000}, 'focus': 'all'}
    c.project['tax'] = {'enabled': True, 'entity': 'c_corp', 'rate': 25, 'payment': 'quarterly', 'includeOwnerDistributions': True}
    I = lambda x, k: x.I(S(k))
    c.row('revenue', 'Total revenue', lambda x: f'{I(x,"ordersStart")}*{I(x,"aov")}', 'usd', True)
    sc = c.scalar
    sc('poolF', 'Option pool after founding (%)', lambda s: s.I('x.pool'), 'pct')
    sc('fF', 'Founders after founding (%)', lambda s: f'100-{s.S("poolF")}', 'pct')
    sc('safeP', 'SAFE holders after the SAFE (%) = share sold', lambda s: s.I('f1.pct'), 'pct')
    sc('fS', 'Founders after the SAFE (%)', lambda s: f'{s.S("fF")}*(1-{s.S("safeP")}/100)', 'pct')
    sc('pricedP', 'Series A after the priced round (%)', lambda s: s.I('f2.pct'), 'pct')
    sc('fP', 'Founders after the priced round (%)', lambda s: f'{s.S("fS")}*(1-{s.S("pricedP")}/100)', 'pct')
    sc('poolP', 'Option pool after the priced round (%)', lambda s: f'{s.S("poolF")}*(1-{s.S("safeP")}/100)*(1-{s.S("pricedP")}/100)', 'pct')
    sc('safeFinal', 'SAFE holders after the priced round (%)', lambda s: f'{s.S("safeP")}*(1-{s.S("pricedP")}/100)', 'pct')
    sc('invP', 'All investors after the priced round (%)', lambda s: f'{s.S("safeFinal")}+{s.S("pricedP")}', 'pct')
    sc('runRate', 'Revenue run rate at the end of the projection', lambda s: f'{s.AT("revenue", 24)}*12')
    sc('exitRev', 'Exit-year revenue', lambda s: f'{s.S("runRate")}*(1+{s.I("x.growth")}/100)^({s.I("x.year")}-2)')
    sc('price', 'Strategic headline price', lambda s: f'{s.S("exitRev")}*{s.I("x.mult")}')
    sc('equity', 'Proceeds to shareholders after fees', lambda s: f'{s.S("price")}*(1-{s.I("x.fees")}/100)+{s.I("x.netCash")}')
    sc('prefs', 'Total 1× preferences', lambda s: f'({s.I("f1.amount")}+{s.I("f2.amount")})*{s.I("x.pref")}')
    sc('convertCheck', 'Strategic: every investor better off converting? (1 = yes)',
       lambda s: f'IF(AND({s.S("safeFinal")}/100*{s.S("equity")}>={s.I("f1.amount")}*{s.I("x.pref")},{s.S("pricedP")}/100*{s.S("equity")}>={s.I("f2.amount")}*{s.I("x.pref")}),1,0)', 'count')
    sc('fGross', 'Strategic: founders’ proceeds (all convert, pro rata)', lambda s: f'{s.S("equity")}*{s.S("fP")}/100')
    sc('qsbsFrac', 'QSBS federal exclusion for the exit year', lambda s: f'IF({s.I("x.year")}>=5,1,IF({s.I("x.year")}>=4,0.75,IF({s.I("x.year")}>=3,0.5,0)))', 'count')
    sc('perFounderGain', 'Gain per founder (basis taken as 0)', lambda s: f'{s.S("fGross")}/2')
    sc('fedTax', 'Federal tax, both founders', lambda s: f'2*MAX(0,{s.S("perFounderGain")}-MIN({s.S("perFounderGain")},15000000)*{s.S("qsbsFrac")})*{s.I("x.fed")}/100')
    sc('caTax', 'California tax, both founders', lambda s: f'{s.S("fGross")}*{s.I("x.ca")}/100')
    sc('sTax', 'Strategic: taxes', lambda s: f'{s.S("fedTax")}+{s.S("caTax")}')
    sc('sNet', 'Strategic: expected take-home', lambda s: f'{s.S("fGross")}-{s.S("sTax")}')
    sc('ahEquity', 'Acqui-hire: proceeds after fees', lambda s: f'{s.I("x.ahPrice")}*(1-{s.I("x.fees")}/100)+{s.I("x.netCash")}')
    sc('ahPrefCheck', 'Acqui-hire: every investor better off taking its preference? (1 = yes)',
       lambda s: f'IF(AND({s.S("safeFinal")}/100*{s.S("ahEquity")}<{s.I("f1.amount")},{s.S("pricedP")}/100*{s.S("ahEquity")}<{s.I("f2.amount")}),1,0)', 'count')
    sc('ahCommon', 'Acqui-hire: left for common after preferences', lambda s: f'MAX(0,{s.S("ahEquity")}-{s.S("prefs")})')
    sc('ahF', 'Acqui-hire: founders’ share of common', lambda s: f'{s.S("ahCommon")}*{s.S("fP")}/({s.S("fP")}+{s.S("poolP")})')
    sc('ahTax', 'Acqui-hire: tax on founders’ stock proceeds',
       lambda s: f'2*MAX(0,{s.S("ahF")}/2-MIN({s.S("ahF")}/2,15000000)*{s.S("qsbsFrac")})*{s.I("x.fed")}/100+{s.S("ahF")}*{s.I("x.ca")}/100')
    sc('ahRet', 'Acqui-hire: retention pay, both founders', lambda s: f'2*{s.I("x.ret")}')
    sc('ahRetTax', 'Acqui-hire: income tax on retention', lambda s: f'{s.S("ahRet")}*{s.I("x.ord")}/100')
    sc('ahNet', 'Acqui-hire: expected take-home', lambda s: f'{s.S("ahF")}-{s.S("ahTax")}+{s.S("ahRet")}-{s.S("ahRetTax")}')
    CT = 'Exit Strategy › Cap table › Ownership after each round'
    EX = 'Exit Strategy › Strategic acquisition'
    AH = 'Exit Strategy › Acqui-hire'
    ch = c.check
    ch(CT, 'Founding: founders', 'fF', None, 'pct', src=('cap', 0, 'founderPct'))
    ch(CT, 'Founding: option pool', 'poolF', None, 'pct', src=('cap', 0, 'poolPct'))
    ch(CT, 'Series A row: founders', 'fP', None, 'pct', conv='C16', src=('cap', 1, 'founderPct'), note='The SAFE converts in this step')
    ch(CT, 'Series A row: investors', 'invP', None, 'pct', conv='C16', src=('cap', 1, 'investorPct'), note='SAFE and Series A together')
    ch(CT, 'Series A row: option pool', 'poolP', None, 'pct', conv='C16', src=('cap', 1, 'poolPct'))
    ch(EX, 'Headline price', 'price', None, conv='C19', src=('exit', 'strategic', 'enterpriseValue'))
    ch(EX, 'Founder share at the headline price (gross)', 'fGross', None, conv='C16, C17', src=('exit', 'strategic', 'gross'))
    ch(EX, 'Taxes (shown as a negative)', 'sTax', None, conv='C16', sign=-1, src=('exit', 'strategic', 'negtax'))
    ch(EX, 'Expected take-home', 'sNet', None, conv='C16', src=('exit', 'strategic', 'net'))
    ch(AH, 'Founder share at the headline price (gross)', 'ahF', None, conv='C16, C17, C18', src=('exit', 'acquihire', 'gross'))
    ch(AH, 'Retention pay', 'ahRet', None, src=('exit', 'acquihire', 'retention'))
    ch(AH, 'Expected take-home', 'ahNet', None, conv='C16, C18', src=('exit', 'acquihire', 'net'))
    # Block B: exit year 3. Separate scalars computed with a fixed 50% exclusion.
    sc('fedTax3', 'Exit year 3: federal tax, both founders (50% QSBS)', lambda s: f'2*MAX(0,{s.S("perFounderGain")}-MIN({s.S("perFounderGain")},15000000)*0.5)*{s.I("x.fed")}/100')
    sc('sNet3', 'Exit year 3: strategic take-home', lambda s: f'{s.S("fGross")}-{s.S("fedTax3")}-{s.S("caTax")}')
    sc('sTax3', 'Exit year 3: strategic taxes', lambda s: f'{s.S("fedTax3")}+{s.S("caTax")}')
    c.blocks = [('Block B: Exit year changed to 3 (everything else the same)', [
        _ck(EX, 'Taxes (shown as a negative)', 'sTax3', None, conv='C16', sign=-1, src=('exit3', 'strategic', 'negtax')),
        _ck(EX, 'Expected take-home', 'sNet3', None, conv='C16', src=('exit3', 'strategic', 'net')),
    ])]
    return c


ALL = [software, enterprise, manufacturing, services, ecommerce, marketplace, licensing, mixed, shared, taxes, scenarios, defaults, exit_case]
