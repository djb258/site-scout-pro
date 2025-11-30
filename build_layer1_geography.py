"""
Layer 1 - Geography Builder
Creates 120-mile radius zone around Bedford, PA and populates layer_1_geography.

Kill Switches:
- distance > 120 miles → KILL
- population_density > 3,500/sq mi → KILL (too urban)

Expected: ~800-950 ZIPs within 120 miles in PA, WV, MD, VA
"""

import psycopg2
from psycopg2.extras import RealDictCursor

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Bedford, PA coordinates
CENTER_ZIP = "15522"
CENTER_LAT = 40.0186
CENTER_LON = -78.5039
RADIUS_MILES = 120
TARGET_STATES = ['PA', 'WV', 'MD', 'VA']
ZONE_NAME = "Bedford PA 120mi"

# Kill switch thresholds
MAX_DENSITY = 3500  # persons per square mile - above this is too urban

def get_connection():
    return psycopg2.connect(CONNECTION_STRING)

def create_target_zone():
    """Create or update the target zone."""
    conn = get_connection()
    cursor = conn.cursor()

    print("=" * 70)
    print("STEP 1: CREATE TARGET ZONE")
    print("=" * 70)

    # Check if zone already exists
    cursor.execute("SELECT zone_id FROM target_zones WHERE center_zip = %s", (CENTER_ZIP,))
    existing = cursor.fetchone()

    if existing:
        zone_id = existing[0]
        print(f"   Zone already exists with zone_id: {zone_id}")
        # Update it
        cursor.execute("""
            UPDATE target_zones
            SET zone_name = %s, center_lat = %s, center_lon = %s, radius_miles = %s, states = %s
            WHERE zone_id = %s
        """, (ZONE_NAME, CENTER_LAT, CENTER_LON, RADIUS_MILES, TARGET_STATES, zone_id))
        print(f"   Updated zone: {ZONE_NAME}")
    else:
        # Insert new zone
        cursor.execute("""
            INSERT INTO target_zones (zone_name, center_zip, center_lat, center_lon, radius_miles, states)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING zone_id
        """, (ZONE_NAME, CENTER_ZIP, CENTER_LAT, CENTER_LON, RADIUS_MILES, TARGET_STATES))
        zone_id = cursor.fetchone()[0]
        print(f"   Created zone: {ZONE_NAME}")
        print(f"   Zone ID: {zone_id}")

    conn.commit()
    conn.close()

    print(f"\n   Center: {CENTER_ZIP} ({CENTER_LAT}, {CENTER_LON})")
    print(f"   Radius: {RADIUS_MILES} miles")
    print(f"   States: {', '.join(TARGET_STATES)}")

    return zone_id

def verify_haversine():
    """Verify the haversine function is working correctly."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("STEP 2: VERIFY HAVERSINE FUNCTION")
    print("=" * 70)

    # Test distances to known cities
    test_cases = [
        ("Pittsburgh, PA", 40.4406, -79.9959),
        ("Washington, DC", 38.9072, -77.0369),
        ("Baltimore, MD", 39.2904, -76.6122),
        ("Harrisburg, PA", 40.2732, -76.8867),
        ("Charleston, WV", 38.3498, -81.6326),
        ("Richmond, VA", 37.5407, -77.4360),
    ]

    print(f"\n   Distance from Bedford PA ({CENTER_LAT}, {CENTER_LON}):")
    print(f"   {'City':<25} {'Distance (mi)':<15} {'Within 120mi?'}")
    print(f"   {'-'*25} {'-'*15} {'-'*15}")

    for city, lat, lon in test_cases:
        cursor.execute("""
            SELECT haversine_miles(%s, %s, %s, %s)
        """, (CENTER_LAT, CENTER_LON, lat, lon))
        distance = float(cursor.fetchone()[0])
        within = "YES" if distance <= RADIUS_MILES else "NO"
        print(f"   {city:<25} {distance:>10.1f} mi   {within}")

    conn.close()

def query_zips_in_radius():
    """Query all ZIPs within 120 miles in target states."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("STEP 3: QUERY ZIPS WITHIN RADIUS")
    print("=" * 70)

    # First, let's see the raw count without state filter
    cursor.execute("""
        SELECT COUNT(*) as cnt
        FROM zips_master
        WHERE haversine_miles(%s, %s, lat, lng) <= %s
    """, (CENTER_LAT, CENTER_LON, RADIUS_MILES))
    total_all_states = cursor.fetchone()['cnt']
    print(f"\n   Total ZIPs within {RADIUS_MILES} miles (all states): {total_all_states:,}")

    # Now with state filter
    cursor.execute("""
        SELECT COUNT(*) as cnt
        FROM zips_master
        WHERE haversine_miles(%s, %s, lat, lng) <= %s
        AND state = ANY(%s)
    """, (CENTER_LAT, CENTER_LON, RADIUS_MILES, TARGET_STATES))
    total_filtered = cursor.fetchone()['cnt']
    print(f"   Total ZIPs within {RADIUS_MILES} miles (PA, WV, MD, VA only): {total_filtered:,}")

    # Count by state
    cursor.execute("""
        SELECT state, COUNT(*) as cnt
        FROM zips_master
        WHERE haversine_miles(%s, %s, lat, lng) <= %s
        AND state = ANY(%s)
        GROUP BY state
        ORDER BY cnt DESC
    """, (CENTER_LAT, CENTER_LON, RADIUS_MILES, TARGET_STATES))

    print(f"\n   By State:")
    for row in cursor.fetchall():
        print(f"      {row['state']}: {row['cnt']:,} ZIPs")

    # Count by distance band
    cursor.execute("""
        SELECT
            CASE
                WHEN haversine_miles(%s, %s, lat, lng) <= 30 THEN '0-30'
                WHEN haversine_miles(%s, %s, lat, lng) <= 60 THEN '31-60'
                WHEN haversine_miles(%s, %s, lat, lng) <= 90 THEN '61-90'
                ELSE '91-120'
            END as distance_band,
            COUNT(*) as cnt
        FROM zips_master
        WHERE haversine_miles(%s, %s, lat, lng) <= %s
        AND state = ANY(%s)
        GROUP BY distance_band
        ORDER BY distance_band
    """, (CENTER_LAT, CENTER_LON, CENTER_LAT, CENTER_LON, CENTER_LAT, CENTER_LON,
          CENTER_LAT, CENTER_LON, RADIUS_MILES, TARGET_STATES))

    print(f"\n   By Distance Band:")
    for row in cursor.fetchall():
        print(f"      {row['distance_band']} miles: {row['cnt']:,} ZIPs")

    conn.close()
    return total_filtered

