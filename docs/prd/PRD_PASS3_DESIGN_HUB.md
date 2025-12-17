# PRD — Pass-3 Design/Calculator Hub

## 1. Overview

- **System Name:** Storage Site Scout (Barton Storage Application)
- **Hub Name:** PASS3_DESIGN_HUB
- **Official Name:** PASS 3 — DESIGN/CALCULATOR HUB
- **Owner:** Barton Enterprises
- **Version:** 1.0.0
- **Doctrine ID:** SS.03.00

---

## 2. Purpose

The Pass-3 Design/Calculator Hub performs detailed pro forma modeling and financial analysis for sites that receive a GO or MAYBE verdict from Pass-2. It produces comprehensive financial projections, construction cost estimates, and investment return calculations.

**Boundary:** This hub owns all detailed financial modeling, construction cost estimation, and investment analysis. It does NOT own site screening (Pass-1), rate verification (Pass-1.5), or underwriting verdicts (Pass-2).

**Input:** Underwriting Package from Pass-2 (GO or MAYBE verdict)
**Output:** Complete Pro Forma Package with financial projections

---

## 2.1 Complete Pipeline Walkthrough

This section provides a step-by-step walkthrough of exactly how Pass-3 processes an opportunity from input to output. Each spoke is documented with its exact inputs, processing logic, API calls, and outputs.

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PASS-3 DESIGN/CALCULATOR HUB                            │
│                                                                                 │
│  INPUT: UnderwritingPackage from Pass-2 (GO or MAYBE verdict)                  │
│                                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
│  │  Setback    │──▶│  Coverage   │──▶│  UnitMix    │──▶│   Phase     │        │
│  │  Engine     │   │  Engine     │   │  Optimizer  │   │  Planner    │        │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘        │
│         │                                                     │                 │
│         ▼                                                     ▼                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
│  │  BuildCost  │◀──│    NOI      │◀──│    Debt     │◀──│ MaxLandPrice│        │
│  │   Model     │   │   Engine    │   │   Model     │   │             │        │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘        │
│         │                                                     │                 │
│         └─────────────────────┬───────────────────────────────┘                 │
│                               ▼                                                 │
│                        ┌─────────────┐                                          │
│                        │    IRR      │                                          │
│                        │   Model     │                                          │
│                        └─────────────┘                                          │
│                               │                                                 │
│  OUTPUT: ProFormaPackage with complete financial projections                   │
└───────────────────────────────┼─────────────────────────────────────────────────┘
                                ▼
                    ┌─────────────────────┐
                    │   Investment Memo   │
                    │   (Final Output)    │
                    └─────────────────────┘
```

---

### Step 1: SetbackEngine (SS.03.01)

**Purpose:** Calculate the actual buildable area by subtracting required setbacks from the total parcel geometry.

**Input Contract:**
```typescript
interface SetbackEngineInput {
  // From Pass-2 UnderwritingPackage
  parcelId: string;
  acreage: number;
  parcelGeometry: GeoJSON.Polygon | null;  // May be null if unavailable

  // Zoning data from Pass-2
  zoningCode: string;
  zoningCategory: 'by_right' | 'conditional' | 'rezoning_required';

  // Setback requirements (from zoning)
  setbackRequirements: {
    front: number;      // feet
    rear: number;       // feet
    side: number;       // feet
    corner: number;     // feet (if corner lot)
  } | null;
}
```

**Processing Logic:**

```typescript
async function executeSetbackEngine(input: SetbackEngineInput): Promise<SetbackResult> {
  // Step 1: Fetch parcel geometry if not provided
  let geometry = input.parcelGeometry;
  if (!geometry) {
    const parcelData = await fetchParcelGeometry(input.parcelId);
    geometry = parcelData?.geometry || null;
  }

  // Step 2: If still no geometry, estimate from acreage
  if (!geometry) {
    return estimateBuildableFromAcreage(input.acreage, input.setbackRequirements);
  }

  // Step 3: Calculate setback polygon
  const setbacks = input.setbackRequirements || getDefaultSetbacks(input.zoningCode);
  const setbackPolygon = calculateSetbackPolygon(geometry, setbacks);

  // Step 4: Calculate buildable area
  const totalSqft = turf.area(geometry) * 10.764;  // Convert m² to sqft
  const buildableSqft = turf.area(setbackPolygon) * 10.764;
  const setbackSqft = totalSqft - buildableSqft;

  // Step 5: Calculate parcel dimensions
  const dimensions = calculateParcelDimensions(geometry);

  return {
    parcelId: input.parcelId,
    totalParcelSqft: totalSqft,
    buildableSqft: buildableSqft,
    setbackSqft: setbackSqft,
    buildablePercentage: (buildableSqft / totalSqft) * 100,
    setbackPolygon: setbackPolygon,
    parcelDimensions: dimensions,
    setbacksApplied: setbacks,
    geometrySource: geometry ? 'parcel_api' : 'acreage_estimate',
    warnings: []
  };
}
```

**External API Calls:**

```typescript
// Parcel Geometry API (Regrid or similar)
// Called when parcel geometry not in Pass-2 handoff
GET https://api.regrid.com/api/v1/parcel/{parcelId}/geometry
Headers: { 'Authorization': 'Bearer {REGRID_API_KEY}' }

Response:
{
  "parcel_id": "TX-123456",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], [lng, lat], ...]]
  },
  "area_sqft": 217800,
  "centroid": { "lat": 32.7767, "lng": -96.7970 }
}
```

**Output Contract:**
```typescript
interface SetbackResult {
  parcelId: string;
  totalParcelSqft: number;
  buildableSqft: number;
  setbackSqft: number;
  buildablePercentage: number;
  setbackPolygon: GeoJSON.Polygon;
  parcelDimensions: {
    width: number;        // feet
    depth: number;        // feet
    frontage: number;     // feet (road frontage)
    shape: 'rectangular' | 'irregular' | 'flag_lot';
  };
  setbacksApplied: {
    front: number;
    rear: number;
    side: number;
    corner: number;
  };
  geometrySource: 'parcel_api' | 'acreage_estimate';
  warnings: string[];
}
```

**Failure Handling:**
```typescript
// If parcel geometry unavailable
if (!geometry) {
  // Estimate buildable area as 75% of total acreage
  const estimatedBuildable = input.acreage * 43560 * 0.75;
  result.warnings.push('PARCEL_GEOMETRY_UNAVAILABLE: Using 75% acreage estimate');
  result.geometrySource = 'acreage_estimate';
}
```

---

### Step 2: CoverageEngine (SS.03.02)

**Purpose:** Determine maximum buildable square footage based on lot coverage limits, height restrictions, and construction type.

**Input Contract:**
```typescript
interface CoverageEngineInput {
  // From SetbackEngine
  buildableSqft: number;
  parcelDimensions: ParcelDimensions;

  // From Pass-2 Zoning
  zoningCode: string;
  maxLotCoverage: number;        // Percentage (0-100)
  maxBuildingHeight: number;     // feet
  maxStories: number;

  // Site characteristics
  acreage: number;
  slope: number;                  // percentage
}
```

**Processing Logic:**

```typescript
async function executeCoverageEngine(input: CoverageEngineInput): Promise<CoverageResult> {
  // Step 1: Calculate max footprint from lot coverage
  const maxFootprint = input.buildableSqft * (input.maxLotCoverage / 100);

  // Step 2: Determine construction type based on site
  const constructionType = determineConstructionType(input);

  // Step 3: Calculate stories based on height and type
  const effectiveStories = Math.min(
    input.maxStories,
    Math.floor(input.maxBuildingHeight / 12)  // 12ft per story
  );

  // Step 4: Calculate total buildable sqft
  let totalBuildableSqft: number;
  let storiesBuilt: number;

  if (constructionType === 'drive_up_only') {
    // Single story, ~60% efficient
    totalBuildableSqft = maxFootprint * 0.60;
    storiesBuilt = 1;
  } else if (constructionType === 'single_story') {
    // Single story enclosed, ~75% efficient
    totalBuildableSqft = maxFootprint * 0.75;
    storiesBuilt = 1;
  } else {
    // Multi-story, ~70% efficient per floor
    storiesBuilt = Math.min(effectiveStories, 3);  // Max 3 for self-storage
    totalBuildableSqft = maxFootprint * 0.70 * storiesBuilt;
  }

  // Step 5: Calculate net rentable (subtract common areas)
  const netRentableSqft = totalBuildableSqft * 0.85;  // 15% common areas

  return {
    maxFootprintSqft: maxFootprint,
    totalBuildableSqft: totalBuildableSqft,
    netRentableSqft: netRentableSqft,
    constructionType: constructionType,
    storiesBuilt: storiesBuilt,
    lotCoverageUsed: input.maxLotCoverage,
    efficiencyFactor: netRentableSqft / maxFootprint,
    parkingRequired: calculateParkingRequired(netRentableSqft, input.zoningCode),
    warnings: []
  };
}

function determineConstructionType(input: CoverageEngineInput): ConstructionType {
  // Multi-story only viable on larger, flatter sites
  if (input.acreage >= 3 && input.slope <= 5 && input.maxStories >= 2) {
    return 'multi_story';
  }
  // Single-story enclosed for moderate sites
  if (input.acreage >= 1.5 && input.slope <= 10) {
    return 'single_story';
  }
  // Drive-up only for smaller or sloped sites
  return 'drive_up_only';
}
```

**Output Contract:**
```typescript
interface CoverageResult {
  maxFootprintSqft: number;
  totalBuildableSqft: number;
  netRentableSqft: number;
  constructionType: 'single_story' | 'multi_story' | 'drive_up_only';
  storiesBuilt: number;
  lotCoverageUsed: number;
  efficiencyFactor: number;
  parkingRequired: {
    spaces: number;
    sqft: number;
  };
  warnings: string[];
}
```

---

### Step 3: UnitMixOptimizer (SS.03.03)

**Purpose:** Optimize the mix of storage unit sizes to maximize revenue per square foot while matching market demand.

**Input Contract:**
```typescript
interface UnitMixInput {
  // From CoverageEngine
  netRentableSqft: number;
  constructionType: ConstructionType;

