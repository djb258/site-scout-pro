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

import { neonAdapter, CountyCapabilityRecord } from '../../shared/data_layer/adapters/NeonAdapter';

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
    console.log(`[CCA] Storing profile for county ${profile.county_id}`);

    try {
      await neonAdapter.upsertCcaProfile({
        county_id: profile.county_id,
        state: profile.state_code,
        county_name: '', // Will be resolved from county_fips
        county_fips: profile.county_fips,

        // Pass 0 dispatch
        pass0_method: this.mapAutomationClassToMethod(profile.automation_class),
        pass0_coverage: profile.permit_automation_viable ? 'full' : 'insufficient',
        pass0_vendor: profile.detected_vendor,
        pass0_has_api: profile.permit_system_type === 'api',
        pass0_has_portal: profile.permit_system_type === 'portal_scrape',
        pass0_inspections_linked: profile.inspections_linked,

        // Pass 2 dispatch
        pass2_method: this.mapAutomationClassToMethod(profile.automation_class),
        pass2_coverage: profile.zoning_automation_viable ? 'full' : 'insufficient',
        pass2_zoning_model_detected: this.mapZoningModel(profile.zoning_model),
        pass2_ordinance_format: profile.document_quality,
        pass2_has_gis: null,
        pass2_has_online_ordinance: profile.zoning_automation_viable,
        pass2_planning_url: profile.planning_url,
        pass2_ordinance_url: null,

        // TTL
        confidence: profile.confidence_ceiling,
        ttl_months: CCA_TTL_MONTHS,
      });

      console.log(`[CCA] Profile stored for county ${profile.county_id}`);
    } catch (error) {
      console.error(`[CCA] Failed to store profile for county ${profile.county_id}:`, error);
      throw error;
    }
  }

  /**
   * Get a profile from the database
   */
  private async getProfile(county_id: number): Promise<CountyCapabilityProfile | null> {
    try {
      const record = await neonAdapter.getCcaProfile(county_id);

      if (!record) {
        return null;
      }

      return this.mapRecordToProfile(record);
    } catch (error) {
      console.error(`[CCA] Failed to get profile for county ${county_id}:`, error);
      return null;
    }
  }

  /**
   * Map database record to CountyCapabilityProfile
   */
  private mapRecordToProfile(record: CountyCapabilityRecord): CountyCapabilityProfile {
    return {
      county_id: record.county_id,
      county_fips: record.county_fips,
      state_code: record.state,

      // Permit system (for Pass 0)
      permit_system_type: this.inferPermitSystemType(record),
      inspections_linked: record.pass0_inspections_linked,
      permit_automation_viable: record.pass0_coverage === 'full' || record.pass0_coverage === 'partial',

      // Zoning/planning (for Pass 2)
      zoning_model: record.pass2_zoning_model_detected || 'unknown',
      document_quality: record.pass2_ordinance_format || 'unknown',
      zoning_automation_viable: record.pass2_coverage === 'full' || record.pass2_coverage === 'partial',

      // Overall
      automation_class: this.inferAutomationClass(record),
      automation_viable: record.pass0_coverage === 'full' || record.pass2_coverage === 'full',

      // Vendor & URLs
      detected_vendor: record.pass0_vendor,
      planning_url: record.pass2_planning_url,
      permits_url: null, // Not stored in current schema
      source_urls: [],

      // Confidence & TTL
      confidence_ceiling: record.confidence,
      last_verified_at: record.verified_at,
      expires_at: record.expires_at,
      escalation_required: record.confidence === 'low',

      // Metadata
      notes: null,
      probe_retry_count: 0,
    };
  }

  /**
   * Infer permit system type from record
   */
  private inferPermitSystemType(record: CountyCapabilityRecord): 'api' | 'portal_scrape' | 'pdf_logs' | 'manual_only' | 'unknown' {
    if (record.pass0_has_api) return 'api';
    if (record.pass0_has_portal) return 'portal_scrape';
    if (record.pass0_method === 'manual') return 'manual_only';
    return 'unknown';
  }

  /**
   * Infer automation class from record
   */
  private inferAutomationClass(record: CountyCapabilityRecord): AutomationClass {
    if (record.pass0_method === 'api' || record.pass2_method === 'api') return 'api';
    if (record.pass0_method === 'portal' || record.pass2_method === 'portal') return 'portal';
    if (record.pass0_method === 'scrape' || record.pass2_method === 'scrape') return 'portal';
    if (record.pass2_ordinance_format === 'pdf_searchable' || record.pass2_ordinance_format === 'pdf_scanned') return 'pdf';
    return 'manual';
  }

  /**
   * Map automation class to method
   */
  private mapAutomationClassToMethod(automationClass: AutomationClass): 'api' | 'scrape' | 'portal' | 'manual' | null {
    switch (automationClass) {
      case 'api': return 'api';
      case 'portal': return 'portal';
      case 'pdf': return 'scrape';
      case 'manual': return 'manual';
      default: return null;
    }
  }

  /**
   * Map zoning model string to enum
   */
  private mapZoningModel(model: string): 'no_zoning' | 'county' | 'municipal' | 'mixed' | null {
    switch (model) {
      case 'no_zoning': return 'no_zoning';
      case 'county': return 'county';
      case 'municipal': return 'municipal';
      case 'mixed': return 'mixed';
      default: return null;
    }
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
