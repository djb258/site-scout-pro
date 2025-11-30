"""
Storage Facility Site Screener - Web API
FastAPI backend serving map data from Neon PostgreSQL
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor
import json
import math
from typing import Optional, List
from pydantic import BaseModel

app = FastAPI(title="Storage Site Screener API", version="1.0.0")

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def get_db():
    return psycopg2.connect(CONNECTION_STRING)

# Constants
BEDFORD_LAT = 40.0186
BEDFORD_LON = -78.5039
RADIUS_MILES = 120

# Tier colors
TIER_COLORS = {
    1: "#22c55e",  # Green
    2: "#eab308",  # Yellow
    3: "#9ca3af",  # Gray
}

# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.get("/api/health")
async def health():
    return {"status": "ok", "database": "connected"}

# -----------------------------------------------------------------------------
# ZONES
# -----------------------------------------------------------------------------

@app.get("/api/zones")
async def list_zones():
    """List all target zones."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("""
        SELECT zone_id, zone_name, center_zip, center_lat, center_lon,
               radius_miles, states, created_at
        FROM target_zones
        ORDER BY zone_id
    """)
    zones = cursor.fetchall()
    conn.close()

    return {"zones": [dict(z) for z in zones]}

@app.get("/api/zone/{zone_id}/boundary")
async def get_zone_boundary(zone_id: int):
    """Get GeoJSON circle boundary for a zone."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("""
        SELECT center_lat, center_lon, radius_miles
        FROM target_zones
        WHERE zone_id = %s
    """, (zone_id,))
    zone = cursor.fetchone()
    conn.close()

    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    # Generate circle GeoJSON (approximate with 64 points)
    center_lat = float(zone['center_lat'])
    center_lon = float(zone['center_lon'])
    radius_miles = float(zone['radius_miles'])

    # Convert miles to degrees (approximate)
    radius_lat = radius_miles / 69.0
    radius_lon = radius_miles / (69.0 * math.cos(math.radians(center_lat)))

    points = []
    for i in range(65):
        angle = (i / 64) * 2 * math.pi
        lat = center_lat + radius_lat * math.sin(angle)
        lon = center_lon + radius_lon * math.cos(angle)
        points.append([lon, lat])

    geojson = {
        "type": "Feature",
        "properties": {
            "zone_id": zone_id,
            "radius_miles": radius_miles,
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [points]
        }
    }

    return geojson

# -----------------------------------------------------------------------------
# COUNTIES
# -----------------------------------------------------------------------------

@app.get("/api/counties")
async def list_counties(tier: Optional[int] = None):
    """List all counties with scores and tiers."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT county_fips, county_name, state, surviving_zips,
               total_population, total_housing_units, demand_sqft,
               high_demand_units, avg_income, avg_poverty, avg_renter_pct,
               total_sfh, total_townhome, total_apartment, total_mobile_home
        FROM layer_3_counties
    """

    if tier:
        # Add tier filter (we'll calculate tier in Python for now)
        pass

    query += " ORDER BY demand_sqft DESC"

    cursor.execute(query)
    counties = cursor.fetchall()
    conn.close()

    # Add tier based on demand ranking
    result = []
    for i, county in enumerate(counties):
        c = dict(county)
        # Top 33% = Tier 1, Middle 33% = Tier 2, Bottom 33% = Tier 3
        percentile = i / len(counties)
        if percentile < 0.33:
            c['tier'] = 1
        elif percentile < 0.67:
            c['tier'] = 2
        else:
            c['tier'] = 3
        c['tier_color'] = TIER_COLORS[c['tier']]
        c['rank'] = i + 1
        result.append(c)

    if tier:
        result = [c for c in result if c['tier'] == tier]

    return {"counties": result, "total": len(result)}

@app.get("/api/counties/{fips}")
async def get_county(fips: str):
    """Get detailed county information."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("""
        SELECT * FROM layer_3_counties
        WHERE county_fips = %s
    """, (fips,))
    county = cursor.fetchone()

    if not county:
        conn.close()
        raise HTTPException(status_code=404, detail="County not found")

    # Get facility count
    cursor.execute("""
        SELECT COUNT(*) as count FROM storage_facilities
        WHERE county_fips = %s
    """, (fips,))
    facility_count = cursor.fetchone()['count']

    # Get housing count
    cursor.execute("""
        SELECT COUNT(*) as count FROM housing_communities
        WHERE county_fips = %s
    """, (fips,))
    housing_count = cursor.fetchone()['count']

    # Get anchor count
    cursor.execute("""
        SELECT COUNT(*) as count FROM demand_anchors
        WHERE county_fips = %s
    """, (fips,))
    anchor_count = cursor.fetchone()['count']

    conn.close()

    result = dict(county)
    result['facility_count'] = facility_count
    result['housing_count'] = housing_count
    result['anchor_count'] = anchor_count

    return result

@app.get("/api/counties/geojson")
async def get_counties_geojson():
    """Get counties as GeoJSON for map display."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    # Get county data with centroids from zips
    cursor.execute("""
        SELECT l3.county_fips, l3.county_name, l3.state, l3.demand_sqft,
               l3.total_population, l3.avg_income,
               AVG(l1.centroid_lat) as center_lat,
               AVG(l1.centroid_lon) as center_lon
        FROM layer_3_counties l3
        JOIN layer_1_geography l1 ON l3.county_fips = l1.county_fips
        GROUP BY l3.county_fips, l3.county_name, l3.state, l3.demand_sqft,
                 l3.total_population, l3.avg_income
        ORDER BY l3.demand_sqft DESC
    """)
    counties = cursor.fetchall()
    conn.close()

    features = []
    for i, county in enumerate(counties):
        # Calculate tier
        percentile = i / len(counties)
        if percentile < 0.33:
            tier = 1
        elif percentile < 0.67:
            tier = 2
        else:
            tier = 3

        feature = {
            "type": "Feature",
            "properties": {
                "fips": county['county_fips'],
                "name": county['county_name'],
                "state": county['state'],
                "tier": tier,
                "color": TIER_COLORS[tier],
                "demand_sqft": county['demand_sqft'],
                "population": county['total_population'],
                "avg_income": county['avg_income'],
                "rank": i + 1,
            },
            "geometry": {
                "type": "Point",
                "coordinates": [float(county['center_lon']), float(county['center_lat'])]
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }

# -----------------------------------------------------------------------------
# FACILITIES
# -----------------------------------------------------------------------------

@app.get("/api/facilities")
async def list_facilities(
    county_fips: Optional[str] = None,
    limit: int = Query(default=500, le=2000)
):
    """List storage facilities."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT id, place_id, name, address, city, state, zip, county_fips,
               lat, lon, total_sqft, unit_count, climate_controlled,
               drive_up, rv_boat, rating, review_count,
               asking_rent_10x10, asking_rent_10x20,
               no_competition_5mi, nearest_competitor_miles
        FROM storage_facilities
        WHERE lat IS NOT NULL AND lon IS NOT NULL
    """
    params = []

    if county_fips:
        query += " AND county_fips = %s"
        params.append(county_fips)

    query += f" LIMIT {limit}"

    cursor.execute(query, params)
    facilities = cursor.fetchall()
    conn.close()

    return {"facilities": [dict(f) for f in facilities], "total": len(facilities)}

@app.get("/api/facilities/{facility_id}")
async def get_facility(facility_id: int):
    """Get single facility details."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("""
        SELECT * FROM storage_facilities
        WHERE id = %s
    """, (facility_id,))
    facility = cursor.fetchone()
    conn.close()

    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    return dict(facility)

@app.get("/api/facilities/geojson")
async def get_facilities_geojson(county_fips: Optional[str] = None):
    """Get facilities as GeoJSON."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT id, name, address, city, state, lat, lon, county_fips,
               rating, review_count, asking_rent_10x10, no_competition_5mi
        FROM storage_facilities
        WHERE lat IS NOT NULL AND lon IS NOT NULL
    """
    params = []

    if county_fips:
        query += " AND county_fips = %s"
        params.append(county_fips)

    cursor.execute(query, params)
    facilities = cursor.fetchall()
    conn.close()

    features = []
    for f in facilities:
        feature = {
            "type": "Feature",
            "properties": {
                "id": f['id'],
                "name": f['name'],
                "address": f['address'],
                "city": f['city'],
                "state": f['state'],
                "rating": float(f['rating']) if f['rating'] else None,
                "review_count": f['review_count'],
                "rent_10x10": f['asking_rent_10x10'],
                "no_competition": f['no_competition_5mi'],
                "type": "facility",
            },
            "geometry": {
                "type": "Point",
                "coordinates": [float(f['lon']), float(f['lat'])]
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }

# -----------------------------------------------------------------------------
# HOUSING
# -----------------------------------------------------------------------------

@app.get("/api/housing")
async def list_housing(
    county_fips: Optional[str] = None,
    community_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=500, le=2000)
):
    """List housing communities."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT id, name, address, city, state, zip, county_fips,
               lat, lon, community_type, status, total_units
        FROM housing_communities
        WHERE lat IS NOT NULL AND lon IS NOT NULL
    """
    params = []

    if county_fips:
        query += " AND county_fips = %s"
        params.append(county_fips)

    if community_type:
        query += " AND community_type = %s"
        params.append(community_type)

    if status:
        query += " AND status = %s"
        params.append(status)

    query += f" LIMIT {limit}"

    cursor.execute(query, params)
    housing = cursor.fetchall()
    conn.close()

    return {"housing": [dict(h) for h in housing], "total": len(housing)}

@app.get("/api/housing/geojson")
async def get_housing_geojson(
    county_fips: Optional[str] = None,
    community_type: Optional[str] = None
):
    """Get housing as GeoJSON."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT id, name, city, state, lat, lon, county_fips,
               community_type, status, total_units
        FROM housing_communities
        WHERE lat IS NOT NULL AND lon IS NOT NULL
    """
    params = []

    if county_fips:
        query += " AND county_fips = %s"
        params.append(county_fips)

    if community_type:
        query += " AND community_type = %s"
        params.append(community_type)

    cursor.execute(query, params)
    housing = cursor.fetchall()
    conn.close()

    # Color by type
    type_colors = {
        'apartment': '#3b82f6',    # Blue
        'townhome': '#8b5cf6',     # Purple
        'condo': '#06b6d4',        # Cyan
        'mobile_home': '#f59e0b',  # Orange
    }

    features = []
    for h in housing:
        feature = {
            "type": "Feature",
            "properties": {
                "id": h['id'],
                "name": h['name'],
                "city": h['city'],
                "state": h['state'],
                "community_type": h['community_type'],
                "status": h['status'],
                "total_units": h['total_units'],
                "color": type_colors.get(h['community_type'], '#9ca3af'),
                "type": "housing",
            },
            "geometry": {
                "type": "Point",
                "coordinates": [float(h['lon']), float(h['lat'])]
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }

# -----------------------------------------------------------------------------
# ANCHORS
# -----------------------------------------------------------------------------

@app.get("/api/anchors")
async def list_anchors(
    county_fips: Optional[str] = None,
    anchor_type: Optional[str] = None,
    limit: int = Query(default=500, le=2000)
):
    """List demand anchors."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT id, name, anchor_type, address, city, state, zip,
               county_fips, lat, lon, size_estimate
        FROM demand_anchors
        WHERE lat IS NOT NULL AND lon IS NOT NULL
    """
    params = []

    if county_fips:
        query += " AND county_fips = %s"
        params.append(county_fips)

    if anchor_type:
        query += " AND anchor_type LIKE %s"
        params.append(f"%{anchor_type}%")

    query += f" LIMIT {limit}"

    cursor.execute(query, params)
    anchors = cursor.fetchall()
    conn.close()

    return {"anchors": [dict(a) for a in anchors], "total": len(anchors)}

@app.get("/api/anchors/geojson")
async def get_anchors_geojson(
    county_fips: Optional[str] = None,
    anchor_type: Optional[str] = None
):
    """Get anchors as GeoJSON."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT id, name, anchor_type, city, state, lat, lon,
               county_fips, size_estimate
        FROM demand_anchors
        WHERE lat IS NOT NULL AND lon IS NOT NULL
    """
    params = []

    if county_fips:
        query += " AND county_fips = %s"
        params.append(county_fips)

    if anchor_type:
        query += " AND anchor_type LIKE %s"
        params.append(f"%{anchor_type}%")

    cursor.execute(query, params)
    anchors = cursor.fetchall()
    conn.close()

    # Color by anchor category
    type_colors = {
        'university': '#dc2626',      # Red
        'college': '#ef4444',         # Light red
        'community_college': '#f87171',
        'military': '#059669',        # Green
        'hospital': '#0ea5e9',        # Sky blue
        'distribution_center': '#7c3aed',  # Violet
        'warehouse': '#a855f7',       # Purple
        'manufacturing': '#c084fc',   # Light purple
        'rv_park': '#f97316',         # Orange
        'marina': '#fb923c',          # Light orange
        'mobile_home_park': '#fbbf24', # Amber
    }

    features = []
    for a in anchors:
        anchor_type = a['anchor_type'] or 'other'
        color = type_colors.get(anchor_type, '#6b7280')

        feature = {
            "type": "Feature",
            "properties": {
                "id": a['id'],
                "name": a['name'],
                "anchor_type": anchor_type,
                "city": a['city'],
                "state": a['state'],
                "size": a['size_estimate'],
                "color": color,
                "type": "anchor",
            },
            "geometry": {
                "type": "Point",
                "coordinates": [float(a['lon']), float(a['lat'])]
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }

# -----------------------------------------------------------------------------
# SUMMARY STATS
# -----------------------------------------------------------------------------

@app.get("/api/stats")
async def get_stats():
    """Get summary statistics."""
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    stats = {}

    # Counties
    cursor.execute("SELECT COUNT(*) as count FROM layer_3_counties")
    stats['counties'] = cursor.fetchone()['count']

    # Facilities
    cursor.execute("SELECT COUNT(*) as count FROM storage_facilities")
    stats['facilities'] = cursor.fetchone()['count']

    # Housing
    cursor.execute("SELECT COUNT(*) as count FROM housing_communities")
    stats['housing'] = cursor.fetchone()['count']

    # Anchors
    cursor.execute("SELECT COUNT(*) as count FROM demand_anchors")
    stats['anchors'] = cursor.fetchone()['count']

    # Total population
    cursor.execute("SELECT SUM(total_population) as total FROM layer_3_counties")
    stats['total_population'] = cursor.fetchone()['total']

    # Total demand sqft
    cursor.execute("SELECT SUM(demand_sqft) as total FROM layer_3_counties")
    stats['total_demand_sqft'] = cursor.fetchone()['total']

    conn.close()

    return stats

# =============================================================================
# SERVE STATIC FILES
# =============================================================================

# Mount static files
try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
except:
    pass  # Static directory may not exist yet

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
