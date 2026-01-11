/**
 * Pass 2 Data Probe — Determines what zoning/jurisdiction data is available
 * ============================================================================
 *
 * DOCTRINE:
 * This probe determines WHAT zoning and jurisdiction data is available
 * from a county, and HOW it can be collected.
 *
 * This information is used by Pass 2 to:
 * - Know if zoning data can be scraped (Firecrawl)
 * - Know if we need to call (Retell)
 * - Know if manual research is required
 * - Know what jurisdiction card fields can be populated
 *
 * ============================================================================
 */

import {
  Pass2DataAvailability,
  DataAvailability,
  DataAccessMethod,
  createEmptyPass2Availability,
} from '../types/cca_data_availability';
import { ConfidenceCeiling, ZoningModelType } from '../types/cca_types';

// =============================================================================
// PROBE INPUT
// =============================================================================

export interface Pass2ProbeInput {
  county_id: number;
  county_fips: string;
  county_name: string;
  state_code: string;
}

// =============================================================================
// PROBE RESULT
// =============================================================================

export interface Pass2ProbeResult {
  success: boolean;
  availability: Pass2DataAvailability;
  zoning_model: ZoningModelType;
  detected_urls: {
    planning_department: string | null;
    zoning_ordinance: string | null;
    zoning_map: string | null;
    permit_checklist: string | null;
    fee_schedule: string | null;
  };
  errors: string[];
  probe_duration_ms: number;
}

// =============================================================================
// NO-ZONING STATE INDICATORS
// =============================================================================

const NO_ZONING_INDICATORS = [
  /no\s+zoning/i,
  /no\s+county\s+zoning/i,
  /unincorporated.*no\s+zoning/i,
  /does\s+not\s+have\s+zoning/i,
];

const NO_ZONING_STATES = ['TX', 'MT', 'AZ', 'NV', 'ID', 'WY', 'SD', 'ND'];

// =============================================================================
// PASS 2 DATA PROBE CLASS
// =============================================================================

export class Pass2DataProbe {
  /**
   * Run the Pass 2 data availability probe
   */
  async probe(input: Pass2ProbeInput): Promise<Pass2ProbeResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // Initialize with empty availability
    const availability = createEmptyPass2Availability();
    let zoningModel: ZoningModelType = 'unknown';
    const detectedUrls = {
      planning_department: null as string | null,
      zoning_ordinance: null as string | null,
      zoning_map: null as string | null,
      permit_checklist: null as string | null,
      fee_schedule: null as string | null,
    };

