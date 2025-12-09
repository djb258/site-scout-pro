/**
 * CIVIL CONSTRAINTS SPOKE
 *
 * Responsibility: Calculate civil engineering constraints for site development
 *
 * Calculations:
 *   1. ADA Parking Requirements (min stalls + slope <2%)
 *   2. Lot Coverage Feasibility (allowed % vs required %)
 *   3. Topography Analysis (slope bands + buildable area reduction)
 *   4. Stormwater Footprint (detention basin acreage, runoff coefficients)
 *   5. Infiltration Viability (high/med/low based on soil type)
 *   6. Construction Bonding Amount + Type
 *
 * Inputs:
 *   - acreage: number
 *   - zoning: ZoningResult (for lot coverage limits)
 *   - state/county: string (for regulatory requirements)
 *   - avgSlopePct: number (optional, from terrain data)
 *   - soilType: string (optional, affects infiltration)
 *
 * Outputs:
 *   - CivilConstraintResult consumed by feasibility + verdict spokes
 *
 * Data Sources:
 *   - Lovable.DB: jurisdiction_cards (lot coverage, setbacks)
 *   - State regulations for stormwater (computed defaults)
 *   - ADA standards (static calculations)
 */

import type { OpportunityObject } from '../../../shared/opportunity_object';
import type {
  CivilConstraintResult,
  CivilConstraintInput,
  ZoningResult,
  ParkingRequirements,
  LotCoverageAnalysis,
  TopographyAnalysis,
  StormwaterAnalysis,
  ConstructionBonding,
} from '../../types/pass2_types';
import { createStubCivilConstraints, createErrorResult } from '../../types/pass2_types';
import { queryData, writeLog } from '../../../shared/lovable_adapter';

// ============================================================================
// CONSTANTS
// ============================================================================

// ADA Parking Requirements (per ADA Standards)
const ADA_PARKING_TABLE = [
  { totalSpaces: 25, adaSpaces: 1 },
  { totalSpaces: 50, adaSpaces: 2 },
  { totalSpaces: 75, adaSpaces: 3 },
  { totalSpaces: 100, adaSpaces: 4 },
  { totalSpaces: 150, adaSpaces: 5 },
  { totalSpaces: 200, adaSpaces: 6 },
  { totalSpaces: 300, adaSpaces: 7 },
  { totalSpaces: 400, adaSpaces: 8 },
  { totalSpaces: 500, adaSpaces: 9 },
  { totalSpaces: 1000, adaSpaces: 20 }, // 2% of total for 501-1000
];

// Self-storage parking ratio (typically 1 space per 5,000-10,000 sqft)
const PARKING_RATIO_SQFT = 7500; // 1 space per 7,500 sqft of rentable
const PARKING_STALL_SQFT = 180; // 9x20 stall including drive aisle portion
const ADA_MAX_SLOPE_PCT = 2.0; // ADA requires <2% slope in accessible areas

// Stormwater runoff coefficients by surface type
const RUNOFF_COEFFICIENTS = {
  impervious: 0.95, // Buildings, asphalt
  gravel: 0.50,
  landscaped: 0.25,
  natural: 0.15,
};

// State stormwater stringency (higher = more requirements)
const STATE_STORMWATER_STRINGENCY: Record<string, number> = {
  CA: 95, NY: 90, NJ: 90, MA: 85, WA: 85, MD: 85, VA: 80,
  FL: 80, TX: 70, PA: 75, IL: 75, OH: 70, GA: 65, NC: 70,
  // Default for unlisted states: 60
};

// Bonding requirements by state
const STATE_BONDING_REQUIREMENTS: Record<string, { required: boolean; pctOfCost: number }> = {
  CA: { required: true, pctOfCost: 0.15 },
  NY: { required: true, pctOfCost: 0.12 },
  NJ: { required: true, pctOfCost: 0.12 },
  TX: { required: false, pctOfCost: 0.10 },
  FL: { required: true, pctOfCost: 0.10 },
  // Default for unlisted states: { required: false, pctOfCost: 0.10 }
};

// Grading cost per cubic yard by slope
const GRADING_COST_PER_CY = 8; // Base cost
const SLOPE_GRADING_MULTIPLIERS = {
  flat: 1.0,      // 0-2% slope
  gentle: 1.5,    // 2-5% slope
  moderate: 2.5,  // 5-10% slope
  steep: 4.0,     // 10%+ slope
};

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate ADA parking requirements
 */
