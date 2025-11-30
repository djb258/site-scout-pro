"""
Build Universities Table
Searches Google Places API for universities/colleges in target counties.
Key demand driver - students need storage during moves.
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

def search_universities(lat, lng, radius=25000):
    """Search for universities near a location."""
    rate_limit()

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "type": "university",
        "key": GOOGLE_API_KEY
    }

    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        return data.get("results", [])
    except Exception as e:
        print(f"      Error: {e}")
        return []

def get_place_details(place_id):
    """Get detailed info for a place."""
    rate_limit()

    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,geometry,rating,user_ratings_total,website,formatted_phone_number",
        "key": GOOGLE_API_KEY
    }

    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        return data.get("result", {})
    except Exception as e:
        print(f"      Error getting details: {e}")
        return {}

def build_universities():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("=" * 70)
    print("BUILDING UNIVERSITIES TABLE")
    print("=" * 70)

    # Get county centroids from layer_3
    cursor.execute("""
        SELECT DISTINCT l3.county_fips, l3.county_name, l3.state,
               AVG(l1.centroid_lat) as lat, AVG(l1.centroid_lon) as lng
        FROM layer_3_counties l3
        JOIN layer_1_geography l1 ON l3.county_fips = l1.county_fips
        GROUP BY l3.county_fips, l3.county_name, l3.state
        ORDER BY l3.state, l3.county_name
    """)
    counties = cursor.fetchall()

    print(f"\n   Searching {len(counties)} counties for universities...")

    seen_place_ids = set()
    total_inserted = 0

    for county in counties:
        county_fips = county['county_fips']
        county_name = county['county_name']
        state = county['state']
        lat = float(county['lat'])
        lng = float(county['lng'])

        print(f"\n   {county_name}, {state}...")

        # Search for universities
        results = search_universities(lat, lng, radius=30000)

        county_count = 0
        for place in results:
            place_id = place.get('place_id')
            if not place_id or place_id in seen_place_ids:
                continue
            seen_place_ids.add(place_id)

            name = place.get('name', '')

            # Filter out non-universities
            lower_name = name.lower()
            skip_keywords = ['high school', 'elementary', 'middle school', 'preschool', 'daycare']
            if any(kw in lower_name for kw in skip_keywords):
                continue

            location = place.get('geometry', {}).get('location', {})
            vicinity = place.get('vicinity', '')
            rating = place.get('rating')

            # Get more details
            details = get_place_details(place_id)
            address = details.get('formatted_address', vicinity)

            # Parse city from address
            city = ''
            if address:
                parts = address.split(',')
                if len(parts) >= 2:
                    city = parts[-3].strip() if len(parts) >= 3 else parts[0].strip()

            # Insert
            try:
                cursor.execute("""
                    INSERT INTO universities (
                        name, institution_type, state, county, city, address,
                        lat, lng, source, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT DO NOTHING
                """, (
                    name,
                    'university',
                    state,
                    county_name,
                    city,
                    address,
                    location.get('lat'),
                    location.get('lng'),
                    'google_places'
                ))
                county_count += 1
                total_inserted += 1
            except Exception as e:
                print(f"      Insert error: {e}")

        conn.commit()
        print(f"      Found {county_count} universities")

    print(f"\n" + "=" * 70)
    print(f"COMPLETE: {total_inserted} universities added")
    print("=" * 70)

    # Verify
    cursor.execute("SELECT COUNT(*) as cnt FROM universities")
    print(f"\n   Total universities in database: {cursor.fetchone()['cnt']}")

    conn.close()

if __name__ == "__main__":
    build_universities()
