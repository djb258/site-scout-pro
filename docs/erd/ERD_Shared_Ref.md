# ERD: Shared / Reference Tables

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)
> **CC Layer:** CC-03 (Context Artifacts)

## Ownership Declaration

- **Hub:** Shared (no single owner)
- **Anchor:** Multiple (ZIP, SVA, County FIPS)
- **Anchor Invariant:** Reference tables serve as lookup anchors — no single row ownership.
- **Authority:** READ-ONLY for all sub-hubs, WRITE via system processes only
- **Purpose:** Reference data, identity containers, cross-hub logging

---

## Tables (System-Managed)

| Table | Primary Key | Description | Write Authority |
|-------|-------------|-------------|-----------------|
| `sovereign_ids` | `sva_id` (UUID) | SVA identity container | System (SVA creation) |
| `sovereign_id_zips` | `id` (UUID) | SVA → ZIP mapping | System (SVA creation) |
| `sovereign_id_counties` | `id` (UUID) | SVA → County mapping | System (SVA creation) |
| `ref_zip_replica` | `zip` (string) | ZIP centroid coordinates | System (sync from Neon) |
| `us_zip_codes` | `zip` (string) | Master ZIP list (Neon) | System (Neon authority) |
| `master_failure_log` | `id` (UUID) | Cross-hub error tracking | All sub-hubs (log only) |
| `engine_logs` | `id` (UUID) | System engine logging | System |
| `generic_ingest_log` | `id` (UUID) | Generic ingest tracking | System |
| `ai_cost_tracker` | `id` (UUID) | AI usage cost tracking | System |
| `zip_runs` | `id` (UUID) | ZIP-level run tracking | System (orchestrator) |

---

## Access Pattern

**All sub-hubs have READ-ONLY access to these tables.**

Write operations are performed only by:
- System orchestrators (SVA creation, ZIP sync)
- Error logging functions (master_failure_log)
- Cost tracking functions (ai_cost_tracker)

---

## Key Relationships

```
sovereign_id_zips.sva_id → sovereign_ids.sva_id
sovereign_id_counties.sva_id → sovereign_ids.sva_id
ref_zip_replica.zip ← (synced from us_zip_codes in Neon)
```

---

## Mermaid ERD

See: [ERD_Shared_Ref.mermaid](./ERD_Shared_Ref.mermaid)

---

## Cross-Hub Rules

- **No sub-hub owns these tables**
- All sub-hubs may READ for identity resolution
- Only system processes may WRITE
- `master_failure_log` is the exception: all sub-hubs may append errors

---

## Sync Pattern

Reference data follows the replica pattern:
1. **Authority:** Neon (us_zip_codes)
2. **Replica:** Supabase (ref_zip_replica)
3. **Sync:** System process with version tracking
4. **Access:** Read-only for all application code

---

## Pressure Test

### Q1: Does every table trace to a PRD constant?

| Table | PRD Constant | Traced? |
|-------|-------------|---------|
| `sovereign_ids` | (System identity — SVA container) | [x] |
| `sovereign_id_zips` | Demographics (ZIP-level geographic scope for SVA) | [x] |
| `sovereign_id_counties` | Zoning data (county-level geographic scope for SVA) | [x] |
| `ref_zip_replica` | Demographics (ZIP centroid coordinates — Census sync) | [x] |
| `us_zip_codes` | Demographics (master ZIP list — Neon authority) | [x] |
| `master_failure_log` | (System error tracking — cross-hub) | [x] |
| `engine_logs` | (System engine logging) | [x] |
| `generic_ingest_log` | (System ingest tracking) | [x] |
| `ai_cost_tracker` | (System AI usage cost tracking) | [x] |
| `zip_runs` | (System ZIP-level run tracking) | [x] |

### Q2: Does every table produce a PRD variable?

| Table | PRD Variable | Produces? |
|-------|-------------|-----------|
| `sovereign_ids` | (Identity container — consumed by all passes) | [x] |
| `sovereign_id_zips` | (Scope mapping — consumed by Pass 0, 1, 4) | [x] |
| `sovereign_id_counties` | (Scope mapping — consumed by Pass 2) | [x] |
| `ref_zip_replica` | (Reference data — consumed by Pass 0, 1) | [x] |
| `us_zip_codes` | (Reference data — authority for ZIP lookup) | [x] |
| `master_failure_log` | (Error tracking — supports observability) | [x] |
| `engine_logs` | (Engine tracking — supports observability) | [x] |
| `generic_ingest_log` | (Ingest tracking — supports observability) | [x] |
| `ai_cost_tracker` | (Cost tracking — supports governance) | [x] |
| `zip_runs` | (Run tracking — supports lineage across passes) | [x] |

### Q3: Does every table have pass ownership?

| Table | Owning Pass | Declared? |
|-------|------------|-----------|
| `sovereign_ids` | System (cross-pass, SVA creation) | [x] |
| `sovereign_id_zips` | System (cross-pass, SVA creation) | [x] |
| `sovereign_id_counties` | System (cross-pass, SVA creation) | [x] |
| `ref_zip_replica` | System (sync from Neon) | [x] |
| `us_zip_codes` | System (Neon authority) | [x] |
| `master_failure_log` | System (cross-hub, all passes append) | [x] |
| `engine_logs` | System (cross-hub) | [x] |
| `generic_ingest_log` | System (cross-hub) | [x] |
| `ai_cost_tracker` | System (cross-hub) | [x] |
| `zip_runs` | System (orchestrator) | [x] |

### Q4: Does every table have a lineage mechanism?

| Table | Lineage Field | Present? |
|-------|--------------|----------|
| `sovereign_ids` | sva_id (UUID, PK) | [x] |
| `sovereign_id_zips` | id (UUID), sva_id FK | [x] |
| `sovereign_id_counties` | id (UUID), sva_id FK | [x] |
| `ref_zip_replica` | zip (string, PK), synced from us_zip_codes | [x] |
| `us_zip_codes` | zip (string, PK) | [x] |
| `master_failure_log` | id (UUID), created_at, process_id | [x] |
| `engine_logs` | id (UUID), created_at | [x] |
| `generic_ingest_log` | id (UUID), created_at | [x] |
| `ai_cost_tracker` | id (UUID), created_at | [x] |
| `zip_runs` | id (UUID), created_at | [x] |

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
| Governing PRD | docs/prd/PRD_BARTON_STORAGE_HUB.md |
| Authority | barton-storage (CC-02) |
