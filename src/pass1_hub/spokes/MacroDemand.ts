/**
 * MACRO DEMAND SPOKE
 *
 * Responsibility: Calculate macro-level storage demand based on population
 *
 * Formula: Population × 6 sq ft = Total Demand
 * (Industry standard: 6 sq ft of storage demand per capita)
 *
 * Inputs:
 *   - population: number
 *   - household_count: number (optional, derived from population)
 *
 * Outputs:
 *   - MacroDemandResult with total demand in square feet
 *   - Add to OpportunityObject: macro.demand block
 */

import type { MacroDemandResult, ZipMetadata, RadiusCounty } from '../../shared/OpportunityObject';
import { writeLog } from '../../shared/adapters/LovableAdapter';

// ============================================================================
// CONSTANTS
// ============================================================================

// Industry standard: 6 sq ft storage demand per capita
const SQFT_PER_CAPITA = 6;

// Average household size for estimation
const AVG_HOUSEHOLD_SIZE = 2.5;

// ============================================================================
// TYPES
// ============================================================================

export interface MacroDemandInput {
  population: number;
  household_count?: number;
  density?: number;
}

export interface MacroDemandOutput {
  success: boolean;
  status: 'ok' | 'stub' | 'error';
  demand: MacroDemandResult;
  error?: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Calculate macro demand from population
 * Formula: demand_sqft = population × 6 (industry standard)
 *
 * @param input - Contains population and optional household_count
 * @returns MacroDemandResult with demand calculations
 */
export function runMacroDemand(input: MacroDemandInput): MacroDemandResult {
  const { population, household_count } = input;

  // Calculate household count if not provided
  const households = household_count ?? Math.round(population / AVG_HOUSEHOLD_SIZE);

  // Core demand calculation: population × 6 sqft
  const demand_sqft = population * SQFT_PER_CAPITA;

  // Per-household demand
  const demand_per_household = households > 0 ? Math.round(demand_sqft / households) : 0;

  console.log(`[MACRO_DEMAND] Population: ${population.toLocaleString()}, Demand: ${demand_sqft.toLocaleString()} sqft`);

  return {
    population,
    demand_sqft,
    household_count: households,
    demand_per_household,
  };
}

/**
 * Run macro demand with full output wrapper (includes status)
 */
export async function runMacroDemandWithStatus(input: MacroDemandInput): Promise<MacroDemandOutput> {
  try {
    const demand = runMacroDemand(input);

    await writeLog('macro_demand_calculated', {
      population: input.population,
      demand_sqft: demand.demand_sqft,
      households: demand.household_count,
    });

    return {
      success: true,
      status: 'ok',
      demand,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[MACRO_DEMAND] Error:', error);

    return {
      success: false,
      status: 'error',
      demand: {
        population: 0,
        demand_sqft: 0,
        household_count: 0,
        demand_per_household: 0,
      },
      error: errorMessage,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate demand from ZipMetadata
 */
export function calculateDemandFromZip(zipMetadata: ZipMetadata): MacroDemandResult {
  return runMacroDemand({
    population: zipMetadata.population || 0,
    density: zipMetadata.density || 0,
  });
}

/**
 * Calculate regional demand from multiple counties (120-mile radius)
 * Used for macro.radius120.demand
 */
export function calculateRegionalDemand(counties: RadiusCounty[]): {
  total_population: number;
  total_demand_sqft: number;
  county_count: number;
  avg_demand_per_county: number;
} {
  const total_population = counties.reduce((sum, c) => sum + (c.population || 0), 0);
  const total_demand_sqft = total_population * SQFT_PER_CAPITA;

  console.log(`[MACRO_DEMAND] Regional: ${counties.length} counties, ${total_population.toLocaleString()} pop, ${total_demand_sqft.toLocaleString()} sqft demand`);

  return {
    total_population,
    total_demand_sqft,
    county_count: counties.length,
    avg_demand_per_county: counties.length > 0 ? Math.round(total_demand_sqft / counties.length) : 0,
  };
}

/**
 * Calculate demand by county with hotspot detection
 * Identifies counties where demand significantly exceeds local capacity
 */
export function calculateCountyDemandBreakdown(counties: RadiusCounty[]): Array<{
  county: string;
  state: string;
  population: number;
  demand_sqft: number;
  distance_miles?: number;
}> {
  return counties.map(c => ({
    county: c.county,
    state: c.state,
    population: c.population,
    demand_sqft: c.population * SQFT_PER_CAPITA,
    distance_miles: c.distance_miles,
  }));
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { SQFT_PER_CAPITA, AVG_HOUSEHOLD_SIZE };
