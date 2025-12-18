// =============================================================================
// PASS 1 — ZIP HYDRATION & MARKET RECONNAISSANCE
// =============================================================================
// Doctrine: SS.REF.SYNC.01 (ZIP Replica Sync)
//
// Data Sources:
// - Geography: ref.ref_zip_replica (lat, lon, state_id)
// - Census: pass1_census_snapshot (population, income, demographics)
// - State: ref.ref_state_replica (state_code, state_name)
//
// See: docs/doctrine/ZIP_REPLICA_SYNC_DOCTRINE.md
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Expected replica version - update when syncing new data
const EXPECTED_REPLICA_VERSION = Deno.env.get('REPLICA_VERSION') || 'v2025.12.18.001';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      zip_code,
      urban_exclude,
      multifamily_priority,
      recreation_load,
      industrial_momentum,
      analysis_mode,
      skip_replica_check  // Allow bypass for testing only
    } = await req.json();

    // Validate ZIP code format
    if (!zip_code || !/^\d{5}$/.test(zip_code)) {
      return new Response(
        JSON.stringify({ error: 'Invalid ZIP code. Must be 5 digits.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Pass1] Starting analysis for ZIP: ${zip_code}`);

    // =========================================================================
    // STEP 0: Validate replica version (Doctrine Requirement)
    // =========================================================================
    if (!skip_replica_check) {
      const { data: versionCheck, error: versionError } = await supabase
        .rpc('check_replica_version', {
          p_expected_version: EXPECTED_REPLICA_VERSION,
          p_table_name: 'ref_zip_replica'
        });

      if (versionError) {
        console.error('[Pass1] Replica version check failed:', versionError);
        // Log to master failure log
        await supabase.from('master_failure_log').insert({
          process_id: crypto.randomUUID(),
          pass: 'PASS_1',
          spoke: 'ZIP_REPLICA_CHECK',
          error_code: 'VERSION_CHECK_FAILED',
          severity: 'critical',
          message: versionError.message,
          context: { zip_code, expected_version: EXPECTED_REPLICA_VERSION }
        });
        throw new Error(`Replica validation failed: ${versionError.message}`);
      }

      if (versionCheck && !versionCheck.valid) {
        console.error('[Pass1] Replica version invalid:', versionCheck);
        return new Response(
          JSON.stringify({
            error: 'ZIP replica validation failed',
            code: versionCheck.error_code,
            message: versionCheck.message,
            hint: 'Run scripts/sync_zip_replica.py to sync replica from Neon'
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[Pass1] Replica version validated: ${EXPECTED_REPLICA_VERSION}`);
    }

    // =========================================================================
    // STEP 1: HYDRATE — Fetch geography from ref.ref_zip_replica
    // =========================================================================
    const { data: geoData, error: geoError } = await supabase
      .from('ref_zip_replica')
      .select('zip_id, state_id, lat, lon')
      .eq('zip_id', zip_code)
      .maybeSingle();

    if (geoError) {
      console.error('[Pass1] Error fetching ZIP geography:', geoError);
      throw geoError;
    }

    if (!geoData) {
      console.warn(`[Pass1] ZIP ${zip_code} not found in ref.ref_zip_replica`);
      return new Response(
        JSON.stringify({
          error: `ZIP code ${zip_code} not found in reference data.`,
          hint: 'Run scripts/sync_zip_replica.py to sync reference data from Neon'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // STEP 2: Fetch state info from ref.ref_state_replica
    // =========================================================================
    const { data: stateData, error: stateError } = await supabase
      .from('ref_state_replica')
      .select('state_id, state_code, state_name')
      .eq('state_id', geoData.state_id)
      .maybeSingle();

    if (stateError) {
      console.error('[Pass1] Error fetching state data:', stateError);
      // Non-fatal, continue with partial data
    }

    // =========================================================================
    // STEP 3: Fetch census/demographic data from pass1_census_snapshot
    // =========================================================================
    const { data: censusData, error: censusError } = await supabase
      .from('pass1_census_snapshot')
      .select('*')
      .eq('zip_code', zip_code)
      .order('vintage_year', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (censusError) {
      console.error('[Pass1] Error fetching census data:', censusError);
      // Non-fatal, continue with partial data
    }

    // Log if census data is missing
    if (!censusData) {
      console.warn(`[Pass1] No census data for ZIP ${zip_code} - using defaults`);
    }

    console.log(`[Pass1] Hydrated ZIP: ${zip_code} (state: ${stateData?.state_name || 'Unknown'})`);

    // =========================================================================
    // Build structured ZIP metadata (combining geography + census)
    // =========================================================================
    const zipMetadata = {
      // Geography (from ref.ref_zip_replica)
      zip: geoData.zip_id,
      lat: geoData.lat,
      lng: geoData.lon,
      state_id: stateData?.state_code || null,
      state_name: stateData?.state_name || null,

      // Census (from pass1_census_snapshot)
      city: censusData?.city || null,
      county: censusData?.county_name || null,
      population: censusData?.population || null,
      density: censusData?.density || null,
      income_household_median: censusData?.income_household_median || null,
      home_value: censusData?.home_value_median || null,
      home_ownership: censusData?.home_ownership_pct || null,
      rent_median: censusData?.rent_median || null,
      age_median: censusData?.age_median || null,
      education_college_or_above: censusData?.education_college_or_above_pct || null,
      unemployment_rate: censusData?.unemployment_rate || null,

      // Metadata
      census_vintage: censusData?.vintage_year || null,
      data_source: censusData?.data_source || null
    };

    // =========================================================================
    // STEP 4: Create zip_run record
    // =========================================================================
    const { data: zipRun, error: runError } = await supabase
      .from('zip_runs')
      .insert({
        zip_code,
        urban_exclude: urban_exclude ?? false,
        multifamily_priority: multifamily_priority ?? false,
        recreation_load: recreation_load ?? false,
        industrial_momentum: industrial_momentum ?? false,
        analysis_mode: analysis_mode ?? 'build',
        status: 'pending'
      })
      .select()
      .single();

    if (runError) {
      console.error('[Pass1] Error creating zip_run:', runError);
      throw runError;
    }

    console.log(`[Pass1] Created zip_run: ${zipRun.id}`);

    // =========================================================================
    // STEP 5: Log engine event for audit trail
    // =========================================================================
    await supabase.from('engine_logs').insert({
      engine: 'startPass1',
      event: 'hydration_complete',
      payload: {
        zip_run_id: zipRun.id,
        zip_code,
        city: zipMetadata.city,
        county: zipMetadata.county,
        state: zipMetadata.state_name,
        population: zipMetadata.population,
        replica_version: EXPECTED_REPLICA_VERSION,
        census_vintage: zipMetadata.census_vintage
      },
      status: 'success'
    });

    // =========================================================================
    // STEP 6: Calculate radius counties (using ref tables)
    // =========================================================================
    let radiusCounties: any[] = [];
    if (geoData.state_id) {
      // Get other ZIPs in the same state from ref_zip_replica
      const { data: nearbyZips } = await supabase
        .from('ref_zip_replica')
        .select('zip_id, lat, lon')
        .eq('state_id', geoData.state_id)
        .limit(100);

      // Get census data for those ZIPs
      if (nearbyZips && nearbyZips.length > 0) {
        const zipIds = nearbyZips.map(z => z.zip_id);
        const { data: nearbyCensus } = await supabase
          .from('pass1_census_snapshot')
          .select('zip_code, county_name, population')
          .in('zip_code', zipIds);

        // Group by county
        const countyMap = new Map();
        nearbyCensus?.forEach(z => {
          if (z.county_name && !countyMap.has(z.county_name)) {
            countyMap.set(z.county_name, {
              county: z.county_name,
              state: zipMetadata.state_name,
              population: z.population || 0
            });
          }
        });
        radiusCounties = Array.from(countyMap.values()).slice(0, 20);
      }
    }

    // =========================================================================
    // STEP 7: Generate competitor placeholders (future: Google Places API)
    // =========================================================================
    const competitors = [
      { name: 'Public Storage', distance_miles: 2.3, estimated_sqft: 45000 },
      { name: 'Extra Space Storage', distance_miles: 4.1, estimated_sqft: 62000 },
      { name: 'CubeSmart', distance_miles: 5.8, estimated_sqft: 38000 }
    ];

    // =========================================================================
    // STEP 8: Housing signals based on census data
    // =========================================================================
    const housingSignals = {
      median_home_value: zipMetadata.home_value || 0,
      home_ownership_rate: zipMetadata.home_ownership || 0,
      rent_median: zipMetadata.rent_median || 0,
      growth_indicator: (zipMetadata.population || 0) > 10000 ? 'high' : 'moderate'
    };

    // =========================================================================
    // STEP 9: Anchors (future: external API integration)
    // =========================================================================
    const anchors = [
      { type: 'retail', name: 'Regional Shopping Center', distance_miles: 3.2 },
      { type: 'employer', name: 'Industrial Park', distance_miles: 5.1 }
    ];

    // =========================================================================
    // STEP 10: RV/Lake signals
    // =========================================================================
    const rvLakeSignals = {
      recreation_load: recreation_load,
      rv_potential: recreation_load ? 'high' : 'low',
      lake_proximity: false,
      campground_nearby: false
    };

    // =========================================================================
    // STEP 11: Industrial signals
    // =========================================================================
    const industrialSignals = {
      industrial_momentum: industrial_momentum,
      distribution_centers_nearby: 2,
      manufacturing_presence: industrial_momentum ? 'moderate' : 'low'
    };

    // =========================================================================
    // STEP 12: Analysis summary
    // =========================================================================
    const analysisSummary = {
      analysis_mode,
      urban_exclude,
      multifamily_priority,
      viability_score: 65, // Placeholder - real calculation in spokes
      recommendation: 'Proceed to Pass 2 for deep dive',
      key_factors: [
        `Population: ${(zipMetadata.population || 0).toLocaleString()}`,
        `Location: ${zipMetadata.city || 'Unknown'}, ${zipMetadata.state_name || 'Unknown'}`,
        `County: ${zipMetadata.county || 'Unknown'}`,
        `Competitors within 10mi: ${competitors.length}`,
        `Analysis mode: ${analysis_mode || 'build'}`,
        `Census vintage: ${zipMetadata.census_vintage || 'Unknown'}`
      ]
    };

    // =========================================================================
    // STEP 13: Store Pass 1 results
    // =========================================================================
    const { error: pass1Error } = await supabase
      .from('pass1_results')
      .insert({
        zip_run_id: zipRun.id,
        zip_metadata: zipMetadata,
        radius_counties: radiusCounties,
        competitors,
        housing_signals: housingSignals,
        anchors,
        rv_lake_signals: rvLakeSignals,
        industrial_signals: industrialSignals,
        analysis_summary: analysisSummary
      });

    if (pass1Error) {
      console.error('[Pass1] Error storing results:', pass1Error);
      throw pass1Error;
    }

    // =========================================================================
    // STEP 14: Update status to pass1_complete
    // =========================================================================
    await supabase
      .from('zip_runs')
      .update({ status: 'pass1_complete' })
      .eq('id', zipRun.id);

    console.log(`[Pass1] Completed for ZIP: ${zip_code}`);

    return new Response(
      JSON.stringify({
        success: true,
        zip_run_id: zipRun.id,
        status: 'pass1_complete',
        zip_metadata: zipMetadata,
        summary: analysisSummary,
        replica_version: EXPECTED_REPLICA_VERSION
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Pass1] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
