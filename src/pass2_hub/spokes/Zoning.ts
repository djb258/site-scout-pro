/**
 * ZONING SPOKE
 *
 * Responsibility: Fetch and analyze zoning regulations for storage development
 *
 * Inputs:
 *   - county_fips: string
 *   - state: string
 *   - zip: string
 *
 * Outputs:
 *   - ZoningResult with classification, requirements, restrictions
 *
 * Data Sources:
 *   - Lovable.DB: jurisdiction_cards scratchpad table
 *   - Computed scores based on zoning attributes
 */

import type { ZoningIntel, OpportunityObject } from '../../shared/OpportunityObject';
import type { ZoningResult, ZoningInput as Pass2ZoningInput } from '../types/pass2_types';
import { createStubZoning, createErrorResult } from '../types/pass2_types';
import { queryData, writeLog } from '../../shared/adapters/LovableAdapter';

// Legacy input interface (for backwards compatibility)
export interface ZoningInput {
  county_fips?: string;
  state: string;
  county: string;
  zip: string;
}

// Legacy output interface (for backwards compatibility)
export interface ZoningOutput {
  success: boolean;
  zoning_intel: ZoningIntel | null;
  data_source: 'neon' | 'scraper' | 'manual' | 'none';
  error?: string;
}

/**
 * Jurisdiction card record from scratchpad
 */
interface JurisdictionCardRecord {
  jurisdiction_id: string;
  county: string;
  state: string;
  county_fips?: string;
  zoning_code?: string;
  storage_allowed?: boolean;
  by_right?: boolean;
  conditional_use_required?: boolean;
  variance_needed?: boolean;
  setback_front_ft?: number;
  setback_side_ft?: number;
  setback_rear_ft?: number;
  height_limit_ft?: number;
  lot_coverage_max_pct?: number;
  allowed_uses?: string[];
  notes?: string;
}

// ============================================================================
// ZONING CLASSIFICATION LOGIC
// ============================================================================

/**
 * Calculate zoning score based on attributes (0-100)
 */
function calculateZoningScoreFromAttributes(
  storageAllowed: boolean,
  byRight: boolean,
  conditionalUseRequired: boolean,
  varianceNeeded: boolean,
  heightLimitFt?: number
): number {
  if (!storageAllowed) {
    return 0; // Storage prohibited
  }

  let score = 100;

  // Deduct for approval requirements
  if (varianceNeeded) {
    score -= 25; // Variance is risky and time-consuming
  }

  if (conditionalUseRequired) {
    score -= 15; // CUP adds time and uncertainty
  }

  if (!byRight) {
    score -= 10; // Not by-right means additional process
  }

  // Height limit considerations
  if (heightLimitFt !== undefined) {
    if (heightLimitFt < 25) {
      score -= 20; // Very restrictive, limits building design
    } else if (heightLimitFt < 35) {
      score -= 10; // Moderately restrictive
    }
    // >= 35ft is typical and acceptable
  }

  return Math.max(0, score);
}

/**
 * Classify zoning favorability based on score
 */
function classifyZoningFromScore(score: number): ZoningResult['classification'] {
  if (score >= 80) return 'favorable';
  if (score >= 60) return 'conditional';
  if (score > 0) return 'challenging';
  return 'prohibited';
}

/**
 * Determine allowed uses for storage based on zoning code
 */
