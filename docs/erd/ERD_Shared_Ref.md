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
| `facility_research_log` | `id` (UUID) | Research provenance + sitemap cache | All sub-hubs (append only) |

---

## Access Pattern

**All sub-hubs have READ-ONLY access to these tables.**

Write operations are performed only by:
- System orchestrators (SVA creation, ZIP sync)
- Error logging functions (master_failure_log)
- Cost tracking functions (ai_cost_tracker)
- Research logging functions (facility_research_log)

---

## Key Relationships

```
sovereign_id_zips.sva_id → sovereign_ids.sva_id
sovereign_id_counties.sva_id → sovereign_ids.sva_id
ref_zip_replica.zip ← (synced from us_zip_codes in Neon)
facility_research_log.facility_id → facility_master.facility_id (Sub-Hub 1)
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
- `facility_research_log` is the exception: all sub-hubs may append research evidence

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
| `facility_research_log` | Competition rates, facility sqft (research provenance) | [x] |

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
| `facility_research_log` | (Research provenance — consumed by Pass 1, 1.5, 2) | [x] |

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
| `facility_research_log` | System (cross-hub, all passes append) | [x] |

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
| `facility_research_log` | id (UUID), facility_id FK, captured_at, created_at | [x] |

---

## Table Detail: facility_research_log

> **Purpose:** Append-only research provenance and sitemap cache. Tracks WHERE every data point (price_per_sqft, total_sqft, etc.) was found, so research is never repeated. Identity is keyed to the physical ADDRESS (facility_id), not the company/brand.

### Schema

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `facility_id` | TEXT | NO | FK → facility_master.facility_id (address hash) |
| `data_point` | TEXT | NO | What was found (price_per_sqft, total_sqft, sitemap, etc.) |
| `value_raw` | TEXT | NO | Exact text as captured ("$89/mo", "45,000 sqft") |
| `value_parsed` | NUMERIC | YES | Normalized numeric value (null for sitemap rows) |
| `unit_size` | TEXT | YES | Unit type if rate evidence ("10x10", "10x20") |
| `source_url` | TEXT | YES | Full URL of the page where data was found |
| `source_domain` | TEXT | YES | Domain (e.g., "selfstorageplus.com") |
| `method` | TEXT | NO | How found (firecrawl_scrape, ai_call, manual_web, etc.) |
| `confidence` | NUMERIC | NO | 0.0 – 1.0 |
| `captured_at` | TIMESTAMPTZ | NO | When the data was captured |
| `metadata` | JSONB | YES | Flexible payload (sitemap pages, extraction notes, etc.) |
| `created_at` | TIMESTAMPTZ | NO | Row creation timestamp (DB default) |

### Access Rules

- **APPEND:** All sub-hubs (Pass 1, Pass 1.5, Pass 2)
- **READ:** All sub-hubs
- **UPDATE:** Never (append-only)
- **DELETE:** Never

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| PK | `id` | Primary key |
| IX_facility | `facility_id, data_point, captured_at DESC` | Latest evidence per facility per data point |
| IX_domain_sitemap | `source_domain, data_point` WHERE `data_point = 'sitemap'` | Sitemap cache lookup by domain |

### Query Patterns

**Get latest price_per_sqft for a facility:**
```sql
SELECT DISTINCT ON (data_point) *
FROM facility_research_log
WHERE facility_id = $1 AND data_point = 'price_per_sqft'
ORDER BY data_point, captured_at DESC;
```

**Get cached sitemap for a domain:**
```sql
SELECT metadata
FROM facility_research_log
WHERE data_point = 'sitemap' AND source_domain = $1
ORDER BY captured_at DESC
LIMIT 1;
```

**Check which facilities need research (no evidence yet):**
```sql
SELECT fm.facility_id, fm.facility_name
FROM facility_master fm
LEFT JOIN facility_research_log frl
  ON fm.facility_id = frl.facility_id
  AND frl.data_point = 'price_per_sqft'
WHERE frl.id IS NULL;
```

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
| Last Modified | 2026-02-14 |
| Doctrine Version | 2.0.0 |
| Status | ACTIVE |
| Governing PRD | docs/prd/PRD_BARTON_STORAGE_HUB.md |
| Authority | barton-storage (CC-02) |
