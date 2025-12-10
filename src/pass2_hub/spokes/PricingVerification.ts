/**
 * PRICING VERIFICATION SPOKE
 *
 * Responsibility: Verify and consolidate pricing data, build rent curve model
 *
 * Inputs:
 *   - ai_caller_pricing: AiCallerPricing[] (from Pass 1 local scan)
 *   - competitors: LocalCompetitor[] (with any existing rates)
 *
 * Outputs:
 *   - PricingVerificationResult with verified market rates
 *   - RentCurveModel for projections
 *
 * Data Sources:
 *   - Lovable.DB: rate_observations, market_rate_benchmarks scratchpad tables
 *   - AI Caller results
 *   - Competitor rate data from Pass 1
 */

import type {
  RentBenchmarks,
  RentCurveModel,
  AiCallerPricing,
  LocalCompetitor,
  OpportunityObject,
} from '../../shared/OpportunityObject';
import type { PricingVerificationResult } from '../types/pass2_types';
import { createStubPricing, createErrorResult } from '../types/pass2_types';
import { queryData, writeLog } from '../../shared/adapters/LovableAdapter';

export interface PricingVerificationInput {
  ai_caller_pricing?: AiCallerPricing[];
  competitors?: LocalCompetitor[];
  county_fips?: string;
  state: string;
}

export interface PricingVerificationOutput {
  success: boolean;
  rent_benchmarks: RentBenchmarks | null;
  rent_curve_model: RentCurveModel | null;
  data_quality: {
    total_observations: number;
    ai_caller_count: number;
    manual_count: number;
    confidence: 'high' | 'medium' | 'low';
  };
  error?: string;
}

/**
 * Rate observation record from scratchpad
 */
interface RateObservationRecord {
  facility_id: string;
  facility_name: string;
  county_fips?: string;
  state: string;
  unit_size: string;
  rate: number;
  climate_control: boolean;
  observation_date: string;
  source: 'ai_caller' | 'sparefoot' | 'manual' | 'competitor';
}

/**
 * Market benchmark record
 */
interface MarketBenchmarkRecord {
  county_fips: string;
  state: string;
  standard_10x10: number;
  climate_10x10: number;
  outdoor_10x20: number;
  avg_psf: number;
  market_position: 'premium' | 'competitive' | 'discount';
  last_updated: string;
}

// ============================================================================
// PRICING CALCULATION LOGIC
// ============================================================================

/**
 * Industry standard size multipliers relative to 10x10 base
 */
const SIZE_MULTIPLIERS: Record<string, number> = {
  '5x5': 1.4,    // 25 sqft - premium per sqft due to small size
  '5x10': 1.2,   // 50 sqft
  '10x10': 1.0,  // 100 sqft - baseline
  '10x15': 0.95, // 150 sqft
  '10x20': 0.9,  // 200 sqft
  '10x30': 0.85, // 300 sqft - volume discount
};

/**
 * Calculate blended rent from multiple rates
 * Weighted average favoring standard unit types
 */
function calculateBlendedRent(
  standard10x10: number,
  climate10x10: number,
  outdoor10x20: number
): number {
  // Typical unit mix: 50% standard, 30% climate, 20% outdoor/large
  const blended = (standard10x10 * 0.50) + (climate10x10 * 0.30) + (outdoor10x20 * 0.50 * 0.20);
  return Math.round(blended);
}

/**
 * Normalize rate to 10x10 equivalent
 */
function normalizeToTenByTen(rate: number, unitSize: string): number {
  const multiplier = SIZE_MULTIPLIERS[unitSize] || 1.0;
  return Math.round(rate / multiplier);
}

/**
 * Calculate average PSF (price per square foot)
 */
function calculateAvgPsf(rates: { size: string; rate: number }[]): number {
  if (rates.length === 0) return 1.25; // Default

  const psfValues = rates.map(r => {
    const sqft = parseSizeToSqft(r.size);
    return r.rate / sqft;
  });

  const avgPsf = psfValues.reduce((a, b) => a + b, 0) / psfValues.length;
  return Math.round(avgPsf * 100) / 100;
}

/**
 * Parse unit size string to square footage
 */
function parseSizeToSqft(size: string): number {
  const match = size.match(/(\d+)x(\d+)/);
  if (match) {
    return parseInt(match[1]) * parseInt(match[2]);
  }
  return 100; // Default to 10x10
}

