# ADR-021: Automated Jurisdiction Card Hydration Pipeline

## Status

**PROPOSED** — Pending implementation

## Date

2024-12-18

## Context

ADR-019 defines Pass 2 as the Jurisdiction Card Completion Engine. Jurisdiction cards store regulatory constants for (county × asset_class) combinations. These cards must be populated before Pass 2 can return `ELIGIBLE`.

**Current State:** Cards are populated through manual research — a human reads county ordinances, extracts setbacks/coverage/fire requirements, and inserts rows into `pass2.jurisdiction_constraints`.

**Problem:** Manual research is:
- Slow (hours per jurisdiction)
- Expensive (human labor cost)
- Error-prone (transcription mistakes)
- Not scalable (3,000+ US counties × 3 asset classes = 9,000+ cards)

**Opportunity:** The system already has Firecrawl (web scraping) and Retell.ai (AI voice calls) integrated in Pass 0 and Pass 1.5. These tools can be repurposed to automate jurisdiction card hydration.

---

## Decision

### Build an Automated Jurisdiction Card Hydration Pipeline

The pipeline will:
1. Detect when a jurisdiction card is missing or incomplete
2. Automatically scrape county/municipal websites for ordinance data
3. Parse PDFs and web pages to extract constraint values
4. Normalize extracted data to canonical constraint keys
5. Insert/update `pass2.jurisdiction_constraints` with provenance
6. Queue voice calls (Retell) for fields that cannot be scraped
7. Flag fields as `blocked` when automation fails

---

## Architecture

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     JURISDICTION CARD HYDRATION PIPELINE                     │
│                              (Pass 2.H — Hydration)                          │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌────────────────────────────┐
                    │  TRIGGER: Card Missing or  │
                    │  Incomplete (from Pass 2)  │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │  [H.01] HydrationRouter    │
                    │  Determine data sources    │
                    │  for this jurisdiction     │
                    └─────────────┬──────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ [H.02] Zoning │       │ [H.03] Fire   │       │ [H.04] Storm  │
│ Scraper       │       │ Code Scraper  │       │ water Scraper │
│               │       │               │       │               │
│ County zoning │       │ Fire district │       │ State DEQ +   │
│ ordinance     │       │ + IFC version │       │ county regs   │
└───────┬───────┘       └───────┬───────┘       └───────┬───────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                                ▼
                    ┌────────────────────────────┐
                    │  [H.05] ConstraintExtractor │
                    │  LLM parses scraped content │
                    │  → canonical constraint keys│
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │  [H.06] ConfidenceScorer   │
                    │  Rate extraction quality   │
                    │  (verified/inferred/low)   │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
          HIGH CONFIDENCE            LOW/BLOCKED CONFIDENCE
                    │                           │
                    ▼                           ▼
        ┌───────────────────┐       ┌───────────────────┐
        │ [H.07] CardWriter │       │ [H.08] RetellQueue│
        │ INSERT/UPDATE DB  │       │ Queue voice call  │
        │ knowledge: 'known'│       │ for manual verify │
        └───────────────────┘       └───────────────────┘
                    │                           │
                    └───────────────┬───────────┘
                                    │
                                    ▼
                    ┌────────────────────────────┐
                    │  [H.09] CompletenessCheck  │
                    │  Update card_complete flag │
                    │  via DB trigger            │
                    └────────────────────────────┘
```

---

### Spoke Specifications

#### H.01 — HydrationRouter

**Purpose:** Determine which data sources to query for a given jurisdiction.

**Input:**
```typescript
interface HydrationRequest {
  jurisdiction_card_id: string;
  county_id: number;
  state_code: string;
  county_name: string;
  asset_class: 'self_storage' | 'rv_storage' | 'boat_storage';
  missing_constraints: string[];  // From Pass 2 required_fields_missing
}
```

**Logic:**
1. Look up jurisdiction in `ref.ref_county` for metadata
2. Check `pass2.jurisdiction_source_registry` for known URLs (if exists)
3. If no known URLs, construct search queries for discovery
4. Route to appropriate scrapers based on missing constraint types

**Output:**
```typescript
interface HydrationPlan {
  zoning_sources: SourceTarget[];
  fire_sources: SourceTarget[];
  stormwater_sources: SourceTarget[];
  site_plan_sources: SourceTarget[];
}

