/**
 * SubHub3_Calculators — Calculators SubHub
 *
 * Anchor: SVA (Sovereign ID)
 * Scope: Feasibility, ROI, density math
 * Constraint: READ_ONLY, NO_GEO_WRITES
 *
 * @module SubHub3_Calculators
 */

// Types
export * from './design_hub/types/pass3_types';

// Orchestrator
export { Pass3Orchestrator, runPass3 } from './design_hub/orchestrator/Pass3Orchestrator';
export type { Pass3Input, Pass3Output } from './design_hub/orchestrator/Pass3Orchestrator';

// Spokes
export { runSetbackEngine } from './design_hub/spokes/SetbackEngine';
export { runCoverageEngine } from './design_hub/spokes/CoverageEngine';
export { runUnitMixOptimizer } from './design_hub/spokes/UnitMixOptimizer';
export { runPhasePlanner } from './design_hub/spokes/PhasePlanner';
export { runBuildCostModel } from './design_hub/spokes/BuildCostModel';
export { runNOIEngine } from './design_hub/spokes/NOIEngine';
export { runDebtModel } from './design_hub/spokes/DebtModel';
export { runMaxLandPrice } from './design_hub/spokes/MaxLandPrice';
export { runIRRModel } from './design_hub/spokes/IRRModel';
export { runFeasibility } from './design_hub/spokes/Feasibility';

// Anchor definition
export const SUBHUB3_ANCHOR = {
  id: 'SubHub3_Calculators',
  anchors: ['SVA'],
  scope: 'feasibility, ROI, density math',
  constraints: ['READ_ONLY', 'NO_GEO_WRITES'],
} as const;
