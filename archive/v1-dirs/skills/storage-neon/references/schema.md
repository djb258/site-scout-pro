# Storage Neon — Schema Reference

> Source: `docs/neon-schema-spec.md`, `docs/ERD.md`, `docs/erd/`

## Neon Core Tables

### runs

Tracks each screening run.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| run_id | UUID | PK, DEFAULT gen_random_uuid() | Unique run identifier |
| created_at | TIMESTAMP | DEFAULT NOW() | Run start time |
| created_by | VARCHAR(100) | | User/system that triggered |
| target_states | VARCHAR[] | NOT NULL | Array of state codes e.g. ['WV', 'PA'] |
| config | JSONB | | Snapshot of screening constants at run time |
| status | VARCHAR(20) | DEFAULT 'pending' | pending, running, complete, failed |
| current_stage | INT | DEFAULT 0 | 0-8, tracks progress |
| total_zips | INT | | Count of ZIPs at start |
| surviving_zips | INT | | Count after all stages |
| completed_at | TIMESTAMP | | When run finished |
| error_message | TEXT | | If status = failed |

### zip_results

Per-ZIP results for each run. One row per ZIP per run.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | Auto-increment |
| run_id | UUID | FK runs(run_id), NOT NULL | Which run |
| zip | VARCHAR(5) | FK zips_master(zip), NOT NULL | Which ZIP |
| stage_reached | INT | DEFAULT 0 | Last stage passed (0-8) |
| killed | BOOLEAN | DEFAULT FALSE | Was this ZIP eliminated |
| kill_stage | INT | | Stage where killed (NULL if survived) |
| kill_step | VARCHAR(20) | | Step ID e.g. 'SS-S1-03' |
| kill_reason | TEXT | | Human-readable reason |
| kill_threshold | DECIMAL | | Threshold that was failed |
| kill_value | DECIMAL | | Actual value that triggered kill |
| metrics | JSONB | DEFAULT '{}' | All collected metrics |
| scores | JSONB | DEFAULT '{}' | Stage 8 scoring components |
| final_score | DECIMAL | | Composite score (NULL if killed) |
| tier | INT | | 1, 2, or NULL |
| rank | INT | | Rank within tier (NULL if killed) |

**Unique constraint:** `(run_id, zip)`

### stage_log

Detailed log of each stage execution per run.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| run_id | UUID | FK runs(run_id) | |
| stage | INT | NOT NULL | 0-8 |
| started_at | TIMESTAMP | DEFAULT NOW() | |
| completed_at | TIMESTAMP | | |
| zips_input | INT | | Count entering stage |
| zips_output | INT | | Count surviving stage |
| zips_killed | INT | | Count killed this stage |
| status | VARCHAR(20) | | running, complete, failed |
| error_message | TEXT | | If failed |

### zoning_cache

County-level zoning research. Persists across runs.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| county_fips | VARCHAR(5) | PK | |
| state | VARCHAR(2) | NOT NULL | |
| county_name | VARCHAR(100) | | |
| storage_allowed | VARCHAR(20) | | yes, conditional, no, unknown |
| moratorium | BOOLEAN | DEFAULT FALSE | Active moratorium |
| conditional_notes | TEXT | | |
| source_url | VARCHAR(500) | | |
| notes | TEXT | | |
| researched_by | VARCHAR(100) | | |
| researched_at | DATE | | |

### api_cache

Cache external API responses to avoid redundant calls.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| cache_key | VARCHAR(255) | PK | e.g. 'census:B19013:26101' |
| endpoint | VARCHAR(100) | | census, google_places, fema |
| request_params | JSONB | | Parameters used |
| response | JSONB | | Cached response |
| fetched_at | TIMESTAMP | DEFAULT NOW() | |
| expires_at | TIMESTAMP | | When to invalidate |

### pricing_data

Manual pricing research entries.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| zip | VARCHAR(5) | FK zips_master(zip) | |
| facility_name | VARCHAR(200) | | |
| facility_address | VARCHAR(300) | | |
| unit_size | VARCHAR(20) | | e.g. '10x10' |
| monthly_rent | DECIMAL(10,2) | | |
| source | VARCHAR(100) | | sparefoot, website, phone |
| researched_by | VARCHAR(100) | | |
| researched_at | DATE | | |

### traffic_data

Manual traffic/access research entries.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| zip | VARCHAR(5) | FK zips_master(zip) | |
| road_name | VARCHAR(200) | | |
| aadt | INT | | Annual avg daily traffic |
| aadt_year | INT | | Year of count |
| visibility_ok | BOOLEAN | | Frontage visible from road |
| turn_count | INT | | Turns from highway |
| source | VARCHAR(100) | | dot, manual |
| notes | TEXT | | |
| researched_by | VARCHAR(100) | | |
| researched_at | DATE | | |

