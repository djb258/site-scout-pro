"""
Layer 3 - County Aggregation Builder
Aggregates surviving ZIPs from Layer 2 into county-level data.

Kill Switch:
- avg_county_density > 750/sq mi -> KILL (too urban)

Calculates:
- Total population, housing units by type
- Average income, poverty rate, renter percentage
- Demand potential (sqft estimate based on housing mix)
"""

import psycopg2
from psycopg2.extras import RealDictCursor

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Kill switch threshold - average density across county's surviving ZIPs
MAX_COUNTY_DENSITY = 750  # persons per sq mi - above this is too urban

# Demand multipliers (sq ft of storage demand per housing unit)
DEMAND_MULTIPLIERS = {
    "sfh": 4,           # SFH has garages/basements, less demand
    "townhome": 6,      # Townhomes have limited storage
    "apartment": 6,     # Apartments have minimal storage
    "mobile_home": 6,   # Mobile homes need external storage
}

def get_connection():
    return psycopg2.connect(CONNECTION_STRING)

def build_layer3():
    """Aggregate surviving ZIPs into county-level data with density kill switch."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("=" * 70)
    print("LAYER 3 - COUNTY AGGREGATION BUILDER")
    print("=" * 70)
    print(f"\n   Kill Switch: avg_county_density > {MAX_COUNTY_DENSITY:,}/sq mi -> KILL (too urban)")

    # First, check how many surviving ZIPs we have
    cursor.execute("""
        SELECT COUNT(*) as cnt FROM layer_2_demographics WHERE passed = TRUE
    """)
    surviving_zips = cursor.fetchone()['cnt']
    print(f"   Surviving ZIPs from Layer 2: {surviving_zips:,}")

    # Clear existing data
    cursor.execute("DELETE FROM layer_3_counties")
    print(f"   Cleared existing layer_3_counties data")

    # Get county aggregates WITH average density from zips_master
    print(f"\n   Aggregating to county level with density check...")

    cursor.execute("""
        SELECT
            l1.county_fips,
            l1.state,
            l1.county_name,
            COUNT(*) as surviving_zips,
            SUM(COALESCE(l2.population, 0)) as total_population,
            SUM(COALESCE(l2.housing_units, 0)) as total_housing_units,
            SUM(COALESCE(l2.sfh_units, 0)) as total_sfh,
            SUM(COALESCE(l2.townhome_units, 0)) as total_townhome,
            SUM(COALESCE(l2.apartment_units, 0)) as total_apartment,
            SUM(COALESCE(l2.mobile_home_units, 0)) as total_mobile_home,
            ROUND(AVG(l2.median_income)) as avg_income,
            ROUND(AVG(l2.poverty_rate)::numeric, 1) as avg_poverty,
            ROUND(AVG(l2.renter_pct)::numeric, 1) as avg_renter_pct,
            ROUND(AVG(z.density)::numeric, 0) as avg_density
        FROM layer_2_demographics l2
        JOIN layer_1_geography l1 ON l2.zip = l1.zip
        JOIN zips_master z ON l1.zip = z.zip
        WHERE l2.passed = TRUE
        GROUP BY l1.county_fips, l1.state, l1.county_name
        ORDER BY surviving_zips DESC
    """)

    all_counties = cursor.fetchall()
    print(f"   Found {len(all_counties)} counties before density filter")

    # Apply density kill switch
    passed_counties = 0
    killed_counties = 0
    killed_list = []

    for county in all_counties:
        avg_density = county['avg_density'] or 0

        if avg_density > MAX_COUNTY_DENSITY:
            killed_counties += 1
            killed_list.append((county['county_name'], county['state'], avg_density))
            continue

        # Insert county that passed
        cursor.execute("""
            INSERT INTO layer_3_counties (
                county_fips, state, county_name, surviving_zips,
                total_population, total_housing_units,
                total_sfh, total_townhome, total_apartment, total_mobile_home,
                avg_income, avg_poverty, avg_renter_pct
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            county['county_fips'], county['state'], county['county_name'],
            county['surviving_zips'], county['total_population'], county['total_housing_units'],
            county['total_sfh'], county['total_townhome'], county['total_apartment'],
            county['total_mobile_home'], county['avg_income'], county['avg_poverty'],
            county['avg_renter_pct']
        ))
        passed_counties += 1

    conn.commit()

    print(f"\n   Results:")
    print(f"      Counties passed: {passed_counties}")
    print(f"      Counties killed (too urban): {killed_counties}")

    if killed_list:
        print(f"\n   Killed Counties (density > {MAX_COUNTY_DENSITY}/sq mi):")
        for name, state, density in sorted(killed_list, key=lambda x: -x[2]):
            print(f"      {name}, {state}: {density:,.0f}/sq mi")

    conn.close()
    return passed_counties

