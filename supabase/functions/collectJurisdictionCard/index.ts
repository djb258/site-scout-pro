import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * COLLECT JURISDICTION CARD — Pass 2 Worker Function
 * 
 * DOCTRINE: Supabase stages working truth. Neon receives ONLY via promotion.
 * This function writes ONLY to Supabase staging tables — NO Neon imports allowed.
 * 
 * execution_id is the PRIMARY TRACE KEY for all operations.
 * 
 * process_id: pass2_collect_jurisdiction_card
 * version: v1.0.0
 */

// HARD RULE: NO Neon/postgres imports allowed in this file
// CI should fail if: import postgres from 'deno.land/x/postgresjs' appears here

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Spec-defined field categories
const REQUIRED_FOR_ENVELOPE = [
  'storage_allowed',
  'fatal_prohibition',
  'setback_front',
  'setback_side',
  'setback_rear',
  'max_lot_coverage',
  'max_height',
  'fire_sprinkler_required',
  'fire_flow_gpm',
  'stormwater_detention_required',
  'parking_spaces_required',
] as const;

const ALL_CARD_FIELDS = [
  // Viability
  'storage_allowed',
  'fatal_prohibition',
  'fatal_prohibition_description',
  'conditional_use_required',
  'discretionary_required',
  // Scope
  'permit_authority',
  'zoning_authority',
  'fire_authority',
  'water_authority',
  'sewer_authority',
  // Envelope
  'setback_front',
  'setback_side',
  'setback_rear',
  'max_lot_coverage',
  'max_height',
  'max_stories',
  'max_far',
  'landscape_buffer',
  // Fire
  'fire_sprinkler_required',
  'fire_flow_gpm',
  'fire_access_width',
  'fire_hydrant_distance',
  // Stormwater
  'stormwater_detention_required',
  'stormwater_retention_required',
  'impervious_limit_percent',
  // Parking
  'parking_spaces_required',
  'parking_ratio',
  'ada_spaces_required',
] as const;

type KnowledgeState = 'known' | 'unknown' | 'blocked';
type SourceType = 'ordinance' | 'pdf' | 'portal' | 'human' | 'gis';
type AuthorityScope = 'county' | 'municipal' | 'fire_district' | 'state';

interface CollectInput {
  county_id: number;
  state_code: string;
  asset_class?: 'self_storage' | 'rv_storage' | 'boat_storage';
}

interface FieldProvenance {
  field: string;
  value: unknown;
  state: KnowledgeState;
  source_type?: SourceType;
  source_reference?: string;
  authority_scope?: AuthorityScope;
  verified_at?: string;
  raw_text?: string;
}

interface CollectionResult {
  execution_id: string;
  status: 'pending' | 'validated' | 'rejected';
  envelope_complete: boolean;
  card_complete: boolean;
  fatal_prohibition: 'yes' | 'no' | 'unknown';
  warnings: string[];
  field_summary: {
    known: number;
    unknown: number;
    blocked: number;
  };
}

function generateExecutionId(): string {
  return crypto.randomUUID();
}

/**
 * Simulated source fetching — in production this would call real sources
 * For now, marks all fields as 'unknown' to be filled by external processes
 */
function collectFieldsFromSources(
  countyId: number,
  stateCode: string,
  assetClass: string
): { cardPayload: Record<string, unknown>; fieldStates: Record<string, KnowledgeState>; provenanceLog: FieldProvenance[]; redFlags: string[] } {
  const cardPayload: Record<string, unknown> = {};
  const fieldStates: Record<string, KnowledgeState> = {};
  const provenanceLog: FieldProvenance[] = [];
  const redFlags: string[] = [];

  // Initialize all fields as unknown — no defaults, no inference
  for (const field of ALL_CARD_FIELDS) {
    cardPayload[field] = null;
    fieldStates[field] = 'unknown';
    provenanceLog.push({
      field,
      value: null,
      state: 'unknown',
      // No source_type, source_reference, etc. for unknown fields
    });
  }

  // Add metadata
  cardPayload['county_id'] = countyId;
  cardPayload['state_code'] = stateCode;
  cardPayload['asset_class'] = assetClass;

  return { cardPayload, fieldStates, provenanceLog, redFlags };
}

/**
 * Compute envelope_complete: all REQUIRED_FOR_ENVELOPE fields must be 'known'
 */
function computeEnvelopeComplete(fieldStates: Record<string, KnowledgeState>): boolean {
  return REQUIRED_FOR_ENVELOPE.every(field => fieldStates[field] === 'known');
}

/**
 * Compute card_complete: all fields must be 'known' OR 'blocked' (researched)
 * CORRECT per spec: unknown = not researched, known|blocked = researched
 */
function computeCardComplete(fieldStates: Record<string, KnowledgeState>): boolean {
  return ALL_CARD_FIELDS.every(field => {
    const state = fieldStates[field];
    return state === 'known' || state === 'blocked';
  });
}

