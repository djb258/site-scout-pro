import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';

/**
 * PASS2_GET_JURISDICTION_CARD Edge Function
 * 
 * DOCTRINE: Pass 3 reads blindly from pass2.v_jurisdiction_card_for_pass3.
 * If Pass 2 lies, that's a Pass 2 bug.
 * 
 * Responsibilities:
 * 1. Fetch complete jurisdiction card from the view
 * 2. Return envelope_complete status
 * 3. Return fatal_prohibition check
 * 4. Return all facts needed for solver
 * 
 * process_id: pass2_get_jurisdiction_card
 * version: v1.0.0
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JurisdictionCard {
  county_id: number;
  state: string;
  county_name: string;
  county_fips: string | null;
  
  // Computed status
  envelope_complete: boolean;
  has_fatal_prohibition: boolean;
  is_storage_allowed: 'yes' | 'no' | 'unknown';
  
  // Scope
  authority_model: string | null;
  zoning_model: string | null;
  controlling_authority_name: string | null;
  
  // Viability
  storage_allowed: string;
  fatal_prohibition: string;
  fatal_prohibition_description: string | null;
  conditional_use_required: string;
  discretionary_required: string;
  
  // Envelope (for solver)
  setback_front: number | null;
  setback_side: number | null;
  setback_rear: number | null;
  max_lot_coverage: number | null;
  max_height: number | null;
  max_stories: number | null;
  max_far: number | null;
  buffer_residential: number | null;
  buffer_waterway: number | null;
  buffer_roadway: number | null;
  
  // Fire/Life Safety
  fire_lane_required: string;
  min_fire_lane_width: number | null;
  sprinkler_required: string;
  adopted_fire_code: string | null;
  
  // Stormwater
  detention_required: string;
  retention_required: string;
  max_impervious: number | null;
  watershed_overlay: string;
  floodplain_overlay: string;
  
  // Parking
  parking_required: string;
  parking_ratio: number | null;
  parking_ratio_unit: string | null;
  truck_access_required: string;
  min_driveway_width: number | null;
}

interface GetCardResult {
  status: 'found' | 'not_found' | 'blocked' | 'error';
  card?: JurisdictionCard;
  message?: string;
  warnings?: string[];
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
    const { county_id, county_name, state } = await req.json();

    if (!county_id && (!county_name || !state)) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Either county_id or (county_name + state) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    sql = await getNeonConnection();

    // Query from the pass3 view (read blindly!)
    let result;
    if (county_id) {
      result = await sql`
        SELECT * FROM pass2.v_jurisdiction_card_for_pass3
        WHERE county_id = ${county_id}
        LIMIT 1
      `;
    } else {
      result = await sql`
        SELECT * FROM pass2.v_jurisdiction_card_for_pass3
        WHERE county_name ILIKE ${county_name}
          AND state = ${state}
        LIMIT 1
      `;
    }

    if (result.length === 0) {
      await sql.end();
      return new Response(
        JSON.stringify({ 
          status: 'not_found',
          message: `No jurisdiction card found for ${county_id || `${county_name}, ${state}`}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const row = result[0];
    const warnings: string[] = [];

    // Check for blocking conditions
    if (row.has_fatal_prohibition) {
      await sql.end();
      return new Response(
        JSON.stringify({ 
          status: 'blocked',
          message: `Fatal prohibition: ${row.fatal_prohibition_description || 'Storage not allowed'}`,
          card: row as unknown as JurisdictionCard,
          warnings: ['BLOCKED: fatal_prohibition = yes'],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add warnings for incomplete envelope
    if (!row.envelope_complete) {
      warnings.push('Envelope incomplete - some REQUIRED_FOR_ENVELOPE fields are unknown');
    }

    if (row.is_storage_allowed === 'unknown') {
      warnings.push('Storage allowance unknown - proceed with caution');
    }

    const response: GetCardResult = {
      status: 'found',
      card: row as unknown as JurisdictionCard,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    console.log(`[PASS2_GET_CARD] Found card for ${row.county_id}, envelope_complete: ${row.envelope_complete}`);
    await sql.end();

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS2_GET_CARD] Error:', error);
    if (sql) await sql.end();
    return new Response(
      JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
