#!/usr/bin/env python3
"""
Stage 0: Geography Filter
=========================
Kill switches:
- SS-S0-01: Urban density > 3,500/sq mi → KILL
- SS-S0-02: MSA central city → KILL
- SS-S0-03: Drive time > 120 min (no tourism) → KILL

For MVP, we'll use population density from zips_master.
MSA core detection uses a heuristic based on city population.
Drive time is estimated using distance to nearest major city.
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import psycopg2
from psycopg2.extras import RealDictCursor
import json
import math

CONN_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Kill switch thresholds
URBAN_DENSITY_THRESHOLD = 3500  # people per sq mi
DRIVE_TIME_THRESHOLD = 120  # minutes

# Major cities for drive time estimation (lat, lon, name)
# These are approximate centroids of major metros
MAJOR_METROS = [
    (38.9072, -77.0369, "Washington DC"),
    (39.9526, -75.1652, "Philadelphia"),
    (40.4406, -79.9959, "Pittsburgh"),
    (39.2904, -76.6122, "Baltimore"),
    (39.1031, -84.5120, "Cincinnati"),
    (40.4173, -82.9071, "Columbus OH"),
    (41.4993, -81.6944, "Cleveland"),
    (37.5407, -77.4360, "Richmond"),
    (36.8529, -75.9780, "Virginia Beach"),
    (38.0293, -78.4767, "Charlottesville"),
]

# WV cities that might be considered "core" urban (population centers)
WV_URBAN_CORES = [
    "Charleston",
    "Huntington",
    "Morgantown",
    "Parkersburg",
    "Wheeling",
]

def haversine_miles(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in miles."""
    R = 3959  # Earth's radius in miles

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c

def estimate_drive_time(lat, lon):
    """
    Estimate drive time to nearest major metro.
    Uses straight-line distance with 1.3x road factor and 45 mph average.
    Returns (minutes, nearest_city_name)
    """
    min_time = float('inf')
    nearest_city = None

    for metro_lat, metro_lon, metro_name in MAJOR_METROS:
        distance = haversine_miles(lat, lon, metro_lat, metro_lon)
        # Assume road distance is 1.3x straight line, average speed 45 mph
        drive_time = (distance * 1.3) / 45 * 60  # minutes

        if drive_time < min_time:
            min_time = drive_time
            nearest_city = metro_name

    return min_time, nearest_city

