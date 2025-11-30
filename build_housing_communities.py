"""
Layer 5a - Housing Communities Builder
Fetches existing housing communities (townhomes, apartments, condos, mobile homes)
from Google Places API for all counties in layer_3_counties.

Uses 30-day caching to minimize API costs.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import time
import json
import re
from datetime import datetime, timedelta

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
GOOGLE_API_KEY = "AIzaSyAWS3lz7Tk-61z82gMN-Ck1-nxTzUVxjU4"
PLACES_TEXT_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"

# Cache settings
CACHE_TTL_DAYS = 30

# Search types and their queries
SEARCH_TYPES = {
    "townhome": "townhome community in",
    "apartment": "apartment complex in",
    "condo": "condominium in",
    "mobile_home": "mobile home park in",
}

# Rate limiting
REQUESTS_PER_SECOND = 10
last_request_time = 0

def get_connection():
    return psycopg2.connect(CONNECTION_STRING)

def rate_limit():
    """Ensure we don't exceed rate limits."""
    global last_request_time
    elapsed = time.time() - last_request_time
    min_interval = 1.0 / REQUESTS_PER_SECOND
    if elapsed < min_interval:
        time.sleep(min_interval - elapsed)
    last_request_time = time.time()

def get_cached_results(cursor, cache_key):
    """Check if we have cached results."""
    cursor.execute("""
        SELECT response, fetched_at
        FROM api_cache
        WHERE cache_key = %s
        AND fetched_at > NOW() - INTERVAL '%s days'
    """, (cache_key, CACHE_TTL_DAYS))

    result = cursor.fetchone()
    if result and result['response']:
        # response is already JSONB, no need to json.loads
        return result['response']
    return None

def cache_results(cursor, conn, cache_key, data):
    """Cache the API response."""
    cursor.execute("""
        INSERT INTO api_cache (cache_key, endpoint, response, fetched_at, expires_at)
        VALUES (%s, %s, %s, NOW(), NOW() + INTERVAL '%s days')
        ON CONFLICT (cache_key) DO UPDATE SET
            response = EXCLUDED.response,
            fetched_at = EXCLUDED.fetched_at,
            expires_at = EXCLUDED.expires_at
    """, (cache_key, 'google_places_housing', json.dumps(data), CACHE_TTL_DAYS))
    conn.commit()

def search_housing(query, page_token=None):
    """Search Google Places for housing communities."""
    rate_limit()

    params = {
        "query": query,
        "key": GOOGLE_API_KEY,
    }

    if page_token:
        params["pagetoken"] = page_token
        time.sleep(2)  # Required delay for page tokens

    response = requests.get(PLACES_TEXT_URL, params=params)
    return response.json()

def categorize_community(name, search_type):
    """Categorize community based on name and search type."""
    name_lower = name.lower()

    # Check name for explicit type indicators
    if any(x in name_lower for x in ['townhome', 'townhouse', 'town home', 'th ']):
        return 'townhome'
    elif any(x in name_lower for x in ['apartment', 'apts', ' apt ', 'flats']):
        return 'apartment'
    elif any(x in name_lower for x in ['condo', 'condominium']):
        return 'condo'
    elif any(x in name_lower for x in ['mobile', 'manufactured', 'trailer', 'rv park']):
        return 'mobile_home'

    # Fall back to search type
    return search_type

def extract_city_state_zip(address):
    """Extract city, state, ZIP from address string."""
    if not address:
        return None, None, None

    # Pattern for "City, ST ZIP" or "City, ST ZIP, USA"
    pattern = r'([^,]+),\s*([A-Z]{2})\s*(\d{5})?'

    # Split by comma and work backwards
    parts = address.split(',')

    city = None
    state = None
    zip_code = None

    for i, part in enumerate(reversed(parts)):
        part = part.strip()

        # Skip USA/United States
        if part.upper() in ['USA', 'UNITED STATES']:
            continue

        # Look for state and ZIP
        match = re.search(r'([A-Z]{2})\s*(\d{5})?', part)
        if match and not state:
            state = match.group(1)
            if match.group(2):
                zip_code = match.group(2)
            # City is the previous part
            if i + 1 < len(parts):
                city = parts[-(i+2)].strip()
            break

    return city, state, zip_code

