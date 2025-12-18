/**
 * ============================================================================
 * PROCESS: hub1.pass1.supply
 * VERSION: v1.0.0
 * ============================================================================
 * DO NOT MODIFY — downstream depends on this shape
 *
 * PURPOSE:
 *   Compute existing storage supply and gap vs baseline demand.
 *
 * READS:
 *   - pass1_radius_zip (frozen geometry)
 *   - pass1_demand_agg (baseline demand per band)
 *
 * WRITES:
 *   - pass1_supply_snapshot (one row per facility)
 *   - pass1_supply_agg (exactly 3 rows: 0-30, 30-60, 60-120)
 *
 * HARD FAILS:
 *   - RADIUS_NOT_FOUND
 *   - DEMAND_NOT_FOUND
 *   - SUPPLY_EMPTY_ABORTED
 *   - BAND_INTEGRITY_ERROR
 *
 * RULES:
 *   ❌ No Neon
 *   ❌ No scoring
 *   ❌ No partial writes
 *   ❌ No retries
 * ============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONSTANTS (LOCKED)
// ============================================================================
const PROCESS_ID = "hub1.pass1.supply";
const VERSION = "v1.0.0";
const PAGE_SIZE = 1000;
const DISTANCE_BANDS = ["0-30", "30-60", "60-120"] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TYPES
// ============================================================================
interface SupplyInput {
  run_id: string;
  origin_zip: string;
  allow_empty_supply?: boolean;
}

interface RadiusZip {
  zip: string;
  distance_miles: number;
}

interface SupplyFacility {
  run_id: string;
  zip: string;
  facility_name: string;
  estimated_sqft: number;
  source: string;
  confidence: "low" | "medium";
}

interface BandAgg {
  band: string;
  facility_count: number;
  supply_sqft: number;
  gap_sqft: number;
  confidence: "low" | "medium";
}

// ============================================================================
// HELPERS
// ============================================================================

function fail(run_id: string, error: string, message: string) {
  return new Response(
    JSON.stringify({ run_id, status: "failed", error, message }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function getBand(distance: number): typeof DISTANCE_BANDS[number] {
  if (distance <= 30) return "0-30";
  if (distance <= 60) return "30-60";
  return "60-120";
}

// Deterministic hash from run_id for mock data generation
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Seeded random number generator
function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let input: SupplyInput;
  try {
    input = await req.json();
  } catch {
    return fail("", "INVALID_INPUT", "Request body must be valid JSON");
  }

  const { run_id, origin_zip, allow_empty_supply = false } = input;

  // Validate input
  if (!run_id || typeof run_id !== "string") {
    return fail(run_id || "", "INVALID_INPUT", "run_id is required");
  }
  if (!origin_zip || typeof origin_zip !== "string") {
    return fail(run_id, "INVALID_INPUT", "origin_zip is required");
  }

  console.log(`[${PROCESS_ID}@${VERSION}] Starting supply analysis for run_id=${run_id}, origin_zip=${origin_zip}`);

  // ==========================================================================
  // HARD GATE 1: Radius Exists
  // ==========================================================================
  const { count: radiusCount, error: radiusError } = await supabase
    .from("pass1_radius_zip")
    .select("*", { count: "exact", head: true })
    .eq("run_id", run_id);

  if (radiusError) {
    console.error(`[${PROCESS_ID}] Radius check error:`, radiusError);
    return fail(run_id, "RADIUS_CHECK_ERROR", radiusError.message);
  }

  if (!radiusCount || radiusCount === 0) {
    console.log(`[${PROCESS_ID}] HARD FAIL: No radius geometry for run_id=${run_id}`);
    return fail(run_id, "RADIUS_NOT_FOUND", "No radius geometry for run_id");
  }

  console.log(`[${PROCESS_ID}] Gate 1 passed: ${radiusCount} radius ZIPs found`);

  // ==========================================================================
  // HARD GATE 2: Demand Exists
  // ==========================================================================
  const { count: demandCount, error: demandError } = await supabase
    .from("pass1_demand_agg")
    .select("*", { count: "exact", head: true })
    .eq("run_id", run_id);

  if (demandError) {
    console.error(`[${PROCESS_ID}] Demand check error:`, demandError);
    return fail(run_id, "DEMAND_CHECK_ERROR", demandError.message);
  }

  if (!demandCount || demandCount === 0) {
    console.log(`[${PROCESS_ID}] HARD FAIL: No baseline demand for run_id=${run_id}`);
    return fail(run_id, "DEMAND_NOT_FOUND", "No baseline demand for run_id");
  }

  console.log(`[${PROCESS_ID}] Gate 2 passed: ${demandCount} demand bands found`);

  // ==========================================================================
  // LOAD RADIUS DATA (PAGINATED)
  // ==========================================================================
  const radiusZips: RadiusZip[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("pass1_radius_zip")
      .select("zip, distance_miles")
      .eq("run_id", run_id)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error(`[${PROCESS_ID}] Radius fetch error:`, error);
      return fail(run_id, "RADIUS_FETCH_ERROR", error.message);
    }

    if (data && data.length > 0) {
      radiusZips.push(...data);
      hasMore = data.length === PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`[${PROCESS_ID}] Loaded ${radiusZips.length} radius ZIPs`);

  // Build ZIP -> distance map
  const zipDistanceMap = new Map<string, number>();
  for (const rz of radiusZips) {
    zipDistanceMap.set(rz.zip, rz.distance_miles);
  }

  // ==========================================================================
  // LOAD DEMAND DATA
  // ==========================================================================
  const { data: demandData, error: demandFetchError } = await supabase
    .from("pass1_demand_agg")
    .select("distance_band, baseline_demand_sqft")
    .eq("run_id", run_id);

  if (demandFetchError) {
    console.error(`[${PROCESS_ID}] Demand fetch error:`, demandFetchError);
    return fail(run_id, "DEMAND_FETCH_ERROR", demandFetchError.message);
  }

  const demandByBand = new Map<string, number>();
  for (const d of demandData || []) {
    demandByBand.set(d.distance_band, Number(d.baseline_demand_sqft));
  }

  console.log(`[${PROCESS_ID}] Loaded demand data:`, Object.fromEntries(demandByBand));

  // ==========================================================================
  // MOCK SUPPLY INGEST (v1.0.0)
  // ==========================================================================
  const seed = hashCode(run_id);
  const supplyRows: SupplyFacility[] = [];

  // Generate ~1 facility per 8-12 ZIPs (deterministic)
  const facilityInterval = 8 + Math.floor(seededRandom(seed, 0) * 5); // 8-12
  
  radiusZips.forEach((rz, index) => {
    // Only create facility at intervals
    if (index % facilityInterval === 0) {
      const sqftBase = 10000 + Math.floor(seededRandom(seed, index) * 70000); // 10k-80k
      const confidence: "low" | "medium" = seededRandom(seed, index + 1000) > 0.6 ? "medium" : "low";
      
      supplyRows.push({
        run_id,
        zip: rz.zip,
        facility_name: `Storage Facility ${index + 1}`,
        estimated_sqft: sqftBase,
        source: "mock",
        confidence, // NEVER "high"
      });
    }
  });

  console.log(`[${PROCESS_ID}] Generated ${supplyRows.length} mock facilities`);

  // ==========================================================================
  // EMPTY SUPPLY GATE
  // ==========================================================================
  if (supplyRows.length === 0 && !allow_empty_supply) {
    console.log(`[${PROCESS_ID}] HARD FAIL: No supply rows and allow_empty_supply=false`);
    return fail(run_id, "SUPPLY_EMPTY_ABORTED", "No supply rows returned and allow_empty_supply=false");
  }

  // ==========================================================================
  // WRITE pass1_supply_snapshot
  // ==========================================================================
  if (supplyRows.length > 0) {
    const { error: snapshotError } = await supabase
      .from("pass1_supply_snapshot")
      .insert(supplyRows);

    if (snapshotError) {
      console.error(`[${PROCESS_ID}] Snapshot insert error:`, snapshotError);
      return fail(run_id, "SNAPSHOT_INSERT_ERROR", snapshotError.message);
    }

    console.log(`[${PROCESS_ID}] Inserted ${supplyRows.length} supply snapshot rows`);
  }

  // ==========================================================================
  // AGGREGATE BY DISTANCE BAND
  // ==========================================================================
  const bandAggs: Map<string, { count: number; sqft: number; lowestConfidence: "low" | "medium" }> = new Map();

  // Initialize all bands
  for (const band of DISTANCE_BANDS) {
    bandAggs.set(band, { count: 0, sqft: 0, lowestConfidence: "medium" });
  }

  // Aggregate supply by band
  for (const facility of supplyRows) {
    const distance = zipDistanceMap.get(facility.zip);
    if (distance === undefined) continue;

    const band = getBand(distance);
    const agg = bandAggs.get(band)!;
    agg.count++;
    agg.sqft += facility.estimated_sqft;
    // "low" beats "medium"
    if (facility.confidence === "low") {
      agg.lowestConfidence = "low";
    }
  }

  // ==========================================================================
  // GAP MATH (LOCKED)
  // ==========================================================================
  const aggRows: BandAgg[] = [];

  for (const band of DISTANCE_BANDS) {
    const agg = bandAggs.get(band)!;
    const baselineDemand = demandByBand.get(band) || 0;
    const gapSqft = baselineDemand - agg.sqft; // Negative allowed (oversupplied)

    aggRows.push({
      band,
      facility_count: agg.count,
      supply_sqft: agg.sqft,
      gap_sqft: gapSqft,
      confidence: agg.lowestConfidence,
    });
  }

  console.log(`[${PROCESS_ID}] Computed gap math:`, aggRows);

  // ==========================================================================
  // WRITE pass1_supply_agg
  // ==========================================================================
  const aggInsertRows = aggRows.map((agg) => ({
    run_id,
    distance_band: agg.band,
    facility_count: agg.facility_count,
    supply_sqft_total: agg.supply_sqft,
    gap_sqft: agg.gap_sqft,
    confidence: agg.confidence,
  }));

  const { error: aggError } = await supabase
    .from("pass1_supply_agg")
    .insert(aggInsertRows);

  if (aggError) {
    // Rollback: delete snapshot rows
    await supabase.from("pass1_supply_snapshot").delete().eq("run_id", run_id);
    console.error(`[${PROCESS_ID}] Agg insert error, rolled back:`, aggError);
    return fail(run_id, "AGG_INSERT_ERROR", aggError.message);
  }

  // ==========================================================================
  // POST-INSERT ASSERTION: Exactly 3 bands
  // ==========================================================================
  const { count: verifyCount } = await supabase
    .from("pass1_supply_agg")
    .select("*", { count: "exact", head: true })
    .eq("run_id", run_id);

  if (verifyCount !== 3) {
    // Rollback all
    await supabase.from("pass1_supply_agg").delete().eq("run_id", run_id);
    await supabase.from("pass1_supply_snapshot").delete().eq("run_id", run_id);
    console.error(`[${PROCESS_ID}] BAND_INTEGRITY_ERROR: Expected 3 bands, got ${verifyCount}`);
    return fail(run_id, "BAND_INTEGRITY_ERROR", `Expected exactly 3 bands, got ${verifyCount}`);
  }

  console.log(`[${PROCESS_ID}] Successfully wrote 3 aggregate bands`);

  // ==========================================================================
  // SUCCESS RESPONSE
  // ==========================================================================
  const response = {
    run_id,
    origin_zip,
    status: "completed",
    facility_count: supplyRows.length,
    bands: aggRows.map((agg) => ({
      band: agg.band,
      facility_count: agg.facility_count,
      supply_sqft: agg.supply_sqft,
      gap_sqft: agg.gap_sqft,
      confidence: agg.confidence,
    })),
  };

  console.log(`[${PROCESS_ID}] Supply analysis completed successfully`);

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