function calculateParkingRequirements(
  netRentableSqft: number,
  avgSlopePct: number
): ParkingRequirements {
  // Calculate total parking spaces needed
  const minStalls = Math.max(5, Math.ceil(netRentableSqft / PARKING_RATIO_SQFT));

  // Determine ADA spaces required
  let adaStalls = 1;
  for (const entry of ADA_PARKING_TABLE) {
    if (minStalls <= entry.totalSpaces) {
      adaStalls = entry.adaSpaces;
      break;
    }
    adaStalls = entry.adaSpaces;
  }

  // For 501+ spaces, 2% of total
  if (minStalls > 500) {
    adaStalls = Math.ceil(minStalls * 0.02);
  }

  const totalParkingArea = minStalls * PARKING_STALL_SQFT;
  const meetsAdaRequirements = avgSlopePct <= ADA_MAX_SLOPE_PCT;

  return {
    minStalls,
    adaStalls,
    maxSlopePct: ADA_MAX_SLOPE_PCT,
    sqftPerStall: PARKING_STALL_SQFT,
    totalParkingArea,
    meetsAdaRequirements,
  };
}

/**
 * Calculate lot coverage feasibility
 */
function calculateLotCoverage(
  acreage: number,
  zoningLotCoveragePct: number,
  netRentableSqft: number,
  parkingAreaSqft: number
): LotCoverageAnalysis {
  const totalSiteSqft = acreage * 43560;
  const allowedCoveragePct = zoningLotCoveragePct || 70;
  const maxBuildableSqft = totalSiteSqft * (allowedCoveragePct / 100);

  // Building footprint (assume 85% efficiency for multi-story)
  const buildingFootprintSqft = Math.ceil(netRentableSqft / 0.85);

  // Landscape buffer (typically 10-15% of site for storage)
  const landscapeBufferSqft = Math.ceil(totalSiteSqft * 0.12);

  // Total required impervious
  const totalRequiredSqft = buildingFootprintSqft + parkingAreaSqft + landscapeBufferSqft;
  const requiredCoveragePct = (totalRequiredSqft / totalSiteSqft) * 100;

  const isFeasible = requiredCoveragePct <= allowedCoveragePct;
  const remainingAreaSqft = Math.max(0, maxBuildableSqft - totalRequiredSqft);

  return {
    allowedCoveragePct,
    requiredCoveragePct: Math.round(requiredCoveragePct * 10) / 10,
    isFeasible,
    maxBuildableSqft: Math.round(maxBuildableSqft),
    buildingFootprintSqft: Math.round(buildingFootprintSqft),
    parkingFootprintSqft: Math.round(parkingAreaSqft),
    landscapeBufferSqft: Math.round(landscapeBufferSqft),
    remainingAreaSqft: Math.round(remainingAreaSqft),
  };
}

/**
 * Calculate topography impacts
 */
