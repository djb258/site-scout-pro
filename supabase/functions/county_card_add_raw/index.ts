import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// PASS 3: COUNTY CARD ADD RAW
// Append raw evidence to county_card_raw (no master writes)
// Raw sources have NO confidence score (doctrine: confidence is card-level)
// ============================================================

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body = await req.json();
    const { county_fips, source_type, source_url, raw_payload, collected_by } = body;

    // Validate required fields
    if (!county_fips) {
      return new Response(
        JSON.stringify({ success: false, error: "county_fips is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!raw_payload) {
      return new Response(
        JSON.stringify({ success: false, error: "raw_payload is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate source_type if provided
    const validSourceTypes = ['ordinance', 'website', 'pdf', 'call', 'email', 'manual'];
    if (source_type && !validSourceTypes.includes(source_type)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid source_type. Must be one of: ${validSourceTypes.join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // INSERT into county_card_raw (append-only, no confidence)
    const { data, error } = await supabase
      .from("county_card_raw")
      .insert({
        county_fips,
        source_type: source_type || 'manual',
        source_url: source_url || null,
        raw_payload,
        collected_by: collected_by || 'user',
      })
      .select("raw_id, county_fips, source_type, source_url, collected_at")
      .single();

    if (error) {
      console.error("Error inserting raw evidence:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        raw_id: data.raw_id,
        message: "Raw evidence added successfully. Use raw_id to link to master card.",
        data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
