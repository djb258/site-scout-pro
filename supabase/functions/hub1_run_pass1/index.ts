import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// CONSTANTS — DO NOT INLINE (NO MAGIC NUMBERS)
// ============================================================================
const SCHEMA_VERSION = "v1.0";
const PROCESS_ID = "hub1.pass1";

// Kill Switch Thresholds
const MIN_DENSITY_THRESHOLD = 100;      // people per sq mile
const MIN_POP_ACRE = 0.1;               // population per acre minimum
const MIN_POPULATION = 5000;            // absolute population floor
const MIN_INCOME = 30000;               // median income floor

// Scoring Weights (LOCKED)
const SCORING_WEIGHTS = {
  demand: 0.40,
  supply: 0.35,
  constraints: 0.25
} as const;

// Decision Thresholds
const ADVANCE_THRESHOLD = 60;
const REJECT_THRESHOLD = 40;

// TTL
const TTL_DAYS = 30;

// Asset Type Whitelist (from Pass0)
const ASSET_TYPE_WHITELIST = [
  "traditional_self_storage",
  "climate_controlled",
  "rv_boat_storage",
  "truck_industrial"
];

// Earth radius in miles for Haversine
const EARTH_RADIUS_MILES = 3959;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPES
// ============================================================================
interface Pass1Request {
  zip: string;
  radius_miles?: number;
  asset_types: string[];
  pass0_signals?: Record<string, unknown>;
  run_id: string;
}

interface ZipData {
  zip: string;
  city: string | null;
  county_name: string | null;
  state_name: string | null;
  state_id: string | null;
  lat: number | null;
  lng: number | null;
  population: number | null;
  density: number | null;
  income_household_median: number | null;
  home_value: number | null;
  rent_median: number | null;
}

interface County {
  name: string;
  fips: string;
  population: number;
  distance_miles: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return EARTH_RADIUS_MILES * c;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const startTime = Date.now();

  // Helper to log steps
  const logStep = async (
    run_id: string,
    step: string,
    status: string,
    metadata: Record<string, unknown> = {},
    competition_confidence?: string
  ) => {
    await supabase.from('hub1_pass1_run_log').insert({
      run_id,
      process_id: PROCESS_ID,
      step,
      status,
      metadata,
      schema_version: SCHEMA_VERSION,
      scoring_weights: SCORING_WEIGHTS,
      competition_confidence: competition_confidence || null
    });
  };

  // Helper to log errors
  const logError = async (
    run_id: string,
    step: string,
    error_code: string,
    error_message: string,
    fatal: boolean = true,
    metadata: Record<string, unknown> = {}
  ) => {
    await supabase.from('hub1_pass1_error_log').insert({
      run_id,
      process_id: PROCESS_ID,
      step,
      error_code,
      error_message,
      fatal,
      recoverable: !fatal,
      metadata
    });
  };

