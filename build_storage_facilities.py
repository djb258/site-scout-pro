"""
Storage Facilities Fetcher
Fetches self-storage facilities for all surviving counties using Google Places API.

Features:
- Caches results with 7-day TTL
- Throttles to 10 requests/second
- Geocodes to get ZIP and county_fips
- Calculates competition buffers
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import json
import time
import math
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyAWS3lz7Tk-61z82gMN-Ck1-nxTzUVxjU4")

# Google Places API endpoints
PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACES_TEXT_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

# Cache TTL
CACHE_TTL_DAYS = 7

# Rate limiting
REQUESTS_PER_SECOND = 10
LAST_REQUEST_TIME = 0

def get_connection():
    return psycopg2.connect(CONNECTION_STRING)

def rate_limit():
    """Enforce rate limiting - max 10 requests per second."""
    global LAST_REQUEST_TIME
    current_time = time.time()
    elapsed = current_time - LAST_REQUEST_TIME
    min_interval = 1.0 / REQUESTS_PER_SECOND

    if elapsed < min_interval:
        sleep_time = min_interval - elapsed
        time.sleep(sleep_time)

    LAST_REQUEST_TIME = time.time()

def get_cached_storage(county_fips: str, conn) -> Optional[List[Dict]]:
    """Check if storage data is cached and not expired."""
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cache_key = f"storage_facilities:{county_fips}"
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

def set_cached_storage(county_fips: str, data: List[Dict], conn):
    """Cache storage data with TTL."""
    cursor = conn.cursor()

    cache_key = f"storage_facilities:{county_fips}"
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

def get_county_centroid(county_fips: str, conn) -> Optional[Tuple[float, float]]:
    """Get the centroid of a county from its ZIPs."""
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("""
        SELECT AVG(centroid_lat) as lat, AVG(centroid_lon) as lon
        FROM layer_1_geography
        WHERE county_fips = %s
    """, (county_fips,))

    row = cursor.fetchone()
    if row and row['lat'] and row['lon']:
        return (float(row['lat']), float(row['lon']))
    return None

def search_storage_facilities(county_name: str, state: str, lat: float, lon: float) -> List[Dict]:
    """
    Search for self-storage facilities in a county using Google Places API.
    Uses Text Search API for better county-specific results.
    """
    facilities = []
    seen_place_ids = set()

    # Search query
    query = f"self storage in {county_name} County, {state}"

    rate_limit()

    params = {
        "query": query,
        "location": f"{lat},{lon}",
        "radius": 50000,  # 50km radius
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
                        facility = {
                            "place_id": place_id,
                            "name": place.get("name"),
                            "address": place.get("formatted_address"),
                            "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                            "lon": place.get("geometry", {}).get("location", {}).get("lng"),
                            "rating": place.get("rating"),
                            "review_count": place.get("user_ratings_total", 0),
                            "types": place.get("types", []),
                            "business_status": place.get("business_status"),
                        }
                        facilities.append(facility)

                # Handle pagination (up to 60 results)
                next_page_token = data.get("next_page_token")
                page = 1

                while next_page_token and len(facilities) < 60 and page < 3:
                    time.sleep(2)  # Required delay for next_page_token
                    rate_limit()

                    params = {
                        "pagetoken": next_page_token,
                        "key": GOOGLE_API_KEY
                    }

                    response = requests.get(PLACES_TEXT_URL, params=params, timeout=30)
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("status") == "OK":
                            for place in data.get("results", []):
                                place_id = place.get("place_id")
                                if place_id and place_id not in seen_place_ids:
                                    seen_place_ids.add(place_id)
                                    facility = {
                                        "place_id": place_id,
                                        "name": place.get("name"),
                                        "address": place.get("formatted_address"),
                                        "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                                        "lon": place.get("geometry", {}).get("location", {}).get("lng"),
                                        "rating": place.get("rating"),
                                        "review_count": place.get("user_ratings_total", 0),
                                        "types": place.get("types", []),
                                        "business_status": place.get("business_status"),
                                    }
                                    facilities.append(facility)

                            next_page_token = data.get("next_page_token")
                            page += 1
                        else:
                            break
                    else:
                        break

    except Exception as e:
        print(f"      Error searching {county_name}, {state}: {e}")

    return facilities

def parse_address_components(address: str) -> Dict[str, str]:
    """Parse city, state, zip from formatted address."""
    result = {"city": None, "state": None, "zip": None}

    if not address:
        return result

    # Try to extract ZIP (5 digits)
    import re
    zip_match = re.search(r'\b(\d{5})(?:-\d{4})?\b', address)
    if zip_match:
        result["zip"] = zip_match.group(1)

    # Split by comma and parse
    parts = [p.strip() for p in address.split(",")]

    if len(parts) >= 3:
        # Usually: "Street, City, State ZIP, USA"
        result["city"] = parts[-3] if len(parts) > 3 else parts[0]

        # State is usually in the second-to-last part with ZIP
        state_zip_part = parts[-2] if len(parts) >= 2 else ""
        state_match = re.search(r'\b([A-Z]{2})\b', state_zip_part)
        if state_match:
            result["state"] = state_match.group(1)

    return result

def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate haversine distance in miles."""
    R = 3959  # Earth's radius in miles

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))

    return R * c

