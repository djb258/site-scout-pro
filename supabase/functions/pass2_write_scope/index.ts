import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * PASS2_WRITE_SCOPE Edge Function
 * 
 * DOCTRINE: Claude Code writes WHAT is true. Lovable persists to Neon.
 * Writes to pass2.jurisdiction_scope table with provenance.
 * 
 * process_id: pass2_write_scope
 * version: v1.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScopePayload {
  county_id: number;
  county_name?: string;
  state?: string;
  county_fips?: string;
  asset_class?: 'self_storage' | 'rv_storage' | 'trailer_yard' | 'boat_storage' | 'other';
  
  authority_model?: 'county' | 'municipal' | 'mixed' | 'none';
  authority_model_state?: 'known' | 'unknown' | 'blocked';
  authority_model_source?: 'ordinance' | 'pdf' | 'portal' | 'human';
  authority_model_ref?: string;
  
  zoning_model?: 'no_zoning' | 'county' | 'municipal' | 'mixed';
  zoning_model_state?: 'known' | 'unknown' | 'blocked';
  zoning_model_source?: 'ordinance' | 'pdf' | 'portal' | 'human';
  zoning_model_ref?: string;
  
  controlling_authority_name?: string;
  controlling_authority_contact?: string;
}

interface WriteResult {
  status: 'written' | 'error';
  county_id: number;
  message: string;
  upserted: boolean;
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

    const payload: ScopePayload = await req.json();

    if (!payload.county_id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'county_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PASS2_WRITE_SCOPE] Writing scope for county_id: ${payload.county_id}`);

    sql = await getNeonConnection();

    // Check if record exists
    const existing = await sql`
      SELECT id FROM pass2.jurisdiction_scope WHERE county_id = ${payload.county_id} LIMIT 1
    `.catch(() => []);

    const isUpdate = existing.length > 0;

    await sql`
      INSERT INTO pass2.jurisdiction_scope (
        county_id,
        county_name,
        state,
        county_fips,
        asset_class,
        authority_model,
        authority_model_state,
        authority_model_source,
        authority_model_ref,
        zoning_model,
        zoning_model_state,
        zoning_model_source,
        zoning_model_ref,
        controlling_authority_name,
        controlling_authority_contact
      ) VALUES (
        ${payload.county_id},
        ${payload.county_name || null},
        ${payload.state || null},
        ${payload.county_fips || null},
        ${payload.asset_class || 'self_storage'}::pass2.asset_class,
        ${payload.authority_model || null}::pass2.authority_model,
        ${payload.authority_model_state || 'unknown'}::pass2.knowledge_state,
        ${payload.authority_model_source || null}::pass2.source_type,
        ${payload.authority_model_ref || null},
        ${payload.zoning_model || null}::pass2.zoning_model,
        ${payload.zoning_model_state || 'unknown'}::pass2.knowledge_state,
        ${payload.zoning_model_source || null}::pass2.source_type,
        ${payload.zoning_model_ref || null},
        ${payload.controlling_authority_name || null},
        ${payload.controlling_authority_contact || null}
      )
      ON CONFLICT (county_id, asset_class) DO UPDATE SET
        county_name = EXCLUDED.county_name,
        state = EXCLUDED.state,
        county_fips = EXCLUDED.county_fips,
        authority_model = EXCLUDED.authority_model,
        authority_model_state = EXCLUDED.authority_model_state,
        authority_model_source = EXCLUDED.authority_model_source,
        authority_model_ref = EXCLUDED.authority_model_ref,
        zoning_model = EXCLUDED.zoning_model,
        zoning_model_state = EXCLUDED.zoning_model_state,
        zoning_model_source = EXCLUDED.zoning_model_source,
        zoning_model_ref = EXCLUDED.zoning_model_ref,
        controlling_authority_name = EXCLUDED.controlling_authority_name,
        controlling_authority_contact = EXCLUDED.controlling_authority_contact
    `;

    const result: WriteResult = {
      status: 'written',
      county_id: payload.county_id,
      message: `Scope ${isUpdate ? 'updated' : 'created'} successfully`,
      upserted: isUpdate,
    };

    await supabase.from('engine_logs').insert({
      engine: 'pass2_write_scope',
      event: 'scope_written',
      payload: { county_id: payload.county_id, upserted: isUpdate },
      status: 'success',
    });

    console.log(`[PASS2_WRITE_SCOPE] Success for ${payload.county_id}`);
    await sql.end();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[PASS2_WRITE_SCOPE] Error:', error);
    if (sql) await sql.end();
    return new Response(
      JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
