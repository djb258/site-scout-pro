"""
Jurisdiction Intel & Reverse Feasibility Schema
================================================
Complete database schema for:
- Jurisdiction intel (permit requirements, contacts, fees)
- Document tracking
- Build constants
- Land cost benchmarks
- Reverse feasibility calculations
- Market saturation

Supports Replit front-end for data entry and calculator.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"


def get_connection():
    return psycopg2.connect(CONNECTION_STRING)


def create_jurisdiction_cards_table():
    """Create the enhanced jurisdiction_cards table."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("1. CREATING JURISDICTION_CARDS TABLE")
    print("=" * 70)

    # Drop and recreate to get full schema
    cursor.execute("""
        DROP TABLE IF EXISTS jurisdiction_documents CASCADE;
        DROP TABLE IF EXISTS jurisdiction_cards CASCADE;
    """)

    cursor.execute("""
        CREATE TABLE jurisdiction_cards (
            id SERIAL PRIMARY KEY,

            -- GEOGRAPHY
            county_fips VARCHAR(5) NOT NULL,
            county_name VARCHAR(100) NOT NULL,
            state VARCHAR(2) NOT NULL,
            jurisdiction VARCHAR(100),
            jurisdiction_type VARCHAR(50),

            -- ZONING
            zoning_districts_allowed TEXT[],
            zoning_code_section VARCHAR(50),
            storage_use_definition TEXT,
            storage_use_category VARCHAR(100),

            -- APPROVAL PATH
            by_right BOOLEAN DEFAULT FALSE,
            sup_required BOOLEAN DEFAULT FALSE,
            cup_required BOOLEAN DEFAULT FALSE,
            public_hearing_required BOOLEAN DEFAULT FALSE,
            planning_commission_review BOOLEAN DEFAULT FALSE,
            board_of_zoning_appeals BOOLEAN DEFAULT FALSE,
            approval_code_section VARCHAR(50),

            -- DIMENSIONAL STANDARDS
            setback_front_ft INT,
            setback_side_ft INT,
            setback_rear_ft INT,
            setback_code_section VARCHAR(50),
            max_height_ft INT,
            max_height_code_section VARCHAR(50),
            max_lot_coverage_pct INT,
            min_lot_size_acres DECIMAL(10,2),
            max_building_size_sqft INT,

            -- SITE REQUIREMENTS
            landscaping_required BOOLEAN DEFAULT FALSE,
            landscaping_code_section VARCHAR(50),
            landscaping_notes TEXT,
            buffer_required BOOLEAN DEFAULT FALSE,
            buffer_width_ft INT,
            buffer_code_section VARCHAR(50),
            screening_required BOOLEAN DEFAULT FALSE,
            screening_type VARCHAR(100),
            fencing_required BOOLEAN DEFAULT FALSE,
            fencing_height_ft INT,

            -- STORMWATER
            stormwater_required BOOLEAN DEFAULT FALSE,
            stormwater_authority VARCHAR(100),
            stormwater_notes TEXT,

            -- ARCHITECTURAL
            architectural_standards BOOLEAN DEFAULT FALSE,
            architectural_notes TEXT,
            facade_materials_restricted BOOLEAN DEFAULT FALSE,

            -- PARKING/ACCESS
            parking_spaces_required INT,
            parking_ratio VARCHAR(50),
            loading_space_required BOOLEAN DEFAULT FALSE,

            -- SIGNAGE
            signage_restrictions BOOLEAN DEFAULT FALSE,
            max_sign_sqft INT,
            signage_notes TEXT,

            -- LIGHTING
            lighting_restrictions BOOLEAN DEFAULT FALSE,
            lighting_notes TEXT,

            -- COSTS
            permit_fee_zoning DECIMAL(10,2),
            permit_fee_building DECIMAL(10,2),
            permit_fee_site_plan DECIMAL(10,2),
            permit_fee_other DECIMAL(10,2),
            permit_fee_other_desc TEXT,
            permit_fees_total DECIMAL(10,2),
            fee_schedule_code_section VARCHAR(50),
            impact_fee DECIMAL(10,2),
            impact_fee_type VARCHAR(100),
            impact_fee_code_section VARCHAR(50),

            -- TIMELINE
            timeline_estimate_days INT,
            timeline_notes TEXT,

            -- URLS
            zoning_ordinance_url VARCHAR(500),
            zoning_map_url VARCHAR(500),
            fee_schedule_url VARCHAR(500),
            application_url VARCHAR(500),
            gis_portal_url VARCHAR(500),

            -- CODE DATES
            zoning_ordinance_date DATE,
            fee_schedule_date DATE,

            -- CONTACTS
            planning_contact_name VARCHAR(100),
            planning_contact_title VARCHAR(100),
            planning_contact_phone VARCHAR(20),
            planning_contact_email VARCHAR(100),
            building_contact_name VARCHAR(100),
            building_contact_phone VARCHAR(20),
            building_contact_email VARCHAR(100),
            engineering_contact_name VARCHAR(100),
            engineering_contact_phone VARCHAR(20),
            engineering_contact_email VARCHAR(100),

            -- ASSESSMENT
            difficulty_score INT,
            difficulty_rating VARCHAR(20),

            -- NOTES
            gotchas TEXT,
            tips TEXT,
            general_notes TEXT,

            -- DATA COLLECTION
            call_date DATE,
            collected_by VARCHAR(100),
            verified BOOLEAN DEFAULT FALSE,
            verified_date DATE,

            -- METADATA
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(county_fips, jurisdiction)
        );

        CREATE INDEX idx_jc_county ON jurisdiction_cards(county_fips);
        CREATE INDEX idx_jc_state ON jurisdiction_cards(state);
        CREATE INDEX idx_jc_difficulty ON jurisdiction_cards(difficulty_rating);
        CREATE INDEX idx_jc_byright ON jurisdiction_cards(by_right);
    """)

    conn.commit()
    print("   [OK] jurisdiction_cards table created with indexes")
    conn.close()


