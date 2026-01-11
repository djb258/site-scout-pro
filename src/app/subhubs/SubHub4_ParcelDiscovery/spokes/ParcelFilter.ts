/**
 * ParcelFilter Spoke (SS.04.02)
 *
 * Filters parcels against criteria to identify viable candidates.
 * Does not perform calculations - just filtering.
 *
 * @module SubHub4_ParcelDiscovery/spokes/ParcelFilter
 */

import {
  ParcelFilterResult,
  RawParcel,
  FilteredParcel,
  FilterCriteria,
  createStubParcelFilter,
  createErrorResult,
} from '../types/pass4_types';

// ============================================================================
// INPUT TYPE
// ============================================================================

export interface ParcelFilterInput {
  /** Parcels to filter */
  parcels: RawParcel[];
  /** Filter criteria */
  criteria: FilterCriteria;
  /** ZIP anchor (for validation) */
  zipCode: string;
}

// ============================================================================
// SPOKE IMPLEMENTATION
// ============================================================================

/**
 * Filter parcels against criteria
 */
export async function runParcelFilter(input: ParcelFilterInput): Promise<ParcelFilterResult> {
  try {
    console.log(`[PARCEL_FILTER] Filtering ${input.parcels.length} parcels...`);

    const filteredParcels: FilteredParcel[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let reviewCount = 0;

    for (const parcel of input.parcels) {
      const result = evaluateParcel(parcel, input.criteria, input.zipCode);
      filteredParcels.push(result);

      if (result.filterStatus === 'passed') passedCount++;
      else if (result.filterStatus === 'failed') failedCount++;
      else reviewCount++;
    }

    return {
      status: 'ok',
      totalEvaluated: input.parcels.length,
      passedCount,
      failedCount,
      reviewCount,
      filteredParcels,
      criteriaUsed: input.criteria,
      notes: `Filtered ${input.parcels.length} parcels: ${passedCount} passed, ${failedCount} failed, ${reviewCount} review.`,
    };
  } catch (error) {
    console.error('[PARCEL_FILTER] Error:', error);
    return createErrorResult(error as Error, createStubParcelFilter);
  }
}

// ============================================================================
// FILTER LOGIC
// ============================================================================

function evaluateParcel(
  parcel: RawParcel,
  criteria: FilterCriteria,
  zipAnchor: string
): FilteredParcel {
  const reasons: string[] = [];
  let score = 100;

  // ZIP validation (must match anchor)
  if (parcel.zipCode !== zipAnchor) {
    reasons.push(`ZIP mismatch: expected ${zipAnchor}, got ${parcel.zipCode}`);
    score -= 100; // Automatic fail
  }

  // Acreage filter
  if (criteria.minAcreage !== undefined && parcel.acreage !== undefined) {
    if (parcel.acreage < criteria.minAcreage) {
      reasons.push(`Below min acreage: ${parcel.acreage} < ${criteria.minAcreage}`);
      score -= 25;
    }
  }

  if (criteria.maxAcreage !== undefined && parcel.acreage !== undefined) {
    if (parcel.acreage > criteria.maxAcreage) {
      reasons.push(`Above max acreage: ${parcel.acreage} > ${criteria.maxAcreage}`);
      score -= 25;
    }
  }

  // Land use filter
  if (criteria.allowedLandUseCodes && criteria.allowedLandUseCodes.length > 0) {
    if (parcel.landUseCode && !criteria.allowedLandUseCodes.includes(parcel.landUseCode)) {
      reasons.push(`Land use not allowed: ${parcel.landUseCode}`);
      score -= 30;
    }
  }

  if (criteria.excludedLandUseCodes && criteria.excludedLandUseCodes.length > 0) {
    if (parcel.landUseCode && criteria.excludedLandUseCodes.includes(parcel.landUseCode)) {
      reasons.push(`Land use excluded: ${parcel.landUseCode}`);
      score -= 50;
    }
  }

  // Zoning filter
  if (criteria.allowedZoningCodes && criteria.allowedZoningCodes.length > 0) {
    if (parcel.zoningCode && !criteria.allowedZoningCodes.includes(parcel.zoningCode)) {
      reasons.push(`Zoning not allowed: ${parcel.zoningCode}`);
      score -= 30;
    }
  }

  if (criteria.excludedZoningCodes && criteria.excludedZoningCodes.length > 0) {
    if (parcel.zoningCode && criteria.excludedZoningCodes.includes(parcel.zoningCode)) {
      reasons.push(`Zoning excluded: ${parcel.zoningCode}`);
      score -= 50;
    }
  }

  // Price filter
  if (criteria.maxLastSalePrice !== undefined && parcel.lastSalePrice !== undefined) {
    if (parcel.lastSalePrice > criteria.maxLastSalePrice) {
      reasons.push(`Price too high: ${parcel.lastSalePrice} > ${criteria.maxLastSalePrice}`);
      score -= 20;
    }
  }

  // Vacant filter
  if (criteria.requireVacant) {
    const vacantCodes = ['VAC', 'VACANT', 'VL', 'V'];
    if (parcel.landUseCode && !vacantCodes.includes(parcel.landUseCode.toUpperCase())) {
      reasons.push(`Not vacant: ${parcel.landUseCode}`);
      score -= 20;
    }
  }

  // Determine status
  const filterScore = Math.max(0, score);
  let filterStatus: 'passed' | 'failed' | 'review';

  if (filterScore >= 70) {
    filterStatus = 'passed';
  } else if (filterScore >= 40) {
    filterStatus = 'review';
  } else {
    filterStatus = 'failed';
  }

  return {
    ...parcel,
    filterStatus,
    filterReasons: reasons.length > 0 ? reasons : ['All criteria passed'],
    filterScore,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default runParcelFilter;