  // From Pass-1.5 RateEvidencePackage
  marketRates: {
    bySize: Record<string, { avgRate: number; minRate: number; maxRate: number }>;
    climateControlledPremium: number;  // percentage
  };

  // From Pass-2 Demand
  demandProfile: {
    dominantSizes: string[];           // e.g., ['10x10', '10x15']
    climateControlledDemand: number;   // percentage
  };

  // Constraints
  constraints: {
    minUnitCount: number;
    maxUnitCount: number;
    targetClimatePct: number;
  };
}
```

**Processing Logic:**

```typescript
async function executeUnitMixOptimizer(input: UnitMixInput): Promise<OptimizedUnitMix> {
  // Step 1: Calculate revenue-weighted scores for each size
  const sizeScores = UNIT_SIZES.map(size => ({
    size: size.name,
    sqft: size.sqft,
    rentPerSqft: input.marketRates.bySize[size.name]?.avgRate / size.sqft || size.defaultRentPerSqft,
    demandWeight: input.demandProfile.dominantSizes.includes(size.name) ? 1.2 : 1.0,
    score: 0  // Calculated below
  }));

  // Step 2: Calculate composite scores
  sizeScores.forEach(s => {
    s.score = s.rentPerSqft * s.demandWeight;
  });

  // Step 3: Run linear optimization
  const allocation = linearOptimize({
    objective: 'maximize_revenue',
    variables: sizeScores.map(s => ({
      name: s.size,
      coefficient: s.score,
      sqft: s.sqft
    })),
    constraints: [
      { type: 'total_sqft', max: input.netRentableSqft },
      { type: 'min_unit_count', min: input.constraints.minUnitCount },
      { type: 'max_unit_count', max: input.constraints.maxUnitCount },
      { type: 'diversity', min: 4 },          // At least 4 sizes
      { type: 'max_concentration', max: 0.35 } // No size > 35%
    ]
  });

  // Step 4: Apply climate control split
  const units = allocation.map(a => {
    const climatePct = getClimatePercentage(a.size, input.demandProfile.climateControlledDemand);
    const climateCount = Math.round(a.count * climatePct);
    return {
      size: a.size,
      sqft: a.sqft,
      count: a.count,
      climateControlledCount: climateCount,
      nonClimateCount: a.count - climateCount,
      monthlyRate: input.marketRates.bySize[a.size]?.avgRate || getDefaultRate(a.size),
      climateRate: (input.marketRates.bySize[a.size]?.avgRate || getDefaultRate(a.size)) *
                   (1 + input.marketRates.climateControlledPremium / 100),
      rentPerSqft: (input.marketRates.bySize[a.size]?.avgRate || getDefaultRate(a.size)) / a.sqft,
      percentOfMix: (a.count * a.sqft) / input.netRentableSqft * 100
    };
  });

  // Step 5: Calculate projected GPR
  const projectedGPR = units.reduce((sum, u) => {
    const climateRevenue = u.climateControlledCount * u.climateRate;
    const nonClimateRevenue = u.nonClimateCount * u.monthlyRate;
    return sum + climateRevenue + nonClimateRevenue;
  }, 0);

  return {
    units: units,
    totalUnits: units.reduce((sum, u) => sum + u.count, 0),
    totalSqft: units.reduce((sum, u) => sum + (u.count * u.sqft), 0),
    climateControlledSqft: units.reduce((sum, u) => sum + (u.climateControlledCount * u.sqft), 0),
    projectedGPR: projectedGPR,
    avgRentPerSqft: projectedGPR / input.netRentableSqft,
    revenueBySize: Object.fromEntries(units.map(u => [u.size, u.count * u.monthlyRate])),
    optimizationScore: calculateOptimizationScore(units, sizeScores)
  };
}
```

**Unit Size Reference:**
```typescript
const UNIT_SIZES = [
  { name: '5x5',   sqft: 25,  defaultRentPerSqft: 3.00, demandTier: 'high' },
  { name: '5x10',  sqft: 50,  defaultRentPerSqft: 2.40, demandTier: 'high' },
  { name: '10x10', sqft: 100, defaultRentPerSqft: 1.85, demandTier: 'highest' },
  { name: '10x15', sqft: 150, defaultRentPerSqft: 1.55, demandTier: 'high' },
  { name: '10x20', sqft: 200, defaultRentPerSqft: 1.30, demandTier: 'medium' },
  { name: '10x30', sqft: 300, defaultRentPerSqft: 1.05, demandTier: 'low' }
];
```

**Output Contract:**
```typescript
interface OptimizedUnitMix {
  units: UnitAllocation[];
  totalUnits: number;
  totalSqft: number;
  climateControlledSqft: number;
  projectedGPR: number;         // Monthly Gross Potential Revenue
  avgRentPerSqft: number;
  revenueBySize: Record<string, number>;
  optimizationScore: number;    // 0-100
}

interface UnitAllocation {
  size: string;
  sqft: number;
  count: number;
  climateControlledCount: number;
  nonClimateCount: number;
  monthlyRate: number;
  climateRate: number;
  rentPerSqft: number;
  percentOfMix: number;
}
```

---

### Step 4: PhasePlanner (SS.03.04)

**Purpose:** Plan construction phases to minimize upfront investment and achieve 85% occupancy triggers between phases.

**Input Contract:**
```typescript
interface PhasePlannerInput {
  // From UnitMixOptimizer
  unitMix: OptimizedUnitMix;
  totalUnits: number;

  // From CoverageEngine
  constructionType: ConstructionType;
  netRentableSqft: number;

  // Absorption data from Pass-2
  marketAbsorption: {
    monthlyAbsorptionRate: number;   // units/month
    averageLeasupMonths: number;
  };

  // Site constraints
  acreage: number;
}
```

**Processing Logic:**

```typescript
async function executePhasePlanner(input: PhasePlannerInput): Promise<PhaseResult> {
  // Step 1: Determine if phasing is appropriate
  const shouldPhase = input.totalUnits > 100 && input.acreage >= 3;

  if (!shouldPhase) {
    // Single phase build
    return createSinglePhasePlan(input);
  }

  // Step 2: Calculate optimal phase size
  // Target: 85% occupancy before Phase 2 trigger
  const phase1TargetUnits = Math.min(
    Math.max(40, Math.ceil(input.totalUnits * 0.35)),  // 35-45% of total
    120  // Max 120 units Phase 1
  );

  // Step 3: Time to stabilization (85%)
  const phase1Absorption = input.marketAbsorption.monthlyAbsorptionRate;
  const phase1Stabilization = Math.ceil((phase1TargetUnits * 0.85) / phase1Absorption);

  // Step 4: Build phase plans
  const phases: PhasePlan[] = [];
  let remainingUnits = input.totalUnits;
  let phaseNumber = 1;
  let cumulativeMonths = 0;

  while (remainingUnits > 0) {
    const phaseUnits = phaseNumber === 1
      ? phase1TargetUnits
      : Math.min(remainingUnits, Math.ceil(input.totalUnits * 0.30));

    const constructionMonths = phaseNumber === 1 ? 6 : 4;  // Phase 1 takes longer
    const stabilizationMonths = Math.ceil((phaseUnits * 0.85) / phase1Absorption);

    phases.push({
      phase: phaseNumber,
      units: phaseUnits,
      sqft: calculatePhaseSqft(phaseUnits, input.unitMix),
      constructionStart: cumulativeMonths,
      constructionEnd: cumulativeMonths + constructionMonths,
      stabilizationTarget: cumulativeMonths + constructionMonths + stabilizationMonths,
      occupancyTrigger: 0.85,
      estimatedCost: 0  // Calculated by BuildCostModel
    });

    remainingUnits -= phaseUnits;
    cumulativeMonths += constructionMonths + stabilizationMonths;
    phaseNumber++;

    if (phaseNumber > 4) break;  // Max 4 phases
  }

  return {
    phases: phases,
    totalPhases: phases.length,
    phase1Timeline: {
      constructionMonths: 6,
      stabilizationMonths: phases[0]?.stabilizationTarget - 6 || 12,
      totalToStabilization: phases[0]?.stabilizationTarget || 18
    },
    totalProjectTimeline: cumulativeMonths,
    stabilizationOccupancy: 0.85,
    absorptionAssumption: input.marketAbsorption.monthlyAbsorptionRate,
    warnings: []
  };
}
```

**Output Contract:**
```typescript
interface PhaseResult {
  phases: PhasePlan[];
  totalPhases: number;
  phase1Timeline: {
    constructionMonths: number;
    stabilizationMonths: number;
    totalToStabilization: number;
  };
  totalProjectTimeline: number;
  stabilizationOccupancy: number;
  absorptionAssumption: number;
  warnings: string[];
}

interface PhasePlan {
  phase: number;
  units: number;
  sqft: number;
  constructionStart: number;     // months from project start
  constructionEnd: number;
  stabilizationTarget: number;   // months from project start
  occupancyTrigger: number;
  estimatedCost: number;         // Populated by BuildCostModel
}
```

---

### Step 5: BuildCostModel (SS.03.05)

**Purpose:** Calculate total construction costs including hard costs, soft costs, dirt work, and contingency. Enforce Barton Doctrine $27/sqft maximum and 20% dirt work kill switch.

**Input Contract:**
```typescript
interface BuildCostInput {
  // From CoverageEngine
  totalBuildableSqft: number;
  constructionType: ConstructionType;

