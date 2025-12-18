# PRD — Pass-2 Underwriting Hub

> ⚠️ **DEPRECATED** — This document is superseded by the new Pass 2 architecture.
>
> **DO NOT USE FOR NEW DEVELOPMENT**
>
> | Superseded By | Purpose |
> |---------------|---------|
> | `PRD_PASS2_JURISDICTION_CARD.md` | Product requirements for jurisdiction cards |
> | `PRS_PASS2_CONSTRAINT_COMPILER.md` | Execution spec for constraint compiler |
> | `SYSTEM_PROMPT_PASS2.md` | Definitive process lock |
>
> **Why deprecated:** This PRD describes Pass 2 as a financial underwriting engine.
> Per ADR-019, ADR-020, and the new doctrine, Pass 2 is a **Constraint Compiler**
> that performs NO financial calculations. All NOI, DSCR, IRR logic belongs in Pass 3.
>
> **Effective Date:** 2025-12-18
> **Doctrine Reference:** ADR-019, ADR-020, SYSTEM_PROMPT_PASS2.md

---

## 1. Overview

- **System Name:** Storage Site Scout (Barton Storage Application)
- **Hub Name:** PASS2_UNDERWRITING_HUB
- **Official Name:** PASS 2 — UNDERWRITING HUB
- **Owner:** Barton Enterprises
- **Version:** 1.1.0
- **Doctrine ID:** SS.02.00

---

## 2. Purpose

The Pass-2 Underwriting Hub performs site-specific underwriting and feasibility analysis. It receives validated rate evidence from Pass-1.5 and produces a comprehensive underwriting package with financial feasibility metrics and the final GO/NO_GO/MAYBE verdict.

**Boundary:** This hub owns all underwriting, feasibility calculations, and verdict decisions. It does NOT own reconnaissance (Pass-1), rate verification (Pass-1.5), or detailed pro forma modeling (Pass-3).

**Input:** Validated OpportunityObject from Pass-1 + Rate Evidence from Pass-1.5
**Output:** Underwriting verdict (GO/NO_GO/MAYBE) + STAMPED vault record

---

## 3. Pipeline Walkthrough

When Pass-2 executes, here is exactly what happens:

### Step 1: Orchestrator Initialization
```typescript
Pass2Orchestrator.run({
  opportunityObject: OpportunityObject,  // From Pass-1
  rateEvidence: RateEvidencePackage,     // From Pass-1.5
  parcelId?: string                       // Optional specific parcel
})
```
The orchestrator receives Pass-1 and Pass-1.5 outputs, initializes logging with `[PASS2_UNDERWRITING_HUB]` prefix, creates a new `pass2_runs` record in Supabase, and begins sequential spoke execution.

---

### Step 2: Zoning Spoke (SS.02.01)
**Purpose:** Fetch zoning code and verify storage is permitted by-right

**Tools Called:** `zoning_api`, `regrid`

```typescript
// Regrid API - Parcel and Zoning Lookup
GET https://app.regrid.com/api/v1/parcel
  ?lat=32.5234
  &lng=-97.2891
  &token=YOUR_API_KEY

// Response Shape
{
  parcel: {
    parcel_id: "48251-001-0234",
    owner: "Smith Family Trust",
    address: "1234 Industrial Blvd",
    acreage: 2.45,
    lot_sqft: 106722,
    zoning: {
      code: "I-1",
      description: "Light Industrial",
      jurisdiction: "City of Burleson"
    }
  }
}

// Zoning Classification
function classifyStoragePermission(zoningCode: string): StoragePermission {
  const byRightZones = ['I-1', 'I-2', 'M-1', 'M-2', 'C-2', 'C-3', 'B-2', 'B-3'];
  const conditionalZones = ['C-1', 'A-1', 'AG', 'PD'];
  const prohibitedZones = ['R-1', 'R-2', 'R-3', 'SF', 'MF'];

  if (byRightZones.includes(zoningCode)) return 'by_right';
  if (conditionalZones.includes(zoningCode)) return 'conditional';
  if (prohibitedZones.includes(zoningCode)) return 'prohibited';
  return 'unknown';
}
```

**Output Contract:**
```typescript
interface ZoningOutput {
  parcelId: string;
  zoningCode: string;
  zoningDescription: string;
  jurisdiction: string;
  storagePermitted: 'by_right' | 'conditional' | 'prohibited' | 'unknown';
  setbacks: {
    front: number;
    rear: number;
    side: number;
  };
  maxHeight: number;
  maxCoverage: number;
  lotSize: number;
  acreage: number;
  zoningScore: number;  // 0-100
  fatalFlaw: FatalFlaw | null;
}
```

**Fatal Flaw Check:**
```typescript
if (zoningResult.storagePermitted === 'prohibited') {
  return {
    fatalFlaw: {
      code: 'ZONING_PROHIBITED',
      severity: 'critical',
      message: 'Storage not permitted in this zoning district',
      recommendation: 'WALK - Zoning does not allow storage use'
    }
  };
}
```

**Failure Handling:**
- `ZONING_NOT_FOUND`: Use county defaults, flag for manual review
- `ZONING_PROHIBITED`: Flag as WALK, no auto-repair (Barton Doctrine: Zoning Sovereignty)

---

### Step 3: CivilConstraints Spoke (SS.02.02)
**Purpose:** Check flood zone, wetlands, slope, soil type, and utilities availability

**Tools Called:** `civil_calculator`, `fema_api`, `usgs_dem`

