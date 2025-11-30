"""
Unified Data Fetcher Service.
Fetches all available data for a ZIP code from multiple APIs and stores in database.
Call this when a new ZIP code is entered to populate all data.

THROTTLING: Uses database caching to minimize API calls.
- Cache TTL: 7 days for most data, 30 days for Census (annual updates)
- Checks cache before making any API call
- Rate limits: 1 request per source per ZIP (cached)
"""

import os
import asyncio
import aiohttp
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

# API Keys
CENSUS_API_KEY = os.environ.get("CENSUS_API_KEY", "8e42aa570992dcc0798224911a7072b0112bfb0c")
DATA_GOV_API_KEY = os.environ.get("DATA_GOV_API_KEY", "78XKITwisQk1NiG3Z3WP5deMeKXB6M5XQLcdFqaX")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyAWS3lz7Tk-61z82gMN-Ck1-nxTzUVxjU4")

# Database connection
NEON_CONNECTION_STRING = os.environ.get(
    "NEON_CONNECTION_STRING",
    os.environ.get("DATABASE_URL", "")
)

# Cache TTLs (in days)
CACHE_TTL = {
    "census": 30,      # Census data rarely changes
    "fema": 7,         # Disaster data updates weekly
    "water": 30,       # Water bodies rarely change
    "storage": 7,      # Storage facilities may open/close
}

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


