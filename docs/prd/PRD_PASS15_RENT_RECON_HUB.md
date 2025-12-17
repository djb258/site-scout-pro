# PRD — Pass-1.5 Rent Recon Hub

## 1. Overview

- **System Name:** Storage Site Scout (Barton Storage Application)
- **Hub Name:** PASS15_RENT_RECON_HUB
- **Official Name:** PASS 1.5 — RENT RECON HUB
- **Owner:** Barton Enterprises
- **Version:** 1.1.0
- **Doctrine ID:** SS.015.00

---

## 2. Purpose

The Pass-1.5 Rent Recon Hub collects and verifies rate evidence from competitors before underwriting begins. It uses web scraping and AI-powered voice calls to gather actual street rates, then normalizes the data to produce reliable pricing benchmarks.

**Boundary:** This hub owns all rate collection, verification, and normalization. It does NOT own competitor discovery (Pass-1), underwriting calculations, or feasibility analysis (Pass-2).

**Input:** OpportunityObject from Pass-1 with competitor list
**Output:** Verified rate evidence + coverage confidence score for Pass-2

---

## 3. Pipeline Walkthrough

When Pass-1.5 executes, here is exactly what happens:

### Step 1: Orchestrator Initialization
```typescript
Pass15Orchestrator.run({
  runId: "abc-123",
  opportunityObject: OpportunityObject,
  competitors: Competitor[]
})
```
The orchestrator receives the Pass-1 output including the competitor list, initializes logging with `[PASS15_RENT_RECON_HUB]` prefix, creates a new `pass15_runs` record in Supabase, and begins spoke execution.

---

### Step 2: PublishedRateScraper Spoke (SS.015.01)
**Purpose:** Scrape published rates from competitor websites and aggregator platforms

**Tools Called:** `firecrawl`, `sparefoot_api`, `selfstorage_api`

```typescript
// Step 2a: Check aggregator platforms first (fastest)
// SpareFoot API
GET https://api.sparefoot.com/v1/facilities/search
  ?lat=32.5234
  &lng=-97.2891
  &radius=10
  &api_key=YOUR_KEY

// Response Shape
{
  facilities: [
    {
      id: "sf-12345",
      name: "Public Storage - Burleson",
      address: "123 Main St",
      units: [
        { size: "5x5", rate: 49.00, climate: false, available: true },
        { size: "10x10", rate: 99.00, climate: false, available: true },
        { size: "10x10", rate: 129.00, climate: true, available: true },
        { size: "10x20", rate: 169.00, climate: false, available: false }
      ],
      promotions: ["First month free", "50% off first 2 months"]
    }
  ]
}

// Step 2b: Direct website scraping via Firecrawl
POST https://api.firecrawl.dev/v0/scrape
{
  url: "https://publicstorage.com/self-storage/tx/burleson",
  formats: ["markdown"],
  waitFor: 3000,  // Wait for JS pricing to load
  includeTags: [".unit-size", ".price", ".availability"]
}

// Response processed through rate extraction
{
  markdown: "## Available Units\n\n5x5 - $49/mo\n10x10 - $99/mo...",
  extractedRates: [
    { size: "5x5", rate: 49.00, source: "website" },
    { size: "10x10", rate: 99.00, source: "website" }
  ]
}
```

**Rate Extraction Logic:**
```typescript
function extractRatesFromMarkdown(markdown: string): ExtractedRate[] {
  const rates: ExtractedRate[] = [];

  // Pattern 1: "5x5 - $49/mo" or "5x5: $49"
  const pattern1 = /(\d+)x(\d+)\s*[-:]\s*\$(\d+(?:\.\d{2})?)/gi;

  // Pattern 2: "$49/month for 5x5"
  const pattern2 = /\$(\d+(?:\.\d{2})?)\s*(?:\/mo|per month|monthly)?\s*(?:for|-)?\s*(\d+)x(\d+)/gi;

  // Pattern 3: "Starting at $49"
  const pattern3 = /(?:starting at|from)\s*\$(\d+(?:\.\d{2})?)/gi;

  // Apply all patterns and deduplicate
  for (const match of markdown.matchAll(pattern1)) {
    rates.push({
      size: `${match[1]}x${match[2]}`,
      rate: parseFloat(match[3]),
      source: 'scrape'
    });
  }
  // ... apply other patterns

  return deduplicateRates(rates);
}
```