```typescript
// FEMA Flood Zone API
GET https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query
  ?geometry=-97.2891,32.5234
  &geometryType=esriGeometryPoint
  &returnGeometry=false
  &outFields=FLD_ZONE,ZONE_SUBTY

// Response Shape
{
  features: [{
    attributes: {
      FLD_ZONE: "X",          // X = minimal flood hazard
      ZONE_SUBTY: "0.2 PCT"   // 0.2% annual chance
    }
  }]
}

// USGS Elevation Service for slope
GET https://epqs.nationalmap.gov/v1/json
  ?x=-97.2891
  &y=32.5234
  &units=Feet
  &output=json

// Soil Type (USDA Web Soil Survey)
GET https://SDMDataAccess.sc.egov.usda.gov/Tabular/SDMTabularService.asmx
  // Returns soil classification

// Civil constraints assessment
function assessCivilConstraints(parcelGeometry): CivilConstraintsOutput {
  const floodZone = fetchFloodZone(parcelGeometry);
  const elevation = fetchElevation(parcelGeometry);
  const slope = calculateSlope(elevation);
  const soil = fetchSoilType(parcelGeometry);

  // Fatal flaw checks
  const fatalFlaws = [];

  if (['A', 'AE', 'AO', 'V', 'VE'].includes(floodZone)) {
    fatalFlaws.push({
      code: 'FLOOD_ZONE_HIGH_RISK',
      severity: 'critical',
      message: `Site is in FEMA Flood Zone ${floodZone}`
    });
  }

  if (slope > 15) {
    fatalFlaws.push({
      code: 'PROHIBITIVE_TOPOGRAPHY',
      severity: 'critical',
      message: `Slope of ${slope}% exceeds 15% maximum`
    });
  }

  return {
    floodZone: floodZone,
    floodRisk: classifyFloodRisk(floodZone),
    slope: slope,
    soilType: soil.classification,
    soilBearing: soil.bearingCapacity,
    utilitiesAvailable: {
      electric: checkUtility('electric', parcelGeometry),
      water: checkUtility('water', parcelGeometry),
      sewer: checkUtility('sewer', parcelGeometry)
    },
    civilScore: calculateCivilScore(...),
    fatalFlaws: fatalFlaws
  };
}
```

**Output Contract:**
```typescript
interface CivilConstraintsOutput {
  floodZone: string;
  floodRisk: 'minimal' | 'moderate' | 'high' | 'severe';
  wetlandsPresent: boolean;
  slope: number;              // percentage
  soilType: string;
  soilBearing: 'good' | 'fair' | 'poor';
  utilitiesAvailable: {
    electric: boolean;
    water: boolean;
    sewer: boolean;
  };
  estimatedGradingCost: number;
  civilScore: number;         // 0-100
  fatalFlaws: FatalFlaw[];
}
```

**Fatal Flaw Triggers:**
- `FLOOD_ZONE_HIGH_RISK`: Zone A, AE, V, VE → WALK
- `PROHIBITIVE_TOPOGRAPHY`: Slope > 15% → WALK
- `UTILITIES_UNAVAILABLE`: Warning, estimate connection costs

---

### Step 4: PermitsStatic Spoke (SS.02.03)
**Purpose:** Research permit history and jurisdiction difficulty

**Tools Called:** `permit_db`, `buildzoom`

```typescript
// BuildZoom API for permit history
GET https://api.buildzoom.com/permits
  ?address=1234+Industrial+Blvd+Burleson+TX
  &radius=0.5

// Response Shape
{
  permits: [
    {
      permit_number: "2023-BP-1234",
      type: "Commercial New Construction",
      status: "Finaled",
      issued_date: "2023-03-15",
      final_date: "2023-09-20",
      value: 1200000,
      days_to_issue: 45,
      days_to_final: 189
    }
  ],
  jurisdiction: {
    name: "City of Burleson",
    avg_permit_time: 52,
    difficulty_rating: "moderate"
  }
}

// Assess permit environment
function assessPermitEnvironment(location): PermitsStaticOutput {
  const recentPermits = fetchRecentPermits(location, '2 years');
  const jurisdiction = fetchJurisdictionData(location);

  return {
    recentPermitCount: recentPermits.length,
    avgPermitTimeDays: jurisdiction.avg_permit_time,
    jurisdictionDifficulty: jurisdiction.difficulty_rating,
    storageSpecificPermits: recentPermits.filter(p =>
      p.type.includes('storage') || p.type.includes('warehouse')
    ),
    estimatedPermitTimeline: calculateTimeline(jurisdiction),
    permitScore: calculatePermitScore(jurisdiction)
  };
}
```

**Output Contract:**
```typescript
interface PermitsStaticOutput {
  recentPermitCount: number;
  avgPermitTimeDays: number;
  jurisdictionDifficulty: 'easy' | 'moderate' | 'difficult' | 'very_difficult';
  storageSpecificPermits: Permit[];
  estimatedPermitTimeline: number;  // days
  permitFees: number;               // estimated
  permitScore: number;              // 0-100
  warnings: string[];
}
```

**Failure Handling:**
- `PERMIT_DATA_UNAVAILABLE`: Use county defaults

---

### Step 5: PricingVerification Spoke (SS.02.04)
**Purpose:** Verify rates from Pass-1.5 and calculate market positioning

**Tools Called:** `rent_benchmarks`

```typescript
// Receive rate evidence from Pass-1.5
function verifyPricing(
  rateEvidence: RateEvidencePackage,
  opportunityObject: OpportunityObject
): PricingVerificationOutput {

  const marketRates = rateEvidence.normalizedRates;
  const benchmarks = rateEvidence.marketBenchmarks;

  // Verify data quality
  const dataQualityCheck = {
    hasMinimumDataPoints: marketRates.totalDataPoints >= 10,
    hasKeyUnitSizes: ['10x10', '10x20'].every(
      size => marketRates.bySize[size]?.nonClimate?.count > 0
    ),
    confidenceLevel: rateEvidence.confidenceLevel
  };

  // Calculate rent assumptions for feasibility
  const rentAssumptions = {
    avg10x10: marketRates.bySize['10x10']?.nonClimate?.median || 95,
    avg10x20: marketRates.bySize['10x20']?.nonClimate?.median || 155,
    climatePremium: calculateClimatePremium(marketRates),
    avgRentPerSqft: calculateAvgRentPerSqft(marketRates),
    marketPosition: benchmarks.marketPosition
  };

  return {
    dataQuality: dataQualityCheck,
    rentAssumptions: rentAssumptions,
    rateConfidence: rateEvidence.confidenceLevel,
    competitorRateRange: {
      min: findMinRate(marketRates),
      max: findMaxRate(marketRates),
      spread: findMaxRate(marketRates) - findMinRate(marketRates)
    },
    pricingScore: calculatePricingScore(rentAssumptions, dataQualityCheck)
  };
}
```

