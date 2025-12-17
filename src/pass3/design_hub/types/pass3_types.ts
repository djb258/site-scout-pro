/**
 * PASS-3 TYPE DEFINITIONS
 *
 * Type definitions for Pass-3 Design/Calculator Hub (SS.03.00)
 * Pro forma modeling and financial analysis.
 *
 * All types are JSON-serializable for edge/cloud function execution.
 */

// ============================================================================
// STATUS ENUM
// ============================================================================

export type SpokeStatus = 'stub' | 'ok' | 'error';

// ============================================================================
// SETBACK ENGINE RESULT (SS.03.01)
// ============================================================================

export interface SetbackEngineResult {
  status: SpokeStatus;
  parcelId?: string;
  totalParcelSqft?: number;
  buildableSqft?: number;
  setbackSqft?: number;
  buildablePercentage?: number;
  setbacksApplied?: {
    front: number;
    rear: number;
    side: number;
    corner: number;
  };
  parcelDimensions?: {
    width: number;
    depth: number;
    frontage: number;
    shape: 'rectangular' | 'irregular' | 'flag_lot';
  };
  geometrySource?: 'parcel_api' | 'acreage_estimate';
  warnings?: string[];
  notes: string;
}

// ============================================================================
// COVERAGE ENGINE RESULT (SS.03.02)
// ============================================================================

export type ConstructionType = 'single_story' | 'multi_story' | 'drive_up_only';

export interface CoverageEngineResult {
  status: SpokeStatus;
  maxFootprintSqft?: number;
  totalBuildableSqft?: number;
  netRentableSqft?: number;
  constructionType?: ConstructionType;
  storiesBuilt?: number;
  lotCoverageUsed?: number;             // percentage
  efficiencyFactor?: number;
  parkingRequired?: {
    spaces: number;
    sqft: number;
  };
  warnings?: string[];
  notes: string;
}

// ============================================================================
// UNIT MIX OPTIMIZER RESULT (SS.03.03)
// ============================================================================

export interface UnitAllocation {
  size: string;                         // e.g., '10x10'
  sqft: number;
  count: number;
  climateControlledCount: number;
  nonClimateCount: number;
  monthlyRate: number;
  climateRate: number;
  rentPerSqft: number;
  percentOfMix: number;
}

export interface UnitMixOptimizerResult {
  status: SpokeStatus;
  units?: UnitAllocation[];
  totalUnits?: number;
  totalSqft?: number;
  climateControlledSqft?: number;
  projectedGPR?: number;                // Monthly Gross Potential Revenue
  avgRentPerSqft?: number;
  revenueBySize?: Record<string, number>;
  optimizationScore?: number;           // 0-100
  notes: string;
}

// ============================================================================
// PHASE PLANNER RESULT (SS.03.04)
// ============================================================================

export interface PhasePlan {
  phase: number;
  units: number;
  sqft: number;
  constructionStart: number;            // months from project start
  constructionEnd: number;
  stabilizationTarget: number;          // months from project start
  occupancyTrigger: number;             // 0.85 = 85%
  estimatedCost: number;
}

export interface PhasePlannerResult {
  status: SpokeStatus;
  phases?: PhasePlan[];
  totalPhases?: number;
  phase1Timeline?: {
    constructionMonths: number;
    stabilizationMonths: number;
    totalToStabilization: number;
  };
  totalProjectTimeline?: number;        // months
  stabilizationOccupancy?: number;
  absorptionAssumption?: number;        // units/month
  warnings?: string[];
  notes: string;
}

// ============================================================================
// BUILD COST MODEL RESULT (SS.03.05)
// ============================================================================

export interface BuildCostModelResult {
  status: SpokeStatus;
  hardCosts?: {
    building: number;
    climatePremium: number;
    paving: number;
    utilities: number;
    sitework: number;
    total: number;
    perSqft: number;
  };
  dirtWork?: {
    grading: number;
    excavation: number;
    demolition: number;
    other: number;
    total: number;
    percentOfProject: number;
  };
  softCosts?: {
    permits: number;
    architectural: number;
    engineering: number;
    legal: number;
    total: number;
    perSqft: number;
  };
  contingency?: {
    amount: number;
    percentage: number;
  };
  totals?: {
    subtotal: number;
    contingency: number;
    totalProjectCost: number;
    costPerSqft: number;
  };
  phaseCosts?: { phase: number; cost: number }[];
  regionalFactor?: number;
  passesDoctrineMaximum?: boolean;      // <= $27/sqft
  passesDirtWorkLimit?: boolean;        // <= 20%
  fatalFlaws?: FatalFlaw[];
  warnings?: string[];
  notes: string;
}

