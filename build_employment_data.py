"""
Build Employment Data Table
Fetches county-level employment data from BLS QCEW.
Shows economic health and job growth in target counties.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import time
from datetime import datetime

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# BLS QCEW API
# Documentation: https://www.bls.gov/cew/downloadable-data-files.htm
# API: https://data.bls.gov/cew/data/api/

# State FIPS codes
STATE_FIPS = {
    'PA': '42',
    'WV': '54',
    'MD': '24',
    'VA': '51'
}

def get_connection():
    return psycopg2.connect(CONNECTION_STRING)

def fetch_qcew_county(county_fips, year='2023'):
    """
    Fetch QCEW data for a single county.
    """
    url = f"https://data.bls.gov/cew/data/api/{year}/a/area/{county_fips}.csv"

    try:
        response = requests.get(url, timeout=60)
        if response.status_code == 200:
            return response.text
        else:
            return None
    except Exception as e:
        print(f"      Error: {e}")
        return None

def parse_qcew_county(csv_text):
    """Parse QCEW CSV and extract county totals (own_code=0 = all ownership, industry=10 = all industries)."""
    lines = csv_text.strip().split('\n')

    if len(lines) < 2:
        return None

    # Parse header
    header = lines[0].split(',')
    header = [h.strip('"') for h in header]

    # Find column indices
    cols = {h: i for i, h in enumerate(header)}

    for line in lines[1:]:
        fields = line.split(',')
        fields = [f.strip('"') for f in fields]

        if len(fields) < len(header):
            continue

        try:
            own_code = fields[cols.get('own_code', 1)]
            industry_code = fields[cols.get('industry_code', 2)]

            # Get total (own_code=0 = all, industry_code=10 = all industries)
            if own_code == '0' and industry_code == '10':
                return {
                    'establishments': int(fields[cols.get('annual_avg_estabs', 8)] or 0),
                    'employment': int(fields[cols.get('annual_avg_emplvl', 9)] or 0),
                    'total_wages': float(fields[cols.get('total_annual_wages', 10)] or 0),
                    'avg_weekly_wage': int(fields[cols.get('annual_avg_wkly_wage', -1)].split(',')[0] or 0) if cols.get('annual_avg_wkly_wage') else 0,
                }
        except (ValueError, IndexError, KeyError) as e:
            continue

    return None

def build_employment_data():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("=" * 70)
    print("BUILDING EMPLOYMENT DATA TABLE")
    print("=" * 70)

    # Get our target county FIPS codes
    cursor.execute("""
        SELECT county_fips, county_name, state
        FROM layer_3_counties
        ORDER BY state, county_name
    """)
    counties = cursor.fetchall()

    print(f"\n   Target counties: {len(counties)}")

    total_inserted = 0
    year = '2023'

    for county in counties:
        county_fips = county['county_fips']
        county_name = county['county_name']
        state = county['state']

        # Fetch data for this county
        csv_text = fetch_qcew_county(county_fips, year=year)

        if not csv_text:
            print(f"   {county_name}, {state}: No data")
            continue

        # Parse
        data = parse_qcew_county(csv_text)

        if not data:
            print(f"   {county_name}, {state}: Parse failed")
            continue

        try:
            cursor.execute("""
                INSERT INTO employment_data (
                    data_year, state, county_fips, county_name,
                    naics_code, naics_title, ownership,
                    establishments, employment, total_wages, avg_weekly_wage,
                    source, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT DO NOTHING
            """, (
                int(year),
                state,
                county_fips,
                county_name,
                '10',  # All industries
                'All Industries',
                'All',
                data['establishments'],
                data['employment'],
                data['total_wages'],
                data['avg_weekly_wage'],
                'bls_qcew'
            ))
            total_inserted += 1
            print(f"   {county_name}, {state}: {data['employment']:,} employees, {data['establishments']:,} establishments")
        except Exception as e:
            print(f"   {county_name}, {state}: Insert error - {e}")

        conn.commit()
        time.sleep(0.5)  # Rate limit

    print(f"\n" + "=" * 70)
    print(f"COMPLETE: {total_inserted} county employment records added")
    print("=" * 70)

    # Summary
    cursor.execute("""
        SELECT state, COUNT(*) as counties, SUM(employment) as total_emp,
               SUM(establishments) as total_estab
        FROM employment_data
        GROUP BY state
        ORDER BY total_emp DESC
    """)
    print("\n   By state:")
    for row in cursor.fetchall():
        print(f"      {row['state']}: {row['counties']} counties, {row['total_emp']:,} employees, {row['total_estab']:,} establishments")

    conn.close()

if __name__ == "__main__":
    build_employment_data()