def fetch_communities_for_county(cursor, conn, county_fips, county_name, state):
    """Fetch all housing community types for a county."""
    all_communities = []
    cache_hits = 0
    api_calls = 0

    for search_type, query_prefix in SEARCH_TYPES.items():
        cache_key = f"housing:{county_fips}:{search_type}"

        # Check cache first
        cached = get_cached_results(cursor, cache_key)
        if cached:
            cache_hits += 1
            all_communities.extend(cached)
            continue

        # Fetch from Google Places
        query = f"{query_prefix} {county_name} County, {state}"
        communities = []
        next_page_token = None

        while True:
            api_calls += 1
            result = search_housing(query, next_page_token)

            if result.get('status') == 'OK':
                for place in result.get('results', []):
                    community = {
                        'place_id': place.get('place_id'),
                        'name': place.get('name'),
                        'address': place.get('formatted_address'),
                        'lat': place.get('geometry', {}).get('location', {}).get('lat'),
                        'lon': place.get('geometry', {}).get('location', {}).get('lng'),
                        'rating': place.get('rating'),
                        'review_count': place.get('user_ratings_total', 0),
                        'search_type': search_type,
                        'county_fips': county_fips,
                    }
                    communities.append(community)

                next_page_token = result.get('next_page_token')
                if not next_page_token:
                    break
            else:
                break

        # Cache results
        cache_results(cursor, conn, cache_key, communities)
        all_communities.extend(communities)

    return all_communities, cache_hits, api_calls

def insert_communities(cursor, conn, communities):
    """Insert communities into housing_communities table."""
    inserted = 0
    skipped = 0

    for comm in communities:
        # Extract city, state, ZIP from address
        city, state, zip_code = extract_city_state_zip(comm.get('address'))

        # Categorize community type
        community_type = categorize_community(comm.get('name', ''), comm.get('search_type', 'apartment'))

        try:
            # Use INSERT ... ON CONFLICT to handle duplicates gracefully
            cursor.execute("""
                INSERT INTO housing_communities (
                    name, address, city, state, zip, county_fips,
                    lat, lon, community_type, status, total_units,
                    source, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                )
                ON CONFLICT (name, city, state) DO NOTHING
            """, (
                comm.get('name'),
                comm.get('address'),
                city,
                state,
                zip_code,
                comm.get('county_fips'),
                comm.get('lat'),
                comm.get('lon'),
                community_type,
                'existing',
                None,  # total_units - not available from Google
                'google_places',
            ))
            if cursor.rowcount > 0:
                inserted += 1
            else:
                skipped += 1
        except Exception as e:
            conn.rollback()
            print(f"      Error inserting {comm.get('name')}: {e}")
            skipped += 1

    conn.commit()
    return inserted, skipped