  try {
    const body: Pass1Request = await req.json();
    const { zip, radius_miles = 120, asset_types, pass0_signals, run_id } = body;

    console.log(`[HUB1_PASS1] Starting run ${run_id} for ZIP ${zip}`);

    // ========================================================================
    // STEP 1: INPUT VALIDATION
    // ========================================================================
    await logStep(run_id, 'init', 'started', { zip, radius_miles, asset_types });

    // Validate run_id
    if (!run_id) {
      await logError(run_id || 'unknown', 'init', 'MISSING_RUN_ID', 'run_id is required', true);
      return new Response(JSON.stringify({
        error: 'run_id is required',
        kill_reason: 'MISSING_RUN_ID'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate ZIP format
    if (!zip || !/^\d{5}$/.test(zip)) {
      await logError(run_id, 'init', 'INVALID_ZIP_FORMAT', `Invalid ZIP format: ${zip}`, true);
      return new Response(JSON.stringify({
        run_id,
        process_id: PROCESS_ID,
        decision: 'reject',
        kill_reason: 'INVALID_ZIP_FORMAT',
        generated_at: new Date().toISOString()
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate asset_types against whitelist
    if (!asset_types || asset_types.length === 0) {
      await logError(run_id, 'init', 'MISSING_ASSET_TYPES', 'asset_types array is required', true);
      return new Response(JSON.stringify({
        run_id,
        process_id: PROCESS_ID,
        decision: 'reject',
        kill_reason: 'MISSING_ASSET_TYPES',
        generated_at: new Date().toISOString()
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const invalidAssetTypes = asset_types.filter(t => !ASSET_TYPE_WHITELIST.includes(t));
    if (invalidAssetTypes.length > 0) {
      await logError(run_id, 'init', 'INVALID_ASSET_TYPES', `Invalid asset types: ${invalidAssetTypes.join(', ')}`, true, {
        invalid: invalidAssetTypes,
        allowed: ASSET_TYPE_WHITELIST
      });
      return new Response(JSON.stringify({
        run_id,
        process_id: PROCESS_ID,
        decision: 'reject',
        kill_reason: 'INVALID_ASSET_TYPES',
        generated_at: new Date().toISOString()
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await logStep(run_id, 'init', 'completed', { validation: 'passed' });

    // ========================================================================
    // STEP 2: ZIP HYDRATION
    // ========================================================================
    await logStep(run_id, 'zip_hydration', 'started');

    const { data: zipData, error: zipError } = await supabase
      .from('us_zip_codes')
      .select('zip, city, county_name, state_name, state_id, lat, lng, population, density, income_household_median, home_value, rent_median')
      .eq('zip', zip)
      .single();

    // KILL SWITCH: ZIP not found
    if (zipError || !zipData) {
      await logError(run_id, 'zip_hydration', 'ZIP_NOT_FOUND', `ZIP ${zip} not found in database`, true);
      await logStep(run_id, 'complete', 'rejected', { kill_reason: 'ZIP_NOT_FOUND' });
      return new Response(JSON.stringify({
        run_id,
        process_id: PROCESS_ID,
        schema_version: SCHEMA_VERSION,
        zip,
        decision: 'reject',
        kill_reason: 'ZIP_NOT_FOUND',
        generated_at: new Date().toISOString()
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const typedZipData = zipData as ZipData;

    // KILL SWITCH: Population below threshold
    if ((typedZipData.population || 0) < MIN_POPULATION) {
      await logError(run_id, 'zip_hydration', 'POPULATION_TOO_LOW', 
        `Population ${typedZipData.population} below threshold ${MIN_POPULATION}`, true, {
        actual: typedZipData.population,
        threshold: MIN_POPULATION
      });
      await logStep(run_id, 'complete', 'rejected', { kill_reason: 'POPULATION_TOO_LOW' });
      return new Response(JSON.stringify({
        run_id,
        process_id: PROCESS_ID,
        schema_version: SCHEMA_VERSION,
        zip,
        zip_metadata: typedZipData,
        decision: 'reject',
        kill_reason: 'POPULATION_TOO_LOW',
        generated_at: new Date().toISOString()
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // KILL SWITCH: Density below threshold
    if ((typedZipData.density || 0) < MIN_DENSITY_THRESHOLD) {
      await logError(run_id, 'zip_hydration', 'DENSITY_TOO_LOW', 
        `Density ${typedZipData.density} below threshold ${MIN_DENSITY_THRESHOLD}`, true, {
        actual: typedZipData.density,
        threshold: MIN_DENSITY_THRESHOLD
      });
      await logStep(run_id, 'complete', 'rejected', { kill_reason: 'DENSITY_TOO_LOW' });
      return new Response(JSON.stringify({
        run_id,
        process_id: PROCESS_ID,
        schema_version: SCHEMA_VERSION,
        zip,
        zip_metadata: typedZipData,
        decision: 'reject',
        kill_reason: 'DENSITY_TOO_LOW',
        generated_at: new Date().toISOString()
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await logStep(run_id, 'zip_hydration', 'completed', { zip_metadata: typedZipData });

    // ========================================================================
    // STEP 3: RADIUS COUNTIES DERIVATION
    // ========================================================================
    await logStep(run_id, 'radius_analysis', 'started', { radius_miles });

    const centerLat = typedZipData.lat || 0;
    const centerLng = typedZipData.lng || 0;

    // Get all ZIPs and filter by distance
    const { data: allZips } = await supabase
      .from('us_zip_codes')
      .select('county_name, county_fips, population, lat, lng')
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    const countiesMap = new Map<string, County>();
    let totalPopulationInRadius = 0;

    if (allZips) {
      for (const z of allZips) {
        if (z.lat && z.lng) {
          const distance = haversineDistance(centerLat, centerLng, z.lat, z.lng);
          if (distance <= radius_miles && z.county_name) {
            totalPopulationInRadius += z.population || 0;
            
            if (!countiesMap.has(z.county_name)) {
              countiesMap.set(z.county_name, {
                name: z.county_name,
                fips: z.county_fips || 'unknown',
                population: z.population || 0,
                distance_miles: Math.round(distance * 10) / 10
              });
            } else {
              const existing = countiesMap.get(z.county_name)!;
              existing.population += z.population || 0;
            }
          }
        }
      }
    }

    const derivedCounties = Array.from(countiesMap.values())
      .sort((a, b) => a.distance_miles - b.distance_miles)
      .slice(0, 20);

    await logStep(run_id, 'radius_analysis', 'completed', {
      counties_count: derivedCounties.length,
      total_population_in_radius: totalPopulationInRadius
    });

    // ========================================================================
    // STEP 4: DEMAND PROXIES (Cheap Calculations)
    // ========================================================================
    await logStep(run_id, 'demand_proxies', 'started');

    const population = typedZipData.population || 0;
    const density = typedZipData.density || 0;
    const income = typedZipData.income_household_median || 0;
    const homeValue = typedZipData.home_value || 0;

    // Normalize scores to 0-100 range
    const populationScore = Math.min(100, Math.round((population / 50000) * 100));
    const densityScore = Math.min(100, Math.round((density / 5000) * 100));
    const incomeScore = Math.min(100, Math.round((income / 100000) * 100));
    const housingValueScore = Math.min(100, Math.round((homeValue / 500000) * 100));
    
    // Commercial presence heuristic (income × density proxy)
    const commercialScore = Math.min(100, Math.round((income * density) / 5000000 * 100));

    // Overall demand score (weighted average)
    const demandScore = Math.round(
      populationScore * 0.25 +
      densityScore * 0.20 +
      incomeScore * 0.25 +
      housingValueScore * 0.15 +
      commercialScore * 0.15
    );

    const demandProxies = {
      population,
      density,
      income,
      housing_value: homeValue,
      scores: {
        population_score: populationScore,
        density_score: densityScore,
        income_score: incomeScore,
        housing_value_score: housingValueScore,
        commercial_score: commercialScore
      },
      demand_score: demandScore
    };

    await logStep(run_id, 'demand_proxies', 'completed', { demand_proxies: demandProxies });

    // ========================================================================
    // STEP 5: COMPETITION SCAN (Surface - confidence always low/medium)
    // ========================================================================
    await logStep(run_id, 'competition_scan', 'started');

    // Inferred competition (no external data source) = "low" confidence
    // Hub 1 may NEVER emit "high"
    const competition_confidence: "low" | "medium" = "low";

    // Estimate competition based on population/density (rough heuristic)
    const estimatedCompetitorCount = Math.round((population / 10000) * (density / 1000) * 2);
    
    // Derive rent bands from rent_median
    const rentMedian = typedZipData.rent_median || 1000;
    const rentBands = {
      low: Math.round(rentMedian * 0.08),    // ~8% of rent for small unit
      medium: Math.round(rentMedian * 0.12), // ~12% for medium
      high: Math.round(rentMedian * 0.18)    // ~18% for large/climate
    };

    // Saturation level heuristic
    const saturationRatio = estimatedCompetitorCount / (population / 5000);
    const saturationLevel = saturationRatio > 2 ? 'oversaturated' : 
                           saturationRatio > 1 ? 'saturated' : 
                           saturationRatio > 0.5 ? 'moderate' : 'undersaturated';

    // Supply gap score (inverse of saturation)
    const supplyGapScore = saturationLevel === 'undersaturated' ? 85 :
                          saturationLevel === 'moderate' ? 65 :
                          saturationLevel === 'saturated' ? 40 : 20;

    const competitionSummary = {
      estimated_count: estimatedCompetitorCount,
      rent_bands: rentBands,
      saturation_level: saturationLevel,
      confidence: competition_confidence
    };

    await logStep(run_id, 'competition_scan', 'completed', { 
      competition_summary: competitionSummary,
      supply_gap_score: supplyGapScore
    }, competition_confidence);

    // ========================================================================
    // STEP 6: CONSTRAINT ENFORCEMENT
    // ========================================================================
    await logStep(run_id, 'constraints', 'started');

    // $5k+/acre/month viability rule (rough math using home_value as land proxy)
    // Assume land cost ~ 30% of home value, need $5k/acre/month revenue
    const estimatedLandCostPerAcre = homeValue * 0.3;
    const requiredMonthlyRevenuePerAcre = 5000;
    const viabilityRatio = (rentBands.medium * 50) / requiredMonthlyRevenuePerAcre; // 50 units/acre rough estimate

    // Zoning red-flag heuristics
    const isMilitaryZip = typedZipData.state_id === 'military'; // Placeholder check
    const isExtremeDensity = density > 20000; // Very urban = zoning challenges

    // Constraint score
    let constraintScore = 70; // Base score
    if (viabilityRatio < 0.8) constraintScore -= 20;
    if (viabilityRatio < 0.5) constraintScore -= 20;
    if (isMilitaryZip) constraintScore -= 30;
    if (isExtremeDensity) constraintScore -= 15;
    constraintScore = Math.max(0, Math.min(100, constraintScore));

    // KILL SWITCH: Viability threshold failure
    if (constraintScore < 20) {
      await logError(run_id, 'constraints', 'VIABILITY_THRESHOLD_FAILED', 
        `Constraint score ${constraintScore} below minimum`, true, {
        constraint_score: constraintScore,
        viability_ratio: viabilityRatio
      });
      await logStep(run_id, 'complete', 'rejected', { kill_reason: 'VIABILITY_THRESHOLD_FAILED' });
      return new Response(JSON.stringify({
        run_id,
        process_id: PROCESS_ID,
        schema_version: SCHEMA_VERSION,
        zip,
        zip_metadata: typedZipData,
        demand_proxies: demandProxies,
        competition_summary: competitionSummary,
        decision: 'reject',
        kill_reason: 'VIABILITY_THRESHOLD_FAILED',
        generated_at: new Date().toISOString()
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await logStep(run_id, 'constraints', 'completed', {
      constraint_score: constraintScore,
      viability_ratio: viabilityRatio,
      flags: { is_military: isMilitaryZip, extreme_density: isExtremeDensity }
    });

    // ========================================================================
    // STEP 7: SCORING (Deterministic Weighted Sum)
    // ========================================================================
    await logStep(run_id, 'scoring', 'started');

    const rawScores = {
      demand: demandScore,
      supply: supplyGapScore,
      constraints: constraintScore
    };

    // Final score = deterministic weighted sum (NO MAGIC NUMBERS)
    const finalScore = Math.round(
      rawScores.demand * SCORING_WEIGHTS.demand +
      rawScores.supply * SCORING_WEIGHTS.supply +
      rawScores.constraints * SCORING_WEIGHTS.constraints
    );

    // Decision classification
    const decision = finalScore >= ADVANCE_THRESHOLD ? "advance" :
                    finalScore < REJECT_THRESHOLD ? "reject" : 
                    "insufficient_data";

    await logStep(run_id, 'scoring', 'completed', {
      raw_scores: rawScores,
      weights: SCORING_WEIGHTS,
      final_score: finalScore,
      decision
    });

    // ========================================================================
    // STEP 8: BUILD RESPONSE (OpportunityObject)
    // ========================================================================
    const runtime_ms = Date.now() - startTime;

    await logStep(run_id, 'complete', 'completed', {
      decision,
      viability_score: finalScore,
      runtime_ms
    }, competition_confidence);

    const response = {
      run_id,
      process_id: PROCESS_ID,
      schema_version: SCHEMA_VERSION,
      zip,
      radius_miles,
      zip_metadata: {
        city: typedZipData.city,
        county: typedZipData.county_name,
        state: typedZipData.state_name,
        state_id: typedZipData.state_id,
        lat: typedZipData.lat,
        lng: typedZipData.lng,
        population: typedZipData.population,
        density: typedZipData.density,
        income: typedZipData.income_household_median,
        home_value: typedZipData.home_value,
        rent_median: typedZipData.rent_median
      },
      derived_counties: derivedCounties,
      total_population_in_radius: totalPopulationInRadius,
      demand_proxies: demandProxies,
      competition_summary: competitionSummary,
      scoring: {
        raw_scores: rawScores,
        weights: SCORING_WEIGHTS,
        final_score: finalScore
      },
      viability_score: finalScore,
      decision,
      kill_reason: null,
      confidence_flags: {
        competition: competition_confidence
      },
      runtime_ms,
      generated_at: new Date().toISOString()
    };

    console.log(`[HUB1_PASS1] Completed run ${run_id}: ${decision} (score: ${finalScore})`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[HUB1_PASS1] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({
      error: errorMessage,
      process_id: PROCESS_ID,
      generated_at: new Date().toISOString()
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
