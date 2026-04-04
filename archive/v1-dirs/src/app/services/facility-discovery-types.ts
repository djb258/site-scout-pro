/**
 * Facility Discovery Types
 *
 * Defines the standardized return format for facility discovery
 * during ZIP code enrichment (Pass 1 pipeline), plus the single
 * facility_research_log table for provenance and sitemap caching.
 *
 * Flow:
 *   1. Mint sovereign ID for county/ZIP
 *   2. Discover storage facilities in radius
 *   3. Return FacilityDiscoveryRecord[] (base discovery)
 *   4. Crawl facility URLs → log sitemap per domain
 *   5. Enrich with pricing/sqft → EnrichedFacilityRecord[]
 *   6. Log every data point to facility_research_log (provenance)
 *   7. Write to competitor_facilities table
 *
 * Table: facility_research_log (Neon vault — Shared_Ref, supportive)
 * Governed by: ERD_Shared_Ref.md
 */

// ═══════════════════════════════════════════════════════════════════════════
// DISCOVERY TYPES
// ═══════════════════════════════════════════════════════════════════════════

// Base shape returned by initial facility discovery (Google Places,
// Firecrawl, or manual research). Contains identity + contact only.
// Identity is the ADDRESS, not the company.

export interface FacilityDiscoveryRecord {
  facility_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  url: string | null;
}

// After enrichment (scraping, AI calling, or manual entry), the base
// record gains pricing and sizing data. This is the Pass 1 output target.

export interface EnrichedFacilityRecord extends FacilityDiscoveryRecord {
  facility_id: string;            // Deterministic from address: fac_XXXXXXXX
  county: string;
  total_sqft: number | null;      // Total rentable square footage
  price_per_sqft: number | null;  // Monthly rent per square foot ($/sqft/mo)
  unit_count: number | null;      // Total unit count at facility
  source: 'web' | 'call' | 'manual' | 'scrape';
  confidence_score: number | null; // 0.0 – 1.0
  discovered_at: string;          // ISO-8601 timestamp
}

// Full response shape when discovering facilities for a county/ZIP lookup.

export interface CountyFacilityDiscoveryResponse {
  county: string;
  state: string;
  zip_codes_searched: string[];
  facility_count: number;
  facilities: FacilityDiscoveryRecord[];
  discovered_at: string;
  source: string;
}

// After enrichment pass adds sqft and pricing data.

export interface EnrichedCountyFacilityResponse {
  county: string;
  state: string;
  zip_codes_searched: string[];
  facility_count: number;
  facilities: EnrichedFacilityRecord[];
  enrichment_complete: boolean;
  enrichment_coverage: number;    // 0.0 – 1.0 (% with pricing)
  discovered_at: string;
  enriched_at: string;
}


// ═══════════════════════════════════════════════════════════════════════════
// FACILITY RESEARCH LOG
// ═══════════════════════════════════════════════════════════════════════════
//
// Single append-only supportive table in Shared_Ref.
// Handles BOTH research provenance AND sitemap caching.
//
// - Rate/sqft evidence: data_point = 'price_per_sqft' | 'total_sqft' | etc.
// - Sitemap crawl:      data_point = 'sitemap', page map in metadata JSONB
//
// Keyed by facility_id (address-based, NOT company-based).
// All passes can READ. All passes can APPEND. Nobody DELETEs.
//
// Table: facility_research_log (Neon vault — ERD_Shared_Ref)
// ═══════════════════════════════════════════════════════════════════════════

export type ResearchDataPoint =
  | 'price_per_sqft'       // $/sqft/mo for a specific address
  | 'total_sqft'           // Total rentable sqft at address
  | 'unit_count'           // Number of units at address
  | 'monthly_rent'         // Raw rent for a specific unit size
  | 'unit_mix'             // Unit size breakdown
  | 'climate_controlled'   // CC availability at address
  | 'phone_number'         // Verified phone
  | 'facility_name'        // Verified/corrected name
  | 'address_correction'   // Address normalization fix
  | 'sitemap';             // Domain sitemap crawl (pages array in metadata)

export type ResearchMethod =
  | 'firecrawl_scrape'     // Automated web scrape via Firecrawl
  | 'ai_call'              // AI voice call via Retell
  | 'manual_web'           // Human looked it up on the website
  | 'manual_call'          // Human called the facility
  | 'google_places'        // Google Places API
  | 'third_party';         // Data provider (Radius+, Yardi Matrix, etc.)

