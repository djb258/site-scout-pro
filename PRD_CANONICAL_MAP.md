# PRD Canonical Map — Storage Site Scout

**Last Updated:** 2024-12-19
**Purpose:** Single source of truth for documentation hierarchy and repository structure

---

## Documentation Hierarchy

```
DOCTRINE (Process Locks)
    └── ADRs (Architectural Decisions)
        └── PRDs (Product Requirements)
            └── PRSs (Execution Specs)
                └── Checklists (Compliance Gates)
```

---

## Quick Reference: Pass 2 Changes (2025-12-18)

> **CRITICAL:** Pass 2 has been redefined from "Underwriting Hub" to "Constraint Compiler"
>
> **Old (DEPRECATED):** 11 spokes including financial logic (Feasibility, Verdict, etc.)
> **New (CANONICAL):** 9 spokes, NO financial logic, constraint compilation only
>
> See ADR-019, ADR-020, and `SYSTEM_PROMPT_PASS2.md` for the definitive rules.

---

## PRD Registry

| PRD ID | Pass | Hub Name | Doctrine ID | Spokes | Status |
|--------|------|----------|-------------|--------|--------|
| PRD_PASS0_RADAR_HUB | 0 | PASS0_RADAR_HUB | SS.00.00 | 6 | Active |
| PRD_PASS1_STRUCTURE_HUB | 1 | PASS1_STRUCTURE_HUB | SS.01.00 | 8 | Active |
| PRD_PASS15_RENT_RECON_HUB | 1.5 | PASS15_RENT_RECON_HUB | SS.015.00 | 5 | Active |
| PRD_PASS2_JURISDICTION_CARD | 2 | PASS2_CONSTRAINT_COMPILER | SS.02.00 | 9 | **Active** |
| ~~PRD_PASS2_UNDERWRITING_HUB~~ | 2 | ~~PASS2_UNDERWRITING_HUB~~ | SS.02.00 | 11 | **DEPRECATED** |
| PRD_PASS3_DESIGN_HUB | 3 | PASS3_DESIGN_HUB | SS.03.00 | 9 | Active |
| PRD_DATA_LAYER_HUB | N/A | DATA_LAYER_HUB | SS.DL.00 | 2 | Active |

---

## Cross-Pass Infrastructure

### County Capability Asset (CCA)

**Location:** `ref` schema (NOT inside any pass)
**Doctrine ID:** REF.CCA.00
**Prime Rule:** "Claude thinks. Neon remembers. Lovable orchestrates."

| Type | File | Purpose |
|------|------|---------|
| Doctrine | `docs/doctrine/CountyCapabilityAsset.md` | Cross-pass reference primitive |
| ADR | `docs/adr/ADR-022-county-capability-asset.md` | CCA as infrastructure |
| ADR | `docs/adr/ADR-023-cca-pass2-schema-separation.md` | Schema separation |
| PRD | `docs/prd/PRD_CCA_RECON_AGENT.md` | Recon agent requirements |
| Checklist | `docs/checklists/CCA_RECON_AGENT_COMPLIANCE.md` | Pre-ship compliance |
| Schema Ref | `docs/LOVABLE_SCHEMA_REFERENCE.md` | Schema for Lovable.dev |
| Migration | `supabase/migrations/20251219_cca_and_pass2_schema.sql` | Database schema |
| Types | `src/cca/agent/types.ts` | Recon agent types |
| Agent | `src/cca/agent/CcaReconAgent.ts` | Recon agent implementation |
| Probes | `src/cca/probes/Pass0DataProbe.ts` | Pass 0 capability probe |
| Probes | `src/cca/probes/Pass2DataProbe.ts` | Pass 2 capability probe |
| Consumers | `src/cca/consumers/Pass0Consumer.ts` | Pass 0 read-only API |
| Consumers | `src/cca/consumers/Pass2Consumer.ts` | Pass 2 read-only API |
| PR Template | `templates/pr/PULL_REQUEST_TEMPLATE_CCA.md` | CCA PR template |

