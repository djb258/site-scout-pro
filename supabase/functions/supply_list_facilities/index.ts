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

    // Fetch facilities from facility_master for this ZIP
    const { data: facilities, error } = await supabase
      .from("facility_master")
      .select("facility_id, facility_name, address, phone, website_url, status, first_seen_at")
      .eq("zip_code", zip_code)
      .order("first_seen_at", { ascending: false });

    if (error) {
      console.error("facility_master query error:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "QUERY_ERROR",
          message: "Failed to fetch facilities" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        zip_code,
        facilities: facilities || [],
        count: facilities?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("supply_list_facilities error:", error);
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
