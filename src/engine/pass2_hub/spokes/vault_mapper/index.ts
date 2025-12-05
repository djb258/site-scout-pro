/**
 * VAULT MAPPER SPOKE
 *
 * Responsibility: Transform final Pass-2 result into Neon schema format
 * Target table: storage_evaluation_state_county_zip_focus
 *
 * Inputs:
 *   - OpportunityObject with all Pass-1 and Pass-2 results
 *   - VerdictResult from verdict spoke
 *
 * Outputs:
 *   - VaultPayload: Flat, Neon-ready JSON payload
 *
 * This spoke does NOT write to Neon directly - it only prepares the payload.
 * The save_to_vault edge function handles the actual write.
 */

import type { OpportunityObject, AnalysisToggles } from '../../../shared/opportunity_object';
import type {
  VaultPayload,
  VerdictResult,
  ZoningResult,
  PermitResult,
  PricingVerificationResult,
  FusionDemandResult,
  CompetitivePressureResult,
  FeasibilityResult,
  ReverseFeasibilityResult,
  MomentumResult,
} from '../../types/pass2_types';
import { writeLog } from '../../../shared/lovable_adapter';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input for vault mapping
 */
export interface VaultMapperInput {
  opportunity: OpportunityObject;
  zoning: ZoningResult;
  permits: PermitResult;
  pricing: PricingVerificationResult;
  fusion: FusionDemandResult;
  comp: CompetitivePressureResult;
  feasibility: FeasibilityResult;
  reverse: ReverseFeasibilityResult;
  momentum: MomentumResult;
  verdict: VerdictResult;
}

/**
 * Neon schema for storage_evaluation_state_county_zip_focus table
 */
export interface NeonVaultRecord {
  // Primary identifiers
  opportunity_id: string;
  created_at: string;
  saved_at: string;

  // Location identity
  zip: string;
  city: string;
  county: string;
  state: string;
  lat: number;
  lng: number;
  county_fips?: string;

  // Analysis toggles
  urban_exclude: boolean;
  multifamily_priority: boolean;
  recreation_load: boolean;
  industrial_momentum: boolean;
  analysis_mode: 'build' | 'buy' | 'compare';

  // Pass 1 summary (flattened)
  pass1_population: number;
  pass1_demand_sqft: number;
  pass1_supply_sqft: number;
  pass1_competitor_count: number;
  pass1_hotspot_score: number;
  pass1_tier: string;
  pass1_proceed_to_pass2: boolean;

  // Zoning (flattened)
  zoning_code: string;
  zoning_classification: string;
  zoning_score: number;
  zoning_storage_allowed: boolean;
  zoning_by_right: boolean;
  zoning_cup_required: boolean;
  zoning_variance_needed: boolean;

  // Permits (flattened)
  permit_complexity: string;
  permit_risk_level: string;
  permit_timeline: string;
  permit_total_fees: number;

  // Pricing (flattened)
  pricing_standard_10x10: number;
  pricing_climate_10x10: number;
  pricing_outdoor_10x20: number;
  pricing_blended_rent: number;
  pricing_avg_psf: number;
  pricing_market_position: string;
  pricing_confidence: string;

  // Demand/Competition (flattened)
  fusion_demand_score: number;
  fusion_supply_gap_sqft: number;
  fusion_market_timing: string;
  comp_pressure_score: number;
  comp_competitor_count_5mi: number;
  comp_competitor_count_10mi: number;
  comp_sqft_per_capita: number;
  comp_market_saturation: string;

  // Feasibility (flattened)
  feas_land_cost: number;
  feas_construction_cost: number;
  feas_total_dev_cost: number;
  feas_net_rentable_sqft: number;
  feas_noi: number;
  feas_cap_rate: number;
  feas_stabilized_value: number;
  feas_roi_5yr: number;
  feas_cash_on_cash: number;
  feas_dscr: number;
  feas_is_viable: boolean;

  // Reverse Feasibility (flattened)
  rev_required_rent_psf: number;
  rev_required_rent_10x10: number;
  rev_break_even_occupancy: number;
  rev_max_land_per_acre: number;
  rev_is_achievable: boolean;

  // Momentum (flattened)
  mom_industrial_growth_pct: number;
  mom_logistics_score: number;
  mom_industrial_rating: string;
  mom_new_housing_units: number;
  mom_housing_growth_score: number;
  mom_timeline_alignment: string;

  // Final Verdict
  verdict_decision: string;
  verdict_recommendation: string;
  verdict_confidence: number;
  verdict_key_factors: string[]; // JSON array
  verdict_risks: string[]; // JSON array
  verdict_next_steps: string[]; // JSON array
}

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

/**
 * Map Pass-2 results to Neon vault record format
 */
