/**
 * Unit Pricing Calculator
 *
 * Canonical calculation service for storage unit pricing.
 * Takes raw sizes and prices, calculates $/sqft per unit,
 * and produces the pricing curve for a facility address.
 *
 * Rule: price_per_sqft goes DOWN as unit size goes UP.
 * This is the expected market behavior. If it doesn't,
 * the data may be wrong or the facility has unusual pricing.
 *
 * Governed by: Sub-Hub 1 (Market Reality) — ERD_SubHub1_Market.md
 */

import type { FacilityResearchLogRecord, ResearchMethod } from './facility-discovery-types';

// ─── Standard Unit Sizes ─────────────────────────────────────────────────
// Industry-standard self-storage unit dimensions.
// This is the reference table — no DB needed.

export const STANDARD_UNITS = {
  '5x5':   { width: 5,  depth: 5,  sqft: 25  },
  '5x10':  { width: 5,  depth: 10, sqft: 50  },
  '5x15':  { width: 5,  depth: 15, sqft: 75  },
  '10x10': { width: 10, depth: 10, sqft: 100 },
  '10x15': { width: 10, depth: 15, sqft: 150 },
  '10x20': { width: 10, depth: 20, sqft: 200 },
  '10x25': { width: 10, depth: 25, sqft: 250 },
  '10x30': { width: 10, depth: 30, sqft: 300 },
  '15x20': { width: 15, depth: 20, sqft: 300 },
  '20x20': { width: 20, depth: 20, sqft: 400 },
} as const;

export type StandardUnitSize = keyof typeof STANDARD_UNITS;

// ─── Input: Raw size + price pair ────────────────────────────────────────
// What you capture during research — just the unit label and the monthly price.

export interface RawUnitPrice {
  unit_size: string;           // "5x5", "10x10", "10x20", etc.
  monthly_price: number;       // Raw monthly rent in dollars
  is_climate_controlled?: boolean;
}

// ─── Output: Calculated unit pricing ─────────────────────────────────────
// After calculation — each unit now carries its $/sqft.

export interface CalculatedUnitPrice {
  unit_size: string;           // "5x5"
  width_ft: number;            // 5
  depth_ft: number;            // 5
  sqft: number;                // 25
  monthly_price: number;       // 50.00
  price_per_sqft: number;      // 2.00
  is_climate_controlled: boolean;
}

// ─── Facility pricing breakdown ──────────────────────────────────────────
// Full pricing analysis for one facility address.

export interface FacilityPricingBreakdown {
  facility_id: string;
  units: CalculatedUnitPrice[];       // Sorted small → large
  unit_count: number;

  // Aggregate metrics
  avg_price_per_sqft: number | null;
  min_price_per_sqft: number | null;  // Usually the largest unit
  max_price_per_sqft: number | null;  // Usually the smallest unit
  weighted_avg_price_per_sqft: number | null; // Weighted by sqft

  // Total facility size (sum of all unit sqft * count, if known)
  total_sqft: number;                 // Sum of sqft across captured units

  // Curve check
  curve_is_normal: boolean;           // true if $/sqft decreases as size increases
  curve_anomalies: string[];          // Any inversions ("10x15 > 10x10")
}


// ═══════════════════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a unit size string like "5x5" or "10x20" into width and depth.
 */
export function parseUnitSize(size: string): { width: number; depth: number; sqft: number } | null {
  // Check standard sizes first
  const standard = STANDARD_UNITS[size as StandardUnitSize];
  if (standard) return { ...standard };

  // Parse freeform "WxD" pattern
  const match = size.toLowerCase().match(/(\d+)\s*[x×]\s*(\d+)/);
  if (!match) return null;

  const width = parseInt(match[1]);
  const depth = parseInt(match[2]);
  return { width, depth, sqft: width * depth };
}

/**
 * Calculate $/sqft for a single unit.
 *
 * Example: 5x5 @ $50/mo → 25 sqft → $2.00/sqft
 */
export function calculateUnitPricePerSqft(raw: RawUnitPrice): CalculatedUnitPrice | null {
  const parsed = parseUnitSize(raw.unit_size);
  if (!parsed) return null;

  return {
    unit_size: raw.unit_size,
    width_ft: parsed.width,
    depth_ft: parsed.depth,
    sqft: parsed.sqft,
    monthly_price: raw.monthly_price,
    price_per_sqft: raw.monthly_price / parsed.sqft,
    is_climate_controlled: raw.is_climate_controlled ?? false,
  };
}

/**
 * Calculate full pricing breakdown for a facility address.
 *
 * Takes all raw unit prices found at one address, calculates $/sqft
 * per unit, sorts small → large, checks if the pricing curve is normal
 * ($/sqft should decrease as unit size increases).
 */
