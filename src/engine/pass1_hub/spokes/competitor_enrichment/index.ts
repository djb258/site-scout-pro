/**
 * COMPETITOR ENRICHMENT SPOKE
 *
 * Responsibility: Classify and enrich competitor data with grades, types, and estimates
 *
 * Inputs:
 *   - competitors: Competitor[] (from macro_supply spoke)
 *
 * Outputs:
 *   - Enriched Competitor[] with grade (A/B/C), type, brand detection
 *   - CompetitorEnrichmentSummary for Pass1MacroResults
 *
 * Classification:
 *   - Grade A: National REITs (Public Storage, Extra Space, CubeSmart, Life Storage, etc.)
 *   - Grade B: Regional operators, multi-facility owners
 *   - Grade C: Mom & Pop, single-location operators
 *
 * Data Sources:
 *   - Pattern matching on facility names
 *   - Lovable.DB: brand_registry (optional lookup)
 */

import type { Competitor, CompetitorEnrichmentSummary } from '../../../shared/opportunity_object';
import { writeLog } from '../../../shared/lovable_adapter';

// ============================================================================
// CONSTANTS - Known National REITs and Regional Operators
// ============================================================================

const NATIONAL_REITS: Record<string, string> = {
  'public storage': 'Public Storage',
  'extra space': 'Extra Space Storage',
  'cubesmart': 'CubeSmart',
  'life storage': 'Life Storage',
  'national storage': 'National Storage Affiliates',
  'iron mountain': 'Iron Mountain',
  'storage asset management': 'Storage Asset Management',
  'storequest': 'StoreQuest',
  'safeguard': 'Safeguard Self Storage',
  'storquest': 'StorQuest',
  'simply self storage': 'Simply Self Storage',
  'prime storage': 'Prime Storage',
  'global self storage': 'Global Self Storage',
  'strategic storage': 'Strategic Storage Trust',
  'janus international': 'Janus International',
};

const REGIONAL_OPERATORS: Record<string, string> = {
  'uncle bob': "Uncle Bob's Self Storage",
  'metro storage': 'Metro Storage',
  'storage mart': 'StorageMart',
  'sparefoot': 'SpareFoot Network',
  'stor-it': 'Stor-It',
  'u-stor': 'U-Stor',
  'all american': 'All American Storage',
  'american self storage': 'American Self Storage',
  'discount storage': 'Discount Storage',
  'storage direct': 'Storage Direct',
  'store space': 'Store Space',
  'store here': 'Store Here',
  'storage zone': 'Storage Zone',
  'compass self storage': 'Compass Self Storage',
  'securcare': 'SecurCare Self Storage',
};

// Keywords that indicate facility types
const TYPE_INDICATORS = {
  rv_boat: ['rv', 'boat', 'vehicle', 'outdoor', 'parking', 'trailer', 'marine'],
  climate_only: ['climate', 'temperature', 'wine', 'art storage', 'document'],
  portable: ['pod', 'container', 'portable', 'mobile', 'delivery'],
};

// ============================================================================
// TYPES
// ============================================================================

export interface EnrichmentInput {
  competitors: Competitor[];
}

