import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * PASS2_WRITE_ENVELOPE Edge Function
 * 
 * DOCTRINE: Claude Code writes WHAT is true. Lovable persists to Neon.
 * Writes to pass2.zoning_envelope table with provenance.
 * Purpose: Numeric constraints for geometry. REQUIRED_FOR_ENVELOPE enforced at view level.
 * 
 * process_id: pass2_write_envelope
 * version: v1.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type KnowledgeState = 'known' | 'unknown' | 'blocked';
type SourceType = 'ordinance' | 'pdf' | 'portal' | 'human';

interface EnvelopePayload {
  county_id: number;
  
  // Setbacks (REQUIRED_FOR_ENVELOPE)
  setback_front?: number;
  setback_front_state?: KnowledgeState;
  setback_front_source?: SourceType;
  setback_front_ref?: string;
  
  setback_side?: number;
  setback_side_state?: KnowledgeState;
  setback_side_source?: SourceType;
  setback_side_ref?: string;
  
  setback_rear?: number;
  setback_rear_state?: KnowledgeState;
  setback_rear_source?: SourceType;
  setback_rear_ref?: string;
  
  // Coverage (REQUIRED_FOR_ENVELOPE)
  max_lot_coverage?: number;
  max_lot_coverage_state?: KnowledgeState;
  max_lot_coverage_source?: SourceType;
  max_lot_coverage_ref?: string;
  
  max_height?: number;
  max_height_state?: KnowledgeState;
  max_height_source?: SourceType;
  max_height_ref?: string;
  
  // Optional coverage fields
  max_far?: number;
  max_far_state?: KnowledgeState;
  max_far_source?: SourceType;
  max_far_ref?: string;
  
  min_open_space?: number;
  min_open_space_state?: KnowledgeState;
  min_open_space_source?: SourceType;
  min_open_space_ref?: string;
  
  max_stories?: number;
  max_stories_state?: KnowledgeState;
  max_stories_source?: SourceType;
  max_stories_ref?: string;
  
  // Buffers
  buffer_residential?: number;
  buffer_residential_state?: KnowledgeState;
  buffer_residential_source?: SourceType;
  buffer_residential_ref?: string;
  
  buffer_waterway?: number;
  buffer_waterway_state?: KnowledgeState;
  buffer_waterway_source?: SourceType;
  buffer_waterway_ref?: string;
  
  buffer_roadway?: number;
  buffer_roadway_state?: KnowledgeState;
  buffer_roadway_source?: SourceType;
  buffer_roadway_ref?: string;
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

    const p: EnvelopePayload = await req.json();

