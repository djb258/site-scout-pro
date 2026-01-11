/**
 * PASS-4 TYPE DEFINITIONS
 *
 * Type definitions for SubHub4_ParcelDiscovery (SS.04.00)
 * Parcel scanning within ZIP boundaries and promotion gating.
 *
 * Anchor: ZIP (search) -> Parcel ID (promotion)
 * Constraint: ZIP_BOUNDED_SEARCH
 *
 * All types are JSON-serializable for edge/cloud function execution.
 */

// ============================================================================
// STATUS ENUM
// ============================================================================

export type SpokeStatus = 'stub' | 'ok' | 'error';

// ============================================================================
// PARCEL TYPES
// ============================================================================

/**
 * Raw parcel data from search
 */
export interface RawParcel {
  /** Assessor's Parcel Number */
  apn: string;
  /** County FIPS code */
  countyFips: string;
  /** Full address */
  address?: string;
  /** City */
  city?: string;
  /** ZIP code (must match search anchor) */
  zipCode: string;
  /** State abbreviation */
  state: string;
  /** Latitude */
  lat?: number;
  /** Longitude */
  lng?: number;
  /** Parcel acreage */
  acreage?: number;
  /** Land use code */
  landUseCode?: string;
  /** Land use description */
  landUseDesc?: string;
  /** Zoning code */
  zoningCode?: string;
  /** Current owner */
  owner?: string;
  /** Last sale date */
  lastSaleDate?: string;
  /** Last sale price */
  lastSalePrice?: number;
  /** Assessed land value */
  assessedLandValue?: number;
  /** Assessed improvement value */
  assessedImprovementValue?: number;
}

/**
 * Filtered parcel after initial screening
 */
export interface FilteredParcel extends RawParcel {
  /** Filter pass status */
  filterStatus: 'passed' | 'failed' | 'review';
  /** Reasons for filter decision */
  filterReasons: string[];
  /** Filter score (0-100) */
  filterScore: number;
}

/**
 * Promoted parcel (ready for SubHub5)
 */
export interface PromotedParcel {
  /** Unique Parcel ID: {FIPS}-{APN} */
  parcelId: string;
  /** Source data */
  source: FilteredParcel;
  /** Promotion timestamp */
  promotedAt: string;
  /** Promotion gate results */
  promotionGates: PromotionGateResult;
  /** Data quality score */
  dataQualityScore: number;
}

// ============================================================================
// PARCEL SCANNER RESULT (SS.04.01)
// ============================================================================

export interface ParcelScannerResult {
  status: SpokeStatus;
  /** Search anchor ZIP */
  searchZip?: string;
  /** Total parcels found */
  totalFound?: number;
  /** Parcels retrieved */
  parcelsRetrieved?: number;
  /** Raw parcel data */
  parcels?: RawParcel[];
  /** Data sources used */
  dataSources?: string[];
  /** Scan timestamp */
  scannedAt?: string;
  notes: string;
}

// ============================================================================
// PARCEL FILTER RESULT (SS.04.02)
// ============================================================================

export interface FilterCriteria {
  minAcreage?: number;
  maxAcreage?: number;
  allowedLandUseCodes?: string[];
  excludedLandUseCodes?: string[];
  allowedZoningCodes?: string[];
  excludedZoningCodes?: string[];
  maxLastSalePrice?: number;
  requireVacant?: boolean;
}

export interface ParcelFilterResult {
  status: SpokeStatus;
  /** Total parcels evaluated */
  totalEvaluated?: number;
  /** Parcels passed filter */
  passedCount?: number;
  /** Parcels failed filter */
  failedCount?: number;
  /** Parcels marked for review */
  reviewCount?: number;
  /** Filtered parcels */
  filteredParcels?: FilteredParcel[];
  /** Filter criteria used */
  criteriaUsed?: FilterCriteria;
  notes: string;
}

// ============================================================================
// SITE SCORER RESULT (SS.04.03)
// ============================================================================

export interface SiteScoreBreakdown {
  locationScore: number;
  sizeScore: number;
  accessScore: number;
  zoningScore: number;
  valueScore: number;
}

export interface SiteScorerResult {
  status: SpokeStatus;
  /** Total parcels scored */
  totalScored?: number;
  /** Score breakdown by parcel */
  scores?: Array<{
    apn: string;
    totalScore: number;
    breakdown: SiteScoreBreakdown;
    rank: number;
  }>;
  /** Top parcels by score */
  topParcels?: string[];
  notes: string;
}

// ============================================================================
// PROMOTION GATE RESULT (SS.04.04)
// ============================================================================

export interface PromotionGateResult {
  /** Did parcel pass all gates? */
  promoted: boolean;
  /** Gate results */
  gates: {
    dataComplete: boolean;
    validZip: boolean;
    validFips: boolean;
    meetsMinSize: boolean;
    meetsMaxSize: boolean;
    zoningCompatible: boolean;
    notExcluded: boolean;
  };
  /** Failed gates */
  failedGates: string[];
  /** Gate evaluation timestamp */
  evaluatedAt: string;
}

export interface PromotionGateBatchResult {
  status: SpokeStatus;
  /** Total parcels evaluated */
  totalEvaluated?: number;
  /** Parcels promoted */
  promotedCount?: number;
  /** Parcels rejected */
  rejectedCount?: number;
  /** Promoted parcels */
  promotedParcels?: PromotedParcel[];
  /** Rejection reasons summary */
  rejectionSummary?: Record<string, number>;
  notes: string;
}

// ============================================================================
// PASS-4 INPUT
// ============================================================================

export interface Pass4Input {
  /** Search anchor ZIP code */
  zipCode: string;
  /** State abbreviation */
  state: string;
  /** SVA reference */
  svaId: string;
  /** Optional filter criteria */
  filterCriteria?: FilterCriteria;
  /** Maximum parcels to return */
  maxResults?: number;
}

// ============================================================================
// PASS-4 OUTPUT (Complete Result Object)
// ============================================================================

export interface Pass4Output {
  success: boolean;
  runId?: string;
  timestamp: number;
  /** Search anchor */
  zipCode: string;
  state: string;
  /** SVA reference */
  svaId: string;
  /** Spoke results */
  parcelScanner: ParcelScannerResult;
  parcelFilter: ParcelFilterResult;
  siteScorer: SiteScorerResult;
  promotionGate: PromotionGateBatchResult;
  /** Summary */
  summary: {
    totalScanned: number;
    totalFiltered: number;
    totalPromoted: number;
    promotionRate: number;
  };
  error?: string;
}

// ============================================================================
// FACTORY FUNCTIONS FOR STUB RESULTS
// ============================================================================

export function createStubParcelScanner(): ParcelScannerResult {
  return {
    status: 'stub',
    notes: 'Parcel scanner not implemented. TODO: Integrate parcel data source.',
  };
}

export function createStubParcelFilter(): ParcelFilterResult {
  return {
    status: 'stub',
    notes: 'Parcel filter not implemented. TODO: Apply filter criteria.',
  };
}

export function createStubSiteScorer(): SiteScorerResult {
  return {
    status: 'stub',
    notes: 'Site scorer not implemented. TODO: Score parcels.',
  };
}

export function createStubPromotionGate(): PromotionGateBatchResult {
  return {
    status: 'stub',
    notes: 'Promotion gate not implemented. TODO: Evaluate promotion gates.',
  };
}

export function createErrorResult<T extends { status: SpokeStatus; notes: string }>(
  error: Error | string,
  factory: () => T
): T {
  const result = factory();
  result.status = 'error';
  result.notes = `Error: ${error instanceof Error ? error.message : error}`;
  return result;
}
