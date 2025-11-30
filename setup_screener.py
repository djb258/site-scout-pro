#!/usr/bin/env python3
"""
ZIP Screener Database Setup Script
Connects to Neon PostgreSQL and sets up all tables, functions, and views.
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import psycopg2
from psycopg2.extras import RealDictCursor
import json

# Connection string
CONN_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def get_connection():
    return psycopg2.connect(CONN_STRING)

def run_query(cursor, query, description=""):
    """Run a query and return results"""
    try:
        cursor.execute(query)
        if cursor.description:
            return cursor.fetchall()
        return None
    except Exception as e:
        print(f"ERROR in {description}: {e}")
        raise

def main():
    print("=" * 60)
    print("ZIP SCREENER DATABASE SETUP")
    print("=" * 60)

    # STEP 1: Verify Connection
    print("\n## STEP 1: VERIFY CONNECTION")
    print("-" * 40)

    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        result = run_query(cursor, "SELECT 1 AS connection_test;", "connection test")
        print("✓ Connection successful!")
    except Exception as e:
        print(f"✗ Connection FAILED: {e}")
        return

    # STEP 2: Check Existing Tables
    print("\n## STEP 2: CHECK EXISTING TABLES")
    print("-" * 40)

    tables = run_query(cursor, """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """, "list tables")

    existing_tables = [t['table_name'] for t in tables]
    print(f"Found {len(existing_tables)} tables:")
    for t in existing_tables:
        print(f"  - {t}")

    # STEP 3: Check zips_master
    print("\n## STEP 3: CHECK ZIPS_MASTER")
    print("-" * 40)

    if 'zips_master' not in existing_tables:
        print("✗ zips_master table NOT FOUND!")
        print("  User needs to load ZIP data first.")
        conn.close()
        return

    zip_counts = run_query(cursor, """
        SELECT state, COUNT(*) as zip_count
        FROM zips_master
        GROUP BY state
        ORDER BY state;
    """, "zip counts")

    total_zips = sum(z['zip_count'] for z in zip_counts)
    print(f"✓ zips_master exists with {total_zips:,} total ZIPs")
    print("\nZIPs by state:")
    for z in zip_counts:
        print(f"  {z['state']}: {z['zip_count']:,}")

    # STEP 4: Create Missing Tables
    print("\n## STEP 4: CREATE MISSING TABLES")
    print("-" * 40)

    tables_to_create = {
        'runs': """
            CREATE TABLE IF NOT EXISTS runs (
                run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                created_at TIMESTAMP DEFAULT NOW(),
                created_by VARCHAR(100),
                target_states VARCHAR[] NOT NULL,
                config JSONB,
                status VARCHAR(20) DEFAULT 'pending',
                current_stage INT DEFAULT 0,
                total_zips INT,
                surviving_zips INT,
                completed_at TIMESTAMP,
                error_message TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
            CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);
        """,
        'zip_results': """
            CREATE TABLE IF NOT EXISTS zip_results (
                id SERIAL PRIMARY KEY,
                run_id UUID REFERENCES runs(run_id),
                zip VARCHAR(5),
                stage_reached INT DEFAULT 0,
                killed BOOLEAN DEFAULT FALSE,
                kill_stage INT,
                kill_step VARCHAR(20),
                kill_reason TEXT,
                kill_threshold DECIMAL,
                kill_value DECIMAL,
                metrics JSONB DEFAULT '{}',
                scores JSONB DEFAULT '{}',
                final_score DECIMAL,
                tier INT,
                rank INT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(run_id, zip)
            );
            CREATE INDEX IF NOT EXISTS idx_zip_results_run ON zip_results(run_id);
            CREATE INDEX IF NOT EXISTS idx_zip_results_zip ON zip_results(zip);
            CREATE INDEX IF NOT EXISTS idx_zip_results_run_tier ON zip_results(run_id, tier) WHERE tier IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_zip_results_run_killed ON zip_results(run_id, killed);
        """,
        'stage_log': """
            CREATE TABLE IF NOT EXISTS stage_log (
                id SERIAL PRIMARY KEY,
                run_id UUID REFERENCES runs(run_id),
                stage INT NOT NULL,
                started_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP,
                zips_input INT,
                zips_output INT,
                zips_killed INT,
                status VARCHAR(20),
                error_message TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_stage_log_run ON stage_log(run_id);
        """,
        'zoning_cache': """
            CREATE TABLE IF NOT EXISTS zoning_cache (
                county_fips VARCHAR(5) PRIMARY KEY,
                state VARCHAR(2) NOT NULL,
                county_name VARCHAR(100),
                storage_allowed VARCHAR(20),
                moratorium BOOLEAN DEFAULT FALSE,
                conditional_notes TEXT,
                source_url VARCHAR(500),
                notes TEXT,
                researched_by VARCHAR(100),
                researched_at DATE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_zoning_state ON zoning_cache(state);
        """,
        'api_cache': """
            CREATE TABLE IF NOT EXISTS api_cache (
                cache_key VARCHAR(255) PRIMARY KEY,
                endpoint VARCHAR(100),
                request_params JSONB,
                response JSONB,
                fetched_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_api_cache_endpoint ON api_cache(endpoint);
            CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);
        """,
        'pricing_data': """
            CREATE TABLE IF NOT EXISTS pricing_data (
                id SERIAL PRIMARY KEY,
                zip VARCHAR(5),
                facility_name VARCHAR(200),
                facility_address VARCHAR(300),
                unit_size VARCHAR(20),
                monthly_rent DECIMAL(10,2),
                source VARCHAR(100),
                researched_by VARCHAR(100),
                researched_at DATE,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_pricing_zip ON pricing_data(zip);
        """,
        'traffic_data': """
            CREATE TABLE IF NOT EXISTS traffic_data (
                id SERIAL PRIMARY KEY,
                zip VARCHAR(5),
                road_name VARCHAR(200),
                aadt INT,
                aadt_year INT,
                visibility_ok BOOLEAN,
                turn_count INT,
                source VARCHAR(100),
                notes TEXT,
                researched_by VARCHAR(100),
                researched_at DATE,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_traffic_zip ON traffic_data(zip);
        """
    }

    created_tables = []
    for table_name, create_sql in tables_to_create.items():
        if table_name not in existing_tables:
            run_query(cursor, create_sql, f"create {table_name}")
            conn.commit()
            created_tables.append(table_name)
            print(f"  ✓ Created: {table_name}")
        else:
            print(f"  - Exists: {table_name}")

    # STEP 5: Create Functions
    print("\n## STEP 5: CREATE FUNCTIONS")
    print("-" * 40)

    functions = {
        'update_updated_at': """
            CREATE OR REPLACE FUNCTION update_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trigger_zip_results_updated ON zip_results;
            CREATE TRIGGER trigger_zip_results_updated
                BEFORE UPDATE ON zip_results
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at();

            DROP TRIGGER IF EXISTS trigger_zoning_cache_updated ON zoning_cache;
            CREATE TRIGGER trigger_zoning_cache_updated
                BEFORE UPDATE ON zoning_cache
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at();
        """,
        'start_run': """
            CREATE OR REPLACE FUNCTION start_run(
                p_target_states VARCHAR[],
                p_config JSONB DEFAULT '{}',
                p_created_by VARCHAR DEFAULT 'system'
            )
            RETURNS UUID AS $$
            DECLARE
                v_run_id UUID;
                v_total_zips INT;
            BEGIN
                SELECT COUNT(*) INTO v_total_zips
                FROM zips_master
                WHERE state = ANY(p_target_states);

                INSERT INTO runs (target_states, config, created_by, total_zips, status)
                VALUES (p_target_states, p_config, p_created_by, v_total_zips, 'running')
                RETURNING run_id INTO v_run_id;

                INSERT INTO zip_results (run_id, zip)
                SELECT v_run_id, zip
                FROM zips_master
                WHERE state = ANY(p_target_states);

                RETURN v_run_id;
            END;
            $$ LANGUAGE plpgsql;
        """,
        'complete_run': """
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
        """,
        'log_stage': """
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
        """,
        'kill_zip': """
            CREATE OR REPLACE FUNCTION kill_zip(
                p_run_id UUID,
                p_zip VARCHAR(5),
                p_stage INT,
                p_step VARCHAR(20),
                p_reason TEXT,
                p_threshold DECIMAL DEFAULT NULL,
                p_value DECIMAL DEFAULT NULL
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
        """,
        'update_zip_metrics': """
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
        """,
        'assign_tiers': """
            CREATE OR REPLACE FUNCTION assign_tiers(
                p_run_id UUID,
                p_tier1_count INT DEFAULT 20,
                p_tier2_count INT DEFAULT 30
            )
            RETURNS VOID AS $$
            BEGIN
                UPDATE zip_results
                SET tier = NULL, rank = NULL
                WHERE run_id = p_run_id;

                WITH ranked AS (
                    SELECT id, ROW_NUMBER() OVER (ORDER BY final_score DESC) as rn
                    FROM zip_results
                    WHERE run_id = p_run_id AND killed = FALSE AND final_score IS NOT NULL
                )
                UPDATE zip_results zr
                SET tier = 1, rank = ranked.rn
                FROM ranked
                WHERE zr.id = ranked.id AND ranked.rn <= p_tier1_count;

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
        """
    }

    for func_name, func_sql in functions.items():
        run_query(cursor, func_sql, f"create function {func_name}")
        conn.commit()
        print(f"  ✓ Created: {func_name}()")

    # STEP 6: Create Views
    print("\n## STEP 6: CREATE VIEWS")
    print("-" * 40)

    views = {
        'v_tier1': """
            CREATE OR REPLACE VIEW v_tier1 AS
            SELECT
                zr.run_id,
                zr.zip,
                zr.final_score,
                zr.rank,
                zr.metrics,
                zr.scores,
                r.created_at as run_date
            FROM zip_results zr
            JOIN runs r ON zr.run_id = r.run_id
            WHERE zr.tier = 1
            ORDER BY r.created_at DESC, zr.rank ASC;
        """,
        'v_tier2': """
            CREATE OR REPLACE VIEW v_tier2 AS
            SELECT
                zr.run_id,
                zr.zip,
                zr.final_score,
                zr.rank,
                zr.metrics,
                zr.scores,
                r.created_at as run_date
            FROM zip_results zr
            JOIN runs r ON zr.run_id = r.run_id
            WHERE zr.tier = 2
            ORDER BY r.created_at DESC, zr.rank ASC;
        """,
        'v_kill_summary': """
            CREATE OR REPLACE VIEW v_kill_summary AS
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
        """,
        'v_run_progress': """
            CREATE OR REPLACE VIEW v_run_progress AS
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
        """,
        'v_zoning_gaps': """
            CREATE OR REPLACE VIEW v_zoning_gaps AS
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
        """
    }

    for view_name, view_sql in views.items():
        run_query(cursor, view_sql, f"create view {view_name}")
        conn.commit()
        print(f"  ✓ Created: {view_name}")

    # STEP 7: Initialize Test Run for WV
    print("\n## STEP 7: INITIALIZE TEST RUN FOR WV")
    print("-" * 40)

    config = {
        "LOT_SIZE_ACRES": 1,
        "UNITS_PER_ACRE": 120,
        "TARGET_RENT": 80,
        "TARGET_OCCUPANCY": 0.85,
        "OPEX_RATIO": 0.25,
        "MIN_YIELD": 0.12,
        "DEMAND_SQFT_PER_PERSON": 6
    }

    result = run_query(cursor, f"""
        SELECT start_run(
            ARRAY['WV']::varchar[],
            '{json.dumps(config)}'::jsonb,
            'claude_code_setup'
        ) as run_id;
    """, "start run")
    conn.commit()

    run_id = result[0]['run_id']
    print(f"  ✓ Created run: {run_id}")

    # STEP 8: Verify Run Initialized
    print("\n## STEP 8: VERIFY RUN INITIALIZED")
    print("-" * 40)

    verification = run_query(cursor, f"""
        SELECT
            r.run_id,
            r.target_states,
            r.total_zips,
            r.status,
            (SELECT COUNT(*) FROM zip_results zr WHERE zr.run_id = r.run_id) as zip_results_count
        FROM runs r
        WHERE r.run_id = '{run_id}';
    """, "verify run")

    v = verification[0]
    print(f"  run_id: {v['run_id']}")
    print(f"  target_states: {v['target_states']}")
    print(f"  total_zips: {v['total_zips']}")
    print(f"  zip_results_count: {v['zip_results_count']}")
    print(f"  status: {v['status']}")

    if v['total_zips'] == v['zip_results_count']:
        print("  ✓ zip_results_count matches total_zips")
    else:
        print("  ✗ MISMATCH: zip_results_count != total_zips")

    # STEP 9: Report Setup Complete
    print("\n")
    print("=" * 60)
    print("DATABASE SETUP COMPLETE")
    print("=" * 60)

    print("""
Connection: ✓ Connected to Neon

Tables:
  - runs
  - zip_results
  - stage_log
  - zoning_cache
  - api_cache
  - pricing_data
  - traffic_data

Functions:
  - start_run()
  - complete_run()
  - log_stage()
  - kill_zip()
  - update_zip_metrics()
  - assign_tiers()

Views:
  - v_tier1
  - v_tier2
  - v_kill_summary
  - v_run_progress
  - v_zoning_gaps
""")

    print(f"""Test Run Initialized:
  - run_id: {run_id}
  - Target: West Virginia
  - Total ZIPs: {v['total_zips']}
  - Status: {v['status']}
""")

    print("=" * 60)
    print("READY FOR STAGE EXECUTION")
    print("=" * 60)
    print("""
To continue, tell me:
  - "Run Stage 0" - Execute geography filter
  - "Run Stage 0-1" - Execute geography + demographics
  - "Run all stages" - Execute full pipeline
""")
    print(f"Current run_id: {run_id}")
    print("=" * 60)

    conn.close()

    # Save run_id to file for subsequent scripts
    with open('current_run.txt', 'w') as f:
        f.write(str(run_id))

if __name__ == "__main__":
    main()
