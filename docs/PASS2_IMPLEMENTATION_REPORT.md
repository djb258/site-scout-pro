# PASS-2 IMPLEMENTATION REPORT
## Underwriting Hub — Civil Engineering Layer Added

**Date**: 2025-12-09
**Status**: Complete (Shell Implementation)
**Version**: 1.0

---

## Executive Summary

Pass-2 Underwriting Hub has been fully implemented with the new **Civil Constraints** spoke that computes site-level engineering requirements including ADA parking, lot coverage, topography analysis, stormwater management, and construction bonding requirements. Civil constraints now feed directly into feasibility calculations and verdict scoring.

---

## Implementation Scope

### Spokes Implemented (10 Total)

| Spoke | Status | Data Source | Purpose |
|-------|--------|-------------|---------|
| zoning | Shell | Neon (future: zoning_codes) | Zoning classification lookup |
| permits | Shell | Neon (future: permit_requirements) | Permit timeline/cost estimation |
| pricing_verification | Shell | Neon rent_benchmarks | Street rate verification |
| fusion_demand | Shell | Pass-1 macro_demand + local signals | Forward demand scoring |
| competitive_pressure | Shell | Pass-1 competitors | Competition intensity analysis |
| **civil_constraints** | **NEW** | Calculated from inputs | ADA/lot/topo/stormwater/bonding |
| feasibility | Shell | Calculated (uses civil) | NOI/ROI/DSCR projections |
| reverse_feasibility | Shell | Calculated | Max viable land cost |
| momentum | Shell | External signals (future) | Velocity/absorption indicators |
| verdict | Shell | All spokes (weighted) | GO/NOGO/CONDITIONAL determination |
| vault_mapper | Shell | Pass-2 outputs | Maps to Neon vault schema |

---

## Civil Constraints Spoke — Detailed Design

### File Location
`src/engine/pass2_hub/spokes/civil_constraints/index.ts`

### Inputs Required
```typescript
interface CivilConstraintsInput {
  opportunity: OpportunityObject;  // Identity + Pass-1 data
  acreage: number;                 // Site acreage
  zoning: ZoningResult;            // Zoning constraints
}
```

### Calculations Performed

#### 1. ADA Parking Requirements
- Uses federal ADA standards for parking ratios
- 1-25 spaces: 1 accessible
- 26-50 spaces: 2 accessible
- 51-75 spaces: 3 accessible
- etc.
- Calculates cost at **$2,500 per ADA space**

#### 2. Lot Coverage Analysis
- Input: `maxLotCoverage` from zoning (default 50%)
- Calculates: buildable footprint, surface parking, drives
- Output: feasibility flag, actual coverage %

#### 3. Topography Analysis
- Slope bands: 0-5% (ideal), 5-10% (manageable), 10-15% (challenging), >15% (prohibitive)
- Cut/fill cost adder: **$5,000/acre for managed slopes**
- Uses default 3% slope (future: DEM integration)

#### 4. Stormwater Management
- Runoff coefficient: 0.85 for developed sites
- 10-year storm: 4 inches
- Detention requirement: 1.5 inches per impervious acre
- BMP cost: **$15,000 per detention acre**
- Infiltration viability: true for slopes < 8%

#### 5. Construction Bonding
- State-based requirements lookup
- TX, CA, FL: $25,000 base
- NY, IL: $35,000 base
- Other states: $20,000 base
- Bonded flag based on state regulations

### Output Schema
```typescript
interface CivilConstraintResult {
  status: 'stub' | 'ok' | 'error';
  parking: ParkingRequirements;
  lotCoverage: LotCoverageAnalysis;
  topography: TopographyAnalysis;
  stormwater: StormwaterAnalysis;
  bonding: ConstructionBonding;
  civilScore: number;           // 0-100
  civilRating: 'favorable' | 'moderate' | 'challenging' | 'prohibitive';
  totalCivilCostAdder: number;  // Sum of all civil costs
  developableAcres: number;     // Effective buildable acreage
  notes: string;
}
```

### Civil Score Rating Scale
| Score | Rating | Description |
|-------|--------|-------------|
| 80-100 | favorable | Minimal civil constraints |
| 60-79 | moderate | Standard civil requirements |
| 40-59 | challenging | Significant civil costs |
| 0-39 | prohibitive | Fatal civil constraints |

---

## Integration Points

