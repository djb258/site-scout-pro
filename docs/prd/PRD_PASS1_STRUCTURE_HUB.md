# PRD — Pass-1 Structure Hub

## 1. Overview

- **System Name:** Storage Site Scout (Barton Storage Application)
- **Hub Name:** PASS1_STRUCTURE_HUB
- **Official Name:** PASS 1 — STRUCTURE HUB (Constants)
- **Owner:** Barton Enterprises
- **Version:** 1.1.0
- **Doctrine ID:** SS.01.00

---

## 2. Purpose

The Pass-1 Structure Hub performs market reconnaissance and hotspot identification for self-storage site scouting. It takes a ZIP code input and produces an enriched OpportunityObject containing demand/supply metrics, competitor analysis, and a viability score.

**Boundary:** This hub owns all reconnaissance and initial screening logic. It does NOT own rate verification (Pass-1.5), underwriting, feasibility calculations, or final GO/NOGO verdicts (those belong to Pass-2).

**Input:** ZIP code + State (5-digit string + 2-letter state)
**Output:** OpportunityObject ready for Pass-1.5 validation

---

## 3. Pipeline Walkthrough

When Pass-1 executes, here is exactly what happens:

### Step 1: Orchestrator Initialization
```typescript
Pass1Orchestrator.run(zipCode: "76028", state: "TX")
```
The orchestrator receives a ZIP code and state, initializes logging with `[PASS1_STRUCTURE_HUB]` prefix, creates a new `pass1_runs` record in Supabase, and begins sequential spoke execution.

---

### Step 2: ZipHydration Spoke (SS.01.01)
**Purpose:** Fetch ZIP code metadata including demographics, coordinates, and geography

**Tools Called:** `census_api`, `lovable_db`
```typescript
// Census API - American Community Survey 5-Year
GET https://api.census.gov/data/2022/acs/acs5
  ?get=B01003_001E,B19013_001E,B25001_001E,NAME
  &for=zip%20code%20tabulation%20area:76028
  &key=YOUR_API_KEY

// Response Shape
[
  ["B01003_001E", "B19013_001E", "B25001_001E", "NAME", "zip code tabulation area"],
  ["48723", "72145", "18934", "ZCTA5 76028", "76028"]
]

// Geocoding for coordinates
GET https://geocoding.geo.census.gov/geocoder/locations/onelineaddress
  ?address=76028
  &benchmark=Public_AR_Current
  &format=json

// Response includes
{ coordinates: { x: -97.2891, y: 32.5234 } }
```

**Output Contract:**
```typescript
interface ZipHydrationOutput {
  zipCode: string;
  city: string;
  county: string;
  state: string;
  population: number;
  medianHouseholdIncome: number;
  housingUnits: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  fipsCode: string;
  timezone: string;
}
```

**Example Output:**
```json
{
  "zipCode": "76028",
  "city": "Burleson",
  "county": "Johnson",
  "state": "TX",
  "population": 48723,
  "medianHouseholdIncome": 72145,
  "housingUnits": 18934,
  "coordinates": { "lat": 32.5234, "lng": -97.2891 },
  "fipsCode": "48251",
  "timezone": "America/Chicago"
}
```

**Failure Handling:**
- `ZIP_NOT_FOUND`: Verify ZIP format, check census availability, fail pipeline
- `CENSUS_API_TIMEOUT`: Retry with exponential backoff (1s, 2s, 4s), use cached data

**Validation Gates:**
- Population >= 1,000 (or warn)
- Median income >= $25,000 (or warn)

---

### Step 3: RadiusBuilder Spoke (SS.01.02)
**Purpose:** Build a 120-mile radius to identify the regional market and adjacent counties

**Tools Called:** `haversine_calc`, `county_adjacency`
```typescript
// Haversine calculation for radius
function haversineDistance(lat1, lng1, lat2, lng2): number {
  // Returns distance in miles between two coordinates
}

// County adjacency lookup
GET /api/counties/adjacent
  ?fips=48251
  &radius_miles=120

// Response Shape
{
  centerCounty: "Johnson",
  adjacentCounties: [
    { name: "Tarrant", fips: "48439", distance: 15.2 },
    { name: "Ellis", fips: "48139", distance: 22.1 },
    { name: "Hill", fips: "48217", distance: 35.8 },
    // ... more counties within 120 miles
  ],
  totalCountiesInRadius: 24,
  totalPopulationInRadius: 7845000
}
```

