"""
Reverse Feasibility Engine
==========================
Backs into maximum land/site/permit budget from market rents and payback requirements.

Traditional feasibility: Start with costs -> Calculate yield
Reverse feasibility: Start with market rent + required return -> Calculate max land budget

Logic:
1. Take market rent for 10x10 unit
2. Calculate gross potential rent (units per acre × rent × 12)
3. Apply vacancy/collection loss and operating expenses to get NOI
4. NOI × payback_years = max total investment
5. Subtract known costs (buildings, concrete, soft costs)
6. Remainder = max land/site/permit budget
7. Compare to typical land costs -> Go/No-Go verdict
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from decimal import Decimal

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"


def get_connection():
    return psycopg2.connect(CONNECTION_STRING)


def create_schema():
    """Create all tables for the reverse feasibility engine."""
    conn = get_connection()
    cursor = conn.cursor()

    print("=" * 70)
    print("CREATING REVERSE FEASIBILITY ENGINE SCHEMA")
    print("=" * 70)

    # =========================================================================
    # 1. BUILD CONSTANTS TABLE
    # =========================================================================
    print("\n1. Creating build_constants table...")
    cursor.execute("""
        DROP TABLE IF EXISTS build_constants CASCADE;

        CREATE TABLE build_constants (
            id SERIAL PRIMARY KEY,

            config_name VARCHAR(100) NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            is_default BOOLEAN DEFAULT FALSE,
            effective_date DATE DEFAULT CURRENT_DATE,

            -- BUILDING SPECS
            building_length_ft INT DEFAULT 200,
            building_width_ft INT DEFAULT 20,
            building_sqft INT GENERATED ALWAYS AS (building_length_ft * building_width_ft) STORED,

            units_per_building INT DEFAULT 40,
            unit_width_ft INT DEFAULT 10,
            unit_depth_ft INT DEFAULT 10,
            unit_sqft INT GENERATED ALWAYS AS (unit_width_ft * unit_depth_ft) STORED,

            buildings_per_acre INT DEFAULT 4,
            units_per_acre INT GENERATED ALWAYS AS (units_per_building * buildings_per_acre) STORED,
            rentable_sqft_per_acre INT GENERATED ALWAYS AS (units_per_building * buildings_per_acre * unit_width_ft * unit_depth_ft) STORED,

            -- BUILDING COSTS (known from quotes)
            building_cost_each INT DEFAULT 65000,
            concrete_cost_per_sqft DECIMAL(10,2) DEFAULT 2.00,

            -- CALCULATED BUILDING COSTS
            concrete_sqft_per_building INT GENERATED ALWAYS AS (building_length_ft * building_width_ft) STORED,

            -- SOFT COSTS (% of hard costs)
            soft_cost_pct DECIMAL(5,3) DEFAULT 0.08,
            contingency_pct DECIMAL(5,3) DEFAULT 0.05,

            -- OPERATING ASSUMPTIONS
            stabilized_occupancy_pct DECIMAL(5,3) DEFAULT 0.93,
            operating_expense_pct DECIMAL(5,3) DEFAULT 0.35,
            vacancy_collection_loss_pct DECIMAL(5,3) DEFAULT 0.05,

            -- LEASE-UP ASSUMPTIONS
            y1_occupancy_pct DECIMAL(5,3) DEFAULT 0.50,
            y2_occupancy_pct DECIMAL(5,3) DEFAULT 0.75,
            y3_occupancy_pct DECIMAL(5,3) DEFAULT 0.90,
            y4_occupancy_pct DECIMAL(5,3) DEFAULT 0.93,

            -- PAYBACK TARGET
            payback_years INT DEFAULT 4,
            target_annual_return_pct DECIMAL(5,3) GENERATED ALWAYS AS (1.0 / payback_years) STORED,

            -- METADATA
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(config_name)
        );
    """)
    print("   [OK] build_constants created")

    # Insert default configuration
    cursor.execute("""
        INSERT INTO build_constants (
            config_name, is_default, is_active,
            building_cost_each, concrete_cost_per_sqft,
            notes
        ) VALUES (
            'Default 2025', TRUE, TRUE,
            65000, 2.00,
            'Base configuration - 200x20 metal buildings, 40 units each, 4 buildings per acre'
        ) ON CONFLICT (config_name) DO NOTHING;
    """)
    print("   [OK] Default configuration inserted")

    # =========================================================================
    # 2. LAND COST BENCHMARKS TABLE
    # =========================================================================
    print("\n2. Creating land_cost_benchmarks table...")
    cursor.execute("""
        DROP TABLE IF EXISTS land_cost_benchmarks CASCADE;

        CREATE TABLE land_cost_benchmarks (
            id SERIAL PRIMARY KEY,

            -- Geography
            geo_type VARCHAR(20) NOT NULL,
            geo_id VARCHAR(20) NOT NULL,
            geo_name VARCHAR(100),
            state VARCHAR(2),

            -- Land cost estimates (per acre)
            cost_per_acre_low INT,
            cost_per_acre_mid INT,
            cost_per_acre_high INT,

            -- Site work estimates (grading, utilities, paving, fencing)
            site_work_per_acre_low INT DEFAULT 35000,
            site_work_per_acre_mid INT DEFAULT 50000,
            site_work_per_acre_high INT DEFAULT 75000,

            -- Permit/impact fee estimates
            permit_fees_low INT DEFAULT 5000,
            permit_fees_mid INT DEFAULT 15000,
            permit_fees_high INT DEFAULT 30000,

            -- Combined land+site+permits
            total_land_budget_low INT GENERATED ALWAYS AS (
                COALESCE(cost_per_acre_low, 0) + site_work_per_acre_low + permit_fees_low
            ) STORED,
            total_land_budget_mid INT GENERATED ALWAYS AS (
                COALESCE(cost_per_acre_mid, 0) + site_work_per_acre_mid + permit_fees_mid
            ) STORED,
            total_land_budget_high INT GENERATED ALWAYS AS (
                COALESCE(cost_per_acre_high, 0) + site_work_per_acre_high + permit_fees_high
            ) STORED,

            -- Data source
            source VARCHAR(200),
            source_date DATE,
            confidence VARCHAR(20),

            -- Metadata
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(geo_type, geo_id)
        );

        CREATE INDEX idx_lcb_geo ON land_cost_benchmarks(geo_type, geo_id);
        CREATE INDEX idx_lcb_state ON land_cost_benchmarks(state);
    """)
    print("   [OK] land_cost_benchmarks created")

    # =========================================================================
    # 3. REVERSE FEASIBILITY RESULTS TABLE
    # =========================================================================
    print("\n3. Creating reverse_feasibility table...")
    cursor.execute("""
        DROP TABLE IF EXISTS reverse_feasibility CASCADE;

        CREATE TABLE reverse_feasibility (
            id SERIAL PRIMARY KEY,

            -- Geography
            geo_type VARCHAR(20) NOT NULL,
            geo_id VARCHAR(20) NOT NULL,
            geo_name VARCHAR(100),
            state VARCHAR(2),

            -- Analysis date and config
            analysis_date DATE DEFAULT CURRENT_DATE,
            build_config_id INT REFERENCES build_constants(id),
            build_config_name VARCHAR(100),

            -- MARKET INPUTS
            market_rent_10x10 DECIMAL(10,2),
            rent_confidence VARCHAR(20),
            rent_source VARCHAR(100),
            rent_date DATE,

            -- BUILD SPECS (from config)
            units_per_acre INT,
            rentable_sqft_per_acre INT,
            buildings_per_acre INT,

            -- REVENUE CALC (per acre, annual, stabilized)
            gross_potential_rent INT,
            effective_gross_income INT,
            operating_expenses INT,
            net_operating_income INT,

            -- PAYBACK CALC
            payback_years INT,
            target_return_pct DECIMAL(5,3),
            max_total_investment INT,

            -- KNOWN COSTS (per acre)
            building_costs INT,
            concrete_costs INT,
            hard_costs_subtotal INT,
            soft_costs INT,
            contingency INT,
            total_fixed_costs INT,

            -- THE ANSWER: What you can spend on land/site/permits (per acre)
            max_land_site_permit_budget INT,

            -- LAND COST COMPARISON
            typical_land_cost_low INT,
            typical_land_cost_mid INT,
            typical_land_cost_high INT,

            -- CUSHION/GAP (positive = cushion, negative = gap)
            budget_vs_typical_low INT,
            budget_vs_typical_mid INT,
            budget_vs_typical_high INT,

            -- VERDICT
            verdict VARCHAR(20),
            verdict_reason TEXT,

            -- SENSITIVITY
            rent_required_for_go DECIMAL(10,2),
            rent_gap DECIMAL(10,2),
            rent_gap_pct DECIMAL(5,2),

            -- BREAKEVEN METRICS
            breakeven_occupancy_pct DECIMAL(5,3),
            margin_of_safety_pct DECIMAL(5,2),

            -- Metadata
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(geo_type, geo_id, analysis_date, build_config_id)
        );

        CREATE INDEX idx_rf_geo ON reverse_feasibility(geo_type, geo_id);
        CREATE INDEX idx_rf_verdict ON reverse_feasibility(verdict);
        CREATE INDEX idx_rf_date ON reverse_feasibility(analysis_date);
        CREATE INDEX idx_rf_state ON reverse_feasibility(state);
    """)
    print("   [OK] reverse_feasibility created")

    conn.commit()
    print("\n" + "=" * 70)
    print("SCHEMA CREATION COMPLETE")
    print("=" * 70)

    conn.close()


def create_feasibility_function():
    """Create the SQL function for reverse feasibility calculation."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("CREATING REVERSE FEASIBILITY FUNCTION")
    print("=" * 70)

    cursor.execute("""
        CREATE OR REPLACE FUNCTION calculate_reverse_feasibility(
            p_geo_type VARCHAR(20),
            p_geo_id VARCHAR(20),
            p_market_rent DECIMAL,
            p_rent_confidence VARCHAR(20) DEFAULT 'estimate',
            p_rent_source VARCHAR(100) DEFAULT 'manual',
            p_build_config_id INT DEFAULT NULL
        )
        RETURNS TABLE (
            result_id INT,
            verdict VARCHAR(20),
            max_land_budget INT,
            verdict_reason TEXT
        ) AS $$
        DECLARE
            v_config_id INT;
            v_config_name VARCHAR(100);
            v_geo_name VARCHAR(100);
            v_state VARCHAR(2);

            -- Config values
            v_units_per_acre INT;
            v_rentable_sqft INT;
            v_buildings_per_acre INT;
            v_building_cost_each INT;
            v_concrete_sqft_per_building INT;
            v_concrete_cost_per_sqft DECIMAL;
            v_soft_cost_pct DECIMAL;
            v_contingency_pct DECIMAL;
            v_stabilized_occ DECIMAL;
            v_opex_pct DECIMAL;
            v_vacancy_pct DECIMAL;
            v_payback_years INT;

            -- Calculated values
            v_gross_potential INT;
            v_egi INT;
            v_expenses INT;
            v_noi INT;
            v_max_investment INT;

            v_building_costs INT;
            v_concrete_costs INT;
            v_hard_costs INT;
            v_soft_costs INT;
            v_contingency INT;
            v_fixed_costs INT;

            v_max_land_budget INT;

            -- Land benchmarks
            v_land_low INT;
            v_land_mid INT;
            v_land_high INT;
            v_cushion_low INT;
            v_cushion_mid INT;
            v_cushion_high INT;

            v_verdict VARCHAR(20);
            v_verdict_reason TEXT;
            v_rent_required DECIMAL;
            v_rent_gap DECIMAL;
            v_rent_gap_pct DECIMAL;
            v_breakeven_occ DECIMAL;
            v_margin_safety DECIMAL;

            v_result_id INT;
        BEGIN
            -- Get build configuration
            IF p_build_config_id IS NULL THEN
                SELECT id, config_name INTO v_config_id, v_config_name
                FROM build_constants WHERE is_default = TRUE AND is_active = TRUE LIMIT 1;
            ELSE
                SELECT id, config_name INTO v_config_id, v_config_name
                FROM build_constants WHERE id = p_build_config_id;
            END IF;

            IF v_config_id IS NULL THEN
                RAISE EXCEPTION 'Build configuration not found';
            END IF;

            -- Load config values
            SELECT
                units_per_acre, rentable_sqft_per_acre, buildings_per_acre,
                building_cost_each, concrete_sqft_per_building, concrete_cost_per_sqft,
                soft_cost_pct, contingency_pct,
                stabilized_occupancy_pct, operating_expense_pct, vacancy_collection_loss_pct,
                payback_years
            INTO
                v_units_per_acre, v_rentable_sqft, v_buildings_per_acre,
                v_building_cost_each, v_concrete_sqft_per_building, v_concrete_cost_per_sqft,
                v_soft_cost_pct, v_contingency_pct,
                v_stabilized_occ, v_opex_pct, v_vacancy_pct,
                v_payback_years
            FROM build_constants WHERE id = v_config_id;

            -- Get geo name and state
            IF p_geo_type = 'county' THEN
                SELECT county_name, l3.state INTO v_geo_name, v_state
                FROM layer_3_counties l3 WHERE county_fips = p_geo_id;

                IF v_geo_name IS NULL THEN
                    SELECT DISTINCT county_name, state INTO v_geo_name, v_state
                    FROM layer_1_geography WHERE county_fips = p_geo_id LIMIT 1;
                END IF;
            ELSIF p_geo_type = 'zip' THEN
                SELECT city, state INTO v_geo_name, v_state
                FROM zips_master WHERE zip = p_geo_id;
            END IF;

            -- Get land cost benchmarks
            SELECT total_land_budget_low, total_land_budget_mid, total_land_budget_high
            INTO v_land_low, v_land_mid, v_land_high
            FROM land_cost_benchmarks
            WHERE geo_type = p_geo_type AND geo_id = p_geo_id;

            -- ================================================================
            -- REVENUE CALCULATION (per acre, annual)
            -- ================================================================

            -- Gross potential rent (all units, full year, 100% occupancy)
            v_gross_potential := v_units_per_acre * p_market_rent * 12;

            -- Effective gross income (stabilized occupancy, less vacancy/collection)
            v_egi := ROUND(v_gross_potential * v_stabilized_occ * (1 - v_vacancy_pct));

            -- Operating expenses
            v_expenses := ROUND(v_egi * v_opex_pct);

            -- Net operating income
            v_noi := v_egi - v_expenses;

            -- ================================================================
            -- PAYBACK CALCULATION
            -- ================================================================

            -- Maximum total investment to achieve payback target
            v_max_investment := v_noi * v_payback_years;

            -- ================================================================
            -- KNOWN COSTS (per acre)
            -- ================================================================

            -- Building costs
            v_building_costs := v_buildings_per_acre * v_building_cost_each;

            -- Concrete costs
            v_concrete_costs := ROUND(v_buildings_per_acre * v_concrete_sqft_per_building * v_concrete_cost_per_sqft);

            -- Hard costs subtotal
            v_hard_costs := v_building_costs + v_concrete_costs;

            -- Soft costs (% of hard costs)
            v_soft_costs := ROUND(v_hard_costs * v_soft_cost_pct);

            -- Contingency
            v_contingency := ROUND(v_hard_costs * v_contingency_pct);

            -- Total fixed costs
            v_fixed_costs := v_hard_costs + v_soft_costs + v_contingency;

            -- ================================================================
            -- THE ANSWER: MAX LAND/SITE/PERMIT BUDGET
            -- ================================================================

            v_max_land_budget := v_max_investment - v_fixed_costs;

            -- ================================================================
            -- COMPARISON TO TYPICAL COSTS
            -- ================================================================

            IF v_land_low IS NOT NULL THEN
                v_cushion_low := v_max_land_budget - v_land_low;
                v_cushion_mid := v_max_land_budget - v_land_mid;
                v_cushion_high := v_max_land_budget - v_land_high;
            END IF;

            -- ================================================================
            -- VERDICT
            -- ================================================================

            IF v_max_land_budget <= 0 THEN
                v_verdict := 'no_go';
                v_verdict_reason := 'Market rent ($' || TRIM(TO_CHAR(p_market_rent, '999')) ||
                    ') does not cover fixed costs at ' || v_payback_years || '-year payback';
            ELSIF v_land_mid IS NULL THEN
                v_verdict := 'unknown';
                v_verdict_reason := 'No land benchmark - max budget is $' ||
                    TRIM(TO_CHAR(v_max_land_budget, 'FM999,999')) || '/acre for land+site+permits';
            ELSIF v_cushion_mid >= v_land_mid * 0.15 THEN
                v_verdict := 'go';
                v_verdict_reason := 'Budget exceeds typical by $' ||
                    TRIM(TO_CHAR(v_cushion_mid, 'FM999,999')) || ' (' ||
                    ROUND(v_cushion_mid::DECIMAL / NULLIF(v_land_mid, 0) * 100) || '% cushion)';
            ELSIF v_cushion_mid >= 0 THEN
                v_verdict := 'marginal';
                v_verdict_reason := 'Tight - only $' ||
                    TRIM(TO_CHAR(v_cushion_mid, 'FM999,999')) || ' cushion vs typical costs';
            ELSIF v_cushion_low >= 0 THEN
                v_verdict := 'marginal';
                v_verdict_reason := 'Need below-market land - $' ||
                    TRIM(TO_CHAR(ABS(v_cushion_mid), 'FM999,999')) || ' short of typical';
            ELSE
                v_verdict := 'no_go';
                v_verdict_reason := 'Rent too low - $' ||
                    TRIM(TO_CHAR(ABS(v_cushion_low), 'FM999,999')) || ' short even at low-end costs';
            END IF;

            -- ================================================================
            -- RENT REQUIRED (if not go)
            -- ================================================================

            IF v_verdict != 'go' AND v_land_mid IS NOT NULL THEN
                -- Back-calculate rent needed for mid-range land costs + 15% cushion
                v_rent_required := CEIL(
                    (v_fixed_costs + v_land_mid * 1.15)::DECIMAL /
                    v_payback_years /
                    (1 - v_opex_pct) /
                    (1 - v_vacancy_pct) /
                    v_stabilized_occ /
                    v_units_per_acre /
                    12
                );
                v_rent_gap := v_rent_required - p_market_rent;
                v_rent_gap_pct := ROUND(v_rent_gap / NULLIF(p_market_rent, 0) * 100, 1);
            END IF;

            -- ================================================================
            -- BREAKEVEN METRICS
            -- ================================================================

            -- What occupancy is needed to breakeven on cash flow?
            IF v_noi > 0 AND v_max_investment > 0 THEN
                v_breakeven_occ := ROUND(
                    (v_fixed_costs + COALESCE(v_land_mid, v_max_land_budget * 0.6))::DECIMAL /
                    v_payback_years /
                    (1 - v_opex_pct) /
                    v_gross_potential, 3
                );
                v_margin_safety := ROUND((v_stabilized_occ - v_breakeven_occ) / v_stabilized_occ * 100, 1);
            END IF;

            -- ================================================================
            -- INSERT RESULT
            -- ================================================================

            INSERT INTO reverse_feasibility (
                geo_type, geo_id, geo_name, state,
                analysis_date, build_config_id, build_config_name,
                market_rent_10x10, rent_confidence, rent_source, rent_date,
                units_per_acre, rentable_sqft_per_acre, buildings_per_acre,
                gross_potential_rent, effective_gross_income, operating_expenses, net_operating_income,
                payback_years, target_return_pct, max_total_investment,
                building_costs, concrete_costs, hard_costs_subtotal, soft_costs, contingency, total_fixed_costs,
                max_land_site_permit_budget,
                typical_land_cost_low, typical_land_cost_mid, typical_land_cost_high,
                budget_vs_typical_low, budget_vs_typical_mid, budget_vs_typical_high,
                verdict, verdict_reason,
                rent_required_for_go, rent_gap, rent_gap_pct,
                breakeven_occupancy_pct, margin_of_safety_pct
            ) VALUES (
                p_geo_type, p_geo_id, v_geo_name, v_state,
                CURRENT_DATE, v_config_id, v_config_name,
                p_market_rent, p_rent_confidence, p_rent_source, CURRENT_DATE,
                v_units_per_acre, v_rentable_sqft, v_buildings_per_acre,
                v_gross_potential, v_egi, v_expenses, v_noi,
                v_payback_years, 1.0/v_payback_years, v_max_investment,
                v_building_costs, v_concrete_costs, v_hard_costs, v_soft_costs, v_contingency, v_fixed_costs,
                v_max_land_budget,
                v_land_low, v_land_mid, v_land_high,
                v_cushion_low, v_cushion_mid, v_cushion_high,
                v_verdict, v_verdict_reason,
                v_rent_required, v_rent_gap, v_rent_gap_pct,
                v_breakeven_occ, v_margin_safety
            )
            ON CONFLICT (geo_type, geo_id, analysis_date, build_config_id)
            DO UPDATE SET
                geo_name = EXCLUDED.geo_name,
                state = EXCLUDED.state,
                market_rent_10x10 = EXCLUDED.market_rent_10x10,
                rent_confidence = EXCLUDED.rent_confidence,
                rent_source = EXCLUDED.rent_source,
                rent_date = EXCLUDED.rent_date,
                gross_potential_rent = EXCLUDED.gross_potential_rent,
                effective_gross_income = EXCLUDED.effective_gross_income,
                operating_expenses = EXCLUDED.operating_expenses,
                net_operating_income = EXCLUDED.net_operating_income,
                max_total_investment = EXCLUDED.max_total_investment,
                building_costs = EXCLUDED.building_costs,
                concrete_costs = EXCLUDED.concrete_costs,
                hard_costs_subtotal = EXCLUDED.hard_costs_subtotal,
                soft_costs = EXCLUDED.soft_costs,
                contingency = EXCLUDED.contingency,
                total_fixed_costs = EXCLUDED.total_fixed_costs,
                max_land_site_permit_budget = EXCLUDED.max_land_site_permit_budget,
                typical_land_cost_low = EXCLUDED.typical_land_cost_low,
                typical_land_cost_mid = EXCLUDED.typical_land_cost_mid,
                typical_land_cost_high = EXCLUDED.typical_land_cost_high,
                budget_vs_typical_low = EXCLUDED.budget_vs_typical_low,
                budget_vs_typical_mid = EXCLUDED.budget_vs_typical_mid,
                budget_vs_typical_high = EXCLUDED.budget_vs_typical_high,
                verdict = EXCLUDED.verdict,
                verdict_reason = EXCLUDED.verdict_reason,
                rent_required_for_go = EXCLUDED.rent_required_for_go,
                rent_gap = EXCLUDED.rent_gap,
                rent_gap_pct = EXCLUDED.rent_gap_pct,
                breakeven_occupancy_pct = EXCLUDED.breakeven_occupancy_pct,
                margin_of_safety_pct = EXCLUDED.margin_of_safety_pct,
                created_at = NOW()
            RETURNING id INTO v_result_id;

            RETURN QUERY SELECT v_result_id, v_verdict, v_max_land_budget, v_verdict_reason;
        END;
        $$ LANGUAGE plpgsql;
    """)
    print("   [OK] calculate_reverse_feasibility function created")

    conn.commit()
    conn.close()


