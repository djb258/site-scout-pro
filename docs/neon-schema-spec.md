# Neon Database Schema Specification

> **Linear Issue:** BAR-21 - M1: Database & Foundation
> **Project:** Storage Building Project
> **Created:** 2025-11-29

---

## Cursor Prompt

Paste the following prompt into Cursor to generate the complete schema:

---

You are building a PostgreSQL database schema in Neon for a ZIP code screening system. This system filters all US ZIPs down to 15-20 viable locations for self-storage facility development.

## PROJECT CONTEXT

- Database: Neon (PostgreSQL)
- Purpose: Store screening runs, ZIP metrics, kill logs, scores, and cached research
- User already has a table with all US ZIPs (we'll reference it, not recreate it)

## REQUIREMENTS

1. All tables need proper primary keys (UUIDs preferred for main entities, SERIAL for logs)
2. Foreign key relationships between tables
3. Indexes on frequently queried columns
4. JSONB columns for flexible/evolving data (metrics, scores, config)
5. Timestamps for audit trail
6. Views for common queries

## EXISTING TABLE

User has an existing ZIP master table. Create a reference assumption:

```sql
-- ASSUMPTION: Existing table structure (do not recreate)
-- Table name: zips_master
-- Columns: zip (VARCHAR 5, PK), state (VARCHAR 2), county_fips (VARCHAR 5),
--          county_name (VARCHAR), centroid_lat (DECIMAL), centroid_lon (DECIMAL)
```

## TABLES TO CREATE

### 1. runs
Tracks each screening run.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| run_id | UUID | PK, DEFAULT gen_random_uuid() | Unique run identifier |
| created_at | TIMESTAMP | DEFAULT NOW() | Run start time |
| created_by | VARCHAR(100) | | User/system that triggered |
| target_states | VARCHAR[] | NOT NULL | Array of state codes ['WV', 'PA'] |
| config | JSONB | | Snapshot of SS-CFG constants at run time |
| status | VARCHAR(20) | DEFAULT 'pending' | pending, running, complete, failed |
| current_stage | INT | DEFAULT 0 | 0-8, tracks progress |
| total_zips | INT | | Count of ZIPs at start |
| surviving_zips | INT | | Count after all stages |
| completed_at | TIMESTAMP | | When run finished |
| error_message | TEXT | | If status = failed |

### 2. zip_results
Per-ZIP results for each run. One row per ZIP per run.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | Auto-increment |
| run_id | UUID | FK → runs(run_id), NOT NULL | Which run |
| zip | VARCHAR(5) | FK → zips_master(zip), NOT NULL | Which ZIP |
| stage_reached | INT | DEFAULT 0 | Last stage passed (0-8) |
| killed | BOOLEAN | DEFAULT FALSE | Did this ZIP get eliminated |
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
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

Add unique constraint: (run_id, zip)

### 3. stage_log
Detailed log of each stage execution per run.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| run_id | UUID | FK → runs(run_id) | |
| stage | INT | NOT NULL | 0-8 |
| started_at | TIMESTAMP | DEFAULT NOW() | |
| completed_at | TIMESTAMP | | |
| zips_input | INT | | Count entering stage |
| zips_output | INT | | Count surviving stage |
| zips_killed | INT | | Count killed this stage |
| status | VARCHAR(20) | | running, complete, failed |
| error_message | TEXT | | If failed |

### 4. zoning_cache
County-level zoning research. Persists across runs.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| county_fips | VARCHAR(5) | PK | |
| state | VARCHAR(2) | NOT NULL | |
| county_name | VARCHAR(100) | | |
| storage_allowed | VARCHAR(20) | | 'yes', 'conditional', 'no', 'unknown' |
| moratorium | BOOLEAN | DEFAULT FALSE | Active moratorium? |
| conditional_notes | TEXT | | Details on conditional use |
| source_url | VARCHAR(500) | | Where researched |
| notes | TEXT | | Additional notes |
| researched_by | VARCHAR(100) | | Who did research |
| researched_at | DATE | | When researched |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

### 5. api_cache
Cache external API responses to avoid redundant calls.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| cache_key | VARCHAR(255) | PK | Unique key e.g. 'census:B19013:26101' |
| endpoint | VARCHAR(100) | | API source: 'census', 'google_places', 'fema' |
| request_params | JSONB | | Parameters used |
| response | JSONB | | Cached response |
| fetched_at | TIMESTAMP | DEFAULT NOW() | When cached |
| expires_at | TIMESTAMP | | When to invalidate |

### 6. pricing_data
Manual pricing research entries.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| zip | VARCHAR(5) | FK → zips_master(zip) | |
| facility_name | VARCHAR(200) | | |
| facility_address | VARCHAR(300) | | |
| unit_size | VARCHAR(20) | | e.g. '10x10' |
| monthly_rent | DECIMAL(10,2) | | |
| source | VARCHAR(100) | | 'sparefoot', 'website', 'phone' |
| researched_by | VARCHAR(100) | | |
| researched_at | DATE | | |
| created_at | TIMESTAMP | DEFAULT NOW() | |

### 7. traffic_data
Manual traffic/access research entries.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| zip | VARCHAR(5) | FK → zips_master(zip) | |
| road_name | VARCHAR(200) | | |
| aadt | INT | | Annual avg daily traffic |
| aadt_year | INT | | Year of count |
| visibility_ok | BOOLEAN | | Frontage visible from road |
| turn_count | INT | | Turns from highway |
| source | VARCHAR(100) | | 'dot', 'manual' |
| notes | TEXT | | |
| researched_by | VARCHAR(100) | | |
| researched_at | DATE | | |
| created_at | TIMESTAMP | DEFAULT NOW() | |

## INDEXES TO CREATE

```sql
-- runs
CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_created ON runs(created_at DESC);

-- zip_results
CREATE INDEX idx_zip_results_run ON zip_results(run_id);
CREATE INDEX idx_zip_results_zip ON zip_results(zip);
CREATE INDEX idx_zip_results_run_tier ON zip_results(run_id, tier) WHERE tier IS NOT NULL;
CREATE INDEX idx_zip_results_run_killed ON zip_results(run_id, killed);
CREATE INDEX idx_zip_results_run_stage ON zip_results(run_id, stage_reached);

-- stage_log
CREATE INDEX idx_stage_log_run ON stage_log(run_id);

-- zoning_cache
CREATE INDEX idx_zoning_state ON zoning_cache(state);
CREATE INDEX idx_zoning_allowed ON zoning_cache(storage_allowed);

-- api_cache
CREATE INDEX idx_api_cache_endpoint ON api_cache(endpoint);
CREATE INDEX idx_api_cache_expires ON api_cache(expires_at);

-- pricing_data
CREATE INDEX idx_pricing_zip ON pricing_data(zip);

-- traffic_data
CREATE INDEX idx_traffic_zip ON traffic_data(zip);
```

## VIEWS TO CREATE

### v_tier1
Quick access to Tier 1 results for most recent run.

```sql
CREATE VIEW v_tier1 AS
SELECT
    zr.run_id,
    zr.zip,
    zm.state,
    zm.county_name,
    zr.final_score,
    zr.rank,
    zr.metrics,
    zr.scores,
    r.created_at as run_date
FROM zip_results zr
JOIN zips_master zm ON zr.zip = zm.zip
JOIN runs r ON zr.run_id = r.run_id
WHERE zr.tier = 1
ORDER BY r.created_at DESC, zr.rank ASC;
```

### v_tier2
Quick access to Tier 2 results.

```sql
CREATE VIEW v_tier2 AS
SELECT
    zr.run_id,
    zr.zip,
    zm.state,
    zm.county_name,
    zr.final_score,
    zr.rank,
    zr.metrics,
    zr.scores,
    r.created_at as run_date
FROM zip_results zr
JOIN zips_master zm ON zr.zip = zm.zip
JOIN runs r ON zr.run_id = r.run_id
WHERE zr.tier = 2
ORDER BY r.created_at DESC, zr.rank ASC;
```

### v_kill_summary
Kill counts by stage for a run.

```sql
CREATE VIEW v_kill_summary AS
SELECT
    run_id,
    kill_stage,
    kill_step,
    COUNT(*) as kill_count,
    ROUND(AVG(kill_value)::numeric, 2) as avg_kill_value
FROM zip_results
WHERE killed = TRUE
GROUP BY run_id, kill_stage, kill_step
ORDER BY run_id, kill_stage, kill_step;
```

### v_run_progress
Run status with counts.

```sql
CREATE VIEW v_run_progress AS
SELECT
    r.run_id,
    r.target_states,
    r.status,
    r.current_stage,
    r.total_zips,
    r.surviving_zips,
    r.created_at,
    r.completed_at,
    EXTRACT(EPOCH FROM (COALESCE(r.completed_at, NOW()) - r.created_at)) / 60 as runtime_minutes,
    (SELECT COUNT(*) FROM zip_results zr WHERE zr.run_id = r.run_id AND zr.tier = 1) as tier1_count,
    (SELECT COUNT(*) FROM zip_results zr WHERE zr.run_id = r.run_id AND zr.tier = 2) as tier2_count
FROM runs r
ORDER BY r.created_at DESC;
```

### v_zoning_gaps
Counties without zoning research.

```sql
CREATE VIEW v_zoning_gaps AS
SELECT DISTINCT
    zm.state,
    zm.county_fips,
    zm.county_name,
    COUNT(zm.zip) as zip_count
FROM zips_master zm
LEFT JOIN zoning_cache zc ON zm.county_fips = zc.county_fips
WHERE zc.county_fips IS NULL
GROUP BY zm.state, zm.county_fips, zm.county_name
ORDER BY zm.state, zip_count DESC;
```

## FUNCTIONS TO CREATE

### Update timestamp trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_zip_results_updated
    BEFORE UPDATE ON zip_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_zoning_cache_updated
    BEFORE UPDATE ON zoning_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### Start a new run

```sql
CREATE OR REPLACE FUNCTION start_run(
    p_target_states VARCHAR[],
    p_config JSONB,
    p_created_by VARCHAR DEFAULT 'system'
)
RETURNS UUID AS $$
DECLARE
    v_run_id UUID;
    v_total_zips INT;
BEGIN
    -- Count ZIPs in target states
    SELECT COUNT(*) INTO v_total_zips
    FROM zips_master
    WHERE state = ANY(p_target_states);

    -- Insert run record
    INSERT INTO runs (target_states, config, created_by, total_zips, status)
    VALUES (p_target_states, p_config, p_created_by, v_total_zips, 'running')
    RETURNING run_id INTO v_run_id;

    -- Initialize zip_results for all ZIPs in target states
    INSERT INTO zip_results (run_id, zip)
    SELECT v_run_id, zip
    FROM zips_master
    WHERE state = ANY(p_target_states);

    RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;
```

### Complete a run

```sql
CREATE OR REPLACE FUNCTION complete_run(p_run_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE runs
    SET
        status = 'complete',
        completed_at = NOW(),
        surviving_zips = (
            SELECT COUNT(*)
            FROM zip_results
            WHERE run_id = p_run_id AND killed = FALSE
        )
    WHERE run_id = p_run_id;
END;
$$ LANGUAGE plpgsql;
```

### Log stage completion

```sql
CREATE OR REPLACE FUNCTION log_stage(
    p_run_id UUID,
    p_stage INT,
    p_zips_input INT,
    p_zips_output INT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO stage_log (run_id, stage, zips_input, zips_output, zips_killed, completed_at, status)
    VALUES (p_run_id, p_stage, p_zips_input, p_zips_output, p_zips_input - p_zips_output, NOW(), 'complete');

    UPDATE runs
    SET current_stage = p_stage
    WHERE run_id = p_run_id;
END;
$$ LANGUAGE plpgsql;
```

### Kill a ZIP

```sql
CREATE OR REPLACE FUNCTION kill_zip(
    p_run_id UUID,
    p_zip VARCHAR(5),
    p_stage INT,
    p_step VARCHAR(20),
    p_reason TEXT,
    p_threshold DECIMAL,
    p_value DECIMAL
)
RETURNS VOID AS $$
BEGIN
    UPDATE zip_results
    SET
        killed = TRUE,
        kill_stage = p_stage,
        kill_step = p_step,
        kill_reason = p_reason,
        kill_threshold = p_threshold,
        kill_value = p_value,
        stage_reached = p_stage - 1
    WHERE run_id = p_run_id AND zip = p_zip;
END;
$$ LANGUAGE plpgsql;
```

### Update ZIP metrics

```sql
CREATE OR REPLACE FUNCTION update_zip_metrics(
    p_run_id UUID,
    p_zip VARCHAR(5),
    p_stage INT,
    p_new_metrics JSONB
)
RETURNS VOID AS $$
BEGIN
    UPDATE zip_results
    SET
        metrics = metrics || p_new_metrics,
        stage_reached = p_stage
    WHERE run_id = p_run_id AND zip = p_zip AND killed = FALSE;
END;
$$ LANGUAGE plpgsql;
```

### Assign tiers and ranks

```sql
CREATE OR REPLACE FUNCTION assign_tiers(p_run_id UUID, p_tier1_count INT DEFAULT 20, p_tier2_count INT DEFAULT 30)
RETURNS VOID AS $$
BEGIN
    -- Clear existing tiers for this run
    UPDATE zip_results
    SET tier = NULL, rank = NULL
    WHERE run_id = p_run_id;

    -- Assign Tier 1
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY final_score DESC) as rn
        FROM zip_results
        WHERE run_id = p_run_id AND killed = FALSE AND final_score IS NOT NULL
    )
    UPDATE zip_results zr
    SET tier = 1, rank = ranked.rn
    FROM ranked
    WHERE zr.id = ranked.id AND ranked.rn <= p_tier1_count;

    -- Assign Tier 2
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY final_score DESC) as rn
        FROM zip_results
        WHERE run_id = p_run_id AND killed = FALSE AND final_score IS NOT NULL AND tier IS NULL
    )
    UPDATE zip_results zr
    SET tier = 2, rank = ranked.rn
    FROM ranked
    WHERE zr.id = ranked.id AND ranked.rn <= p_tier2_count;
END;
$$ LANGUAGE plpgsql;
```

## OUTPUT

Generate the complete SQL script with:
1. All CREATE TABLE statements with constraints
2. All CREATE INDEX statements
3. All CREATE VIEW statements
4. All CREATE FUNCTION statements
5. Comments explaining each section

Order matters for foreign keys — create tables in dependency order.

Test the script can run cleanly on a fresh Neon database (assuming zips_master already exists).

---

## Schema Summary

| Category | Count | Items |
|----------|-------|-------|
| **Tables** | 7 | runs, zip_results, stage_log, zoning_cache, api_cache, pricing_data, traffic_data |
| **Indexes** | 14 | Performance indexes on all key query patterns |
| **Views** | 5 | v_tier1, v_tier2, v_kill_summary, v_run_progress, v_zoning_gaps |
| **Functions** | 8 | start_run, complete_run, log_stage, kill_zip, update_zip_metrics, assign_tiers, + triggers |

## Linear Task Mapping

| Linear Task | Schema Coverage |
|-------------|-----------------|
| ZIP-001: Create Neon project | Pre-req (manual) |
| ZIP-002: Create runs table | ✅ `runs` table |
| ZIP-003: Create zip_results table | ✅ `zip_results` table |
| ZIP-004: Create zoning_cache table | ✅ `zoning_cache` table |
| ZIP-005: Create api_cache table | ✅ `api_cache` table |
| ZIP-006: Create database indexes | ✅ 14 indexes defined |
| ZIP-010: Create runs insert function | ✅ `start_run()` function |
