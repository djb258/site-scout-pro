/**
 * CALL SHEET SPOKE
 *
 * Responsibility: Generate structured call sheets for AI dialer pricing collection
 *
 * Inputs:
 *   - competitors: Array of LocalCompetitor
 *   - prioritize_by: 'distance' | 'size' | 'pricing_gap'
 *
 * Outputs:
 *   - CallSheetEntry[] with fields:
 *     - name: string
 *     - phone: string
 *     - city: string
 *     - unit_size_targets: ['10x10', '10x20']
 *
 * Integration:
 *   - AI Dialer (Bland.ai, Retell, etc.)
 *   - Lovable.DB: rate_observations for storing results
 */

import type { LocalCompetitor, CallSheetEntry, AiCallerPricing } from '../../../shared/opportunity_object';
import { writeData, writeLog, writeErrorLog, TABLES } from '../../../shared/lovable_adapter';

// ============================================================================
// TYPES
// ============================================================================

export interface CallSheetInput {
  competitors: LocalCompetitor[];
  prioritize_by?: 'distance' | 'size' | 'pricing_gap';
  max_calls?: number;
}

export interface CallSheetOutput {
  success: boolean;
  status: 'ok' | 'stub' | 'error';
  call_sheet: CallSheetEntry[];
  total_calls_needed: number;
  estimated_duration_minutes: number;
  error?: string;
}

/**
 * Enhanced call sheet entry with unit size targets
 */