export function calculateFacilityPricing(
  facilityId: string,
  rawPrices: RawUnitPrice[]
): FacilityPricingBreakdown {
  // Calculate per-unit pricing
  const units = rawPrices
    .map(calculateUnitPricePerSqft)
    .filter((u): u is CalculatedUnitPrice => u !== null)
    .sort((a, b) => a.sqft - b.sqft); // Small → Large

  if (units.length === 0) {
    return {
      facility_id: facilityId,
      units: [],
      unit_count: 0,
      avg_price_per_sqft: null,
      min_price_per_sqft: null,
      max_price_per_sqft: null,
      weighted_avg_price_per_sqft: null,
      total_sqft: 0,
      curve_is_normal: true,
      curve_anomalies: [],
    };
  }

  const prices = units.map(u => u.price_per_sqft);
  const totalSqft = units.reduce((sum, u) => sum + u.sqft, 0);

  // Simple average
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  // Weighted average: each unit's $/sqft weighted by its sqft
  const weightedSum = units.reduce((sum, u) => sum + (u.price_per_sqft * u.sqft), 0);
  const weightedAvg = weightedSum / totalSqft;

  // Check pricing curve: $/sqft should decrease as sqft increases
  const anomalies: string[] = [];
  for (let i = 1; i < units.length; i++) {
    if (units[i].price_per_sqft > units[i - 1].price_per_sqft) {
      anomalies.push(
        `${units[i].unit_size} ($${units[i].price_per_sqft.toFixed(2)}/sqft) > ` +
        `${units[i - 1].unit_size} ($${units[i - 1].price_per_sqft.toFixed(2)}/sqft)`
      );
    }
  }

  return {
    facility_id: facilityId,
    units,
    unit_count: units.length,
    avg_price_per_sqft: avg,
    min_price_per_sqft: Math.min(...prices),
    max_price_per_sqft: Math.max(...prices),
    weighted_avg_price_per_sqft: weightedAvg,
    total_sqft: totalSqft,
    curve_is_normal: anomalies.length === 0,
    curve_anomalies: anomalies,
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH LOG HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a facility pricing breakdown into research log records.
 *
 * Each unit size/price pair becomes its own evidence row in
 * facility_research_log. This is how you "don't recreate the wheel" —
 * next time you look up this address, you read from the log.
 */
export function toResearchLogRecords(
  facilityId: string,
  rawPrices: RawUnitPrice[],
  source: {
    url: string | null;
    domain: string | null;
    method: ResearchMethod;
    confidence: number;
  }
): Omit<FacilityResearchLogRecord, 'id' | 'created_at'>[] {
  const now = new Date().toISOString();
  const records: Omit<FacilityResearchLogRecord, 'id' | 'created_at'>[] = [];

  for (const raw of rawPrices) {
    const calc = calculateUnitPricePerSqft(raw);
    if (!calc) continue;

    // Log the raw monthly rent per unit size
    records.push({
      facility_id: facilityId,
      data_point: 'monthly_rent',
      value_raw: `$${raw.monthly_price}/mo`,
      value_parsed: raw.monthly_price,
      unit_size: raw.unit_size,
      source_url: source.url,
      source_domain: source.domain,
      method: source.method,
      confidence: source.confidence,
      captured_at: now,
      metadata: {
        sqft: calc.sqft,
        price_per_sqft: calc.price_per_sqft,
        is_climate_controlled: calc.is_climate_controlled,
      },
    });
  }

  // Also log the facility-level aggregates
  const breakdown = calculateFacilityPricing(facilityId, rawPrices);
  if (breakdown.avg_price_per_sqft !== null) {
    records.push({
      facility_id: facilityId,
      data_point: 'price_per_sqft',
      value_raw: `$${breakdown.weighted_avg_price_per_sqft?.toFixed(2)}/sqft (weighted avg)`,
      value_parsed: breakdown.weighted_avg_price_per_sqft,
      unit_size: null,
      source_url: source.url,
      source_domain: source.domain,
      method: source.method,
      confidence: source.confidence,
      captured_at: now,
      metadata: {
        avg_price_per_sqft: breakdown.avg_price_per_sqft,
        min_price_per_sqft: breakdown.min_price_per_sqft,
        max_price_per_sqft: breakdown.max_price_per_sqft,
        weighted_avg_price_per_sqft: breakdown.weighted_avg_price_per_sqft,
        unit_count: breakdown.unit_count,
        curve_is_normal: breakdown.curve_is_normal,
        curve_anomalies: breakdown.curve_anomalies,
      },
    });

    records.push({
      facility_id: facilityId,
      data_point: 'total_sqft',
      value_raw: `${breakdown.total_sqft} sqft`,
      value_parsed: breakdown.total_sqft,
      unit_size: null,
      source_url: source.url,
      source_domain: source.domain,
      method: source.method,
      confidence: source.confidence,
      captured_at: now,
      metadata: null,
    });
  }

  return records;
}