function mapToNeonRecord(input: VaultMapperInput): NeonVaultRecord {
  const { opportunity, zoning, permits, pricing, fusion, comp, feasibility, reverse, momentum, verdict } = input;

  return {
    // Primary identifiers
    opportunity_id: opportunity.id,
    created_at: opportunity.created_at,
    saved_at: new Date().toISOString(),

    // Location identity
    zip: opportunity.identity.zip,
    city: opportunity.identity.city,
    county: opportunity.identity.county,
    state: opportunity.identity.state,
    lat: opportunity.identity.lat,
    lng: opportunity.identity.lng,
    county_fips: opportunity.identity.county_fips,

    // Analysis toggles
    urban_exclude: opportunity.toggles.urban_exclude,
    multifamily_priority: opportunity.toggles.multifamily_priority,
    recreation_load: opportunity.toggles.recreation_load,
    industrial_momentum: opportunity.toggles.industrial_momentum,
    analysis_mode: opportunity.toggles.analysis_mode,

    // Pass 1 summary
    pass1_population: opportunity.pass1_macro?.macro_demand?.population || 0,
    pass1_demand_sqft: opportunity.pass1_macro?.macro_demand?.demand_sqft || 0,
    pass1_supply_sqft: opportunity.pass1_macro?.macro_supply?.total_supply_sqft || 0,
    pass1_competitor_count: opportunity.pass1_macro?.competitors?.length || 0,
    pass1_hotspot_score: opportunity.pass1_macro?.hotspot_score?.overall_score || 0,
    pass1_tier: opportunity.pass1_recommendation?.tier || 'D',
    pass1_proceed_to_pass2: opportunity.pass1_recommendation?.proceed_to_pass2 || false,

    // Zoning
    zoning_code: zoning.zoningCode || '',
    zoning_classification: zoning.classification || 'conditional',
    zoning_score: zoning.score || 0,
    zoning_storage_allowed: zoning.storageAllowed ?? true,
    zoning_by_right: zoning.byRight ?? false,
    zoning_cup_required: zoning.conditionalUseRequired ?? true,
    zoning_variance_needed: zoning.varianceNeeded ?? false,

    // Permits
    permit_complexity: permits.complexity || 'moderate',
    permit_risk_level: permits.permitRiskLevel || 'medium',
    permit_timeline: permits.estimatedTimeline || '90-120 days',
    permit_total_fees: permits.totalFees || 0,

    // Pricing
    pricing_standard_10x10: pricing.standard10x10 || 0,
    pricing_climate_10x10: pricing.climateControl10x10 || 0,
    pricing_outdoor_10x20: pricing.outdoor10x20 || 0,
    pricing_blended_rent: pricing.blendedRent || 0,
    pricing_avg_psf: pricing.avgPsf || 0,
    pricing_market_position: pricing.marketPosition || 'competitive',
    pricing_confidence: pricing.confidence || 'low',

    // Fusion Demand
    fusion_demand_score: fusion.demandScore || 0,
    fusion_supply_gap_sqft: fusion.supplyGapSqFt || 0,
    fusion_market_timing: fusion.marketTiming || 'neutral',

    // Competitive Pressure
    comp_pressure_score: comp.pressureScore || 0,
    comp_competitor_count_5mi: comp.competitorCount5mi || 0,
    comp_competitor_count_10mi: comp.competitorCount10mi || 0,
    comp_sqft_per_capita: comp.sqftPerCapita || 0,
    comp_market_saturation: comp.marketSaturation || 'balanced',

    // Feasibility
    feas_land_cost: feasibility.landCost || 0,
    feas_construction_cost: feasibility.constructionCost || 0,
    feas_total_dev_cost: feasibility.totalDevelopmentCost || 0,
    feas_net_rentable_sqft: feasibility.netRentableSqft || 0,
    feas_noi: feasibility.noi || 0,
    feas_cap_rate: feasibility.capRate || 0,
    feas_stabilized_value: feasibility.stabilizedValue || 0,
    feas_roi_5yr: feasibility.roi5yr || 0,
    feas_cash_on_cash: feasibility.cashOnCash || 0,
    feas_dscr: feasibility.dscr || 0,
    feas_is_viable: feasibility.isViable ?? false,

    // Reverse Feasibility
    rev_required_rent_psf: reverse.requiredRentPsf || 0,
    rev_required_rent_10x10: reverse.requiredRent10x10 || 0,
    rev_break_even_occupancy: reverse.breakEvenOccupancy || 0,
    rev_max_land_per_acre: reverse.maxLandPricePerAcre || 0,
    rev_is_achievable: reverse.isAchievable ?? false,

    // Momentum
    mom_industrial_growth_pct: momentum.industrialGrowthRatePct || 0,
    mom_logistics_score: momentum.logisticsScore || 0,
    mom_industrial_rating: momentum.industrialMomentumRating || 'weak',
    mom_new_housing_units: momentum.newUnitsPlanned || 0,
    mom_housing_growth_score: momentum.housingGrowth || 0,
    mom_timeline_alignment: momentum.timelineAlignment || 'neutral',

    // Verdict
    verdict_decision: verdict.decision || 'EVALUATE',
    verdict_recommendation: verdict.recommendation || 'EVALUATE',
    verdict_confidence: verdict.confidence || 0,
    verdict_key_factors: verdict.keyFactors || [],
    verdict_risks: verdict.risks || [],
    verdict_next_steps: verdict.nextSteps || [],
  };
}

