/**
 * JURISDICTION CARD READER — Spoke SS.02.02
 * ============================================================================
 * Doctrine ID: SS.02.02
 * Purpose: Read jurisdiction cards from Supabase staging tables
 *
 * ============================================================================
 * VAULT GUARDIAN DOCTRINE
 * ============================================================================
 *
 * Pass 2 MUST NOT read from or write to Neon.
 * Pass 2 reads/writes ONLY to Supabase staging tables.
 *
 * Data flow:
 *   1. Cloud Functions collect data → Supabase staging
 *   2. Pass 2 reads from Supabase staging
 *   3. Promotion functions write to Neon vault (ONLY after validation)
 *
 * ============================================================================
 */

import { getSupabase } from '../../../shared/data_layer/ConnectionFactory';
import type {
  JurisdictionCardReaderInput,
  JurisdictionCardReaderResult,
  JurisdictionCard,
} from '../types/constraint_types';

// ============================================================================
// TYPES
// ============================================================================

interface StagedJurisdictionCard {
  draft_id: string;
  county_id: number;
  state_code: string;
  asset_class: string;
  status: 'pending' | 'validated' | 'promoted' | 'rejected';
  payload: {
    envelope_complete: boolean;
    card_complete: boolean;
    use_viability: {
      storage_allowed: 'yes' | 'no' | 'unknown';
      fatal_prohibition: 'yes' | 'no' | 'unknown';
      conditional_use_required: 'yes' | 'no' | 'unknown';
    };
    envelope_constraints: {
      front_setback_min_ft: { value: number | null; knowledge_state: string };
      side_setback_min_ft: { value: number | null; knowledge_state: string };
      rear_setback_min_ft: { value: number | null; knowledge_state: string };
      max_lot_coverage_pct: { value: number | null; knowledge_state: string };
      max_height_ft: { value: number | null; knowledge_state: string };
    };
    fire_safety: {
      fire_lane_required: 'yes' | 'no' | 'unknown';
      sprinkler_required: 'yes' | 'no' | 'unknown';
    };
    stormwater: {
      detention_required: 'yes' | 'no' | 'unknown';
    };
  };
  collected_at: string;
  validated_at: string | null;
}

// ============================================================================
// SPOKE IMPLEMENTATION
// ============================================================================

/**
 * Read jurisdiction card from Supabase staging.
 * DOCTRINE: Pass 2 reads from Supabase ONLY, never from Neon.
 */
