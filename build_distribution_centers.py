"""
Build Distribution Centers Table
Searches Google Places API for Amazon, FedEx, UPS, and other warehouses.
Key growth indicator - jobs and potential storage demand from workers.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import time
import json
from datetime import datetime

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
GOOGLE_API_KEY = "AIzaSyAWS3lz7Tk-61z82gMN-Ck1-nxTzUVxjU4"

# Rate limiting
REQUESTS_PER_MINUTE = 50
request_count = 0
last_reset = time.time()

def rate_limit():
    global request_count, last_reset
    current_time = time.time()
    if current_time - last_reset >= 60:
        request_count = 0
        last_reset = current_time
    if request_count >= REQUESTS_PER_MINUTE:
        sleep_time = 60 - (current_time - last_reset)
        if sleep_time > 0:
            print(f"      Rate limit reached, sleeping {sleep_time:.0f}s...")
            time.sleep(sleep_time)
        request_count = 0
        last_reset = time.time()
    request_count += 1

def get_connection():
    return psycopg2.connect(CONNECTION_STRING)

def search_places(lat, lng, keyword, radius=25000):
    """Search for places near a location."""
    rate_limit()

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "keyword": keyword,
        "key": GOOGLE_API_KEY
    }

    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        return data.get("results", [])
    except Exception as e:
        print(f"      Error: {e}")
        return []

def determine_company(name):
    """Determine company from place name."""
    name_lower = name.lower()

    if 'amazon' in name_lower:
        return 'Amazon', 'Fulfillment Center'
    elif 'fedex' in name_lower:
        return 'FedEx', 'Distribution Hub'
    elif 'ups' in name_lower:
        return 'UPS', 'Distribution Hub'
    elif 'usps' in name_lower or 'postal' in name_lower:
        return 'USPS', 'Distribution Center'
    elif 'walmart' in name_lower:
        return 'Walmart', 'Distribution Center'
    elif 'target' in name_lower:
        return 'Target', 'Distribution Center'
    elif 'home depot' in name_lower:
        return 'Home Depot', 'Distribution Center'
    elif 'lowes' in name_lower or "lowe's" in name_lower:
        return "Lowe's", 'Distribution Center'
    else:
        return 'Other', 'Warehouse'

def build_distribution_centers():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("=" * 70)
    print("BUILDING DISTRIBUTION CENTERS TABLE")
    print("=" * 70)

    # Get county centroids
    cursor.execute("""
        SELECT DISTINCT l3.county_fips, l3.county_name, l3.state,
               AVG(l1.centroid_lat) as lat, AVG(l1.centroid_lon) as lng
        FROM layer_3_counties l3
        JOIN layer_1_geography l1 ON l3.county_fips = l1.county_fips
        GROUP BY l3.county_fips, l3.county_name, l3.state
        ORDER BY l3.state, l3.county_name
    """)
    counties = cursor.fetchall()

    print(f"\n   Searching {len(counties)} counties for distribution centers...")

    search_terms = [
        "Amazon fulfillment center",
        "Amazon warehouse",
        "FedEx distribution",
        "UPS distribution center",
        "warehouse distribution center"
    ]

    seen_place_ids = set()
    total_inserted = 0

    for county in counties:
        county_fips = county['county_fips']
        county_name = county['county_name']
        state = county['state']
        lat = float(county['lat'])
        lng = float(county['lng'])

        print(f"\n   {county_name}, {state}...")

        county_count = 0
        for search_term in search_terms:
            results = search_places(lat, lng, search_term, radius=30000)

            for place in results:
                place_id = place.get('place_id')
                if not place_id or place_id in seen_place_ids:
                    continue
                seen_place_ids.add(place_id)

                name = place.get('name', '')
                location = place.get('geometry', {}).get('location', {})
                vicinity = place.get('vicinity', '')

                # Determine company
                company, facility_type = determine_company(name)

                # Parse city
                city = ''
                if vicinity:
                    parts = vicinity.split(',')
                    if parts:
                        city = parts[-1].strip()

                # Insert
                try:
                    cursor.execute("""
                        INSERT INTO distribution_centers (
                            company, facility_name, facility_type, state, county, city,
                            address, lat, lng, source, fetched_at, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                        ON CONFLICT DO NOTHING
                    """, (
                        company,
                        name,
                        facility_type,
                        state,
                        county_name,
                        city,
                        vicinity,
                        location.get('lat'),
                        location.get('lng'),
                        'google_places'
                    ))
                    county_count += 1
                    total_inserted += 1
                except Exception as e:
                    print(f"      Insert error: {e}")

        conn.commit()
        print(f"      Found {county_count} distribution centers")

    print(f"\n" + "=" * 70)
    print(f"COMPLETE: {total_inserted} distribution centers added")
    print("=" * 70)

    # Verify
    cursor.execute("""
        SELECT company, COUNT(*) as cnt
        FROM distribution_centers
        GROUP BY company
        ORDER BY cnt DESC
    """)
    print("\n   By company:")
    for row in cursor.fetchall():
        print(f"      {row['company']}: {row['cnt']}")

    conn.close()

if __name__ == "__main__":
    build_distribution_centers()
