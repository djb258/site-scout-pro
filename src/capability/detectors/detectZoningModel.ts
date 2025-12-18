/**
 * Zoning Model Detector
 *
 * DOCTRINE: Detect HOW zoning is structured, not WHAT the zones allow.
 * This is a CHEAP probe — no ordinance parsing, no rule extraction.
 *
 * Allowed signals:
 * - Presence of county zoning page
 * - Explicit "no zoning" statements
 * - References to municipal authority
 * - Overlay district mentions
 *
 * NOT allowed:
 * - Parsing zoning ordinances
 * - Extracting zone boundaries
 * - Determining setbacks or uses
 */

import type {
  ZoningModel,
  ZoningModelDetectorResult,
  DetectorSignal,
  ConfidenceLevel,
} from '../types';
import { NO_ZONING_STATES } from '../types';

/**
 * Input for zoning model detection
 */
export interface ZoningModelDetectorInput {
  county_name: string;
  state_code: string;
  planning_url?: string | null;
  page_content_snippet?: string | null;  // First 5000 chars of page
}

/**
 * Detect the zoning model for a county
 *
 * This is a CHEAP detection — uses only page indicators and known patterns.
 * Does NOT parse ordinances or extract rules.
 */
export function detectZoningModel(
  input: ZoningModelDetectorInput
): ZoningModelDetectorResult {
  const signals: DetectorSignal[] = [];
  let confidence: ConfidenceLevel = 'low';
  let value: ZoningModel = 'unknown';

  // Check if state is known for no-zoning counties
  if (NO_ZONING_STATES.includes(input.state_code as any)) {
    signals.push({
      type: 'no_zoning_state',
      description: `${input.state_code} is known to have counties without zoning`,
      source: 'state_pattern',
    });
    // Don't assume no zoning — just note it's possible
  }

  // Check page content for indicators
  if (input.page_content_snippet) {
    const contentResult = detectFromPageContent(
      input.page_content_snippet,
      input.county_name
    );
    signals.push(...contentResult.signals);

    if (contentResult.zoning_model !== 'unknown') {
      value = contentResult.zoning_model;
      confidence = contentResult.confidence;
    }
  }

  // No signals found
  if (signals.length === 0 || value === 'unknown') {
    signals.push({
      type: 'no_signals',
      description: 'No zoning model indicators found',
      source: 'detectZoningModel',
    });
  }

  return {
    value,
    confidence,
    signals,
  };
}

/**
 * Detect zoning model from page content (cheap indicators only)
 */
function detectFromPageContent(
  content: string,
  countyName: string
): {
  zoning_model: ZoningModel;
  confidence: ConfidenceLevel;
  signals: DetectorSignal[];
} {
  const signals: DetectorSignal[] = [];
  const lowerContent = content.toLowerCase();
  const lowerCounty = countyName.toLowerCase();

  // =========================================================================
  // CHECK FOR NO ZONING (first-class model)
  // =========================================================================

  const noZoningIndicators = [
    'no zoning',
    'unzoned',
    'does not have zoning',
    'no county zoning',
    'zoning is not',
    'no land use regulations',
    'no zoning ordinance',
    'zoning does not apply',
  ];

  for (const indicator of noZoningIndicators) {
    if (lowerContent.includes(indicator)) {
      signals.push({
        type: 'no_zoning_explicit',
        description: `Found explicit no-zoning statement: "${indicator}"`,
        source: 'page_content',
      });
      return { zoning_model: 'no_zoning', confidence: 'medium', signals };
    }
  }

  // =========================================================================
  // CHECK FOR MUNICIPAL-ONLY ZONING
  // =========================================================================

  const municipalIndicators = [
    'city zoning only',
    'municipal zoning',
    'incorporated areas only',
    'cities and towns',
    'contact your city',
    'zoning within city limits',
    'unincorporated areas are not zoned',
    'county does not zone',
  ];

  for (const indicator of municipalIndicators) {
    if (lowerContent.includes(indicator)) {
      signals.push({
        type: 'municipal_only',
        description: `Found municipal-only indicator: "${indicator}"`,
        source: 'page_content',
      });
      return { zoning_model: 'municipal_only', confidence: 'medium', signals };
    }
  }

  // =========================================================================
  // CHECK FOR OVERLAY-BASED ZONING
  // =========================================================================

  const overlayIndicators = [
    'overlay district',
    'overlay zone',
    'special district',
    'planned development district',
    'historic overlay',
    'airport overlay',
    'floodplain overlay',
  ];

  let overlayCount = 0;
  for (const indicator of overlayIndicators) {
    if (lowerContent.includes(indicator)) {
      overlayCount++;
      signals.push({
        type: 'overlay_indicator',
        description: `Found overlay indicator: "${indicator}"`,
        source: 'page_content',
      });
    }
  }

  // Multiple overlay mentions suggest overlay-based model
  if (overlayCount >= 2) {
    return { zoning_model: 'overlay_based', confidence: 'low', signals };
  }

  // =========================================================================
  // CHECK FOR COUNTYWIDE ZONING
  // =========================================================================

  const countywideIndicators = [
    `${lowerCounty} zoning ordinance`,
    `${lowerCounty} zoning code`,
    'county zoning districts',
    'countywide zoning',
    'unified development code',
    'unified development ordinance',
    'land development code',
    'zoning map',
    'zoning districts include',
  ];

  for (const indicator of countywideIndicators) {
    if (lowerContent.includes(indicator)) {
      signals.push({
        type: 'countywide_indicator',
        description: `Found countywide indicator: "${indicator}"`,
        source: 'page_content',
      });
      return { zoning_model: 'countywide', confidence: 'low', signals };
    }
  }

  // =========================================================================
  // NO CLEAR MODEL DETECTED
  // =========================================================================

  return { zoning_model: 'unknown', confidence: 'low', signals };
}

/**
 * Check if a county is likely to have no zoning based on state
 * This is NOT authoritative — just a hint for prioritization
 */
export function isNoZoningLikely(stateCode: string): boolean {
  return NO_ZONING_STATES.includes(stateCode as any);
}
