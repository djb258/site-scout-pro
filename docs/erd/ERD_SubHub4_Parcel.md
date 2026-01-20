# ERD: Sub-Hub 4 — Parcel Discovery

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)  
> **CC Layer:** CC-03 (Context Artifacts)

## Ownership Declaration

- **Hub:** Sub-Hub 4
- **Anchor:** Parcel ID (site_intake_id)
- **Authority:** WRITE for owned tables, READ-ONLY for referenced tables
- **Purpose:** Site intake, screening, and scoring of specific parcels

---

## Tables Owned (WRITE)

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `site_intake_staging` | `id` (UUID) | Raw parcel intake data |
| `site_demand_staging` | `id` (UUID) | Demand metrics for parcel |
| `site_results_staging` | `id` (UUID) | Scored parcel results |

---

## Tables Referenced (READ-ONLY)

| Table | Owner | Purpose |
|-------|-------|---------|
| `sovereign_id_zips` | Shared/Ref | SVA → ZIP scope validation |
| `county_card_master` | Sub-Hub 2 | Zoning constraints for parcel |
| `pass1_results` | Sub-Hub 1 | Market context |
| `pass2_results` | Sub-Hub 3 | Feasibility context |
| `competitor_facilities` | Sub-Hub 1 | Nearby competition |

---

## Key Relationships

```
site_demand_staging.site_intake_id → site_intake_staging.id
site_results_staging.site_intake_id → site_intake_staging.id
rent_band_staging.site_intake_id → site_intake_staging.id
```

---

## Mermaid ERD

See: [ERD_SubHub4_Parcel.mermaid](./ERD_SubHub4_Parcel.mermaid)

---

## Cross-Hub Rules

- All prior sub-hub outputs are READ-ONLY context
- Sub-Hub 5 (Deal Gate) may READ site_results_staging for promotion decisions
- No other sub-hub may WRITE to these tables

---

## Staging Pattern

All tables follow `*_staging` naming convention:
- Data enters via intake
- Processing enriches with demand/scoring
- Promotion to vault requires explicit gate passage
