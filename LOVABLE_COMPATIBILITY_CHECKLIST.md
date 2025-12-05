# Lovable.dev Compatibility Checklist

## Pass 1 & Pass 2 Hub-and-Spoke Architecture

**Patch Date:** 2024-12-05
**Status:** ✅ Lovable Dry Run Ready

---

## Summary of Changes

This patch makes the Hub-and-Spoke architecture fully compatible with Lovable.dev's runtime model, which uses:
- `@lovable/cloud-db` for data persistence
- `@lovable/functions` for edge function deployment
- Cloudflare Workers as the runtime environment

---

## ✅ Completed Patches

### 1. Fixed Imports — Removed All Dynamic Imports

| File | Status | Notes |
|------|--------|-------|
| `pass1_orchestrator.ts` | ✅ Already static | No changes needed |
| `pass2_orchestrator.ts` | ✅ Already static | No changes needed |
| All spoke `index.ts` files | ✅ Static imports | All use `import { } from` syntax |

**Verification:** All imports use static `import` statements at the top of each file.

---

### 2. Orchestrator Execution Inside Edge Functions

| Edge Function | Orchestrator Called | Status |
|---------------|---------------------|--------|
| `start_pass1.ts` | `runPass1()` | ✅ Updated |
| `start_local_scan.ts` | `runLocalScan()` | ✅ Updated |
| `trigger_calls.ts` | `triggerCalls()` | ✅ Updated |
| `start_pass2.ts` | `runPass2()` | ✅ Updated |
| `save_to_vault.ts` | `prepareForVault()` | ✅ Updated |

**Pattern Used:**
```typescript
import { runPass1 } from '../pass1_hub/orchestrators/pass1_orchestrator';

export default async function handler(req: Request): Promise<Response> {
  const body = await req.json();
  const result = await runPass1(body);
  return Response.json({ result });
}
```

---

### 3. Database Access via Lovable Cloud DB

**New File Created:** `src/engine/shared/lovable_adapter.ts`

| Helper Function | Purpose | Used In |
|-----------------|---------|---------|
| `createRun()` | Create new run record | All edge functions |
| `updateRunStatus()` | Update run status | All edge functions |
| `getRun()` | Get run by ID | Not yet used |
| `writeData()` | Write to scratchpad | `trigger_calls.ts` |
| `updateData()` | Update scratchpad data | Available |
| `readData()` | Read from scratchpad | Available |
| `queryData()` | Query scratchpad | Available |
| `stageOpportunity()` | Stage opportunity JSON | All edge functions |
| `getStagedOpportunity()` | Get staged opportunity | All edge functions |
| `stageResults()` | Stage intermediate results | Pass 2 functions |
| `getStagedResults()` | Get staged results | `trigger_calls.ts` |
| `writeLog()` | Write engine log | All edge functions |
| `writeErrorLog()` | Write error log | All edge functions |
| `saveToVault()` | Save to permanent Neon | `save_to_vault.ts` only |

**DB Tables (Scratchpad):**
```typescript
TABLES = {
  PASS1_RUNS: 'pass1_runs',
  PASS1_RESULTS: 'pass1_results',
  LOCAL_SCAN_RUNS: 'local_scan_runs',
  LOCAL_SCAN_RESULTS: 'local_scan_results',
  CALL_BATCHES: 'call_batches',
  CALL_RESULTS: 'call_results',
  RATE_OBSERVATIONS: 'rate_observations',
  PASS2_RUNS: 'pass2_runs',
  PASS2_RESULTS: 'pass2_results',
  VAULT: 'opportunities_vault',
  ENGINE_LOGS: 'engine_logs',
}
```

---

### 4. JSON-Serializable Returns

| Function | Status | Notes |
|----------|--------|-------|
| `ensureSerializable()` | ✅ Created | Deep clones via JSON.parse/stringify |
| `createResponse()` | ✅ Created | Wraps responses with timestamp |
| All edge functions | ✅ Updated | Use `Response.json()` |
| All returns | ✅ Checked | No classes, functions, or symbols |

---

### 5. Lovable Compatibility Layer

**File:** `src/engine/shared/lovable_adapter.ts`

