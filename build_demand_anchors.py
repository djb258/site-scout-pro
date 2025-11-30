"""
Layer 5b - Demand Anchors Builder
Fetches demand anchors (colleges, military, hospitals, large employers, RV/boat, mobile homes)
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
    # Colleges
    "college_university": "university in",
    "college_college": "college in",
    "college_community": "community college in",

    # Military
    "military_base": "military base in",
    "military_guard": "national guard in",
    "military_army": "army base in",
    "military_airforce": "air force base in",

    # Hospitals
    "hospital_hospital": "hospital in",
    "hospital_medical": "medical center in",

    # Large Employers
    "employer_distribution": "distribution center in",
    "employer_warehouse": "warehouse in",
    "employer_manufacturing": "manufacturing plant in",

    # RV/Boat
    "rvboat_rv": "rv park in",
    "rvboat_marina": "marina in",

    # Mobile Home
    "mobile_park": "mobile home park in",
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
    """, (cache_key, 'google_places_anchors', json.dumps(data), CACHE_TTL_DAYS))
    conn.commit()

def search_places(query, page_token=None):
    """Search Google Places."""
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

def categorize_anchor(name, search_type):
    """Categorize anchor based on name and search type."""
    name_lower = name.lower()

    # Colleges
    if any(x in name_lower for x in ['university', 'univ ', 'u of ']):
        return 'university'
    elif any(x in name_lower for x in ['community college', 'cc ']):
        return 'community_college'
    elif any(x in name_lower for x in ['college', 'institute', 'academy']):
        return 'college'

    # Military
    elif any(x in name_lower for x in ['army', 'fort ', 'camp ']):
        return 'military_army'
    elif any(x in name_lower for x in ['air force', 'afb', 'air base']):
        return 'military_airforce'
    elif any(x in name_lower for x in ['navy', 'naval', 'nas ']):
        return 'military_navy'
    elif any(x in name_lower for x in ['national guard', 'armory']):
        return 'military_guard'
    elif any(x in name_lower for x in ['military', 'base', 'reserve']):
        return 'military_base'

    # Hospitals
    elif any(x in name_lower for x in ['hospital', 'medical center', 'med center']):
        return 'hospital'
    elif any(x in name_lower for x in ['clinic', 'health center']):
        return 'clinic'

    # Employers
    elif any(x in name_lower for x in ['distribution', 'logistics', 'fulfillment']):
        return 'distribution_center'
    elif any(x in name_lower for x in ['warehouse', 'storage']):
        return 'warehouse'
    elif any(x in name_lower for x in ['manufacturing', 'plant', 'factory', 'mill']):
        return 'manufacturing'

    # RV/Boat
    elif any(x in name_lower for x in ['rv park', 'rv resort', 'campground', 'camping']):
        return 'rv_park'
    elif any(x in name_lower for x in ['marina', 'yacht', 'boat']):
        return 'marina'

    # Mobile Home
    elif any(x in name_lower for x in ['mobile home', 'manufactured', 'trailer park']):
        return 'mobile_home_park'

    # Fall back to search type category
    if search_type.startswith('college'):
        return 'college'
    elif search_type.startswith('military'):
        return 'military_base'
    elif search_type.startswith('hospital'):
        return 'hospital'
    elif search_type.startswith('employer'):
        return 'large_employer'
    elif search_type.startswith('rvboat'):
        return 'rv_boat'
    elif search_type.startswith('mobile'):
        return 'mobile_home_park'

    return 'other'

def estimate_size(review_count):
    """Estimate size based on review count."""
    if review_count is None:
        return 'unknown'
    elif review_count > 500:
        return 'large'
    elif review_count >= 100:
        return 'medium'
    else:
        return 'small'

def extract_city_state_zip(address):
    """Extract city, state, ZIP from address string."""
    if not address:
        return None, None, None

    parts = address.split(',')
    city = None
    state = None
    zip_code = None

    for i, part in enumerate(reversed(parts)):
        part = part.strip()

        if part.upper() in ['USA', 'UNITED STATES']:
            continue

        match = re.search(r'([A-Z]{2})\s*(\d{5})?', part)
        if match and not state:
            state = match.group(1)
            if match.group(2):
                zip_code = match.group(2)
            if i + 1 < len(parts):
                city = parts[-(i+2)].strip()
            break

    return city, state, zip_code

