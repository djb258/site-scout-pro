import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================================================
// CONSTANTS (LOCKED)
// ========================================================================
const PROCESS_ID = "hub1.pass1.radius";
const EXPECTED_ZIP_VERSION = "v1.0.0";
const EARTH_RADIUS_MILES = 3959;
const DEFAULT_RADIUS_MILES = 120;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================================================================
// HAVERSINE DISTANCE CALCULATION
// ========================================================================
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // ========================================================================
    // INPUT VALIDATION
    // ========================================================================
    const body = await req.json();
    const { run_id, origin_zip, radius_miles = DEFAULT_RADIUS_MILES } = body;

    if (!run_id || !origin_zip) {
      console.error(`[${PROCESS_ID}] Missing required fields: run_id or origin_zip`);
      return new Response(JSON.stringify({
        error: 'Missing required fields: run_id and origin_zip',
        status: 'error'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[${PROCESS_ID}] Starting radius build for ZIP ${origin_zip}, radius ${radius_miles} miles`);

    // ========================================================================
    // STEP 1: VERSION GUARD (FIRST - MANDATORY)
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 1: Version guard check`);
    
    const { data: versionData, error: versionError } = await supabase
      .from('ref_zip_replica')
      .select('source_version')
      .limit(1)
      .single();

    if (versionError || !versionData) {
      console.error(`[${PROCESS_ID}] FATAL: Cannot read ref_zip_replica - ${versionError?.message}`);
      
      await supabase.from('pass1_skip_log').insert({
        run_id,
        process_id: PROCESS_ID,
        zip: origin_zip,
        skip_reason: 'ZIP_REPLICA_UNAVAILABLE',
        expected_version: EXPECTED_ZIP_VERSION,
        actual_version: null
      });

      return new Response(JSON.stringify({
        run_id,
        status: 'skipped',
        reason: 'ZIP_REPLICA_UNAVAILABLE'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (versionData.source_version !== EXPECTED_ZIP_VERSION) {
      console.error(`[${PROCESS_ID}] VERSION MISMATCH: expected ${EXPECTED_ZIP_VERSION}, got ${versionData.source_version}`);
      
      await supabase.from('pass1_skip_log').insert({
        run_id,
        process_id: PROCESS_ID,
        zip: origin_zip,
        skip_reason: 'ZIP_REPLICA_VERSION_MISMATCH',
        expected_version: EXPECTED_ZIP_VERSION,
        actual_version: versionData.source_version
      });

      return new Response(JSON.stringify({
        run_id,
        status: 'skipped',
        reason: 'ZIP_REPLICA_VERSION_MISMATCH',
        expected_version: EXPECTED_ZIP_VERSION,
        actual_version: versionData.source_version
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[${PROCESS_ID}] Version guard passed: ${EXPECTED_ZIP_VERSION}`);

    // ========================================================================
    // STEP 2: ORIGIN ZIP LOOKUP
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 2: Origin ZIP lookup`);
    
    const { data: origin, error: originError } = await supabase
      .from('ref_zip_replica')
      .select('zip, lat, lng')
      .eq('zip', origin_zip)
      .single();

    if (originError || !origin) {
      console.error(`[${PROCESS_ID}] ZIP NOT FOUND: ${origin_zip}`);
      
      await supabase.from('pass1_skip_log').insert({
        run_id,
        process_id: PROCESS_ID,
        zip: origin_zip,
        skip_reason: 'ZIP_NOT_FOUND',
        expected_version: EXPECTED_ZIP_VERSION,
        actual_version: null
      });

      return new Response(JSON.stringify({
        run_id,
        status: 'skipped',
        reason: 'ZIP_NOT_FOUND',
        zip: origin_zip
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[${PROCESS_ID}] Origin found: ${origin.zip} at (${origin.lat}, ${origin.lng})`);

    // ========================================================================
    // STEP 3: LOAD ALL ZIPS
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 3: Loading all ZIPs from replica`);
    
    const { data: allZips, error: allZipsError } = await supabase
      .from('ref_zip_replica')
      .select('zip, lat, lng');

    if (allZipsError || !allZips) {
      console.error(`[${PROCESS_ID}] Failed to load ZIPs: ${allZipsError?.message}`);
      return new Response(JSON.stringify({
        run_id,
        status: 'error',
        reason: 'FAILED_TO_LOAD_ZIPS'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[${PROCESS_ID}] Loaded ${allZips.length} ZIPs from replica`);

    // ========================================================================
    // STEP 4: HAVERSINE + FILTER ≤ RADIUS
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 4: Computing distances (Haversine)`);
    
    const originLat = Number(origin.lat);
    const originLng = Number(origin.lng);
    
    const radiusZips = allZips
      .map(z => ({
        zip: z.zip,
        lat: Number(z.lat),
        lng: Number(z.lng),
        distance: haversine(originLat, originLng, Number(z.lat), Number(z.lng))
      }))
      .filter(z => z.distance <= radius_miles);

    console.log(`[${PROCESS_ID}] Found ${radiusZips.length} ZIPs within ${radius_miles} miles`);

    // ========================================================================
    // STEP 5: INSERT RESULTS
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 5: Persisting radius ZIP set`);
    
    const insertRows = radiusZips.map(z => ({
      run_id,
      origin_zip,
      zip: z.zip,
      lat: z.lat,
      lng: z.lng,
      distance_miles: Math.round(z.distance * 100) / 100 // Round to 2 decimal places
    }));

    // Insert in batches of 1000 to avoid payload limits
    const BATCH_SIZE = 1000;
    let insertedCount = 0;
    
    for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
      const batch = insertRows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('pass1_radius_zip')
        .insert(batch);
      
      if (insertError) {
        console.error(`[${PROCESS_ID}] Insert error at batch ${i}: ${insertError.message}`);
        return new Response(JSON.stringify({
          run_id,
          status: 'error',
          reason: 'INSERT_FAILED',
          error: insertError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      insertedCount += batch.length;
      console.log(`[${PROCESS_ID}] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}, total: ${insertedCount}`);
    }

    console.log(`[${PROCESS_ID}] Radius build complete: ${insertedCount} ZIPs persisted`);

    // ========================================================================
    // RESPONSE
    // ========================================================================
    return new Response(JSON.stringify({
      run_id,
      origin_zip,
      radius_miles,
      zip_count: insertedCount,
      status: 'completed',
      generated_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${PROCESS_ID}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      status: 'error',
      reason: 'UNEXPECTED_ERROR',
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