function calculateTopography(
  acreage: number,
  avgSlopePct: number
): TopographyAnalysis {
  // Estimate slope bands based on average slope
  // This is a simplified model - real analysis would use DEM data
  let slopeBands: TopographyAnalysis['slopeBands'];
  let buildableAreaReductionPct: number;
  let retainingWallsRequired: boolean;
  let gradingMultiplier: number;

  if (avgSlopePct <= 2) {
    slopeBands = { flat_0_2: 85, gentle_2_5: 10, moderate_5_10: 4, steep_10_plus: 1 };
    buildableAreaReductionPct = 2;
    retainingWallsRequired = false;
    gradingMultiplier = SLOPE_GRADING_MULTIPLIERS.flat;
  } else if (avgSlopePct <= 5) {
    slopeBands = { flat_0_2: 40, gentle_2_5: 45, moderate_5_10: 12, steep_10_plus: 3 };
    buildableAreaReductionPct = 8;
    retainingWallsRequired = false;
    gradingMultiplier = SLOPE_GRADING_MULTIPLIERS.gentle;
  } else if (avgSlopePct <= 10) {
    slopeBands = { flat_0_2: 15, gentle_2_5: 25, moderate_5_10: 45, steep_10_plus: 15 };
    buildableAreaReductionPct = 20;
    retainingWallsRequired = true;
    gradingMultiplier = SLOPE_GRADING_MULTIPLIERS.moderate;
  } else {
    slopeBands = { flat_0_2: 5, gentle_2_5: 10, moderate_5_10: 30, steep_10_plus: 55 };
    buildableAreaReductionPct = 40;
    retainingWallsRequired = true;
    gradingMultiplier = SLOPE_GRADING_MULTIPLIERS.steep;
  }

  const effectiveBuildableAcres = acreage * (1 - buildableAreaReductionPct / 100);

  // Estimate grading cost
  // Assume average cut/fill of 2 feet depth across 40% of site
  const totalSiteSqft = acreage * 43560;
  const gradingAreaSqft = totalSiteSqft * 0.40;
  const avgDepthFt = 2 + (avgSlopePct * 0.3); // More slope = more cut/fill
  const cubicYards = (gradingAreaSqft * avgDepthFt) / 27;
  const gradingCostEstimate = Math.round(cubicYards * GRADING_COST_PER_CY * gradingMultiplier);

  return {
    avgSlopePct,
    slopeBands,
    buildableAreaReductionPct,
    effectiveBuildableAcres: Math.round(effectiveBuildableAcres * 100) / 100,
    gradingCostEstimate,
    retainingWallsRequired,
  };
}

/**
 * Calculate stormwater requirements
 */
function calculateStormwater(
  acreage: number,
  imperviousPct: number,
  state: string,
  soilType?: 'clay' | 'sand' | 'loam' | 'rock'
): StormwaterAnalysis {
  const totalSiteSqft = acreage * 43560;

  // Calculate weighted runoff coefficient
  const imperviousSqft = totalSiteSqft * (imperviousPct / 100);
  const perviousSqft = totalSiteSqft - imperviousSqft;
  const runoffCoefficient =
    (imperviousSqft * RUNOFF_COEFFICIENTS.impervious +
      perviousSqft * RUNOFF_COEFFICIENTS.landscaped) /
    totalSiteSqft;

  // Get state stringency
  const stateStringency = STATE_STORMWATER_STRINGENCY[state] || 60;

  // Detention requirements
  // Rule of thumb: 0.5-1.5% of site for detention in most jurisdictions
  const detentionRequired = stateStringency >= 60;
  const detentionPct = 0.005 + (stateStringency / 100) * 0.01; // 0.5% to 1.5%
  const detentionBasinAcres = Math.round(acreage * detentionPct * 1000) / 1000;

  // Retention (underground or on-site) for high-stringency states
  const retentionRequired = stateStringency >= 85;

  // Infiltration viability based on soil type
  let infiltrationViability: StormwaterAnalysis['infiltrationViability'] = 'medium';
  if (soilType) {
    switch (soilType) {
      case 'sand':
        infiltrationViability = 'high';
        break;
      case 'loam':
        infiltrationViability = 'medium';
        break;
      case 'clay':
      case 'rock':
        infiltrationViability = 'low';
        break;
    }
  }

  // BMP requirements for stringent states
  const bmpRequired = stateStringency >= 75;

  // Cost estimate
  // Detention pond: $15,000-25,000 per acre
  // Underground: $30,000-50,000 per acre
  const detentionCost = detentionBasinAcres * 20000;
  const undergroundCost = retentionRequired ? acreage * 0.01 * 40000 : 0;
  const bmpCost = bmpRequired ? acreage * 5000 : 0;
  const estimatedCost = Math.round(detentionCost + undergroundCost + bmpCost);

  // Determine regulatory authority
  let regulatoryAuthority: string | undefined;
  if (state === 'CA') regulatoryAuthority = 'Regional Water Quality Control Board';
  else if (state === 'FL') regulatoryAuthority = 'Water Management District';
  else if (state === 'MD') regulatoryAuthority = 'MDE Stormwater';
  else if (state === 'NY') regulatoryAuthority = 'DEC SPDES';

  return {
    runoffCoefficient: Math.round(runoffCoefficient * 100) / 100,
    detentionRequired,
    detentionBasinAcres,
    retentionRequired,
    infiltrationViability,
    bmpRequired,
    estimatedCost,
    regulatoryAuthority,
    notes: `State stringency: ${stateStringency}/100. ${bmpRequired ? 'BMP required. ' : ''}${retentionRequired ? 'Underground retention may be required.' : ''}`,
  };
}