### zips_master / us_zip_codes

Master ZIP reference table (pre-existing).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| zip | VARCHAR(5) | PK | |
| state | VARCHAR(2) | | |
| county_fips | VARCHAR(5) | | |
| county_name | VARCHAR | | |
| centroid_lat | DECIMAL | | |
| centroid_lon | DECIMAL | | |

---

## Supabase Sub-Hub Tables (Production)

### Shared / Reference

| Table | PK | Write Authority |
|-------|-----|-----------------|
| `sovereign_ids` | `sva_id` (UUID) | System (SVA creation) |
| `sovereign_id_zips` | `id` (UUID) | System (SVA creation) |
| `sovereign_id_counties` | `id` (UUID) | System (SVA creation) |
| `ref_zip_replica` | `zip` (string) | System (sync from Neon) |
| `master_failure_log` | `id` (UUID) | All sub-hubs (log only) |
| `engine_logs` | `id` (UUID) | System |
| `ai_cost_tracker` | `id` (UUID) | System |
| `zip_runs` | `id` (UUID) | System (orchestrator) |

### Sub-Hub 0 — Signals (Anchor: ZIP)

| Table | PK | Notes |
|-------|-----|-------|
| `pass0_signals` | `signal_id` (UUID) | Append-only signal observations |
| `pass0_narrative_pins` | `id` (UUID) | Geographic pins from narrative sources |
| `pass0_run_log` | `id` (UUID) | Orchestrator run tracking |
| `pass0_url_queue` | `id` (UUID) | URL queue for signal processing |
| `hub0_event_log` | `id` (UUID) | Event log |

### Sub-Hub 1 — Market (Anchor: ZIP)

Key tables: `pass1_*`, `facility_*`, `competitor_facilities`

### Sub-Hub 2 — CountyCard (Anchor: County FIPS)

Key tables: `county_card_*`, `jurisdiction_*`

### Sub-Hub 3 — Calculators (Anchor: SVA)

Key tables: `calculators_state`, `pass2_*`

### Sub-Hub 4 — Parcel (Anchor: Parcel ID)

Key tables: `site_*_staging`

### Sub-Hub 5 — DealGate (Anchor: SVA)

Decision logs (future implementation)

---

## Indexes

```sql
-- runs
idx_runs_status ON runs(status)
idx_runs_created ON runs(created_at DESC)

-- zip_results
idx_zip_results_run ON zip_results(run_id)
idx_zip_results_zip ON zip_results(zip)
idx_zip_results_run_tier ON zip_results(run_id, tier) WHERE tier IS NOT NULL
idx_zip_results_run_killed ON zip_results(run_id, killed)
idx_zip_results_run_stage ON zip_results(run_id, stage_reached)

-- stage_log
idx_stage_log_run ON stage_log(run_id)

-- zoning_cache
idx_zoning_state ON zoning_cache(state)
idx_zoning_allowed ON zoning_cache(storage_allowed)

-- api_cache
idx_api_cache_endpoint ON api_cache(endpoint)
idx_api_cache_expires ON api_cache(expires_at)

-- pricing_data
idx_pricing_zip ON pricing_data(zip)

-- traffic_data
idx_traffic_zip ON traffic_data(zip)
```

---

## Views

| View | Purpose |
|------|---------|
| `v_tier1` | Tier 1 results joined with ZIP master + run date |
| `v_tier2` | Tier 2 results joined with ZIP master + run date |
| `v_kill_summary` | Kill counts grouped by run, stage, step |
| `v_run_progress` | Run status with runtime, tier counts |
| `v_zoning_gaps` | Counties without zoning research |

---

## Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `start_run` | `(states VARCHAR[], config JSONB, created_by VARCHAR)` → UUID | Initialize run + populate zip_results |
| `complete_run` | `(run_id UUID)` → VOID | Finalize run, count survivors |
| `log_stage` | `(run_id UUID, stage INT, zips_in INT, zips_out INT)` → VOID | Record stage completion |
| `kill_zip` | `(run_id UUID, zip VARCHAR, stage INT, step VARCHAR, reason TEXT, threshold DECIMAL, value DECIMAL)` → VOID | Eliminate ZIP with full audit trail |
| `update_zip_metrics` | `(run_id UUID, zip VARCHAR, stage INT, new_metrics JSONB)` → VOID | Append metrics to ZIP result |
| `assign_tiers` | `(run_id UUID, tier1_count INT DEFAULT 20, tier2_count INT DEFAULT 30)` → VOID | Rank survivors into tiers |
| `update_updated_at` | trigger function | Auto-update `updated_at` on zip_results, zoning_cache |
