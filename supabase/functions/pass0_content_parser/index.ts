const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkerInput {
  run_id: string;
  dry_run?: boolean;
  items: FetchedItem[];
}

interface FetchedItem {
  source_id: string;
  raw_title: string;
  raw_url: string;
  published_at?: string;
  raw_snippet?: string;
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

interface ParsedItem extends FetchedItem {
  extracted_text?: string;
  locations: ExtractedLocation[];
  parse_status: 'success' | 'failed' | 'skipped';
  parse_error?: string;
}

// Versioned regex patterns (must match pass0-geo-patterns.json)
const GEO_PATTERNS = {
  version: '1.0.0',
  zip_code: /\b(\d{5})(?:-\d{4})?\b/g,
  city_state: /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*,\s*([A-Z]{2})\b/g,
  county_state: /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s+County\s*,\s*([A-Z]{2})\b/g,
  state_name: /\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/g
};

const STATE_ABBREV: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY'
};

function extractLocations(text: string): ExtractedLocation[] {
  const locations: ExtractedLocation[] = [];
  const seen = new Set<string>();
  
  // Extract ZIP codes (highest confidence)
  let match;
  const zipRegex = new RegExp(GEO_PATTERNS.zip_code.source, 'g');
  while ((match = zipRegex.exec(text)) !== null) {
    const zip = match[1];
    const key = `zip:${zip}`;
    if (!seen.has(key)) {
      seen.add(key);
      locations.push({
        type: 'zip',
        value: zip,
        zip,
        confidence: 'high'
      });
    }
  }
  
  // Extract County, State patterns
  const countyRegex = new RegExp(GEO_PATTERNS.county_state.source, 'g');
  while ((match = countyRegex.exec(text)) !== null) {
    const county = match[1];
    const state = match[2];
    const key = `county:${county}:${state}`;
    if (!seen.has(key)) {
      seen.add(key);
      locations.push({
        type: 'county_state',
        value: `${county} County, ${state}`,
        county,
        state,
        confidence: 'medium'
      });
    }
  }
  
  // Extract City, State patterns
  const cityRegex = new RegExp(GEO_PATTERNS.city_state.source, 'g');
  while ((match = cityRegex.exec(text)) !== null) {
    const city = match[1];
    const state = match[2];
    // Skip if it looks like a county we already captured
    const key = `city:${city}:${state}`;
    if (!seen.has(key) && !seen.has(`county:${city}:${state}`)) {
      seen.add(key);
      locations.push({
        type: 'city_state',
        value: `${city}, ${state}`,
        city,
        state,
        confidence: 'high'
      });
    }
  }
  
  // Extract state names only (lowest confidence)
  const stateRegex = new RegExp(GEO_PATTERNS.state_name.source, 'g');
  while ((match = stateRegex.exec(text)) !== null) {
    const stateName = match[1];
    const stateAbbrev = STATE_ABBREV[stateName];
    const key = `state:${stateAbbrev}`;
    if (!seen.has(key) && stateAbbrev) {
      seen.add(key);
      locations.push({
        type: 'state',
        value: stateName,
        state: stateAbbrev,
        confidence: 'low'
      });
    }
  }
  
  return locations;
}

async function fetchAndParseHTML(url: string): Promise<{ text: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Pass0-Parser/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { text: '', error: `HTTP ${response.status}` };
    }
    
    const html = await response.text();
    
    // Simple HTML text extraction using regex (deterministic, no external deps)
    // Remove script and style tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    
    return { text: text.substring(0, 5000) };
    
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return { text: '', error: errorMsg };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: WorkerInput = await req.json();
    console.log(`[PASS0_CONTENT_PARSER] Starting for run ${input.run_id} with ${input.items?.length || 0} items`);

    if (!input.items || input.items.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'success',
          run_id: input.run_id,
          item_count: 0,
          items: [],
          logs: [{ level: 'warn', message: 'No items to parse' }]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsedItems: ParsedItem[] = [];
    const logs: Array<{level: string; message: string}> = [];
    let successCount = 0;
    let failCount = 0;

    // Process items (limit concurrent requests)
    const batchSize = 5;
    for (let i = 0; i < input.items.length; i += batchSize) {
      const batch = input.items.slice(i, i + batchSize);
      
      const results = await Promise.all(batch.map(async (item) => {
        // First, try to extract locations from title and snippet
        const titleText = `${item.raw_title} ${item.raw_snippet || ''}`;
        let locations = extractLocations(titleText);
        let extractedText = titleText;
        let parseStatus: 'success' | 'failed' | 'skipped' = 'skipped';
        let parseError: string | undefined;
        
        // If no locations found in title, try fetching the full article
        if (locations.length === 0 && !input.dry_run) {
          const { text, error } = await fetchAndParseHTML(item.raw_url);
          if (text) {
            extractedText = text;
            locations = extractLocations(text);
            parseStatus = 'success';
            successCount++;
          } else {
            parseStatus = 'failed';
            parseError = error;
            failCount++;
          }
        } else if (locations.length > 0) {
          parseStatus = 'success';
          successCount++;
        }
        
        return {
          ...item,
          extracted_text: extractedText.substring(0, 1000),
          locations,
          parse_status: parseStatus,
          parse_error: parseError
        } as ParsedItem;
      }));
      
      parsedItems.push(...results);
    }

    // Filter to only items with locations
    const itemsWithLocations = parsedItems.filter(p => p.locations.length > 0);
    
    logs.push({ level: 'info', message: `Parsed ${parsedItems.length} items` });
    logs.push({ level: 'info', message: `Found locations in ${itemsWithLocations.length} items` });
    logs.push({ level: 'info', message: `Pattern version: ${GEO_PATTERNS.version}` });
    if (failCount > 0) {
      logs.push({ level: 'warn', message: `${failCount} items failed to parse` });
    }

    console.log(`[PASS0_CONTENT_PARSER] Complete: ${itemsWithLocations.length}/${parsedItems.length} items have locations`);

    return new Response(
      JSON.stringify({
        status: 'success',
        run_id: input.run_id,
        item_count: itemsWithLocations.length,
        total_parsed: parsedItems.length,
        pattern_version: GEO_PATTERNS.version,
        items: itemsWithLocations,
        logs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PASS0_CONTENT_PARSER] Error:', error);
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