**Output Contract:**
```typescript
interface PublishedRateScraperOutput {
  competitorsScraped: number;
  competitorsWithRates: number;
  scrapedRates: {
    competitorId: string;
    competitorName: string;
    source: 'sparefoot' | 'selfstorage' | 'website';
    rates: {
      size: string;
      rate: number;
      climate: boolean;
      available: boolean;
    }[];
    promotions: string[];
    scrapedAt: Date;
  }[];
  scrapeFailures: {
    competitorId: string;
    reason: string;
  }[];
  coverageFromScraping: number;  // % of competitors with rates
}
```

**Failure Handling:**
- `SCRAPE_BLOCKED`: Try alternate user agent, use cached data if available
- `SCRAPE_NO_RATES`: Flag competitor for AI call queue
- `AGGREGATOR_UNAVAILABLE`: Continue with direct scraping only

---

### Step 3: AICallWorkOrders Spoke (SS.015.02)
**Purpose:** Generate and execute AI voice calls to fill gaps in scraped data

**Tools Called:** `retell_ai`, `call_scheduler`

```typescript
// Step 3a: Identify gaps from scraping
function identifyCallTargets(
  competitors: Competitor[],
  scrapedRates: ScrapedRate[]
): CallTarget[] {
  const targets: CallTarget[] = [];

  for (const competitor of competitors) {
    const scraped = scrapedRates.find(r => r.competitorId === competitor.id);

    // Call if: no scraped data, or missing key unit sizes
    const needsCall =
      !scraped ||
      scraped.rates.length < 3 ||
      !hasAllStandardSizes(scraped.rates);

    if (needsCall && competitor.phoneNumber) {
      targets.push({
        competitorId: competitor.id,
        competitorName: competitor.name,
        phoneNumber: competitor.phoneNumber,
        priority: scraped ? 'low' : 'high',  // Higher priority if no data
        targetSizes: getMissingSizes(scraped?.rates || [])
      });
    }
  }

  return targets.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// Step 3b: Execute AI calls via Retell.ai
POST https://api.retell.ai/v1/calls
{
  agent_id: "storage-rate-collector",
  phone_number: "+18175551234",
  metadata: {
    competitor_id: "comp-123",
    target_sizes: ["5x5", "10x10", "10x20"]
  },
  call_script: {
    greeting: "Hi, I'm looking to rent a storage unit. Do you have any availability?",
    questions: [
      "What sizes do you have available?",
      "How much is a 10x10 unit per month?",
      "Do you have climate-controlled units? How much are those?",
      "Are there any move-in specials or promotions right now?"
    ],
    closing: "Great, thank you so much for your help!"
  }
}

// Response (async via webhook)
{
  call_id: "call-789",
  status: "completed",
  duration: 142,  // seconds
  transcript: "Agent: Hi, I'm looking to rent a storage unit...\nFacility: Hi there! Yes, we have several sizes available...",
  extracted_data: {
    rates: [
      { size: "10x10", rate: 95, climate: false },
      { size: "10x10", rate: 125, climate: true },
      { size: "10x20", rate: 155, climate: false }
    ],
    promotions: ["First month 50% off"],
    availability: "good"
  },
  confidence: 0.92
}
```

**Call Concurrency Management:**
```typescript
const CONCURRENT_CALL_LIMIT = 20;
const CALL_TIMEOUT_SECONDS = 180;

async function executeCallBatch(targets: CallTarget[]): Promise<CallResult[]> {
  const results: CallResult[] = [];
  const queue = [...targets];

  while (queue.length > 0) {
    // Take up to CONCURRENT_CALL_LIMIT calls
    const batch = queue.splice(0, CONCURRENT_CALL_LIMIT);

    const batchResults = await Promise.allSettled(
      batch.map(target => executeCall(target, CALL_TIMEOUT_SECONDS))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          status: 'failed',
          reason: result.reason.message
        });
      }
    }

    // Rate limiting pause between batches
    if (queue.length > 0) {
      await sleep(5000);  // 5 second pause
    }
  }

  return results;
}
```