/**
 * Calculate construction bonding requirements
 */
function calculateBonding(
  state: string,
  totalDevelopmentCost: number
): ConstructionBonding {
  const stateReq = STATE_BONDING_REQUIREMENTS[state] || { required: false, pctOfCost: 0.10 };

  const estimatedAmount = stateReq.required
    ? Math.round(totalDevelopmentCost * stateReq.pctOfCost)
    : 0;

  // Determine bond type
  let bondType: ConstructionBonding['bondType'] = 'none';
  if (stateReq.required) {
    bondType = 'performance'; // Most common for commercial development
  }

  return {
    bondRequired: stateReq.required,
    bondType,
    estimatedAmount,
    releaseConditions: stateReq.required
      ? 'Released upon completion of site improvements and final inspection'
      : undefined,
    letterOfCreditAccepted: true, // Most jurisdictions accept LOC
  };
}

/**
 * Calculate overall civil score and rating
 */
function calculateCivilScore(
  parking: ParkingRequirements,
  lotCoverage: LotCoverageAnalysis,
  topography: TopographyAnalysis,
  stormwater: StormwaterAnalysis,
  bonding: ConstructionBonding
): { score: number; rating: CivilConstraintResult['civilRating'] } {
  let score = 100;

  // Parking deductions
  if (!parking.meetsAdaRequirements) score -= 15;

  // Lot coverage deductions
  if (!lotCoverage.isFeasible) score -= 30;
  else if (lotCoverage.requiredCoveragePct > lotCoverage.allowedCoveragePct * 0.9) {
    score -= 10; // Tight margin
  }

  // Topography deductions
  if (topography.buildableAreaReductionPct > 30) score -= 25;
  else if (topography.buildableAreaReductionPct > 15) score -= 15;
  else if (topography.buildableAreaReductionPct > 5) score -= 5;

  if (topography.retainingWallsRequired) score -= 10;

  // Stormwater deductions
  if (stormwater.retentionRequired) score -= 10;
  if (stormwater.bmpRequired) score -= 5;
  if (stormwater.infiltrationViability === 'low') score -= 10;
  else if (stormwater.infiltrationViability === 'medium') score -= 3;

  // Bonding deductions
  if (bonding.bondRequired && bonding.estimatedAmount > 100000) score -= 5;

  // Determine rating
  score = Math.max(0, score);
  let rating: CivilConstraintResult['civilRating'];
  if (score >= 80) rating = 'favorable';
  else if (score >= 60) rating = 'moderate';
  else if (score >= 40) rating = 'challenging';
  else rating = 'prohibitive';

  return { score, rating };
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Run civil constraints analysis
 *
 * @param input - CivilConstraintInput with site and zoning data
 * @returns CivilConstraintResult with all civil engineering constraints
 */
export async function runCivilConstraints(input: CivilConstraintInput): Promise<CivilConstraintResult> {
  const { opportunity, acreage, zoning, state, county, avgSlopePct = 3, soilType } = input;

  console.log(`[CIVIL_CONSTRAINTS] Analyzing civil constraints for ${county}, ${state} (${acreage} acres)`);

  try {
    // Calculate net rentable sqft (40% of acreage for building)
    const totalSiteSqft = acreage * 43560;
    const buildableSqft = totalSiteSqft * 0.40;
    const netRentableSqft = buildableSqft * 0.85;

    // Estimated development cost for bonding calculation
    const estimatedDevCost = acreage * 500000; // ~$500k per acre rough estimate

    // Calculate all components
    const parking = calculateParkingRequirements(netRentableSqft, avgSlopePct);
    const topography = calculateTopography(acreage, avgSlopePct);
    const lotCoverage = calculateLotCoverage(
      topography.effectiveBuildableAcres, // Use effective acreage after topo reduction
      zoning.lotCoverageMax_pct || 70,
      netRentableSqft,
      parking.totalParkingArea
    );
    const stormwater = calculateStormwater(
      acreage,
      lotCoverage.requiredCoveragePct,
      state,
      soilType
    );
    const bonding = calculateBonding(state, estimatedDevCost);

    // Calculate score and rating
    const { score, rating } = calculateCivilScore(parking, lotCoverage, topography, stormwater, bonding);

    // Calculate total civil cost adder
    const totalCivilCostAdder =
      topography.gradingCostEstimate +
      stormwater.estimatedCost +
      (topography.retainingWallsRequired ? acreage * 25000 : 0) +
      bonding.estimatedAmount;

    await writeLog('civil_constraints_complete', {
      county,
      state,
      acreage,
      civil_score: score,
      civil_rating: rating,
      lot_coverage_feasible: lotCoverage.isFeasible,
      detention_acres: stormwater.detentionBasinAcres,
      total_cost_adder: totalCivilCostAdder,
    });

    const result: CivilConstraintResult = {
      status: 'ok',
      parking,
      lotCoverage,
      topography,
      stormwater,
      bonding,
      civilScore: score,
      civilRating: rating,
      totalCivilCostAdder,
      developableAcres: topography.effectiveBuildableAcres,
      notes: `Civil analysis for ${acreage} acres in ${county}, ${state}. Score: ${score}, Rating: ${rating}. ` +
        `Lot coverage ${lotCoverage.isFeasible ? 'feasible' : 'NOT FEASIBLE'}. ` +
        `Detention: ${stormwater.detentionBasinAcres} acres. ` +
        `Total civil cost adder: $${totalCivilCostAdder.toLocaleString()}.`,
    };

    console.log(`[CIVIL_CONSTRAINTS] Result: Score=${score}, Rating=${rating}, CostAdder=$${totalCivilCostAdder.toLocaleString()}`);
    return result;
  } catch (error) {
    console.error('[CIVIL_CONSTRAINTS] Error:', error);
    return createErrorResult(
      error instanceof Error ? error : 'Unknown civil constraints error',
      createStubCivilConstraints
    );
  }
}

/**
 * Run civil constraints shell (wrapper for orchestrator)
 */
export async function runCivilConstraintsShell(
  opportunity: OpportunityObject,
  acreage: number,
  zoning: ZoningResult
): Promise<CivilConstraintResult> {
  return runCivilConstraints({
    opportunity,
    acreage,
    zoning,
    state: opportunity.identity.state,
    county: opportunity.identity.county,
    avgSlopePct: 3, // Default - would come from terrain data
    soilType: 'loam', // Default - would come from soil survey
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick check if site is feasible from civil perspective
 */
export function isCivillyFeasible(civil: CivilConstraintResult): boolean {
  return (
    civil.status === 'ok' &&
    civil.lotCoverage.isFeasible &&
    civil.civilRating !== 'prohibitive'
  );
}

/**
 * Get civil cost adjustments for feasibility calculations
 */
export function getCivilCostAdjustments(civil: CivilConstraintResult): {
  gradingCost: number;
  stormwaterCost: number;
  bondingCost: number;
  totalAdder: number;
  effectiveAcres: number;
} {
  return {
    gradingCost: civil.topography.gradingCostEstimate,
    stormwaterCost: civil.stormwater.estimatedCost,
    bondingCost: civil.bonding.estimatedAmount,
    totalAdder: civil.totalCivilCostAdder,
    effectiveAcres: civil.developableAcres,
  };
}

/**
 * Get civil risk factors for verdict
 */
export function getCivilRiskFactors(civil: CivilConstraintResult): string[] {
  const risks: string[] = [];

  if (!civil.lotCoverage.isFeasible) {
    risks.push(`Lot coverage exceeds limit (${civil.lotCoverage.requiredCoveragePct}% vs ${civil.lotCoverage.allowedCoveragePct}% allowed)`);
  }

  if (civil.topography.buildableAreaReductionPct > 20) {
    risks.push(`Significant topography constraints (${civil.topography.buildableAreaReductionPct}% buildable area reduction)`);
  }

  if (civil.topography.retainingWallsRequired) {
    risks.push('Retaining walls required');
  }

  if (civil.stormwater.retentionRequired) {
    risks.push('Underground stormwater retention required');
  }

  if (!civil.parking.meetsAdaRequirements) {
    risks.push('ADA slope requirements may require additional grading');
  }

  if (civil.totalCivilCostAdder > 100000) {
    risks.push(`Significant civil costs: $${civil.totalCivilCostAdder.toLocaleString()}`);
  }

  return risks;
}

// Re-export types
export type { CivilConstraintResult, CivilConstraintInput };
