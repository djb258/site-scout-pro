// =============================================================================
// ⚠️  DEPRECATED — ZIP REPLICA SYNC DOCTRINE (SS.REF.SYNC.01)
// =============================================================================
// This function is DEPRECATED and should NOT be used.
//
// REASON: Writes to 'us_zip_codes' with demographic data, violating doctrine.
//
// USE INSTEAD: scripts/sync_zip_replica.py
//   - Syncs to ref.ref_zip_replica (geography only)
//   - Manual sync only, audited
//   - Writes sync manifest
//
// DO NOT USE — ZIP REPLICA DOCTRINE
// See: docs/doctrine/ZIP_REPLICA_SYNC_DOCTRINE.md
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let neonUrl = Deno.env.get("NEON_DATABASE_URL");
    if (!neonUrl) {
      throw new Error("NEON_DATABASE_URL not configured");
    }
    
    // Clean up the URL if it has psql command wrapper or quotes
    neonUrl = neonUrl
      .replace(/^psql\s+/i, '')  // Remove "psql " prefix
      .replace(/^['"]/, '')       // Remove leading quote
      .replace(/['"]$/, '')       // Remove trailing quote
      .trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Connecting to Neon database...");
    const sql = postgres(neonUrl, { ssl: "require" });

    // Query all ZIP codes from Neon's zips_master table - use * to get all available columns
    console.log("Fetching ZIP codes from Neon zips_master...");
    const neonZips = await sql`SELECT * FROM zips_master`;

    console.log(`Fetched ${neonZips.length} ZIP codes from Neon`);
    if (neonZips.length > 0) {
      console.log("Available columns:", Object.keys(neonZips[0]).join(", "));
    }

    // Map Neon columns to Lovable Cloud schema - handle missing columns gracefully
    const mappedZips = neonZips.map((z: any) => ({
      zip: z.zip,
      lat: z.lat ?? z.latitude,
      lng: z.lng ?? z.longitude,
      city: z.city,
      state_id: z.state ?? z.state_id,
      state_name: z.state_name,
      zcta: z.zcta,
      parent_zcta: z.parent_zcta,
      population: z.population,
      density: z.density,
      county_fips: z.county_fips,
      county_name: z.county_name,
      county_fips_all: z.county_fips_all,
      county_names_all: z.county_names_all,
      county_weights: z.county_weights,
      imprecise: z.imprecise,
      military: z.military,
      timezone: z.timezone,
      age_median: z.age_median,
      male: z.male,
      female: z.female,
      married: z.married,
      family_size: z.family_size,
      income_household_median: z.income_household_median,
      income_household_six_figure: z.income_household_six_figure,
      home_ownership: z.home_ownership,
      home_value: z.home_value,
      rent_median: z.rent_median,
      education_college_or_above: z.education_college_or_above,
      labor_force_participation: z.labor_force_participation,
      unemployment_rate: z.unemployment_rate,
      race_white: z.race_white,
      race_black: z.race_black,
      race_asian: z.race_asian,
      race_native: z.race_native,
      race_pacific: z.race_pacific,
      race_other: z.race_other,
      race_multiple: z.race_multiple,
    }));

    // Batch upsert in chunks of 500
    const BATCH_SIZE = 500;
    let totalUpserted = 0;

    for (let i = 0; i < mappedZips.length; i += BATCH_SIZE) {
      const batch = mappedZips.slice(i, i + BATCH_SIZE);
      
      const { error } = await supabase
        .from("us_zip_codes")
        .upsert(batch, { onConflict: "zip" });

      if (error) {
        console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error);
        throw error;
      }

      totalUpserted += batch.length;
      console.log(`Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${totalUpserted}/${mappedZips.length}`);
    }

    await sql.end();

    console.log(`Sync complete: ${totalUpserted} ZIP codes synced`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${totalUpserted} ZIP codes from Neon to Lovable Cloud`,
        count: totalUpserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Sync error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
