/**
 * DOCTRINE-LOCKED CAPABILITY PROBE
 * ADR-022 Compliant — Stage 1 Implementation
 *
 * RULES (IMMUTABLE):
 * - This is the ONLY process that writes to CCA
 * - No zoning rules extracted
 * - No numeric data extracted
 * - No assumptions — unknown is valid
 * - Output may be partially unknown
 * - Retry cap enforced
 * - Failure → unknown (not error)
 */

import {
  AutomationClass,
  ZoningModelV2,
  ConfidenceCeiling,
  CapabilityProbeInput,
  CapabilityProbeOutput,
  CcaAuditLogEntry,
  DEFAULT_PROBE_OUTPUT,
  TTL_MONTHS,
  validateProbeOutput,
} from './doctrine_types';

// =============================================================================
// PROBE CONFIGURATION (LOCKED)
// =============================================================================

const PROBE_CONFIG = {
  MAX_RETRIES: 3,
  TIMEOUT_MS: 10000,
  TTL_MONTHS: 12,
} as const;

// =============================================================================
// KNOWN VENDOR PATTERNS
// =============================================================================

const VENDOR_PATTERNS: Record<string, RegExp[]> = {
  accela: [/accela/i, /citizenaccess/i],
  tyler: [/tylertech/i, /energov/i],
  municity: [/municity/i],
  civicplus: [/civicplus/i],
  opengov: [/opengov/i],
};

// =============================================================================
// NO-ZONING STATE INDICATORS
// =============================================================================

const NO_ZONING_INDICATORS = [
  /no\s+zoning/i,
  /no\s+county\s+zoning/i,
  /unzoned/i,
  /no\s+zoning\s+ordinance/i,
];

// =============================================================================
// STAGE 1: CAPABILITY PROBE
// =============================================================================

export interface ProbeContext {
  input: CapabilityProbeInput;
  retryCount: number;
  startedAt: Date;
  auditLog: CcaAuditLogEntry[];
}

/**
 * Run the capability probe (Stage 1)
 *
 * DOCTRINE RULES:
 * - Deterministic steps
 * - Retry caps
 * - Failure → unknown
 * - TTL assignment logic
 */
export async function runCapabilityProbe(
  input: CapabilityProbeInput
): Promise<CapabilityProbeOutput> {
  const context: ProbeContext = {
    input,
    retryCount: 0,
    startedAt: new Date(),
    auditLog: [],
  };

  // Initialize with defaults (all unknown)
  const output: CapabilityProbeOutput = {
    ...DEFAULT_PROBE_OUTPUT,
    last_verified_at: new Date().toISOString(),
  };

  try {
    // Step 1: Detect planning/permits URLs
    const urls = await detectCountyUrls(context);
    output.source_urls = urls.source_urls;
    output.planning_url = urls.planning_url;
    output.permits_url = urls.permits_url;

    // Step 2: Detect automation class
    output.automation_class = await detectAutomationClass(context, urls);

    // Step 3: Detect zoning model
    output.zoning_model = await detectZoningModel(context, urls);

    // Step 4: Derive permit system type
    output.permit_system_type = derivePermitSystemType(output.automation_class);

    // Step 5: Detect vendor
    output.detected_vendor = detectVendor(urls.source_urls);

    // Step 6: Calculate confidence ceiling
    output.confidence_ceiling = calculateConfidenceCeiling(output);

    // Step 7: Set TTL
    output.ttl_months = TTL_MONTHS;

    // Log success
    logAudit(context, 'probe_complete', 'success', output.confidence_ceiling);

  } catch (error) {
    // DOCTRINE: Failure → unknown, not error
    output.error_message = error instanceof Error ? error.message : 'Unknown error';
    output.automation_class = 'manual';
    output.zoning_model = 'unknown';
    output.confidence_ceiling = 'low';

    logAudit(context, 'probe_failed', 'failure', 'low', {
      error: output.error_message,
    });
  }

  // Validate output
  const violations = validateProbeOutput(output);
  if (violations.length > 0) {
    output.error_message = `Validation violations: ${violations.join(', ')}`;
    logAudit(context, 'validation_failed', 'failure', 'low', { violations });
  }

  return output;
}

// =============================================================================
// STEP 1: DETECT COUNTY URLS
// =============================================================================

interface UrlDetectionResult {
  source_urls: string[];
  planning_url: string | null;
  permits_url: string | null;
}

async function detectCountyUrls(context: ProbeContext): Promise<UrlDetectionResult> {
  const result: UrlDetectionResult = {
    source_urls: [],
    planning_url: null,
    permits_url: null,
  };

  // DOCTRINE: Only detect URLs, do not scrape content
  const { county_name, state_code } = context.input;

  // Build search patterns
  const searchTerms = [
    `${county_name} county ${state_code} planning`,
    `${county_name} county ${state_code} permits`,
    `${county_name} county ${state_code} zoning`,
  ];

  // NOTE: In production, this would make HEAD requests to detect URLs
  // For now, return empty (unknown state is valid)
  logAudit(context, 'detect_urls', 'pending', 'low', { searchTerms });

  return result;
}

// =============================================================================
// STEP 2: DETECT AUTOMATION CLASS
// =============================================================================

