import { a, emptyScenarios, makeStream } from '../../data/defaults';
import { defaultExit } from '../exit';
import type { ModelKind, Project, Stream } from '../types';

/** A bare project: one stream, no team, no expenses, no tax, no cash. */
export function bare(kind: ModelKind, inputs: Record<string, number>, options: Stream['options'] = {}, months = 6): Project {
  const s = makeStream(kind, undefined, 's1');
  // Zero every input first so tests only depend on the values they set.
  for (const k of Object.keys(s.inputs)) s.inputs[k] = a(0);
  for (const [k, v] of Object.entries(inputs)) s.inputs[k] = a(v);
  s.options = { ...s.options, ...options };
  return {
    schemaVersion: 1,
    id: 'test',
    createdAt: '',
    updatedAt: '',
    setup: {
      name: 'Test', description: '', industries: [], startMonth: '2027-01', months,
      startingCash: a(0), founderInvestment: a(0), minCashCushion: a(0), largestCustomerSharePct: a(0),
    },
    streams: [s],
    roles: [],
    expenses: [],
    capex: [],
    funding: [],
    tax: { enabled: false, entity: 'c_corp', rate: a(0), payment: 'quarterly', includeOwnerDistributions: false },
    scenarios: emptyScenarios(),
    reviewResponses: {},
    reflection: '',
    exit: defaultExit({ streams: [s] }),
  };
}

export function line(lines: { key: string; values: number[] }[], key: string): number[] {
  const l = lines.find((x) => x.key === key || x.key.endsWith(`.${key}`));
  if (!l) throw new Error(`line ${key} not found in ${lines.map((x) => x.key).join(', ')}`);
  return l.values;
}
