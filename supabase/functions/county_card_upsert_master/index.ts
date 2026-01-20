import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// PASS 3: COUNTY CARD UPSERT MASTER
// Update master card with interpreted facts.
// CONFIDENCE DOCTRINE: confidence_score is card-level, not source-level.
// AUTHORITY PRECEDENCE: Once this record exists, jurisdiction_card_drafts is ignored.
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
    const { 
      county_fips, 
      county_name, 
      state_code, 
      raw_ids,
      updates,
      confidence_score 
    } = body;

    // Validate required fields
    if (!county_fips) {
      return new Response(
        JSON.stringify({ success: false, error: "county_fips is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // READ-ONLY ENFORCEMENT: Reject updates to validated cards
    const { data: existingCard } = await supabase
      .from("county_card_master")
      .select("status")
      .eq("county_fips", county_fips)
      .single();

    if (existingCard?.status === 'validated') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Cannot modify validated card. Change status to 'draft' first." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the upsert payload
    const masterPayload: Record<string, unknown> = {
      county_fips,
      status: 'draft', // NEVER auto-validate
      updated_at: new Date().toISOString(),
    };

    // Add optional fields if provided
    if (county_name) masterPayload.county_name = county_name;
    if (state_code) masterPayload.state_code = state_code;
    if (confidence_score !== undefined) {
      // Validate confidence score range (card-level confidence)
      if (confidence_score < 0 || confidence_score > 100) {
        return new Response(
          JSON.stringify({ success: false, error: "confidence_score must be between 0 and 100" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      masterPayload.confidence_score = confidence_score;
    }

    // Merge updates into payload
    if (updates && typeof updates === 'object') {
      const allowedFields = [
        'zoning_authority',
        'permitting_authority',
        'min_setback_front_ft',
        'min_setback_side_ft',
        'min_setback_rear_ft',
        'max_height_ft',
        'max_lot_coverage_pct',
        'special_use_required',
        'variance_process',
      ];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          masterPayload[field] = updates[field];
        }
      }
    }

    // UPSERT into county_card_master
    const { data: masterData, error: masterError } = await supabase
      .from("county_card_master")
      .upsert(masterPayload, { onConflict: 'county_fips' })
      .select()
      .single();

    if (masterError) {
      console.error("Error upserting master card:", masterError);
      return new Response(
        JSON.stringify({ success: false, error: masterError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Link raw sources if provided
    let linkedCount = 0;
    if (raw_ids && Array.isArray(raw_ids) && raw_ids.length > 0) {
      // Verify raw_ids exist
      const { data: existingRaw, error: rawCheckError } = await supabase
        .from("county_card_raw")
        .select("raw_id")
        .in("raw_id", raw_ids);

      if (rawCheckError) {
        console.error("Error checking raw sources:", rawCheckError);
      } else {
        const validRawIds = existingRaw?.map(r => r.raw_id) || [];
        
        // Insert source links (ignore duplicates)
        for (const rawId of validRawIds) {
          const { error: linkError } = await supabase
            .from("county_card_sources")
            .upsert(
              { county_fips, raw_id: rawId },
              { onConflict: 'county_fips,raw_id' }
            );

          if (!linkError) {
            linkedCount++;
          }
        }
      }
    }

    // Get total source count
    const { count: sourceCount } = await supabase
      .from("county_card_sources")
      .select("*", { count: 'exact', head: true })
      .eq("county_fips", county_fips);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Master card upserted successfully (status remains 'draft')",
        data: {
          ...masterData,
          sources_linked: linkedCount,
          total_sources: sourceCount || 0,
        },
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