export interface EnrichmentOutput {
  success: boolean;
  status: 'ok' | 'stub' | 'error';
  enriched_competitors: Competitor[];
  summary: CompetitorEnrichmentSummary;
  error?: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Enrich competitors with grade, type, and brand information
 *
 * @param input - Contains array of competitors to enrich
 * @returns EnrichmentOutput with enriched competitors and summary
 */
export async function enrichCompetitors(input: EnrichmentInput): Promise<EnrichmentOutput> {
  const { competitors } = input;

  console.log(`[COMPETITOR_ENRICHMENT] Enriching ${competitors.length} competitors`);

  try {
    // Enrich each competitor
    const enriched_competitors = competitors.map(competitor => enrichSingleCompetitor(competitor));

    // Build summary
    const summary = buildEnrichmentSummary(enriched_competitors);

    await writeLog('competitor_enrichment_complete', {
      total: enriched_competitors.length,
      grade_a: summary.grade_a_count,
      grade_b: summary.grade_b_count,
      grade_c: summary.grade_c_count,
      reit_presence: summary.reit_presence,
    });

    console.log(`[COMPETITOR_ENRICHMENT] Complete: A=${summary.grade_a_count}, B=${summary.grade_b_count}, C=${summary.grade_c_count}`);

    return {
      success: true,
      status: 'ok',
      enriched_competitors,
      summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[COMPETITOR_ENRICHMENT] Error:', error);

    return {
      success: false,
      status: 'error',
      enriched_competitors: competitors, // Return original if enrichment fails
      summary: createEmptySummary(),
      error: errorMessage,
    };
  }
}

/**
 * Enrich a single competitor
 */
function enrichSingleCompetitor(competitor: Competitor): Competitor {
  const nameLower = competitor.name.toLowerCase();
  const addressLower = (competitor.address || '').toLowerCase();
  const combined = `${nameLower} ${addressLower}`;

  // Detect grade and brand
  const { grade, brand, is_reit } = classifyCompetitor(nameLower);

  // Detect facility type
  const facility_type = detectFacilityType(combined, competitor.climate_controlled);

  // Estimate unit count from sqft (industry avg: 75 sqft per unit)
  const unit_count_estimate = competitor.estimated_sqft
    ? Math.round(competitor.estimated_sqft / 75)
    : undefined;

  // Estimate occupancy from rating/reviews (heuristic)
  const occupancy_estimate = estimateOccupancy(competitor.rating, competitor.review_count);

  // Determine enrichment confidence
  const enrichment_confidence = determineConfidence(grade, brand);

  // Check for specialty storage
  const has_rv_boat = TYPE_INDICATORS.rv_boat.some(kw => combined.includes(kw));
  const has_wine_storage = combined.includes('wine');
  const has_vehicle_storage = ['car', 'auto', 'vehicle', 'parking'].some(kw => combined.includes(kw));

  return {
    ...competitor,
    grade,
    facility_type,
    brand,
    is_reit,
    unit_count_estimate,
    occupancy_estimate,
    has_rv_boat,
    has_wine_storage,
    has_vehicle_storage,
    enrichment_confidence,
  };
}

/**
 * Classify competitor into grade A/B/C
 */
function classifyCompetitor(nameLower: string): {
  grade: 'A' | 'B' | 'C';
  brand?: string;
  is_reit: boolean;
} {
  // Check for national REITs (Grade A)
  for (const [pattern, brand] of Object.entries(NATIONAL_REITS)) {
    if (nameLower.includes(pattern)) {
      return { grade: 'A', brand, is_reit: true };
    }
  }

  // Check for regional operators (Grade B)
  for (const [pattern, brand] of Object.entries(REGIONAL_OPERATORS)) {
    if (nameLower.includes(pattern)) {
      return { grade: 'B', brand, is_reit: false };
    }
  }

  // Check for multi-location indicators (Grade B)
  if (
    nameLower.includes('#') || // Numbered location like "Storage Inc #5"
    /\d{2,}/.test(nameLower) || // Multiple digits often indicate chain
    nameLower.includes('franchise') ||
    nameLower.includes('locations')
  ) {
    return { grade: 'B', brand: undefined, is_reit: false };
  }

  // Default to Mom & Pop (Grade C)
  return { grade: 'C', brand: undefined, is_reit: false };
}

/**
 * Detect facility type from name and attributes
 */
function detectFacilityType(
  combined: string,
  climateControlled?: boolean
): Competitor['facility_type'] {
  // Check for RV/Boat
  if (TYPE_INDICATORS.rv_boat.some(kw => combined.includes(kw))) {
    return 'rv_boat';
  }

  // Check for portable/container
  if (TYPE_INDICATORS.portable.some(kw => combined.includes(kw))) {
    return 'portable';
  }

  // Check for climate-only indicators
  if (
    TYPE_INDICATORS.climate_only.some(kw => combined.includes(kw)) &&
    !combined.includes('traditional') &&
    !combined.includes('standard')
  ) {
    return 'climate_only';
  }

  // Mixed if has climate but also traditional indicators
  if (climateControlled && (combined.includes('self storage') || combined.includes('mini storage'))) {
    return 'mixed';
  }

  // Default to traditional
  return 'traditional';
}

/**
 * Estimate occupancy from rating and review count
 * Heuristic: Higher ratings + more reviews = better occupancy
 */
function estimateOccupancy(rating?: number, reviewCount?: number): number | undefined {
  if (!rating && !reviewCount) return undefined;

  let estimate = 75; // Base occupancy

  // Rating adjustment
  if (rating) {
    if (rating >= 4.5) estimate += 15;
    else if (rating >= 4.0) estimate += 10;
    else if (rating >= 3.5) estimate += 5;
    else if (rating < 3.0) estimate -= 10;
  }

  // Review count adjustment (more reviews = established business)
  if (reviewCount) {
    if (reviewCount >= 100) estimate += 5;
    else if (reviewCount >= 50) estimate += 3;
    else if (reviewCount < 10) estimate -= 5;
  }

  return Math.min(98, Math.max(40, estimate));
}

/**
 * Determine confidence level of enrichment
 */
function determineConfidence(grade: 'A' | 'B' | 'C', brand?: string): 'high' | 'medium' | 'low' {
  if (grade === 'A' && brand) return 'high';
  if (grade === 'B' && brand) return 'high';
  if (grade === 'B') return 'medium';
  return 'low';
}

/**
 * Build summary of enrichment results
 */
function buildEnrichmentSummary(competitors: Competitor[]): CompetitorEnrichmentSummary {
  const grade_a_count = competitors.filter(c => c.grade === 'A').length;
  const grade_b_count = competitors.filter(c => c.grade === 'B').length;
  const grade_c_count = competitors.filter(c => c.grade === 'C').length;
  const reit_presence = competitors.some(c => c.is_reit);

  const total_estimated_sqft = competitors.reduce((sum, c) => sum + (c.estimated_sqft || 0), 0);
  const avg_estimated_sqft = competitors.length > 0
    ? Math.round(total_estimated_sqft / competitors.length)
    : 0;

  // Determine dominant type
  const typeCounts = new Map<string, number>();
  for (const c of competitors) {
    const type = c.facility_type || 'traditional';
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  }
  let dominant_type: CompetitorEnrichmentSummary['dominant_type'] = 'traditional';
  let maxCount = 0;
  for (const [type, count] of typeCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominant_type = type as CompetitorEnrichmentSummary['dominant_type'];
    }
  }

  return {
    total_competitors: competitors.length,
    grade_a_count,
    grade_b_count,
    grade_c_count,
    reit_presence,
    avg_estimated_sqft,
    total_estimated_sqft,
    dominant_type,
    enrichment_complete: true,
    enrichment_timestamp: new Date().toISOString(),
  };
}

/**
 * Create empty summary for error cases
 */
function createEmptySummary(): CompetitorEnrichmentSummary {
  return {
    total_competitors: 0,
    grade_a_count: 0,
    grade_b_count: 0,
    grade_c_count: 0,
    reit_presence: false,
    avg_estimated_sqft: 0,
    total_estimated_sqft: 0,
    dominant_type: 'traditional',
    enrichment_complete: false,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get competitors by grade
 */
export function getCompetitorsByGrade(
  competitors: Competitor[],
  grade: 'A' | 'B' | 'C'
): Competitor[] {
  return competitors.filter(c => c.grade === grade);
}

/**
 * Get REIT competitors only
 */
export function getREITCompetitors(competitors: Competitor[]): Competitor[] {
  return competitors.filter(c => c.is_reit);
}

/**
 * Calculate competition pressure from grades
 * Grade A competitors create more pressure than Grade C
 */
export function calculateGradedPressure(competitors: Competitor[]): number {
  let pressure = 0;

  for (const c of competitors) {
    const distance_factor = Math.max(0, 1 - (c.distance_miles / 15)); // Closer = more pressure
    const sqft_factor = Math.min(1, (c.estimated_sqft || 30000) / 100000);

    switch (c.grade) {
      case 'A':
        pressure += 3 * distance_factor * sqft_factor; // REITs create 3x pressure
        break;
      case 'B':
        pressure += 2 * distance_factor * sqft_factor; // Regionals create 2x pressure
        break;
      case 'C':
        pressure += 1 * distance_factor * sqft_factor; // Mom & Pop baseline
        break;
    }
  }

  // Normalize to 0-100 scale
  return Math.min(100, Math.round(pressure * 10));
}

/**
 * Identify primary competitive threat
 */
export function identifyPrimaryThreat(competitors: Competitor[]): Competitor | null {
  if (competitors.length === 0) return null;

  // Sort by: Grade (A first), then distance, then size
  const sorted = [...competitors].sort((a, b) => {
    // Grade priority: A > B > C
    const gradeOrder = { A: 0, B: 1, C: 2 };
    const gradeA = gradeOrder[a.grade || 'C'];
    const gradeB = gradeOrder[b.grade || 'C'];
    if (gradeA !== gradeB) return gradeA - gradeB;

    // Then by distance
    if (a.distance_miles !== b.distance_miles) {
      return a.distance_miles - b.distance_miles;
    }

    // Then by size (larger = bigger threat)
    return (b.estimated_sqft || 0) - (a.estimated_sqft || 0);
  });

  return sorted[0];
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { NATIONAL_REITS, REGIONAL_OPERATORS };
