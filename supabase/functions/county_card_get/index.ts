import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// PASS 3: COUNTY CARD GET
// Fetch a county card with its linked raw sources.
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

    // Get county_fips from query params or body
    let county_fips: string | null = null;
    
    if (req.method === "GET") {
      const url = new URL(req.url);
      county_fips = url.searchParams.get("county_fips");
    } else {
      const body = await req.json();
      county_fips = body.county_fips;
    }

    if (!county_fips) {
      return new Response(
        JSON.stringify({ success: false, error: "county_fips is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch master card
    const { data: masterCard, error: masterError } = await supabase
      .from("county_card_master")
      .select("*")
      .eq("county_fips", county_fips)
      .single();

    // Fetch raw sources for this county (all of them, not just linked)
    const { data: rawSources, error: rawError } = await supabase
      .from("county_card_raw")
      .select("raw_id, source_type, source_url, raw_payload, collected_at, collected_by")
      .eq("county_fips", county_fips)
      .order("collected_at", { ascending: false });

    // Fetch linked source IDs
    const { data: linkedSources } = await supabase
      .from("county_card_sources")
      .select("raw_id, linked_at")
      .eq("county_fips", county_fips);

    const linkedRawIds = new Set((linkedSources || []).map(s => s.raw_id));

    // Annotate raw sources with linked status
    const annotatedSources = (rawSources || []).map(source => ({
      ...source,
      is_linked: linkedRawIds.has(source.raw_id),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        exists: !!masterCard,
        master: masterCard || null,
        sources: annotatedSources,
        linked_count: linkedRawIds.size,
        total_raw_count: annotatedSources.length,
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