**Output Contract:**
```typescript
interface RadiusBuilderOutput {
  centerPoint: { lat: number; lng: number };
  radiusMiles: number;
  countiesInRadius: {
    name: string;
    fips: string;
    distanceFromCenter: number;
    population: number;
  }[];
  totalPopulationInRadius: number;
  majorMetroAreas: string[];
}
```

**Failure Handling:**
- `INVALID_COORDINATES`: Geocode from ZIP, validate bounds (-180 to 180 lng, -90 to 90 lat)
- Continue with center county only if adjacency fails

---

### Step 4: MacroDemand Spoke (SS.01.03)
**Purpose:** Calculate population-based storage demand using the 6 sqft/person formula

**Tools Called:** `demand_calculator`
```typescript
// Demand calculation per Barton Doctrine
// Base demand = Population × 6 sqft per person

const demandCalculation = {
  population: 48723,
  sqftPerPerson: 6,
  baseDemand: 48723 * 6,  // 292,338 sqft

  // Growth modifiers
  populationGrowthRate: 0.032,  // 3.2% YoY
  employmentGrowthRate: 0.028,  // 2.8% YoY
  housingStartsGrowth: 0.045,   // 4.5% YoY

  // Projected demand (5-year)
  projectedDemand5yr: 292338 * Math.pow(1.032, 5)  // 342,891 sqft
};
```

**Output Contract:**
```typescript
interface MacroDemandOutput {
  baseDemandSqft: number;           // Population × 6
  populationGrowthRate: number;      // YoY %
  employmentGrowthRate: number;      // YoY %
  housingStartsGrowth: number;       // YoY %
  projectedDemand5yr: number;        // 5-year projection
  demandScore: number;               // 0-100
  demandDrivers: string[];           // Top factors
}
```

**Demand Score Calculation:**
```typescript
function calculateDemandScore(input): number {
  let score = 50; // Base score

  // Population growth modifiers
  if (input.populationGrowthRate > 0.03) score += 15;
  else if (input.populationGrowthRate > 0.02) score += 10;
  else if (input.populationGrowthRate > 0.01) score += 5;
  else if (input.populationGrowthRate < 0) score -= 15;

  // Income modifiers
  if (input.medianIncome > 75000) score += 10;
  else if (input.medianIncome > 50000) score += 5;
  else if (input.medianIncome < 35000) score -= 10;

  // Employment growth
  if (input.employmentGrowthRate > 0.03) score += 10;
  else if (input.employmentGrowthRate > 0.02) score += 5;

  return Math.min(100, Math.max(0, score));
}
```

**Failure Handling:**
- `MISSING_POPULATION_DATA`: Fetch from census, use county aggregates as fallback

---

### Step 5: MacroSupply Spoke (SS.01.04)
**Purpose:** Discover competitors and calculate existing storage supply

**Tools Called:** `google_places`, `competitor_db`
```typescript
// Google Places Nearby Search
GET https://maps.googleapis.com/maps/api/place/nearbysearch/json
  ?location=32.5234,-97.2891
  &radius=16093  // 10 miles in meters
  &type=storage
  &keyword=self+storage
  &key=YOUR_API_KEY

// Response Shape (paginated, up to 60 results)
{
  results: [
    {
      place_id: "ChIJ...",
      name: "Public Storage",
      vicinity: "123 Main St, Burleson",
      geometry: { location: { lat: 32.521, lng: -97.285 } },
      rating: 4.2,
      user_ratings_total: 156,
      types: ["storage", "point_of_interest"]
    },
    // ... more facilities
  ],
  next_page_token: "..."
}

// Sqft estimation based on facility count
// Average facility = 45,000 sqft (industry standard)
const estimatedSupply = competitorCount * 45000;
```

