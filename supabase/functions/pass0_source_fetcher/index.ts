import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerInput {
  run_id: string;
  dry_run?: boolean;
  sources?: SourceConfig[];
}

interface SourceConfig {
  source_id: string;
  type: string;
  enabled: boolean;
  rss_url?: string;
  query?: string;
}

interface FetchedItem {
  source_id: string;
  raw_title: string;
  raw_url: string;
  published_at?: string;
  raw_snippet?: string;
}

// RSS feed configurations for Google News
const RSS_FEEDS: Record<string, string> = {
  'google_news_local': 'https://news.google.com/rss/search?q=self+storage+facility+OR+warehouse+OR+distribution+center&hl=en-US&gl=US&ceid=US:en',
  'bizjournals': 'https://news.google.com/rss/search?q=commercial+real+estate+development&hl=en-US&gl=US&ceid=US:en',
  'economic_dev': 'https://news.google.com/rss/search?q=economic+development+industrial+park&hl=en-US&gl=US&ceid=US:en',
  'press_releases': 'https://news.google.com/rss/search?q=new+construction+permits+approved&hl=en-US&gl=US&ceid=US:en',
};

// Default source registry
const DEFAULT_SOURCES: SourceConfig[] = [
  { source_id: 'google_news_local', type: 'rss', enabled: true },
  { source_id: 'bizjournals', type: 'rss', enabled: true },
  { source_id: 'economic_dev', type: 'rss', enabled: true },
  { source_id: 'press_releases', type: 'rss', enabled: true },
];

async function fetchRSSFeed(url: string, sourceId: string): Promise<FetchedItem[]> {
  const items: FetchedItem[] = [];
  
  try {
    console.log(`[SOURCE_FETCHER] Fetching RSS: ${url}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Pass0-News-Fetcher/1.0' }
    });
    
    if (!response.ok) {
      console.warn(`[SOURCE_FETCHER] RSS fetch failed for ${sourceId}: ${response.status}`);
      return items;
    }
    
    const xml = await response.text();
    
    // Parse XML using regex (Deno-compatible, no external parser needed)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>/;
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;
    const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/;
    
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      
      const titleMatch = itemXml.match(titleRegex);
      const linkMatch = itemXml.match(linkRegex);
      const pubDateMatch = itemXml.match(pubDateRegex);
      const descMatch = itemXml.match(descRegex);
      
      const title = titleMatch ? (titleMatch[1] || titleMatch[2]) : '';
      const link = linkMatch ? linkMatch[1] : '';
      const pubDate = pubDateMatch ? pubDateMatch[1] : undefined;
      const description = descMatch ? (descMatch[1] || descMatch[2]) : undefined;
      
      if (title && link) {
        items.push({
          source_id: sourceId,
          raw_title: title.trim(),
          raw_url: link.trim(),
          published_at: pubDate,
          raw_snippet: description?.substring(0, 500)
        });
      }
    }
    
    console.log(`[SOURCE_FETCHER] Parsed ${items.length} items from ${sourceId}`);
  } catch (err) {
    console.error(`[SOURCE_FETCHER] Error fetching ${sourceId}:`, err);
  }
  
  return items;
}

async function fetchManualQueue(supabase: any, runId: string): Promise<FetchedItem[]> {
  const items: FetchedItem[] = [];
  
  try {
    const { data: queuedUrls, error } = await supabase
      .from('pass0_url_queue')
      .select('*')
      .eq('status', 'pending')
      .limit(50);
    
    if (error) {
      console.error('[SOURCE_FETCHER] Error fetching URL queue:', error);
      return items;
    }
    
    if (queuedUrls && queuedUrls.length > 0) {
      console.log(`[SOURCE_FETCHER] Found ${queuedUrls.length} manual URLs in queue`);
      
      for (const queued of queuedUrls) {
        items.push({
          source_id: queued.source_override || 'manual_inject',
          raw_title: queued.title || queued.url,
          raw_url: queued.url,
          raw_snippet: queued.geo_hint
        });
        
        // Mark as processing
        await supabase
          .from('pass0_url_queue')
          .update({ status: 'processing', processed_run_id: runId })
          .eq('id', queued.id);
      }
    }
  } catch (err) {
    console.error('[SOURCE_FETCHER] Error processing manual queue:', err);
  }
  
  return items;
}

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
    const sources = input.sources || DEFAULT_SOURCES;
    const enabledSources = sources.filter(s => s.enabled);
    
    console.log(`[PASS0_SOURCE_FETCHER] Starting for run ${input.run_id}`);
    console.log(`[PASS0_SOURCE_FETCHER] Enabled sources: ${enabledSources.map(s => s.source_id).join(', ')}`);

    const allItems: FetchedItem[] = [];
    const logs: Array<{level: string; message: string}> = [];

    // Fetch from RSS feeds in parallel
    const rssPromises = enabledSources
      .filter(s => s.type === 'rss' && RSS_FEEDS[s.source_id])
      .map(s => fetchRSSFeed(RSS_FEEDS[s.source_id], s.source_id));
    
    const rssResults = await Promise.all(rssPromises);
    for (const items of rssResults) {
      allItems.push(...items);
    }
    logs.push({ level: 'info', message: `Fetched ${allItems.length} items from ${rssPromises.length} RSS feeds` });

    // Fetch from manual URL queue
    const manualItems = await fetchManualQueue(supabase, input.run_id);
    allItems.push(...manualItems);
    if (manualItems.length > 0) {
      logs.push({ level: 'info', message: `Added ${manualItems.length} items from manual URL queue` });
    }

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const uniqueItems = allItems.filter(item => {
      if (seenUrls.has(item.raw_url)) return false;
      seenUrls.add(item.raw_url);
      return true;
    });

    logs.push({ level: 'info', message: `Deduplicated to ${uniqueItems.length} unique items` });
    console.log(`[PASS0_SOURCE_FETCHER] Total unique items: ${uniqueItems.length}`);

    return new Response(
      JSON.stringify({
        status: 'success',
        run_id: input.run_id,
        item_count: uniqueItems.length,
        sources_checked: enabledSources.length,
        items: uniqueItems.slice(0, 100), // Limit to 100 items per run
        logs
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