/**
 * Determine market position from rates
 */
function determineMarketPosition(
  standard10x10: number,
  state: string
): PricingVerificationResult['marketPosition'] {
  // State-level benchmarks for 10x10 standard
  const benchmarks: Record<string, { premium: number; discount: number }> = {
    CA: { premium: 200, discount: 120 },
    NY: { premium: 220, discount: 140 },
    TX: { premium: 140, discount: 90 },
    FL: { premium: 160, discount: 100 },
    VA: { premium: 150, discount: 100 },
    // Default for other states
    DEFAULT: { premium: 150, discount: 95 },
  };

  const benchmark = benchmarks[state] || benchmarks.DEFAULT;

  if (standard10x10 >= benchmark.premium) return 'premium';
  if (standard10x10 <= benchmark.discount) return 'discount';
  return 'competitive';
}

/**
 * Determine confidence level based on data quality
 */
function determineConfidence(
  totalObservations: number,
  aiCallerCount: number,
  hasBenchmarkData: boolean
): PricingVerificationResult['confidence'] {
  // High confidence: 10+ observations with AI caller data
  if (totalObservations >= 10 && aiCallerCount >= 3) return 'high';

  // Medium confidence: 5+ observations or benchmark data
  if (totalObservations >= 5 || (hasBenchmarkData && totalObservations >= 2)) return 'medium';

  // Low confidence: limited data
  return 'low';
}

/**
 * Calculate climate control premium percentage
 */
