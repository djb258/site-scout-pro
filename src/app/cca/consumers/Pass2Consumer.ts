/**
 * Pass 2 CCA Consumer — Read-only API for Pass 2 to consume CCA
 * ============================================================================
 *
 * ✅ SAFE FOR UI/LOVABLE — READ-ONLY
 *
 * This module only reads from CCA. Safe to import anywhere.
 *
 * ============================================================================
 *
 * DOCTRINE:
 * Pass 2 uses CCA to know HOW to hydrate jurisdiction cards.
 * This is a READ-ONLY API. Pass 2 may NEVER write to CCA.
 *
 * Pass 2 asks:
 * - Can I automate zoning data collection?
 * - Where is the planning department page?
 * - What format are zoning documents in?
 * - Should I use Firecrawl, Retell, or manual research?
 * - What confidence ceiling applies to hydrated data?
 *
 * CCA answers HOW to collect data.
 * Pass 2 owns WHAT the jurisdiction facts are.
 *
 * ============================================================================
 */

import { CcaPass2Contract, ConfidenceCeiling, ZoningModelType } from '../types/cca_types';
import { Pass2DataAvailability, DataAccessMethod } from '../types/cca_data_availability';

// =============================================================================
// PASS 2 CONSUMPTION RESULT
// =============================================================================

export interface Pass2CcaResult {
  /** Is CCA available for this county? */
  has_coverage: boolean;

  /** Is the CCA data fresh (not expired)? */
  is_fresh: boolean;

  /** The CCA contract for Pass 2 */
  contract: CcaPass2Contract | null;

  /** Detailed data availability */
  data_availability: Pass2DataAvailability | null;

  /** Recommended action for Pass 2 */
  recommendation: Pass2Recommendation;
}

export interface Pass2Recommendation {
  /** What hydration method should Pass 2 use? */
  hydration_method: 'firecrawl' | 'retell' | 'manual' | 'skip';

  /** Confidence ceiling for hydrated data */
  confidence_ceiling: ConfidenceCeiling;

  /** Which fields can likely be automated? */
  automatable_fields: string[];

  /** Which fields will need manual research? */
  manual_fields: string[];

  /** Reason for this recommendation */
  reason: string;
}

// =============================================================================
// HYDRATION ROUTE
// =============================================================================

export type HydrationRoute = 'firecrawl' | 'retell' | 'manual_queue' | 'hybrid';

export interface HydrationRouteResult {
  route: HydrationRoute;
  firecrawl_urls: string[];
  retell_required: boolean;
  manual_required: boolean;
  confidence_ceiling: ConfidenceCeiling;
}

// =============================================================================
// PASS 2 CONSUMER CLASS
// =============================================================================

export class Pass2CcaConsumer {
  /**
   * Get CCA data for Pass 2
   * This is the main entry point for Pass 2 to consume CCA
   */
  async getForCounty(county_id: number): Promise<Pass2CcaResult> {
    // TODO: Implement actual database read
    // This would read from ref.ref_county_capability

    // For now, return no coverage
    return {
      has_coverage: false,
      is_fresh: false,
      contract: null,
      data_availability: null,
      recommendation: {
        hydration_method: 'skip',
        confidence_ceiling: 'low',
        automatable_fields: [],
        manual_fields: [],
        reason: 'No CCA coverage for this county',
      },
    };
  }