export async function runJurisdictionCardReader(
  input: JurisdictionCardReaderInput
): Promise<JurisdictionCardReaderResult> {
  const timestamp = new Date().toISOString();

  console.log(`[SS.02.02] Looking up card for jurisdiction: ${input.jurisdiction_id}, asset: ${input.asset_class}`);

  try {
    // Parse jurisdiction_id to county_id
    const countyId = parseCountyId(input.jurisdiction_id);

    if (countyId === null) {
      console.warn(`[SS.02.02] Could not parse jurisdiction_id: ${input.jurisdiction_id}`);
      return {
        spoke_id: 'SS.02.02',
        status: 'error',
        timestamp,
        notes: `Invalid jurisdiction_id format: ${input.jurisdiction_id}`,
        card_found: false,
        card: null,
        card_age_days: null,
        card_stale: false,
      };
    }

    const supabase = getSupabase();

    // Query the staged jurisdiction card from Supabase
    const { data: stagedCard, error } = await supabase
      .from('staging_jurisdiction_card_drafts')
      .select('*')
      .eq('county_id', countyId)
      .eq('asset_class', input.asset_class)
      .in('status', ['validated', 'pending'])
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[SS.02.02] Error reading staged card:`, error);
      return {
        spoke_id: 'SS.02.02',
        status: 'error',
        timestamp,
        notes: `Database error: ${error.message}`,
        card_found: false,
        card: null,
        card_age_days: null,
        card_stale: false,
      };
    }

    if (!stagedCard) {
      console.log(`[SS.02.02] No staged card found for county ${countyId}`);
      return {
        spoke_id: 'SS.02.02',
        status: 'partial',
        timestamp,
        notes: `No jurisdiction card found for county ${countyId}. Card research required.`,
        card_found: false,
        card: null,
        card_age_days: null,
        card_stale: false,
      };
    }

    // Map staged card to JurisdictionCard interface
    const card = mapStagedCardToJurisdictionCard(stagedCard as StagedJurisdictionCard, input.asset_class);

    // Calculate card age
    const cardAgeMs = Date.now() - new Date(stagedCard.collected_at).getTime();
    const cardAgeDays = Math.floor(cardAgeMs / (1000 * 60 * 60 * 24));
    const cardStale = cardAgeDays > 365;

    // Determine envelope completeness from payload
    const envelopeComplete = stagedCard.payload?.envelope_complete ?? false;

    console.log(`[SS.02.02] Card found for county ${countyId}:`, {
      envelope_complete: envelopeComplete,
      age_days: cardAgeDays,
      stale: cardStale,
      status: stagedCard.status,
    });

    return {
      spoke_id: 'SS.02.02',
      status: envelopeComplete ? 'ok' : 'partial',
      timestamp,
      notes: envelopeComplete
        ? 'Jurisdiction card complete'
        : 'Jurisdiction card incomplete - some REQUIRED_FOR_ENVELOPE fields missing',
      card_found: true,
      card,
      card_age_days: cardAgeDays,
      card_stale: cardStale,
    };

  } catch (error) {
    console.error(`[SS.02.02] Error reading jurisdiction card:`, error);
    return {
      spoke_id: 'SS.02.02',
      status: 'error',
      timestamp,
      notes: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      card_found: false,
      card: null,
      card_age_days: null,
      card_stale: false,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse jurisdiction_id to numeric county_id.
 * Handles both numeric IDs and FIPS codes.
 */
function parseCountyId(jurisdictionId: string): number | null {
  // Try direct numeric parse
  const numericId = parseInt(jurisdictionId, 10);
  if (!isNaN(numericId)) {
    return numericId;
  }

  // Could be a FIPS code - try extracting numeric portion
  const fipsMatch = jurisdictionId.match(/\d+/);
  if (fipsMatch) {
    return parseInt(fipsMatch[0], 10);
  }

  return null;
}

/**
 * Map staged card to JurisdictionCard interface.
 */
function mapStagedCardToJurisdictionCard(
  staged: StagedJurisdictionCard,
  assetClass: string
): JurisdictionCard {
  const payload = staged.payload;

  return {
    card_id: `CARD-${staged.county_id}-${assetClass}`,
    jurisdiction_id: String(staged.county_id),
    asset_class: assetClass,
    last_updated: staged.collected_at,
    verified: staged.status === 'validated',

    // Zoning
    typical_zoning_codes: [],
    storage_by_right: payload.use_viability?.storage_allowed === 'yes' ? true :
                      payload.use_viability?.storage_allowed === 'no' ? false : null,
    conditional_use_typical: payload.use_viability?.conditional_use_required === 'yes',

    // Setbacks (from envelope_constraints)
    typical_setback_front_ft: payload.envelope_constraints?.front_setback_min_ft?.value ?? null,
    typical_setback_side_ft: payload.envelope_constraints?.side_setback_min_ft?.value ?? null,
    typical_setback_rear_ft: payload.envelope_constraints?.rear_setback_min_ft?.value ?? null,

    // Coverage (from envelope_constraints)
    typical_max_coverage_pct: payload.envelope_constraints?.max_lot_coverage_pct?.value ?? null,
    typical_max_height_ft: payload.envelope_constraints?.max_height_ft?.value ?? null,

    // Fire
    fire_code_adopted: null,
    fire_lane_required: payload.fire_safety?.fire_lane_required === 'yes',
    sprinkler_threshold_sqft: payload.fire_safety?.sprinkler_required === 'yes' ? 0 : null,

    // Stormwater
    stormwater_authority: null,
    detention_typically_required: payload.stormwater?.detention_required === 'yes',

    // Permitting
    typical_permit_timeline_months: null,
    permit_difficulty: null,

    // Notes
    special_conditions: [],
    warnings: staged.status !== 'validated'
      ? ['STAGED DATA - NOT YET VALIDATED']
      : [],
  };
}

/**
 * Check if a jurisdiction has a fatal prohibition.
 * Reads from Supabase staging.
 */
export async function checkFatalProhibition(countyId: number): Promise<boolean> {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('staging_jurisdiction_card_drafts')
      .select('payload')
      .eq('county_id', countyId)
      .in('status', ['validated', 'pending'])
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return false; // Assume no fatal prohibition if no data
    }

    return data.payload?.use_viability?.fatal_prohibition === 'yes';
  } catch (error) {
    console.error(`[SS.02.02] Error checking fatal prohibition:`, error);
    return false;
  }
}

/**
 * Check if envelope is complete for a jurisdiction.
 * Reads from Supabase staging.
 */
export async function checkEnvelopeComplete(countyId: number): Promise<boolean> {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('staging_jurisdiction_card_drafts')
      .select('payload')
      .eq('county_id', countyId)
      .in('status', ['validated', 'pending'])
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    return data.payload?.envelope_complete ?? false;
  } catch (error) {
    console.error(`[SS.02.02] Error checking envelope completeness:`, error);
    return false;
  }
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
