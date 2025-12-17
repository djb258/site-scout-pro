# BARTON STORAGE APPLICATION

**Operational Doctrine | Evaluation Engine | Decision System**

---

## 1. OVERVIEW

The Barton Storage Application is a structured evaluation and decision engine used to identify, score, and approve land for storage-based commercial assets.

The system uses the **Barton Storage Doctrine**, a strict set of operational rules, financial thresholds, and pivot logic to determine whether a parcel qualifies for acquisition.

> This application does not rely on emotion, intuition, or guesswork.
> It uses pass/fail gates, weighted scoring, kill-switches, and pivot modeling to determine one outcome:

```
┌─────────────────────────────────────┐
│       BUY  •  HOLD  •  WALK         │
└─────────────────────────────────────┘
```

The application is built to interface with:

- **Lovable.dev UI** — Frontend interface
- **Neon database** — Persistent vault storage
- **Pass-0 / Pass-1 / Pass-1.5 / Pass-2 / Pass-3 engine** — Evaluation pipeline
- **Cloud agents** — Enrichment and data fetch

---

## 2. WHAT THE APPLICATION IS LOOKING FOR

The system evaluates land for one purpose:

> **To produce a dynasty-grade commercial storage asset generating at least $5,000/month per acre.**

### Approved Asset Types

| Asset Type | Description |
|------------|-------------|
| Drive-up self-storage | Traditional climate/non-climate units |
| RV & boat storage | Covered and uncovered recreational vehicle parking |
| Trailer yards | Semi/chassis/container storage |
| Tow & insurance impound yards | Vehicle impound and auction staging |
| Truck parking & fleet storage | Commercial vehicle overnight/long-term parking |
| Contractor/tradesmen yards | Equipment and material staging |
| Heavy equipment yards | Construction and industrial equipment storage |
| Car dealership overflow storage | Dealer inventory overflow |
| Container drop-lot storage | Intermodal container staging |

**Anything below $5,000/acre is automatically disqualified.**

---

## 3. BARTON STORAGE DOCTRINE (FOUNDATION OF THE SYSTEM)

### Prime Directive

> **Storage is an asset engine — not a job.**
> Deals must be predictable, scalable, low labor, and compounding.

### Core Rules

| Rule | Description |
|------|-------------|
| **$5,000/Month Per Acre Minimum** | Non-negotiable floor for asset viability |
| **Phase-First Construction** | 20–40 units → 85% occupancy → Phase 2 |
| **Porta-John Rule** | No water/sewer/employee requirements |
| **Pivotability Requirement** | Must support RV, truck, contractor, equipment pivots |
| **Sovereignty Rule** | No variances or politics |
| **No-Emotion Rule** | Math wins |

### Evaluation Loop

```
Land → Zoning → Indicators → Competition → Feasibility → NOI → Pivot → Decision
```

---

## 4. PASS / FAIL GATES (HARD FILTERS)

The application will not score a parcel unless it passes **all five gates**:

### Gate 1: Profitability Gate
- ≥ $5,000/acre/month projected
- ≥ $3,750/acre/month under 25% NOI reduction

### Gate 2: Zoning Gate
- Must be by-right for storage, yard, or parking
- No hearings, variances, political friction

### Gate 3: Access Gate
- Simple ingress/egress
- Adequate geometry for trailers & trucks
- No severe slope or grading obstacles

### Gate 4: Buildability Gate
- Phase 1 rent-ready in < 90 days
- Dirt work manageable

### Gate 5: Debt Survivability Gate
- Must survive full P&I at 6% on a 25-year amort
- Must survive 25% NOI haircut

```
┌────────────────────────────────────────────────────┐
│  ANY FAIL = AUTOMATIC WALK                         │
│  The scoring matrix will not run.                  │
└────────────────────────────────────────────────────┘
```

---

## 5. WEIGHTED SCORING MATRIX (0–100 POINTS)

**Only runs after passing all gates.**

