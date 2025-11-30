"""
Storage Facility Site Screener - Database Schema Creation
Creates all tables for the 9-stage screening pipeline.

NOTE: This script works with the existing schema structure where:
- target_zones uses zone_id (not id) as primary key
- zips_master already has comprehensive ZIP data with demographics
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Neon connection
CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def get_connection():
    return psycopg2.connect(CONNECTION_STRING)

def check_existing_tables():
    """Check what tables already exist."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    return tables

def create_schema():
    """Create all tables for the storage facility screener."""
    conn = get_connection()
    cursor = conn.cursor()

    print("=" * 60)
    print("CREATING STORAGE FACILITY SCREENER SCHEMA")
    print("=" * 60)

    # NOTE: target_zones already exists with zone_id as primary key
    # Existing schema:
    #   zone_id: integer (PK)
    #   zone_name: varchar
    #   center_zip, center_lat, center_lon, radius_miles, states, created_at
    print("\n1. target_zones - EXISTING (zone_id is PK)")
    print("   ✓ Using existing target_zones table")

    # 2. zone_zips - Links zones to ZIPs within radius
    print("\n2. Creating zone_zips...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS zone_zips (
            id SERIAL PRIMARY KEY,
            zone_id INT REFERENCES target_zones(zone_id) ON DELETE CASCADE,
            zip VARCHAR(5),
            distance_miles DECIMAL(6, 2),
            included BOOLEAN DEFAULT TRUE
        )
    """)
    print("   ✓ zone_zips created")

    # 3. layer_1_geography - First screening layer
    print("\n3. Creating layer_1_geography...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS layer_1_geography (
            zip VARCHAR(5) PRIMARY KEY,
            zone_id INT REFERENCES target_zones(zone_id) ON DELETE CASCADE,
            state VARCHAR(2),
            county_fips VARCHAR(5),
            county_name VARCHAR(100),
            centroid_lat DECIMAL(10, 7),
            centroid_lon DECIMAL(10, 7),
            distance_miles DECIMAL(6, 2),
            passed BOOLEAN DEFAULT TRUE,
            kill_reason VARCHAR(100)
        )
    """)
    print("   ✓ layer_1_geography created")

    # 4. layer_2_demographics - Census demographic data
    print("\n4. Creating layer_2_demographics...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS layer_2_demographics (
            zip VARCHAR(5) PRIMARY KEY,
            population INT,
            median_income INT,
            poverty_rate DECIMAL(5, 2),
            renter_pct DECIMAL(5, 2),
            median_age DECIMAL(4, 1),
            housing_units INT,
            occupied_units INT,
            sfh_units INT,
            townhome_units INT,
            apartment_units INT,
            mobile_home_units INT,
            passed BOOLEAN DEFAULT TRUE,
            kill_reason VARCHAR(100)
        )
    """)
    print("   ✓ layer_2_demographics created")

    # 5. layer_3_counties - County aggregation
    print("\n5. Creating layer_3_counties...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS layer_3_counties (
            county_fips VARCHAR(5) PRIMARY KEY,
            state VARCHAR(2),
            county_name VARCHAR(100),
            surviving_zips INT,
            total_population INT,
            total_housing_units INT,
            total_sfh INT,
            total_townhome INT,
            total_apartment INT,
            total_mobile_home INT,
            avg_income INT,
            avg_poverty DECIMAL(5, 2),
            avg_renter_pct DECIMAL(5, 2)
        )
    """)
    print("   ✓ layer_3_counties created")

    # 6. storage_facilities - Competitor analysis
    print("\n6. Creating storage_facilities...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS storage_facilities (
            id SERIAL PRIMARY KEY,
            place_id VARCHAR(100) UNIQUE,
            name VARCHAR(200),
            address VARCHAR(300),
            city VARCHAR(100),
            state VARCHAR(2),
            zip VARCHAR(5),
            county_fips VARCHAR(5),
            lat DECIMAL(10, 7),
            lon DECIMAL(10, 7),
            total_sqft INT,
            unit_count INT,
            year_built INT,
            climate_controlled BOOLEAN,
            drive_up BOOLEAN,
            rv_boat BOOLEAN,
            owner_operator VARCHAR(200),
            rating DECIMAL(2, 1),
            review_count INT,
            asking_rent_10x10 INT,
            asking_rent_10x20 INT,
            source VARCHAR(100),
            fetched_at TIMESTAMP DEFAULT NOW()
        )
    """)
    print("   ✓ storage_facilities created")

    # 7. housing_communities - Demand drivers (existing + pipeline)
    print("\n7. Creating housing_communities...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS housing_communities (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200),
            address VARCHAR(300),
            city VARCHAR(100),
            state VARCHAR(2),
            zip VARCHAR(5),
            county_fips VARCHAR(5),
            lat DECIMAL(10, 7),
            lon DECIMAL(10, 7),
            community_type VARCHAR(50),
            status VARCHAR(20),
            total_units INT,
            year_built INT,
            permit_date DATE,
            site_work_date DATE,
            vertical_date DATE,
            completion_date DATE,
            expected_completion DATE,
            builder VARCHAR(200),
            permit_number VARCHAR(100),
            source VARCHAR(100),
            source_url VARCHAR(500),
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(name, city, state)
        )
    """)
    print("   ✓ housing_communities created")

    # 8. demand_anchors - Colleges, military, hospitals, etc.
    print("\n8. Creating demand_anchors...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS demand_anchors (
            id SERIAL PRIMARY KEY,
            place_id VARCHAR(100) UNIQUE,
            name VARCHAR(200),
            anchor_type VARCHAR(50),
            address VARCHAR(300),
            city VARCHAR(100),
            state VARCHAR(2),
            zip VARCHAR(5),
            county_fips VARCHAR(5),
            lat DECIMAL(10, 7),
            lon DECIMAL(10, 7),
            size_estimate VARCHAR(50),
            student_count INT,
            employee_count INT,
            unit_count INT,
            source VARCHAR(100),
            fetched_at TIMESTAMP DEFAULT NOW()
        )
    """)
    print("   ✓ demand_anchors created")

    # 9. county_scoring - Final scoring by county
    print("\n9. Creating county_scoring...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS county_scoring (
            county_fips VARCHAR(5) PRIMARY KEY,
            demand_score INT,
            supply_score INT,
            growth_score INT,
            risk_score INT,
            access_score INT,
            total_score INT,
            tier INT,
            notes TEXT,
            scored_at TIMESTAMP DEFAULT NOW()
        )
    """)
    print("   ✓ county_scoring created")

    # 10. flood_zones - FEMA flood zone overlay
    print("\n10. Creating flood_zones...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS flood_zones (
            id SERIAL PRIMARY KEY,
            zone_id VARCHAR(20),
            county_fips VARCHAR(5),
            risk_level VARCHAR(20),
            geometry_json TEXT
        )
    """)
    print("   ✓ flood_zones created")

    # 11. Update api_cache table if needed
    print("\n11. Checking api_cache table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS api_cache (
            id SERIAL PRIMARY KEY,
            cache_key VARCHAR(200) UNIQUE,
            data JSONB,
            response JSONB,
            source VARCHAR(50),
            ttl_days INT,
            fetched_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP
        )
    """)
    print("   ✓ api_cache created/verified")

    conn.commit()
    print("\n" + "=" * 60)
    print("CREATING INDEXES")
    print("=" * 60)

    # Create indexes
    indexes = [
        ("idx_zone_zips_zone_id", "zone_zips", "zone_id"),
        ("idx_zone_zips_zip", "zone_zips", "zip"),
        ("idx_layer1_zone_id", "layer_1_geography", "zone_id"),
        ("idx_layer1_county_fips", "layer_1_geography", "county_fips"),
        ("idx_layer1_state", "layer_1_geography", "state"),
        ("idx_layer2_zip", "layer_2_demographics", "zip"),
        ("idx_storage_zip", "storage_facilities", "zip"),
        ("idx_storage_county", "storage_facilities", "county_fips"),
        ("idx_storage_state", "storage_facilities", "state"),
        ("idx_housing_zip", "housing_communities", "zip"),
        ("idx_housing_county", "housing_communities", "county_fips"),
        ("idx_housing_status", "housing_communities", "status"),
        ("idx_housing_type", "housing_communities", "community_type"),
        ("idx_anchors_zip", "demand_anchors", "zip"),
        ("idx_anchors_county", "demand_anchors", "county_fips"),
        ("idx_anchors_type", "demand_anchors", "anchor_type"),
        ("idx_flood_county", "flood_zones", "county_fips"),
        ("idx_api_cache_key", "api_cache", "cache_key"),
        ("idx_api_cache_expires", "api_cache", "expires_at"),
    ]

    for idx_name, table, column in indexes:
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({column})")
            print(f"   ✓ {idx_name}")
        except Exception as e:
            print(f"   ⚠ {idx_name}: {e}")

    conn.commit()

    print("\n" + "=" * 60)
    print("CREATING HAVERSINE FUNCTION")
    print("=" * 60)

    # Create haversine_miles function
    cursor.execute("""
        CREATE OR REPLACE FUNCTION haversine_miles(
            lat1 DECIMAL, lon1 DECIMAL,
            lat2 DECIMAL, lon2 DECIMAL
        ) RETURNS DECIMAL AS $$
        DECLARE
            R DECIMAL := 3959;  -- Earth's radius in miles
            dlat DECIMAL;
            dlon DECIMAL;
            a DECIMAL;
            c DECIMAL;
        BEGIN
            dlat := RADIANS(lat2 - lat1);
            dlon := RADIANS(lon2 - lon1);
            a := SIN(dlat/2) * SIN(dlat/2) +
                 COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
                 SIN(dlon/2) * SIN(dlon/2);
            c := 2 * ASIN(SQRT(a));
            RETURN R * c;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
    """)
    print("   ✓ haversine_miles function created")

    conn.commit()
    conn.close()
    print("\n✓ Schema creation complete!")

def verify_schema():
    """Verify all tables were created and show counts."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 60)
    print("VERIFICATION - TABLE COUNTS")
    print("=" * 60)

    tables = [
        "target_zones", "zone_zips", "layer_1_geography",
        "layer_2_demographics", "layer_3_counties", "storage_facilities",
        "housing_communities", "demand_anchors", "county_scoring",
        "flood_zones", "api_cache", "zips_master"
    ]

    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"   {table}: {count:,} rows")
        except Exception as e:
            print(f"   {table}: ⚠ {e}")

    # Test haversine function
    print("\n" + "=" * 60)
    print("TESTING HAVERSINE FUNCTION")
    print("=" * 60)

    # Distance from Bedford PA (15522) to Pittsburgh PA
    cursor.execute("""
        SELECT haversine_miles(39.9956, -78.5047, 40.4406, -79.9959) as distance
    """)
    distance = cursor.fetchone()[0]
    print(f"   Bedford PA to Pittsburgh PA: {distance:.1f} miles")

    conn.close()

if __name__ == "__main__":
    print("\nExisting tables:")
    existing = check_existing_tables()
    for t in existing:
        print(f"   - {t}")

    print("\n")
    create_schema()
    verify_schema()
