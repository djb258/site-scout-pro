#!/usr/bin/env python3
"""
Create Stage 8 reference tables for strategic scoring.
These tables store data from external sources used in final scoring.
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import psycopg2

CONN_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

TABLES = {
    'stip_projects': """
        -- Highway expansion projects from State DOT STIP/TIP
        CREATE TABLE IF NOT EXISTS stip_projects (
            id SERIAL PRIMARY KEY,
            state VARCHAR(2) NOT NULL,
            project_id VARCHAR(50),
            project_name VARCHAR(500),
            route VARCHAR(100),
            county VARCHAR(100),
            description TEXT,
            project_type VARCHAR(50),  -- 'expansion', 'interchange', 'bridge', 'safety'
            estimated_cost DECIMAL(15,2),
            funding_status VARCHAR(50),  -- 'funded', 'planned', 'under_construction'
            start_year INT,
            completion_year INT,
            lat DECIMAL(10,5),
            lng DECIMAL(10,5),
            source_url VARCHAR(500),
            fetched_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_stip_state ON stip_projects(state);
        CREATE INDEX IF NOT EXISTS idx_stip_county ON stip_projects(county);
        CREATE INDEX IF NOT EXISTS idx_stip_status ON stip_projects(funding_status);
        CREATE INDEX IF NOT EXISTS idx_stip_type ON stip_projects(project_type);
    """,

    'mfg_announcements': """
        -- Manufacturing and economic development announcements
        CREATE TABLE IF NOT EXISTS mfg_announcements (
            id SERIAL PRIMARY KEY,
            state VARCHAR(2) NOT NULL,
            company_name VARCHAR(200),
            project_name VARCHAR(300),
            city VARCHAR(100),
            county VARCHAR(100),
            announcement_date DATE,
            jobs_created INT,
            investment_amount DECIMAL(15,2),
            industry VARCHAR(100),  -- 'manufacturing', 'chips', 'battery', 'ev', 'pharma', etc.
            project_type VARCHAR(50),  -- 'new_facility', 'expansion', 'relocation'
            is_chips_act BOOLEAN DEFAULT FALSE,
            is_ira BOOLEAN DEFAULT FALSE,
            is_reshoring BOOLEAN DEFAULT FALSE,
            lat DECIMAL(10,5),
            lng DECIMAL(10,5),
            source VARCHAR(100),  -- 'selectusa', 'state_eda', 'goodjobsfirst', etc.
            source_url VARCHAR(500),
            fetched_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_mfg_state ON mfg_announcements(state);
        CREATE INDEX IF NOT EXISTS idx_mfg_county ON mfg_announcements(county);
        CREATE INDEX IF NOT EXISTS idx_mfg_industry ON mfg_announcements(industry);
        CREATE INDEX IF NOT EXISTS idx_mfg_date ON mfg_announcements(announcement_date);
        CREATE INDEX IF NOT EXISTS idx_mfg_jobs ON mfg_announcements(jobs_created);
    """,

    'water_bodies': """
        -- Lakes, rivers, and reservoirs for RV/boat proximity scoring
        CREATE TABLE IF NOT EXISTS water_bodies (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200),
            water_type VARCHAR(50),  -- 'lake', 'reservoir', 'river', 'bay'
            state VARCHAR(2),
            county VARCHAR(100),
            area_acres DECIMAL(12,2),
            perimeter_miles DECIMAL(10,2),
            has_public_access BOOLEAN,
            has_marina BOOLEAN,
            has_boat_launch BOOLEAN,
            centroid_lat DECIMAL(10,5),
            centroid_lng DECIMAL(10,5),
            source VARCHAR(50),  -- 'usgs_nhd', 'state_dnr'
            gnis_id VARCHAR(20),
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_water_state ON water_bodies(state);
        CREATE INDEX IF NOT EXISTS idx_water_type ON water_bodies(water_type);
        CREATE INDEX IF NOT EXISTS idx_water_area ON water_bodies(area_acres);
    """,

    'campgrounds': """
        -- RV parks and campgrounds
        CREATE TABLE IF NOT EXISTS campgrounds (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200),
            campground_type VARCHAR(50),  -- 'rv_park', 'campground', 'koa', 'state_park', 'federal'
            state VARCHAR(2),
            county VARCHAR(100),
            city VARCHAR(100),
            address VARCHAR(300),
            total_sites INT,
            rv_sites INT,
            has_hookups BOOLEAN,
            lat DECIMAL(10,5),
            lng DECIMAL(10,5),
            google_place_id VARCHAR(100),
            google_rating DECIMAL(2,1),
            google_review_count INT,
            source VARCHAR(50),  -- 'google_places', 'recreation_gov', 'koa', 'state_parks'
            source_url VARCHAR(500),
            fetched_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_camp_state ON campgrounds(state);
        CREATE INDEX IF NOT EXISTS idx_camp_county ON campgrounds(county);
        CREATE INDEX IF NOT EXISTS idx_camp_type ON campgrounds(campground_type);
        CREATE INDEX IF NOT EXISTS idx_camp_sites ON campgrounds(rv_sites);
    """,

    'military_bases': """
        -- DoD installations
        CREATE TABLE IF NOT EXISTS military_bases (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200),
            branch VARCHAR(50),  -- 'army', 'navy', 'air_force', 'marines', 'coast_guard', 'national_guard'
            installation_type VARCHAR(50),  -- 'base', 'fort', 'station', 'depot', 'arsenal'
            state VARCHAR(2),
            county VARCHAR(100),
            city VARCHAR(100),
            military_personnel INT,
            civilian_personnel INT,
            total_personnel INT,
            lat DECIMAL(10,5),
            lng DECIMAL(10,5),
            source VARCHAR(50),
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_mil_state ON military_bases(state);
        CREATE INDEX IF NOT EXISTS idx_mil_branch ON military_bases(branch);
        CREATE INDEX IF NOT EXISTS idx_mil_personnel ON military_bases(total_personnel);
    """,

    'universities': """
        -- Colleges and universities with enrollment data
        CREATE TABLE IF NOT EXISTS universities (
            id SERIAL PRIMARY KEY,
            name VARCHAR(300),
            ipeds_id VARCHAR(20),
            institution_type VARCHAR(50),  -- 'public_4yr', 'private_4yr', 'public_2yr', 'private_2yr'
            state VARCHAR(2),
            county VARCHAR(100),
            city VARCHAR(100),
            address VARCHAR(300),
            total_enrollment INT,
            undergrad_enrollment INT,
            grad_enrollment INT,
            has_dorms BOOLEAN,
            dorm_capacity INT,
            lat DECIMAL(10,5),
            lng DECIMAL(10,5),
            source VARCHAR(50),  -- 'ipeds'
            data_year INT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_univ_state ON universities(state);
        CREATE INDEX IF NOT EXISTS idx_univ_county ON universities(county);
        CREATE INDEX IF NOT EXISTS idx_univ_enrollment ON universities(total_enrollment);
        CREATE INDEX IF NOT EXISTS idx_univ_type ON universities(institution_type);
    """,

    'distribution_centers': """
        -- Amazon, FedEx, UPS, and other major distribution facilities
        CREATE TABLE IF NOT EXISTS distribution_centers (
            id SERIAL PRIMARY KEY,
            company VARCHAR(100),  -- 'amazon', 'fedex', 'ups', 'walmart', 'target'
            facility_name VARCHAR(200),
            facility_type VARCHAR(50),  -- 'fulfillment', 'sortation', 'delivery', 'hub', 'ground'
            facility_code VARCHAR(20),  -- e.g., 'BWI2' for Amazon
            state VARCHAR(2),
            county VARCHAR(100),
            city VARCHAR(100),
            address VARCHAR(300),
            sqft INT,
            employees INT,
            opened_year INT,
            lat DECIMAL(10,5),
            lng DECIMAL(10,5),
            source VARCHAR(50),  -- 'mwpvl', 'company_website'
            source_url VARCHAR(500),
            fetched_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_dc_state ON distribution_centers(state);
        CREATE INDEX IF NOT EXISTS idx_dc_company ON distribution_centers(company);
        CREATE INDEX IF NOT EXISTS idx_dc_type ON distribution_centers(facility_type);
        CREATE INDEX IF NOT EXISTS idx_dc_employees ON distribution_centers(employees);
    """,

    'migration_data': """
        -- IRS county-to-county migration flows
        CREATE TABLE IF NOT EXISTS migration_data (
            id SERIAL PRIMARY KEY,
            data_year INT,
            origin_state VARCHAR(2),
            origin_county_fips VARCHAR(5),
            origin_county_name VARCHAR(100),
            dest_state VARCHAR(2),
            dest_county_fips VARCHAR(5),
            dest_county_name VARCHAR(100),
            returns INT,  -- number of tax returns (proxy for households)
            exemptions INT,  -- number of exemptions (proxy for people)
            agi DECIMAL(15,2),  -- adjusted gross income in thousands
            flow_direction VARCHAR(10),  -- 'inflow' or 'outflow'
            source VARCHAR(50),  -- 'irs_soi'
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_mig_dest_state ON migration_data(dest_state);
        CREATE INDEX IF NOT EXISTS idx_mig_dest_county ON migration_data(dest_county_fips);
        CREATE INDEX IF NOT EXISTS idx_mig_year ON migration_data(data_year);
        CREATE INDEX IF NOT EXISTS idx_mig_returns ON migration_data(returns);
    """,

    'employment_data': """
        -- BLS QCEW employment by industry
        CREATE TABLE IF NOT EXISTS employment_data (
            id SERIAL PRIMARY KEY,
            data_year INT,
            data_quarter INT,
            state VARCHAR(2),
            county_fips VARCHAR(5),
            county_name VARCHAR(100),
            naics_code VARCHAR(10),
            naics_title VARCHAR(200),
            ownership VARCHAR(50),  -- 'private', 'federal', 'state', 'local'
            establishments INT,
            employment INT,
            total_wages DECIMAL(15,2),
            avg_weekly_wage DECIMAL(10,2),
            source VARCHAR(50),  -- 'bls_qcew'
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_emp_state ON employment_data(state);
        CREATE INDEX IF NOT EXISTS idx_emp_county ON employment_data(county_fips);
        CREATE INDEX IF NOT EXISTS idx_emp_naics ON employment_data(naics_code);
        CREATE INDEX IF NOT EXISTS idx_emp_year_qtr ON employment_data(data_year, data_quarter);
    """,

    'county_gis_portals': """
        -- Reference table for county GIS portal URLs
        CREATE TABLE IF NOT EXISTS county_gis_portals (
            id SERIAL PRIMARY KEY,
            state VARCHAR(2) NOT NULL,
            county_fips VARCHAR(5) NOT NULL,
            county_name VARCHAR(100),
            gis_portal_url VARCHAR(500),
            zoning_map_url VARCHAR(500),
            parcel_search_url VARCHAR(500),
            planning_dept_url VARCHAR(500),
            notes TEXT,
            last_verified DATE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(state, county_fips)
        );
        CREATE INDEX IF NOT EXISTS idx_gis_state ON county_gis_portals(state);
    """
}

def main():
    print("=" * 60)
    print("CREATING STAGE 8 REFERENCE TABLES")
    print("=" * 60)

    conn = psycopg2.connect(CONN_STRING)
    cursor = conn.cursor()

    print("\nCreating tables...")
    for table_name, create_sql in TABLES.items():
        try:
            cursor.execute(create_sql)
            conn.commit()
            print(f"  ✓ {table_name}")
        except Exception as e:
            print(f"  ✗ {table_name}: {e}")
            conn.rollback()

    # Verify tables created
    print("\nVerifying tables...")
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN (
            'stip_projects', 'mfg_announcements', 'water_bodies',
            'campgrounds', 'military_bases', 'universities',
            'distribution_centers', 'migration_data', 'employment_data',
            'county_gis_portals'
        )
        ORDER BY table_name;
    """)
    created = cursor.fetchall()
    print(f"\n{len(created)} Stage 8 tables created:")
    for t in created:
        print(f"  - {t[0]}")

    conn.close()

    print("\n" + "=" * 60)
    print("STAGE 8 TABLES READY")
    print("=" * 60)

if __name__ == "__main__":
    main()
