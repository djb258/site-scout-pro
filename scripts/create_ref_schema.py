#!/usr/bin/env python3
"""
Create the ref schema in Neon PostgreSQL.
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
    print("CREATING REF SCHEMA")
    print("=" * 60)

    # Read SQL file
    sql_path = os.path.join(os.path.dirname(__file__), 'create_ref_schema.sql')
    with open(sql_path, 'r') as f:
        sql = f.read()

    try:
        print("\n[1] Connecting to Neon...")
        conn = psycopg2.connect(conn_string)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        print("[OK] Connected")

        print("\n[2] Executing schema creation...")
        with conn.cursor() as cur:
            cur.execute(sql)
        print("[OK] Schema created")

        print("\n[3] Verifying...")
        with conn.cursor() as cur:
            # Check tables
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'ref' ORDER BY table_name
            """)
            tables = [r[0] for r in cur.fetchall()]

            # Check views
            cur.execute("""
                SELECT table_name FROM information_schema.views
                WHERE table_schema = 'ref' ORDER BY table_name
            """)
            views = [r[0] for r in cur.fetchall()]

            # Count states
            cur.execute("SELECT COUNT(*) FROM ref.ref_state")
            state_count = cur.fetchone()[0]

            # Count zips via view
            cur.execute("SELECT COUNT(*) FROM ref.ref_zip")
            zip_count = cur.fetchone()[0]

        print("\n" + "=" * 60)
        print("REF SCHEMA CREATED SUCCESSFULLY")
        print("=" * 60)
        print(f"\nTables: {', '.join(tables)}")
        print(f"Views: {', '.join(views)}")
        print(f"States loaded: {state_count}")
        print(f"ZIPs available (via view): {zip_count:,}")

        conn.close()
        return 0

    except Exception as e:
        print(f"\n[ERROR] {e}")
        return 1

if __name__ == "__main__":
    exit(main())
