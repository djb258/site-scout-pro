/**
 * SubHub4_ParcelDiscovery — ParcelDiscovery SubHub
 *
 * Anchor: ZIP (search) -> Parcel ID (promotion)
 * Scope: Parcel scanning & gating
 * Constraint: ZIP_BOUNDED_SEARCH
 *
 * Memory: Signals → Market → Rules → Math → **Parcels** → Verdict
 *
 * @module SubHub4_ParcelDiscovery
 */

// Types
export * from './types/pass4_types';

// Orchestrator
export { Pass4Orchestrator, runPass4 } from './orchestrator/Pass4Orchestrator';
export type { Pass4Input, Pass4Output } from './types/pass4_types';

// Spokes
export { runParcelScanner } from './spokes/ParcelScanner';
export type { ParcelScannerInput } from './spokes/ParcelScanner';

export { runParcelFilter } from './spokes/ParcelFilter';
export type { ParcelFilterInput } from './spokes/ParcelFilter';

export { runSiteScorer } from './spokes/SiteScorer';
export type { SiteScorerInput } from './spokes/SiteScorer';

export { runPromotionGate } from './spokes/PromotionGate';
export type { PromotionGateInput } from './spokes/PromotionGate';

// Anchor definition
export const SUBHUB4_ANCHOR = {
  id: 'SubHub4_ParcelDiscovery',
  anchors: ['ZIP', 'PARCEL_ID'],
  anchorTransition: 'ZIP -> PARCEL_ID (via promotion)',
  scope: 'parcel scanning & gating',
  constraints: ['ZIP_BOUNDED_SEARCH'],
} as const;
