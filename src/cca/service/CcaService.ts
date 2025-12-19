/**
 * CCA Service — Standalone County Capability Asset Service
 * ============================================================================
 *
 * ⛔ STAGE-1 WRITER — DO NOT IMPORT FROM UI OR LOVABLE ⛔
 *
 * This module has WRITE access to ref.county_capability.
 * UI/Lovable must use src/cca/consumers/* instead.
 *
 * See LOCKS.md for import restrictions.
 *
 * ============================================================================
 *
 * DOCTRINE:
 * This service runs INDEPENDENTLY and UPFRONT before any pass.
 * It answers: HOW do we collect information from this county?
 *
 * The CCA Service:
 * 1. Probes counties to determine capability
 * 2. Stores results in ref.ref_county_capability
 * 3. Provides read-only contracts for Pass 0 and Pass 2
 *
 * NO PASS MAY WRITE TO CCA. Only this service writes.
 *
 * ============================================================================
 */

import {
  CountyCapabilityProfile,
  CcaProbeInput,
  CcaProbeResult,
  CcaServiceStatus,
  CcaPass0Contract,
  CcaPass2Contract,
  ProbeReason,
  CCA_TTL_MONTHS,
  CCA_MAX_RETRIES,
  AutomationClass,
  ConfidenceCeiling,
} from '../types/cca_types';

// =============================================================================
// CCA SERVICE CLASS
// =============================================================================

export class CcaService {
  private static instance: CcaService | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton CCA Service instance
   */
  public static getInstance(): CcaService {
    if (!CcaService.instance) {
      CcaService.instance = new CcaService();
    }
    return CcaService.instance;
  }

  // ===========================================================================
  // CORE OPERATIONS
  // ===========================================================================

  /**
   * Check if a county needs CCA probing
   */
  async checkCountyStatus(county_id: number): Promise<CcaServiceStatus> {
    const profile = await this.getProfile(county_id);

    if (!profile) {
      return {
        county_id,
        profile_exists: false,
        profile_expired: false,
        needs_probe: true,
        last_probe_at: null,
        next_probe_due: null,
      };
    }

    const isExpired = new Date(profile.expires_at) < new Date();

    return {
      county_id,
      profile_exists: true,
      profile_expired: isExpired,
      needs_probe: isExpired,
      last_probe_at: profile.last_verified_at,
      next_probe_due: profile.expires_at,
    };
  }

  /**
   * Probe a county to determine its capability
   * This is the main entry point for CCA collection
   */
  async probeCounty(input: CcaProbeInput): Promise<CcaProbeResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Check if we should skip (profile exists and not forced)
      if (!input.force_reprobe) {
        const status = await this.checkCountyStatus(input.county_id);
        if (status.profile_exists && !status.profile_expired) {
          const existingProfile = await this.getProfile(input.county_id);
          return {
            success: true,
            profile: existingProfile,
            errors: [],
            probe_duration_ms: Date.now() - startTime,
          };
        }
      }

      // Run the probe
      const profile = await this.runProbe(input);

      // Store the result
      await this.storeProfile(profile);