| Category | Weight | Description |
|----------|--------|-------------|
| Market Demand Indicators | 20 | Housing, business growth, roads, permits, population trend |
| Competition & Pricing | 20 | Local rents, occupancy, saturation, megastore risk |
| Land Geometry & Access | 15 | Shape, slope, road frontage, truck flow |
| Build Cost & Timeline | 15 | < $27/sqft, dirt work cost, Phase 1 timeline |
| NOI Robustness | 15 | Sensitivity under rent reduction & expense drift |
| Pivot Flexibility | 10 | Ability to pivot into RV, truck, tow, contractor uses |
| Operational Simplicity | 5 | Low-maintenance, low-staffing, low-touch |

**Total: 100 points**

---

## 6. DEAL INDEX (0–10 SCORE)

Once the matrix is totaled, the system produces a **Deal Index (DI)**:

```
DI = (Score / 100) × 10
```

### Interpretation

| DI Range | Meaning | Action |
|----------|---------|--------|
| **9–10** | Immediate Buy | Execute acquisition |
| **7–8.9** | Strong Deal | Proceed to refinement |
| **5–6.9** | Marginal | Pivot-dependent |
| **< 5** | Walk | Do not pursue |

---

## 7. KILL SWITCHES

Kill switches override all scores and force an **automatic WALK**:

| Kill Switch | Trigger |
|-------------|---------|
| **NIMBY Risk** | Neighbor/community opposition detected |
| **Utility Entanglement** | Water/sewer required for operation |
| **Environmental/Flood** | Wetlands, flood zone, contamination |
| **Mega-Operator Expansion** | Public Storage, Extra Space, CubeSmart expanding nearby |
| **Access Failure** | Truck geometry impossible |
| **Excessive Dirt Work** | >20% of project cost in grading/site prep |

```
┌────────────────────────────────────────────────────┐
│  ANY KILL SWITCH = AUTOMATIC WALK                  │
│  Score is irrelevant.                              │
└────────────────────────────────────────────────────┘
```

---

## 8. PIVOT SCORING MODULE (0–30 POINTS)

This module assesses alternate-asset feasibility in case classic storage is not optimal.

### Categories (0–10 each)

| Pivot Category | Max Points | Evaluation Criteria |
|----------------|------------|---------------------|
| RV & Boat Pivot | 10 | Lake/recreation proximity, seasonal demand |
| Truck Parking Pivot | 10 | Highway access, industrial corridor, overnight demand |
| Tow/Insurance Pivot | 10 | Police contracts, auction demand, impound need |
| Contractor/Equipment Yard Pivot | 10 | Construction activity, trade density |

### Pivot Score Integration

```
Final DI = (Deal Index × 0.7) + (PivotScore/30 × 0.3 × 10)
```

> **High pivot scores rescue good dirt with weak storage demand.**

---

## 9. FINAL DECISION LOGIC

The application produces one of three outcomes:

### BUY
- Passes all gates
- DI ≥ 7
- No kill switches
- Healthy pivot strength

### HOLD / OPTION
- DI 5–6.9
- Strong pivot potential
- Geometry favorable

### WALK
- Any hard fail
- Any kill switch
- DI < 5
- Weak pivot environment

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   GATE CHECK ──► SCORING MATRIX ──► KILL SWITCH ──► DECISION   │
│       │               │                  │              │       │
│      FAIL            RUN               TRIP           OUTPUT    │
│       │               │                  │              │       │
│       ▼               ▼                  ▼              ▼       │
│     WALK          0-100 pts           WALK      BUY/HOLD/WALK   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. SYSTEM PURPOSE

The Barton Storage Application provides:

| Capability | Description |
|------------|-------------|
| **Repeatable Engine** | Emotionless acquisition evaluation |
| **Complete Scoring Model** | Scoring + pivot model for all parcels |
| **Risk Elimination** | Strict risk elimination framework |
| **Trust-Aligned Filter** | Asset filter aligned with dynasty goals |
| **Automated Pipeline** | Pass 0 → Pass 1 → Pass 1.5 → Pass 2 → Pass 3 |

> **Every site is evaluated the same way, every time, by doctrine.**

---

## 11. HUB-AND-SPOKE ARCHITECTURE

