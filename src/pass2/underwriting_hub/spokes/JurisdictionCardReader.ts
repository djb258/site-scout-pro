// =============================================================================
// JURISDICTION CARD READER — Spoke SS.02.02
// =============================================================================
// Doctrine ID: SS.02.02
// Purpose: Read pre-compiled jurisdiction constraint cards from database
//
// Jurisdiction cards contain typical constraints for a jurisdiction+asset combo.
// Cards are manually researched and periodically updated.
// =============================================================================

import type {
  JurisdictionCardReaderInput,
  JurisdictionCardReaderResult,
  JurisdictionCard,
} from '../types/constraint_types';

/**
 * Read jurisdiction card from database.
 *
 * TODO: Implement actual card lookup from:
 * - Supabase jurisdiction_cards table
 * - Neon vault (if promoted)
 */
export async function runJurisdictionCardReader(
  input: JurisdictionCardReaderInput
): Promise<JurisdictionCardReaderResult> {
  const timestamp = new Date().toISOString();

  console.log(`[SS.02.02] Looking up card for jurisdiction: ${input.jurisdiction_id}, asset: ${input.asset_class}`);

  // STUB: No card found
  // In production, this would query the jurisdiction_cards table

  return {
    spoke_id: 'SS.02.02',
    status: 'stub',
    timestamp,
    notes: `No jurisdiction card found for ${input.jurisdiction_id}. Card research required.`,
    card_found: false,
    card: null,
    card_age_days: null,
    card_stale: false,
  };
}

/**
 * Create a mock jurisdiction card for testing.
 */
export function createMockJurisdictionCard(
  jurisdictionId: string,
  assetClass: string
): JurisdictionCard {
  return {
    card_id: `CARD-${jurisdictionId}-${assetClass}`,
    jurisdiction_id: jurisdictionId,
    asset_class: assetClass,
    last_updated: new Date().toISOString(),
    verified: false,

    // Zoning
    typical_zoning_codes: ['I-1', 'I-2', 'C-2'],
    storage_by_right: null,
    conditional_use_typical: true,

    // Setbacks
    typical_setback_front_ft: 25,
    typical_setback_side_ft: 10,
    typical_setback_rear_ft: 15,

    // Coverage
    typical_max_coverage_pct: 65,
    typical_max_height_ft: 35,

    // Fire
    fire_code_adopted: 'IFC 2021',
    fire_lane_required: true,
    sprinkler_threshold_sqft: 5000,

    // Stormwater
    stormwater_authority: 'County',
    detention_typically_required: true,

    // Permitting
    typical_permit_timeline_months: 6,
    permit_difficulty: 'moderate',

    // Notes
    special_conditions: [],
    warnings: ['MOCK DATA - NOT VERIFIED'],
  };
}
