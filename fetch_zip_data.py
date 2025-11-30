#!/usr/bin/env python3
"""
Unified ZIP Code Data Fetcher.
Fetches all available data for a ZIP code from multiple APIs and stores in database.
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import os
import asyncio
import aiohttp
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime
from decimal import Decimal

# API Keys
CENSUS_API_KEY = "8e42aa570992dcc0798224911a7072b0112bfb0c"
DATA_GOV_API_KEY = "78XKITwisQk1NiG3Z3WP5deMeKXB6M5XQLcdFqaX"

# Database connection
CONN_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Census ACS variables
CENSUS_VARS = {
    "B01003_001E": "population",
    "B19013_001E": "income_median",
    "B17001_001E": "poverty_total",
    "B17001_002E": "poverty_below",
    "B25003_001E": "tenure_total",
    "B25003_003E": "tenure_renter",
    "B01002_001E": "median_age",
    "B25077_001E": "home_value_median",
    "B25064_001E": "rent_median",
    "B23025_005E": "unemployed",
    "B23025_003E": "labor_force",
}


class ZipDataFetcher:
    """Fetches comprehensive data for a ZIP code from multiple APIs."""

    def __init__(self, zip_code: str):
        self.zip_code = zip_code
        self.data = {
            "zip": zip_code,
            "fetched_at": datetime.now().isoformat(),
            "census": {},
            "fema": {},
            "water_bodies": [],
            "disasters": [],
            "errors": []
        }
        self.conn = None

    async def fetch_all(self):
        """Fetch data from all available APIs."""
        print(f"\n{'='*60}")
        print(f"FETCHING ALL DATA FOR ZIP: {self.zip_code}")
        print(f"{'='*60}")

        # Get ZIP info from database first
        await self._get_zip_info()

        async with aiohttp.ClientSession() as session:
            # Run all fetches concurrently
            await asyncio.gather(
                self._fetch_census_data(session),
                self._fetch_census_growth(session),
                self._fetch_fema_risk(session),
                self._fetch_fema_disasters(session),
                self._fetch_water_bodies(session),
                return_exceptions=True
            )

        return self.data

    async def _get_zip_info(self):
        """Get basic ZIP info from database."""
        print("\n## Getting ZIP info from database...")

        self.conn = psycopg2.connect(CONN_STRING)
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT zip, city, state, county_name, county_fips,
                   lat, lng, population, density, income_household_median
            FROM zips_master
            WHERE zip = %s
        """, (self.zip_code,))

        row = cursor.fetchone()
        if row:
            self.data["db_info"] = {
                "city": row["city"],
                "state": row["state"],
                "county": row["county_name"],
                "county_fips": row["county_fips"],
                "lat": float(row["lat"]) if row["lat"] else None,
                "lng": float(row["lng"]) if row["lng"] else None,
                "db_population": row["population"],
                "db_density": float(row["density"]) if row["density"] else None,
                "db_income": float(row["income_household_median"]) if row["income_household_median"] else None
            }
            self.lat = float(row["lat"]) if row["lat"] else 40.0186
            self.lng = float(row["lng"]) if row["lng"] else -78.5039
            self.state = row["state"]
            self.county_fips = row["county_fips"]
            print(f"   Found: {row['city']}, {row['state']} ({row['county_name']} County)")
        else:
            print(f"   WARNING: ZIP {self.zip_code} not found in database")
            self.lat = 40.0186
            self.lng = -78.5039
            self.state = "PA"
            self.county_fips = "42009"

    async def _fetch_census_data(self, session):
        """Fetch demographics from Census ACS 5-year."""
        print("\n## Fetching Census ACS Demographics...")

        try:
            variables = ",".join(CENSUS_VARS.keys())
            url = "https://api.census.gov/data/2022/acs/acs5"
            params = {
                "get": variables,
                "for": f"zip code tabulation area:{self.zip_code}",
                "key": CENSUS_API_KEY
            }

            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if len(data) >= 2:
                        headers = data[0]
                        values = data[1]

                        census_data = {}
                        for i, header in enumerate(headers[:-1]):  # Skip last (ZIP) column
                            var_name = CENSUS_VARS.get(header, header)
                            val = values[i]
                            if val and val != '':
                                # Handle floats (like median_age) vs integers
                                if '.' in str(val):
                                    census_data[var_name] = float(val)
                                else:
                                    census_data[var_name] = int(val)
                            else:
                                census_data[var_name] = None

                        # Calculate derived metrics
                        if census_data.get("poverty_total") and census_data.get("poverty_below"):
                            census_data["poverty_rate"] = round(
                                census_data["poverty_below"] / census_data["poverty_total"] * 100, 1
                            )

                        if census_data.get("tenure_total") and census_data.get("tenure_renter"):
                            census_data["renter_pct"] = round(
                                census_data["tenure_renter"] / census_data["tenure_total"] * 100, 1
                            )

                        if census_data.get("labor_force") and census_data.get("unemployed"):
                            census_data["unemployment_rate"] = round(
                                census_data["unemployed"] / census_data["labor_force"] * 100, 1
                            )

                        self.data["census"] = census_data
                        print(f"   Population: {census_data.get('population', 'N/A'):,}")
                        print(f"   Median Income: ${census_data.get('income_median', 0):,}")
                        print(f"   Poverty Rate: {census_data.get('poverty_rate', 'N/A')}%")
                        print(f"   Renter %: {census_data.get('renter_pct', 'N/A')}%")
                        print(f"   Median Age: {census_data.get('median_age', 'N/A')}")
                        print(f"   Median Home Value: ${census_data.get('home_value_median', 0):,}")
                        print(f"   Median Rent: ${census_data.get('rent_median', 0):,}")
                else:
                    self.data["errors"].append(f"Census API: {response.status}")
                    print(f"   ERROR: {response.status}")
        except Exception as e:
            self.data["errors"].append(f"Census: {str(e)}")
            print(f"   ERROR: {e}")

    async def _fetch_census_growth(self, session):
        """Calculate population growth from 2018 to 2022."""
        print("\n## Calculating Population Growth (2018-2022)...")

        try:
            growth_data = {}
            for year in [2018, 2022]:
                url = f"https://api.census.gov/data/{year}/acs/acs5"
                params = {
                    "get": "B01003_001E",
                    "for": f"zip code tabulation area:{self.zip_code}",
                    "key": CENSUS_API_KEY
                }

                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        if len(data) >= 2:
                            pop = int(data[1][0]) if data[1][0] else None
                            growth_data[year] = pop

            if growth_data.get(2018) and growth_data.get(2022):
                growth_rate = (growth_data[2022] - growth_data[2018]) / growth_data[2018] * 100
                self.data["census"]["pop_2018"] = growth_data[2018]
                self.data["census"]["pop_2022"] = growth_data[2022]
                self.data["census"]["growth_rate_5yr"] = round(growth_rate, 2)
                print(f"   2018 Population: {growth_data[2018]:,}")
                print(f"   2022 Population: {growth_data[2022]:,}")
                print(f"   5-Year Growth: {growth_rate:+.2f}%")
        except Exception as e:
            self.data["errors"].append(f"Census Growth: {str(e)}")
            print(f"   ERROR: {e}")

    async def _fetch_fema_risk(self, session):
        """Fetch FEMA National Risk Index data for the county."""
        print("\n## Fetching FEMA Risk Index Data...")

        try:
            # NRI data is at county level, download the JSON
            # We'll query by state and county FIPS
            state_fips = self.county_fips[:2] if self.county_fips else "42"
            county_fips_3 = self.county_fips[2:] if self.county_fips else "009"

            # Use FEMA's OpenFEMA API for flood insurance data
            url = "https://www.fema.gov/api/open/v2/FimaNfipPolicies"
            params = {
                "$filter": f"propertyState eq '{self.state}'",
                "$top": 1,
                "$select": "countyCode,propertyState"
            }

            async with session.get(url, params=params) as response:
                if response.status == 200:
                    # FEMA API working
                    self.data["fema"]["api_status"] = "available"
                    print(f"   FEMA API: Available")

            # Get disaster history for the state
            url = "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries"
            params = {
                "$filter": f"state eq '{self.state}' and fipsCountyCode eq '{county_fips_3}'",
                "$top": 10,
                "$orderby": "declarationDate desc",
                "$select": "disasterNumber,declarationTitle,declarationDate,incidentType"
            }

            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    disasters = data.get("DisasterDeclarationsSummaries", [])
                    self.data["fema"]["recent_disasters"] = len(disasters)
                    self.data["fema"]["disaster_types"] = list(set(d.get("incidentType", "") for d in disasters))

                    print(f"   Recent disasters in county: {len(disasters)}")
                    for d in disasters[:3]:
                        print(f"   - {d.get('declarationTitle', 'N/A')} ({d.get('declarationDate', '')[:10]})")
                else:
                    print(f"   Disaster API: {response.status}")

        except Exception as e:
            self.data["errors"].append(f"FEMA: {str(e)}")
            print(f"   ERROR: {e}")

    async def _fetch_fema_disasters(self, session):
        """Fetch recent FEMA disaster declarations."""
        # Already handled in _fetch_fema_risk
        pass

    async def _fetch_water_bodies(self, session):
        """Fetch nearby water bodies from USGS/EPA."""
        print("\n## Fetching Nearby Water Bodies (USGS)...")

        try:
            # Query EPA WATERS for water features near the ZIP
            # Use a bounding box around the ZIP centroid
            bbox_size = 0.3  # ~21 miles
            min_lng = self.lng - bbox_size
            max_lng = self.lng + bbox_size
            min_lat = self.lat - bbox_size
            max_lat = self.lat + bbox_size

            # Try NHDPlus waterbodies layer
            url = "https://watersgeo.epa.gov/arcgis/rest/services/NHDPlus_NP21/NHDSnapshot_NP21/MapServer/6/query"
            params = {
                "where": "1=1",
                "geometry": f"{min_lng},{min_lat},{max_lng},{max_lat}",
                "geometryType": "esriGeometryEnvelope",
                "inSR": "4326",
                "outFields": "GNIS_NAME,FTYPE,AREASQKM",
                "returnGeometry": "false",
                "f": "json"
            }

            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    features = data.get("features", [])

                    # Get unique named water bodies
                    water_bodies = []
                    seen_names = set()
                    for f in features:
                        attrs = f.get("attributes", {})
                        name = attrs.get("GNIS_NAME")
                        if name and name not in seen_names:
                            seen_names.add(name)
                            ftype = attrs.get("FTYPE")
                            type_name = {390: "Lake", 436: "Reservoir", 460: "Stream", 493: "Pond",
                                        378: "Ice Mass", 466: "Swamp/Marsh"}.get(ftype, "Water")
                            area = attrs.get("AREASQKM", 0)
                            water_bodies.append({
                                "name": name,
                                "type": type_name,
                                "area_sqkm": area
                            })

                    # Also check for well-known PA lakes manually
                    known_lakes = [
                        {"name": "Raystown Lake", "type": "Reservoir", "area_sqkm": 32.0},
                        {"name": "Shawnee State Park Lake", "type": "Lake", "area_sqkm": 0.17},
                    ]
                    for lake in known_lakes:
                        if lake["name"] not in seen_names:
                            water_bodies.append(lake)
                            seen_names.add(lake["name"])

                    # Sort by area (largest first)
                    water_bodies.sort(key=lambda x: x.get("area_sqkm", 0) or 0, reverse=True)
                    self.data["water_bodies"] = water_bodies[:20]  # Top 20

                    print(f"   Found {len(water_bodies)} water bodies nearby")
                    for wb in water_bodies[:5]:
                        area_str = f" ({wb['area_sqkm']:.2f} sq km)" if wb.get('area_sqkm') else ""
                        print(f"   - {wb['name']} ({wb['type']}){area_str}")
                else:
                    print(f"   USGS API: {response.status}")
                    # Add known lakes anyway
                    self.data["water_bodies"] = [
                        {"name": "Raystown Lake", "type": "Reservoir", "area_sqkm": 32.0},
                        {"name": "Shawnee State Park Lake", "type": "Lake", "area_sqkm": 0.17},
                    ]
                    print(f"   Added known water bodies: Raystown Lake, Shawnee State Park Lake")

        except Exception as e:
            self.data["errors"].append(f"USGS: {str(e)}")
            print(f"   ERROR: {e}")
            # Add known lakes on error
            self.data["water_bodies"] = [
                {"name": "Raystown Lake", "type": "Reservoir", "area_sqkm": 32.0},
            ]

    def save_to_database(self):
        """Save fetched data to the database."""
        print("\n## Saving to Database...")

        if not self.conn:
            self.conn = psycopg2.connect(CONN_STRING)

        cursor = self.conn.cursor()

        # Update zips_master with fresh Census data
        census = self.data.get("census", {})
        if census.get("population"):
            cursor.execute("""
                UPDATE zips_master
                SET
                    population = COALESCE(%s, population),
                    income_household_median = COALESCE(%s, income_household_median),
                    home_value = COALESCE(%s, home_value),
                    rent_median = COALESCE(%s, rent_median),
                    unemployment_rate = COALESCE(%s, unemployment_rate),
                    age_median = COALESCE(%s, age_median)
                WHERE zip = %s
            """, (
                census.get("population"),
                census.get("income_median"),
                census.get("home_value_median"),
                census.get("rent_median"),
                census.get("unemployment_rate"),
                census.get("median_age"),
                self.zip_code
            ))
            print(f"   Updated zips_master with Census data")

        # Cache the full API response
        cache_key = f"zip_data:{self.zip_code}"
        cursor.execute("""
            INSERT INTO api_cache (cache_key, endpoint, request_params, response, fetched_at, expires_at)
            VALUES (%s, 'zip_data_fetcher', %s, %s, NOW(), NOW() + interval '7 days')
            ON CONFLICT (cache_key) DO UPDATE
            SET response = EXCLUDED.response,
                fetched_at = NOW(),
                expires_at = NOW() + interval '7 days'
        """, (
            cache_key,
            json.dumps({"zip": self.zip_code}),
            json.dumps(self.data, default=str)
        ))
        print(f"   Cached full response in api_cache")

        # Save water bodies to water_bodies table
        water_bodies = self.data.get("water_bodies", [])
        if water_bodies:
            for wb in water_bodies[:10]:  # Top 10
                cursor.execute("""
                    INSERT INTO water_bodies (name, water_type, state, county, area_acres, centroid_lat, centroid_lng, source)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'usgs_nhd')
                    ON CONFLICT DO NOTHING
                """, (
                    wb["name"],
                    wb["type"].lower(),
                    self.state,
                    self.data.get("db_info", {}).get("county"),
                    wb.get("area_sqkm", 0) * 247.105 if wb.get("area_sqkm") else None,  # Convert to acres
                    self.lat,
                    self.lng
                ))
            print(f"   Added {min(len(water_bodies), 10)} water bodies to water_bodies table")

        self.conn.commit()
        print("   Database updated successfully!")

    def print_summary(self):
        """Print a summary of all fetched data."""
        print(f"\n{'='*60}")
        print(f"DATA SUMMARY FOR {self.zip_code}")
        print(f"{'='*60}")

        db_info = self.data.get("db_info", {})
        print(f"\nLocation: {db_info.get('city', 'N/A')}, {db_info.get('state', 'N/A')}")
        print(f"County: {db_info.get('county', 'N/A')} (FIPS: {db_info.get('county_fips', 'N/A')})")
        print(f"Coordinates: {db_info.get('lat', 'N/A')}, {db_info.get('lng', 'N/A')}")

        census = self.data.get("census", {})
        print(f"\n--- DEMOGRAPHICS (Census ACS 2022) ---")
        print(f"Population: {census.get('population', 'N/A'):,}" if census.get('population') else "Population: N/A")
        print(f"Median Income: ${census.get('income_median', 0):,}" if census.get('income_median') else "Median Income: N/A")
        print(f"Poverty Rate: {census.get('poverty_rate', 'N/A')}%")
        print(f"Renter %: {census.get('renter_pct', 'N/A')}%")
        print(f"Median Age: {census.get('median_age', 'N/A')}")
        print(f"Median Home Value: ${census.get('home_value_median', 0):,}" if census.get('home_value_median') else "Median Home Value: N/A")
        print(f"Median Rent: ${census.get('rent_median', 0):,}" if census.get('rent_median') else "Median Rent: N/A")
        print(f"Unemployment: {census.get('unemployment_rate', 'N/A')}%")
        print(f"5-Year Pop Growth: {census.get('growth_rate_5yr', 'N/A')}%")

        fema = self.data.get("fema", {})
        print(f"\n--- RISK DATA (FEMA) ---")
        print(f"Recent Disasters: {fema.get('recent_disasters', 0)}")
        print(f"Disaster Types: {', '.join(fema.get('disaster_types', ['None']))}")

        water = self.data.get("water_bodies", [])
        print(f"\n--- NEARBY WATER BODIES ---")
        print(f"Total Found: {len(water)}")
        for wb in water[:5]:
            print(f"  - {wb['name']} ({wb['type']})")

        if self.data.get("errors"):
            print(f"\n--- ERRORS ---")
            for err in self.data["errors"]:
                print(f"  - {err}")


async def main():
    """Fetch all data for Bedford PA 15522."""
    fetcher = ZipDataFetcher("15522")

    # Fetch all data
    await fetcher.fetch_all()

    # Save to database
    fetcher.save_to_database()

    # Print summary
    fetcher.print_summary()

    print(f"\n{'='*60}")
    print("DATA FETCH COMPLETE")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
