# ARCHITECTURE GAP REPORT
## Storage Container Go/No-Go Analysis Engine

**Generated:** 2024-12-05
**Architecture Version:** Hub-and-Spoke v1.0
**Status:** Shell Implementation Complete

---

> **IMPORTANT: LLM ONBOARDING INSTRUCTIONS**
>
> If you are an AI assistant reading this file, START HERE:
>
> 1. **Read this entire document first** - it explains the complete architecture
> 2. **Understand the two-pass analysis flow** - Pass 1 (Exploration) → Pass 2 (Underwriting)
> 3. **Review the Opportunity Object** - The unified data transfer object at `src/engine/shared/opportunity_object/types.ts`
> 4. **Check the orchestrators** - Pass 1 at `src/engine/pass1_hub/orchestrators/` and Pass 2 at `src/engine/pass2_hub/orchestrators/`
> 5. **Identify gaps before implementing** - Use the gap tables below to understand what's missing
>
> This architecture was built as SHELLS ONLY - business logic placeholders exist but need implementation.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Folder Structure](#folder-structure)
3. [Data Flow](#data-flow)
4. [Opportunity Object Schema](#opportunity-object-schema)
5. [Pass 1 Hub - Exploration Intelligence](#pass-1-hub---exploration-intelligence)
6. [Pass 2 Hub - Underwriting Intelligence](#pass-2-hub---underwriting-intelligence)
7. [Edge Functions](#edge-functions)
8. [Gap Analysis](#gap-analysis)
9. [Implementation Priority](#implementation-priority)
10. [Database Schema Requirements](#database-schema-requirements)
11. [External API Dependencies](#external-api-dependencies)
12. [Next Steps](#next-steps)

---

## Architecture Overview

This system analyzes potential self-storage development sites using a **two-pass hub-and-spoke architecture**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EDGE FUNCTIONS (API Layer)                        │
│  start_pass1 → start_local_scan → trigger_calls → start_pass2 → save_vault │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SHARED: OPPORTUNITY OBJECT                           │
│  Unified data transfer object flowing through all analysis stages           │
│  Location: src/engine/shared/opportunity_object/types.ts                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
┌──────────────────────────────┐           ┌──────────────────────────────┐
│    PASS 1 HUB                │           │    PASS 2 HUB                │
│    Exploration Intelligence  │    ───►   │    Underwriting Intelligence │
│                              │           │                              │
│  ┌────────────────────────┐  │           │  ┌────────────────────────┐  │
│  │ ORCHESTRATOR           │  │           │  │ ORCHESTRATOR           │  │
│  │ pass1_orchestrator.ts  │  │           │  │ pass2_orchestrator.ts  │  │
│  └────────────────────────┘  │           │  └────────────────────────┘  │
│             │                │           │             │                │
│  ┌──────────┼──────────┐     │           │  ┌──────────┼──────────┐     │
│  ▼          ▼          ▼     │           │  ▼          ▼          ▼     │
│ Spoke     Spoke      Spoke   │           │ Spoke     Spoke      Spoke   │
│  •zip_hydration              │           │  •zoning                     │
│  •radius_builder             │           │  •permits                    │
│  •macro_demand               │           │  •pricing_verification       │
│  •macro_supply               │           │  •fusion_demand              │
│  •hotspot_scoring            │           │  •competitive_pressure       │
│  •local_scan                 │           │  •feasibility                │
│  •call_sheet                 │           │  •reverse_feasibility        │
│                              │           │  •industrial_momentum        │
│                              │           │  •housing_pipeline           │
│                              │           │  •verdict                    │
└──────────────────────────────┘           └──────────────────────────────┘
```

### Design Principles

1. **Separation of Concerns** - Each spoke handles one specific analysis domain
2. **Typed Data Flow** - Opportunity Object provides strict typing across all stages
3. **Orchestrator Pattern** - Hubs coordinate spokes in defined sequence
4. **Edge Function Entry** - All external triggers come through edge functions
5. **Stateless Spokes** - Spokes receive inputs, return outputs, no side effects

---

## Folder Structure

```
src/engine/
├── shared/
│   └── opportunity_object/
│       ├── types.ts          # All TypeScript interfaces (400+ lines)
│       └── index.ts          # Re-exports
│
├── pass1_hub/
│   ├── orchestrators/
│   │   └── pass1_orchestrator.ts    # Main Pass 1 coordination
│   └── spokes/
│       ├── zip_hydration/           # ZIP metadata fetching
│       │   └── index.ts
│       ├── radius_builder/          # 120-mile county radius
│       │   └── index.ts
│       ├── macro_demand/            # Population × 6 sqft
│       │   └── index.ts
│       ├── macro_supply/            # Competitor density
│       │   └── index.ts
│       ├── hotspot_scoring/         # Composite viability
│       │   └── index.ts
│       ├── local_scan/              # 5-30 mile radius scan
│       │   └── index.ts
│       └── call_sheet/              # AI dialer preparation
│           └── index.ts
│
├── pass2_hub/
│   ├── orchestrators/
│   │   └── pass2_orchestrator.ts    # Main Pass 2 coordination
│   └── spokes/
│       ├── zoning/                  # Zoning regulations
│       │   └── index.ts
│       ├── permits/                 # Permit requirements
│       │   └── index.ts
│       ├── pricing_verification/    # Rent benchmarks + curve
│       │   └── index.ts
│       ├── fusion_demand/           # Fusion score calculation
│       │   └── index.ts
│       ├── competitive_pressure/    # Market saturation
│       │   └── index.ts
│       ├── feasibility/             # NOI, ROI, DSCR
│       │   └── index.ts
│       ├── reverse_feasibility/     # Max land price calc
│       │   └── index.ts
│       ├── industrial_momentum/     # Industrial deep dive
│       │   └── index.ts
│       ├── housing_pipeline/        # Housing pipeline analysis
│       │   └── index.ts
│       └── verdict/                 # PROCEED/EVALUATE/WALK
│           └── index.ts
│
└── edge_functions/
    ├── index.ts              # Central exports
    ├── start_pass1.ts        # Entry point for Pass 1
    ├── start_local_scan.ts   # Local scan trigger
    ├── trigger_calls.ts      # AI dialer trigger
    ├── start_pass2.ts        # Entry point for Pass 2
    └── save_to_vault.ts      # Archive completed analysis
```

---

## Data Flow

```
User Request
    │
    ▼
┌─────────────────┐
│  start_pass1    │  POST { zip_code, toggles }
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Pass 1 Hub      │
│  1. hydrateZip  │  → ZIP metadata, lat/lng, county
│  2. buildRadius │  → 120-mile county enumeration
│  3. macroDemand │  → Population × 6 sqft demand
│  4. macroSupply │  → Competitor count, density score
│  5. hotspots    │  → Composite viability score
│  6. localScan?  │  → Optional 5-30mi detailed scan
│  7. callSheet?  │  → Prepare AI dialer list
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Opportunity     │  Status: pass1_complete
│ Object Updated  │  + pass1_macro, pass1_recommendation
└─────────────────┘
    │
    ▼ (User triggers local scan if needed)
┌─────────────────┐
│start_local_scan │  POST { zip_run_id, radius_miles }
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Local Scan      │
│  • Competitor   │  → Detailed competitor list
│    details      │  → Distance, size estimates
│  • Call sheet   │  → Phone numbers for pricing calls
│  • Readiness    │  → % verified pricing
└─────────────────┘
    │
    ▼ (User triggers AI dialer)
┌─────────────────┐
│ trigger_calls   │  POST { zip_run_id, call_sheet }
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ AI Dialer       │  Bland.ai / Retell / Vapi
│  • Calls        │  → Call storage facilities
│  • Transcripts  │  → Extract pricing data
│  • Webhook      │  → Return results
└─────────────────┘
    │
    ▼ (Once pricing collected)
┌─────────────────┐
│  start_pass2    │  POST { zip_run_id, acreage, land_cost }
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Pass 2 Hub      │
│  1. zoning      │  → Zoning classification, by-right check
│  2. permits     │  → Permit timeline, fees
│  3. pricing     │  → Rent benchmarks, curve model
│  4. industrial  │  → Industrial momentum deep dive
│  5. housing     │  → Housing pipeline analysis
│  6. fusion      │  → Fusion demand score
│  7. compPress   │  → Competitive pressure score
│  8. feasibility │  → NOI, ROI, DSCR, cap rate
│  9. reverse     │  → Required rents, max land price
│ 10. verdict     │  → PROCEED / EVALUATE / WALK
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Opportunity     │  Status: pass2_complete
│ Object Updated  │  + pass2_results, final_verdict
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ save_to_vault   │  POST { zip_run_id }
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Vault Archive   │  Permanent storage with summary
└─────────────────┘
```

---

## Opportunity Object Schema

The **Opportunity Object** is the unified data transfer object. Full types at:
`src/engine/shared/opportunity_object/types.ts`

### Top-Level Structure

```typescript
interface OpportunityObject {
  // Identity
  id: string;
  identity: IdentityBlock;        // ZIP, county, state, lat/lng
  toggles: AnalysisToggles;       // User preferences

  // Pass 1 Results
  pass1_macro: Pass1MacroResults;
  local_scan?: LocalScanResults;
  ai_caller_pricing?: AiCallerPricing[];
  pass1_recommendation: Pass1Recommendation;

  // Pass 2 Gate
  pass2_ready: boolean;
  pass2_prerequisites: {
    has_pricing_data: boolean;
    has_competitor_list: boolean;
    has_zoning_lookup: boolean;
  };

  // Pass 2 Results
  pass2_results?: Pass2Results;
  final_verdict?: FinalVerdict;

  // Timestamps
  status: 'pending' | 'pass1_complete' | 'local_scan_complete' | 'pass2_complete' | 'saved';
  created_at: string;
  pass1_completed_at?: string;
  pass2_completed_at?: string;
}
```

### Analysis Toggles (User Inputs)

```typescript
interface AnalysisToggles {
  urban_exclude: boolean;           // Kill switch for density > 3,500/sqmi
  multifamily_priority: boolean;    // Weight multifamily demand higher
  recreation_load: boolean;         // Consider RV/boat storage
  industrial_momentum: boolean;     // Weight industrial growth higher
  analysis_mode: 'build' | 'buy' | 'compare';
}
```

### Key Nested Types

| Type | Location | Purpose |
|------|----------|---------|
| `Pass1MacroResults` | types.ts:45 | Macro demand/supply, competitors, signals |
| `LocalScanResults` | types.ts:120 | Detailed competitor list within radius |
| `CallSheetEntry` | types.ts:140 | AI dialer call list entry |
| `AiCallerPricing` | types.ts:160 | Pricing data from AI calls |
| `Pass2Results` | types.ts:180 | All Pass 2 analysis outputs |
| `FinalVerdict` | types.ts:260 | PROCEED/EVALUATE/WALK decision |

---

## Pass 1 Hub - Exploration Intelligence

### Purpose
Quick triage of a ZIP code to determine if it warrants deeper analysis.

### Orchestrator Flow
Location: `src/engine/pass1_hub/orchestrators/pass1_orchestrator.ts`

```typescript
async function runPass1(input: Pass1Input): Promise<Pass1Output> {
  // Step 1: Hydrate ZIP metadata
  const zipData = await hydrateZip(input.zip_code);

  // Step 2: Build 120-mile radius county list
  const radiusCounties = await buildRadius120(zipData.lat, zipData.lng);

  // Step 3: Calculate macro demand (population × 6 sqft)
  const macroDemand = runMacroDemand(radiusCounties);

  // Step 4: Calculate macro supply (competitor density)
  const macroSupply = await runMacroSupply({ ... });
  const competitors = await fetchCompetitors({ ... });

  // Step 5: Build supporting signals
  const housingSignals = buildHousingSignals(zipData);
  const rvLakeSignals = buildRvLakeSignals(zipData);
  const industrialSignals = buildIndustrialSignals(zipData);

  // Step 6: Compute hotspot score
  const hotspots = computeHotspots({ ... });

  // Step 7: Optional local scan
  if (input.run_local_scan) {
    localScan = await runLocalScan({ ... });
    callSheet = generateCallSheet({ ... });
  }

  // Step 8: Generate recommendation
  const recommendation = assemblePass1Recommendation({ ... });

  return { success: true, opportunity };
}
```

### Spokes Detail

| Spoke | Function | Status | Gap |
|-------|----------|--------|-----|
| **zip_hydration** | `hydrateZip()` | Shell | Needs Neon query for ZIP metadata |
| **radius_builder** | `buildRadius120()` | Shell | Needs PostGIS/Haversine calculation |
| **macro_demand** | `runMacroDemand()` | Implemented | Formula: population × 6 sqft |
| **macro_supply** | `runMacroSupply()` | Shell | Needs Google Places API integration |
| **hotspot_scoring** | `computeHotspots()` | Implemented | Weighted scoring formula |
| **local_scan** | `runLocalScan()` | Shell | Needs Places API + enrichment |
| **call_sheet** | `generateCallSheet()` | Implemented | Sort + filter logic |

---

## Pass 2 Hub - Underwriting Intelligence

### Purpose
Deep-dive financial and regulatory analysis for sites that passed Pass 1.

### Orchestrator Flow
Location: `src/engine/pass2_hub/orchestrators/pass2_orchestrator.ts`

```typescript
async function runPass2(input: Pass2Input): Promise<Pass2Output> {
  // Prerequisites check
  if (opportunity.status !== 'pass1_complete') return error;

  // Step 1-3: Regulatory
  const zoningResult = await runZoning({ ... });
  const permitResult = await runPermits({ ... });
  const pricingResult = await runPricingVerification({ ... });

  // Step 4-6: Deep Analysis
  const industrialResult = await runIndustrialMomentum({ ... });
  const housingResult = await runHousingPipeline({ ... });
  const fusion_demand = runFusionDemand({ ... });

  // Step 7-9: Financial
  const compPressureResult = await runCompPressure({ ... });
  const feasibility = runFeasibility({ ... });
  const reverse_feasibility = runReverseFeasibility({ ... });

  // Step 10: Verdict
  const final_verdict = generateVerdict({ ... });

  return { success: true, opportunity };
}
```

### Spokes Detail

| Spoke | Function | Status | Gap |
|-------|----------|--------|-----|
| **zoning** | `runZoning()` | Shell | Needs jurisdiction_cards query |
| **permits** | `runPermits()` | Shell | Needs jurisdiction_cards query |
| **pricing_verification** | `runPricingVerification()` | Shell | Needs rate_observations query |
| **fusion_demand** | `runFusionDemand()` | Implemented | Weighted formula (55/25/20) |
| **competitive_pressure** | `runCompPressure()` | Implemented | Saturation calculation |
| **feasibility** | `runFeasibility()` | Implemented | Full NOI/ROI/DSCR model |
| **reverse_feasibility** | `runReverseFeasibility()` | Implemented | Max land price calc |
| **industrial_momentum** | `runIndustrialMomentum()` | Shell | Needs data source |
| **housing_pipeline** | `runHousingPipeline()` | Shell | Needs permit data |
| **verdict** | `generateVerdict()` | Implemented | Scoring weights applied |

---

## Edge Functions

### Deployment Target
All edge functions should be deployed to Supabase Edge Functions:
```
supabase/functions/startPass1/index.ts
supabase/functions/startLocalScan/index.ts
supabase/functions/triggerCalls/index.ts
supabase/functions/callWebhook/index.ts
supabase/functions/startPass2/index.ts
supabase/functions/saveToVault/index.ts
```

### API Endpoints

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/start_pass1` | POST | `{ zip_code, toggles }` | `{ opportunity, summary }` |
| `/start_local_scan` | POST | `{ zip_run_id, radius_miles }` | `{ local_scan_results, call_sheet }` |
| `/trigger_calls` | POST | `{ zip_run_id, call_sheet, max_calls }` | `{ batch_id, calls_triggered }` |
| `/call_webhook` | POST | AI dialer payload | `{ success }` |
| `/start_pass2` | POST | `{ zip_run_id, acreage, land_cost }` | `{ opportunity, verdict }` |
| `/save_to_vault` | POST | `{ zip_run_id, tags }` | `{ vault_id, summary }` |

---

## Gap Analysis

### Critical Gaps (Must Fix)

| Component | Gap | Priority | Effort |
|-----------|-----|----------|--------|
| `zip_hydration` | No Neon query for ZIP metadata | P0 | Low |
| `radius_builder` | No Haversine/PostGIS query for 120mi radius | P0 | Medium |
| `macro_supply` | No Google Places API integration | P0 | High |
| `local_scan` | No Places API + phone enrichment | P0 | High |
| `zoning` | No jurisdiction_cards query | P0 | Low |
| `permits` | No jurisdiction_cards query | P0 | Low |
| `pricing_verification` | No rate_observations query | P0 | Low |
| Edge functions | Not deployed to Supabase | P0 | Medium |

### Data Gaps

| Data Type | Current Source | Required | Status |
|-----------|---------------|----------|--------|
| ZIP metadata | None | Neon `uszips` table | Missing query |
| County population | None | Neon `county_tier1` table | Missing query |
| Competitors | None | Google Places API | Not integrated |
| Competitor pricing | AI dialer | Bland.ai / Retell | Shell only |
| Zoning info | None | `jurisdiction_cards` table | Has 56 counties |
| Housing permits | Scrapers | `housing_permits` table | Partial data |
| Industrial data | None | External API | No source identified |

### Logic Gaps vs Existing Code

The following functions exist in `pass1Calculators.ts` and `pass2Calculators.ts` but were only partially migrated:

| Original Function | New Location | Migration Status |
|-------------------|--------------|------------------|
| `calculateRadiusEnumeration()` | `radius_builder/` | Migrated signature, missing Neon query |
| `calculateCompetitorDensity()` | `macro_supply/` | Migrated formula |
| `calculateMultifamilyInfluence()` | Pass 1 orchestrator | Inline implementation |
| `calculateIndustrialQuickScore()` | Pass 1 orchestrator | Inline implementation |
| `calculateRecreationProximity()` | Pass 1 orchestrator | Inline implementation |
| `compilePass1Summary()` | `hotspot_scoring/` | Migrated with modifications |
| `calculateZoningClassification()` | `zoning/` | Migrated signature, missing query |
| `calculatePermitPipeline()` | `permits/` | Migrated signature, missing query |
| `calculateFeasibility()` | `feasibility/` | Fully migrated |
| `calculateReverseFeasibility()` | `reverse_feasibility/` | Fully migrated |
| `calculateFinalVerdict()` | `verdict/` | Fully migrated |

### Broken Imports (None Currently)

All imports are correctly structured. However, the following imports reference stub implementations:

```typescript
// These functions return placeholder data:
import { hydrateZip } from '../spokes/zip_hydration';     // Returns mock data
import { buildRadius120 } from '../spokes/radius_builder'; // Returns empty array
import { fetchCompetitors } from '../spokes/macro_supply'; // Returns empty array
```

---

## Implementation Priority

### Phase 1: Database Connectivity (Week 1)
1. ✅ Create typed interfaces
2. ⬜ Connect `zip_hydration` to Neon `uszips` table
3. ⬜ Connect `radius_builder` to county tables with Haversine
4. ⬜ Connect `zoning` and `permits` to `jurisdiction_cards`
5. ⬜ Connect `pricing_verification` to `rate_observations`

### Phase 2: External APIs (Week 2)
1. ⬜ Integrate Google Places API in `macro_supply`
2. ⬜ Integrate Google Places API in `local_scan`
3. ⬜ Add phone number enrichment (Twilio Lookup or similar)
4. ⬜ Integrate AI dialer (Bland.ai recommended)

### Phase 3: Edge Function Deployment (Week 3)
1. ⬜ Deploy `start_pass1` to Supabase
2. ⬜ Deploy `start_local_scan` to Supabase
3. ⬜ Deploy `trigger_calls` to Supabase
4. ⬜ Deploy `start_pass2` to Supabase
5. ⬜ Deploy `save_to_vault` to Supabase
6. ⬜ Configure webhook endpoint for AI dialer

### Phase 4: UI Integration (Week 4)
1. ⬜ Connect Hive UI to edge function endpoints
2. ⬜ Add real-time status updates
3. ⬜ Build vault browser
4. ⬜ Add export functionality

---

## Database Schema Requirements

### Existing Tables (Verified)

| Table | Purpose | Records |
|-------|---------|---------|
| `uszips` | ZIP code metadata | 41,551 |
| `county_tier1` | Target counties (4 states) | 56 |
| `county_layer3` | Extended county data | ~74 |
| `jurisdiction_cards` | Permit/zoning intel | 56 |
| `jurisdiction_documents` | Linked documents | Variable |
| `housing_permits` | Multi-unit housing permits | ~5,000+ |
| `storage_facilities` | Google Places results | ~2,344 |
| `housing_communities` | Residential communities | ~6,698 |
| `demand_anchors` | Retail demand sources | ~2,666 |

### Required New Tables

```sql
-- ZIP run tracking
CREATE TABLE zip_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code VARCHAR(10) NOT NULL,
  toggles JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  pass1_completed_at TIMESTAMPTZ,
  pass2_completed_at TIMESTAMPTZ,
  saved_to_vault_at TIMESTAMPTZ
);

-- Pass 1 results storage
CREATE TABLE pass1_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_run_id UUID REFERENCES zip_runs(id),
  macro_demand JSONB,
  macro_supply JSONB,
  competitors JSONB,
  housing_signals JSONB,
  industrial_signals JSONB,
  hotspots JSONB,
  local_scan_results JSONB,
  recommendation JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pass 2 results storage
CREATE TABLE pass2_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_run_id UUID REFERENCES zip_runs(id),
  zoning_intel JSONB,
  permit_intel JSONB,
  rent_benchmarks JSONB,
  fusion_demand JSONB,
  competitive_pressure JSONB,
  feasibility JSONB,
  reverse_feasibility JSONB,
  final_verdict JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rate observations from AI dialer
CREATE TABLE rate_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_run_id UUID REFERENCES zip_runs(id),
  facility_id VARCHAR(100),
  facility_name TEXT,
  unit_size VARCHAR(20),
  rate DECIMAL(10,2),
  rate_type VARCHAR(20), -- 'climate' | 'standard' | 'outdoor'
  source VARCHAR(50), -- 'ai_call' | 'website' | 'manual'
  call_transcript TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Completed analysis vault
CREATE TABLE opportunities_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_run_id UUID REFERENCES zip_runs(id),
  zip VARCHAR(10),
  state VARCHAR(2),
  county VARCHAR(100),
  verdict VARCHAR(20),
  confidence DECIMAL(5,4),
  full_payload JSONB,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  saved_at TIMESTAMPTZ DEFAULT now()
);
```

---

## External API Dependencies

### Required APIs

| API | Purpose | Estimated Cost | Status |
|-----|---------|----------------|--------|
| **Google Places API** | Competitor search | ~$17/1000 requests | Not integrated |
| **Bland.ai** | AI phone dialer | ~$0.09/min | Not integrated |
| **Twilio Lookup** | Phone validation | ~$0.005/lookup | Optional |
| **Census API** | Demographics | Free | Partial data exists |
| **SpareFoot API** | Market rents | Unknown | Not integrated |

### API Keys Required

```env
# .env file requirements
GOOGLE_PLACES_API_KEY=
BLAND_AI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
NEON_DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

---

## Next Steps

### Immediate Actions

1. **Create `zip_runs` table** - Store analysis run state
2. **Implement `hydrateZip()`** - Query `uszips` table
3. **Implement `buildRadius120()`** - Haversine query for counties
4. **Test Pass 1 orchestrator** - End-to-end with real data

### Short-term (1-2 weeks)

1. **Google Places integration** - Competitor search
2. **Phone enrichment** - Add phone numbers to call sheet
3. **AI dialer integration** - Connect Bland.ai
4. **Webhook handler** - Receive call results

### Medium-term (2-4 weeks)

1. **Deploy edge functions** - Supabase deployment
2. **Connect Hive UI** - Frontend integration
3. **Vault functionality** - Save and query completed analyses
4. **Export features** - PDF/Excel reports

---

## File Quick Reference

| Purpose | File Path |
|---------|-----------|
| **All Types** | `src/engine/shared/opportunity_object/types.ts` |
| **Pass 1 Orchestrator** | `src/engine/pass1_hub/orchestrators/pass1_orchestrator.ts` |
| **Pass 2 Orchestrator** | `src/engine/pass2_hub/orchestrators/pass2_orchestrator.ts` |
| **Edge Functions** | `src/engine/edge_functions/` |
| **Original Calculators** | `src/services/pass1Calculators.ts`, `src/services/pass2Calculators.ts` |
| **Database Schema** | `backend/db/schema.sql`, `create_jurisdiction_schema.py` |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-05 | Initial architecture shell created | Claude |
| 2024-12-05 | All Pass 1 and Pass 2 spokes created | Claude |
| 2024-12-05 | Edge function shells created | Claude |
| 2024-12-05 | Gap report generated | Claude |

---

*This document should be updated as implementation progresses. When making changes, update the gap tables and change log.*