async function detectAutomationClass(
  context: ProbeContext,
  urls: UrlDetectionResult
): Promise<AutomationClass> {
  // DOCTRINE: If no URLs found → manual
  if (urls.source_urls.length === 0) {
    logAudit(context, 'detect_automation_class', 'no_urls', 'low');
    return 'manual';
  }

  // Check for known API patterns
  for (const url of urls.source_urls) {
    if (url.includes('/api/') || url.includes('/rest/')) {
      logAudit(context, 'detect_automation_class', 'api_detected', 'medium', { url });
      return 'api';
    }
  }

  // Check for portal indicators
  for (const url of urls.source_urls) {
    for (const [vendor, patterns] of Object.entries(VENDOR_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(url)) {
          logAudit(context, 'detect_automation_class', 'portal_detected', 'medium', {
            url,
            vendor,
          });
          return 'portal';
        }
      }
    }
  }

  // Check for PDF patterns
  for (const url of urls.source_urls) {
    if (url.endsWith('.pdf') || url.includes('/pdf/')) {
      logAudit(context, 'detect_automation_class', 'pdf_detected', 'low', { url });
      return 'pdf';
    }
  }

  // Default to manual
  logAudit(context, 'detect_automation_class', 'default_manual', 'low');
  return 'manual';
}

// =============================================================================
// STEP 3: DETECT ZONING MODEL
// =============================================================================

async function detectZoningModel(
  context: ProbeContext,
  urls: UrlDetectionResult
): Promise<ZoningModelV2> {
  // DOCTRINE: Do not scrape ordinances, only detect structure

  // Check for no-zoning indicators in URLs
  for (const url of urls.source_urls) {
    for (const pattern of NO_ZONING_INDICATORS) {
      if (pattern.test(url)) {
        logAudit(context, 'detect_zoning_model', 'no_zoning_detected', 'medium', { url });
        return 'no_zoning';
      }
    }
  }

  // Check for municipal-only indicators
  const municipalPatterns = [/municipal/i, /city\s+zoning/i, /town\s+zoning/i];
  for (const url of urls.source_urls) {
    for (const pattern of municipalPatterns) {
      if (pattern.test(url)) {
        logAudit(context, 'detect_zoning_model', 'municipal_detected', 'low', { url });
        return 'municipal';
      }
    }
  }

  // DOCTRINE: If uncertain → unknown
  logAudit(context, 'detect_zoning_model', 'unknown', 'low');
  return 'unknown';
}

// =============================================================================
// STEP 4: DERIVE PERMIT SYSTEM TYPE
// =============================================================================

function derivePermitSystemType(automationClass: AutomationClass): string {
  // Direct mapping from automation_class
  switch (automationClass) {
    case 'api':
      return 'api';
    case 'portal':
      return 'portal_scrape';
    case 'pdf':
      return 'pdf_logs';
    case 'manual':
      return 'manual_only';
    default:
      return 'unknown';
  }
}

// =============================================================================
// STEP 5: DETECT VENDOR
// =============================================================================

function detectVendor(urls: string[]): string | null {
  for (const url of urls) {
    for (const [vendor, patterns] of Object.entries(VENDOR_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(url)) {
          return vendor;
        }
      }
    }
  }
  return null;
}

// =============================================================================
// STEP 6: CALCULATE CONFIDENCE CEILING
// =============================================================================

function calculateConfidenceCeiling(output: CapabilityProbeOutput): ConfidenceCeiling {
  // DOCTRINE: manual_only counties ALWAYS cap confidence at low
  if (output.automation_class === 'manual') {
    return 'low';
  }

  // API or portal with vendor → medium
  if (
    (output.automation_class === 'api' || output.automation_class === 'portal') &&
    output.detected_vendor
  ) {
    return 'medium';
  }

  // PDF → low
  if (output.automation_class === 'pdf') {
    return 'low';
  }

  // Unknown zoning model → low
  if (output.zoning_model === 'unknown') {
    return 'low';
  }

  // Default
  return 'low';
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

function logAudit(
  context: ProbeContext,
  action: string,
  result: string,
  confidence: ConfidenceCeiling,
  details?: Record<string, unknown>
): void {
  const entry: CcaAuditLogEntry = {
    county_fips: context.input.county_fips,
    stage: 'probe',
    action,
    result,
    confidence_ceiling: confidence,
    timestamp: new Date().toISOString(),
    source: 'automated',
    details,
  };
  context.auditLog.push(entry);
}

// =============================================================================
// RETRY LOGIC
// =============================================================================

/**
 * Check if probe should retry
 */
export function shouldRetryProbe(
  retryCount: number,
  error: Error | null
): boolean {
  // DOCTRINE: Enforce retry cap
  if (retryCount >= PROBE_CONFIG.MAX_RETRIES) {
    return false;
  }

  // Only retry on transient errors
  if (error?.message.includes('timeout') || error?.message.includes('network')) {
    return true;
  }

  return false;
}

/**
 * Run probe with retry logic
 */
export async function runCapabilityProbeWithRetry(
  input: CapabilityProbeInput
): Promise<CapabilityProbeOutput> {
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount <= PROBE_CONFIG.MAX_RETRIES) {
    try {
      return await runCapabilityProbe(input);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      retryCount++;

      if (!shouldRetryProbe(retryCount, lastError)) {
        break;
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
    }
  }

  // DOCTRINE: Failure → unknown, not error
  return {
    ...DEFAULT_PROBE_OUTPUT,
    error_message: lastError?.message || 'Max retries exceeded',
    last_verified_at: new Date().toISOString(),
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  PROBE_CONFIG,
  VENDOR_PATTERNS,
  NO_ZONING_INDICATORS,
};
