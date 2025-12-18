import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerInput {
  run_id: string;
  dry_run?: boolean;
  items: ResolvedItem[];
}

interface ResolvedItem {
  source_id: string;
  raw_title: string;
  raw_url: string;
  lat: number | null;
  lon: number | null;
  resolved_zip: string | null;
  resolution_tier: string;
  resolution_explain: Record<string, any>;
  geo_confidence: string;
}

interface MappedItem extends ResolvedItem {
  zip_id: string | null;
  distance_miles: number | null;
  confidence: 'high' | 'medium' | 'low';
}

const MAX_DISTANCE_MILES = 2.5;

async function findNearestZip(supabase: any, lat: number, lon: number): Promise<{zip: string; distance: number; city: string; state: string} | null> {
  // Haversine distance calculation in SQL
  // 3959 = Earth's radius in miles
  const { data, error } = await supabase
    .rpc('get_nearest_zip', { p_lat: lat, p_lon: lon });
  
  // If RPC doesn't exist, fallback to manual calculation
  if (error) {
    // Fallback: fetch nearby ZIPs and calculate distance client-side
    const { data: nearby, error: nearbyError } = await supabase
      .from('us_zip_codes')
      .select('zip, lat, lng, city, state_id')
      .gte('lat', lat - 0.5)
      .lte('lat', lat + 0.5)
      .gte('lng', lon - 0.5)
      .lte('lng', lon + 0.5)
      .limit(100);
    
    if (nearbyError || !nearby || nearby.length === 0) {
      // Wider search if nothing found
      const { data: wider } = await supabase
        .from('us_zip_codes')
        .select('zip, lat, lng, city, state_id')
        .gte('lat', lat - 1.0)
        .lte('lat', lat + 1.0)
        .gte('lng', lon - 1.0)
        .lte('lng', lon + 1.0)
        .limit(200);
      
      if (!wider || wider.length === 0) return null;
      
      // Calculate distances
      const withDistance = wider.map((z: any) => ({
        ...z,
        distance: haversineDistance(lat, lon, z.lat, z.lng)
      })).sort((a: any, b: any) => a.distance - b.distance);
      
      const nearest = withDistance[0];
      return { zip: nearest.zip, distance: nearest.distance, city: nearest.city, state: nearest.state_id };
    }
    
    // Calculate distances for nearby results
    const withDistance = nearby.map((z: any) => ({
      ...z,
      distance: haversineDistance(lat, lon, z.lat, z.lng)
    })).sort((a: any, b: any) => a.distance - b.distance);
    
    const nearest = withDistance[0];
    return { zip: nearest.zip, distance: nearest.distance, city: nearest.city, state: nearest.state_id };
  }
  
  if (data && data.length > 0) {
    return { zip: data[0].zip, distance: data[0].distance_miles, city: data[0].city, state: data[0].state_id };
  }
  
  return null;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function calculateConfidence(distance: number, resolutionTier: string): 'high' | 'medium' | 'low' {
  // If we already have a ZIP from resolution, distance should be 0
  if (distance === 0) return 'high';
  
  // If resolution was at city level, trust it
  if (resolutionTier === 'city' || resolutionTier === 'zip') return 'high';
  
  // For county-level, apply distance decay
  if (distance <= 1.0) return 'high';
  if (distance <= MAX_DISTANCE_MILES) return 'medium';
  return 'low';
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
    console.log(`[PASS0_ZIP_MAPPER] Starting for run ${input.run_id} with ${input.items?.length || 0} items`);

    if (!input.items || input.items.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'success',
          run_id: input.run_id,
          item_count: 0,
          items: [],
          logs: [{ level: 'warn', message: 'No items to map' }]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mappedItems: MappedItem[] = [];
    const logs: Array<{level: string; message: string}> = [];
    let mappedCount = 0;
    let unmappedCount = 0;

    for (const item of input.items) {
      // If we already have a resolved ZIP, use it
      if (item.resolved_zip) {
        mappedItems.push({
          ...item,
          zip_id: item.resolved_zip,
          distance_miles: 0,
          confidence: 'high'
        });
        mappedCount++;
        continue;
      }
      
      // Otherwise, find nearest ZIP from lat/lon
      if (item.lat && item.lon) {
        const nearest = await findNearestZip(supabase, item.lat, item.lon);
        
        if (nearest) {
          const confidence = calculateConfidence(nearest.distance, item.resolution_tier);
          
          mappedItems.push({
            ...item,
            zip_id: nearest.zip,
            distance_miles: Math.round(nearest.distance * 100) / 100,
            confidence
          });
          
          if (confidence !== 'low') {
            mappedCount++;
          } else {
            console.log(`[ZIP_MAPPER] Low confidence mapping: ${nearest.distance.toFixed(2)} miles for ${item.raw_title.substring(0, 40)}`);
            unmappedCount++;
          }
        } else {
          mappedItems.push({
            ...item,
            zip_id: null,
            distance_miles: null,
            confidence: 'low'
          });
          unmappedCount++;
        }
      } else {
        // No lat/lon, can't map
        mappedItems.push({
          ...item,
          zip_id: null,
          distance_miles: null,
          confidence: 'low'
        });
        unmappedCount++;
      }
    }

    // Filter to high/medium confidence only
    const validMappings = mappedItems.filter(m => m.confidence !== 'low');
    
    logs.push({ level: 'info', message: `Mapped ${mappedCount} items to ZIPs` });
    logs.push({ level: 'info', message: `${unmappedCount} items unmapped or low confidence` });
    logs.push({ level: 'info', message: `Max distance threshold: ${MAX_DISTANCE_MILES} miles` });

    console.log(`[PASS0_ZIP_MAPPER] Complete: ${validMappings.length} valid mappings`);

    return new Response(
      JSON.stringify({
        status: 'success',
        run_id: input.run_id,
        item_count: validMappings.length,
        mapped: mappedCount,
        unmapped: unmappedCount,
        items: validMappings,
        logs
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
