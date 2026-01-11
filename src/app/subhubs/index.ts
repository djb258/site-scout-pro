/**
 * SubHubs Index — Storage Site Go/No-Go Engine
 *
 * Unified export for all SubHubs in the Hub-Spoke architecture.
 *
 * Pipeline Flow:
 * ```
 * ZIP → SubHub0 (Signals) → SubHub1 (Market) → SubHub2 (Rules)
 *                                                     ↓
 * SVA (Intent) ────────────────────────────→ SubHub3 (Calculators)
 *                                                     ↓
 * ZIP → SubHub4 (Parcels) ─── Parcel ID ──→ SubHub5 (Verdict)
 *                                                     ↓
 *                                           GOOD_DEAL | BAD_DEAL
 * ```
 *
 * Memory Hook: **Signals → Market → Rules → Math → Parcels → Verdict**
 *
 * @module subhubs
 */

// ============================================================================
// SUBHUB EXPORTS
// ============================================================================

// SubHub0: Signals (ZIP + FIPS anchor)
export * from './SubHub0_Signals';
export { SUBHUB0_ANCHOR } from './SubHub0_Signals';

// SubHub1: Market (ZIP anchor)
export * from './SubHub1_Market';
export { SUBHUB1_ANCHOR } from './SubHub1_Market';

// SubHub2: CountyCard (FIPS anchor)
export * from './SubHub2_CountyCard';
export { SUBHUB2_ANCHOR } from './SubHub2_CountyCard';

// SubHub3: Calculators (SVA anchor)
export * from './SubHub3_Calculators';
export { SUBHUB3_ANCHOR } from './SubHub3_Calculators';

// SubHub4: ParcelDiscovery (ZIP → Parcel ID anchor)
export * from './SubHub4_ParcelDiscovery';
export { SUBHUB4_ANCHOR } from './SubHub4_ParcelDiscovery';

// SubHub5: DealGate (SVA + Parcel ID anchor)
export * from './SubHub5_DealGate';
export { SUBHUB5_ANCHOR } from './SubHub5_DealGate';

// ============================================================================
// ANCHOR REGISTRY
// ============================================================================

import { SUBHUB0_ANCHOR } from './SubHub0_Signals';
import { SUBHUB1_ANCHOR } from './SubHub1_Market';
import { SUBHUB2_ANCHOR } from './SubHub2_CountyCard';
import { SUBHUB3_ANCHOR } from './SubHub3_Calculators';
import { SUBHUB4_ANCHOR } from './SubHub4_ParcelDiscovery';
import { SUBHUB5_ANCHOR } from './SubHub5_DealGate';

/**
 * All SubHub anchor definitions
 */
export const SUBHUB_ANCHORS = {
  SubHub0: SUBHUB0_ANCHOR,
  SubHub1: SUBHUB1_ANCHOR,
  SubHub2: SUBHUB2_ANCHOR,
  SubHub3: SUBHUB3_ANCHOR,
  SubHub4: SUBHUB4_ANCHOR,
  SubHub5: SUBHUB5_ANCHOR,
} as const;

// ============================================================================
// PIPELINE ORCHESTRATION
// ============================================================================

import { runPass0 } from './SubHub0_Signals';
import { runPass1 } from './SubHub1_Market';
import { runPass2 } from './SubHub2_CountyCard';
import { runPass3 } from './SubHub3_Calculators';
import { runPass4 } from './SubHub4_ParcelDiscovery';
import { runPass5 } from './SubHub5_DealGate';

/**
 * SubHub orchestrator functions
 */
export const SubHubOrchestrators = {
  runSignals: runPass0,
  runMarket: runPass1,
  runCountyCard: runPass2,
  runCalculators: runPass3,
  runParcelDiscovery: runPass4,
  runDealGate: runPass5,
} as const;

// ============================================================================
// TYPE RE-EXPORTS FOR CONVENIENCE
// ============================================================================

export type { Pass0Input, Pass0Output } from './SubHub0_Signals';
export type { Pass1Input, Pass1Output } from './SubHub1_Market';
// Pass2 types from SubHub2_CountyCard
export type { Pass3Input, Pass3Output } from './SubHub3_Calculators';
export type { Pass4Input, Pass4Output } from './SubHub4_ParcelDiscovery';
export type { Pass5Input, Pass5Output, DealVerdictOutput, DealVerdict } from './SubHub5_DealGate';
