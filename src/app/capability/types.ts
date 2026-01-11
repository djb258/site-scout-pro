/**
 * County Capability Asset (CCA) Types
 *
 * DOCTRINE: This layer answers HOW to get information from a county,
 * NOT what the rules are. Capability ≠ jurisdiction rules.
 *
 * - 12-month TTL with automatic expiration
 * - "unknown" is a valid first-class state
 * - "no_zoning" is a valid first-class zoning model
 * - No coupling to Pass 2 math or jurisdiction constraints
 */

// =============================================================================
// ENUM TYPES (match Neon schema)
// =============================================================================

/**
 * Zoning model classification
 * Describes HOW zoning is structured, not WHAT the zones allow
 */
export type ZoningModel =
  | 'countywide'       // County has unified zoning ordinance
  | 'municipal_only'   // Zoning delegated to municipalities
  | 'overlay_based'    // Zoning via overlay districts
  | 'no_zoning'        // County has no zoning (valid first-class model)
  | 'unknown';         // Not yet determined

/**
 * Permit system classification
 * Describes HOW permits are accessed, not permit requirements
 */
export type PermitSystem =
  | 'api'              // Programmatic API access available
  | 'portal_scrape'    // Web portal that can be scraped
  | 'pdf_logs'         // PDF-based permit logs
  | 'manual_only'      // Phone/in-person only
  | 'unknown';         // Not yet determined

/**
 * Document quality classification
 * Describes HOW documents are formatted, not content
 */
export type DocumentQuality =
  | 'structured_html'  // Modern HTML with semantic markup
  | 'searchable_pdf'   // PDF with text layer
  | 'scanned_pdf'      // Image-only PDF (OCR required)
  | 'none'             // No online documents
  | 'unknown';         // Not yet determined

/**
 * Confidence level for capability assessment
 */
export type ConfidenceLevel =
  | 'low'              // Initial probe, limited signals
  | 'medium'           // Multiple signals confirmed
  | 'high';            // Verified by manual review

// =============================================================================
// PROBE INPUT/OUTPUT TYPES
// =============================================================================

/**
 * Input to the CapabilityProbe
 */
export interface CapabilityProbeInput {
  county_id: number;
  county_name: string;
  state_code: string;
}

/**
 * Output from the CapabilityProbe
 */
export interface CountyCapabilityProfile {
  // Identity
  county_id: number;

  // Capability classifications
  zoning_model: ZoningModel;
  permit_system: PermitSystem;
  document_quality: DocumentQuality;
  inspections_linked: boolean | null;

  // Computed viability
  automation_viable: boolean;

  // Metadata
  confidence_level: ConfidenceLevel;
  detected_vendor: string | null;
  planning_url: string | null;
  permits_url: string | null;
  notes: string | null;

  // Timestamps
  last_verified_at: string;  // ISO timestamp
  expires_at: string;        // ISO timestamp
}

/**
 * Partial profile for updates
 */
export interface CountyCapabilityProfileUpdate {
  zoning_model?: ZoningModel;
  permit_system?: PermitSystem;
  document_quality?: DocumentQuality;
  inspections_linked?: boolean | null;
  confidence_level?: ConfidenceLevel;
  detected_vendor?: string | null;
  planning_url?: string | null;
  permits_url?: string | null;
  notes?: string | null;
}

// =============================================================================
// DETECTOR TYPES
// =============================================================================

/**
 * Result from a single detector
 */
export interface DetectorResult<T> {
  value: T;
  confidence: ConfidenceLevel;
  signals: DetectorSignal[];
}

/**
 * A signal detected during probing
 */
export interface DetectorSignal {
  type: string;           // e.g., 'vendor_detected', 'page_found', 'mime_type'
  description: string;    // Human-readable description
  source: string;         // URL or source identifier
}

/**
 * Zoning model detector result
 */
export type ZoningModelDetectorResult = DetectorResult<ZoningModel>;

/**
 * Permit system detector result
 */
export type PermitSystemDetectorResult = DetectorResult<PermitSystem>;

/**
 * Document quality detector result
 */
export type DocumentQualityDetectorResult = DetectorResult<DocumentQuality>;

