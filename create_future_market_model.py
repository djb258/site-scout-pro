"""
Prompt 15: Future State Market Model
Projects supply/demand trajectory using pipeline data and leading indicators.
"""
import psycopg2

CONNECTION_STRING = 'postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'


def create_storage_pipeline_table(cur):
    """Create storage pipeline table for tracking planned facilities."""
    print('Creating storage_pipeline table...')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS storage_pipeline (
            id SERIAL PRIMARY KEY,

            -- Location
            state VARCHAR(2) NOT NULL,
            county_fips VARCHAR(5) NOT NULL,
            county_name VARCHAR(100),
            city VARCHAR(100),
            zip VARCHAR(10),
            address VARCHAR(300),
            lat DECIMAL,
            lon DECIMAL,
            parcel_id VARCHAR(50),

            -- Project identification
            project_name VARCHAR(200) NOT NULL,
            developer VARCHAR(200),
            brand VARCHAR(100),
            brand_type VARCHAR(50),

            -- Status
            status VARCHAR(20) NOT NULL,
            status_date DATE,

            -- Facility specs
            planned_sqft INT,
            planned_units INT,
            stories INT,
            facility_type VARCHAR(50),
            climate_pct INT,

            -- Timeline
            announcement_date DATE,
            approval_date DATE,
            construction_start_date DATE,
            expected_open_date DATE,
            actual_open_date DATE,

            -- Permit linkage
            permit_number VARCHAR(100),
            permit_id INT,

            -- Impact assessment
            market_impact VARCHAR(20),
            absorption_months INT,

            -- Source
            source VARCHAR(100),
            source_url VARCHAR(500),
            verified BOOLEAN DEFAULT FALSE,
            verified_date DATE,
            notes TEXT,

            -- Metadata
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(state, county_fips, project_name)
        )
    ''')

    cur.execute('CREATE INDEX IF NOT EXISTS idx_sp_county ON storage_pipeline(county_fips)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_sp_status ON storage_pipeline(status)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_sp_open_date ON storage_pipeline(expected_open_date)')

    print('  [OK] storage_pipeline table created')


def create_population_projections_table(cur):
    """Create population projections table."""
    print('Creating population_projections table...')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS population_projections (
            id SERIAL PRIMARY KEY,

            -- Geography
            geo_type VARCHAR(20) NOT NULL,
            geo_id VARCHAR(20) NOT NULL,
            geo_name VARCHAR(100),
            state VARCHAR(2),

            -- Base year
            base_year INT NOT NULL,
            base_population INT,
            base_households INT,

            -- Projections
            year_1_population INT,
            year_1_households INT,
            year_2_population INT,
            year_2_households INT,
            year_3_population INT,
            year_3_households INT,
            year_5_population INT,
            year_5_households INT,

            -- Growth rates
            annual_pop_growth_rate DECIMAL,
            annual_hh_growth_rate DECIMAL,

            -- Growth classification
            growth_tier VARCHAR(20),

            -- Source
            data_source VARCHAR(100),
            projection_date DATE,

            -- Metadata
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(geo_type, geo_id, base_year)
        )
    ''')

    cur.execute('CREATE INDEX IF NOT EXISTS idx_pp_geo ON population_projections(geo_type, geo_id)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_pp_growth ON population_projections(growth_tier)')

    print('  [OK] population_projections table created')