def create_views():
    """Create analysis views for the reverse feasibility engine."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("CREATING ANALYSIS VIEWS")
    print("=" * 70)

    # View: Feasibility summary by verdict
    cursor.execute("""
        CREATE OR REPLACE VIEW v_feasibility_by_verdict AS
        SELECT
            verdict,
            COUNT(*) as count,
            ROUND(AVG(market_rent_10x10)::numeric, 0) as avg_rent,
            ROUND(AVG(net_operating_income)::numeric, 0) as avg_noi,
            ROUND(AVG(max_land_site_permit_budget)::numeric, 0) as avg_land_budget,
            ROUND(AVG(budget_vs_typical_mid)::numeric, 0) as avg_cushion
        FROM reverse_feasibility
        WHERE analysis_date = (SELECT MAX(analysis_date) FROM reverse_feasibility)
        GROUP BY verdict
        ORDER BY
            CASE verdict
                WHEN 'go' THEN 1
                WHEN 'marginal' THEN 2
                WHEN 'unknown' THEN 3
                WHEN 'no_go' THEN 4
            END;
    """)
    print("   [OK] v_feasibility_by_verdict created")

    # View: Go markets ranked by cushion
    cursor.execute("""
        CREATE OR REPLACE VIEW v_go_markets AS
        SELECT
            geo_id as county_fips,
            geo_name as county_name,
            state,
            market_rent_10x10 as rent,
            net_operating_income as noi,
            max_land_site_permit_budget as land_budget,
            typical_land_cost_mid as typical_cost,
            budget_vs_typical_mid as cushion,
            ROUND(budget_vs_typical_mid::decimal / NULLIF(typical_land_cost_mid, 0) * 100, 1) as cushion_pct,
            margin_of_safety_pct,
            verdict_reason
        FROM reverse_feasibility
        WHERE verdict = 'go'
        AND analysis_date = (SELECT MAX(analysis_date) FROM reverse_feasibility)
        ORDER BY budget_vs_typical_mid DESC;
    """)
    print("   [OK] v_go_markets created")

    # View: Marginal markets (opportunities with risk)
    cursor.execute("""
        CREATE OR REPLACE VIEW v_marginal_markets AS
        SELECT
            geo_id as county_fips,
            geo_name as county_name,
            state,
            market_rent_10x10 as rent,
            max_land_site_permit_budget as land_budget,
            typical_land_cost_mid as typical_cost,
            budget_vs_typical_mid as gap,
            rent_required_for_go,
            rent_gap,
            rent_gap_pct,
            verdict_reason
        FROM reverse_feasibility
        WHERE verdict = 'marginal'
        AND analysis_date = (SELECT MAX(analysis_date) FROM reverse_feasibility)
        ORDER BY rent_gap ASC;
    """)
    print("   [OK] v_marginal_markets created")

    # View: No-go markets with rent required
    cursor.execute("""
        CREATE OR REPLACE VIEW v_nogo_markets AS
        SELECT
            geo_id as county_fips,
            geo_name as county_name,
            state,
            market_rent_10x10 as current_rent,
            rent_required_for_go,
            rent_gap,
            rent_gap_pct,
            max_land_site_permit_budget as calculated_land_budget,
            verdict_reason
        FROM reverse_feasibility
        WHERE verdict = 'no_go'
        AND analysis_date = (SELECT MAX(analysis_date) FROM reverse_feasibility)
        ORDER BY rent_gap ASC;
    """)
    print("   [OK] v_nogo_markets created")

    # View: Build config comparison
    cursor.execute("""
        CREATE OR REPLACE VIEW v_build_config_summary AS
        SELECT
            config_name,
            is_default,
            is_active,
            buildings_per_acre,
            units_per_acre,
            rentable_sqft_per_acre,
            building_cost_each,
            buildings_per_acre * building_cost_each as building_costs_per_acre,
            ROUND(buildings_per_acre * building_sqft * concrete_cost_per_sqft) as concrete_costs_per_acre,
            payback_years,
            ROUND(target_annual_return_pct * 100, 1) as target_return_pct,
            stabilized_occupancy_pct,
            operating_expense_pct
        FROM build_constants
        ORDER BY is_default DESC, config_name;
    """)
    print("   [OK] v_build_config_summary created")

    # View: Feasibility detail with all metrics
    cursor.execute("""
        CREATE OR REPLACE VIEW v_feasibility_detail AS
        SELECT
            rf.geo_id as county_fips,
            rf.geo_name as county_name,
            rf.state,
            rf.verdict,

            -- Market inputs
            rf.market_rent_10x10 as rent,
            rf.rent_confidence,

            -- Revenue (per acre)
            rf.units_per_acre,
            rf.gross_potential_rent as gpr,
            rf.effective_gross_income as egi,
            rf.operating_expenses as opex,
            rf.net_operating_income as noi,

            -- Investment calc
            rf.payback_years,
            rf.max_total_investment,

            -- Known costs
            rf.building_costs,
            rf.concrete_costs,
            rf.soft_costs,
            rf.contingency,
            rf.total_fixed_costs,

            -- The answer
            rf.max_land_site_permit_budget as max_land_budget,

            -- Comparison
            rf.typical_land_cost_low,
            rf.typical_land_cost_mid,
            rf.typical_land_cost_high,
            rf.budget_vs_typical_mid as cushion,

            -- Sensitivity
            rf.rent_required_for_go,
            rf.rent_gap,
            rf.rent_gap_pct,
            rf.breakeven_occupancy_pct,
            rf.margin_of_safety_pct,

            rf.verdict_reason,
            rf.analysis_date
        FROM reverse_feasibility rf
        WHERE rf.analysis_date = (SELECT MAX(analysis_date) FROM reverse_feasibility)
        ORDER BY
            CASE rf.verdict
                WHEN 'go' THEN 1
                WHEN 'marginal' THEN 2
                WHEN 'unknown' THEN 3
                WHEN 'no_go' THEN 4
            END,
            rf.budget_vs_typical_mid DESC NULLS LAST;
    """)
    print("   [OK] v_feasibility_detail created")

    conn.commit()
    conn.close()


def seed_land_benchmarks():
    """Seed land cost benchmarks for counties in the target zone."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("SEEDING LAND COST BENCHMARKS")
    print("=" * 70)

    # Get all counties from layer_3
    cursor.execute("""
        SELECT DISTINCT county_fips, county_name, state
        FROM layer_3_counties
        ORDER BY state, county_name
    """)
    counties = cursor.fetchall()

    print(f"\n   Counties to seed: {len(counties)}")

    # Default land cost estimates by state (rough estimates - should be refined)
    state_defaults = {
        'PA': {'low': 15000, 'mid': 35000, 'high': 75000},
        'WV': {'low': 8000, 'mid': 20000, 'high': 45000},
        'MD': {'low': 25000, 'mid': 60000, 'high': 150000},
        'VA': {'low': 20000, 'mid': 50000, 'high': 120000},
        'OH': {'low': 12000, 'mid': 30000, 'high': 65000},
        'NY': {'low': 30000, 'mid': 75000, 'high': 175000},
        'DC': {'low': 200000, 'mid': 500000, 'high': 1000000},
    }

    # Rural vs suburban adjustments
    # Counties with larger populations get higher land costs
    cursor.execute("""
        SELECT county_fips, total_population
        FROM layer_3_counties
    """)
    pop_data = {r['county_fips']: r['total_population'] for r in cursor.fetchall()}

    inserted = 0
    for county in counties:
        fips = county['county_fips']
        name = county['county_name']
        state = county['state']

        defaults = state_defaults.get(state, {'low': 15000, 'mid': 40000, 'high': 80000})

        # Adjust based on population density
        pop = pop_data.get(fips, 50000)
        if pop > 200000:
            multiplier = 1.5
        elif pop > 100000:
            multiplier = 1.2
        elif pop < 30000:
            multiplier = 0.7
        else:
            multiplier = 1.0

        try:
            cursor.execute("""
                INSERT INTO land_cost_benchmarks (
                    geo_type, geo_id, geo_name, state,
                    cost_per_acre_low, cost_per_acre_mid, cost_per_acre_high,
                    source, confidence
                ) VALUES (
                    'county', %s, %s, %s,
                    %s, %s, %s,
                    'State average estimate - refine with local data', 'low'
                )
                ON CONFLICT (geo_type, geo_id) DO UPDATE SET
                    geo_name = EXCLUDED.geo_name,
                    cost_per_acre_low = EXCLUDED.cost_per_acre_low,
                    cost_per_acre_mid = EXCLUDED.cost_per_acre_mid,
                    cost_per_acre_high = EXCLUDED.cost_per_acre_high,
                    updated_at = NOW()
            """, (
                fips, name, state,
                int(defaults['low'] * multiplier),
                int(defaults['mid'] * multiplier),
                int(defaults['high'] * multiplier)
            ))
            inserted += 1
        except Exception as e:
            print(f"   Error inserting {fips}: {e}")

    conn.commit()
    print(f"   [OK] Inserted/updated {inserted} land benchmarks")
    conn.close()


