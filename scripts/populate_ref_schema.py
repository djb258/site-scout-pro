#!/usr/bin/env python3
"""
Populate the ref schema tables in Neon PostgreSQL.
Uses Doppler for secrets management.
"""
import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def main():
    # Get connection string from environment (Doppler injects this)
    conn_string = os.environ.get('NEON_DATABASE_URL') or os.environ.get('DATABASE_URL')

    if not conn_string:
        # Fallback to direct connection string if Doppler not configured
        conn_string = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

    print("=" * 60)
    print("POPULATING REF SCHEMA TABLES")
    print("=" * 60)

    # Read SQL file
    sql_path = os.path.join(os.path.dirname(__file__), 'populate_ref_schema.sql')
    with open(sql_path, 'r') as f:
        sql = f.read()

    try:
        print("\n[1] Connecting to Neon...")
        conn = psycopg2.connect(conn_string)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        print("[OK] Connected")

        print("\n[2] Executing population script...")
        with conn.cursor() as cur:
            cur.execute(sql)
        print("[OK] Script executed")

        print("\n[3] Verifying ref table counts...")
        with conn.cursor() as cur:
            # Check ref table counts
            cur.execute("""
                SELECT 'ref_country' AS table_name, COUNT(*) AS row_count FROM ref.ref_country
                UNION ALL
                SELECT 'ref_state', COUNT(*) FROM ref.ref_state
                UNION ALL
                SELECT 'ref_county', COUNT(*) FROM ref.ref_county
                UNION ALL
                SELECT 'ref_asset_class', COUNT(*) FROM ref.ref_asset_class
                UNION ALL
                SELECT 'ref_unit_type', COUNT(*) FROM ref.ref_unit_type
                UNION ALL
                SELECT 'ref_unit_size', COUNT(*) FROM ref.ref_unit_size
                UNION ALL
                SELECT 'ref_zip_county_map', COUNT(*) FROM ref.ref_zip_county_map
            """)
            results = cur.fetchall()

        print("\n" + "=" * 60)
        print("REF SCHEMA POPULATION RESULTS")
        print("=" * 60)
        print(f"\n{'Table':<25} {'Rows':>10}")
        print("-" * 35)
        for table_name, row_count in results:
            print(f"{table_name:<25} {row_count:>10,}")

        # Verify pass1_census_snapshot table exists
        print("\n[4] Verifying pass1_census_snapshot table...")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'pass1_census_snapshot'
                ORDER BY ordinal_position
            """)
            columns = cur.fetchall()

        if columns:
            print(f"[OK] pass1_census_snapshot table created with {len(columns)} columns")
        else:
            print("[WARN] pass1_census_snapshot table not found")

        # Check for orphan ZIPs
        print("\n[5] Checking for orphan ZIPs...")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) AS orphan_count
                FROM ref.ref_zip_county_map m
                LEFT JOIN public.zips_master z ON m.zip_code = z.zip
                WHERE z.zip IS NULL
            """)
            orphan_count = cur.fetchone()[0]

        if orphan_count == 0:
            print("[OK] No orphan ZIPs found")
        else:
            print(f"[WARN] Found {orphan_count} orphan ZIPs")

        conn.close()
        print("\n" + "=" * 60)
        print("POPULATION COMPLETE")
        print("=" * 60)
        return 0

    except Exception as e:
        print(f"\n[ERROR] {e}")
        return 1

if __name__ == "__main__":
    exit(main())