// ============================================================================
// NOI ENGINE RESULT (SS.03.06)
// ============================================================================

export interface YearlyProjection {
  year: number;
  gpr: number;
  vacancy: number;
  egi: number;
  opex: number;
  noi: number;
}

export interface NOIEngineResult {
  status: SpokeStatus;
  revenue?: {
    grossPotentialRent: number;
    monthlyGPR: number;
    vacancyLoss: number;
    collectionLoss: number;
    effectiveGrossIncome: number;
  };
  expenses?: {
    operatingExpenses: number;
    managementFee: number;
    totalOpex: number;
    opexRatio: number;
  };
  noi?: {
    annual: number;
    monthly: number;
    perAcre: number;
    perAcreMonthly: number;
  };
  stressed?: {
    noi: number;
    perAcreMonthly: number;
    haircut: number;
  };
  metrics?: {
    impliedCapRate: number;
    revenuePerUnit: number;
    opexPerUnit: number;
  };
  fiveYearProjection?: YearlyProjection[];
  meetsDoctrineMinimum?: boolean;       // >= $5,000/acre/month
  survivesStressTest?: boolean;
  fatalFlaws?: FatalFlaw[];
  warnings?: string[];
  notes: string;
}

// ============================================================================
// DEBT MODEL RESULT (SS.03.07)
// ============================================================================

export interface DebtModelResult {
  status: SpokeStatus;
  loanAmount?: number;
  ltv?: number;
  interestRate?: number;
  termYears?: number;
  amortizationYears?: number;
  annualDebtService?: number;
  monthlyPayment?: number;
  dscr?: number;
  debtYield?: number;
  passesDSCR?: boolean;                 // >= 1.25
  passesDebtYield?: boolean;
  warnings?: string[];
  notes: string;
}

// ============================================================================
// MAX LAND PRICE RESULT (SS.03.08)
// ============================================================================

export interface MaxLandPriceResult {
  status: SpokeStatus;
  maxLandPrice?: number;
  maxPricePerAcre?: number;
  breakEvenOccupancy?: number;
  impliedValue?: number;
  estimatedBuildCost?: number;
  sensitivity?: {
    rentIncrease10Pct: number;
    rentDecrease10Pct: number;
    capRate6Pct: number;
    capRate8Pct: number;
  };
  viabilityAssessment?: 'strong' | 'moderate' | 'marginal' | 'weak';
  notes: string;
}

// ============================================================================
// IRR MODEL RESULT (SS.03.09)
// ============================================================================

export interface IRRModelResult {
  status: SpokeStatus;
  leveredIRR?: number;
  unleveredIRR?: number;
  cashOnCash?: {
    year1: number;
    year3: number;
    year5: number;
    stabilized: number;
  };
  equityMultiple?: number;
  totalEquityRequired?: number;
  totalDistributions?: number;
  paybackPeriodMonths?: number;
  exitAssumptions?: {
    exitCapRate: number;
    exitYear: number;
    projectedSalePrice: number;
  };
  sensitivityAnalysis?: {
    optimistic: { irr: number; equity_multiple: number };
    base: { irr: number; equity_multiple: number };
    pessimistic: { irr: number; equity_multiple: number };
  };
  notes: string;
}

// ============================================================================
// FATAL FLAW
// ============================================================================

export interface FatalFlaw {
  code: string;
  severity: 'critical' | 'warning';
  message: string;
  recommendation?: string;
}

// ============================================================================
// PASS-3 INPUT
// ============================================================================