def run_feasibility_analysis():
    """Run reverse feasibility analysis for all counties with rate data."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("RUNNING REVERSE FEASIBILITY ANALYSIS")
    print("=" * 70)

    # Get market rents from storage_facilities (primary source with asking rents)
    # and fall back to state averages for counties without data
    cursor.execute("""
        SELECT
            county_fips,
            ROUND(AVG(asking_rent_10x10)) as rent,
            'storage_facilities' as source,
            CASE
                WHEN COUNT(*) >= 5 THEN 'high'
                WHEN COUNT(*) >= 2 THEN 'medium'
                ELSE 'low'
            END as confidence
        FROM storage_facilities
        WHERE asking_rent_10x10 IS NOT NULL AND asking_rent_10x10 > 0
        GROUP BY county_fips
        ORDER BY county_fips
    """)
    rent_data = cursor.fetchall()

    print(f"\n   Counties with rent data: {len(rent_data)}")

    # Also get counties without rent data (use regional estimate)
    cursor.execute("""
        SELECT DISTINCT l3.county_fips, l3.county_name, l3.state
        FROM layer_3_counties l3
        WHERE l3.county_fips NOT IN (
            SELECT county_fips FROM storage_facilities WHERE asking_rent_10x10 IS NOT NULL
        )
    """)
    no_rent_counties = cursor.fetchall()

    # Calculate state averages for counties without data
    cursor.execute("""
        SELECT state, ROUND(AVG(asking_rent_10x10)) as avg_rent
        FROM storage_facilities
        WHERE asking_rent_10x10 IS NOT NULL AND asking_rent_10x10 > 0
        GROUP BY state
    """)
    state_avg_rents = {r['state']: r['avg_rent'] for r in cursor.fetchall()}
    default_rent = 80  # Fallback if no state data

    results = {'go': 0, 'marginal': 0, 'no_go': 0, 'unknown': 0}

    # Process counties with rent data
    print("\n   Processing counties with rent data...")
    for row in rent_data:
        try:
            cursor.execute("""
                SELECT * FROM calculate_reverse_feasibility(
                    'county', %s, %s, %s, %s
                )
            """, (row['county_fips'], row['rent'], row['confidence'], row['source']))
            result = cursor.fetchone()
            if result:
                results[result['verdict']] = results.get(result['verdict'], 0) + 1
        except Exception as e:
            print(f"      Error processing {row['county_fips']}: {e}")
            conn.rollback()

    # Process counties without rent data (use state average)
    print(f"\n   Processing {len(no_rent_counties)} counties without rent data (using state avg)...")
    for county in no_rent_counties:
        rent = state_avg_rents.get(county['state'], default_rent)
        try:
            cursor.execute("""
                SELECT * FROM calculate_reverse_feasibility(
                    'county', %s, %s, 'estimate', 'state_average'
                )
            """, (county['county_fips'], rent))
            result = cursor.fetchone()
            if result:
                results[result['verdict']] = results.get(result['verdict'], 0) + 1
        except Exception as e:
            print(f"      Error processing {county['county_fips']}: {e}")
            conn.rollback()

    conn.commit()

    print("\n" + "-" * 70)
    print("RESULTS SUMMARY")
    print("-" * 70)
    print(f"   GO:       {results.get('go', 0)} counties")
    print(f"   MARGINAL: {results.get('marginal', 0)} counties")
    print(f"   NO-GO:    {results.get('no_go', 0)} counties")
    print(f"   UNKNOWN:  {results.get('unknown', 0)} counties")

    conn.close()


def print_report():
    """Print a summary report of the feasibility analysis."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("REVERSE FEASIBILITY REPORT")
    print("=" * 70)

    # Build config summary
    print("\n--- BUILD CONFIGURATION ---")
    cursor.execute("SELECT * FROM v_build_config_summary WHERE is_default = TRUE")
    config = cursor.fetchone()
    if config:
        print(f"   Config: {config['config_name']}")
        print(f"   Buildings/acre: {config['buildings_per_acre']}")
        print(f"   Units/acre: {config['units_per_acre']}")
        print(f"   Rentable sqft/acre: {config['rentable_sqft_per_acre']:,}")
        print(f"   Building costs/acre: ${config['building_costs_per_acre']:,}")
        print(f"   Concrete costs/acre: ${int(config['concrete_costs_per_acre']):,}")
        print(f"   Payback target: {config['payback_years']} years ({config['target_return_pct']}% annual)")

    # Summary by verdict
    print("\n--- VERDICT SUMMARY ---")
    cursor.execute("SELECT * FROM v_feasibility_by_verdict")
    for row in cursor.fetchall():
        print(f"   {row['verdict'].upper():<10} {row['count']:>3} counties | "
              f"Avg rent: ${row['avg_rent'] or 0:,.0f} | "
              f"Avg NOI: ${row['avg_noi'] or 0:,.0f} | "
              f"Avg land budget: ${row['avg_land_budget'] or 0:,.0f}")

    # Top GO markets
    print("\n--- TOP GO MARKETS (by cushion) ---")
    cursor.execute("SELECT * FROM v_go_markets LIMIT 10")
    rows = cursor.fetchall()
    if rows:
        print(f"   {'County':<25} {'ST':<3} {'Rent':<7} {'Land Budget':<12} {'Cushion':<10} {'%':<6}")
        print(f"   {'-'*25} {'-'*3} {'-'*7} {'-'*12} {'-'*10} {'-'*6}")
        for row in rows:
            print(f"   {row['county_name'][:25]:<25} {row['state']:<3} "
                  f"${row['rent']:>5,.0f} ${row['land_budget']:>10,} "
                  f"${row['cushion']:>8,} {row['cushion_pct'] or 0:>5.1f}%")
    else:
        print("   No GO markets found")

    # Marginal markets
    print("\n--- MARGINAL MARKETS (close to GO) ---")
    cursor.execute("SELECT * FROM v_marginal_markets LIMIT 10")
    rows = cursor.fetchall()
    if rows:
        print(f"   {'County':<25} {'ST':<3} {'Rent':<7} {'Gap':<10} {'Rent Needed':<12}")
        print(f"   {'-'*25} {'-'*3} {'-'*7} {'-'*10} {'-'*12}")
        for row in rows:
            print(f"   {row['county_name'][:25]:<25} {row['state']:<3} "
                  f"${row['rent']:>5,.0f} ${row['gap'] or 0:>8,} "
                  f"${row['rent_required_for_go'] or 0:>10,.0f}")
    else:
        print("   No marginal markets found")

    # No-go markets
    print("\n--- NO-GO MARKETS (rent too low) ---")
    cursor.execute("SELECT * FROM v_nogo_markets LIMIT 10")
    rows = cursor.fetchall()
    if rows:
        print(f"   {'County':<25} {'ST':<3} {'Current':<8} {'Required':<10} {'Gap':<8} {'Gap %':<7}")
        print(f"   {'-'*25} {'-'*3} {'-'*8} {'-'*10} {'-'*8} {'-'*7}")
        for row in rows:
            print(f"   {row['county_name'][:25]:<25} {row['state']:<3} "
                  f"${row['current_rent'] or 0:>6,.0f} ${row['rent_required_for_go'] or 0:>8,.0f} "
                  f"${row['rent_gap'] or 0:>6,.0f} {row['rent_gap_pct'] or 0:>6.1f}%")
    else:
        print("   No no-go markets found")

    conn.close()


def main():
    """Main entry point."""
    print("\n" + "=" * 70)
    print("REVERSE FEASIBILITY ENGINE")
    print("=" * 70)
    print("Backs into max land/site/permit budget from market rents")
    print("=" * 70)

    # Create schema
    create_schema()

    # Create function
    create_feasibility_function()

    # Create views
    create_views()

    # Seed land benchmarks
    seed_land_benchmarks()

    # Run analysis
    run_feasibility_analysis()

    # Print report
    print_report()

    print("\n" + "=" * 70)
    print("REVERSE FEASIBILITY ENGINE COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