export interface EnhancedCallSheetEntry extends CallSheetEntry {
  city?: string;
  state?: string;
  unit_size_targets: string[];
  priority_rank: number;
  estimated_sqft?: number;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate prioritized call sheet
 * Returns call sheet with structured fields for AI dialer
 *
 * @param input - Contains competitors, priority strategy, and max calls
 * @returns CallSheetOutput with call sheet and metrics
 */
export function generateCallSheet(input: CallSheetInput): CallSheetOutput {
  const { competitors, prioritize_by = 'distance', max_calls = 20 } = input;

  console.log(`[CALL_SHEET] Generating call sheet, prioritize by: ${prioritize_by}, max: ${max_calls}`);

  try {
    // Filter to facilities needing pricing
    let needPricing = competitors.filter((c) => !c.pricing_verified);

    if (needPricing.length === 0) {
      console.log('[CALL_SHEET] All facilities have verified pricing');
      return {
        success: true,
        status: 'ok',
        call_sheet: [],
        total_calls_needed: 0,
        estimated_duration_minutes: 0,
      };
    }

    // Sort by priority
    switch (prioritize_by) {
      case 'distance':
        needPricing.sort((a, b) => a.distance_miles - b.distance_miles);
        break;
      case 'size':
        needPricing.sort((a, b) => (b.estimated_sqft || 0) - (a.estimated_sqft || 0));
        break;
      case 'pricing_gap':
        // Prioritize those with no pricing data at all
        needPricing.sort((a, b) => {
          const aHasRates = a.rates ? Object.keys(a.rates).length : 0;
          const bHasRates = b.rates ? Object.keys(b.rates).length : 0;
          return aHasRates - bHasRates;
        });
        break;
    }

    // Limit to max_calls
    needPricing = needPricing.slice(0, max_calls);

    // Build structured call sheet with unit size targets
    const call_sheet: CallSheetEntry[] = needPricing.map((c, index) => ({
      facility_name: c.name,
      phone: c.phone || 'LOOKUP_NEEDED',
      address: c.address || '',
      distance_miles: c.distance_miles,
      notes: buildCallNotes(c, index + 1),
      pricing_needed: true,
      call_status: 'pending',
    }));

    // Estimate 3 minutes per call average
    const estimated_duration_minutes = call_sheet.length * 3;

    console.log(`[CALL_SHEET] Generated ${call_sheet.length} calls, ~${estimated_duration_minutes} min`);

    return {
      success: true,
      status: 'ok',
      call_sheet,
      total_calls_needed: call_sheet.length,
      estimated_duration_minutes,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CALL_SHEET] Error:', error);

    return {
      success: false,
      status: 'error',
      call_sheet: [],
      total_calls_needed: 0,
      estimated_duration_minutes: 0,
      error: errorMessage,
    };
  }
}

/**
 * Generate enhanced call sheet with unit size targets
 */
export function generateEnhancedCallSheet(input: CallSheetInput): EnhancedCallSheetEntry[] {
  const { competitors, prioritize_by = 'distance', max_calls = 20 } = input;

  // Standard unit size targets for all calls
  const DEFAULT_UNIT_TARGETS = ['10x10', '10x20'];

  // Filter and sort
  let needPricing = competitors.filter((c) => !c.pricing_verified);

  switch (prioritize_by) {
    case 'distance':
      needPricing.sort((a, b) => a.distance_miles - b.distance_miles);
      break;
    case 'size':
      needPricing.sort((a, b) => (b.estimated_sqft || 0) - (a.estimated_sqft || 0));
      break;
    case 'pricing_gap':
      needPricing.sort((a, b) => {
        const aHasRates = a.rates ? Object.keys(a.rates).length : 0;
        const bHasRates = b.rates ? Object.keys(b.rates).length : 0;
        return aHasRates - bHasRates;
      });
      break;
  }

  needPricing = needPricing.slice(0, max_calls);

  return needPricing.map((c, index) => ({
    facility_name: c.name,
    phone: c.phone || 'LOOKUP_NEEDED',
    address: c.address || '',
    city: extractCity(c.address),
    state: extractState(c.address),
    distance_miles: c.distance_miles,
    notes: buildCallNotes(c, index + 1),
    pricing_needed: true,
    call_status: 'pending' as const,
    unit_size_targets: DEFAULT_UNIT_TARGETS,
    priority_rank: index + 1,
    estimated_sqft: c.estimated_sqft,
  }));
}

// ============================================================================
// AI DIALER INTEGRATION
// ============================================================================

/**
 * Trigger AI caller for pricing collection
 * Returns batch ID for tracking
 *
 * @param call_sheet - Array of CallSheetEntry to process
 * @returns Trigger result with batch ID and counts
 */
export async function triggerCalls(call_sheet: CallSheetEntry[]): Promise<{
  triggered: number;
  failed: number;
  batch_id: string;
}> {
  console.log(`[CALL_SHEET] Triggering ${call_sheet.length} AI calls`);

  // Filter out entries without phone numbers
  const validCalls = call_sheet.filter(c => c.phone && c.phone !== 'LOOKUP_NEEDED');
  const invalidCalls = call_sheet.length - validCalls.length;

  if (validCalls.length === 0) {
    console.warn('[CALL_SHEET] No valid phone numbers to call');
    return {
      triggered: 0,
      failed: call_sheet.length,
      batch_id: 'NO_VALID_PHONES',
    };
  }

  // Generate batch ID
  const batch_id = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Write batch record to scratchpad
    await writeData(TABLES.CALL_BATCHES, {
      batch_id,
      call_count: validCalls.length,
      status: 'pending',
      calls: validCalls.map(c => ({
        facility_name: c.facility_name,
        phone: c.phone,
        status: 'pending',
      })),
    });

    await writeLog('call_batch_created', {
      batch_id,
      total_calls: validCalls.length,
      skipped_no_phone: invalidCalls,
    });

    // TODO: Implement actual AI dialer API call
    // Options:
    //   - Bland.ai: POST /v1/calls
    //   - Retell: POST /v1/batch-calls
    //   - Vapi: POST /calls
    //   - Custom Twilio implementation

    console.log(`[CALL_SHEET] Batch ${batch_id} created with ${validCalls.length} calls`);

    return {
      triggered: validCalls.length,
      failed: invalidCalls,
      batch_id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CALL_SHEET] Error triggering calls:', error);
    await writeErrorLog('call_trigger_error', error instanceof Error ? error : errorMessage, {
      batch_id,
      call_count: validCalls.length,
    });

    return {
      triggered: 0,
      failed: call_sheet.length,
      batch_id: 'ERROR',
    };
  }
}

/**
 * Process AI caller results into pricing data
 */