def create_market_projections_table(cur):
    """Create market projections table."""
    print('Creating market_projections table...')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS market_projections (
            id SERIAL PRIMARY KEY,

            -- Geography
            geo_type VARCHAR(20) NOT NULL,
            geo_id VARCHAR(20) NOT NULL,
            geo_name VARCHAR(100),
            state VARCHAR(2),
            projection_date DATE DEFAULT CURRENT_DATE,

            -- CURRENT STATE
            current_population INT,
            current_households INT,
            current_supply_sqft INT,
            current_sqft_per_capita DECIMAL,
            current_saturation VARCHAR(20),
            current_health_score INT,

            -- PIPELINE: HOUSING DEMAND
            pipeline_permitted_units INT,
            pipeline_site_work_units INT,
            pipeline_vertical_units INT,
            pipeline_total_units INT,

            -- Demand timing
            units_delivering_0_6mo INT,
            units_delivering_6_12mo INT,
            units_delivering_12_24mo INT,

            -- Demand impact
            pipeline_demand_sqft INT,

            -- PIPELINE: STORAGE SUPPLY
            storage_pipeline_sqft INT,
            storage_pipeline_projects INT,
            storage_opening_0_12mo_sqft INT,
            storage_opening_12_24mo_sqft INT,

            -- YEAR 1 PROJECTION
            y1_population INT,
            y1_households INT,
            y1_demand_sqft INT,
            y1_supply_sqft INT,
            y1_sqft_per_capita DECIMAL,
            y1_saturation VARCHAR(20),
            y1_net_absorption INT,

            -- YEAR 2 PROJECTION
            y2_population INT,
            y2_households INT,
            y2_demand_sqft INT,
            y2_supply_sqft INT,
            y2_sqft_per_capita DECIMAL,
            y2_saturation VARCHAR(20),

            -- YEAR 3 PROJECTION
            y3_population INT,
            y3_households INT,
            y3_demand_sqft INT,
            y3_supply_sqft INT,
            y3_sqft_per_capita DECIMAL,
            y3_saturation VARCHAR(20),

            -- TRAJECTORY
            trajectory VARCHAR(20),
            trajectory_score INT,

            -- TIMING ANALYSIS
            demand_velocity VARCHAR(20),
            supply_velocity VARCHAR(20),
            supply_demand_gap INT,

            -- OPPORTUNITY WINDOW
            window_status VARCHAR(20),
            window_months INT,
            optimal_entry_timing VARCHAR(50),

            -- RISK ASSESSMENT
            demand_risk VARCHAR(20),
            supply_risk VARCHAR(20),
            timing_risk VARCHAR(20),
            overall_risk VARCHAR(20),

            -- COMPOSITE SCORES
            opportunity_score INT,
            confidence_score INT,

            -- RECOMMENDATION
            recommendation VARCHAR(20),
            recommendation_rationale TEXT,

            -- Key insights
            primary_catalyst TEXT,
            primary_headwind TEXT,

            -- Metadata
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(geo_type, geo_id, projection_date)
        )
    ''')

    cur.execute('CREATE INDEX IF NOT EXISTS idx_mp_geo ON market_projections(geo_type, geo_id)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_mp_trajectory ON market_projections(trajectory)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_mp_recommendation ON market_projections(recommendation)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_mp_opportunity ON market_projections(opportunity_score)')

    print('  [OK] market_projections table created')


def create_housing_pipeline_summary_function(cur):
    """Create function to aggregate housing pipeline by county."""
    print('Creating get_housing_pipeline_summary function...')

    cur.execute('''
        CREATE OR REPLACE FUNCTION get_housing_pipeline_summary(p_county_fips VARCHAR(5))
        RETURNS TABLE(
            permitted_units INT,
            site_work_units INT,
            vertical_units INT,
            total_units INT,
            total_demand_sqft INT,
            units_0_6mo INT,
            units_6_12mo INT,
            units_12_24mo INT
        ) AS $func$
        BEGIN
            RETURN QUERY
            SELECT
                COALESCE(SUM(CASE WHEN status = 'permitted' OR status = 'green' THEN unit_count ELSE 0 END), 0)::INT as permitted_units,
                COALESCE(SUM(CASE WHEN status = 'site_work' OR status = 'yellow' THEN unit_count ELSE 0 END), 0)::INT as site_work_units,
                COALESCE(SUM(CASE WHEN status = 'vertical' OR status = 'red' THEN unit_count ELSE 0 END), 0)::INT as vertical_units,
                COALESCE(SUM(unit_count), 0)::INT as total_units,
                COALESCE(SUM(unit_count * 6), 0)::INT as total_demand_sqft,
                -- Timing based on status
                COALESCE(SUM(CASE WHEN status IN ('vertical', 'red') THEN unit_count ELSE 0 END), 0)::INT as units_0_6mo,
                COALESCE(SUM(CASE WHEN status IN ('site_work', 'yellow') THEN unit_count ELSE 0 END), 0)::INT as units_6_12mo,
                COALESCE(SUM(CASE WHEN status IN ('permitted', 'green') THEN unit_count ELSE 0 END), 0)::INT as units_12_24mo
            FROM housing_pipeline
            WHERE county_fips = p_county_fips
            AND status NOT IN ('existing', 'black', 'completed');
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] get_housing_pipeline_summary function created')