**Output Contract:**
```typescript
interface PricingVerificationOutput {
  dataQuality: {
    hasMinimumDataPoints: boolean;
    hasKeyUnitSizes: boolean;
    confidenceLevel: 'high' | 'medium' | 'low';
  };
  rentAssumptions: {
    avg10x10: number;
    avg10x20: number;
    climatePremium: number;       // % premium for climate units
    avgRentPerSqft: number;
    marketPosition: string;
  };
  rateConfidence: string;
  competitorRateRange: {
    min: number;
    max: number;
    spread: number;
  };
  pricingScore: number;           // 0-100
  warnings: string[];
}
```

---

### Step 6: FusionDemand Spoke (SS.02.05)
**Purpose:** Fuse demand signals from multiple sources

**Tools Called:** `fusion_calculator`

```typescript
function fuseDemandSignals(
  opportunityObject: OpportunityObject,
  pass0Momentum?: MomentumFusionOutput
): FusionDemandOutput {

  // Combine Pass-1 demand metrics with Pass-0 momentum
  const demandInputs = {
    baseDemandSqft: opportunityObject.baseDemandSqft,
    populationGrowth: opportunityObject.populationGrowthRate,
    householdIncome: opportunityObject.medianHouseholdIncome,
    housingUnits: opportunityObject.housingUnits,
    momentumScore: pass0Momentum?.fusedMomentumScore || null
  };

  // Demand score calculation
  let demandScore = 50; // Base

  // Population growth impact
  if (demandInputs.populationGrowth > 0.03) demandScore += 15;
  else if (demandInputs.populationGrowth > 0.02) demandScore += 10;
  else if (demandInputs.populationGrowth > 0.01) demandScore += 5;
  else if (demandInputs.populationGrowth < 0) demandScore -= 15;

  // Income impact
  if (demandInputs.householdIncome > 75000) demandScore += 10;
  else if (demandInputs.householdIncome > 50000) demandScore += 5;
  else if (demandInputs.householdIncome < 35000) demandScore -= 10;

  // Momentum integration (if available)
  if (demandInputs.momentumScore) {
    demandScore = (demandScore * 0.7) + (demandInputs.momentumScore * 0.3);
  }

  return {
    fusedDemandScore: Math.min(100, Math.max(0, Math.round(demandScore))),
    demandDrivers: identifyTopDrivers(demandInputs),
    demandRisks: identifyRisks(demandInputs),
    momentumIntegrated: !!pass0Momentum,
    projectedAbsorption: calculateAbsorption(demandInputs)
  };
}
```

**Output Contract:**
```typescript
interface FusionDemandOutput {
  fusedDemandScore: number;        // 0-100
  demandDrivers: string[];         // Top positive factors
  demandRisks: string[];           // Risk factors
  momentumIntegrated: boolean;
  projectedAbsorption: number;     // sqft/year
  demandConfidence: 'high' | 'medium' | 'low';
}
```

---

### Step 7: CompetitivePressure Spoke (SS.02.06)
**Purpose:** Calculate competitive pressure and saturation

**Tools Called:** `pressure_calculator`

```typescript
function calculateCompetitivePressure(
  opportunityObject: OpportunityObject
): CompetitivePressureOutput {

  const {
    competitorCount,
    sqftPerCapita,
    nearestCompetitorMiles,
    nationalBrandCount,
    megastoreRisk
  } = opportunityObject;

  // Pressure scoring (lower pressure = better)
  let pressureScore = 100; // Start high (no pressure)

  // Competitor count impact
  pressureScore -= competitorCount * 5;

  // sqft/capita (< 5 is undersupplied, > 7 is oversupplied)
  if (sqftPerCapita > 10) pressureScore -= 30;
  else if (sqftPerCapita > 7) pressureScore -= 15;
  else if (sqftPerCapita < 5) pressureScore += 10;

  // National brand presence
  pressureScore -= nationalBrandCount * 8;

  // Megastore risk
  if (megastoreRisk) pressureScore -= 20;

  // Proximity to nearest competitor
  if (nearestCompetitorMiles < 1) pressureScore -= 15;
  else if (nearestCompetitorMiles < 2) pressureScore -= 10;
  else if (nearestCompetitorMiles > 5) pressureScore += 10;

  return {
    pressureScore: Math.min(100, Math.max(0, pressureScore)),
    saturationLevel: classifySaturation(sqftPerCapita),
    nearestCompetitor: nearestCompetitorMiles,
    nationalBrandThreat: nationalBrandCount > 0,
    megastoreRisk: megastoreRisk,
    competitivePosition: classifyPosition(pressureScore)
  };
}
```

**Output Contract:**
```typescript
interface CompetitivePressureOutput {
  pressureScore: number;           // 0-100 (higher = less pressure = better)
  saturationLevel: 'undersupplied' | 'balanced' | 'oversupplied';
  nearestCompetitor: number;       // miles
  nationalBrandThreat: boolean;
  megastoreRisk: boolean;
  competitivePosition: 'strong' | 'moderate' | 'weak';
}
```

---

### Step 8: Feasibility Spoke (SS.02.07)
**Purpose:** Calculate units, sqft, revenue, NOI, cap rate, DSCR

**Tools Called:** `feasibility_engine` (ADR-006)