interface SourceTarget {
  url: string;
  source_type: 'pdf' | 'html' | 'api';
  authority_scope: AuthorityScopeDB;
  expected_constraints: string[];
}
```

---

#### H.02 — ZoningOrdinanceScraper

**Purpose:** Scrape county/municipal zoning ordinances for dimensional standards.

**Data Sources:**
- County planning department website
- Municipal code library (Municode, American Legal, Code Publishing)
- Direct PDF links to zoning ordinances

**Target Constraints:**
| Constraint Key | Typical Location |
|----------------|------------------|
| `front_setback_ft` | "Article X: Dimensional Standards" |
| `side_setback_ft` | "Table of Dimensional Requirements" |
| `rear_setback_ft` | "Setback Requirements by Zone" |
| `max_lot_coverage_pct` | "Maximum Lot Coverage" |
| `max_height_ft` | "Height Limitations" |
| `max_stories` | "Building Height" |
| `floor_area_ratio` | "FAR by District" |
| `storage_by_right` | "Permitted Uses Table" |
| `conditional_use_required` | "Conditional Uses" |

**Firecrawl Configuration:**
```typescript
const zoningScraperConfig = {
  mode: 'scrape',
  formats: ['markdown', 'html'],
  includePaths: [
    '/planning/*',
    '/zoning/*',
    '/development-services/*',
    '/code-of-ordinances/*'
  ],
  excludePaths: [
    '/news/*',
    '/calendar/*',
    '/jobs/*'
  ],
  maxDepth: 3,
  timeout: 30000,
};
```

---

#### H.03 — FireCodeScraper

**Purpose:** Extract fire access and suppression requirements.

**Data Sources:**
- Fire Marshal office website
- Adopted fire code version (IFC 2018, 2021, etc.)
- Local fire district amendments

**Target Constraints:**
| Constraint Key | Source |
|----------------|--------|
| `fire_lane_width_ft` | IFC Chapter 5 / Local amendments |
| `hydrant_spacing_ft` | IFC Appendix C / Local standards |
| `sprinkler_required` | IFC Chapter 9 / Threshold sqft |
| `ada_parking_ratio` | ADA + local amendments |

**Special Handling:**
- Many jurisdictions adopt IFC with local amendments
- Scraper must identify base code version + amendments
- Store `fire_code_version` as metadata

---

#### H.04 — StormwaterScraper

**Purpose:** Extract stormwater management requirements.

**Data Sources:**
- County stormwater ordinance
- State DEQ/EPA regulations
- Watershed district rules (if applicable)

**Target Constraints:**
| Constraint Key | Source |
|----------------|--------|
| `detention_required` | Local stormwater ordinance |
| `retention_required` | Local stormwater ordinance |
| `infiltration_allowed` | Soil type + local rules |
| `stormwater_reservation_factor` | Design manual |

**Authority Scope Handling:**
```typescript
// Stormwater often has overlapping authorities
const stormwaterAuthorities = [
  { scope: 'county', priority: 1 },
  { scope: 'watershed', priority: 2 },  // More restrictive
  { scope: 'state', priority: 3 },       // Minimum standards
];
// Use most restrictive where authorities overlap
```

---

#### H.05 — ConstraintExtractor

**Purpose:** Use LLM to parse scraped content into canonical constraint values.

**Model:** Claude Haiku (cost-effective for structured extraction)

**Prompt Template:**
```
You are extracting zoning constraints from a municipal ordinance.

DOCUMENT CONTENT:
{scraped_content}

JURISDICTION: {county_name}, {state_code}
ASSET CLASS: {asset_class}

Extract the following constraints for SELF-STORAGE facilities.
Return ONLY the JSON object. Use null for values not found.

{
  "front_setback_ft": <number or null>,
  "side_setback_ft": <number or null>,
  "rear_setback_ft": <number or null>,
  "max_lot_coverage_pct": <number or null>,
  "max_height_ft": <number or null>,
  "max_stories": <number or null>,
  "floor_area_ratio": <number or null>,
  "storage_by_right": <boolean or null>,
  "conditional_use_required": <boolean or null>,
  "source_section": "<exact section/article reference>"
}

