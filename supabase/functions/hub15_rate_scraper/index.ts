/**
 * PROCESS: hub15.rate_scraper
 * VERSION: v1.0.0
 * 
 * PURPOSE: Web scraping worker for rate remediation.
 * Attempts to extract storage rates from competitor websites using simple fetch.
 * 
 * TIERS:
 *   Tier 2: Simple fetch (static sites) - ~$0.001/page
 *   Tier 3: Fetch with delay (JS-heavy sites) - ~$0.005/page
 * 
 * INPUT: gap_queue_id, run_id, competitor_name, website_url (optional)
 * OUTPUT: Extracted rates with confidence score
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ================================================================
// GUARD RAILS — DO NOT MODIFY THRESHOLDS WITHOUT ADR
// ================================================================
const SCRAPER_GUARD_RAILS = {
  TIMEOUT_MS: 30000,               // 30 seconds per page
  MAX_RETRIES: 2,                  // Retry with JS mode
  COST_STATIC_CENTS: 0,            // Free - just fetch
  COST_JS_CENTS: 0,                // Free - just fetch with delay
};

// ================================================================
// INPUT CONTRACT
// ================================================================
interface ScraperInput {
  gap_queue_id: string;
  run_id: string;
  competitor_id: string;
  competitor_name: string;
  competitor_address?: string;
  website_url?: string;
  target_unit_sizes: string[];
  attempt_number: number;
}

// ================================================================
// OUTPUT CONTRACT
// ================================================================
interface ScraperOutput {
  process_id: string;
  version: string;
  gap_queue_id: string;
  status: 'completed' | 'partial' | 'failed' | 'timeout';
  rates?: {
    unit_size: string;
    monthly_rate: number;
    climate_controlled: boolean;
  }[];
  source_url?: string;
  confidence: number;              // 0.0 to 1.0
  duration_ms: number;
  cost_cents: number;
  needs_next_tier: boolean;
  error_code?: string;
  error_message?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate parsing patterns
const RATE_PATTERNS = [
  // "$XX/month" or "$XX per month"
  /\$(\d+(?:\.\d{2})?)\s*(?:\/|per)\s*(?:mo(?:nth)?|mo\.?)/gi,
  // "$XX monthly"
  /\$(\d+(?:\.\d{2})?)\s*monthly/gi,
  // "Starting at $XX"
  /starting\s+(?:at|from)\s+\$(\d+(?:\.\d{2})?)/gi,
  // "$XX - $YY" range
  /\$(\d+(?:\.\d{2})?)\s*-\s*\$(\d+(?:\.\d{2})?)/gi,
];

// Unit size patterns
const UNIT_SIZE_PATTERNS = {
  '5x5': /5\s*[x×]\s*5/i,
  '5x10': /5\s*[x×]\s*10/i,
  '10x10': /10\s*[x×]\s*10/i,
  '10x15': /10\s*[x×]\s*15/i,
  '10x20': /10\s*[x×]\s*20/i,
  '10x30': /10\s*[x×]\s*30/i,
};

function extractRates(html: string): Array<{ unit_size: string; monthly_rate: number; climate_controlled: boolean }> {
  const rates: Array<{ unit_size: string; monthly_rate: number; climate_controlled: boolean }> = [];
  const foundPrices: Map<string, number[]> = new Map();

  // Look for sections containing unit sizes and prices
  const sections = html.split(/<(?:div|tr|section|article)[^>]*>/i);

  for (const section of sections) {
    // Detect unit size in this section
    let detectedSize: string | null = null;
    for (const [size, pattern] of Object.entries(UNIT_SIZE_PATTERNS)) {
      if (pattern.test(section)) {
        detectedSize = size;
        break;
      }
    }

    if (!detectedSize) continue;

    // Look for prices in this section
    for (const pattern of RATE_PATTERNS) {
      const matches = section.matchAll(pattern);
      for (const match of matches) {
        const price = parseFloat(match[1]);
        if (price >= 20 && price <= 500) { // Reasonable storage unit price range
          const existing = foundPrices.get(detectedSize) || [];
          existing.push(price);
          foundPrices.set(detectedSize, existing);
        }
      }
    }
  }

  // Check for climate controlled indicator
  const isClimateControlled = (section: string) => {
    return /climate\s*control/i.test(section) || /heated/i.test(section) || /cooled/i.test(section);
  };

  // Convert to output format (use lowest price found for each size)
  for (const [size, prices] of foundPrices.entries()) {
    if (prices.length > 0) {
      rates.push({
        unit_size: size,
        monthly_rate: Math.min(...prices),
        climate_controlled: isClimateControlled(html),
      });
    }
  }

  return rates;
}

async function scrapeWebsite(url: string): Promise<{ html: string; success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCRAPER_GUARD_RAILS.TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StorageBot/1.0; +https://lovable.dev)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { html: '', success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    return { html, success: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { html: '', success: false, error: 'Timeout' };
    }
    return { html: '', success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const processId = 'hub15.rate_scraper';
  const version = 'v1.0.0';
  const startTime = Date.now();

  try {
    const input: ScraperInput = await req.json();
    const { gap_queue_id, run_id, competitor_id, competitor_name, website_url, target_unit_sizes, attempt_number } = input;

    console.log(`[${processId}@${version}] Starting scrape for ${competitor_name}, attempt=${attempt_number}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check kill switch
    const { data: costData } = await supabase
      .from('ai_cost_tracker')
      .select('cost_cents')
      .eq('run_id', run_id);

    const totalCost = (costData || []).reduce((sum, row) => sum + (row.cost_cents || 0), 0);
    const budgetCents = 5000; // $50 budget

    if (totalCost >= budgetCents * 0.10) {
      console.log(`[${processId}] Kill switch - cost ${totalCost} exceeds 10% of budget`);
      return new Response(JSON.stringify({
        process_id: processId,
        version,
        gap_queue_id,
        status: 'failed',
        confidence: 0,
        duration_ms: Date.now() - startTime,
        cost_cents: 0,
        needs_next_tier: true,
        error_code: 'BUDGET_EXCEEDED',
        error_message: 'AI cost budget exceeded for this run',
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no website URL, try to get from competitor record
    let urlToScrape = website_url;
    if (!urlToScrape) {
      const { data: competitor } = await supabase
        .from('competitor_facilities')
        .select('website_url')
        .eq('id', competitor_id)
        .maybeSingle();

      urlToScrape = competitor?.website_url;
    }

    if (!urlToScrape) {
      console.log(`[${processId}] No website URL available for ${competitor_name}`);
      
      // Log attempt
      await supabase.from('pass_1_5_attempt_log').insert({
        gap_queue_id,
        run_id,
        attempt_number,
        worker_type: 'rate_scraper',
        status: 'failed',
        error_code: 'NO_URL',
        error_message: 'No website URL available',
        duration_ms: Date.now() - startTime,
        cost_cents: 0,
      });

      return new Response(JSON.stringify({
        process_id: processId,
        version,
        gap_queue_id,
        status: 'failed',
        confidence: 0,
        duration_ms: Date.now() - startTime,
        cost_cents: 0,
        needs_next_tier: true,
        error_code: 'NO_URL',
        error_message: 'No website URL available - needs AI search or phone call',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${processId}] Scraping URL: ${urlToScrape}`);

    // Attempt to scrape
    const scrapeResult = await scrapeWebsite(urlToScrape);

    if (!scrapeResult.success) {
      console.log(`[${processId}] Scrape failed: ${scrapeResult.error}`);
      
      await supabase.from('pass_1_5_attempt_log').insert({
        gap_queue_id,
        run_id,
        attempt_number,
        worker_type: 'rate_scraper',
        status: 'failed',
        error_code: 'SCRAPE_FAILED',
        error_message: scrapeResult.error,
        source_url: urlToScrape,
        duration_ms: Date.now() - startTime,
        cost_cents: 0,
      });

      return new Response(JSON.stringify({
        process_id: processId,
        version,
        gap_queue_id,
        status: 'failed',
        source_url: urlToScrape,
        confidence: 0,
        duration_ms: Date.now() - startTime,
        cost_cents: 0,
        needs_next_tier: true,
        error_code: 'SCRAPE_FAILED',
        error_message: scrapeResult.error,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract rates from HTML
    const rates = extractRates(scrapeResult.html);
    console.log(`[${processId}] Extracted ${rates.length} rates from ${urlToScrape}`);

    // Calculate confidence based on coverage
    const targetedFound = rates.filter(r => target_unit_sizes.includes(r.unit_size)).length;
    const confidence = rates.length > 0 
      ? Math.min(0.8, 0.3 + (targetedFound / target_unit_sizes.length) * 0.5)
      : 0;

    // Determine if we need next tier
    const needsNextTier = rates.length === 0 || confidence < 0.5;

    // Update competitor_facilities with found rates
    if (rates.length > 0) {
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        source_url: urlToScrape,
        last_verified_at: new Date().toISOString(),
      };

      for (const rate of rates) {
        const fieldName = `rent_${rate.unit_size.replace('x', 'x')}${rate.climate_controlled ? '_cc' : ''}`;
        if (['rent_5x5', 'rent_5x10', 'rent_10x10', 'rent_10x15', 'rent_10x20', 'rent_10x30', 'rent_10x10_cc', 'rent_10x15_cc', 'rent_10x20_cc'].includes(fieldName)) {
          updatePayload[fieldName] = rate.monthly_rate;
        }
      }

      // Calculate price_per_sqft if we have 10x10
      const rate10x10 = rates.find(r => r.unit_size === '10x10' && !r.climate_controlled);
      if (rate10x10) {
        updatePayload.price_per_sqft = rate10x10.monthly_rate / 100;
      }

      if (!needsNextTier) {
        updatePayload.needs_call_verification = false;
      }

      await supabase
        .from('competitor_facilities')
        .update(updatePayload)
        .eq('id', competitor_id);
    }

    // Log successful attempt
    await supabase.from('pass_1_5_attempt_log').insert({
      gap_queue_id,
      run_id,
      attempt_number,
      worker_type: 'rate_scraper',
      status: rates.length > 0 ? 'completed' : 'failed',
      source_url: urlToScrape,
      duration_ms: Date.now() - startTime,
      cost_cents: 0,
      metadata: { rates_found: rates.length, confidence },
    });

    // Track cost (free for simple fetch)
    await supabase.from('ai_cost_tracker').insert({
      run_id,
      service: 'rate_scraper',
      operation: 'web_scrape',
      cost_cents: 0,
      metadata: { url: urlToScrape, rates_found: rates.length },
    });

    // Update gap queue status if successful
    if (rates.length > 0 && !needsNextTier) {
      await supabase
        .from('pass_1_5_gap_queue')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', gap_queue_id);
    }

    const response: ScraperOutput = {
      process_id: processId,
      version,
      gap_queue_id,
      status: rates.length > 0 ? (needsNextTier ? 'partial' : 'completed') : 'failed',
      rates: rates.length > 0 ? rates : undefined,
      source_url: urlToScrape,
      confidence,
      duration_ms: Date.now() - startTime,
      cost_cents: 0,
      needs_next_tier: needsNextTier,
    };

    console.log(`[${processId}] Completed: status=${response.status}, rates=${rates.length}, confidence=${confidence}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[${processId}@${version}] ERROR:`, error);
    return new Response(JSON.stringify({
      process_id: processId,
      version,
      gap_queue_id: '',
      status: 'failed',
      confidence: 0,
      duration_ms: Date.now() - startTime,
      cost_cents: 0,
      needs_next_tier: true,
      error_code: 'INTERNAL_ERROR',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