function calculateClimatePremium(standard10x10: number, climate10x10: number): number {
  if (standard10x10 <= 0) return 48; // Default 48% premium
  return Math.round(((climate10x10 - standard10x10) / standard10x10) * 100);
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Run pricing verification (New Pass-2 Shell Interface)
 *
 * @param opportunity - OpportunityObject with identity and pass1 data
 * @returns PricingVerificationResult with status, rents, and confidence
 */
export async function runPricingShell(opportunity: OpportunityObject): Promise<PricingVerificationResult> {
  console.log(`[PRICING_SPOKE] Running pricing verification for ${opportunity.identity.county}, ${opportunity.identity.state}`);

  try {
    const state = opportunity.identity.state;
    const countyFips = opportunity.identity.county_fips;

    // Aggregate rate observations
    let climate10x10Rates: number[] = [];
    let standard10x10Rates: number[] = [];
    let outdoor10x20Rates: number[] = [];
    let allRates: { size: string; rate: number }[] = [];

    let aiCallerCount = 0;
    let competitorCount = 0;

    // 1. Process AI caller pricing from opportunity
    if (opportunity.ai_caller_pricing && opportunity.ai_caller_pricing.length > 0) {
      for (const pricing of opportunity.ai_caller_pricing) {
        aiCallerCount++;
        for (const rate of pricing.rates_collected) {
          allRates.push({ size: rate.unit_size, rate: rate.advertised_rate });

          if (rate.unit_size === '10x10') {
            if (rate.climate_control) {
              climate10x10Rates.push(rate.advertised_rate);
            } else {
              standard10x10Rates.push(rate.advertised_rate);
            }
          } else if (rate.unit_size === '10x20' && !rate.climate_control) {
            outdoor10x20Rates.push(rate.advertised_rate);
          }
        }
      }
    }

    // 2. Process competitor rates from local scan
    if (opportunity.local_scan?.local_competitors) {
      for (const comp of opportunity.local_scan.local_competitors) {
        if (comp.rates) {
          competitorCount++;
          if (comp.rates['10x10']) {
            standard10x10Rates.push(comp.rates['10x10']);
            allRates.push({ size: '10x10', rate: comp.rates['10x10'] });
          }
          if (comp.rates['10x20']) {
            outdoor10x20Rates.push(comp.rates['10x20']);
            allRates.push({ size: '10x20', rate: comp.rates['10x20'] });
          }
        }
      }
    }

    // 3. Query rate_observations scratchpad for additional data
    if (countyFips) {
      const rateRecords = await queryData<RateObservationRecord>('rate_observations', {
        county_fips: countyFips,
      });

      if (rateRecords && rateRecords.length > 0) {
        for (const record of rateRecords) {
          allRates.push({ size: record.unit_size, rate: record.rate });

          if (record.unit_size === '10x10') {
            if (record.climate_control) {
              climate10x10Rates.push(record.rate);
            } else {
              standard10x10Rates.push(record.rate);
            }
          } else if (record.unit_size === '10x20' && !record.climate_control) {
            outdoor10x20Rates.push(record.rate);
          }
        }
      }
    }

    // 4. Query market benchmarks as fallback
    let hasBenchmarkData = false;
    if (countyFips) {
      const benchmarks = await queryData<MarketBenchmarkRecord>('market_rate_benchmarks', {
        county_fips: countyFips,
      });

      if (benchmarks && benchmarks.length > 0) {
        hasBenchmarkData = true;
        const benchmark = benchmarks[0];

        // Use benchmarks if we have insufficient direct observations
        if (standard10x10Rates.length === 0) {
          standard10x10Rates.push(benchmark.standard_10x10);
        }
        if (climate10x10Rates.length === 0) {
          climate10x10Rates.push(benchmark.climate_10x10);
        }
        if (outdoor10x20Rates.length === 0) {
          outdoor10x20Rates.push(benchmark.outdoor_10x20);
        }
      }
    }

    // 5. Calculate final rates (average of observations or defaults)
    const standard10x10 = standard10x10Rates.length > 0
      ? Math.round(standard10x10Rates.reduce((a, b) => a + b, 0) / standard10x10Rates.length)
      : 125; // Default

    const climate10x10 = climate10x10Rates.length > 0
      ? Math.round(climate10x10Rates.reduce((a, b) => a + b, 0) / climate10x10Rates.length)
      : Math.round(standard10x10 * 1.48); // Default 48% premium

    const outdoor10x20 = outdoor10x20Rates.length > 0
      ? Math.round(outdoor10x20Rates.reduce((a, b) => a + b, 0) / outdoor10x20Rates.length)
      : Math.round(standard10x10 * 0.9 * 2); // 10x20 = ~2x 10x10 with discount

    const totalObservations = allRates.length;
    const blendedRent = calculateBlendedRent(standard10x10, climate10x10, outdoor10x20);
    const avgPsf = calculateAvgPsf(allRates);
    const marketPosition = determineMarketPosition(standard10x10, state);
    const confidence = determineConfidence(totalObservations, aiCallerCount, hasBenchmarkData);
    const climatePremiumPct = calculateClimatePremium(standard10x10, climate10x10);

    // Build data sources list
    const dataSources: string[] = [];
    if (aiCallerCount > 0) dataSources.push('ai_caller');
    if (competitorCount > 0) dataSources.push('competitor_rates');
    if (hasBenchmarkData) dataSources.push('market_benchmarks');
    if (dataSources.length === 0) dataSources.push('defaults');

    await writeLog('pricing_verification_complete', {
      county: opportunity.identity.county,
      state,
      standard_10x10: standard10x10,
      climate_10x10: climate10x10,
      total_observations: totalObservations,
      confidence,
      data_sources: dataSources,
    });

    const result: PricingVerificationResult = {
      status: 'ok',
      blendedRent,
      climateControl10x10: climate10x10,
      standard10x10,
      outdoor10x20,
      avgPsf,
      marketPosition,
      rentCurve: {
        baseRate10x10: standard10x10,
        sizeMultipliers: SIZE_MULTIPLIERS,
        climatePremiumPct,
        projectedAnnualIncreasePct: 3.5, // Industry standard assumption
      },
      dataSources,
      confidence,
      notes: `Pricing verification for ${opportunity.identity.county}, ${state}. Based on ${totalObservations} observations. 10x10 Std: $${standard10x10}, CC: $${climate10x10}. Confidence: ${confidence}.`,
    };

    console.log(`[PRICING_SPOKE] Result: 10x10=$${result.standard10x10}, CC=$${result.climateControl10x10}, confidence=${result.confidence}`);
    return result;
  } catch (error) {
    console.error('[PRICING_SPOKE] Error:', error);
    return createErrorResult(
      error instanceof Error ? error : 'Unknown pricing error',
      createStubPricing
    );
  }
}

/**
 * Run pricing verification and build rent curve (Legacy Interface)
 */
export async function runPricingVerification(
  input: PricingVerificationInput
): Promise<PricingVerificationOutput> {
  console.log(`[PRICING] Verifying pricing for ${input.state}`);

  const aiCallerCount = input.ai_caller_pricing?.length || 0;
  const competitorCount = input.competitors?.filter((c) => c.pricing_verified).length || 0;

  // Aggregate pricing data
  let climate10x10 = 0;
  let standard10x10 = 0;
  let outdoor10x20 = 0;
  let observations = 0;

  // Process AI caller results
  if (input.ai_caller_pricing) {
    for (const pricing of input.ai_caller_pricing) {
      for (const rate of pricing.rates_collected) {
        observations++;
        if (rate.unit_size === '10x10' && rate.climate_control) {
          climate10x10 = climate10x10 ? (climate10x10 + rate.advertised_rate) / 2 : rate.advertised_rate;
        } else if (rate.unit_size === '10x10' && !rate.climate_control) {
          standard10x10 = standard10x10 ? (standard10x10 + rate.advertised_rate) / 2 : rate.advertised_rate;
        } else if (rate.unit_size === '10x20' && !rate.climate_control) {
          outdoor10x20 = outdoor10x20 ? (outdoor10x20 + rate.advertised_rate) / 2 : rate.advertised_rate;
        }
      }
    }
  }

  // Process competitor rates
  if (input.competitors) {
    for (const comp of input.competitors) {
      if (comp.rates) {
        if (comp.rates['10x10']) {
          observations++;
          standard10x10 = standard10x10 ? (standard10x10 + comp.rates['10x10']) / 2 : comp.rates['10x10'];
        }
        if (comp.rates['10x20']) {
          observations++;
          outdoor10x20 = outdoor10x20 ? (outdoor10x20 + comp.rates['10x20']) / 2 : comp.rates['10x20'];
        }
      }
    }
  }

  // Use defaults if no data
  if (!climate10x10) climate10x10 = 185;
  if (!standard10x10) standard10x10 = 125;
  if (!outdoor10x20) outdoor10x20 = 95;

  // Calculate average PSF
  const avgPsf = (climate10x10 / 100 + standard10x10 / 100 + outdoor10x20 / 200) / 3;

  // Determine market position
  let marketPosition: RentBenchmarks['market_position'] = 'competitive';
  if (climate10x10 > 200 || standard10x10 > 150) marketPosition = 'premium';
  else if (climate10x10 < 150 || standard10x10 < 100) marketPosition = 'discount';

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (observations >= 10) confidence = 'high';
  else if (observations >= 5) confidence = 'medium';

  const rent_benchmarks: RentBenchmarks = {
    climate_control_10x10: Math.round(climate10x10),
    standard_10x10: Math.round(standard10x10),
    outdoor_10x20: Math.round(outdoor10x20),
    market_position: marketPosition,
    avg_psf: Math.round(avgPsf * 100) / 100,
    data_sources: aiCallerCount > 0 ? ['ai_caller', 'competitor_rates'] : ['competitor_rates'],
    confidence,
  };

  // Build rent curve model
  const rent_curve_model: RentCurveModel = {
    base_rate_10x10: standard10x10,
    size_multipliers: SIZE_MULTIPLIERS,
    climate_premium_pct: climate10x10 > 0 && standard10x10 > 0
      ? Math.round(((climate10x10 - standard10x10) / standard10x10) * 100)
      : 48, // Default 48% climate premium
    projected_annual_increase_pct: 3.5,
  };

  return {
    success: true,
    rent_benchmarks,
    rent_curve_model,
    data_quality: {
      total_observations: observations,
      ai_caller_count: aiCallerCount,
      manual_count: competitorCount,
      confidence,
    },
  };
}

/**
 * Check if pricing data is sufficient for feasibility analysis
 */
export function checkPricingExists(
  rent_benchmarks: RentBenchmarks | null
): { exists: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!rent_benchmarks) {
    return { exists: false, missing: ['All pricing data'] };
  }

  if (!rent_benchmarks.standard_10x10) missing.push('Standard 10x10 rate');
  if (!rent_benchmarks.climate_control_10x10) missing.push('Climate 10x10 rate');
  if (rent_benchmarks.confidence === 'low') missing.push('Sufficient rate observations');

  return {
    exists: missing.length === 0,
    missing,
  };
}

// Re-export types for convenience
export type { PricingVerificationResult };
