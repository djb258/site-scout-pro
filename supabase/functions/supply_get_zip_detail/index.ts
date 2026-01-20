import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { zip_code } = await req.json();

    if (!zip_code) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "MISSING_ZIP_CODE",
          message: "zip_code is required" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get ZIP metadata from sovereign_id_zips
    const { data: zipMetadata, error: zipError } = await supabase
      .from("sovereign_id_zips")
      .select("zip, sva_id, distance_miles, population, demand_sqft")
      .eq("zip", zip_code)
      .limit(1);

    if (zipError) {
      console.error("sovereign_id_zips query error:", zipError);
    }

    // 2. Get facilities from facility_master
    const { data: facilities, error: facilitiesError } = await supabase
      .from("facility_master")
      .select("facility_id, facility_name, address, phone, website_url, status, first_seen_at")
      .eq("zip_code", zip_code)
      .order("first_seen_at", { ascending: false });

    if (facilitiesError) {
      console.error("facility_master query error:", facilitiesError);
    }

    // 3. Get raw intake count from facility_raw
    const { count: rawCount, error: rawError } = await supabase
      .from("facility_raw")
      .select("*", { count: "exact", head: true })
      .eq("zip_code", zip_code);

    if (rawError) {
      console.error("facility_raw count error:", rawError);
    }

    // Build response
    const zipInfo = zipMetadata && zipMetadata.length > 0 ? zipMetadata[0] : null;

    return new Response(
      JSON.stringify({ 
        success: true,
        zip_code,
        metadata: {
          population: zipInfo?.population || null,
          demand_sqft: zipInfo?.demand_sqft || null,
          distance_miles: zipInfo?.distance_miles || null,
          sva_id: zipInfo?.sva_id || null,
          is_authorized: !!zipInfo
        },
        facilities: facilities || [],
        facility_count: facilities?.length || 0,
        raw_intake_count: rawCount || 0
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("supply_get_zip_detail error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
