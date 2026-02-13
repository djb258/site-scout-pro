# ERD: Sub-Hub 3 — Calculators / Underwriting

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)
> **CC Layer:** CC-03 (Context Artifacts)

## Ownership Declaration

- **Hub:** Sub-Hub 3
- **Anchor:** SVA (Sovereign ID)
- **Anchor Invariant:** All rows must trace to exactly one SVA (Sovereign ID).
- **Authority:** WRITE for owned tables, READ-ONLY for referenced tables
- **Purpose:** Financial modeling, feasibility calculations, verdict generation

---

## Tables Owned (WRITE)

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `calculators_state` | `id` (UUID) | User-configurable calculator inputs |
| `pass2_results` | `id` (UUID) | Complete Pass 2 analysis results |
| `pass2_runs` | `id` (UUID) | Pass 2 run metadata |
| `rent_band_staging` | `id` (UUID) | Rent band calculation staging |

---

## Tables Referenced (READ-ONLY)

| Table | Owner | Purpose |
|-------|-------|---------|
| `sovereign_ids` | Shared/Ref | SVA identity for scoping |
| `pass1_results` | Sub-Hub 1 | Market data inputs |
| `pass1_runs` | Sub-Hub 1 | Run linkage |
| `county_card_master` | Sub-Hub 2 | Zoning constraints |
| `competitor_facilities` | Sub-Hub 1 | Rent benchmarks |

---

## Key Relationships

```
pass2_runs.pass1_id → pass1_runs.id (READ-ONLY)
pass2_results.zip_run_id → zip_runs.id
rent_band_staging.site_intake_id → site_intake_staging.id (READ-ONLY)
```

---

## Mermaid ERD

See: [ERD_SubHub3_Calculators.mermaid](./ERD_SubHub3_Calculators.mermaid)

---

## Cross-Hub Rules

- Sub-Hub 1 outputs are READ-ONLY inputs (pass1_results, competitor_facilities)
- Sub-Hub 2 outputs are READ-ONLY inputs (county_card_master)
- Sub-Hub 4 may READ pass2_results for parcel evaluation
- Sub-Hub 5 may READ pass2_results for final verdict

---

## Calculator Scope

Calculators include:
- Feasibility (build cost, IRR)
- Reverse feasibility (max land price)
- Rent benchmarking
- Fusion model scoring
- Verdict generation

---

## Pressure Test

### Q1: Does every table trace to a PRD constant?

| Table | PRD Constant | Traced? |
|-------|-------------|---------|
| `calculators_state` | Demographics + Competitor rents + Zoning data (user-configurable inputs) | [x] |
| `pass2_results` | Demographics + Competitor rents + Zoning data (composite analysis) | [x] |
| `pass2_runs` | (System orchestration metadata) | [x] |
| `rent_band_staging` | Competitor rents (rent band calculation inputs) | [x] |

### Q2: Does every table produce a PRD variable?

| Table | PRD Variable | Produces? |
|-------|-------------|-----------|
| `calculators_state` | Feasibility verdicts (calculator configuration state) | [x] |
| `pass2_results` | Feasibility verdicts (financial viability assessments) | [x] |
| `pass2_runs` | (Run tracking — supports lineage) | [x] |
| `rent_band_staging` | Reconciled rents (rent band staging for feasibility) | [x] |

### Q3: Does every table have pass ownership?

| Table | Owning Pass | Declared? |
|-------|------------|-----------|
| `calculators_state` | Pass 3 (COMPUTE) | [x] |
| `pass2_results` | Pass 3 (COMPUTE) | [x] |
| `pass2_runs` | Pass 3 (COMPUTE) | [x] |
| `rent_band_staging` | Pass 3 (COMPUTE) | [x] |

### Q4: Does every table have a lineage mechanism?

| Table | Lineage Field | Present? |
|-------|--------------|----------|
| `calculators_state` | id (UUID) | [x] |
| `pass2_results` | id (UUID), zip_run_id FK | [x] |
| `pass2_runs` | id (UUID), pass1_id FK, created_at | [x] |
| `rent_band_staging` | id (UUID), site_intake_id FK | [x] |

## OSAM Alignment

| Check | Status |
|-------|--------|
| All tables declared in OSAM | [ ] |
| No undeclared joins exist | [ ] |
| Join key is sovereign_id | [ ] |

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-01-25 |
| Last Modified | 2026-02-13 |
| Doctrine Version | 2.0.0 |
| Status | ACTIVE |
| Governing PRD | docs/prd/PRD_PASS3_DESIGN_HUB.md |
| Authority | barton-storage (CC-02) |