class DataFetcherService:
    """Fetches comprehensive data for a ZIP code from multiple APIs.

    THROTTLING:
    - Checks cache before any API call
    - Only fetches if cache is expired or missing
    - Caches all responses to minimize repeat calls
    """

    def __init__(self, connection_string: Optional[str] = None):
        self.conn_string = connection_string or NEON_CONNECTION_STRING
        self._conn = None

    @property
    def conn(self):
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self.conn_string)
        return self._conn

    def close(self):
        if self._conn:
            self._conn.close()

    def _get_cached(self, cache_key: str) -> Optional[Dict]:
        """Check if we have valid cached data. Returns None if expired/missing."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT response, expires_at
            FROM api_cache
            WHERE cache_key = %s AND expires_at > NOW()
        """, (cache_key,))
        row = cursor.fetchone()
        if row:
            logger.info(f"Cache HIT: {cache_key}")
            return json.loads(row["response"]) if isinstance(row["response"], str) else row["response"]
        logger.info(f"Cache MISS: {cache_key}")
        return None

    def _set_cached(self, cache_key: str, data: Dict, ttl_days: int = 7):
        """Store data in cache with TTL."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO api_cache (cache_key, endpoint, request_params, response, fetched_at, expires_at)
            VALUES (%s, %s, %s, %s, NOW(), NOW() + interval '%s days')
            ON CONFLICT (cache_key) DO UPDATE
            SET response = EXCLUDED.response,
                fetched_at = NOW(),
                expires_at = NOW() + interval '%s days'
        """, (
            cache_key,
            cache_key.split(":")[0],
            json.dumps({"key": cache_key}),
            json.dumps(data, default=str),
            ttl_days,
            ttl_days
        ))
        self.conn.commit()

    async def fetch_zip_data(self, zip_code: str, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Fetch all available data for a ZIP code.

        THROTTLING: Uses cache to minimize API calls. Only fetches if:
        - Cache is expired or missing
        - force_refresh=True is passed

        Args:
            zip_code: 5-digit ZIP code
            force_refresh: If True, bypasses cache and fetches fresh data

        Returns:
            Dictionary with all fetched data
        """
        # Check master cache first (entire ZIP data)
        master_cache_key = f"zip_data:{zip_code}"
        if not force_refresh:
            cached = self._get_cached(master_cache_key)
            if cached:
                logger.info(f"Using cached data for ZIP {zip_code}")
                return cached

        data = {
            "zip": zip_code,
            "fetched_at": datetime.now().isoformat(),
            "census": {},
            "fema": {},
            "water_bodies": [],
            "storage_facilities": [],
            "api_calls_made": 0,
            "cache_hits": 0,
            "errors": []
        }

        # Get ZIP info from database
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT zip, city, state, county_name, county_fips, lat, lng
            FROM zips_master WHERE zip = %s
        """, (zip_code,))
        row = cursor.fetchone()

        if row:
            data["db_info"] = {
                "city": row["city"],
                "state": row["state"],
                "county": row["county_name"],
                "county_fips": row["county_fips"],
                "lat": float(row["lat"]) if row["lat"] else None,
                "lng": float(row["lng"]) if row["lng"] else None
            }
            lat = float(row["lat"]) if row["lat"] else 40.0
            lng = float(row["lng"]) if row["lng"] else -78.0
            state = row["state"]
            county_fips = row["county_fips"]
        else:
            logger.warning(f"ZIP {zip_code} not found in database")
            data["errors"].append(f"ZIP {zip_code} not found in database")
            return data

        async with aiohttp.ClientSession() as session:
            # Fetch all data concurrently (each checks its own cache)
            census_task = self._fetch_census_cached(session, zip_code, force_refresh)
            fema_task = self._fetch_fema_cached(session, state, county_fips, force_refresh)
            water_task = self._fetch_water_cached(session, lat, lng, state, data["db_info"]["county"], zip_code, force_refresh)
            storage_task = self._fetch_storage_cached(session, lat, lng, zip_code, force_refresh)

            results = await asyncio.gather(
                census_task, fema_task, water_task, storage_task,
                return_exceptions=True
            )

            # Process results and track API calls
            for i, (result, key) in enumerate(zip(results, ["census", "fema", "water_bodies", "storage_facilities"])):
                if not isinstance(result, Exception):
                    if isinstance(result, dict) and "from_cache" in result:
                        if result["from_cache"]:
                            data["cache_hits"] += 1
                        else:
                            data["api_calls_made"] += 1
                        data[key] = result.get("data", result)
                    else:
                        data[key] = result
                else:
                    data["errors"].append(f"{key}: {str(result)}")

        # Save to database and cache
        self._save_to_database(zip_code, data, state, data["db_info"]["county"])

        # Log API usage
        logger.info(f"ZIP {zip_code}: {data['api_calls_made']} API calls, {data['cache_hits']} cache hits")

        return data

    async def _fetch_census_cached(self, session, zip_code: str, force_refresh: bool) -> Dict[str, Any]:
        """Fetch Census with caching."""
        cache_key = f"census:{zip_code}"
        if not force_refresh:
            cached = self._get_cached(cache_key)
            if cached:
                return {"data": cached, "from_cache": True}

        result = await self._fetch_census(session, zip_code)
        if result:
            self._set_cached(cache_key, result, CACHE_TTL["census"])
        return {"data": result, "from_cache": False}

    async def _fetch_fema_cached(self, session, state: str, county_fips: str, force_refresh: bool) -> Dict[str, Any]:
        """Fetch FEMA with caching."""
        cache_key = f"fema:{state}:{county_fips}"
        if not force_refresh:
            cached = self._get_cached(cache_key)
            if cached:
                return {"data": cached, "from_cache": True}

        result = await self._fetch_fema(session, state, county_fips)
        if result:
            self._set_cached(cache_key, result, CACHE_TTL["fema"])
        return {"data": result, "from_cache": False}

    async def _fetch_water_cached(self, session, lat: float, lng: float, state: str, county: str, zip_code: str, force_refresh: bool) -> Dict[str, Any]:
        """Fetch water bodies with caching."""
        cache_key = f"water:{zip_code}"
        if not force_refresh:
            cached = self._get_cached(cache_key)
            if cached:
                return {"data": cached, "from_cache": True}

        result = await self._fetch_water_bodies(session, lat, lng, state, county)
        if result:
            self._set_cached(cache_key, result, CACHE_TTL["water"])
        return {"data": result, "from_cache": False}

    async def _fetch_storage_cached(self, session, lat: float, lng: float, zip_code: str, force_refresh: bool) -> Dict[str, Any]:
        """Fetch storage facilities with caching."""
        cache_key = f"storage:{zip_code}"
        if not force_refresh:
            cached = self._get_cached(cache_key)
            if cached:
                return {"data": cached, "from_cache": True}

        result = await self._fetch_storage_facilities(session, lat, lng)
        if result:
            self._set_cached(cache_key, result, CACHE_TTL["storage"])
        return {"data": result, "from_cache": False}

    async def _fetch_census(self, session, zip_code: str) -> Dict[str, Any]:
        """Fetch Census ACS demographics."""
        variables = ",".join(CENSUS_VARS.keys())
        url = "https://api.census.gov/data/2022/acs/acs5"
        params = {
            "get": variables,
            "for": f"zip code tabulation area:{zip_code}",
            "key": CENSUS_API_KEY
        }

        async with session.get(url, params=params) as response:
            if response.status == 200:
                data = await response.json()
                if len(data) >= 2:
                    headers = data[0]
                    values = data[1]

                    census_data = {}
                    for i, header in enumerate(headers[:-1]):
                        var_name = CENSUS_VARS.get(header, header)
                        val = values[i]
                        if val and val != '':
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

                    return census_data

        return {}

    async def _fetch_fema(self, session, state: str, county_fips: str) -> Dict[str, Any]:
        """Fetch FEMA disaster data."""
        fema_data = {"api_status": "available"}

        county_fips_3 = county_fips[2:] if county_fips and len(county_fips) >= 5 else ""

        url = "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries"
        params = {
            "$filter": f"state eq '{state}' and fipsCountyCode eq '{county_fips_3}'",
            "$top": 10,
            "$orderby": "declarationDate desc",
            "$select": "disasterNumber,declarationTitle,declarationDate,incidentType"
        }

        try:
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    disasters = data.get("DisasterDeclarationsSummaries", [])
                    fema_data["recent_disasters"] = len(disasters)
                    fema_data["disaster_types"] = list(set(d.get("incidentType", "") for d in disasters))
                    fema_data["disasters"] = [
                        {
                            "title": d.get("declarationTitle"),
                            "date": d.get("declarationDate", "")[:10],
                            "type": d.get("incidentType")
                        }
                        for d in disasters[:5]
                    ]
        except Exception as e:
            logger.warning(f"FEMA API error: {e}")

        return fema_data

    async def _fetch_water_bodies(self, session, lat: float, lng: float, state: str, county: str) -> List[Dict]:
        """Fetch nearby water bodies."""
        water_bodies = []

        bbox_size = 0.3
        min_lng = lng - bbox_size
        max_lng = lng + bbox_size
        min_lat = lat - bbox_size
        max_lat = lat + bbox_size

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

        try:
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    features = data.get("features", [])

                    seen_names = set()
                    for f in features:
                        attrs = f.get("attributes", {})
                        name = attrs.get("GNIS_NAME")
                        if name and name not in seen_names:
                            seen_names.add(name)
                            ftype = attrs.get("FTYPE")
                            type_name = {390: "Lake", 436: "Reservoir", 460: "Stream", 493: "Pond"}.get(ftype, "Water")
                            area = attrs.get("AREASQKM", 0)
                            water_bodies.append({
                                "name": name,
                                "type": type_name,
                                "area_sqkm": area
                            })

                    water_bodies.sort(key=lambda x: x.get("area_sqkm", 0) or 0, reverse=True)
        except Exception as e:
            logger.warning(f"USGS API error: {e}")

        return water_bodies[:20]

    async def _fetch_storage_facilities(self, session, lat: float, lng: float, radius_miles: float = 10) -> List[Dict]:
        """
        Fetch storage facilities near coordinates using Google Places API.

        THROTTLING: Limited to 10-mile radius, max 20 results to minimize API costs.
        """
        facilities = []
        radius_meters = int(radius_miles * 1609.34)

        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            "location": f"{lat},{lng}",
            "radius": min(radius_meters, 50000),  # Max 50km
            "keyword": "self storage",
            "key": GOOGLE_API_KEY
        }

        try:
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("status") == "OK":
                        for place in data.get("results", [])[:20]:  # Limit to 20
                            facility = {
                                "place_id": place.get("place_id"),
                                "name": place.get("name"),
                                "address": place.get("vicinity"),
                                "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                                "lng": place.get("geometry", {}).get("location", {}).get("lng"),
                                "rating": place.get("rating"),
                                "user_ratings_total": place.get("user_ratings_total", 0),
                            }
                            facilities.append(facility)
                    elif data.get("status") == "ZERO_RESULTS":
                        logger.info(f"No storage facilities found near {lat},{lng}")
                    else:
                        logger.warning(f"Google Places API status: {data.get('status')}")
        except Exception as e:
            logger.warning(f"Google Places API error: {e}")

        return facilities

    def _save_to_database(self, zip_code: str, data: Dict, state: str, county: str):
        """Save fetched data to database."""
        cursor = self.conn.cursor()

        # Update zips_master with Census data
        census = data.get("census", {})
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
                zip_code
            ))

        # Cache the full response
        cache_key = f"zip_data:{zip_code}"
        cursor.execute("""
            INSERT INTO api_cache (cache_key, endpoint, request_params, response, fetched_at, expires_at)
            VALUES (%s, 'data_fetcher', %s, %s, NOW(), NOW() + interval '7 days')
            ON CONFLICT (cache_key) DO UPDATE
            SET response = EXCLUDED.response,
                fetched_at = NOW(),
                expires_at = NOW() + interval '7 days'
        """, (
            cache_key,
            json.dumps({"zip": zip_code}),
            json.dumps(data, default=str)
        ))

        # Save water bodies
        water_bodies = data.get("water_bodies", [])
        for wb in water_bodies[:10]:
            cursor.execute("""
                INSERT INTO water_bodies (name, water_type, state, county, area_acres, source)
                VALUES (%s, %s, %s, %s, %s, 'usgs_nhd')
                ON CONFLICT DO NOTHING
            """, (
                wb["name"],
                wb["type"].lower(),
                state,
                county,
                wb.get("area_sqkm", 0) * 247.105 if wb.get("area_sqkm") else None
            ))

        self.conn.commit()
        logger.info(f"Saved data for ZIP {zip_code}")


