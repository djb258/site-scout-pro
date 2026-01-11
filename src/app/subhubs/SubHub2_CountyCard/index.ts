/**
 * SubHub2_CountyCard — CountyCard SubHub
 *
 * Anchor: County FIPS
 * Scope: Zoning, ordinances, build constants, cost indices
 * Constraint: NO_MATH
 *
 * DOCTRINE:
 * Pass 2 defines WHAT is true about a jurisdiction.
 *
 * - Data may be known or unknown
 * - Absence of data is meaningful
 * - Pass 3 consumes this data without reinterpretation
 * - This is county-scoped, not parcel-scoped
 *
 * If a planner would write it on paper, it belongs here.
 * If it is a calculation or derived value, it belongs in Pass 3.
 *
 * @module SubHub2_CountyCard
 */

// Types
export * from './types';
export * from './underwriting_hub/types/pass2_types';
export * from './underwriting_hub/types/constraint_types';
export * from './underwriting_hub/types/jurisdiction_card';

// Factories
export {
  createEmptyJurisdictionCard,
  createUnknownNumeric,
  createUnknownTernary,
  createUnknownText,
  createKnownNumeric,
  createKnownTernary,
  createKnownText,
  CreateJurisdictionCardInput,
  UpdateNumericFieldInput,
  UpdateTernaryFieldInput,
  UpdateTextFieldInput,
} from './factories/jurisdiction_card_factory';

// Orchestrator
export { Pass2Orchestrator, runPass2 } from './underwriting_hub/orchestrator/Pass2Orchestrator';
export { Pass2ConstraintCompiler } from './underwriting_hub/orchestrator/Pass2ConstraintCompiler';

// Contracts
export * from './underwriting_hub/contracts/pass2_input';
export * from './underwriting_hub/contracts/pass2_output';

// Spokes
export { runJurisdictionResolver } from './underwriting_hub/spokes/JurisdictionResolver';
export { runJurisdictionCardReader } from './underwriting_hub/spokes/JurisdictionCardReader';
export { runZoningConstraints } from './underwriting_hub/spokes/ZoningConstraints';
export { runSitePlanConstraints } from './underwriting_hub/spokes/SitePlanConstraints';
export { runStormwaterConstraints } from './underwriting_hub/spokes/StormwaterConstraints';
export { runFireAccessConstraints } from './underwriting_hub/spokes/FireAccessConstraints';
export { runPermittingChecklist } from './underwriting_hub/spokes/PermittingChecklist';
export { runConstraintVerdict } from './underwriting_hub/spokes/ConstraintVerdict';
export { runEnvelopeReducer } from './underwriting_hub/spokes/EnvelopeReducer';

// Anchor definition
export const SUBHUB2_ANCHOR = {
  id: 'SubHub2_CountyCard',
  anchors: ['COUNTY_FIPS'],
  scope: 'zoning, ordinances, build constants, cost indices',
  constraints: ['NO_MATH'],
} as const;
