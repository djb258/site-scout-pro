/**
 * GLOBAL CONFIGURATION LOADER
 *
 * TypeScript interface for loading and accessing global_config.yaml settings.
 * Used by Pass-1/Pass-2 orchestrators and spokes.
 *
 * Note: In browser/Cloudflare Workers environment, config is loaded at build time.
 * In Node.js environment, config can be loaded dynamically.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DoctrineConfig {
  STAMPED: boolean;
  SPVPET: boolean;
  STACKED: boolean;
  BARTON_DOCTRINE: boolean;
}

export interface HotspotWeights {
  population: number;
  competition: number;
  industrial: number;
  multifamily: number;
  recreation: number;
}

export interface TierThresholds {
  A: number;
  B: number;
  C: number;
  D: number;
}

export interface CompetitorGradeConfig {
  A: {
    brands: string[];
    min_sqft: number;
  };
  B: {
    min_sqft: number;
    max_sqft: number;
  };
  C: {
    max_sqft: number;
  };
}

export interface ValidationGateConfig {
  required_fields: string[];
  min_population: number;
  min_income: number;
  min_viability_score: number;
  min_competitors_for_pricing: number;
}

export interface Pass1HubConfig {
  enabled: boolean;
  spokes: string[];
  radius_builder: {
    default_radius_miles: number;
    min_radius_miles: number;
    max_radius_miles: number;
  };
  macro_demand: {
    sqft_per_capita: number;
    sqft_per_household: number;
  };
  macro_supply: {
    default_sqft_per_competitor: number;
    climate_controlled_multiplier: number;
  };
  hotspot_scoring: {
    weights: HotspotWeights;
    tier_thresholds: TierThresholds;
  };
  competitor_enrichment: {
    grades: CompetitorGradeConfig;
  };
  validation_gate: ValidationGateConfig;
}

export interface CivilParkingConfig {
  sqft_per_stall: number;
  ada_ratios: Record<string, number | string>;
  cost_per_ada_space: number;
}

export interface CivilLotCoverageConfig {
  default_max_pct: number;
  building_efficiency: number;
  parking_ratio: number;
  landscape_buffer_pct: number;
}

export interface CivilTopographyConfig {
  slope_bands: {
    ideal: number;
    manageable: number;
    challenging: number;
  };
  grading_cost_per_acre: number;
}

export interface CivilStormwaterConfig {
  runoff_coefficient: number;
  storm_intensity_inches: number;
  detention_factor: number;
  bmp_cost_per_acre: number;
}

export interface CivilBondingConfig {
  high_requirement_states: string[];
  high_bond_amount: number;
  medium_requirement_states: string[];
  medium_bond_amount: number;
  default_bond_amount: number;
}

export interface CivilConstraintsConfig {
  parking: CivilParkingConfig;
  lot_coverage: CivilLotCoverageConfig;
  topography: CivilTopographyConfig;
  stormwater: CivilStormwaterConfig;
  bonding: CivilBondingConfig;
}

export interface FeasibilityDefaults {
  metal_cost_sqft: number;
  concrete_cost_yard: number;
  finish_labor_cost: number;
  construction_cost_sqft: number;
  soft_cost_pct: number;
  cap_rate_target: number;
  expense_ratio: number;
  target_occupancy: number;
  ltv_ratio: number;
  debt_rate: number;
  building_efficiency: number;
  buildable_pct: number;
}

export interface UnitMixConfig {
  climate_control_pct: number;
  standard_pct: number;
  outdoor_pct: number;
}

export interface ViabilityConfig {
  min_cap_rate: number;
  min_roi_5yr: number;
  min_dscr: number;
}

export interface VerdictWeights {
  feasibility: number;
  fusion_demand: number;
  zoning: number;
  permits: number;
  civil: number;
}

export interface VerdictThresholds {
  proceed: number;
  evaluate: number;
  walk: number;
}

export interface VerdictConfig {
  weights: VerdictWeights;
  thresholds: VerdictThresholds;
  fatal_flaws: string[];
}

export interface Pass2HubConfig {
  enabled: boolean;
  spokes: string[];
  civil_constraints: CivilConstraintsConfig;
  feasibility: {
    defaults: FeasibilityDefaults;
    unit_mix: UnitMixConfig;
    viability: ViabilityConfig;
  };
  verdict: VerdictConfig;
}

export interface StateRule {
  default_county_difficulty: number;
  rent_multiplier: number;
  area_code: string;
}

export interface StatesConfig {
  supported: string[];
  rules: Record<string, StateRule>;
}

export interface DatabaseConfig {
  pool_min_size: number;
  pool_max_size: number;
  command_timeout: number;
  table_prefix: string;
  tables: {
    pass1_runs: string;
    pass2_runs: string;
    staging_payload: string;
    vault: string;
    engine_logs: string;
    jurisdiction_cards: string;
    rate_observations: string;
    rent_benchmarks: string;
  };
}

export interface RetellAgentConfig {
  name: string;
  voice_id: string;
  model: string;
  language: string;
  max_call_duration_seconds: number;
  silence_timeout_seconds: number;
  end_call_after_silence: boolean;
}

export interface RetellScriptConfig {
  greeting: string;
  unit_sizes: string[];
  questions: string[];
}

export interface RetellConfig {
  enabled: boolean;
  api_key: string;
  base_url: string;
  concurrency_limit: number;
  webhook_url: string;
  agent: RetellAgentConfig;
  script: RetellScriptConfig;
}

export interface GlobalConfig {
  doctrine: DoctrineConfig;
  pass1_hub: Pass1HubConfig;
  pass2_hub: Pass2HubConfig;
  states: StatesConfig;
  database: DatabaseConfig;
  retell: RetellConfig;
  // Legacy sections
  scoring: {
    weights: Record<string, number>;
  };
  saturation: {
    sqft_per_person: number;
    undersupplied_threshold: number;
    oversupplied_threshold: number;
    elimination_threshold: number;
  };
  elimination: {
    min_population: number;
    min_households: number;
    min_traffic_count: number;
    max_county_difficulty: number;
    min_final_score: number;
  };
}

// ============================================================================
// DEFAULT CONFIGURATION (Hardcoded for browser/Workers compatibility)
// ============================================================================

const DEFAULT_CONFIG: GlobalConfig = {
  doctrine: {
    STAMPED: true,
    SPVPET: true,
    STACKED: true,
    BARTON_DOCTRINE: true,
  },

  pass1_hub: {
    enabled: true,
    spokes: [
      'ZipHydration',
      'RadiusBuilder',
      'MacroDemand',
      'MacroSupply',
      'HotspotScoring',
      'LocalScan',
      'CallSheet',
      'CompetitorEnrichment',
      'ValidationGate',
    ],
    radius_builder: {
      default_radius_miles: 15,
      min_radius_miles: 5,
      max_radius_miles: 50,
    },
    macro_demand: {
      sqft_per_capita: 6,
      sqft_per_household: 15,
    },
    macro_supply: {
      default_sqft_per_competitor: 45000,
      climate_controlled_multiplier: 1.2,
    },
    hotspot_scoring: {
      weights: {
        population: 0.25,
        competition: 0.25,
        industrial: 0.20,
        multifamily: 0.15,
        recreation: 0.15,
      },
      tier_thresholds: {
        A: 80,
        B: 65,
        C: 50,
        D: 0,
      },
    },
    competitor_enrichment: {
      grades: {
        A: {
          brands: [
            'Public Storage',
            'Extra Space',
            'CubeSmart',
            'Life Storage',
            'U-Haul',
            'StorageMart',
          ],
          min_sqft: 75000,
        },
        B: {
          min_sqft: 25000,
          max_sqft: 75000,
        },
        C: {
          max_sqft: 25000,
        },
      },
    },
    validation_gate: {
      required_fields: [
        'zip',
        'city',
        'county',
        'state',
        'lat',
        'lng',
        'macro_demand',
        'macro_supply',
        'hotspot_score',
      ],
      min_population: 1000,
      min_income: 25000,
      min_viability_score: 20,
      min_competitors_for_pricing: 3,
    },
  },

  pass2_hub: {
    enabled: true,
    spokes: [
      'Zoning',
      'CivilConstraints',
      'Permits',
      'PricingVerification',
      'Momentum',
      'FusionDemand',
      'CompetitivePressure',
      'Feasibility',
      'ReverseFeasibility',
      'Verdict',
      'VaultMapper',
    ],
    civil_constraints: {
      parking: {
        sqft_per_stall: 180,
        ada_ratios: {
          '1_25': 1,
          '26_50': 2,
          '51_75': 3,
          '76_100': 4,
          '101_150': 5,
          '151_200': 6,
          '201_300': 7,
          '301_400': 8,
          '401_500': 9,
        },
        cost_per_ada_space: 2500,
      },
      lot_coverage: {
        default_max_pct: 50,
        building_efficiency: 0.40,
        parking_ratio: 0.25,
        landscape_buffer_pct: 0.10,
      },
      topography: {
        slope_bands: {
          ideal: 5,
          manageable: 10,
          challenging: 15,
        },
        grading_cost_per_acre: 5000,
      },
      stormwater: {
        runoff_coefficient: 0.85,
        storm_intensity_inches: 4,
        detention_factor: 1.5,
        bmp_cost_per_acre: 15000,
      },
      bonding: {
        high_requirement_states: ['TX', 'CA', 'FL'],
        high_bond_amount: 25000,
        medium_requirement_states: ['NY', 'IL'],
        medium_bond_amount: 35000,
        default_bond_amount: 20000,
      },
    },
    feasibility: {
      defaults: {
        metal_cost_sqft: 23,
        concrete_cost_yard: 150,
        finish_labor_cost: 2.50,
        construction_cost_sqft: 30,
        soft_cost_pct: 0.15,
        cap_rate_target: 0.065,
        expense_ratio: 0.35,
        target_occupancy: 0.88,
        ltv_ratio: 0.70,
        debt_rate: 0.07,
        building_efficiency: 0.85,
        buildable_pct: 0.40,
      },
      unit_mix: {
        climate_control_pct: 0.30,
        standard_pct: 0.50,
        outdoor_pct: 0.20,
      },
      viability: {
        min_cap_rate: 6.5,
        min_roi_5yr: 25,
        min_dscr: 1.25,
      },
    },
    verdict: {
      weights: {
        feasibility: 0.30,
        fusion_demand: 0.25,
        zoning: 0.15,
        permits: 0.15,
        civil: 0.15,
      },
      thresholds: {
        proceed: 75,
        evaluate: 50,
        walk: 0,
      },
      fatal_flaws: [
        'lot_coverage_infeasible',
        'zoning_prohibited',
        'prohibitive_topography',
        'negative_dscr',
      ],
    },
  },

  states: {
    supported: ['WV', 'PA', 'MD', 'VA', 'TX', 'FL', 'CA', 'NY', 'IL'],
    rules: {
      WV: { default_county_difficulty: 50, rent_multiplier: 1.0, area_code: '304' },
      PA: { default_county_difficulty: 45, rent_multiplier: 1.1, area_code: '717' },
      MD: { default_county_difficulty: 40, rent_multiplier: 1.2, area_code: '301' },
      VA: { default_county_difficulty: 50, rent_multiplier: 1.1, area_code: '540' },
      TX: { default_county_difficulty: 35, rent_multiplier: 1.0, area_code: '512' },
      FL: { default_county_difficulty: 40, rent_multiplier: 1.15, area_code: '407' },
      CA: { default_county_difficulty: 60, rent_multiplier: 1.5, area_code: '415' },
      NY: { default_county_difficulty: 55, rent_multiplier: 1.4, area_code: '212' },
      IL: { default_county_difficulty: 45, rent_multiplier: 1.2, area_code: '312' },
    },
  },

  database: {
    pool_min_size: 2,
    pool_max_size: 10,
    command_timeout: 60,
    table_prefix: '',
    tables: {
      pass1_runs: 'pass1_runs',
      pass2_runs: 'pass2_runs',
      staging_payload: 'staging_payload',
      vault: 'vault',
      engine_logs: 'engine_logs',
      jurisdiction_cards: 'jurisdiction_cards',
      rate_observations: 'rate_observations',
      rent_benchmarks: 'rent_benchmarks',
    },
  },

  retell: {
    enabled: true,
    api_key: '',
    base_url: 'https://api.retellai.com',
    concurrency_limit: 20,
    webhook_url: '',
    agent: {
      name: 'Storage Rate Collector',
      voice_id: 'eleven_labs_amy',
      model: 'gpt-4o-mini',
      language: 'en-US',
      max_call_duration_seconds: 180,
      silence_timeout_seconds: 10,
      end_call_after_silence: true,
    },
    script: {
      greeting: "Hi, I'm calling to inquire about storage unit rates at your facility.",
      unit_sizes: ['5x5', '5x10', '10x10', '10x15', '10x20', '10x30'],
      questions: [
        'What are your current rates for a {size} unit?',
        'Do you have any move-in specials or promotions?',
        'Is climate control available?',
        'What is the admin fee?',
      ],
    },
  },

  scoring: {
    weights: {
      saturation: 0.25,
      parcel: 0.25,
      county: 0.20,
      financial: 0.30,
    },
  },

  saturation: {
    sqft_per_person: 6,
    undersupplied_threshold: 0.7,
    oversupplied_threshold: 1.1,
    elimination_threshold: 1.1,
  },

  elimination: {
    min_population: 5000,
    min_households: 2000,
    min_traffic_count: 5000,
    max_county_difficulty: 50,
    min_final_score: 60,
  },
};

// ============================================================================
// CONFIG SINGLETON
// ============================================================================

let _config: GlobalConfig = DEFAULT_CONFIG;

/**
 * Get the global configuration.
 * Returns the default config (can be overridden with setConfig).
 */