**Output Contract:**
```typescript
interface AICallWorkOrdersOutput {
  callsAttempted: number;
  callsCompleted: number;
  callsFailed: number;
  callResults: {
    competitorId: string;
    competitorName: string;
    callStatus: 'completed' | 'no_answer' | 'voicemail' | 'failed';
    duration: number;
    transcript: string;
    extractedRates: {
      size: string;
      rate: number;
      climate: boolean;
    }[];
    promotions: string[];
    confidence: number;
  }[];
  avgCallDuration: number;
  totalCallCost: number;  // Estimated
}
```

**Failure Handling:**
- `AI_CALL_NO_ANSWER`: Retry up to 3 times at different times of day
- `AI_CALL_FAILED`: Log failure, continue with available data
- `AI_CALL_INVALID_RESPONSE`: Discard, flag for manual review

---

### Step 4: RateEvidenceNormalizer Spoke (SS.015.03)
**Purpose:** Normalize all collected rates into standardized format by unit size

**Tools Called:** `rate_normalizer`

```typescript
// Combine scraped and call data
function normalizeRates(
  scrapedRates: ScrapedRate[],
  callRates: CallRate[]
): NormalizedRates {

  // Standard unit sizes we track
  const standardSizes = ['5x5', '5x10', '10x10', '10x15', '10x20', '10x30'];

  const allRates: RateDataPoint[] = [];

  // Process scraped rates
  for (const scraped of scrapedRates) {
    for (const rate of scraped.rates) {
      allRates.push({
        competitorId: scraped.competitorId,
        size: normalizeSize(rate.size),  // "5 x 5" → "5x5"
        rate: rate.rate,
        climate: rate.climate,
        source: scraped.source,
        confidence: 0.85  // Scraped data confidence
      });
    }
  }

  // Process call rates (higher confidence)
  for (const call of callRates) {
    for (const rate of call.extractedRates) {
      allRates.push({
        competitorId: call.competitorId,
        size: normalizeSize(rate.size),
        rate: rate.rate,
        climate: rate.climate,
        source: 'ai_call',
        confidence: call.confidence
      });
    }
  }

  // Calculate statistics by size
  const bySize: Record<string, SizeStatistics> = {};

  for (const size of standardSizes) {
    const sizeRates = allRates.filter(r => r.size === size);
    const nonClimate = sizeRates.filter(r => !r.climate);
    const climate = sizeRates.filter(r => r.climate);

    bySize[size] = {
      size: size,
      nonClimate: {
        count: nonClimate.length,
        min: Math.min(...nonClimate.map(r => r.rate)),
        max: Math.max(...nonClimate.map(r => r.rate)),
        average: average(nonClimate.map(r => r.rate)),
        median: median(nonClimate.map(r => r.rate))
      },
      climate: {
        count: climate.length,
        min: Math.min(...climate.map(r => r.rate)),
        max: Math.max(...climate.map(r => r.rate)),
        average: average(climate.map(r => r.rate)),
        median: median(climate.map(r => r.rate))
      }
    };
  }

  return {
    bySize: bySize,
    totalDataPoints: allRates.length,
    marketPosition: determineMarketPosition(bySize)
  };
}

function determineMarketPosition(bySize): 'budget' | 'competitive' | 'premium' {
  // Compare to national averages
  const nationalAvg10x10 = 110;  // $110/month baseline
  const our10x10 = bySize['10x10']?.nonClimate?.median || nationalAvg10x10;

  if (our10x10 < nationalAvg10x10 * 0.85) return 'budget';
  if (our10x10 > nationalAvg10x10 * 1.15) return 'premium';
  return 'competitive';
}
```

**Output Contract:**
```typescript
interface RateEvidenceNormalizerOutput {
  bySize: {
    [size: string]: {
      size: string;
      nonClimate: {
        count: number;
        min: number;
        max: number;
        average: number;
        median: number;
      };
      climate: {
        count: number;
        min: number;
        max: number;
        average: number;
        median: number;
      };
    };
  };
  totalDataPoints: number;
  uniqueCompetitors: number;
  marketPosition: 'budget' | 'competitive' | 'premium';
  commonPromotions: string[];
  dataQuality: 'high' | 'medium' | 'low';
}
```

**Failure Handling:**
- `NORMALIZATION_ERROR`: Check input data formats, use defaults for missing values

---