  // From UnitMixOptimizer
  climateControlledSqft: number;
  climateControlledPct: number;

  // From PhasePlanner
  phases: PhasePlan[];

  // From Pass-2 Civil Constraints
  siteConditions: {
    slope: number;              // percentage
    soilType: 'standard' | 'rock' | 'fill_required';
    demolitionRequired: boolean;
    utilitiesOnSite: boolean;
    floodMitigation: boolean;
  };

  // Location
  state: string;
  county: string;
  isMetro: boolean;
  acreage: number;
}
```

**Processing Logic:**

```typescript
async function executeBuildCostModel(input: BuildCostInput): Promise<BuildCostResult> {
  // Step 1: Get regional cost factor
  const regionalFactor = getRegionalFactor(input.state, input.county, input.isMetro);

  // Step 2: Calculate base building cost
  const baseBuildingCostPerSqft = input.constructionType === 'multi_story' ? 18.00 : 15.00;

  // Step 3: Climate control premium ($3/sqft for CC areas)
  const climatePremiumTotal = input.climateControlledSqft * 3.00;

  // Step 4: Calculate hard costs
  const buildingCost = input.totalBuildableSqft * baseBuildingCostPerSqft * regionalFactor;
  const pavingCost = input.acreage * 43560 * 0.15 * 2.50;  // 15% paved at $2.50/sqft
  const utilityCost = input.siteConditions.utilitiesOnSite
    ? input.totalBuildableSqft * 0.75
    : input.totalBuildableSqft * 2.25;
  const siteworkCost = input.acreage * 15000;  // $15K/acre baseline

  const totalHardCost = buildingCost + climatePremiumTotal + pavingCost + utilityCost + siteworkCost;

  // Step 5: Calculate dirt work separately (Kill Switch tracking)
  let dirtWorkCost = 0;
  dirtWorkCost += input.siteConditions.slope * 0.50 * input.totalBuildableSqft;  // $0.50/sqft per % slope
  if (input.siteConditions.soilType === 'rock') {
    dirtWorkCost += input.totalBuildableSqft * 3.00;
  } else if (input.siteConditions.soilType === 'fill_required') {
    dirtWorkCost += input.totalBuildableSqft * 2.50;
  }
  if (input.siteConditions.demolitionRequired) {
    dirtWorkCost += 25000;  // Flat demo cost
  }
  dirtWorkCost *= regionalFactor;

  // Step 6: Calculate soft costs
  const permitFees = input.totalBuildableSqft * 0.50;
  const architecturalDesign = input.totalBuildableSqft * 1.00;
  const engineering = input.totalBuildableSqft * 0.75;
  const legalFees = 15000;
  const totalSoftCost = permitFees + architecturalDesign + engineering + legalFees;

  // Step 7: Calculate totals
  const subtotal = totalHardCost + dirtWorkCost + totalSoftCost;
  const contingencyPct = input.siteConditions.slope > 10 ? 0.10 : 0.05;
  const contingency = subtotal * contingencyPct;
  const totalProjectCost = subtotal + contingency;
  const costPerSqft = totalProjectCost / input.totalBuildableSqft;

  // Step 8: Doctrine compliance checks
  const dirtWorkPct = (dirtWorkCost / totalProjectCost) * 100;
  const warnings: string[] = [];
  const fatalFlaws: FatalFlaw[] = [];

  if (costPerSqft > 27) {
    fatalFlaws.push({
      code: 'BUILD_COST_EXCEEDS_MAXIMUM',
      severity: 'critical',
      message: `Build cost of $${costPerSqft.toFixed(2)}/sqft exceeds $27/sqft maximum`
    });
  } else if (costPerSqft > 25) {
    warnings.push(`Build cost of $${costPerSqft.toFixed(2)}/sqft approaching $27/sqft maximum`);
  }

  if (dirtWorkPct > 20) {
    fatalFlaws.push({
      code: 'EXCESSIVE_DIRT_WORK',
      severity: 'critical',
      message: `Dirt work at ${dirtWorkPct.toFixed(1)}% exceeds 20% maximum - WALK RECOMMENDED`
    });
  } else if (dirtWorkPct > 15) {
    warnings.push(`Dirt work at ${dirtWorkPct.toFixed(1)}% approaching 20% kill switch`);
  }

  // Step 9: Allocate costs to phases
  const phaseCosts = input.phases.map((phase, idx) => {
    const phaseRatio = phase.sqft / input.totalBuildableSqft;
    return {
      phase: phase.phase,
      cost: totalProjectCost * phaseRatio * (idx === 0 ? 1.1 : 1.0)  // Phase 1 has 10% premium
    };
  });

  return {
    hardCosts: {
      building: buildingCost,
      climatePremium: climatePremiumTotal,
      paving: pavingCost,
      utilities: utilityCost,
      sitework: siteworkCost,
      total: totalHardCost,
      perSqft: totalHardCost / input.totalBuildableSqft
    },
    dirtWork: {
      grading: dirtWorkCost * 0.6,
      excavation: dirtWorkCost * 0.3,
      demolition: input.siteConditions.demolitionRequired ? 25000 : 0,
      other: dirtWorkCost * 0.1,
      total: dirtWorkCost,
      percentOfProject: dirtWorkPct
    },
    softCosts: {
      permits: permitFees,
      architectural: architecturalDesign,
      engineering: engineering,
      legal: legalFees,
      total: totalSoftCost,
      perSqft: totalSoftCost / input.totalBuildableSqft
    },
    contingency: {
      amount: contingency,
      percentage: contingencyPct * 100
    },
    totals: {
      subtotal: subtotal,
      contingency: contingency,
      totalProjectCost: totalProjectCost,
      costPerSqft: costPerSqft
    },
    phaseCosts: phaseCosts,
    regionalFactor: regionalFactor,
    passesDoctrineMaximum: costPerSqft <= 27,
    passesDirtWorkLimit: dirtWorkPct <= 20,
    fatalFlaws: fatalFlaws,
    warnings: warnings
  };
}
```

**Regional Cost Factors:**
```typescript
const REGIONAL_FACTORS: Record<string, number> = {
  'TX_nonmetro': 0.85,
  'TX_metro': 1.00,
  'OK': 0.82,
  'AR': 0.80,
  'LA': 0.88,
  'NM': 0.90,
  'AZ': 0.95,
  'CO': 1.05,
  'FL': 1.00,
  'GA': 0.92,
  'TN': 0.88,
  'NC': 0.90,
  'default': 1.00
};
```

**Output Contract:**
```typescript
interface BuildCostResult {
  hardCosts: {
    building: number;
    climatePremium: number;
    paving: number;
    utilities: number;
    sitework: number;
    total: number;
    perSqft: number;
  };
  dirtWork: {
    grading: number;
    excavation: number;
    demolition: number;
    other: number;
    total: number;
    percentOfProject: number;
  };
  softCosts: {
    permits: number;
    architectural: number;
    engineering: number;
    legal: number;
    total: number;
    perSqft: number;
  };
  contingency: {
    amount: number;
    percentage: number;
  };
  totals: {
    subtotal: number;
    contingency: number;
    totalProjectCost: number;
    costPerSqft: number;
  };
  phaseCosts: { phase: number; cost: number }[];
  regionalFactor: number;
  passesDoctrineMaximum: boolean;
  passesDirtWorkLimit: boolean;
  fatalFlaws: FatalFlaw[];
  warnings: string[];
}
```

---

### Step 6: NOIEngine (SS.03.06)

**Purpose:** Calculate Gross Potential Revenue, vacancy adjustments, Effective Gross Income, operating expenses, and Net Operating Income. Enforce Barton Doctrine $5,000/acre/month minimum.

**Input Contract:**
```typescript
interface NOIEngineInput {
  // From UnitMixOptimizer
  projectedGPR: number;          // Monthly
  totalUnits: number;

  // From BuildCostModel
  totalProjectCost: number;

  // From PhasePlanner
  phases: PhasePlan[];

  // Property details
  acreage: number;

