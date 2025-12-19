import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * PASS2_WRITE_PARKING Edge Function
 * 
 * DOCTRINE: Claude Code writes WHAT is true. Lovable persists to Neon.
 * Writes to pass2.parking_access table with provenance.
 * 
 * process_id: pass2_write_parking
 * version: v1.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Ternary = 'yes' | 'no' | 'unknown';
type KnowledgeState = 'known' | 'unknown' | 'blocked';
type SourceType = 'ordinance' | 'pdf' | 'portal' | 'human';

interface ParkingPayload {
  county_id: number;
  
  parking_required?: Ternary;
  parking_required_state?: KnowledgeState;
  parking_required_source?: SourceType;
  parking_required_ref?: string;
  
  parking_ratio?: number;
  parking_ratio_state?: KnowledgeState;
  parking_ratio_source?: SourceType;
  parking_ratio_ref?: string;
  parking_ratio_unit?: string;
  
  truck_access_required?: Ternary;
  truck_access_required_state?: KnowledgeState;
  truck_access_required_source?: SourceType;
  truck_access_required_ref?: string;
  
  min_driveway_width?: number;
  min_driveway_width_state?: KnowledgeState;
  min_driveway_width_source?: SourceType;
  min_driveway_width_ref?: string;
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

    const p: ParkingPayload = await req.json();

    if (!p.county_id) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'county_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PASS2_WRITE_PARKING] Writing parking/access for county_id: ${p.county_id}`);

    sql = await getNeonConnection();

    const existing = await sql`
      SELECT id FROM pass2.parking_access WHERE county_id = ${p.county_id} LIMIT 1
    `.catch(() => []);

    const isUpdate = existing.length > 0;

    await sql`
      INSERT INTO pass2.parking_access (
        county_id,
        parking_required, parking_required_state, parking_required_source, parking_required_ref,
        parking_ratio, parking_ratio_state, parking_ratio_source, parking_ratio_ref, parking_ratio_unit,
        truck_access_required, truck_access_required_state, truck_access_required_source, truck_access_required_ref,
        min_driveway_width, min_driveway_width_state, min_driveway_width_source, min_driveway_width_ref
      ) VALUES (
        ${p.county_id},
        ${p.parking_required || 'unknown'}::pass2.ternary, ${p.parking_required_state || 'unknown'}::pass2.knowledge_state, ${p.parking_required_source || null}::pass2.source_type, ${p.parking_required_ref || null},
        ${p.parking_ratio ?? null}, ${p.parking_ratio_state || 'unknown'}::pass2.knowledge_state, ${p.parking_ratio_source || null}::pass2.source_type, ${p.parking_ratio_ref || null}, ${p.parking_ratio_unit || null},
        ${p.truck_access_required || 'unknown'}::pass2.ternary, ${p.truck_access_required_state || 'unknown'}::pass2.knowledge_state, ${p.truck_access_required_source || null}::pass2.source_type, ${p.truck_access_required_ref || null},
        ${p.min_driveway_width ?? null}, ${p.min_driveway_width_state || 'unknown'}::pass2.knowledge_state, ${p.min_driveway_width_source || null}::pass2.source_type, ${p.min_driveway_width_ref || null}
      )
      ON CONFLICT (county_id) DO UPDATE SET
        parking_required = EXCLUDED.parking_required, parking_required_state = EXCLUDED.parking_required_state,
        parking_required_source = EXCLUDED.parking_required_source, parking_required_ref = EXCLUDED.parking_required_ref,
        parking_ratio = EXCLUDED.parking_ratio, parking_ratio_state = EXCLUDED.parking_ratio_state,
        parking_ratio_source = EXCLUDED.parking_ratio_source, parking_ratio_ref = EXCLUDED.parking_ratio_ref,
        parking_ratio_unit = EXCLUDED.parking_ratio_unit,
        truck_access_required = EXCLUDED.truck_access_required, truck_access_required_state = EXCLUDED.truck_access_required_state,
        truck_access_required_source = EXCLUDED.truck_access_required_source, truck_access_required_ref = EXCLUDED.truck_access_required_ref,
        min_driveway_width = EXCLUDED.min_driveway_width, min_driveway_width_state = EXCLUDED.min_driveway_width_state,
        min_driveway_width_source = EXCLUDED.min_driveway_width_source, min_driveway_width_ref = EXCLUDED.min_driveway_width_ref
    `;

    await supabase.from('engine_logs').insert({
      engine: 'pass2_write_parking',
      event: 'parking_written',
      payload: { county_id: p.county_id, upserted: isUpdate },
      status: 'success',
    });

    console.log(`[PASS2_WRITE_PARKING] Success for ${p.county_id}`);
    await sql.end();

    return new Response(
      JSON.stringify({ status: 'written', county_id: p.county_id, upserted: isUpdate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS2_WRITE_PARKING] Error:', error);
    if (sql) await sql.end();
    return new Response(
      JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