### Step 5: CoverageConfidence Spoke (SS.015.04)
**Purpose:** Calculate coverage score and confidence level for the rate data

**Tools Called:** `coverage_calculator`

```typescript
function calculateCoverageConfidence(
  competitors: Competitor[],
  normalizedRates: NormalizedRates,
  scrapedResults: ScrapedResult[],
  callResults: CallResult[]
): CoverageConfidenceOutput {

  const totalCompetitors = competitors.length;
  const competitorsWithData = new Set([
    ...scrapedResults.filter(r => r.rates.length > 0).map(r => r.competitorId),
    ...callResults.filter(r => r.extractedRates.length > 0).map(r => r.competitorId)
  ]).size;

  // Competitor coverage (50% weight)
  const competitorCoverage = competitorsWithData / totalCompetitors;

  // Unit size coverage (30% weight) - do we have rates for standard sizes?
  const standardSizes = ['5x5', '10x10', '10x15', '10x20'];
  const sizesWithData = standardSizes.filter(
    size => normalizedRates.bySize[size]?.nonClimate?.count > 0
  ).length;
  const sizeCoverage = sizesWithData / standardSizes.length;

  // Source diversity (20% weight) - multiple sources per competitor?
  const competitorsWithMultipleSources = competitors.filter(comp => {
    const scraped = scrapedResults.find(r => r.competitorId === comp.id);
    const called = callResults.find(r => r.competitorId === comp.id);
    return scraped?.rates.length > 0 && called?.extractedRates.length > 0;
  }).length;
  const sourceDiversity = competitorsWithMultipleSources / totalCompetitors;

  // Weighted coverage score
  const coverageScore =
    (competitorCoverage * 50) +
    (sizeCoverage * 30) +
    (sourceDiversity * 20);

  // Confidence level
  let confidenceLevel: 'high' | 'medium' | 'low';
  if (coverageScore >= 80) confidenceLevel = 'high';
  else if (coverageScore >= 60) confidenceLevel = 'medium';
  else confidenceLevel = 'low';

  return {
    coverageScore: Math.round(coverageScore),
    confidenceLevel: confidenceLevel,
    breakdown: {
      competitorCoverage: Math.round(competitorCoverage * 100),
      sizeCoverage: Math.round(sizeCoverage * 100),
      sourceDiversity: Math.round(sourceDiversity * 100)
    },
    gaps: identifyGaps(competitors, normalizedRates)
  };
}
```

**Output Contract:**
```typescript
interface CoverageConfidenceOutput {
  coverageScore: number;           // 0-100
  confidenceLevel: 'high' | 'medium' | 'low';
  breakdown: {
    competitorCoverage: number;    // % of competitors with rate data
    sizeCoverage: number;          // % of standard sizes with rates
    sourceDiversity: number;       // % with multiple sources
  };
  gaps: {
    competitorsWithoutData: string[];
    sizesMissingData: string[];
  };
  dataPointCount: number;
  averageConfidencePerRate: number;
}
```

**Coverage Thresholds:**
| Level | Score | Meaning |
|-------|-------|---------|
| High | >= 80% | Confident pricing, promote immediately |
| Medium | 60-79% | Acceptable, promote with flag |
| Low | < 60% | Insufficient, require override to promote |

---

### Step 6: PromotionGate Spoke (SS.015.05)
**Purpose:** Decide whether to promote to Pass-2 based on coverage threshold

**Tools Called:** `validator`