def create_storage_pipeline_summary_function(cur):
    """Create function to aggregate storage pipeline by county."""
    print('Creating get_storage_pipeline_summary function...')

    cur.execute('''
        CREATE OR REPLACE FUNCTION get_storage_pipeline_summary(p_county_fips VARCHAR(5))
        RETURNS TABLE(
            pipeline_projects INT,
            pipeline_sqft INT,
            opening_0_12mo_sqft INT,
            opening_12_24mo_sqft INT
        ) AS $func$
        BEGIN
            RETURN QUERY
            SELECT
                COUNT(*)::INT as pipeline_projects,
                COALESCE(SUM(planned_sqft), 0)::INT as pipeline_sqft,
                COALESCE(SUM(CASE
                    WHEN expected_open_date <= CURRENT_DATE + INTERVAL '12 months'
                    THEN planned_sqft ELSE 0
                END), 0)::INT as opening_0_12mo_sqft,
                COALESCE(SUM(CASE
                    WHEN expected_open_date > CURRENT_DATE + INTERVAL '12 months'
                    AND expected_open_date <= CURRENT_DATE + INTERVAL '24 months'
                    THEN planned_sqft ELSE 0
                END), 0)::INT as opening_12_24mo_sqft
            FROM storage_pipeline
            WHERE county_fips = p_county_fips
            AND status NOT IN ('opened', 'cancelled');
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] get_storage_pipeline_summary function created')


def create_project_market_function(cur):
    """Create the main market projection function."""
    print('Creating project_market function...')

    cur.execute('''
        CREATE OR REPLACE FUNCTION project_market(
            p_geo_type VARCHAR(20),
            p_geo_id VARCHAR(20),
            p_geo_name VARCHAR(100) DEFAULT NULL,
            p_state VARCHAR(2) DEFAULT NULL
        )
        RETURNS INT AS $func$
        DECLARE
            v_current market_analysis%ROWTYPE;
            v_projections population_projections%ROWTYPE;
            v_housing RECORD;
            v_storage RECORD;

            -- Calculated values
            v_y1_pop INT;
            v_y1_hh INT;
            v_y1_demand INT;
            v_y1_supply INT;
            v_y1_sqft_cap DECIMAL;
            v_y1_saturation VARCHAR(20);

            v_y2_pop INT;
            v_y2_demand INT;
            v_y2_supply INT;
            v_y2_sqft_cap DECIMAL;
            v_y2_saturation VARCHAR(20);

            v_y3_pop INT;
            v_y3_demand INT;
            v_y3_supply INT;
            v_y3_sqft_cap DECIMAL;
            v_y3_saturation VARCHAR(20);

            v_trajectory VARCHAR(20);
            v_trajectory_score INT;
            v_supply_demand_gap INT;
            v_opportunity_score INT;
            v_confidence INT;
            v_recommendation VARCHAR(20);
            v_rationale TEXT;
            v_catalyst TEXT;
            v_headwind TEXT;
            v_window_status VARCHAR(20);
            v_window_months INT;
            v_demand_risk VARCHAR(20);
            v_supply_risk VARCHAR(20);
            v_timing_risk VARCHAR(20);
            v_overall_risk VARCHAR(20);
            v_demand_velocity VARCHAR(20);
            v_supply_velocity VARCHAR(20);

            v_projection_id INT;
            v_growth_rate DECIMAL;
        BEGIN
            -- Get current market analysis
            SELECT * INTO v_current
            FROM market_analysis
            WHERE geo_type = p_geo_type AND geo_id = p_geo_id
            ORDER BY analysis_date DESC
            LIMIT 1;

            IF NOT FOUND THEN
                -- Run current analysis first
                PERFORM analyze_market(p_geo_type, p_geo_id, p_geo_name, p_state);
                SELECT * INTO v_current
                FROM market_analysis
                WHERE geo_type = p_geo_type AND geo_id = p_geo_id
                ORDER BY analysis_date DESC
                LIMIT 1;
            END IF;

            -- Get population projections
            SELECT * INTO v_projections
            FROM population_projections
            WHERE geo_type = p_geo_type AND geo_id = p_geo_id
            ORDER BY base_year DESC
            LIMIT 1;

            -- Default growth rate if no projections
            v_growth_rate := COALESCE(v_projections.annual_pop_growth_rate, 0.01);

            -- Get housing pipeline
            SELECT * INTO v_housing FROM get_housing_pipeline_summary(p_geo_id);

            -- Get storage pipeline
            SELECT * INTO v_storage FROM get_storage_pipeline_summary(p_geo_id);

            -- YEAR 1 PROJECTIONS
            v_y1_pop := COALESCE(v_projections.year_1_population,
                                 (v_current.population * (1 + v_growth_rate))::INT);
            v_y1_hh := COALESCE(v_projections.year_1_households,
                                (v_current.households * (1 + v_growth_rate))::INT);

            -- Y1 Demand = base demand growth + pipeline demand (vertical units deliver)
            v_y1_demand := (COALESCE(v_current.adjusted_demand_sqft, v_current.population * 7) * (1 + v_growth_rate))::INT
                           + COALESCE(v_housing.units_0_6mo, 0) * 6;

            -- Y1 Supply = current + storage pipeline opening in 12mo
            v_y1_supply := COALESCE(v_current.total_supply_sqft, 0) + COALESCE(v_storage.opening_0_12mo_sqft, 0);

            v_y1_sqft_cap := CASE WHEN v_y1_pop > 0 THEN ROUND(v_y1_supply::DECIMAL / v_y1_pop, 2) ELSE 0 END;
            v_y1_saturation := CASE
                WHEN v_y1_sqft_cap < 4 THEN 'undersupplied'
                WHEN v_y1_sqft_cap < 7 THEN 'balanced'
                WHEN v_y1_sqft_cap < 10 THEN 'oversupplied'
                ELSE 'saturated'
            END;

            -- YEAR 2 PROJECTIONS
            v_y2_pop := COALESCE(v_projections.year_2_population,
                                 (v_current.population * POWER(1 + v_growth_rate, 2))::INT);
            v_y2_demand := (COALESCE(v_current.adjusted_demand_sqft, v_current.population * 7) * POWER(1 + v_growth_rate, 2))::INT
                           + COALESCE(v_housing.units_0_6mo, 0) * 6
                           + COALESCE(v_housing.units_6_12mo, 0) * 6;
            v_y2_supply := COALESCE(v_current.total_supply_sqft, 0)
                           + COALESCE(v_storage.opening_0_12mo_sqft, 0)
                           + COALESCE(v_storage.opening_12_24mo_sqft, 0);
            v_y2_sqft_cap := CASE WHEN v_y2_pop > 0 THEN ROUND(v_y2_supply::DECIMAL / v_y2_pop, 2) ELSE 0 END;
            v_y2_saturation := CASE
                WHEN v_y2_sqft_cap < 4 THEN 'undersupplied'
                WHEN v_y2_sqft_cap < 7 THEN 'balanced'
                WHEN v_y2_sqft_cap < 10 THEN 'oversupplied'
                ELSE 'saturated'
            END;

            -- YEAR 3 PROJECTIONS
            v_y3_pop := COALESCE(v_projections.year_3_population,
                                 (v_current.population * POWER(1 + v_growth_rate, 3))::INT);
            v_y3_demand := (COALESCE(v_current.adjusted_demand_sqft, v_current.population * 7) * POWER(1 + v_growth_rate, 3))::INT
                           + COALESCE(v_housing.total_units, 0) * 6;
            v_y3_supply := COALESCE(v_current.total_supply_sqft, 0) + COALESCE(v_storage.pipeline_sqft, 0);
            v_y3_sqft_cap := CASE WHEN v_y3_pop > 0 THEN ROUND(v_y3_supply::DECIMAL / v_y3_pop, 2) ELSE 0 END;
            v_y3_saturation := CASE
                WHEN v_y3_sqft_cap < 4 THEN 'undersupplied'
                WHEN v_y3_sqft_cap < 7 THEN 'balanced'
                WHEN v_y3_sqft_cap < 10 THEN 'oversupplied'
                ELSE 'saturated'
            END;

            -- TRAJECTORY ANALYSIS
            v_trajectory_score := ((COALESCE(v_current.sqft_per_capita, 0) - v_y3_sqft_cap) * 10)::INT;
            v_trajectory := CASE
                WHEN v_trajectory_score > 10 THEN 'improving'
                WHEN v_trajectory_score > -10 THEN 'stable'
                ELSE 'deteriorating'
            END;

            -- VELOCITY ANALYSIS
            v_demand_velocity := CASE
                WHEN COALESCE(v_housing.vertical_units, 0) > COALESCE(v_housing.permitted_units, 0) THEN 'accelerating'
                WHEN COALESCE(v_housing.total_units, 0) > 500 THEN 'steady'
                ELSE 'slowing'
            END;

            v_supply_velocity := CASE
                WHEN COALESCE(v_storage.opening_0_12mo_sqft, 0) > COALESCE(v_storage.opening_12_24mo_sqft, 0) THEN 'accelerating'
                WHEN COALESCE(v_storage.pipeline_sqft, 0) > 0 THEN 'steady'
                ELSE 'slowing'
            END;

            -- SUPPLY/DEMAND GAP
            v_supply_demand_gap := COALESCE(v_housing.total_demand_sqft, 0) - COALESCE(v_storage.pipeline_sqft, 0);

            -- OPPORTUNITY WINDOW
            IF v_current.saturation_level = 'undersupplied' AND v_supply_demand_gap > 0 THEN
                v_window_status := 'open';
                v_window_months := GREATEST(12, 36 - (COALESCE(v_storage.pipeline_projects, 0) * 6));
            ELSIF v_current.saturation_level = 'balanced' AND v_supply_demand_gap > 50000 THEN
                v_window_status := 'opening';
                v_window_months := 18;
            ELSIF v_trajectory = 'deteriorating' THEN
                v_window_status := 'closing';
                v_window_months := 6;
            ELSE
                v_window_status := 'closed';
                v_window_months := 0;
            END IF;

            -- RISK ASSESSMENT
            v_demand_risk := CASE
                WHEN COALESCE(v_housing.total_units, 0) > 1000 THEN 'low'
                WHEN COALESCE(v_housing.total_units, 0) > 300 THEN 'medium'
                ELSE 'high'
            END;

            v_supply_risk := CASE
                WHEN COALESCE(v_storage.pipeline_sqft, 0) = 0 THEN 'low'
                WHEN COALESCE(v_storage.pipeline_sqft, 0) < 50000 THEN 'medium'
                ELSE 'high'
            END;

            v_timing_risk := CASE
                WHEN v_window_status = 'open' THEN 'low'
                WHEN v_window_status = 'opening' THEN 'medium'
                ELSE 'high'
            END;

            v_overall_risk := CASE
                WHEN v_demand_risk = 'high' OR v_supply_risk = 'high' OR v_timing_risk = 'high' THEN 'high'
                WHEN v_demand_risk = 'medium' OR v_supply_risk = 'medium' THEN 'medium'
                ELSE 'low'
            END;

            -- OPPORTUNITY SCORE
            v_opportunity_score := 50;

            -- Saturation bonus/penalty
            v_opportunity_score := v_opportunity_score + CASE v_current.saturation_level
                WHEN 'undersupplied' THEN 25
                WHEN 'balanced' THEN 10
                WHEN 'oversupplied' THEN -15
                WHEN 'saturated' THEN -30
                ELSE 0
            END;

            -- Pipeline demand bonus
            IF COALESCE(v_housing.vertical_units, 0) > 200 THEN
                v_opportunity_score := v_opportunity_score + 15;
            ELSIF COALESCE(v_housing.total_units, 0) > 500 THEN
                v_opportunity_score := v_opportunity_score + 10;
            END IF;

            -- Supply competition penalty
            IF COALESCE(v_storage.pipeline_sqft, 0) > 100000 THEN
                v_opportunity_score := v_opportunity_score - 20;
            ELSIF COALESCE(v_storage.pipeline_sqft, 0) > 50000 THEN
                v_opportunity_score := v_opportunity_score - 10;
            END IF;

            -- Trajectory bonus/penalty
            v_opportunity_score := v_opportunity_score + (v_trajectory_score / 2)::INT;

            v_opportunity_score := LEAST(GREATEST(v_opportunity_score, 0), 100);

            -- CONFIDENCE SCORE
            v_confidence := 50;
            IF v_projections.id IS NOT NULL THEN v_confidence := v_confidence + 15; END IF;
            IF COALESCE(v_housing.total_units, 0) > 0 THEN v_confidence := v_confidence + 15; END IF;
            IF v_current.avg_rent_10x10 IS NOT NULL THEN v_confidence := v_confidence + 10; END IF;
            IF v_current.facility_count > 3 THEN v_confidence := v_confidence + 10; END IF;

            -- RECOMMENDATION
            v_recommendation := CASE
                WHEN v_opportunity_score >= 75 AND v_overall_risk != 'high' THEN 'strong_pursue'
                WHEN v_opportunity_score >= 55 AND v_overall_risk != 'high' THEN 'pursue'
                WHEN v_opportunity_score >= 35 THEN 'monitor'
                ELSE 'avoid'
            END;

            -- RATIONALE
            v_rationale := 'Current: ' || v_current.saturation_level ||
                ' (' || ROUND(COALESCE(v_current.sqft_per_capita, 0)::NUMERIC, 1) || ' sq ft/cap). ' ||
                'Y3 projection: ' || v_y3_saturation ||
                ' (' || ROUND(v_y3_sqft_cap::NUMERIC, 1) || ' sq ft/cap). ' ||
                'Pipeline: ' || COALESCE(v_housing.total_units, 0) || ' housing units, ' ||
                COALESCE(v_storage.pipeline_sqft, 0) || ' storage sq ft. ' ||
                CASE v_trajectory
                    WHEN 'improving' THEN 'Market improving as demand outpaces supply.'
                    WHEN 'stable' THEN 'Market stable with balanced growth.'
                    ELSE 'Caution: new supply may outpace demand.'
                END;

            -- CATALYST
            v_catalyst := CASE
                WHEN COALESCE(v_housing.vertical_units, 0) > 200 THEN
                    v_housing.vertical_units || ' units in vertical construction - demand imminent'
                WHEN COALESCE(v_housing.total_units, 0) > 500 THEN
                    v_housing.total_units || ' total pipeline units driving future demand'
                WHEN v_current.saturation_level = 'undersupplied' THEN
                    'Market undersupplied with limited competition'
                WHEN v_growth_rate > 0.02 THEN
                    'Strong population growth (' || ROUND((v_growth_rate * 100)::NUMERIC, 1) || '% annually)'
                ELSE
                    'Moderate organic demand growth'
            END;

            -- HEADWIND
            v_headwind := CASE
                WHEN COALESCE(v_storage.pipeline_sqft, 0) > 100000 THEN
                    v_storage.pipeline_sqft || ' sq ft of new storage supply in pipeline'
                WHEN v_current.saturation_level IN ('oversupplied', 'saturated') THEN
                    'Market already at or above saturation levels'
                WHEN v_current.avg_rent_10x10 < 70 THEN
                    'Weak rental rates indicate soft demand'
                WHEN COALESCE(v_housing.total_units, 0) < 100 THEN
                    'Limited housing pipeline to drive demand growth'
                ELSE
                    'Standard market competition'
            END;

            -- INSERT PROJECTION
            INSERT INTO market_projections (
                geo_type, geo_id, geo_name, state, projection_date,
                current_population, current_households, current_supply_sqft,
                current_sqft_per_capita, current_saturation, current_health_score,
                pipeline_permitted_units, pipeline_site_work_units, pipeline_vertical_units, pipeline_total_units,
                units_delivering_0_6mo, units_delivering_6_12mo, units_delivering_12_24mo,
                pipeline_demand_sqft,
                storage_pipeline_sqft, storage_pipeline_projects,
                storage_opening_0_12mo_sqft, storage_opening_12_24mo_sqft,
                y1_population, y1_households, y1_demand_sqft, y1_supply_sqft, y1_sqft_per_capita, y1_saturation, y1_net_absorption,
                y2_population, y2_demand_sqft, y2_supply_sqft, y2_sqft_per_capita, y2_saturation,
                y3_population, y3_demand_sqft, y3_supply_sqft, y3_sqft_per_capita, y3_saturation,
                trajectory, trajectory_score,
                demand_velocity, supply_velocity, supply_demand_gap,
                window_status, window_months, optimal_entry_timing,
                demand_risk, supply_risk, timing_risk, overall_risk,
                opportunity_score, confidence_score,
                recommendation, recommendation_rationale,
                primary_catalyst, primary_headwind
            ) VALUES (
                p_geo_type, p_geo_id, p_geo_name, p_state, CURRENT_DATE,
                v_current.population, v_current.households, v_current.total_supply_sqft,
                v_current.sqft_per_capita, v_current.saturation_level, v_current.market_health_score,
                v_housing.permitted_units, v_housing.site_work_units, v_housing.vertical_units, v_housing.total_units,
                v_housing.units_0_6mo, v_housing.units_6_12mo, v_housing.units_12_24mo,
                v_housing.total_demand_sqft,
                v_storage.pipeline_sqft, v_storage.pipeline_projects,
                v_storage.opening_0_12mo_sqft, v_storage.opening_12_24mo_sqft,
                v_y1_pop, v_y1_hh, v_y1_demand, v_y1_supply, v_y1_sqft_cap, v_y1_saturation, v_y1_demand - v_y1_supply,
                v_y2_pop, v_y2_demand, v_y2_supply, v_y2_sqft_cap, v_y2_saturation,
                v_y3_pop, v_y3_demand, v_y3_supply, v_y3_sqft_cap, v_y3_saturation,
                v_trajectory, v_trajectory_score,
                v_demand_velocity, v_supply_velocity, v_supply_demand_gap,
                v_window_status, v_window_months,
                CASE
                    WHEN v_window_status = 'open' AND v_overall_risk = 'low' THEN 'immediate'
                    WHEN v_window_status = 'open' THEN '6_months'
                    WHEN v_window_status = 'opening' THEN '12_months'
                    ELSE 'wait'
                END,
                v_demand_risk, v_supply_risk, v_timing_risk, v_overall_risk,
                v_opportunity_score, v_confidence,
                v_recommendation, v_rationale,
                v_catalyst, v_headwind
            )
            ON CONFLICT (geo_type, geo_id, projection_date) DO UPDATE SET
                current_population = EXCLUDED.current_population,
                pipeline_total_units = EXCLUDED.pipeline_total_units,
                opportunity_score = EXCLUDED.opportunity_score,
                recommendation = EXCLUDED.recommendation,
                recommendation_rationale = EXCLUDED.recommendation_rationale,
                trajectory = EXCLUDED.trajectory,
                y3_saturation = EXCLUDED.y3_saturation
            RETURNING id INTO v_projection_id;

            RETURN v_projection_id;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] project_market function created')


