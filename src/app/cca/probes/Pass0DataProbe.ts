/**
 * Pass 0 Data Probe — Determines what permit/inspection data is available
 * ============================================================================
 *
 * DOCTRINE:
 * This probe determines WHAT permit and inspection data is available
 * from a county, and HOW it can be collected.
 *
 * This information is used by Pass 0 to:
 * - Know if permit signals can be automated
 * - Know if inspections are linked to permits
 * - Know how fresh the data is
 *
 * ============================================================================
 */

import {
  Pass0DataAvailability,
  DataAvailability,
  DataAccessMethod,
  createEmptyPass0Availability,
} from '../types/cca_data_availability';
import { ConfidenceCeiling, KNOWN_VENDORS, KnownVendor } from '../types/cca_types';

// =============================================================================
// PROBE INPUT
// =============================================================================

export interface Pass0ProbeInput {
  county_id: number;
  county_fips: string;
  county_name: string;
  state_code: string;
}

// =============================================================================
// PROBE RESULT
// =============================================================================

export interface Pass0ProbeResult {
  success: boolean;
  availability: Pass0DataAvailability;
  detected_vendor: KnownVendor | null;
  detected_urls: {
    permits_portal: string | null;
    inspections_portal: string | null;
    contractor_lookup: string | null;
  };
  errors: string[];
  probe_duration_ms: number;
}

// =============================================================================
// VENDOR DETECTION PATTERNS
// =============================================================================

const VENDOR_PATTERNS: Record<KnownVendor, RegExp[]> = {
  accela: [/accela/i, /citizenaccess/i, /aca-prod/i],
  tyler: [/tylertech/i, /energov/i, /tylerst/i],
  municity: [/municity/i, /munilink/i],
  civicplus: [/civicplus/i, /civiclive/i],
  opengov: [/opengov/i],
  granicus: [/granicus/i],
  citizenserve: [/citizenserve/i],
  'bs&a': [/bsasoftware/i, /bs-a\.com/i],
};

// =============================================================================
// PASS 0 DATA PROBE CLASS
// =============================================================================

export class Pass0DataProbe {
  /**
   * Run the Pass 0 data availability probe
   */
  async probe(input: Pass0ProbeInput): Promise<Pass0ProbeResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // Initialize with empty availability
    const availability = createEmptyPass0Availability();
    let detectedVendor: KnownVendor | null = null;
    const detectedUrls = {
      permits_portal: null as string | null,
      inspections_portal: null as string | null,
      contractor_lookup: null as string | null,
    };

    try {
      // Step 1: Search for permit portal
      const permitPortalResult = await this.findPermitPortal(input);
      if (permitPortalResult.url) {
        detectedUrls.permits_portal = permitPortalResult.url;
        detectedVendor = permitPortalResult.vendor;

        // Update availability based on what we found
        availability.permit_applications = {
          availability: this.assessAvailability(permitPortalResult),
          access_method: this.determineAccessMethod(permitPortalResult),
          data_freshness: permitPortalResult.hasRealTimeData ? 'real_time' : 'unknown',
          historical_depth_years: null,
          url: permitPortalResult.url,
        };

        availability.permit_issuances = {
          availability: this.assessAvailability(permitPortalResult),
          access_method: this.determineAccessMethod(permitPortalResult),
          data_freshness: permitPortalResult.hasRealTimeData ? 'real_time' : 'unknown',
          historical_depth_years: null,
          url: permitPortalResult.url,
        };

        availability.permit_status = {
          availability: permitPortalResult.hasStatusTracking ? 'available' : 'unknown',
          access_method: this.determineAccessMethod(permitPortalResult),
          url: permitPortalResult.url,
        };
      }

      // Step 2: Check for inspection data
      const inspectionResult = await this.findInspectionData(input, detectedUrls.permits_portal);
      if (inspectionResult.found) {
        detectedUrls.inspections_portal = inspectionResult.url;

        availability.inspection_records = {
          availability: 'available',
          access_method: inspectionResult.accessMethod,
          linked_to_permits: inspectionResult.linkedToPermits,
          url: inspectionResult.url,
        };

        availability.inspection_schedules = {
          availability: inspectionResult.hasSchedules ? 'available' : 'unavailable',
          access_method: inspectionResult.accessMethod,
          url: inspectionResult.url,
        };
      }

      // Step 3: Check for contractor lookup
      const contractorResult = await this.findContractorLookup(input);
      if (contractorResult.found) {
        detectedUrls.contractor_lookup = contractorResult.url;

        availability.contractor_licenses = {
          availability: 'available',
          access_method: contractorResult.accessMethod,
          url: contractorResult.url,
        };
      }

      // Step 4: Calculate overall viability
      availability.overall_viability = this.calculateOverallViability(availability);
      availability.confidence = this.calculateConfidence(availability);

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown probe error');
    }

