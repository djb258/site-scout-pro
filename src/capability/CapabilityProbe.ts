/**
 * CapabilityProbe
 *
 * DOCTRINE: This is a CHEAP, DETERMINISTIC probe that classifies county capabilities.
 * It answers HOW information can be obtained from a county, NOT what the rules are.
 *
 * PURPOSE:
 * - Decide automation vs manual research
 * - Control cost before scraping
 * - Prevent impossible automation attempts
 * - Feed Pass 2 hydration routing
 *
 * ALLOWED:
 * - Presence checks (does page exist?)
 * - Known vendor detection (Accela, Tyler, etc.)
 * - PDF MIME type detection
 * - Presence of searchable inputs
 * - Explicit "no zoning" statements
 *
 * NOT ALLOWED:
 * - Scrape ordinances
 * - Parse PDFs
 * - Call external APIs (beyond simple HEAD requests)
 * - Estimate rules
 * - Hydrate jurisdiction cards
 *
 * TTL: 12 months — profiles expire and must be re-probed
 */

import type {
  CapabilityProbeInput,
  CapabilityProbeResult,
  CountyCapabilityProfile,
  ConfidenceLevel,
  ZoningModelDetectorResult,
  PermitSystemDetectorResult,
  DocumentQualityDetectorResult,
  InspectionLinkageDetectorResult,
} from './types';
import {
  isAutomationViable,
  calculateExpiration,
  PROFILE_TTL_MS,
} from './types';
import {
  detectPermitSystem,
  detectZoningModel,
  detectDocumentQuality,
  detectInspectionLinkage,
  getDetectedVendor,
  extractDocumentLinks,
} from './detectors';

// =============================================================================
// PROBE CONFIGURATION
// =============================================================================

/**
 * Configuration for the CapabilityProbe
 */
export interface CapabilityProbeConfig {
  /**
   * Timeout for URL checks in milliseconds
   * Default: 5000 (5 seconds)
   */
  urlCheckTimeout?: number;

  /**
   * Whether to skip URL checks (for testing)
   * Default: false
   */
  skipUrlChecks?: boolean;

  /**
   * Maximum content snippet length to analyze
   * Default: 5000 characters
   */
  maxContentLength?: number;
}

const DEFAULT_CONFIG: Required<CapabilityProbeConfig> = {
  urlCheckTimeout: 5000,
  skipUrlChecks: false,
  maxContentLength: 5000,
};

// =============================================================================
// URL CONSTRUCTION
// =============================================================================

/**
 * Construct likely planning department URL for a county
 */