      return {
        success: true,
        profile,
        errors,
        probe_duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        profile: null,
        errors,
        probe_duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Batch probe multiple counties
   */
  async probeCounties(inputs: CcaProbeInput[]): Promise<Map<number, CcaProbeResult>> {
    const results = new Map<number, CcaProbeResult>();

    for (const input of inputs) {
      const result = await this.probeCounty(input);
      results.set(input.county_id, result);
    }

    return results;
  }

  // ===========================================================================
  // PASS CONSUMPTION APIs (READ-ONLY)
  // ===========================================================================

  /**
   * Get CCA contract for Pass 0
   * Pass 0 uses this to know HOW to collect permit/inspection data
   */
  async getPass0Contract(county_id: number): Promise<CcaPass0Contract | null> {
    const profile = await this.getProfile(county_id);

    if (!profile) {
      return null;
    }

    // Check expiration
    if (new Date(profile.expires_at) < new Date()) {
      // Return with low confidence if expired
      return {
        county_id,
        permit_automation_viable: false,
        permit_system_type: 'unknown',
        inspections_linked: null,
        confidence_ceiling: 'low',
        permits_url: profile.permits_url,
        detected_vendor: profile.detected_vendor,
      };
    }

    return {
      county_id,
      permit_automation_viable: profile.permit_automation_viable,
      permit_system_type: profile.permit_system_type,
      inspections_linked: profile.inspections_linked,
      confidence_ceiling: profile.confidence_ceiling,
      permits_url: profile.permits_url,
      detected_vendor: profile.detected_vendor,
    };
  }

  /**
   * Get CCA contract for Pass 2
   * Pass 2 uses this to know HOW to hydrate jurisdiction cards
   */
  async getPass2Contract(county_id: number): Promise<CcaPass2Contract | null> {
    const profile = await this.getProfile(county_id);

    if (!profile) {
      return null;
    }

    // Check expiration
    if (new Date(profile.expires_at) < new Date()) {
      return {
        county_id,
        zoning_automation_viable: false,
        zoning_model: 'unknown',
        document_quality: 'unknown',
        confidence_ceiling: 'low',
        planning_url: profile.planning_url,
        hydration_route: 'manual_queue',
      };
    }

    // Determine hydration route based on capability
    const hydrationRoute = this.determineHydrationRoute(profile);

    return {
      county_id,
      zoning_automation_viable: profile.zoning_automation_viable,
      zoning_model: profile.zoning_model,
      document_quality: profile.document_quality,
      confidence_ceiling: profile.confidence_ceiling,
      planning_url: profile.planning_url,
      hydration_route: hydrationRoute,
    };
  }

  // ===========================================================================
  // INTERNAL METHODS
  // ===========================================================================

  /**
   * Run the actual probe logic
   */
  private async runProbe(input: CcaProbeInput): Promise<CountyCapabilityProfile> {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + CCA_TTL_MONTHS);

    // Initialize with unknowns
    const profile: CountyCapabilityProfile = {
      county_id: input.county_id,
      county_fips: input.county_fips,
      state_code: input.state_code,

      // Permit system (for Pass 0)
      permit_system_type: 'unknown',
      inspections_linked: null,
      permit_automation_viable: false,

      // Zoning/planning (for Pass 2)
      zoning_model: 'unknown',
      document_quality: 'unknown',
      zoning_automation_viable: false,

      // Overall
      automation_class: 'manual',
      automation_viable: false,

      // Vendor & URLs
      detected_vendor: null,
      planning_url: null,
      permits_url: null,
      source_urls: [],

      // Confidence & TTL
      confidence_ceiling: 'low',
      last_verified_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      escalation_required: true,

      // Metadata
      notes: null,
      probe_retry_count: 0,
    };

    // TODO: Implement actual probing logic
    // For now, return the default profile
    // Real implementation would:
    // 1. Search for county planning/permit pages
    // 2. Detect permit system vendor
    // 3. Check document quality
    // 4. Determine automation viability

    return profile;
  }

  /**
   * Store a profile in the database
   */
  private async storeProfile(profile: CountyCapabilityProfile): Promise<void> {
    // TODO: Implement database storage
    // This would insert/update ref.ref_county_capability
    console.log(`[CCA] Storing profile for county ${profile.county_id}`);
  }

  /**
   * Get a profile from the database
   */
  private async getProfile(county_id: number): Promise<CountyCapabilityProfile | null> {
    // TODO: Implement database read
    // This would select from ref.ref_county_capability
    return null;
  }

  /**
   * Determine hydration route based on capability
   */
  private determineHydrationRoute(
    profile: CountyCapabilityProfile
  ): 'firecrawl' | 'retell' | 'manual_queue' {
    // If automation viable → Firecrawl
    if (profile.zoning_automation_viable) {
      return 'firecrawl';
    }

    // If manual-only but can call → Retell
    if (profile.automation_class === 'manual' || profile.automation_class === 'pdf') {
      return 'retell';
    }

    // Default to manual queue
    return 'manual_queue';
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Get the CCA Service instance
 */
export function getCcaService(): CcaService {
  return CcaService.getInstance();
}

/**
 * Quick check if a county has CCA coverage
 */
export async function hasCountyCoverage(county_id: number): Promise<boolean> {
  const service = getCcaService();
  const status = await service.checkCountyStatus(county_id);
  return status.profile_exists && !status.profile_expired;
}

/**
 * Ensure CCA exists for a county (probe if missing)
 */
export async function ensureCcaExists(input: CcaProbeInput): Promise<CcaProbeResult> {
  const service = getCcaService();
  return service.probeCounty(input);
}
