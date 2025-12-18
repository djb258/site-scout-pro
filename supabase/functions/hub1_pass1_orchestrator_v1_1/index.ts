/**
 * ============================================================================
 * PROCESS: hub1.pass1.orchestrator
 * VERSION: v1.1.0
 * FREEZE TAG: hub1_pass1_orchestrator_v1_1@v1.1.0 ✅ FROZEN
 * ============================================================================
 * 
 * THIN CONTROLLER ONLY — no compute, no score, no database access
 * Calls: radius → census → demand → (optional) supply
 * 
 * v1.1 CHANGE: Adds optional supply step via include_supply flag
 * When include_supply=false or omitted: identical to v1.0.0 behavior
 * 
 * DO NOT MODIFY — downstream depends on this shape
 * See: docs/adr/ADR-018-hub1-pass1-orchestrator-v1-1.md
 * ============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PROCESS_ID = "hub1.pass1.orchestrator";
const VERSION = "v1.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StepResult {
  step: string;
  status: "completed" | "failed";
  error?: string;
}

interface OrchestratorInput {
  run_id: string;
  origin_zip: string;
  include_supply?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const steps: StepResult[] = [];
  let run_id = "";
  let origin_zip = "";
  let include_supply = false;

  try {
    const body: OrchestratorInput = await req.json();
    run_id = body.run_id;
    origin_zip = body.origin_zip;
    include_supply = body.include_supply ?? false;

    // ─────────────────────────────────────────────────────────────
    // INPUT VALIDATION
    // ─────────────────────────────────────────────────────────────
    if (!run_id || typeof run_id !== "string") {
      return new Response(
        JSON.stringify({
          run_id: run_id || null,
          origin_zip: origin_zip || null,
          status: "failed",
          failed_step: "validation",
          error: "INVALID_RUN_ID",
          message: "run_id is required and must be a string",
          steps: [],
          failed_at: new Date().toISOString(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!origin_zip || typeof origin_zip !== "string" || !/^\d{5}$/.test(origin_zip)) {
      return new Response(
        JSON.stringify({
          run_id,
          origin_zip: origin_zip || null,
          status: "failed",
          failed_step: "validation",
          error: "INVALID_ORIGIN_ZIP",
          message: "origin_zip is required and must be a 5-digit string",
          steps: [],
          failed_at: new Date().toISOString(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log(`[${PROCESS_ID}@${VERSION}] Starting pipeline for run_id=${run_id}, origin_zip=${origin_zip}, include_supply=${include_supply}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 1: RADIUS
    // ─────────────────────────────────────────────────────────────
    console.log(`[${PROCESS_ID}] Step 1: Calling hub1_pass1_radius`);
    const radiusRes = await fetch(`${supabaseUrl}/functions/v1/hub1_pass1_radius`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        run_id,
        origin_zip,
        radius_miles: 120,
      }),
    });

    if (!radiusRes.ok) {
      const radiusError = await radiusRes.json().catch(() => ({ error: "UNKNOWN_ERROR" }));
      steps.push({ step: "radius", status: "failed", error: radiusError.error || "RADIUS_FAILED" });
      console.error(`[${PROCESS_ID}] Radius failed:`, radiusError);
      return new Response(
        JSON.stringify({
          run_id,
          origin_zip,
          status: "failed",
          failed_step: "radius",
          error: radiusError.error || "RADIUS_FAILED",
          message: "hub1_pass1_radius failed — pipeline halted",
          steps,
          failed_at: new Date().toISOString(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    steps.push({ step: "radius", status: "completed" });
    console.log(`[${PROCESS_ID}] Radius completed`);

    // ─────────────────────────────────────────────────────────────
    // STEP 2: CENSUS
    // ─────────────────────────────────────────────────────────────
    console.log(`[${PROCESS_ID}] Step 2: Calling hub1_pass1_census`);
    const censusRes = await fetch(`${supabaseUrl}/functions/v1/hub1_pass1_census`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        run_id,
      }),
    });

    if (!censusRes.ok) {
      const censusError = await censusRes.json().catch(() => ({ error: "UNKNOWN_ERROR" }));
      steps.push({ step: "census", status: "failed", error: censusError.error || "CENSUS_FAILED" });
      console.error(`[${PROCESS_ID}] Census failed:`, censusError);
      return new Response(
        JSON.stringify({
          run_id,
          origin_zip,
          status: "failed",
          failed_step: "census",
          error: censusError.error || "CENSUS_FAILED",
          message: "hub1_pass1_census failed — pipeline halted",
          steps,
          failed_at: new Date().toISOString(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    steps.push({ step: "census", status: "completed" });
    console.log(`[${PROCESS_ID}] Census completed`);

    // ─────────────────────────────────────────────────────────────
    // STEP 3: DEMAND
    // ─────────────────────────────────────────────────────────────
    console.log(`[${PROCESS_ID}] Step 3: Calling hub1_pass1_demand`);
    const demandRes = await fetch(`${supabaseUrl}/functions/v1/hub1_pass1_demand`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        run_id,
        origin_zip,
      }),
    });

    if (!demandRes.ok) {
      const demandError = await demandRes.json().catch(() => ({ error: "UNKNOWN_ERROR" }));
      steps.push({ step: "demand", status: "failed", error: demandError.error || "DEMAND_FAILED" });
      console.error(`[${PROCESS_ID}] Demand failed:`, demandError);
      return new Response(
        JSON.stringify({
          run_id,
          origin_zip,
          status: "failed",
          failed_step: "demand",
          error: demandError.error || "DEMAND_FAILED",
          message: "hub1_pass1_demand failed — pipeline halted",
          steps,
          failed_at: new Date().toISOString(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    steps.push({ step: "demand", status: "completed" });
    console.log(`[${PROCESS_ID}] Demand completed`);

    // ─────────────────────────────────────────────────────────────
    // STEP 4: SUPPLY (OPTIONAL)
    // ─────────────────────────────────────────────────────────────
    if (include_supply) {
      console.log(`[${PROCESS_ID}] Step 4: Calling hub1_pass1_supply (include_supply=true)`);
      const supplyRes = await fetch(`${supabaseUrl}/functions/v1/hub1_pass1_supply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          run_id,
          origin_zip,
          allow_empty_supply: false,
        }),
      });

      if (!supplyRes.ok) {
        const supplyError = await supplyRes.json().catch(() => ({ error: "UNKNOWN_ERROR" }));
        steps.push({ step: "supply", status: "failed", error: supplyError.error || "SUPPLY_FAILED" });
        console.error(`[${PROCESS_ID}] Supply failed:`, supplyError);
        return new Response(
          JSON.stringify({
            run_id,
            origin_zip,
            status: "failed",
            failed_step: "supply",
            error: supplyError.error || "SUPPLY_FAILED",
            message: "hub1_pass1_supply failed — pipeline halted",
            steps,
            failed_at: new Date().toISOString(),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      steps.push({ step: "supply", status: "completed" });
      console.log(`[${PROCESS_ID}] Supply completed`);
    }

    // ─────────────────────────────────────────────────────────────
    // SUCCESS
    // ─────────────────────────────────────────────────────────────
    const elapsed = Date.now() - startTime;
    console.log(`[${PROCESS_ID}@${VERSION}] Pipeline completed in ${elapsed}ms — ${steps.length} steps`);

    return new Response(
      JSON.stringify({
        run_id,
        origin_zip,
        status: "completed",
        include_supply,
        steps,
        completed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(`[${PROCESS_ID}@${VERSION}] Unexpected error:`, err);
    return new Response(
      JSON.stringify({
        run_id: run_id || null,
        origin_zip: origin_zip || null,
        status: "failed",
        failed_step: "orchestrator",
        error: "ORCHESTRATOR_ERROR",
        message: err instanceof Error ? err.message : "Unknown error",
        steps,
        failed_at: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
