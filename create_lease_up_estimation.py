"""
Prompt 22: Lease-Up Period Estimation
Creates comprehensive lease-up estimation system based on market conditions.

Tables: lease_up_estimates, lease_up_factors, lease_up_scenarios
Functions: estimate_lease_up_period, calculate_lease_up_curve, update_feasibility_lease_up
Views: v_lease_up_summary, v_lease_up_by_market
"""

import psycopg2
from datetime import datetime

# Database connection
DATABASE_URL = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"


def create_lease_up_factors_table(cur):
    """Create lease_up_factors table for configurable estimation parameters."""
    print("Creating lease_up_factors table...")

    cur.execute("DROP TABLE IF EXISTS lease_up_factors CASCADE;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS lease_up_factors (
            id SERIAL PRIMARY KEY,
            factor_set_name VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,

            -- Base lease-up months by saturation/trajectory
            base_tight_improving INT DEFAULT 18,      -- saturation < 5, improving
            base_tight_stable INT DEFAULT 21,         -- saturation < 5, stable
            base_tight_declining INT DEFAULT 24,      -- saturation < 5, declining
            base_moderate_improving INT DEFAULT 24,   -- saturation 5-7, improving
            base_moderate_stable INT DEFAULT 30,      -- saturation 5-7, stable
            base_moderate_declining INT DEFAULT 36,   -- saturation 5-7, declining
            base_soft_improving INT DEFAULT 36,       -- saturation 7-9, improving
            base_soft_stable INT DEFAULT 42,          -- saturation 7-9, stable
            base_soft_declining INT DEFAULT 48,       -- saturation 7-9, declining
            base_oversupplied INT DEFAULT 48,         -- saturation >= 9

            -- Adjustment factors (months added/subtracted)
            adj_new_housing_pipeline INT DEFAULT -2,  -- Strong housing pipeline nearby
            adj_economic_catalyst INT DEFAULT -3,     -- Major employer/catalyst announced
            adj_infrastructure_project INT DEFAULT -2, -- Road improvement opening access
            adj_competitor_opening INT DEFAULT 4,     -- New competitor in pipeline
            adj_high_visibility INT DEFAULT -2,       -- High traffic/visibility location
            adj_low_visibility INT DEFAULT 3,         -- Poor visibility
            adj_premium_pricing INT DEFAULT 2,        -- Pricing above market
            adj_discount_pricing INT DEFAULT -2,      -- Pricing below market
            adj_climate_focus INT DEFAULT 1,          -- Heavy climate-control focus
            adj_reit_competition INT DEFAULT 2,       -- Strong REIT presence
            adj_independent_market INT DEFAULT -1,    -- Mostly independents
            adj_strong_promos INT DEFAULT -1,         -- Market has aggressive promos
            adj_weak_promos INT DEFAULT 1,            -- Little promo activity

            -- Occupancy curve parameters
            month_1_occupancy_pct DECIMAL(5,2) DEFAULT 5.0,
            month_3_occupancy_pct DECIMAL(5,2) DEFAULT 15.0,
            month_6_occupancy_pct DECIMAL(5,2) DEFAULT 35.0,
            month_12_occupancy_pct DECIMAL(5,2) DEFAULT 60.0,
            stabilized_occupancy_pct DECIMAL(5,2) DEFAULT 90.0,

            -- Minimum/maximum bounds
            min_lease_up_months INT DEFAULT 12,
            max_lease_up_months INT DEFAULT 60,

            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    """)

    # Insert default factor set
    cur.execute("""
        INSERT INTO lease_up_factors (factor_set_name, description)
        VALUES ('default', 'Default lease-up estimation parameters based on industry benchmarks')
        ON CONFLICT (factor_set_name) DO NOTHING;
    """)

    # Insert conservative factor set
    cur.execute("""
        INSERT INTO lease_up_factors (
            factor_set_name, description,
            base_tight_improving, base_tight_stable, base_tight_declining,
            base_moderate_improving, base_moderate_stable, base_moderate_declining,
            base_soft_improving, base_soft_stable, base_soft_declining,
            base_oversupplied,
            min_lease_up_months, max_lease_up_months
        ) VALUES (
            'conservative', 'Conservative estimates for risk-averse analysis',
            24, 27, 30,
            30, 36, 42,
            42, 48, 54,
            60,
            18, 72
        )
        ON CONFLICT (factor_set_name) DO NOTHING;
    """)

    # Insert aggressive factor set
    cur.execute("""
        INSERT INTO lease_up_factors (
            factor_set_name, description,
            base_tight_improving, base_tight_stable, base_tight_declining,
            base_moderate_improving, base_moderate_stable, base_moderate_declining,
            base_soft_improving, base_soft_stable, base_soft_declining,
            base_oversupplied,
            min_lease_up_months, max_lease_up_months
        ) VALUES (
            'aggressive', 'Optimistic estimates for high-growth markets',
            12, 15, 18,
            18, 21, 24,
            24, 30, 36,
            36,
            9, 48
        )
        ON CONFLICT (factor_set_name) DO NOTHING;
    """)

    print("  Created lease_up_factors table with 3 factor sets")


def create_lease_up_estimates_table(cur):
    """Create lease_up_estimates table for storing estimation results."""
    print("Creating lease_up_estimates table...")

    cur.execute("DROP TABLE IF EXISTS lease_up_estimates CASCADE;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS lease_up_estimates (
            id SERIAL PRIMARY KEY,

            -- Geography
            county_fips VARCHAR(5) NOT NULL,
            county_name VARCHAR(100),
            state VARCHAR(2),

            -- Estimation parameters
            factor_set_id INT REFERENCES lease_up_factors(id),
            estimation_date DATE DEFAULT CURRENT_DATE,

            -- Market conditions (inputs)
            saturation_sqft_per_cap DECIMAL(6,2),
            saturation_category VARCHAR(20),  -- tight, moderate, soft, oversupplied
            market_trajectory VARCHAR(20),    -- improving, stable, declining

            -- Adjustment factors applied
            housing_pipeline_units INT,
            has_housing_adjustment BOOLEAN DEFAULT FALSE,
            catalyst_count INT,
            has_catalyst_adjustment BOOLEAN DEFAULT FALSE,
            infrastructure_projects INT,
            has_infrastructure_adjustment BOOLEAN DEFAULT FALSE,
            competitor_pipeline_count INT,
            has_competitor_adjustment BOOLEAN DEFAULT FALSE,
            visibility_rating VARCHAR(20),    -- high, medium, low
            has_visibility_adjustment BOOLEAN DEFAULT FALSE,
            pricing_position VARCHAR(20),     -- premium, market, discount
            has_pricing_adjustment BOOLEAN DEFAULT FALSE,
            climate_focus_pct DECIMAL(5,2),
            has_climate_adjustment BOOLEAN DEFAULT FALSE,
            reit_market_share_pct DECIMAL(5,2),
            has_reit_adjustment BOOLEAN DEFAULT FALSE,
            promo_activity VARCHAR(20),       -- strong, moderate, weak
            has_promo_adjustment BOOLEAN DEFAULT FALSE,

            -- Estimation results
            base_lease_up_months INT,
            total_adjustments INT,
            estimated_lease_up_months INT,
            lease_up_confidence VARCHAR(20),  -- high, medium, low

            -- Occupancy curve
            month_3_occupancy DECIMAL(5,2),
            month_6_occupancy DECIMAL(5,2),
            month_12_occupancy DECIMAL(5,2),
            month_18_occupancy DECIMAL(5,2),
            month_24_occupancy DECIMAL(5,2),
            month_36_occupancy DECIMAL(5,2),
            stabilized_occupancy DECIMAL(5,2),

            -- Financial impact
            cumulative_vacancy_loss_months DECIMAL(6,2),  -- Total months of lost revenue during lease-up
            effective_first_year_occupancy DECIMAL(5,2),
            effective_second_year_occupancy DECIMAL(5,2),
            effective_third_year_occupancy DECIMAL(5,2),

            -- Risk assessment
            lease_up_risk VARCHAR(20),        -- low, moderate, high, very_high
            risk_factors TEXT[],

            -- Metadata
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(county_fips, factor_set_id, estimation_date)
        );

        CREATE INDEX idx_lue_county ON lease_up_estimates(county_fips);
        CREATE INDEX idx_lue_date ON lease_up_estimates(estimation_date);
    """)

    print("  Created lease_up_estimates table")


