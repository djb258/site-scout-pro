#!/usr/bin/env python3
"""
Harden the ref schema by replacing VIEW with static TABLE.
Geography-only columns, no census/demographic data.
"""
import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def main():
    conn_string = os.environ.get('NEON_DATABASE_URL') or os.environ.get('DATABASE_URL')
    if not conn_string:
        conn_string = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

    print("=" * 70)
    print("REF SCHEMA HARDENING")
    print("=" * 70)

    try:
        conn = psycopg2.connect(conn_string)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        print("\n[1] Connected to Neon")

        # Step 1: Drop VIEW
        print("\n[2] Dropping ref.ref_zip VIEW...")
        with conn.cursor() as cur:
            cur.execute("DROP VIEW IF EXISTS ref.ref_zip CASCADE")
        print("    [OK] VIEW dropped")

        # Step 2: Create TABLE
        print("\n[3] Creating ref.ref_zip TABLE (geography-only)...")
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS ref.ref_zip (
                    zip_id CHAR(5) PRIMARY KEY,
                    state_id INTEGER NOT NULL REFERENCES ref.ref_state(state_id) ON DELETE RESTRICT,
                    lat NUMERIC(9,6),
                    lon NUMERIC(10,6)
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_ref_zip_state ON ref.ref_zip(state_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_ref_zip_lat_lon ON ref.ref_zip(lat, lon)")
        print("    [OK] TABLE created with geography-only columns")

        # Step 3: Backfill from zips_master
        print("\n[4] Backfilling ref.ref_zip from zips_master...")
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO ref.ref_zip (zip_id, state_id, lat, lon)
                SELECT
                    LPAD(zm.zip::TEXT, 5, '0') AS zip_id,
                    rs.state_id,
                    zm.lat,
                    zm.lng AS lon
                FROM public.zips_master zm
                JOIN ref.ref_state rs ON rs.state_code = zm.state
                WHERE zm.zip IS NOT NULL
                ON CONFLICT (zip_id) DO NOTHING
            """)
            cur.execute("SELECT COUNT(*) FROM ref.ref_zip")
            zip_count = cur.fetchone()[0]
        print(f"    [OK] Backfilled {zip_count:,} ZIPs")

        # Step 4: Rebuild ref_zip_county_map
        print("\n[5] Rebuilding ref.ref_zip_county_map...")
        with conn.cursor() as cur:
            cur.execute("DROP TABLE IF EXISTS ref.ref_zip_county_map CASCADE")
            cur.execute("""
                CREATE TABLE ref.ref_zip_county_map (
                    zip_id CHAR(5) NOT NULL REFERENCES ref.ref_zip(zip_id) ON DELETE RESTRICT,
                    county_id INTEGER NOT NULL REFERENCES ref.ref_county(county_id) ON DELETE RESTRICT,
                    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (zip_id, county_id)
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_ref_zip_county_map_county ON ref.ref_zip_county_map(county_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_ref_zip_county_map_primary ON ref.ref_zip_county_map(is_primary) WHERE is_primary = TRUE")

            cur.execute("""
                INSERT INTO ref.ref_zip_county_map (zip_id, county_id, is_primary)
                SELECT
                    LPAD(zm.zip::TEXT, 5, '0') AS zip_id,
                    rc.county_id,
                    TRUE AS is_primary
                FROM public.zips_master zm
                JOIN ref.ref_county rc ON rc.county_fips = zm.county_fips
                WHERE zm.county_fips IS NOT NULL
                  AND EXISTS (SELECT 1 FROM ref.ref_zip rz WHERE rz.zip_id = LPAD(zm.zip::TEXT, 5, '0'))
                ON CONFLICT (zip_id, county_id) DO NOTHING
            """)
            cur.execute("SELECT COUNT(*) FROM ref.ref_zip_county_map")
            map_count = cur.fetchone()[0]
        print(f"    [OK] Rebuilt with {map_count:,} mappings")

        # Validation
        print("\n" + "=" * 70)
        print("VALIDATION RESULTS")
        print("=" * 70)

        # V1: Column check
        print("\n[V1] ref.ref_zip columns:")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'ref' AND table_name = 'ref_zip'
                ORDER BY ordinal_position
            """)
            columns = cur.fetchall()
            valid_columns = {'zip_id', 'state_id', 'lat', 'lon'}
            for col, dtype in columns:
                status = "[OK]" if col in valid_columns else "[VIOLATION]"
                print(f"     {status} {col} ({dtype})")

        # V2: Check for forbidden columns
        print("\n[V2] Forbidden columns check:")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'ref'
                  AND table_name = 'ref_zip'
                  AND column_name IN ('population', 'income', 'median_income',
                       'income_household_median', 'home_value', 'census_data',
                       'demographic', 'county_name', 'city', 'county_fips')
            """)
            forbidden = cur.fetchall()
            if forbidden:
                print(f"     [FAIL] Found forbidden columns: {[c[0] for c in forbidden]}")
            else:
                print("     [OK] No census/demographic columns present")

        # V3: ZIP count
        print("\n[V3] ZIP count verification:")
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM ref.ref_zip")
            ref_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(DISTINCT zip) FROM public.zips_master WHERE state IN (SELECT state_code FROM ref.ref_state)")
            master_count = cur.fetchone()[0]
            print(f"     ref.ref_zip:     {ref_count:>10,}")
            print(f"     zips_master:     {master_count:>10,}")
            pct = (ref_count / master_count * 100) if master_count > 0 else 0
            status = "[OK]" if pct > 99 else "[WARN]"
            print(f"     {status} Coverage: {pct:.2f}%")

        # V4: County count
        print("\n[V4] County count:")
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM ref.ref_county")
            county_count = cur.fetchone()[0]
            status = "[OK]" if 3100 <= county_count <= 3300 else "[WARN]"
            print(f"     {status} {county_count:,} counties (expected 3,100-3,200)")

        # V5: ZIP-County mapping
        print("\n[V5] ZIP-County mapping:")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    (SELECT COUNT(*) FROM ref.ref_zip) AS total_zips,
                    (SELECT COUNT(DISTINCT zip_id) FROM ref.ref_zip_county_map) AS mapped_zips
            """)
            total, mapped = cur.fetchone()
            orphans = total - mapped
            print(f"     Total ZIPs:      {total:>10,}")
            print(f"     Mapped ZIPs:     {mapped:>10,}")
            print(f"     Orphan ZIPs:     {orphans:>10,}")
            status = "[OK]" if orphans < total * 0.02 else "[WARN]"
            print(f"     {status} {((total-orphans)/total*100):.1f}% mapped")

        # V6: Primary county uniqueness
        print("\n[V6] Primary county uniqueness:")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) FROM (
                    SELECT zip_id
                    FROM ref.ref_zip_county_map
                    WHERE is_primary = TRUE
                    GROUP BY zip_id
                    HAVING COUNT(*) > 1
                ) t
            """)
            multi_primary = cur.fetchone()[0]
            status = "[OK]" if multi_primary == 0 else "[FAIL]"
            print(f"     {status} ZIPs with multiple primaries: {multi_primary}")

        # V7: State reference integrity
        print("\n[V7] State reference integrity:")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) FROM ref.ref_zip rz
                WHERE NOT EXISTS (SELECT 1 FROM ref.ref_state rs WHERE rs.state_id = rz.state_id)
            """)
            invalid_refs = cur.fetchone()[0]
            status = "[OK]" if invalid_refs == 0 else "[FAIL]"
            print(f"     {status} Invalid state references: {invalid_refs}")

        conn.close()

        print("\n" + "=" * 70)
        print("HARDENING COMPLETE")
        print("=" * 70)
        return 0

    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