/**
 * Count field states for logging
 */
function countFieldStates(fieldStates: Record<string, KnowledgeState>): { known: number; unknown: number; blocked: number } {
  let known = 0, unknown = 0, blocked = 0;
  for (const state of Object.values(fieldStates)) {
    if (state === 'known') known++;
    else if (state === 'unknown') unknown++;
    else if (state === 'blocked') blocked++;
  }
  return { known, unknown, blocked };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const executionId = generateExecutionId();

  // Initialize Supabase client (NOT Neon!)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const input: CollectInput = await req.json();
    const { county_id, state_code, asset_class = 'self_storage' } = input;

    if (!county_id || !state_code) {
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          message: 'county_id and state_code are required',
          execution_id: executionId 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[COLLECT_JURISDICTION_CARD] execution_id=${executionId} county_id=${county_id} state=${state_code}`);

    // Log start of collection
    await supabase.from('jurisdiction_collection_log').insert({
      execution_id: executionId,
      county_id,
      state_code,
      status: 'running',
    });

    // Collect from sources (NO Neon access!)
    const { cardPayload, fieldStates, provenanceLog, redFlags } = collectFieldsFromSources(
      county_id,
      state_code,
      asset_class
    );

    // Compute completeness flags
    const envelopeComplete = computeEnvelopeComplete(fieldStates);
    const cardComplete = computeCardComplete(fieldStates);
    const fieldCounts = countFieldStates(fieldStates);

    // Determine fatal_prohibition from collected data
    const fatalProhibition = cardPayload.fatal_prohibition as 'yes' | 'no' | 'unknown' ?? 'unknown';

    // Determine initial status
    let status: 'pending' | 'validated' | 'rejected' = 'pending';
    let failureReason: string | null = null;

    if (fatalProhibition === 'yes') {
      status = 'rejected';
      failureReason = 'Fatal prohibition detected - storage not allowed';
    }

    // Generate warnings
    const warnings: string[] = [];
    if (!envelopeComplete) {
      warnings.push('Envelope incomplete - missing required fields');
    }
    if (redFlags.length > 0) {
      warnings.push(...redFlags);
    }

    const durationMs = Date.now() - startTime;

    // Extract county_name for STRUCTURAL column (first-class, CI-enforced)
    const countyName = (cardPayload.county_name as string) || 'Unknown';

    // Write atomic record to Supabase staging (NOT Neon!)
    const { error: insertError } = await supabase.from('jurisdiction_card_drafts').insert({
      execution_id: executionId,
      county_id,
      county_name: countyName, // STRUCTURAL: First-class column
      state_code,
      asset_class,
      status,
      envelope_complete: envelopeComplete,
      card_complete: cardComplete,
      fatal_prohibition: fatalProhibition,
      card_payload: cardPayload, // ALLOWED: Copy for payload completeness
      field_states: fieldStates,
      provenance_log: provenanceLog,
      red_flags: redFlags,
      failure_reason: failureReason,
      duration_ms: durationMs,
      source_count: 0, // Updated when real sources are connected
    });

    if (insertError) {
      throw new Error(`Failed to write draft: ${insertError.message}`);
    }

    // Update collection log
    await supabase.from('jurisdiction_collection_log').update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      duration_ms: durationMs,
      source_count: 0,
      known_count: fieldCounts.known,
      unknown_count: fieldCounts.unknown,
      blocked_count: fieldCounts.blocked,
      red_flags: redFlags,
    }).eq('execution_id', executionId);

    // Log to engine_logs for observability
    await supabase.from('engine_logs').insert({
      engine: 'pass2_collect_jurisdiction_card',
      event: 'collection_complete',
      payload: {
        execution_id: executionId,
        county_id,
        state_code,
        duration_ms: durationMs,
        envelope_complete: envelopeComplete,
        card_complete: cardComplete,
        field_counts: fieldCounts,
        red_flags: redFlags,
      },
      status: 'success',
    });

    console.log(`[COLLECT_JURISDICTION_CARD] Complete execution_id=${executionId} duration=${durationMs}ms`);

    const result: CollectionResult = {
      execution_id: executionId,
      status,
      envelope_complete: envelopeComplete,
      card_complete: cardComplete,
      fatal_prohibition: fatalProhibition,
      warnings,
      field_summary: fieldCounts,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[COLLECT_JURISDICTION_CARD] Error execution_id=${executionId}:`, error);

    // Log failure
    await supabase.from('jurisdiction_collection_log').update({
      status: 'failed',
      ended_at: new Date().toISOString(),
      duration_ms: durationMs,
      failure_reason: error instanceof Error ? error.message : 'Unknown error',
    }).eq('execution_id', executionId);

    await supabase.from('engine_logs').insert({
      engine: 'pass2_collect_jurisdiction_card',
      event: 'collection_failed',
      payload: {
        execution_id: executionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: durationMs,
      },
      status: 'error',
    });

    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        execution_id: executionId 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