  // Operating assumptions
  assumptions: {
    vacancyRate: number;         // Default 10%
    collectionLoss: number;      // Default 2%
    opexRatio: number;           // Default 32%
    rentGrowth: number;          // Default 3%/year
    managementFee: number;       // Default 6% of EGI
  };
}
```

**Processing Logic:**

```typescript
async function executeNOIEngine(input: NOIEngineInput): Promise<NOIResult> {
  const {
    projectedGPR,
    acreage,
    assumptions: { vacancyRate, collectionLoss, opexRatio, managementFee }
  } = input;

  // Step 1: Calculate annual GPR
  const annualGPR = projectedGPR * 12;

  // Step 2: Apply vacancy (10% standard for stabilized)
  const vacancyLoss = annualGPR * vacancyRate;
  const afterVacancy = annualGPR - vacancyLoss;

  // Step 3: Apply collection loss (2%)
  const collectionLossAmount = afterVacancy * collectionLoss;
  const effectiveGrossIncome = afterVacancy - collectionLossAmount;

  // Step 4: Calculate operating expenses
  const operatingExpenses = effectiveGrossIncome * opexRatio;
  const managementFeeAmount = effectiveGrossIncome * managementFee;
  const totalOpex = operatingExpenses;  // Management included in opex ratio

  // Step 5: Calculate NOI
  const netOperatingIncome = effectiveGrossIncome - totalOpex;

  // Step 6: Calculate per-acre metrics (CRITICAL for Barton Doctrine)
  const noiPerAcre = netOperatingIncome / acreage;
  const noiPerAcreMonthly = noiPerAcre / 12;

  // Step 7: Doctrine compliance check
  const warnings: string[] = [];
  const fatalFlaws: FatalFlaw[] = [];

  if (netOperatingIncome <= 0) {
    fatalFlaws.push({
      code: 'NEGATIVE_NOI',
      severity: 'critical',
      message: 'Project produces negative NOI - non-viable'
    });
  } else if (noiPerAcreMonthly < 5000) {
    fatalFlaws.push({
      code: 'NOI_BELOW_DOCTRINE',
      severity: 'critical',
      message: `NOI of $${noiPerAcreMonthly.toFixed(0)}/acre/month is below $5,000 minimum`
    });
  } else if (noiPerAcreMonthly < 6000) {
    warnings.push(`NOI of $${noiPerAcreMonthly.toFixed(0)}/acre/month is marginally above $5,000 minimum`);
  }

  // Step 8: Calculate stressed NOI (25% haircut per Doctrine)
  const stressedNOI = netOperatingIncome * 0.75;
  const stressedNoiPerAcreMonthly = (stressedNOI / acreage) / 12;

  // Step 9: Calculate cap rate (based on project cost)
  const impliedCapRate = (netOperatingIncome / input.totalProjectCost) * 100;

  // Step 10: Build 5-year projection
  const fiveYearProjection: YearlyProjection[] = [];
  let currentGPR = annualGPR;

  for (let year = 1; year <= 5; year++) {
    const yearVacancy = year === 1 ? 0.15 : vacancyRate;  // Higher Y1 vacancy
    const yearGPR = currentGPR;
    const yearEGI = yearGPR * (1 - yearVacancy) * (1 - collectionLoss);
    const yearOpex = yearEGI * opexRatio;
    const yearNOI = yearEGI - yearOpex;

    fiveYearProjection.push({
      year,
      gpr: yearGPR,
      vacancy: yearVacancy,
      egi: yearEGI,
      opex: yearOpex,
      noi: yearNOI
    });

    currentGPR *= (1 + input.assumptions.rentGrowth);
  }

  return {
    revenue: {
      grossPotentialRent: annualGPR,
      monthlyGPR: projectedGPR,
      vacancyLoss: vacancyLoss,
      collectionLoss: collectionLossAmount,
      effectiveGrossIncome: effectiveGrossIncome
    },
    expenses: {
      operatingExpenses: operatingExpenses,
      managementFee: managementFeeAmount,
      totalOpex: totalOpex,
      opexRatio: opexRatio * 100
    },
    noi: {
      annual: netOperatingIncome,
      monthly: netOperatingIncome / 12,
      perAcre: noiPerAcre,
      perAcreMonthly: noiPerAcreMonthly
    },
    stressed: {
      noi: stressedNOI,
      perAcreMonthly: stressedNoiPerAcreMonthly,
      haircut: 25
    },
    metrics: {
      impliedCapRate: impliedCapRate,
      revenuePerUnit: annualGPR / input.totalUnits,
      opexPerUnit: totalOpex / input.totalUnits
    },
    fiveYearProjection: fiveYearProjection,
    meetsDoctrineMinimum: noiPerAcreMonthly >= 5000,
    survivesStressTest: stressedNoiPerAcreMonthly >= 5000,
    fatalFlaws: fatalFlaws,
    warnings: warnings
  };
}
```

**Output Contract:**
```typescript
interface NOIResult {
  revenue: {
    grossPotentialRent: number;
    monthlyGPR: number;
    vacancyLoss: number;
    collectionLoss: number;
    effectiveGrossIncome: number;
  };
  expenses: {
    operatingExpenses: number;
    managementFee: number;
    totalOpex: number;
    opexRatio: number;
  };
  noi: {
    annual: number;
    monthly: number;
    perAcre: number;
    perAcreMonthly: number;
  };
  stressed: {
    noi: number;
    perAcreMonthly: number;
    haircut: number;
  };
  metrics: {
    impliedCapRate: number;
    revenuePerUnit: number;
    opexPerUnit: number;
  };
  fiveYearProjection: YearlyProjection[];
  meetsDoctrineMinimum: boolean;
  survivesStressTest: boolean;
  fatalFlaws: FatalFlaw[];
  warnings: string[];
}
```

---

### Step 7: DebtModel (SS.03.07)

**Purpose:** Calculate loan amount, debt service, DSCR, and LTV. Enforce Barton Doctrine DSCR >= 1.25 minimum.

**Input Contract:**
```typescript
interface DebtModelInput {
  // From BuildCostModel
  totalProjectCost: number;

  // From NOIEngine
  netOperatingIncome: number;
  stressedNOI: number;

  // Debt assumptions
  debtAssumptions: {
    interestRate: number;          // Default 6.0%
    amortizationYears: number;     // Default 25
    targetLTV: number;             // Default 65%
    maxLTV: number;                // Default 75%
    minDSCR: number;               // Default 1.25
  };
}
```

**Processing Logic:**

```typescript
async function executeDebtModel(input: DebtModelInput): Promise<DebtResult> {
  const {
    totalProjectCost,
    netOperatingIncome,
    stressedNOI,
    debtAssumptions: { interestRate, amortizationYears, targetLTV, maxLTV, minDSCR }
  } = input;

  // Step 1: Calculate max loan by LTV
  const maxLoanByLTV = totalProjectCost * maxLTV;

  // Step 2: Calculate max loan by DSCR
  // Debt Service = NOI / DSCR
  const maxDebtService = netOperatingIncome / minDSCR;
  const monthlyRate = interestRate / 12;
  const payments = amortizationYears * 12;

  // Loan amount from debt service using mortgage formula
  // P = (DS * (1 - (1 + r)^-n)) / r
  const maxLoanByDSCR = (maxDebtService / 12) *
    ((1 - Math.pow(1 + monthlyRate, -payments)) / monthlyRate);

  // Step 3: Constrain loan to lesser of LTV and DSCR limits
  const constrainedLoanAmount = Math.min(maxLoanByLTV, maxLoanByDSCR);
  const targetLoanAmount = totalProjectCost * targetLTV;
  const recommendedLoan = Math.min(targetLoanAmount, constrainedLoanAmount);

  // Step 4: Calculate actual debt service
  const annualDebtService = calculateAnnualDebtService(
    recommendedLoan, interestRate, amortizationYears
  );

  // Step 5: Calculate actual DSCR
  const actualDSCR = netOperatingIncome / annualDebtService;
  const stressedDSCR = stressedNOI / annualDebtService;

  // Step 6: Calculate equity required
  const equityRequired = totalProjectCost - recommendedLoan;
  const actualLTV = (recommendedLoan / totalProjectCost) * 100;

  // Step 7: Doctrine compliance check
  const warnings: string[] = [];
  const fatalFlaws: FatalFlaw[] = [];

  if (actualDSCR < minDSCR) {
    fatalFlaws.push({
      code: 'DSCR_BELOW_MINIMUM',
      severity: 'critical',
      message: `DSCR of ${actualDSCR.toFixed(2)}x is below ${minDSCR}x minimum`
    });
  } else if (actualDSCR < 1.40) {
    warnings.push(`DSCR of ${actualDSCR.toFixed(2)}x is marginally above 1.25x minimum`);
  }

  if (stressedDSCR < 1.10) {
    warnings.push(`Stressed DSCR of ${stressedDSCR.toFixed(2)}x is below 1.10x - refinance risk`);
  }

  // Step 8: Build amortization schedule (first 5 years)
  const amortizationSchedule = buildAmortizationSchedule(
    recommendedLoan, interestRate, amortizationYears, 5
  );

  return {
    loan: {
      amount: recommendedLoan,
      maxByLTV: maxLoanByLTV,
      maxByDSCR: maxLoanByDSCR,
      constrainingFactor: maxLoanByDSCR < maxLoanByLTV ? 'DSCR' : 'LTV'
    },
    equity: {
      required: equityRequired,
      percentOfProject: (equityRequired / totalProjectCost) * 100
    },
    terms: {
      interestRate: interestRate,
      amortizationYears: amortizationYears,
      ltv: actualLTV
    },
    debtService: {
      annual: annualDebtService,
      monthly: annualDebtService / 12
    },
    coverage: {
      dscr: actualDSCR,
      stressedDSCR: stressedDSCR,
      meetsMinimum: actualDSCR >= minDSCR,
      cushion: ((actualDSCR - minDSCR) / minDSCR) * 100
    },
    amortizationSchedule: amortizationSchedule,
    fatalFlaws: fatalFlaws,
    warnings: warnings
  };
}

function calculateAnnualDebtService(
  principal: number,
  rate: number,
  years: number
): number {
  const monthlyRate = rate / 12;
  const payments = years * 12;
  const monthlyPayment = principal *
    (monthlyRate * Math.pow(1 + monthlyRate, payments)) /
    (Math.pow(1 + monthlyRate, payments) - 1);
  return monthlyPayment * 12;
}
```

**Output Contract:**
```typescript
interface DebtResult {
  loan: {
    amount: number;
    maxByLTV: number;
    maxByDSCR: number;
    constrainingFactor: 'LTV' | 'DSCR';
  };
  equity: {
    required: number;
    percentOfProject: number;
  };
  terms: {
    interestRate: number;
    amortizationYears: number;
    ltv: number;
  };
  debtService: {
    annual: number;
    monthly: number;
  };
  coverage: {
    dscr: number;
    stressedDSCR: number;
    meetsMinimum: boolean;
    cushion: number;
  };
  amortizationSchedule: AmortizationYear[];
  fatalFlaws: FatalFlaw[];
  warnings: string[];
}
```

---

### Step 8: MaxLandPrice (SS.03.08)

**Purpose:** Calculate the maximum price that can be paid for the land based on residual land value analysis. This ensures the project still meets return thresholds.

**Input Contract:**
```typescript
interface MaxLandPriceInput {
  // From BuildCostModel
  totalProjectCost: number;       // Excluding land

  // From NOIEngine
  netOperatingIncome: number;

  // From DebtModel
  loanAmount: number;
  debtService: number;

