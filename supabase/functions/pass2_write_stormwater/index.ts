import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * PASS2_WRITE_STORMWATER Edge Function
 * 
 * DOCTRINE: Claude Code writes WHAT is true. Lovable persists to Neon.
 * Writes to pass2.stormwater_environmental table with provenance.
 * 
 * process_id: pass2_write_stormwater
 * version: v1.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Ternary = 'yes' | 'no' | 'unknown';
type KnowledgeState = 'known' | 'unknown' | 'blocked';
type SourceType = 'ordinance' | 'pdf' | 'portal' | 'human';

interface StormwaterPayload {
  county_id: number;
  
  detention_required?: Ternary;
  detention_required_state?: KnowledgeState;
  detention_required_source?: SourceType;
  detention_required_ref?: string;
  
  retention_required?: Ternary;
  retention_required_state?: KnowledgeState;
  retention_required_source?: SourceType;
  retention_required_ref?: string;
  
  max_impervious?: number;
  max_impervious_state?: KnowledgeState;
  max_impervious_source?: SourceType;
  max_impervious_ref?: string;
  
  watershed_overlay?: Ternary;
  watershed_overlay_state?: KnowledgeState;
  watershed_overlay_source?: SourceType;
  watershed_overlay_ref?: string;
  
  floodplain_overlay?: Ternary;
  floodplain_overlay_state?: KnowledgeState;
  floodplain_overlay_source?: SourceType;
  floodplain_overlay_ref?: string;
  
  environmental_notes?: string;
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

    const p: StormwaterPayload = await req.json();

    if (!p.county_id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'county_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PASS2_WRITE_STORMWATER] Writing stormwater for county_id: ${p.county_id}`);

    sql = await getNeonConnection();

    const existing = await sql`
      SELECT id FROM pass2.stormwater_environmental WHERE county_id = ${p.county_id} LIMIT 1
    `.catch(() => []);

    const isUpdate = existing.length > 0;

    await sql`
      INSERT INTO pass2.stormwater_environmental (
        county_id,
        detention_required, detention_required_state, detention_required_source, detention_required_ref,
        retention_required, retention_required_state, retention_required_source, retention_required_ref,
        max_impervious, max_impervious_state, max_impervious_source, max_impervious_ref,
        watershed_overlay, watershed_overlay_state, watershed_overlay_source, watershed_overlay_ref,
        floodplain_overlay, floodplain_overlay_state, floodplain_overlay_source, floodplain_overlay_ref,
        environmental_notes
      ) VALUES (
        ${p.county_id},
        ${p.detention_required || 'unknown'}::pass2.ternary, ${p.detention_required_state || 'unknown'}::pass2.knowledge_state, ${p.detention_required_source || null}::pass2.source_type, ${p.detention_required_ref || null},
        ${p.retention_required || 'unknown'}::pass2.ternary, ${p.retention_required_state || 'unknown'}::pass2.knowledge_state, ${p.retention_required_source || null}::pass2.source_type, ${p.retention_required_ref || null},
        ${p.max_impervious ?? null}, ${p.max_impervious_state || 'unknown'}::pass2.knowledge_state, ${p.max_impervious_source || null}::pass2.source_type, ${p.max_impervious_ref || null},
        ${p.watershed_overlay || 'unknown'}::pass2.ternary, ${p.watershed_overlay_state || 'unknown'}::pass2.knowledge_state, ${p.watershed_overlay_source || null}::pass2.source_type, ${p.watershed_overlay_ref || null},
        ${p.floodplain_overlay || 'unknown'}::pass2.ternary, ${p.floodplain_overlay_state || 'unknown'}::pass2.knowledge_state, ${p.floodplain_overlay_source || null}::pass2.source_type, ${p.floodplain_overlay_ref || null},
        ${p.environmental_notes || null}
      )
      ON CONFLICT (county_id) DO UPDATE SET
        detention_required = EXCLUDED.detention_required, detention_required_state = EXCLUDED.detention_required_state,
        detention_required_source = EXCLUDED.detention_required_source, detention_required_ref = EXCLUDED.detention_required_ref,
        retention_required = EXCLUDED.retention_required, retention_required_state = EXCLUDED.retention_required_state,
        retention_required_source = EXCLUDED.retention_required_source, retention_required_ref = EXCLUDED.retention_required_ref,
        max_impervious = EXCLUDED.max_impervious, max_impervious_state = EXCLUDED.max_impervious_state,
        max_impervious_source = EXCLUDED.max_impervious_source, max_impervious_ref = EXCLUDED.max_impervious_ref,
        watershed_overlay = EXCLUDED.watershed_overlay, watershed_overlay_state = EXCLUDED.watershed_overlay_state,
        watershed_overlay_source = EXCLUDED.watershed_overlay_source, watershed_overlay_ref = EXCLUDED.watershed_overlay_ref,
        floodplain_overlay = EXCLUDED.floodplain_overlay, floodplain_overlay_state = EXCLUDED.floodplain_overlay_state,
        floodplain_overlay_source = EXCLUDED.floodplain_overlay_source, floodplain_overlay_ref = EXCLUDED.floodplain_overlay_ref,
        environmental_notes = EXCLUDED.environmental_notes
    `;

    await supabase.from('engine_logs').insert({
      engine: 'pass2_write_stormwater',
      event: 'stormwater_written',
      payload: { county_id: p.county_id, upserted: isUpdate },
      status: 'success',
    });

    console.log(`[PASS2_WRITE_STORMWATER] Success for ${p.county_id}`);
    await sql.end();

    return new Response(
      JSON.stringify({ status: 'written', county_id: p.county_id, upserted: isUpdate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS2_WRITE_STORMWATER] Error:', error);
    if (sql) await sql.end();
    return new Response(
      JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