def calculate_demand_potential():
    """Calculate demand potential (estimated sq ft demand) per county."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print(f"\n" + "=" * 70)
    print("CALCULATING DEMAND POTENTIAL")
    print("=" * 70)

    print(f"\n   Demand Multipliers (sq ft per housing unit):")
    for unit_type, multiplier in DEMAND_MULTIPLIERS.items():
        print(f"      {unit_type}: {multiplier} sq ft")

    # We'll add a demand_sqft column if it doesn't exist
    cursor.execute("""
        ALTER TABLE layer_3_counties
        ADD COLUMN IF NOT EXISTS demand_sqft BIGINT,
        ADD COLUMN IF NOT EXISTS high_demand_units INT
    """)
    conn.commit()

    # Calculate demand potential
    cursor.execute(f"""
        UPDATE layer_3_counties
        SET
            demand_sqft = (
                (COALESCE(total_sfh, 0) * {DEMAND_MULTIPLIERS['sfh']}) +
                (COALESCE(total_townhome, 0) * {DEMAND_MULTIPLIERS['townhome']}) +
                (COALESCE(total_apartment, 0) * {DEMAND_MULTIPLIERS['apartment']}) +
                (COALESCE(total_mobile_home, 0) * {DEMAND_MULTIPLIERS['mobile_home']})
            ),
            high_demand_units = COALESCE(total_townhome, 0) + COALESCE(total_apartment, 0) + COALESCE(total_mobile_home, 0)
    """)

    updated = cursor.rowcount
    conn.commit()

    print(f"\n   Updated {updated} counties with demand calculations")

    # Show formula
    print(f"\n   Formula:")
    print(f"   demand_sqft = (SFH × 4) + (Townhome × 6) + (Apartment × 6) + (Mobile × 6)")
    print(f"   high_demand_units = Townhome + Apartment + Mobile Home")

    conn.close()

def verify_and_rank():
    """Verify data and generate rankings."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print(f"\n" + "=" * 70)
    print("LAYER 3 VERIFICATION & RANKINGS")
    print("=" * 70)

    # Summary stats
    cursor.execute("""
        SELECT
            COUNT(*) as total_counties,
            SUM(surviving_zips) as total_zips,
            SUM(total_population) as total_pop,
            SUM(total_housing_units) as total_housing,
            SUM(demand_sqft) as total_demand_sqft,
            ROUND(AVG(avg_income)) as overall_avg_income
        FROM layer_3_counties
    """)
    stats = cursor.fetchone()

    print(f"\n   Summary:")
    print(f"      Total Counties: {stats['total_counties']}")
    print(f"      Total Surviving ZIPs: {stats['total_zips']:,}")
    print(f"      Total Population: {stats['total_pop']:,}")
    print(f"      Total Housing Units: {stats['total_housing']:,}")
    print(f"      Total Demand (sq ft): {stats['total_demand_sqft']:,}")
    print(f"      Overall Avg Income: ${stats['overall_avg_income']:,}")

    # Counties by state
    cursor.execute("""
        SELECT state, COUNT(*) as counties, SUM(surviving_zips) as zips
        FROM layer_3_counties
        GROUP BY state
        ORDER BY counties DESC
    """)
    print(f"\n   Counties by State:")
    for row in cursor.fetchall():
        print(f"      {row['state']}: {row['counties']} counties, {row['zips']} ZIPs")

    # Top 10 by surviving ZIPs
    cursor.execute("""
        SELECT county_name, state, surviving_zips, total_population, total_housing_units
        FROM layer_3_counties
        ORDER BY surviving_zips DESC
        LIMIT 10
    """)
    print(f"\n   Top 10 Counties by Surviving ZIPs:")
    print(f"   {'County':<30} {'State':<5} {'ZIPs':<6} {'Population':<12} {'Housing'}")
    print(f"   {'-'*30} {'-'*5} {'-'*6} {'-'*12} {'-'*10}")
    for row in cursor.fetchall():
        print(f"   {row['county_name']:<30} {row['state']:<5} {row['surviving_zips']:<6} {row['total_population']:>10,} {row['total_housing_units']:>10,}")

    # Top 10 by high-demand units (apartment + townhome + mobile)
    cursor.execute("""
        SELECT county_name, state, high_demand_units, total_apartment, total_townhome, total_mobile_home
        FROM layer_3_counties
        ORDER BY high_demand_units DESC
        LIMIT 10
    """)
    print(f"\n   Top 10 Counties by High-Demand Units (Apt + TH + Mobile):")
    print(f"   {'County':<30} {'State':<5} {'Total':<10} {'Apt':<10} {'TH':<10} {'Mobile'}")
    print(f"   {'-'*30} {'-'*5} {'-'*10} {'-'*10} {'-'*10} {'-'*10}")
    for row in cursor.fetchall():
        print(f"   {row['county_name']:<30} {row['state']:<5} {row['high_demand_units']:>8,} {row['total_apartment']:>8,} {row['total_townhome']:>8,} {row['total_mobile_home']:>8,}")

    # Top 10 by demand sq ft
    cursor.execute("""
        SELECT county_name, state, demand_sqft, total_housing_units,
               ROUND(demand_sqft::numeric / NULLIF(total_housing_units, 0), 1) as sqft_per_unit
        FROM layer_3_counties
        ORDER BY demand_sqft DESC
        LIMIT 10
    """)
    print(f"\n   Top 10 Counties by Demand Potential (sq ft):")
    print(f"   {'County':<30} {'State':<5} {'Demand SqFt':<15} {'Housing':<10} {'SqFt/Unit'}")
    print(f"   {'-'*30} {'-'*5} {'-'*15} {'-'*10} {'-'*10}")
    for row in cursor.fetchall():
        print(f"   {row['county_name']:<30} {row['state']:<5} {row['demand_sqft']:>13,} {row['total_housing_units']:>8,} {row['sqft_per_unit']:>8}")

    # Top 10 by avg income (wealth indicator)
    cursor.execute("""
        SELECT county_name, state, avg_income, avg_renter_pct, total_population
        FROM layer_3_counties
        ORDER BY avg_income DESC
        LIMIT 10
    """)
    print(f"\n   Top 10 Counties by Avg Income (Wealth):")
    print(f"   {'County':<30} {'State':<5} {'Avg Income':<12} {'Renter%':<8} {'Population'}")
    print(f"   {'-'*30} {'-'*5} {'-'*12} {'-'*8} {'-'*12}")
    for row in cursor.fetchall():
        print(f"   {row['county_name']:<30} {row['state']:<5} ${row['avg_income']:>10,} {row['avg_renter_pct']:>6.1f}% {row['total_population']:>10,}")

    # Full county list (sorted by demand_sqft)
    cursor.execute("""
        SELECT county_name, state, surviving_zips, total_population,
               total_housing_units, high_demand_units, demand_sqft, avg_income
        FROM layer_3_counties
        ORDER BY demand_sqft DESC
    """)
    all_counties = cursor.fetchall()

    print(f"\n" + "=" * 70)
    print(f"ALL {len(all_counties)} COUNTIES (Ranked by Demand Potential)")
    print("=" * 70)
    print(f"\n{'#':<4} {'County':<25} {'ST':<3} {'ZIPs':<5} {'Pop':<10} {'Housing':<10} {'Hi-Demand':<10} {'Demand SqFt':<12} {'Avg Inc'}")
    print(f"{'-'*4} {'-'*25} {'-'*3} {'-'*5} {'-'*10} {'-'*10} {'-'*10} {'-'*12} {'-'*10}")

    for i, row in enumerate(all_counties, 1):
        print(f"{i:<4} {row['county_name'][:25]:<25} {row['state']:<3} {row['surviving_zips']:<5} {row['total_population']:>8,} {row['total_housing_units']:>8,} {row['high_demand_units']:>8,} {row['demand_sqft']:>10,} ${row['avg_income']:>8,}")

    conn.close()
    return len(all_counties)

if __name__ == "__main__":
    # Build Layer 3
    counties = build_layer3()

    # Calculate demand potential
    calculate_demand_potential()

    # Verify and rank
    total = verify_and_rank()

    print(f"\n" + "=" * 70)
    print(f"LAYER 3 COMPLETE: {total} counties aggregated")
    print("=" * 70)
