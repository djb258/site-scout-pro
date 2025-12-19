/**
 * CCA (County Capability Asset) — Standalone Service Types
 * ============================================================================
 *
 * DOCTRINE:
 * CCA answers HOW we collect information from a county.
 * It does NOT answer WHAT the jurisdiction rules are.
 *
 * CCA must be collected UPFRONT before:
 *   - Pass 0 can gather permits/inspections
 *   - Pass 2 can hydrate jurisdiction cards
 *
 * ============================================================================
 */

// =============================================================================
// CORE ENUMS — What CCA classifies
// =============================================================================

/**
 * How can we automate data collection from this county?
 */
export type AutomationClass = 'api' | 'portal' | 'pdf' | 'manual';

/**
 * How is zoning information organized?
 * NOTE: This is about STRUCTURE, not rules.
 */
export type ZoningModelType = 'no_zoning' | 'county' | 'municipal' | 'mixed' | 'unknown';

/**
 * What type of permit system does the county use?
 */
export type PermitSystemType =
  | 'api'              // Modern API access
  | 'portal_scrape'    // Web portal (Accela, Tyler, etc.)
  | 'pdf_logs'         // PDF permit logs
  | 'manual_only'      // Phone/in-person only
  | 'unknown';

/**
 * What is the quality of online documents?
 */
export type DocumentQuality =
  | 'structured_html'  // Modern HTML, easy to scrape
  | 'searchable_pdf'   // PDF with text layer
  | 'scanned_pdf'      // Image-only PDF (OCR needed)
  | 'none'             // No online documents
  | 'unknown';

/**
 * Confidence in the CCA assessment
 */
export type ConfidenceCeiling = 'low' | 'medium' | 'high';

// =============================================================================
// CCA PROFILE — The complete capability assessment
// =============================================================================

/**
 * County Capability Profile — The core CCA data structure
 *
 * This is what gets stored in ref.ref_county_capability
 */
export interface CountyCapabilityProfile {
  // Identity
  county_id: number;
  county_fips: string;
  state_code: string;

  // =========================================================================
  // PERMIT SYSTEM CAPABILITIES (Used by Pass 0)
  // =========================================================================

  /** How can we access permit data? */
  permit_system_type: PermitSystemType;

  /** Are inspections linked to permits? */
  inspections_linked: boolean | null;

  /** Can we automate permit data collection? */
  permit_automation_viable: boolean;

  // =========================================================================
  // ZONING/PLANNING CAPABILITIES (Used by Pass 2)
  // =========================================================================

  /** How is zoning structured in this county? */
  zoning_model: ZoningModelType;

  /** What is the quality of zoning documents? */
  document_quality: DocumentQuality;

  /** Can we automate zoning data collection? */
  zoning_automation_viable: boolean;

  // =========================================================================
  // OVERALL AUTOMATION CLASS
  // =========================================================================

  /** Overall automation class for this county */
  automation_class: AutomationClass;

  /** Is full automation viable? */
  automation_viable: boolean;

  // =========================================================================
  // VENDOR & URLS
  // =========================================================================

  /** Detected permit system vendor (Accela, Tyler, etc.) */
  detected_vendor: string | null;

  /** URL to planning/zoning page */
  planning_url: string | null;

  /** URL to permit portal */
  permits_url: string | null;

  /** Source URLs used for detection */
  source_urls: string[];

  // =========================================================================
  // CONFIDENCE & TTL
  // =========================================================================

  /** Confidence ceiling for this assessment */
  confidence_ceiling: ConfidenceCeiling;

  /** When was this profile last verified? */
  last_verified_at: string;

  /** When does this profile expire? (12 months from verification) */
  expires_at: string;

  /** Is manual escalation required? */
  escalation_required: boolean;

  // =========================================================================
  // METADATA
  // =========================================================================

  /** Notes from probing */
  notes: string | null;

  /** Probe retry count */
  probe_retry_count: number;
}

// =============================================================================
// PROBE INPUT/OUTPUT
// =============================================================================

/**
 * Input to the CCA Probe
 */
export interface CcaProbeInput {
  county_id: number;
  county_fips: string;
  county_name: string;
  state_code: string;

  /** Force re-probe even if profile exists */
  force_reprobe?: boolean;
}

/**
 * Output from the CCA Probe
 */
export interface CcaProbeResult {
  success: boolean;
  profile: CountyCapabilityProfile | null;
  errors: string[];
  probe_duration_ms: number;
}

// =============================================================================
// PASS CONSUMPTION CONTRACTS
// =============================================================================

/**
 * What Pass 0 needs from CCA
 */
export interface CcaPass0Contract {
  county_id: number;

  /** Can Pass 0 automate permit data collection? */
  permit_automation_viable: boolean;

  /** What type of permit system? */
  permit_system_type: PermitSystemType;

  /** Are inspections linked? */
  inspections_linked: boolean | null;

  /** Confidence ceiling for Pass 0 signals */
  confidence_ceiling: ConfidenceCeiling;

  /** Permit portal URL */
  permits_url: string | null;

  /** Detected vendor */
  detected_vendor: string | null;
}

/**
 * What Pass 2 needs from CCA
 */
export interface CcaPass2Contract {
  county_id: number;

  /** Can Pass 2 automate zoning data collection? */
  zoning_automation_viable: boolean;

  /** How is zoning structured? */
  zoning_model: ZoningModelType;

  /** What is document quality? */
  document_quality: DocumentQuality;

  /** Confidence ceiling for Pass 2 hydration */
  confidence_ceiling: ConfidenceCeiling;

  /** Planning/zoning URL */
  planning_url: string | null;

  /** Hydration route recommendation */
  hydration_route: 'firecrawl' | 'retell' | 'manual_queue';
}

// =============================================================================
// SERVICE STATUS
// =============================================================================

/**
 * CCA Service status for a county
 */
export interface CcaServiceStatus {
  county_id: number;
  profile_exists: boolean;
  profile_expired: boolean;
  needs_probe: boolean;
  last_probe_at: string | null;
  next_probe_due: string | null;
}

// =============================================================================
// PROBE TRIGGER REASONS
// =============================================================================

export type ProbeReason =
  | 'missing'           // No profile exists
  | 'expired'           // Profile TTL exceeded
  | 'low_confidence'    // Profile has low confidence
  | 'manual_request'    // User requested re-probe
  | 'pass0_request'     // Pass 0 needs better data
  | 'pass2_request';    // Pass 2 needs better data

// =============================================================================
// CONSTANTS
// =============================================================================

/** Profile TTL in months */
export const CCA_TTL_MONTHS = 12;

/** Maximum probe retries */
export const CCA_MAX_RETRIES = 3;

/** Known permit system vendors */
export const KNOWN_VENDORS = [
  'accela',
  'tyler',
  'municity',
  'civicplus',
  'opengov',
  'granicus',
  'citizenserve',
  'bs&a',
] as const;

export type KnownVendor = typeof KNOWN_VENDORS[number];