  // Target returns
  targets: {
    targetCapRate: number;        // Default 7%
    minimumCapRate: number;       // Default 6.5%
    targetIRR: number;            // Default 18%
    holdPeriod: number;           // Default 5 years
    exitCapRate: number;          // Default 7.5%
  };

  // Land asking price (if known)
  askingPrice?: number;
  acreage: number;
}
```

**Processing Logic:**

```typescript
async function executeMaxLandPrice(input: MaxLandPriceInput): Promise<MaxLandPriceResult> {
  const {
    totalProjectCost,
    netOperatingIncome,
    targets: { targetCapRate, minimumCapRate, targetIRR, holdPeriod, exitCapRate },
    askingPrice,
    acreage
  } = input;

  // Step 1: Calculate max project value at target cap rate
  // Project Value = NOI / Cap Rate
  const targetProjectValue = netOperatingIncome / targetCapRate;
  const minimumProjectValue = netOperatingIncome / minimumCapRate;

  // Step 2: Residual land value = Project Value - Build Costs
  const targetResidualLand = targetProjectValue - totalProjectCost;
  const maxResidualLand = minimumProjectValue - totalProjectCost;

  // Step 3: Per-acre calculations
  const targetPerAcre = targetResidualLand / acreage;
  const maxPerAcre = maxResidualLand / acreage;

  // Step 4: Compare to asking price
  let askingAnalysis: AskingAnalysis | null = null;
  if (askingPrice) {
    const askingPerAcre = askingPrice / acreage;
    const totalWithAsking = totalProjectCost + askingPrice;
    const impliedCapRate = netOperatingIncome / totalWithAsking;

    askingAnalysis = {
      askingPrice,
      askingPerAcre,
      impliedCapRate: impliedCapRate * 100,
      meetsTargetCap: impliedCapRate >= targetCapRate,
      meetsMinimumCap: impliedCapRate >= minimumCapRate,
      overpayAmount: askingPrice > maxResidualLand ? askingPrice - maxResidualLand : 0,
      recommendation: getAskingRecommendation(impliedCapRate, targetCapRate, minimumCapRate)
    };
  }

  // Step 5: IRR-based land price (what can we pay and hit target IRR)
  const irrBasedMax = calculateIRRBasedLandMax(
    totalProjectCost,
    netOperatingIncome,
    input.loanAmount,
    input.debtService,
    targetIRR,
    holdPeriod,
    exitCapRate
  );

  // Step 6: Determine final max land price (most conservative)
  const maxLandPrice = Math.min(maxResidualLand, irrBasedMax);

  // Step 7: Warnings
  const warnings: string[] = [];
  if (maxLandPrice < 0) {
    warnings.push('Project does not support positive land value at minimum returns');
  }
  if (askingPrice && askingPrice > maxLandPrice) {
    warnings.push(`Asking price of $${askingPrice.toLocaleString()} exceeds max land price of $${maxLandPrice.toLocaleString()}`);
  }

  return {
    residualAnalysis: {
      targetValue: targetResidualLand,
      targetPerAcre: targetPerAcre,
      maxValue: maxResidualLand,
      maxPerAcre: maxPerAcre,
      targetCapRate: targetCapRate * 100,
      minimumCapRate: minimumCapRate * 100
    },
    irrAnalysis: {
      maxLandForTargetIRR: irrBasedMax,
      targetIRR: targetIRR * 100,
      holdPeriod,
      exitCapRate: exitCapRate * 100
    },
    recommendation: {
      maxLandPrice: maxLandPrice,
      maxPerAcre: maxLandPrice / acreage,
      constrainingFactor: irrBasedMax < maxResidualLand ? 'IRR' : 'CAP_RATE'
    },
    askingAnalysis: askingAnalysis,
    warnings: warnings
  };
}

function getAskingRecommendation(
  impliedCap: number,
  targetCap: number,
  minCap: number
): string {
  if (impliedCap >= targetCap) {
    return 'PROCEED - Asking price meets target returns';
  } else if (impliedCap >= minCap) {
    return 'NEGOTIATE - Asking price meets minimum but below target';
  } else {
    return 'WALK OR HEAVY NEGOTIATION - Asking price does not meet minimum returns';
  }
}
```

**Output Contract:**
```typescript
interface MaxLandPriceResult {
  residualAnalysis: {
    targetValue: number;
    targetPerAcre: number;
    maxValue: number;
    maxPerAcre: number;
    targetCapRate: number;
    minimumCapRate: number;
  };
  irrAnalysis: {
    maxLandForTargetIRR: number;
    targetIRR: number;
    holdPeriod: number;
    exitCapRate: number;
  };
  recommendation: {
    maxLandPrice: number;
    maxPerAcre: number;
    constrainingFactor: 'IRR' | 'CAP_RATE';
  };
  askingAnalysis: AskingAnalysis | null;
  warnings: string[];
}

interface AskingAnalysis {
  askingPrice: number;
  askingPerAcre: number;
  impliedCapRate: number;
  meetsTargetCap: boolean;
  meetsMinimumCap: boolean;
  overpayAmount: number;
  recommendation: string;
}
```

---

### Step 9: IRRModel (SS.03.09)

**Purpose:** Calculate project-level returns including Unlevered IRR, Levered IRR, Equity Multiple, NPV, and Cash-on-Cash returns. This is the final financial validation spoke.

**Input Contract:**
```typescript
interface IRRModelInput {
  // From BuildCostModel
  totalProjectCost: number;
  phaseCosts: { phase: number; cost: number }[];

  // From MaxLandPrice
  landCost: number;              // Recommended max or actual asking

  // From DebtModel
  loanAmount: number;
  equityRequired: number;
  annualDebtService: number;
  interestRate: number;
  amortizationYears: number;

  // From NOIEngine
  netOperatingIncome: number;
  fiveYearProjection: YearlyProjection[];

  // From PhasePlanner
  phases: PhasePlan[];

  // Assumptions
  assumptions: {
    holdPeriod: number;           // Default 5 years
    exitCapRate: number;          // Default 7.5%
    sellingCosts: number;         // Default 3%
    discountRate: number;         // Default 10% for NPV
    noiGrowth: number;            // Default 3%
  };
}
```

**Processing Logic:**

```typescript
async function executeIRRModel(input: IRRModelInput): Promise<IRRResult> {
  const {
    totalProjectCost,
    landCost,
    loanAmount,
    equityRequired,
    annualDebtService,
    interestRate,
    amortizationYears,
    netOperatingIncome,
    fiveYearProjection,
    assumptions: { holdPeriod, exitCapRate, sellingCosts, discountRate, noiGrowth }
  } = input;

  const totalInvestment = totalProjectCost + landCost;
  const totalEquity = totalInvestment - loanAmount;

  // Step 1: Build unlevered cash flows
  const unleveredCashFlows: number[] = [-totalInvestment];

  // Step 2: Build levered cash flows
  const leveredCashFlows: number[] = [-totalEquity];

  // Step 3: Operating years cash flows
  const yearlyDebtService: number[] = [];
  const cashOnCashByYear: number[] = [];

  let currentNOI = netOperatingIncome;
  for (let year = 1; year <= holdPeriod; year++) {
    // Use projection if available, otherwise grow NOI
    const yearNOI = fiveYearProjection[year - 1]?.noi || currentNOI;

    // Unlevered = NOI only
    unleveredCashFlows.push(yearNOI);

    // Levered = NOI - Debt Service
    const leveredCF = yearNOI - annualDebtService;
    leveredCashFlows.push(leveredCF);

    yearlyDebtService.push(annualDebtService);
    cashOnCashByYear.push((leveredCF / totalEquity) * 100);

    currentNOI *= (1 + noiGrowth);
  }

  // Step 4: Calculate exit value
  const exitYearNOI = fiveYearProjection[holdPeriod - 1]?.noi || currentNOI;
  const terminalNOI = exitYearNOI * (1 + noiGrowth);  // Forward NOI
  const salePrice = terminalNOI / exitCapRate;
  const netSaleProceeds = salePrice * (1 - sellingCosts);

  // Step 5: Calculate loan balance at exit
  const loanBalance = calculateLoanBalance(
    loanAmount, interestRate, amortizationYears, holdPeriod
  );

  // Step 6: Add exit proceeds to final year
  unleveredCashFlows[holdPeriod] += netSaleProceeds;
  leveredCashFlows[holdPeriod] += (netSaleProceeds - loanBalance);

  // Step 7: Calculate IRR using Newton-Raphson
  const unleveredIRR = calculateIRRFromCashFlows(unleveredCashFlows);
  const leveredIRR = calculateIRRFromCashFlows(leveredCashFlows);

  // Step 8: Calculate NPV
  const npv = calculateNPV(leveredCashFlows, discountRate);

  // Step 9: Calculate Equity Multiple
  const totalCashReturned = leveredCashFlows.slice(1).reduce((a, b) => a + b, 0);
  const equityMultiple = totalCashReturned / totalEquity;

  // Step 10: Calculate average cash-on-cash
  const avgCashOnCash = cashOnCashByYear.reduce((a, b) => a + b, 0) / holdPeriod;

  // Step 11: Total profit
  const totalProfit = totalCashReturned - totalEquity;

  // Step 12: Threshold compliance
  const warnings: string[] = [];
  const meetsThresholds = {
    unleveredIRR: unleveredIRR >= 0.08,      // 8% minimum
    leveredIRR: leveredIRR >= 0.12,          // 12% minimum
    equityMultiple: equityMultiple >= 1.5,  // 1.5x minimum
    cashOnCash: cashOnCashByYear[0] >= 6    // 6% Y1 minimum
  };

  const meetsMinimumThresholds = Object.values(meetsThresholds).every(v => v);

  if (!meetsThresholds.leveredIRR) {
    warnings.push(`Levered IRR of ${(leveredIRR * 100).toFixed(1)}% is below 12% minimum`);
  }
  if (!meetsThresholds.equityMultiple) {
    warnings.push(`Equity multiple of ${equityMultiple.toFixed(2)}x is below 1.5x minimum`);
  }
  if (!meetsThresholds.cashOnCash) {
    warnings.push(`Year 1 cash-on-cash of ${cashOnCashByYear[0]?.toFixed(1)}% is below 6% minimum`);
  }

  // Step 13: Sensitivity analysis
  const sensitivity = calculateSensitivity(input, unleveredCashFlows, leveredCashFlows);

  return {
    cashFlows: {
      unlevered: unleveredCashFlows,
      levered: leveredCashFlows,
      debtService: yearlyDebtService
    },
    returns: {
      unleveredIRR: unleveredIRR * 100,
      leveredIRR: leveredIRR * 100,
      npv: npv,
      equityMultiple: equityMultiple
    },
    cashOnCash: {
      byYear: cashOnCashByYear,
      average: avgCashOnCash
    },
    exit: {
      salePrice: salePrice,
      netProceeds: netSaleProceeds,
      loanPayoff: loanBalance,
      equityProceeds: netSaleProceeds - loanBalance,
      exitCapRate: exitCapRate * 100,
      terminalNOI: terminalNOI
    },
    profit: {
      totalProfit: totalProfit,
      profitOnCost: (totalProfit / totalInvestment) * 100
    },
    thresholds: meetsThresholds,
    meetsMinimumThresholds: meetsMinimumThresholds,
    sensitivity: sensitivity,
    warnings: warnings
  };
}