The evaluation engine is implemented as a 5-pass hub-and-spoke system:

```
Pass0 ──► Pass1 ──► Pass1.5 ──► Pass2 ──► Pass3
  │         │          │          │         │
  ▼         ▼          ▼          ▼         ▼
RADAR    STRUCTURE   RENT      UNDER-    DESIGN/
 HUB       HUB      RECON     WRITING   CALCULATOR
                     HUB        HUB        HUB
```

### PASS 0 — RADAR HUB (Variables)
**Purpose:** Aggregates momentum signals before site-specific analysis

| Spoke | Doctrine ID | Function |
|-------|-------------|----------|
| TrendSignal | SS.00.01 | Google Trends, search volume growth |
| PermitActivity | SS.00.02 | Commercial/residential permit tracking |
| NewsEvents | SS.00.03 | Major employer announcements, infrastructure |
| IndustrialLogistics | SS.00.04 | Warehouse vacancy, logistics facilities |
| HousingPipeline | SS.00.05 | Multifamily/single-family starts |
| MomentumFusion | SS.00.06 | Fused momentum score calculation |

### PASS 1 — STRUCTURE HUB (Constants)
**Purpose:** Market reconnaissance and hotspot identification

| Spoke | Doctrine ID | Function |
|-------|-------------|----------|
| ZipHydration | SS.01.01 | ZIP metadata, demographics, coordinates |
| RadiusBuilder | SS.01.02 | 120-mile radius county aggregation |
| MacroDemand | SS.01.03 | Population growth, employment, housing |
| MacroSupply | SS.01.04 | Existing storage facilities, sqft/capita |
| CompetitorRegistry | SS.01.05 | Competitor inventory, brand breakdown |
| LocalScan | SS.01.06 | Amenities, traffic, visibility, access |
| HotspotScoring | SS.01.07 | Weighted hotspot score, tier assignment |
| ValidationGate | SS.01.08 | Pass/fail checks, promotion decision |

### PASS 1.5 — RENT RECON HUB
**Purpose:** Rate evidence collection and verification before underwriting

| Spoke | Doctrine ID | Function |
|-------|-------------|----------|
| PublishedRateScraper | SS.015.01 | Website/aggregator rate scraping |
| AICallWorkOrders | SS.015.02 | AI voice call rate collection |
| RateEvidenceNormalizer | SS.015.03 | Rate normalization, averages, medians |
| CoverageConfidence | SS.015.04 | Coverage score, confidence level |
| PromotionGate | SS.015.05 | Pass/fail for Pass-2 promotion |

### PASS 2 — UNDERWRITING HUB
**Purpose:** Site-specific underwriting and feasibility analysis

| Spoke | Doctrine ID | Function |
|-------|-------------|----------|
| Zoning | SS.02.01 | Zoning code, storage allowed, setbacks |
| CivilConstraints | SS.02.02 | Flood zone, wetlands, utilities, slope |
| PermitsStatic | SS.02.03 | Recent permits, jurisdiction difficulty |
| PricingVerification | SS.02.04 | Verified rates, market averages |
| FusionDemand | SS.02.05 | Fused demand score, drivers |
| CompetitivePressure | SS.02.06 | Pressure score, saturation level |
| Feasibility | SS.02.07 | Units, sqft, revenue, NOI, cap rate, DSCR |
| ReverseFeasibility | SS.02.08 | Max land price, break-even occupancy |
| MomentumReader | SS.02.09 | Pass-0 momentum integration |
| Verdict | SS.02.10 | GO/NO_GO/MAYBE, fatal flaws, strengths |
| VaultMapper | SS.02.11 | Vault storage mapping, field stamping |

### PASS 3 — DESIGN/CALCULATOR HUB
**Purpose:** Detailed pro forma modeling and financial analysis

