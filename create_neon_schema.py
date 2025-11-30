#!/usr/bin/env python3
"""
Create the complete schema for the ZIP Code Screener system in Neon PostgreSQL
"""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sys

# Connection string
CONN_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def execute_sql(conn, sql, description):
    """Execute SQL and report results"""
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            print(f"[OK] {description}")
            return True
    except Exception as e:
        print(f"[ERROR] {description}: {str(e)}")
        return False

def main():
    print("=" * 80)
    print("ZIP CODE SCREENER SCHEMA CREATION")
    print("=" * 80)

    try:
        # Connect to database
        print("\n[1] Connecting to Neon PostgreSQL database...")
        conn = psycopg2.connect(CONN_STRING)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        print("[OK] Connected successfully")

        # Check existing tables
        print("\n[2] Checking existing tables...")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            existing_tables = [row[0] for row in cur.fetchall()]
            print(f"Found {len(existing_tables)} existing tables: {', '.join(existing_tables)}")

            if 'zips_master' in existing_tables:
                print("[OK] Confirmed zips_master table exists (will not recreate)")

        # Create tables
        print("\n[3] Creating tables...")

        tables_sql = {
            "runs": """
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
                )
            """,
            "zip_results": """
                CREATE TABLE IF NOT EXISTS zip_results (
                    id SERIAL PRIMARY KEY,
                    run_id UUID NOT NULL REFERENCES runs(run_id),
                    zip VARCHAR(5) NOT NULL,
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
                )
            """,
            "stage_log": """
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
                )
            """,
            "zoning_cache": """
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
                )
            """,
            "api_cache": """
                CREATE TABLE IF NOT EXISTS api_cache (
                    cache_key VARCHAR(255) PRIMARY KEY,
                    endpoint VARCHAR(100),
                    request_params JSONB,
                    response JSONB,
                    fetched_at TIMESTAMP DEFAULT NOW(),
                    expires_at TIMESTAMP
                )
            """,
            "pricing_data": """
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
                )
            """,
            "traffic_data": """
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
                )
            """
        }

        tables_created = []
        for table_name, sql in tables_sql.items():
            if execute_sql(conn, sql, f"Created table: {table_name}"):
                tables_created.append(table_name)

        # Create indexes
        print("\n[4] Creating indexes...")

        indexes_sql = {
            "idx_runs_status": "CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status)",
            "idx_runs_created": "CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC)",
            "idx_zip_results_run": "CREATE INDEX IF NOT EXISTS idx_zip_results_run ON zip_results(run_id)",
            "idx_zip_results_zip": "CREATE INDEX IF NOT EXISTS idx_zip_results_zip ON zip_results(zip)",
            "idx_zip_results_run_tier": "CREATE INDEX IF NOT EXISTS idx_zip_results_run_tier ON zip_results(run_id, tier) WHERE tier IS NOT NULL",
            "idx_zip_results_run_killed": "CREATE INDEX IF NOT EXISTS idx_zip_results_run_killed ON zip_results(run_id, killed)",
            "idx_zip_results_run_stage": "CREATE INDEX IF NOT EXISTS idx_zip_results_run_stage ON zip_results(run_id, stage_reached)",
            "idx_stage_log_run": "CREATE INDEX IF NOT EXISTS idx_stage_log_run ON stage_log(run_id)",
            "idx_zoning_state": "CREATE INDEX IF NOT EXISTS idx_zoning_state ON zoning_cache(state)",
            "idx_zoning_allowed": "CREATE INDEX IF NOT EXISTS idx_zoning_allowed ON zoning_cache(storage_allowed)",
            "idx_api_cache_endpoint": "CREATE INDEX IF NOT EXISTS idx_api_cache_endpoint ON api_cache(endpoint)",
            "idx_api_cache_expires": "CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at)",
            "idx_pricing_zip": "CREATE INDEX IF NOT EXISTS idx_pricing_zip ON pricing_data(zip)",
            "idx_traffic_zip": "CREATE INDEX IF NOT EXISTS idx_traffic_zip ON traffic_data(zip)"
        }

        indexes_created = []
        for index_name, sql in indexes_sql.items():
            if execute_sql(conn, sql, f"Created index: {index_name}"):
                indexes_created.append(index_name)

        # Create views
        print("\n[5] Creating views...")

        # Drop views first if they exist
        with conn.cursor() as cur:
            cur.execute("DROP VIEW IF EXISTS v_tier1 CASCADE")
            cur.execute("DROP VIEW IF EXISTS v_tier2 CASCADE")
            cur.execute("DROP VIEW IF EXISTS v_kill_summary CASCADE")
            cur.execute("DROP VIEW IF EXISTS v_run_progress CASCADE")

        views_sql = {
            "v_tier1": """
                CREATE VIEW v_tier1 AS
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
                ORDER BY r.created_at DESC, zr.rank ASC
            """,
            "v_tier2": """
                CREATE VIEW v_tier2 AS
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
                ORDER BY r.created_at DESC, zr.rank ASC
            """,
            "v_kill_summary": """
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
                ORDER BY run_id, kill_stage, kill_step
            """,
            "v_run_progress": """
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
                ORDER BY r.created_at DESC
            """
        }

        views_created = []
        for view_name, sql in views_sql.items():
            if execute_sql(conn, sql, f"Created view: {view_name}"):
                views_created.append(view_name)

        # Create functions and triggers
        print("\n[6] Creating functions and triggers...")

        # Drop existing triggers first
        with conn.cursor() as cur:
            cur.execute("DROP TRIGGER IF EXISTS trigger_zip_results_updated ON zip_results")
            cur.execute("DROP TRIGGER IF EXISTS trigger_zoning_cache_updated ON zoning_cache")

        functions_sql = {
            "update_updated_at": """
                CREATE OR REPLACE FUNCTION update_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
            """,
            "start_run": """
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
                $$ LANGUAGE plpgsql
            """,
            "complete_run": """
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
                $$ LANGUAGE plpgsql
            """,
            "log_stage": """
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
                $$ LANGUAGE plpgsql
            """,
            "kill_zip": """
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
                $$ LANGUAGE plpgsql
            """,
            "update_zip_metrics": """
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
                $$ LANGUAGE plpgsql
            """,
            "assign_tiers": """
                CREATE OR REPLACE FUNCTION assign_tiers(p_run_id UUID, p_tier1_count INT DEFAULT 20, p_tier2_count INT DEFAULT 30)
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
                $$ LANGUAGE plpgsql
            """
        }

        functions_created = []
        for func_name, sql in functions_sql.items():
            if execute_sql(conn, sql, f"Created function: {func_name}"):
                functions_created.append(func_name)

        # Create triggers
        print("\n[7] Creating triggers...")

        triggers_sql = {
            "trigger_zip_results_updated": """
                CREATE TRIGGER trigger_zip_results_updated
                    BEFORE UPDATE ON zip_results
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at()
            """,
            "trigger_zoning_cache_updated": """
                CREATE TRIGGER trigger_zoning_cache_updated
                    BEFORE UPDATE ON zoning_cache
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at()
            """
        }

        triggers_created = []
        for trigger_name, sql in triggers_sql.items():
            if execute_sql(conn, sql, f"Created trigger: {trigger_name}"):
                triggers_created.append(trigger_name)

        # Verify schema
        print("\n[8] Verifying created objects...")

        with conn.cursor() as cur:
            # Count tables
            cur.execute("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """)
            table_count = cur.fetchone()[0]

            # Count views
            cur.execute("""
                SELECT COUNT(*)
                FROM information_schema.views
                WHERE table_schema = 'public'
            """)
            view_count = cur.fetchone()[0]

            # Count functions
            cur.execute("""
                SELECT COUNT(*)
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public' AND p.prokind = 'f'
            """)
            function_count = cur.fetchone()[0]

            # Count indexes
            cur.execute("""
                SELECT COUNT(*)
                FROM pg_indexes
                WHERE schemaname = 'public'
            """)
            index_count = cur.fetchone()[0]

            # List all tables
            cur.execute("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)
            all_tables = [row[0] for row in cur.fetchall()]

            # List all views
            cur.execute("""
                SELECT table_name
                FROM information_schema.views
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            all_views = [row[0] for row in cur.fetchall()]

            # List all functions
            cur.execute("""
                SELECT p.proname
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public' AND p.prokind = 'f'
                ORDER BY p.proname
            """)
            all_functions = [row[0] for row in cur.fetchall()]

        # Print summary
        print("\n" + "=" * 80)
        print("SCHEMA CREATION SUMMARY")
        print("=" * 80)

        print(f"\nTables Created: {len(tables_created)}")
        for table in tables_created:
            print(f"  - {table}")

        print(f"\nIndexes Created: {len(indexes_created)}")
        for index in indexes_created:
            print(f"  - {index}")

        print(f"\nViews Created: {len(views_created)}")
        for view in views_created:
            print(f"  - {view}")

        print(f"\nFunctions Created: {len(functions_created)}")
        for func in functions_created:
            print(f"  - {func}")

        print(f"\nTriggers Created: {len(triggers_created)}")
        for trigger in triggers_created:
            print(f"  - {trigger}")

        print(f"\n{'=' * 80}")
        print("FINAL DATABASE INVENTORY")
        print("=" * 80)
        print(f"\nTotal Tables: {table_count}")
        for table in all_tables:
            print(f"  - {table}")

        print(f"\nTotal Views: {view_count}")
        for view in all_views:
            print(f"  - {view}")

        print(f"\nTotal Functions: {function_count}")
        for func in all_functions:
            print(f"  - {func}")

        print(f"\nTotal Indexes: {index_count}")

        print(f"\n{'=' * 80}")
        print("SCHEMA CREATION COMPLETED SUCCESSFULLY")
        print("=" * 80)

        conn.close()
        return 0

    except Exception as e:
        print(f"\n!!! ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