function calculateIRRFromCashFlows(cashFlows: number[]): number {
  // Newton-Raphson method for IRR
  let rate = 0.10;  // Initial guess 10%
  const maxIterations = 100;
  const tolerance = 0.0001;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + rate, t);
      if (t > 0) {
        derivative -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
      }
    }

    const newRate = rate - npv / derivative;

    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }

    rate = newRate;
  }

  return rate;
}

function calculateLoanBalance(
  principal: number,
  rate: number,
  amortYears: number,
  yearsElapsed: number
): number {
  const monthlyRate = rate / 12;
  const totalPayments = amortYears * 12;
  const paymentsMade = yearsElapsed * 12;

  const monthlyPayment = principal *
    (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) /
    (Math.pow(1 + monthlyRate, totalPayments) - 1);

  const balance = principal * Math.pow(1 + monthlyRate, paymentsMade) -
    monthlyPayment * ((Math.pow(1 + monthlyRate, paymentsMade) - 1) / monthlyRate);

  return Math.max(0, balance);
}
```

**Sensitivity Analysis:**
```typescript
function calculateSensitivity(
  input: IRRModelInput,
  baseUnlevered: number[],
  baseLevered: number[]
): SensitivityAnalysis {
  const scenarios: SensitivityAnalysis = {
    exitCapRate: {},
    noiGrowth: {},
    holdPeriod: {}
  };

  // Exit cap rate scenarios
  [0.065, 0.070, 0.075, 0.080, 0.085].forEach(cap => {
    const adjustedCF = [...baseLevered];
    const exitNOI = input.netOperatingIncome * Math.pow(1 + input.assumptions.noiGrowth, input.assumptions.holdPeriod);
    const newSalePrice = exitNOI / cap;
    const netProceeds = newSalePrice * (1 - input.assumptions.sellingCosts);
    const loanBal = calculateLoanBalance(input.loanAmount, input.interestRate, input.amortizationYears, input.assumptions.holdPeriod);
    adjustedCF[input.assumptions.holdPeriod] = baseLevered[input.assumptions.holdPeriod] - (baseLevered[input.assumptions.holdPeriod] - adjustedCF[input.assumptions.holdPeriod]) + (netProceeds - loanBal);
    scenarios.exitCapRate[cap * 100] = calculateIRRFromCashFlows(adjustedCF) * 100;
  });

  // NOI growth scenarios
  [0.00, 0.02, 0.03, 0.04, 0.05].forEach(growth => {
    scenarios.noiGrowth[growth * 100] = calculateIRRWithGrowth(input, growth) * 100;
  });

  // Hold period scenarios
  [3, 5, 7, 10].forEach(years => {
    scenarios.holdPeriod[years] = calculateIRRWithHoldPeriod(input, years) * 100;
  });

  return scenarios;
}
```

**Output Contract:**
```typescript
interface IRRResult {
  cashFlows: {
    unlevered: number[];
    levered: number[];
    debtService: number[];
  };
  returns: {
    unleveredIRR: number;       // Percentage
    leveredIRR: number;         // Percentage
    npv: number;                // Dollar amount
    equityMultiple: number;     // Multiple (e.g., 2.1x)
  };
  cashOnCash: {
    byYear: number[];           // Percentages
    average: number;            // Average percentage
  };
  exit: {
    salePrice: number;
    netProceeds: number;
    loanPayoff: number;
    equityProceeds: number;
    exitCapRate: number;
    terminalNOI: number;
  };
  profit: {
    totalProfit: number;
    profitOnCost: number;       // Percentage
  };
  thresholds: {
    unleveredIRR: boolean;
    leveredIRR: boolean;
    equityMultiple: boolean;
    cashOnCash: boolean;
  };
  meetsMinimumThresholds: boolean;
  sensitivity: SensitivityAnalysis;
  warnings: string[];
}

interface SensitivityAnalysis {
  exitCapRate: Record<number, number>;    // Cap rate % → IRR %
  noiGrowth: Record<number, number>;      // Growth % → IRR %
  holdPeriod: Record<number, number>;     // Years → IRR %
}
```

---

### Final Output: ProFormaPackage

After all 9 spokes complete, the orchestrator assembles the complete Pro Forma Package:

```typescript
interface ProFormaPackage {
  // Metadata
  opportunityId: string;
  pass3RunId: string;
  generatedAt: string;
  version: string;

  // Input reference
  underwritingPackage: UnderwritingPackageReference;

  // Spoke results (complete)
  setback: SetbackResult;
  coverage: CoverageResult;
  unitMix: OptimizedUnitMix;
  phasing: PhaseResult;
  buildCost: BuildCostResult;
  noi: NOIResult;
  debt: DebtResult;
  maxLandPrice: MaxLandPriceResult;
  irr: IRRResult;

  // Aggregated financials
  summary: {
    totalProjectCost: number;
    recommendedLandPrice: number;
    totalInvestment: number;
    equityRequired: number;
    loanAmount: number;
    stabilizedNOI: number;
    noiPerAcreMonthly: number;
    impliedCapRate: number;
    leveredIRR: number;
    equityMultiple: number;
    dscr: number;
  };

  // Doctrine compliance
  doctrineCompliance: {
    noiMinimum: { required: 5000; actual: number; passes: boolean };
    buildCostMax: { required: 27; actual: number; passes: boolean };
    dirtWorkMax: { required: 20; actual: number; passes: boolean };
    dscrMinimum: { required: 1.25; actual: number; passes: boolean };
    irrMinimum: { required: 12; actual: number; passes: boolean };
    equityMultipleMin: { required: 1.5; actual: number; passes: boolean };
    stressTestSurvival: { haircutPct: 25; survivesMinNOI: boolean };
    allPassing: boolean;
  };

  // Fatal flaws aggregated
  fatalFlaws: FatalFlaw[];
  warnings: string[];

  // Final recommendation
  recommendation: {
    verdict: 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'NEGOTIATE' | 'WALK';
    summary: string;
    keyRisks: string[];
    negotiationPoints: string[];
  };