def check_for_issues():
    """Debug potential issues if count is too high."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("STEP 4: DIAGNOSTIC CHECKS")
    print("=" * 70)

    # Check for ZIPs with potentially bad coordinates
    cursor.execute("""
        SELECT COUNT(*) as cnt
        FROM zips_master
        WHERE lat IS NULL OR lng IS NULL
    """)
    null_coords = cursor.fetchone()['cnt']
    print(f"\n   ZIPs with NULL coordinates: {null_coords:,}")

    # Check for ZIPs with coordinates outside continental US
    cursor.execute("""
        SELECT COUNT(*) as cnt
        FROM zips_master
        WHERE lat < 24 OR lat > 50 OR lng < -125 OR lng > -66
    """)
    outside_conus = cursor.fetchone()['cnt']
    print(f"   ZIPs with coords outside CONUS: {outside_conus:,}")

    # Sample some ZIPs at the edge of our radius
    cursor.execute("""
        SELECT zip, city, state, lat, lng,
               haversine_miles(%s, %s, lat, lng) as distance
        FROM zips_master
        WHERE haversine_miles(%s, %s, lat, lng) BETWEEN 110 AND 120
        AND state = ANY(%s)
        ORDER BY distance DESC
        LIMIT 10
    """, (CENTER_LAT, CENTER_LON, CENTER_LAT, CENTER_LON, TARGET_STATES))

    print(f"\n   Sample ZIPs at edge (110-120 miles):")
    print(f"   {'ZIP':<8} {'City':<20} {'State':<5} {'Distance'}")
    print(f"   {'-'*8} {'-'*20} {'-'*5} {'-'*10}")
    for row in cursor.fetchall():
        print(f"   {row['zip']:<8} {row['city'][:20]:<20} {row['state']:<5} {float(row['distance']):.1f} mi")

    conn.close()

def populate_layer1_geography(zone_id):
    """Populate layer_1_geography with ZIPs in radius, applying density kill switch."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("STEP 5: POPULATE LAYER_1_GEOGRAPHY")
    print("=" * 70)
    print(f"\n   Kill Switch: density > {MAX_DENSITY:,}/sq mi -> KILL (too urban)")

    # Clear existing data for this zone
    cursor.execute("DELETE FROM layer_1_geography WHERE zone_id = %s", (zone_id,))
    deleted = cursor.rowcount
    if deleted > 0:
        print(f"   Cleared {deleted:,} existing rows for zone {zone_id}")

    # Get all ZIPs within radius with their density
    cursor.execute("""
        SELECT
            z.zip,
            z.state,
            z.county_fips,
            z.county_name,
            z.lat as centroid_lat,
            z.lng as centroid_lon,
            z.density,
            ROUND(haversine_miles(%s, %s, z.lat, z.lng)::numeric, 2) as distance_miles
        FROM zips_master z
        WHERE haversine_miles(%s, %s, z.lat, z.lng) <= %s
        AND z.state = ANY(%s)
    """, (CENTER_LAT, CENTER_LON, CENTER_LAT, CENTER_LON, RADIUS_MILES, TARGET_STATES))

    zips = cursor.fetchall()
    print(f"   Found {len(zips):,} ZIPs within {RADIUS_MILES} miles")

    # Track stats
    passed_count = 0
    killed_count = 0

    # Insert with kill switch logic
    for z in zips:
        density = z['density'] or 0

        if density > MAX_DENSITY:
            passed = False
            kill_reason = f"Density {density:,.0f}/sq mi > {MAX_DENSITY:,}"
            killed_count += 1
        else:
            passed = True
            kill_reason = None
            passed_count += 1

        cursor.execute("""
            INSERT INTO layer_1_geography (zip, zone_id, state, county_fips, county_name,
                                           centroid_lat, centroid_lon, distance_miles, passed, kill_reason)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (zip) DO UPDATE SET
                zone_id = EXCLUDED.zone_id,
                state = EXCLUDED.state,
                county_fips = EXCLUDED.county_fips,
                county_name = EXCLUDED.county_name,
                centroid_lat = EXCLUDED.centroid_lat,
                centroid_lon = EXCLUDED.centroid_lon,
                distance_miles = EXCLUDED.distance_miles,
                passed = EXCLUDED.passed,
                kill_reason = EXCLUDED.kill_reason
        """, (z['zip'], zone_id, z['state'], z['county_fips'], z['county_name'],
              z['centroid_lat'], z['centroid_lon'], z['distance_miles'], passed, kill_reason))

    conn.commit()

    print(f"\n   Results:")
    print(f"      Total ZIPs: {len(zips):,}")
    print(f"      Passed: {passed_count:,}")
    print(f"      Killed (too urban): {killed_count:,}")

    conn.close()
    return passed_count