/**
 * Inspection linkage detector result
 */
export type InspectionLinkageDetectorResult = DetectorResult<boolean | null>;

// =============================================================================
// KNOWN VENDORS
// =============================================================================

/**
 * Known permit system vendors
 * Used for vendor detection in CapabilityProbe
 */
export const KNOWN_PERMIT_VENDORS = [
  'accela',
  'tyler',
  'municity',
  'civicplus',
  'govqa',
  'opengov',
  'granicus',
  'citizenserve',
  'viewpoint',
  'bs&a',
] as const;

export type KnownPermitVendor = typeof KNOWN_PERMIT_VENDORS[number];

/**
 * Vendor URL patterns for detection
 */
export const VENDOR_URL_PATTERNS: Record<KnownPermitVendor, RegExp[]> = {
  accela: [
    /aca-prod\.accela\.com/i,
    /citizenaccess\.accela\.com/i,
    /accela\.com/i,
  ],
  tyler: [
    /tylertech\.com/i,
    /tylerst\.com/i,
    /energov/i,
  ],
  municity: [
    /municity\.com/i,
    /munilink/i,
  ],
  civicplus: [
    /civicplus\.com/i,
    /civiclive/i,
  ],
  govqa: [
    /govqa\.us/i,
  ],
  opengov: [
    /opengov\.com/i,
  ],
  granicus: [
    /granicus\.com/i,
  ],
  citizenserve: [
    /citizenserve\.com/i,
  ],
  viewpoint: [
    /viewpointcloud\.com/i,
  ],
  'bs&a': [
    /bsasoftware\.com/i,
    /bs-a\.com/i,
  ],
};

// =============================================================================
// NO-ZONING STATES
// =============================================================================

/**
 * States known to have counties with no zoning
 * This is not exhaustive — probe must still check
 */
export const NO_ZONING_STATES = [
  'TX',  // Texas — many rural counties
  'MT',  // Montana — most counties
  'AZ',  // Arizona — some counties
  'NV',  // Nevada — some counties
  'ID',  // Idaho — some counties
  'WY',  // Wyoming — some counties
  'SD',  // South Dakota — some counties
  'ND',  // North Dakota — some counties
] as const;

// =============================================================================
// TTL CONSTANTS
// =============================================================================

/**
 * Profile expiration in milliseconds (12 months)
 */
export const PROFILE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Profile expiration in days
 */
export const PROFILE_TTL_DAYS = 365;

// =============================================================================
// AUTOMATION VIABILITY RULES
// =============================================================================

/**
 * Check if a profile is automation-viable
 * Matches the computed column in the database
 */
export function isAutomationViable(
  permitSystem: PermitSystem,
  documentQuality: DocumentQuality
): boolean {
  const viablePermitSystems: PermitSystem[] = ['api', 'portal_scrape'];
  const viableDocumentQualities: DocumentQuality[] = ['structured_html', 'searchable_pdf'];

  return (
    viablePermitSystems.includes(permitSystem) &&
    viableDocumentQualities.includes(documentQuality)
  );
}

/**
 * Check if a profile is expired
 */
export function isProfileExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
}

/**
 * Calculate expiration date from verification date
 */
export function calculateExpiration(verifiedAt: Date): Date {
  const expires = new Date(verifiedAt);
  expires.setFullYear(expires.getFullYear() + 1);
  return expires;
}

// =============================================================================
// AGGREGATE TYPES
// =============================================================================

/**
 * Full probe result with all detectors
 */
export interface CapabilityProbeResult {
  profile: CountyCapabilityProfile;
  zoning_detection: ZoningModelDetectorResult;
  permit_detection: PermitSystemDetectorResult;
  document_detection: DocumentQualityDetectorResult;
  inspection_detection: InspectionLinkageDetectorResult;
  probe_duration_ms: number;
  errors: string[];
}

/**
 * Probe status for tracking
 */
export type ProbeStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

/**
 * Probe request for queueing
 */
export interface CapabilityProbeRequest {
  county_id: number;
  county_name: string;
  state_code: string;
  priority: 'high' | 'medium' | 'low';
  reason: 'missing' | 'expired' | 'pass2_scope' | 'manual';
}