  // Audit trail
  spokeExecutionLog: {
    spoke: string;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    status: 'success' | 'warning' | 'error';
  }[];
}
```

---

### Data Flow Diagram (Complete)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              PASS-3 DESIGN/CALCULATOR HUB                                │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         INPUT: UnderwritingPackage                                 │ │
│  │  {                                                                                 │ │
│  │    verdict: 'GO' | 'MAYBE',                                                        │ │
│  │    parcelId, acreage, zoningCode, setbackRequirements,                            │ │
│  │    rateEvidence, demandData, civilConstraints, ...                                │ │
│  │  }                                                                                 │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                         │                                                │
│                                         ▼                                                │
│  ┌─────────────────┐                                                                    │
│  │  1. SETBACK     │ ←─ Parcel API (Regrid)                                            │
│  │     ENGINE      │                                                                    │
│  │  ───────────────│                                                                    │
│  │  • Fetch geometry                                                                    │
│  │  • Apply setbacks                                                                    │
│  │  • Calculate buildable                                                               │
│  └────────┬────────┘                                                                    │
│           │ buildableSqft, setbackPolygon                                               │
│           ▼                                                                              │
│  ┌─────────────────┐                                                                    │
│  │  2. COVERAGE    │                                                                    │
│  │     ENGINE      │                                                                    │
│  │  ───────────────│                                                                    │
│  │  • Max footprint                                                                     │
│  │  • Construction type                                                                 │
│  │  • Net rentable sqft                                                                 │
│  └────────┬────────┘                                                                    │
│           │ netRentableSqft, constructionType                                           │
│           ▼                                                                              │
│  ┌─────────────────┐                                                                    │
│  │  3. UNIT MIX    │ ←─ Market rates from Pass-1.5                                     │
│  │     OPTIMIZER   │                                                                    │
│  │  ───────────────│                                                                    │
│  │  • Revenue optimization                                                              │
│  │  • Demand matching                                                                   │
│  │  • Climate split                                                                     │
│  └────────┬────────┘                                                                    │
│           │ unitMix[], projectedGPR                                                     │
│           ▼                                                                              │
│  ┌─────────────────┐                                                                    │
│  │  4. PHASE       │                                                                    │
│  │     PLANNER     │                                                                    │
│  │  ───────────────│                                                                    │
│  │  • Phase sizing                                                                      │
│  │  • 85% triggers                                                                      │
│  │  • Timeline                                                                          │
│  └────────┬────────┘                                                                    │
│           │ phases[], timeline                                                          │
│           ▼                                                                              │
│  ┌─────────────────┐                                                                    │
│  │  5. BUILD COST  │ ←─ Regional cost factors                                          │
│  │     MODEL       │                                                                    │
│  │  ───────────────│                                                                    │
│  │  • Hard costs                                                                        │
│  │  • Soft costs                                                                        │
│  │  • Dirt work (KILL SWITCH)                                                          │
│  │  • $27/sqft max                                                                      │
│  └────────┬────────┘                                                                    │
│           │ totalProjectCost, costPerSqft, dirtWorkPct                                  │
│           ▼                                                                              │
│  ┌─────────────────┐                                                                    │
│  │  6. NOI         │                                                                    │
│  │     ENGINE      │                                                                    │
│  │  ───────────────│                                                                    │
│  │  • GPR → EGI → NOI                                                                   │
│  │  • $5,000/acre/mo min                                                                │
│  │  • 25% stress test                                                                   │
│  └────────┬────────┘                                                                    │
│           │ netOperatingIncome, noiPerAcreMonthly                                       │
│           ▼                                                                              │
│  ┌─────────────────┐                                                                    │
│  │  7. DEBT        │                                                                    │
│  │     MODEL       │                                                                    │
│  │  ───────────────│                                                                    │
│  │  • Loan sizing (LTV/DSCR)                                                            │
│  │  • DSCR >= 1.25                                                                      │
│  │  • Debt service                                                                      │
│  └────────┬────────┘                                                                    │
│           │ loanAmount, debtService, dscr                                               │
│           ▼                                                                              │
│  ┌─────────────────┐                                                                    │
│  │  8. MAX LAND    │                                                                    │
│  │     PRICE       │                                                                    │
│  │  ───────────────│                                                                    │
│  │  • Residual value                                                                    │
│  │  • IRR-based max                                                                     │
│  │  • Asking comparison                                                                 │
│  └────────┬────────┘                                                                    │
│           │ maxLandPrice, askingAnalysis                                                │
│           ▼                                                                              │
│  ┌─────────────────┐                                                                    │
│  │  9. IRR         │                                                                    │
│  │     MODEL       │                                                                    │
│  │  ───────────────│                                                                    │
│  │  • Cash flows                                                                        │
│  │  • IRR (12% min)                                                                     │
│  │  • Equity multiple (1.5x)                                                            │
│  │  • Sensitivity                                                                       │
│  └────────┬────────┘                                                                    │
│           │ leveredIRR, equityMultiple, npv                                             │
│           ▼                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         OUTPUT: ProFormaPackage                                    │ │
│  │  {                                                                                 │ │
│  │    summary: { totalInvestment, equityRequired, leveredIRR, dscr, ... },           │ │
│  │    doctrineCompliance: { noiMinimum, buildCostMax, dscrMinimum, ... },            │ │
│  │    recommendation: { verdict: 'PROCEED' | 'NEGOTIATE' | 'WALK', ... },            │ │
│  │    fatalFlaws: [...],                                                              │ │
│  │    ... all spoke results ...                                                       │ │
│  │  }                                                                                 │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                         │                                                │
└─────────────────────────────────────────┼────────────────────────────────────────────────┘
                                          │
                                          ▼
                              ┌─────────────────────┐
                              │   Investment Memo   │
                              │   (PDF/Report)      │
                              └─────────────────────┘
                                          │
                                          ▼
                              ┌─────────────────────┐
                              │   Neon Vault        │
                              │   (PostgreSQL)      │
                              └─────────────────────┘
```

---

## 3. Spokes

| Spoke Name | Doctrine ID | Capability | Inherits Tools |
|------------|-------------|------------|----------------|
| SetbackEngine | SS.03.01 | Calculate buildable area from parcel geometry minus setbacks | geometry_engine, parcel_api |
| CoverageEngine | SS.03.02 | Max buildable sqft, coverage percentage, story calculations | coverage_calculator |
| UnitMixOptimizer | SS.03.03 | Optimize unit mix for revenue, rent/sqft by unit type | mix_optimizer |
| PhasePlanner | SS.03.04 | Phase construction timeline, 85% occupancy triggers | phase_engine |
| BuildCostModel | SS.03.05 | Hard costs, soft costs, contingency, cost per sqft | cost_calculator |
| NOIEngine | SS.03.06 | GPR, vacancy, EGI, OpEx, NOI calculations | noi_calculator |
| DebtModel | SS.03.07 | Loan amount, DSCR, LTV, debt service calculations | debt_calculator |
| MaxLandPrice | SS.03.08 | Residual land value, max acquisition price | residual_calculator |
| IRRModel | SS.03.09 | Project IRR, equity multiple, NPV, cash-on-cash | irr_calculator |

---

## 4. Connectors

| Connector | Type | Direction | Contract |
|-----------|------|-----------|----------|
| Pass-2 Handoff | Event | Inbound | Underwriting Package via Verdict spoke |
| Parcel API | API | Inbound | Parcel geometry and dimensions |
| Construction DB | API | Inbound | Regional construction costs |
| Neon Vault | API | Outbound | Write pro forma records to PostgreSQL |
| Supabase | API | Bidirectional | Read/write pass3_runs |
| Report Generator | Event | Outbound | Final investment memo output |

---

## 5. Tools

| Tool | Doctrine ID | Owner | ADR |
|------|-------------|-------|-----|
| geometry_engine | SS.03.T01 | This Hub | - |
| parcel_api | SS.03.T02 | This Hub | - |
| coverage_calculator | SS.03.T03 | This Hub | - |
| mix_optimizer | SS.03.T04 | This Hub | ADR-010 |
| phase_engine | SS.03.T05 | This Hub | - |
| cost_calculator | SS.03.T06 | This Hub | ADR-011 |
| noi_calculator | SS.03.T07 | This Hub | - |
| debt_calculator | SS.03.T08 | This Hub | - |
| residual_calculator | SS.03.T09 | This Hub | - |
| irr_calculator | SS.03.T10 | This Hub | ADR-012 |

---

## 6. Guard Rails

| Guard Rail | Type | Threshold |
|------------|------|-----------|
| Build Cost Maximum | Validation | <= $27/sqft |
| Dirt Work Maximum | Validation | <= 20% of project cost |
| DSCR Minimum | Validation | >= 1.25 |
| Phase 1 Timeline | Validation | <= 90 days to rent-ready |
| Target Cap Rate | Validation | >= 6.5% |
| Stabilization Occupancy | Validation | 85% |
| Spoke Timeout | Timeout | 60 seconds per spoke |
| Orchestrator Timeout | Timeout | 10 minutes total |

---

## 7. Kill Switch

- **Endpoint:** `/api/admin/pass3/kill`
- **Activation Criteria:**
  - Calculation producing impossible values (negative IRR, >100% LTV)
  - Database write failures > 5 consecutive
  - Orchestrator failure rate > 30% in 5 minutes
- **Emergency Contact:** System Admin via Slack #storage-alerts
- **Recovery:** Manual restart after root cause analysis

---

## 8. Promotion Gates

| Gate | Requirement |
|------|-------------|
| G1 | All unit tests pass (Jest) |
| G2 | Hub compliance checklist complete |
| G3 | ADR approved for any new tools |
| G4 | Kill switch tested in staging |
| G5 | Rollback plan documented and tested |

---

## 9. Failure Modes

| Failure Code | Spoke | Severity | Remediation |
|--------------|-------|----------|-------------|
| PARCEL_GEOMETRY_UNAVAILABLE | SetbackEngine | error | Use acreage estimate, flag for manual entry |
| SETBACK_CALCULATION_ERROR | SetbackEngine | error | Use conservative defaults |
| COVERAGE_EXCEEDS_ZONING | CoverageEngine | warning | Cap at zoning limit |
| UNIT_MIX_OPTIMIZATION_FAILED | UnitMixOptimizer | warning | Use standard mix template |
| PHASE_TIMELINE_UNREALISTIC | PhasePlanner | warning | Adjust assumptions, flag |
| BUILD_COST_EXCEEDS_THRESHOLD | BuildCostModel | critical | Flag as potential WALK |
| DIRT_WORK_EXCEEDS_THRESHOLD | BuildCostModel | critical | Flag as potential WALK |
| NEGATIVE_NOI | NOIEngine | critical | Flag as non-viable |
| DSCR_BELOW_THRESHOLD | DebtModel | error | Flag risk, may require more equity |
| NEGATIVE_IRR | IRRModel | critical | Flag as non-viable |
| MAX_LAND_PRICE_BELOW_ASK | MaxLandPrice | warning | Negotiate or WALK |
| PASS3_ORCHESTRATOR_FAILURE | Orchestrator | critical | Check logs, restart orchestrator |

---

## 10. Human Override Rules

| Override | Condition | Approver |
|----------|-----------|----------|
| Accept Higher Build Cost | Strategic location, premium finishes | Investment Committee |
| Accept Lower IRR | Portfolio diversification, anchor asset | Investment Committee |
| Adjust Unit Mix | Local market intelligence | Hub Owner |
| Override Phase Timeline | Permitting delays, seasonal factors | Hub Owner |
| Accept Lower DSCR | Strong sponsor, additional collateral | Investment Committee |

**Process:** Override requests logged to `engine_logs` table with approver, timestamp, and justification. All overrides trigger audit trail entry.

---

## 11. Observability

- **Logs:**
  - Supabase `engine_logs` table
  - Console logging via `[PASS3_DESIGN_HUB]` prefix
  - Spoke-level logging with execution time

