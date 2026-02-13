# ERD: Sub-Hub 1 — Market Reality

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)
> **CC Layer:** CC-03 (Context Artifacts)

## Ownership Declaration

- **Hub:** Sub-Hub 1
- **Anchor:** ZIP Code
- **Anchor Invariant:** All rows must trace to exactly one ZIP code.
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
| `pass1_runs` | `id` (UUID) | **DEPRECATED** — Legacy run metadata (read-only, pending removal) |
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

---

## Deprecated Tables

| Table | Status | Reason | Replacement |
|-------|--------|--------|-------------|
| `pass1_runs` | DEPRECATED (read-only) | Legacy run tracking | `hub1_pass1_run_log` |

These tables remain for historical compatibility but should not be written to. Future migrations will remove them.

---

## Pressure Test

### Q1: Does every table trace to a PRD constant?

| Table | PRD Constant | Traced? |
|-------|-------------|---------|
| `pass1_census_snapshot` | Demographics (Census API — population, income, housing) | [x] |
| `pass1_demand_agg` | Demographics (population-based demand calculation) | [x] |
| `pass1_radius_zip` | Demographics (geographic radius from ZIP coordinates) | [x] |
| `pass1_results` | Demographics + Competitor rents (composite analysis) | [x] |
| `pass1_runs` | (System orchestration metadata — DEPRECATED) | [x] |
| `pass1_skip_log` | (System tracking — skipped ZIP logging) | [x] |
| `pass1_supply_agg` | Competitor rents (aggregated supply by distance band) | [x] |
| `pass1_supply_snapshot` | Competitor rents (facility supply per run) | [x] |
| `hub1_pass1_run_log` | (System orchestration metadata) | [x] |
| `hub1_pass1_error_log` | (System error tracking) | [x] |
| `facility_master` | Competitor rents (canonical facility identity) | [x] |
| `facility_raw` | Competitor rents (raw facility discovery data) | [x] |
| `facility_totals` | Competitor rents (facility aggregate metrics) | [x] |
| `facility_unit_pricing` | Competitor rents (unit-level pricing data) | [x] |
| `competitor_facilities` | Competitor rents (competitor facility details) | [x] |
| `pass_1_5_gap_queue` | Competitor rents (gap queue for rent reconciliation) | [x] |
| `pass_1_5_attempt_log` | Competitor rents (attempt tracking for gap resolution) | [x] |

### Q2: Does every table produce a PRD variable?

| Table | PRD Variable | Produces? |
|-------|-------------|-----------|
| `pass1_census_snapshot` | Market metrics (demographic snapshot per ZIP) | [x] |
| `pass1_demand_agg` | Market metrics (aggregated demand indicators) | [x] |
| `pass1_radius_zip` | Market metrics (radius market geography) | [x] |
| `pass1_results` | Market metrics (saturation, supply gap, demand) | [x] |
| `pass1_runs` | (Run tracking — supports lineage, DEPRECATED) | [x] |
| `pass1_skip_log` | (Skip tracking — supports audit) | [x] |
| `pass1_supply_agg` | Market metrics (supply aggregation) | [x] |
| `pass1_supply_snapshot` | Market metrics (supply snapshot) | [x] |
| `hub1_pass1_run_log` | (Run tracking — supports lineage) | [x] |
| `hub1_pass1_error_log` | (Error tracking — supports observability) | [x] |
| `facility_master` | Market metrics (canonical facility identity) | [x] |
| `facility_raw` | Market metrics (raw facility data) | [x] |
| `facility_totals` | Market metrics (facility-level totals) | [x] |
| `facility_unit_pricing` | Reconciled rents (unit pricing for rent recon) | [x] |
| `competitor_facilities` | Market metrics (competitor details) | [x] |
| `pass_1_5_gap_queue` | Reconciled rents (gap queue for Pass 1.5) | [x] |
| `pass_1_5_attempt_log` | Reconciled rents (attempt tracking) | [x] |

### Q3: Does every table have pass ownership?

| Table | Owning Pass | Declared? |
|-------|------------|-----------|
| `pass1_census_snapshot` | Pass 1 (COMPUTE) | [x] |
| `pass1_demand_agg` | Pass 1 (COMPUTE) | [x] |
| `pass1_radius_zip` | Pass 1 (COMPUTE) | [x] |
| `pass1_results` | Pass 1 (COMPUTE) | [x] |
| `pass1_runs` | Pass 1 (COMPUTE, DEPRECATED) | [x] |
| `pass1_skip_log` | Pass 1 (COMPUTE) | [x] |
| `pass1_supply_agg` | Pass 1 (COMPUTE) | [x] |
| `pass1_supply_snapshot` | Pass 1 (COMPUTE) | [x] |
| `hub1_pass1_run_log` | Pass 1 (COMPUTE) | [x] |
| `hub1_pass1_error_log` | Pass 1 (COMPUTE) | [x] |
| `facility_master` | Pass 1 (COMPUTE) | [x] |
| `facility_raw` | Pass 1 (CAPTURE) | [x] |
| `facility_totals` | Pass 1 (COMPUTE) | [x] |
| `facility_unit_pricing` | Pass 1 (COMPUTE) | [x] |
| `competitor_facilities` | Pass 1 (COMPUTE) | [x] |
| `pass_1_5_gap_queue` | Pass 1.5 (COMPUTE) | [x] |
| `pass_1_5_attempt_log` | Pass 1.5 (COMPUTE) | [x] |

### Q4: Does every table have a lineage mechanism?

| Table | Lineage Field | Present? |
|-------|--------------|----------|
| `pass1_census_snapshot` | id (UUID), zip_code FK | [x] |
| `pass1_demand_agg` | id (UUID) | [x] |
| `pass1_radius_zip` | id (UUID), origin_zip FK | [x] |
| `pass1_results` | id (UUID), zip_run_id FK | [x] |
| `pass1_runs` | id (UUID), created_at | [x] |
| `pass1_skip_log` | id (UUID) | [x] |
| `pass1_supply_agg` | id (UUID) | [x] |
| `pass1_supply_snapshot` | id (UUID) | [x] |
| `hub1_pass1_run_log` | id (UUID), created_at | [x] |
| `hub1_pass1_error_log` | id (UUID), created_at | [x] |
| `facility_master` | facility_id (string) | [x] |
| `facility_raw` | raw_id (UUID) | [x] |
| `facility_totals` | facility_id FK to facility_master | [x] |
| `facility_unit_pricing` | unit_price_id (UUID), facility_id FK | [x] |
| `competitor_facilities` | id (UUID) | [x] |
| `pass_1_5_gap_queue` | id (UUID) | [x] |
| `pass_1_5_attempt_log` | id (UUID), gap_queue_id FK | [x] |

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
| Governing PRD | docs/prd/PRD_PASS1_STRUCTURE_HUB.md |
| Authority | barton-storage (CC-02) |