def create_lease_up_scenarios_table(cur):
    """Create lease_up_scenarios table for what-if analysis."""
    print("Creating lease_up_scenarios table...")

    cur.execute("DROP TABLE IF EXISTS lease_up_scenarios CASCADE;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS lease_up_scenarios (
            id SERIAL PRIMARY KEY,

            lease_up_estimate_id INT REFERENCES lease_up_estimates(id),
            scenario_name VARCHAR(50) NOT NULL,
            scenario_type VARCHAR(20) NOT NULL,  -- base, optimistic, pessimistic, stress

            -- Scenario adjustments
            saturation_override VARCHAR(20),
            trajectory_override VARCHAR(20),
            additional_months INT DEFAULT 0,
            occupancy_multiplier DECIMAL(4,2) DEFAULT 1.0,

            -- Scenario results
            scenario_lease_up_months INT,
            scenario_month_12_occupancy DECIMAL(5,2),
            scenario_stabilized_occupancy DECIMAL(5,2),
            scenario_vacancy_loss_months DECIMAL(6,2),

            -- Financial impact
            noi_impact_year_1 INT,
            noi_impact_year_2 INT,
            noi_impact_year_3 INT,
            yield_impact_year_1 DECIMAL(5,2),
            yield_impact_year_3 DECIMAL(5,2),

            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX idx_lus_estimate ON lease_up_scenarios(lease_up_estimate_id);
    """)

    print("  Created lease_up_scenarios table")


def create_estimate_lease_up_function(cur):
    """Create main function to estimate lease-up period."""
    print("Creating estimate_lease_up_period function...")

    cur.execute("DROP FUNCTION IF EXISTS estimate_lease_up_period(VARCHAR, VARCHAR);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION estimate_lease_up_period(
            p_county_fips VARCHAR(5),
            p_factor_set VARCHAR(50) DEFAULT 'default'
        )
        RETURNS INT AS $func$
        DECLARE
            v_factors lease_up_factors%ROWTYPE;
            v_market market_projections%ROWTYPE;
            v_analysis market_analysis%ROWTYPE;
            v_county layer_3_counties%ROWTYPE;
            v_estimate_id INT;
            v_base_months INT;
            v_adjustments INT := 0;
            v_final_months INT;
            v_saturation_cat VARCHAR(20);
            v_trajectory VARCHAR(20);
            v_confidence VARCHAR(20);
            v_risk VARCHAR(20);
            v_risk_factors TEXT[] := '{}';
            v_housing_units INT;
            v_catalyst_count INT;
            v_infra_count INT;
            v_competitor_count INT;
            v_reit_pct DECIMAL;
            v_promo_pct DECIMAL;
            v_vacancy_loss DECIMAL;
            v_m3_occ DECIMAL;
            v_m6_occ DECIMAL;
            v_m12_occ DECIMAL;
            v_m18_occ DECIMAL;
            v_m24_occ DECIMAL;
            v_m36_occ DECIMAL;
        BEGIN
            -- Get factor set
            SELECT * INTO v_factors
            FROM lease_up_factors
            WHERE factor_set_name = p_factor_set AND is_active = TRUE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Factor set % not found', p_factor_set;
            END IF;

            -- Get market data
            SELECT * INTO v_market
            FROM market_projections
            WHERE geo_type = 'county' AND geo_id = p_county_fips
            ORDER BY projection_date DESC LIMIT 1;

            SELECT * INTO v_analysis
            FROM market_analysis
            WHERE geo_type = 'county' AND geo_id = p_county_fips
            ORDER BY analysis_date DESC LIMIT 1;

            SELECT * INTO v_county
            FROM layer_3_counties
            WHERE county_fips = p_county_fips;

            -- Determine saturation category
            v_saturation_cat := CASE
                WHEN COALESCE(v_market.current_sqft_per_cap, v_analysis.sqft_per_capita, 7) < 5 THEN 'tight'
                WHEN COALESCE(v_market.current_sqft_per_cap, v_analysis.sqft_per_capita, 7) < 7 THEN 'moderate'
                WHEN COALESCE(v_market.current_sqft_per_cap, v_analysis.sqft_per_capita, 7) < 9 THEN 'soft'
                ELSE 'oversupplied'
            END;

            -- Determine trajectory
            v_trajectory := COALESCE(v_market.trajectory, 'stable');

            -- Calculate base lease-up months
            v_base_months := CASE
                WHEN v_saturation_cat = 'tight' AND v_trajectory = 'improving' THEN v_factors.base_tight_improving
                WHEN v_saturation_cat = 'tight' AND v_trajectory = 'stable' THEN v_factors.base_tight_stable
                WHEN v_saturation_cat = 'tight' AND v_trajectory = 'declining' THEN v_factors.base_tight_declining
                WHEN v_saturation_cat = 'moderate' AND v_trajectory = 'improving' THEN v_factors.base_moderate_improving
                WHEN v_saturation_cat = 'moderate' AND v_trajectory = 'stable' THEN v_factors.base_moderate_stable
                WHEN v_saturation_cat = 'moderate' AND v_trajectory = 'declining' THEN v_factors.base_moderate_declining
                WHEN v_saturation_cat = 'soft' AND v_trajectory = 'improving' THEN v_factors.base_soft_improving
                WHEN v_saturation_cat = 'soft' AND v_trajectory = 'stable' THEN v_factors.base_soft_stable
                WHEN v_saturation_cat = 'soft' AND v_trajectory = 'declining' THEN v_factors.base_soft_declining
                ELSE v_factors.base_oversupplied
            END;

            -- Get housing pipeline
            SELECT COALESCE(SUM(unit_count), 0) INTO v_housing_units
            FROM housing_pipeline
            WHERE county_fips = p_county_fips
            AND status IN ('permitted', 'under_construction', 'site_work');

            IF v_housing_units > 500 THEN
                v_adjustments := v_adjustments + v_factors.adj_new_housing_pipeline;
            END IF;

            -- Get economic catalysts
            SELECT COUNT(*) INTO v_catalyst_count
            FROM economic_catalysts
            WHERE county_fips = p_county_fips
            AND is_active = TRUE
            AND status IN ('announced', 'under_construction')
            AND jobs_announced > 100;

            IF v_catalyst_count > 0 THEN
                v_adjustments := v_adjustments + (v_factors.adj_economic_catalyst * LEAST(v_catalyst_count, 3));
            END IF;

            -- Get infrastructure projects
            SELECT COUNT(*) INTO v_infra_count
            FROM infrastructure_projects
            WHERE catalyst_id IN (
                SELECT id FROM economic_catalysts WHERE county_fips = p_county_fips
            )
            AND enables_development = TRUE
            AND current_phase IN ('design', 'construction');

            IF v_infra_count > 0 THEN
                v_adjustments := v_adjustments + v_factors.adj_infrastructure_project;
            END IF;

            -- Get competitor pipeline
            SELECT COUNT(*) INTO v_competitor_count
            FROM storage_pipeline
            WHERE county_fips = p_county_fips
            AND pipeline_status IN ('announced', 'permitted', 'under_construction');

            IF v_competitor_count > 0 THEN
                v_adjustments := v_adjustments + (v_factors.adj_competitor_opening * v_competitor_count);
                v_risk_factors := array_append(v_risk_factors, v_competitor_count || ' competitors in pipeline');
            END IF;

            -- Get REIT market share
            SELECT COALESCE(
                COUNT(*) FILTER (WHERE owner_operator IN ('Public Storage', 'Extra Space', 'CubeSmart', 'Life Storage', 'National Storage'))::DECIMAL
                / NULLIF(COUNT(*), 0) * 100, 0
            ) INTO v_reit_pct
            FROM storage_facilities
            WHERE county_fips = p_county_fips;

            IF v_reit_pct > 40 THEN
                v_adjustments := v_adjustments + v_factors.adj_reit_competition;
                v_risk_factors := array_append(v_risk_factors, 'High REIT presence (' || ROUND(v_reit_pct)::INT || '%)');
            ELSIF v_reit_pct < 15 THEN
                v_adjustments := v_adjustments + v_factors.adj_independent_market;
            END IF;

            -- Get promo activity
            SELECT COALESCE(pct_facilities_with_promos, 30) INTO v_promo_pct
            FROM market_rate_benchmarks
            WHERE geo_type = 'county' AND geo_id = p_county_fips
            ORDER BY benchmark_date DESC LIMIT 1;

            IF v_promo_pct > 50 THEN
                v_adjustments := v_adjustments + v_factors.adj_strong_promos;
            ELSIF v_promo_pct < 20 THEN
                v_adjustments := v_adjustments + v_factors.adj_weak_promos;
            END IF;

            -- Calculate final months with bounds
            v_final_months := GREATEST(
                v_factors.min_lease_up_months,
                LEAST(v_factors.max_lease_up_months, v_base_months + v_adjustments)
            );

            -- Calculate occupancy curve (S-curve approximation)
            v_m3_occ := v_factors.month_3_occupancy_pct * (24.0 / v_final_months);
            v_m6_occ := v_factors.month_6_occupancy_pct * (24.0 / v_final_months);
            v_m12_occ := LEAST(85, v_factors.month_12_occupancy_pct * (24.0 / v_final_months));
            v_m18_occ := LEAST(88, 60 + (v_factors.stabilized_occupancy_pct - 60) * (18.0 / v_final_months));
            v_m24_occ := LEAST(90, 70 + (v_factors.stabilized_occupancy_pct - 70) * (24.0 / v_final_months));
            v_m36_occ := v_factors.stabilized_occupancy_pct;

            -- Calculate cumulative vacancy loss (months of full rent lost)
            v_vacancy_loss := (
                (100 - v_m3_occ) / 100 * 3 +
                (100 - v_m6_occ) / 100 * 3 +
                (100 - v_m12_occ) / 100 * 6 +
                (100 - v_m18_occ) / 100 * 6 +
                (100 - (v_m18_occ + v_m24_occ) / 2) / 100 * 6
            );

            -- Determine confidence
            v_confidence := CASE
                WHEN v_market.geo_id IS NOT NULL AND v_analysis.geo_id IS NOT NULL THEN 'high'
                WHEN v_analysis.geo_id IS NOT NULL THEN 'medium'
                ELSE 'low'
            END;

            -- Determine risk level
            v_risk := CASE
                WHEN v_final_months <= 18 THEN 'low'
                WHEN v_final_months <= 30 THEN 'moderate'
                WHEN v_final_months <= 42 THEN 'high'
                ELSE 'very_high'
            END;

            IF v_saturation_cat = 'oversupplied' THEN
                v_risk_factors := array_append(v_risk_factors, 'Oversupplied market');
            END IF;
            IF v_trajectory = 'declining' THEN
                v_risk_factors := array_append(v_risk_factors, 'Declining market trajectory');
            END IF;

            -- Insert estimate
            INSERT INTO lease_up_estimates (
                county_fips, county_name, state,
                factor_set_id, estimation_date,
                saturation_sqft_per_cap, saturation_category, market_trajectory,
                housing_pipeline_units, has_housing_adjustment,
                catalyst_count, has_catalyst_adjustment,
                infrastructure_projects, has_infrastructure_adjustment,
                competitor_pipeline_count, has_competitor_adjustment,
                reit_market_share_pct, has_reit_adjustment,
                promo_activity, has_promo_adjustment,
                base_lease_up_months, total_adjustments, estimated_lease_up_months,
                lease_up_confidence,
                month_3_occupancy, month_6_occupancy, month_12_occupancy,
                month_18_occupancy, month_24_occupancy, month_36_occupancy,
                stabilized_occupancy,
                cumulative_vacancy_loss_months,
                effective_first_year_occupancy,
                effective_second_year_occupancy,
                effective_third_year_occupancy,
                lease_up_risk, risk_factors
            ) VALUES (
                p_county_fips, v_county.county_name, v_county.state,
                v_factors.id, CURRENT_DATE,
                COALESCE(v_market.current_sqft_per_cap, v_analysis.sqft_per_capita),
                v_saturation_cat, v_trajectory,
                v_housing_units, v_housing_units > 500,
                v_catalyst_count, v_catalyst_count > 0,
                v_infra_count, v_infra_count > 0,
                v_competitor_count, v_competitor_count > 0,
                v_reit_pct, v_reit_pct > 40 OR v_reit_pct < 15,
                CASE WHEN v_promo_pct > 50 THEN 'strong' WHEN v_promo_pct < 20 THEN 'weak' ELSE 'moderate' END,
                v_promo_pct > 50 OR v_promo_pct < 20,
                v_base_months, v_adjustments, v_final_months,
                v_confidence,
                ROUND(v_m3_occ::NUMERIC, 1), ROUND(v_m6_occ::NUMERIC, 1), ROUND(v_m12_occ::NUMERIC, 1),
                ROUND(v_m18_occ::NUMERIC, 1), ROUND(v_m24_occ::NUMERIC, 1), ROUND(v_m36_occ::NUMERIC, 1),
                v_factors.stabilized_occupancy_pct,
                ROUND(v_vacancy_loss::NUMERIC, 1),
                ROUND(((v_m3_occ * 3 + v_m6_occ * 3 + v_m12_occ * 6) / 12)::NUMERIC, 1),
                ROUND(((v_m12_occ * 6 + v_m18_occ * 6) / 12)::NUMERIC, 1),
                ROUND(((v_m24_occ * 6 + v_m36_occ * 6) / 12)::NUMERIC, 1),
                v_risk, v_risk_factors
            )
            ON CONFLICT (county_fips, factor_set_id, estimation_date) DO UPDATE SET
                saturation_sqft_per_cap = EXCLUDED.saturation_sqft_per_cap,
                saturation_category = EXCLUDED.saturation_category,
                market_trajectory = EXCLUDED.market_trajectory,
                base_lease_up_months = EXCLUDED.base_lease_up_months,
                total_adjustments = EXCLUDED.total_adjustments,
                estimated_lease_up_months = EXCLUDED.estimated_lease_up_months,
                lease_up_confidence = EXCLUDED.lease_up_confidence,
                month_3_occupancy = EXCLUDED.month_3_occupancy,
                month_6_occupancy = EXCLUDED.month_6_occupancy,
                month_12_occupancy = EXCLUDED.month_12_occupancy,
                month_18_occupancy = EXCLUDED.month_18_occupancy,
                month_24_occupancy = EXCLUDED.month_24_occupancy,
                month_36_occupancy = EXCLUDED.month_36_occupancy,
                cumulative_vacancy_loss_months = EXCLUDED.cumulative_vacancy_loss_months,
                lease_up_risk = EXCLUDED.lease_up_risk,
                risk_factors = EXCLUDED.risk_factors
            RETURNING id INTO v_estimate_id;

            RETURN v_final_months;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created estimate_lease_up_period function")


def create_generate_scenarios_function(cur):
    """Create function to generate lease-up scenarios."""
    print("Creating generate_lease_up_scenarios function...")

    cur.execute("DROP FUNCTION IF EXISTS generate_lease_up_scenarios(INT);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION generate_lease_up_scenarios(p_estimate_id INT)
        RETURNS VOID AS $func$
        DECLARE
            v_estimate lease_up_estimates%ROWTYPE;
            v_feasibility feasibility_analysis%ROWTYPE;
        BEGIN
            SELECT * INTO v_estimate
            FROM lease_up_estimates WHERE id = p_estimate_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Estimate ID % not found', p_estimate_id;
            END IF;

            -- Get feasibility data if available
            SELECT * INTO v_feasibility
            FROM feasibility_analysis
            WHERE county_fips = v_estimate.county_fips
            ORDER BY analysis_date DESC LIMIT 1;

            -- Delete existing scenarios
            DELETE FROM lease_up_scenarios WHERE lease_up_estimate_id = p_estimate_id;

            -- Base scenario
            INSERT INTO lease_up_scenarios (
                lease_up_estimate_id, scenario_name, scenario_type,
                scenario_lease_up_months, scenario_month_12_occupancy,
                scenario_stabilized_occupancy, scenario_vacancy_loss_months,
                noi_impact_year_1, noi_impact_year_2, noi_impact_year_3,
                notes
            ) VALUES (
                p_estimate_id, 'Base Case', 'base',
                v_estimate.estimated_lease_up_months,
                v_estimate.month_12_occupancy,
                v_estimate.stabilized_occupancy,
                v_estimate.cumulative_vacancy_loss_months,
                CASE WHEN v_feasibility.id IS NOT NULL
                     THEN ROUND(v_feasibility.stabilized_noi * v_estimate.effective_first_year_occupancy / 100)
                     ELSE NULL END,
                CASE WHEN v_feasibility.id IS NOT NULL
                     THEN ROUND(v_feasibility.stabilized_noi * v_estimate.effective_second_year_occupancy / 100)
                     ELSE NULL END,
                CASE WHEN v_feasibility.id IS NOT NULL
                     THEN ROUND(v_feasibility.stabilized_noi * v_estimate.effective_third_year_occupancy / 100)
                     ELSE NULL END,
                'Expected outcome based on current market conditions'
            );

            -- Optimistic scenario (6 months faster)
            INSERT INTO lease_up_scenarios (
                lease_up_estimate_id, scenario_name, scenario_type,
                additional_months, occupancy_multiplier,
                scenario_lease_up_months, scenario_month_12_occupancy,
                scenario_stabilized_occupancy, scenario_vacancy_loss_months,
                noi_impact_year_1, noi_impact_year_2,
                notes
            ) VALUES (
                p_estimate_id, 'Optimistic', 'optimistic',
                -6, 1.15,
                GREATEST(12, v_estimate.estimated_lease_up_months - 6),
                LEAST(85, v_estimate.month_12_occupancy * 1.15),
                v_estimate.stabilized_occupancy,
                v_estimate.cumulative_vacancy_loss_months * 0.7,
                CASE WHEN v_feasibility.id IS NOT NULL
                     THEN ROUND(v_feasibility.stabilized_noi * LEAST(85, v_estimate.effective_first_year_occupancy * 1.15) / 100)
                     ELSE NULL END,
                CASE WHEN v_feasibility.id IS NOT NULL
                     THEN ROUND(v_feasibility.stabilized_noi * LEAST(90, v_estimate.effective_second_year_occupancy * 1.1) / 100)
                     ELSE NULL END,
                'Better-than-expected lease-up due to strong demand or weak competition'
            );

            -- Pessimistic scenario (6 months slower)
            INSERT INTO lease_up_scenarios (
                lease_up_estimate_id, scenario_name, scenario_type,
                additional_months, occupancy_multiplier,
                scenario_lease_up_months, scenario_month_12_occupancy,
                scenario_stabilized_occupancy, scenario_vacancy_loss_months,
                noi_impact_year_1, noi_impact_year_2, noi_impact_year_3,
                notes
            ) VALUES (
                p_estimate_id, 'Pessimistic', 'pessimistic',
                6, 0.85,
                LEAST(60, v_estimate.estimated_lease_up_months + 6),
                v_estimate.month_12_occupancy * 0.85,
                v_estimate.stabilized_occupancy,
                v_estimate.cumulative_vacancy_loss_months * 1.4,
                CASE WHEN v_feasibility.id IS NOT NULL
                     THEN ROUND(v_feasibility.stabilized_noi * v_estimate.effective_first_year_occupancy * 0.85 / 100)
                     ELSE NULL END,
                CASE WHEN v_feasibility.id IS NOT NULL
                     THEN ROUND(v_feasibility.stabilized_noi * v_estimate.effective_second_year_occupancy * 0.9 / 100)
                     ELSE NULL END,
                CASE WHEN v_feasibility.id IS NOT NULL
                     THEN ROUND(v_feasibility.stabilized_noi * v_estimate.effective_third_year_occupancy * 0.95 / 100)
                     ELSE NULL END,
                'Slower lease-up due to new competition or softer demand'
            );

            -- Stress scenario (12 months slower, lower stabilization)
            INSERT INTO lease_up_scenarios (
                lease_up_estimate_id, scenario_name, scenario_type,
                additional_months, occupancy_multiplier,
                scenario_lease_up_months, scenario_month_12_occupancy,
                scenario_stabilized_occupancy, scenario_vacancy_loss_months,
                noi_impact_year_1, noi_impact_year_2, noi_impact_year_3,
                notes
            ) VALUES (
                p_estimate_id, 'Stress Test', 'stress',
                12, 0.70,
                LEAST(60, v_estimate.estimated_lease_up_months + 12),
                v_estimate.month_12_occupancy * 0.70,
                v_estimate.stabilized_occupancy - 5,
                v_estimate.cumulative_vacancy_loss_months * 2.0,
                CASE WHEN v_feasibility.id IS NOT NULL
                     THEN ROUND(v_feasibility.stabilized_noi * v_estimate.effective_first_year_occupancy * 0.70 / 100)
                     ELSE NULL END,
                CASE WHEN v_feasibility.id IS NOT NULL
                     THEN ROUND(v_feasibility.stabilized_noi * v_estimate.effective_second_year_occupancy * 0.80 / 100)
                     ELSE NULL END,
                CASE WHEN v_feasibility.id IS NOT NULL
                     THEN ROUND(v_feasibility.stabilized_noi * (v_estimate.stabilized_occupancy - 5) / 100)
                     ELSE NULL END,
                'Severe market downturn with multiple competitors opening'
            );
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created generate_lease_up_scenarios function")


def create_update_feasibility_function(cur):
    """Create function to update feasibility analysis with lease-up estimates."""
    print("Creating update_feasibility_lease_up function...")

    cur.execute("DROP FUNCTION IF EXISTS update_feasibility_lease_up(VARCHAR);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION update_feasibility_lease_up(p_county_fips VARCHAR(5))
        RETURNS VOID AS $func$
        DECLARE
            v_estimate lease_up_estimates%ROWTYPE;
        BEGIN
            -- Get latest lease-up estimate
            SELECT * INTO v_estimate
            FROM lease_up_estimates
            WHERE county_fips = p_county_fips
            ORDER BY estimation_date DESC LIMIT 1;

            IF NOT FOUND THEN
                RETURN;
            END IF;

            -- Update feasibility analysis with lease-up adjusted occupancies
            UPDATE feasibility_analysis SET
                y1_occupancy_pct = v_estimate.effective_first_year_occupancy,
                y2_occupancy_pct = v_estimate.effective_second_year_occupancy,
                y3_occupancy_pct = v_estimate.effective_third_year_occupancy
            WHERE county_fips = p_county_fips;

            -- Recalculate NOI based on new occupancies
            UPDATE feasibility_analysis SET
                y1_noi = ROUND(stabilized_noi * y1_occupancy_pct / 100),
                y2_noi = ROUND(stabilized_noi * y2_occupancy_pct / 100),
                y3_noi = ROUND(stabilized_noi * y3_occupancy_pct / 100),
                y1_yield_pct = ROUND((stabilized_noi * y1_occupancy_pct / 100.0 / NULLIF(total_investment, 0) * 100)::NUMERIC, 2),
                y2_yield_pct = ROUND((stabilized_noi * y2_occupancy_pct / 100.0 / NULLIF(total_investment, 0) * 100)::NUMERIC, 2),
                y3_yield_pct = ROUND((stabilized_noi * y3_occupancy_pct / 100.0 / NULLIF(total_investment, 0) * 100)::NUMERIC, 2)
            WHERE county_fips = p_county_fips;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created update_feasibility_lease_up function")


def create_lease_up_views(cur):
    """Create views for lease-up analysis."""
    print("Creating lease-up views...")

    # Summary view
    cur.execute("DROP VIEW IF EXISTS v_lease_up_summary CASCADE;")
    cur.execute("""
        CREATE OR REPLACE VIEW v_lease_up_summary AS
        SELECT
            lue.county_name,
            lue.state,
            lue.saturation_category,
            lue.market_trajectory,
            lue.estimated_lease_up_months as lease_up_months,
            lue.month_12_occupancy || '%' as year_1_occ,
            lue.stabilized_occupancy || '%' as stabilized_occ,
            lue.cumulative_vacancy_loss_months as vacancy_loss_months,
            lue.lease_up_risk as risk,
            lue.lease_up_confidence as confidence,
            lf.factor_set_name as factor_set,
            lue.estimation_date
        FROM lease_up_estimates lue
        JOIN lease_up_factors lf ON lue.factor_set_id = lf.id
        ORDER BY lue.estimated_lease_up_months;
    """)

    # Detailed comparison view
    cur.execute("DROP VIEW IF EXISTS v_lease_up_comparison CASCADE;")
    cur.execute("""
        CREATE OR REPLACE VIEW v_lease_up_comparison AS
        SELECT
            lue.county_fips,
            lue.county_name,
            lue.state,
            lue.saturation_category || '/' || lue.market_trajectory as market_condition,
            lue.base_lease_up_months as base_months,
            lue.total_adjustments as adjustments,
            lue.estimated_lease_up_months as final_months,
            CASE
                WHEN lue.has_housing_adjustment THEN '+Housing'
                ELSE ''
            END ||
            CASE
                WHEN lue.has_catalyst_adjustment THEN '+Catalyst'
                ELSE ''
            END ||
            CASE
                WHEN lue.has_competitor_adjustment THEN '+Competition'
                ELSE ''
            END as adjustment_factors,
            lue.month_6_occupancy || '% -> ' ||
            lue.month_12_occupancy || '% -> ' ||
            lue.month_24_occupancy || '%' as occupancy_curve,
            lue.lease_up_risk,
            array_to_string(lue.risk_factors, ', ') as risk_factors
        FROM lease_up_estimates lue
        WHERE lue.estimation_date = (
            SELECT MAX(estimation_date) FROM lease_up_estimates le2
            WHERE le2.county_fips = lue.county_fips
        )
        ORDER BY lue.estimated_lease_up_months;
    """)

    # Scenarios comparison view
    cur.execute("DROP VIEW IF EXISTS v_lease_up_scenarios CASCADE;")
    cur.execute("""
        CREATE OR REPLACE VIEW v_lease_up_scenarios AS
        SELECT
            lue.county_name,
            lue.state,
            lus.scenario_name,
            lus.scenario_type,
            lus.scenario_lease_up_months as months,
            lus.scenario_month_12_occupancy || '%' as y1_occ,
            lus.scenario_stabilized_occupancy || '%' as stabilized,
            '$' || COALESCE(lus.noi_impact_year_1::TEXT, 'N/A') as y1_noi,
            '$' || COALESCE(lus.noi_impact_year_2::TEXT, 'N/A') as y2_noi,
            '$' || COALESCE(lus.noi_impact_year_3::TEXT, 'N/A') as y3_noi,
            lus.notes
        FROM lease_up_scenarios lus
        JOIN lease_up_estimates lue ON lus.lease_up_estimate_id = lue.id
        ORDER BY lue.county_name, lus.scenario_type;
    """)

    print("  Created 3 lease-up views")


def run_lease_up_tests(cur):
    """Test the lease-up estimation system."""
    print("\n" + "="*60)
    print("TESTING LEASE-UP ESTIMATION SYSTEM")
    print("="*60)

    # Test counties
    test_counties = [
        ('54003', 'Berkeley'),
        ('54037', 'Jefferson'),
        ('54065', 'Morgan')
    ]

    print("\n--- Generating Lease-Up Estimates ---")
    for county_fips, county_name in test_counties:
        try:
            cur.execute("SELECT estimate_lease_up_period(%s, 'default');", (county_fips,))
            months = cur.fetchone()[0]
            print(f"  {county_name}: {months} months to stabilization")

            # Generate scenarios
            cur.execute("""
                SELECT id FROM lease_up_estimates
                WHERE county_fips = %s
                ORDER BY estimation_date DESC LIMIT 1;
            """, (county_fips,))
            estimate_id = cur.fetchone()[0]
            cur.execute("SELECT generate_lease_up_scenarios(%s);", (estimate_id,))

            # Update feasibility
            cur.execute("SELECT update_feasibility_lease_up(%s);", (county_fips,))

        except Exception as e:
            print(f"  {county_name}: Error - {str(e)[:50]}")

    # Show summary
    print("\n--- Lease-Up Summary ---")
    cur.execute("SELECT * FROM v_lease_up_summary;")
    results = cur.fetchall()
    if results:
        print(f"{'County':<15} {'Saturation':<12} {'Trajectory':<12} {'Months':<8} {'Y1 Occ':<10} {'Risk':<10}")
        print("-" * 70)
        for row in results:
            print(f"{row[0][:14]:<15} {row[2]:<12} {row[3]:<12} {row[4]:<8} {row[5]:<10} {row[8]:<10}")

    # Show scenarios for first county
    print("\n--- Scenario Analysis (Berkeley) ---")
    cur.execute("""
        SELECT scenario_name, scenario_type, scenario_lease_up_months,
               scenario_month_12_occupancy, noi_impact_year_1
        FROM v_lease_up_scenarios
        WHERE county_name = 'Berkeley'
        ORDER BY scenario_type;
    """)
    scenarios = cur.fetchall()
    if scenarios:
        print(f"{'Scenario':<15} {'Type':<12} {'Months':<8} {'Y1 Occ':<10} {'Y1 NOI':<12}")
        print("-" * 60)
        for row in scenarios:
            y1_occ = f"{row[3]}%" if row[3] else 'N/A'
            y1_noi = f"${row[4]:,}" if row[4] else 'N/A'
            print(f"{row[0]:<15} {row[1]:<12} {row[2]:<8} {y1_occ:<10} {y1_noi:<12}")


def main():
    print("="*60)
    print("PROMPT 22: LEASE-UP PERIOD ESTIMATION")
    print("="*60)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # Create tables
        create_lease_up_factors_table(cur)
        create_lease_up_estimates_table(cur)
        create_lease_up_scenarios_table(cur)
        conn.commit()

        # Create functions
        create_estimate_lease_up_function(cur)
        create_generate_scenarios_function(cur)
        create_update_feasibility_function(cur)
        conn.commit()

        # Create views
        create_lease_up_views(cur)
        conn.commit()

        # Run tests
        run_lease_up_tests(cur)
        conn.commit()

        # Final summary
        cur.execute("SELECT COUNT(*) FROM lease_up_factors;")
        factor_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM lease_up_estimates;")
        estimate_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM lease_up_scenarios;")
        scenario_count = cur.fetchone()[0]

        print("\n" + "="*60)
        print("LEASE-UP ESTIMATION COMPLETE")
        print("="*60)
        print(f"""
Created:
  - lease_up_factors table ({factor_count} factor sets)
  - lease_up_estimates table ({estimate_count} estimates)
  - lease_up_scenarios table ({scenario_count} scenarios)
  - estimate_lease_up_period() function
  - generate_lease_up_scenarios() function
  - update_feasibility_lease_up() function
  - 3 lease-up views
""")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