def create_document_tracking_tables():
    """Create document tracking tables."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("2. CREATING DOCUMENT TRACKING TABLES")
    print("=" * 70)

    # Document types reference table
    cursor.execute("""
        DROP TABLE IF EXISTS document_types CASCADE;

        CREATE TABLE document_types (
            id SERIAL PRIMARY KEY,
            doc_type VARCHAR(50) NOT NULL UNIQUE,
            doc_type_display VARCHAR(100),
            category VARCHAR(50),
            priority INT,
            description TEXT
        );

        INSERT INTO document_types (doc_type, doc_type_display, category, priority, description) VALUES
        ('zoning_ordinance', 'Zoning Ordinance', 'zoning', 1, 'Full zoning code or relevant chapters'),
        ('zoning_map', 'Zoning Map', 'zoning', 2, 'Map showing zoning districts'),
        ('permitted_use_table', 'Permitted Use Table', 'zoning', 1, 'Matrix of uses by zone'),
        ('dimensional_standards', 'Dimensional Standards', 'zoning', 1, 'Setbacks, height, coverage table'),
        ('supplemental_standards', 'Supplemental Use Standards', 'zoning', 2, 'Special requirements for storage'),
        ('fee_schedule', 'Fee Schedule', 'fees', 1, 'Permit and application fees'),
        ('impact_fee_schedule', 'Impact Fee Schedule', 'fees', 2, 'Impact or development fees'),
        ('site_plan_application', 'Site Plan Application', 'applications', 2, 'Site plan submittal form'),
        ('site_plan_checklist', 'Site Plan Checklist', 'applications', 2, 'Required submittal items'),
        ('sup_application', 'SUP/CUP Application', 'applications', 2, 'Special use permit application'),
        ('building_permit_app', 'Building Permit Application', 'applications', 3, 'Building permit form'),
        ('stormwater_ordinance', 'Stormwater Ordinance', 'engineering', 2, 'Stormwater management requirements'),
        ('stormwater_manual', 'Stormwater Design Manual', 'engineering', 3, 'Technical design standards'),
        ('erosion_control', 'Erosion & Sediment Control', 'engineering', 3, 'E&S requirements'),
        ('utility_requirements', 'Utility Requirements', 'engineering', 3, 'Water/sewer connection reqs')
        ON CONFLICT (doc_type) DO NOTHING;
    """)
    print("   [OK] document_types table created with seed data")

    # Jurisdiction documents table
    cursor.execute("""
        CREATE TABLE jurisdiction_documents (
            id SERIAL PRIMARY KEY,

            jurisdiction_card_id INT REFERENCES jurisdiction_cards(id) ON DELETE CASCADE,
            county_fips VARCHAR(5) NOT NULL,
            state VARCHAR(2) NOT NULL,

            -- DOCUMENT INFO
            doc_type VARCHAR(50) NOT NULL,
            doc_type_display VARCHAR(100),
            doc_name VARCHAR(200),
            file_name VARCHAR(200),
            file_path VARCHAR(500),
            file_size_bytes INT,
            mime_type VARCHAR(100),

            -- SOURCE
            source_url VARCHAR(500),

            -- DATES
            document_date DATE,
            collected_date DATE DEFAULT CURRENT_DATE,

            -- STATUS
            is_current BOOLEAN DEFAULT TRUE,
            needs_update BOOLEAN DEFAULT FALSE,
            superseded_by INT REFERENCES jurisdiction_documents(id),

            -- NOTES
            notes TEXT,

            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX idx_jd_jurisdiction ON jurisdiction_documents(jurisdiction_card_id);
        CREATE INDEX idx_jd_county ON jurisdiction_documents(county_fips);
        CREATE INDEX idx_jd_type ON jurisdiction_documents(doc_type);
    """)
    print("   [OK] jurisdiction_documents table created with indexes")

    conn.commit()
    conn.close()


def update_build_constants_table():
    """Update build_constants with enhanced schema."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("3. UPDATING BUILD_CONSTANTS TABLE")
    print("=" * 70)

    cursor.execute("""
        DROP TABLE IF EXISTS build_constants CASCADE;

        CREATE TABLE build_constants (
            id SERIAL PRIMARY KEY,

            config_name VARCHAR(100) NOT NULL UNIQUE,
            is_active BOOLEAN DEFAULT TRUE,
            is_default BOOLEAN DEFAULT FALSE,
            effective_date DATE DEFAULT CURRENT_DATE,

            -- BUILDING SPECS
            building_length_ft INT DEFAULT 200,
            building_width_ft INT DEFAULT 20,
            units_per_building INT DEFAULT 40,
            unit_width_ft INT DEFAULT 10,
            unit_depth_ft INT DEFAULT 10,
            buildings_per_acre INT DEFAULT 4,

            -- CALCULATED
            building_sqft INT GENERATED ALWAYS AS (building_length_ft * building_width_ft) STORED,
            unit_sqft INT GENERATED ALWAYS AS (unit_width_ft * unit_depth_ft) STORED,
            units_per_acre INT GENERATED ALWAYS AS (units_per_building * buildings_per_acre) STORED,
            rentable_sqft_per_acre INT GENERATED ALWAYS AS (units_per_building * buildings_per_acre * unit_width_ft * unit_depth_ft) STORED,

            -- COSTS
            building_cost_per_sqft DECIMAL(10,2) DEFAULT 24.00,
            concrete_cost_per_yard DECIMAL(10,2) DEFAULT 200.00,
            concrete_thickness_inches INT DEFAULT 4,
            finish_cost_per_sqft DECIMAL(10,2) DEFAULT 3.00,
            dirt_work_flat DECIMAL(10,2) DEFAULT 30000.00,
            permitting_default DECIMAL(10,2) DEFAULT 30000.00,

            -- OPERATING ASSUMPTIONS
            stabilized_occupancy_pct DECIMAL(5,3) DEFAULT 0.93,
            vacancy_collection_loss_pct DECIMAL(5,3) DEFAULT 0.05,
            operating_expense_pct DECIMAL(5,3) DEFAULT 0.35,

            -- PAYBACK TARGET
            payback_years INT DEFAULT 4,

            -- NOTES
            notes TEXT,

            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Insert default configuration
        INSERT INTO build_constants (config_name, is_default, notes)
        VALUES ('Default 2025', TRUE, 'Base configuration - update costs from actual quotes')
        ON CONFLICT (config_name) DO NOTHING;
    """)

    conn.commit()
    print("   [OK] build_constants table recreated with default config")
    conn.close()


def update_land_cost_benchmarks():
    """Update land_cost_benchmarks table."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("4. UPDATING LAND_COST_BENCHMARKS TABLE")
    print("=" * 70)

    cursor.execute("""
        DROP TABLE IF EXISTS land_cost_benchmarks CASCADE;

        CREATE TABLE land_cost_benchmarks (
            id SERIAL PRIMARY KEY,

            county_fips VARCHAR(5) NOT NULL,
            county_name VARCHAR(100),
            state VARCHAR(2) NOT NULL,

            -- LAND COSTS
            cost_per_acre_low INT,
            cost_per_acre_mid INT,
            cost_per_acre_high INT,

            -- SITE WORK ESTIMATES
            site_work_per_acre_low INT DEFAULT 25000,
            site_work_per_acre_mid INT DEFAULT 40000,
            site_work_per_acre_high INT DEFAULT 60000,

            -- SOURCE
            source VARCHAR(200),
            source_date DATE,
            confidence VARCHAR(20),

            -- NOTES
            notes TEXT,

            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(county_fips)
        );

        CREATE INDEX idx_lcb_county ON land_cost_benchmarks(county_fips);
        CREATE INDEX idx_lcb_state ON land_cost_benchmarks(state);
    """)

    conn.commit()
    print("   [OK] land_cost_benchmarks table recreated")
    conn.close()


def update_reverse_feasibility_table():
    """Update reverse_feasibility table with enhanced schema."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("5. UPDATING REVERSE_FEASIBILITY TABLE")
    print("=" * 70)

    cursor.execute("""
        DROP TABLE IF EXISTS reverse_feasibility CASCADE;

        CREATE TABLE reverse_feasibility (
            id SERIAL PRIMARY KEY,

            -- GEOGRAPHY
            county_fips VARCHAR(5) NOT NULL,
            county_name VARCHAR(100),
            state VARCHAR(2) NOT NULL,
            jurisdiction_card_id INT REFERENCES jurisdiction_cards(id),

            -- ANALYSIS INFO
            analysis_date DATE DEFAULT CURRENT_DATE,
            build_config_id INT REFERENCES build_constants(id),

            -- INPUTS
            market_rent_10x10 DECIMAL(10,2) NOT NULL,
            land_cost_per_acre DECIMAL(10,2),

            -- BUILD SPECS
            buildings_per_acre INT,
            units_per_acre INT,

            -- COSTS USED
            building_cost_total DECIMAL(12,2),
            concrete_cost_total DECIMAL(12,2),
            finish_cost_total DECIMAL(12,2),
            dirt_work_cost DECIMAL(12,2),
            permit_cost DECIMAL(12,2),
            total_fixed_costs DECIMAL(12,2),
            land_cost DECIMAL(12,2),
            total_investment DECIMAL(12,2),

            -- REVENUE
            gross_potential_rent DECIMAL(12,2),
            effective_gross_income DECIMAL(12,2),
            operating_expenses DECIMAL(12,2),
            net_operating_income DECIMAL(12,2),

            -- PAYBACK CALC
            payback_years_target INT,
            payback_years_actual DECIMAL(5,2),
            max_investment_for_target DECIMAL(12,2),
            max_land_budget DECIMAL(12,2),

            -- VERDICT
            verdict VARCHAR(20),
            verdict_reason TEXT,

            -- WHAT WOULD MAKE IT WORK
            rent_required_for_go DECIMAL(10,2),
            rent_gap DECIMAL(10,2),
            land_max_for_go DECIMAL(12,2),

            -- METADATA
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(county_fips, analysis_date, market_rent_10x10)
        );

        CREATE INDEX idx_rf_county ON reverse_feasibility(county_fips);
        CREATE INDEX idx_rf_verdict ON reverse_feasibility(verdict);
        CREATE INDEX idx_rf_date ON reverse_feasibility(analysis_date);
    """)

    conn.commit()
    print("   [OK] reverse_feasibility table recreated")
    conn.close()


def create_market_saturation_table():
    """Create market saturation tracking table."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("6. CREATING MARKET_SATURATION TABLE")
    print("=" * 70)

    cursor.execute("""
        DROP TABLE IF EXISTS market_saturation CASCADE;

        CREATE TABLE market_saturation (
            id SERIAL PRIMARY KEY,

            county_fips VARCHAR(5) NOT NULL,
            county_name VARCHAR(100),
            state VARCHAR(2) NOT NULL,

            analysis_date DATE DEFAULT CURRENT_DATE,

            -- SUPPLY
            facility_count INT,
            total_sqft INT,
            sqft_source VARCHAR(50),

            -- DEMAND
            population INT,
            population_source VARCHAR(50),
            population_year INT,

            -- SATURATION
            sqft_per_capita DECIMAL(6,2),
            saturation_level VARCHAR(20),

            -- THRESHOLDS USED
            undersaturated_threshold DECIMAL(4,2) DEFAULT 6.0,
            oversaturated_threshold DECIMAL(4,2) DEFAULT 8.0,

            -- ROOM FOR MORE
            sqft_to_saturation INT,
            sqft_surplus INT,

            -- METADATA
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(county_fips, analysis_date)
        );

        CREATE INDEX idx_ms_county ON market_saturation(county_fips);
        CREATE INDEX idx_ms_level ON market_saturation(saturation_level);
    """)

    conn.commit()
    print("   [OK] market_saturation table created")
    conn.close()


def create_replit_views():
    """Create views for the Replit front-end."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("7. CREATING VIEWS FOR REPLIT APP")
    print("=" * 70)

    # Jurisdiction summary view
    cursor.execute("""
        CREATE OR REPLACE VIEW v_jurisdiction_summary AS
        SELECT
            jc.id,
            jc.county_fips,
            jc.county_name,
            jc.state,
            jc.jurisdiction,
            jc.jurisdiction_type,
            jc.by_right,
            jc.sup_required,
            jc.cup_required,
            jc.public_hearing_required,
            jc.permit_fees_total,
            jc.timeline_estimate_days,
            jc.difficulty_score,
            jc.difficulty_rating,
            CASE jc.difficulty_rating
                WHEN 'easy' THEN 'green'
                WHEN 'medium' THEN 'yellow'
                WHEN 'hard' THEN 'red'
                ELSE 'gray'
            END as difficulty_color,
            jc.call_date,
            jc.verified,
            jc.planning_contact_name,
            jc.planning_contact_phone,
            (SELECT COUNT(*) FROM jurisdiction_documents jd WHERE jd.jurisdiction_card_id = jc.id) as doc_count
        FROM jurisdiction_cards jc
        ORDER BY jc.state, jc.county_name;
    """)
    print("   [OK] v_jurisdiction_summary created")

    # Calculator inputs view
    cursor.execute("""
        CREATE OR REPLACE VIEW v_calculator_inputs AS
        SELECT
            jc.id as jurisdiction_card_id,
            jc.county_fips,
            jc.county_name,
            jc.state,
            jc.county_name || ', ' || jc.state as display_name,
            COALESCE(jc.permit_fees_total, bc.permitting_default) as permit_cost,
            bc.building_cost_per_sqft,
            bc.concrete_cost_per_yard,
            bc.concrete_thickness_inches,
            bc.finish_cost_per_sqft,
            bc.dirt_work_flat,
            bc.buildings_per_acre,
            bc.units_per_acre,
            bc.building_sqft,
            bc.payback_years,
            bc.stabilized_occupancy_pct,
            bc.vacancy_collection_loss_pct,
            bc.operating_expense_pct,
            lcb.cost_per_acre_low as land_cost_low,
            lcb.cost_per_acre_mid as land_cost_mid,
            lcb.cost_per_acre_high as land_cost_high,
            ms.sqft_per_capita,
            ms.saturation_level
        FROM jurisdiction_cards jc
        CROSS JOIN build_constants bc
        LEFT JOIN land_cost_benchmarks lcb ON jc.county_fips = lcb.county_fips
        LEFT JOIN market_saturation ms ON jc.county_fips = ms.county_fips
            AND ms.analysis_date = (SELECT MAX(analysis_date) FROM market_saturation WHERE county_fips = jc.county_fips)
        WHERE bc.is_default = TRUE;
    """)
    print("   [OK] v_calculator_inputs created")

    # Market dashboard view
    cursor.execute("""
        CREATE OR REPLACE VIEW v_market_dashboard AS
        SELECT
            jc.county_fips,
            jc.county_name,
            jc.state,
            jc.by_right,
            jc.difficulty_rating,
            CASE jc.difficulty_rating
                WHEN 'easy' THEN 'green'
                WHEN 'medium' THEN 'yellow'
                WHEN 'hard' THEN 'red'
                ELSE 'gray'
            END as permit_color,
            ms.sqft_per_capita,
            ms.saturation_level,
            CASE ms.saturation_level
                WHEN 'undersaturated' THEN 'green'
                WHEN 'balanced' THEN 'yellow'
                WHEN 'oversaturated' THEN 'red'
                ELSE 'gray'
            END as saturation_color,
            rf.market_rent_10x10,
            rf.verdict,
            CASE rf.verdict
                WHEN 'go' THEN 'green'
                WHEN 'marginal' THEN 'yellow'
                WHEN 'no_go' THEN 'red'
                ELSE 'gray'
            END as verdict_color,
            rf.max_land_budget,
            lcb.cost_per_acre_mid as typical_land,
            rf.payback_years_actual,
            rf.rent_required_for_go,
            jc.verified,
            jc.call_date
        FROM jurisdiction_cards jc
        LEFT JOIN market_saturation ms ON jc.county_fips = ms.county_fips
            AND ms.analysis_date = (SELECT MAX(analysis_date) FROM market_saturation WHERE county_fips = jc.county_fips)
        LEFT JOIN land_cost_benchmarks lcb ON jc.county_fips = lcb.county_fips
        LEFT JOIN reverse_feasibility rf ON jc.county_fips = rf.county_fips
            AND rf.analysis_date = (SELECT MAX(analysis_date) FROM reverse_feasibility WHERE county_fips = jc.county_fips)
        ORDER BY jc.state, jc.county_name;
    """)
    print("   [OK] v_market_dashboard created")

    # Document checklist view
    cursor.execute("""
        CREATE OR REPLACE VIEW v_document_checklist AS
        SELECT
            jc.county_fips,
            jc.county_name,
            jc.state,
            dt.doc_type,
            dt.doc_type_display,
            dt.category,
            dt.priority,
            CASE WHEN jd.id IS NOT NULL THEN TRUE ELSE FALSE END as has_document,
            jd.doc_name,
            jd.source_url,
            jd.document_date,
            jd.collected_date,
            jd.is_current,
            jd.needs_update
        FROM jurisdiction_cards jc
        CROSS JOIN document_types dt
        LEFT JOIN jurisdiction_documents jd ON jc.id = jd.jurisdiction_card_id AND dt.doc_type = jd.doc_type
        ORDER BY jc.state, jc.county_name, dt.priority, dt.category;
    """)
    print("   [OK] v_document_checklist created")

    # Feasibility detail view
    cursor.execute("""
        CREATE OR REPLACE VIEW v_feasibility_detail AS
        SELECT
            rf.id,
            rf.county_fips,
            rf.county_name,
            rf.state,
            rf.analysis_date,
            rf.market_rent_10x10,
            rf.land_cost_per_acre,
            rf.buildings_per_acre,
            rf.units_per_acre,
            rf.building_cost_total,
            rf.concrete_cost_total,
            rf.finish_cost_total,
            rf.dirt_work_cost,
            rf.permit_cost,
            rf.total_fixed_costs,
            rf.land_cost,
            rf.total_investment,
            rf.gross_potential_rent,
            rf.effective_gross_income,
            rf.operating_expenses,
            rf.net_operating_income,
            rf.payback_years_target,
            rf.payback_years_actual,
            rf.max_investment_for_target,
            rf.max_land_budget,
            rf.verdict,
            rf.verdict_reason,
            rf.rent_required_for_go,
            rf.rent_gap,
            jc.difficulty_rating,
            jc.by_right,
            ms.saturation_level
        FROM reverse_feasibility rf
        LEFT JOIN jurisdiction_cards jc ON rf.county_fips = jc.county_fips
        LEFT JOIN market_saturation ms ON rf.county_fips = ms.county_fips
            AND ms.analysis_date = (SELECT MAX(analysis_date) FROM market_saturation WHERE county_fips = rf.county_fips)
        ORDER BY rf.analysis_date DESC, rf.county_name;
    """)
    print("   [OK] v_feasibility_detail created")

    conn.commit()
    conn.close()


def create_calculate_function():
    """Create the reverse feasibility calculation function."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("8. CREATING CALCULATE FUNCTION")
    print("=" * 70)

    cursor.execute("""
        CREATE OR REPLACE FUNCTION calculate_reverse_feasibility(
            p_county_fips VARCHAR(5),
            p_market_rent DECIMAL,
            p_land_cost DECIMAL DEFAULT NULL
        )
        RETURNS TABLE(
            verdict VARCHAR,
            noi DECIMAL,
            max_investment DECIMAL,
            total_fixed_costs DECIMAL,
            max_land_budget DECIMAL,
            payback_years_actual DECIMAL,
            rent_required_for_go DECIMAL
        ) AS $$
        DECLARE
            v_bc build_constants%ROWTYPE;
            v_jc jurisdiction_cards%ROWTYPE;
            v_lcb land_cost_benchmarks%ROWTYPE;

            v_building_cost DECIMAL;
            v_concrete_yards DECIMAL;
            v_concrete_cost DECIMAL;
            v_finish_cost DECIMAL;
            v_permit_cost DECIMAL;
            v_fixed_costs DECIMAL;

            v_gross_potential DECIMAL;
            v_egi DECIMAL;
            v_expenses DECIMAL;
            v_noi DECIMAL;

            v_max_investment DECIMAL;
            v_max_land DECIMAL;
            v_land_cost DECIMAL;
            v_total_investment DECIMAL;
            v_payback_actual DECIMAL;

            v_verdict VARCHAR(20);
            v_verdict_reason TEXT;
            v_rent_for_go DECIMAL;
        BEGIN
            -- Get build constants
            SELECT * INTO v_bc FROM build_constants WHERE is_default = TRUE LIMIT 1;

            IF v_bc.id IS NULL THEN
                RAISE EXCEPTION 'No default build configuration found';
            END IF;

            -- Get jurisdiction card
            SELECT * INTO v_jc FROM jurisdiction_cards WHERE county_fips = p_county_fips LIMIT 1;

            -- Get land benchmark
            SELECT * INTO v_lcb FROM land_cost_benchmarks WHERE county_fips = p_county_fips;

            -- CALCULATE FIXED COSTS
            -- Buildings: sqft * cost/sqft * buildings
            v_building_cost := v_bc.building_sqft * v_bc.building_cost_per_sqft * v_bc.buildings_per_acre;

            -- Concrete: (sqft * thickness/12) / 27 yards * cost/yard * buildings
            v_concrete_yards := (v_bc.building_sqft * (v_bc.concrete_thickness_inches::DECIMAL / 12) / 27) * v_bc.buildings_per_acre;
            v_concrete_cost := v_concrete_yards * v_bc.concrete_cost_per_yard;

            -- Finish: sqft * cost/sqft * buildings
            v_finish_cost := v_bc.building_sqft * v_bc.finish_cost_per_sqft * v_bc.buildings_per_acre;

            -- Permits: from jurisdiction card or default
            v_permit_cost := COALESCE(v_jc.permit_fees_total, v_bc.permitting_default);

            -- Total fixed
            v_fixed_costs := v_building_cost + v_concrete_cost + v_finish_cost + v_bc.dirt_work_flat + v_permit_cost;

            -- CALCULATE REVENUE
            v_gross_potential := v_bc.units_per_acre * p_market_rent * 12;
            v_egi := v_gross_potential * v_bc.stabilized_occupancy_pct * (1 - v_bc.vacancy_collection_loss_pct);
            v_expenses := v_egi * v_bc.operating_expense_pct;
            v_noi := v_egi - v_expenses;

            -- PAYBACK CALC
            v_max_investment := v_noi * v_bc.payback_years;
            v_max_land := v_max_investment - v_fixed_costs;

            -- Land cost (input or benchmark)
            v_land_cost := COALESCE(p_land_cost, v_lcb.cost_per_acre_mid);

            -- Actual payback if we know land cost
            IF v_land_cost IS NOT NULL AND v_noi > 0 THEN
                v_total_investment := v_fixed_costs + v_land_cost;
                v_payback_actual := ROUND(v_total_investment / v_noi, 2);
            END IF;

            -- VERDICT
            IF v_max_land < 0 THEN
                v_verdict := 'no_go';
                v_verdict_reason := 'Rent does not cover fixed costs at target payback';
            ELSIF v_land_cost IS NULL THEN
                v_verdict := 'unknown';
                v_verdict_reason := 'No land cost data - max budget is $' || TRIM(TO_CHAR(v_max_land, 'FM999,999'));
            ELSIF v_max_land >= v_land_cost * 1.15 THEN
                v_verdict := 'go';
                v_verdict_reason := 'Budget exceeds typical land by ' || ROUND((v_max_land - v_land_cost) / v_land_cost * 100) || '%';
            ELSIF v_max_land >= v_land_cost THEN
                v_verdict := 'marginal';
                v_verdict_reason := 'Tight margin - only $' || TRIM(TO_CHAR(v_max_land - v_land_cost, 'FM999,999')) || ' cushion';
            ELSE
                v_verdict := 'no_go';
                v_verdict_reason := 'Land budget $' || TRIM(TO_CHAR(v_land_cost - v_max_land, 'FM999,999')) || ' short';
            END IF;

            -- What rent would make it work
            IF v_verdict != 'go' AND v_land_cost IS NOT NULL THEN
                v_rent_for_go := CEIL(
                    (v_fixed_costs + v_land_cost * 1.15) / v_bc.payback_years
                    / (1 - v_bc.operating_expense_pct)
                    / (1 - v_bc.vacancy_collection_loss_pct)
                    / v_bc.stabilized_occupancy_pct
                    / v_bc.units_per_acre
                    / 12
                );
            END IF;

            -- Store result
            INSERT INTO reverse_feasibility (
                county_fips, county_name, state, jurisdiction_card_id,
                build_config_id, market_rent_10x10, land_cost_per_acre,
                buildings_per_acre, units_per_acre,
                building_cost_total, concrete_cost_total, finish_cost_total,
                dirt_work_cost, permit_cost, total_fixed_costs,
                land_cost, total_investment,
                gross_potential_rent, effective_gross_income, operating_expenses, net_operating_income,
                payback_years_target, payback_years_actual, max_investment_for_target, max_land_budget,
                verdict, verdict_reason, rent_required_for_go,
                rent_gap, land_max_for_go
            ) VALUES (
                p_county_fips, v_jc.county_name, v_jc.state, v_jc.id,
                v_bc.id, p_market_rent, v_land_cost,
                v_bc.buildings_per_acre, v_bc.units_per_acre,
                v_building_cost, v_concrete_cost, v_finish_cost,
                v_bc.dirt_work_flat, v_permit_cost, v_fixed_costs,
                v_land_cost, v_total_investment,
                v_gross_potential, v_egi, v_expenses, v_noi,
                v_bc.payback_years, v_payback_actual, v_max_investment, v_max_land,
                v_verdict, v_verdict_reason, v_rent_for_go,
                v_rent_for_go - p_market_rent, v_max_land
            )
            ON CONFLICT (county_fips, analysis_date, market_rent_10x10) DO UPDATE SET
                verdict = EXCLUDED.verdict,
                verdict_reason = EXCLUDED.verdict_reason,
                net_operating_income = EXCLUDED.net_operating_income,
                max_land_budget = EXCLUDED.max_land_budget,
                payback_years_actual = EXCLUDED.payback_years_actual,
                rent_required_for_go = EXCLUDED.rent_required_for_go,
                created_at = NOW();

            -- Return results
            RETURN QUERY SELECT
                v_verdict,
                v_noi,
                v_max_investment,
                v_fixed_costs,
                v_max_land,
                v_payback_actual,
                v_rent_for_go;
        END;
        $$ LANGUAGE plpgsql;
    """)

    conn.commit()
    print("   [OK] calculate_reverse_feasibility function created")
    conn.close()


def seed_target_counties():
    """Seed the 7 target counties with initial data."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("9. SEEDING TARGET COUNTIES")
    print("=" * 70)

    # Land cost benchmarks for 7 target counties
    cursor.execute("""
        INSERT INTO land_cost_benchmarks (county_fips, county_name, state, cost_per_acre_low, cost_per_acre_mid, cost_per_acre_high, confidence)
        VALUES
            ('54065', 'Morgan', 'WV', 30000, 50000, 80000, 'estimate'),
            ('54037', 'Jefferson', 'WV', 80000, 120000, 180000, 'estimate'),
            ('54003', 'Berkeley', 'WV', 60000, 90000, 140000, 'estimate'),
            ('42009', 'Bedford', 'PA', 25000, 45000, 75000, 'estimate'),
            ('42013', 'Blair', 'PA', 40000, 65000, 100000, 'estimate'),
            ('42021', 'Cambria', 'PA', 35000, 55000, 90000, 'estimate'),
            ('24001', 'Allegany', 'MD', 40000, 60000, 95000, 'estimate')
        ON CONFLICT (county_fips) DO UPDATE SET
            cost_per_acre_low = EXCLUDED.cost_per_acre_low,
            cost_per_acre_mid = EXCLUDED.cost_per_acre_mid,
            cost_per_acre_high = EXCLUDED.cost_per_acre_high,
            updated_at = NOW();
    """)
    print("   [OK] Land cost benchmarks seeded for 7 counties")

    # Empty jurisdiction cards for 7 target counties
    cursor.execute("""
        INSERT INTO jurisdiction_cards (county_fips, county_name, state, jurisdiction_type)
        VALUES
            ('54065', 'Morgan', 'WV', 'county'),
            ('54037', 'Jefferson', 'WV', 'county'),
            ('54003', 'Berkeley', 'WV', 'county'),
            ('42009', 'Bedford', 'PA', 'county'),
            ('42013', 'Blair', 'PA', 'county'),
            ('42021', 'Cambria', 'PA', 'county'),
            ('24001', 'Allegany', 'MD', 'county')
        ON CONFLICT (county_fips, jurisdiction) DO UPDATE SET
            county_name = EXCLUDED.county_name,
            updated_at = NOW();
    """)
    print("   [OK] Jurisdiction cards seeded for 7 counties")

    conn.commit()
    conn.close()


def test_schema():
    """Test the schema with sample queries."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("10. TESTING SCHEMA")
    print("=" * 70)

    # Test jurisdiction summary view
    print("\n--- Jurisdiction Summary ---")
    cursor.execute("SELECT * FROM v_jurisdiction_summary LIMIT 5")
    rows = cursor.fetchall()
    for r in rows:
        print(f"   {r['county_name']}, {r['state']} | by_right: {r['by_right']} | docs: {r['doc_count']}")

    # Test calculator function
    print("\n--- Calculator Test (Berkeley, WV @ $105 rent) ---")
    cursor.execute("SELECT * FROM calculate_reverse_feasibility('54003', 105, 90000)")
    result = cursor.fetchone()
    if result:
        print(f"   Verdict: {result['verdict']}")
        print(f"   NOI: ${float(result['noi']):,.0f}")
        print(f"   Max Investment: ${float(result['max_investment']):,.0f}")
        print(f"   Fixed Costs: ${float(result['total_fixed_costs']):,.0f}")
        print(f"   Max Land Budget: ${float(result['max_land_budget']):,.0f}")
        if result['payback_years_actual']:
            print(f"   Payback Years: {float(result['payback_years_actual']):.1f}")
        if result['rent_required_for_go']:
            print(f"   Rent for GO: ${float(result['rent_required_for_go']):.0f}")

    # Test market dashboard view
    print("\n--- Market Dashboard ---")
    cursor.execute("SELECT * FROM v_market_dashboard LIMIT 7")
    rows = cursor.fetchall()
    print(f"   {'County':<20} {'ST':<4} {'Permit':<10} {'Saturation':<12} {'Verdict':<10}")
    print(f"   {'-'*20} {'-'*4} {'-'*10} {'-'*12} {'-'*10}")
    for r in rows:
        print(f"   {r['county_name']:<20} {r['state']:<4} {r['difficulty_rating'] or 'N/A':<10} "
              f"{r['saturation_level'] or 'N/A':<12} {r['verdict'] or 'N/A':<10}")

    # Show document types
    print("\n--- Document Types ---")
    cursor.execute("SELECT doc_type, doc_type_display, category, priority FROM document_types ORDER BY priority, category")
    rows = cursor.fetchall()
    for r in rows:
        print(f"   P{r['priority']} | {r['category']:<12} | {r['doc_type_display']}")

    conn.close()


def print_summary():
    """Print summary of created objects."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("SCHEMA CREATION SUMMARY")
    print("=" * 70)

    # Count tables
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('jurisdiction_cards', 'jurisdiction_documents', 'document_types',
                          'build_constants', 'land_cost_benchmarks', 'reverse_feasibility',
                          'market_saturation')
        ORDER BY table_name
    """)
    tables = cursor.fetchall()
    print(f"\nTables created: {len(tables)}")
    for t in tables:
        cursor.execute(f"SELECT COUNT(*) as cnt FROM {t['table_name']}")
        cnt = cursor.fetchone()['cnt']
        print(f"   - {t['table_name']}: {cnt} rows")

    # Count views
    cursor.execute("""
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name LIKE 'v_%'
        ORDER BY table_name
    """)
    views = cursor.fetchall()
    print(f"\nViews created: {len(views)}")
    for v in views:
        print(f"   - {v['table_name']}")

    # Check function
    cursor.execute("""
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_name = 'calculate_reverse_feasibility'
    """)
    funcs = cursor.fetchall()
    print(f"\nFunctions created: {len(funcs)}")
    for f in funcs:
        print(f"   - {f['routine_name']}")

    conn.close()


def main():
    """Main entry point."""
    print("\n" + "=" * 70)
    print("JURISDICTION INTEL & REVERSE FEASIBILITY SCHEMA")
    print("=" * 70)
    print("Creating complete schema for Replit front-end")
    print("=" * 70)

    # Create all tables and objects
    create_jurisdiction_cards_table()
    create_document_tracking_tables()
    update_build_constants_table()
    update_land_cost_benchmarks()
    update_reverse_feasibility_table()
    create_market_saturation_table()
    create_replit_views()
    create_calculate_function()
    seed_target_counties()
    test_schema()
    print_summary()

    print("\n" + "=" * 70)
    print("SCHEMA CREATION COMPLETE")
    print("=" * 70)
    print("""
Ready for Replit front-end:
- jurisdiction_cards: Store permit intel from phone calls
- jurisdiction_documents: Track collected documents
- document_types: Reference for document categories
- build_constants: Configure cost assumptions
- land_cost_benchmarks: Land cost estimates by county
- reverse_feasibility: Calculator results
- market_saturation: Saturation tracking

Views for UI:
- v_jurisdiction_summary: List/dropdown for jurisdictions
- v_calculator_inputs: Pre-populated calculator fields
- v_market_dashboard: Overview with traffic lights
- v_document_checklist: What docs we have/need
- v_feasibility_detail: Full breakdown

Function:
- calculate_reverse_feasibility(county_fips, rent, land_cost)
""")


if __name__ == "__main__":
    main()
