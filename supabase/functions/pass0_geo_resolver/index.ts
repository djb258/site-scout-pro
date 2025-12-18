import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerInput {
  run_id: string;
  dry_run?: boolean;
  items: ParsedItem[];
}

interface ExtractedLocation {
  type: 'zip' | 'city_state' | 'county_state' | 'state';
  value: string;
  city?: string;
  county?: string;
  state?: string;
  zip?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ParsedItem {
  source_id: string;
  raw_title: string;
  raw_url: string;
  locations: ExtractedLocation[];
}

interface ResolvedItem extends ParsedItem {
  lat: number | null;
  lon: number | null;
  resolved_zip: string | null;
  resolution_tier: 'zip' | 'city' | 'county' | 'state' | 'failed';
  resolution_explain: {
    method: string;
    query?: string;
    matches?: number;
    dataset_version: string;
  };
  geo_confidence: 'high' | 'medium' | 'low' | 'rejected';
}

const DATASET_VERSION = 'us_zip_codes_v1';
const CONFIDENCE_CAP_ENABLED = true;

async function resolveByZip(supabase: any, zip: string): Promise<{lat: number; lon: number; city: string; state: string} | null> {
  const { data, error } = await supabase
    .from('us_zip_codes')
    .select('lat, lng, city, state_id')
    .eq('zip', zip)
    .limit(1)
    .single();
  
  if (error || !data) return null;
  return { lat: data.lat, lon: data.lng, city: data.city, state: data.state_id };
}

async function resolveByCityState(supabase: any, city: string, state: string): Promise<{lat: number; lon: number; zip: string} | null> {
  const { data, error } = await supabase
    .from('us_zip_codes')
    .select('lat, lng, zip')
    .ilike('city', city)
    .eq('state_id', state)
    .limit(1);
  
  if (error || !data || data.length === 0) return null;
  return { lat: data[0].lat, lon: data[0].lng, zip: data[0].zip };
}

async function resolveByCountyState(supabase: any, county: string, state: string): Promise<{lat: number; lon: number; zip: string; matches: number} | null> {
  // Query all ZIPs in the county and average their coordinates
  const { data, error } = await supabase
    .from('us_zip_codes')
    .select('lat, lng, zip')
    .ilike('county_name', `%${county}%`)
    .eq('state_id', state)
    .limit(100);
  
  if (error || !data || data.length === 0) return null;
  
  // Calculate centroid
  const avgLat = data.reduce((sum: number, d: any) => sum + (d.lat || 0), 0) / data.length;
  const avgLon = data.reduce((sum: number, d: any) => sum + (d.lng || 0), 0) / data.length;
  
  return { lat: avgLat, lon: avgLon, zip: data[0].zip, matches: data.length };
}

async function resolveByState(supabase: any, state: string): Promise<{lat: number; lon: number; matches: number} | null> {
  // Query all ZIPs in the state and average their coordinates
  const { data, error } = await supabase
    .from('us_zip_codes')
    .select('lat, lng')
    .eq('state_id', state)
    .limit(500);
  
  if (error || !data || data.length === 0) return null;
  
  // Calculate centroid
  const avgLat = data.reduce((sum: number, d: any) => sum + (d.lat || 0), 0) / data.length;
  const avgLon = data.reduce((sum: number, d: any) => sum + (d.lng || 0), 0) / data.length;
  
  return { lat: avgLat, lon: avgLon, matches: data.length };
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
    console.log(`[PASS0_GEO_RESOLVER] Starting for run ${input.run_id} with ${input.items?.length || 0} items`);

    if (!input.items || input.items.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'success',
          run_id: input.run_id,
          item_count: 0,
          items: [],
          logs: [{ level: 'warn', message: 'No items to resolve' }]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolvedItems: ResolvedItem[] = [];
    const logs: Array<{level: string; message: string}> = [];
    let resolvedCount = 0;
    let rejectedCount = 0;

    for (const item of input.items) {
      let bestResult: ResolvedItem | null = null;
      
      // Sort locations by confidence (highest first)
      const sortedLocations = [...item.locations].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.confidence] - order[b.confidence];
      });
      