# Convenience function
async def fetch_and_store_zip_data(zip_code: str, connection_string: Optional[str] = None,
                                    force_refresh: bool = False) -> Dict[str, Any]:
    """
    Fetch all available data for a ZIP code and store in database.

    THROTTLING: Uses cache by default. Only makes API calls if cache expired or force_refresh=True.

    Args:
        zip_code: 5-digit ZIP code
        connection_string: Optional database connection string
        force_refresh: If True, bypasses cache and fetches fresh data

    Returns:
        Dictionary with all fetched data including:
        - api_calls_made: Number of actual API calls
        - cache_hits: Number of cache hits

    Example:
        data = await fetch_and_store_zip_data("15522")
        print(f"API calls: {data['api_calls_made']}, Cache hits: {data['cache_hits']}")
    """
    service = DataFetcherService(connection_string)
    try:
        return await service.fetch_zip_data(zip_code, force_refresh)
    finally:
        service.close()


def fetch_zip_data_sync(zip_code: str, connection_string: Optional[str] = None,
                        force_refresh: bool = False) -> Dict[str, Any]:
    """
    Synchronous wrapper for fetch_and_store_zip_data.

    THROTTLING: Uses cache by default. Set force_refresh=True to bypass.

    Args:
        zip_code: 5-digit ZIP code
        connection_string: Optional database connection string
        force_refresh: If True, bypasses cache

    Returns:
        Dictionary with all fetched data
    """
    return asyncio.run(fetch_and_store_zip_data(zip_code, connection_string, force_refresh))