export interface FacilityResearchLogRecord {
  // IDENTITY — keyed to the physical address, not the brand
  id: string;                       // UUID
  facility_id: string;              // FK → facility_master.facility_id (address hash)

  // WHAT was found
  data_point: ResearchDataPoint;
  value_raw: string;                // Exact text as captured ("$89/mo", "45,000 sqft")
  value_parsed: number | null;      // Normalized numeric (null for sitemap rows)
  unit_size: string | null;         // If rate: "10x10", "10x20", etc.

  // WHERE it was found
  source_url: string | null;        // Full URL of the page
  source_domain: string | null;     // e.g., "selfstorageplus.com"

  // HOW it was found
  method: ResearchMethod;
  confidence: number;               // 0.0 – 1.0

  // WHEN
  captured_at: string;              // ISO-8601

  // FLEXIBLE PAYLOAD
  // - For rate evidence: extraction notes, screenshot hash, etc.
  // - For sitemap: { pages: [{ url, title, has_pricing, page_type }], ... }
  metadata: Record<string, unknown> | null;

  // AUDIT
  created_at: string;               // ISO-8601, set by DB default
}

// ─── Sitemap Metadata Shape ──────────────────────────────────────────────
// When data_point = 'sitemap', metadata contains this structure.

export interface SitemapMetadata {
  sitemap_url: string | null;       // /sitemap.xml if found
  pages: SitemapPage[];
  page_count: number;
  pricing_page_count: number;
  location_urls: LocationUrl[];     // Per-facility pages on this domain
  crawl_method: 'sitemap_xml' | 'firecrawl_map' | 'manual_discovery';
  crawl_cost_cents: number;
  robots_txt_allows: boolean | null;
  is_spa: boolean;
  brand_name: string | null;        // e.g., "Self Storage Plus"
}

export interface SitemapPage {
  url: string;
  title: string | null;
  has_pricing: boolean;
  has_unit_list: boolean;
  has_contact: boolean;
  page_type: 'pricing' | 'units' | 'contact' | 'location_list' | 'about' | 'other';
}

export interface LocationUrl {
  url: string;                      // e.g., "selfstorageplus.com/martinsburg-triamigas"
  facility_id: string | null;       // FK → facility_master if matched
  facility_name: string | null;
  pricing_url: string | null;       // Direct link to this location's pricing
}


// ═══════════════════════════════════════════════════════════════════════════
// QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// Get latest evidence per data point for a facility.
// SQL: SELECT DISTINCT ON (data_point) * FROM facility_research_log
//      WHERE facility_id = $1 ORDER BY data_point, captured_at DESC

export interface FacilityResearchSummary {
  facility_id: string;
  facility_name: string;
  evidence_count: number;
  latest_capture: string;
  has_price_per_sqft: boolean;
  has_total_sqft: boolean;
  has_unit_count: boolean;
  has_sitemap: boolean;
  highest_confidence: number;
}

// Get cached sitemap for a domain.
// SQL: SELECT metadata FROM facility_research_log
//      WHERE data_point = 'sitemap' AND source_domain = $1
//      ORDER BY captured_at DESC LIMIT 1


// ═══════════════════════════════════════════════════════════════════════════
// MAPPERS
// ═══════════════════════════════════════════════════════════════════════════

// Maps an EnrichedFacilityRecord to the competitor_facilities INSERT shape.

export function toCompetitorFacilityInsert(
  record: EnrichedFacilityRecord
): {
  facility_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  county: string;
  phone: string | null;
  website_url: string | null;
  total_sqft: number | null;
  price_per_sqft: number | null;
  unit_count: number | null;
  source: string | null;
  confidence_score: number | null;
} {
  return {
    facility_name: record.facility_name,
    address: record.address,
    city: record.city,
    state: record.state,
    zip_code: record.zip,
    county: record.county,
    phone: record.phone,
    website_url: record.url,
    total_sqft: record.total_sqft,
    price_per_sqft: record.price_per_sqft,
    unit_count: record.unit_count,
    source: record.source,
    confidence_score: record.confidence_score,
  };
}

// Extracts the domain from a URL for sitemap cache lookups.

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}
