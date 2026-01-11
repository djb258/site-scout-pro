/**
 * SiteScorer Spoke (SS.04.03)
 *
 * Scores filtered parcels to prioritize candidates.
 * Note: This performs scoring, not feasibility math (that's SubHub3).
 *
 * @module SubHub4_ParcelDiscovery/spokes/SiteScorer
 */

import {
  SiteScorerResult,
  FilteredParcel,
  SiteScoreBreakdown,
  createStubSiteScorer,
  createErrorResult,
} from '../types/pass4_types';

// ============================================================================
// INPUT TYPE
// ============================================================================

export interface SiteScorerInput {
  /** Filtered parcels to score */
  parcels: FilteredParcel[];
  /** Scoring weights (optional) */
  weights?: {
    location: number;
    size: number;
    access: number;
    zoning: number;
    value: number;
  };
  /** Target acreage (for size scoring) */
  targetAcreage?: number;
}

// ============================================================================
// DEFAULT WEIGHTS
// ============================================================================

const DEFAULT_WEIGHTS = {
  location: 0.25,
  size: 0.25,
  access: 0.20,
  zoning: 0.15,
  value: 0.15,
};

// ============================================================================
// SPOKE IMPLEMENTATION
// ============================================================================

/**
 * Score parcels for prioritization
 */
export async function runSiteScorer(input: SiteScorerInput): Promise<SiteScorerResult> {
  try {
    console.log(`[SITE_SCORER] Scoring ${input.parcels.length} parcels...`);

    const weights = input.weights ?? DEFAULT_WEIGHTS;
    const targetAcreage = input.targetAcreage ?? 2.0; // Default target for storage

    const scores = input.parcels
      .filter((p) => p.filterStatus !== 'failed')
      .map((parcel) => {
        const breakdown = scoreParcel(parcel, weights, targetAcreage);
        const totalScore = calculateTotalScore(breakdown, weights);

        return {
          apn: parcel.apn,
          totalScore,
          breakdown,
          rank: 0, // Will be set after sorting
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((score, index) => ({
        ...score,
        rank: index + 1,
      }));

    const topParcels = scores.slice(0, 10).map((s) => s.apn);

    return {
      status: 'ok',
      totalScored: scores.length,
      scores,
      topParcels,
      notes: `Scored ${scores.length} parcels. Top scorer: ${topParcels[0] || 'none'}.`,
    };
  } catch (error) {
    console.error('[SITE_SCORER] Error:', error);
    return createErrorResult(error as Error, createStubSiteScorer);
  }
}

// ============================================================================
// SCORING LOGIC
// ============================================================================

function scoreParcel(
  parcel: FilteredParcel,
  _weights: typeof DEFAULT_WEIGHTS,
  targetAcreage: number
): SiteScoreBreakdown {
  return {
    locationScore: scoreLocation(parcel),
    sizeScore: scoreSize(parcel, targetAcreage),
    accessScore: scoreAccess(parcel),
    zoningScore: scoreZoning(parcel),
    valueScore: scoreValue(parcel),
  };
}

function scoreLocation(parcel: FilteredParcel): number {
  // Location scoring based on available data
  let score = 50; // Base score

  // Boost for having coordinates
  if (parcel.lat && parcel.lng) {
    score += 20;
  }

  // Boost for having address
  if (parcel.address) {
    score += 15;
  }

  // Boost for being in a city
  if (parcel.city) {
    score += 15;
  }

  return Math.min(100, score);
}

function scoreSize(parcel: FilteredParcel, targetAcreage: number): number {
  if (!parcel.acreage) return 50;

  // Score based on proximity to target acreage
  const ratio = parcel.acreage / targetAcreage;

  if (ratio >= 0.8 && ratio <= 1.5) {
    return 100; // Ideal range
  } else if (ratio >= 0.5 && ratio <= 2.0) {
    return 80; // Acceptable range
  } else if (ratio >= 0.25 && ratio <= 3.0) {
    return 60; // Marginal range
  } else {
    return 30; // Poor fit
  }
}

function scoreAccess(parcel: FilteredParcel): number {
  // Access scoring (placeholder - would use road data in production)
  let score = 50;

  // Boost for having an address (implies road access)
  if (parcel.address) {
    score += 30;
  }

  // Boost for city location (better infrastructure)
  if (parcel.city) {
    score += 20;
  }

  return Math.min(100, score);
}

function scoreZoning(parcel: FilteredParcel): number {
  if (!parcel.zoningCode) return 50;

  // Favorable zoning for storage
  const favorableZoning = ['I-1', 'I-2', 'M-1', 'M-2', 'C-2', 'C-3', 'IND', 'COM'];
  const neutralZoning = ['PUD', 'MU', 'MIXED'];
  const unfavorableZoning = ['R-1', 'R-2', 'RES', 'AG', 'OS'];

  const code = parcel.zoningCode.toUpperCase();

  if (favorableZoning.some((z) => code.includes(z))) {
    return 100;
  } else if (neutralZoning.some((z) => code.includes(z))) {
    return 70;
  } else if (unfavorableZoning.some((z) => code.includes(z))) {
    return 30;
  }

  return 50;
}

function scoreValue(parcel: FilteredParcel): number {
  if (!parcel.lastSalePrice && !parcel.assessedLandValue) return 50;

  const value = parcel.lastSalePrice || parcel.assessedLandValue || 0;
  const acreage = parcel.acreage || 1;
  const pricePerAcre = value / acreage;

  // Score inversely to price (lower price = higher score)
  // Assuming typical range of $50k - $500k per acre
  if (pricePerAcre < 100000) {
    return 100;
  } else if (pricePerAcre < 200000) {
    return 80;
  } else if (pricePerAcre < 350000) {
    return 60;
  } else if (pricePerAcre < 500000) {
    return 40;
  } else {
    return 20;
  }
}

function calculateTotalScore(
  breakdown: SiteScoreBreakdown,
  weights: typeof DEFAULT_WEIGHTS
): number {
  return Math.round(
    breakdown.locationScore * weights.location +
      breakdown.sizeScore * weights.size +
      breakdown.accessScore * weights.access +
      breakdown.zoningScore * weights.zoning +
      breakdown.valueScore * weights.value
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default runSiteScorer;
