"""
County Deep Dive - Storage Facility Analysis
When you've identified a target county, this script:
1. Fetches ALL storage facilities in that county (fresh Google search)
2. Gets phone numbers for each
3. Exports call list for AI caller
4. Imports results and generates competitive analysis

Usage:
    python build_county_deep_dive.py --county "Bedford" --state PA
    python build_county_deep_dive.py --county-fips 42009
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import json
import csv
import time
import math
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyAWS3lz7Tk-61z82gMN-Ck1-nxTzUVxjU4")

# Google Places API endpoints
PLACES_TEXT_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

# Rate limiting
REQUESTS_PER_SECOND = 10
LAST_REQUEST_TIME = 0


def get_connection():
    return psycopg2.connect(CONNECTION_STRING)


def rate_limit():
    """Enforce rate limiting."""
    global LAST_REQUEST_TIME
    current_time = time.time()
    elapsed = current_time - LAST_REQUEST_TIME
    min_interval = 1.0 / REQUESTS_PER_SECOND

    if elapsed < min_interval:
        time.sleep(min_interval - elapsed)

    LAST_REQUEST_TIME = time.time()


def get_county_info(county_name: str = None, state: str = None, county_fips: str = None) -> Optional[Dict]:
    """Get county information from database."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    if county_fips:
        cursor.execute("""
            SELECT county_fips, county_name, state, total_population, surviving_zips
            FROM layer_3_counties
            WHERE county_fips = %s
        """, (county_fips,))
    else:
        cursor.execute("""
            SELECT county_fips, county_name, state, total_population, surviving_zips
            FROM layer_3_counties
            WHERE LOWER(county_name) = LOWER(%s) AND state = %s
        """, (county_name, state))

    result = cursor.fetchone()
    conn.close()
    return dict(result) if result else None


def get_county_bounds(county_fips: str) -> Tuple[float, float, float, float]:
    """Get bounding box for county from ZIP centroids."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("""
        SELECT
            MIN(centroid_lat) as min_lat,
            MAX(centroid_lat) as max_lat,
            MIN(centroid_lon) as min_lon,
            MAX(centroid_lon) as max_lon,
            AVG(centroid_lat) as center_lat,
            AVG(centroid_lon) as center_lon
        FROM layer_1_geography
        WHERE county_fips = %s
    """, (county_fips,))

    result = cursor.fetchone()
    conn.close()

    return result


def get_zip_codes_in_county(county_fips: str) -> List[Dict]:
    """Get all ZIP codes in a county."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("""
        SELECT zip, centroid_lat, centroid_lon
        FROM layer_1_geography
        WHERE county_fips = %s
    """, (county_fips,))

    results = cursor.fetchall()
    conn.close()
    return [dict(r) for r in results]


def search_storage_in_area(lat: float, lon: float, radius_meters: int = 20000,
                           search_name: str = "self storage") -> List[Dict]:
    """Search for storage facilities in an area using Google Places."""
    facilities = []
    seen_place_ids = set()

    rate_limit()

    # Try text search first (better for specific queries)
    params = {
        "query": search_name,
        "location": f"{lat},{lon}",
        "radius": radius_meters,
        "key": GOOGLE_API_KEY
    }

    try:
        response = requests.get(PLACES_TEXT_URL, params=params, timeout=30)

        if response.status_code == 200:
            data = response.json()

            if data.get("status") == "OK":
                for place in data.get("results", []):
                    place_id = place.get("place_id")
                    if place_id and place_id not in seen_place_ids:
                        seen_place_ids.add(place_id)
                        facilities.append({
                            "place_id": place_id,
                            "name": place.get("name"),
                            "address": place.get("formatted_address"),
                            "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                            "lon": place.get("geometry", {}).get("location", {}).get("lng"),
                            "rating": place.get("rating"),
                            "review_count": place.get("user_ratings_total", 0),
                            "types": place.get("types", []),
                        })

                # Handle pagination
                next_page_token = data.get("next_page_token")
                page = 1

                while next_page_token and page < 3:
                    time.sleep(2)  # Required delay
                    rate_limit()

                    params = {"pagetoken": next_page_token, "key": GOOGLE_API_KEY}
                    response = requests.get(PLACES_TEXT_URL, params=params, timeout=30)

                    if response.status_code == 200:
                        data = response.json()
                        if data.get("status") == "OK":
                            for place in data.get("results", []):
                                place_id = place.get("place_id")
                                if place_id and place_id not in seen_place_ids:
                                    seen_place_ids.add(place_id)
                                    facilities.append({
                                        "place_id": place_id,
                                        "name": place.get("name"),
                                        "address": place.get("formatted_address"),
                                        "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                                        "lon": place.get("geometry", {}).get("location", {}).get("lng"),
                                        "rating": place.get("rating"),
                                        "review_count": place.get("user_ratings_total", 0),
                                        "types": place.get("types", []),
                                    })
                            next_page_token = data.get("next_page_token")
                            page += 1
                        else:
                            break
                    else:
                        break

    except Exception as e:
        print(f"   Error searching: {e}")

    return facilities


def get_place_details(place_id: str) -> Dict:
    """Get detailed information about a place including phone number."""
    rate_limit()

    params = {
        "place_id": place_id,
        "fields": "formatted_phone_number,international_phone_number,website,opening_hours,price_level",
        "key": GOOGLE_API_KEY
    }

    try:
        response = requests.get(PLACE_DETAILS_URL, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "OK":
                return data.get("result", {})
    except Exception as e:
        print(f"   Error getting details: {e}")

    return {}


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in miles between two points."""
    R = 3959  # Earth's radius in miles

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))

    return R * c


