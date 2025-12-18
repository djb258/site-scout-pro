import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerInput {
  run_id: string;
  dry_run?: boolean;
}

// Mock source registry (in production, load from config)
const MOCK_SOURCES = [
  { source_id: 'google_news_local', enabled: true },
  { source_id: 'bizjournals', enabled: true },
  { source_id: 'press_releases', enabled: true },
  { source_id: 'economic_dev', enabled: true },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: WorkerInput = await req.json();
    console.log(`[PASS0_SOURCE_FETCHER] Starting for run ${input.run_id}`);

    // Mock data: simulate fetching news items from sources
    const mockItems = [
      {
        source_id: 'google_news_local',
        raw_title: 'Amazon announces new distribution center in Bedford County, PA',
        raw_url: 'https://example.com/news/1',
        raw_location: 'Bedford County, PA'
      },
      {
        source_id: 'bizjournals',
        raw_title: 'Major housing development approved for Frederick, MD',
        raw_url: 'https://example.com/news/2',
        raw_location: 'Frederick, MD'
      },
      {
        source_id: 'press_releases',
        raw_title: 'Tesla expands manufacturing to West Virginia Eastern Panhandle',
        raw_url: 'https://example.com/news/3',
        raw_location: 'Martinsburg, WV'
      },
      {
        source_id: 'economic_dev',
        raw_title: 'State announces $50M infrastructure investment in rural counties',
        raw_url: 'https://example.com/news/4',
        raw_location: 'Pennsylvania'
      },
      {
        source_id: 'google_news_local',
        raw_title: 'New self-storage facility planned for growing suburb',
        raw_url: 'https://example.com/news/5',
        raw_location: 'Hagerstown, MD'
      }
    ];

    const enabledSources = MOCK_SOURCES.filter(s => s.enabled).map(s => s.source_id);
    const filteredItems = mockItems.filter(item => enabledSources.includes(item.source_id));

    console.log(`[PASS0_SOURCE_FETCHER] Fetched ${filteredItems.length} items from ${enabledSources.length} sources`);

    return new Response(
      JSON.stringify({
        status: 'success',
        run_id: input.run_id,
        item_count: filteredItems.length,
        sources_checked: enabledSources.length,
        items: filteredItems,
        logs: [
          { level: 'info', message: `Checked ${enabledSources.length} enabled sources` },
          { level: 'info', message: `Fetched ${filteredItems.length} raw items` }
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS0_SOURCE_FETCHER] Error:', error);
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
