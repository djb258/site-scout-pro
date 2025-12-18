/**
 * PROCESS: hub1.pass1.orchestrator
 * VERSION: v1.0.0
 * DO NOT MODIFY — downstream depends on this shape
 * 
 * CONTROL ONLY — no compute, no score, no database access
 * Calls: hub1_pass1_radius → hub1_pass1_census → hub1_pass1_demand
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PROCESS_ID = "hub1.pass1.orchestrator";
const VERSION = "v1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { run_id, origin_zip } = await req.json();

    // Validate input
    if (!run_id || !origin_zip) {
      return new Response(JSON.stringify({
        run_id: run_id || null,
        origin_zip: origin_zip || null,
        status: "failed",
        failed_step: "validation",
        error: "INVALID_INPUT",
        message: "run_id and origin_zip are required",
        steps: []
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const steps: { step: string; status: string }[] = [];

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: hub1_pass1_radius
    // ═══════════════════════════════════════════════════════════════
    console.log(`[${PROCESS_ID}] Step 1: Calling hub1_pass1_radius`);
    
    const radiusResponse = await fetch(`${SUPABASE_URL}/functions/v1/hub1_pass1_radius`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ run_id, origin_zip, radius_miles: 120 })
    });

    const radiusResult = await radiusResponse.json();
    
    if (radiusResult.status !== "completed") {
      steps.push({ step: "radius", status: "failed" });
      console.log(`[${PROCESS_ID}] HALT: hub1_pass1_radius failed`);
      return new Response(JSON.stringify({
        run_id,
        origin_zip,
        status: "failed",
        failed_step: "radius",
        error: radiusResult.error || "RADIUS_FAILED",
        message: "hub1_pass1_radius failed — pipeline halted",
        steps
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    steps.push({ step: "radius", status: "completed" });
    console.log(`[${PROCESS_ID}] Step 1 completed: ${radiusResult.zip_count} ZIPs`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: hub1_pass1_census
    // ⚠️ DO NOT PASS origin_zip
    // ═══════════════════════════════════════════════════════════════
    console.log(`[${PROCESS_ID}] Step 2: Calling hub1_pass1_census`);
    
    const censusResponse = await fetch(`${SUPABASE_URL}/functions/v1/hub1_pass1_census`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ run_id }) // ⚠️ NO origin_zip
    });

    const censusResult = await censusResponse.json();
    
    if (censusResult.status !== "completed") {
      steps.push({ step: "census", status: "failed" });
      console.log(`[${PROCESS_ID}] HALT: hub1_pass1_census failed`);
      return new Response(JSON.stringify({
        run_id,
        origin_zip,
        status: "failed",
        failed_step: "census",
        error: censusResult.error || "CENSUS_FAILED",
        message: "hub1_pass1_census failed — pipeline halted",
        steps
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    steps.push({ step: "census", status: "completed" });
    console.log(`[${PROCESS_ID}] Step 2 completed: ${censusResult.inserted_count} ZIPs snapshotted`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: hub1_pass1_demand
    // ═══════════════════════════════════════════════════════════════
    console.log(`[${PROCESS_ID}] Step 3: Calling hub1_pass1_demand`);
    
    const demandResponse = await fetch(`${SUPABASE_URL}/functions/v1/hub1_pass1_demand`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ run_id, origin_zip })
    });

    const demandResult = await demandResponse.json();
    
    if (demandResult.status !== "completed") {
      steps.push({ step: "demand", status: "failed" });
      console.log(`[${PROCESS_ID}] HALT: hub1_pass1_demand failed`);
      return new Response(JSON.stringify({
        run_id,
        origin_zip,
        status: "failed",
        failed_step: "demand",
        error: demandResult.error || "DEMAND_FAILED",
        message: "hub1_pass1_demand failed — pipeline halted",
        steps
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    steps.push({ step: "demand", status: "completed" });
    console.log(`[${PROCESS_ID}] Step 3 completed: ${demandResult.bands?.length || 3} bands computed`);

    // ═══════════════════════════════════════════════════════════════
    // SUCCESS — All 3 steps completed
    // ═══════════════════════════════════════════════════════════════
    console.log(`[${PROCESS_ID}] Pipeline completed successfully`);
    
    return new Response(JSON.stringify({
      run_id,
      origin_zip,
      status: "completed",
      steps,
      completed_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${PROCESS_ID}] Unhandled error:`, error);
    return new Response(JSON.stringify({
      status: "failed",
      failed_step: "orchestrator",
      error: "INTERNAL_ERROR",
      message: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
