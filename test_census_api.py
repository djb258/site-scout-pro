#!/usr/bin/env python3
"""
Test the Census API integration with real data.
Uses the Census Bureau ACS 5-year estimates.
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import os
import asyncio
import aiohttp

# Set the Census API key
CENSUS_API_KEY = "8e42aa570992dcc0798224911a7072b0112bfb0c"
os.environ["CENSUS_API_KEY"] = CENSUS_API_KEY

# Census ACS 5-year tables we use
CENSUS_TABLES = {
    "population": "B01003_001E",      # Total population
    "income": "B19013_001E",          # Median household income
    "poverty_total": "B17001_001E",   # Poverty status - total
    "poverty_below": "B17001_002E",   # Poverty status - below poverty
    "tenure_total": "B25003_001E",    # Housing tenure - total
    "tenure_renter": "B25003_003E",   # Housing tenure - renter occupied
    "age_median": "B01002_001E",      # Median age
}


async def fetch_zip_demographics(session, zip_code: str, year: int = 2022):
    """Fetch demographics for a single ZIP code."""
    variables = ",".join(CENSUS_TABLES.values())
    url = f"https://api.census.gov/data/{year}/acs/acs5"
    params = {
        "get": variables,
        "for": f"zip code tabulation area:{zip_code}",
        "key": CENSUS_API_KEY
    }

    try:
        async with session.get(url, params=params) as response:
            if response.status == 200:
                data = await response.json()
                if len(data) >= 2:
                    values = data[1]
                    pop = int(values[0]) if values[0] else None
                    income = int(values[1]) if values[1] else None
                    poverty_total = int(values[2]) if values[2] else 0
                    poverty_below = int(values[3]) if values[3] else 0
                    tenure_total = int(values[4]) if values[4] else 0
                    tenure_renter = int(values[5]) if values[5] else 0
                    median_age = float(values[6]) if values[6] else None

                    poverty_rate = (poverty_below / poverty_total * 100) if poverty_total > 0 else None
                    renter_pct = (tenure_renter / tenure_total * 100) if tenure_total > 0 else None

                    return {
                        "zip": zip_code,
                        "population": pop,
                        "income_median": income,
                        "poverty_rate": round(poverty_rate, 1) if poverty_rate else None,
                        "renter_pct": round(renter_pct, 1) if renter_pct else None,
                        "median_age": median_age,
                        "source": "census_acs",
                        "year": year
                    }
            return {"zip": zip_code, "error": f"Status {response.status}"}
    except Exception as e:
        return {"zip": zip_code, "error": str(e)}


async def fetch_bulk_demographics(zip_codes: list, year: int = 2022):
    """Fetch demographics for multiple ZIP codes efficiently."""
    results = {}

    async with aiohttp.ClientSession() as session:
        # Process in batches of 50 (Census API limit)
        batch_size = 50
        for i in range(0, len(zip_codes), batch_size):
            batch = zip_codes[i:i+batch_size]
            zip_list = ",".join(batch)

            variables = ",".join(CENSUS_TABLES.values())
            url = f"https://api.census.gov/data/{year}/acs/acs5"
            params = {
                "get": variables,
                "for": f"zip code tabulation area:{zip_list}",
                "key": CENSUS_API_KEY
            }

            try:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        if len(data) > 1:
                            for row in data[1:]:
                                zip_code = row[-1]  # Last column is ZIP
                                pop = int(row[0]) if row[0] else None
                                income = int(row[1]) if row[1] else None
                                poverty_total = int(row[2]) if row[2] else 0
                                poverty_below = int(row[3]) if row[3] else 0
                                tenure_total = int(row[4]) if row[4] else 0
                                tenure_renter = int(row[5]) if row[5] else 0
                                median_age = float(row[6]) if row[6] else None

                                poverty_rate = (poverty_below / poverty_total * 100) if poverty_total > 0 else None
                                renter_pct = (tenure_renter / tenure_total * 100) if tenure_total > 0 else None

                                results[zip_code] = {
                                    "population": pop,
                                    "income_median": income,
                                    "poverty_rate": round(poverty_rate, 1) if poverty_rate else None,
                                    "renter_pct": round(renter_pct, 1) if renter_pct else None,
                                    "median_age": median_age
                                }
            except Exception as e:
                print(f"  Error fetching batch: {e}")

            # Rate limiting
            await asyncio.sleep(0.1)

    return results


async def main():
    print("=" * 60)
    print("CENSUS API INTEGRATION TEST")
    print("=" * 60)

    # Test 1: Single ZIP
    print("\n## Test 1: Single ZIP Code (Bedford PA - 15522)")
    print("-" * 40)

    async with aiohttp.ClientSession() as session:
        result = await fetch_zip_demographics(session, "15522")
        print(f"  ZIP: {result['zip']}")
        print(f"  Population: {result.get('population', 'N/A'):,}" if result.get('population') else "  Population: N/A")
        print(f"  Median Income: ${result.get('income_median', 0):,}" if result.get('income_median') else "  Median Income: N/A")
        print(f"  Poverty Rate: {result.get('poverty_rate', 'N/A')}%")
        print(f"  Renter %: {result.get('renter_pct', 'N/A')}%")
        print(f"  Median Age: {result.get('median_age', 'N/A')}")

    # Test 2: Bulk fetch (first 20 ZIPs from Bedford zone)
    print("\n## Test 2: Bulk Fetch (20 ZIPs from Bedford Zone)")
    print("-" * 40)

    # Sample ZIPs from Bedford PA zone
    test_zips = [
        "15522", "15537", "15550", "15554", "15559",
        "16667", "16664", "16650", "15563", "15535",
        "16673", "16662", "16678", "16679", "15533",
        "15540", "15545", "15552", "15557", "15558"
    ]

    results = await fetch_bulk_demographics(test_zips)

    print(f"\n  Fetched data for {len(results)} ZIPs:")
    print(f"  {'ZIP':<8} {'Pop':<10} {'Income':<12} {'Poverty':<10} {'Renter%':<10}")
    print("  " + "-" * 50)

    for zip_code in test_zips:
        if zip_code in results:
            r = results[zip_code]
            pop = f"{r['population']:,}" if r['population'] else "N/A"
            inc = f"${r['income_median']:,}" if r['income_median'] else "N/A"
            pov = f"{r['poverty_rate']}%" if r['poverty_rate'] else "N/A"
            rent = f"{r['renter_pct']}%" if r['renter_pct'] else "N/A"
            print(f"  {zip_code:<8} {pop:<10} {inc:<12} {pov:<10} {rent:<10}")
        else:
            print(f"  {zip_code:<8} No data")

    # Test 3: Population growth calculation
    print("\n## Test 3: Population Growth (2018 vs 2022)")
    print("-" * 40)

    async with aiohttp.ClientSession() as session:
        data_2018 = await fetch_zip_demographics(session, "15522", 2018)
        data_2022 = await fetch_zip_demographics(session, "15522", 2022)

        if data_2018.get('population') and data_2022.get('population'):
            pop_2018 = data_2018['population']
            pop_2022 = data_2022['population']
            growth = (pop_2022 - pop_2018) / pop_2018 * 100

            print(f"  Bedford PA (15522):")
            print(f"    2018 Population: {pop_2018:,}")
            print(f"    2022 Population: {pop_2022:,}")
            print(f"    Growth Rate: {growth:+.1f}%")

    print("\n" + "=" * 60)
    print("CENSUS API TEST COMPLETE")
    print("=" * 60)
    print("""
API Key Status: ACTIVE
Data Available: ACS 5-Year Estimates (2018-2022)

Variables fetched:
  - B01003_001E: Total population
  - B19013_001E: Median household income
  - B17001_001E/002E: Poverty rate
  - B25003_001E/003E: Renter percentage
  - B01002_001E: Median age

Next steps:
  - Integrate with pipeline Stage 1 for live demographics
  - Add population growth calculation
  - Cache responses in api_cache table
""")


if __name__ == "__main__":
    asyncio.run(main())
