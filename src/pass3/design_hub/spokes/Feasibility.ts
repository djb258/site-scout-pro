// =============================================================================
// FEASIBILITY SPOKE — Pass-3 Core Financial Engine
// =============================================================================
// Doctrine ID: SS.03.07
// Purpose: Calculate project feasibility with Barton Doctrine enforcement
//
// DOCTRINAL NOTE: Financial modeling belongs in Pass 3 (Capital Truth Hub).
// Pass 2 is constraint-only eligibility. This is the AUTHORITATIVE MATH SPINE.
//
// All calculations are deterministic, auditable, and replayable.
// No heuristics, no ML, no randomness.
//
// Same inputs → Same outputs (always)
// =============================================================================

// Import types from Pass 2 for compatibility (shared constraint types)
import type {
  PricingVerificationResult,
  CivilConstraintResult,
} from '../../../pass2/underwriting_hub/types/pass2_types';

// =============================================================================
// FEASIBILITY INPUT — Shared interface for Pass 3
// =============================================================================

export interface FeasibilityInput {
  opportunity: unknown; // Pass-through object
  rentBenchmarks: PricingVerificationResult;
  acreage: number;
  landCostPerAcre: number;
  civilConstraints?: CivilConstraintResult;
}

// =============================================================================
// NAMED CONSTANTS — All numeric assumptions must be named
// =============================================================================

/** Barton Doctrine: Minimum NOI per acre per month */
const DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY = 5000;

/** Barton Doctrine: Minimum stressed NOI per acre per month (after 25% haircut) */
const DOCTRINE_MIN_STRESSED_NOI_PER_ACRE_MONTHLY = 3750;

/** Barton Doctrine: Minimum DSCR ratio */
const DOCTRINE_MIN_DSCR = 1.25;

/** Default vacancy rate (10%) */
const DEFAULT_VACANCY_RATE = 0.10;

/** Default collection loss rate (2%) */
const DEFAULT_COLLECTION_LOSS_RATE = 0.02;

/** Default operating expense ratio (32%) */
const DEFAULT_OPEX_RATIO = 0.32;

/** Stress test haircut (25% reduction to NOI) */
const STRESS_TEST_HAIRCUT = 0.25;

/** Default interest rate for debt service calculation */
const DEFAULT_INTEREST_RATE = 0.06;

/** Default loan amortization in years */
const DEFAULT_AMORTIZATION_YEARS = 25;

/** Default loan-to-value ratio */
const DEFAULT_LTV = 0.70;

/** Default cap rate for yield calculation */
const DEFAULT_CAP_RATE = 0.07;

/** Months per year (named for clarity in calculations) */
const MONTHS_PER_YEAR = 12;

/** Default rent per sqft per month if not provided */
const DEFAULT_RENT_PSF_MONTHLY = 1.00;

/** Default buildable sqft per acre (conservative) */
const DEFAULT_BUILDABLE_SQFT_PER_ACRE = 25000;

/** Default construction cost per sqft */
const DEFAULT_CONSTRUCTION_COST_PSF = 85;

// =============================================================================
// FATAL FLAW CODES
// =============================================================================

export type FeasibilityFatalFlawCode =
  | 'NOI_BELOW_DOCTRINE'
  | 'STRESSED_NOI_FAILURE'
  | 'NEGATIVE_NOI'
  | 'ZERO_ACREAGE'
  | 'ZERO_REVENUE'
  | 'INVALID_INPUT';

export type FeasibilityWarningCode =
  | 'DSCR_BELOW_THRESHOLD'
  | 'LOW_YIELD_ON_COST'
  | 'HIGH_OPEX_RATIO'
  | 'MISSING_RENT_DATA'
  | 'ESTIMATED_VALUES_USED';

// =============================================================================
// OUTPUT INTERFACE — Fully typed result object
// =============================================================================

export interface FeasibilityFatalFlaw {
  code: FeasibilityFatalFlawCode;
  severity: 'critical';
  message: string;
  threshold?: number;
  actual?: number;
}

export interface FeasibilityWarning {
  code: FeasibilityWarningCode;
  severity: 'warning';
  message: string;
  threshold?: number;
  actual?: number;
}