function constructPlanningUrl(countyName: string, stateCode: string): string {
  // Normalize county name for URL
  const normalized = countyName
    .toLowerCase()
    .replace(/\s+county$/i, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');

  // Common URL patterns
  return `https://www.${normalized}county${stateCode.toLowerCase()}.gov/planning`;
}

/**
 * Construct likely permits URL for a county
 */
function constructPermitsUrl(countyName: string, stateCode: string): string {
  const normalized = countyName
    .toLowerCase()
    .replace(/\s+county$/i, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');

  return `https://www.${normalized}county${stateCode.toLowerCase()}.gov/permits`;
}

// =============================================================================
// CAPABILITY PROBE
// =============================================================================

/**
 * Run the CapabilityProbe for a county
 *
 * This is a CHEAP probe that does NOT:
 * - Scrape ordinances
 * - Parse PDFs
 * - Call external APIs
 * - Estimate or guess values
 *
 * @param input - County identification
 * @param config - Probe configuration
 * @param pageContent - Optional page content (if already fetched)
 * @returns CapabilityProbeResult with profile and detection details
 */
export async function runCapabilityProbe(
  input: CapabilityProbeInput,
  config: CapabilityProbeConfig = {},
  pageContent?: {
    planning_page?: string | null;
    permits_page?: string | null;
  }
): Promise<CapabilityProbeResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Construct URLs
  const planningUrl = constructPlanningUrl(input.county_name, input.state_code);
  const permitsUrl = constructPermitsUrl(input.county_name, input.state_code);

  // Get page content snippets (truncated for cheap analysis)
  const planningContent = pageContent?.planning_page
    ? pageContent.planning_page.slice(0, cfg.maxContentLength)
    : null;
  const permitsContent = pageContent?.permits_page
    ? pageContent.permits_page.slice(0, cfg.maxContentLength)
    : null;

  // Extract document links if we have content
  const documentLinks = planningContent
    ? extractDocumentLinks(planningContent)
    : [];

  // =========================================================================
  // RUN DETECTORS
  // =========================================================================

  // 1. Detect zoning model
  let zoningDetection: ZoningModelDetectorResult;
  try {
    zoningDetection = detectZoningModel({
      county_name: input.county_name,
      state_code: input.state_code,
      planning_url: planningUrl,
      page_content_snippet: planningContent,
    });
  } catch (e) {
    errors.push(`Zoning detection failed: ${e}`);
    zoningDetection = {
      value: 'unknown',
      confidence: 'low',
      signals: [{ type: 'error', description: String(e), source: 'detectZoningModel' }],
    };
  }

  // 2. Detect permit system
  let permitDetection: PermitSystemDetectorResult;
  try {
    permitDetection = detectPermitSystem({
      county_name: input.county_name,
      state_code: input.state_code,
      permits_url: permitsUrl,
      planning_url: planningUrl,
      page_content_snippet: permitsContent || planningContent,
    });
  } catch (e) {
    errors.push(`Permit system detection failed: ${e}`);
    permitDetection = {
      value: 'unknown',
      confidence: 'low',
      signals: [{ type: 'error', description: String(e), source: 'detectPermitSystem' }],
    };
  }

  // 3. Detect document quality
  let documentDetection: DocumentQualityDetectorResult;
  try {
    documentDetection = detectDocumentQuality({
      county_name: input.county_name,
      state_code: input.state_code,
      planning_url: planningUrl,
      page_content_snippet: planningContent,
      document_links: documentLinks,
    });
  } catch (e) {
    errors.push(`Document quality detection failed: ${e}`);
    documentDetection = {
      value: 'unknown',
      confidence: 'low',
      signals: [{ type: 'error', description: String(e), source: 'detectDocumentQuality' }],
    };
  }

  // 4. Detect inspection linkage
  let inspectionDetection: InspectionLinkageDetectorResult;
  try {
    inspectionDetection = detectInspectionLinkage({
      county_name: input.county_name,
      state_code: input.state_code,
      permits_url: permitsUrl,
      page_content_snippet: permitsContent || planningContent,
    });
  } catch (e) {
    errors.push(`Inspection linkage detection failed: ${e}`);
    inspectionDetection = {
      value: null,
      confidence: 'low',
      signals: [{ type: 'error', description: String(e), source: 'detectInspectionLinkage' }],
    };
  }

  // =========================================================================
  // COMPUTE AGGREGATE CONFIDENCE
  // =========================================================================

  const confidenceLevels: ConfidenceLevel[] = [
    zoningDetection.confidence,
    permitDetection.confidence,
    documentDetection.confidence,
    inspectionDetection.confidence,
  ];

  const aggregateConfidence = computeAggregateConfidence(confidenceLevels);

  // =========================================================================
  // COMPUTE AUTOMATION VIABILITY
  // =========================================================================

  const automationViable = isAutomationViable(
    permitDetection.value,
    documentDetection.value
  );

  // =========================================================================
  // BUILD PROFILE
  // =========================================================================

  const now = new Date();
  const expiresAt = calculateExpiration(now);

  // Get detected vendor
  const detectedVendor = getDetectedVendor(permitsUrl, planningUrl);

  const profile: CountyCapabilityProfile = {
    county_id: input.county_id,
    zoning_model: zoningDetection.value,
    permit_system: permitDetection.value,
    document_quality: documentDetection.value,
    inspections_linked: inspectionDetection.value,
    automation_viable: automationViable,
    confidence_level: aggregateConfidence,
    detected_vendor: detectedVendor,
    planning_url: planningUrl,
    permits_url: permitsUrl,
    notes: buildProbeNotes(
      zoningDetection,
      permitDetection,
      documentDetection,
      inspectionDetection
    ),
    last_verified_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  // =========================================================================
  // RETURN RESULT
  // =========================================================================

  const endTime = Date.now();

  return {
    profile,
    zoning_detection: zoningDetection,
    permit_detection: permitDetection,
    document_detection: documentDetection,
    inspection_detection: inspectionDetection,
    probe_duration_ms: endTime - startTime,
    errors,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Compute aggregate confidence from individual detector confidences
 */
function computeAggregateConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  const counts = {
    high: levels.filter(l => l === 'high').length,
    medium: levels.filter(l => l === 'medium').length,
    low: levels.filter(l => l === 'low').length,
  };

  // Need majority medium or better for medium confidence
  if (counts.high >= 2 || (counts.high >= 1 && counts.medium >= 2)) {
    return 'medium';
  }
  if (counts.medium >= 2) {
    return 'medium';
  }
  return 'low';
}

/**
 * Build probe notes from detection results
 */
function buildProbeNotes(
  zoning: ZoningModelDetectorResult,
  permit: PermitSystemDetectorResult,
  document: DocumentQualityDetectorResult,
  inspection: InspectionLinkageDetectorResult
): string {
  const notes: string[] = [];

  // Summarize key signals
  const keySignals = [
    ...zoning.signals.filter(s => s.type !== 'no_signals'),
    ...permit.signals.filter(s => s.type !== 'no_signals'),
    ...document.signals.filter(s => s.type !== 'no_signals'),
    ...inspection.signals.filter(s => s.type !== 'no_signals'),
  ];

  if (keySignals.length === 0) {
    return 'No significant signals detected during probe.';
  }

  // Group by type
  const vendorSignals = keySignals.filter(s => s.type.includes('vendor'));
  const modelSignals = keySignals.filter(
    s => s.type.includes('zoning') || s.type.includes('municipal')
  );

  if (vendorSignals.length > 0) {
    notes.push(`Vendor: ${vendorSignals.map(s => s.description).join('; ')}`);
  }

  if (modelSignals.length > 0) {
    notes.push(`Zoning: ${modelSignals.map(s => s.description).join('; ')}`);
  }

  return notes.join(' | ') || `Detected ${keySignals.length} signals.`;
}

// =============================================================================
// SHOULD PROBE HELPERS
// =============================================================================

/**
 * Check if a county needs probing
 */
export function shouldProbeCounty(
  existingProfile: CountyCapabilityProfile | null,
  reason: 'missing' | 'expired' | 'pass2_scope' | 'manual'
): boolean {
  // Always probe if no profile exists
  if (!existingProfile) {
    return true;
  }

  // Always probe if manual request
  if (reason === 'manual') {
    return true;
  }

  // Check expiration
  const now = new Date();
  const expiresAt = new Date(existingProfile.expires_at);

  if (now > expiresAt) {
    return true;
  }

  // Pass 2 scope: probe if confidence is low
  if (reason === 'pass2_scope' && existingProfile.confidence_level === 'low') {
    return true;
  }

  return false;
}

/**
 * Get time until profile expires
 */
export function getTimeUntilExpiration(profile: CountyCapabilityProfile): number {
  const now = new Date();
  const expiresAt = new Date(profile.expires_at);
  return Math.max(0, expiresAt.getTime() - now.getTime());
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  CapabilityProbeInput,
  CapabilityProbeResult,
  CountyCapabilityProfile,
} from './types';