    return {
      success: errors.length === 0,
      availability,
      detected_vendor: detectedVendor,
      detected_urls: detectedUrls,
      errors,
      probe_duration_ms: Date.now() - startTime,
    };
  }

  // ===========================================================================
  // PERMIT PORTAL DETECTION
  // ===========================================================================

  private async findPermitPortal(input: Pass0ProbeInput): Promise<{
    url: string | null;
    vendor: KnownVendor | null;
    hasRealTimeData: boolean;
    hasStatusTracking: boolean;
    hasApi: boolean;
  }> {
    // TODO: Implement actual URL detection
    // This would search for permit portals using patterns like:
    // - {county} county permits
    // - {county} county building permits
    // - citizenaccess {county}
    // - etc.

    return {
      url: null,
      vendor: null,
      hasRealTimeData: false,
      hasStatusTracking: false,
      hasApi: false,
    };
  }

  // ===========================================================================
  // INSPECTION DATA DETECTION
  // ===========================================================================

  private async findInspectionData(
    input: Pass0ProbeInput,
    permitPortalUrl: string | null
  ): Promise<{
    found: boolean;
    url: string | null;
    accessMethod: DataAccessMethod;
    linkedToPermits: boolean;
    hasSchedules: boolean;
  }> {
    // TODO: Implement inspection data detection
    // Check if inspections are available through the permit portal
    // or through a separate system

    return {
      found: false,
      url: null,
      accessMethod: 'not_available',
      linkedToPermits: false,
      hasSchedules: false,
    };
  }

  // ===========================================================================
  // CONTRACTOR LOOKUP DETECTION
  // ===========================================================================

  private async findContractorLookup(input: Pass0ProbeInput): Promise<{
    found: boolean;
    url: string | null;
    accessMethod: DataAccessMethod;
  }> {
    // TODO: Implement contractor lookup detection

    return {
      found: false,
      url: null,
      accessMethod: 'not_available',
    };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private assessAvailability(result: { url: string | null; hasApi: boolean }): DataAvailability {
    if (!result.url) return 'unknown';
    if (result.hasApi) return 'available';
    return 'available';
  }

  private determineAccessMethod(result: { hasApi: boolean; url: string | null }): DataAccessMethod {
    if (!result.url) return 'not_available';
    if (result.hasApi) return 'api';
    return 'web_portal';
  }

  private calculateOverallViability(
    availability: Pass0DataAvailability
  ): 'high' | 'medium' | 'low' | 'none' {
    const permitAvailable = availability.permit_applications.availability === 'available';
    const inspectionsAvailable = availability.inspection_records.availability === 'available';
    const permitMethod = availability.permit_applications.access_method;

    if (permitAvailable && permitMethod === 'api') return 'high';
    if (permitAvailable && permitMethod === 'web_portal') return 'medium';
    if (permitAvailable) return 'low';
    return 'none';
  }

  private calculateConfidence(availability: Pass0DataAvailability): ConfidenceCeiling {
    const knownCount = [
      availability.permit_applications.availability !== 'unknown',
      availability.permit_issuances.availability !== 'unknown',
      availability.inspection_records.availability !== 'unknown',
    ].filter(Boolean).length;

    if (knownCount >= 3) return 'medium';
    if (knownCount >= 1) return 'low';
    return 'low';
  }
}

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

export async function probePass0Data(input: Pass0ProbeInput): Promise<Pass0ProbeResult> {
  const probe = new Pass0DataProbe();
  return probe.probe(input);
}
