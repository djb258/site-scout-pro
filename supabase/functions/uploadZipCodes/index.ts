// =============================================================================
// ⚠️  DEPRECATED — ZIP REPLICA SYNC DOCTRINE (SS.REF.SYNC.01)
// =============================================================================
// This function is DEPRECATED and should NOT be used.
//
// REASON: Uploads to 'us_zip_codes' with 30+ demographic columns,
// violating doctrine (ref schema = geography ONLY).
//
// USE INSTEAD: scripts/sync_zip_replica.py
//   - Syncs to ref.ref_zip_replica (geography only: zip_id, state_id, lat, lon)
//   - Manual sync only, audited
//   - Writes sync manifest
//
// DO NOT USE — ZIP REPLICA DOCTRINE
// See: docs/doctrine/ZIP_REPLICA_SYNC_DOCTRINE.md
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Upload Zip Codes: Received request');
    
    const body = await req.json();
    const { rows } = body;

    if (!rows || !Array.isArray(rows)) {
      throw new Error('Invalid payload: rows array required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Skip header row and parse CSV data
    const dataRows = rows.slice(1);
    const parsedData = dataRows.map((row: string[]) => {
      // Helper to clean quoted values
      const clean = (val: string) => {
        if (!val) return null;
        const cleaned = val.replace(/^"|"$/g, '').replace(/\r$/g, '');
        return cleaned === '' ? null : cleaned;
      };

      const cleanNum = (val: string) => {
        const cleaned = clean(val);
        return cleaned ? parseFloat(cleaned) : null;
      };

      const cleanInt = (val: string) => {
        const cleaned = clean(val);
        return cleaned ? parseInt(cleaned, 10) : null;
      };

      const cleanBool = (val: string) => {
        const cleaned = clean(val);
        return cleaned === 'TRUE' ? true : cleaned === 'FALSE' ? false : null;
      };

      const cleanJson = (val: string) => {
        const cleaned = clean(val);
        if (!cleaned) return null;
        try {
          return JSON.parse(cleaned);
        } catch {
          return null;
        }
      };

      return {
        zip: clean(row[0]),
        lat: cleanNum(row[1]),
        lng: cleanNum(row[2]),
        city: clean(row[3]),
        state_id: clean(row[4]),
        state_name: clean(row[5]),
        zcta: cleanBool(row[6]),
        parent_zcta: clean(row[7]),
        population: cleanInt(row[8]),
        density: cleanNum(row[9]),
        county_fips: clean(row[10]),
        county_name: clean(row[11]),
        county_weights: cleanJson(row[12]),
        county_names_all: clean(row[13]),
        county_fips_all: clean(row[14]),
        imprecise: cleanBool(row[15]),
        military: cleanBool(row[16]),
        timezone: clean(row[17]),
        age_median: cleanNum(row[18]),
        male: cleanNum(row[19]),
        female: cleanNum(row[20]),
        married: cleanNum(row[21]),
        family_size: cleanNum(row[22]),
        income_household_median: cleanInt(row[23]),
        income_household_six_figure: cleanNum(row[24]),
        home_ownership: cleanNum(row[25]),
        home_value: cleanInt(row[26]),
        rent_median: cleanInt(row[27]),
        education_college_or_above: cleanNum(row[28]),
        labor_force_participation: cleanNum(row[29]),
        unemployment_rate: cleanNum(row[30]),
        race_white: cleanNum(row[31]),
        race_black: cleanNum(row[32]),
        race_asian: cleanNum(row[33]),
        race_native: cleanNum(row[34]),
        race_pacific: cleanNum(row[35]),
        race_other: cleanNum(row[36]),
        race_multiple: cleanNum(row[37]),
      };
    }).filter(record => record.zip); // Filter out records without ZIP codes

    console.log(`Uploading ${parsedData.length} ZIP code records`);

    // Insert in batches of 500 to avoid timeouts
    const batchSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < parsedData.length; i += batchSize) {
      const batch = parsedData.slice(i, i + batchSize);
      const { error } = await supabase
        .from('us_zip_codes')
        .upsert(batch, { onConflict: 'zip', ignoreDuplicates: false });

      if (error) {
        console.error('Batch insert error:', error);
        throw error;
      }
      
      inserted += batch.length;
      console.log(`Inserted ${inserted} of ${parsedData.length} records`);
    }

    console.log(`Successfully uploaded ${inserted} ZIP code records`);

    return new Response(
      JSON.stringify({
        status: 'ok',
        message: `Successfully uploaded ${inserted} ZIP code records`,
        count: inserted,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('Upload Zip Codes: Error', err);
    
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        status: 'error',
        message: errorMessage,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