def main():
    print("=" * 60)
    print("STAGE 0: GEOGRAPHY FILTER")
    print("=" * 60)

    # Get run_id from file
    try:
        with open('current_run.txt', 'r') as f:
            run_id = f.read().strip()
    except:
        print("ERROR: No current_run.txt found. Run setup_screener.py first.")
        return

    print(f"\nrun_id: {run_id}")

    # Connect
    conn = psycopg2.connect(CONN_STRING)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    # Get count of surviving ZIPs at start
    cursor.execute("""
        SELECT COUNT(*) as cnt FROM zip_results
        WHERE run_id = %s AND killed = FALSE
    """, (run_id,))
    start_count = cursor.fetchone()['cnt']
    print(f"Starting ZIPs: {start_count}")

    # Get all surviving ZIPs with their data
    cursor.execute("""
        SELECT zr.zip, zm.density, zm.city, zm.lat, zm.lng, zm.population
        FROM zip_results zr
        JOIN zips_master zm ON zr.zip = zm.zip
        WHERE zr.run_id = %s AND zr.killed = FALSE
    """, (run_id,))
    zips = cursor.fetchall()

    kills = {
        'urban_density': [],
        'msa_core': [],
        'drive_time': []
    }

    print("\n" + "-" * 40)
    print("SS-S0-01: Urban Density Check")
    print(f"Threshold: > {URBAN_DENSITY_THRESHOLD:,} people/sq mi")
    print("-" * 40)

    for z in zips:
        density = z['density']
        if density and density > URBAN_DENSITY_THRESHOLD:
            kills['urban_density'].append({
                'zip': z['zip'],
                'city': z['city'],
                'value': float(density)
            })
            # Execute kill
            cursor.execute("""
                SELECT kill_zip(%s, %s, 0, 'SS-S0-01', %s, %s, %s)
            """, (
                run_id,
                z['zip'],
                f"Urban density {density:.0f}/sq mi exceeds {URBAN_DENSITY_THRESHOLD}",
                URBAN_DENSITY_THRESHOLD,
                float(density)
            ))
            # Update metrics
            cursor.execute("""
                UPDATE zip_results
                SET metrics = metrics || %s
                WHERE run_id = %s AND zip = %s
            """, (
                json.dumps({'density': float(density)}),
                run_id,
                z['zip']
            ))

    conn.commit()
    print(f"Killed: {len(kills['urban_density'])} ZIPs")
    if kills['urban_density'][:5]:
        print("Examples:")
        for k in kills['urban_density'][:5]:
            print(f"  {k['zip']} - {k['city']} ({k['value']:.0f}/sq mi)")

    # Refresh surviving ZIPs
    cursor.execute("""
        SELECT zr.zip, zm.density, zm.city, zm.lat, zm.lng, zm.population
        FROM zip_results zr
        JOIN zips_master zm ON zr.zip = zm.zip
        WHERE zr.run_id = %s AND zr.killed = FALSE
    """, (run_id,))
    zips = cursor.fetchall()

    print("\n" + "-" * 40)
    print("SS-S0-02: MSA Core Check")
    print("Checking for central city urban cores")
    print("-" * 40)

    # For WV, we'll flag ZIPs in major city cores with high population
    # This is a heuristic - real implementation would use Census MSA data
    for z in zips:
        city = z['city']
        population = z['population'] or 0
        density = z['density'] or 0

        # Check if this is a core urban ZIP in a WV city
        # Criteria: In a known urban city AND (high population OR high density)
        is_core = False
        if city in WV_URBAN_CORES:
            # Only flag the densest/most populated ZIPs as "core"
            if population > 30000 or density > 2000:
                is_core = True

        if is_core:
            kills['msa_core'].append({
                'zip': z['zip'],
                'city': city,
                'population': population,
                'density': float(density) if density else 0
            })
            cursor.execute("""
                SELECT kill_zip(%s, %s, 0, 'SS-S0-02', %s, NULL, %s)
            """, (
                run_id,
                z['zip'],
                f"MSA core: {city} (pop {population:,}, density {density:.0f})",
                population
            ))
            cursor.execute("""
                UPDATE zip_results
                SET metrics = metrics || %s
                WHERE run_id = %s AND zip = %s
            """, (
                json.dumps({'msa_core': True, 'core_city': city}),
                run_id,
                z['zip']
            ))

    conn.commit()
    print(f"Killed: {len(kills['msa_core'])} ZIPs")
    if kills['msa_core']:
        print("Examples:")
        for k in kills['msa_core'][:5]:
            print(f"  {k['zip']} - {k['city']} (pop: {k['population']:,})")

    # Refresh surviving ZIPs
    cursor.execute("""
        SELECT zr.zip, zm.density, zm.city, zm.lat, zm.lng, zm.population
        FROM zip_results zr
        JOIN zips_master zm ON zr.zip = zm.zip
        WHERE zr.run_id = %s AND zr.killed = FALSE
    """, (run_id,))
    zips = cursor.fetchall()

    print("\n" + "-" * 40)
    print("SS-S0-03: Drive Time Check")
    print(f"Threshold: > {DRIVE_TIME_THRESHOLD} min to nearest metro")
    print("-" * 40)

    for z in zips:
        if z['lat'] and z['lng']:
            drive_time, nearest_city = estimate_drive_time(float(z['lat']), float(z['lng']))

            # Update metrics for all ZIPs
            cursor.execute("""
                UPDATE zip_results
                SET metrics = metrics || %s
                WHERE run_id = %s AND zip = %s
            """, (
                json.dumps({
                    'drive_time_min': round(drive_time, 1),
                    'nearest_metro': nearest_city
                }),
                run_id,
                z['zip']
            ))

            if drive_time > DRIVE_TIME_THRESHOLD:
                # For now, kill all > 120 min
                # TODO: Add tourism flag exception
                kills['drive_time'].append({
                    'zip': z['zip'],
                    'city': z['city'],
                    'drive_time': round(drive_time, 1),
                    'nearest': nearest_city
                })
                cursor.execute("""
                    SELECT kill_zip(%s, %s, 0, 'SS-S0-03', %s, %s, %s)
                """, (
                    run_id,
                    z['zip'],
                    f"Drive time {drive_time:.0f} min to {nearest_city} exceeds {DRIVE_TIME_THRESHOLD}",
                    DRIVE_TIME_THRESHOLD,
                    round(drive_time, 1)
                ))

    conn.commit()
    print(f"Killed: {len(kills['drive_time'])} ZIPs")
    if kills['drive_time'][:5]:
        print("Examples:")
        for k in kills['drive_time'][:5]:
            print(f"  {k['zip']} - {k['city']} ({k['drive_time']} min to {k['nearest']})")

    # Final count
    cursor.execute("""
        SELECT COUNT(*) as cnt FROM zip_results
        WHERE run_id = %s AND killed = FALSE
    """, (run_id,))
    end_count = cursor.fetchone()['cnt']

    total_killed = start_count - end_count

    # Log stage completion
    cursor.execute("""
        SELECT log_stage(%s, 0, %s, %s)
    """, (run_id, start_count, end_count))

    # Update all surviving ZIPs to stage_reached = 0
    cursor.execute("""
        UPDATE zip_results
        SET stage_reached = 0
        WHERE run_id = %s AND killed = FALSE
    """, (run_id,))

    conn.commit()

    # Print summary
    print("\n")
    print("=" * 60)
    print("STAGE 0 COMPLETE")
    print("=" * 60)
    print(f"""
Input:     {start_count} ZIPs
Killed:    {total_killed} ZIPs
Surviving: {end_count} ZIPs

Kill breakdown:
  - Urban density (>{URBAN_DENSITY_THRESHOLD}/sq mi): {len(kills['urban_density'])}
  - MSA core:                        {len(kills['msa_core'])}
  - Drive time (>{DRIVE_TIME_THRESHOLD} min):         {len(kills['drive_time'])}
""")

    # Show some survivors
    cursor.execute("""
        SELECT zr.zip, zm.city, zm.county_name, zm.population, zm.density,
               zr.metrics->>'drive_time_min' as drive_time
        FROM zip_results zr
        JOIN zips_master zm ON zr.zip = zm.zip
        WHERE zr.run_id = %s AND zr.killed = FALSE
        ORDER BY zm.population DESC NULLS LAST
        LIMIT 10
    """, (run_id,))
    survivors = cursor.fetchall()

    print("Top 10 surviving ZIPs by population:")
    print("-" * 60)
    for s in survivors:
        pop = f"{s['population']:,}" if s['population'] else "N/A"
        density = f"{s['density']:.0f}" if s['density'] else "N/A"
        dt = s['drive_time'] or "N/A"
        print(f"  {s['zip']} - {s['city']}, {s['county_name']}")
        print(f"          pop: {pop}, density: {density}/sq mi, drive: {dt} min")

    print("\n" + "=" * 60)
    print("Ready for Stage 1.")
    print("=" * 60)

    conn.close()

if __name__ == "__main__":
    main()
