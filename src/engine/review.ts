// Model review: prompts that ask the student to look again at parts of their
// model. These are questions, not verdicts. The tool never decides whether a
// business is good or bad.

import { computeProject } from './engine';
import { listAssumptions } from './paths';
import { clone } from './paths';
import type { SensRow } from './sensitivity';
import type { ModelKind, Project, ProjectResult, ScenarioId } from './types';

export interface ReviewPrompt {
  id: string;
  title: string;
  detail: string;
  question: string;
  area: 'cash' | 'revenue' | 'costs' | 'assumptions' | 'scenarios' | 'capacity';
  link: 'setup' | 'model' | 'assumptions' | 'projections' | 'scenarios' | 'review';
}

const money = (x: number) => (x < 0 ? '−' : '') + '$' + Math.round(Math.abs(x)).toLocaleString('en-US');
const pctf = (x: number) => `${Math.round(x * 100)}%`;

const MARGIN_RANGE: Record<ModelKind, [number, number, string]> = {
  software: [0.6, 0.95, 'Software businesses commonly report gross margins of roughly 70% to 85%.'],
  enterprise: [0.5, 0.95, 'Enterprise software commonly reports gross margins of roughly 65% to 85% once implementation costs settle.'],
  manufacturing: [0.2, 0.7, 'Manufacturers commonly see gross margins of roughly 25% to 50%, depending on the product.'],
  services: [0.2, 0.7, 'Service firms commonly see gross margins of roughly 30% to 50% after delivery staff costs.'],
  ecommerce: [0.2, 0.75, 'Direct-to-consumer brands commonly see gross margins of roughly 35% to 65%.'],
  marketplace: [0.4, 0.95, 'Marketplaces measured on their fee revenue commonly see gross margins of roughly 60% to 80%.'],
  licensing: [0.5, 0.98, 'Licensing businesses often have very high gross margins because the licensee carries production cost.'],
};