export function processCallerResults(
  rawResults: unknown[],
  facility_id: string,
  facility_name: string
): AiCallerPricing | null {
  console.log(`[CALL_SHEET] Processing results for facility: ${facility_id}`);

  if (!rawResults || rawResults.length === 0) {
    return null;
  }

  // TODO: Implement result parsing from AI dialer webhook
  // Map raw transcript/results to structured AiCallerPricing

  // Stub implementation
  const pricing: AiCallerPricing = {
    facility_id,
    facility_name,
    call_date: new Date().toISOString(),
    rates_collected: [],
    availability: [],
    confidence_level: 'low',
  };

  return pricing;
}

/**
 * Save pricing results to scratchpad
 */
export async function savePricingResults(pricing: AiCallerPricing): Promise<boolean> {
  console.log(`[CALL_SHEET] Saving pricing for: ${pricing.facility_name}`);

  try {
    await writeData(TABLES.RATE_OBSERVATIONS, {
      facility_id: pricing.facility_id,
      facility_name: pricing.facility_name,
      call_date: pricing.call_date,
      rates: pricing.rates_collected,
      availability: pricing.availability,
      confidence: pricing.confidence_level,
      admin_fee: pricing.admin_fee,
      insurance_required: pricing.insurance_required,
    });

    await writeLog('pricing_saved', {
      facility_id: pricing.facility_id,
      rate_count: pricing.rates_collected.length,
    });

    return true;
  } catch (error) {
    console.error('[CALL_SHEET] Error saving pricing:', error);
    await writeErrorLog('pricing_save_error', error instanceof Error ? error : 'Unknown error', {
      facility_id: pricing.facility_id,
    });
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build notes string for call sheet entry
 */
function buildCallNotes(competitor: LocalCompetitor, rank: number): string {
  const parts: string[] = [];

  parts.push(`#${rank}`);

  if (competitor.estimated_sqft) {
    parts.push(`Est. ${competitor.estimated_sqft.toLocaleString()} sqft`);
  }

  if (competitor.rating) {
    parts.push(`${competitor.rating}★`);
  }

  if (competitor.climate_controlled) {
    parts.push('CC');
  }

  return parts.join(' | ');
}

/**
 * Extract city from address string
 */
function extractCity(address?: string): string | undefined {
  if (!address) return undefined;

  // Try to extract city from "123 Main St, City, ST 12345" format
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim();
  }
  return undefined;
}

/**
 * Extract state from address string
 */
function extractState(address?: string): string | undefined {
  if (!address) return undefined;

  // Try to extract state from "123 Main St, City, ST 12345" format
  const stateZipMatch = address.match(/,\s*([A-Z]{2})\s+\d{5}/);
  if (stateZipMatch) {
    return stateZipMatch[1];
  }
  return undefined;
}

/**
 * Calculate call sheet metrics
 */
export function calculateCallSheetMetrics(callSheet: CallSheetEntry[]): {
  total: number;
  pending: number;
  completed: number;
  no_answer: number;
  skipped: number;
  completion_pct: number;
} {
  const pending = callSheet.filter(c => c.call_status === 'pending').length;
  const completed = callSheet.filter(c => c.call_status === 'completed').length;
  const no_answer = callSheet.filter(c => c.call_status === 'no_answer').length;
  const skipped = callSheet.filter(c => c.call_status === 'skipped').length;

  const total = callSheet.length;
  const completion_pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    pending,
    completed,
    no_answer,
    skipped,
    completion_pct,
  };
}

/**
 * Get facilities still needing calls
 */
export function getPendingCalls(callSheet: CallSheetEntry[]): CallSheetEntry[] {
  return callSheet.filter(c => c.call_status === 'pending');
}

/**
 * Update call status in call sheet
 */
export function updateCallStatus(
  callSheet: CallSheetEntry[],
  facilityName: string,
  newStatus: CallSheetEntry['call_status']
): CallSheetEntry[] {
  return callSheet.map(c =>
    c.facility_name === facilityName
      ? { ...c, call_status: newStatus }
      : c
  );
}
