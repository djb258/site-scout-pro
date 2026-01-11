/**
 * Inspection Linkage Detector
 *
 * DOCTRINE: Detect whether inspection records are linked to permits.
 * This is a CHEAP probe — no data extraction, no API calls.
 *
 * Allowed signals:
 * - Presence of inspection search/lookup
 * - Combined permit + inspection portals
 * - Page structure indicators
 *
 * NOT allowed:
 * - Querying inspection records
 * - Parsing inspection data
 * - Calling inspection APIs
 */

import type {
  InspectionLinkageDetectorResult,
  DetectorSignal,
  ConfidenceLevel,
} from '../types';

/**
 * Input for inspection linkage detection
 */
export interface InspectionLinkageDetectorInput {
  county_name: string;
  state_code: string;
  permits_url?: string | null;
  page_content_snippet?: string | null;  // First 5000 chars of page
}

/**
 * Detect whether inspection records are linked to permits
 *
 * This is a CHEAP detection — uses only page indicators.
 * Does NOT query or parse inspection records.
 */
export function detectInspectionLinkage(
  input: InspectionLinkageDetectorInput
): InspectionLinkageDetectorResult {
  const signals: DetectorSignal[] = [];
  let confidence: ConfidenceLevel = 'low';
  let value: boolean | null = null;

  // Check page content for indicators
  if (input.page_content_snippet) {
    const contentResult = detectFromPageContent(input.page_content_snippet);
    signals.push(...contentResult.signals);

    if (contentResult.linked !== null) {
      value = contentResult.linked;
      confidence = contentResult.confidence;
    }
  }

  // Check permits URL for inspection indicators
  if (input.permits_url) {
    const urlSignals = analyzePermitsUrl(input.permits_url);
    signals.push(...urlSignals.signals);

    // URL can provide additional confidence
    if (urlSignals.linked !== null && value === null) {
      value = urlSignals.linked;
      confidence = urlSignals.confidence;
    }
  }

  // No signals found
  if (signals.length === 0) {
    signals.push({
      type: 'no_signals',
      description: 'No inspection linkage indicators found',
      source: 'detectInspectionLinkage',
    });
  }

  return {
    value,
    confidence,
    signals,
  };
}

/**
 * Detect inspection linkage from page content
 */
function detectFromPageContent(content: string): {
  linked: boolean | null;
  confidence: ConfidenceLevel;
  signals: DetectorSignal[];
} {
  const signals: DetectorSignal[] = [];
  const lowerContent = content.toLowerCase();

  // =========================================================================
  // CHECK FOR LINKED INSPECTION INDICATORS
  // =========================================================================

  const linkedIndicators = [
    'inspection status',
    'schedule inspection',
    'request inspection',
    'inspection results',
    'inspection history',
    'view inspections',
    'track inspections',
    'permit and inspection',
    'permits & inspections',
    'inspection tracking',
  ];

  let linkedCount = 0;
  for (const indicator of linkedIndicators) {
    if (lowerContent.includes(indicator)) {
      linkedCount++;
      signals.push({
        type: 'linked_indicator',
        description: `Found linked inspection indicator: "${indicator}"`,
        source: 'page_content',
      });
    }
  }

  // Multiple linked indicators suggest integration
  if (linkedCount >= 2) {
    return { linked: true, confidence: 'medium', signals };
  } else if (linkedCount === 1) {
    return { linked: true, confidence: 'low', signals };
  }

  // =========================================================================
  // CHECK FOR SEPARATE SYSTEM INDICATORS
  // =========================================================================

  const separateIndicators = [
    'separate inspection',
    'call to schedule',
    'inspection department',
    'inspections office',
    'contact inspector',
  ];

  for (const indicator of separateIndicators) {
    if (lowerContent.includes(indicator)) {
      signals.push({
        type: 'separate_indicator',
        description: `Found separate system indicator: "${indicator}"`,
        source: 'page_content',
      });
      return { linked: false, confidence: 'low', signals };
    }
  }

  return { linked: null, confidence: 'low', signals };
}

/**
 * Analyze permits URL for inspection linkage hints
 */
function analyzePermitsUrl(url: string): {
  linked: boolean | null;
  confidence: ConfidenceLevel;
  signals: DetectorSignal[];
} {
  const signals: DetectorSignal[] = [];
  const lowerUrl = url.toLowerCase();

  // Combined portal indicators
  const combinedIndicators = [
    'citizenaccess',
    'permit-inspection',
    'permits-inspections',
    'building-services',
    'development-services',
  ];

  for (const indicator of combinedIndicators) {
    if (lowerUrl.includes(indicator)) {
      signals.push({
        type: 'combined_portal_url',
        description: `URL suggests combined permit/inspection portal: "${indicator}"`,
        source: url,
      });
      return { linked: true, confidence: 'low', signals };
    }
  }

  return { linked: null, confidence: 'low', signals };
}
