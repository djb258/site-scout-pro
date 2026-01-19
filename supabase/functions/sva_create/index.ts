import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid options
const VALID_ASSET_TYPES = ["self-storage", "rv-storage", "boat-storage", "truck-tractor", "tow-impound"];
const VALID_RADII = [25, 50, 75, 100, 120];

// Haversine formula for distance calculation
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Generate deterministic SVA ID from inputs
async function generateSvaId(assetType: string, anchorZip: string, radiusMiles: number): Promise<string> {
  const hashInput = `${assetType}|${anchorZip}|${radiusMiles}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return `SVA-${hashHex.substring(0, 12).toUpperCase()}`;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { asset_type, anchor_zip, radius_miles } = await req.json();

    // Validate asset_type
    if (!asset_type || !VALID_ASSET_TYPES.includes(asset_type)) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid asset_type", 
          valid_options: VALID_ASSET_TYPES 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate anchor_zip format
    if (!anchor_zip || !/^\d{5}$/.test(anchor_zip)) {
      return new Response(
        JSON.stringify({ error: "Invalid anchor_zip. Must be exactly 5 digits." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate radius_miles
    if (!radius_miles || !VALID_RADII.includes(radius_miles)) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid radius_miles", 
          valid_options: VALID_RADII 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve anchor ZIP from us_zip_codes
    const { data: zipData, error: zipError } = await supabase
      .from("us_zip_codes")
      .select("zip, city, state_id, state_name, county_name, county_fips, lat, lng")
      .eq("zip", anchor_zip)
      .single();

    if (zipError || !zipData) {
      return new Response(
        JSON.stringify({ error: "ZIP code not found in reference data", anchor_zip }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!zipData.lat || !zipData.lng) {
      return new Response(
        JSON.stringify({ error: "ZIP code missing coordinates", anchor_zip }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate deterministic SVA ID
    const sva_id = await generateSvaId(asset_type, anchor_zip, radius_miles);

    // Check if SVA already exists (idempotent)
    const { data: existingSva } = await supabase
      .from("sovereign_ids")
      .select("*")
      .eq("sva_id", sva_id)
      .single();

    if (existingSva) {
      // Return existing SVA (idempotent behavior)
      return new Response(
        JSON.stringify({
          ...existingSva,
          already_existed: true,
          message: "Sovereign ID already exists with these parameters"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get ALL ZIPs with coordinates AND county data using pagination (Supabase default limit is 1000)
    let allZips: { zip: string; lat: number; lng: number; county_name: string | null; county_fips: string | null; state_id: string | null; population: number | null }[] = [];
    let offset = 0;
    const batchSize = 10000;

    console.log("Fetching all ZIPs for radius calculation...");

    while (true) {
      const { data: batch, error: batchError } = await supabase
        .from("us_zip_codes")
        .select("zip, lat, lng, county_name, county_fips, state_id, population")
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (batchError) {
        throw new Error(`Failed to fetch ZIP codes: ${batchError.message}`);
      }
      
      if (!batch || batch.length === 0) break;
      
      // For the first batch without range, we get everything up to the limit
      // Use range for subsequent batches
      if (offset === 0) {
        const { data: firstBatch, error: firstError } = await supabase
          .from("us_zip_codes")
          .select("zip, lat, lng, county_name, county_fips, state_id, population")
          .not("lat", "is", null)
          .not("lng", "is", null)
          .range(0, batchSize - 1);
        
        if (firstError) throw new Error(`Failed to fetch ZIP codes: ${firstError.message}`);
        if (!firstBatch || firstBatch.length === 0) break;
        
        allZips = firstBatch;
        if (firstBatch.length < batchSize) break;
        offset = batchSize;
      } else {
        const { data: nextBatch, error: nextError } = await supabase
          .from("us_zip_codes")
          .select("zip, lat, lng, county_name, county_fips, state_id, population")
          .not("lat", "is", null)
          .not("lng", "is", null)
          .range(offset, offset + batchSize - 1);
        
        if (nextError) throw new Error(`Failed to fetch ZIP codes: ${nextError.message}`);
        if (!nextBatch || nextBatch.length === 0) break;
        
        allZips = allZips.concat(nextBatch);
        if (nextBatch.length < batchSize) break;
        offset += batchSize;
      }
      break; // Exit the outer loop after first iteration since we handle batching inside
    }

    // Actually do proper pagination
    allZips = [];
    offset = 0;
    while (true) {
      const { data: batch, error: batchError } = await supabase
        .from("us_zip_codes")
        .select("zip, lat, lng, county_name, county_fips, state_id, population")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .range(offset, offset + batchSize - 1);

      if (batchError) {
        throw new Error(`Failed to fetch ZIP codes: ${batchError.message}`);
      }
      
      if (!batch || batch.length === 0) break;
      
      allZips = allZips.concat(batch);
      console.log(`Fetched ${allZips.length} ZIPs so far...`);
      
      if (batch.length < batchSize) break;
      offset += batchSize;
    }

    console.log(`Total ZIPs fetched: ${allZips.length}`);

    // Calculate ZIPs within radius and aggregate county data
    const anchorLat = Number(zipData.lat);
    const anchorLng = Number(zipData.lng);
    const zipsInScope: { zip: string; distance_miles: number; county_fips: string | null; county_name: string | null; state_id: string | null; population: number | null }[] = [];
    
    // Map to aggregate county data
    const countyMap = new Map<string, {
      county_name: string;
      county_fips: string;
      state_id: string;
      min_distance: number;
      zip_count: number;
      total_population: number;
    }>();

    for (const z of allZips || []) {
      const distance = haversineDistance(anchorLat, anchorLng, Number(z.lat), Number(z.lng));
      if (distance <= radius_miles) {
        const distanceRounded = Math.round(distance * 100) / 100;
        zipsInScope.push({
          zip: z.zip,
          distance_miles: distanceRounded,
          county_fips: z.county_fips,
          county_name: z.county_name,
          state_id: z.state_id,
          population: z.population
        });

        // Aggregate county data
        if (z.county_fips && z.county_name && z.state_id) {
          const existing = countyMap.get(z.county_fips);
          if (existing) {
            existing.min_distance = Math.min(existing.min_distance, distanceRounded);
            existing.zip_count += 1;
            existing.total_population += z.population || 0;
          } else {
            countyMap.set(z.county_fips, {
              county_name: z.county_name,
              county_fips: z.county_fips,
              state_id: z.state_id,
              min_distance: distanceRounded,
              zip_count: 1,
              total_population: z.population || 0
            });
          }
        }
      }
    }

    console.log(`Found ${zipsInScope.length} ZIPs and ${countyMap.size} counties within ${radius_miles} miles`);

    // Insert sovereign_id record
    const svaRecord = {
      sva_id,
      asset_type,
      anchor_zip,
      anchor_city: zipData.city || "Unknown",
      anchor_state: zipData.state_id || zipData.state_name || "Unknown",
      anchor_county: zipData.county_name || "Unknown",
      anchor_fips: zipData.county_fips || "00000",
      anchor_lat: anchorLat,
      anchor_lng: anchorLng,
      radius_miles,
      zip_count_in_scope: zipsInScope.length,
      status: "CREATED"
    };

    const { error: insertSvaError } = await supabase
      .from("sovereign_ids")
      .insert(svaRecord);

    if (insertSvaError) {
      throw new Error(`Failed to create SVA: ${insertSvaError.message}`);
    }

    // Bulk insert ZIPs in scope
    if (zipsInScope.length > 0) {
      const zipRecords = zipsInScope.map(z => ({
        sva_id,
        zip: z.zip,
        distance_miles: z.distance_miles
      }));

      // Insert in batches of 500 to avoid payload limits
      const batchSize = 500;
      for (let i = 0; i < zipRecords.length; i += batchSize) {
        const batch = zipRecords.slice(i, i + batchSize);
        const { error: insertZipsError } = await supabase
          .from("sovereign_id_zips")
          .insert(batch);

        if (insertZipsError) {
          console.error(`Failed to insert ZIP batch: ${insertZipsError.message}`);
        }
      }
    }

    // Bulk insert counties in scope
    if (countyMap.size > 0) {
      const countyRecords = Array.from(countyMap.values()).map(c => ({
        sva_id,
        county_name: c.county_name,
        county_fips: c.county_fips,
        state_id: c.state_id,
        min_distance_miles: c.min_distance,
        zip_count: c.zip_count,
        total_population: c.total_population
      }));

      // Insert counties in batches
      const countyBatchSize = 100;
      for (let i = 0; i < countyRecords.length; i += countyBatchSize) {
        const batch = countyRecords.slice(i, i + countyBatchSize);
        const { error: insertCountiesError } = await supabase
          .from("sovereign_id_counties")
          .insert(batch);

        if (insertCountiesError) {
          console.error(`Failed to insert county batch: ${insertCountiesError.message}`);
        }
      }
      console.log(`Inserted ${countyRecords.length} counties`);
    }
    const { data: createdSva } = await supabase
      .from("sovereign_ids")
      .select("*")
      .eq("sva_id", sva_id)
      .single();

    return new Response(
      JSON.stringify({
        ...createdSva,
        already_existed: false,
        message: "Sovereign ID created successfully"
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("SVA creation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