/**
 * Create summary object for VaultPayload
 */
function createSummary(input: VaultMapperInput) {
  const { opportunity, zoning, permits, pricing, fusion, comp, feasibility, verdict } = input;

  return {
    pass1Summary: {
      macro_demand_sqft: opportunity.pass1_macro?.macro_demand?.demand_sqft,
      macro_supply_sqft: opportunity.pass1_macro?.macro_supply?.total_supply_sqft,
      competitor_count: opportunity.pass1_macro?.competitors?.length || 0,
      hotspot_score: opportunity.pass1_macro?.hotspot_score?.overall_score,
    },
    pass2Summary: {
      zoningClassification: zoning.classification,
      permitComplexity: permits.complexity,
      rent10x10Std: pricing.standard10x10,
      fusionScore: fusion.demandScore,
      compPressure: comp.pressureScore,
      capRate: feasibility.capRate,
      isViable: feasibility.isViable,
    },
  };
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Map Pass-2 results to vault payload
 *
 * @param input - VaultMapperInput with all spoke results
 * @returns VaultPayload ready for save_to_vault
 */
export function mapToVaultPayload(input: VaultMapperInput): VaultPayload {
  console.log(`[VAULT_MAPPER] Mapping results for ${input.opportunity.identity.county}, ${input.opportunity.identity.state}`);

  try {
    const neonRecord = mapToNeonRecord(input);
    const summary = createSummary(input);

    const vaultPayload: VaultPayload = {
      status: 'ok',
      mapped: true,
      payload: {
        opportunityId: input.opportunity.id,
        createdAt: input.opportunity.created_at,
        savedAt: new Date().toISOString(),
        identity: {
          zip: input.opportunity.identity.zip,
          city: input.opportunity.identity.city,
          county: input.opportunity.identity.county,
          state: input.opportunity.identity.state,
          lat: input.opportunity.identity.lat,
          lng: input.opportunity.identity.lng,
        },
        toggles: {
          urban_exclude: input.opportunity.toggles.urban_exclude,
          multifamily_priority: input.opportunity.toggles.multifamily_priority,
          recreation_load: input.opportunity.toggles.recreation_load,
          industrial_momentum: input.opportunity.toggles.industrial_momentum,
          analysis_mode: input.opportunity.toggles.analysis_mode,
        },
        pass1Summary: summary.pass1Summary,
        pass2Summary: summary.pass2Summary,
        verdict: input.verdict,
        neonRecord, // Full flattened record for Neon insert
      },
      notes: `Vault payload mapped for ${input.opportunity.identity.county}, ${input.opportunity.identity.state}. Decision: ${input.verdict.decision}.`,
    };

    console.log(`[VAULT_MAPPER] Mapped successfully. Decision: ${input.verdict.decision}`);
    return vaultPayload;
  } catch (error) {
    console.error('[VAULT_MAPPER] Error:', error);

    return {
      status: 'error',
      mapped: false,
      payload: null,
      notes: `Vault mapping failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Run vault mapper shell (async version with logging)
 */
export async function runVaultMapperShell(input: VaultMapperInput): Promise<VaultPayload> {
  const payload = mapToVaultPayload(input);

  await writeLog('vault_mapper_complete', {
    opportunity_id: input.opportunity.id,
    county: input.opportunity.identity.county,
    state: input.opportunity.identity.state,
    decision: input.verdict.decision,
    mapped: payload.mapped,
    status: payload.status,
  });

  return payload;
}

/**
 * Validate payload before save
 */
export function validateVaultPayload(payload: VaultPayload): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!payload.mapped) {
    errors.push('Payload not successfully mapped');
  }

  if (!payload.payload) {
    errors.push('Payload data is null');
    return { valid: false, errors };
  }

  // Check required fields
  if (!payload.payload.opportunityId) errors.push('Missing opportunity ID');
  if (!payload.payload.identity?.zip) errors.push('Missing ZIP code');
  if (!payload.payload.identity?.state) errors.push('Missing state');
  if (!payload.payload.verdict) errors.push('Missing verdict');

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract Neon-ready record from vault payload
 */
export function extractNeonRecord(payload: VaultPayload): NeonVaultRecord | null {
  if (!payload.mapped || !payload.payload) {
    return null;
  }

  return payload.payload.neonRecord || null;
}

// Re-export types
export type { VaultPayload, NeonVaultRecord };