```typescript
function calculateFeasibility(
  zoningOutput: ZoningOutput,
  pricingOutput: PricingVerificationOutput,
  acreage: number
): FeasibilityOutput {

  // Buildable area calculation
  const buildableArea = calculateBuildableArea(zoningOutput);

  // Unit mix estimation
  const unitMix = estimateUnitMix(buildableArea);

  // Revenue calculation
  const grossPotentialRent = calculateGPR(unitMix, pricingOutput.rentAssumptions);
  const vacancyFactor = 0.10;       // 10% vacancy
  const collectionLoss = 0.02;      // 2% collection loss
  const effectiveGrossIncome = grossPotentialRent * (1 - vacancyFactor) * (1 - collectionLoss);

  // Operating expenses (30-35% of EGI)
  const opExRatio = 0.32;
  const operatingExpenses = effectiveGrossIncome * opExRatio;

  // NOI Calculation
  const netOperatingIncome = effectiveGrossIncome - operatingExpenses;

  // Per-acre metrics (CRITICAL for Barton Doctrine)
  const noiPerAcre = netOperatingIncome / acreage;
  const noiPerAcreMonthly = noiPerAcre / 12;

  // 25% stress test (Barton Doctrine)
  const stressedNOI = netOperatingIncome * 0.75;
  const stressedNOIPerAcreMonthly = (stressedNOI / acreage) / 12;

  // Debt service calculation (6% / 25 year)
  const assumedLTV = 0.70;
  const estimatedValue = netOperatingIncome / 0.07;  // 7% cap
  const loanAmount = estimatedValue * assumedLTV;
  const annualDebtService = calculateDebtService(loanAmount, 0.06, 25);
  const dscr = netOperatingIncome / annualDebtService;

  // Cap rate
  const capRate = netOperatingIncome / estimatedValue;

  // Fatal flaw checks
  const fatalFlaws = [];

  if (noiPerAcreMonthly < 5000) {
    fatalFlaws.push({
      code: 'NOI_BELOW_DOCTRINE',
      severity: 'critical',
      message: `NOI of $${noiPerAcreMonthly.toFixed(0)}/acre/month is below $5,000 minimum`
    });
  }

  if (netOperatingIncome < 0) {
    fatalFlaws.push({
      code: 'NEGATIVE_NOI',
      severity: 'critical',
      message: 'Negative NOI - site is not viable'
    });
  }

  return {
    buildableSqft: buildableArea,
    estimatedUnits: unitMix.totalUnits,
    unitMixSummary: unitMix,
    grossPotentialRent: grossPotentialRent,
    effectiveGrossIncome: effectiveGrossIncome,
    operatingExpenses: operatingExpenses,
    netOperatingIncome: netOperatingIncome,
    noiPerAcre: noiPerAcre,
    noiPerAcreMonthly: noiPerAcreMonthly,
    stressedNOI: stressedNOI,
    stressedNOIPerAcreMonthly: stressedNOIPerAcreMonthly,
    passesDoctrineMinimum: noiPerAcreMonthly >= 5000,
    passesStressTest: stressedNOIPerAcreMonthly >= 3750,
    capRate: capRate,
    dscr: dscr,
    passesDSCR: dscr >= 1.25,
    feasibilityScore: calculateFeasibilityScore(...),
    fatalFlaws: fatalFlaws
  };
}
```

**Output Contract:**
```typescript
interface FeasibilityOutput {
  // Physical
  buildableSqft: number;
  estimatedUnits: number;
  unitMixSummary: UnitMix;

  // Revenue
  grossPotentialRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  netOperatingIncome: number;

  // Per-Acre Metrics (Barton Doctrine)
  noiPerAcre: number;
  noiPerAcreMonthly: number;
  stressedNOI: number;
  stressedNOIPerAcreMonthly: number;
  passesDoctrineMinimum: boolean;  // >= $5,000/acre/month
  passesStressTest: boolean;        // >= $3,750 after 25% haircut

  // Returns
  capRate: number;
  dscr: number;
  passesDSCR: boolean;              // >= 1.25

  // Scoring
  feasibilityScore: number;         // 0-100
  fatalFlaws: FatalFlaw[];
}
```

**Barton Doctrine Thresholds:**
| Metric | Minimum | Fatal Flaw |
|--------|---------|------------|
| NOI/Acre/Month | $5,000 | `NOI_BELOW_DOCTRINE` |
| Stressed NOI | $3,750 | `STRESSED_NOI_FAILURE` |
| DSCR | 1.25x | Warning (not fatal) |

---

### Step 9: ReverseFeasibility Spoke (SS.02.08)
**Purpose:** Calculate max land price and break-even occupancy

**Tools Called:** `reverse_engine`

```typescript
function calculateReverseFeasibility(
  feasibilityOutput: FeasibilityOutput,
  buildCostPerSqft: number = 25
): ReverseFeasibilityOutput {

  const { buildableSqft, netOperatingIncome, capRate } = feasibilityOutput;

  // Target value based on cap rate
  const targetCapRate = 0.07;  // 7% target
  const impliedValue = netOperatingIncome / targetCapRate;

  // Build cost estimation
  const estimatedBuildCost = buildableSqft * buildCostPerSqft;

  // Max land price = Value - Build Cost - Profit Margin
  const profitMargin = 0.15;  // 15% developer profit
  const maxLandPrice = impliedValue - estimatedBuildCost - (impliedValue * profitMargin);

  // Break-even occupancy
  const totalCost = estimatedBuildCost + maxLandPrice;
  const breakEvenOccupancy = (totalCost * 0.07) / feasibilityOutput.grossPotentialRent;

  // Sensitivity analysis
  const sensitivity = {
    rentIncrease10Pct: maxLandPrice * 1.15,
    rentDecrease10Pct: maxLandPrice * 0.85,
    capRate6Pct: netOperatingIncome / 0.06 - estimatedBuildCost - (netOperatingIncome / 0.06 * profitMargin),
    capRate8Pct: netOperatingIncome / 0.08 - estimatedBuildCost - (netOperatingIncome / 0.08 * profitMargin)
  };

  return {
    maxLandPrice: Math.max(0, maxLandPrice),
    maxPricePerAcre: Math.max(0, maxLandPrice / feasibilityOutput.acreage),
    breakEvenOccupancy: breakEvenOccupancy,
    impliedValue: impliedValue,
    estimatedBuildCost: estimatedBuildCost,
    sensitivity: sensitivity,
    viabilityAssessment: assessViability(maxLandPrice, breakEvenOccupancy)
  };
}
```

**Output Contract:**
```typescript
interface ReverseFeasibilityOutput {
  maxLandPrice: number;
  maxPricePerAcre: number;
  breakEvenOccupancy: number;      // percentage
  impliedValue: number;
  estimatedBuildCost: number;
  sensitivity: {
    rentIncrease10Pct: number;
    rentDecrease10Pct: number;
    capRate6Pct: number;
    capRate8Pct: number;
  };
  viabilityAssessment: 'strong' | 'moderate' | 'marginal' | 'weak';
}
```

