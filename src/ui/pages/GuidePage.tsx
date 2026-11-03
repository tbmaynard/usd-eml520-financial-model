import { Box, Button, Stack, Typography } from '@mui/material';
import { useEffect, type ReactNode } from 'react';
import type { Confidence } from '../../engine/types';
import { CONFIDENCE_LABELS } from '../../engine/types';
import { useStore } from '../../state/store';
import { Grid, PageHeader, Panel, Principle } from '../components/common';
import { CONF_HELP, ConfidenceDot } from '../components/inputs';
import { CHART, SURFACE, USD } from '../theme';

// "Start Here": the ideas that come up on every page, explained once before
// students start entering numbers. Reading only; not part of model progress.

function Prose({ children }: { children: ReactNode }) {
  return <Typography className="prose" sx={{ mb: 1.5, maxWidth: 820 }}>{children}</Typography>;
}

const STEPS: { title: string; text: string }[] = [
  { title: 'Venture Setup', text: 'Name the venture, pick its industries, set the projection period and the cash and funding you start with.' },
  { title: 'Business Model', text: 'Choose how the venture makes money. Each model asks for different drivers. Add more revenue streams if you have them.' },
  { title: 'Assumptions', text: 'Enter the drivers behind revenue and costs, plus your team, expenses and funding. Each one gets a basis and a confidence level.' },
  { title: 'Financial Projections', text: 'See the monthly income statement, cash flow and dashboard that your assumptions produce.' },
  { title: 'Scenarios', text: 'Test what happens when important assumptions turn out worse or better, and find the ones that matter most.' },
  { title: 'Model Review', text: 'Answer questions about your model and write a short reflection. Then export for your instructor.' },
];

const CONF_EXAMPLES: Record<Exclude<Confidence, 'unset'>, string> = {
  evidence: 'Three police departments told you in interviews they would pay $8,000 a year, and one signed a letter of intent.',
  benchmark: 'Published surveys say software companies like yours lose about 2% of customers a month.',
  speculative: 'You think about one in five pilots will turn into a contract, but you have not run a pilot yet.',
};

const TERMS: { term: string; text: string }[] = [
  { term: 'Driver', text: 'An input that the model multiplies or adds up to produce results, such as price, customers per month or days until customers pay. You change drivers, never totals.' },
  { term: 'Revenue', text: 'What customers are charged for what you delivered in a month. It is earned when you deliver, which is not always when the cash arrives.' },
  { term: 'Direct costs', text: 'Costs that rise with each sale: materials, hosting per customer, payment fees, staff who deliver the service. Also called cost of goods sold.' },
  { term: 'Gross margin', text: 'Revenue minus direct costs, as a percent of revenue. It shows how much of each sales dollar is left to pay for everything else.' },
  { term: 'Operating expenses', text: 'Costs of running the company that do not rise with each sale: salaries outside delivery, rent, software, marketing, legal.' },
  { term: 'EBITDA and operating profit', text: 'Gross profit minus operating expenses is EBITDA. Subtract depreciation of equipment and you have operating profit (or loss).' },
  { term: 'Cash is not profit', text: 'A profitable month can still drain cash if customers pay late, you buy inventory ahead of sales, or you repay a loan. Most startups fail by running out of cash, not by being unprofitable on paper.' },
  { term: 'Burn and runway', text: 'Burn is the cash you use each month. Runway is how many months of cash you have left at the current burn.' },
  { term: 'Break-even', text: 'The first month operating profit turns positive and stays positive.' },
  { term: 'Funding required', text: 'The extra money you would need so cash never drops below the minimum cushion you set.' },
  { term: 'Funding is not revenue', text: 'Investment, grants and loans bring cash in, but they are not sales. Loans must be repaid; investors receive part of the company.' },
  { term: 'Equity, dilution and the cap table', text: 'Selling equity means investors own a percentage of the company. Each new round shrinks (dilutes) everyone else’s share. The cap table lists who owns what.' },
];

function Anchor({ id }: { id: string }) {
  return <Box id={`guide-${id}`} sx={{ position: 'relative', top: -88 }} />;
}