**Key Rules:**
- CCA answers HOW to get data, not WHAT the rules are
- CCA Recon Agent selects: API → Scrape → Portal → Manual
- Only CCA Recon Agent writes to CCA (passes are read-only)
- Pass 0 and Pass 2 both read CCA via consumer APIs
- 12-month TTL with automatic expiration
- Lovable orchestrates dispatch based on CCA output

---

## Pass 2: Constraint Compiler (SS.02.00)

**Critical Doctrine:** "Pass 2 defines WHAT is true. CCA defines HOW to collect it."

### Current (Canonical)

| Type | File | Purpose |
|------|------|---------|
| Doctrine | `docs/doctrine/SYSTEM_PROMPT_PASS2.md` | **Process lock** — Definitive rules |
| Doctrine | `docs/doctrine/Pass2ReallyIs.md` | What Pass 2 actually is |
| Spec | `docs/PASS2_JURISDICTION_CARD.md` | What to collect per county |
| ADR | `docs/adr/ADR-019-pass2-really-is.md` | Why Pass 2 is a constraint compiler |
| ADR | `docs/adr/ADR-020-pass2-constraint-compiler-position.md` | Architectural position |
| ADR | `docs/adr/ADR-021-jurisdiction-card-hydration-pipeline.md` | Automated hydration |
| ADR | `docs/adr/ADR-023-cca-pass2-schema-separation.md` | Schema separation |
| PRD | `docs/prd/PRD_PASS2_JURISDICTION_CARD.md` | Jurisdiction card requirements |
| PRS | `docs/prs/PRS_PASS2_CONSTRAINT_COMPILER.md` | Execution specification |
| Checklist | `docs/checklists/PASS2_CONSTRAINT_COMPILER_COMPLIANCE.md` | Pre-ship compliance |
| Checklist | `docs/checklists/PASS2_JURISDICTION_CARD_COMPLIANCE.md` | Schema compliance |
| PR Template | `templates/pr/PULL_REQUEST_TEMPLATE_PASS2_JURISDICTION.md` | Pass 2 PR template |
| Types | `src/pass2/types/jurisdiction_card.ts` | TypeScript types |
| Factories | `src/pass2/factories/jurisdiction_card_factory.ts` | Factory functions |

### Database Tables (pass2 schema)

| Table | Purpose |
|-------|---------|
| `pass2.jurisdiction_scope` | Who governs, at what level |
| `pass2.use_viability` | Should we continue? (gating) |
| `pass2.zoning_envelope` | Numeric constraints for geometry |
| `pass2.fire_life_safety` | Fire and safety constraints |
| `pass2.stormwater_environmental` | Stormwater and environmental |
| `pass2.parking_access` | Parking and access requirements |

### Spokes (9 Total)

| Spoke | Doctrine ID | Purpose |
|-------|-------------|---------|
| JurisdictionResolver | SS.02.01 | ZIP → County resolution |
| JurisdictionCardReader | SS.02.02 | Load jurisdiction card |
| ZoningConstraints | SS.02.03 | Zoning restrictions |
| SitePlanConstraints | SS.02.04 | Site plan requirements |
| StormwaterConstraints | SS.02.05 | Stormwater rules |
| FireAccessConstraints | SS.02.06 | Fire access requirements |
| PermittingChecklist | SS.02.07 | Required permits |
| EnvelopeReducer | SS.02.08 | Geometry-only envelope |
| ConstraintVerdict | SS.02.09 | ELIGIBLE/HOLD/NO_GO |

### Deprecated (Do Not Use)

| File | Superseded By | Why |
|------|---------------|-----|
| `PRD_PASS2_UNDERWRITING_HUB.md` | `PRD_PASS2_JURISDICTION_CARD.md` | Contained financial logic |
| `PASS2_UNDERWRITING_HUB_COMPLIANCE.md` | `PASS2_CONSTRAINT_COMPILER_COMPLIANCE.md` | Wrong spoke count |

