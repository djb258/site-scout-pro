import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerInput {
  run_id: string;
  dry_run?: boolean;
  items: MappedItem[];
  ttl_days?: number;
  confidence_threshold?: 'high' | 'medium' | 'low';
}

interface MappedItem {
  source_id: string;
  raw_title: string;
  raw_url: string;
  lat: number | null;
  lon: number | null;
  zip_id: string | null;
  distance_miles: number | null;
  resolution_tier: string;
  resolution_explain: Record<string, any>;
  confidence: 'high' | 'medium' | 'low';
}

interface PinRecord {
  run_id: string;
  source_id: string;
  raw_title: string;
  raw_url: string;
  lat: number | null;
  lon: number | null;
  zip_id: string | null;
  distance_miles: number | null;
  resolution_tier: string;
  resolution_explain: Record<string, any>;
  confidence: string;
  ttl: string;
}

const DEFAULT_TTL_DAYS = 7;
const CONFIDENCE_ORDER = ['high', 'medium', 'low'];

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
    const ttlDays = input.ttl_days ?? DEFAULT_TTL_DAYS;
    const confidenceThreshold = input.confidence_threshold ?? 'medium';
    
    console.log(`[PASS0_PIN_EMITTER] Starting for run ${input.run_id} with ${input.items?.length || 0} items`);
    console.log(`[PASS0_PIN_EMITTER] TTL: ${ttlDays} days, Confidence threshold: ${confidenceThreshold}`);

    if (!input.items || input.items.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'success',
          run_id: input.run_id,
          item_count: 0,
          items: [],
          logs: [{ level: 'warn', message: 'No items to emit' }]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const logs: Array<{level: string; message: string}> = [];
    
    // Filter by confidence threshold
    const thresholdIndex = CONFIDENCE_ORDER.indexOf(confidenceThreshold);
    const filteredItems = input.items.filter(item => {
      const itemIndex = CONFIDENCE_ORDER.indexOf(item.confidence);
      return itemIndex <= thresholdIndex;
    });
    
    const rejectedByConfidence = input.items.length - filteredItems.length;
    if (rejectedByConfidence > 0) {
      logs.push({ level: 'info', message: `Filtered out ${rejectedByConfidence} items below confidence threshold` });
    }

    // Calculate TTL timestamp
    const ttlDate = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    
    // Prepare pins for insertion
    const pinsToInsert: PinRecord[] = filteredItems.map(item => ({
      run_id: input.run_id,
      source_id: item.source_id,
      raw_title: item.raw_title,
      raw_url: item.raw_url,
      lat: item.lat,
      lon: item.lon,
      zip_id: item.zip_id,
      distance_miles: item.distance_miles,
      resolution_tier: item.resolution_tier,
      resolution_explain: {
        ...item.resolution_explain,
        emitted_at: new Date().toISOString(),
        ttl_days: ttlDays
      },
      confidence: item.confidence,
      ttl: ttlDate.toISOString()
    }));

    let insertedCount = 0;
    let errorCount = 0;

    if (!input.dry_run && pinsToInsert.length > 0) {
      // Insert in batches to avoid timeouts
      const batchSize = 50;
      for (let i = 0; i < pinsToInsert.length; i += batchSize) {
        const batch = pinsToInsert.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('pass0_narrative_pins')
          .insert(batch)
          .select('id');

        if (error) {
          console.error('[PIN_EMITTER] Batch insert error:', error);
          errorCount += batch.length;
          logs.push({ level: 'error', message: `Batch ${i / batchSize + 1} failed: ${error.message}` });
        } else {
          insertedCount += data?.length ?? 0;
        }
      }
      
      logs.push({ level: 'info', message: `Inserted ${insertedCount} pins to database` });
      
    } else if (input.dry_run) {
      insertedCount = pinsToInsert.length;
      logs.push({ level: 'info', message: `Dry run: would insert ${insertedCount} pins` });
    }

    // Clean up expired pins (TTL enforcement)
    if (!input.dry_run) {
      const { data: expiredData, error: cleanupError } = await supabase
        .from('pass0_narrative_pins')
        .delete()
        .lt('ttl', new Date().toISOString())
        .select('id');
      
      if (!cleanupError && expiredData && expiredData.length > 0) {
        logs.push({ level: 'info', message: `Cleaned up ${expiredData.length} expired pins` });
        console.log(`[PIN_EMITTER] Cleaned up ${expiredData.length} expired pins`);
      }
    }

    // Mark manual queue items as processed
    if (!input.dry_run) {
      await supabase
        .from('pass0_url_queue')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('processed_run_id', input.run_id)
        .eq('status', 'processing');
    }

    logs.push({ level: 'info', message: `TTL set to ${ttlDays} days` });

    console.log(`[PASS0_PIN_EMITTER] Complete: ${insertedCount} pins emitted, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        status: 'success',
        run_id: input.run_id,
        item_count: insertedCount,
        dry_run: input.dry_run ?? false,
        filtered_by_confidence: rejectedByConfidence,
        error_count: errorCount,
        ttl_days: ttlDays,
        ttl_expires: ttlDate.toISOString(),
        logs
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