export interface FeasibilityOutput {
  // Spoke metadata — Updated to SS.03.07 for Pass 3
  spokeId: 'SS.03.07';
  status: 'ok' | 'error';
  timestamp: string;

  // Input echo (for audit)
  inputs: {
    acreage: number;
    rentPsfMonthly: number;
    buildableSqft: number;
    landCostPerAcre: number;
    constructionCostPsf: number;
    vacancyRate: number;
    collectionLossRate: number;
    opexRatio: number;
    interestRate: number;
    amortizationYears: number;
    ltv: number;
  };

  // Revenue calculations
  gross_monthly_revenue: number;
  gross_annual_revenue: number;
  effective_gross_income: number;

  // Expense calculations
  operating_expenses: number;
  opex_ratio_actual: number;

  // NOI calculations
  noi_annual: number;
  noi_monthly: number;
  noi_per_acre_annual: number;
  noi_per_acre_per_month: number;

  // Stressed NOI (25% haircut)
  stressed_noi_annual: number;
  stressed_noi_per_acre_per_month: number;

  // Development costs
  total_land_cost: number;
  total_construction_cost: number;
  total_development_cost: number;

  // Debt service
  loan_amount: number;
  annual_debt_service: number;
  dscr: number;

  // Returns
  yield_on_cost: number;
  implied_value: number;
  cap_rate: number;

  // Doctrine compliance
  passes_doctrine_noi: boolean;
  passes_stress_test: boolean;
  passes_dscr: boolean;
  pass_fail: boolean;

  // Fatal flaws and warnings
  fatal_flaws: FeasibilityFatalFlaw[];
  warnings: FeasibilityWarning[];