```typescript
function evaluatePromotion(
  coverageResult: CoverageConfidenceOutput,
  normalizedRates: NormalizedRates
): PromotionGateOutput {

  const MIN_COVERAGE_THRESHOLD = 60;
  const MIN_DATA_POINTS = 10;

  const canPromote =
    coverageResult.coverageScore >= MIN_COVERAGE_THRESHOLD &&
    normalizedRates.totalDataPoints >= MIN_DATA_POINTS;

  let promotionDecision: 'PROMOTE' | 'REVIEW' | 'BLOCK';
  let reasoning: string;

  if (coverageResult.coverageScore >= 80) {
    promotionDecision = 'PROMOTE';
    reasoning = 'High coverage confidence - sufficient rate evidence collected';
  } else if (coverageResult.coverageScore >= 60) {
    promotionDecision = 'PROMOTE';
    reasoning = 'Medium coverage - promoting with data quality flag';
  } else if (coverageResult.coverageScore >= 40) {
    promotionDecision = 'REVIEW';
    reasoning = 'Low coverage - requires manual review before promotion';
  } else {
    promotionDecision = 'BLOCK';
    reasoning = 'Insufficient rate evidence - cannot proceed to underwriting';
  }

  // Build rate evidence package for Pass-2
  const rateEvidence: RateEvidencePackage = {
    runId: uuid(),
    normalizedRates: normalizedRates,
    coverageScore: coverageResult.coverageScore,
    confidenceLevel: coverageResult.confidenceLevel,
    marketBenchmarks: {
      avg10x10NonClimate: normalizedRates.bySize['10x10']?.nonClimate?.median,
      avg10x10Climate: normalizedRates.bySize['10x10']?.climate?.median,
      marketPosition: normalizedRates.marketPosition
    },
    dataQuality: coverageResult.confidenceLevel,
    createdAt: new Date()
  };

  return {
    canPromote: canPromote,
    promotionDecision: promotionDecision,
    reasoning: reasoning,
    coverageScore: coverageResult.coverageScore,
    confidenceLevel: coverageResult.confidenceLevel,
    rateEvidence: rateEvidence,
    warnings: coverageResult.gaps.competitorsWithoutData.length > 0
      ? [`Missing data for ${coverageResult.gaps.competitorsWithoutData.length} competitors`]
      : []
  };
}
```

**Output Contract:**
```typescript
interface PromotionGateOutput {
  canPromote: boolean;
  promotionDecision: 'PROMOTE' | 'REVIEW' | 'BLOCK';
  reasoning: string;
  coverageScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  rateEvidence: RateEvidencePackage;
  warnings: string[];
  overrideEligible: boolean;
}
```

**Failure Handling:**
- `PROMOTION_BLOCKED`: Review coverage, consider manual rate entry, allow override

---

