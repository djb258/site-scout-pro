import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignalRow {
  signal_id: string;
  sovereign_id: string;
  zip_code: string;
  signal_type: string;
  source_name: string;
  source_url: string | null;
  raw_excerpt: string | null;
  signal_strength_hint: "low" | "medium" | "high" | null;
  signal_category_version: string;
  observed_at: string;
  created_at: string;
}

interface ZipSignalGroup {
  zip_code: string;
  signal_count: number;
  latest_signal_at: string | null;
  signals: SignalRow[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sovereign_id } = await req.json();

    if (!sovereign_id) {
      return new Response(
        JSON.stringify({ error: "sovereign_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify SVA exists
    const { data: svaData, error: svaError } = await supabase
      .from("sovereign_ids")
      .select("sva_id, asset_type, anchor_zip, radius_miles")
      .eq("sva_id", sovereign_id)
      .single();

    if (svaError || !svaData) {
      return new Response(
        JSON.stringify({ error: "Sovereign ID not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get ZIPs in scope
    const { data: zipsData, error: zipsError } = await supabase
      .from("sovereign_id_zips")
      .select("zip_code")
      .eq("sva_id", sovereign_id);

    if (zipsError) {
      throw new Error(`Failed to fetch ZIPs: ${zipsError.message}`);
    }

    const zipsInScope = (zipsData || []).map((z) => z.zip_code);

    if (zipsInScope.length === 0) {
      return new Response(
        JSON.stringify({
          sovereign_id,
          asset_type: svaData.asset_type,
          anchor_zip: svaData.anchor_zip,
          radius_miles: svaData.radius_miles,
          total_signals: 0,
          zip_count: 0,
          zips: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch signals for ZIPs in scope
    const { data: signalsData, error: signalsError } = await supabase
      .from("pass0_signals")
      .select("*")
      .eq("sovereign_id", sovereign_id)
      .in("zip_code", zipsInScope)
      .order("observed_at", { ascending: false });

    if (signalsError) {
      throw new Error(`Failed to fetch signals: ${signalsError.message}`);
    }

    const signals: SignalRow[] = signalsData || [];

    // Group signals by ZIP
    const zipMap = new Map<string, SignalRow[]>();
    for (const signal of signals) {
      const existing = zipMap.get(signal.zip_code) || [];
      existing.push(signal);
      zipMap.set(signal.zip_code, existing);
    }

    // Build grouped response
    const zips: ZipSignalGroup[] = [];
    for (const zip of zipsInScope) {
      const zipSignals = zipMap.get(zip) || [];
      zips.push({
        zip_code: zip,
        signal_count: zipSignals.length,
        latest_signal_at: zipSignals.length > 0 ? zipSignals[0].observed_at : null,
        signals: zipSignals,
      });
    }

    // Sort by signal count descending
    zips.sort((a, b) => b.signal_count - a.signal_count);

    return new Response(
      JSON.stringify({
        sovereign_id,
        asset_type: svaData.asset_type,
        anchor_zip: svaData.anchor_zip,
        radius_miles: svaData.radius_miles,
        total_signals: signals.length,
        zip_count: zipsInScope.length,
        zips,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[pass0_get_signals] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
