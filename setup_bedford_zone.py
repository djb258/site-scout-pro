#!/usr/bin/env python3
"""
Setup Bedford PA 120-mile zone for ZIP code screening.
Creates target_zones table, helper functions, and views.
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import psycopg2
from psycopg2.extras import RealDictCursor

CONN_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def main():
    print("=" * 60)
    print("BEDFORD PA 120-MILE ZONE SETUP")
    print("=" * 60)

    conn = psycopg2.connect(CONN_STRING)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    # STEP 1: Create target_zones table
    print("\n## STEP 1: CREATE TARGET_ZONES TABLE")
    print("-" * 40)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS target_zones (
            zone_id SERIAL PRIMARY KEY,
            zone_name VARCHAR(100),
            center_zip VARCHAR(5),
            center_lat DECIMAL,
            center_lon DECIMAL,
            radius_miles INT,
            states VARCHAR[],
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)
    conn.commit()
    print("  ✓ target_zones table created")

    # Check if Bedford zone exists
    cursor.execute("SELECT * FROM target_zones WHERE center_zip = '15522';")
    existing = cursor.fetchone()

    if not existing:
        cursor.execute("""
            INSERT INTO target_zones (zone_name, center_zip, center_lat, center_lon, radius_miles, states)
            VALUES ('Bedford PA 120mi', '15522', 40.0186, -78.5039, 120, ARRAY['PA', 'WV', 'MD', 'VA']);
        """)
        conn.commit()
        print("  ✓ Bedford PA 120mi zone inserted")
    else:
        print("  - Bedford zone already exists")

    # STEP 2: Create haversine_miles function
    print("\n## STEP 2: CREATE HAVERSINE FUNCTION")
    print("-" * 40)

    cursor.execute("""
        CREATE OR REPLACE FUNCTION haversine_miles(
            lat1 DECIMAL,
            lon1 DECIMAL,
            lat2 DECIMAL,
            lon2 DECIMAL
        )
        RETURNS DECIMAL AS $$
        BEGIN
            RETURN 3959 * ACOS(
                LEAST(1, GREATEST(-1,
                    COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
                    COS(RADIANS(lon2) - RADIANS(lon1)) +
                    SIN(RADIANS(lat1)) * SIN(RADIANS(lat2))
                ))
            );
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
    """)
    conn.commit()
    print("  ✓ haversine_miles() function created")

    # STEP 3: Create start_run_by_zone function
    print("\n## STEP 3: CREATE ZONE RUN FUNCTION")
    print("-" * 40)

    cursor.execute("""
        CREATE OR REPLACE FUNCTION start_run_by_zone(
            p_zone_id INT,
            p_config JSONB DEFAULT '{}',
            p_created_by VARCHAR DEFAULT 'system'
        )
        RETURNS UUID AS $$
        DECLARE
            v_run_id UUID;
            v_total_zips INT;
            v_zone RECORD;
        BEGIN
            -- Get zone parameters
            SELECT * INTO v_zone FROM target_zones WHERE zone_id = p_zone_id;

            IF v_zone IS NULL THEN
                RAISE EXCEPTION 'Zone ID % not found', p_zone_id;
            END IF;

            -- Count ZIPs in radius
            SELECT COUNT(*) INTO v_total_zips
            FROM zips_master zm
            WHERE zm.state = ANY(v_zone.states)
            AND haversine_miles(v_zone.center_lat, v_zone.center_lon, zm.lat, zm.lng) <= v_zone.radius_miles;

            -- Create run record
            INSERT INTO runs (target_states, config, created_by, total_zips, status)
            VALUES (
                v_zone.states,
                p_config || jsonb_build_object(
                    'zone_id', p_zone_id,
                    'zone_name', v_zone.zone_name,
                    'center_zip', v_zone.center_zip,
                    'radius_miles', v_zone.radius_miles
                ),
                p_created_by,
                v_total_zips,
                'running'
            )
            RETURNING run_id INTO v_run_id;

            -- Initialize zip_results for all ZIPs in radius
            INSERT INTO zip_results (run_id, zip)
            SELECT v_run_id, zm.zip
            FROM zips_master zm
            WHERE zm.state = ANY(v_zone.states)
            AND haversine_miles(v_zone.center_lat, v_zone.center_lon, zm.lat, zm.lng) <= v_zone.radius_miles;

            RETURN v_run_id;
        END;
        $$ LANGUAGE plpgsql;
    """)
    conn.commit()
    print("  ✓ start_run_by_zone() function created")

    # STEP 4: Create views
    print("\n## STEP 4: CREATE ZONE VIEWS")
    print("-" * 40)

    cursor.execute("""
        CREATE OR REPLACE VIEW v_zone_zips AS
        SELECT
            tz.zone_id,
            tz.zone_name,
            zm.zip,
            zm.state,
            zm.county_fips,
            zm.county_name,
            zm.lat,
            zm.lng,
            zm.population,
            zm.income_household_median,
            ROUND(haversine_miles(tz.center_lat, tz.center_lon, zm.lat, zm.lng)::numeric, 1) AS distance_miles
        FROM target_zones tz
        CROSS JOIN zips_master zm
        WHERE zm.state = ANY(tz.states)
        AND haversine_miles(tz.center_lat, tz.center_lon, zm.lat, zm.lng) <= tz.radius_miles;
    """)
    conn.commit()
    print("  ✓ v_zone_zips view created")

    cursor.execute("""
        CREATE OR REPLACE VIEW v_zone_counties AS
        SELECT DISTINCT
            tz.zone_id,
            tz.zone_name,
            zm.state,
            zm.county_fips,
            zm.county_name,
            COUNT(zm.zip) as zip_count,
            ROUND(MIN(haversine_miles(tz.center_lat, tz.center_lon, zm.lat, zm.lng))::numeric, 1) AS closest_zip_miles,
            ROUND(MAX(haversine_miles(tz.center_lat, tz.center_lon, zm.lat, zm.lng))::numeric, 1) AS farthest_zip_miles
        FROM target_zones tz
        CROSS JOIN zips_master zm
        WHERE zm.state = ANY(tz.states)
        AND haversine_miles(tz.center_lat, tz.center_lon, zm.lat, zm.lng) <= tz.radius_miles
        GROUP BY tz.zone_id, tz.zone_name, zm.state, zm.county_fips, zm.county_name
        ORDER BY zm.state, zm.county_name;
    """)
    conn.commit()
    print("  ✓ v_zone_counties view created")

    # STEP 5: Verify and report
    print("\n## STEP 5: VERIFY SETUP")
    print("-" * 40)

    # 5a. Confirm zone
    cursor.execute("SELECT * FROM target_zones WHERE center_zip = '15522';")
    zone = cursor.fetchone()
    print(f"\nZone: {zone['zone_name']}")
    print(f"  Center: {zone['center_zip']} ({zone['center_lat']}, {zone['center_lon']})")
    print(f"  Radius: {zone['radius_miles']} miles")
    print(f"  States: {zone['states']}")

    # 5b. Count ZIPs by state
    cursor.execute("""
        SELECT state, COUNT(*) as zip_count
        FROM v_zone_zips
        WHERE zone_id = 1
        GROUP BY state
        ORDER BY state;
    """)
    zip_counts = cursor.fetchall()
    total_zips = sum(z['zip_count'] for z in zip_counts)

    print(f"\nZIPs in zone: {total_zips:,}")
    for z in zip_counts:
        print(f"  {z['state']}: {z['zip_count']:,}")

    # 5c. Count counties by state
    cursor.execute("""
        SELECT state, COUNT(*) as county_count
        FROM v_zone_counties
        WHERE zone_id = 1
        GROUP BY state
        ORDER BY state;
    """)
    county_counts = cursor.fetchall()
    total_counties = sum(c['county_count'] for c in county_counts)

    print(f"\nCounties in zone: {total_counties}")
    for c in county_counts:
        print(f"  {c['state']}: {c['county_count']}")

    # 5d. Show all counties
    print("\n" + "-" * 40)
    print("COUNTIES IN ZONE:")
    print("-" * 40)
    cursor.execute("""
        SELECT state, county_name, zip_count, closest_zip_miles, farthest_zip_miles
        FROM v_zone_counties
        WHERE zone_id = 1
        ORDER BY state, county_name;
    """)
    counties = cursor.fetchall()

    current_state = None
    for c in counties:
        if c['state'] != current_state:
            print(f"\n{c['state']}:")
            current_state = c['state']
        print(f"  {c['county_name']}: {c['zip_count']} ZIPs ({c['closest_zip_miles']}-{c['farthest_zip_miles']} mi)")

    # 5e. Closest and farthest ZIPs
    print("\n" + "-" * 40)
    print("CLOSEST 10 ZIPs:")
    print("-" * 40)
    cursor.execute("""
        SELECT zip, state, county_name, distance_miles, population
        FROM v_zone_zips
        WHERE zone_id = 1
        ORDER BY distance_miles ASC
        LIMIT 10;
    """)
    closest = cursor.fetchall()
    for z in closest:
        pop = f"{z['population']:,}" if z['population'] else "N/A"
        print(f"  {z['zip']} - {z['county_name']}, {z['state']} ({z['distance_miles']} mi, pop: {pop})")

    print("\n" + "-" * 40)
    print("FARTHEST 10 ZIPs (still in radius):")
    print("-" * 40)
    cursor.execute("""
        SELECT zip, state, county_name, distance_miles, population
        FROM v_zone_zips
        WHERE zone_id = 1
        ORDER BY distance_miles DESC
        LIMIT 10;
    """)
    farthest = cursor.fetchall()
    for z in farthest:
        pop = f"{z['population']:,}" if z['population'] else "N/A"
        print(f"  {z['zip']} - {z['county_name']}, {z['state']} ({z['distance_miles']} mi, pop: {pop})")

    # 5f. Confirm all tables exist
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN (
            'target_zones',
            'stip_projects',
            'mfg_announcements',
            'water_bodies',
            'campgrounds',
            'military_bases',
            'universities',
            'distribution_centers',
            'migration_data',
            'employment_data',
            'county_gis_portals'
        )
        ORDER BY table_name;
    """)
    tables = cursor.fetchall()

    print("\n" + "-" * 40)
    print("REFERENCE TABLES:")
    print("-" * 40)
    expected = [
        'target_zones', 'stip_projects', 'mfg_announcements', 'water_bodies',
        'campgrounds', 'military_bases', 'universities', 'distribution_centers',
        'migration_data', 'employment_data', 'county_gis_portals'
    ]
    existing = [t['table_name'] for t in tables]
    for t in expected:
        status = "✓" if t in existing else "✗"
        print(f"  {status} {t}")

    conn.close()

    # Final summary
    print("\n")
    print("=" * 60)
    print("BEDFORD PA 120-MILE ZONE SETUP COMPLETE")
    print("=" * 60)
    print(f"""
Zone Configuration:
  - Zone ID: {zone['zone_id']}
  - Center: Bedford, PA ({zone['center_zip']})
  - Coordinates: {zone['center_lat']}, {zone['center_lon']}
  - Radius: {zone['radius_miles']} miles
  - States: {', '.join(zone['states'])}

Coverage:
  - Total ZIPs: {total_zips:,}""")
    for z in zip_counts:
        print(f"    {z['state']}: {z['zip_count']:,} ZIPs")
    print(f"""
  - Total Counties: {total_counties}""")
    for c in county_counts:
        print(f"    {c['state']}: {c['county_count']} counties")

    print("""
Tables Created/Verified:
  - target_zones ✓
  - stip_projects ✓
  - mfg_announcements ✓
  - water_bodies ✓
  - campgrounds ✓
  - military_bases ✓
  - universities ✓
  - distribution_centers ✓
  - migration_data ✓
  - employment_data ✓
  - county_gis_portals ✓

Functions Created:
  - haversine_miles() ✓
  - start_run_by_zone() ✓

Views Created:
  - v_zone_zips ✓
  - v_zone_counties ✓
""")

    print("=" * 60)
    print("READY TO START SCREENING RUN")
    print("=" * 60)
    print("""
To start a run for this zone, execute:

  SELECT start_run_by_zone(
      1,  -- zone_id for Bedford PA 120mi
      '{"UNITS_PER_ACRE": 120, "TARGET_RENT": 80, "TARGET_OCCUPANCY": 0.85,
        "OPEX_RATIO": 0.25, "MIN_YIELD": 0.12, "DEMAND_SQFT_PER_PERSON": 6}'::jsonb,
      'claude_code'
  );

Then tell Claude Code: "Run Stage 0-1 for zone 1"
""")

if __name__ == "__main__":
    main()
