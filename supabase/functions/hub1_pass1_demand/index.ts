/**
 * ============================================================================
 * PROCESS: hub1.pass1.demand
 * VERSION: v1.0.0
 * ============================================================================
 * DO NOT MODIFY — downstream depends on this shape
 * 
 * PURPOSE: Compute directional storage demand using Census snapshots
 *          over frozen radius geometry
 * 
 * READS FROM:
 *   - pass1_radius_zip (frozen geometry)
 *   - pass1_census_snapshot (Census evidence per run)
 * 
 * WRITES TO:
 *   - pass1_demand_agg (exactly 3 rows per run: 0-30, 30-60, 60-120)
 * 
 * HARD GATES:
 *   - RADIUS_NOT_FOUND: No rows in pass1_radius_zip for run_id
 *   - CENSUS_NOT_FOUND: No rows in pass1_census_snapshot for run_id
 * 
 * POST-INSERT ASSERTION:
 *   - BAND_COUNT_MISMATCH: If rows inserted ≠ 3, rollback and fail
 * ============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONSTANTS (LOCKED)
// ============================================================================
const PROCESS_ID = "hub1.pass1.demand";
const VERSION = "v1.0.0";
const SQFT_PER_PERSON = 6;
const PAGE_SIZE = 1000;
const DISTANCE_BANDS = ["0-30", "30-60", "60-120"] as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// BAND ASSIGNMENT FUNCTION
// ============================================================================
function getBand(distanceMiles: number): string {
  if (distanceMiles <= 30) return "0-30";
  if (distanceMiles <= 60) return "30-60";
  return "60-120";
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
    // PARSE INPUT
    // ========================================================================
    const { run_id, origin_zip } = await req.json();

    if (!run_id || !origin_zip) {
      console.error(`[${PROCESS_ID}] Missing required fields`);
      return new Response(JSON.stringify({
        status: 'error',
        reason: 'INVALID_INPUT',
        message: 'run_id and origin_zip are required'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[${PROCESS_ID}@${VERSION}] Starting demand math for run_id: ${run_id}, origin: ${origin_zip}`);

    // ========================================================================
    // HARD GATE 1: Radius must exist
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 1: Validating radius exists`);
    
    const { count: radiusCount, error: radiusError } = await supabase
      .from('pass1_radius_zip')
      .select('*', { count: 'exact', head: true })
      .eq('run_id', run_id);

    if (radiusError) {
      console.error(`[${PROCESS_ID}] Database error checking radius:`, radiusError);
      throw radiusError;
    }

    if (!radiusCount || radiusCount === 0) {
      console.error(`[${PROCESS_ID}] HARD FAIL: No radius data for run_id ${run_id}`);
      return new Response(JSON.stringify({
        run_id,
        status: 'error',
        reason: 'RADIUS_NOT_FOUND',
        message: 'Demand math requires radius geometry. Run hub1_pass1_radius first.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[${PROCESS_ID}] Radius validated: ${radiusCount} ZIPs`);

    // ========================================================================
    // HARD GATE 2: Census snapshot must exist
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 2: Validating census snapshot exists`);
    
    const { count: censusCount, error: censusError } = await supabase
      .from('pass1_census_snapshot')
      .select('*', { count: 'exact', head: true })
      .eq('run_id', run_id);

    if (censusError) {
      console.error(`[${PROCESS_ID}] Database error checking census:`, censusError);
      throw censusError;
    }

    if (!censusCount || censusCount === 0) {
      console.error(`[${PROCESS_ID}] HARD FAIL: No census snapshot for run_id ${run_id}`);
      return new Response(JSON.stringify({
        run_id,
        status: 'error',
        reason: 'CENSUS_NOT_FOUND',
        message: 'Demand math requires census snapshot. Run hub1_pass1_census first.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[${PROCESS_ID}] Census validated: ${censusCount} ZIPs`);

    // ========================================================================
    // STEP 3: Load radius ZIPs with distances (paginated)
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 3: Loading radius data`);
    
    const radiusData: Array<{ zip: string; distance_miles: number }> = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('pass1_radius_zip')
        .select('zip, distance_miles')
        .eq('run_id', run_id)
        .order('zip')
        .range(from, from + PAGE_SIZE - 1);

      if (batchError) {
        console.error(`[${PROCESS_ID}] Error loading radius batch:`, batchError);
        throw batchError;
      }

      if (batch && batch.length > 0) {
        radiusData.push(...batch);
        from += PAGE_SIZE;
        hasMore = batch.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    console.log(`[${PROCESS_ID}] Loaded ${radiusData.length} radius ZIPs`);

    // ========================================================================
    // STEP 4: Load census population data (paginated)
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 4: Loading census data`);
    
    const censusData: Map<string, number> = new Map();
    from = 0;
    hasMore = true;

    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('pass1_census_snapshot')
        .select('zip_code, population')
        .eq('run_id', run_id)
        .order('zip_code')
        .range(from, from + PAGE_SIZE - 1);

      if (batchError) {
        console.error(`[${PROCESS_ID}] Error loading census batch:`, batchError);
        throw batchError;
      }

      if (batch && batch.length > 0) {
        for (const row of batch) {
          if (row.population !== null) {
            censusData.set(row.zip_code, row.population);
          }
        }
        from += PAGE_SIZE;
        hasMore = batch.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    console.log(`[${PROCESS_ID}] Loaded ${censusData.size} census records with population`);

    // ========================================================================
    // STEP 5: Inner join — only ZIPs with BOTH geometry AND census
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 5: Performing inner join`);
    
    const joinedData = radiusData
      .filter(r => censusData.has(r.zip))
      .map(r => ({
        zip: r.zip,
        distance_miles: Number(r.distance_miles),
        population: censusData.get(r.zip) || 0
      }));

    console.log(`[${PROCESS_ID}] Inner join result: ${joinedData.length} ZIPs`);

    // ========================================================================
    // STEP 6: Aggregate by distance band
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 6: Aggregating by distance band`);
    
    const bandAggregates = DISTANCE_BANDS.map(band => {
      const zipsInBand = joinedData.filter(z => getBand(z.distance_miles) === band);
      const popTotal = zipsInBand.reduce((sum, z) => sum + z.population, 0);
      
      return {
        run_id,
        origin_zip,
        distance_band: band,
        zip_count: zipsInBand.length,
        population_total: popTotal,
        baseline_demand_sqft: popTotal * SQFT_PER_PERSON
      };
    });

    console.log(`[${PROCESS_ID}] Band aggregates computed:`, bandAggregates.map(b => 
      `${b.distance_band}: ${b.zip_count} ZIPs, ${b.population_total} pop, ${b.baseline_demand_sqft} sqft`
    ));

    // ========================================================================
    // STEP 7: Insert exactly 3 rows
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 7: Inserting demand aggregates`);
    
    const { data: insertedRows, error: insertError } = await supabase
      .from('pass1_demand_agg')
      .insert(bandAggregates)
      .select();

    if (insertError) {
      console.error(`[${PROCESS_ID}] Error inserting demand aggregates:`, insertError);
      throw insertError;
    }

    // ========================================================================
    // POST-INSERT ASSERTION: Exactly 3 rows
    // ========================================================================
    const insertedCount = insertedRows?.length || 0;
    
    if (insertedCount !== 3) {
      console.error(`[${PROCESS_ID}] ASSERTION FAILED: Expected 3 rows, got ${insertedCount}`);
      
      // ROLLBACK: Delete any partially inserted rows
      console.log(`[${PROCESS_ID}] Rolling back: deleting rows for run_id ${run_id}`);
      const { error: deleteError } = await supabase
        .from('pass1_demand_agg')
        .delete()
        .eq('run_id', run_id);

      if (deleteError) {
        console.error(`[${PROCESS_ID}] Rollback error:`, deleteError);
      }

      return new Response(JSON.stringify({
        run_id,
        status: 'error',
        reason: 'BAND_COUNT_MISMATCH',
        message: `Expected exactly 3 band rows, inserted ${insertedCount}. Rolled back.`,
        expected: 3,
        actual: insertedCount
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========================================================================
    // RESPONSE
    // ========================================================================
    console.log(`[${PROCESS_ID}@${VERSION}] Demand math completed: 3 bands inserted`);

    return new Response(JSON.stringify({
      run_id,
      origin_zip,
      bands: bandAggregates.map(b => ({
        band: b.distance_band,
        zip_count: b.zip_count,
        population_total: b.population_total,
        baseline_demand_sqft: b.baseline_demand_sqft
      })),
      status: 'completed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error(`[${PROCESS_ID}] Unhandled error:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      status: 'error',
      reason: 'INTERNAL_ERROR',
      message
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
