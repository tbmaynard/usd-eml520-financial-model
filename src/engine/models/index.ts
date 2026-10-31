import type { ModelKind } from '../types';
import { ecommerce } from './ecommerce';
import { enterprise } from './enterprise';
import { licensing } from './licensing';
import { manufacturing } from './manufacturing';
import { marketplace } from './marketplace';
import type { ModelModule } from './moduleTypes';
import { services } from './services';
import { software } from './software';

export const MODULES: Record<ModelKind, ModelModule> = {
  software,
  manufacturing,
  services,
  ecommerce,
  marketplace,
  licensing,
  enterprise,
};

export const MODEL_ORDER: ModelKind[] = ['software', 'enterprise', 'manufacturing', 'services', 'ecommerce', 'marketplace', 'licensing'];

export function getModule(kind: ModelKind): ModelModule {
  return MODULES[kind];
}

export type { ModelModule, FieldSpec, OptionSpec, FormulaDoc, Ref } from './moduleTypes';
