import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScanRequest {
  scan_type: "full" | "targeted";
  toggles: {
    news_events: boolean;
    permits_zoning: boolean;
    infrastructure: boolean;
    storage_industrial: boolean;
  };
  filters: {
    states?: string[];
    industry_focus?: string;
    lookback_days: number;
  };
}

interface Candidate {
  area: { city: string; county: string; state: string };
  signal_score: number;
  signal_density: number;
  primary_drivers: string[];
  source_count: number;
  confidence_level: "high" | "medium" | "low";
  evidence: {
    summary: string;
    sources: { title: string; type: string; snippet: string; date: string }[];
    rationale: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const process_id = crypto.randomUUID();
  const started_at = new Date().toISOString();

  try {
    const body: ScanRequest = await req.json();
    console.log(`[HUB0_RUN_RADAR] Starting ${body.scan_type} scan - Process ID: ${process_id}`);

    // Log scan start
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('hub0_event_log').insert({
      process_id,
      action: 'scan_started',
      status: 'running',
      metadata: { scan_type: body.scan_type, toggles: body.toggles, filters: body.filters }
    });

    // Generate mock radar candidates based on enabled toggles
    const candidates: Candidate[] = generateMockCandidates(body);

    // Log scan completion
    await supabase.from('hub0_event_log').insert({
      process_id,
      action: 'scan_completed',
      status: 'completed',
      metadata: { candidate_count: candidates.length }
    });

    console.log(`[HUB0_RUN_RADAR] Scan completed - ${candidates.length} candidates found`);

    return new Response(
      JSON.stringify({
        process_id,
        status: "completed",
        started_at,
        completed_at: new Date().toISOString(),
        candidates
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[HUB0_RUN_RADAR] Scan failed:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failure
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('hub0_event_log').insert({
      process_id,
      action: 'scan_failed',
      status: 'failed',
      error: errorMessage
    });

    return new Response(
      JSON.stringify({ 
        process_id, 
        status: "failed", 
        error: errorMessage,
        started_at 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateMockCandidates(request: ScanRequest): Candidate[] {
  const { toggles, filters } = request;
  const candidates: Candidate[] = [];

  // Mock data pools
  const areas = [
    { city: "Frederick", county: "Frederick County", state: "MD" },
    { city: "Martinsburg", county: "Berkeley County", state: "WV" },
    { city: "Winchester", county: "Frederick County", state: "VA" },
    { city: "Hagerstown", county: "Washington County", state: "MD" },
    { city: "Charles Town", county: "Jefferson County", state: "WV" },
    { city: "Leesburg", county: "Loudoun County", state: "VA" },
    { city: "Chambersburg", county: "Franklin County", state: "PA" },
    { city: "Gettysburg", county: "Adams County", state: "PA" },
  ];

  const driverPools = {
    news_events: ["Population Growth", "Economic Development", "New Employer"],
    permits_zoning: ["Zoning Changes", "Permit Surge", "Rezoning Approved"],
    infrastructure: ["Highway Expansion", "Distribution Center", "Logistics Hub"],
    storage_industrial: ["Storage Deficit", "RV Demand", "Industrial Growth"]
  };

  // Filter by states if specified
  let filteredAreas = areas;
  if (filters.states && filters.states.length > 0) {
    filteredAreas = areas.filter(a => filters.states!.includes(a.state));
  }

  // Generate candidates based on enabled toggles
  const enabledDrivers: string[] = [];
  if (toggles.news_events) enabledDrivers.push(...driverPools.news_events);
  if (toggles.permits_zoning) enabledDrivers.push(...driverPools.permits_zoning);
  if (toggles.infrastructure) enabledDrivers.push(...driverPools.infrastructure);
  if (toggles.storage_industrial) enabledDrivers.push(...driverPools.storage_industrial);

  // If no toggles enabled, return empty
  if (enabledDrivers.length === 0) return [];

  // Generate 3-6 candidates
  const numCandidates = Math.min(filteredAreas.length, Math.floor(Math.random() * 4) + 3);
  const selectedAreas = filteredAreas.slice(0, numCandidates);

  for (const area of selectedAreas) {
    const signalScore = Math.floor(Math.random() * 40) + 60; // 60-100
    const numDrivers = Math.floor(Math.random() * 3) + 2; // 2-4 drivers
    const selectedDrivers = enabledDrivers
      .sort(() => Math.random() - 0.5)
      .slice(0, numDrivers);

    candidates.push({
      area,
      signal_score: signalScore,
      signal_density: parseFloat((Math.random() * 2 + 1).toFixed(2)),
      primary_drivers: selectedDrivers,
      source_count: Math.floor(Math.random() * 8) + 3,
      confidence_level: signalScore >= 80 ? "high" : signalScore >= 65 ? "medium" : "low",
      evidence: {
        summary: `Strong signals detected in ${area.city}, ${area.state} area based on ${selectedDrivers.join(", ").toLowerCase()} indicators.`,
        sources: generateMockSources(selectedDrivers, area, filters.lookback_days),
        rationale: `${area.city} shows ${signalScore >= 80 ? "exceptional" : signalScore >= 65 ? "solid" : "emerging"} potential due to convergent signals across ${selectedDrivers.length} categories. Key drivers include ${selectedDrivers.slice(0, 2).join(" and ").toLowerCase()}.`
      }
    });
  }

  // Sort by signal score descending
  return candidates.sort((a, b) => b.signal_score - a.signal_score);
}

function generateMockSources(drivers: string[], area: { city: string; state: string }, lookbackDays: number) {
  const sources = [];
  const now = new Date();

  for (let i = 0; i < Math.min(drivers.length + 2, 5); i++) {
    const daysAgo = Math.floor(Math.random() * lookbackDays);
    const sourceDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    sources.push({
      title: `${drivers[i % drivers.length]} Report: ${area.city} Area`,
      type: ["News Article", "Permit Filing", "Market Report", "Government Data"][i % 4],
      snippet: `Analysis indicates significant ${drivers[i % drivers.length].toLowerCase()} activity in the ${area.city}, ${area.state} metropolitan area...`,
      date: sourceDate.toISOString().split('T')[0]
    });
  }

  return sources;
}
