import type { ModelKind } from '../types';
import { ecommerce } from './ecommerce';
import { enterprise } from './enterprise';
import { withLaunch } from './launch';
import { licensing } from './licensing';
import { manufacturing } from './manufacturing';
import { marketplace } from './marketplace';
import type { ModelModule } from './moduleTypes';
import { services } from './services';
import { software } from './software';

/** Every module also gets the shared "First month of sales" driver (see launch.ts). */
export const MODULES: Record<ModelKind, ModelModule> = {
  software: withLaunch(software),
  manufacturing: withLaunch(manufacturing),
  services: withLaunch(services),
  ecommerce: withLaunch(ecommerce),
  marketplace: withLaunch(marketplace),
  licensing: withLaunch(licensing),
  enterprise: withLaunch(enterprise),
};

export const MODEL_ORDER: ModelKind[] = ['software', 'enterprise', 'manufacturing', 'services', 'ecommerce', 'marketplace', 'licensing'];

export function getModule(kind: ModelKind): ModelModule {
  return MODULES[kind];
}

export { SALES_START_KEY } from './launch';
export type { ModelModule, FieldSpec, OptionSpec, FormulaDoc, Ref } from './moduleTypes';