    try {
      // Step 1: Find planning department page
      const planningResult = await this.findPlanningDepartment(input);
      if (planningResult.url) {
        detectedUrls.planning_department = planningResult.url;
      }

      // Step 2: Detect zoning model
      zoningModel = await this.detectZoningModel(input, planningResult);

      // Step 3: If no-zoning, mark appropriately
      if (zoningModel === 'no_zoning') {
        availability.zoning_ordinance = {
          availability: 'unavailable',
          access_method: 'not_available',
          format: 'unknown',
          url: null,
        };
        availability.zoning_maps = {
          availability: 'unavailable',
          access_method: 'not_available',
          format: 'unknown',
          url: null,
        };
        availability.dimensional_requirements = {
          availability: 'unavailable',
          access_method: 'not_available',
          format: 'unknown',
          url: null,
        };
        availability.use_tables = {
          availability: 'unavailable',
          access_method: 'not_available',
          storage_specifically_listed: null,
          url: null,
        };

        availability.overall_viability = 'none';
        availability.hydration_recommendation = 'manual';
        availability.notes = 'County has no zoning ordinance';
      } else {
        // Step 4: Find zoning ordinance
        const ordinanceResult = await this.findZoningOrdinance(input, planningResult.url);
        if (ordinanceResult.url) {
          detectedUrls.zoning_ordinance = ordinanceResult.url;

          availability.zoning_ordinance = {
            availability: 'available',
            access_method: ordinanceResult.accessMethod,
            format: ordinanceResult.format,
            url: ordinanceResult.url,
          };
        }

        // Step 5: Find zoning maps
        const mapResult = await this.findZoningMaps(input, planningResult.url);
        if (mapResult.url) {
          detectedUrls.zoning_map = mapResult.url;

          availability.zoning_maps = {
            availability: 'available',
            access_method: mapResult.accessMethod,
            format: mapResult.format,
            url: mapResult.url,
          };
        }

        // Step 6: Find dimensional requirements
        const dimensionalResult = await this.findDimensionalRequirements(
          input,
          detectedUrls.zoning_ordinance
        );
        availability.dimensional_requirements = {
          availability: dimensionalResult.found ? 'available' : 'unknown',
          access_method: dimensionalResult.accessMethod,
          format: dimensionalResult.format,
          url: dimensionalResult.url,
        };

        // Step 7: Find use tables
        const useTableResult = await this.findUseTables(input, detectedUrls.zoning_ordinance);
        availability.use_tables = {
          availability: useTableResult.found ? 'available' : 'unknown',
          access_method: useTableResult.accessMethod,
          storage_specifically_listed: useTableResult.storageListsed,
          url: useTableResult.url,
        };

        // Step 8: Find permit checklist
        const checklistResult = await this.findPermitChecklist(input, planningResult.url);
        if (checklistResult.url) {
          detectedUrls.permit_checklist = checklistResult.url;

          availability.permit_checklist = {
            availability: 'available',
            access_method: checklistResult.accessMethod,
            url: checklistResult.url,
          };
        }

        // Step 9: Find fee schedule
        const feeResult = await this.findFeeSchedule(input, planningResult.url);
        if (feeResult.url) {
          detectedUrls.fee_schedule = feeResult.url;

          availability.fee_schedules = {
            availability: 'available',
            access_method: feeResult.accessMethod,
            url: feeResult.url,
          };
        }

        // Step 10: Find other requirements
        await this.findAdditionalRequirements(input, availability, planningResult.url);

        // Step 11: Calculate overall viability and recommendation
        availability.overall_viability = this.calculateOverallViability(availability);
        availability.hydration_recommendation = this.determineHydrationRecommendation(availability);
      }

      availability.confidence = this.calculateConfidence(availability);

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown probe error');
    }

