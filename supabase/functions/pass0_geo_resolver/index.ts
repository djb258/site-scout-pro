const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerInput {
  run_id: string;
  dry_run?: boolean;
}

// Mock geocoding results
const MOCK_GEO_RESULTS = [
  { raw_location: 'Bedford County, PA', lat: 40.0064, lon: -78.4895, confidence: 'high', resolution_tier: 'county' },
  { raw_location: 'Frederick, MD', lat: 39.4143, lon: -77.4105, confidence: 'high', resolution_tier: 'city' },
  { raw_location: 'Martinsburg, WV', lat: 39.4562, lon: -77.9639, confidence: 'high', resolution_tier: 'city' },
  { raw_location: 'Pennsylvania', lat: 40.5908, lon: -77.2098, confidence: 'low', resolution_tier: 'state' },
  { raw_location: 'Hagerstown, MD', lat: 39.6418, lon: -77.7200, confidence: 'high', resolution_tier: 'city' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: WorkerInput = await req.json();
    console.log(`[PASS0_GEO_RESOLVER] Starting for run ${input.run_id}`);

    // Simulate geocoding delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const resolvedCount = MOCK_GEO_RESULTS.filter(r => r.confidence !== 'low').length;
    const failedCount = MOCK_GEO_RESULTS.filter(r => r.confidence === 'low').length;

    console.log(`[PASS0_GEO_RESOLVER] Resolved ${resolvedCount} locations, ${failedCount} low confidence`);

    return new Response(
      JSON.stringify({
        status: 'success',
        run_id: input.run_id,
        item_count: MOCK_GEO_RESULTS.length,
        resolved: resolvedCount,
        low_confidence: failedCount,
        results: MOCK_GEO_RESULTS,
        logs: [
          { level: 'info', message: `Geocoded ${MOCK_GEO_RESULTS.length} locations` },
          { level: 'warn', message: `${failedCount} items have low confidence geo` }
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS0_GEO_RESOLVER] Error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        item_count: 0 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
