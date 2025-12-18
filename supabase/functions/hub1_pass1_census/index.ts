/**
 * ============================================================================
 * PROCESS: hub1.pass1.census
 * VERSION: v1.0.0
 * ============================================================================
 * DO NOT MODIFY — downstream depends on this shape
 * 
 * PURPOSE: Snapshot Census data from us_zip_codes for ZIPs in frozen radius
 * 
 * READS FROM:
 *   - pass1_radius_zip (frozen geometry)
 *   - us_zip_codes (Census reference data)
 * 
 * WRITES TO:
 *   - pass1_census_snapshot (evidence per run)
 * 
 * HARD GATE:
 *   - RADIUS_NOT_FOUND: No rows in pass1_radius_zip for run_id
 * ============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONSTANTS (LOCKED)
// ============================================================================
const PROCESS_ID = "hub1.pass1.census";
const VERSION = "v1.0.0";
const VINTAGE_YEAR = 2023;
const PAGE_SIZE = 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    // PARSE INPUT — { run_id } ONLY (no origin_zip)
    // ========================================================================
    const { run_id } = await req.json();

    if (!run_id) {
      console.error(`[${PROCESS_ID}] Missing required field: run_id`);
      return new Response(JSON.stringify({
        status: 'error',
        reason: 'INVALID_INPUT',
        message: 'run_id is required'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[${PROCESS_ID}@${VERSION}] Starting census snapshot for run_id: ${run_id}`);

    // ========================================================================
    // HARD GATE: Radius must exist
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
        message: 'Census snapshot requires radius geometry first. Run hub1_pass1_radius.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[${PROCESS_ID}] Radius validated: ${radiusCount} ZIPs in geometry`);

    // ========================================================================
    // STEP 2: Load all ZIPs from frozen radius (paginated)
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 2: Loading radius ZIPs (paginated)`);
    
    const radiusZips: string[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: batchError } = await supabase
        .from('pass1_radius_zip')
        .select('zip')
        .eq('run_id', run_id)
        .order('zip')
        .range(from, from + PAGE_SIZE - 1);

      if (batchError) {
        console.error(`[${PROCESS_ID}] Error loading radius batch:`, batchError);
        throw batchError;
      }

      if (batch && batch.length > 0) {
        radiusZips.push(...batch.map(r => r.zip));
        from += PAGE_SIZE;
        hasMore = batch.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    console.log(`[${PROCESS_ID}] Loaded ${radiusZips.length} ZIPs from radius`);

    // ========================================================================
    // STEP 3: Query Census data from us_zip_codes (batched)
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 3: Querying Census data from us_zip_codes`);
    
    const BATCH_SIZE = 500;
    const censusRecords: Array<{
      run_id: string;
      zip_code: string;
      population: number | null;
      housing_units: number | null;
      vacancy_rate: number | null;
      vintage_year: number;
    }> = [];

    for (let i = 0; i < radiusZips.length; i += BATCH_SIZE) {
      const zipBatch = radiusZips.slice(i, i + BATCH_SIZE);
      
      const { data: censusData, error: censusError } = await supabase
        .from('us_zip_codes')
        .select('zip, population, density, home_ownership')
        .in('zip', zipBatch);

      if (censusError) {
        console.error(`[${PROCESS_ID}] Error querying Census batch:`, censusError);
        throw censusError;
      }

      if (censusData) {
        for (const row of censusData) {
          censusRecords.push({
            run_id,
            zip_code: row.zip,
            population: row.population,
            // Estimate housing_units from population and density
            housing_units: row.population && row.density 
              ? Math.round(row.population / 2.5) // ~2.5 persons per household
              : null,
            // Estimate vacancy from home_ownership (inverse proxy)
            vacancy_rate: row.home_ownership 
              ? Math.round((100 - row.home_ownership) * 0.1 * 100) / 100 
              : null,
            vintage_year: VINTAGE_YEAR
          });
        }
      }

      console.log(`[${PROCESS_ID}] Processed Census batch ${i + zipBatch.length}/${radiusZips.length}`);
    }

    console.log(`[${PROCESS_ID}] Census data retrieved for ${censusRecords.length} ZIPs`);

    // ========================================================================
    // STEP 4: Insert Census snapshot (batched)
    // ========================================================================
    console.log(`[${PROCESS_ID}] Step 4: Inserting Census snapshot`);
    
    const INSERT_BATCH = 500;
    let insertedCount = 0;

    for (let i = 0; i < censusRecords.length; i += INSERT_BATCH) {
      const batch = censusRecords.slice(i, i + INSERT_BATCH);
      
      const { error: insertError } = await supabase
        .from('pass1_census_snapshot')
        .upsert(batch, { onConflict: 'run_id,zip_code' });

      if (insertError) {
        console.error(`[${PROCESS_ID}] Error inserting Census batch:`, insertError);
        throw insertError;
      }

      insertedCount += batch.length;
      console.log(`[${PROCESS_ID}] Inserted ${insertedCount}/${censusRecords.length} Census records`);
    }

    // ========================================================================
    // RESPONSE
    // ========================================================================
    console.log(`[${PROCESS_ID}@${VERSION}] Census snapshot completed: ${insertedCount} ZIPs`);

    return new Response(JSON.stringify({
      run_id,
      zip_count: insertedCount,
      vintage_year: VINTAGE_YEAR,
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
