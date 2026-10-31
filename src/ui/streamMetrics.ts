import { useDeferredValue, useMemo } from 'react';
import { runSensitivity } from '../engine/sensitivity';
import type { ModelKind } from '../engine/types';
import { useStore } from '../state/store';

/** The handful of business metrics worth showing for each model, with the
 *  formula that explains each one. */
export const KEY_METRICS: Record<ModelKind, { key: string; formula: string; at: 'last' | 'sum' }[]> = {
  software: [
    { key: 'endCustomers', formula: 'sw.customers', at: 'last' },
    { key: 'mrr', formula: 'sw.mrr', at: 'last' },
    { key: 'arr', formula: 'sw.arr', at: 'last' },
    { key: 'ltv', formula: 'sw.ltv', at: 'last' },
    { key: 'blendedCac', formula: 'sw.cac', at: 'last' },
    { key: 'licSales', formula: 'sw.license', at: 'sum' },
    { key: 'activeProjects', formula: 'sw.projects', at: 'last' },
  ],
  enterprise: [
    { key: 'pilotsStarted', formula: 'en.pilots', at: 'sum' },
    { key: 'wins', formula: 'en.wins', at: 'sum' },
    { key: 'activeCustomers', formula: 'en.recurring', at: 'last' },
    { key: 'contractedArr', formula: 'en.contractedArr', at: 'last' },
    { key: 'pipelineWeighted', formula: 'en.pipeline', at: 'last' },
    { key: 'salesCycle', formula: 'en.cycle', at: 'last' },
    { key: 'cac', formula: 'en.cac', at: 'last' },
    { key: 'concentration', formula: 'en.concentration', at: 'last' },
  ],
  manufacturing: [
    { key: 'unitsSold', formula: 'mf.units', at: 'sum' },
    { key: 'unmet', formula: 'mf.units', at: 'sum' },
    { key: 'utilization', formula: 'mf.util', at: 'last' },
    { key: 'varCostPerUnit', formula: 'mf.varcost', at: 'last' },
    { key: 'inventory', formula: 'mf.inventory', at: 'last' },
  ],
  services: [
    { key: 'billableHours', formula: 'ps.billable', at: 'sum' },
    { key: 'unservedHours', formula: 'ps.billable', at: 'sum' },
    { key: 'utilization', formula: 'ps.util', at: 'last' },
    { key: 'revPerConsultant', formula: 'ps.revPerEmp', at: 'last' },
    { key: 'consultants', formula: 'ps.available', at: 'last' },
  ],
  ecommerce: [
    { key: 'orders', formula: 'ec.orders', at: 'sum' },
    { key: 'contributionPerOrder', formula: 'ec.contribution', at: 'last' },
    { key: 'newCustomers', formula: 'ec.acq', at: 'sum' },
  ],
  marketplace: [
    { key: 'gmv', formula: 'mp.gmv', at: 'sum' },
    { key: 'transactions', formula: 'mp.tx', at: 'sum' },
    { key: 'revPerTx', formula: 'mp.revPerTx', at: 'last' },
    { key: 'contribution', formula: 'mp.contribution', at: 'sum' },
  ],
  licensing: [
    { key: 'newDeals', formula: 'li.deals', at: 'sum' },
    { key: 'activeLicensees', formula: 'li.recurring', at: 'last' },
  ],
};

/** Sensitivity results for the base case, recomputed in the background. */
export function useSensitivity(pct = 20) {
  const { project } = useStore();
  const deferred = useDeferredValue(project);
  return useMemo(() => runSensitivity(deferred, pct), [deferred, pct]);
}
