/**
 * Pass 0 CCA Consumer — Read-only API for Pass 0 to consume CCA
 * ============================================================================
 *
 * DOCTRINE:
 * Pass 0 uses CCA to know HOW to collect permit and inspection data.
 * This is a READ-ONLY API. Pass 0 may NEVER write to CCA.
 *
 * Pass 0 asks:
 * - Can I automate permit data collection?
 * - Where is the permit portal?
 * - Are inspections linked to permits?
 * - What vendor system is used?
 * - What confidence ceiling applies to my signals?
 *
 * ============================================================================
 */

import { CcaPass0Contract, ConfidenceCeiling } from '../types/cca_types';
import { Pass0DataAvailability, DataAccessMethod } from '../types/cca_data_availability';

// =============================================================================
// PASS 0 CONSUMPTION RESULT
// =============================================================================

export interface Pass0CcaResult {
  /** Is CCA available for this county? */
  has_coverage: boolean;

  /** Is the CCA data fresh (not expired)? */
  is_fresh: boolean;

  /** The CCA contract for Pass 0 */
  contract: CcaPass0Contract | null;

  /** Detailed data availability */
  data_availability: Pass0DataAvailability | null;

  /** Recommended action for Pass 0 */
  recommendation: Pass0Recommendation;
}

export interface Pass0Recommendation {
  /** Can Pass 0 proceed with automation? */
  can_automate: boolean;

  /** What method should Pass 0 use? */
  collection_method: 'api' | 'scrape' | 'pdf_parse' | 'skip';

  /** Confidence ceiling for signals */
  confidence_ceiling: ConfidenceCeiling;

  /** Reason for this recommendation */
  reason: string;
}

// =============================================================================
// PASS 0 CONSUMER CLASS
// =============================================================================

export class Pass0CcaConsumer {
  /**
   * Get CCA data for Pass 0
   * This is the main entry point for Pass 0 to consume CCA
   */
  async getForCounty(county_id: number): Promise<Pass0CcaResult> {
    // TODO: Implement actual database read
    // This would read from ref.ref_county_capability

    // For now, return no coverage
    return {
      has_coverage: false,
      is_fresh: false,
      contract: null,
      data_availability: null,
      recommendation: {
        can_automate: false,
        collection_method: 'skip',
        confidence_ceiling: 'low',
        reason: 'No CCA coverage for this county',
      },
    };
  }

  /**
   * Check if Pass 0 should skip this county
   */
  async shouldSkip(county_id: number): Promise<{
    skip: boolean;
    reason: string;
  }> {
    const result = await this.getForCounty(county_id);

    if (!result.has_coverage) {
      return { skip: true, reason: 'No CCA coverage - probe needed first' };
    }

    if (!result.is_fresh) {
      return { skip: true, reason: 'CCA expired - re-probe needed' };
    }

    if (!result.recommendation.can_automate) {
      return { skip: false, reason: 'Manual-only county - low confidence signals' };
    }

    return { skip: false, reason: 'Ready for automation' };
  }

  /**
   * Get confidence ceiling for Pass 0 signals
   * DOCTRINE: Pass 0 may NOT emit high-confidence signals from manual-only counties
   */
  async getConfidenceCeiling(county_id: number): Promise<ConfidenceCeiling> {
    const result = await this.getForCounty(county_id);

    if (!result.has_coverage || !result.is_fresh) {
      return 'low';
    }

    return result.recommendation.confidence_ceiling;
  }

  /**
   * Get permit portal URL if available
   */
  async getPermitPortalUrl(county_id: number): Promise<string | null> {
    const result = await this.getForCounty(county_id);

    if (!result.contract) {
      return null;
    }

    return result.contract.permits_url;
  }

  /**
   * Check if inspections are linked to permits
   */
  async areInspectionsLinked(county_id: number): Promise<boolean | null> {
    const result = await this.getForCounty(county_id);

    if (!result.contract) {
      return null;
    }

    return result.contract.inspections_linked;
  }

  /**
   * Get the recommended collection method
   */
  getRecommendedMethod(contract: CcaPass0Contract | null): 'api' | 'scrape' | 'pdf_parse' | 'skip' {
    if (!contract) {
      return 'skip';
    }

    switch (contract.permit_system_type) {
      case 'api':
        return 'api';
      case 'portal_scrape':
        return 'scrape';
      case 'pdf_logs':
        return 'pdf_parse';
      case 'manual_only':
      case 'unknown':
      default:
        return 'skip';
    }
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

let consumerInstance: Pass0CcaConsumer | null = null;

export function getPass0Consumer(): Pass0CcaConsumer {
  if (!consumerInstance) {
    consumerInstance = new Pass0CcaConsumer();
  }
  return consumerInstance;
}

/**
 * Quick check if Pass 0 can automate for a county
 */
export async function canPass0Automate(county_id: number): Promise<boolean> {
  const consumer = getPass0Consumer();
  const result = await consumer.getForCounty(county_id);
  return result.recommendation.can_automate;
}

/**
 * Get Pass 0 confidence ceiling for a county
 */
export async function getPass0Ceiling(county_id: number): Promise<ConfidenceCeiling> {
  const consumer = getPass0Consumer();
  return consumer.getConfidenceCeiling(county_id);
}
