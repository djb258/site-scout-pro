/**
 * CCA Data Availability Types
 * ============================================================================
 *
 * DOCTRINE:
 * CCA tells us not just HOW to collect, but WHAT we CAN collect.
 * This determines what Pass 0 and Pass 2 can expect to find.
 *
 * ============================================================================
 */

import { ConfidenceCeiling } from './cca_types';

// =============================================================================
// DATA AVAILABILITY STATUS
// =============================================================================

/**
 * Is this data available from this county?
 */
export type DataAvailability =
  | 'available'           // Data exists and can be collected
  | 'partial'             // Some data available, not complete
  | 'unavailable'         // Data does not exist online
  | 'requires_request'    // Must request via FOIA/records request
  | 'unknown';            // Haven't determined yet

/**
 * How is the data accessed?
 */
export type DataAccessMethod =
  | 'api'                 // Direct API access
  | 'web_portal'          // Web portal (scrape or interact)
  | 'pdf_download'        // PDF files available
  | 'phone_call'          // Must call to get data
  | 'in_person'           // Must visit in person
  | 'email_request'       // Email to request
  | 'foia'                // FOIA/public records request
  | 'not_available';      // Data doesn't exist

// =============================================================================
// PASS 0 DATA AVAILABILITY — What permit/inspection data can we get?
// =============================================================================

export interface Pass0DataAvailability {
  // =========================================================================
  // PERMIT DATA
  // =========================================================================

  /** Can we get permit applications? */
  permit_applications: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    data_freshness: 'real_time' | 'daily' | 'weekly' | 'monthly' | 'unknown';
    historical_depth_years: number | null;  // How far back does data go?
    url: string | null;
  };

  /** Can we get permit issuance records? */
  permit_issuances: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    data_freshness: 'real_time' | 'daily' | 'weekly' | 'monthly' | 'unknown';
    historical_depth_years: number | null;
    url: string | null;
  };

  /** Can we get permit status/tracking? */
  permit_status: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    url: string | null;
  };

  // =========================================================================
  // INSPECTION DATA
  // =========================================================================

  /** Can we get inspection records? */
  inspection_records: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    linked_to_permits: boolean | null;
    url: string | null;
  };

  /** Can we get inspection schedules? */
  inspection_schedules: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    url: string | null;
  };

  // =========================================================================
  // CONTRACTOR DATA
  // =========================================================================

  /** Can we get contractor license data? */
  contractor_licenses: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    url: string | null;
  };

  // =========================================================================
  // SUMMARY
  // =========================================================================

  /** Overall Pass 0 data collection viability */
  overall_viability: 'high' | 'medium' | 'low' | 'none';

  /** Confidence in this assessment */
  confidence: ConfidenceCeiling;

  /** Notes on Pass 0 data collection */
  notes: string | null;
}

// =============================================================================
// PASS 2 DATA AVAILABILITY — What zoning/jurisdiction data can we get?
// =============================================================================

export interface Pass2DataAvailability {
  // =========================================================================
  // ZONING DATA
  // =========================================================================