export function getConfig(): GlobalConfig {
  return _config;
}

/**
 * Override the global configuration.
 * Useful for testing or loading from external source.
 */
export function setConfig(config: Partial<GlobalConfig>): void {
  _config = { ...DEFAULT_CONFIG, ...config };
}

/**
 * Reset to default configuration.
 */
export function resetConfig(): void {
  _config = DEFAULT_CONFIG;
}

// ============================================================================
// CONVENIENCE GETTERS
// ============================================================================

export function getPass1Config(): Pass1HubConfig {
  return _config.pass1_hub;
}

export function getPass2Config(): Pass2HubConfig {
  return _config.pass2_hub;
}

export function getValidationGateConfig(): ValidationGateConfig {
  return _config.pass1_hub.validation_gate;
}

export function getCivilConstraintsConfig(): CivilConstraintsConfig {
  return _config.pass2_hub.civil_constraints;
}

export function getFeasibilityDefaults(): FeasibilityDefaults {
  return _config.pass2_hub.feasibility.defaults;
}

export function getVerdictConfig(): VerdictConfig {
  return _config.pass2_hub.verdict;
}

export function getStateRule(state: string): StateRule | undefined {
  return _config.states.rules[state];
}

export function isStateSupported(state: string): boolean {
  return _config.states.supported.includes(state);
}

export function getTableName(table: keyof DatabaseConfig['tables']): string {
  return _config.database.tables[table];
}

export function getHotspotWeights(): HotspotWeights {
  return _config.pass1_hub.hotspot_scoring.weights;
}

export function getTierThresholds(): TierThresholds {
  return _config.pass1_hub.hotspot_scoring.tier_thresholds;
}

export function getCompetitorGradeConfig(): CompetitorGradeConfig {
  return _config.pass1_hub.competitor_enrichment.grades;
}

/**
 * Get bonding amount for a state.
 */
export function getBondingAmount(state: string): number {
  const bonding = _config.pass2_hub.civil_constraints.bonding;

  if (bonding.high_requirement_states.includes(state)) {
    return bonding.high_bond_amount;
  }
  if (bonding.medium_requirement_states.includes(state)) {
    return bonding.medium_bond_amount;
  }
  return bonding.default_bond_amount;
}

/**
 * Check if a flaw is fatal (triggers auto-WALK).
 */
export function isFatalFlaw(flaw: string): boolean {
  return _config.pass2_hub.verdict.fatal_flaws.includes(flaw);
}

// Export default config for reference
export { DEFAULT_CONFIG };