| Spoke | Doctrine ID | Function |
|-------|-------------|----------|
| SetbackEngine | SS.03.01 | Buildable area, setback polygon |
| CoverageEngine | SS.03.02 | Max buildable sqft, coverage %, stories |
| UnitMixOptimizer | SS.03.03 | Unit mix optimization, rent/sqft |
| PhasePlanner | SS.03.04 | Phase planning, construction timeline |
| BuildCostModel | SS.03.05 | Hard/soft costs, contingency, cost/sqft |
| NOIEngine | SS.03.06 | GPR, vacancy, EGI, OpEx, NOI |
| DebtModel | SS.03.07 | Loan amount, DSCR, LTV |
| MaxLandPrice | SS.03.08 | Residual land value analysis |
| IRRModel | SS.03.09 | Project IRR, equity multiple, NPV |

---

## 12. EDGE FUNCTIONS

Edge functions provide serverless entry points for Lovable.dev and Cloudflare Workers.

| Endpoint | File | Orchestrator | Purpose |
|----------|------|--------------|---------|
| `start_pass0` | `src/edge_functions/start_pass0.ts` | Pass0Orchestrator.run() | Initiate momentum analysis |
| `start_pass1` | `src/edge_functions/start_pass1.ts` | Pass1Orchestrator.run() | Initiate market recon |
| `start_pass15` | `src/edge_functions/start_pass15.ts` | Pass15Orchestrator.run() | Initiate rate verification |
| `start_pass2` | `src/edge_functions/start_pass2.ts` | Pass2Orchestrator.run() | Initiate underwriting |
| `start_pass3` | `src/edge_functions/start_pass3.ts` | Pass3Orchestrator.run() | Initiate pro forma |
| `saveToVault` | `src/pass2_underwriting_hub/spokes/VaultMapper.ts` | VaultMapper spoke | Save to Neon vault |

### Edge Function Request Pattern

```typescript
POST /start_passX
Content-Type: application/json

{
  "zip_code": "75001",
  "dry_run": false,
  "options": { ... }
}
```

All edge functions integrate with the Master Failure Log for centralized error tracking.

### Edge Function Promotion Rules (MANDATORY)

The following rules govern edge function behavior. These are absolute constraints enforced by architecture, not operator judgment.

| Rule | Enforcement |
|------|-------------|
| Edge functions MAY hydrate OpportunityObjects or downstream payloads | PERMITTED |
| Edge functions MAY return data to the calling client | PERMITTED |
| Edge functions MAY log failures to console | PERMITTED |
| Edge functions MUST NOT persist data to any database | PROHIBITED |
| Edge functions MUST NOT promote opportunities to downstream passes | PROHIBITED |
| Edge functions MUST NOT write to Neon vault | PROHIBITED |
| Edge functions MUST NOT make promotion decisions | PROHIBITED |

**Promotion Authority:**
- All promotion decisions occur in Pass 1, Pass 2, or Pass 3 orchestrators ONLY
- Pass 0 edge functions return momentum data but CANNOT promote
- Pass 1.5 edge functions return rate evidence but CANNOT promote
- Promotion requires orchestrator context with database credentials

**Violation Response:**
Any edge function that attempts to persist, promote, or vault data:
1. MUST be rejected at code review
2. MUST be logged as `INVARIANT_VIOLATION` if detected at runtime
3. MUST halt execution immediately

---

## 13. MASTER FAILURE LOG

All passes log failures to a centralized Master Failure Log for troubleshooting and audit.

### Log Entry Structure

| Field | Type | Description |
|-------|------|-------------|
| `process_id` | UUID | Unique run identifier (format: `PASSN_YYYYMMDD_HHMMSS_RAND`) |
| `pass` | Enum | PASS0, PASS1, PASS1_5, PASS2, PASS3, DATA_LAYER, SYSTEM |
| `spoke` | String | Spoke name or 'orchestrator' |
| `error_code` | String | Standardized error code |
| `severity` | Enum | info, warning, error, critical |
| `message` | String | Human-readable error message |
| `context` | JSONB | Additional context data |

### Implementation

```typescript
import { logFailure, generateProcessId } from '@/shared/failures/masterFailureLogger';

const processId = generateProcessId('PASS1');
await logFailure({
  process_id: processId,
  pass: 'PASS1',
  spoke: 'ZipHydration',
  error_code: 'ZIP_NOT_FOUND',
  severity: 'error',
  message: 'ZIP code not found in database',
  context: { zip_code: '99999' }
});
```

