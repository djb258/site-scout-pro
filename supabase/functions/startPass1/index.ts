import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      analysis_mode 
    } = await req.json();

    // Validate ZIP code
    if (!zip_code || !/^\d{5}$/.test(zip_code)) {
      return new Response(
        JSON.stringify({ error: 'Invalid ZIP code. Must be 5 digits.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Pass1] Starting analysis for ZIP: ${zip_code}`);

    // 1. HYDRATE: Fetch ZIP metadata from us_zip_codes FIRST (fail fast if missing)
    const { data: zipData, error: zipError } = await supabase
      .from('us_zip_codes')
      .select('*')
      .eq('zip', zip_code)
      .maybeSingle();

    if (zipError) {
      console.error('[Pass1] Error fetching ZIP metadata:', zipError);
      throw zipError;
    }

    if (!zipData) {
      console.warn(`[Pass1] ZIP ${zip_code} not found in us_zip_codes reference table`);
      return new Response(
        JSON.stringify({ 
          error: `ZIP code ${zip_code} not found in reference data. Please sync ZIP codes first.`,
          hint: 'Run syncZipsFromNeon to populate reference data'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Pass1] Hydrated ZIP metadata: ${zipData.city}, ${zipData.state_name} (pop: ${zipData.population})`);

    // Build structured ZIP metadata
    const zipMetadata = {
      zip: zipData.zip,
      city: zipData.city,
      county: zipData.county_name,
      state_id: zipData.state_id,
      state_name: zipData.state_name,
      lat: zipData.lat,
      lng: zipData.lng,
      population: zipData.population,
      density: zipData.density,
      income_household_median: zipData.income_household_median,
      home_value: zipData.home_value,
      home_ownership: zipData.home_ownership,
      rent_median: zipData.rent_median,
      age_median: zipData.age_median,
      education_college_or_above: zipData.education_college_or_above,
      unemployment_rate: zipData.unemployment_rate
    };

    // 2. Create zip_run record
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

    // 3. Log engine event for audit trail
    await supabase.from('engine_logs').insert({
      engine: 'startPass1',
      event: 'hydration_complete',
      payload: { 
        zip_run_id: zipRun.id, 
        zip_code,
        city: zipData.city,
        county: zipData.county_name,
        state: zipData.state_name,
        population: zipData.population
      },
      status: 'success'
    });

    // 4. Calculate 120-mile radius counties (simplified - using state for now)
    let radiusCounties: any[] = [];
    if (zipData.state_id) {
      const { data: nearbyZips } = await supabase
        .from('us_zip_codes')
        .select('county_name, state_name, population, lat, lng')
        .eq('state_id', zipData.state_id)
        .not('county_name', 'is', null)
        .limit(50);
      
      // Group by county
      const countyMap = new Map();
      nearbyZips?.forEach(z => {
        if (z.county_name && !countyMap.has(z.county_name)) {
          countyMap.set(z.county_name, {
            county: z.county_name,
            state: z.state_name,
            population: z.population || 0
          });
        }
      });
      radiusCounties = Array.from(countyMap.values()).slice(0, 20);
    }

    // 5. Generate competitor placeholders (would connect to Google Places API)
    const competitors = [
      { name: 'Public Storage', distance_miles: 2.3, estimated_sqft: 45000 },
      { name: 'Extra Space Storage', distance_miles: 4.1, estimated_sqft: 62000 },
      { name: 'CubeSmart', distance_miles: 5.8, estimated_sqft: 38000 }
    ];

    // 6. Housing signals based on demographics
    const housingSignals = {
      median_home_value: zipData.home_value || 0,
      home_ownership_rate: zipData.home_ownership || 0,
      rent_median: zipData.rent_median || 0,
      growth_indicator: (zipData.population || 0) > 10000 ? 'high' : 'moderate'
    };

    // 7. Anchors (major employers/attractions)
    const anchors = [
      { type: 'retail', name: 'Regional Shopping Center', distance_miles: 3.2 },
      { type: 'employer', name: 'Industrial Park', distance_miles: 5.1 }
    ];

    // 8. RV/Lake signals
    const rvLakeSignals = {
      recreation_load: recreation_load,
      rv_potential: recreation_load ? 'high' : 'low',
      lake_proximity: false,
      campground_nearby: false
    };

    // 9. Industrial signals
    const industrialSignals = {
      industrial_momentum: industrial_momentum,
      distribution_centers_nearby: 2,
      manufacturing_presence: industrial_momentum ? 'moderate' : 'low'
    };

    // 10. Analysis summary
    const analysisSummary = {
      analysis_mode,
      urban_exclude,
      multifamily_priority,
      viability_score: 65, // Placeholder
      recommendation: 'Proceed to Pass 2 for deep dive',
      key_factors: [
        `Population: ${(zipMetadata.population || 0).toLocaleString()}`,
        `Location: ${zipMetadata.city}, ${zipMetadata.state_name}`,
        `County: ${zipMetadata.county || 'Unknown'}`,
        `Competitors within 10mi: ${competitors.length}`,
        `Analysis mode: ${analysis_mode}`
      ]
    };

    // 11. Store Pass 1 results
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

    // 12. Update status to pass1_complete
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
        summary: analysisSummary
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
