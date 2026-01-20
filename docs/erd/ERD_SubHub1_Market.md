# ERD: Sub-Hub 1 — Market Reality

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)  
> **CC Layer:** CC-03 (Context Artifacts)

## Ownership Declaration

- **Hub:** Sub-Hub 1
- **Anchor:** ZIP Code
- **Authority:** WRITE for owned tables, READ-ONLY for referenced tables
- **Purpose:** Establish market reality — demand, supply, competition within radius

---

## Tables Owned (WRITE)

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `pass1_census_snapshot` | `id` (UUID) | Census data snapshot per ZIP per run |
| `pass1_demand_agg` | `id` (UUID) | Aggregated demand by distance band |
| `pass1_radius_zip` | `id` (UUID) | ZIPs within radius of origin |
| `pass1_results` | `id` (UUID) | Complete Pass 1 analysis results |
| `pass1_runs` | `id` (UUID) | Pass 1 run metadata (legacy) |
| `pass1_skip_log` | `id` (UUID) | Skipped ZIP logging |
| `pass1_supply_agg` | `id` (UUID) | Aggregated supply by distance band |
| `pass1_supply_snapshot` | `id` (UUID) | Facility supply snapshot per run |
| `hub1_pass1_run_log` | `id` (UUID) | Hub 1 run tracking |
| `hub1_pass1_error_log` | `id` (UUID) | Hub 1 error tracking |
| `facility_master` | `facility_id` (string) | Canonical facility identity |
| `facility_raw` | `raw_id` (UUID) | Raw facility discovery data |
| `facility_totals` | `facility_id` (string) | Facility aggregate metrics |
| `facility_unit_pricing` | `unit_price_id` (UUID) | Unit-level pricing data |
| `competitor_facilities` | `id` (UUID) | Competitor facility details |
| `pass_1_5_gap_queue` | `id` (UUID) | Gap queue for Pass 1.5 remediation |
| `pass_1_5_attempt_log` | `id` (UUID) | Attempt tracking for gap resolution |

---

## Tables Referenced (READ-ONLY)

| Table | Owner | Purpose |
|-------|-------|---------|
| `ref_zip_replica` | Shared/Ref | ZIP centroid coordinates |
| `sovereign_id_zips` | Shared/Ref | SVA → ZIP scope mapping |
| `pass0_signals` | Sub-Hub 0 | Signal data for context |

---

## Key Relationships

```
pass1_radius_zip.origin_zip → ref_zip_replica.zip (READ-ONLY)
pass1_census_snapshot.zip_code → ref_zip_replica.zip (READ-ONLY)
pass1_results.zip_run_id → zip_runs.id
facility_totals.facility_id → facility_master.facility_id
facility_unit_pricing.facility_id → facility_master.facility_id
pass_1_5_attempt_log.gap_queue_id → pass_1_5_gap_queue.id
```

---

## Mermaid ERD

See: [ERD_SubHub1_Market.mermaid](./ERD_SubHub1_Market.mermaid)

---

## Cross-Hub Rules

- Sub-Hub 0 signals are READ-ONLY input
- Sub-Hub 2 may READ competitor_facilities for county context
- Sub-Hub 3 may READ pass1_results for calculator inputs
- No other sub-hub may WRITE to these tables