**Output Contract:**
```typescript
interface MacroSupplyOutput {
  competitorCount: number;
  estimatedSupplySqft: number;
  sqftPerCapita: number;              // Supply / Population
  supplyGapSqft: number;              // Demand - Supply
  supplyGapPercent: number;           // Gap as % of demand
  nearestCompetitorMiles: number;
  competitors: {
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    rating: number;
    distanceMiles: number;
  }[];
}
```

**Supply Analysis:**
```typescript
function analyzeSupply(competitors, population, baseDemand): MacroSupplyOutput {
  const estimatedSupply = competitors.length * 45000;
  const sqftPerCapita = estimatedSupply / population;
  const supplyGap = baseDemand - estimatedSupply;

  // Industry benchmarks
  // < 5 sqft/capita = undersupplied (good)
  // 5-7 sqft/capita = balanced
  // > 7 sqft/capita = oversupplied (caution)

  return {
    competitorCount: competitors.length,
    estimatedSupplySqft: estimatedSupply,
    sqftPerCapita: sqftPerCapita,
    supplyGapSqft: supplyGap,
    supplyGapPercent: (supplyGap / baseDemand) * 100,
    nearestCompetitorMiles: findNearest(competitors).distance,
    competitors: competitors
  };
}
```

**Failure Handling:**
- `NO_COMPETITORS_FOUND`: Expand search to 15 miles, verify location coordinates
- `GOOGLE_API_QUOTA_EXCEEDED`: Use cached competitor data, trigger kill switch if critical

---

### Step 6: CompetitorRegistry Spoke (SS.01.05)
**Purpose:** Build detailed competitor inventory with brand classification

**Tools Called:** `competitor_db`, `brand_classifier`
```typescript
// Brand classification
const brandPatterns = {
  national: ['Public Storage', 'Extra Space', 'CubeSmart', 'Life Storage', 'U-Haul'],
  regional: ['Metro Storage', 'SecurCare', 'StorageMart'],
  local: [] // Everything else
};

function classifyCompetitor(name: string): 'national' | 'regional' | 'local' {
  for (const [tier, brands] of Object.entries(brandPatterns)) {
    if (brands.some(brand => name.toLowerCase().includes(brand.toLowerCase()))) {
      return tier as 'national' | 'regional' | 'local';
    }
  }
  return 'local';
}

// Build registry
const registry = competitors.map(comp => ({
  ...comp,
  brand: classifyCompetitor(comp.name),
  estimatedSqft: 45000,  // Default estimate
  estimatedUnits: 300,   // Default estimate
  threatLevel: comp.rating > 4.5 ? 'high' : comp.rating > 4.0 ? 'medium' : 'low'
}));
```

**Output Contract:**
```typescript
interface CompetitorRegistryOutput {
  totalCompetitors: number;
  byBrand: {
    national: number;
    regional: number;
    local: number;
  };
  topCompetitors: {
    name: string;
    brand: 'national' | 'regional' | 'local';
    distanceMiles: number;
    rating: number;
    threatLevel: 'high' | 'medium' | 'low';
  }[];
  nationalBrandPresence: boolean;
  megastoreRisk: boolean;         // Large national within 3 miles
  competitionIntensityScore: number; // 0-100
}
```

**Competition Intensity Score:**
```typescript
function calculateCompetitionIntensity(registry): number {
  let score = 100; // Start at 100 (no competition = best)

  // Deductions
  score -= registry.totalCompetitors * 3;           // -3 per competitor
  score -= registry.byBrand.national * 10;          // -10 per national brand
  score -= registry.megastoreRisk ? 20 : 0;         // -20 if megastore nearby
  score -= (10 - registry.nearestCompetitorMiles) * 2; // Proximity penalty

  return Math.min(100, Math.max(0, score));
}
```

**Failure Handling:**
- `COMPETITOR_REGISTRY_EMPTY`: Use MacroSupply data, flag for manual entry

---

### Step 7: LocalScan Spoke (SS.01.06)
**Purpose:** Scan for local amenities, traffic patterns, and access scores