    if (!p.county_id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'county_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PASS2_WRITE_ENVELOPE] Writing envelope for county_id: ${p.county_id}`);

    sql = await getNeonConnection();

    const existing = await sql`
      SELECT id FROM pass2.zoning_envelope WHERE county_id = ${p.county_id} LIMIT 1
    `.catch(() => []);

    const isUpdate = existing.length > 0;

    // Helper to cast knowledge_state
    const ks = (val?: KnowledgeState) => val ? `${val}::pass2.knowledge_state` : "'unknown'::pass2.knowledge_state";
    const st = (val?: SourceType) => val ? `'${val}'::pass2.source_type` : 'NULL';

    await sql`
      INSERT INTO pass2.zoning_envelope (
        county_id,
        setback_front, setback_front_state, setback_front_source, setback_front_ref,
        setback_side, setback_side_state, setback_side_source, setback_side_ref,
        setback_rear, setback_rear_state, setback_rear_source, setback_rear_ref,
        max_lot_coverage, max_lot_coverage_state, max_lot_coverage_source, max_lot_coverage_ref,
        max_height, max_height_state, max_height_source, max_height_ref,
        max_far, max_far_state, max_far_source, max_far_ref,
        min_open_space, min_open_space_state, min_open_space_source, min_open_space_ref,
        max_stories, max_stories_state, max_stories_source, max_stories_ref,
        buffer_residential, buffer_residential_state, buffer_residential_source, buffer_residential_ref,
        buffer_waterway, buffer_waterway_state, buffer_waterway_source, buffer_waterway_ref,
        buffer_roadway, buffer_roadway_state, buffer_roadway_source, buffer_roadway_ref
      ) VALUES (
        ${p.county_id},
        ${p.setback_front ?? null}, ${p.setback_front_state || 'unknown'}::pass2.knowledge_state, ${p.setback_front_source || null}::pass2.source_type, ${p.setback_front_ref || null},
        ${p.setback_side ?? null}, ${p.setback_side_state || 'unknown'}::pass2.knowledge_state, ${p.setback_side_source || null}::pass2.source_type, ${p.setback_side_ref || null},
        ${p.setback_rear ?? null}, ${p.setback_rear_state || 'unknown'}::pass2.knowledge_state, ${p.setback_rear_source || null}::pass2.source_type, ${p.setback_rear_ref || null},
        ${p.max_lot_coverage ?? null}, ${p.max_lot_coverage_state || 'unknown'}::pass2.knowledge_state, ${p.max_lot_coverage_source || null}::pass2.source_type, ${p.max_lot_coverage_ref || null},
        ${p.max_height ?? null}, ${p.max_height_state || 'unknown'}::pass2.knowledge_state, ${p.max_height_source || null}::pass2.source_type, ${p.max_height_ref || null},
        ${p.max_far ?? null}, ${p.max_far_state || 'unknown'}::pass2.knowledge_state, ${p.max_far_source || null}::pass2.source_type, ${p.max_far_ref || null},
        ${p.min_open_space ?? null}, ${p.min_open_space_state || 'unknown'}::pass2.knowledge_state, ${p.min_open_space_source || null}::pass2.source_type, ${p.min_open_space_ref || null},
        ${p.max_stories ?? null}, ${p.max_stories_state || 'unknown'}::pass2.knowledge_state, ${p.max_stories_source || null}::pass2.source_type, ${p.max_stories_ref || null},
        ${p.buffer_residential ?? null}, ${p.buffer_residential_state || 'unknown'}::pass2.knowledge_state, ${p.buffer_residential_source || null}::pass2.source_type, ${p.buffer_residential_ref || null},
        ${p.buffer_waterway ?? null}, ${p.buffer_waterway_state || 'unknown'}::pass2.knowledge_state, ${p.buffer_waterway_source || null}::pass2.source_type, ${p.buffer_waterway_ref || null},
        ${p.buffer_roadway ?? null}, ${p.buffer_roadway_state || 'unknown'}::pass2.knowledge_state, ${p.buffer_roadway_source || null}::pass2.source_type, ${p.buffer_roadway_ref || null}
      )
      ON CONFLICT (county_id) DO UPDATE SET
        setback_front = EXCLUDED.setback_front, setback_front_state = EXCLUDED.setback_front_state, 
        setback_front_source = EXCLUDED.setback_front_source, setback_front_ref = EXCLUDED.setback_front_ref,
        setback_side = EXCLUDED.setback_side, setback_side_state = EXCLUDED.setback_side_state,
        setback_side_source = EXCLUDED.setback_side_source, setback_side_ref = EXCLUDED.setback_side_ref,
        setback_rear = EXCLUDED.setback_rear, setback_rear_state = EXCLUDED.setback_rear_state,
        setback_rear_source = EXCLUDED.setback_rear_source, setback_rear_ref = EXCLUDED.setback_rear_ref,
        max_lot_coverage = EXCLUDED.max_lot_coverage, max_lot_coverage_state = EXCLUDED.max_lot_coverage_state,
        max_lot_coverage_source = EXCLUDED.max_lot_coverage_source, max_lot_coverage_ref = EXCLUDED.max_lot_coverage_ref,
        max_height = EXCLUDED.max_height, max_height_state = EXCLUDED.max_height_state,
        max_height_source = EXCLUDED.max_height_source, max_height_ref = EXCLUDED.max_height_ref,
        max_far = EXCLUDED.max_far, max_far_state = EXCLUDED.max_far_state,
        max_far_source = EXCLUDED.max_far_source, max_far_ref = EXCLUDED.max_far_ref,
        min_open_space = EXCLUDED.min_open_space, min_open_space_state = EXCLUDED.min_open_space_state,
        min_open_space_source = EXCLUDED.min_open_space_source, min_open_space_ref = EXCLUDED.min_open_space_ref,
        max_stories = EXCLUDED.max_stories, max_stories_state = EXCLUDED.max_stories_state,
        max_stories_source = EXCLUDED.max_stories_source, max_stories_ref = EXCLUDED.max_stories_ref,
        buffer_residential = EXCLUDED.buffer_residential, buffer_residential_state = EXCLUDED.buffer_residential_state,
        buffer_residential_source = EXCLUDED.buffer_residential_source, buffer_residential_ref = EXCLUDED.buffer_residential_ref,
        buffer_waterway = EXCLUDED.buffer_waterway, buffer_waterway_state = EXCLUDED.buffer_waterway_state,
        buffer_waterway_source = EXCLUDED.buffer_waterway_source, buffer_waterway_ref = EXCLUDED.buffer_waterway_ref,
        buffer_roadway = EXCLUDED.buffer_roadway, buffer_roadway_state = EXCLUDED.buffer_roadway_state,
        buffer_roadway_source = EXCLUDED.buffer_roadway_source, buffer_roadway_ref = EXCLUDED.buffer_roadway_ref
    `;

    await supabase.from('engine_logs').insert({
      engine: 'pass2_write_envelope',
      event: 'envelope_written',
      payload: { county_id: p.county_id, upserted: isUpdate },
      status: 'success',
    });

    console.log(`[PASS2_WRITE_ENVELOPE] Success for ${p.county_id}`);
    await sql.end();

    return new Response(
      JSON.stringify({ status: 'written', county_id: p.county_id, upserted: isUpdate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS2_WRITE_ENVELOPE] Error:', error);
    if (sql) await sql.end();
    return new Response(
      JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
