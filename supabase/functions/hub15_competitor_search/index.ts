/**
 * PROCESS: hub15.competitor_search
 * VERSION: v1.0.0
 * 
 * PURPOSE: AI-powered competitor pricing search using Lovable AI.
 * Tier 1 of the 4-tier cost ladder for competition recon.
 * 
 * INPUT: competitor_name, county, state, phone (optional)
 * OUTPUT: Extracted pricing data, website URL, confidence score
 * 
 * COST: ~$0.01 per search (Lovable AI)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorSearchInput {
  run_id: string;
  competitor_id: string;
  competitor_name: string;
  county: string;
  state: string;
  address?: string;
  phone?: string;
}

interface ExtractedPricing {
  rent_5x5?: number;
  rent_5x10?: number;
  rent_10x10?: number;
  rent_10x15?: number;
  rent_10x20?: number;
  rent_10x30?: number;
  rent_10x10_cc?: number;
  rent_10x15_cc?: number;
  rent_10x20_cc?: number;
  website_url?: string;
  source_url?: string;
  confidence_score: number;
  extraction_notes: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const processId = 'hub15.competitor_search';
  const version = 'v1.0.0';
  const costCents = 1; // ~$0.01 per AI call

  try {
    const input: CompetitorSearchInput = await req.json();
    const { run_id, competitor_id, competitor_name, county, state, address } = input;

    if (!run_id || !competitor_id || !competitor_name || !county || !state) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: run_id, competitor_id, competitor_name, county, state',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${processId}@${version}] Searching for: ${competitor_name} in ${county}, ${state}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check kill switch - if cost exceeded, skip AI search
    const { data: costData } = await supabase
      .from('ai_cost_tracker')
      .select('cost_cents')
      .eq('run_id', run_id);

    const totalCost = (costData || []).reduce((sum, row) => sum + (row.cost_cents || 0), 0);
    const budgetCents = 5000; // $50 budget per run

    if (totalCost >= budgetCents * 0.10) {
      console.log(`[${processId}] Kill switch triggered - cost ${totalCost} exceeds 10% of budget`);
      return new Response(JSON.stringify({
        success: false,
        error: 'AI cost budget exceeded for this run',
        kill_switch: true,
        total_cost_cents: totalCost,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build search prompt for Lovable AI
    const searchPrompt = `Find current storage unit rental prices for "${competitor_name}" located in ${county} County, ${state}${address ? ` at or near ${address}` : ''}.

I need:
1. Their website URL
2. Monthly rental rates for these unit sizes:
   - 5x5 (25 sq ft)
   - 5x10 (50 sq ft)  
   - 10x10 (100 sq ft)
   - 10x15 (150 sq ft)
   - 10x20 (200 sq ft)
   - 10x30 (300 sq ft)
   - Climate controlled 10x10
   - Climate controlled 10x15
   - Climate controlled 10x20

Return ONLY a JSON object with this exact structure (use null for unknown values):
{
  "website_url": "string or null",
  "rent_5x5": number or null,
  "rent_5x10": number or null,
  "rent_10x10": number or null,
  "rent_10x15": number or null,
  "rent_10x20": number or null,
  "rent_10x30": number or null,
  "rent_10x10_cc": number or null,
  "rent_10x15_cc": number or null,
  "rent_10x20_cc": number or null,
  "confidence": "high" | "medium" | "low",
  "notes": "string explaining data source"
}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error(`[${processId}] LOVABLE_API_KEY not configured`);
      return new Response(JSON.stringify({
        success: false,
        error: 'AI service not configured',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Lovable AI for search
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant specialized in finding self-storage facility pricing data. Always respond with valid JSON only, no markdown formatting.',
          },
          {
            role: 'user',
            content: searchPrompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    // Track cost regardless of success
    await supabase.from('ai_cost_tracker').insert({
      run_id,
      service: 'lovable_ai',
      operation: 'competitor_search',
      cost_cents: costCents,
      metadata: { competitor_id, competitor_name },
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[${processId}] AI API error:`, errorText);
      return new Response(JSON.stringify({
        success: false,
        error: 'AI search failed',
        details: errorText.substring(0, 200),
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    console.log(`[${processId}] AI response received, parsing...`);

    // Parse AI response
    let extractedData: ExtractedPricing;
    try {
      // Try to extract JSON from response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      
      const confidenceMap: Record<string, number> = {
        'high': 0.9,
        'medium': 0.6,
        'low': 0.3,
      };

      extractedData = {
        rent_5x5: parsed.rent_5x5,
        rent_5x10: parsed.rent_5x10,
        rent_10x10: parsed.rent_10x10,
        rent_10x15: parsed.rent_10x15,
        rent_10x20: parsed.rent_10x20,
        rent_10x30: parsed.rent_10x30,
        rent_10x10_cc: parsed.rent_10x10_cc,
        rent_10x15_cc: parsed.rent_10x15_cc,
        rent_10x20_cc: parsed.rent_10x20_cc,
        website_url: parsed.website_url,
        source_url: parsed.website_url,
        confidence_score: confidenceMap[parsed.confidence] || 0.3,
        extraction_notes: parsed.notes || 'AI-extracted pricing data',
      };
    } catch (parseError) {
      console.error(`[${processId}] Failed to parse AI response:`, parseError);
      extractedData = {
        confidence_score: 0.1,
        extraction_notes: 'AI response could not be parsed - needs manual verification',
      };
    }

    // Calculate if we have enough data
    const hasRentData = extractedData.rent_10x10 || extractedData.rent_10x15 || extractedData.rent_10x20;
    
    // Update competitor_facilities with extracted data
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      source: 'ai_search',
      confidence_score: extractedData.confidence_score,
    };

    if (extractedData.website_url) updatePayload.website_url = extractedData.website_url;
    if (extractedData.rent_5x5) updatePayload.rent_5x5 = extractedData.rent_5x5;
    if (extractedData.rent_5x10) updatePayload.rent_5x10 = extractedData.rent_5x10;
    if (extractedData.rent_10x10) updatePayload.rent_10x10 = extractedData.rent_10x10;
    if (extractedData.rent_10x15) updatePayload.rent_10x15 = extractedData.rent_10x15;
    if (extractedData.rent_10x20) updatePayload.rent_10x20 = extractedData.rent_10x20;
    if (extractedData.rent_10x30) updatePayload.rent_10x30 = extractedData.rent_10x30;
    if (extractedData.rent_10x10_cc) updatePayload.rent_10x10_cc = extractedData.rent_10x10_cc;
    if (extractedData.rent_10x15_cc) updatePayload.rent_10x15_cc = extractedData.rent_10x15_cc;
    if (extractedData.rent_10x20_cc) updatePayload.rent_10x20_cc = extractedData.rent_10x20_cc;

    // Calculate price_per_sqft if we have 10x10 rate
    if (extractedData.rent_10x10) {
      updatePayload.price_per_sqft = extractedData.rent_10x10 / 100;
    }

    // Determine if we need further verification
    if (!hasRentData || extractedData.confidence_score < 0.5) {
      updatePayload.needs_call_verification = true;
      updatePayload.missing_fields = ['rent_10x10', 'rent_10x20'].filter(
        field => !extractedData[field.replace('rent_', 'rent_') as keyof ExtractedPricing]
      );
    }

    const { error: updateError } = await supabase
      .from('competitor_facilities')
      .update(updatePayload)
      .eq('id', competitor_id);

    if (updateError) {
      console.error(`[${processId}] Failed to update competitor:`, updateError);
    }

    console.log(`[${processId}] Completed search for ${competitor_name}, hasRentData=${hasRentData}, confidence=${extractedData.confidence_score}`);

    return new Response(JSON.stringify({
      success: true,
      process_id: processId,
      version,
      run_id,
      competitor_id,
      competitor_name,
      extracted_data: extractedData,
      has_rent_data: hasRentData,
      needs_next_tier: !hasRentData || extractedData.confidence_score < 0.5,
      cost_cents: costCents,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[${processId}@${version}] ERROR:`, error);
    return new Response(JSON.stringify({
      success: false,
      process_id: processId,
      version,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
