/**
 * SubHub1_Market — Market SubHub
 *
 * Anchor: ZIP
 * Scope: Demand, population, competitors, rent recon
 * Constraint: NO_ZONING, NO_RULES
 *
 * @module SubHub1_Market
 */

// Types
export * from './structure_hub/types/pass1_types';
export * from './rent_recon/rent_recon_hub/types/pass15_types';

// Orchestrator
export { Pass1Orchestrator, runPass1 } from './structure_hub/orchestrator/Pass1Orchestrator';
export type { Pass1Input, Pass1Output } from './structure_hub/types/pass1_types';

// Rent Recon Orchestrator
export { Pass15Orchestrator, runPass15 } from './rent_recon/rent_recon_hub/orchestrator/Pass15Orchestrator';

// Structure Spokes
export { runZipHydration } from './structure_hub/spokes/ZipHydration';
export { runRadiusBuilder } from './structure_hub/spokes/RadiusBuilder';
export { runMacroDemand } from './structure_hub/spokes/MacroDemand';
export { runMacroSupply } from './structure_hub/spokes/MacroSupply';
export { runCompetitorRegistry } from './structure_hub/spokes/CompetitorRegistry';
export { runLocalScan } from './structure_hub/spokes/LocalScan';
export { runHotspotScoring } from './structure_hub/spokes/HotspotScoring';
export { runValidationGate } from './structure_hub/spokes/ValidationGate';

// Rent Recon Spokes
export { runPublishedRateScraper } from './rent_recon/rent_recon_hub/spokes/PublishedRateScraper';
export { runRateEvidenceNormalizer } from './rent_recon/rent_recon_hub/spokes/RateEvidenceNormalizer';
export { runCoverageConfidence } from './rent_recon/rent_recon_hub/spokes/CoverageConfidence';
export { runAICallWorkOrders } from './rent_recon/rent_recon_hub/spokes/AICallWorkOrders';
export { runPromotionGate } from './rent_recon/rent_recon_hub/spokes/PromotionGate';

// Anchor definition
export const SUBHUB1_ANCHOR = {
  id: 'SubHub1_Market',
  anchors: ['ZIP'],
  scope: 'demand, population, competitors, rent recon',
  constraints: ['NO_ZONING', 'NO_RULES'],
} as const;
