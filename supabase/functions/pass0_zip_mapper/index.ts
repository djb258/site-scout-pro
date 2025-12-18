const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerInput {
  run_id: string;
  dry_run?: boolean;
}

// Mock ZIP mapping results
const MOCK_ZIP_MAPPINGS = [
  { lat: 40.0064, lon: -78.4895, zip_id: '15522', confidence: 'high' },
  { lat: 39.4143, lon: -77.4105, zip_id: '21701', confidence: 'high' },
  { lat: 39.4562, lon: -77.9639, zip_id: '25401', confidence: 'high' },
  { lat: 40.5908, lon: -77.2098, zip_id: null, confidence: 'none' }, // State-level, no ZIP
  { lat: 39.6418, lon: -77.7200, zip_id: '21740', confidence: 'high' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: WorkerInput = await req.json();
    console.log(`[PASS0_ZIP_MAPPER] Starting for run ${input.run_id}`);

    const mappedCount = MOCK_ZIP_MAPPINGS.filter(m => m.zip_id !== null).length;
    const unmappedCount = MOCK_ZIP_MAPPINGS.filter(m => m.zip_id === null).length;

    console.log(`[PASS0_ZIP_MAPPER] Mapped ${mappedCount} to ZIPs, ${unmappedCount} unmapped`);

    return new Response(
      JSON.stringify({
        status: 'success',
        run_id: input.run_id,
        item_count: mappedCount,
        mapped: mappedCount,
        unmapped: unmappedCount,
        mappings: MOCK_ZIP_MAPPINGS,
        logs: [
          { level: 'info', message: `Mapped ${mappedCount} coordinates to ZIP codes` },
          { level: 'info', message: `${unmappedCount} items could not be mapped to ZIP` }
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS0_ZIP_MAPPER] Error:', error);
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
