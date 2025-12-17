# PRD — Pass-0 Radar Hub

## 1. Overview

- **System Name:** Storage Site Scout (Barton Storage Application)
- **Hub Name:** PASS0_RADAR_HUB
- **Official Name:** PASS 0 — RADAR HUB (Variables)
- **Owner:** Barton Enterprises
- **Version:** 1.1.0
- **Doctrine ID:** SS.00.00

---

## 2. Purpose

The Pass-0 Radar Hub aggregates momentum signals and market variables before site-specific analysis begins. It scans for leading indicators of storage demand including permit activity, news events, industrial logistics trends, and housing pipeline data.

**Boundary:** This hub owns all macro-level momentum and trend detection. It does NOT own site-specific analysis, competitor research, or underwriting (those belong to Pass-1 and Pass-2).

**Input:** ZIP code + State (target market)
**Output:** Aggregated Momentum Score + trend signals for Pass-1

---

## 3. Pipeline Walkthrough

When Pass-0 executes, here is exactly what happens:

### Step 1: Orchestrator Initialization
```
Pass0Orchestrator.run(zipCode: "76028", state: "TX")
```
The orchestrator receives a ZIP code and state, initializes logging with `[PASS0_RADAR_HUB]` prefix, and begins sequential spoke execution.

### Step 2: TrendSignal Spoke (SS.00.01)
**Purpose:** Fetch Google Trends data for storage-related search terms

**Tool Called:** `google_trends_api`
```typescript
// API Request
GET pytrends.interest_by_region(
  keywords: ["self storage near me", "storage units", "rv storage"],
  geo: "US-TX",
  timeframe: "today 12-m"
)

// Response Shape
{
  "self storage near me": { interestIndex: 72, trend: "rising" },
  "storage units": { interestIndex: 65, trend: "stable" },
  "rv storage": { interestIndex: 48, trend: "rising" }
}
```

**Output Contract:**
```typescript
interface TrendSignalOutput {
  searchInterestIndex: number;      // 0-100 composite
  trendDirection: 'rising' | 'stable' | 'declining';
  topKeywords: string[];
  dataQuality: 'high' | 'medium' | 'low';
}
```

**Failure Handling:**
- `TRENDS_API_UNAVAILABLE`: Use cached data (24hr TTL), set dataQuality to 'low'
- `TRENDS_NO_DATA`: Return null, spoke contributes 0 to fusion

---

### Step 3: PermitActivity Spoke (SS.00.02)
**Purpose:** Track commercial and residential permit growth rates

**Tools Called:** `permit_api`, `census_building_permits`
```typescript
// Census Building Permits API
GET https://api.census.gov/data/2022/cbp
  ?get=PERMITS,VALUATION
  &for=county:439
  &in=state:48
  &NAICS=236220  // Commercial construction

// Response Shape
{
  commercialPermits: 142,
  residentialPermits: 1823,
  yoyGrowthCommercial: 0.12,  // 12% growth
  yoyGrowthResidential: 0.08
}
```

**Output Contract:**
```typescript
interface PermitActivityOutput {
  commercialPermitCount: number;
  residentialPermitCount: number;
  commercialGrowthRate: number;     // YoY %
  residentialGrowthRate: number;    // YoY %
  permitActivityScore: number;      // 0-100
}
```

**Failure Handling:**
- `PERMIT_DATA_STALE`: Use most recent available, flag staleness in output
- Continue pipeline, reduce confidence

---

### Step 4: NewsEvents Spoke (SS.00.03)
**Purpose:** Detect major employer announcements and infrastructure projects

**Tools Called:** `news_api`, `firecrawl`
```typescript
// News API Search
GET https://newsapi.org/v2/everything
  ?q="Burleson TX" AND (employer OR jobs OR warehouse OR distribution)
  &from=2024-06-01
  &sortBy=relevancy

// Firecrawl for full article scraping
POST https://api.firecrawl.dev/v0/scrape
  { url: "https://example.com/article", formats: ["markdown"] }

// Sentiment Analysis on scraped content
analyzeSentiment(articleMarkdown) → { score: 0.72, label: "positive" }
```

