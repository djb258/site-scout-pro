import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STALE_THRESHOLD_DAYS = 30;

function classifyZipState(
  facilityCount: number,
  oldestSeenAt: string | null
): 'KNOWN' | 'STALE' | 'UNKNOWN' {
  if (facilityCount === 0) return 'UNKNOWN';
  if (!oldestSeenAt) return 'KNOWN';
  
  const seenDate = new Date(oldestSeenAt);
  const daysSinceSeen = Math.floor(
    (Date.now() - seenDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysSinceSeen > STALE_THRESHOLD_DAYS ? 'STALE' : 'KNOWN';
}

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

    const { sva_id } = await req.json();

    if (!sva_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "MISSING_SVA_ID",
          message: "sva_id is required" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get ZIPs from sovereign_id_zips
    const { data: svaZips, error: svaError } = await supabase
      .from("sovereign_id_zips")
      .select("id, zip, distance_miles, population, demand_sqft")
      .eq("sva_id", sva_id)
      .order("distance_miles", { ascending: true });

    if (svaError) {
      console.error("sovereign_id_zips query error:", svaError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "QUERY_ERROR",
          message: svaError.message 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!svaZips || svaZips.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          zips: [],
          message: "No ZIPs found for this SVA" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get facility counts and oldest seen dates for each ZIP
    const zipCodes = svaZips.map(z => z.zip);
    
    const { data: facilityAgg, error: aggError } = await supabase
      .from("facility_master")
      .select("zip_code, first_seen_at")
      .in("zip_code", zipCodes);

    if (aggError) {
      console.error("facility_master query error:", aggError);
    }

    // Build aggregation map: zip -> { count, oldest_seen_at }
    const facilityMap: Record<string, { count: number; oldest_seen_at: string | null }> = {};
    
    if (facilityAgg) {
      for (const f of facilityAgg) {
        if (!facilityMap[f.zip_code]) {
          facilityMap[f.zip_code] = { count: 0, oldest_seen_at: null };
        }
        facilityMap[f.zip_code].count++;
        
        // Track oldest seen date
        if (f.first_seen_at) {
          if (!facilityMap[f.zip_code].oldest_seen_at || 
              new Date(f.first_seen_at) < new Date(facilityMap[f.zip_code].oldest_seen_at!)) {
            facilityMap[f.zip_code].oldest_seen_at = f.first_seen_at;
          }
        }
      }
    }

    // 3. Build response with state classification
    const zipsWithState = svaZips.map(z => {
      const agg = facilityMap[z.zip] || { count: 0, oldest_seen_at: null };
      const state = classifyZipState(agg.count, agg.oldest_seen_at);
      
      return {
        id: z.id,
        zip: z.zip,
        distance_miles: z.distance_miles,
        population: z.population,
        demand_sqft: z.demand_sqft,
        facility_count: agg.count,
        oldest_seen_at: agg.oldest_seen_at,
        state
      };
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        zips: zipsWithState
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("supply_list_zips_with_state error:", error);
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