export interface Pass3Input {
  zipCode: string;
  state: string;
  acreage: number;
  underwritingPackage: {
    verdict: 'GO' | 'MAYBE';
    dealIndex: number;
    noiPerAcreMonthly: number;
    feasibilityScore: number;
  };
  rateEvidence: {
    avg10x10: number;
    avg10x20: number;
    avgRatePerSqft: number;
    climateControlledPremium: number;
  };
  siteConditions: {
    slope: number;
    soilType: 'standard' | 'rock' | 'fill_required';
    demolitionRequired: boolean;
    utilitiesOnSite: boolean;
  };
  zoningConstraints: {
    maxLotCoverage: number;
    maxBuildingHeight: number;
    maxStories: number;
    setbacks: {
      front: number;
      rear: number;
      side: number;
    };
  };
}

// ============================================================================
// PASS-3 OUTPUT (Complete Result Object)
// ============================================================================

export interface Pass3Output {
  success: boolean;
  runId?: string;
  timestamp: number;
  zipCode: string;
  state: string;
  setbackEngine: SetbackEngineResult;
  coverageEngine: CoverageEngineResult;
  unitMixOptimizer: UnitMixOptimizerResult;
  phasePlanner: PhasePlannerResult;
  buildCostModel: BuildCostModelResult;
  noiEngine: NOIEngineResult;
  debtModel: DebtModelResult;
  maxLandPrice: MaxLandPriceResult;
  irrModel: IRRModelResult;
  fatalFlaws: FatalFlaw[];
  error?: string;
}

// ============================================================================
// PRO FORMA PACKAGE (Final Export Object)
// ============================================================================

export interface ProFormaPackage {
  zipCode: string;
  state: string;
  acreage: number;
  generatedAt: string;

  // Physical
  buildableSqft: number;
  netRentableSqft: number;
  totalUnits: number;
  constructionType: ConstructionType;
  phases: number;

  // Financial
  totalProjectCost: number;
  costPerSqft: number;
  projectedNOI: number;
  noiPerAcreMonthly: number;
  capRate: number;
  dscr: number;
  leveredIRR: number;
  unleveredIRR: number;
  maxLandPrice: number;

  // Doctrine Compliance
  passesDoctrineMinimum: boolean;
  passesBuildCostMax: boolean;
  passesDirtWorkLimit: boolean;
  passesDSCR: boolean;

  // Verdict
  recommendation: 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'RECONSIDER';
  fatalFlaws: FatalFlaw[];
  warnings: string[];
}

// ============================================================================
// FACTORY FUNCTIONS FOR STUB RESULTS
// ============================================================================

export function createStubSetbackEngine(): SetbackEngineResult {
  return {
    status: 'stub',
    notes: 'Setback engine not implemented. TODO: Calculate buildable area.',
  };
}

export function createStubCoverageEngine(): CoverageEngineResult {
  return {
    status: 'stub',
    notes: 'Coverage engine not implemented. TODO: Calculate lot coverage.',
  };
}

export function createStubUnitMixOptimizer(): UnitMixOptimizerResult {
  return {
    status: 'stub',
    notes: 'Unit mix optimizer not implemented. TODO: Implement optimization.',
  };
}

export function createStubPhasePlanner(): PhasePlannerResult {
  return {
    status: 'stub',
    notes: 'Phase planner not implemented. TODO: Plan construction phases.',
  };
}

export function createStubBuildCostModel(): BuildCostModelResult {
  return {
    status: 'stub',
    notes: 'Build cost model not implemented. TODO: Calculate construction costs.',
  };
}

export function createStubNOIEngine(): NOIEngineResult {
  return {
    status: 'stub',
    notes: 'NOI engine not implemented. TODO: Calculate income projections.',
  };
}

export function createStubDebtModel(): DebtModelResult {
  return {
    status: 'stub',
    notes: 'Debt model not implemented. TODO: Calculate debt service.',
  };
}

export function createStubMaxLandPrice(): MaxLandPriceResult {
  return {
    status: 'stub',
    notes: 'Max land price not implemented. TODO: Calculate max supportable price.',
  };
}

export function createStubIRRModel(): IRRModelResult {
  return {
    status: 'stub',
    notes: 'IRR model not implemented. TODO: Calculate investment returns.',
  };
}

export function createErrorResult<T extends { status: SpokeStatus; notes: string }>(
  error: Error | string,
  factory: () => T
): T {
  const result = factory();
  result.status = 'error';
  result.notes = `Error: ${error instanceof Error ? error.message : error}`;
  return result;
}