def deep_dive_county(county_name: str = None, state: str = None, county_fips: str = None,
                     include_adjacent: bool = True, radius_miles: float = 10):
    """
    Comprehensive storage facility search for a specific county.

    Args:
        county_name: County name (e.g., "Bedford")
        state: State code (e.g., "PA")
        county_fips: Alternative - use FIPS code directly
        include_adjacent: Also search 10 miles outside county bounds
        radius_miles: Buffer around each search point
    """
    print("=" * 70)
    print("COUNTY DEEP DIVE - STORAGE FACILITY SEARCH")
    print("=" * 70)

    # Get county info
    county = get_county_info(county_name, state, county_fips)
    if not county:
        print(f"\n   ERROR: County not found")
        print(f"   Try: python build_county_deep_dive.py --list-counties")
        return

    county_fips = county['county_fips']
    print(f"\n   Target: {county['county_name']} County, {county['state']}")
    print(f"   FIPS: {county_fips}")
    print(f"   Population: {county['total_population']:,}")
    print(f"   ZIP codes: {county['surviving_zips']}")

    # Get county bounds
    bounds = get_county_bounds(county_fips)
    print(f"\n   Bounds:")
    print(f"      Lat: {bounds['min_lat']:.4f} to {bounds['max_lat']:.4f}")
    print(f"      Lon: {bounds['min_lon']:.4f} to {bounds['max_lon']:.4f}")
    print(f"      Center: {bounds['center_lat']:.4f}, {bounds['center_lon']:.4f}")

    # Get ZIP codes for search points
    zips = get_zip_codes_in_county(county_fips)
    print(f"\n   Search points: {len(zips)} ZIP centroids")

    # Search for facilities
    print(f"\n" + "-" * 70)
    print("SEARCHING FOR STORAGE FACILITIES")
    print("-" * 70)

    all_facilities = {}
    search_terms = [
        "self storage",
        "mini storage",
        "storage units",
        "public storage",
        "extra space storage",
        "cubesmart"
    ]

    # Search from county center first
    print(f"\n   Searching from county center...")
    for term in search_terms:
        facilities = search_storage_in_area(
            float(bounds['center_lat']),
            float(bounds['center_lon']),
            radius_meters=50000,  # 50km radius
            search_name=f"{term} in {county['county_name']} County {county['state']}"
        )
        for f in facilities:
            if f['place_id'] not in all_facilities:
                all_facilities[f['place_id']] = f
        print(f"      '{term}': +{len(facilities)} results (total unique: {len(all_facilities)})")

    # Search from each ZIP centroid for thoroughness
    print(f"\n   Searching from ZIP centroids...")
    for i, zip_info in enumerate(zips):
        facilities = search_storage_in_area(
            float(zip_info['centroid_lat']),
            float(zip_info['centroid_lon']),
            radius_meters=15000,  # 15km radius per ZIP
            search_name="self storage"
        )
        new_count = 0
        for f in facilities:
            if f['place_id'] not in all_facilities:
                all_facilities[f['place_id']] = f
                new_count += 1
        if new_count > 0:
            print(f"      ZIP {zip_info['zip']}: +{new_count} new facilities")

    print(f"\n   Total unique facilities found: {len(all_facilities)}")

    # Get phone numbers for all facilities
    print(f"\n" + "-" * 70)
    print("FETCHING PHONE NUMBERS & DETAILS")
    print("-" * 70)

    facilities_list = list(all_facilities.values())

    for i, facility in enumerate(facilities_list):
        details = get_place_details(facility['place_id'])
        facility['phone_number'] = details.get('formatted_phone_number') or details.get('international_phone_number')
        facility['website'] = details.get('website')

        phone_display = facility['phone_number'] or 'No phone'
        print(f"   [{i+1}/{len(facilities_list)}] {facility['name'][:40]}: {phone_display}")

    # Calculate distances from county center
    center_lat = float(bounds['center_lat'])
    center_lon = float(bounds['center_lon'])

    for facility in facilities_list:
        if facility.get('lat') and facility.get('lon'):
            facility['distance_from_center'] = haversine_miles(
                center_lat, center_lon,
                float(facility['lat']), float(facility['lon'])
            )
        else:
            facility['distance_from_center'] = None

    # Filter to facilities within reasonable distance
    in_county = [f for f in facilities_list if f.get('distance_from_center') and f['distance_from_center'] <= 30]

    print(f"\n   Facilities within 30 miles of county center: {len(in_county)}")

    # Save to database
    print(f"\n" + "-" * 70)
    print("SAVING TO DATABASE")
    print("-" * 70)

    conn = get_connection()
    cursor = conn.cursor()

    # Create county-specific table for deep dive results
    table_name = f"deep_dive_{county_fips}"

    cursor.execute(f"""
        DROP TABLE IF EXISTS {table_name};
        CREATE TABLE {table_name} (
            id SERIAL PRIMARY KEY,
            place_id VARCHAR(100) UNIQUE,
            name VARCHAR(200),
            address VARCHAR(300),
            lat DECIMAL(10, 7),
            lon DECIMAL(10, 7),
            phone_number VARCHAR(20),
            website VARCHAR(500),
            rating DECIMAL(2, 1),
            review_count INT,
            distance_from_center DECIMAL(6, 2),

            -- Pricing (to be filled by AI caller)
            rate_10x10 INT,
            rate_10x20 INT,
            has_climate BOOLEAN,
            climate_premium INT,
            move_in_special TEXT,

            -- Competition analysis
            nearest_competitor_miles DECIMAL(6, 2),
            competitors_within_5mi INT,

            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    inserted = 0
    for facility in in_county:
        try:
            cursor.execute(f"""
                INSERT INTO {table_name} (
                    place_id, name, address, lat, lon, phone_number, website,
                    rating, review_count, distance_from_center
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (place_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone_number = EXCLUDED.phone_number
            """, (
                facility['place_id'],
                facility['name'],
                facility.get('address'),
                facility.get('lat'),
                facility.get('lon'),
                facility.get('phone_number'),
                facility.get('website'),
                facility.get('rating'),
                facility.get('review_count'),
                facility.get('distance_from_center')
            ))
            inserted += 1
        except Exception as e:
            print(f"   Error inserting {facility['name']}: {e}")

    conn.commit()
    print(f"\n   [OK] Created table: {table_name}")
    print(f"   [OK] Inserted: {inserted} facilities")

    # Calculate competition metrics
    print(f"\n   Calculating competition metrics...")
    cursor.execute(f"""
        UPDATE {table_name} t1
        SET
            nearest_competitor_miles = (
                SELECT MIN(
                    3959 * 2 * ASIN(SQRT(
                        POWER(SIN(RADIANS(t2.lat - t1.lat) / 2), 2) +
                        COS(RADIANS(t1.lat)) * COS(RADIANS(t2.lat)) *
                        POWER(SIN(RADIANS(t2.lon - t1.lon) / 2), 2)
                    ))
                )
                FROM {table_name} t2
                WHERE t2.id != t1.id
            ),
            competitors_within_5mi = (
                SELECT COUNT(*)
                FROM {table_name} t2
                WHERE t2.id != t1.id
                AND 3959 * 2 * ASIN(SQRT(
                    POWER(SIN(RADIANS(t2.lat - t1.lat) / 2), 2) +
                    COS(RADIANS(t1.lat)) * COS(RADIANS(t2.lat)) *
                    POWER(SIN(RADIANS(t2.lon - t1.lon) / 2), 2)
                )) <= 5
            )
    """)
    conn.commit()
    print(f"   [OK] Competition metrics calculated")

    conn.close()

    # Export call list
    export_file = f"call_list_{county['county_name'].lower()}_{county['state'].lower()}.csv"

    with open(export_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'facility_id', 'name', 'phone_number', 'address',
            'distance_miles', 'rating', 'reviews', 'competitors_5mi'
        ])

        # Sort by distance
        in_county_with_phone = [f for f in in_county if f.get('phone_number')]
        in_county_with_phone.sort(key=lambda x: x.get('distance_from_center', 999))

        for i, facility in enumerate(in_county_with_phone):
            writer.writerow([
                i + 1,
                facility['name'],
                facility['phone_number'],
                facility.get('address', ''),
                f"{facility.get('distance_from_center', 0):.1f}",
                facility.get('rating', ''),
                facility.get('review_count', 0),
                ''  # Will be filled after competition calc
            ])

    print(f"\n   [OK] Call list exported: {export_file}")

    # Print summary
    print(f"\n" + "=" * 70)
    print("DEEP DIVE SUMMARY")
    print("=" * 70)

    with_phone = len([f for f in in_county if f.get('phone_number')])

    print(f"\n   County: {county['county_name']}, {county['state']}")
    print(f"   Total facilities found: {len(in_county)}")
    print(f"   With phone numbers: {with_phone}")
    print(f"   Without phone: {len(in_county) - with_phone}")
    print(f"\n   Database table: {table_name}")
    print(f"   Call list: {export_file}")

    # Cost estimate
    est_minutes = with_phone * 1.5  # 90 seconds per call
    est_cost_bland = est_minutes * 0.09
    est_cost_vapi = est_minutes * 0.05

    print(f"\n   AI Caller Cost Estimate:")
    print(f"      Calls to make: {with_phone}")
    print(f"      Est. minutes: {est_minutes:.0f}")
    print(f"      Bland AI: ${est_cost_bland:.2f}")
    print(f"      Vapi: ${est_cost_vapi:.2f}")

    print(f"\n" + "=" * 70)
    print("NEXT STEPS")
    print("=" * 70)
    print(f"""
   1. Review the call list: {export_file}

   2. Upload to AI caller service (Bland AI or Vapi)

   3. Import results:
      python build_ai_caller.py --import-file results.csv

   4. View competition analysis:
      SELECT name, phone_number, distance_from_center,
             nearest_competitor_miles, competitors_within_5mi
      FROM {table_name}
      ORDER BY competitors_within_5mi ASC;

   5. Find underserved areas:
      SELECT * FROM {table_name}
      WHERE competitors_within_5mi = 0
      OR nearest_competitor_miles > 5;
""")

    return {
        "county": county,
        "facilities_found": len(in_county),
        "with_phone": with_phone,
        "table_name": table_name,
        "export_file": export_file
    }


def list_counties():
    """List all available counties from layer_3."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("""
        SELECT county_fips, county_name, state, total_population, surviving_zips
        FROM layer_3_counties
        ORDER BY total_population DESC
    """)

    counties = cursor.fetchall()
    conn.close()

    print("=" * 70)
    print("AVAILABLE COUNTIES")
    print("=" * 70)
    print(f"\n   {'County':<25} {'ST':<4} {'FIPS':<8} {'Population':<12} {'ZIPs'}")
    print(f"   {'-'*25} {'-'*4} {'-'*8} {'-'*12} {'-'*5}")

    for county in counties:
        print(f"   {county['county_name'][:25]:<25} {county['state']:<4} {county['county_fips']:<8} {county['total_population']:>10,} {county['surviving_zips']:>5}")

    print(f"\n   Total counties: {len(counties)}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description='County Deep Dive - Storage Facility Analysis')
    parser.add_argument('--county', type=str, help='County name (e.g., "Bedford")')
    parser.add_argument('--state', type=str, help='State code (e.g., "PA")')
    parser.add_argument('--county-fips', type=str, help='County FIPS code (alternative to name/state)')
    parser.add_argument('--list-counties', action='store_true', help='List all available counties')
    parser.add_argument('--radius', type=float, default=30, help='Search radius in miles (default: 30)')

    args = parser.parse_args()

    if args.list_counties:
        list_counties()
        return

    if args.county_fips:
        deep_dive_county(county_fips=args.county_fips)
    elif args.county and args.state:
        deep_dive_county(county_name=args.county, state=args.state)
    else:
        parser.print_help()
        print("\n" + "=" * 70)
        print("EXAMPLES")
        print("=" * 70)
        print("""
   # List available counties
   python build_county_deep_dive.py --list-counties

   # Deep dive into Bedford County, PA
   python build_county_deep_dive.py --county Bedford --state PA

   # Deep dive using FIPS code
   python build_county_deep_dive.py --county-fips 42009
""")


if __name__ == "__main__":
    main()
