/**
 * Permit System Detector
 *
 * DOCTRINE: Detect HOW permits are accessed, not permit requirements.
 * This is a CHEAP probe — no scraping, no API calls, no PDF parsing.
 *
 * Allowed signals:
 * - Presence of permits page
 * - Known vendor URL patterns
 * - Page structure indicators
 *
 * NOT allowed:
 * - Scraping permit data
 * - Calling permit APIs
 * - Parsing PDFs
 */

import type {
  PermitSystem,
  PermitSystemDetectorResult,
  DetectorSignal,
  ConfidenceLevel,
  KnownPermitVendor,
} from '../types';
import { VENDOR_URL_PATTERNS, KNOWN_PERMIT_VENDORS } from '../types';

/**
 * Input for permit system detection
 */
export interface PermitSystemDetectorInput {
  county_name: string;
  state_code: string;
  permits_url?: string | null;
  planning_url?: string | null;
  page_content_snippet?: string | null;  // First 5000 chars of page
}

/**
 * Detect the permit system type for a county
 *
 * This is a CHEAP detection — uses only URL patterns and page indicators.
 * Does NOT scrape, call APIs, or parse documents.
 */
export function detectPermitSystem(
  input: PermitSystemDetectorInput
): PermitSystemDetectorResult {
  const signals: DetectorSignal[] = [];
  let detectedVendor: KnownPermitVendor | null = null;
  let confidence: ConfidenceLevel = 'low';
  let value: PermitSystem = 'unknown';

  // Check permits URL for known vendors
  if (input.permits_url) {
    const vendor = detectVendorFromUrl(input.permits_url);
    if (vendor) {
      detectedVendor = vendor;
      signals.push({
        type: 'vendor_detected',
        description: `Detected ${vendor} from permits URL`,
        source: input.permits_url,
      });

      // Known vendors typically have portal access
      value = 'portal_scrape';
      confidence = 'medium';

      // Some vendors have APIs
      if (vendor === 'accela' || vendor === 'tyler') {
        signals.push({
          type: 'api_likely',
          description: `${vendor} typically provides API access`,
          source: input.permits_url,
        });
        value = 'api';
      }
    }
  }

  // Check planning URL for known vendors (fallback)
  if (input.planning_url && !detectedVendor) {
    const vendor = detectVendorFromUrl(input.planning_url);
    if (vendor) {
      detectedVendor = vendor;
      signals.push({
        type: 'vendor_detected',
        description: `Detected ${vendor} from planning URL`,
        source: input.planning_url,
      });
      value = 'portal_scrape';
      confidence = 'medium';
    }
  }

  // Check page content for indicators
  if (input.page_content_snippet) {
    const contentSignals = detectFromPageContent(input.page_content_snippet);
    signals.push(...contentSignals.signals);

    if (contentSignals.permit_system !== 'unknown' && value === 'unknown') {
      value = contentSignals.permit_system;
      confidence = contentSignals.confidence;
    }
  }

  // No signals found
  if (signals.length === 0) {
    signals.push({
      type: 'no_signals',
      description: 'No permit system indicators found',
      source: 'detectPermitSystem',
    });
  }

  return {
    value,
    confidence,
    signals,
  };
}

/**
 * Detect vendor from URL patterns
 */
function detectVendorFromUrl(url: string): KnownPermitVendor | null {
  for (const vendor of KNOWN_PERMIT_VENDORS) {
    const patterns = VENDOR_URL_PATTERNS[vendor];
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        return vendor;
      }
    }
  }
  return null;
}

/**
 * Detect permit system from page content (cheap indicators only)
 */
function detectFromPageContent(content: string): {
  permit_system: PermitSystem;
  confidence: ConfidenceLevel;
  signals: DetectorSignal[];
} {
  const signals: DetectorSignal[] = [];
  const lowerContent = content.toLowerCase();

  // Check for API mentions
  if (
    lowerContent.includes('api') &&
    (lowerContent.includes('permit') || lowerContent.includes('developer'))
  ) {
    signals.push({
      type: 'api_mention',
      description: 'Page mentions API access',
      source: 'page_content',
    });
    return { permit_system: 'api', confidence: 'low', signals };
  }

  // Check for online portal indicators
  const portalIndicators = [
    'apply online',
    'submit online',
    'online permit',
    'permit portal',
    'citizen access',
    'self-service',
    'login to apply',
    'create account',
  ];

  for (const indicator of portalIndicators) {
    if (lowerContent.includes(indicator)) {
      signals.push({
        type: 'portal_indicator',
        description: `Found portal indicator: "${indicator}"`,
        source: 'page_content',
      });
      return { permit_system: 'portal_scrape', confidence: 'low', signals };
    }
  }

  // Check for PDF-only indicators
  const pdfIndicators = [
    'download application',
    'print and mail',
    'pdf application',
    'fillable form',
  ];

  for (const indicator of pdfIndicators) {
    if (lowerContent.includes(indicator)) {
      signals.push({
        type: 'pdf_indicator',
        description: `Found PDF indicator: "${indicator}"`,
        source: 'page_content',
      });
      return { permit_system: 'pdf_logs', confidence: 'low', signals };
    }
  }

  // Check for manual-only indicators
  const manualIndicators = [
    'call for information',
    'visit our office',
    'in person only',
    'schedule appointment',
    'contact planning',
  ];

  for (const indicator of manualIndicators) {
    if (lowerContent.includes(indicator)) {
      signals.push({
        type: 'manual_indicator',
        description: `Found manual indicator: "${indicator}"`,
        source: 'page_content',
      });
      return { permit_system: 'manual_only', confidence: 'low', signals };
    }
  }

  return { permit_system: 'unknown', confidence: 'low', signals };
}

/**
 * Export detected vendor for use in profile
 */
export function getDetectedVendor(
  permitsUrl?: string | null,
  planningUrl?: string | null
): string | null {
  if (permitsUrl) {
    const vendor = detectVendorFromUrl(permitsUrl);
    if (vendor) return vendor;
  }
  if (planningUrl) {
    const vendor = detectVendorFromUrl(planningUrl);
    if (vendor) return vendor;
  }
  return null;
}
