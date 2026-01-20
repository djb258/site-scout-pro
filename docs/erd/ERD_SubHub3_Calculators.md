# ERD: Sub-Hub 3 — Calculators / Underwriting

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)  
> **CC Layer:** CC-03 (Context Artifacts)

## Ownership Declaration

- **Hub:** Sub-Hub 3
- **Anchor:** SVA (Sovereign ID)
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
