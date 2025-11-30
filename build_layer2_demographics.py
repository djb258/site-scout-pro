"""
Layer 2 - Demographics Builder
Fetches Census ACS data for all ZIPs in layer_1_geography.
Applies kill switches based on population, income, poverty, renter %.

Kill Switches:
- population < 5,000 → KILL
- median_income < 40,000 → KILL
- poverty_rate > 25% → KILL
- renter_pct < 15% → KILL
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
CENSUS_API_KEY = "8e42aa570992dcc0798224911a7072b0112bfb0c"

# Census ACS 5-Year API endpoint
CENSUS_BASE_URL = "https://api.census.gov/data/2022/acs/acs5"

# Cache TTL in days
CACHE_TTL_DAYS = 30

# Kill switch thresholds
KILL_THRESHOLDS = {
    "min_population": 5000,
    "min_income": 40000,
    "max_poverty_rate": 25.0,
    "min_renter_pct": 15.0,
}

# Rate limiting
MAX_CALLS_PER_MINUTE = 50
CALLS_THIS_MINUTE = 0
MINUTE_START = time.time()

def get_connection():
    return psycopg2.connect(CONNECTION_STRING)

def rate_limit():
    """Enforce rate limiting - max 50 calls per minute."""
    global CALLS_THIS_MINUTE, MINUTE_START

    current_time = time.time()
    elapsed = current_time - MINUTE_START

    if elapsed >= 60:
        # Reset counter
        CALLS_THIS_MINUTE = 0
        MINUTE_START = current_time
    elif CALLS_THIS_MINUTE >= MAX_CALLS_PER_MINUTE:
        # Wait for the minute to pass
        sleep_time = 60 - elapsed + 0.1
        print(f"      Rate limit reached, sleeping {sleep_time:.1f}s...")
        time.sleep(sleep_time)
        CALLS_THIS_MINUTE = 0
        MINUTE_START = time.time()

    CALLS_THIS_MINUTE += 1

def get_cached_census(zip_code: str, conn) -> Optional[Dict]:
    """Check if Census data is cached and not expired."""
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cache_key = f"census:{zip_code}"
    cursor.execute("""
        SELECT response, expires_at
        FROM api_cache
        WHERE cache_key = %s AND expires_at > NOW()
    """, (cache_key,))

    row = cursor.fetchone()
    if row:
        response = row['response']
        if isinstance(response, str):
            return json.loads(response)
        return response
    return None

def set_cached_census(zip_code: str, data: Dict, conn):
    """Cache Census data with TTL."""
    cursor = conn.cursor()

    cache_key = f"census:{zip_code}"
    expires_at = datetime.now() + timedelta(days=CACHE_TTL_DAYS)

    cursor.execute("""
        INSERT INTO api_cache (cache_key, response, fetched_at, expires_at)
        VALUES (%s, %s, NOW(), %s)
        ON CONFLICT (cache_key) DO UPDATE SET
            response = EXCLUDED.response,
            fetched_at = NOW(),
            expires_at = EXCLUDED.expires_at
    """, (cache_key, json.dumps(data), expires_at))

    conn.commit()

def fetch_census_data_for_zip(zip_code: str, state_fips: str, conn) -> Optional[Dict]:
    """
    Fetch Census ACS data for a single ZIP code.
    Uses ZCTA (ZIP Code Tabulation Area) geography.

    Tables:
    - B01003: Total population
    - B19013: Median household income
    - B17001: Poverty status
    - B25003: Tenure (owner vs renter)
    - B25024: Units in structure
    - B25001: Housing units
    """

    # Check cache first
    cached = get_cached_census(zip_code, conn)
    if cached:
        return cached

    # Rate limit API calls
    rate_limit()

    # Variables to fetch
    variables = [
        "B01003_001E",  # Total population
        "B19013_001E",  # Median household income
        "B17001_001E",  # Total for poverty status
        "B17001_002E",  # Below poverty level
        "B25003_001E",  # Total tenure
        "B25003_002E",  # Owner occupied
        "B25003_003E",  # Renter occupied
        "B25001_001E",  # Total housing units
        "B25024_001E",  # Total units in structure
        "B25024_002E",  # SFH detached
        "B25024_003E",  # SFH attached
        "B25024_004E",  # 2 units
        "B25024_005E",  # 3-4 units
        "B25024_006E",  # 5-9 units
        "B25024_007E",  # 10-19 units
        "B25024_008E",  # 20-49 units
        "B25024_009E",  # 50+ units
        "B25024_010E",  # Mobile home
        "B01002_001E",  # Median age
    ]

    params = {
        "get": ",".join(variables),
        "for": f"zip code tabulation area:{zip_code}",
        "key": CENSUS_API_KEY
    }

    try:
        response = requests.get(CENSUS_BASE_URL, params=params, timeout=30)

        if response.status_code == 200:
            data = response.json()
            if len(data) > 1:  # First row is headers
                headers = data[0]
                values = data[1]

                result = {}
                for i, header in enumerate(headers):
                    val = values[i]
                    # Convert to int/float, handling null values
                    if val is None or val == '' or val == '-':
                        result[header] = None
                    else:
                        try:
                            result[header] = int(val) if '.' not in str(val) else float(val)
                        except:
                            result[header] = val

                # Cache the result
                set_cached_census(zip_code, result, conn)
                return result
        elif response.status_code == 204:
            # No data for this ZIP
            result = {"no_data": True}
            set_cached_census(zip_code, result, conn)
            return result
        else:
            print(f"      Census API error for {zip_code}: {response.status_code}")
            return None

    except Exception as e:
        print(f"      Census API exception for {zip_code}: {e}")
        return None

def process_census_data(raw_data: Dict) -> Dict:
    """
    Process raw Census data into our schema format.
    Calculate derived fields and categorize housing types.
    """
    if not raw_data or raw_data.get("no_data"):
        return None

    # Helper to safely get int value
    def safe_int(key, default=0):
        val = raw_data.get(key)
        if val is None:
            return default
        try:
            return int(val)
        except:
            return default

    def safe_float(key, default=0.0):
        val = raw_data.get(key)
        if val is None:
            return default
        try:
            return float(val)
        except:
            return default

    # Extract base values
    population = safe_int("B01003_001E")
    median_income = safe_int("B19013_001E")
    median_age = safe_float("B01002_001E")

    # Poverty calculation
    poverty_total = safe_int("B17001_001E", 1)
    poverty_below = safe_int("B17001_002E")
    poverty_rate = (poverty_below / poverty_total * 100) if poverty_total > 0 else 0

    # Tenure calculation
    tenure_total = safe_int("B25003_001E", 1)
    owner_occupied = safe_int("B25003_002E")
    renter_occupied = safe_int("B25003_003E")
    renter_pct = (renter_occupied / tenure_total * 100) if tenure_total > 0 else 0

    # Housing units
    housing_units = safe_int("B25001_001E")
    occupied_units = tenure_total

    # Housing type breakdown (from B25024)
    sfh_detached = safe_int("B25024_002E")
    sfh_attached = safe_int("B25024_003E")
    units_2 = safe_int("B25024_004E")
    units_3_4 = safe_int("B25024_005E")
    units_5_9 = safe_int("B25024_006E")
    units_10_19 = safe_int("B25024_007E")
    units_20_49 = safe_int("B25024_008E")
    units_50_plus = safe_int("B25024_009E")
    mobile_home = safe_int("B25024_010E")

    # Categorize housing types
    sfh_units = sfh_detached
    townhome_units = sfh_attached + units_2 + units_3_4
    apartment_units = units_5_9 + units_10_19 + units_20_49 + units_50_plus
    mobile_home_units = mobile_home

    # Cap values to prevent database overflow
    # poverty_rate and renter_pct should be 0-100
    poverty_rate = min(max(poverty_rate, 0), 100)
    renter_pct = min(max(renter_pct, 0), 100)
    # median_age typically 0-120
    median_age_capped = min(max(median_age, 0), 999) if median_age else None

    return {
        "population": population,
        "median_income": median_income,
        "poverty_rate": round(poverty_rate, 2),
        "renter_pct": round(renter_pct, 2),
        "median_age": round(median_age_capped, 1) if median_age_capped else None,
        "housing_units": housing_units,
        "occupied_units": occupied_units,
        "sfh_units": sfh_units,
        "townhome_units": townhome_units,
        "apartment_units": apartment_units,
        "mobile_home_units": mobile_home_units,
    }

def apply_kill_switches(data: Dict) -> tuple:
    """
    Apply kill switches to demographic data.
    Returns (passed, kill_reason)
    """
    if data is None:
        return False, "No Census data available"

    # Check each threshold
    if data["population"] < KILL_THRESHOLDS["min_population"]:
        return False, f"Population {data['population']:,} < {KILL_THRESHOLDS['min_population']:,}"

    if data["median_income"] and data["median_income"] < KILL_THRESHOLDS["min_income"]:
        return False, f"Income ${data['median_income']:,} < ${KILL_THRESHOLDS['min_income']:,}"

    if data["poverty_rate"] > KILL_THRESHOLDS["max_poverty_rate"]:
        return False, f"Poverty {data['poverty_rate']:.1f}% > {KILL_THRESHOLDS['max_poverty_rate']}%"

    if data["renter_pct"] < KILL_THRESHOLDS["min_renter_pct"]:
        return False, f"Renter {data['renter_pct']:.1f}% < {KILL_THRESHOLDS['min_renter_pct']}%"

    return True, None

def get_state_fips(state: str) -> str:
    """Convert state abbreviation to FIPS code."""
    fips_map = {
        "PA": "42", "MD": "24", "VA": "51", "WV": "54",
        "OH": "39", "NY": "36", "NJ": "34", "DE": "10", "DC": "11"
    }
    return fips_map.get(state, "00")

def build_layer2():
    """Main function to build Layer 2 demographics."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("=" * 70)
    print("LAYER 2 - DEMOGRAPHICS BUILDER")
    print("=" * 70)
    print(f"\nKill Thresholds:")
    print(f"   Min Population: {KILL_THRESHOLDS['min_population']:,}")
    print(f"   Min Income: ${KILL_THRESHOLDS['min_income']:,}")
    print(f"   Max Poverty: {KILL_THRESHOLDS['max_poverty_rate']}%")
    print(f"   Min Renter %: {KILL_THRESHOLDS['min_renter_pct']}%")

    # Get all ZIPs from layer_1_geography
    cursor.execute("""
        SELECT zip, state, county_fips
        FROM layer_1_geography
        WHERE passed = TRUE
        ORDER BY zip
    """)
    zips = cursor.fetchall()
    total_zips = len(zips)

    print(f"\n   Total ZIPs to process: {total_zips:,}")

    # Track statistics
    stats = {
        "processed": 0,
        "passed": 0,
        "killed": 0,
        "no_data": 0,
        "cache_hits": 0,
        "api_calls": 0,
        "kill_reasons": {},
    }

    start_time = time.time()

    print(f"\n   Processing ZIPs...")
    print(f"   {'Progress':<15} {'Passed':<10} {'Killed':<10} {'No Data':<10} {'Cache':<10} {'API':<10}")
    print(f"   {'-'*15} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10}")

    for i, zip_row in enumerate(zips):
        zip_code = zip_row['zip']
        state = zip_row['state']
        state_fips = get_state_fips(state)

        # Check if we have cached data
        cached = get_cached_census(zip_code, conn)
        if cached:
            stats["cache_hits"] += 1
            raw_data = cached
        else:
            stats["api_calls"] += 1
            raw_data = fetch_census_data_for_zip(zip_code, state_fips, conn)

        # Process the data
        processed = process_census_data(raw_data)

        if processed is None:
            stats["no_data"] += 1
            passed = False
            kill_reason = "No Census data available"
            processed = {
                "population": None, "median_income": None, "poverty_rate": None,
                "renter_pct": None, "median_age": None, "housing_units": None,
                "occupied_units": None, "sfh_units": None, "townhome_units": None,
                "apartment_units": None, "mobile_home_units": None
            }
        else:
            passed, kill_reason = apply_kill_switches(processed)
            if passed:
                stats["passed"] += 1
            else:
                stats["killed"] += 1
                # Track kill reasons
                reason_key = kill_reason.split()[0] if kill_reason else "Unknown"
                stats["kill_reasons"][reason_key] = stats["kill_reasons"].get(reason_key, 0) + 1

        # Insert into layer_2_demographics
        try:
            cursor.execute("""
                INSERT INTO layer_2_demographics
                (zip, population, median_income, poverty_rate, renter_pct, median_age,
                 housing_units, occupied_units, sfh_units, townhome_units, apartment_units,
                 mobile_home_units, passed, kill_reason)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (zip) DO UPDATE SET
                    population = EXCLUDED.population,
                    median_income = EXCLUDED.median_income,
                    poverty_rate = EXCLUDED.poverty_rate,
                    renter_pct = EXCLUDED.renter_pct,
                    median_age = EXCLUDED.median_age,
                    housing_units = EXCLUDED.housing_units,
                    occupied_units = EXCLUDED.occupied_units,
                    sfh_units = EXCLUDED.sfh_units,
                    townhome_units = EXCLUDED.townhome_units,
                    apartment_units = EXCLUDED.apartment_units,
                    mobile_home_units = EXCLUDED.mobile_home_units,
                    passed = EXCLUDED.passed,
                    kill_reason = EXCLUDED.kill_reason
            """, (
                zip_code, processed["population"], processed["median_income"],
                processed["poverty_rate"], processed["renter_pct"], processed["median_age"],
                processed["housing_units"], processed["occupied_units"], processed["sfh_units"],
                processed["townhome_units"], processed["apartment_units"], processed["mobile_home_units"],
                passed, kill_reason
            ))
        except Exception as e:
            print(f"\n      ERROR inserting {zip_code}: {e}")
            print(f"      Data: {processed}")
            conn.rollback()
            continue

        stats["processed"] += 1

        # Log progress every 100 ZIPs
        if (i + 1) % 100 == 0 or (i + 1) == total_zips:
            pct = (i + 1) / total_zips * 100
            print(f"   {i+1:,}/{total_zips:,} ({pct:>5.1f}%)  {stats['passed']:<10} {stats['killed']:<10} {stats['no_data']:<10} {stats['cache_hits']:<10} {stats['api_calls']:<10}")
            conn.commit()

    conn.commit()
    elapsed = time.time() - start_time

    print(f"\n" + "=" * 70)
    print("LAYER 2 SUMMARY")
    print("=" * 70)
    print(f"\n   Processing Time: {elapsed/60:.1f} minutes")
    print(f"   Total ZIPs: {stats['processed']:,}")
    print(f"   Passed: {stats['passed']:,} ({stats['passed']/stats['processed']*100:.1f}%)")
    print(f"   Killed: {stats['killed']:,} ({stats['killed']/stats['processed']*100:.1f}%)")
    print(f"   No Data: {stats['no_data']:,} ({stats['no_data']/stats['processed']*100:.1f}%)")
    print(f"\n   Cache Hits: {stats['cache_hits']:,}")
    print(f"   API Calls: {stats['api_calls']:,}")

    print(f"\n   Kill Reasons:")
    for reason, count in sorted(stats["kill_reasons"].items(), key=lambda x: -x[1]):
        print(f"      {reason}: {count:,}")

    conn.close()
    return stats