  /**
   * Get hydration route for Pass 2
   * This tells Pass 2 HOW to fill out the jurisdiction card
   */
  async getHydrationRoute(county_id: number): Promise<HydrationRouteResult> {
    const result = await this.getForCounty(county_id);

    if (!result.has_coverage || !result.is_fresh || !result.contract) {
      return {
        route: 'manual_queue',
        firecrawl_urls: [],
        retell_required: false,
        manual_required: true,
        confidence_ceiling: 'low',
      };
    }

    const contract = result.contract;
    const availability = result.data_availability;

    // Collect URLs for Firecrawl
    const firecrawlUrls: string[] = [];
    if (contract.planning_url) {
      firecrawlUrls.push(contract.planning_url);
    }

    // Determine route based on contract recommendation
    switch (contract.hydration_route) {
      case 'firecrawl':
        return {
          route: 'firecrawl',
          firecrawl_urls: firecrawlUrls,
          retell_required: false,
          manual_required: false,
          confidence_ceiling: contract.confidence_ceiling,
        };

      case 'retell':
        return {
          route: 'retell',
          firecrawl_urls: [],
          retell_required: true,
          manual_required: false,
          confidence_ceiling: 'low',
        };

      case 'manual_queue':
      default:
        return {
          route: 'manual_queue',
          firecrawl_urls: [],
          retell_required: false,
          manual_required: true,
          confidence_ceiling: 'low',
        };
    }
  }

  /**
   * Check if Pass 2 should skip this county
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

    return { skip: false, reason: 'Ready for hydration' };
  }

  /**
   * Get zoning model from CCA
   */
  async getZoningModel(county_id: number): Promise<ZoningModelType> {
    const result = await this.getForCounty(county_id);

    if (!result.contract) {
      return 'unknown';
    }

    return result.contract.zoning_model;
  }

  /**
   * Get confidence ceiling for hydrated data
   * DOCTRINE: CCA confidence caps downstream confidence
   */
  async getConfidenceCeiling(county_id: number): Promise<ConfidenceCeiling> {
    const result = await this.getForCounty(county_id);

    if (!result.has_coverage || !result.is_fresh) {
      return 'low';
    }

    return result.recommendation.confidence_ceiling;
  }

  /**
   * Get planning department URL if available
   */
  async getPlanningUrl(county_id: number): Promise<string | null> {
    const result = await this.getForCounty(county_id);

    if (!result.contract) {
      return null;
    }

    return result.contract.planning_url;
  }

  /**
   * Check if county has no zoning
   */
  async isNoZoningCounty(county_id: number): Promise<boolean> {
    const zoningModel = await this.getZoningModel(county_id);
    return zoningModel === 'no_zoning';
  }

  /**
   * Get list of fields that can be automated
   */
  async getAutomatableFields(county_id: number): Promise<string[]> {
    const result = await this.getForCounty(county_id);

    if (!result.data_availability) {
      return [];
    }

    const fields: string[] = [];
    const avail = result.data_availability;

    // Check what's available and automatable
    if (avail.dimensional_requirements.availability === 'available') {
      fields.push('setbacks', 'lot_coverage', 'height');
    }

    if (avail.use_tables.availability === 'available') {
      fields.push('storage_allowed', 'use_type');
    }

    if (avail.stormwater_requirements.availability === 'available') {
      fields.push('stormwater_detention', 'impervious_limits');
    }

    if (avail.fire_code_requirements.availability === 'available') {
      fields.push('fire_lane', 'sprinkler', 'hydrant_spacing');
    }

    return fields;
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

let consumerInstance: Pass2CcaConsumer | null = null;

export function getPass2Consumer(): Pass2CcaConsumer {
  if (!consumerInstance) {
    consumerInstance = new Pass2CcaConsumer();
  }
  return consumerInstance;
}

/**
 * Get hydration route for a county
 */
export async function getHydrationRoute(county_id: number): Promise<HydrationRouteResult> {
  const consumer = getPass2Consumer();
  return consumer.getHydrationRoute(county_id);
}

/**
 * Check if county has no zoning
 */
export async function isNoZoning(county_id: number): Promise<boolean> {
  const consumer = getPass2Consumer();
  return consumer.isNoZoningCounty(county_id);
}

/**
 * Get Pass 2 confidence ceiling for a county
 */
export async function getPass2Ceiling(county_id: number): Promise<ConfidenceCeiling> {
  const consumer = getPass2Consumer();
  return consumer.getConfidenceCeiling(county_id);
}