---

### Step 10: MomentumReader Spoke (SS.02.09)
**Purpose:** Read Pass-0 momentum score and integrate trend direction

**Tools Called:** `momentum_reader`

```typescript
async function readMomentum(
  zipCode: string,
  state: string
): Promise<MomentumReaderOutput> {

  // Fetch most recent Pass-0 run for this location
  const { data: pass0Run } = await supabase
    .from('pass0_runs')
    .select('*')
    .eq('zip_code', zipCode)
    .eq('state', state)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!pass0Run) {
    return {
      momentumAvailable: false,
      momentumScore: null,
      trendDirection: null,
      topContributors: [],
      confidenceLevel: null,
      momentumAge: null
    };
  }

  // Check freshness (momentum data older than 30 days should be flagged)
  const ageInDays = (Date.now() - new Date(pass0Run.created_at).getTime()) / (1000 * 60 * 60 * 24);

  return {
    momentumAvailable: true,
    momentumScore: pass0Run.fused_momentum_score,
    trendDirection: pass0Run.trend_direction,
    topContributors: pass0Run.top_contributors,
    confidenceLevel: pass0Run.confidence_level,
    momentumAge: ageInDays,
    stale: ageInDays > 30
  };
}
```

**Output Contract:**
```typescript
interface MomentumReaderOutput {
  momentumAvailable: boolean;
  momentumScore: number | null;     // 0-100
  trendDirection: 'rising' | 'stable' | 'declining' | null;
  topContributors: string[];
  confidenceLevel: 'high' | 'medium' | 'low' | null;
  momentumAge: number | null;       // days since Pass-0 run
  stale: boolean;
}
```

---

### Step 11: Verdict Spoke (SS.02.10)
**Purpose:** Generate final GO/NO_GO/MAYBE verdict

**Tools Called:** `verdict_engine` (ADR-007)

```typescript
function generateVerdict(
  feasibilityOutput: FeasibilityOutput,
  fusionDemandOutput: FusionDemandOutput,
  competitivePressureOutput: CompetitivePressureOutput,
  zoningOutput: ZoningOutput,
  momentumOutput: MomentumReaderOutput,
  allFatalFlaws: FatalFlaw[]
): VerdictOutput {

  // Step 1: Check fatal flaws FIRST
  if (allFatalFlaws.length > 0) {
    return {
      verdict: 'NO_GO',
      dealIndex: calculateDealIndex(...),  // Still calculate for audit
      fatalFlaws: allFatalFlaws,
      reasoning: `Fatal flaw: ${allFatalFlaws[0].code}`,
      strengths: [],
      weaknesses: [allFatalFlaws[0].message],
      overrideEligible: allFatalFlaws.some(f => f.overridable !== false)
    };
  }

  // Step 2: Calculate Deal Index (weighted score)
  const weights = {
    feasibility: 0.30,        // 30%
    fusionDemand: 0.25,       // 25%
    competitivePressure: 0.20, // 20%
    zoning: 0.15,             // 15%
    momentum: 0.10            // 10%
  };

  const dealIndex =
    (feasibilityOutput.feasibilityScore * weights.feasibility) +
    (fusionDemandOutput.fusedDemandScore * weights.fusionDemand) +
    (competitivePressureOutput.pressureScore * weights.competitivePressure) +
    (zoningOutput.zoningScore * weights.zoning) +
    ((momentumOutput.momentumScore || 50) * weights.momentum);

  // Step 3: Determine verdict
  let verdict: 'GO' | 'NO_GO' | 'MAYBE';

  if (dealIndex >= 70 && feasibilityOutput.passesDoctrineMinimum) {
    verdict = 'GO';
  } else if (dealIndex >= 50 && !allFatalFlaws.length) {
    verdict = 'MAYBE';
  } else {
    verdict = 'NO_GO';
  }

  // Step 4: Identify strengths and weaknesses
  const strengths = identifyStrengths(feasibilityOutput, fusionDemandOutput, competitivePressureOutput);
  const weaknesses = identifyWeaknesses(feasibilityOutput, fusionDemandOutput, competitivePressureOutput);

  return {
    verdict: verdict,
    dealIndex: Math.round(dealIndex),
    fatalFlaws: [],
    reasoning: generateReasoning(verdict, dealIndex),
    strengths: strengths,
    weaknesses: weaknesses,
    scoreBreakdown: {
      feasibilityContribution: feasibilityOutput.feasibilityScore * weights.feasibility,
      demandContribution: fusionDemandOutput.fusedDemandScore * weights.fusionDemand,
      competitiveContribution: competitivePressureOutput.pressureScore * weights.competitivePressure,
      zoningContribution: zoningOutput.zoningScore * weights.zoning,
      momentumContribution: (momentumOutput.momentumScore || 50) * weights.momentum
    },
    confidenceLevel: calculateVerdictConfidence(...),
    overrideEligible: verdict === 'MAYBE'
  };
}
```

**Output Contract:**
```typescript
interface VerdictOutput {
  verdict: 'GO' | 'NO_GO' | 'MAYBE';
  dealIndex: number;               // 0-100
  fatalFlaws: FatalFlaw[];
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  scoreBreakdown: {
    feasibilityContribution: number;
    demandContribution: number;
    competitiveContribution: number;
    zoningContribution: number;
    momentumContribution: number;
  };
  confidenceLevel: 'high' | 'medium' | 'low';
  overrideEligible: boolean;
}
```

**Verdict Thresholds:**
| Verdict | Criteria |
|---------|----------|
| GO | Deal Index >= 70, NOI >= $5,000/acre, no fatal flaws |
| MAYBE | Deal Index 50-69, no fatal flaws |
| NO_GO | Deal Index < 50 OR any fatal flaw |

---

### Step 12: VaultMapper Spoke (SS.02.11)
**Purpose:** Map results to Neon vault schema and stamp fields

**Tools Called:** `vault_mapper`, `neon_db`