def verify_layer2():
    """Verify and summarize Layer 2 data."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print(f"\n" + "=" * 70)
    print("LAYER 2 VERIFICATION")
    print("=" * 70)

    # Overall counts
    cursor.execute("""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN NOT passed THEN 1 ELSE 0 END) as killed
        FROM layer_2_demographics
    """)
    row = cursor.fetchone()
    print(f"\n   Total: {row['total']:,}")
    print(f"   Passed: {row['passed']:,}")
    print(f"   Killed: {row['killed']:,}")

    # Kill reasons breakdown
    cursor.execute("""
        SELECT kill_reason, COUNT(*) as cnt
        FROM layer_2_demographics
        WHERE kill_reason IS NOT NULL
        GROUP BY kill_reason
        ORDER BY cnt DESC
        LIMIT 10
    """)
    print(f"\n   Top Kill Reasons:")
    for row in cursor.fetchall():
        print(f"      {row['kill_reason']}: {row['cnt']:,}")

    # Survivors by state
    cursor.execute("""
        SELECT l1.state, COUNT(*) as surviving
        FROM layer_2_demographics l2
        JOIN layer_1_geography l1 ON l2.zip = l1.zip
        WHERE l2.passed = TRUE
        GROUP BY l1.state
        ORDER BY surviving DESC
    """)
    print(f"\n   Survivors by State:")
    for row in cursor.fetchall():
        print(f"      {row['state']}: {row['surviving']:,}")

    # Demographic stats for survivors
    cursor.execute("""
        SELECT
            AVG(population) as avg_pop,
            AVG(median_income) as avg_income,
            AVG(poverty_rate) as avg_poverty,
            AVG(renter_pct) as avg_renter,
            SUM(housing_units) as total_housing,
            SUM(sfh_units) as total_sfh,
            SUM(townhome_units) as total_townhome,
            SUM(apartment_units) as total_apartment,
            SUM(mobile_home_units) as total_mobile
        FROM layer_2_demographics
        WHERE passed = TRUE
    """)
    row = cursor.fetchone()
    print(f"\n   Survivor Demographics (Averages):")
    print(f"      Avg Population: {int(row['avg_pop'] or 0):,}")
    print(f"      Avg Income: ${int(row['avg_income'] or 0):,}")
    print(f"      Avg Poverty Rate: {row['avg_poverty'] or 0:.1f}%")
    print(f"      Avg Renter %: {row['avg_renter'] or 0:.1f}%")

    print(f"\n   Housing Units (Survivors):")
    print(f"      Total Housing: {int(row['total_housing'] or 0):,}")
    print(f"      SFH: {int(row['total_sfh'] or 0):,}")
    print(f"      Townhome: {int(row['total_townhome'] or 0):,}")
    print(f"      Apartment: {int(row['total_apartment'] or 0):,}")
    print(f"      Mobile Home: {int(row['total_mobile'] or 0):,}")

    # Sample survivors
    cursor.execute("""
        SELECT l2.zip, z.city, l1.state, l2.population, l2.median_income,
               l2.renter_pct, l2.housing_units
        FROM layer_2_demographics l2
        JOIN layer_1_geography l1 ON l2.zip = l1.zip
        JOIN zips_master z ON l2.zip = z.zip
        WHERE l2.passed = TRUE
        ORDER BY l2.population DESC
        LIMIT 10
    """)
    print(f"\n   Top 10 Survivors by Population:")
    print(f"   {'ZIP':<8} {'City':<20} {'State':<5} {'Pop':<10} {'Income':<10} {'Renter%':<8} {'Units'}")
    for row in cursor.fetchall():
        print(f"   {row['zip']:<8} {row['city'][:20]:<20} {row['state']:<5} {row['population']:>8,} ${row['median_income']:>8,} {row['renter_pct']:>6.1f}% {row['housing_units']:>7,}")

    conn.close()

if __name__ == "__main__":
    # Build Layer 2
    stats = build_layer2()

    # Verify results
    verify_layer2()