RULES:
- Only extract values explicitly stated for storage/warehouse uses
- If a range is given (e.g., "25-50 ft"), use the MORE RESTRICTIVE value
- Include the exact code section reference in source_section
- Return null if the value cannot be determined with confidence
```

**Output Validation:**
- Numeric values must be positive
- Percentages must be 0-100
- Setbacks typically 10-100 ft (flag outliers)
- Coverage typically 40-80% (flag outliers)

---

#### H.06 — ConfidenceScorer

**Purpose:** Rate the quality of extracted constraints.

**Confidence Levels:**
| Level | Criteria | Action |
|-------|----------|--------|
| `verified` | Exact match to code section, no ambiguity | Insert as `known` |
| `inferred` | Derived from related zone or use type | Insert as `known` with flag |
| `estimated` | Industry default or neighboring jurisdiction | Insert as `unknown` |
| `blocked` | Conflicting sources or no data found | Mark `blocked`, queue Retell |

**Scoring Factors:**
```typescript
interface ConfidenceFactors {
  source_authority: number;      // 0-1: Official gov site vs third-party
  extraction_certainty: number;  // 0-1: LLM confidence score
  value_reasonableness: number;  // 0-1: Within typical ranges
  source_freshness: number;      // 0-1: Document date < 3 years
  cross_reference: number;       // 0-1: Multiple sources agree
}

// Final score = weighted average
// threshold for 'verified' = 0.85
// threshold for 'inferred' = 0.60
// below 0.60 = 'blocked'
```

---

#### H.07 — CardWriter

**Purpose:** Persist extracted constraints to database.

**Insert Logic:**
```sql
INSERT INTO pass2.jurisdiction_constraints (
  jurisdiction_card_id,
  constraint_key,
  constraint_value,
  criticality,
  knowledge_state,
  authority_scope,
  verified_at,
  revalidation_required,
  source,
  notes
) VALUES (
  $1,                          -- card ID
  $2,                          -- constraint_key
  $3::jsonb,                   -- constraint_value
  (SELECT criticality FROM pass2.ref_constraint_keys WHERE constraint_key = $2),
  $4,                          -- knowledge_state
  $5,                          -- authority_scope
  NOW(),                       -- verified_at
  FALSE,                       -- revalidation_required
  $6,                          -- source (URL + section)
  $7                           -- notes (extraction metadata)
)
ON CONFLICT (jurisdiction_card_id, constraint_key)
DO UPDATE SET
  constraint_value = EXCLUDED.constraint_value,
  knowledge_state = EXCLUDED.knowledge_state,
  verified_at = NOW(),
  revalidation_required = FALSE,
  source = EXCLUDED.source,
  notes = EXCLUDED.notes,
  updated_at = NOW();
```

**Provenance Requirements:**
- `source` must include URL and document section
- `notes` must include extraction method and confidence score
- `verified_at` set to extraction timestamp

---

#### H.08 — RetellQueue

**Purpose:** Queue voice calls for constraints that cannot be scraped.

**Trigger Conditions:**
1. Constraint marked `blocked` after scraping
2. Confidence score below threshold
3. Conflicting values from multiple sources
4. REQUIRED_FOR_ENVELOPE field still unknown

**Work Order Schema:**
```typescript
interface RetellWorkOrder {
  work_order_id: string;
  jurisdiction_card_id: string;
  constraint_keys: string[];           // Fields to verify
  target_department: string;           // "Planning Department"
  phone_number: string;                // From jurisdiction registry
  call_script_id: string;              // Pre-built script template
  priority: 'high' | 'medium' | 'low';
  created_at: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
}
```

**Call Script Template:**
```
Hi, I'm calling to verify some zoning requirements for a self-storage
development in {county_name}.

I'm looking at the {zoning_district} zone and need to confirm:
1. What is the front setback requirement?
2. What is the maximum lot coverage percentage?
3. Is self-storage a permitted use or does it require a conditional use permit?

