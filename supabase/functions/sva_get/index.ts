import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sva_id from query params or body
    let sva_id: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      sva_id = url.searchParams.get("sva_id");
    } else if (req.method === "POST") {
      const body = await req.json();
      sva_id = body.sva_id;
    }

    if (!sva_id) {
      return new Response(
        JSON.stringify({ error: "sva_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch SVA record
    const { data: svaData, error: svaError } = await supabase
      .from("sovereign_ids")
      .select("*")
      .eq("sva_id", sva_id)
      .single();

    if (svaError || !svaData) {
      return new Response(
        JSON.stringify({ error: "Sovereign ID not found", sva_id }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch ZIPs in scope (optional, can be large)
    const url = new URL(req.url);
    const includeZips = url.searchParams.get("include_zips") === "true";

    let zipsInScope = null;
    if (includeZips) {
      const { data: zips } = await supabase
        .from("sovereign_id_zips")
        .select("zip, distance_miles")
        .eq("sva_id", sva_id)
        .order("distance_miles", { ascending: true });
      
      zipsInScope = zips;
    }

    // Sub-hub status (all locked initially for new SVAs)
    const subHubStatus = [
      { id: 0, name: "Radar / Signals", status: "LOCKED" },
      { id: 1, name: "Competitive Supply", status: "LOCKED" },
      { id: 2, name: "County / FIPS Card", status: "LOCKED" },
      { id: 3, name: "Economics & Calculators", status: "LOCKED" },
      { id: 4, name: "Parcel Discovery", status: "LOCKED" },
      { id: 5, name: "Verdict / Doctrine Gate", status: "LOCKED" },
    ];

    return new Response(
      JSON.stringify({
        ...svaData,
        zips_in_scope: zipsInScope,
        sub_hub_status: subHubStatus
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("SVA get error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
