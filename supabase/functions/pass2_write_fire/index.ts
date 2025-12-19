import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * PASS2_WRITE_FIRE Edge Function
 * 
 * DOCTRINE: Claude Code writes WHAT is true. Lovable persists to Neon.
 * Writes to pass2.fire_life_safety table with provenance.
 * 
 * process_id: pass2_write_fire
 * version: v1.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Ternary = 'yes' | 'no' | 'unknown';
type KnowledgeState = 'known' | 'unknown' | 'blocked';
type SourceType = 'ordinance' | 'pdf' | 'portal' | 'human';

interface FirePayload {
  county_id: number;
  
  fire_lane_required?: Ternary;
  fire_lane_required_state?: KnowledgeState;
  fire_lane_required_source?: SourceType;
  fire_lane_required_ref?: string;
  
  min_fire_lane_width?: number;
  min_fire_lane_width_state?: KnowledgeState;
  min_fire_lane_width_source?: SourceType;
  min_fire_lane_width_ref?: string;
  
  max_hydrant_spacing?: number;
  max_hydrant_spacing_state?: KnowledgeState;
  max_hydrant_spacing_source?: SourceType;
  max_hydrant_spacing_ref?: string;
  
  fire_dept_access_required?: Ternary;
  fire_dept_access_required_state?: KnowledgeState;
  fire_dept_access_required_source?: SourceType;
  fire_dept_access_required_ref?: string;
  
  sprinkler_required?: Ternary;
  sprinkler_required_state?: KnowledgeState;
  sprinkler_required_source?: SourceType;
  sprinkler_required_ref?: string;
  
  adopted_fire_code?: string;
  adopted_fire_code_state?: KnowledgeState;
  adopted_fire_code_source?: SourceType;
  adopted_fire_code_ref?: string;
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

    const p: FirePayload = await req.json();

    if (!p.county_id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'county_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PASS2_WRITE_FIRE] Writing fire/life safety for county_id: ${p.county_id}`);

    sql = await getNeonConnection();

    const existing = await sql`
      SELECT id FROM pass2.fire_life_safety WHERE county_id = ${p.county_id} LIMIT 1
    `.catch(() => []);

    const isUpdate = existing.length > 0;

    await sql`
      INSERT INTO pass2.fire_life_safety (
        county_id,
        fire_lane_required, fire_lane_required_state, fire_lane_required_source, fire_lane_required_ref,
        min_fire_lane_width, min_fire_lane_width_state, min_fire_lane_width_source, min_fire_lane_width_ref,
        max_hydrant_spacing, max_hydrant_spacing_state, max_hydrant_spacing_source, max_hydrant_spacing_ref,
        fire_dept_access_required, fire_dept_access_required_state, fire_dept_access_required_source, fire_dept_access_required_ref,
        sprinkler_required, sprinkler_required_state, sprinkler_required_source, sprinkler_required_ref,
        adopted_fire_code, adopted_fire_code_state, adopted_fire_code_source, adopted_fire_code_ref
      ) VALUES (
        ${p.county_id},
        ${p.fire_lane_required || 'unknown'}::pass2.ternary, ${p.fire_lane_required_state || 'unknown'}::pass2.knowledge_state, ${p.fire_lane_required_source || null}::pass2.source_type, ${p.fire_lane_required_ref || null},
        ${p.min_fire_lane_width ?? null}, ${p.min_fire_lane_width_state || 'unknown'}::pass2.knowledge_state, ${p.min_fire_lane_width_source || null}::pass2.source_type, ${p.min_fire_lane_width_ref || null},
        ${p.max_hydrant_spacing ?? null}, ${p.max_hydrant_spacing_state || 'unknown'}::pass2.knowledge_state, ${p.max_hydrant_spacing_source || null}::pass2.source_type, ${p.max_hydrant_spacing_ref || null},
        ${p.fire_dept_access_required || 'unknown'}::pass2.ternary, ${p.fire_dept_access_required_state || 'unknown'}::pass2.knowledge_state, ${p.fire_dept_access_required_source || null}::pass2.source_type, ${p.fire_dept_access_required_ref || null},
        ${p.sprinkler_required || 'unknown'}::pass2.ternary, ${p.sprinkler_required_state || 'unknown'}::pass2.knowledge_state, ${p.sprinkler_required_source || null}::pass2.source_type, ${p.sprinkler_required_ref || null},
        ${p.adopted_fire_code || null}, ${p.adopted_fire_code_state || 'unknown'}::pass2.knowledge_state, ${p.adopted_fire_code_source || null}::pass2.source_type, ${p.adopted_fire_code_ref || null}
      )
      ON CONFLICT (county_id) DO UPDATE SET
        fire_lane_required = EXCLUDED.fire_lane_required, fire_lane_required_state = EXCLUDED.fire_lane_required_state,
        fire_lane_required_source = EXCLUDED.fire_lane_required_source, fire_lane_required_ref = EXCLUDED.fire_lane_required_ref,
        min_fire_lane_width = EXCLUDED.min_fire_lane_width, min_fire_lane_width_state = EXCLUDED.min_fire_lane_width_state,
        min_fire_lane_width_source = EXCLUDED.min_fire_lane_width_source, min_fire_lane_width_ref = EXCLUDED.min_fire_lane_width_ref,
        max_hydrant_spacing = EXCLUDED.max_hydrant_spacing, max_hydrant_spacing_state = EXCLUDED.max_hydrant_spacing_state,
        max_hydrant_spacing_source = EXCLUDED.max_hydrant_spacing_source, max_hydrant_spacing_ref = EXCLUDED.max_hydrant_spacing_ref,
        fire_dept_access_required = EXCLUDED.fire_dept_access_required, fire_dept_access_required_state = EXCLUDED.fire_dept_access_required_state,
        fire_dept_access_required_source = EXCLUDED.fire_dept_access_required_source, fire_dept_access_required_ref = EXCLUDED.fire_dept_access_required_ref,
        sprinkler_required = EXCLUDED.sprinkler_required, sprinkler_required_state = EXCLUDED.sprinkler_required_state,
        sprinkler_required_source = EXCLUDED.sprinkler_required_source, sprinkler_required_ref = EXCLUDED.sprinkler_required_ref,
        adopted_fire_code = EXCLUDED.adopted_fire_code, adopted_fire_code_state = EXCLUDED.adopted_fire_code_state,
        adopted_fire_code_source = EXCLUDED.adopted_fire_code_source, adopted_fire_code_ref = EXCLUDED.adopted_fire_code_ref
    `;

    await supabase.from('engine_logs').insert({
      engine: 'pass2_write_fire',
      event: 'fire_written',
      payload: { county_id: p.county_id, upserted: isUpdate },
      status: 'success',
    });

    console.log(`[PASS2_WRITE_FIRE] Success for ${p.county_id}`);
    await sql.end();

    return new Response(
      JSON.stringify({ status: 'written', county_id: p.county_id, upserted: isUpdate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS2_WRITE_FIRE] Error:', error);
    if (sql) await sql.end();
    return new Response(
      JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