Features:
- ✅ Mock DB implementation for development
- ✅ Type definitions matching `@lovable/cloud-db`
- ✅ JSON staging helpers
- ✅ Logging helpers
- ✅ Serialization helpers
- ✅ Constants for table names

**Production Switch:**
```typescript
// Replace mock with actual import:
// import { db } from "@lovable/cloud-db";
```

---

### 6. Opportunity Object Flow (DB Persistence)

```
┌─────────────────┐
│  start_pass1    │
│  └─ creates run │
│  └─ stages opportunity → pass1_runs + JSON
└─────────────────┘
         │
         ▼
┌─────────────────┐
│start_local_scan │
│  └─ reads opportunity from JSON
│  └─ updates opportunity
│  └─ stages back → local_scan_runs + JSON
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ trigger_calls   │
│  └─ reads opportunity from JSON
│  └─ creates call batch
│  └─ stages results → call_batches + rate_observations
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  start_pass2    │
│  └─ reads opportunity from JSON
│  └─ runs Pass 2 orchestrator
│  └─ stages results → pass2_runs + JSON
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ save_to_vault   │
│  └─ reads opportunity from JSON
│  └─ writes to Neon (ONLY Neon write)
│  └─ updates status
└─────────────────┘
```

**Key Rule:** No free-floating in-memory objects. Everything persists in Lovable DB.

---

### 7. Pass-1 Dry-Run Entrypoint

**Endpoint:** `GET /start_pass1?dry_run=true`

**Response:**
```json
{
  "success": true,
  "mode": "dry-run",
  "run_id": "dry_run_1701792000000",
  "status": "pass1_complete",
  "opportunity": { ... },
  "summary": {
    "zip": "22101",
    "city": "McLean",
    "county": "Fairfax County",
    "state": "VA",
    "population": 48115,
    "demand_sqft": 288690,
    "competitor_count": 3,
    "supply_sqft": 165000,
    "hotspot_count": 2,
    "county_count": 5,
    "viability_score": 68,
    "tier": "B",
    "recommendation": "Moderate potential - Pass 2 recommended for validation",
    "key_factors": ["Strong population base", "Industrial presence", "High income area"],
    "risk_factors": ["High land costs", "Established competition"],
    "proceed_to_pass2": true
  },
  "hotspots": [
    {
      "county": "Loudoun County",
      "state": "VA",
      "population": 420000,
      "demand_sqft": 2520000,
      "estimated_supply_sqft": 1800000,
      "supply_gap_sqft": 720000,
      "supply_ratio": 1.40,
      "is_hotspot": true,
      "distance_miles": 15
    }
  ],
  "timestamp": 1701792000000
}
```

**Test Command:**
```bash
curl -X GET "https://your-lovable-app.com/functions/start_pass1?dry_run=true"
```

---

### 8. Pass-2 Dry-Run Entrypoint

**Endpoint:** `GET /start_pass2?dry_run=true`

**Response:**
```json
{
  "success": true,
  "mode": "dry-run",
  "status": "pass2_complete",
  "opportunity": { ... },
  "verdict": {
    "decision": "EVALUATE",
    "confidence": 0.72,
    "key_factors": [...],
    "risks": [...]
  },
  "timestamp": 1701792000000
}
```

**Test Command:**
```bash
curl -X GET "https://your-lovable-app.com/functions/start_pass2?dry_run=true"
```

---

## Modified Files

### Edge Functions (Updated)
- `src/engine/edge_functions/start_pass1.ts`
- `src/engine/edge_functions/start_local_scan.ts`
- `src/engine/edge_functions/trigger_calls.ts`
- `src/engine/edge_functions/start_pass2.ts`
- `src/engine/edge_functions/save_to_vault.ts`
- `src/engine/edge_functions/index.ts`

### New Files (Created)
- `src/engine/shared/lovable_adapter.ts`

### Unchanged (Already Compatible)
- `src/engine/pass1_hub/orchestrators/pass1_orchestrator.ts`
- `src/engine/pass2_hub/orchestrators/pass2_orchestrator.ts`
- All spoke `index.ts` files

---

## Patched Orchestrators

