"""
Zone Management Service.
Handles creation and management of screening zones from any ZIP code.
Automatically fetches data from Census, FEMA, and other APIs when creating zones.
"""
import os
import asyncio
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, List, Optional
import logging
import json

logger = logging.getLogger(__name__)

# Database connection
NEON_CONNECTION_STRING = os.environ.get(
    "NEON_CONNECTION_STRING",
    os.environ.get("DATABASE_URL", "")
)

# Default screening configuration
DEFAULT_CONFIG = {
    "LOT_SIZE_ACRES": 1,
    "UNITS_PER_ACRE": 120,
    "TARGET_RENT": 80,
    "TARGET_OCCUPANCY": 0.85,
    "OPEX_RATIO": 0.25,
    "MIN_YIELD": 0.12,
    "DEMAND_SQFT_PER_PERSON": 6,
    "RENTABLE_SQFT_PER_ACRE": 12000
}

# Kill switch thresholds
KILL_THRESHOLDS = {
    "S0_URBAN_DENSITY": 3500,       # people/sq mi
    "S0_DRIVE_TIME": 120,           # minutes
    "S1_ZIP_POPULATION": 8000,
    "S1_5MI_POPULATION": 25000,
    "S1_INCOME": 40000,
    "S1_POVERTY_RATE": 25,          # percent
    "S1_GROWTH_RATE": 0,            # percent
    "S1_RENTER_PCT": 20,            # percent
    "S2_ROUGH_SATURATION": 1.4,
    "S4_TRUE_SATURATION": 1.1,
    "S4_SUPPORTABLE_ACRES": 1.0,
    "S5_RENT_PSF": 0.70,
    "S5_YIELD": 0.12,
    "S6_AADT": 10000,
    "S6_TURN_COUNT": 3,
    "S7_FLOOD_PCT": 50,
    "S7_CRIME_RATIO": 2.0
}

# State to FIPS mapping
STATE_FIPS = {
    "PA": "42", "WV": "54", "VA": "51", "MD": "24",
    "OH": "39", "KY": "21", "NC": "37", "TN": "47"
}


