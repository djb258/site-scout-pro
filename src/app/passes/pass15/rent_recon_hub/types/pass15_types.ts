/**
 * PASS-1.5 TYPE DEFINITIONS
 *
 * Type definitions for Pass-1.5 Rent Recon Hub (SS.015.00)
 * Rate collection, verification, and normalization.
 *
 * All types are JSON-serializable for edge/cloud function execution.
 */

// ============================================================================
// STATUS ENUM
// ============================================================================

export type SpokeStatus = 'stub' | 'ok' | 'error';

// ============================================================================
// RATE OBSERVATION
// ============================================================================

export interface RateObservation {
  competitorName: string;
  competitorId?: string;
  unitSize: string;                     // e.g., '10x10', '10x20'
  unitSqft: number;
  monthlyRate: number;
  ratePerSqft: number;
  isClimateControlled: boolean;
  isFirstFloor?: boolean;
  hasPromotion?: boolean;
  promotionDetails?: string;
  source: 'website' | 'aggregator' | 'ai_call' | 'manual';
  sourceUrl?: string;
  collectedAt: string;                  // ISO timestamp
  confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// PUBLISHED RATE SCRAPER RESULT (SS.015.01)
// ============================================================================

export interface PublishedRateScraperResult {
  status: SpokeStatus;
  observations?: RateObservation[];
  competitorsScraped?: number;
  successfulScrapes?: number;
  failedScrapes?: number;
  uniqueUnitSizes?: string[];
  avgRatePerSqft?: number;
  dataFreshness?: 'current' | 'stale';  // < 7 days = current
  notes: string;
}

// ============================================================================
// AI CALL WORK ORDERS RESULT (SS.015.02)
// ============================================================================

export interface AICallWorkOrder {
  competitorName: string;
  phoneNumber: string;
  callStatus: 'pending' | 'completed' | 'failed' | 'no_answer';
  callDuration?: number;                // seconds
  ratesCollected?: RateObservation[];
  transcript?: string;
  callId?: string;
  attemptCount: number;
  lastAttempt?: string;                 // ISO timestamp
}

export interface AICallWorkOrdersResult {
  status: SpokeStatus;
  workOrders?: AICallWorkOrder[];
  totalCalls?: number;
  completedCalls?: number;
  failedCalls?: number;
  ratesCollected?: number;
  avgCallDuration?: number;
  notes: string;
}

// ============================================================================
// RATE EVIDENCE NORMALIZER RESULT (SS.015.03)
// ============================================================================

export interface NormalizedRateBySize {
  unitSize: string;
  sampleCount: number;
  minRate: number;
  maxRate: number;
  avgRate: number;
  medianRate: number;
  stdDev: number;
  climateControlled: {
    count: number;
    avgRate: number;
    medianRate: number;
  };
  nonClimate: {
    count: number;
    avgRate: number;
    medianRate: number;
  };
}

export interface RateEvidenceNormalizerResult {
  status: SpokeStatus;
  normalizedRates?: Record<string, NormalizedRateBySize>;
  totalDataPoints?: number;
  uniqueSources?: number;
  marketAvgRatePerSqft?: number;
  climateControlledPremiumPct?: number;
  marketPosition?: 'premium' | 'competitive' | 'discount';
  notes: string;
}

// ============================================================================
// COVERAGE CONFIDENCE RESULT (SS.015.04)
// ============================================================================

export interface CoverageConfidenceResult {
  status: SpokeStatus;
  coverageScore?: number;               // 0-100
  confidenceLevel?: 'high' | 'medium' | 'low';
  competitorCoveragePct?: number;       // % of competitors with data
  sizeCoveragePct?: number;             // % of common sizes covered
  sourceDiversityScore?: number;        // 0-100
  dataQualityScore?: number;            // 0-100
  missingCompetitors?: string[];
  missingSizes?: string[];
  recommendations?: string[];
  notes: string;
}

// ============================================================================
// PROMOTION GATE RESULT (SS.015.05)
// ============================================================================

export interface PromotionGateResult {
  status: SpokeStatus;
  promotionDecision?: 'PROMOTE' | 'HOLD' | 'OVERRIDE_REQUIRED';
  coverageThresholdMet?: boolean;
  minCoverageThreshold?: number;        // Required % (default 60)
  actualCoverage?: number;
  dataQualityPassed?: boolean;
  blockers?: string[];
  warnings?: string[];
  overrideReason?: string;              // If manually overridden
  notes: string;
}

// ============================================================================
// PASS-1.5 INPUT
// ============================================================================

export interface Pass15Input {
  zipCode: string;
  state: string;
  competitors: {
    name: string;
    address: string;
    phone?: string;
    website?: string;
  }[];
  existingRateData?: RateObservation[];
}

// ============================================================================
// PASS-1.5 OUTPUT (Complete Result Object)
// ============================================================================

export interface Pass15Output {
  success: boolean;
  runId?: string;
  timestamp: number;
  zipCode: string;
  state: string;
  publishedRateScraper: PublishedRateScraperResult;
  aiCallWorkOrders: AICallWorkOrdersResult;
  rateEvidenceNormalizer: RateEvidenceNormalizerResult;
  coverageConfidence: CoverageConfidenceResult;
  promotionGate: PromotionGateResult;
  error?: string;
}

// ============================================================================
// RATE EVIDENCE PACKAGE (Export to Pass-2)
// ============================================================================

export interface RateEvidencePackage {
  zipCode: string;
  state: string;
  collectedAt: string;
  normalizedRates: Record<string, NormalizedRateBySize>;
  totalDataPoints: number;
  coverageScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  marketBenchmarks: {
    avg10x10: number;
    avg10x20: number;
    avgRatePerSqft: number;
    climateControlledPremium: number;
    marketPosition: string;
  };
  sources: {
    websiteScrapes: number;
    aggregatorData: number;
    aiCalls: number;
  };
}

// ============================================================================
// FACTORY FUNCTIONS FOR STUB RESULTS
// ============================================================================

export function createStubPublishedRateScraper(): PublishedRateScraperResult {
  return {
    status: 'stub',
    notes: 'Published rate scraper not implemented. TODO: Integrate Firecrawl.',
  };
}

export function createStubAICallWorkOrders(): AICallWorkOrdersResult {
  return {
    status: 'stub',
    notes: 'AI call work orders not implemented. TODO: Integrate Retell.ai.',
  };
}

export function createStubRateEvidenceNormalizer(): RateEvidenceNormalizerResult {
  return {
    status: 'stub',
    notes: 'Rate evidence normalizer not implemented. TODO: Implement normalization.',
  };
}

export function createStubCoverageConfidence(): CoverageConfidenceResult {
  return {
    status: 'stub',
    notes: 'Coverage confidence not implemented. TODO: Calculate coverage score.',
  };
}

export function createStubPromotionGate(): PromotionGateResult {
  return {
    status: 'stub',
    notes: 'Promotion gate not implemented. TODO: Implement threshold check.',
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
