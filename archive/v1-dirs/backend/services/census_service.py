"""
Census API service integration.
Provides demographic data for ZIP code screening.
"""
import os
import asyncio
import aiohttp
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Census API configuration
CENSUS_BASE_URL = "https://api.census.gov/data"
CENSUS_API_KEY = os.environ.get("CENSUS_API_KEY", "8e42aa570992dcc0798224911a7072b0112bfb0c")

# ACS 5-year tables we use
CENSUS_TABLES = {
    "population": "B01003_001E",      # Total population
    "income": "B19013_001E",          # Median household income
    "poverty_total": "B17001_001E",   # Poverty status - total
    "poverty_below": "B17001_002E",   # Poverty status - below poverty
    "tenure_total": "B25003_001E",    # Housing tenure - total
    "tenure_renter": "B25003_003E",   # Housing tenure - renter occupied
    "age_median": "B01002_001E",      # Median age
}


class CensusService:
    """Service for fetching Census Bureau demographic data."""

    def __init__(self, api_key: Optional[str] = None, db_connection=None):
        """
        Initialize Census service.

        Args:
            api_key: Census API key (optional, uses env var if not provided)
            db_connection: Database connection for caching
        """
        self.api_key = api_key or CENSUS_API_KEY
        self.db = db_connection
        self.session: Optional[aiohttp.ClientSession] = None
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = timedelta(hours=24)

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def _get_cache_key(self, endpoint: str, params: Dict) -> str:
        """Generate cache key for API request."""
        param_str = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        return f"census:{endpoint}:{param_str}"

    async def _check_db_cache(self, cache_key: str) -> Optional[Dict]:
        """Check database cache for existing data."""
        if not self.db:
            return None
        try:
            cursor = self.db.cursor()
            cursor.execute("""
                SELECT response, fetched_at, expires_at
                FROM api_cache
                WHERE cache_key = %s AND (expires_at IS NULL OR expires_at > NOW())
            """, (cache_key,))
            row = cursor.fetchone()
            if row:
                return row[0]  # response JSONB
        except Exception as e:
            logger.warning(f"Cache lookup failed: {e}")
        return None

    async def _save_to_db_cache(self, cache_key: str, endpoint: str,
                                 params: Dict, response: Dict, ttl_hours: int = 24):
        """Save API response to database cache."""
        if not self.db:
            return
        try:
            cursor = self.db.cursor()
            cursor.execute("""
                INSERT INTO api_cache (cache_key, endpoint, request_params, response, fetched_at, expires_at)
                VALUES (%s, %s, %s, %s, NOW(), NOW() + interval '%s hours')
                ON CONFLICT (cache_key) DO UPDATE
                SET response = EXCLUDED.response,
                    fetched_at = NOW(),
                    expires_at = NOW() + interval '%s hours'
            """, (cache_key, endpoint, params, response, ttl_hours, ttl_hours))
            self.db.commit()
        except Exception as e:
            logger.warning(f"Cache save failed: {e}")

    async def _make_request(self, endpoint: str, params: Dict) -> Optional[List]:
        """Make Census API request with caching."""
        cache_key = self._get_cache_key(endpoint, params)

        # Check memory cache first
        if cache_key in self._cache:
            cached = self._cache[cache_key]
            if datetime.now() - cached['time'] < self._cache_ttl:
                return cached['data']

        # Check database cache
        db_cached = await self._check_db_cache(cache_key)
        if db_cached:
            self._cache[cache_key] = {'data': db_cached, 'time': datetime.now()}
            return db_cached

        # Make API request
        if not self.session:
            self.session = aiohttp.ClientSession()

        url = f"{CENSUS_BASE_URL}/{endpoint}"
        params_with_key = {**params}
        if self.api_key:
            params_with_key['key'] = self.api_key

        try:
            async with self.session.get(url, params=params_with_key) as response:
                if response.status == 200:
                    data = await response.json()
                    # Cache the response
                    self._cache[cache_key] = {'data': data, 'time': datetime.now()}
                    await self._save_to_db_cache(cache_key, endpoint, params, data)
                    return data
                else:
                    logger.error(f"Census API error: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Census API request failed: {e}")
            return None

    async def get_zip_demographics(self, zip_code: str, year: int = 2022) -> Dict[str, Any]:
        """
        Fetch demographics for a single ZIP code.

        Args:
            zip_code: 5-digit ZIP code
            year: ACS data year (default 2022)

        Returns:
            Dictionary with population, income, poverty_rate, renter_pct
        """
        variables = ",".join(CENSUS_TABLES.values())
        endpoint = f"{year}/acs/acs5"
        params = {
            "get": variables,
            "for": f"zip code tabulation area:{zip_code}"
        }

        data = await self._make_request(endpoint, params)

        if not data or len(data) < 2:
            return self._empty_demographics()

        # Parse response (first row is headers, second is data)
        try:
            values = data[1]
            return {
                "population": self._safe_int(values[0]),
                "income_median": self._safe_int(values[1]),
                "poverty_rate": self._calc_rate(values[2], values[3]),
                "renter_pct": self._calc_rate(values[4], values[5]),
                "age_median": self._safe_float(values[6]),
                "source": "census_acs",
                "year": year
            }
        except (IndexError, ValueError) as e:
            logger.warning(f"Failed to parse Census data for {zip_code}: {e}")
            return self._empty_demographics()

    async def get_bulk_demographics(self, zip_codes: List[str], year: int = 2022) -> Dict[str, Dict]:
        """
        Fetch demographics for multiple ZIP codes efficiently.

        Args:
            zip_codes: List of 5-digit ZIP codes
            year: ACS data year

        Returns:
            Dictionary mapping ZIP code to demographics
        """
        results = {}

        # Census API allows querying multiple ZIPs at once
        # Process in batches of 50
        batch_size = 50
        for i in range(0, len(zip_codes), batch_size):
            batch = zip_codes[i:i+batch_size]
            zip_list = ",".join(batch)

            variables = ",".join(CENSUS_TABLES.values())
            endpoint = f"{year}/acs/acs5"
            params = {
                "get": variables,
                "for": f"zip code tabulation area:{zip_list}"
            }

            data = await self._make_request(endpoint, params)

            if data and len(data) > 1:
                # First row is headers, rest are data
                for row in data[1:]:
                    try:
                        zip_code = row[-1]  # Last column is ZIP
                        results[zip_code] = {
                            "population": self._safe_int(row[0]),
                            "income_median": self._safe_int(row[1]),
                            "poverty_rate": self._calc_rate(row[2], row[3]),
                            "renter_pct": self._calc_rate(row[4], row[5]),
                            "age_median": self._safe_float(row[6]),
                            "source": "census_acs",
                            "year": year
                        }
                    except (IndexError, ValueError):
                        continue

        return results

    async def get_population_growth(self, zip_code: str,
                                     start_year: int = 2018,
                                     end_year: int = 2022) -> Optional[float]:
        """
        Calculate population growth rate between two ACS vintages.

        Args:
            zip_code: 5-digit ZIP code
            start_year: Starting year
            end_year: Ending year

        Returns:
            Growth rate as decimal (e.g., 0.05 for 5% growth)
        """
        # Get population for both years
        start_data = await self.get_zip_demographics(zip_code, start_year)
        end_data = await self.get_zip_demographics(zip_code, end_year)

        start_pop = start_data.get("population")
        end_pop = end_data.get("population")

        if start_pop and end_pop and start_pop > 0:
            return (end_pop - start_pop) / start_pop
        return None

    async def get_county_demographics(self, state_fips: str, county_fips: str,
                                       year: int = 2022) -> Dict[str, Any]:
        """
        Fetch demographics at county level.

        Args:
            state_fips: 2-digit state FIPS code
            county_fips: 3-digit county FIPS code
            year: ACS data year

        Returns:
            Dictionary with county demographics
        """
        variables = ",".join(CENSUS_TABLES.values())
        endpoint = f"{year}/acs/acs5"
        params = {
            "get": variables,
            "for": f"county:{county_fips}",
            "in": f"state:{state_fips}"
        }

        data = await self._make_request(endpoint, params)

        if not data or len(data) < 2:
            return self._empty_demographics()

        try:
            values = data[1]
            return {
                "population": self._safe_int(values[0]),
                "income_median": self._safe_int(values[1]),
                "poverty_rate": self._calc_rate(values[2], values[3]),
                "renter_pct": self._calc_rate(values[4], values[5]),
                "age_median": self._safe_float(values[6]),
                "source": "census_acs",
                "year": year
            }
        except (IndexError, ValueError) as e:
            logger.warning(f"Failed to parse Census data: {e}")
            return self._empty_demographics()

    def _empty_demographics(self) -> Dict[str, Any]:
        """Return empty demographics structure."""
        return {
            "population": None,
            "income_median": None,
            "poverty_rate": None,
            "renter_pct": None,
            "age_median": None,
            "source": None,
            "year": None
        }

    def _safe_int(self, value: Any) -> Optional[int]:
        """Safely convert to int."""
        try:
            return int(value) if value and value != '' else None
        except (ValueError, TypeError):
            return None

    def _safe_float(self, value: Any) -> Optional[float]:
        """Safely convert to float."""
        try:
            return float(value) if value and value != '' else None
        except (ValueError, TypeError):
            return None

    def _calc_rate(self, total: Any, subset: Any) -> Optional[float]:
        """Calculate rate (subset/total) safely."""
        total_val = self._safe_int(total)
        subset_val = self._safe_int(subset)
        if total_val and total_val > 0:
            return round(subset_val / total_val * 100, 1) if subset_val else 0.0
        return None


# Convenience functions for backward compatibility
async def get_population_data(county: str, state: str) -> Dict[str, Any]:
    """
    Fetch population data from Census API.

    Args:
        county: County name
        state: State abbreviation

    Returns:
        Dictionary with population and households
    """
    # This needs county FIPS lookup - for now return stub
    # TODO: Add state/county name to FIPS lookup
    logger.info(f"Fetching population data for {county}, {state}")

    async with CensusService() as service:
        # Would need to convert county name to FIPS
        # For now, return structure expected by callers
        return {
            "population": 0,
            "households": 0,
            "population_growth_rate": 0.0,
            "household_density": 0.0
        }


async def get_household_density(county: str, state: str) -> float:
    """
    Calculate household density.

    Args:
        county: County name
        state: State abbreviation

    Returns:
        Households per square mile
    """
    # TODO: Implement actual calculation
    return 0.0