def fetch_anchors_for_county(cursor, conn, county_fips, county_name, state):
    """Fetch all anchor types for a county."""
    all_anchors = []
    cache_hits = 0
    api_calls = 0

    for search_type, query_prefix in SEARCH_TYPES.items():
        cache_key = f"anchors:{county_fips}:{search_type}"

        # Check cache first
        cached = get_cached_results(cursor, cache_key)
        if cached:
            cache_hits += 1
            all_anchors.extend(cached)
            continue

        # Fetch from Google Places
        query = f"{query_prefix} {county_name} County, {state}"
        anchors = []
        next_page_token = None

        while True:
            api_calls += 1
            result = search_places(query, next_page_token)

            if result.get('status') == 'OK':
                for place in result.get('results', []):
                    anchor = {
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
                    anchors.append(anchor)

                next_page_token = result.get('next_page_token')
                if not next_page_token:
                    break
            else:
                break

        # Cache results
        cache_results(cursor, conn, cache_key, anchors)
        all_anchors.extend(anchors)

    return all_anchors, cache_hits, api_calls

def insert_anchors(cursor, conn, anchors):
    """Insert anchors into demand_anchors table."""
    inserted = 0
    skipped = 0

    for anchor in anchors:
        # Extract city, state, ZIP from address
        city, state, zip_code = extract_city_state_zip(anchor.get('address'))

        # Categorize anchor type
        anchor_type = categorize_anchor(anchor.get('name', ''), anchor.get('search_type', ''))

        # Estimate size
        size_estimate = estimate_size(anchor.get('review_count'))

        try:
            cursor.execute("""
                INSERT INTO demand_anchors (
                    place_id, name, anchor_type, address, city, state, zip,
                    county_fips, lat, lon, size_estimate, source, fetched_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                )
                ON CONFLICT (place_id) DO NOTHING
            """, (
                anchor.get('place_id'),
                anchor.get('name'),
                anchor_type,
                anchor.get('address'),
                city,
                state,
                zip_code,
                anchor.get('county_fips'),
                anchor.get('lat'),
                anchor.get('lon'),
                size_estimate,
                'google_places',
            ))
            if cursor.rowcount > 0:
                inserted += 1
            else:
                skipped += 1
        except Exception as e:
            conn.rollback()
            print(f"      Error inserting {anchor.get('name')}: {e}")
            skipped += 1

    conn.commit()
    return inserted, skipped

def build_demand_anchors():
    """Main function to build demand anchors data."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("=" * 70)
    print("LAYER 5b - DEMAND ANCHORS BUILDER")
    print("=" * 70)

    # Check if place_id has unique constraint
    cursor.execute("""
        SELECT COUNT(*) as cnt FROM pg_constraint
        WHERE conname = 'demand_anchors_place_id_key'
    """)
    if cursor.fetchone()['cnt'] == 0:
        print("\n   Adding unique constraint on place_id...")
        cursor.execute("""
            ALTER TABLE demand_anchors ADD CONSTRAINT demand_anchors_place_id_key UNIQUE (place_id)
        """)
        conn.commit()

    # Get all counties
    cursor.execute("""
        SELECT county_fips, county_name, state, total_population
        FROM layer_3_counties
        ORDER BY total_population DESC
    """)
    counties = cursor.fetchall()
    print(f"\n   Counties to process: {len(counties)}")
    print(f"   Search types: {len(SEARCH_TYPES)}")
    print(f"   Cache TTL: {CACHE_TTL_DAYS} days")

    # Track stats
    total_anchors = 0
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

        # Fetch anchors
        anchors, cache_hits, api_calls = fetch_anchors_for_county(
            cursor, conn, county_fips, county_name, state
        )

        # Insert into database
        inserted, skipped = insert_anchors(cursor, conn, anchors)

        # Update stats
        total_anchors += len(anchors)
        total_cache_hits += cache_hits
        total_api_calls += api_calls
        total_inserted += inserted
        total_skipped += skipped

        print(f"   {i+1:<4} {county_name[:25]:<25} {state:<4} {len(anchors):<8} {inserted:<10} {cache_hits:<6} {api_calls}")

    elapsed = time.time() - start_time

    print(f"\n" + "=" * 70)
    print("DEMAND ANCHORS FETCH COMPLETE")
    print("=" * 70)
    print(f"\n   Total anchors found: {total_anchors:,}")
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
    print("DEMAND ANCHORS VERIFICATION REPORT")
    print("=" * 70)

    # Total count
    cursor.execute("SELECT COUNT(*) as cnt FROM demand_anchors")
    total = cursor.fetchone()['cnt']
    print(f"\n   Total Demand Anchors: {total:,}")

    # By anchor type
    cursor.execute("""
        SELECT anchor_type, COUNT(*) as cnt
        FROM demand_anchors
        GROUP BY anchor_type
        ORDER BY cnt DESC
    """)
    print(f"\n   By Anchor Type:")
    for row in cursor.fetchall():
        print(f"      {row['anchor_type']}: {row['cnt']:,}")

    # By size estimate
    cursor.execute("""
        SELECT size_estimate, COUNT(*) as cnt
        FROM demand_anchors
        GROUP BY size_estimate
        ORDER BY cnt DESC
    """)
    print(f"\n   By Size Estimate:")
    for row in cursor.fetchall():
        print(f"      {row['size_estimate']}: {row['cnt']:,}")

    # By state
    cursor.execute("""
        SELECT state, COUNT(*) as cnt
        FROM demand_anchors
        GROUP BY state
        ORDER BY cnt DESC
    """)
    print(f"\n   By State:")
    for row in cursor.fetchall():
        state = row['state'] or 'Unknown'
        print(f"      {state}: {row['cnt']:,}")

    # Top counties by anchor count
    cursor.execute("""
        SELECT da.county_fips, l3.county_name, l3.state, COUNT(*) as cnt
        FROM demand_anchors da
        JOIN layer_3_counties l3 ON da.county_fips = l3.county_fips
        GROUP BY da.county_fips, l3.county_name, l3.state
        ORDER BY cnt DESC
        LIMIT 15
    """)
    print(f"\n   Top 15 Counties by Anchor Count:")
    print(f"   {'County':<25} {'ST':<4} {'Anchors'}")
    print(f"   {'-'*25} {'-'*4} {'-'*10}")
    for row in cursor.fetchall():
        print(f"   {row['county_name'][:25]:<25} {row['state']:<4} {row['cnt']:>8,}")

    # Anchor type breakdown by category
    cursor.execute("""
        SELECT
            da.county_fips, l3.county_name, l3.state,
            COUNT(*) FILTER (WHERE da.anchor_type IN ('university', 'college', 'community_college')) as colleges,
            COUNT(*) FILTER (WHERE da.anchor_type LIKE 'military%') as military,
            COUNT(*) FILTER (WHERE da.anchor_type IN ('hospital', 'clinic')) as hospitals,
            COUNT(*) FILTER (WHERE da.anchor_type IN ('distribution_center', 'warehouse', 'manufacturing', 'large_employer')) as employers,
            COUNT(*) FILTER (WHERE da.anchor_type IN ('rv_park', 'marina')) as rv_boat,
            COUNT(*) FILTER (WHERE da.anchor_type = 'mobile_home_park') as mobile
        FROM demand_anchors da
        JOIN layer_3_counties l3 ON da.county_fips = l3.county_fips
        GROUP BY da.county_fips, l3.county_name, l3.state
        ORDER BY colleges + military DESC
        LIMIT 15
    """)
    print(f"\n   Top 15 Counties by High-Value Anchors (Colleges + Military):")
    print(f"   {'County':<25} {'ST':<4} {'College':<8} {'Military':<8} {'Hospital':<8} {'Employer':<8} {'RV/Boat':<8} {'Mobile'}")
    print(f"   {'-'*25} {'-'*4} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8}")
    for row in cursor.fetchall():
        print(f"   {row['county_name'][:25]:<25} {row['state']:<4} {row['colleges']:>6} {row['military']:>6} {row['hospitals']:>6} {row['employers']:>6} {row['rv_boat']:>6} {row['mobile']:>6}")

    # Large anchors (high visibility/demand)
    cursor.execute("""
        SELECT name, anchor_type, city, state, size_estimate
        FROM demand_anchors
        WHERE size_estimate = 'large'
        ORDER BY anchor_type, name
        LIMIT 20
    """)
    print(f"\n   Sample Large Anchors (High Demand Generators):")
    print(f"   {'Name':<40} {'Type':<20} {'City':<20} {'ST'}")
    print(f"   {'-'*40} {'-'*20} {'-'*20} {'-'*4}")
    for row in cursor.fetchall():
        name = (row['name'] or '')[:40]
        anchor_type = (row['anchor_type'] or '')[:20]
        city = (row['city'] or '')[:20]
        state = row['state'] or ''
        print(f"   {name:<40} {anchor_type:<20} {city:<20} {state}")

    print(f"\n" + "=" * 70)
    print("LAYER 5b COMPLETE")
    print("=" * 70)

    conn.close()
    return total

if __name__ == "__main__":
    # Build demand anchors
    inserted = build_demand_anchors()

    # Verify and report
    total = verify_and_report()

    print(f"\n   Ready for Layer 6: Flood Zones")