**Output Contract:**
```typescript
interface NewsEventsOutput {
  majorAnnouncements: {
    headline: string;
    source: string;
    sentiment: number;        // -1 to 1
    relevanceScore: number;   // 0-100
  }[];
  infrastructureProjects: string[];
  overallSentiment: number;
  newsEventScore: number;     // 0-100
}
```

**Failure Handling:**
- `NEWS_SCRAPE_FAILED`: Use cached headlines, reduce confidence
- Continue pipeline with partial data

---

### Step 5: IndustrialLogistics Spoke (SS.00.04)
**Purpose:** Track warehouse vacancy rates and logistics facility growth

**Tools Called:** `costar_api`, `logistics_db`
```typescript
// CoStar API (if available) or internal logistics_db
GET /api/industrial/vacancy
  ?market=Dallas-Fort Worth
  &submarket=South

// Response Shape
{
  warehouseVacancyRate: 0.042,      // 4.2%
  newConstructionSqft: 2400000,
  absorptionRate: 0.89,
  freightVolumeIndex: 112
}
```

**Output Contract:**
```typescript
interface IndustrialLogisticsOutput {
  warehouseVacancyRate: number;
  newLogisticsFacilities: number;
  freightVolumeIndex: number;       // 100 = baseline
  industrialExpansionScore: number; // 0-100
}
```

**Failure Handling:**
- `INDUSTRIAL_DATA_MISSING`: Use regional defaults from logistics_db
- Flag data as estimated

---

### Step 6: HousingPipeline Spoke (SS.00.05)
**Purpose:** Track multifamily and single-family construction starts

**Tools Called:** `census_housing`, `housing_db`
```typescript
// Census Housing Starts
GET https://api.census.gov/data/2022/hous
  ?get=UNITS,VALUATION
  &for=county:439
  &in=state:48

// Response Shape
{
  multifamilyUnitsPermitted: 1240,
  singleFamilyStarts: 892,
  yoyGrowthMultifamily: 0.18,
  yoyGrowthSingleFamily: 0.05
}
```

**Output Contract:**
```typescript
interface HousingPipelineOutput {
  multifamilyUnitsPermitted: number;
  singleFamilyStarts: number;
  multifamilyGrowthRate: number;
  singleFamilyGrowthRate: number;
  housingPressureScore: number;     // 0-100
}
```

**Failure Handling:**
- `HOUSING_API_TIMEOUT`: Retry once, then skip
- Continue to fusion with available data

---

### Step 7: MomentumFusion Spoke (SS.00.06)
**Purpose:** Calculate fused momentum score from all spoke outputs

**Tool Called:** `fusion_engine` (internal calculation)

**Input:** All previous spoke outputs
```typescript
interface FusionInput {
  trendSignal: TrendSignalOutput | null;
  permitActivity: PermitActivityOutput | null;
  newsEvents: NewsEventsOutput | null;
  industrialLogistics: IndustrialLogisticsOutput | null;
  housingPipeline: HousingPipelineOutput | null;
}
```

**Fusion Calculation:**
```typescript
function calculateMomentumFusion(input: FusionInput): MomentumFusionOutput {
  const weights = {
    trendSignal: 0.20,          // 20%
    permitActivity: 0.25,       // 25%
    newsEvents: 0.15,           // 15%
    industrialLogistics: 0.20,  // 20%
    housingPipeline: 0.20       // 20%
  };

  let totalWeight = 0;
  let weightedSum = 0;

  if (input.trendSignal) {
    weightedSum += input.trendSignal.searchInterestIndex * weights.trendSignal;
    totalWeight += weights.trendSignal;
  }
  if (input.permitActivity) {
    weightedSum += input.permitActivity.permitActivityScore * weights.permitActivity;
    totalWeight += weights.permitActivity;
  }
  // ... repeat for all spokes

  // Require minimum 3 spokes for valid fusion
  const spokesWithData = [trendSignal, permitActivity, newsEvents, industrialLogistics, housingPipeline]
    .filter(s => s !== null).length;

  if (spokesWithData < 3) {
    throw new Error('FUSION_INSUFFICIENT_DATA');
  }

  const fusedScore = (weightedSum / totalWeight) * 100;

  return {
    fusedMomentumScore: Math.round(fusedScore),
    confidenceLevel: spokesWithData >= 5 ? 'high' : spokesWithData >= 4 ? 'medium' : 'low',
    topContributors: identifyTopContributors(input),
    spokeDataAvailability: spokesWithData
  };
}
```

