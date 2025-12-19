import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * VALIDATE JURISDICTION CARD — Pass 2 Validation Gate
 * 
 * DOCTRINE: Validates staging draft before promotion eligibility.
 * This function reads/writes ONLY Supabase staging — NO Neon access.
 * 
 * execution_id is the PRIMARY TRACE KEY.
 * 
 * process_id: pass2_validate_jurisdiction_card
 * version: v1.0.0
 */

// HARD RULE: NO Neon/postgres imports allowed in this file

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fields that require full provenance when marked 'known'
const PROVENANCE_REQUIRED_FOR_KNOWN = [
  'source_type',
  'source_reference',
  'authority_scope',
  'verified_at',
] as const;

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

interface ValidateInput {
  execution_id: string;
}

interface ValidationResult {
  valid: boolean;
  execution_id: string;
  status: 'validated' | 'rejected' | 'pending';
  errors: string[];
  warnings: string[];
  envelope_complete: boolean;
  card_complete: boolean;
}

interface ProvenanceEntry {
  field: string;
  state: 'known' | 'unknown' | 'blocked';
  source_type?: string;
  source_reference?: string;
  authority_scope?: string;
  verified_at?: string;
  raw_text?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const input: ValidateInput = await req.json();
    const { execution_id } = input;

    if (!execution_id) {
      return new Response(
        JSON.stringify({ valid: false, errors: ['execution_id is required'] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[VALIDATE_JURISDICTION_CARD] Validating execution_id=${execution_id}`);

    // Fetch draft by execution_id
    const { data: draft, error: fetchError } = await supabase
      .from('jurisdiction_card_drafts')
      .select('*')
      .eq('execution_id', execution_id)
      .single();

    if (fetchError || !draft) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          execution_id,
          errors: [`Draft not found for execution_id: ${execution_id}`] 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cannot validate already promoted drafts
    if (draft.status === 'promoted') {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          execution_id,
          status: 'promoted',
          errors: ['Draft already promoted - cannot re-validate'] 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const provenanceLog: ProvenanceEntry[] = draft.provenance_log || [];
    const fieldStates: Record<string, string> = draft.field_states || {};

    // Validation Rule 1: Every 'known' field MUST have full provenance
    for (const entry of provenanceLog) {
      if (entry.state === 'known') {
        const missingProvenance: string[] = [];
        
        if (!entry.source_type) missingProvenance.push('source_type');
        if (!entry.source_reference) missingProvenance.push('source_reference');
        if (!entry.authority_scope) missingProvenance.push('authority_scope');
        if (!entry.verified_at) missingProvenance.push('verified_at');

        if (missingProvenance.length > 0) {
          errors.push(`Field '${entry.field}' marked 'known' but missing: ${missingProvenance.join(', ')}`);
        }
      }
    }

    // Validation Rule 2: Check for CONFLICT_DETECTED flags
    const redFlags: string[] = draft.red_flags || [];
    const conflictFlags = redFlags.filter((f: string) => f.includes('CONFLICT_DETECTED'));
    if (conflictFlags.length > 0) {
      errors.push(`Unresolved conflicts detected: ${conflictFlags.join('; ')}`);
    }

    // Validation Rule 3: Fatal prohibition check
    if (draft.fatal_prohibition === 'yes') {
      errors.push('Fatal prohibition detected - storage not allowed in jurisdiction');
    }

    // Check envelope completeness
    const envelopeComplete = REQUIRED_FOR_ENVELOPE.every(
      field => fieldStates[field] === 'known'
    );

    if (!envelopeComplete) {
      const missingEnvelope = REQUIRED_FOR_ENVELOPE.filter(
        field => fieldStates[field] !== 'known'
      );
      warnings.push(`Envelope incomplete - missing: ${missingEnvelope.join(', ')}`);
    }

    // Determine final validation status
    let newStatus: 'validated' | 'rejected' | 'pending';
    
    if (errors.length > 0) {
      newStatus = 'rejected';
    } else if (envelopeComplete && draft.fatal_prohibition !== 'yes') {
      newStatus = 'validated';
    } else {
      newStatus = 'pending'; // Not enough data yet
    }

    // Update draft status
    const { error: updateError } = await supabase
      .from('jurisdiction_card_drafts')
      .update({
        status: newStatus,
        envelope_complete: envelopeComplete,
        failure_reason: errors.length > 0 ? errors.join('; ') : null,
        updated_at: new Date().toISOString(),
      })
      .eq('execution_id', execution_id);

    if (updateError) {
      throw new Error(`Failed to update draft: ${updateError.message}`);
    }

    // Log validation result
    await supabase.from('engine_logs').insert({
      engine: 'pass2_validate_jurisdiction_card',
      event: 'validation_complete',
      payload: {
        execution_id,
        status: newStatus,
        errors,
        warnings,
        envelope_complete: envelopeComplete,
        card_complete: draft.card_complete,
      },
      status: newStatus === 'rejected' ? 'error' : 'success',
    });

    console.log(`[VALIDATE_JURISDICTION_CARD] Complete execution_id=${execution_id} status=${newStatus}`);

    const result: ValidationResult = {
      valid: newStatus === 'validated',
      execution_id,
      status: newStatus,
      errors,
      warnings,
      envelope_complete: envelopeComplete,
      card_complete: draft.card_complete,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[VALIDATE_JURISDICTION_CARD] Error:', error);

    await supabase.from('engine_logs').insert({
      engine: 'pass2_validate_jurisdiction_card',
      event: 'validation_failed',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      status: 'error',
    });

    return new Response(
      JSON.stringify({ 
        valid: false, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