**Tools Called:** `local_scanner`, `google_places`
```typescript
// Nearby amenities search
const amenityTypes = [
  'shopping_mall',
  'grocery_or_supermarket',
  'home_goods_store',
  'moving_company',
  'apartment_complex'
];

// Traffic and visibility assessment
const accessMetrics = {
  majorRoadProximity: 0.3,      // Miles to nearest major road
  dailyTrafficCount: 25000,     // Estimated ADT
  visibilityScore: 75,          // 0-100
  ingressEgressRating: 'good'   // good/fair/poor
};

// Amenity density
const amenityDensity = {
  retailWithin1Mile: 12,
  residentialDensity: 'suburban',
  commercialDensity: 'moderate'
};
```

**Output Contract:**
```typescript
interface LocalScanOutput {
  amenities: {
    type: string;
    count: number;
    nearestMiles: number;
  }[];
  trafficMetrics: {
    majorRoadProximity: number;
    estimatedDailyTraffic: number;
    visibilityScore: number;
  };
  accessScore: number;            // 0-100
  demographicDensity: 'urban' | 'suburban' | 'rural';
  movingCompanyProximity: number; // Miles
  apartmentComplexCount: number;
}
```

**Failure Handling:**
- `LOCAL_SCAN_TIMEOUT`: Use defaults, continue pipeline
- Flag for manual verification

---

### Step 8: HotspotScoring Spoke (SS.01.07)
**Purpose:** Generate composite viability score and assign tier ranking

**Tools Called:** `scoring_engine`
```typescript
// Weighted scoring per Barton Doctrine
const weights = {
  demandScore: 0.40,           // 40%
  supplyGap: 0.35,             // 35%
  competitionIntensity: 0.25   // 25%
};

function calculateHotspotScore(
  demandScore: number,
  supplyGapPercent: number,
  competitionIntensity: number
): HotspotScore {

  // Normalize supply gap to 0-100 score
  const supplyGapScore = Math.min(100, Math.max(0, supplyGapPercent + 50));

  const weightedScore =
    (demandScore * weights.demandScore) +
    (supplyGapScore * weights.supplyGap) +
    (competitionIntensity * weights.competitionIntensity);

  // Tier assignment
  let tier: 'A' | 'B' | 'C' | 'D';
  if (weightedScore >= 80) tier = 'A';
  else if (weightedScore >= 60) tier = 'B';
  else if (weightedScore >= 40) tier = 'C';
  else tier = 'D';

  return {
    totalScore: Math.round(weightedScore),
    tier: tier,
    components: {
      demandContribution: demandScore * weights.demandScore,
      supplyGapContribution: supplyGapScore * weights.supplyGap,
      competitionContribution: competitionIntensity * weights.competitionIntensity
    }
  };
}
```

**Output Contract:**
```typescript
interface HotspotScoringOutput {
  totalScore: number;            // 0-100
  tier: 'A' | 'B' | 'C' | 'D';
  components: {
    demandContribution: number;
    supplyGapContribution: number;
    competitionContribution: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}
```

**Tier Thresholds:**
| Tier | Score Range | Meaning | Action |
|------|-------------|---------|--------|
| A | >= 80 | Excellent opportunity | Auto-promote to Pass-1.5 |
| B | 60-79 | Good opportunity | Auto-promote to Pass-1.5 |
| C | 40-59 | Marginal | Manual review required |
| D | < 40 | Poor | Auto-reject |

**Failure Handling:**
- `INSUFFICIENT_DATA_FOR_SCORING`: Ensure demand/supply data available, fail if not

---

### Step 9: ValidationGate Spoke (SS.01.08)
**Purpose:** Validate OpportunityObject completeness and decide promotion to Pass-1.5