    return {
      success: errors.length === 0,
      availability,
      zoning_model: zoningModel,
      detected_urls: detectedUrls,
      errors,
      probe_duration_ms: Date.now() - startTime,
    };
  }

  // ===========================================================================
  // PLANNING DEPARTMENT DETECTION
  // ===========================================================================

  private async findPlanningDepartment(input: Pass2ProbeInput): Promise<{
    url: string | null;
    hasZoningSection: boolean;
  }> {
    // TODO: Implement actual URL detection
    // Search for planning department pages

    return {
      url: null,
      hasZoningSection: false,
    };
  }

  // ===========================================================================
  // ZONING MODEL DETECTION
  // ===========================================================================

  private async detectZoningModel(
    input: Pass2ProbeInput,
    planningResult: { url: string | null }
  ): Promise<ZoningModelType> {
    // Check if state is known for no-zoning
    if (NO_ZONING_STATES.includes(input.state_code)) {
      // Need to verify — some counties in these states do have zoning
      // TODO: Check for no-zoning indicators
    }

    // Default to unknown
    return 'unknown';
  }

  // ===========================================================================
  // ZONING ORDINANCE DETECTION
  // ===========================================================================

  private async findZoningOrdinance(
    input: Pass2ProbeInput,
    planningUrl: string | null
  ): Promise<{
    url: string | null;
    accessMethod: DataAccessMethod;
    format: 'html' | 'pdf_searchable' | 'pdf_scanned' | 'unknown';
  }> {
    // TODO: Implement zoning ordinance detection

    return {
      url: null,
      accessMethod: 'not_available',
      format: 'unknown',
    };
  }

  // ===========================================================================
  // ZONING MAP DETECTION
  // ===========================================================================

  private async findZoningMaps(
    input: Pass2ProbeInput,
    planningUrl: string | null
  ): Promise<{
    url: string | null;
    accessMethod: DataAccessMethod;
    format: 'gis' | 'interactive_map' | 'pdf' | 'image' | 'unknown';
  }> {
    // TODO: Implement zoning map detection

    return {
      url: null,
      accessMethod: 'not_available',
      format: 'unknown',
    };
  }

  // ===========================================================================
  // DIMENSIONAL REQUIREMENTS DETECTION
  // ===========================================================================

  private async findDimensionalRequirements(
    input: Pass2ProbeInput,
    ordinanceUrl: string | null
  ): Promise<{
    found: boolean;
    url: string | null;
    accessMethod: DataAccessMethod;
    format: 'table' | 'narrative' | 'pdf' | 'unknown';
  }> {
    // TODO: Implement dimensional requirements detection

    return {
      found: false,
      url: null,
      accessMethod: 'not_available',
      format: 'unknown',
    };
  }

  // ===========================================================================
  // USE TABLE DETECTION
  // ===========================================================================

  private async findUseTables(
    input: Pass2ProbeInput,
    ordinanceUrl: string | null
  ): Promise<{
    found: boolean;
    url: string | null;
    accessMethod: DataAccessMethod;
    storageListsed: boolean | null;
  }> {
    // TODO: Implement use table detection

    return {
      found: false,
      url: null,
      accessMethod: 'not_available',
      storageListsed: null,
    };
  }

  // ===========================================================================
  // PERMIT CHECKLIST DETECTION
  // ===========================================================================

  private async findPermitChecklist(
    input: Pass2ProbeInput,
    planningUrl: string | null
  ): Promise<{
    url: string | null;
    accessMethod: DataAccessMethod;
  }> {
    // TODO: Implement permit checklist detection

    return {
      url: null,
      accessMethod: 'not_available',
    };
  }

  // ===========================================================================
  // FEE SCHEDULE DETECTION
  // ===========================================================================

  private async findFeeSchedule(
    input: Pass2ProbeInput,
    planningUrl: string | null
  ): Promise<{
    url: string | null;
    accessMethod: DataAccessMethod;
  }> {
    // TODO: Implement fee schedule detection

    return {
      url: null,
      accessMethod: 'not_available',
    };
  }

  // ===========================================================================
  // ADDITIONAL REQUIREMENTS
  // ===========================================================================

  private async findAdditionalRequirements(
    input: Pass2ProbeInput,
    availability: Pass2DataAvailability,
    planningUrl: string | null
  ): Promise<void> {
    // TODO: Find site plan, landscape, stormwater, fire requirements
  }

  // ===========================================================================
  // VIABILITY CALCULATION
  // ===========================================================================

  private calculateOverallViability(
    availability: Pass2DataAvailability
  ): 'high' | 'medium' | 'low' | 'none' {
    const ordinanceAvailable = availability.zoning_ordinance.availability === 'available';
    const dimensionalAvailable = availability.dimensional_requirements.availability === 'available';
    const ordinanceFormat = availability.zoning_ordinance.format;

    if (ordinanceAvailable && ordinanceFormat === 'html') return 'high';
    if (ordinanceAvailable && ordinanceFormat === 'pdf_searchable') return 'medium';
    if (ordinanceAvailable) return 'low';
    return 'none';
  }

  private determineHydrationRecommendation(
    availability: Pass2DataAvailability
  ): 'firecrawl' | 'retell' | 'manual' | 'hybrid' {
    const viability = availability.overall_viability;
    const ordinanceFormat = availability.zoning_ordinance.format;

    if (viability === 'high') return 'firecrawl';
    if (viability === 'medium' && ordinanceFormat === 'pdf_searchable') return 'firecrawl';
    if (viability === 'low') return 'hybrid';
    return 'manual';
  }

  private calculateConfidence(availability: Pass2DataAvailability): ConfidenceCeiling {
    const knownCount = [
      availability.zoning_ordinance.availability !== 'unknown',
      availability.zoning_maps.availability !== 'unknown',
      availability.dimensional_requirements.availability !== 'unknown',
      availability.use_tables.availability !== 'unknown',
    ].filter(Boolean).length;

    if (knownCount >= 4) return 'medium';
    if (knownCount >= 2) return 'low';
    return 'low';
  }
}

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

export async function probePass2Data(input: Pass2ProbeInput): Promise<Pass2ProbeResult> {
  const probe = new Pass2DataProbe();
  return probe.probe(input);
}