```typescript
async function mapToVault(
  opportunityObject: OpportunityObject,
  verdictOutput: VerdictOutput,
  allSpokeOutputs: AllSpokeOutputs
): Promise<VaultMapperOutput> {

  // Build vault record
  const vaultRecord = {
    // Identification
    run_id: uuid(),
    pass1_run_id: opportunityObject.runId,
    zip_code: opportunityObject.zipCode,
    state: opportunityObject.state,

    // Verdict
    verdict: verdictOutput.verdict,
    deal_index: verdictOutput.dealIndex,
    fatal_flaws: verdictOutput.fatalFlaws,

    // Feasibility
    noi: allSpokeOutputs.feasibility.netOperatingIncome,
    noi_per_acre_monthly: allSpokeOutputs.feasibility.noiPerAcreMonthly,
    passes_doctrine: allSpokeOutputs.feasibility.passesDoctrineMinimum,
    cap_rate: allSpokeOutputs.feasibility.capRate,
    dscr: allSpokeOutputs.feasibility.dscr,

    // Scoring
    feasibility_score: allSpokeOutputs.feasibility.feasibilityScore,
    demand_score: allSpokeOutputs.fusionDemand.fusedDemandScore,
    competitive_score: allSpokeOutputs.competitivePressure.pressureScore,
    zoning_score: allSpokeOutputs.zoning.zoningScore,

    // Metadata
    created_at: new Date(),
    stamped: true,
    stamp_timestamp: new Date()
  };

  // Write to Neon vault
  const { data, error } = await neonClient
    .from('pass2_vault')
    .insert(vaultRecord)
    .select()
    .single();

  if (error) {
    throw new Error(`VAULT_WRITE_FAILED: ${error.message}`);
  }

  return {
    vaultRecordId: data.run_id,
    stamped: true,
    stampTimestamp: data.stamp_timestamp,
    recordWritten: true
  };
}
```

**Output Contract:**
```typescript
interface VaultMapperOutput {
  vaultRecordId: string;
  stamped: boolean;
  stampTimestamp: Date;
  recordWritten: boolean;
  vaultLocation: 'neon_pass2_vault';
}
```

---

## 4. Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PASS-2 UNDERWRITING HUB                                │
│                          Doctrine ID: SS.02.00                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  INPUT: OpportunityObject (Pass-1) + RateEvidence (Pass-1.5)                    │
│                                                                                 │
│  ┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐             │
│  │   Zoning    │      │ CivilConstraints │      │  PermitsStatic  │             │
│  │  SS.02.01   │      │    SS.02.02      │      │    SS.02.03     │             │
│  │             │      │                  │      │                 │             │
│  │ regrid      │      │ fema_api         │      │ buildzoom       │             │
│  │ zoning_api  │      │ usgs_dem         │      │ permit_db       │             │
│  └──────┬──────┘      └────────┬─────────┘      └────────┬────────┘             │
│         │                      │                         │                      │
│         ▼                      ▼                         ▼                      │
│  ┌──────────────────────────────────────────────────────────────────┐           │
│  │                     FATAL FLAW AGGREGATION                        │           │
│  │  - ZONING_PROHIBITED                                              │           │
│  │  - FLOOD_ZONE_HIGH_RISK                                           │           │
│  │  - PROHIBITIVE_TOPOGRAPHY                                         │           │
│  └──────────────────────────────────────────────────────────────────┘           │
│         │                                                                       │
│         ▼                                                                       │
│  ┌─────────────────────┐                                                        │
│  │PricingVerification  │──▶ Verify Pass-1.5 rates                               │
│  │    SS.02.04         │    └─▶ { avg10x10: $95, marketPosition: "competitive" }│
│  └────────┬────────────┘                                                        │
│           │                                                                     │
│           ▼                                                                     │
│  ┌─────────────────┐       ┌────────────────────┐                               │
│  │  FusionDemand   │       │CompetitivePressure │                               │
│  │   SS.02.05      │       │    SS.02.06        │                               │
│  │                 │       │                    │                               │
│  │ demandScore: 72 │       │ pressureScore: 68  │                               │
│  └────────┬────────┘       └─────────┬──────────┘                               │
│           │                          │                                          │
│           ▼                          ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐            │
│  │                        FEASIBILITY                               │            │
│  │                        SS.02.07                                  │            │
│  │                                                                  │            │
│  │  ┌─────────────────────────────────────────────────────────┐    │            │
│  │  │  Barton Doctrine Validation                              │    │            │
│  │  │  ├─ NOI/Acre/Month: $6,250 ✓ (>= $5,000)                │    │            │
│  │  │  ├─ Stressed NOI:   $4,688 ✓ (>= $3,750)                │    │            │
│  │  │  ├─ DSCR:           1.42 ✓ (>= 1.25)                    │    │            │
│  │  │  └─ Cap Rate:       7.2%                                 │    │            │
│  │  └─────────────────────────────────────────────────────────┘    │            │
│  └──────────────────────────────┬──────────────────────────────────┘            │
│                                 │                                               │
│                                 ▼                                               │
│  ┌───────────────────┐   ┌─────────────────┐                                    │
│  │ReverseFeasibility │   │ MomentumReader  │                                    │
│  │    SS.02.08       │   │   SS.02.09      │                                    │
│  │                   │   │                 │                                    │
│  │ maxLand: $425K    │   │ momentum: 74    │                                    │
│  └─────────┬─────────┘   └────────┬────────┘                                    │
│            │                      │                                             │
│            ▼                      ▼                                             │
│  ┌────────────────────────────────────────────────────────────────┐             │
│  │                          VERDICT                                │             │
│  │                         SS.02.10                                │             │
│  │                                                                 │             │
│  │  Deal Index Calculation:                                        │             │
│  │  ├─ Feasibility:    78 × 30% = 23.4                            │             │
│  │  ├─ Demand:         72 × 25% = 18.0                            │             │
│  │  ├─ Competitive:    68 × 20% = 13.6                            │             │
│  │  ├─ Zoning:         85 × 15% = 12.75                           │             │
│  │  └─ Momentum:       74 × 10% = 7.4                             │             │
│  │                              ═══════                            │             │
│  │  DEAL INDEX:                  75.15 → 75                        │             │
│  │                                                                 │             │
│  │  VERDICT: GO ✓                                                  │             │
│  │  (DI >= 70, NOI >= $5,000/acre, no fatal flaws)                │             │
│  └────────────────────────────────────────────────────────────────┘             │
│                                 │                                               │
│                                 ▼                                               │
│  ┌─────────────────┐                                                            │
│  │  VaultMapper    │──▶ neon_db                                                 │
│  │   SS.02.11      │    └─▶ STAMPED record written to Neon vault               │
│  └────────┬────────┘                                                            │
│           │                                                                     │
│           ▼                                                                     │
│  OUTPUT: UnderwritingPackage                                                    │
│  {                                                                              │
│    verdict: "GO",                                                               │
│    dealIndex: 75,                                                               │
│    noiPerAcreMonthly: 6250,                                                     │
│    passesDoctrineMinimum: true,                                                 │
│    capRate: 0.072,                                                              │
│    dscr: 1.42,                                                                  │
│    fatalFlaws: [],                                                              │
│    stamped: true                                                                │
│  }                                                                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
              ┌───────────────────┐   ┌───────────────────┐
              │  If GO or MAYBE   │   │    If NO_GO       │
              │                   │   │                   │
              │  → PASS-3 DESIGN  │   │  → WALK           │
              │    HUB            │   │    (End pipeline) │
              └───────────────────┘   └───────────────────┘