  /** Can we get zoning ordinance text? */
  zoning_ordinance: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    format: 'html' | 'pdf_searchable' | 'pdf_scanned' | 'unknown';
    url: string | null;
  };

  /** Can we get zoning maps? */
  zoning_maps: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    format: 'gis' | 'interactive_map' | 'pdf' | 'image' | 'unknown';
    url: string | null;
  };

  /** Can we get dimensional requirements (setbacks, coverage, etc.)? */
  dimensional_requirements: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    format: 'table' | 'narrative' | 'pdf' | 'unknown';
    url: string | null;
  };

  /** Can we get use tables (what's allowed where)? */
  use_tables: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    storage_specifically_listed: boolean | null;
    url: string | null;
  };

  // =========================================================================
  // SITE PLAN REQUIREMENTS
  // =========================================================================

  /** Can we get site plan requirements? */
  site_plan_requirements: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    url: string | null;
  };

  /** Can we get landscape requirements? */
  landscape_requirements: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    url: string | null;
  };

  // =========================================================================
  // STORMWATER
  // =========================================================================

  /** Can we get stormwater requirements? */
  stormwater_requirements: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    url: string | null;
  };

  // =========================================================================
  // FIRE CODE
  // =========================================================================

  /** Can we get fire code requirements? */
  fire_code_requirements: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    authority: 'county' | 'fire_district' | 'state' | 'unknown';
    url: string | null;
  };

  // =========================================================================
  // PERMIT CHECKLIST
  // =========================================================================

  /** Can we get a list of required permits? */
  permit_checklist: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    url: string | null;
  };

  // =========================================================================
  // FEES
  // =========================================================================

  /** Can we get fee schedules? */
  fee_schedules: {
    availability: DataAvailability;
    access_method: DataAccessMethod;
    url: string | null;
  };

  // =========================================================================
  // SUMMARY
  // =========================================================================

  /** Overall Pass 2 data collection viability */
  overall_viability: 'high' | 'medium' | 'low' | 'none';

  /** Recommended hydration approach */
  hydration_recommendation: 'firecrawl' | 'retell' | 'manual' | 'hybrid';

  /** Confidence in this assessment */
  confidence: ConfidenceCeiling;

  /** Notes on Pass 2 data collection */
  notes: string | null;
}

// =============================================================================
// FULL CCA DATA AVAILABILITY — Combined for both passes
// =============================================================================

export interface CcaDataAvailability {
  county_id: number;
  county_fips: string;

  /** Pass 0 data availability */
  pass0: Pass0DataAvailability;

  /** Pass 2 data availability */
  pass2: Pass2DataAvailability;

  /** When was this assessed? */
  assessed_at: string;

  /** When should this be re-assessed? */
  reassess_after: string;
}

// =============================================================================
// DEFAULT / EMPTY DATA AVAILABILITY
// =============================================================================

export function createEmptyPass0Availability(): Pass0DataAvailability {
  return {
    permit_applications: {
      availability: 'unknown',
      access_method: 'not_available',
      data_freshness: 'unknown',
      historical_depth_years: null,
      url: null,
    },
    permit_issuances: {
      availability: 'unknown',
      access_method: 'not_available',
      data_freshness: 'unknown',
      historical_depth_years: null,
      url: null,
    },
    permit_status: {
      availability: 'unknown',
      access_method: 'not_available',
      url: null,
    },
    inspection_records: {
      availability: 'unknown',
      access_method: 'not_available',
      linked_to_permits: null,
      url: null,
    },
    inspection_schedules: {
      availability: 'unknown',
      access_method: 'not_available',
      url: null,
    },
    contractor_licenses: {
      availability: 'unknown',
      access_method: 'not_available',
      url: null,
    },
    overall_viability: 'none',
    confidence: 'low',
    notes: null,
  };
}

export function createEmptyPass2Availability(): Pass2DataAvailability {
  return {
    zoning_ordinance: {
      availability: 'unknown',
      access_method: 'not_available',
      format: 'unknown',
      url: null,
    },
    zoning_maps: {
      availability: 'unknown',
      access_method: 'not_available',
      format: 'unknown',
      url: null,
    },
    dimensional_requirements: {
      availability: 'unknown',
      access_method: 'not_available',
      format: 'unknown',
      url: null,
    },
    use_tables: {
      availability: 'unknown',
      access_method: 'not_available',
      storage_specifically_listed: null,
      url: null,
    },
    site_plan_requirements: {
      availability: 'unknown',
      access_method: 'not_available',
      url: null,
    },
    landscape_requirements: {
      availability: 'unknown',
      access_method: 'not_available',
      url: null,
    },
    stormwater_requirements: {
      availability: 'unknown',
      access_method: 'not_available',
      url: null,
    },
    fire_code_requirements: {
      availability: 'unknown',
      access_method: 'not_available',
      authority: 'unknown',
      url: null,
    },
    permit_checklist: {
      availability: 'unknown',
      access_method: 'not_available',
      url: null,
    },
    fee_schedules: {
      availability: 'unknown',
      access_method: 'not_available',
      url: null,
    },
    overall_viability: 'none',
    hydration_recommendation: 'manual',
    confidence: 'low',
    notes: null,
  };
}