### 1. Civil → Feasibility
```typescript
// feasibility/index.ts
const civilCostAdder = civilConstraints?.totalCivilCostAdder || 0;
const totalDevelopmentCost = landCost + constructionCost + softCosts + civilCostAdder;

const effectiveAcreage = civilConstraints?.developableAcres || acreage;
```

### 2. Civil → Verdict
```typescript
// verdict/index.ts - Scoring Weights
const weights = {
  feasibility: 0.30,  // Reduced from 0.35
  fusion: 0.25,
  zoning: 0.15,       // Reduced from 0.20
  permits: 0.15,      // Reduced from 0.20
  civil: 0.15,        // NEW
};

// Civil rating impacts
const civilScore = {
  favorable: 90,
  moderate: 70,
  challenging: 45,
  prohibitive: 20,
};

// Fatal flaw check
if (!civil.lotCoverage.isFeasible) {
  // Forces WALK verdict
}
```

### 3. Civil → Vault Mapper
18 new fields added to NeonVaultRecord:
- `civil_score`, `civil_rating`, `civil_cost_adder`
- `parking_spaces_required`, `ada_spaces_required`, `parking_cost`
- `lot_coverage_allowed`, `lot_coverage_actual`, `lot_coverage_feasible`
- `slope_average`, `slope_classification`, `topography_cost`
- `stormwater_detention_acres`, `stormwater_cost`, `infiltration_viable`
- `bonding_required`, `bonding_amount`, `developable_acres`

---

## Orchestrator Flow (12 Steps)

