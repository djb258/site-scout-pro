#!/usr/bin/env python3
"""
Load uszips.csv into zips_master table in Neon PostgreSQL.
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import csv
import psycopg2
from psycopg2.extras import execute_values

CONN_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
CSV_PATH = r"c:\Users\CUSTOM PC\Desktop\uszips.csv"

def main():
    print("=" * 60)
    print("LOADING ZIPS_MASTER FROM CSV")
    print("=" * 60)

    # Connect to database
    print("\n1. Connecting to Neon...")
    conn = psycopg2.connect(CONN_STRING)
    cursor = conn.cursor()
    print("   ✓ Connected")

    # Drop and recreate zips_master with extended schema
    print("\n2. Creating zips_master table...")
    cursor.execute("DROP TABLE IF EXISTS zips_master CASCADE;")

    cursor.execute("""
        CREATE TABLE zips_master (
            zip VARCHAR(5) PRIMARY KEY,
            lat DECIMAL(10, 5),
            lng DECIMAL(10, 5),
            city VARCHAR(100),
            state VARCHAR(2) NOT NULL,
            state_name VARCHAR(50),
            zcta BOOLEAN,
            parent_zcta VARCHAR(5),
            population INT,
            density DECIMAL(10, 2),
            county_fips VARCHAR(5),
            county_name VARCHAR(100),
            timezone VARCHAR(50),
            age_median DECIMAL(5, 1),
            income_household_median INT,
            home_ownership DECIMAL(5, 1),
            home_value INT,
            rent_median INT,
            education_college_or_above DECIMAL(5, 1),
            unemployment_rate DECIMAL(5, 1),
            military BOOLEAN
        );

        CREATE INDEX idx_zips_master_state ON zips_master(state);
        CREATE INDEX idx_zips_master_county ON zips_master(county_fips);
        CREATE INDEX idx_zips_master_population ON zips_master(population);
    """)
    conn.commit()
    print("   ✓ Table created with indexes")

    # Read CSV and prepare data
    print("\n3. Reading CSV file...")
    rows = []
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Parse numeric values safely
            def parse_decimal(val):
                try:
                    return float(val) if val and val.strip() else None
                except:
                    return None

            def parse_int(val):
                try:
                    return int(float(val)) if val and val.strip() else None
                except:
                    return None

            def parse_bool(val):
                return val.upper() == 'TRUE' if val else False

            rows.append((
                row['zip'],
                parse_decimal(row['lat']),
                parse_decimal(row['lng']),
                row['city'] or None,
                row['state_id'],  # This is the 2-letter state code
                row['state_name'] or None,
                parse_bool(row['zcta']),
                row['parent_zcta'] or None,
                parse_int(row['population']),
                parse_decimal(row['density']),
                row['county_fips'] or None,
                row['county_name'] or None,
                row['timezone'] or None,
                parse_decimal(row['age_median']),
                parse_int(row['income_household_median']),
                parse_decimal(row['home_ownership']),
                parse_int(row['home_value']),
                parse_int(row['rent_median']),
                parse_decimal(row['education_college_or_above']),
                parse_decimal(row['unemployment_rate']),
                parse_bool(row['military'])
            ))

    print(f"   ✓ Read {len(rows):,} ZIP codes")

    # Bulk insert
    print("\n4. Inserting into database...")
    insert_sql = """
        INSERT INTO zips_master (
            zip, lat, lng, city, state, state_name, zcta, parent_zcta,
            population, density, county_fips, county_name, timezone,
            age_median, income_household_median, home_ownership, home_value,
            rent_median, education_college_or_above, unemployment_rate, military
        ) VALUES %s
    """

    # Insert in batches of 1000
    batch_size = 1000
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        execute_values(cursor, insert_sql, batch)
        conn.commit()
        print(f"   Inserted {min(i+batch_size, len(rows)):,} / {len(rows):,}", end='\r')

    print(f"\n   ✓ Inserted {len(rows):,} rows")

    # Verify
    print("\n5. Verifying data...")
    cursor.execute("SELECT COUNT(*) FROM zips_master;")
    total = cursor.fetchone()[0]

    cursor.execute("""
        SELECT state, COUNT(*) as cnt
        FROM zips_master
        GROUP BY state
        ORDER BY cnt DESC
        LIMIT 10;
    """)
    top_states = cursor.fetchall()

    cursor.execute("""
        SELECT state, COUNT(*) as cnt
        FROM zips_master
        WHERE state IN ('WV', 'PA', 'VA', 'OH', 'MD')
        GROUP BY state
        ORDER BY state;
    """)
    target_states = cursor.fetchall()

    print(f"   ✓ Total ZIPs: {total:,}")
    print("\n   Top 10 states by ZIP count:")
    for state, cnt in top_states:
        print(f"     {state}: {cnt:,}")

    print("\n   Target states (WV, PA, VA, OH, MD):")
    for state, cnt in target_states:
        print(f"     {state}: {cnt:,}")

    # Check WV specifically
    cursor.execute("""
        SELECT zip, city, county_name, population, income_household_median
        FROM zips_master
        WHERE state = 'WV'
        ORDER BY population DESC NULLS LAST
        LIMIT 5;
    """)
    wv_top = cursor.fetchall()

    print("\n   Top 5 WV ZIPs by population:")
    for row in wv_top:
        print(f"     {row[0]} - {row[1]}, {row[2]} (pop: {row[3]:,}, income: ${row[4]:,})" if row[3] and row[4] else f"     {row[0]} - {row[1]}, {row[2]}")

    conn.close()

    print("\n" + "=" * 60)
    print("ZIPS_MASTER LOADED SUCCESSFULLY")
    print("=" * 60)
    print(f"\nTotal ZIPs: {total:,}")
    print("\nReady to continue with setup_screener.py")

if __name__ == "__main__":
    main()