```

---

## 5. Spokes Summary

| Spoke Name | Doctrine ID | Capability | Inherits Tools |
|------------|-------------|------------|----------------|
| Zoning | SS.02.01 | Fetch zoning code, check storage permitted, setbacks, height limits | zoning_api, regrid |
| CivilConstraints | SS.02.02 | Flood zone, wetlands, slope, soil type, utilities availability | civil_calculator, fema_api, usgs_dem |
| PermitsStatic | SS.02.03 | Recent permit history, avg permit time, jurisdiction difficulty | permit_db, buildzoom |
| PricingVerification | SS.02.04 | Verify rates from Pass-1.5, calculate market averages | rent_benchmarks |
| FusionDemand | SS.02.05 | Fuse demand signals, population density, household growth | fusion_calculator |
| CompetitivePressure | SS.02.06 | Pressure score, nearest competitor, saturation level | pressure_calculator |
| Feasibility | SS.02.07 | Units, sqft, revenue, NOI, cap rate, DSCR | feasibility_engine |
| ReverseFeasibility | SS.02.08 | Max land price, break-even occupancy, sensitivity | reverse_engine |
| MomentumReader | SS.02.09 | Read Pass-0 momentum score, trend direction | momentum_reader |
| Verdict | SS.02.10 | Generate GO/NO_GO/MAYBE, fatal flaws, strengths/weaknesses | verdict_engine |
| VaultMapper | SS.02.11 | Map results to Neon vault schema, stamp fields | vault_mapper, neon_db |

---

## 6. Fatal Flaws (Auto-WALK)

| Code | Description | Source Spoke |
|------|-------------|--------------|
| `ZONING_PROHIBITED` | Storage not permitted in zoning district | Zoning |
| `FLOOD_ZONE_HIGH_RISK` | Site in FEMA Zone A or V | CivilConstraints |
| `PROHIBITIVE_TOPOGRAPHY` | Slope exceeds 15% | CivilConstraints |
| `NEGATIVE_NOI` | NOI calculation is negative | Feasibility |
| `NOI_BELOW_DOCTRINE` | NOI < $5,000/acre/month | Feasibility |
| `EXCESSIVE_DIRT_WORK` | Grading > 20% of project cost | CivilConstraints |

---

## 7. Barton Doctrine Alignment

| Doctrine Rule | Pass-2 Enforcement |
|---------------|-------------------|
| $5,000/Month Per Acre Minimum | Feasibility spoke calculates, Verdict checks |
| Zoning Sovereignty | Zoning spoke checks by-right, flags variances |
| Debt Survivability | Feasibility checks DSCR >= 1.25 at 6%/25yr |
| 25% NOI Haircut | ReverseFeasibility runs stressed scenario |
| Pivotability | VaultMapper flags pivot potential for Pass-3 |
| No-Emotion Rule | All verdicts are math-driven, no manual scoring |

---

## 8. Verdict Scoring Weights

| Factor | Weight | Source Spoke |
|--------|--------|--------------|
| Feasibility Score | 30% | Feasibility |
| Fusion Demand Score | 25% | FusionDemand |
| Competitive Pressure | 20% | CompetitivePressure |
| Zoning Score | 15% | Zoning |
| Momentum Score | 10% | MomentumReader |

---

## 9. Guard Rails

| Guard Rail | Type | Threshold |
|------------|------|-----------|
| DSCR Minimum | Validation | >= 1.25 (Barton Doctrine) |
| Cap Rate Target | Validation | >= 6.5% |
| NOI per Acre Minimum | Validation | >= $5,000/month (Barton Doctrine) |
| Stressed NOI Minimum | Validation | >= $3,750/month (25% haircut) |
| Lot Coverage Maximum | Validation | <= zoning limit or 70% |
| Slope Maximum | Validation | <= 15% |
| Spoke Timeout | Timeout | 60 seconds per spoke |
| Orchestrator Timeout | Timeout | 10 minutes total |

---

## 10. Kill Switch

- **Endpoint:** `/api/admin/pass2/kill`
- **Activation Criteria:**
  - Neon vault write failures > 10 consecutive
  - Regrid API down
  - DSCR calculation producing invalid results
  - Orchestrator failure rate > 30% in 5 minutes
- **Emergency Contact:** System Admin via Slack #storage-alerts
- **Recovery:** Manual restart after root cause analysis

---

## 11. Human Override Rules

| Override | Condition | Approver |
|----------|-----------|----------|
| Force GO | MAYBE verdict but strategic opportunity | Investment Committee |
| Override WALK | Fatal flaw is addressable (e.g., zoning variance likely) | Hub Owner + Legal |
| Adjust Cap Rate | Market conditions warrant deviation | Hub Owner |
| Accept Low DSCR | Strong other factors, will improve with lease-up | Hub Owner |
| Manual Zoning Override | Local knowledge contradicts API | Hub Owner |

**Process:** Override requests logged to `engine_logs` table with approver, timestamp, and justification.

---

## 12. Integration with Pass-3

Pass-2 output triggers Pass-3 for GO or MAYBE verdicts:

```typescript
// If verdict is GO or MAYBE, proceed to Pass-3
if (verdictOutput.verdict === 'GO' || verdictOutput.verdict === 'MAYBE') {
  const pass3Input = {
    underwritingPackage: underwritingPackage,
    opportunityObject: opportunityObject,
    rateEvidence: rateEvidence,
    feasibilityOutput: feasibilityOutput
  };

  // Trigger Pass-3 Design Hub
  await Pass3Orchestrator.run(pass3Input);
}

