/**
 * SubHub0_Signals — Signals SubHub
 *
 * Anchor: ZIP + County FIPS
 * Scope: Signals, inspections, permits chatter
 * Constraint: NO_CALCULATIONS
 *
 * @module SubHub0_Signals
 */

// Types
export * from './radar_hub/types/pass0_types';

// Orchestrator
export { Pass0Orchestrator, runPass0 } from './radar_hub/orchestrator/Pass0Orchestrator';
export type { Pass0Input, Pass0Output } from './radar_hub/orchestrator/Pass0Orchestrator';

// Spokes
export { runTrendSignal } from './radar_hub/spokes/TrendSignal';
export { runPermitActivity } from './radar_hub/spokes/PermitActivity';
export { runNewsEvents } from './radar_hub/spokes/NewsEvents';
export { runIndustrialLogistics } from './radar_hub/spokes/IndustrialLogistics';
export { runHousingPipeline } from './radar_hub/spokes/HousingPipeline';
export { runMomentumFusion } from './radar_hub/spokes/MomentumFusion';

// Anchor definition
export const SUBHUB0_ANCHOR = {
  id: 'SubHub0_Signals',
  anchors: ['ZIP', 'COUNTY_FIPS'],
  scope: 'signals, inspections, permits chatter',
  constraints: ['NO_CALCULATIONS'],
} as const;
