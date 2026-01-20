import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// PASS 3: COUNTY CARD VALIDATE
// Explicit finalization step (user-triggered only).
// Sets status = 'validated' and last_validated_at.
// Requires at least 1 linked raw source.
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
    const { county_fips } = body;

    // Validate required fields
    if (!county_fips) {
      return new Response(
        JSON.stringify({ success: false, error: "county_fips is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if master card exists
    const { data: existingCard, error: checkError } = await supabase
      .from("county_card_master")
      .select("county_fips, county_name, status, confidence_score")
      .eq("county_fips", county_fips)
      .single();

    if (checkError || !existingCard) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No master card found for county_fips: ${county_fips}. Create one first.` 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already validated
    if (existingCard.status === 'validated') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Card is already validated. Edit the card to make changes." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify at least 1 linked source exists (doctrine requirement)
    const { count: sourceCount, error: countError } = await supabase
      .from("county_card_sources")
      .select("*", { count: 'exact', head: true })
      .eq("county_fips", county_fips);

    if (countError) {
      console.error("Error counting sources:", countError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to verify source links" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sourceCount || sourceCount === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Cannot validate: Card must have at least 1 linked raw source. Add evidence first." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set status = 'validated' and last_validated_at
    const { data: updatedCard, error: updateError } = await supabase
      .from("county_card_master")
      .update({
        status: 'validated',
        last_validated_at: new Date().toISOString(),
      })
      .eq("county_fips", county_fips)
      .select()
      .single();

    if (updateError) {
      console.error("Error validating card:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "County Card validated successfully. It is now authoritative.",
        data: {
          ...updatedCard,
          source_count: sourceCount,
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