### Pass Isolation

Each pass operates independently with its own process ID. Failures in one pass do not affect other passes. Troubleshooting can be isolated by filtering on `pass` and `process_id`.

### Dual-Sink Architecture

The Master Failure Logger supports two output sinks:

| Sink | Activation | Purpose |
|------|------------|---------|
| Console | ALWAYS ON | Immediate visibility in logs |
| Supabase | Environment-controlled | Persistent database storage |

### Environment-Based Kill Switch

| Pass | Console | Database |
|------|---------|----------|
| Pass 0 | ON | **OFF** (no credentials in edge) |
| Pass 1 | ON | ON (when configured) |
| Pass 1.5 | ON | ON (when configured) |
| Pass 2 | ON | ON (when configured) |
| Pass 3 | ON | ON (when configured) |

**Pass 0 Failure Logging:** Pass 0 runs in Lovable.dev edge environment where Supabase credentials are intentionally unavailable. Pass 0 failures are logged to console only. This is correct behavior—Pass 0 failures appear in edge function logs but are not persisted to database.

**Kill Switch Trigger:** If `SUPABASE_URL` or `SUPABASE_ANON_KEY` are missing:
- Database sink is DISABLED (silent degradation)
- Console sink remains ACTIVE
- Warning logged to console

---

## 14. DATA LAYER

### Dual-Database Architecture

| Layer | Database | Purpose |
|-------|----------|---------|
| Scratchpad | Supabase | Real-time UI, in-progress data |
| Vault | Neon PostgreSQL | Permanent storage, audit trail |
| Auth | Supabase | User authentication |
| Logs | Both | Engine logs, failure tracking |

### Data Flow

```
Pipeline Execution
    │
    ▼
┌─────────────────┐
│   Supabase      │  ◄── In-progress runs, real-time updates
│  (Scratchpad)   │
└────────┬────────┘
         │
         │  Pass completes successfully
         ▼
┌─────────────────┐
│     Neon        │  ◄── Permanent storage, audit trail
│    (Vault)      │
└─────────────────┘
```

---

## 15. FINANCIAL THRESHOLDS

| Metric | Threshold | Gate |
|--------|-----------|------|
| Minimum NOI/Acre | $5,000/month | Profitability |
| Stressed NOI/Acre | $3,750/month (25% haircut) | Debt Survivability |
| Max Build Cost | $27/sqft | Build Cost |
| Max Dirt Work | 20% of project cost | Kill Switch |
| Target DSCR | 1.25x | Debt Survivability |
| Debt Terms | 6% / 25-year amort | Debt Survivability |
| Phase 1 Timeline | < 90 days to rent-ready | Buildability |
| Stabilization Occupancy | 85% | Phase trigger |

---

## 16. CUT-AND-PASTE SUMMARY BLOCK

```
The Barton Storage Application evaluates land for commercial storage assets
using a strict doctrine-driven framework. It applies mandatory Pass/Fail Gates,
a 100-point Scoring Matrix, kill switches, debt survivability analysis, cost
thresholds, and pivot scoring to produce one of three outcomes: BUY, HOLD, or WALK.

The system enforces a $5,000/month/acre minimum, requires by-right zoning,
and demands full debt survivability under stressed conditions. Every site is
evaluated the same way, every time, by doctrine.

Pipeline: Pass0 (Radar) → Pass1 (Structure) → Pass1.5 (Rent Recon) →
          Pass2 (Underwriting) → Pass3 (Design/Calculator) → Vault
```

---

## 17. VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12 | Initial doctrine codification |
| 1.1.0 | 2024-12 | Added Pass-0 Radar Hub, Pass-1.5 Rent Recon Hub |
| 1.2.0 | 2024-12 | Hub-and-spoke architecture alignment |
| 1.3.0 | 2025-12 | Added edge function file references, Master Failure Log, Data Layer sections |

---

**Document ID:** `BARTON_STORAGE_DOCTRINE_v1.3`
**Classification:** Internal Operations
**Owner:** Barton Storage Systems