export function reviewModel(
  p: Project,
  results: Record<ScenarioId, ProjectResult>,
  sens?: SensRow[],
): ReviewPrompt[] {
  const out: ReviewPrompt[] = [];
  const base = results.base;
  const s = base.summary;
  const rows = base.rows;
  const n = rows.length;

  // ---- Cash
  if (s.firstNegativeCashMonth != null && !s.hiddenShortfall) {
    out.push({
      id: 'cash.out', area: 'cash', link: 'projections',
      title: `Cash runs out in month ${s.firstNegativeCashMonth} (${rows[s.firstNegativeCashMonth - 1].label})`,
      detail: `In the base case the lowest balance is ${money(s.minCash)} in month ${s.minCashMonth}. To stay above your ${money(p.setup.minCashCushion.v)} cushion you would need about ${money(s.fundingRequired)} more.`,
      question: 'Where would that money come from, and when would you need to start raising it?',
    });
  }
  if (s.hiddenShortfall) {
    out.push({
      id: 'cash.hidden', area: 'cash', link: 'projections',
      title: 'Cash ends positive, but goes negative along the way',
      detail: `Ending cash is ${money(s.endingCash)}, but cash drops to ${money(s.minCash)} in month ${s.minCashMonth}. The business cannot spend money it does not have yet.`,
      question: 'What would you do in the months before the cash recovers?',
    });
  }
  // Payment delays
  const instant = clone(p);
  for (const st of instant.streams) {
    if (st.inputs.collectionDays) st.inputs.collectionDays.v = 0;
    if (st.inputs.royaltyDays) st.inputs.royaltyDays.v = 0;
  }
  const instantMin = computeProject(instant).summary.minCash;
  const delayCost = instantMin - s.minCash;
  if (delayCost > Math.max(5000, Math.abs(s.minCash) * 0.1)) {
    out.push({
      id: 'cash.delays', area: 'cash', link: 'assumptions',
      title: 'Customer payment delays tie up a lot of cash',
      detail: `If customers paid immediately, your lowest cash balance would be ${money(delayCost)} higher. That money is earned but sitting in unpaid invoices.`,
      question: 'How confident are you in your payment terms? Could you ask for deposits or bill in advance?',
    });
  }

  // ---- Revenue
  if (s.totalRevenue <= 0) {
    out.push({
      id: 'rev.none', area: 'revenue', link: 'assumptions',
      title: 'The model earns no revenue',
      detail: 'No revenue appears anywhere in the projection.',
      question: 'Is that intended (for example, a long development period), or is a revenue driver missing?',
    });
  } else {
    const firstIdx = rows.findIndex((r) => r.revenue > 0);
    const startRev = rows.slice(firstIdx, firstIdx + 3).reduce((a, r) => a + r.revenue, 0) / Math.min(3, n - firstIdx);
    const endRev = rows.slice(-3).reduce((a, r) => a + r.revenue, 0) / 3;
    const span = n - 1 - firstIdx;
    if (startRev > 0 && span >= 6) {
      const multiple = endRev / startRev;
      const monthly = Math.pow(multiple, 1 / span) - 1;
      if (monthly > 0.12) {
        out.push({
          id: 'rev.aggressive', area: 'revenue', link: 'assumptions',
          title: 'Revenue growth is steep relative to where it starts',
          detail: `Revenue grows about ${multiple.toFixed(0)}× from its first months to its last (about ${pctf(monthly)} per month, compounded).`,
          question: 'What would have to happen in sales and operations to sustain that pace? Who are the customers in the last months?',
        });
      }
    }
  }
  const conc = base.largestCustomerShare[n - 1];
  if (conc > 0.25) {
    out.push({
      id: 'rev.concentration', area: 'revenue', link: 'assumptions',
      title: `One customer is about ${pctf(conc)} of revenue at the end`,
      detail: 'A large share of revenue depends on a single customer.',
      question: 'What happens to cash if that customer pays late, shrinks the contract or leaves?',
    });
  }

  for (const st of p.streams) {
    const v = (k: string) => st.inputs[k]?.v;
    if (st.kind === 'software' && st.options.subscription && v('subChurnPct') === 0) {
      out.push({ id: `${st.id}.noChurn`, area: 'assumptions', link: 'assumptions', title: `${st.name}: no subscriber churn`, detail: 'The model assumes no subscriber ever cancels.', question: 'What churn do comparable products report? What would make a customer leave yours?' });
    }
    if ((st.kind === 'enterprise' || st.kind === 'licensing') && v('renewalPct') === 100) {
      out.push({ id: `${st.id}.noChurn`, area: 'assumptions', link: 'assumptions', title: `${st.name}: every customer renews`, detail: 'A 100% renewal rate means no customer is ever lost.', question: 'What could cause a customer not to renew (budget cuts, leadership change, a competitor)?' });
    }
    if (st.kind === 'enterprise') {
      const r = base.streams.find((x) => x.stream.id === st.id)?.result;
      const cycle = r?.metrics.find((m) => m.key === 'salesCycle')?.values[0] ?? 0;
      if (s.firstNegativeCashMonth != null && cycle >= s.firstNegativeCashMonth) {
        out.push({ id: `${st.id}.cycleVsRunway`, area: 'cash', link: 'assumptions', title: `${st.name}: the sales cycle is longer than your runway`, detail: `A prospect who enters the pipeline in month 1 starts paying after about ${cycle} months, but cash runs out in month ${s.firstNegativeCashMonth}.`, question: 'Which existing opportunities could close sooner, and what evidence supports the timing?' });
      }
    }
    if (st.kind === 'software' && st.options.subscription) {
      const r = base.streams.find((x) => x.stream.id === st.id)?.result;
      const ltv = r?.metrics.find((m) => m.key === 'ltv')?.values[n - 1];
      const cac = r?.metrics.find((m) => m.key === 'blendedCac')?.values[n - 1];
      if (ltv != null && cac != null && Number.isFinite(ltv) && Number.isFinite(cac) && cac > 0 && ltv / cac < 3) {
        out.push({ id: `${st.id}.ltvcac`, area: 'revenue', link: 'projections', title: `${st.name}: lifetime value is ${(ltv / cac).toFixed(1)}× acquisition cost`, detail: 'Many investors look for lifetime value of at least three times acquisition cost, as a rough rule of thumb.', question: 'Is acquisition cost likely to fall as you grow, or could you raise price or reduce churn?' });
      }
    }
  }

  // ---- Costs and margins
  const primary = p.streams[0];
  if (primary && s.totalRevenue > 0) {
    const last6 = rows.slice(-6);
    const rev6 = last6.reduce((a, r) => a + r.revenue, 0);
    const gp6 = last6.reduce((a, r) => a + r.grossProfit, 0);
    const gm = rev6 > 0 ? gp6 / rev6 : null;
    const [lo, hi, note] = MARGIN_RANGE[primary.kind];
    if (gm != null && p.streams.length === 1 && (gm < lo || gm > hi)) {
      out.push({
        id: 'cost.margin', area: 'costs', link: 'assumptions',
        title: `Gross margin is ${gm < lo ? 'low' : 'high'} for this kind of business (${pctf(gm)} in the last six months)`,
        detail: note,
        question: gm < lo ? 'Which direct costs could fall with scale, or is pricing too low?' : 'Are all the costs of delivering the product or service included?',
      });
    }
  }
  for (const r of p.roles) {
    if (r.startMonth <= 1 || r.startMonth > n) continue;
    const row = rows[r.startMonth - 1];
    if (row.grossProfit < row.personnel) {
      out.push({
        id: `cost.hire.${r.id}`, area: 'costs', link: 'assumptions',
        title: `Hiring the ${r.title.toLowerCase()} in month ${r.startMonth} comes before gross profit covers the team`,
        detail: `In month ${r.startMonth}, team cost is ${money(row.personnel)} and gross profit is ${money(row.grossProfit)}.`,
        question: 'What does this hire make possible, and could it wait until revenue supports it?',
      });
      break;
    }
  }
  if (p.roles.some((r) => r.monthlyComp === 0)) {
    out.push({ id: 'cost.unpaid', area: 'costs', link: 'assumptions', title: 'Some team members are unpaid', detail: 'At least one role has zero pay.', question: 'How long can they work unpaid? What would it cost to replace them with paid staff?' });
  }

  // ---- Capacity
  for (const iss of base.issues) {
    if (/capacity|supply/.test(iss.id)) {
      out.push({ id: `cap.${iss.id}`, area: 'capacity', link: 'assumptions', title: 'Demand exceeds what you can deliver', detail: iss.message, question: 'When would you add capacity, and what would it cost?' });
    }
  }

  // ---- Scenarios
  const up = results.upside.summary;
  const down = results.downside.summary;
  if (s.operatingBreakEvenMonth == null && up.operatingBreakEvenMonth != null) {
    out.push({ id: 'scn.upsideOnly', area: 'scenarios', link: 'scenarios', title: 'The business reaches break-even only in the upside case', detail: `Upside reaches sustained break-even in month ${up.operatingBreakEvenMonth}; the base case does not within the projection.`, question: 'Which upside assumptions matter most, and what evidence would make them your base case?' });
  }
  if (down.firstNegativeCashMonth != null && s.firstNegativeCashMonth == null) {
    out.push({ id: 'scn.downsideCash', area: 'scenarios', link: 'scenarios', title: `The downside case runs out of cash in month ${down.firstNegativeCashMonth}`, detail: `Base case cash stays positive, but the downside needs about ${money(down.fundingRequired)} more.`, question: 'What early warning signs would tell you the downside is happening, and what would you cut first?' });
  }
  const scenarioUntouched = ['downside', 'upside'].every((id) => !p.scenarios[id as 'downside'].notes.trim());
  if (scenarioUntouched) {
    out.push({ id: 'scn.notes', area: 'scenarios', link: 'scenarios', title: 'Scenarios have no explanation yet', detail: 'The downside and upside cases do not say what situation they represent.', question: 'What specific events would produce your downside and your upside?' });
  }

  // ---- Assumptions
  const all = listAssumptions(p);
  const examples = all.filter((x) => x.example);
  if (examples.length) {
    out.push({ id: 'asm.examples', area: 'assumptions', link: 'assumptions', title: `${examples.length} values are still illustrative examples`, detail: 'These came with the template and have not been changed or confirmed.', question: 'Replace each with your own estimate and explain its basis, or confirm it if it genuinely fits.' });
  }
  const noBasis = all.filter((x) => !x.basis.trim());
  if (noBasis.length) {
    out.push({ id: 'asm.basis', area: 'assumptions', link: 'assumptions', title: `${noBasis.length} assumptions have no stated basis`, detail: 'There is no explanation of where these values came from.', question: 'For each one: is it based on evidence, a benchmark, or your best guess?' });
  }
  if (sens && sens.length) {
    const ranked = [...sens]
      .filter((r) => r.assumption)
      .map((r) => ({ r, swing: Math.abs(r.highResult.minCash - r.lowResult.minCash) }))
      .sort((a, b) => b.swing - a.swing)
      .slice(0, 5)
      .filter(({ r }) => r.assumption && (r.assumption.conf === 'speculative' || r.assumption.conf === 'unset'));
    if (ranked.length) {
      out.push({
        id: 'asm.sensitiveWeak', area: 'assumptions', link: 'assumptions',
        title: 'Some of your most influential assumptions have weak support',
        detail: `Among the five assumptions that move your lowest cash balance the most, these are speculative or unrated: ${ranked.map(({ r }) => r.label).join('; ')}.`,
        question: 'What could you do this week to gather evidence for one of them?',
      });
    }
  }
  if (!p.tax.enabled && s.totalOperatingProfit > 0) {
    out.push({ id: 'tax.off', area: 'costs', link: 'assumptions', title: 'Taxes are turned off, but the model is profitable', detail: 'Profitable businesses owe income tax, either at the company level or through the owners.', question: 'Which tax treatment applies to your legal structure?' });
  }
  return out;
}