- **Metrics:**
  - `pass3_success_rate` - % of runs completing IRRModel
  - `pass3_avg_duration` - Average orchestration time
  - `build_cost_distribution` - Cost/sqft histogram
  - `irr_distribution` - Project IRR histogram
  - `max_land_price_vs_ask` - % of deals where max < asking

- **Alerts:**
  - Slack #storage-alerts for CRITICAL failures
  - Email to investment committee for completed pro formas
  - Master Failure Hub aggregation

---

## 12. Execution Flow

```
Underwriting Package (from Pass-2)
    │
    ▼
┌─────────────────┐
│  SetbackEngine  │ ──▶ Buildable area, setback polygon
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ CoverageEngine  │ ──▶ Max buildable sqft, coverage %, stories
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│UnitMixOptimizer  │ ──▶ Optimal unit mix, rent/sqft by type
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  PhasePlanner   │ ──▶ Phase timeline, occupancy triggers
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ BuildCostModel  │ ──▶ Hard costs, soft costs, total cost/sqft
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    NOIEngine    │ ──▶ GPR, vacancy, EGI, OpEx, stabilized NOI
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    DebtModel    │ ──▶ Loan amount, DSCR, LTV, debt service
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MaxLandPrice   │ ──▶ Residual land value, max acquisition
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    IRRModel     │ ──▶ Project IRR, equity multiple, NPV
└────────┬────────┘
         │
         ▼
   Pro Forma Package
   (→ Investment Memo)
```

---

## 13. Financial Model Parameters

### Build Cost Targets (Barton Doctrine)

| Component | Target | Maximum |
|-----------|--------|---------|
| Hard Costs | $20-22/sqft | $25/sqft |
| Soft Costs | $3-4/sqft | $5/sqft |
| Contingency | 5% | 10% |
| **Total** | **$24-26/sqft** | **$27/sqft** |
| Dirt Work | < 10% | 20% (Kill Switch) |

### Revenue Assumptions

| Metric | Assumption |
|--------|------------|
| Stabilized Occupancy | 85% |
| Vacancy Factor | 10% |
| Collection Loss | 2% |
| Rent Growth | 3%/year |
| OpEx Ratio | 30-35% of EGI |

### Debt Parameters

| Metric | Standard | Stressed |
|--------|----------|----------|
| Interest Rate | 6.0% | 7.5% |
| Amortization | 25 years | 25 years |
| LTV Target | 65-70% | 60% |
| DSCR Minimum | 1.25x | 1.10x |

### Return Thresholds

| Metric | Minimum | Target |
|--------|---------|--------|
| Unlevered IRR | 8% | 12%+ |
| Levered IRR | 12% | 18%+ |
| Cash-on-Cash Y1 | 6% | 10%+ |
| Equity Multiple | 1.5x | 2.0x+ |
| Cap Rate | 6.5% | 7.5%+ |

---

## 14. Unit Mix Templates

### Standard Self-Storage Mix

| Unit Size | % of Mix | Climate | Non-Climate |
|-----------|----------|---------|-------------|
| 5x5 | 10% | 60% | 40% |
| 5x10 | 20% | 50% | 50% |
| 10x10 | 30% | 40% | 60% |
| 10x15 | 20% | 30% | 70% |
| 10x20 | 15% | 20% | 80% |
| 10x30 | 5% | 0% | 100% |

### RV/Boat Storage Mix

| Unit Type | % of Mix |
|-----------|----------|
| Covered RV (12x40) | 40% |
| Uncovered RV (12x40) | 35% |
| Enclosed Boat (12x30) | 15% |
| Open Parking | 10% |

---

## 15. Barton Doctrine Alignment

| Doctrine Rule | Pass-3 Enforcement |
|---------------|-------------------|
| $5,000/Month Per Acre Minimum | NOIEngine validates, MaxLandPrice caps acquisition |
| Phase-First Construction | PhasePlanner enforces 20-40 unit Phase 1 |
| $27/sqft Build Cost Maximum | BuildCostModel validates, flags exceedances |
| 20% Dirt Work Maximum | BuildCostModel calculates, triggers Kill Switch |
| DSCR >= 1.25 | DebtModel validates at 6%/25yr |
| 25% NOI Haircut Survival | NOIEngine runs stressed scenario |
| 85% Stabilization Trigger | PhasePlanner uses as phase gate |

---

## 16. Master Failure Log Integration

All failures in Pass-3 are logged to the centralized `master_failure_log` table for unified troubleshooting. See ADR-013 for full specification.

### Pass Identifier
```
pass: 'PASS3'
```

### Error Codes (Pass-3 Specific)

| Error Code | Spoke | Severity | Description |
|------------|-------|----------|-------------|
| `PARCEL_GEOMETRY_UNAVAILABLE` | SetbackEngine | warning | Could not fetch parcel geometry |
| `SETBACK_CALCULATION_ERROR` | SetbackEngine | error | Failed to calculate setbacks |
| `COVERAGE_EXCEEDS_ZONING` | CoverageEngine | warning | Coverage exceeds zoning limit |
| `COVERAGE_CALCULATION_ERROR` | CoverageEngine | error | Failed coverage calculation |
| `UNIT_MIX_OPTIMIZATION_FAILED` | UnitMixOptimizer | warning | Optimization failed, using template |
| `PHASE_TIMELINE_UNREALISTIC` | PhasePlanner | warning | Phase timeline exceeds reasonable bounds |
| `PHASE_PLANNING_ERROR` | PhasePlanner | error | Failed to plan phases |
| `BUILD_COST_EXCEEDS_MAXIMUM` | BuildCostModel | critical | Cost > $27/sqft (FATAL FLAW) |
| `EXCESSIVE_DIRT_WORK` | BuildCostModel | critical | Dirt work > 20% (FATAL FLAW) |
| `BUILD_COST_CALCULATION_ERROR` | BuildCostModel | error | Failed cost calculation |
| `NOI_BELOW_DOCTRINE` | NOIEngine | critical | NOI < $5,000/acre/month (FATAL FLAW) |
| `NEGATIVE_NOI` | NOIEngine | critical | NOI is negative (FATAL FLAW) |
| `NOI_CALCULATION_ERROR` | NOIEngine | error | Failed NOI calculation |
| `DSCR_BELOW_THRESHOLD` | DebtModel | error | DSCR < 1.25 |
| `DEBT_CALCULATION_ERROR` | DebtModel | error | Failed debt calculation |
| `MAX_LAND_PRICE_BELOW_ASK` | MaxLandPrice | warning | Max price below asking |
| `MAX_LAND_CALCULATION_ERROR` | MaxLandPrice | error | Failed land price calculation |
| `NEGATIVE_IRR` | IRRModel | critical | IRR is negative (FATAL FLAW) |
| `IRR_BELOW_MINIMUM` | IRRModel | warning | IRR below 12% threshold |
| `IRR_CALCULATION_ERROR` | IRRModel | error | Failed IRR calculation |
| `PASS3_ORCHESTRATOR_FAILURE` | Orchestrator | critical | Hub orchestration failed |
| `PASS3_TIMEOUT` | Orchestrator | critical | Hub exceeded timeout |

### Logging Implementation

```typescript
import { logPass3Failure } from '@/shared/failures/masterFailureLogger';

// In BuildCostModel spoke - doctrine check:
if (costPerSqft > 27) {
  await logPass3Failure(
    processId,                           // UUID for this run
    'BuildCostModel',                    // Spoke name
    'BUILD_COST_EXCEEDS_MAXIMUM',        // Error code
    'critical',                          // Severity - FATAL FLAW
    `Build cost of $${costPerSqft.toFixed(2)}/sqft exceeds $27/sqft maximum`,
    {
      opportunityId,
      costPerSqft,
      doctrineMaximum: 27,
      totalProjectCost,
      hardCosts,
      softCosts,
      dirtWork,
      isFatalFlaw: true
    }
  );
  // Add to fatalFlaws array...
}

// In IRRModel spoke - calculation error:
try {
  const irr = calculateIRRFromCashFlows(cashFlows);
} catch (error) {
  await logPass3Failure(
    processId,
    'IRRModel',
    'IRR_CALCULATION_ERROR',
    'error',
    `IRR calculation failed: ${error.message}`,
    {
      opportunityId,
      cashFlows,
      errorType: error.name,
      stack: error.stack
    }
  );
  throw error;
}
```

### Troubleshooting Workflow

```sql
-- Find all Pass-3 failures for a specific opportunity
SELECT * FROM master_failure_log
WHERE pass = 'PASS3'
  AND opportunity_id = '<opportunity-id>'
ORDER BY created_at ASC;

-- Find all fatal flaws in pro forma generation
SELECT * FROM master_failure_log
WHERE pass = 'PASS3'
  AND severity = 'critical'
  AND error_code IN (
    'BUILD_COST_EXCEEDS_MAXIMUM',
    'EXCESSIVE_DIRT_WORK',
    'NOI_BELOW_DOCTRINE',
    'NEGATIVE_NOI',
    'NEGATIVE_IRR'
  )
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Get Pass-3 failure summary by spoke
SELECT
    spoke,
    error_code,
    severity,
    COUNT(*) as occurrences,
    MAX(created_at) as last_occurrence
FROM master_failure_log
WHERE pass = 'PASS3'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY spoke, error_code, severity
ORDER BY
    CASE severity WHEN 'critical' THEN 1 WHEN 'error' THEN 2 ELSE 3 END,
    occurrences DESC;

-- Find build cost issues
SELECT
    context->>'costPerSqft' as cost_per_sqft,
    context->>'dirtWork' as dirt_work,
    message,
    created_at
FROM master_failure_log
WHERE pass = 'PASS3'
  AND spoke = 'BuildCostModel'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

## Approval

| Role | Name | Date |
|------|------|------|
| Owner | Barton Enterprises | 2025-12-17 |
| Reviewer | | |
