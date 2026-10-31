// Suggested grading rubric. Also published in docs/RUBRIC.md; keep the two in step.

export interface RubricCriterion {
  criterion: string;
  points: number;
  strong: string;
  developing: string;
  where: string;
}

export const RUBRIC: RubricCriterion[] = [
  {
    criterion: 'Business model logic',
    points: 15,
    strong: 'The chosen model and drivers match how the venture actually earns money. Revenue traces to concrete operational activity (customers, units, hours, deals).',
    developing: 'Model choice is unclear or drivers are generic; revenue depends on a growth rate with no operational story.',
    where: 'Summary header; Assumptions (revenue drivers)',
  },
  {
    criterion: 'Assumption quality and justification',
    points: 25,
    strong: 'Example values replaced or explicitly confirmed. Every major assumption has a specific basis; key drivers are evidence- or benchmark-based, and speculative ones are acknowledged.',
    developing: 'Many example values remain, bases are missing or vague (“estimate”), confidence is unrated.',
    where: 'Assumption support counts; Assumptions and their basis',
  },
  {
    criterion: 'Costs and team plan',
    points: 15,
    strong: 'Costs are complete and not double counted. Hiring is timed to need, founders’ pay is addressed, direct and operating costs are separated sensibly.',
    developing: 'Missing cost categories, unpaid founders not discussed, hires far ahead of revenue without explanation.',
    where: 'Assumptions (team, operating expenses)',
  },
  {
    criterion: 'Cash flow and funding',
    points: 15,
    strong: 'Payment timing is realistic for the customer type. The student identifies the cash low point and how much funding is needed and when.',
    developing: 'Assumes customers pay immediately without reason; treats positive ending cash as viability despite an earlier shortfall.',
    where: 'Results by scenario; cash chart',
  },
  {
    criterion: 'Scenarios and sensitivity',
    points: 15,
    strong: 'Downside and upside change specific, justified drivers and describe real situations. The student knows which assumptions matter most.',
    developing: 'Scenarios left at the suggested ±20% values with no explanation.',
    where: 'Results by scenario; most influential assumptions',
  },
  {
    criterion: 'Critical review and reflection',
    points: 15,
    strong: 'Thoughtful responses to the review prompts. The reflection states what must be true for the venture to work and how each will be tested.',
    developing: 'Prompts unanswered or answered defensively; no plan to test key assumptions.',
    where: 'Review prompts and responses; reflection',
  },
];