## 4. Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PASS-1.5 RENT RECON HUB                               │
│                       Doctrine ID: SS.015.00                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT: OpportunityObject + Competitor List (from Pass-1)                   │
│  {                                                                          │
│    runId: "abc-123",                                                        │
│    competitors: [                                                           │
│      { id: "c1", name: "Public Storage", phone: "817-555-1234", ... },      │
│      { id: "c2", name: "Extra Space", phone: "817-555-5678", ... },         │
│      ...8 total competitors                                                 │
│    ]                                                                        │
│  }                                                                          │
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │PublishedRateScraper │──▶ firecrawl + sparefoot_api + selfstorage_api     │
│  │  SS.015.01          │                                                    │
│  │                     │    Scrape competitor websites & aggregators        │
│  │                     │    └─▶ { 6/8 competitors scraped, 42 rates }       │
│  └────────┬────────────┘                                                    │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────┐                                                    │
│  │  AICallWorkOrders   │──▶ retell_ai (20 concurrent max)                   │
│  │  SS.015.02          │                                                    │
│  │                     │    Call competitors with gaps                      │
│  │                     │    └─▶ { 4 calls, 3 completed, 18 rates }          │
│  └────────┬────────────┘                                                    │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────┐                                                │
│  │RateEvidenceNormalizer   │──▶ rate_normalizer                             │
│  │  SS.015.03              │                                                │
│  │                         │    Combine & normalize all rates               │
│  │                         │    └─▶ {                                       │
│  │                         │          "10x10": { median: $95, avg: $98 },   │
│  │                         │          "10x20": { median: $155, avg: $162 }, │
│  │                         │          marketPosition: "competitive"         │
│  │                         │        }                                       │
│  └────────┬────────────────┘                                                │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────┐                                                    │
│  │ CoverageConfidence  │──▶ coverage_calculator                             │
│  │  SS.015.04          │                                                    │
│  │                     │    Weights:                                        │
│  │                     │    ├─ Competitor Coverage: 50%                     │
│  │                     │    ├─ Size Coverage:       30%                     │
│  │                     │    └─ Source Diversity:    20%                     │
│  │                     │                                                    │
│  │                     │    └─▶ { coverageScore: 78, confidence: "medium" } │
│  └────────┬────────────┘                                                    │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────┐                                                    │
│  │   PromotionGate     │──▶ validator                                       │
│  │  SS.015.05          │                                                    │
│  │                     │    Threshold: 60% minimum coverage                 │
│  │                     │    └─▶ { decision: "PROMOTE", canPromote: true }   │
│  └────────┬────────────┘                                                    │
│           │                                                                 │
│           ▼                                                                 │
│  OUTPUT: RateEvidencePackage                                                │
│  {                                                                          │
│    coverageScore: 78,                                                       │
│    confidenceLevel: "medium",                                               │
│    normalizedRates: { ... },                                                │
│    marketBenchmarks: {                                                      │
│      avg10x10NonClimate: 95,                                                │
│      avg10x10Climate: 125,                                                  │
│      marketPosition: "competitive"                                          │
│    },                                                                       │
│    promotionDecision: "PROMOTE"                                             │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────────┐
                        │ PASS-2 UNDERWRITING HUB   │
                        │ PricingVerification spoke │
                        │ receives rate evidence    │
                        └───────────────────────────┘
```

---

## 5. RateEvidencePackage Schema

The complete data structure passed to Pass-2:

```typescript
interface RateEvidencePackage {
  // Identification
  runId: string;
  pass1RunId: string;
  zipCode: string;

  // Normalized Rates
  normalizedRates: {
    bySize: {
      [size: string]: {
        nonClimate: { count: number; min: number; max: number; average: number; median: number };
        climate: { count: number; min: number; max: number; average: number; median: number };
      };
    };
    totalDataPoints: number;
    uniqueCompetitors: number;
  };

  // Market Benchmarks
  marketBenchmarks: {
    avg10x10NonClimate: number;
    avg10x10Climate: number;
    avgRentPerSqft: number;
    marketPosition: 'budget' | 'competitive' | 'premium';
  };

  // Coverage
  coverageScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  coverageBreakdown: {
    competitorCoverage: number;
    sizeCoverage: number;
    sourceDiversity: number;
  };

  // Data Sources
  dataSources: {
    scrapedCount: number;
    aiCallCount: number;
    aggregatorCount: number;
  };

  // Promotions
  commonPromotions: string[];

  // Quality
  dataQuality: 'high' | 'medium' | 'low';
  warnings: string[];

  // Metadata
  promotionDecision: 'PROMOTE' | 'REVIEW' | 'BLOCK';
  createdAt: Date;
  pass15Duration: number;
}
```

---

## 6. Spokes

| Spoke Name | Doctrine ID | Capability | Inherits Tools |
|------------|-------------|------------|----------------|
| PublishedRateScraper | SS.015.01 | Scrape published rates from competitor websites and aggregators | firecrawl, sparefoot_api, selfstorage_api |
| AICallWorkOrders | SS.015.02 | Generate and execute AI voice calls to collect rates | retell_ai, call_scheduler |
| RateEvidenceNormalizer | SS.015.03 | Normalize rates by unit size, calculate averages and medians | rate_normalizer |
| CoverageConfidence | SS.015.04 | Calculate coverage score and confidence level | coverage_calculator |
| PromotionGate | SS.015.05 | Decide promotion to Pass-2 based on coverage threshold | validator |

---

## 7. Connectors

| Connector | Type | Direction | Contract |
|-----------|------|-----------|----------|
| Pass-1 Handoff | Event | Inbound | OpportunityObject with competitor list |
| Firecrawl | API | Inbound | Web scraping for competitor websites |
| SpareFoot/SelfStorage.com | API | Inbound | Aggregator rate data |
| Retell.ai | API | Outbound | AI voice calls for rate verification |
| Supabase | API | Bidirectional | Read/write pass15_runs |
| Pass-2 Handoff | Event | Outbound | Rate evidence via PromotionGate |

---

## 8. Tools

| Tool | Doctrine ID | Owner | ADR | Rate Limit |
|------|-------------|-------|-----|------------|
| firecrawl | SS.015.T01 | This Hub | ADR-009 | 100/hour |
| sparefoot_api | SS.015.T02 | This Hub | - | Per contract |
| selfstorage_api | SS.015.T03 | This Hub | - | Per contract |
| retell_ai | SS.015.T04 | This Hub | ADR-005 | 20 concurrent |
| call_scheduler | SS.015.T05 | This Hub | - | N/A |
| rate_normalizer | SS.015.T06 | This Hub | - | N/A |
| coverage_calculator | SS.015.T07 | This Hub | - | N/A |
| validator | SS.015.T08 | This Hub | - | N/A |

---

## 9. Guard Rails

| Guard Rail | Type | Threshold |
|------------|------|-----------|
| Retell.ai Concurrency | Rate Limit | 20 concurrent calls |
| Retell.ai Call Duration | Timeout | 180 seconds max per call |
| Firecrawl Rate Limit | Rate Limit | 100 requests/hour |
| Minimum Coverage | Validation | >= 60% competitor coverage |
| Minimum Rate Sources | Validation | >= 2 sources per competitor |
| Spoke Timeout | Timeout | 60 seconds per spoke (except AI calls) |
| AI Call Timeout | Timeout | 180 seconds per call |
| Orchestrator Timeout | Timeout | 15 minutes total |

---

## 10. Kill Switch

- **Endpoint:** `/api/admin/pass15/kill`
- **Activation Criteria:**
  - Retell.ai API down or returning errors
  - Firecrawl quota exhausted
  - AI call failure rate > 70%
  - Orchestrator failure rate > 40% in 5 minutes
- **Emergency Contact:** System Admin via Slack #storage-alerts
- **Recovery:** Manual restart after API verification

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
| SCRAPE_BLOCKED | PublishedRateScraper | warning | Try alternate user agent, use cached data |
| SCRAPE_NO_RATES | PublishedRateScraper | warning | Flag competitor, queue for AI call |
| AGGREGATOR_UNAVAILABLE | PublishedRateScraper | warning | Use direct scraping only |
| AI_CALL_NO_ANSWER | AICallWorkOrders | warning | Retry up to 3 times, different times of day |
| AI_CALL_FAILED | AICallWorkOrders | warning | Log failure, continue with available data |
| AI_CALL_INVALID_RESPONSE | AICallWorkOrders | warning | Discard, flag for manual review |
| NORMALIZATION_ERROR | RateEvidenceNormalizer | error | Check input data, use defaults |
| INSUFFICIENT_COVERAGE | CoverageConfidence | warning | Lower confidence, may still promote |
| PROMOTION_BLOCKED | PromotionGate | error | Review coverage, consider override |
| PASS15_ORCHESTRATOR_FAILURE | Orchestrator | critical | Check logs, restart orchestrator |

---

## 13. Human Override Rules

| Override | Condition | Approver |
|----------|-----------|----------|
| Force Pass-2 | Coverage < 60% but strategic market | Hub Owner |
| Skip AI Calls | Sufficient scraped data available | Hub Owner |
| Manual Rate Entry | AI calls failing, known local rates | Hub Owner |
| Accept Low Confidence | Time-sensitive, will verify later | Hub Owner |

**Process:** Override requests logged to `engine_logs` table with approver, timestamp, and justification.

---

## 14. Observability

- **Logs:**
  - Supabase `engine_logs` table
  - Console logging via `[PASS15_RENT_RECON_HUB]` prefix
  - AI call transcripts stored in `call_transcripts` table

- **Metrics:**
  - `pass15_success_rate` - % of runs completing PromotionGate
  - `pass15_avg_duration` - Average orchestration time
  - `scrape_success_rate` - % of successful website scrapes
  - `ai_call_success_rate` - % of successful AI calls
  - `coverage_score_distribution` - Coverage score histogram

- **Alerts:**
  - Slack #storage-alerts for CRITICAL failures
  - Retell.ai quota warnings at 80% usage
  - Master Failure Hub aggregation

---

## 15. Rate Normalization

| Unit Size | Climate-Controlled | Standard | Outdoor |
|-----------|-------------------|----------|---------|
| 5x5 | Yes | Yes | - |
| 5x10 | Yes | Yes | - |
| 10x10 | Yes | Yes | - |
| 10x15 | Yes | Yes | - |
| 10x20 | Yes | Yes | Yes |
| 10x30 | - | Yes | Yes |

**Output:**
- `averageBySize`: Average rate per unit size
- `medianBySize`: Median rate per unit size
- `marketPosition`: competitive/premium/budget

---

## 16. Integration with Pass-2

Pass-1.5 stores output and notifies Pass-2:

```typescript
// Store RateEvidencePackage in Supabase
const { data: pass15Run } = await supabase
  .from('pass15_runs')
  .insert({
    run_id: uuid(),
    pass1_run_id: input.pass1RunId,
    zip_code: input.zipCode,
    rate_evidence: rateEvidencePackage,
    coverage_score: 78,
    confidence_level: "medium",
    promotion_decision: "PROMOTE",
    created_at: new Date()
  })
  .select()
  .single();

// Pass-2 PricingVerification spoke fetches this data
const pass15Data = await supabase
  .from('pass15_runs')
  .select('rate_evidence')
  .eq('pass1_run_id', pass1RunId)
  .single();

// Use in underwriting
const marketRates = pass15Data.rate_evidence.normalizedRates;
const benchmarks = pass15Data.rate_evidence.marketBenchmarks;
```

---

## 17. Master Failure Log Integration

All failures in Pass-1.5 are logged to the centralized `master_failure_log` table for unified troubleshooting. See ADR-013 for full specification.

### Pass Identifier
```
pass: 'PASS1_5'
```

### Error Codes (Pass-1.5 Specific)

| Error Code | Spoke | Severity | Description |
|------------|-------|----------|-------------|
| `SCRAPER_BLOCKED` | PublishedRateScraper | warning | Website blocked scraper |
| `SCRAPER_PARSE_ERROR` | PublishedRateScraper | error | Failed to parse rate page |
| `SCRAPER_TIMEOUT` | PublishedRateScraper | warning | Scraper timed out |
| `AI_CALL_FAILED` | AICallWorkOrders | error | Retell.ai call failed |
| `AI_CALL_TIMEOUT` | AICallWorkOrders | warning | AI call exceeded 180s |
| `AI_CALL_NO_ANSWER` | AICallWorkOrders | info | Competitor did not answer |
| `AI_TRANSCRIPT_PARSE_ERROR` | AICallWorkOrders | error | Failed to parse transcript |
| `RATE_NORMALIZATION_ERROR` | RateEvidenceNormalizer | error | Failed to normalize rates |
| `RATE_CONFLICT` | RateEvidenceNormalizer | warning | Conflicting rate data |
| `COVERAGE_CALCULATION_ERROR` | CoverageConfidence | error | Failed to calculate coverage |
| `INSUFFICIENT_COVERAGE` | CoverageConfidence | warning | Coverage below threshold |
| `PROMOTION_GATE_ERROR` | PromotionGate | error | Failed to evaluate promotion |
| `PASS15_ORCHESTRATOR_FAILURE` | Orchestrator | critical | Hub orchestration failed |
| `PASS15_TIMEOUT` | Orchestrator | critical | Hub exceeded timeout |

### Logging Implementation

```typescript
import { logPass15Failure } from '@/shared/failures/masterFailureLogger';

// In AICallWorkOrders spoke:
try {
  const callResult = await retellApi.initiateCall(phoneNumber, script);
  // ... process result
} catch (error) {
  await logPass15Failure(
    processId,                           // UUID for this run
    'AICallWorkOrders',                  // Spoke name
    'AI_CALL_FAILED',                    // Error code
    'error',                             // Severity
    `Retell.ai call failed for ${competitorName}: ${error.message}`,
    {
      competitorName,
      phoneNumber: phoneNumber.slice(-4),  // Last 4 digits only
      errorType: error.name,
      callId: error.callId
    }
  );
  // Mark competitor as call_failed...
}
```

### Troubleshooting Workflow

```sql
-- Find all Pass-1.5 failures for a specific run
SELECT * FROM master_failure_log
WHERE pass = 'PASS1_5'
  AND process_id = '<uuid>'
ORDER BY created_at ASC;

-- Find recent AI call failures
SELECT * FROM master_failure_log
WHERE pass = 'PASS1_5'
  AND spoke = 'AICallWorkOrders'
  AND error_code IN ('AI_CALL_FAILED', 'AI_CALL_TIMEOUT')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Get Pass-1.5 failure summary
SELECT
    spoke,
    error_code,
    COUNT(*) as occurrences,
    MAX(created_at) as last_occurrence
FROM master_failure_log
WHERE pass = 'PASS1_5'
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