**Tools Called:** `validator`
```typescript
// Required fields check
const requiredFields = [
  'zipCode', 'coordinates', 'population', 'medianIncome',
  'baseDemandSqft', 'competitorCount', 'hotspotScore', 'tier'
];

function validateOpportunityObject(obj: OpportunityObject): ValidationResult {
  const missingFields = requiredFields.filter(f => !obj[f]);
  const warnings = [];

  // Validation checks
  if (obj.population < 1000) {
    warnings.push('LOW_POPULATION: Population under 1,000');
  }
  if (obj.medianIncome < 25000) {
    warnings.push('LOW_INCOME: Median income under $25,000');
  }
  if (obj.competitorCount === 0) {
    warnings.push('NO_COMPETITORS: Verify location accuracy');
  }

  // Promotion decision
  const canPromote = missingFields.length === 0 && obj.tier !== 'D';

  return {
    isValid: missingFields.length === 0,
    missingFields: missingFields,
    warnings: warnings,
    canPromote: canPromote,
    promotionBlockers: !canPromote ? ['Tier D or missing required fields'] : []
  };
}
```

**Output Contract:**
```typescript
interface ValidationGateOutput {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
  canPromote: boolean;
  promotionDecision: 'PROMOTE' | 'REVIEW' | 'REJECT';
  promotionBlockers: string[];
  opportunityObject: OpportunityObject;
}
```

**Promotion Logic:**
- **PROMOTE**: Score >= 60 (Tier A or B), no missing required fields
- **REVIEW**: Score 40-59 (Tier C), may still promote with override
- **REJECT**: Score < 40 (Tier D) or critical missing data

**Failure Handling:**
- `VALIDATION_BLOCKED`: Review blockers, complete missing fields

---