**Output Contract:**
```typescript
interface MomentumFusionOutput {
  fusedMomentumScore: number;       // 0-100
  confidenceLevel: 'high' | 'medium' | 'low';
  topContributors: string[];        // Top 3 contributing signals
  spokeDataAvailability: number;    // Count of spokes with data
  breakdown: {
    trendSignalContribution: number;
    permitActivityContribution: number;
    newsEventsContribution: number;
    industrialLogisticsContribution: number;
    housingPipelineContribution: number;
  };
}
```

**Failure Handling:**
- `FUSION_INSUFFICIENT_DATA`: Require minimum 3 spoke inputs, fail if not met
- `FUSION_CALCULATION_ERROR`: Log error, return null score

---

## 4. Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PASS-0 RADAR HUB                                  │
│                         Doctrine ID: SS.00.00                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT: { zipCode: "76028", state: "TX" }                                   │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │  TrendSignal    │──▶ google_trends_api                                   │
│  │  SS.00.01       │    └─▶ { searchInterestIndex: 72, trend: "rising" }    │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ PermitActivity  │──▶ census_building_permits                             │
│  │  SS.00.02       │    └─▶ { permitActivityScore: 68, growth: 12% }        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │  NewsEvents     │──▶ news_api + firecrawl                                │
│  │  SS.00.03       │    └─▶ { newsEventScore: 75, sentiment: 0.72 }         │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────┐                                                    │
│  │IndustrialLogistics  │──▶ costar_api + logistics_db                       │
│  │  SS.00.04           │    └─▶ { industrialScore: 82, vacancy: 4.2% }      │
│  └────────┬────────────┘                                                    │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ HousingPipeline │──▶ census_housing                                      │
│  │  SS.00.05       │    └─▶ { housingPressureScore: 71, MF growth: 18% }    │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │ MomentumFusion  │──▶ fusion_engine (weighted calculation)                │
│  │  SS.00.06       │                                                        │
│  │                 │    Weights:                                            │
│  │                 │    ├─ TrendSignal:        20%                          │
│  │                 │    ├─ PermitActivity:     25%                          │
│  │                 │    ├─ NewsEvents:         15%                          │
│  │                 │    ├─ IndustrialLogistics: 20%                         │
│  │                 │    └─ HousingPipeline:    20%                          │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  OUTPUT: Pass0Output                                                        │
│  {                                                                          │
│    fusedMomentumScore: 74,                                                  │
│    confidenceLevel: "high",                                                 │
│    topContributors: ["IndustrialLogistics", "NewsEvents", "TrendSignal"],   │
│    trendDirection: "rising"                                                 │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │  PASS-1 STRUCTURE HUB │
                        │  MomentumReader spoke │
                        │  reads this output    │
                        └───────────────────────┘
```

---

## 5. Spokes

| Spoke Name | Doctrine ID | Capability | Inherits Tools |
|------------|-------------|------------|----------------|
| TrendSignal | SS.00.01 | Google Trends index, search volume growth tracking | google_trends_api |
| PermitActivity | SS.00.02 | Commercial/residential permit tracking and growth rates | permit_api, census_building_permits |
| NewsEvents | SS.00.03 | Major employer announcements, infrastructure projects, sentiment | news_api, firecrawl |
| IndustrialLogistics | SS.00.04 | Warehouse vacancy rates, new logistics facilities, freight volume | costar_api, logistics_db |
| HousingPipeline | SS.00.05 | Multifamily units permitted, single-family starts, supply pressure | census_housing, housing_db |
| MomentumFusion | SS.00.06 | Fused momentum score calculation, confidence level, top contributors | fusion_engine |

---

## 6. Connectors

| Connector | Type | Direction | Contract |
|-----------|------|-----------|----------|
| Google Trends API | API | Inbound | Search interest data for storage-related terms |
| Census Building Permits | API | Inbound | Monthly permit data by geography |
| News/Firecrawl API | API | Inbound | News scraping and sentiment analysis |
| CoStar/Logistics DB | API | Inbound | Industrial real estate metrics |
| Census Housing | API | Inbound | Housing starts and permits |
| Pass-1 Handoff | Event | Outbound | MomentumFusion output → Pass-1 MomentumReader |

---

## 7. Tools

| Tool | Doctrine ID | Owner | ADR | Rate Limit |
|------|-------------|-------|-----|------------|
| google_trends_api | SS.00.T01 | This Hub | ADR-008 | 100/day |
| permit_api | SS.00.T02 | This Hub | - | 500/day |
| census_building_permits | SS.00.T03 | This Hub | - | 500/day |
| news_api | SS.00.T04 | This Hub | - | 500/day |
| firecrawl | SS.00.T05 | This Hub | ADR-009 | 100/hour |
| costar_api | SS.00.T06 | This Hub | - | Per contract |
| logistics_db | SS.00.T07 | This Hub | - | N/A |
| census_housing | SS.00.T08 | This Hub | - | 500/day |
| housing_db | SS.00.T09 | This Hub | - | N/A |
| fusion_engine | SS.00.T10 | This Hub | - | N/A |

---

## 8. Guard Rails

| Guard Rail | Type | Threshold |
|------------|------|-----------|
| Google Trends Rate Limit | Rate Limit | 100 requests/day |
| News API Rate Limit | Rate Limit | 500 requests/day |
| Lookback Period | Validation | 6-24 months |
| Minimum Data Points | Validation | >= 3 spokes must return data |
| Spoke Timeout | Timeout | 30 seconds per spoke |
| Orchestrator Timeout | Timeout | 3 minutes total |

---

## 9. Kill Switch

- **Endpoint:** `/api/admin/pass0/kill`
- **Activation Criteria:**
  - Google Trends API quota exhausted
  - News API returning errors > 50% of requests
  - MomentumFusion producing null scores
  - Orchestrator failure rate > 40% in 5 minutes
- **Emergency Contact:** System Admin via Slack #storage-alerts
- **Recovery:** Manual restart after API quota reset or root cause analysis

---

## 10. Promotion Gates

| Gate | Requirement |
|------|-------------|
| G1 | All unit tests pass (Jest) |
| G2 | Hub compliance checklist complete |
| G3 | ADR approved for any new tools |
| G4 | Kill switch tested in staging |
| G5 | Rollback plan documented and tested |

---

## 11. Failure Modes

| Failure Code | Spoke | Severity | Remediation |
|--------------|-------|----------|-------------|
| TRENDS_API_UNAVAILABLE | TrendSignal | warning | Use cached data, skip spoke |
| TRENDS_NO_DATA | TrendSignal | warning | Return null, continue pipeline |
| PERMIT_DATA_STALE | PermitActivity | warning | Use most recent available, flag age |
| NEWS_SCRAPE_FAILED | NewsEvents | warning | Use cached headlines, reduce confidence |
| INDUSTRIAL_DATA_MISSING | IndustrialLogistics | warning | Use regional defaults |
| HOUSING_API_TIMEOUT | HousingPipeline | warning | Retry once, then skip |
| FUSION_INSUFFICIENT_DATA | MomentumFusion | error | Require minimum 3 spoke inputs |
| FUSION_CALCULATION_ERROR | MomentumFusion | error | Log error, return null score |
| PASS0_ORCHESTRATOR_FAILURE | Orchestrator | critical | Check logs, restart orchestrator |

---

## 12. Human Override Rules

| Override | Condition | Approver |
|----------|-----------|----------|
| Force Momentum Score | Data insufficient but local knowledge exists | Hub Owner |
| Skip TrendSignal | API unavailable, time-sensitive | Hub Owner |
| Manual Trend Override | Google Trends data contradicts reality | Hub Owner |

**Process:** Override requests logged to `engine_logs` table with approver, timestamp, and justification.

---

## 13. Observability

- **Logs:**
  - Supabase `engine_logs` table
  - Console logging via `[PASS0_RADAR_HUB]` prefix
  - Spoke-level logging with execution time

- **Metrics:**
  - `pass0_success_rate` - % of runs completing MomentumFusion
  - `pass0_avg_duration` - Average orchestration time
  - `spoke_data_availability` - % of spokes returning valid data
  - `momentum_score_distribution` - Score histogram

- **Alerts:**
  - Slack #storage-alerts for CRITICAL failures
  - API quota warnings at 80% usage
  - Master Failure Hub aggregation

---

## 14. Momentum Scoring

| Signal | Weight | Source Spoke |
|--------|--------|--------------|
| Search Trend Growth | 20% | TrendSignal |
| Permit Activity Growth | 25% | PermitActivity |
| News Sentiment | 15% | NewsEvents |
| Industrial Expansion | 20% | IndustrialLogistics |
| Housing Pipeline Pressure | 20% | HousingPipeline |

**Confidence Levels:**
- **High:** 5/5 spokes return valid data
- **Medium:** 3-4 spokes return valid data
- **Low:** < 3 spokes return valid data (minimum to proceed)

**Output:**
- `fusedMomentumScore`: 0-100
- `confidenceLevel`: high/medium/low
- `topContributors`: Top 3 contributing signals

---

## 15. Integration with Pass-1

Pass-0 output is consumed by the **MomentumReader** spoke in Pass-2 (SS.02.09). The handoff contract:

```typescript
// Pass-0 stores output in Supabase
await supabase.from('pass0_runs').insert({
  run_id: uuid(),
  zip_code: "76028",
  state: "TX",
  fused_momentum_score: 74,
  confidence_level: "high",
  top_contributors: ["IndustrialLogistics", "NewsEvents", "TrendSignal"],
  trend_direction: "rising",
  created_at: new Date()
});

// Pass-2 MomentumReader fetches this data
const pass0Data = await supabase
  .from('pass0_runs')
  .select('*')
  .eq('zip_code', zipCode)
  .order('created_at', { ascending: false })
  .limit(1);
```

---

## 16. Edge Function Constraints (MANDATORY)

Pass 0 executes in Lovable.dev edge/cloud function context. The following rules are absolute constraints enforced by architecture, not operator judgment.

### Permitted Operations

| Operation | Status | Notes |
|-----------|--------|-------|
| Hydrate momentum data from APIs | PERMITTED | Core function |
| Return MomentumAnalysis to caller | PERMITTED | Expected output |
| Log failures to console | PERMITTED | Default sink in edge |
| Cache data in memory | PERMITTED | Within request lifecycle |

### Prohibited Operations

| Operation | Status | Consequence |
|-----------|--------|-------------|
| Write to Neon database | **PROHIBITED** | INVARIANT_VIOLATION |
| Import @neondatabase/serverless | **PROHIBITED** | Build rejection |
| Reference NEON_DATABASE_URL | **PROHIBITED** | Runtime halt |
| Promote opportunities to Pass 1 | **PROHIBITED** | Architecture violation |
| Make vault persistence decisions | **PROHIBITED** | Architecture violation |
| Trigger downstream orchestrators | **PROHIBITED** | Must be client-initiated |

### Promotion Authority Rule

**Pass 0 edge functions CANNOT promote opportunities.** All promotion decisions occur in Pass 1, Pass 2, or Pass 3 orchestrators ONLY.

Pass 0 returns momentum data to the calling client. The client (or a server-side orchestrator) decides whether to invoke Pass 1. This separation is enforced by:
1. No database credentials in edge environment
2. No orchestrator-to-orchestrator calls from edge functions
3. Architectural boundary between edge (stateless) and server (stateful)

### Failure Logging Behavior

Pass 0 failures are logged to **console only** (not database). This is correct behavior because:
- Supabase credentials are not available in edge environment
- Edge function logs are captured by Lovable.dev/Cloudflare
- Database persistence occurs only in Pass 1-3 orchestrators

### Violation Response

Any violation of these constraints:
1. MUST be rejected at code review
2. MUST be logged as `INVARIANT_VIOLATION` if detected at runtime
3. MUST halt execution immediately
4. MUST trigger system fault alert

---

## 17. Master Failure Log Integration

All failures in Pass-0 are logged to the centralized `master_failure_log` table for unified troubleshooting. See ADR-013 for full specification.

### Pass Identifier
```
pass: 'PASS0'
```

### Error Codes (Pass-0 Specific)

| Error Code | Spoke | Severity | Description |
|------------|-------|----------|-------------|
| `TRENDS_API_UNAVAILABLE` | TrendSignal | warning | Google Trends API unreachable |
| `TRENDS_NO_DATA` | TrendSignal | warning | No trend data for region |
| `PERMIT_API_TIMEOUT` | PermitActivity | warning | Census permit API timeout |
| `PERMIT_DATA_STALE` | PermitActivity | info | Using cached permit data |
| `NEWS_API_ERROR` | NewsEvents | warning | News aggregator API failure |
| `NEWS_PARSE_ERROR` | NewsEvents | error | Failed to parse news response |
| `INDUSTRIAL_DATA_UNAVAILABLE` | IndustrialLogistics | warning | Industrial trend data missing |
| `HOUSING_DATA_UNAVAILABLE` | HousingPipeline | warning | Housing pipeline data missing |
| `MOMENTUM_FUSION_FAILED` | MomentumFusion | error | Failed to calculate fusion score |
| `INSUFFICIENT_DATA` | MomentumFusion | error | Less than 3 spokes returned data |
| `PASS0_ORCHESTRATOR_FAILURE` | Orchestrator | critical | Hub orchestration failed |
| `PASS0_TIMEOUT` | Orchestrator | critical | Hub exceeded timeout |

### Logging Implementation

```typescript
import { logPass0Failure } from '@/shared/failures/masterFailureLogger';

// In each spoke's catch block:
try {
  const trendData = await googleTrendsApi.fetch(keywords, region);
  // ... process data
} catch (error) {
  await logPass0Failure(
    processId,                           // UUID for this run
    'TrendSignal',                       // Spoke name
    'TRENDS_API_UNAVAILABLE',            // Error code
    'error',                             // Severity
    `Google Trends API failed: ${error.message}`,
    {
      keywords,
      region,
      errorType: error.name,
      stack: error.stack
    }
  );
  // Continue with fallback...
}
```

### Troubleshooting Workflow

```sql
-- Find all Pass-0 failures for a specific run
SELECT * FROM master_failure_log
WHERE pass = 'PASS0'
  AND process_id = '<uuid>'
ORDER BY created_at ASC;

-- Find recent TrendSignal failures
SELECT * FROM master_failure_log
WHERE pass = 'PASS0'
  AND spoke = 'TrendSignal'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Get Pass-0 failure summary
SELECT
    spoke,
    error_code,
    COUNT(*) as occurrences,
    MAX(created_at) as last_occurrence
FROM master_failure_log
WHERE pass = 'PASS0'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY spoke, error_code
ORDER BY occurrences DESC;
```

---

## 18. Approval

| Role | Name | Date |
|------|------|------|
| Owner | Barton Enterprises | 2025-12-17 |
| Reviewer | | |
