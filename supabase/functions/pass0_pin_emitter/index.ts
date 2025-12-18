import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerInput {
  run_id: string;
  dry_run?: boolean;
}

// Mock final pins to emit
const MOCK_PINS = [
  {
    source_id: 'google_news_local',
    raw_title: 'Amazon announces new distribution center in Bedford County, PA',
    raw_url: 'https://example.com/news/1',
    lat: 40.0064,
    lon: -78.4895,
    zip_id: '15522',
    confidence: 'high',
    resolution_tier: 'county'
  },
  {
    source_id: 'bizjournals',
    raw_title: 'Major housing development approved for Frederick, MD',
    raw_url: 'https://example.com/news/2',
    lat: 39.4143,
    lon: -77.4105,
    zip_id: '21701',
    confidence: 'high',
    resolution_tier: 'city'
  },
  {
    source_id: 'press_releases',
    raw_title: 'Tesla expands manufacturing to West Virginia Eastern Panhandle',
    raw_url: 'https://example.com/news/3',
    lat: 39.4562,
    lon: -77.9639,
    zip_id: '25401',
    confidence: 'high',
    resolution_tier: 'city'
  },
  {
    source_id: 'google_news_local',
    raw_title: 'New self-storage facility planned for growing suburb',
    raw_url: 'https://example.com/news/5',
    lat: 39.6418,
    lon: -77.7200,
    zip_id: '21740',
    confidence: 'high',
    resolution_tier: 'city'
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const input: WorkerInput = await req.json();
    console.log(`[PASS0_PIN_EMITTER] Starting for run ${input.run_id}`);

    // Prepare pins with run_id
    const pinsToInsert = MOCK_PINS.map(pin => ({
      ...pin,
      run_id: input.run_id,
      ttl: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }));

    let insertedCount = 0;

    if (!input.dry_run) {
      const { data, error } = await supabase
        .from('pass0_narrative_pins')
        .insert(pinsToInsert)
        .select();

      if (error) {
        console.error('[PASS0_PIN_EMITTER] Insert error:', error);
        throw error;
      }

      insertedCount = data?.length ?? 0;
    } else {
      insertedCount = pinsToInsert.length;
      console.log('[PASS0_PIN_EMITTER] Dry run - skipping insert');
    }

    console.log(`[PASS0_PIN_EMITTER] Emitted ${insertedCount} pins`);

    return new Response(
      JSON.stringify({
        status: 'success',
        run_id: input.run_id,
        item_count: insertedCount,
        dry_run: input.dry_run ?? false,
        pins: pinsToInsert,
        logs: [
          { level: 'info', message: `Emitted ${insertedCount} narrative pins` },
          { level: 'info', message: `TTL set to 7 days` }
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS0_PIN_EMITTER] Error:', error);
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
