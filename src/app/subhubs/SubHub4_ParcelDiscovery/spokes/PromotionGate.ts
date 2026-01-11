/**
 * PromotionGate Spoke (SS.04.04)
 *
 * Evaluates parcels for promotion to SubHub5_DealGate.
 * Only promoted parcels receive Parcel ID anchors.
 *
 * @module SubHub4_ParcelDiscovery/spokes/PromotionGate
 */

import {
  PromotionGateBatchResult,
  PromotionGateResult,
  FilteredParcel,
  PromotedParcel,
  SiteScorerResult,
  createStubPromotionGate,
  createErrorResult,
} from '../types/pass4_types';

// ============================================================================
// INPUT TYPE
// ============================================================================

export interface PromotionGateInput {
  /** Filtered parcels to evaluate */
  parcels: FilteredParcel[];
  /** Site scores */
  scores: SiteScorerResult;
  /** SVA reference */
  svaId: string;
  /** Minimum score for promotion */
  minScore?: number;
  /** Maximum parcels to promote */
  maxPromotions?: number;
  /** Required data fields */
  requiredFields?: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_MIN_SCORE = 60;
const DEFAULT_MAX_PROMOTIONS = 20;
const DEFAULT_REQUIRED_FIELDS = ['apn', 'countyFips', 'zipCode', 'acreage'];

// ============================================================================
// SPOKE IMPLEMENTATION
// ============================================================================

/**
 * Evaluate parcels for promotion
 */
export async function runPromotionGate(input: PromotionGateInput): Promise<PromotionGateBatchResult> {
  try {
    console.log(`[PROMOTION_GATE] Evaluating ${input.parcels.length} parcels for promotion...`);

    const minScore = input.minScore ?? DEFAULT_MIN_SCORE;
    const maxPromotions = input.maxPromotions ?? DEFAULT_MAX_PROMOTIONS;
    const requiredFields = input.requiredFields ?? DEFAULT_REQUIRED_FIELDS;

    const promotedParcels: PromotedParcel[] = [];
    const rejectionSummary: Record<string, number> = {};

    // Get score lookup
    const scoreMap = new Map<string, number>();
    if (input.scores.scores) {
      for (const score of input.scores.scores) {
        scoreMap.set(score.apn, score.totalScore);
      }
    }

    // Sort parcels by score (highest first)
    const sortedParcels = [...input.parcels]
      .filter((p) => p.filterStatus !== 'failed')
      .sort((a, b) => {
        const scoreA = scoreMap.get(a.apn) ?? 0;
        const scoreB = scoreMap.get(b.apn) ?? 0;
        return scoreB - scoreA;
      });

    for (const parcel of sortedParcels) {
      // Stop if we've hit max promotions
      if (promotedParcels.length >= maxPromotions) {
        break;
      }

      const gateResult = evaluateGates(parcel, scoreMap.get(parcel.apn) ?? 0, minScore, requiredFields);

      if (gateResult.promoted) {
        const parcelId = generateParcelId(parcel);
        promotedParcels.push({
          parcelId,
          source: parcel,
          promotedAt: new Date().toISOString(),
          promotionGates: gateResult,
          dataQualityScore: calculateDataQuality(parcel, requiredFields),
        });
      } else {
        // Track rejection reasons
        for (const gate of gateResult.failedGates) {
          rejectionSummary[gate] = (rejectionSummary[gate] || 0) + 1;
        }
      }
    }

    return {
      status: 'ok',
      totalEvaluated: input.parcels.length,
      promotedCount: promotedParcels.length,
      rejectedCount: input.parcels.length - promotedParcels.length,
      promotedParcels,
      rejectionSummary,
      notes: `Promoted ${promotedParcels.length} of ${input.parcels.length} parcels.`,
    };
  } catch (error) {
    console.error('[PROMOTION_GATE] Error:', error);
    return createErrorResult(error as Error, createStubPromotionGate);
  }
}

// ============================================================================
// GATE EVALUATION
// ============================================================================

function evaluateGates(
  parcel: FilteredParcel,
  score: number,
  minScore: number,
  requiredFields: string[]
): PromotionGateResult {
  const failedGates: string[] = [];

  // Gate: Data complete
  const dataComplete = requiredFields.every((field) => {
    const value = (parcel as Record<string, unknown>)[field];
    return value !== undefined && value !== null && value !== '';
  });
  if (!dataComplete) failedGates.push('dataComplete');

  // Gate: Valid ZIP
  const validZip = /^\d{5}$/.test(parcel.zipCode);
  if (!validZip) failedGates.push('validZip');

  // Gate: Valid FIPS
  const validFips = /^\d{5}$/.test(parcel.countyFips);
  if (!validFips) failedGates.push('validFips');

  // Gate: Minimum size (0.25 acres for storage)
  const meetsMinSize = (parcel.acreage ?? 0) >= 0.25;
  if (!meetsMinSize) failedGates.push('meetsMinSize');

  // Gate: Maximum size (reasonable upper bound)
  const meetsMaxSize = (parcel.acreage ?? 0) <= 100;
  if (!meetsMaxSize) failedGates.push('meetsMaxSize');

  // Gate: Zoning compatible (not explicitly residential or protected)
  const excludedZoning = ['R-1', 'R-2', 'SF', 'OS', 'PARK', 'WETLAND'];
  const zoningCompatible =
    !parcel.zoningCode ||
    !excludedZoning.some((z) => parcel.zoningCode?.toUpperCase().includes(z));
  if (!zoningCompatible) failedGates.push('zoningCompatible');

  // Gate: Not explicitly excluded (filter score check)
  const notExcluded = score >= minScore && parcel.filterStatus !== 'failed';
  if (!notExcluded) failedGates.push('notExcluded');

  return {
    promoted: failedGates.length === 0,
    gates: {
      dataComplete,
      validZip,
      validFips,
      meetsMinSize,
      meetsMaxSize,
      zoningCompatible,
      notExcluded,
    },
    failedGates,
    evaluatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate Parcel ID: {FIPS}-{APN}
 */
function generateParcelId(parcel: FilteredParcel): string {
  const fips = parcel.countyFips.replace(/[^0-9]/g, '');
  const apn = parcel.apn.replace(/[^a-zA-Z0-9]/g, '');
  return `${fips}-${apn}`;
}

/**
 * Calculate data quality score
 */
function calculateDataQuality(parcel: FilteredParcel, requiredFields: string[]): number {
  const allFields = [
    'apn',
    'countyFips',
    'address',
    'city',
    'zipCode',
    'state',
    'lat',
    'lng',
    'acreage',
    'landUseCode',
    'landUseDesc',
    'zoningCode',
    'owner',
    'lastSaleDate',
    'lastSalePrice',
    'assessedLandValue',
    'assessedImprovementValue',
  ];

  let presentCount = 0;
  let requiredPresent = 0;

  for (const field of allFields) {
    const value = (parcel as Record<string, unknown>)[field];
    if (value !== undefined && value !== null && value !== '') {
      presentCount++;
      if (requiredFields.includes(field)) {
        requiredPresent++;
      }
    }
  }

  // Weight required fields more heavily
  const requiredScore = (requiredPresent / requiredFields.length) * 60;
  const optionalScore = (presentCount / allFields.length) * 40;

  return Math.round(requiredScore + optionalScore);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default runPromotionGate;