def match_to_county(lat: float, lon: float, conn) -> Optional[str]:
    """Match a lat/lon to the nearest county_fips in our data."""
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    # Find the ZIP closest to this point
    cursor.execute("""
        SELECT county_fips, haversine_miles(%s, %s, centroid_lat, centroid_lon) as distance
        FROM layer_1_geography
        ORDER BY haversine_miles(%s, %s, centroid_lat, centroid_lon)
        LIMIT 1
    """, (lat, lon, lat, lon))

    row = cursor.fetchone()
    if row and row['distance'] < 50:  # Within 50 miles
        return row['county_fips']
    return None

def build_storage_facilities():
    """Main function to fetch storage facilities for all counties."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("=" * 70)
    print("STORAGE FACILITIES FETCHER")
    print("=" * 70)

    # Get all counties from layer_3
    cursor.execute("""
        SELECT county_fips, county_name, state, surviving_zips, total_population
        FROM layer_3_counties
        ORDER BY total_population DESC
    """)
    counties = cursor.fetchall()

    print(f"\n   Total counties to process: {len(counties)}")

    stats = {
        "counties_processed": 0,
        "facilities_found": 0,
        "cache_hits": 0,
        "api_calls": 0,
        "facilities_by_county": {},
    }

    all_facilities = []

    print(f"\n   Processing counties...")
    print(f"   {'#':<4} {'County':<25} {'ST':<4} {'Facilities':<12} {'Source'}")
    print(f"   {'-'*4} {'-'*25} {'-'*4} {'-'*12} {'-'*10}")

    for i, county in enumerate(counties):
        county_fips = county['county_fips']
        county_name = county['county_name']
        state = county['state']

        # Check cache first
        cached = get_cached_storage(county_fips, conn)

        if cached:
            facilities = cached
            source = "cache"
            stats["cache_hits"] += 1
        else:
            # Get county centroid
            centroid = get_county_centroid(county_fips, conn)

            if centroid:
                lat, lon = centroid
                facilities = search_storage_facilities(county_name, state, lat, lon)
                stats["api_calls"] += 1

                # Cache the results
                set_cached_storage(county_fips, facilities, conn)
            else:
                facilities = []

            source = "API"

        # Add county_fips to each facility
        for f in facilities:
            f['county_fips'] = county_fips

        all_facilities.extend(facilities)
        stats["facilities_found"] += len(facilities)
        stats["facilities_by_county"][county_fips] = len(facilities)
        stats["counties_processed"] += 1

        print(f"   {i+1:<4} {county_name[:25]:<25} {state:<4} {len(facilities):<12} {source}")

    print(f"\n   Total facilities found: {stats['facilities_found']:,}")
    print(f"   Cache hits: {stats['cache_hits']}")
    print(f"   API calls: {stats['api_calls']}")

    # Insert into database
    print(f"\n" + "=" * 70)
    print("INSERTING INTO DATABASE")
    print("=" * 70)

    # Clear existing data
    cursor.execute("DELETE FROM storage_facilities")
    print(f"\n   Cleared existing storage_facilities data")

    inserted = 0
    duplicates = 0

    for facility in all_facilities:
        if not facility.get('place_id'):
            continue

        # Parse address
        addr_parts = parse_address_components(facility.get('address', ''))

        try:
            cursor.execute("""
                INSERT INTO storage_facilities (
                    place_id, name, address, city, state, zip, county_fips,
                    lat, lon, rating, review_count, source, fetched_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (place_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    address = EXCLUDED.address,
                    rating = EXCLUDED.rating,
                    review_count = EXCLUDED.review_count,
                    fetched_at = NOW()
            """, (
                facility['place_id'],
                facility['name'],
                facility.get('address'),
                addr_parts.get('city'),
                addr_parts.get('state') or facility.get('state'),
                addr_parts.get('zip'),
                facility.get('county_fips'),
                facility.get('lat'),
                facility.get('lon'),
                facility.get('rating'),
                facility.get('review_count'),
                'google_places'
            ))
            inserted += 1
        except Exception as e:
            duplicates += 1

    conn.commit()
    print(f"   Inserted: {inserted:,} facilities")
    print(f"   Duplicates skipped: {duplicates}")

    conn.close()
    return stats

def calculate_competition():
    """Calculate facilities with no competition within 5 miles."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print(f"\n" + "=" * 70)
    print("CALCULATING COMPETITION BUFFERS")
    print("=" * 70)

    # Get all facilities
    cursor.execute("""
        SELECT id, place_id, name, lat, lon, county_fips
        FROM storage_facilities
        WHERE lat IS NOT NULL AND lon IS NOT NULL
    """)
    facilities = cursor.fetchall()

    print(f"\n   Analyzing {len(facilities)} facilities for competition...")

    # For each facility, count competitors within 5 miles
    no_competition = []

    for i, facility in enumerate(facilities):
        cursor.execute("""
            SELECT COUNT(*) as competitors
            FROM storage_facilities
            WHERE id != %s
            AND lat IS NOT NULL AND lon IS NOT NULL
            AND haversine_miles(%s, %s, lat, lon) <= 5
        """, (facility['id'], facility['lat'], facility['lon']))

        competitors = cursor.fetchone()['competitors']

        if competitors == 0:
            no_competition.append(facility)

        if (i + 1) % 100 == 0:
            print(f"      Processed {i+1}/{len(facilities)}...")

    print(f"\n   Facilities with NO competition within 5 miles: {len(no_competition)}")

    if no_competition:
        print(f"\n   Low-Competition Facilities:")
        print(f"   {'Name':<40} {'County'}")
        print(f"   {'-'*40} {'-'*15}")
        for f in no_competition[:20]:
            print(f"   {f['name'][:40]:<40} {f['county_fips']}")

    conn.close()
    return no_competition

def verify_and_report():
    """Generate verification report."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print(f"\n" + "=" * 70)
    print("STORAGE FACILITIES VERIFICATION")
    print("=" * 70)

    # Total count
    cursor.execute("SELECT COUNT(*) as cnt FROM storage_facilities")
    total = cursor.fetchone()['cnt']
    print(f"\n   Total facilities: {total:,}")

    # By county (top 15)
    cursor.execute("""
        SELECT sf.county_fips, lc.county_name, lc.state,
               COUNT(*) as facility_count,
               ROUND(AVG(sf.rating)::numeric, 2) as avg_rating,
               SUM(sf.review_count) as total_reviews
        FROM storage_facilities sf
        JOIN layer_3_counties lc ON sf.county_fips = lc.county_fips
        GROUP BY sf.county_fips, lc.county_name, lc.state
        ORDER BY facility_count DESC
        LIMIT 15
    """)

    print(f"\n   Top 15 Counties by Facility Count:")
    print(f"   {'County':<25} {'ST':<4} {'Facilities':<12} {'Avg Rating':<12} {'Reviews'}")
    print(f"   {'-'*25} {'-'*4} {'-'*12} {'-'*12} {'-'*10}")
    for row in cursor.fetchall():
        rating = row['avg_rating'] if row['avg_rating'] else 0
        print(f"   {row['county_name'][:25]:<25} {row['state']:<4} {row['facility_count']:<12} {rating:<12} {row['total_reviews']:,}")

    # Overall stats
    cursor.execute("""
        SELECT
            ROUND(AVG(rating)::numeric, 2) as avg_rating,
            SUM(review_count) as total_reviews,
            COUNT(DISTINCT county_fips) as counties_covered
        FROM storage_facilities
    """)
    stats = cursor.fetchone()
    print(f"\n   Overall Stats:")
    print(f"      Average Rating: {stats['avg_rating']}")
    print(f"      Total Reviews: {stats['total_reviews']:,}")
    print(f"      Counties Covered: {stats['counties_covered']}")

    # Sample facilities
    cursor.execute("""
        SELECT name, city, state, rating, review_count
        FROM storage_facilities
        WHERE rating IS NOT NULL
        ORDER BY review_count DESC
        LIMIT 10
    """)
    print(f"\n   Top 10 Facilities by Reviews:")
    for row in cursor.fetchall():
        print(f"      {row['name'][:40]} - {row['city']}, {row['state']} ({row['rating']}★, {row['review_count']} reviews)")

    # Calculate saturation (facilities per 10k population)
    cursor.execute("""
        SELECT lc.county_name, lc.state, lc.total_population,
               COUNT(sf.id) as facilities,
               ROUND((COUNT(sf.id)::numeric / lc.total_population * 10000)::numeric, 2) as per_10k
        FROM layer_3_counties lc
        LEFT JOIN storage_facilities sf ON lc.county_fips = sf.county_fips
        GROUP BY lc.county_fips, lc.county_name, lc.state, lc.total_population
        ORDER BY per_10k DESC
        LIMIT 15
    """)
    print(f"\n   Counties by Saturation (Facilities per 10k pop):")
    print(f"   {'County':<25} {'ST':<4} {'Population':<12} {'Facilities':<12} {'Per 10k'}")
    print(f"   {'-'*25} {'-'*4} {'-'*12} {'-'*12} {'-'*10}")
    for row in cursor.fetchall():
        print(f"   {row['county_name'][:25]:<25} {row['state']:<4} {row['total_population']:>10,} {row['facilities']:<12} {row['per_10k']}")

    conn.close()

if __name__ == "__main__":
    # Build storage facilities
    stats = build_storage_facilities()

    # Calculate competition
    no_competition = calculate_competition()

    # Verify and report
    verify_and_report()

    print(f"\n" + "=" * 70)
    print("STORAGE FACILITIES COMPLETE")
    print("=" * 70)