      // Try each location until we get a resolution
      for (const loc of sortedLocations) {
        let result: ResolvedItem = {
          ...item,
          lat: null,
          lon: null,
          resolved_zip: null,
          resolution_tier: 'failed',
          resolution_explain: { method: 'none', dataset_version: DATASET_VERSION },
          geo_confidence: 'rejected'
        };
        
        if (loc.type === 'zip' && loc.zip) {
          const resolved = await resolveByZip(supabase, loc.zip);
          if (resolved) {
            result = {
              ...item,
              lat: resolved.lat,
              lon: resolved.lon,
              resolved_zip: loc.zip,
              resolution_tier: 'zip',
              resolution_explain: {
                method: 'direct_zip_lookup',
                query: `zip=${loc.zip}`,
                dataset_version: DATASET_VERSION
              },
              geo_confidence: 'high'
            };
            bestResult = result;
            break;
          }
        }
        
        if (loc.type === 'city_state' && loc.city && loc.state) {
          const resolved = await resolveByCityState(supabase, loc.city, loc.state);
          if (resolved) {
            result = {
              ...item,
              lat: resolved.lat,
              lon: resolved.lon,
              resolved_zip: resolved.zip,
              resolution_tier: 'city',
              resolution_explain: {
                method: 'city_state_lookup',
                query: `city=${loc.city}&state=${loc.state}`,
                dataset_version: DATASET_VERSION
              },
              geo_confidence: 'high'
            };
            bestResult = result;
            break;
          }
        }
        
        if (loc.type === 'county_state' && loc.county && loc.state) {
          const resolved = await resolveByCountyState(supabase, loc.county, loc.state);
          if (resolved) {
            result = {
              ...item,
              lat: resolved.lat,
              lon: resolved.lon,
              resolved_zip: resolved.zip,
              resolution_tier: 'county',
              resolution_explain: {
                method: 'county_centroid',
                query: `county=${loc.county}&state=${loc.state}`,
                matches: resolved.matches,
                dataset_version: DATASET_VERSION
              },
              geo_confidence: 'medium'
            };
            if (!bestResult || bestResult.resolution_tier === 'state') {
              bestResult = result;
            }
          }
        }
        
        if (loc.type === 'state' && loc.state) {
          const resolved = await resolveByState(supabase, loc.state);
          if (resolved) {
            result = {
              ...item,
              lat: resolved.lat,
              lon: resolved.lon,
              resolved_zip: null,
              resolution_tier: 'state',
              resolution_explain: {
                method: 'state_centroid',
                query: `state=${loc.state}`,
                matches: resolved.matches,
                dataset_version: DATASET_VERSION
              },
              geo_confidence: 'low'
            };
            if (!bestResult) {
              bestResult = result;
            }
          }
        }
      }
      
      // Apply confidence cap - reject state-level resolutions
      if (bestResult) {
        if (CONFIDENCE_CAP_ENABLED && bestResult.resolution_tier === 'state') {
          bestResult.geo_confidence = 'rejected';
          rejectedCount++;
          console.log(`[GEO_RESOLVER] Rejected state-level resolution for: ${item.raw_title.substring(0, 50)}`);
        } else {
          resolvedCount++;
        }
        resolvedItems.push(bestResult);
      } else {
        // No resolution at all
        resolvedItems.push({
          ...item,
          lat: null,
          lon: null,
          resolved_zip: null,
          resolution_tier: 'failed',
          resolution_explain: { method: 'no_match', dataset_version: DATASET_VERSION },
          geo_confidence: 'rejected'
        });
        rejectedCount++;
      }
    }

    // Filter to only items with valid geo (not rejected)
    const validItems = resolvedItems.filter(r => r.geo_confidence !== 'rejected');
    
    logs.push({ level: 'info', message: `Resolved ${resolvedCount} items with valid geo` });
    logs.push({ level: 'info', message: `Rejected ${rejectedCount} items (low confidence or no match)` });
    logs.push({ level: 'info', message: `Dataset version: ${DATASET_VERSION}` });

    console.log(`[PASS0_GEO_RESOLVER] Complete: ${validItems.length} valid, ${rejectedCount} rejected`);

    return new Response(
      JSON.stringify({
        status: 'success',
        run_id: input.run_id,
        item_count: validItems.length,
        total_processed: resolvedItems.length,
        rejected_count: rejectedCount,
        dataset_version: DATASET_VERSION,
        items: validItems,
        logs
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
