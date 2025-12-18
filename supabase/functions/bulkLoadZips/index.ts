// =============================================================================
// ⚠️  DEPRECATED — ZIP REPLICA SYNC DOCTRINE (SS.REF.SYNC.01)
// =============================================================================
// This function is DEPRECATED and should NOT be used.
//
// REASON: Bulk loads to 'us_zip_codes' with 30+ demographic columns,
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

interface ZipRecord {
  zip: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  state_id: string | null;
  state_name: string | null;
  zcta: boolean | null;
  parent_zcta: string | null;
  population: number | null;
  density: number | null;
  county_fips: string | null;
  county_name: string | null;
  county_weights: any;
  county_names_all: string | null;
  county_fips_all: string | null;
  imprecise: boolean | null;
  military: boolean | null;
  timezone: string | null;
  age_median: number | null;
  male: number | null;
  female: number | null;
  married: number | null;
  family_size: number | null;
  income_household_median: number | null;
  income_household_six_figure: number | null;
  home_ownership: number | null;
  home_value: number | null;
  rent_median: number | null;
  education_college_or_above: number | null;
  labor_force_participation: number | null;
  unemployment_rate: number | null;
  race_white: number | null;
  race_black: number | null;
  race_asian: number | null;
  race_native: number | null;
  race_pacific: number | null;
  race_other: number | null;
  race_multiple: number | null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseRow(row: string[]): ZipRecord | null {
  const clean = (val: string): string | null => {
    if (!val || val === '') return null;
    return val.replace(/^"|"$/g, '').replace(/\r$/g, '') || null;
  };

  const cleanNum = (val: string): number | null => {
    const cleaned = clean(val);
    if (!cleaned || cleaned === '') return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const cleanInt = (val: string): number | null => {
    const cleaned = clean(val);
    if (!cleaned || cleaned === '') return null;
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  };

  const cleanBool = (val: string): boolean | null => {
    const cleaned = clean(val);
    if (!cleaned) return null;
    return cleaned.toUpperCase() === 'TRUE' ? true : cleaned.toUpperCase() === 'FALSE' ? false : null;
  };

  const cleanJson = (val: string): any => {
    const cleaned = clean(val);
    if (!cleaned) return null;
    try {
      // Handle escaped quotes in JSON
      const jsonStr = cleaned.replace(/""/g, '"');
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  const zip = clean(row[0]);
  if (!zip) return null;

  return {
    zip,
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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bulk Load Zips: Received request');
    
    const body = await req.json();
    const { csvContent } = body;

    if (!csvContent) {
      throw new Error('Invalid payload: csvContent required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse CSV
    const lines = csvContent.split('\n');
    console.log(`Total lines in CSV: ${lines.length}`);
    
    // Skip header row
    const dataLines = lines.slice(1).filter((line: string) => line.trim());
    console.log(`Data lines to process: ${dataLines.length}`);

    const records: ZipRecord[] = [];
    for (const line of dataLines) {
      const row = parseCSVLine(line);
      const record = parseRow(row);
      if (record) {
        records.push(record);
      }
    }

    console.log(`Parsed ${records.length} valid records`);

    // Insert in batches of 500
    const batchSize = 500;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('us_zip_codes')
        .upsert(batch, { onConflict: 'zip', ignoreDuplicates: false });

      if (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
        errors++;
      } else {
        inserted += batch.length;
      }
      
      console.log(`Progress: ${inserted} inserted, ${errors} batch errors`);
    }

    console.log(`Bulk load complete: ${inserted} records inserted`);

    return new Response(
      JSON.stringify({
        status: 'ok',
        message: `Successfully processed ${inserted} ZIP code records`,
        total_parsed: records.length,
        inserted,
        batch_errors: errors,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('Bulk Load Zips: Error', err);
    
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