### Pass 2 Doctrine Summary

**ALLOWED:**
- ZIP → County resolution
- Read County Capability Asset (CCA)
- Read Jurisdiction Cards
- Detect missing/blocked/stale constraints
- Compute geometry-only envelope (setbacks, coverage, net acres)
- Emit: ELIGIBLE / HOLD_INCOMPLETE / NO_GO

**NOT ALLOWED:**
- NOI, DSCR, IRR, yield, or costs
- Timeline estimates
- Deal scoring or rankings
- Recommendations
- Guessing missing values

---

## Pass 0: Radar Hub (SS.00.00)

**PRD:** `docs/prd/PRD_PASS0_RADAR_HUB.md`
**Checklist:** `docs/checklists/PASS0_RADAR_HUB_COMPLIANCE.md`
**Directory:** `/src/pass0/radar_hub/`

### Spokes (6 Total)
| Spoke | Doctrine ID | File |
|-------|-------------|------|
| TrendSignal | SS.00.01 | `spokes/TrendSignal.ts` |
| PermitActivity | SS.00.02 | `spokes/PermitActivity.ts` |
| NewsEvents | SS.00.03 | `spokes/NewsEvents.ts` |
| IndustrialLogistics | SS.00.04 | `spokes/IndustrialLogistics.ts` |
| HousingPipeline | SS.00.05 | `spokes/HousingPipeline.ts` |
| MomentumFusion | SS.00.06 | `spokes/MomentumFusion.ts` |

### CCA Integration
- Pass 0 reads CCA to determine signal confidence
- `manual_only` or `unknown` capability → low confidence signals
- **DOCTRINE:** Pass 0 may NOT emit high-confidence signals from manual_only/unknown counties

---

## Pass 1: Structure Hub (SS.01.00)

**PRD:** `docs/prd/PRD_PASS1_STRUCTURE_HUB.md`
**Checklist:** `docs/checklists/PASS1_STRUCTURE_HUB_COMPLIANCE.md`
**Directory:** `/src/pass1/structure_hub/`

### Spokes (8 Total)
| Spoke | Doctrine ID | File |
|-------|-------------|------|
| ZipHydration | SS.01.01 | `spokes/ZipHydration.ts` |
| RadiusBuilder | SS.01.02 | `spokes/RadiusBuilder.ts` |
| MacroDemand | SS.01.03 | `spokes/MacroDemand.ts` |
| MacroSupply | SS.01.04 | `spokes/MacroSupply.ts` |
| CompetitorRegistry | SS.01.05 | `spokes/CompetitorRegistry.ts` |
| LocalScan | SS.01.06 | `spokes/LocalScan.ts` |
| HotspotScoring | SS.01.07 | `spokes/HotspotScoring.ts` |
| ValidationGate | SS.01.08 | `spokes/ValidationGate.ts` |

---

## Pass 1.5: Rent Recon Hub (SS.015.00)

**PRD:** `docs/prd/PRD_PASS15_RENT_RECON_HUB.md`
**Checklist:** `docs/checklists/PASS15_RENT_RECON_HUB_COMPLIANCE.md`
**Directory:** `/src/pass15/rent_recon_hub/`

### Spokes (5 Total)
| Spoke | Doctrine ID | File |
|-------|-------------|------|
| PublishedRateScraper | SS.015.01 | `spokes/PublishedRateScraper.ts` |
| AICallWorkOrders | SS.015.02 | `spokes/AICallWorkOrders.ts` |
| RateEvidenceNormalizer | SS.015.03 | `spokes/RateEvidenceNormalizer.ts` |
| CoverageConfidence | SS.015.04 | `spokes/CoverageConfidence.ts` |
| PromotionGate | SS.015.05 | `spokes/PromotionGate.ts` |

---

## Pass 3: Design/Calculator Hub (SS.03.00)

**PRD:** `docs/prd/PRD_PASS3_DESIGN_HUB.md`
**Checklist:** `docs/checklists/PASS3_DESIGN_HUB_COMPLIANCE.md`
**Directory:** `/src/pass3/design_hub/`

