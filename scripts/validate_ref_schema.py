#!/usr/bin/env python3
"""
Validate ref schema and pass1_census_snapshot data integrity.
"""
import os
import psycopg2

def main():
    conn_string = os.environ.get('NEON_DATABASE_URL') or os.environ.get('DATABASE_URL')
    if not conn_string:
        conn_string = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

    print("=" * 60)
    print("REF SCHEMA VALIDATION REPORT")
    print("=" * 60)

    conn = psycopg2.connect(conn_string)

    # V1: Ref table counts
    print("\n[V1] REF TABLE COUNTS")
    print("-" * 40)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 'ref_country' AS table_name, COUNT(*) AS row_count FROM ref.ref_country
            UNION ALL SELECT 'ref_state', COUNT(*) FROM ref.ref_state
            UNION ALL SELECT 'ref_county', COUNT(*) FROM ref.ref_county
            UNION ALL SELECT 'ref_zip', COUNT(*) FROM ref.ref_zip
            UNION ALL SELECT 'ref_zip_county_map', COUNT(*) FROM ref.ref_zip_county_map
            UNION ALL SELECT 'ref_asset_class', COUNT(*) FROM ref.ref_asset_class
            UNION ALL SELECT 'ref_unit_type', COUNT(*) FROM ref.ref_unit_type
            UNION ALL SELECT 'ref_unit_size', COUNT(*) FROM ref.ref_unit_size
            ORDER BY 1
        """)
        for table, count in cur.fetchall():
            status = "[OK]" if count > 0 else "[WARN]"
            print(f"  {status} {table:<25} {count:>10,} rows")

    # V1b: ref.ref_zip column check (HARDENED)
    print("\n[V1b] ref.ref_zip COLUMN CHECK (HARDENED)")
    print("-" * 40)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'ref' AND table_name = 'ref_zip'
            ORDER BY ordinal_position
        """)
        columns = cur.fetchall()
        valid_columns = {'zip_id', 'state_id', 'lat', 'lon'}
        forbidden = {'population', 'income', 'median_income', 'home_value',
                     'census_data', 'demographic', 'county_name', 'city', 'county_fips'}

        for col, dtype in columns:
            if col in valid_columns:
                print(f"  [OK] {col} ({dtype})")
            elif col in forbidden:
                print(f"  [VIOLATION] {col} ({dtype}) - FORBIDDEN COLUMN!")
            else:
                print(f"  [WARN] {col} ({dtype}) - unexpected column")

    # V2: ZIP to county mapping coverage
    print("\n[V2] ZIP-COUNTY MAPPING COVERAGE")
    print("-" * 40)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                (SELECT COUNT(*) FROM public.zips_master WHERE county_fips IS NOT NULL) AS zips_with_county,
                (SELECT COUNT(*) FROM ref.ref_zip_county_map) AS mapped_zips,
                (SELECT COUNT(*) FROM public.zips_master WHERE county_fips IS NULL) AS zips_without_county
        """)
        row = cur.fetchone()
        print(f"  ZIPs with county FIPS:   {row[0]:>10,}")
        print(f"  ZIPs mapped in ref:      {row[1]:>10,}")
        print(f"  ZIPs without county:     {row[2]:>10,}")
        coverage = (row[1] / row[0] * 100) if row[0] > 0 else 0
        status = "[OK]" if coverage > 99 else "[WARN]"
        print(f"  {status} Coverage: {coverage:.2f}%")

    # V3: Verify no Census data in ref schema
    print("\n[V3] REF SCHEMA PURITY CHECK")
    print("-" * 40)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'ref'
            AND column_name IN ('population', 'median_income', 'census_data', 'demographic')
            ORDER BY table_name, column_name
        """)
        violations = cur.fetchall()
        if violations:
            print("  [FAIL] Census columns found in ref schema:")
            for table, col in violations:
                print(f"         - {table}.{col}")
        else:
            print("  [OK] No Census columns in ref schema (purity maintained)")

    # V4: Orphan check
    print("\n[V4] ORPHAN ZIP CHECK")
    print("-" * 40)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) AS orphan_count
            FROM ref.ref_zip_county_map m
            LEFT JOIN public.zips_master z ON m.zip_id = z.zip
            WHERE z.zip IS NULL
        """)
        orphan_count = cur.fetchone()[0]
        status = "[OK]" if orphan_count == 0 else "[FAIL]"
        print(f"  {status} Orphan ZIPs in ref_zip_county_map: {orphan_count}")

    # V5: State coverage
    print("\n[V5] STATE COVERAGE")
    print("-" * 40)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(DISTINCT state) FROM public.zips_master
        """)
        zips_master_states = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM ref.ref_state")
        ref_states = cur.fetchone()[0]

        print(f"  States in zips_master:   {zips_master_states:>10}")
        print(f"  States in ref_state:     {ref_states:>10}")
        status = "[OK]" if ref_states >= zips_master_states else "[WARN]"
        print(f"  {status} All states covered")

    # V6: Census snapshot stats (if any data exists)
    print("\n[V6] CENSUS SNAPSHOT STATS")
    print("-" * 40)
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM public.pass1_census_snapshot")
        snapshot_count = cur.fetchone()[0]
        print(f"  Total snapshots:         {snapshot_count:>10,}")

        if snapshot_count > 0:
            cur.execute("""
                SELECT
                    vintage_year,
                    COUNT(*) as records,
                    COUNT(DISTINCT zip_code) as unique_zips,
                    COUNT(DISTINCT run_id) as runs
                FROM public.pass1_census_snapshot
                GROUP BY vintage_year
                ORDER BY vintage_year DESC
            """)
            for year, records, zips, runs in cur.fetchall():
                print(f"  Year {year}: {records:,} records, {zips:,} ZIPs, {runs} runs")

    # V7: Skip log stats
    print("\n[V7] CENSUS SKIP LOG")
    print("-" * 40)
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM public.pass1_census_skip_log")
        skip_count = cur.fetchone()[0]
        print(f"  Total skipped ZIPs:      {skip_count:>10,}")

        if skip_count > 0:
            cur.execute("""
                SELECT skip_reason, COUNT(*)
                FROM public.pass1_census_skip_log
                GROUP BY skip_reason
                ORDER BY COUNT(*) DESC
                LIMIT 5
            """)
            print("  Top skip reasons:")
            for reason, count in cur.fetchall():
                print(f"    - {reason[:40]}: {count:,}")

    # V8: Sample Census data quality
    print("\n[V8] CENSUS DATA QUALITY SAMPLE")
    print("-" * 40)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE population IS NOT NULL) as has_pop,
                COUNT(*) FILTER (WHERE median_household_income IS NOT NULL) as has_income,
                COUNT(*) FILTER (WHERE housing_units IS NOT NULL) as has_housing,
                COUNT(*) FILTER (WHERE median_age IS NOT NULL) as has_age,
                COUNT(*) as total
            FROM public.pass1_census_snapshot
        """)
        row = cur.fetchone()
        if row and row[4] > 0:
            total = row[4]
            print(f"  Population present:      {row[0]:>10,} ({row[0]/total*100:.1f}%)")
            print(f"  Income present:          {row[1]:>10,} ({row[1]/total*100:.1f}%)")
            print(f"  Housing units present:   {row[2]:>10,} ({row[2]/total*100:.1f}%)")
            print(f"  Median age present:      {row[3]:>10,} ({row[3]/total*100:.1f}%)")
        else:
            print("  No Census snapshot data to analyze")

    conn.close()

    print("\n" + "=" * 60)
    print("VALIDATION COMPLETE")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    exit(main())
