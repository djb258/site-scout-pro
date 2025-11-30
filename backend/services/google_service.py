"""
Google Maps Platform Service.
Fetches storage facilities, traffic data, and location information.
"""

import os
import asyncio
import aiohttp
from typing import Dict, Any, List, Optional, Tuple
import logging
import math

logger = logging.getLogger(__name__)

# Google API Key
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyAWS3lz7Tk-61z82gMN-Ck1-nxTzUVxjU4")

# API endpoints
PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"


class GoogleService:
    """Service for Google Maps Platform APIs."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or GOOGLE_API_KEY
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def _ensure_session(self):
        if self.session is None:
            self.session = aiohttp.ClientSession()

    async def get_storage_facilities(self, lat: float, lng: float,
                                      radius_miles: float = 10) -> List[Dict[str, Any]]:
        """
        Find self-storage facilities near a location.

        Args:
            lat: Latitude
            lng: Longitude
            radius_miles: Search radius in miles (default 10)

        Returns:
            List of facility dictionaries with name, address, rating, location
        """
        await self._ensure_session()

        radius_meters = int(radius_miles * 1609.34)
        facilities = []

        params = {
            "location": f"{lat},{lng}",
            "radius": min(radius_meters, 50000),  # Max 50km
            "keyword": "self storage",
            "key": self.api_key
        }

        try:
            async with self.session.get(PLACES_NEARBY_URL, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("status") == "OK":
                        for place in data.get("results", []):
                            facility = {
                                "place_id": place.get("place_id"),
                                "name": place.get("name"),
                                "address": place.get("vicinity"),
                                "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                                "lng": place.get("geometry", {}).get("location", {}).get("lng"),
                                "rating": place.get("rating"),
                                "user_ratings_total": place.get("user_ratings_total", 0),
                                "types": place.get("types", []),
                                "business_status": place.get("business_status"),
                            }
                            facilities.append(facility)

                        # Handle pagination if there are more results
                        next_page = data.get("next_page_token")
                        if next_page and len(facilities) < 60:
                            await asyncio.sleep(2)  # Required delay for next_page_token
                            params["pagetoken"] = next_page
                            del params["location"]
                            del params["radius"]
                            del params["keyword"]

                            async with self.session.get(PLACES_NEARBY_URL, params=params) as resp2:
                                if resp2.status == 200:
                                    data2 = await resp2.json()
                                    if data2.get("status") == "OK":
                                        for place in data2.get("results", []):
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
        except Exception as e:
            logger.error(f"Error fetching storage facilities: {e}")

        return facilities

    async def get_facility_details(self, place_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a storage facility.

        Args:
            place_id: Google Place ID

        Returns:
            Dictionary with facility details including hours, phone, website
        """
        await self._ensure_session()

        params = {
            "place_id": place_id,
            "fields": "name,formatted_address,formatted_phone_number,website,opening_hours,rating,user_ratings_total,reviews,price_level",
            "key": self.api_key
        }

        try:
            async with self.session.get(PLACES_DETAILS_URL, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("status") == "OK":
                        result = data.get("result", {})
                        return {
                            "name": result.get("name"),
                            "address": result.get("formatted_address"),
                            "phone": result.get("formatted_phone_number"),
                            "website": result.get("website"),
                            "rating": result.get("rating"),
                            "review_count": result.get("user_ratings_total"),
                            "hours": result.get("opening_hours", {}).get("weekday_text", []),
                            "open_now": result.get("opening_hours", {}).get("open_now"),
                        }
        except Exception as e:
            logger.error(f"Error fetching facility details: {e}")

        return None

    async def get_drive_time(self, origin_lat: float, origin_lng: float,
                             dest_lat: float, dest_lng: float) -> Optional[Dict[str, Any]]:
        """
        Get drive time and distance between two points.

        Args:
            origin_lat, origin_lng: Origin coordinates
            dest_lat, dest_lng: Destination coordinates

        Returns:
            Dictionary with duration_minutes, distance_miles, and route info
        """
        await self._ensure_session()

        params = {
            "origins": f"{origin_lat},{origin_lng}",
            "destinations": f"{dest_lat},{dest_lng}",
            "key": self.api_key
        }

        try:
            async with self.session.get(DISTANCE_MATRIX_URL, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("status") == "OK":
                        element = data.get("rows", [{}])[0].get("elements", [{}])[0]
                        if element.get("status") == "OK":
                            duration_sec = element.get("duration", {}).get("value", 0)
                            distance_m = element.get("distance", {}).get("value", 0)
                            return {
                                "duration_minutes": round(duration_sec / 60, 1),
                                "distance_miles": round(distance_m / 1609.34, 1),
                                "duration_text": element.get("duration", {}).get("text"),
                                "distance_text": element.get("distance", {}).get("text"),
                            }
        except Exception as e:
            logger.error(f"Error fetching drive time: {e}")

        return None

    async def get_directions(self, origin_lat: float, origin_lng: float,
                            dest_lat: float, dest_lng: float) -> Optional[Dict[str, Any]]:
        """
        Get directions and turn count between two points.

        Args:
            origin_lat, origin_lng: Origin coordinates
            dest_lat, dest_lng: Destination coordinates

        Returns:
            Dictionary with steps, turn_count, and total distance/duration
        """
        await self._ensure_session()

        params = {
            "origin": f"{origin_lat},{origin_lng}",
            "destination": f"{dest_lat},{dest_lng}",
            "key": self.api_key
        }

        try:
            async with self.session.get(DIRECTIONS_URL, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("status") == "OK" and data.get("routes"):
                        route = data["routes"][0]
                        leg = route.get("legs", [{}])[0]
                        steps = leg.get("steps", [])

                        # Count turns
                        turn_count = 0
                        for step in steps:
                            maneuver = step.get("maneuver", "")
                            if "turn" in maneuver or "merge" in maneuver or "ramp" in maneuver:
                                turn_count += 1

                        return {
                            "duration_minutes": round(leg.get("duration", {}).get("value", 0) / 60, 1),
                            "distance_miles": round(leg.get("distance", {}).get("value", 0) / 1609.34, 1),
                            "turn_count": turn_count,
                            "step_count": len(steps),
                            "start_address": leg.get("start_address"),
                            "end_address": leg.get("end_address"),
                        }
        except Exception as e:
            logger.error(f"Error fetching directions: {e}")

        return None

    async def geocode_zip(self, zip_code: str) -> Optional[Dict[str, Any]]:
        """
        Geocode a ZIP code to get coordinates and formatted address.

        Args:
            zip_code: 5-digit ZIP code

        Returns:
            Dictionary with lat, lng, formatted_address, and components
        """
        await self._ensure_session()

        params = {
            "address": zip_code,
            "key": self.api_key
        }

        try:
            async with self.session.get(GEOCODE_URL, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("status") == "OK" and data.get("results"):
                        result = data["results"][0]
                        location = result.get("geometry", {}).get("location", {})

                        # Parse address components
                        components = {}
                        for comp in result.get("address_components", []):
                            types = comp.get("types", [])
                            if "locality" in types:
                                components["city"] = comp.get("long_name")
                            elif "administrative_area_level_1" in types:
                                components["state"] = comp.get("short_name")
                            elif "administrative_area_level_2" in types:
                                components["county"] = comp.get("long_name")

                        return {
                            "lat": location.get("lat"),
                            "lng": location.get("lng"),
                            "formatted_address": result.get("formatted_address"),
                            **components
                        }
        except Exception as e:
            logger.error(f"Error geocoding ZIP: {e}")

        return None

    async def get_nearby_metros(self, lat: float, lng: float,
                                max_distance_miles: float = 150) -> List[Dict[str, Any]]:
        """
        Find nearby major metro areas and calculate drive times.

        Args:
            lat: Latitude
            lng: Longitude
            max_distance_miles: Maximum straight-line distance to check

        Returns:
            List of metro areas with drive times
        """
        # Major metro areas in the region
        metros = [
            {"name": "Pittsburgh, PA", "lat": 40.4406, "lng": -79.9959},
            {"name": "Washington, DC", "lat": 38.9072, "lng": -77.0369},
            {"name": "Baltimore, MD", "lat": 39.2904, "lng": -76.6122},
            {"name": "Philadelphia, PA", "lat": 39.9526, "lng": -75.1652},
            {"name": "Columbus, OH", "lat": 39.9612, "lng": -82.9988},
            {"name": "Cleveland, OH", "lat": 41.4993, "lng": -81.6944},
            {"name": "Richmond, VA", "lat": 37.5407, "lng": -77.4360},
            {"name": "Charleston, WV", "lat": 38.3498, "lng": -81.6326},
        ]

        results = []
        for metro in metros:
            # Calculate straight-line distance
            distance = self._haversine(lat, lng, metro["lat"], metro["lng"])
            if distance <= max_distance_miles:
                # Get actual drive time
                drive_info = await self.get_drive_time(lat, lng, metro["lat"], metro["lng"])
                if drive_info:
                    results.append({
                        "name": metro["name"],
                        "straight_line_miles": round(distance, 1),
                        "drive_minutes": drive_info["duration_minutes"],
                        "drive_miles": drive_info["distance_miles"],
                    })

        # Sort by drive time
        results.sort(key=lambda x: x["drive_minutes"])
        return results

    def _haversine(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate haversine distance in miles."""
        R = 3959  # Earth's radius in miles

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)

        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
        c = 2 * math.asin(math.sqrt(a))

        return R * c


# Convenience functions
async def get_storage_facilities_near_zip(zip_code: str, radius_miles: float = 10) -> List[Dict]:
    """
    Get storage facilities near a ZIP code.

    Args:
        zip_code: 5-digit ZIP code
        radius_miles: Search radius in miles

    Returns:
        List of facility dictionaries
    """
    async with GoogleService() as service:
        # First geocode the ZIP
        geo = await service.geocode_zip(zip_code)
        if geo:
            return await service.get_storage_facilities(geo["lat"], geo["lng"], radius_miles)
    return []


async def get_saturation_data(zip_code: str, radius_miles: float = 5) -> Dict[str, Any]:
    """
    Get saturation data for a ZIP code (facility count, rough sq ft estimate).

    Args:
        zip_code: 5-digit ZIP code
        radius_miles: Search radius in miles

    Returns:
        Dictionary with facility_count, estimated_sqft, facilities list
    """
    facilities = await get_storage_facilities_near_zip(zip_code, radius_miles)

    # Estimate square footage (rough: avg 50,000 sq ft per facility)
    avg_sqft_per_facility = 50000
    estimated_total_sqft = len(facilities) * avg_sqft_per_facility

    return {
        "zip_code": zip_code,
        "radius_miles": radius_miles,
        "facility_count": len(facilities),
        "estimated_sqft": estimated_total_sqft,
        "facilities": facilities
    }
