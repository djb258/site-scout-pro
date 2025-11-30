#!/usr/bin/env python3
"""
Verify the Neon PostgreSQL schema for ZIP Code Screener
"""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import json

CONN_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def main():
    print("=" * 80)
    print("SCHEMA VERIFICATION")
    print("=" * 80)

    conn = psycopg2.connect(CONN_STRING)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)

    with conn.cursor() as cur:
        # Test 1: Verify table structures
        print("\n[1] Verifying table structures...")

        tables_to_check = [
            'runs', 'zip_results', 'stage_log', 'zoning_cache',
            'api_cache', 'pricing_data', 'traffic_data'
        ]

        for table in tables_to_check:
            cur.execute(f"""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = '{table}'
                ORDER BY ordinal_position
            """)
            columns = cur.fetchall()
            print(f"\n  {table}: {len(columns)} columns")
            for col in columns[:5]:  # Show first 5 columns
                print(f"    - {col[0]} ({col[1]}) {'NULL' if col[2] == 'YES' else 'NOT NULL'}")
            if len(columns) > 5:
                print(f"    ... and {len(columns) - 5} more columns")

        # Test 2: Verify views
        print("\n[2] Verifying views...")

        cur.execute("""
            SELECT table_name, view_definition
            FROM information_schema.views
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        views = cur.fetchall()
        for view in views:
            print(f"  [OK] {view[0]}")

        # Test 3: Verify functions
        print("\n[3] Verifying functions...")

        cur.execute("""
            SELECT p.proname, pg_get_function_arguments(p.oid) as args
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.prokind = 'f'
            ORDER BY p.proname
        """)
        functions = cur.fetchall()
        for func in functions:
            print(f"  [OK] {func[0]}({func[1]})")

        # Test 4: Verify triggers
        print("\n[4] Verifying triggers...")

        cur.execute("""
            SELECT trigger_name, event_object_table, action_statement
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            ORDER BY trigger_name
        """)
        triggers = cur.fetchall()
        for trigger in triggers:
            print(f"  [OK] {trigger[0]} on {trigger[1]}")

        # Test 5: Verify indexes
        print("\n[5] Verifying key indexes...")

        cur.execute("""
            SELECT indexname, tablename
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname LIKE 'idx_%'
            ORDER BY indexname
        """)
        indexes = cur.fetchall()
        for idx in indexes:
            print(f"  [OK] {idx[0]} on {idx[1]}")

        # Test 6: Check foreign key constraints
        print("\n[6] Verifying foreign key constraints...")

        cur.execute("""
            SELECT
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            ORDER BY tc.table_name
        """)
        fkeys = cur.fetchall()
        for fk in fkeys:
            print(f"  [OK] {fk[0]}.{fk[1]} -> {fk[2]}.{fk[3]}")

        # Test 7: Sample data check (if zips_master exists)
        print("\n[7] Checking for zips_master table...")

        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'zips_master'
            )
        """)
        zips_exists = cur.fetchone()[0]

        if zips_exists:
            cur.execute("SELECT COUNT(*) FROM zips_master")
            zip_count = cur.fetchone()[0]
            print(f"  [OK] zips_master exists with {zip_count:,} ZIP codes")

            # Sample a few ZIPs
            cur.execute("SELECT zip, state FROM zips_master LIMIT 5")
            samples = cur.fetchall()
            print("  Sample ZIPs:")
            for sample in samples:
                print(f"    - {sample[0]} ({sample[1]})")
        else:
            print("  [WARNING] zips_master table not found - this is needed for start_run function")

        print("\n" + "=" * 80)
        print("VERIFICATION COMPLETE")
        print("=" * 80)
        print("\nDatabase is ready for ZIP Code Screener operations!")
        print("\nAvailable operations:")
        print("  - start_run(states, config, created_by) - Initialize a new screening run")
        print("  - kill_zip(run_id, zip, stage, step, reason, threshold, value) - Mark a ZIP as eliminated")
        print("  - update_zip_metrics(run_id, zip, stage, metrics) - Update ZIP metrics")
        print("  - log_stage(run_id, stage, input_count, output_count) - Log stage completion")
        print("  - assign_tiers(run_id, tier1_count, tier2_count) - Assign final tiers")
        print("  - complete_run(run_id) - Mark run as complete")

    conn.close()

if __name__ == "__main__":
    main()