function inferAllowedUses(zoningCode?: string): string[] {
  if (!zoningCode) {
    return ['storage', 'warehouse'];
  }

  const code = zoningCode.toUpperCase();
  const uses: string[] = [];

  // Industrial zones
  if (code.includes('I-') || code.includes('M-') || code.includes('IND')) {
    uses.push('warehouse', 'storage', 'light_manufacturing', 'distribution');
  }

  // Commercial zones
  if (code.includes('C-') || code.includes('B-') || code.includes('COM')) {
    uses.push('retail', 'office', 'storage');
  }

  // Mixed use
  if (code.includes('MU') || code.includes('MX') || code.includes('PD')) {
    uses.push('mixed_use', 'storage', 'retail');
  }

  // If nothing matched, default to storage
  if (uses.length === 0) {
    uses.push('storage');
  }

  return [...new Set(uses)]; // Remove duplicates
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Run zoning analysis (New Pass-2 Shell Interface)
 *
 * @param opportunity - OpportunityObject with identity and pass1 data
 * @returns ZoningResult with status, classification, and requirements
 */
export async function runZoningShell(opportunity: OpportunityObject): Promise<ZoningResult> {
  console.log(`[ZONING_SPOKE] Running zoning analysis for ${opportunity.identity.county}, ${opportunity.identity.state}`);

  try {
    // Query jurisdiction_cards scratchpad for this location
    const jurisdictionId = `${opportunity.identity.state}-${opportunity.identity.county.replace(/\s+/g, '_')}`;

    const records = await queryData<JurisdictionCardRecord>('jurisdiction_cards', {
      jurisdiction_id: jurisdictionId,
    });

    // Also try by county_fips if available
    let jurisdictionCard: JurisdictionCardRecord | undefined;

    if (records && records.length > 0) {
      jurisdictionCard = records[0];
    } else if (opportunity.identity.county_fips) {
      const fipsRecords = await queryData<JurisdictionCardRecord>('jurisdiction_cards', {
        county_fips: opportunity.identity.county_fips,
      });
      if (fipsRecords && fipsRecords.length > 0) {
        jurisdictionCard = fipsRecords[0];
      }
    }

    // Build result from jurisdiction card or use intelligent defaults
    let storageAllowed = true;
    let byRight = false;
    let conditionalUseRequired = true;
    let varianceNeeded = false;
    let zoningCode = 'I-1 (Industrial Light)';
    let setbacks = { front_ft: 50, side_ft: 25, rear_ft: 25 };
    let heightLimitFt = 45;
    let lotCoverageMaxPct = 70;
    let allowedUses: string[] = [];
    let dataSource = 'computed';

    if (jurisdictionCard) {
      // Use actual data from jurisdiction card
      storageAllowed = jurisdictionCard.storage_allowed ?? true;
      byRight = jurisdictionCard.by_right ?? false;
      conditionalUseRequired = jurisdictionCard.conditional_use_required ?? true;
      varianceNeeded = jurisdictionCard.variance_needed ?? false;
      zoningCode = jurisdictionCard.zoning_code || zoningCode;
      setbacks = {
        front_ft: jurisdictionCard.setback_front_ft ?? 50,
        side_ft: jurisdictionCard.setback_side_ft ?? 25,
        rear_ft: jurisdictionCard.setback_rear_ft ?? 25,
      };
      heightLimitFt = jurisdictionCard.height_limit_ft ?? 45;
      lotCoverageMaxPct = jurisdictionCard.lot_coverage_max_pct ?? 70;
      allowedUses = jurisdictionCard.allowed_uses || [];
      dataSource = 'jurisdiction_cards';
    }

    // Infer allowed uses if not provided
    if (allowedUses.length === 0) {
      allowedUses = inferAllowedUses(zoningCode);
    }

    // Calculate score and classification
    const score = calculateZoningScoreFromAttributes(
      storageAllowed,
      byRight,
      conditionalUseRequired,
      varianceNeeded,
      heightLimitFt
    );
    const classification = classifyZoningFromScore(score);

    await writeLog('zoning_analysis_complete', {
      county: opportunity.identity.county,
      state: opportunity.identity.state,
      classification,
      score,
      data_source: dataSource,
    });

    const result: ZoningResult = {
      status: 'ok',
      zoningCode,
      allowedUses,
      storageAllowed,
      byRight,
      conditionalUseRequired,
      varianceNeeded,
      setbacks,
      heightLimit_ft: heightLimitFt,
      lotCoverageMax_pct: lotCoverageMaxPct,
      classification,
      score,
      notes: `Zoning analysis for ${opportunity.identity.county}, ${opportunity.identity.state}. Classification: ${classification}, Score: ${score}. Data source: ${dataSource}.`,
    };

    console.log(`[ZONING_SPOKE] Result: ${result.classification}, score=${result.score}`);
    return result;
  } catch (error) {
    console.error('[ZONING_SPOKE] Error:', error);
    return createErrorResult(
      error instanceof Error ? error : 'Unknown zoning error',
      createStubZoning
    );
  }
}

/**
 * Run zoning analysis (Legacy Interface - Retained for Backwards Compatibility)
 */
export async function runZoning(input: ZoningInput): Promise<ZoningOutput> {
  console.log(`[ZONING] Analyzing zoning for ${input.county}, ${input.state}`);

  try {
    // Query jurisdiction_cards
    const jurisdictionId = `${input.state}-${input.county.replace(/\s+/g, '_')}`;
    const records = await queryData<JurisdictionCardRecord>('jurisdiction_cards', {
      jurisdiction_id: jurisdictionId,
    });

    let zoning_intel: ZoningIntel;
    let data_source: ZoningOutput['data_source'] = 'none';

    if (records && records.length > 0) {
      const card = records[0];
      const score = calculateZoningScoreFromAttributes(
        card.storage_allowed ?? true,
        card.by_right ?? false,
        card.conditional_use_required ?? true,
        card.variance_needed ?? false,
        card.height_limit_ft
      );
      const classification = classifyZoningFromScore(score);

      zoning_intel = {
        primary_zone: card.zoning_code || 'Commercial/Industrial',
        storage_allowed: card.storage_allowed ?? true,
        by_right: card.by_right ?? true,
        conditional_use_required: card.conditional_use_required ?? false,
        variance_needed: card.variance_needed ?? false,
        setback_requirements: `${card.setback_front_ft || 25}ft front, ${card.setback_side_ft || 10}ft sides`,
        height_limit: card.height_limit_ft ? `${card.height_limit_ft}ft` : '35ft',
        lot_coverage_max: card.lot_coverage_max_pct ? `${card.lot_coverage_max_pct}%` : '70%',
        classification,
        score,
      };
      data_source = 'neon';
    } else {
      // Default zoning intel when no data found
      zoning_intel = {
        primary_zone: 'Commercial/Industrial',
        storage_allowed: true,
        by_right: true,
        conditional_use_required: false,
        variance_needed: false,
        setback_requirements: '25ft front, 10ft sides',
        height_limit: '35ft',
        lot_coverage_max: '70%',
        classification: 'favorable',
        score: 85,
      };
    }

    return {
      success: true,
      zoning_intel,
      data_source,
    };
  } catch (error) {
    console.error('[ZONING] Error:', error);
    return {
      success: false,
      zoning_intel: null,
      data_source: 'none',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Calculate zoning classification score
 */
export function calculateZoningScore(zoning: ZoningIntel): number {
  return calculateZoningScoreFromAttributes(
    zoning.storage_allowed,
    zoning.by_right,
    zoning.conditional_use_required,
    zoning.variance_needed,
    zoning.height_limit ? parseInt(zoning.height_limit) : undefined
  );
}

/**
 * Classify zoning favorability
 */
export function classifyZoning(score: number): ZoningIntel['classification'] {
  return classifyZoningFromScore(score);
}

/**
 * Check if storage is allowed by-right
 */
export function isStorageByRight(zoning: ZoningResult): boolean {
  return zoning.storageAllowed === true && zoning.byRight === true;
}

/**
 * Calculate zoning risk score (0-100, lower is better)
 */
export function calculateZoningRisk(zoning: ZoningResult): number {
  if (zoning.status !== 'ok') return 50; // Default for stub/error

  let risk = 0;

  if (!zoning.storageAllowed) risk += 100;
  if (zoning.varianceNeeded) risk += 30;
  if (zoning.conditionalUseRequired) risk += 20;
  if (!zoning.byRight) risk += 10;

  return Math.min(100, risk);
}

// Re-export types for convenience
export type { ZoningResult };