| Orchestrator | Location | Changes |
|--------------|----------|---------|
| Pass 1 | `pass1_hub/orchestrators/pass1_orchestrator.ts` | None needed - already compatible |
| Pass 2 | `pass2_hub/orchestrators/pass2_orchestrator.ts` | None needed - already compatible |

---

## DB Write Updates

| Edge Function | Tables Written | Permanent? |
|---------------|----------------|------------|
| `start_pass1` | `pass1_runs`, JSON staging | No (scratchpad) |
| `start_local_scan` | `local_scan_runs`, JSON staging | No (scratchpad) |
| `trigger_calls` | `call_batches`, `rate_observations` | No (scratchpad) |
| `call_webhook` | `rate_observations`, `engine_logs` | No (scratchpad) |
| `start_pass2` | `pass2_runs`, JSON staging | No (scratchpad) |
| `save_to_vault` | `opportunities_vault` | ✅ YES (Neon) |

---

## Updated Edge Function Signatures

### start_pass1
```typescript
POST /functions/start_pass1
Request: { zip_code, urban_exclude?, multifamily_priority?, ... }
Response: { success, run_id, status, opportunity, summary, timestamp }
```

### start_local_scan
```typescript
POST /functions/start_local_scan
Request: { run_id, radius_miles, include_pricing?, generate_call_sheet? }
Response: { success, run_id, local_scan_results, call_sheet, pricing_readiness, timestamp }
```

### trigger_calls
```typescript
POST /functions/trigger_calls
Request: { run_id, max_calls?, prioritize_by? }
Response: { success, batch_id, calls_triggered, calls_failed, estimated_duration_minutes, timestamp }
```

### call_webhook
```typescript
POST /functions/call_webhook
Request: { batch_id, call_id, facility_id, status, transcript?, extracted_data? }
Response: { success, pricing_updated, timestamp }
```

### start_pass2
```typescript
POST /functions/start_pass2
Request: { run_id, acreage?, land_cost_per_acre?, force_run? }
Response: { success, mode, run_id, status, opportunity, verdict, timestamp }

DRY RUN: POST /functions/start_pass2?dry_run=true
```

### save_to_vault
```typescript
POST /functions/save_to_vault
Request: { run_id, include_attachments?, tags?, notes? }
Response: { success, vault_id, saved_at, summary, timestamp }
```

---

## Lovable Dry Run Ready Checklist

- [x] No dynamic imports in orchestrators
- [x] No dynamic imports in spokes
- [x] No dynamic imports in edge functions
- [x] No Node.js APIs used
- [x] No unsupported Cloudflare features
- [x] No direct Neon calls (except save_to_vault)
- [x] No filesystem usage
- [x] All orchestrators invoked from edge functions
- [x] All data goes through @lovable/cloud-db
- [x] All returns are JSON-serializable
- [x] Pass-2 dry-run endpoint available
- [x] Opportunity object persisted in DB between calls
- [x] Architecture NOT rebuilt (only patched)

---

## Testing the Dry Run

### Via UI Button
Add a button in Lovable.dev that calls:
```javascript
const response = await fetch('/functions/start_pass2?dry_run=true', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});
const result = await response.json();
console.log('Dry run result:', result);
```

### Via curl
```bash
curl -X POST "http://localhost:8787/functions/start_pass2?dry_run=true"
```

### Via wrangler
```bash
wrangler dev
# Then in another terminal:
curl http://localhost:8787/functions/start_pass2?dry_run=true
```

---

## Production Deployment

To switch from mock DB to production:

1. Update `src/engine/shared/lovable_adapter.ts`:
```typescript
// Change this:
export const db: LovableDB = createMockDB();

// To this:
import { db } from "@lovable/cloud-db";
export { db };
```

2. Deploy edge functions via Lovable.dev dashboard

3. Configure environment variables for any external APIs (Google Places, AI Dialer, etc.)

---

## Architecture NOT Changed

The following architecture elements were preserved:
- ✅ Hub-and-Spoke folder structure
- ✅ Pass 1 / Pass 2 hub separation
- ✅ All spoke modules
- ✅ Opportunity Object types
- ✅ Orchestrator flow logic
- ✅ Spoke function signatures

