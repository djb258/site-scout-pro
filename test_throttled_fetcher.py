"""
Test the throttled data fetcher with caching.
Run this twice to see caching in action.
"""
import os
import sys
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set connection string
os.environ["NEON_CONNECTION_STRING"] = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

from backend.services.data_fetcher_service import fetch_zip_data_sync

def main():
    zip_code = "15522"  # Bedford PA

    print("=" * 60)
    print(f"FIRST FETCH - ZIP {zip_code} (should make API calls if not cached)")
    print("=" * 60)

    data = fetch_zip_data_sync(zip_code)

    print(f"\nResults:")
    print(f"  ZIP: {data.get('zip')}")
    print(f"  API Calls Made: {data.get('api_calls_made', 'N/A')}")
    print(f"  Cache Hits: {data.get('cache_hits', 'N/A')}")
    print(f"  Errors: {data.get('errors', [])}")

    # Census
    census = data.get("census", {})
    if census:
        print(f"\n  Census Data:")
        print(f"    Population: {census.get('population')}")
        print(f"    Median Income: ${census.get('income_median'):,}" if census.get('income_median') else "    Median Income: N/A")

    # Storage Facilities
    facilities = data.get("storage_facilities", [])
    print(f"\n  Storage Facilities Found: {len(facilities)}")
    for i, f in enumerate(facilities[:5], 1):
        print(f"    {i}. {f.get('name')} - Rating: {f.get('rating', 'N/A')}")

    # Water Bodies
    water = data.get("water_bodies", [])
    print(f"\n  Water Bodies Found: {len(water)}")
    for i, w in enumerate(water[:3], 1):
        print(f"    {i}. {w.get('name')} ({w.get('type')})")

    print("\n" + "=" * 60)
    print("SECOND FETCH - Same ZIP (should be ALL cache hits)")
    print("=" * 60)

    data2 = fetch_zip_data_sync(zip_code)

    print(f"\nResults:")
    print(f"  API Calls Made: {data2.get('api_calls_made', 'N/A')}")
    print(f"  Cache Hits: {data2.get('cache_hits', 'N/A')}")

    # If we got master cache hit, it won't have these fields
    if 'api_calls_made' not in data2:
        print("  (Returned from master cache - no individual API tracking)")

    print("\n" + "=" * 60)
    print("FORCE REFRESH - Same ZIP (should make fresh API calls)")
    print("=" * 60)

    data3 = fetch_zip_data_sync(zip_code, force_refresh=True)

    print(f"\nResults:")
    print(f"  API Calls Made: {data3.get('api_calls_made', 'N/A')}")
    print(f"  Cache Hits: {data3.get('cache_hits', 'N/A')}")
    print(f"  Storage Facilities: {len(data3.get('storage_facilities', []))}")

if __name__ == "__main__":
    main()
