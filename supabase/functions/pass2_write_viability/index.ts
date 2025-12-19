import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * PASS2_WRITE_VIABILITY Edge Function
 * 
 * DOCTRINE: Claude Code writes WHAT is true. Lovable persists to Neon.
 * Writes to pass2.use_viability table with provenance.
 * Purpose: Binary gating - should we continue?
 * 
 * process_id: pass2_write_viability
 * version: v1.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ViabilityPayload {
  county_id: number;
  
  storage_allowed?: 'yes' | 'no' | 'unknown';
  storage_allowed_state?: 'known' | 'unknown' | 'blocked';
  storage_allowed_source?: 'ordinance' | 'pdf' | 'portal' | 'human';
  storage_allowed_ref?: string;
  storage_allowed_scope?: 'county' | 'municipal' | 'fire_district' | 'state';
  
  fatal_prohibition?: 'yes' | 'no' | 'unknown';
  fatal_prohibition_description?: string;
  
  conditional_use_required?: 'yes' | 'no' | 'unknown';
  discretionary_required?: 'yes' | 'no' | 'unknown';
  general_notes?: string;
}

async function getNeonConnection() {
  const neonUrl = Deno.env.get('NEON_DATABASE_URL');
  if (!neonUrl) throw new Error('NEON_DATABASE_URL not configured');
  return postgres(neonUrl, { ssl: 'require' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: ViabilityPayload = await req.json();

    if (!payload.county_id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'county_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PASS2_WRITE_VIABILITY] Writing viability for county_id: ${payload.county_id}`);

    sql = await getNeonConnection();

    const existing = await sql`
      SELECT id FROM pass2.use_viability WHERE county_id = ${payload.county_id} LIMIT 1
    `.catch(() => []);

    const isUpdate = existing.length > 0;

    await sql`
      INSERT INTO pass2.use_viability (
        county_id,
        storage_allowed,
        storage_allowed_state,
        storage_allowed_source,
        storage_allowed_ref,
        storage_allowed_scope,
        fatal_prohibition,
        fatal_prohibition_description,
        conditional_use_required,
        discretionary_required,
        general_notes
      ) VALUES (
        ${payload.county_id},
        ${payload.storage_allowed || 'unknown'}::pass2.ternary,
        ${payload.storage_allowed_state || 'unknown'}::pass2.knowledge_state,
        ${payload.storage_allowed_source || null}::pass2.source_type,
        ${payload.storage_allowed_ref || null},
        ${payload.storage_allowed_scope || null}::pass2.authority_scope,
        ${payload.fatal_prohibition || 'unknown'}::pass2.ternary,
        ${payload.fatal_prohibition_description || null},
        ${payload.conditional_use_required || 'unknown'}::pass2.ternary,
        ${payload.discretionary_required || 'unknown'}::pass2.ternary,
        ${payload.general_notes || null}
      )
      ON CONFLICT (county_id) DO UPDATE SET
        storage_allowed = EXCLUDED.storage_allowed,
        storage_allowed_state = EXCLUDED.storage_allowed_state,
        storage_allowed_source = EXCLUDED.storage_allowed_source,
        storage_allowed_ref = EXCLUDED.storage_allowed_ref,
        storage_allowed_scope = EXCLUDED.storage_allowed_scope,
        fatal_prohibition = EXCLUDED.fatal_prohibition,
        fatal_prohibition_description = EXCLUDED.fatal_prohibition_description,
        conditional_use_required = EXCLUDED.conditional_use_required,
        discretionary_required = EXCLUDED.discretionary_required,
        general_notes = EXCLUDED.general_notes
    `;

    await supabase.from('engine_logs').insert({
      engine: 'pass2_write_viability',
      event: 'viability_written',
      payload: { county_id: payload.county_id, fatal_prohibition: payload.fatal_prohibition, upserted: isUpdate },
      status: 'success',
    });

    console.log(`[PASS2_WRITE_VIABILITY] Success for ${payload.county_id}`);
    await sql.end();

    return new Response(
      JSON.stringify({ status: 'written', county_id: payload.county_id, upserted: isUpdate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS2_WRITE_VIABILITY] Error:', error);
    if (sql) await sql.end();
    return new Response(
      JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
