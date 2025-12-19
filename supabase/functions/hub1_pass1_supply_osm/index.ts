/**
 * PROCESS: hub1.pass1.supply_osm
 * VERSION: v1.0.0
 * 
 * PURPOSE: Fetch real storage facility data from OpenStreetMap via Overpass API.
 * This is a ZERO-COST data source for initial supply discovery.
 * 
 * INPUT: run_id, bounding box (from pass1_radius_zip)
 * OUTPUT: Real facilities to pass1_supply_snapshot with confidence="low"
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OSMElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    operator?: string;
    brand?: string;
    phone?: string;
    website?: string;
    'addr:street'?: string;
    'addr:city'?: string;
    'addr:postcode'?: string;
    'addr:housenumber'?: string;
  };
}

interface OverpassResponse {
  elements: OSMElement[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const processId = 'hub1.pass1.supply_osm';
  const version = 'v1.0.0';

  try {
    const { run_id, origin_zip, radius_miles = 10 } = await req.json();

    if (!run_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'run_id is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${processId}@${version}] Starting OSM supply fetch for run_id=${run_id}, origin_zip=${origin_zip}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get bounding box from radius zips or use origin zip coordinates
    let lat: number, lng: number;

    if (origin_zip) {
      // Get coordinates from us_zip_codes
      const { data: zipData, error: zipError } = await supabase
        .from('us_zip_codes')
        .select('lat, lng')
        .eq('zip', origin_zip)
        .maybeSingle();

      if (zipError || !zipData?.lat || !zipData?.lng) {
        console.error(`[${processId}] Failed to get coordinates for zip ${origin_zip}:`, zipError);
        return new Response(JSON.stringify({
          success: false,
          error: `Could not find coordinates for zip ${origin_zip}`,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      lat = Number(zipData.lat);
      lng = Number(zipData.lng);
    } else {
      // Try to get from pass1_radius_zip
      const { data: radiusData, error: radiusError } = await supabase
        .from('pass1_radius_zip')
        .select('lat, lng')
        .eq('run_id', run_id)
        .limit(1)
        .maybeSingle();

      if (radiusError || !radiusData) {
        console.error(`[${processId}] No radius data found for run_id=${run_id}`);
        return new Response(JSON.stringify({
          success: false,
          error: 'No location data available for this run',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      lat = Number(radiusData.lat);
      lng = Number(radiusData.lng);
    }

    // Calculate bounding box (approximate: 1 degree ≈ 69 miles)
    const latDelta = radius_miles / 69;
    const lngDelta = radius_miles / (69 * Math.cos(lat * Math.PI / 180));

    const south = lat - latDelta;
    const north = lat + latDelta;
    const west = lng - lngDelta;
    const east = lng + lngDelta;

    console.log(`[${processId}] Querying Overpass API for bbox: ${south},${west},${north},${east}`);

    // Query Overpass API for storage facilities
    const overpassQuery = `
      [out:json][timeout:30];
      (
        node["amenity"="storage_rental"](${south},${west},${north},${east});
        way["amenity"="storage_rental"](${south},${west},${north},${east});
        relation["amenity"="storage_rental"](${south},${west},${north},${east});
        node["shop"="storage_rental"](${south},${west},${north},${east});
        way["shop"="storage_rental"](${south},${west},${north},${east});
        node["landuse"="storage"](${south},${west},${north},${east});
        way["landuse"="storage"](${south},${west},${north},${east});
        node["building"="storage"](${south},${west},${north},${east});
        way["building"="storage"](${south},${west},${north},${east});
      );
      out center;
    `;

    const overpassResponse = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (!overpassResponse.ok) {
      const errorText = await overpassResponse.text();
      console.error(`[${processId}] Overpass API error:`, errorText);
      
      // Track the failed attempt (0 cost)
      await supabase.from('ai_cost_tracker').insert({
        run_id,
        service: 'overpass',
        operation: 'supply_query_failed',
        cost_cents: 0,
        metadata: { error: errorText.substring(0, 500) },
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Overpass API request failed',
        details: errorText.substring(0, 200),
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const osmData: OverpassResponse = await overpassResponse.json();
    console.log(`[${processId}] Found ${osmData.elements.length} OSM elements`);

    // Track successful query (0 cost - Overpass is free)
    await supabase.from('ai_cost_tracker').insert({
      run_id,
      service: 'overpass',
      operation: 'supply_query',
      cost_cents: 0,
      metadata: { element_count: osmData.elements.length },
    });

    // Transform OSM elements to supply snapshots
    const facilities = osmData.elements.map((element) => {
      const facilityLat = element.lat || element.center?.lat;
      const facilityLng = element.lon || element.center?.lon;
      
      // Estimate sqft based on OSM data (very rough - confidence is low)
      // Default to 15,000 sqft if unknown (small facility assumption)
      const estimatedSqft = 15000;

      const facilityName = element.tags?.name 
        || element.tags?.operator 
        || element.tags?.brand 
        || `Storage Facility OSM-${element.id}`;

      // Try to extract zip from address or use origin_zip
      const zip = element.tags?.['addr:postcode'] || origin_zip || 'unknown';

      return {
        run_id,
        zip,
        facility_name: facilityName,
        estimated_sqft: estimatedSqft,
        source: 'osm_overpass',
        confidence: 'low', // OSM data quality varies significantly
      };
    });

    // Insert facilities into pass1_supply_snapshot
    if (facilities.length > 0) {
      const { error: insertError } = await supabase
        .from('pass1_supply_snapshot')
        .insert(facilities);

      if (insertError) {
        console.error(`[${processId}] Error inserting facilities:`, insertError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to save facilities',
          details: insertError.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`[${processId}] Successfully processed ${facilities.length} facilities from OSM`);

    return new Response(JSON.stringify({
      success: true,
      process_id: processId,
      version,
      run_id,
      facility_count: facilities.length,
      source: 'osm_overpass',
      cost_cents: 0,
      message: facilities.length > 0 
        ? `Found ${facilities.length} storage facilities from OpenStreetMap`
        : 'No storage facilities found in OSM for this area',
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