def final_verification():
    """Final verification of layer_1_geography."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("FINAL VERIFICATION")
    print("=" * 70)

    # Total count with pass/fail breakdown
    cursor.execute("""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN NOT passed THEN 1 ELSE 0 END) as killed
        FROM layer_1_geography
    """)
    row = cursor.fetchone()
    total = row['total']
    passed = row['passed']
    killed = row['killed']
    print(f"\n   Total ZIPs: {total:,}")
    print(f"   Passed (within density threshold): {passed:,}")
    print(f"   Killed (too urban): {killed:,}")

    # By state
    cursor.execute("""
        SELECT state, COUNT(*) as cnt
        FROM layer_1_geography
        GROUP BY state
        ORDER BY cnt DESC
    """)
    print(f"\n   By State:")
    for row in cursor.fetchall():
        print(f"      {row['state']}: {row['cnt']:,} ZIPs")

    # By distance band
    cursor.execute("""
        SELECT
            CASE
                WHEN distance_miles <= 30 THEN '0-30 mi'
                WHEN distance_miles <= 60 THEN '31-60 mi'
                WHEN distance_miles <= 90 THEN '61-90 mi'
                ELSE '91-120 mi'
            END as band,
            COUNT(*) as cnt
        FROM layer_1_geography
        GROUP BY band
        ORDER BY band
    """)
    print(f"\n   By Distance Band:")
    for row in cursor.fetchall():
        print(f"      {row['band']}: {row['cnt']:,} ZIPs")

    # Unique counties
    cursor.execute("""
        SELECT COUNT(DISTINCT county_fips) as cnt
        FROM layer_1_geography
    """)
    counties = cursor.fetchone()['cnt']
    print(f"\n   Unique Counties: {counties}")

    # Sample closest ZIPs
    cursor.execute("""
        SELECT l.zip, z.city, l.state, l.distance_miles
        FROM layer_1_geography l
        JOIN zips_master z ON l.zip = z.zip
        ORDER BY l.distance_miles
        LIMIT 5
    """)
    print(f"\n   5 Closest ZIPs:")
    for row in cursor.fetchall():
        print(f"      {row['zip']} - {row['city']}, {row['state']} ({float(row['distance_miles']):.1f} mi)")

    # Sample furthest ZIPs
    cursor.execute("""
        SELECT l.zip, z.city, l.state, l.distance_miles
        FROM layer_1_geography l
        JOIN zips_master z ON l.zip = z.zip
        ORDER BY l.distance_miles DESC
        LIMIT 5
    """)
    print(f"\n   5 Furthest ZIPs:")
    for row in cursor.fetchall():
        print(f"      {row['zip']} - {row['city']}, {row['state']} ({float(row['distance_miles']):.1f} mi)")

    conn.close()

    # Assessment
    print("\n" + "=" * 70)
    print(f"LAYER 1 COMPLETE")
    print(f"   Total ZIPs: {total:,}")
    print(f"   Passed (survivng to Layer 2): {passed:,}")
    print(f"   Killed (too urban): {killed:,}")
    print("=" * 70)

    return total

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("LAYER 1 - GEOGRAPHY BUILDER")
    print(f"Bedford, PA ({CENTER_LAT}, {CENTER_LON}) - {RADIUS_MILES} mile radius")
    print("=" * 70)

    # Step 1: Create target zone
    zone_id = create_target_zone()

    # Step 2: Verify haversine
    verify_haversine()

    # Step 3: Query and count
    total = query_zips_in_radius()

    # Step 4: Diagnostic checks
    check_for_issues()

    # Step 5: Populate layer_1_geography
    populate_layer1_geography(zone_id)

    # Final verification
    final_verification()