export function GuidePage() {
  const { tab, go } = useStore();
  useEffect(() => {
    if (!tab) return;
    const t = setTimeout(() => document.getElementById(`guide-${tab}`)?.scrollIntoView({ behavior: 'smooth' }), 50);
    return () => clearTimeout(t);
  }, [tab]);

  return (
    <Box>
      <PageHeader title="Start Here" lead="A few ideas come up on every page of this tool. Read this once before you start, and come back whenever a term is unclear." />
      <Principle />

      <Panel title="How the tool works">
        <Prose>
          You will describe how your venture makes money, enter the assumptions behind it, and the tool will build a month-by-month projection of revenue, costs and cash. Every number in the projection comes from an assumption you can see and change. Nothing is sent to a server.
        </Prose>
        <Grid min={240} gap={1.5}>
          {STEPS.map((st, i) => (
            <Box key={st.title} sx={{ p: 1.75, borderRadius: 2, bgcolor: SURFACE.bg, height: '100%' }}>
              <Typography variant="overline" sx={{ color: USD.toreroBlue }}>Step {i + 1}</Typography>
              <Typography variant="subtitle1">{st.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{st.text}</Typography>
            </Box>
          ))}
        </Grid>
      </Panel>

      <Anchor id="confidence" />
      <Panel title="Every assumption has a value, a basis and a confidence">
        <Prose>
          A number on its own is not enough. For each assumption you also record its <b>basis</b> (where the number comes from, in a sentence) and how confident you are in it. Your instructor reads these as closely as the numbers.
        </Prose>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {(['evidence', 'benchmark', 'speculative'] as const).map((c) => (
            <Box key={c} sx={{ p: 1.75, borderRadius: 2, bgcolor: SURFACE.bg }}>
              <ConfidenceDot conf={c} withLabel />
              <Typography variant="body2" sx={{ mt: 0.75 }}>{CONF_HELP[c]}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>For example: {CONF_EXAMPLES[c]}</Typography>
            </Box>
          ))}
        </Stack>
        <Prose>
          Speculative is not a bad answer. Early ventures run on speculation; the point is to know which numbers are guesses, so you can go and test the ones that matter most. Values still marked <Box component="span" sx={{ color: USD.yarrow, fontWeight: 600 }}>Example</Box> are illustrative starting values the tool filled in. Replace or confirm each one; the label disappears when you do. A value with no rating shows as “{CONFIDENCE_LABELS.unset}”.
        </Prose>
      </Panel>

      <Anchor id="scenarios" />
      <Panel title="Scenarios: base, downside and upside">
        <Prose>
          Your plan will be wrong in some way; the question is how wrong, and whether the venture survives it. The tool keeps three versions of the same model:
        </Prose>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {([
            ['base', 'Base case', 'Your assumptions exactly as you entered them. This is what most pages show.'],
            ['downside', 'Downside case', 'The same model with a few drivers moved in the harmful direction: fewer customers, longer sales cycles, customers paying later.'],
            ['upside', 'Upside case', 'The same model with those drivers moved in the helpful direction.'],
          ] as const).map(([id, title, text]) => (
            <Stack key={id} direction="row" spacing={1.5} alignItems="baseline" sx={{ p: 1.75, borderRadius: 2, bgcolor: SURFACE.bg }}>
              <Box sx={{ width: 14, height: 4, borderRadius: 1, bgcolor: CHART.scenario[id], flexShrink: 0, position: 'relative', top: -3 }} />
              <Box>
                <Typography variant="subtitle1">{title}</Typography>
                <Typography variant="body2" color="text.secondary">{text}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
        <Prose>
          The <b>Downside / Base / Upside</b> buttons in the top bar only choose which version the projection pages display; they never change your inputs. The question mark next to them lists exactly what each scenario changes. When you create a model, the downside and upside start with placeholder changes (each key driver moved about 20%). On the Scenarios page you can change those values, add or remove drivers, and write down the real-world situation each case represents, such as “our anchor customer delays its purchase by six months.”
        </Prose>
        <Prose>
          The Scenarios page also has a <b>sensitivity analysis</b>. It moves one assumption at a time and shows which ones change the outcome most. Those are the assumptions that most need good evidence.
        </Prose>
        <Button variant="outlined" onClick={() => go('scenarios', 'edit')}>Open the scenario settings</Button>
      </Panel>

      <Anchor id="terms" />
      <Panel title="Words you will see">
        <Grid min={300} gap={1.5}>
          {TERMS.map((t) => (
            <Box key={t.term} sx={{ p: 1.75, borderRadius: 2, bgcolor: SURFACE.bg, height: '100%' }}>
              <Typography variant="subtitle1">{t.term}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{t.text}</Typography>
            </Box>
          ))}
        </Grid>
      </Panel>

      <Panel title="Saving your work">
        <Prose>
          There is no account. Your work saves automatically in this browser only, and clearing browser data erases it. Use <b>Download project file</b> in the top bar regularly to keep a copy you can reopen anywhere, and submit that file (or the Excel export) for class.
        </Prose>
        <Button variant="contained" onClick={() => go('setup')}>Start with Venture Setup</Button>
      </Panel>
    </Box>
  );
}
