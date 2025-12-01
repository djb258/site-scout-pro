"""
Deep Dive: Eastern WV Panhandle
Target Counties: Morgan, Berkeley, Jefferson (WV)

This script does a thorough search for ALL storage facilities in these counties.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import json
import csv
import time
import math
from datetime import datetime
from typing import Dict, List, Optional, Tuple

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyAWS3lz7Tk-61z82gMN-Ck1-nxTzUVxjU4")

# Target counties
TARGET_COUNTIES = [
    {"fips": "54065", "name": "Morgan", "state": "WV"},
    {"fips": "54003", "name": "Berkeley", "state": "WV"},
    {"fips": "54037", "name": "Jefferson", "state": "WV"},
]

# Major towns in each county for searching
SEARCH_LOCATIONS = {
    "54065": [  # Morgan County
        {"name": "Berkeley Springs", "lat": 39.6265, "lon": -78.2250},
        {"name": "Paw Paw", "lat": 39.5387, "lon": -78.4581},
        {"name": "Great Cacapon", "lat": 39.5790, "lon": -78.2967},
    ],
    "54003": [  # Berkeley County
        {"name": "Martinsburg", "lat": 39.4565, "lon": -77.9636},
        {"name": "Inwood", "lat": 39.3576, "lon": -78.0400},
        {"name": "Hedgesville", "lat": 39.5515, "lon": -77.9892},
        {"name": "Falling Waters", "lat": 39.5665, "lon": -77.8981},
        {"name": "Bunker Hill", "lat": 39.2990, "lon": -78.0772},
    ],
    "54037": [  # Jefferson County
        {"name": "Charles Town", "lat": 39.2890, "lon": -77.8597},
        {"name": "Shepherdstown", "lat": 39.4318, "lon": -77.8042},
        {"name": "Harpers Ferry", "lat": 39.3251, "lon": -77.7286},
        {"name": "Ranson", "lat": 39.2960, "lon": -77.8614},
        {"name": "Kearneysville", "lat": 39.3790, "lon": -77.8842},
    ],
}

# Google Places API
PLACES_TEXT_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

LAST_REQUEST_TIME = 0


def rate_limit():
    global LAST_REQUEST_TIME
    current = time.time()
    elapsed = current - LAST_REQUEST_TIME
    if elapsed < 0.1:  # 10 req/sec
        time.sleep(0.1 - elapsed)
    LAST_REQUEST_TIME = time.time()


def get_connection():
    return psycopg2.connect(CONNECTION_STRING)


def search_storage(lat: float, lon: float, query: str, radius: int = 25000) -> List[Dict]:
    """Search for storage facilities near a location."""
    facilities = []
    seen = set()

    rate_limit()

    params = {
        "query": query,
        "location": f"{lat},{lon}",
        "radius": radius,
        "key": GOOGLE_API_KEY
    }

    try:
        resp = requests.get(PLACES_TEXT_URL, params=params, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "OK":
                for place in data.get("results", []):
                    pid = place.get("place_id")
                    if pid and pid not in seen:
                        seen.add(pid)
                        facilities.append({
                            "place_id": pid,
                            "name": place.get("name"),
                            "address": place.get("formatted_address"),
                            "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                            "lon": place.get("geometry", {}).get("location", {}).get("lng"),
                            "rating": place.get("rating"),
                            "review_count": place.get("user_ratings_total", 0),
                        })

                # Pagination
                next_token = data.get("next_page_token")
                page = 1
                while next_token and page < 3:
                    time.sleep(2)
                    rate_limit()
                    params = {"pagetoken": next_token, "key": GOOGLE_API_KEY}
                    resp = requests.get(PLACES_TEXT_URL, params=params, timeout=30)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("status") == "OK":
                            for place in data.get("results", []):
                                pid = place.get("place_id")
                                if pid and pid not in seen:
                                    seen.add(pid)
                                    facilities.append({
                                        "place_id": pid,
                                        "name": place.get("name"),
                                        "address": place.get("formatted_address"),
                                        "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                                        "lon": place.get("geometry", {}).get("location", {}).get("lng"),
                                        "rating": place.get("rating"),
                                        "review_count": place.get("user_ratings_total", 0),
                                    })
                            next_token = data.get("next_page_token")
                            page += 1
                        else:
                            break
                    else:
                        break
    except Exception as e:
        print(f"      Error: {e}")

    return facilities


def get_phone_number(place_id: str) -> Optional[str]:
    """Get phone number for a place."""
    rate_limit()

    params = {
        "place_id": place_id,
        "fields": "formatted_phone_number,international_phone_number,website,opening_hours",
        "key": GOOGLE_API_KEY
    }

    try:
        resp = requests.get(PLACE_DETAILS_URL, params=params, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "OK":
                result = data.get("result", {})
                return result.get("formatted_phone_number") or result.get("international_phone_number")
    except:
        pass

    return None


def haversine(lat1, lon1, lat2, lon2) -> float:
    """Distance in miles."""
    R = 3959
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def main():
    print("=" * 70)
    print("EASTERN WV PANHANDLE DEEP DIVE")
    print("Morgan, Berkeley, Jefferson Counties")
    print("=" * 70)

    all_facilities = {}

    # Search terms
    search_terms = [
        "self storage",
        "mini storage",
        "storage units",
        "public storage",
        "U-Haul storage",
        "storage facility",
    ]

    for county in TARGET_COUNTIES:
        fips = county["fips"]
        name = county["name"]
        state = county["state"]

        print(f"\n{'='*70}")
        print(f"COUNTY: {name}, {state} (FIPS: {fips})")
        print(f"{'='*70}")

        locations = SEARCH_LOCATIONS.get(fips, [])

        # Search from each town
        for loc in locations:
            print(f"\n   Searching from: {loc['name']}")

            for term in search_terms:
                query = f"{term} near {loc['name']}, {state}"
                results = search_storage(loc['lat'], loc['lon'], query, radius=30000)

                new_count = 0
                for f in results:
                    if f['place_id'] not in all_facilities:
                        # Add county info
                        f['search_county'] = fips
                        f['search_location'] = loc['name']
                        all_facilities[f['place_id']] = f
                        new_count += 1

                if new_count > 0:
                    print(f"      '{term}': +{new_count} new")

        # Also search the county name directly
        print(f"\n   Searching: '{name} County {state} storage'")
        for term in search_terms:
            query = f"{term} in {name} County, {state}"
            # Use county center
            center_lat = sum(l['lat'] for l in locations) / len(locations) if locations else 39.4
            center_lon = sum(l['lon'] for l in locations) / len(locations) if locations else -78.0
            results = search_storage(center_lat, center_lon, query, radius=40000)

            for f in results:
                if f['place_id'] not in all_facilities:
                    f['search_county'] = fips
                    all_facilities[f['place_id']] = f

    print(f"\n{'='*70}")
    print(f"TOTAL UNIQUE FACILITIES FOUND: {len(all_facilities)}")
    print(f"{'='*70}")

    # Get phone numbers
    print(f"\nFetching phone numbers...")
    facilities_list = list(all_facilities.values())

    for i, f in enumerate(facilities_list):
        phone = get_phone_number(f['place_id'])
        f['phone_number'] = phone
        status = phone if phone else "No phone"
        print(f"   [{i+1}/{len(facilities_list)}] {f['name'][:45]}: {status}")

    # Determine which county each facility is actually in
    print(f"\n{'='*70}")
    print("ASSIGNING FACILITIES TO COUNTIES")
    print("=" * 70)

    county_centers = {
        "54065": (39.5814, -78.3000),  # Morgan
        "54003": (39.4565, -77.9636),  # Berkeley
        "54037": (39.3500, -77.8000),  # Jefferson
    }

    for f in facilities_list:
        if f.get('lat') and f.get('lon'):
            # Find closest county center
            min_dist = 999
            assigned_county = None
            for fips, (clat, clon) in county_centers.items():
                dist = haversine(f['lat'], f['lon'], clat, clon)
                if dist < min_dist:
                    min_dist = dist
                    assigned_county = fips
            f['assigned_county'] = assigned_county
            f['distance_from_center'] = min_dist
        else:
            f['assigned_county'] = f.get('search_county')
            f['distance_from_center'] = None

    # Filter to only facilities within ~20 miles of any county center (to exclude DC/MD facilities)
    local_facilities = [f for f in facilities_list
                        if f.get('distance_from_center') and f['distance_from_center'] <= 25]

    print(f"\n   Facilities within 25 miles of county centers: {len(local_facilities)}")

    # Count by county
    by_county = {}
    for f in local_facilities:
        county = f.get('assigned_county', 'Unknown')
        by_county[county] = by_county.get(county, 0) + 1

    print(f"\n   By County:")
    for fips, count in sorted(by_county.items()):
        name = next((c['name'] for c in TARGET_COUNTIES if c['fips'] == fips), fips)
        print(f"      {name} ({fips}): {count} facilities")

    # Save to database
    print(f"\n{'='*70}")
    print("SAVING TO DATABASE")
    print("=" * 70)

    conn = get_connection()
    cursor = conn.cursor()

    # Create combined table
    cursor.execute("""
        DROP TABLE IF EXISTS deep_dive_wv_eastern;
        CREATE TABLE deep_dive_wv_eastern (
            id SERIAL PRIMARY KEY,
            place_id VARCHAR(100) UNIQUE,
            name VARCHAR(200),
            address VARCHAR(300),
            city VARCHAR(100),
            county_fips VARCHAR(5),
            county_name VARCHAR(50),
            lat DECIMAL(10, 7),
            lon DECIMAL(10, 7),
            phone_number VARCHAR(20),
            rating DECIMAL(2, 1),
            review_count INT,
            distance_from_center DECIMAL(6, 2),

            -- Pricing (to be filled)
            rate_10x10 INT,
            rate_10x20 INT,
            has_climate BOOLEAN,
            climate_premium INT,
            move_in_special TEXT,
            availability VARCHAR(20),

            -- Competition
            nearest_competitor_miles DECIMAL(6, 2),
            competitors_within_3mi INT,
            competitors_within_5mi INT,

            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    inserted = 0
    for f in local_facilities:
        # Parse city from address
        city = None
        if f.get('address'):
            parts = f['address'].split(',')
            if len(parts) >= 2:
                city = parts[-3].strip() if len(parts) >= 3 else parts[0].strip()

        county_name = next((c['name'] for c in TARGET_COUNTIES if c['fips'] == f.get('assigned_county')), None)

        try:
            cursor.execute("""
                INSERT INTO deep_dive_wv_eastern (
                    place_id, name, address, city, county_fips, county_name,
                    lat, lon, phone_number, rating, review_count, distance_from_center
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (place_id) DO UPDATE SET
                    phone_number = EXCLUDED.phone_number
            """, (
                f['place_id'], f['name'], f.get('address'), city,
                f.get('assigned_county'), county_name,
                f.get('lat'), f.get('lon'), f.get('phone_number'),
                f.get('rating'), f.get('review_count'), f.get('distance_from_center')
            ))
            inserted += 1
        except Exception as e:
            print(f"   Error: {e}")

    conn.commit()
    print(f"\n   [OK] Created table: deep_dive_wv_eastern")
    print(f"   [OK] Inserted: {inserted} facilities")

    # Calculate competition
    print(f"\n   Calculating competition metrics...")
    cursor.execute("""
        UPDATE deep_dive_wv_eastern t1
        SET
            nearest_competitor_miles = (
                SELECT MIN(
                    3959 * 2 * ASIN(SQRT(
                        POWER(SIN(RADIANS(t2.lat - t1.lat) / 2), 2) +
                        COS(RADIANS(t1.lat)) * COS(RADIANS(t2.lat)) *
                        POWER(SIN(RADIANS(t2.lon - t1.lon) / 2), 2)
                    ))
                )
                FROM deep_dive_wv_eastern t2
                WHERE t2.id != t1.id AND t2.lat IS NOT NULL
            ),
            competitors_within_3mi = (
                SELECT COUNT(*)
                FROM deep_dive_wv_eastern t2
                WHERE t2.id != t1.id AND t2.lat IS NOT NULL
                AND 3959 * 2 * ASIN(SQRT(
                    POWER(SIN(RADIANS(t2.lat - t1.lat) / 2), 2) +
                    COS(RADIANS(t1.lat)) * COS(RADIANS(t2.lat)) *
                    POWER(SIN(RADIANS(t2.lon - t1.lon) / 2), 2)
                )) <= 3
            ),
            competitors_within_5mi = (
                SELECT COUNT(*)
                FROM deep_dive_wv_eastern t2
                WHERE t2.id != t1.id AND t2.lat IS NOT NULL
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
    export_file = "call_list_wv_eastern_panhandle.csv"

    with_phone = [f for f in local_facilities if f.get('phone_number')]
    with_phone.sort(key=lambda x: (x.get('assigned_county', ''), x.get('name', '')))

    with open(export_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow([
            'id', 'county', 'name', 'phone_number', 'address',
            'rating', 'reviews', 'distance_miles'
        ])

        for i, f in enumerate(with_phone):
            county_name = next((c['name'] for c in TARGET_COUNTIES if c['fips'] == f.get('assigned_county')), 'Unknown')
            writer.writerow([
                i + 1,
                county_name,
                f['name'],
                f['phone_number'],
                f.get('address', ''),
                f.get('rating', ''),
                f.get('review_count', 0),
                f"{f.get('distance_from_center', 0):.1f}" if f.get('distance_from_center') else ''
            ])

    print(f"\n   [OK] Call list exported: {export_file}")

    # Summary
    print(f"\n{'='*70}")
    print("SUMMARY")
    print("=" * 70)

    print(f"\n   Total facilities found: {len(local_facilities)}")
    print(f"   With phone numbers: {len(with_phone)}")
    print(f"   Without phone: {len(local_facilities) - len(with_phone)}")

    print(f"\n   By County:")
    for county in TARGET_COUNTIES:
        count = len([f for f in local_facilities if f.get('assigned_county') == county['fips']])
        with_ph = len([f for f in with_phone if f.get('assigned_county') == county['fips']])
        print(f"      {county['name']}: {count} total, {with_ph} with phone")

    # Cost estimate
    est_minutes = len(with_phone) * 1.5
    print(f"\n   AI Caller Cost Estimate:")
    print(f"      Facilities to call: {len(with_phone)}")
    print(f"      Est. minutes: {est_minutes:.0f}")
    print(f"      Bland AI (~$0.09/min): ${est_minutes * 0.09:.2f}")
    print(f"      Vapi (~$0.05/min): ${est_minutes * 0.05:.2f}")

    print(f"\n{'='*70}")
    print("FILES CREATED")
    print("=" * 70)
    print(f"\n   Database table: deep_dive_wv_eastern")
    print(f"   Call list CSV: {export_file}")

    print(f"\n{'='*70}")
    print("NEXT STEPS")
    print("=" * 70)
    print(f"""
   1. Review call list: {export_file}

   2. Query competition analysis:
      SELECT county_name, name, phone_number,
             nearest_competitor_miles, competitors_within_5mi
      FROM deep_dive_wv_eastern
      ORDER BY county_name, competitors_within_5mi ASC;

   3. Find underserved areas:
      SELECT * FROM deep_dive_wv_eastern
      WHERE competitors_within_5mi <= 1
      ORDER BY county_name;

   4. Upload to AI caller (Bland AI or Vapi)

   5. Import results:
      python build_ai_caller.py --import-file results.csv
""")


if __name__ == "__main__":
    main()