### Spokes (9 Total)
| Spoke | Doctrine ID | File |
|-------|-------------|------|
| SetbackEngine | SS.03.01 | `spokes/SetbackEngine.ts` |
| CoverageEngine | SS.03.02 | `spokes/CoverageEngine.ts` |
| UnitMixOptimizer | SS.03.03 | `spokes/UnitMixOptimizer.ts` |
| PhasePlanner | SS.03.04 | `spokes/PhasePlanner.ts` |
| BuildCostModel | SS.03.05 | `spokes/BuildCostModel.ts` |
| NOIEngine | SS.03.06 | `spokes/NOIEngine.ts` |
| DebtModel | SS.03.07 | `spokes/DebtModel.ts` |
| MaxLandPrice | SS.03.08 | `spokes/MaxLandPrice.ts` |
| IRRModel | SS.03.09 | `spokes/IRRModel.ts` |

**Note:** All financial calculations (NOI, DSCR, IRR) belong in Pass 3, NOT Pass 2.

---

## Data Layer Hub (SS.DL.00)

**PRD:** `docs/prd/PRD_DATA_LAYER_HUB.md`
**Checklist:** `docs/checklists/DATA_LAYER_HUB_COMPLIANCE.md`
**Directory:** `/src/shared/data_layer/`

### Components
| Component | Doctrine ID | Status |
|-----------|-------------|--------|
| LovableAdapter | SS.DL.01 | Implemented |
| NeonAdapter | SS.DL.02 | Stub (by design) |

---

## ADR Index

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | Census API | Active |
| ADR-002 | Google Places API | Active |
| ADR-003 | Scoring Engine | Active |
| ADR-004 | Zoning Regrid API | Active |
| ADR-005 | Retell AI | Active |
| ADR-006 | Feasibility Engine | **Review needed** |
| ADR-007 | Verdict Engine | **Review needed** |
| ADR-008 | Google Trends API | Active |
| ADR-009 | Firecrawl | Active |
| ADR-010 | Unit Mix Optimizer | Active (Pass 3) |
| ADR-011 | Build Cost Calculator | Active (Pass 3) |
| ADR-012 | IRR Calculator | Active (Pass 3) |
| ADR-013 | Master Failure Log | Active |
| ADR-014 | FEMA Flood API | Active |
| ADR-015 | USGS DEM API | Active |
| ADR-016 | Neon Database | Active |
| ADR-017 | Supabase Integration | Active |
| ADR-018 | Pass 2/Pass 3 Realignment | **Superseded** |
| ADR-019 | Pass 2 Really Is | **Active** |
| ADR-020 | Pass 2 Constraint Compiler Position | **Active** |
| ADR-021 | Jurisdiction Card Hydration Pipeline | **Active** |
| ADR-022 | County Capability Asset | **Active** |
| ADR-023 | CCA and Pass 2 Schema Separation | **Active** |

---

## Doctrine Hierarchy

When conflicts arise, resolve using this priority:

1. **SYSTEM_PROMPT_PASS2.md** — Highest authority for Pass 2
2. **CountyCapabilityAsset.md** — Highest authority for CCA
3. **ADRs** — Architectural decisions
4. **PRDs** — Product requirements
5. **Checklists** — Compliance gates

---

## Review Flags

Documents marked for review:

| Document | Issue | Action Needed |
|----------|-------|---------------|
| ADR-006 | References Pass 2 feasibility | Update to reference Pass 3 |
| ADR-007 | References Pass 2 verdict | Update outputs to ELIGIBLE/HOLD/NO_GO |
| ADR-018 | Interim realignment doc | Mark as fully superseded |

---

## Maintenance Rules

1. **No orphan documents** — Every PRD must have a checklist
2. **Deprecation over deletion** — Add deprecation notice, don't delete
3. **Single source of truth** — One canonical document per concept
4. **Cross-reference** — ADRs reference doctrine, PRDs reference ADRs