def create_project_all_markets_function(cur):
    """Create batch projection function."""
    print('Creating project_all_markets function...')

    cur.execute('''
        CREATE OR REPLACE FUNCTION project_all_markets()
        RETURNS TABLE(
            geo_id VARCHAR(20),
            geo_name VARCHAR(100),
            current_saturation VARCHAR(20),
            y3_saturation VARCHAR(20),
            trajectory VARCHAR(20),
            opportunity_score INT,
            recommendation VARCHAR(20)
        ) AS $func$
        DECLARE
            v_county RECORD;
            v_projection_id INT;
        BEGIN
            FOR v_county IN
                SELECT DISTINCT county_fips, county_name, state
                FROM jurisdiction_cards
                ORDER BY state, county_name
            LOOP
                v_projection_id := project_market('county', v_county.county_fips, v_county.county_name, v_county.state);

                RETURN QUERY
                SELECT
                    v_county.county_fips::VARCHAR(20),
                    v_county.county_name::VARCHAR(100),
                    mp.current_saturation::VARCHAR(20),
                    mp.y3_saturation::VARCHAR(20),
                    mp.trajectory::VARCHAR(20),
                    mp.opportunity_score,
                    mp.recommendation::VARCHAR(20)
                FROM market_projections mp
                WHERE mp.id = v_projection_id;
            END LOOP;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] project_all_markets function created')


def create_views(cur):
    """Create projection views."""
    print('Creating views...')

    # Drop existing views
    views_to_drop = [
        'v_market_trajectory',
        'v_pipeline_impact',
        'v_opportunity_ranking',
        'v_risk_matrix'
    ]
    for view in views_to_drop:
        cur.execute(f'DROP VIEW IF EXISTS {view}')

    # Market trajectory dashboard
    cur.execute('''
        CREATE VIEW v_market_trajectory AS
        SELECT
            state,
            geo_name as county,
            -- Current state
            current_sqft_per_capita as current_sqft_cap,
            current_saturation,
            CASE current_saturation
                WHEN 'undersupplied' THEN '[GREEN]'
                WHEN 'balanced' THEN '[YELLOW]'
                WHEN 'oversupplied' THEN '[ORANGE]'
                WHEN 'saturated' THEN '[RED]'
            END as current_icon,
            -- Y3 state
            y3_sqft_per_capita as y3_sqft_cap,
            y3_saturation,
            CASE y3_saturation
                WHEN 'undersupplied' THEN '[GREEN]'
                WHEN 'balanced' THEN '[YELLOW]'
                WHEN 'oversupplied' THEN '[ORANGE]'
                WHEN 'saturated' THEN '[RED]'
            END as y3_icon,
            -- Trajectory
            trajectory,
            trajectory_score,
            CASE trajectory
                WHEN 'improving' THEN '[UP]'
                WHEN 'stable' THEN '[STABLE]'
                WHEN 'deteriorating' THEN '[DOWN]'
            END as trajectory_icon,
            -- Recommendation
            opportunity_score,
            recommendation,
            CASE recommendation
                WHEN 'strong_pursue' THEN '[TARGET]'
                WHEN 'pursue' THEN '[GO]'
                WHEN 'monitor' THEN '[WATCH]'
                WHEN 'avoid' THEN '[STOP]'
            END as rec_icon,
            projection_date
        FROM market_projections
        WHERE geo_type = 'county'
        ORDER BY opportunity_score DESC
    ''')

    # Pipeline impact view
    cur.execute('''
        CREATE VIEW v_pipeline_impact AS
        SELECT
            state,
            geo_name as county,
            -- Housing pipeline
            pipeline_permitted_units as permitted,
            pipeline_site_work_units as site_work,
            pipeline_vertical_units as vertical,
            pipeline_total_units as total_units,
            pipeline_demand_sqft as demand_sqft,
            -- Storage pipeline
            storage_pipeline_sqft as new_storage_sqft,
            storage_pipeline_projects as new_storage_projects,
            -- Net impact
            supply_demand_gap,
            CASE
                WHEN supply_demand_gap > 50000 THEN '[GREEN] Demand > Supply'
                WHEN supply_demand_gap > 0 THEN '[YELLOW] Slight demand advantage'
                WHEN supply_demand_gap > -50000 THEN '[ORANGE] Slight supply advantage'
                ELSE '[RED] Supply > Demand'
            END as gap_assessment,
            -- Timing
            demand_velocity,
            supply_velocity,
            window_status,
            window_months,
            optimal_entry_timing
        FROM market_projections
        WHERE geo_type = 'county'
        ORDER BY supply_demand_gap DESC
    ''')

    # Opportunity ranking
    cur.execute('''
        CREATE VIEW v_opportunity_ranking AS
        SELECT
            ROW_NUMBER() OVER (ORDER BY opportunity_score DESC) as rank,
            state,
            geo_name as county,
            opportunity_score,
            confidence_score,
            recommendation,
            CASE recommendation
                WHEN 'strong_pursue' THEN '[TARGET]'
                WHEN 'pursue' THEN '[GO]'
                WHEN 'monitor' THEN '[WATCH]'
                WHEN 'avoid' THEN '[STOP]'
            END as rec_icon,
            current_saturation,
            trajectory,
            overall_risk,
            primary_catalyst,
            primary_headwind,
            optimal_entry_timing
        FROM market_projections
        WHERE geo_type = 'county'
        ORDER BY opportunity_score DESC
    ''')

    # Risk matrix
    cur.execute('''
        CREATE VIEW v_risk_matrix AS
        SELECT
            state,
            geo_name as county,
            demand_risk,
            supply_risk,
            timing_risk,
            overall_risk,
            CASE overall_risk
                WHEN 'low' THEN '[GREEN]'
                WHEN 'medium' THEN '[YELLOW]'
                WHEN 'high' THEN '[RED]'
            END as risk_icon,
            opportunity_score,
            recommendation,
            recommendation_rationale
        FROM market_projections
        WHERE geo_type = 'county'
        ORDER BY
            CASE overall_risk WHEN 'low' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            opportunity_score DESC
    ''')

    print('  [OK] Views created')


def seed_population_projections(cur):
    """Seed population projections for WV counties."""
    print('Seeding population projections...')

    projections = [
        ('county', '54003', 'Berkeley County', 'WV',
         2022, 122000, 45000,
         124500, 46100, 127000, 47200, 130000, 48500, 135000, 51000,
         0.021, 0.025, 'high_growth', 'wv_demographer'),
        ('county', '54037', 'Jefferson County', 'WV',
         2022, 58000, 22000,
         58900, 22400, 59800, 22800, 60700, 23200, 62500, 24000,
         0.015, 0.018, 'moderate', 'wv_demographer'),
        ('county', '54065', 'Morgan County', 'WV',
         2022, 18000, 7200,
         18100, 7250, 18200, 7300, 18300, 7350, 18500, 7450,
         0.005, 0.007, 'stable', 'wv_demographer'),
    ]

    for p in projections:
        cur.execute('''
            INSERT INTO population_projections (
                geo_type, geo_id, geo_name, state,
                base_year, base_population, base_households,
                year_1_population, year_1_households,
                year_2_population, year_2_households,
                year_3_population, year_3_households,
                year_5_population, year_5_households,
                annual_pop_growth_rate, annual_hh_growth_rate,
                growth_tier, data_source
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (geo_type, geo_id, base_year) DO NOTHING
        ''', p)

    print('  [OK] Population projections seeded (3 counties)')


def run_test(cur):
    """Run projection test."""
    print('\nRunning market projections test...')

    # Run projections
    cur.execute('SELECT * FROM project_all_markets()')
    results = cur.fetchall()

    print('\nMarket Projections:')
    for r in results:
        print(f'  {r[1]} ({r[0]}):')
        print(f'    Current: {r[2]} -> Y3: {r[3]}')
        print(f'    Trajectory: {r[4]}, Score: {r[5]}, Rec: {r[6]}')

    # Show trajectory dashboard
    print('\nTrajectory Dashboard:')
    cur.execute('''
        SELECT county, current_icon, current_saturation, trajectory_icon, trajectory,
               y3_icon, y3_saturation, rec_icon, recommendation, opportunity_score
        FROM v_market_trajectory
    ''')
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]} {row[2]} {row[3]} {row[4]} -> {row[5]} {row[6]}')
        print(f'    {row[7]} {row[8]} (Score: {row[9]})')

    # Show pipeline impact
    print('\nPipeline Impact:')
    cur.execute('''
        SELECT county, total_units, demand_sqft, new_storage_sqft, supply_demand_gap, gap_assessment
        FROM v_pipeline_impact
    ''')
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]} housing units, {row[2]} demand sqft')
        print(f'    New storage: {row[3]} sqft, Gap: {row[4]}')
        print(f'    {row[5]}')

    # Show opportunity ranking
    print('\nOpportunity Ranking:')
    cur.execute('''
        SELECT rank, county, opportunity_score, recommendation, rec_icon, overall_risk, optimal_entry_timing
        FROM v_opportunity_ranking
    ''')
    for row in cur.fetchall():
        print(f'  #{row[0]} {row[1]}: Score {row[2]}, {row[4]} {row[3]}, Risk: {row[5]}, Timing: {row[6]}')

    # Show recommendation summary
    print('\nRecommendation Summary:')
    cur.execute('''
        SELECT recommendation, COUNT(*) as counties, ROUND(AVG(opportunity_score)) as avg_score
        FROM market_projections
        WHERE geo_type = 'county'
        GROUP BY recommendation
        ORDER BY CASE recommendation
            WHEN 'strong_pursue' THEN 1
            WHEN 'pursue' THEN 2
            WHEN 'monitor' THEN 3
            ELSE 4
        END
    ''')
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]} counties, avg score {row[2]}')


def main():
    conn = psycopg2.connect(CONNECTION_STRING)
    conn.autocommit = True
    cur = conn.cursor()

    print('='*70)
    print('PROMPT 15: FUTURE STATE MARKET MODEL')
    print('='*70)

    # Create tables
    create_storage_pipeline_table(cur)
    create_population_projections_table(cur)
    create_market_projections_table(cur)

    # Create functions
    create_housing_pipeline_summary_function(cur)
    create_storage_pipeline_summary_function(cur)
    create_project_market_function(cur)
    create_project_all_markets_function(cur)

    # Create views
    create_views(cur)

    # Seed data and test
    seed_population_projections(cur)
    run_test(cur)

    print('\n' + '='*70)
    print('SETUP COMPLETE')
    print('='*70)
    print('\nTables created:')
    print('  - storage_pipeline')
    print('  - population_projections')
    print('  - market_projections')
    print('\nFunctions created:')
    print('  - get_housing_pipeline_summary(county_fips)')
    print('  - get_storage_pipeline_summary(county_fips)')
    print('  - project_market(geo_type, geo_id, name, state)')
    print('  - project_all_markets()')
    print('\nViews created:')
    print('  - v_market_trajectory')
    print('  - v_pipeline_impact')
    print('  - v_opportunity_ranking')
    print('  - v_risk_matrix')
    print('\nRecommendations:')
    print('  [TARGET] strong_pursue (75+, low risk) - Act now')
    print('  [GO] pursue (55+, low/med risk) - Move forward')
    print('  [WATCH] monitor (35+) - Watch and wait')
    print('  [STOP] avoid (<35) - Do not enter')

    conn.close()


if __name__ == '__main__':
    main()