def build_housing_communities():
    """Main function to build housing communities data."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("=" * 70)
    print("LAYER 5a - HOUSING COMMUNITIES BUILDER")
    print("=" * 70)

    # Get all counties
    cursor.execute("""
        SELECT county_fips, county_name, state, total_population
        FROM layer_3_counties
        ORDER BY total_population DESC
    """)
    counties = cursor.fetchall()
    print(f"\n   Counties to process: {len(counties)}")
    print(f"   Search types: {', '.join(SEARCH_TYPES.keys())}")
    print(f"   Cache TTL: {CACHE_TTL_DAYS} days")

    # Track stats
    total_communities = 0
    total_cache_hits = 0
    total_api_calls = 0
    total_inserted = 0
    total_skipped = 0
    start_time = time.time()

    print(f"\n   Processing counties...")
    print(f"   {'#':<4} {'County':<25} {'ST':<4} {'Found':<8} {'Inserted':<10} {'Cache':<6} {'API'}")
    print(f"   {'-'*4} {'-'*25} {'-'*4} {'-'*8} {'-'*10} {'-'*6} {'-'*6}")

    for i, county in enumerate(counties):
        county_fips = county['county_fips']
        county_name = county['county_name']
        state = county['state']

        # Fetch communities
        communities, cache_hits, api_calls = fetch_communities_for_county(
            cursor, conn, county_fips, county_name, state
        )

        # Insert into database
        inserted, skipped = insert_communities(cursor, conn, communities)

        # Update stats
        total_communities += len(communities)
        total_cache_hits += cache_hits
        total_api_calls += api_calls
        total_inserted += inserted
        total_skipped += skipped

        print(f"   {i+1:<4} {county_name[:25]:<25} {state:<4} {len(communities):<8} {inserted:<10} {cache_hits:<6} {api_calls}")

    elapsed = time.time() - start_time

    print(f"\n" + "=" * 70)
    print("HOUSING COMMUNITIES FETCH COMPLETE")
    print("=" * 70)
    print(f"\n   Total communities found: {total_communities:,}")
    print(f"   Inserted: {total_inserted:,}")
    print(f"   Skipped (duplicates): {total_skipped:,}")
    print(f"   Cache hits: {total_cache_hits}")
    print(f"   API calls: {total_api_calls}")
    print(f"   Time elapsed: {elapsed:.1f} seconds")

    conn.close()
    return total_inserted

def verify_and_report():
    """Generate verification report."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print(f"\n" + "=" * 70)
    print("HOUSING COMMUNITIES VERIFICATION REPORT")
    print("=" * 70)

    # Total count
    cursor.execute("SELECT COUNT(*) as cnt FROM housing_communities")
    total = cursor.fetchone()['cnt']
    print(f"\n   Total Housing Communities: {total:,}")

    # By community type
    cursor.execute("""
        SELECT community_type, COUNT(*) as cnt
        FROM housing_communities
        GROUP BY community_type
        ORDER BY cnt DESC
    """)
    print(f"\n   By Community Type:")
    for row in cursor.fetchall():
        print(f"      {row['community_type']}: {row['cnt']:,}")

    # By state
    cursor.execute("""
        SELECT state, COUNT(*) as cnt
        FROM housing_communities
        GROUP BY state
        ORDER BY cnt DESC
    """)
    print(f"\n   By State:")
    for row in cursor.fetchall():
        state = row['state'] or 'Unknown'
        print(f"      {state}: {row['cnt']:,}")

    # Top counties by community count
    cursor.execute("""
        SELECT hc.county_fips, l3.county_name, l3.state, COUNT(*) as cnt
        FROM housing_communities hc
        JOIN layer_3_counties l3 ON hc.county_fips = l3.county_fips
        GROUP BY hc.county_fips, l3.county_name, l3.state
        ORDER BY cnt DESC
        LIMIT 15
    """)
    print(f"\n   Top 15 Counties by Community Count:")
    print(f"   {'County':<25} {'ST':<4} {'Communities'}")
    print(f"   {'-'*25} {'-'*4} {'-'*12}")
    for row in cursor.fetchall():
        print(f"   {row['county_name'][:25]:<25} {row['state']:<4} {row['cnt']:>10,}")

    # Counties with most apartments (high storage demand)
    cursor.execute("""
        SELECT hc.county_fips, l3.county_name, l3.state,
               COUNT(*) FILTER (WHERE hc.community_type = 'apartment') as apartments,
               COUNT(*) FILTER (WHERE hc.community_type = 'townhome') as townhomes,
               COUNT(*) FILTER (WHERE hc.community_type = 'condo') as condos,
               COUNT(*) FILTER (WHERE hc.community_type = 'mobile_home') as mobile
        FROM housing_communities hc
        JOIN layer_3_counties l3 ON hc.county_fips = l3.county_fips
        GROUP BY hc.county_fips, l3.county_name, l3.state
        ORDER BY apartments DESC
        LIMIT 15
    """)
    print(f"\n   Top 15 Counties by Apartment Count (High Storage Demand):")
    print(f"   {'County':<25} {'ST':<4} {'Apt':<8} {'TH':<8} {'Condo':<8} {'Mobile'}")
    print(f"   {'-'*25} {'-'*4} {'-'*8} {'-'*8} {'-'*8} {'-'*8}")
    for row in cursor.fetchall():
        print(f"   {row['county_name'][:25]:<25} {row['state']:<4} {row['apartments']:>6} {row['townhomes']:>6} {row['condos']:>6} {row['mobile']:>6}")

    # Average rating by type
    cursor.execute("""
        SELECT community_type,
               ROUND(AVG(CASE WHEN rating IS NOT NULL THEN rating END), 2) as avg_rating,
               SUM(COALESCE(review_count, 0)) as total_reviews
        FROM housing_communities
        GROUP BY community_type
        ORDER BY avg_rating DESC NULLS LAST
    """)
    print(f"\n   Average Rating by Type:")
    print(f"   {'Type':<15} {'Avg Rating':<12} {'Total Reviews'}")
    print(f"   {'-'*15} {'-'*12} {'-'*15}")
    for row in cursor.fetchall():
        rating = row['avg_rating'] if row['avg_rating'] else 'N/A'
        reviews = row['total_reviews'] or 0
        print(f"   {row['community_type']:<15} {str(rating):<12} {reviews:>13,}")

    print(f"\n" + "=" * 70)
    print("LAYER 5a COMPLETE")
    print("=" * 70)

    conn.close()
    return total

if __name__ == "__main__":
    # Build housing communities
    inserted = build_housing_communities()

    # Verify and report
    total = verify_and_report()

    print(f"\n   Note: total_units is NULL for all records")
    print(f"   Manual research needed for key communities")
    print(f"\n   Ready for Layer 5b: Pipeline/Under Construction additions")