Could you also tell me where I can find this in your zoning ordinance?
```

**Post-Call Processing:**
1. Retell transcribes call
2. LLM extracts constraint values from transcript
3. Insert with `source: "Phone call to {dept} on {date}"`
4. Mark as `verified` (human confirmation)

---

#### H.09 — CompletenessCheck

**Purpose:** Verify card completeness after hydration.

**Logic:**
```typescript
async function checkHydrationComplete(cardId: string): Promise<HydrationResult> {
  // Get current constraint state
  const constraints = await getConstraintsForCard(cardId);

  // Check REQUIRED_FOR_ENVELOPE fields
  const requiredKeys = REQUIRED_FOR_ENVELOPE_KEYS;
  const missing = requiredKeys.filter(key => {
    const c = constraints.find(x => x.constraint_key === key);
    return !c || c.knowledge_state !== 'known';
  });

  if (missing.length === 0) {
    return { status: 'complete', missing: [] };
  } else {
    return { status: 'incomplete', missing };
  }
}
```

**Trigger DB Update:**
- Handled by existing `trg_update_card_completeness_on_constraint` trigger
- No additional code needed

---

## Data Source Registry

### New Table: `pass2.jurisdiction_source_registry`

```sql
CREATE TABLE IF NOT EXISTS pass2.jurisdiction_source_registry (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_id INTEGER NOT NULL REFERENCES ref.ref_county(county_id),

  -- Source URLs by type
  zoning_ordinance_url TEXT,
  fire_code_url TEXT,
  stormwater_ordinance_url TEXT,
  design_standards_url TEXT,

  -- Contact info for Retell fallback
  planning_dept_phone TEXT,
  fire_marshal_phone TEXT,

  -- Metadata
  last_scraped_at TIMESTAMPTZ,
  scrape_success BOOLEAN,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_registry_county ON pass2.jurisdiction_source_registry(county_id);
```

### Seed Strategy

1. **Phase 1:** Top 100 MSAs (covers ~60% of US population)
2. **Phase 2:** State capitals and county seats
3. **Phase 3:** Discovery mode for remaining jurisdictions

---

## Integration with Pass 2

### Modified Pass 2 Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PASS 2 WITH HYDRATION                              │
└─────────────────────────────────────────────────────────────────────────────┘

Input: ZIP 75001 + self_storage
        │
        ▼
[SS.02.01] JurisdictionResolver
        │
        ▼
[SS.02.02] JurisdictionCardReader ──────┐
        │                               │
        ▼                               │
   CARD EXISTS?                         │
        │                               │
   ┌────┴────┐                          │
   │         │                          │
  YES        NO                         │
   │         │                          │
   │         ▼                          │
   │    ┌─────────────────┐             │
   │    │ SPAWN HYDRATION │◄────────────┘
   │    │ PIPELINE        │    (async, non-blocking)
   │    │ (Pass 2.H)      │
   │    └────────┬────────┘
   │             │
   │             ▼
   │    ┌─────────────────┐
   │    │ Return early:   │
   │    │ HOLD_INCOMPLETE │
   │    │ + hydration_id  │
   │    └─────────────────┘
   │
   ▼
[SS.02.03-07] Constraint Spokes
        │
        ▼
[SS.02.08] EnvelopeReducer
        │
        ▼
[SS.02.09] ConstraintVerdict
        │
        ▼
Output: ELIGIBLE / HOLD_INCOMPLETE / NO_GO
```

### Hydration Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `sync` | Wait for hydration to complete | Single site analysis |
| `async` | Return HOLD, hydrate in background | Batch processing |
| `skip` | Never hydrate, use existing data only | Production (card must exist) |

---

## Guardrails

### 1. No Guessing

**Rule:** If extraction confidence is below threshold, mark `blocked`, not `estimated`.

**Enforcement:**
```typescript
if (confidenceScore < 0.60) {
  return {
    knowledge_state: 'blocked',
    notes: `Extraction confidence ${confidenceScore} below threshold`,
  };
}
```

### 2. Source Attribution Required

**Rule:** Every constraint must have a traceable source.

**Enforcement:**
```typescript
interface ConstraintInsertion {
  constraint_key: string;
  constraint_value: unknown;
  source: string;  // REQUIRED - URL + section
}

function validateInsertion(data: ConstraintInsertion): void {
  if (!data.source || data.source.length < 10) {
    throw new Error('GUARDRAIL: source attribution required');
  }
}
```

### 3. Human-in-Loop for Ambiguity

**Rule:** Conflicting values trigger Retell queue, not silent resolution.

**Enforcement:**
```typescript
if (sourceA.value !== sourceB.value) {
  await queueRetellWorkOrder({
    reason: 'conflicting_sources',
    values: [sourceA, sourceB],
    constraint_key: key,
  });
  return { knowledge_state: 'blocked' };
}
```

### 4. Staleness Expiration

**Rule:** Cards older than 2 years trigger re-hydration.

**Enforcement:**
```typescript
const STALENESS_THRESHOLD_DAYS = 730; // 2 years

if (daysSinceVerified > STALENESS_THRESHOLD_DAYS) {
  await markForRevalidation(constraintId);
}
```

---

## Cost Model

### Per-Jurisdiction Hydration Cost

| Component | Unit Cost | Units per Jurisdiction | Total |
|-----------|-----------|------------------------|-------|
| Firecrawl (web scrape) | $0.01/page | ~50 pages | $0.50 |
| Firecrawl (PDF parse) | $0.05/PDF | ~5 PDFs | $0.25 |
| Claude Haiku (extraction) | $0.00025/1K tokens | ~20K tokens | $0.005 |
| Retell (voice call) | $0.10/minute | ~5 minutes (if needed) | $0.50 |

**Estimated Cost per Jurisdiction:** $0.75 - $1.25 (without Retell) / $1.25 - $1.75 (with Retell)

**Full Coverage (9,000 jurisdictions):** ~$11,000 - $16,000

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Extraction accuracy (vs manual) | > 95% |
| REQUIRED_FOR_ENVELOPE completion rate | > 80% without Retell |
| Time to hydrate new jurisdiction | < 5 minutes (async) |
| Cost per jurisdiction | < $2.00 |
| Retell fallback rate | < 20% of jurisdictions |

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create `pass2.jurisdiction_source_registry` table
- [ ] Build H.01 HydrationRouter spoke
- [ ] Integrate Firecrawl for basic web scraping
- [ ] Build H.05 ConstraintExtractor with Claude Haiku

### Phase 2: Scrapers (Week 3-4)
- [ ] Build H.02 ZoningOrdinanceScraper
- [ ] Build H.03 FireCodeScraper
- [ ] Build H.04 StormwaterScraper
- [ ] Build H.06 ConfidenceScorer

### Phase 3: Persistence (Week 5)
- [ ] Build H.07 CardWriter with provenance
- [ ] Build H.09 CompletenessCheck
- [ ] Integration tests with real jurisdictions

### Phase 4: Retell Fallback (Week 6)
- [ ] Build H.08 RetellQueue
- [ ] Create call script templates
- [ ] Post-call transcript processing

### Phase 5: Scale (Week 7-8)
- [ ] Seed top 100 MSA source URLs
- [ ] Batch hydration for priority jurisdictions
- [ ] Monitoring and alerting

---

## Alternatives Considered

### 1. Manual-Only Research

**Rejected because:**
- Does not scale to 9,000+ jurisdictions
- High labor cost (~$50-100 per jurisdiction)
- Inconsistent quality across researchers

### 2. Third-Party Data Provider (e.g., Regrid, CoreLogic)

**Rejected because:**
- Regrid provides parcel-level zoning, not jurisdiction-level constants
- No provider covers all constraint types (fire, stormwater, bonding)
- Licensing costs exceed DIY automation at scale

### 3. Crowdsourced Research

**Rejected because:**
- Quality control challenges
- Provenance tracking difficult
- Not faster than automation

---

## References

- ADR-019: Pass 2 Really Is (Jurisdiction Card Completion Engine)
- ADR-020: Pass 2 Constraint Compiler Architectural Position
- ADR-005: Retell.ai Voice AI Integration
- ADR-009: Firecrawl Web Scraping Integration
- PRS-PASS2-001: Pass 2 Execution Specification