class ZoneService:
    """Service for managing screening zones."""

    def __init__(self, connection_string: Optional[str] = None):
        """Initialize zone service with database connection."""
        self.conn_string = connection_string or NEON_CONNECTION_STRING
        self._conn = None

    @property
    def conn(self):
        """Get or create database connection."""
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self.conn_string)
        return self._conn

    def close(self):
        """Close database connection."""
        if self._conn:
            self._conn.close()

    def get_zip_info(self, zip_code: str) -> Optional[Dict]:
        """
        Get information about a ZIP code from zips_master.

        Args:
            zip_code: 5-digit ZIP code

        Returns:
            Dictionary with ZIP details or None
        """
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT zip, city, state, county_name, county_fips,
                   lat, lng, population, density, income_household_median
            FROM zips_master
            WHERE zip = %s
        """, (zip_code,))
        return cursor.fetchone()

    def create_zone(self, center_zip: str, radius_miles: int = 120,
                    zone_name: Optional[str] = None,
                    states: Optional[List[str]] = None,
                    fetch_data: bool = True) -> Dict[str, Any]:
        """
        Create a new screening zone centered on a ZIP code.

        Args:
            center_zip: Center ZIP code
            radius_miles: Radius in miles (default 120)
            zone_name: Optional custom name
            states: Optional list of states to include (auto-detected if not provided)
            fetch_data: Whether to fetch Census/FEMA data for center ZIP (default True)

        Returns:
            Dictionary with zone details including zone_id and ZIP count
        """
        # Fetch data for the center ZIP first if requested
        if fetch_data:
            try:
                from backend.services.data_fetcher_service import fetch_zip_data_sync
                logger.info(f"Fetching data for center ZIP {center_zip}...")
                fetch_result = fetch_zip_data_sync(center_zip, self.conn_string)
                logger.info(f"Data fetched: Census pop={fetch_result.get('census', {}).get('population')}")
            except Exception as e:
                logger.warning(f"Failed to fetch data for {center_zip}: {e}")

        # Get center ZIP info
        zip_info = self.get_zip_info(center_zip)
        if not zip_info:
            raise ValueError(f"ZIP code {center_zip} not found in database")

        center_lat = float(zip_info['lat'])
        center_lon = float(zip_info['lng'])
        city = zip_info['city']
        state = zip_info['state']

        # Auto-generate zone name if not provided
        if not zone_name:
            zone_name = f"{city} {state} {radius_miles}mi"

        # Auto-detect states if not provided
        if not states:
            # Query to find all states within radius
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT DISTINCT state
                FROM zips_master
                WHERE haversine_miles(%s, %s, lat, lng) <= %s
                ORDER BY state
            """, (center_lat, center_lon, radius_miles))
            states = [row[0] for row in cursor.fetchall()]

        # Check if zone already exists
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT zone_id FROM target_zones
            WHERE center_zip = %s AND radius_miles = %s
        """, (center_zip, radius_miles))
        existing = cursor.fetchone()

        if existing:
            zone_id = existing['zone_id']
            logger.info(f"Zone already exists: {zone_id}")
        else:
            # Create new zone
            cursor.execute("""
                INSERT INTO target_zones (zone_name, center_zip, center_lat, center_lon, radius_miles, states)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING zone_id
            """, (zone_name, center_zip, center_lat, center_lon, radius_miles, states))
            zone_id = cursor.fetchone()['zone_id']
            self.conn.commit()
            logger.info(f"Created new zone: {zone_id}")

        # Get zone stats
        stats = self.get_zone_stats(zone_id)

        return {
            "zone_id": zone_id,
            "zone_name": zone_name,
            "center_zip": center_zip,
            "center_city": city,
            "center_state": state,
            "center_lat": center_lat,
            "center_lon": center_lon,
            "radius_miles": radius_miles,
            "states": states,
            **stats
        }

    def get_zone_stats(self, zone_id: int) -> Dict[str, Any]:
        """
        Get statistics for a zone.

        Args:
            zone_id: Zone ID

        Returns:
            Dictionary with ZIP and county counts by state
        """
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        # Get ZIP counts by state
        cursor.execute("""
            SELECT state, COUNT(*) as zip_count
            FROM v_zone_zips
            WHERE zone_id = %s
            GROUP BY state
            ORDER BY state
        """, (zone_id,))
        zip_counts = {row['state']: row['zip_count'] for row in cursor.fetchall()}

        # Get county counts by state
        cursor.execute("""
            SELECT state, COUNT(*) as county_count
            FROM v_zone_counties
            WHERE zone_id = %s
            GROUP BY state
            ORDER BY state
        """, (zone_id,))
        county_counts = {row['state']: row['county_count'] for row in cursor.fetchall()}

        return {
            "total_zips": sum(zip_counts.values()),
            "total_counties": sum(county_counts.values()),
            "zips_by_state": zip_counts,
            "counties_by_state": county_counts
        }

    def start_zone_run(self, zone_id: int, config: Optional[Dict] = None,
                       created_by: str = "system") -> str:
        """
        Start a screening run for a zone.

        Args:
            zone_id: Zone ID
            config: Optional configuration overrides
            created_by: User/system that started the run

        Returns:
            run_id (UUID string)
        """
        run_config = {**DEFAULT_CONFIG, **(config or {})}
        run_config["kill_thresholds"] = KILL_THRESHOLDS

        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT start_run_by_zone(%s, %s, %s)
        """, (zone_id, json.dumps(run_config), created_by))
        run_id = cursor.fetchone()[0]
        self.conn.commit()

        logger.info(f"Started run {run_id} for zone {zone_id}")
        return str(run_id)

    def get_zone_zips(self, zone_id: int, include_demographics: bool = True) -> List[Dict]:
        """
        Get all ZIPs in a zone with optional demographic data.

        Args:
            zone_id: Zone ID
            include_demographics: Include demographic columns

        Returns:
            List of ZIP dictionaries
        """
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        if include_demographics:
            cursor.execute("""
                SELECT z.zip, z.state, z.county_name, z.distance_miles,
                       zm.population, zm.density, zm.income_household_median,
                       zm.home_ownership, zm.rent_median, zm.unemployment_rate
                FROM v_zone_zips z
                JOIN zips_master zm ON z.zip = zm.zip
                WHERE z.zone_id = %s
                ORDER BY z.distance_miles
            """, (zone_id,))
        else:
            cursor.execute("""
                SELECT zip, state, county_name, distance_miles
                FROM v_zone_zips
                WHERE zone_id = %s
                ORDER BY distance_miles
            """, (zone_id,))

        return [dict(row) for row in cursor.fetchall()]

    def get_zone_counties(self, zone_id: int) -> List[Dict]:
        """
        Get all counties in a zone.

        Args:
            zone_id: Zone ID

        Returns:
            List of county dictionaries
        """
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT state, county_fips, county_name, zip_count,
                   closest_zip_miles, farthest_zip_miles
            FROM v_zone_counties
            WHERE zone_id = %s
            ORDER BY state, county_name
        """, (zone_id,))
        return [dict(row) for row in cursor.fetchall()]

    def list_zones(self) -> List[Dict]:
        """
        List all defined zones.

        Returns:
            List of zone dictionaries
        """
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT tz.zone_id, tz.zone_name, tz.center_zip, tz.radius_miles,
                   tz.states, tz.created_at,
                   (SELECT COUNT(*) FROM v_zone_zips WHERE zone_id = tz.zone_id) as total_zips
            FROM target_zones tz
            ORDER BY tz.created_at DESC
        """)
        return [dict(row) for row in cursor.fetchall()]

    def delete_zone(self, zone_id: int) -> bool:
        """
        Delete a zone (does not delete associated runs).

        Args:
            zone_id: Zone ID

        Returns:
            True if deleted
        """
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM target_zones WHERE zone_id = %s", (zone_id,))
        deleted = cursor.rowcount > 0
        self.conn.commit()
        return deleted


# Convenience function for quick zone creation
def create_screening_zone(center_zip: str, radius_miles: int = 120,
                          connection_string: Optional[str] = None) -> Dict[str, Any]:
    """
    Quick function to create a screening zone from any ZIP code.

    Args:
        center_zip: Center ZIP code (e.g., "15522" for Bedford PA)
        radius_miles: Radius in miles (default 120)
        connection_string: Optional database connection string

    Returns:
        Dictionary with zone details

    Example:
        zone = create_screening_zone("15522", 120)
        print(f"Created zone {zone['zone_id']} with {zone['total_zips']} ZIPs")
    """
    service = ZoneService(connection_string)
    try:
        return service.create_zone(center_zip, radius_miles)
    finally:
        service.close()


def start_screening_run(zone_id: int, connection_string: Optional[str] = None) -> str:
    """
    Quick function to start a screening run for a zone.

    Args:
        zone_id: Zone ID
        connection_string: Optional database connection string

    Returns:
        run_id (UUID string)

    Example:
        run_id = start_screening_run(1)
        print(f"Started run: {run_id}")
    """
    service = ZoneService(connection_string)
    try:
        return service.start_zone_run(zone_id)
    finally:
        service.close()
