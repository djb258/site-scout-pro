"""
Build Migration Data Table
Downloads and processes IRS SOI county-to-county migration data.
Shows where people are moving FROM and TO - key growth indicator.

Source: https://www.irs.gov/statistics/soi-tax-stats-migration-data
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import csv
import io
import zipfile
from datetime import datetime

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# IRS SOI Migration Data URLs
# Format: county inflows and outflows
# Latest available is usually 2-3 years behind current year
IRS_MIGRATION_URLS = {
    '2021-2022': {
        'inflow': 'https://www.irs.gov/pub/irs-soi/countyinflow2122.csv',
        'outflow': 'https://www.irs.gov/pub/irs-soi/countyoutflow2122.csv',
    },
    '2020-2021': {
        'inflow': 'https://www.irs.gov/pub/irs-soi/countyinflow2021.csv',
        'outflow': 'https://www.irs.gov/pub/irs-soi/countyoutflow2021.csv',
    }
}

# Target state FIPS
TARGET_STATES = {'42': 'PA', '54': 'WV', '24': 'MD', '51': 'VA'}

def get_connection():
    return psycopg2.connect(CONNECTION_STRING)

def download_csv(url):
    """Download CSV from IRS."""
    print(f"      Downloading {url}...")
    try:
        response = requests.get(url, timeout=120)
        if response.status_code == 200:
            return response.text
        else:
            print(f"      Error: {response.status_code}")
            return None
    except Exception as e:
        print(f"      Error: {e}")
        return None

def parse_migration_csv(csv_text, target_county_fips, flow_direction):
    """
    Parse IRS migration CSV.

    CSV columns:
    - y1_statefips, y1_countyfips, y1_state, y1_countyname (origin/dest year 1)
    - y2_statefips, y2_countyfips, y2_state, y2_countyname (origin/dest year 2)
    - n1 (returns), n2 (exemptions), AGI (adjusted gross income in thousands)
    """
    results = []

    reader = csv.DictReader(io.StringIO(csv_text))

    for row in reader:
        try:
            # Get FIPS codes
            if flow_direction == 'inflow':
                # Inflow: y2 is destination (our county), y1 is origin
                dest_state_fips = str(row.get('y2_statefips', '')).zfill(2)
                dest_county_fips = str(row.get('y2_countyfips', '')).zfill(3)
                dest_fips = dest_state_fips + dest_county_fips

                origin_state_fips = str(row.get('y1_statefips', '')).zfill(2)
                origin_county_fips = str(row.get('y1_countyfips', '')).zfill(3)
                origin_fips = origin_state_fips + origin_county_fips

                origin_state = row.get('y1_state', '')
                origin_county = row.get('y1_countyname', '')
                dest_state = row.get('y2_state', '')
                dest_county = row.get('y2_countyname', '')
            else:
                # Outflow: y1 is origin (our county), y2 is destination
                origin_state_fips = str(row.get('y1_statefips', '')).zfill(2)
                origin_county_fips = str(row.get('y1_countyfips', '')).zfill(3)
                origin_fips = origin_state_fips + origin_county_fips

                dest_state_fips = str(row.get('y2_statefips', '')).zfill(2)
                dest_county_fips = str(row.get('y2_countyfips', '')).zfill(3)
                dest_fips = dest_state_fips + dest_county_fips

                origin_state = row.get('y1_state', '')
                origin_county = row.get('y1_countyname', '')
                dest_state = row.get('y2_state', '')
                dest_county = row.get('y2_countyname', '')

            # Skip if not our target counties
            if flow_direction == 'inflow':
                if dest_fips not in target_county_fips:
                    continue
            else:
                if origin_fips not in target_county_fips:
                    continue

            # Skip same-county (non-migrants) and aggregates
            if origin_fips == dest_fips:
                continue
            if origin_county_fips in ['000', '999'] or dest_county_fips in ['000', '999']:
                continue

            # Parse numbers
            returns = int(row.get('n1', 0) or 0)
            exemptions = int(row.get('n2', 0) or 0)
            agi = float(row.get('AGI', 0) or 0) * 1000  # Convert from thousands

            if returns <= 0:
                continue

            results.append({
                'origin_state': origin_state,
                'origin_county_fips': origin_fips,
                'origin_county_name': origin_county,
                'dest_state': dest_state,
                'dest_county_fips': dest_fips,
                'dest_county_name': dest_county,
                'returns': returns,
                'exemptions': exemptions,
                'agi': agi,
                'flow_direction': flow_direction,
            })

        except (ValueError, KeyError) as e:
            continue

    return results

def build_migration_data():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("=" * 70)
    print("BUILDING MIGRATION DATA TABLE")
    print("=" * 70)

    # Get our target county FIPS codes
    cursor.execute("""
        SELECT county_fips, county_name, state
        FROM layer_3_counties
    """)
    counties = cursor.fetchall()
    target_fips = {c['county_fips'] for c in counties}
    county_lookup = {c['county_fips']: c for c in counties}

    print(f"\n   Target counties: {len(target_fips)}")

    total_inserted = 0
    data_year = 2022  # Most recent available

    for year_range, urls in IRS_MIGRATION_URLS.items():
        print(f"\n   Processing {year_range}...")

        for flow_direction, url in urls.items():
            csv_text = download_csv(url)

            if not csv_text:
                print(f"      Skipping {flow_direction} - no data")
                continue

            records = parse_migration_csv(csv_text, target_fips, flow_direction)
            print(f"      Found {len(records)} {flow_direction} records for target counties")

            for rec in records:
                try:
                    cursor.execute("""
                        INSERT INTO migration_data (
                            data_year, origin_state, origin_county_fips, origin_county_name,
                            dest_state, dest_county_fips, dest_county_name,
                            returns, exemptions, agi, flow_direction,
                            source, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        ON CONFLICT DO NOTHING
                    """, (
                        data_year,
                        rec['origin_state'],
                        rec['origin_county_fips'],
                        rec['origin_county_name'],
                        rec['dest_state'],
                        rec['dest_county_fips'],
                        rec['dest_county_name'],
                        rec['returns'],
                        rec['exemptions'],
                        rec['agi'],
                        rec['flow_direction'],
                        'irs_soi'
                    ))
                    total_inserted += 1
                except Exception as e:
                    pass  # Skip duplicates

            conn.commit()

        # Only process most recent year
        break

    print(f"\n" + "=" * 70)
    print(f"COMPLETE: {total_inserted} migration records added")
    print("=" * 70)

    # Summary - net migration by county
    cursor.execute("""
        WITH inflows AS (
            SELECT dest_county_fips as county_fips, SUM(returns) as inflow
            FROM migration_data WHERE flow_direction = 'inflow'
            GROUP BY dest_county_fips
        ),
        outflows AS (
            SELECT origin_county_fips as county_fips, SUM(returns) as outflow
            FROM migration_data WHERE flow_direction = 'outflow'
            GROUP BY origin_county_fips
        )
        SELECT
            l3.county_name, l3.state,
            COALESCE(i.inflow, 0) as inflow,
            COALESCE(o.outflow, 0) as outflow,
            COALESCE(i.inflow, 0) - COALESCE(o.outflow, 0) as net
        FROM layer_3_counties l3
        LEFT JOIN inflows i ON l3.county_fips = i.county_fips
        LEFT JOIN outflows o ON l3.county_fips = o.county_fips
        WHERE COALESCE(i.inflow, 0) > 0 OR COALESCE(o.outflow, 0) > 0
        ORDER BY net DESC
        LIMIT 15
    """)

    print("\n   Top 15 Counties by Net Migration:")
    print(f"   {'County':<25} {'ST':<4} {'Inflow':>10} {'Outflow':>10} {'Net':>10}")
    print(f"   {'-'*25} {'-'*4} {'-'*10} {'-'*10} {'-'*10}")

    for row in cursor.fetchall():
        net_str = f"+{row['net']:,}" if row['net'] > 0 else f"{row['net']:,}"
        print(f"   {row['county_name'][:25]:<25} {row['state']:<4} {row['inflow']:>10,} {row['outflow']:>10,} {net_str:>10}")

    conn.close()

if __name__ == "__main__":
    build_migration_data()