  // Human-readable notes
  notes: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate annual debt service using standard mortgage formula
 * P = L[c(1 + c)^n]/[(1 + c)^n - 1]
 * where L = loan amount, c = monthly rate, n = number of payments
 */
function calculateAnnualDebtService(
  loanAmount: number,
  annualInterestRate: number,
  amortizationYears: number
): number {
  if (loanAmount <= 0) return 0;
  if (annualInterestRate <= 0) return loanAmount / amortizationYears;

  const monthlyRate = annualInterestRate / MONTHS_PER_YEAR;
  const numPayments = amortizationYears * MONTHS_PER_YEAR;

  const numerator = monthlyRate * Math.pow(1 + monthlyRate, numPayments);
  const denominator = Math.pow(1 + monthlyRate, numPayments) - 1;

  const monthlyPayment = loanAmount * (numerator / denominator);
  return monthlyPayment * MONTHS_PER_YEAR;
}

/**
 * Extract rent PSF from pricing verification result
 * Falls back to default if not available
 */
function extractRentPsf(rentBenchmarks: PricingVerificationResult | undefined): number {
  if (!rentBenchmarks) return DEFAULT_RENT_PSF_MONTHLY;
  if (rentBenchmarks.avgPsf && rentBenchmarks.avgPsf > 0) return rentBenchmarks.avgPsf;
  if (rentBenchmarks.blendedRent && rentBenchmarks.blendedRent > 0) {
    // Assume blendedRent is monthly rent for a 100sqft unit (10x10)
    return rentBenchmarks.blendedRent / 100;
  }
  return DEFAULT_RENT_PSF_MONTHLY;
}

/**
 * Calculate buildable sqft from acreage, accounting for civil constraints
 */
function calculateBuildableSqft(
  acreage: number,
  civilConstraints: CivilConstraintResult | undefined
): number {
  if (civilConstraints?.lotCoverage?.maxBuildableSqft > 0) {
    return civilConstraints.lotCoverage.maxBuildableSqft;
  }
  // Default: assume 25,000 sqft rentable per acre
  return acreage * DEFAULT_BUILDABLE_SQFT_PER_ACRE;
}

// =============================================================================
// MAIN FEASIBILITY FUNCTION
// =============================================================================

export async function runFeasibility(input: FeasibilityInput): Promise<FeasibilityOutput> {
  const timestamp = new Date().toISOString();
  const fatalFlaws: FeasibilityFatalFlaw[] = [];
  const warnings: FeasibilityWarning[] = [];

  // ---------------------------------------------------------------------------
  // STEP 1: Extract and validate inputs
  // ---------------------------------------------------------------------------

  const acreage = input.acreage ?? 0;
  const landCostPerAcre = input.landCostPerAcre ?? 0;
  const rentPsfMonthly = extractRentPsf(input.rentBenchmarks);
  const buildableSqft = calculateBuildableSqft(acreage, input.civilConstraints);

  // Get civil cost adder if available
  const civilCostAdder = input.civilConstraints?.totalCivilCostAdder ?? 0;

  // Use defaults for financial assumptions
  const vacancyRate = DEFAULT_VACANCY_RATE;
  const collectionLossRate = DEFAULT_COLLECTION_LOSS_RATE;
  const opexRatio = DEFAULT_OPEX_RATIO;
  const interestRate = DEFAULT_INTEREST_RATE;
  const amortizationYears = DEFAULT_AMORTIZATION_YEARS;
  const ltv = DEFAULT_LTV;
  const constructionCostPsf = DEFAULT_CONSTRUCTION_COST_PSF;

  // Track if we're using estimated values
  let usingEstimates = false;
  if (!input.rentBenchmarks?.avgPsf) {
    usingEstimates = true;
    warnings.push({
      code: 'MISSING_RENT_DATA',
      severity: 'warning',
      message: `No rent PSF provided, using default $${DEFAULT_RENT_PSF_MONTHLY.toFixed(2)}/sqft/month`,
    });
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Validate critical inputs
  // ---------------------------------------------------------------------------

  if (acreage <= 0) {
    fatalFlaws.push({
      code: 'ZERO_ACREAGE',
      severity: 'critical',
      message: 'Acreage is zero or negative - cannot calculate feasibility',
      actual: acreage,
    });
  }

  if (buildableSqft <= 0) {
    fatalFlaws.push({
      code: 'INVALID_INPUT',
      severity: 'critical',
      message: 'Buildable sqft is zero or negative',
      actual: buildableSqft,
    });
  }

  // If critical inputs missing, return early with error
  if (acreage <= 0 || buildableSqft <= 0) {
    return {
      spokeId: 'SS.03.07',
      status: 'error',
      timestamp,
      inputs: {
        acreage,
        rentPsfMonthly,
        buildableSqft,
        landCostPerAcre,
        constructionCostPsf,
        vacancyRate,
        collectionLossRate,
        opexRatio,
        interestRate,
        amortizationYears,
        ltv,
      },
      gross_monthly_revenue: 0,
      gross_annual_revenue: 0,
      effective_gross_income: 0,
      operating_expenses: 0,
      opex_ratio_actual: 0,
      noi_annual: 0,
      noi_monthly: 0,
      noi_per_acre_annual: 0,
      noi_per_acre_per_month: 0,
      stressed_noi_annual: 0,
      stressed_noi_per_acre_per_month: 0,
      total_land_cost: 0,
      total_construction_cost: 0,
      total_development_cost: 0,
      loan_amount: 0,
      annual_debt_service: 0,
      dscr: 0,
      yield_on_cost: 0,
      implied_value: 0,
      cap_rate: 0,
      passes_doctrine_noi: false,
      passes_stress_test: false,
      passes_dscr: false,
      pass_fail: false,
      fatal_flaws: fatalFlaws,
      warnings,
      notes: 'Feasibility calculation failed due to invalid inputs',
    };
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Revenue calculations
  // ---------------------------------------------------------------------------

  // Gross Monthly Revenue = Buildable Sqft × Rent PSF
  const gross_monthly_revenue = buildableSqft * rentPsfMonthly;

  // Gross Annual Revenue = Monthly × 12
  const gross_annual_revenue = gross_monthly_revenue * MONTHS_PER_YEAR;

  // Effective Gross Income = Gross × (1 - vacancy) × (1 - collection loss)
  const occupancyFactor = 1 - vacancyRate;
  const collectionFactor = 1 - collectionLossRate;
  const effective_gross_income = gross_annual_revenue * occupancyFactor * collectionFactor;

  if (gross_annual_revenue <= 0) {
    fatalFlaws.push({
      code: 'ZERO_REVENUE',
      severity: 'critical',
      message: 'Gross annual revenue is zero - cannot proceed',
      actual: gross_annual_revenue,
    });
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Operating expenses
  // ---------------------------------------------------------------------------

  const operating_expenses = effective_gross_income * opexRatio;
  const opex_ratio_actual = effective_gross_income > 0
    ? operating_expenses / effective_gross_income
    : 0;

  if (opexRatio > 0.40) {
    warnings.push({
      code: 'HIGH_OPEX_RATIO',
      severity: 'warning',
      message: `Operating expense ratio of ${(opexRatio * 100).toFixed(1)}% is above typical 35%`,
      threshold: 0.35,
      actual: opexRatio,
    });
  }

  // ---------------------------------------------------------------------------
  // STEP 5: NOI calculations
  // ---------------------------------------------------------------------------

  const noi_annual = effective_gross_income - operating_expenses;
  const noi_monthly = noi_annual / MONTHS_PER_YEAR;
  const noi_per_acre_annual = noi_annual / acreage;
  const noi_per_acre_per_month = noi_per_acre_annual / MONTHS_PER_YEAR;

  // Check for negative NOI (fatal)
  if (noi_annual < 0) {
    fatalFlaws.push({
      code: 'NEGATIVE_NOI',
      severity: 'critical',
      message: `Negative NOI of $${noi_annual.toLocaleString()} - site is not viable`,
      actual: noi_annual,
    });
  }

  // ---------------------------------------------------------------------------
  // STEP 6: Stressed NOI (25% haircut)
  // ---------------------------------------------------------------------------

  const stressed_noi_annual = noi_annual * (1 - STRESS_TEST_HAIRCUT);
  const stressed_noi_per_acre_per_month = (stressed_noi_annual / acreage) / MONTHS_PER_YEAR;

  // ---------------------------------------------------------------------------
  // STEP 7: Development costs
  // ---------------------------------------------------------------------------

  const total_land_cost = acreage * landCostPerAcre;
  const total_construction_cost = (buildableSqft * constructionCostPsf) + civilCostAdder;
  const total_development_cost = total_land_cost + total_construction_cost;

  // ---------------------------------------------------------------------------
  // STEP 8: Debt service calculations
  // ---------------------------------------------------------------------------

  const loan_amount = total_development_cost * ltv;
  const annual_debt_service = calculateAnnualDebtService(
    loan_amount,
    interestRate,
    amortizationYears
  );

  // DSCR = NOI / Annual Debt Service
  const dscr = annual_debt_service > 0 ? noi_annual / annual_debt_service : 0;

  // ---------------------------------------------------------------------------
  // STEP 9: Returns calculations
  // ---------------------------------------------------------------------------

  // Yield on Cost = NOI / Total Development Cost
  const yield_on_cost = total_development_cost > 0
    ? noi_annual / total_development_cost
    : 0;

  // Implied Value = NOI / Cap Rate
  const implied_value = noi_annual / DEFAULT_CAP_RATE;

  // Actual Cap Rate based on development cost
  const cap_rate = total_development_cost > 0
    ? noi_annual / total_development_cost
    : 0;

  if (yield_on_cost < 0.08) {
    warnings.push({
      code: 'LOW_YIELD_ON_COST',
      severity: 'warning',
      message: `Yield on cost of ${(yield_on_cost * 100).toFixed(2)}% is below typical 8% target`,
      threshold: 0.08,
      actual: yield_on_cost,
    });
  }

  // ---------------------------------------------------------------------------
  // STEP 10: Barton Doctrine enforcement
  // ---------------------------------------------------------------------------

  // Doctrine Rule 1: NOI per acre per month >= $5,000
  const passes_doctrine_noi = noi_per_acre_per_month >= DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY;
  if (!passes_doctrine_noi && noi_annual >= 0) {
    fatalFlaws.push({
      code: 'NOI_BELOW_DOCTRINE',
      severity: 'critical',
      message: `NOI of $${noi_per_acre_per_month.toLocaleString(undefined, { maximumFractionDigits: 0 })}/acre/month is below $${DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY.toLocaleString()} minimum`,
      threshold: DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY,
      actual: noi_per_acre_per_month,
    });
  }

  // Doctrine Rule 2: Stressed NOI >= $3,750/acre/month
  const passes_stress_test = stressed_noi_per_acre_per_month >= DOCTRINE_MIN_STRESSED_NOI_PER_ACRE_MONTHLY;
  if (!passes_stress_test && noi_annual >= 0) {
    fatalFlaws.push({
      code: 'STRESSED_NOI_FAILURE',
      severity: 'critical',
      message: `Stressed NOI of $${stressed_noi_per_acre_per_month.toLocaleString(undefined, { maximumFractionDigits: 0 })}/acre/month fails debt survivability test (min $${DOCTRINE_MIN_STRESSED_NOI_PER_ACRE_MONTHLY.toLocaleString()})`,
      threshold: DOCTRINE_MIN_STRESSED_NOI_PER_ACRE_MONTHLY,
      actual: stressed_noi_per_acre_per_month,
    });
  }

  // Doctrine Rule 3: DSCR >= 1.25 (warning only, not fatal)
  const passes_dscr = dscr >= DOCTRINE_MIN_DSCR;
  if (!passes_dscr && dscr > 0) {
    warnings.push({
      code: 'DSCR_BELOW_THRESHOLD',
      severity: 'warning',
      message: `DSCR of ${dscr.toFixed(2)}x is below ${DOCTRINE_MIN_DSCR}x threshold`,
      threshold: DOCTRINE_MIN_DSCR,
      actual: dscr,
    });
  }

  // Add estimated values warning if applicable
  if (usingEstimates) {
    warnings.push({
      code: 'ESTIMATED_VALUES_USED',
      severity: 'warning',
      message: 'Some calculations used estimated/default values - verify with actual data',
    });
  }

  // ---------------------------------------------------------------------------
  // STEP 11: Final pass/fail determination
  // ---------------------------------------------------------------------------

  // Pass/Fail: No fatal flaws
  const pass_fail = fatalFlaws.length === 0;

  // Build notes summary
  const notesParts: string[] = [];
  notesParts.push(`Feasibility analysis for ${acreage.toFixed(2)} acres`);
  notesParts.push(`NOI: $${noi_annual.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year ($${noi_per_acre_per_month.toLocaleString(undefined, { maximumFractionDigits: 0 })}/acre/month)`);
  notesParts.push(`DSCR: ${dscr.toFixed(2)}x`);
  if (pass_fail) {
    notesParts.push('RESULT: PASSES Barton Doctrine');
  } else {
    notesParts.push(`RESULT: FAILS - ${fatalFlaws.length} fatal flaw(s)`);
  }

  // ---------------------------------------------------------------------------
  // STEP 12: Return complete result
  // ---------------------------------------------------------------------------

  return {
    spokeId: 'SS.03.07',
    status: fatalFlaws.some(f => f.code === 'ZERO_ACREAGE' || f.code === 'INVALID_INPUT') ? 'error' : 'ok',
    timestamp,
    inputs: {
      acreage,
      rentPsfMonthly,
      buildableSqft,
      landCostPerAcre,
      constructionCostPsf,
      vacancyRate,
      collectionLossRate,
      opexRatio,
      interestRate,
      amortizationYears,
      ltv,
    },
    gross_monthly_revenue,
    gross_annual_revenue,
    effective_gross_income,
    operating_expenses,
    opex_ratio_actual,
    noi_annual,
    noi_monthly,
    noi_per_acre_annual,
    noi_per_acre_per_month,
    stressed_noi_annual,
    stressed_noi_per_acre_per_month,
    total_land_cost,
    total_construction_cost,
    total_development_cost,
    loan_amount,
    annual_debt_service,
    dscr,
    yield_on_cost,
    implied_value,
    cap_rate,
    passes_doctrine_noi,
    passes_stress_test,
    passes_dscr,
    pass_fail,
    fatal_flaws: fatalFlaws,
    warnings,
    notes: notesParts.join('. '),
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY,
  DOCTRINE_MIN_STRESSED_NOI_PER_ACRE_MONTHLY,
  DOCTRINE_MIN_DSCR,
  DEFAULT_VACANCY_RATE,
  DEFAULT_COLLECTION_LOSS_RATE,
  DEFAULT_OPEX_RATIO,
  DEFAULT_INTEREST_RATE,
  DEFAULT_AMORTIZATION_YEARS,
  DEFAULT_LTV,
  STRESS_TEST_HAIRCUT,
};