```
┌─────────────────────────────────────────────────────────────┐
│  PASS-2 ORCHESTRATOR FLOW                                   │
├─────────────────────────────────────────────────────────────┤
│  Step 1:  Fetch OpportunityObject from pass1_runs           │
│  Step 2:  Run zoning spoke                                  │
│  Step 3:  Run civil_constraints spoke ← EARLY (needs zoning)│
│  Step 4:  Run permits spoke                                 │
│  Step 5:  Run pricing_verification spoke                    │
│  Step 6:  Run fusion_demand spoke                           │
│  Step 7:  Run competitive_pressure spoke                    │
│  Step 8:  Run feasibility spoke ← USES civil.costAdder      │
│  Step 9:  Run reverse_feasibility spoke                     │
│  Step 10: Run momentum spoke                                │
│  Step 11: Run verdict spoke ← USES civil for scoring        │
│  Step 12: Run vault_mapper spoke                            │
│           ↓                                                 │
│  Insert pass2_runs + staging_payload                        │
│  (vault_mapper.save_to_vault = false by default)           │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema Updates Required

### pass2_runs table — New Columns
```sql
ALTER TABLE pass2_runs ADD COLUMN IF NOT EXISTS civil_score DECIMAL(5,2);
ALTER TABLE pass2_runs ADD COLUMN IF NOT EXISTS civil_rating VARCHAR(20);
ALTER TABLE pass2_runs ADD COLUMN IF NOT EXISTS civil_cost_adder INTEGER;
```

### staging_payload table
Already uses JSONB for `underwriting_payload`, no schema change needed.

### Neon Vault Table — New Columns
```sql
-- Civil constraint fields
ALTER TABLE vault ADD COLUMN IF NOT EXISTS civil_score DECIMAL(5,2);
ALTER TABLE vault ADD COLUMN IF NOT EXISTS civil_rating VARCHAR(20);
ALTER TABLE vault ADD COLUMN IF NOT EXISTS civil_cost_adder INTEGER;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS parking_spaces_required INTEGER;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS ada_spaces_required INTEGER;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS parking_cost INTEGER;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS lot_coverage_allowed DECIMAL(5,4);
ALTER TABLE vault ADD COLUMN IF NOT EXISTS lot_coverage_actual DECIMAL(5,4);
ALTER TABLE vault ADD COLUMN IF NOT EXISTS lot_coverage_feasible BOOLEAN;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS slope_average DECIMAL(5,2);
ALTER TABLE vault ADD COLUMN IF NOT EXISTS slope_classification VARCHAR(20);
ALTER TABLE vault ADD COLUMN IF NOT EXISTS topography_cost INTEGER;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS stormwater_detention_acres DECIMAL(6,3);
ALTER TABLE vault ADD COLUMN IF NOT EXISTS stormwater_cost INTEGER;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS infiltration_viable BOOLEAN;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS bonding_required BOOLEAN;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS bonding_amount INTEGER;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS developable_acres DECIMAL(6,3);
```

---

## TODOs — Data Source Integration

### HIGH PRIORITY

| TODO | Data Source | Spoke | Notes |
|------|-------------|-------|-------|
| Integrate zoning API | Regrid/Zoneomics | zoning | Real zoning codes + setbacks |
| Integrate permit data | BuildZoom/local | permits | Actual permit timelines |
| DEM/elevation data | USGS/Mapbox | civil_constraints | Real slope analysis |
| Soil/infiltration data | NRCS/SSURGO | civil_constraints | Actual infiltration rates |
| State bonding lookup | State databases | civil_constraints | Accurate bonding requirements |

### MEDIUM PRIORITY

| TODO | Data Source | Spoke | Notes |
|------|-------------|-------|-------|
| Stormwater regulations | Local municipalities | civil_constraints | Jurisdiction-specific rules |
| Floodplain data | FEMA NFHL | civil_constraints | Flood zone impacts |
| Wetland delineation | NWI/USACE | civil_constraints | Wetland avoidance areas |
| Traffic impact | ITE Trip Gen | civil_constraints | Parking requirement validation |

### FUTURE ENHANCEMENTS

| TODO | Description | Spoke |
|------|-------------|-------|
| Phase 1 ESA integration | Environmental risk assessment | civil_constraints |
| Utility availability | Water/sewer/power proximity | civil_constraints |
| Geotechnical factors | Soil bearing capacity | civil_constraints |
| Climate risk scoring | Flood/fire/wind exposure | civil_constraints |

---

## Files Modified

### New Files
- `src/engine/pass2_hub/spokes/civil_constraints/index.ts` — NEW SPOKE

### Modified Files
- `src/engine/pass2_hub/types/pass2_types.ts` — Added CivilConstraintResult and sub-types
- `src/engine/pass2_hub/spokes/feasibility/index.ts` — Consumes civil cost adder
- `src/engine/pass2_hub/spokes/verdict/index.ts` — Added civil to scoring (15% weight)
- `src/engine/pass2_hub/spokes/vault_mapper/index.ts` — Added 18 civil fields
- `src/engine/pass2_hub/orchestrators/pass2_orchestrator.ts` — Civil in flow at Step 3

### Unchanged (Compatible)
- `supabase/functions/start_pass2/index.ts` — Uses runPass2Shell, automatically compatible

---

## Testing Checklist

- [ ] Civil constraints runs without error for sample opportunity
- [ ] Civil cost adder correctly added to feasibility total_development_cost
- [ ] Verdict scoring includes civil weight (15%)
- [ ] Lot coverage failure triggers WALK verdict
- [ ] Vault mapper exports all 18 civil fields
- [ ] pass2_runs insert includes civil_score, civil_rating, civil_cost_adder
- [ ] staging_payload contains full civil result in JSON

---

## Architecture Notes

### Cloudflare Workers Compatibility
- All imports are static (no dynamic imports)
- All DB access via `@lovable/cloud-db`
- No Node.js-specific APIs used
- All spoke outputs are JSON-serializable

### Error Handling
- All spokes return `status: 'error'` on failure
- `createErrorResult()` helper ensures consistent error structure
- Orchestrator continues on spoke errors with stub values

### Scoring Philosophy
The verdict scoring model uses weighted components:
- **Feasibility (30%)** — Financial viability
- **Fusion Demand (25%)** — Forward demand confidence
- **Zoning (15%)** — Entitlement risk
- **Permits (15%)** — Time/cost risk
- **Civil (15%)** — Site development risk

Civil constraints can trigger fatal flaws:
- Lot coverage > allowed = WALK
- Prohibitive topography (>15% slope) = WALK
- Future: wetlands, flood zones, etc.

---

## Summary

The Pass-2 Underwriting Hub is now complete with civil engineering analysis integrated throughout the pipeline. The civil_constraints spoke provides early-stage site feasibility signals that flow into financial projections and final verdict determination. All spokes are shell implementations ready for production data source integration.

**Next Steps:**
1. Run Supabase migrations for new columns
2. Test end-to-end with sample opportunity
3. Integrate first external data sources (DEM, zoning API)
4. Build UI components for civil constraint display