## 4. Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PASS-1 STRUCTURE HUB                                │
│                        Doctrine ID: SS.01.00                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT: { zipCode: "76028", state: "TX" }                                   │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │  ZipHydration   │──▶ census_api                                          │
│  │  SS.01.01       │    └─▶ { population: 48723, income: 72145, coords }    │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │  RadiusBuilder  │──▶ haversine_calc + county_adjacency                   │
│  │  SS.01.02       │    └─▶ { 24 counties, 7.8M population in radius }      │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │  MacroDemand    │──▶ demand_calculator                                   │
│  │  SS.01.03       │    └─▶ { baseDemand: 292,338 sqft, score: 72 }         │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │  MacroSupply    │──▶ google_places                                       │
│  │  SS.01.04       │    └─▶ { 8 competitors, 360,000 sqft supply }          │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌───────────────────┐                                                      │
│  │CompetitorRegistry │──▶ brand_classifier                                  │
│  │  SS.01.05         │    └─▶ { 2 national, 1 regional, 5 local }           │
│  └────────┬──────────┘                                                      │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │   LocalScan     │──▶ google_places (amenities)                           │
│  │  SS.01.06       │    └─▶ { accessScore: 78, visibility: 75 }             │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ HotspotScoring  │──▶ scoring_engine                                      │
│  │  SS.01.07       │                                                        │
│  │                 │    Weights:                                            │
│  │                 │    ├─ Demand Score:    40%                             │
│  │                 │    ├─ Supply Gap:      35%                             │
│  │                 │    └─ Competition:     25%                             │
│  │                 │                                                        │
│  │                 │    └─▶ { score: 68, tier: "B" }                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ ValidationGate  │──▶ validator                                           │
│  │  SS.01.08       │    └─▶ { canPromote: true, decision: "PROMOTE" }       │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  OUTPUT: OpportunityObject                                                  │
│  {                                                                          │
│    zipCode: "76028",                                                        │
│    coordinates: { lat: 32.5234, lng: -97.2891 },                            │
│    population: 48723,                                                       │
│    baseDemandSqft: 292338,                                                  │
│    competitorCount: 8,                                                      │
│    hotspotScore: 68,                                                        │
│    tier: "B",                                                               │
│    promotionDecision: "PROMOTE",                                            │
│    competitors: [...]                                                       │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────────┐
                        │  PASS-1.5 RENT RECON HUB  │
                        │  Receives competitor list │
                        │  for rate verification    │
                        └───────────────────────────┘
```

---

## 5. OpportunityObject Schema

The complete data structure passed to Pass-1.5:

```typescript
interface OpportunityObject {
  // Identification
  runId: string;
  zipCode: string;
  state: string;
  city: string;
  county: string;

  // Geography
  coordinates: { lat: number; lng: number };
  fipsCode: string;
  radiusMiles: number;
  countiesInRadius: number;

  // Demographics
  population: number;
  medianHouseholdIncome: number;
  housingUnits: number;
  populationGrowthRate: number;

  // Demand
  baseDemandSqft: number;
  projectedDemand5yr: number;
  demandScore: number;

  // Supply
  competitorCount: number;
  estimatedSupplySqft: number;
  sqftPerCapita: number;
  supplyGapSqft: number;
  supplyGapPercent: number;

  // Competition
  competitors: Competitor[];
  nationalBrandCount: number;
  nearestCompetitorMiles: number;
  megastoreRisk: boolean;
  competitionIntensityScore: number;

  // Local
  accessScore: number;
  visibilityScore: number;
  demographicDensity: string;

  // Scoring
  hotspotScore: number;
  tier: 'A' | 'B' | 'C' | 'D';
  strengths: string[];
  weaknesses: string[];

  // Validation
  isValid: boolean;
  warnings: string[];
  promotionDecision: 'PROMOTE' | 'REVIEW' | 'REJECT';

  // Metadata
  createdAt: Date;
  pass1Duration: number;
}
```

---

## 6. Spokes

| Spoke Name | Doctrine ID | Capability | Inherits Tools |
|------------|-------------|------------|----------------|
| ZipHydration | SS.01.01 | Fetch ZIP metadata from census data (city, county, population, income, coordinates) | census_api, lovable_db |
| RadiusBuilder | SS.01.02 | Build 120-mile county radius using Haversine distance | haversine_calc, county_adjacency |
| MacroDemand | SS.01.03 | Calculate population-based demand (pop × 6 sqft), employment growth, housing trends | demand_calculator |
| MacroSupply | SS.01.04 | Fetch competitors and calculate supply (existing sqft, sqft/capita) | google_places, competitor_db |
| CompetitorRegistry | SS.01.05 | Build competitor inventory with brand breakdown | competitor_db, brand_classifier |
| LocalScan | SS.01.06 | Scan for local amenities, traffic, visibility, access scores | local_scanner, google_places |
| HotspotScoring | SS.01.07 | Generate composite viability score (0-100) and tier (A/B/C/D) | scoring_engine |
| ValidationGate | SS.01.08 | Validate OpportunityObject is complete, decide promotion to Pass-1.5 | validator |

---

## 7. Connectors

| Connector | Type | Direction | Contract |
|-----------|------|-----------|----------|
| Pass-0 Momentum | Event | Inbound | MomentumFusion output (optional) |
| Census API | API | Inbound | GET /data/acs5 - Demographics, income, population |
| Google Places | API | Inbound | Nearby search for self-storage competitors |
| Lovable/Supabase | API | Bidirectional | Read/write pass1_runs, staging_payload |
| Pass-1.5 Handoff | Event | Outbound | OpportunityObject via ValidationGate |

---

## 8. Tools

| Tool | Doctrine ID | Owner | ADR | Rate Limit |
|------|-------------|-------|-----|------------|
| census_api | SS.01.T01 | This Hub | ADR-001 | 500/day |
| lovable_db | SS.01.T02 | This Hub | - | N/A |
| haversine_calc | SS.01.T03 | This Hub | - | N/A |
| county_adjacency | SS.01.T04 | This Hub | - | N/A |
| demand_calculator | SS.01.T05 | This Hub | - | N/A |
| google_places | SS.01.T06 | This Hub | ADR-002 | 1000/day |
| competitor_db | SS.01.T07 | This Hub | - | N/A |
| brand_classifier | SS.01.T08 | This Hub | - | N/A |
| local_scanner | SS.01.T09 | This Hub | - | N/A |
| scoring_engine | SS.01.T10 | This Hub | ADR-003 | N/A |
| validator | SS.01.T11 | This Hub | - | N/A |

---

## 9. Guard Rails

| Guard Rail | Type | Threshold |
|------------|------|-----------|
| Census API Rate Limit | Rate Limit | 500 requests/day |
| Google Places Quota | Rate Limit | 1000 requests/day |
| ZIP Validation | Validation | 5-digit numeric, must exist in census |
| Population Minimum | Validation | >= 1,000 population |
| Income Minimum | Validation | >= $25,000 median household income |
| Spoke Timeout | Timeout | 30 seconds per spoke |
| Orchestrator Timeout | Timeout | 5 minutes total |

---

## 10. Kill Switch

- **Endpoint:** `/api/admin/pass1/kill`
- **Activation Criteria:**
  - Google API quota exhausted (CRITICAL)
  - Orchestrator failure rate > 50% in 5 minutes
  - Database connection failure
- **Emergency Contact:** System Admin via Slack #storage-alerts
- **Recovery:** Manual restart after root cause analysis

---

## 11. Promotion Gates

| Gate | Requirement |
|------|-------------|
| G1 | All unit tests pass (Jest) |
| G2 | Hub compliance checklist complete |
| G3 | ADR approved for any new tools |
| G4 | Kill switch tested in staging |
| G5 | Rollback plan documented and tested |

---

## 12. Failure Modes

| Failure Code | Spoke | Severity | Remediation |
|--------------|-------|----------|-------------|
| ZIP_NOT_FOUND | ZipHydration | error | Verify ZIP code format, check census data availability |
| CENSUS_API_TIMEOUT | ZipHydration | warning | Retry with exponential backoff, use cached data |
| INVALID_COORDINATES | RadiusBuilder | error | Geocode from ZIP, validate coordinate bounds |
| MISSING_POPULATION_DATA | MacroDemand | error | Fetch from census, use county aggregates |
| NO_COMPETITORS_FOUND | MacroSupply | warning | Expand search radius, verify location |
| GOOGLE_API_QUOTA_EXCEEDED | MacroSupply | critical | Wait for quota reset, use cached data |
| COMPETITOR_REGISTRY_EMPTY | CompetitorRegistry | warning | Use MacroSupply data, flag for manual entry |
| LOCAL_SCAN_TIMEOUT | LocalScan | warning | Use defaults, continue pipeline |
| INSUFFICIENT_DATA_FOR_SCORING | HotspotScoring | error | Ensure demand/supply data available |
| VALIDATION_BLOCKED | ValidationGate | error | Review blockers, complete missing fields |
| PASS1_ORCHESTRATOR_FAILURE | Orchestrator | critical | Check logs, restart orchestrator, verify DB connection |

---

## 13. Human Override Rules

| Override | Condition | Approver |
|----------|-----------|----------|
| Force Pass-1.5 | ValidationGate blocked but data is sufficient | Hub Owner |
| Skip LocalScan | Time-sensitive opportunity | Hub Owner |
| Manual Score Override | Scoring algorithm produces outlier | System Admin |

**Process:** Override requests logged to `engine_logs` table with approver, timestamp, and justification.

---

## 14. Observability

- **Logs:**
  - Supabase `engine_logs` table
  - Console logging via `[PASS1_STRUCTURE_HUB]` prefix
  - Spoke-level logging with execution time

- **Metrics:**
  - `pass1_success_rate` - % of runs completing ValidationGate
  - `pass1_avg_duration` - Average orchestration time
  - `spoke_failure_rate` - Per-spoke failure tracking
  - `api_quota_remaining` - Google/Census quota monitoring
  - `hotspot_tier_distribution` - A/B/C/D tier breakdown

- **Alerts:**
  - Slack #storage-alerts for CRITICAL failures
  - Email to system admin for quota warnings
  - Master Failure Hub aggregation

---

## 15. Hotspot Scoring

| Factor | Weight | Source Spoke |
|--------|--------|--------------|
| Demand Score | 40% | MacroDemand |
| Supply Gap | 35% | MacroSupply |
| Competition Intensity | 25% | CompetitorRegistry |

**Tier Assignment:**
- **A Tier:** Score >= 80
- **B Tier:** Score >= 60 and < 80
- **C Tier:** Score >= 40 and < 60
- **D Tier:** Score < 40

**Promotion Criteria:**
- Score >= 60 (A or B tier) → Promote to Pass-1.5
- Score < 60 → Flag for review, may still promote with override

---

## 16. Integration with Pass-1.5

Pass-1 stores output and notifies Pass-1.5:

```typescript
// Store OpportunityObject in Supabase
const { data: pass1Run } = await supabase
  .from('pass1_runs')
  .insert({
    run_id: uuid(),
    zip_code: "76028",
    state: "TX",
    opportunity_object: opportunityObject,
    hotspot_score: 68,
    tier: "B",
    promotion_decision: "PROMOTE",
    created_at: new Date()
  })
  .select()
  .single();

// Pass-1.5 receives the OpportunityObject with competitor list
// for rate verification
const pass15Input = {
  runId: pass1Run.run_id,
  opportunityObject: opportunityObject,
  competitors: opportunityObject.competitors  // For rate calls
};
```

---

## 17. Master Failure Log Integration

All failures in Pass-1 are logged to the centralized `master_failure_log` table for unified troubleshooting. See ADR-013 for full specification.

### Pass Identifier
```
pass: 'PASS1'
```

### Error Codes (Pass-1 Specific)

| Error Code | Spoke | Severity | Description |
|------------|-------|----------|-------------|
| `ZIP_HYDRATION_FAILED` | ZipHydration | error | Failed to hydrate ZIP data |
| `CENSUS_API_UNAVAILABLE` | ZipHydration | warning | Census API unreachable |
| `CENSUS_DATA_STALE` | ZipHydration | info | Using cached census data |
| `RADIUS_CALCULATION_ERROR` | RadiusBuilder | error | Failed to calculate radius |
| `MACRO_DEMAND_UNAVAILABLE` | MacroDemand | warning | Demand data unavailable |
| `MACRO_SUPPLY_UNAVAILABLE` | MacroSupply | warning | Supply data unavailable |
| `COMPETITOR_SEARCH_FAILED` | CompetitorRegistry | error | Google Places API failure |
| `COMPETITOR_PARSE_ERROR` | CompetitorRegistry | error | Failed to parse competitor data |
| `LOCAL_SCAN_TIMEOUT` | LocalScan | warning | Local scan timed out |
| `HOTSPOT_CALCULATION_ERROR` | HotspotScoring | error | Failed to calculate hotspot score |
| `VALIDATION_FAILED` | ValidationGate | error | Opportunity failed validation |
| `TIER_ASSIGNMENT_ERROR` | ValidationGate | error | Failed to assign tier |
| `PASS1_ORCHESTRATOR_FAILURE` | Orchestrator | critical | Hub orchestration failed |
| `PASS1_TIMEOUT` | Orchestrator | critical | Hub exceeded timeout |

### Logging Implementation

```typescript
import { logPass1Failure } from '@/shared/failures/masterFailureLogger';

// In each spoke's catch block:
try {
  const competitors = await googlePlacesApi.nearbySearch(location, radius);
  // ... process data
} catch (error) {
  await logPass1Failure(
    processId,                           // UUID for this run
    'CompetitorRegistry',                // Spoke name
    'COMPETITOR_SEARCH_FAILED',          // Error code
    'error',                             // Severity
    `Google Places API failed: ${error.message}`,
    {
      location,
      radius,
      errorType: error.name,
      stack: error.stack
    }
  );
  throw error;  // Re-throw for orchestrator handling
}
```

### Troubleshooting Workflow

```sql
-- Find all Pass-1 failures for a specific opportunity
SELECT * FROM master_failure_log
WHERE pass = 'PASS1'
  AND opportunity_id = '<opportunity-id>'
ORDER BY created_at ASC;

-- Find recent CompetitorRegistry failures
SELECT * FROM master_failure_log
WHERE pass = 'PASS1'
  AND spoke = 'CompetitorRegistry'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Get Pass-1 failure summary by spoke
SELECT
    spoke,
    error_code,
    COUNT(*) as occurrences,
    MAX(created_at) as last_occurrence
FROM master_failure_log
WHERE pass = 'PASS1'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY spoke, error_code
ORDER BY occurrences DESC;
```

---

## Approval

| Role | Name | Date |
|------|------|------|
| Owner | Barton Enterprises | 2025-12-17 |
| Reviewer | | |
