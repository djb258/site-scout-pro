import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Static system configuration - navigation metadata only
// No calculations, scoring, enrichment, or data promotion
const systemConfig = {
  hubs: [
    {
      id: "pass0",
      name: "Pass 0 — Radar",
      shortName: "Pass 0",
      route: "/hub/pass0",
      status: "active",
      color: "hsl(210, 100%, 60%)",
      card: {
        purpose: "Market radar signals and trend detection",
        inputs: "Housing permits, industrial logistics, news events",
        outputs: "Momentum signals, trend score",
        promotionRule: "Signal strength > 0.6 → promote to Pass 1",
      },
    },
    {
      id: "pass1",
      name: "Pass 1 — Exploration",
      shortName: "Pass 1",
      route: "/hub/pass1",
      status: "active",
      color: "hsl(45, 100%, 50%)",
      card: {
        purpose: "Initial site exploration and competitor scan",
        inputs: "ZIP code, radius, toggle preferences",
        outputs: "Competitor registry, demand anchors, hotspot score",
        promotionRule: "Hotspot score ≥ 60 → promote to Pass 1.5",
      },
    },
    {
      id: "pass15",
      name: "Pass 1.5 — Cleanup",
      shortName: "Pass 1.5",
      route: "/hub/pass15",
      status: "active",
      color: "hsl(280, 80%, 60%)",
      card: {
        purpose: "Rate verification and evidence cleanup",
        inputs: "Pass 1 results, published rates",
        outputs: "Verified rent bands, confidence score",
        promotionRule: "Coverage confidence ≥ 70% → promote to Pass 2",
      },
    },
    {
      id: "pass2",
      name: "Pass 2 — Underwriting",
      shortName: "Pass 2",
      route: "/hub/pass2",
      status: "active",
      color: "hsl(150, 80%, 45%)",
      card: {
        purpose: "Full underwriting and feasibility analysis",
        inputs: "Verified rates, zoning, civil constraints",
        outputs: "Feasibility model, verdict, fusion demand",
        promotionRule: "Verdict = GO → eligible for Vault save",
      },
    },
    {
      id: "pass3",
      name: "Pass 3 — Design",
      shortName: "Pass 3",
      route: "/hub/pass3",
      status: "placeholder",
      color: "hsl(0, 0%, 50%)",
      card: {
        purpose: "Future: Site design and pro forma modeling",
        inputs: "Pass 2 results, land constraints",
        outputs: "Unit mix, build cost, IRR projection",
        promotionRule: "IRR ≥ target → proceed to LOI",
      },
    },
  ],
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[GET_SYSTEM_CONFIG] Returning static hub configuration");

  return new Response(JSON.stringify(systemConfig), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