// If NO_GO, end pipeline
if (verdictOutput.verdict === 'NO_GO') {
  await logWalk(underwritingPackage, verdictOutput.reasoning);
  return { status: 'WALK', reason: verdictOutput.reasoning };
}
```

---

## 13. Master Failure Log Integration

All failures in Pass-2 are logged to the centralized `master_failure_log` table for unified troubleshooting. See ADR-013 for full specification.

### Pass Identifier
```
pass: 'PASS2'
```

### Error Codes (Pass-2 Specific)

| Error Code | Spoke | Severity | Description |
|------------|-------|----------|-------------|
| `ZONING_API_UNAVAILABLE` | Zoning | error | Regrid API unreachable |
| `ZONING_PROHIBITED` | Zoning | critical | Storage prohibited in zone (FATAL FLAW) |
| `ZONING_PARSE_ERROR` | Zoning | error | Failed to parse zoning data |
| `CIVIL_CONSTRAINTS_ERROR` | CivilConstraints | error | Failed to fetch civil data |
| `FLOOD_ZONE_HIGH_RISK` | CivilConstraints | critical | High-risk flood zone (FATAL FLAW) |
| `PROHIBITIVE_TOPOGRAPHY` | CivilConstraints | critical | Slope > 15% (FATAL FLAW) |
| `PERMIT_CHECK_FAILED` | PermitsStatic | warning | Could not verify permits |
| `PRICING_VERIFICATION_FAILED` | PricingVerification | error | Rate verification failed |
| `FUSION_DEMAND_ERROR` | FusionDemand | error | Failed to calculate demand |
| `COMPETITIVE_ANALYSIS_ERROR` | CompetitivePressure | error | Failed competitive analysis |
| `FEASIBILITY_CALCULATION_ERROR` | Feasibility | error | Failed feasibility calculation |
| `NOI_BELOW_DOCTRINE` | Feasibility | critical | NOI < $5,000/acre/month (FATAL FLAW) |
| `NEGATIVE_NOI` | Feasibility | critical | NOI is negative (FATAL FLAW) |
| `DSCR_BELOW_MINIMUM` | Feasibility | critical | DSCR < 1.25 (FATAL FLAW) |
| `REVERSE_FEASIBILITY_ERROR` | ReverseFeasibility | error | Stress test calculation failed |
| `MOMENTUM_READ_ERROR` | MomentumReader | warning | Could not read Pass-0 data |
| `VERDICT_CALCULATION_ERROR` | Verdict | error | Failed to calculate verdict |
| `VAULT_WRITE_ERROR` | VaultMapper | error | Failed to write to vault |
| `PASS2_ORCHESTRATOR_FAILURE` | Orchestrator | critical | Hub orchestration failed |
| `PASS2_TIMEOUT` | Orchestrator | critical | Hub exceeded timeout |

### Logging Implementation

```typescript
import { logPass2Failure } from '@/shared/failures/masterFailureLogger';

// In Feasibility spoke - critical doctrine check:
if (noiPerAcreMonthly < 5000) {
  await logPass2Failure(
    processId,                           // UUID for this run
    'Feasibility',                       // Spoke name
    'NOI_BELOW_DOCTRINE',                // Error code
    'critical',                          // Severity - FATAL FLAW
    `NOI of $${noiPerAcreMonthly.toFixed(0)}/acre/month is below $5,000 minimum`,
    {
      opportunityId,
      noiPerAcreMonthly,
      doctrineMinimum: 5000,
      acreage,
      netOperatingIncome,
      isFatalFlaw: true
    }
  );
  // Add to fatalFlaws array, proceed to verdict...
}

// In Zoning spoke - API failure:
try {
  const zoningData = await regridApi.getZoning(parcelId);
} catch (error) {
  await logPass2Failure(
    processId,
    'Zoning',
    'ZONING_API_UNAVAILABLE',
    'error',
    `Regrid API failed: ${error.message}`,
    {
      parcelId,
      errorType: error.name,
      stack: error.stack
    }
  );
  throw error;
}
```

### Troubleshooting Workflow

```sql
-- Find all Pass-2 failures for a specific opportunity
SELECT * FROM master_failure_log
WHERE pass = 'PASS2'
  AND opportunity_id = '<opportunity-id>'
ORDER BY created_at ASC;

-- Find all fatal flaws (auto-WALK triggers)
SELECT * FROM master_failure_log
WHERE pass = 'PASS2'
  AND severity = 'critical'
  AND error_code IN (
    'ZONING_PROHIBITED',
    'FLOOD_ZONE_HIGH_RISK',
    'PROHIBITIVE_TOPOGRAPHY',
    'NOI_BELOW_DOCTRINE',
    'NEGATIVE_NOI',
    'DSCR_BELOW_MINIMUM'
  )
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Get Pass-2 failure summary by spoke
SELECT
    spoke,
    error_code,
    severity,
    COUNT(*) as occurrences,
    MAX(created_at) as last_occurrence
FROM master_failure_log
WHERE pass = 'PASS2'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY spoke, error_code, severity
ORDER BY
    CASE severity WHEN 'critical' THEN 1 WHEN 'error' THEN 2 ELSE 3 END,
    occurrences DESC;
```

---

## Approval

| Role | Name | Date |
|------|------|------|
| Owner | Barton Enterprises | 2025-12-17 |
| Reviewer | | |