Only **runtime compatibility** was patched, not the architecture itself.

---

## Pass-2 Shell Implementation (2024-12-05)

### New Files Created

| File | Purpose |
|------|---------|
| `src/engine/pass2_hub/types/pass2_types.ts` | Complete typed shells for all Pass-2 results |

### Updated Spoke Files

Each spoke now exports a new shell function returning typed results:

| Spoke | Shell Function | Return Type |
|-------|---------------|-------------|
| `zoning/index.ts` | `runZoningShell()` | `ZoningResult` |
| `permits/index.ts` | `runPermitShell()` | `PermitResult` |
| `pricing_verification/index.ts` | `runPricingShell()` | `PricingVerificationResult` |
| `fusion_demand/index.ts` | `runFusionShell()` | `FusionDemandResult` |
| `competitive_pressure/index.ts` | `runCompPressureShell()` | `CompetitivePressureResult` |
| `feasibility/index.ts` | `runFeasibilityShell()` | `FeasibilityResult` |
| `reverse_feasibility/index.ts` | `runReverseShell()` | `ReverseFeasibilityResult` |
| `industrial_momentum/index.ts` | `runMomentumShell()` | `MomentumResult` |
| `verdict/index.ts` | `runVerdictShell()` | `VerdictResult` |

### Updated Orchestrator

| File | New Export |
|------|------------|
| `pass2_orchestrator.ts` | `runPass2Shell()` returns `TypedPass2Output` |

### Updated Edge Function

| File | Changes |
|------|---------|
| `start_pass2.ts` | Dry-run now uses `runPass2Shell()`, returns `pass2Results` with typed output |

---

## Remaining TODOs (For Production)

### Spoke TODOs - Neon Database Queries

| Spoke | TODO |
|-------|------|
| **Zoning** | Query `jurisdiction_cards` table for zoning data |
| **Zoning** | Query `jurisdiction_zoning` table for zone classifications |
| **Zoning** | Implement zoning scraper fallback for uncached counties |
| **Permits** | Query `jurisdiction_permits` table for permit requirements |
| **Permits** | Query `jurisdiction_tpa` table for building department contacts |
| **Permits** | Implement permit portal scraper integration |
| **Pricing** | Query `rate_observations` table for market rates |
| **Pricing** | Query `market_rate_benchmarks` for county-level data |
| **Competitive Pressure** | Query `storage_pipeline` table for new supply |
| **Industrial Momentum** | Query `mfg_announcements` for recent projects |
| **Industrial Momentum** | Query `distribution_centers` for logistics presence |
| **Industrial Momentum** | Query `employment_data` for job growth |
| **Industrial Momentum** | Fetch `warehouse_vacancy_pct` from market data |
| **Housing Pipeline** | Query `housing_pipeline` for planned developments |
| **Housing Pipeline** | Query `permits_raw` for recent housing permits |
| **Housing Pipeline** | Query `housing_communities` for existing developments |

### Data Sources Required

| Table | Source | Priority |
|-------|--------|----------|
| `jurisdiction_cards` | Manual entry / scrapers | High |
| `jurisdiction_permits` | Manual entry / scrapers | High |
| `rate_observations` | AI Caller results | High |
| `storage_pipeline` | Industry reports / scrapers | Medium |
| `mfg_announcements` | News scrapers / economic dev | Medium |
| `housing_pipeline` | Permit scrapers | Medium |

---

## Shell Status Legend

Each spoke result includes a `status` field:

| Status | Meaning |
|--------|---------|
| `stub` | Using placeholder data - TODO not implemented |
| `ok` | Real data fetched successfully |
| `error` | Error occurred during data fetch |

---

## Pass-1 Full Implementation (2024-12-05)

### Spoke Files Updated

All Pass-1 spokes now have real logic using Lovable.DB:

| Spoke | File | Status | Description |
|-------|------|--------|-------------|
| **ZIP Hydration** | `zip_hydration/index.ts` | ✅ Implemented | Queries `zip_master` table for ZIP metadata |
| **Radius Builder** | `radius_builder/index.ts` | ✅ Implemented | Uses Haversine distance, aggregates by county |
| **Macro Demand** | `macro_demand/index.ts` | ✅ Implemented | `demand_sqft = population × 6` |
| **Macro Supply** | `macro_supply/index.ts` | ✅ Implemented | Queries `competitors_scratchpad` table |
| **Hotspot Scoring** | `hotspot_scoring/index.ts` | ✅ Implemented | Marks counties where `demand > 1.25 × supply` |
| **Local Scan** | `local_scan/index.ts` | ✅ Implemented | Configurable radius (5-30mi), fetches competitors |
| **Call Sheet** | `call_sheet/index.ts` | ✅ Implemented | Structured output with `unit_size_targets: ['10x10', '10x20']` |

### Pass-1 Orchestrator Updates

| File | Changes |
|------|---------|
| `pass1_orchestrator.ts` | Full spoke integration, JSON-safe returns, hotspot detection |

### Pass-1 Data Flow

```
Input: ZIP code + toggles
         │
         ▼
┌────────────────────┐
│  1. hydrateZip()   │
│  └─ zip_master     │
│  └─ Returns: identity, zip_metadata
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  2. buildRadius120()│
│  └─ Haversine calc │
│  └─ Returns: radius_counties[], total_population
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  3. runMacroDemand()│
│  └─ demand_sqft = pop × 6
│  └─ Returns: MacroDemandResult
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  4. fetchCompetitors()│
│  └─ competitors_scratchpad
│  └─ Returns: Competitor[], MacroSupplyResult
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  5. identifyHotspots()│
│  └─ demand > 1.25 × supply
│  └─ Returns: CountyHotspot[]
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  6. computeHotspots()│
│  └─ Weighted scoring
│  └─ Returns: HotspotScore (tier A/B/C/D)
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  7. runLocalScan() │ (Optional)
│  └─ 5-30mi radius slider
│  └─ Returns: LocalScanResults
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  8. generateCallSheet()│
│  └─ unit_size_targets
│  └─ Returns: CallSheetEntry[]
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  9. assembleOpportunityObject()│
│  └─ JSON-serializable
│  └─ Returns: Pass1Output
└────────────────────┘
```

### Pass-1 Output Structure

```typescript
interface Pass1Output {
  success: boolean;
  status: 'ok' | 'stub' | 'error';
  opportunity: OpportunityObject;
  hotspots: CountyHotspot[];
  summary: Pass1Summary;
  error?: string;
}

interface Pass1Summary {
  zip: string;
  city: string;
  county: string;
  state: string;
  population: number;
  demand_sqft: number;
  competitor_count: number;
  supply_sqft: number;
  hotspot_count: number;
  county_count: number;
  tier: 'A' | 'B' | 'C' | 'D';
  viability_score: number;
  proceed_to_pass2: boolean;
}

interface CountyHotspot {
  county: string;
  state: string;
  population: number;
  demand_sqft: number;
  estimated_supply_sqft: number;
  supply_gap_sqft: number;
  supply_ratio: number;
  is_hotspot: boolean;
  distance_miles?: number;
}
```

### Lovable.DB Tables Used

| Table | Spoke | Purpose |
|-------|-------|---------|
| `zip_master` | ZIP Hydration, Radius Builder | ZIP code metadata |
| `competitors_scratchpad` | Macro Supply, Local Scan | Storage facility data |
| `call_batches` | Call Sheet | AI dialer batch tracking |
| `rate_observations` | Call Sheet | Pricing data storage |
| `engine_logs` | All | Operation logging |

### Key Formulas Implemented

| Formula | Description |
|---------|-------------|
| `demand_sqft = population × 6` | Industry standard demand per capita |
| `Haversine distance` | Accurate geographic distance calculation |
| `hotspot = demand > 1.25 × supply` | County undersupply threshold |
| `density_score = 100 - (competitors × adjustment)` | Competition intensity |

### Pass-1 Dry-Run Endpoint

```bash
curl -X POST "https://your-lovable-app.com/functions/start_pass1" \
  -H "Content-Type: application/json" \
  -d '{"zip_code": "22401", "toggles": {"urban_exclude": false, "multifamily_priority": true, "recreation_load": false, "industrial_momentum": true, "analysis_mode": "build"}}'
```

---
