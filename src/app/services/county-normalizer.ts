/**
 * County Name Normalizer Service
 *
 * Normalizes county names for fuzzy matching.
 * Used as FALLBACK when county_fips is not available.
 *
 * NOTE: This is a temporary bridge until FIPS is promoted
 * to jurisdiction_card_drafts as a first-class column.
 */
export function normalizeCountyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+county$/i, '')  // Strip trailing "county"
    .replace(/\s+/g, ' ');       // Collapse whitespace
}

// Examples:
// "Bedford County" → "bedford"
// "  FULTON COUNTY  " → "fulton"
// "St. Mary's County" → "st. mary's"
