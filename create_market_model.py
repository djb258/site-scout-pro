"""
Prompt 14: Current State Market Model
Creates market analysis system for supply, demand, saturation, and market health.
"""
import psycopg2

CONNECTION_STRING = 'postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'


def create_storage_facilities_table(cur):
    """Create comprehensive storage facilities table."""
    print('Creating storage_facilities table...')

    # Check if table exists and has data - we may need to migrate
    cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'storage_facilities')")
    table_exists = cur.fetchone()[0]

    if table_exists:
        # Check if it has the new columns
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'storage_facilities' AND column_name = 'brand_type'
        """)
        has_new_columns = cur.fetchone() is not None

        if not has_new_columns:
            print('  Migrating existing storage_facilities table...')
            # Add new columns to existing table
            new_columns = [
                ('brand', 'VARCHAR(100)'),
                ('brand_type', 'VARCHAR(50)'),
                ('facility_type', 'VARCHAR(50)'),
                ('stories', 'INT'),
                ('year_built', 'INT'),
                ('year_expanded', 'INT'),
                ('total_sqft', 'INT'),
                ('rentable_sqft', 'INT'),
                ('unit_mix', 'JSONB'),
                ('climate_sqft', 'INT'),
                ('climate_pct', 'INT'),
                ('has_security_gate', 'BOOLEAN'),
                ('has_cameras', 'BOOLEAN'),
                ('has_onsite_manager', 'BOOLEAN'),
                ('has_truck_rental', 'BOOLEAN'),
                ('has_packing_supplies', 'BOOLEAN'),
                ('access_hours', 'VARCHAR(100)'),
                ('rate_10x10_climate', 'DECIMAL'),
                ('rate_5x5', 'DECIMAL'),
                ('rate_5x10', 'DECIMAL'),
                ('rate_10x15', 'DECIMAL'),
                ('rate_10x30', 'DECIMAL'),
                ('rate_source', 'VARCHAR(50)'),
                ('rate_date', 'DATE'),
                ('occupancy_pct', 'INT'),
                ('occupancy_source', 'VARCHAR(50)'),
                ('occupancy_date', 'DATE'),
                ('google_rating', 'DECIMAL'),
                ('google_reviews', 'INT'),
                ('competitive_position', 'VARCHAR(20)'),
                ('source', 'VARCHAR(100)'),
                ('source_url', 'VARCHAR(500)'),
                ('verified', 'BOOLEAN DEFAULT FALSE'),
                ('verified_date', 'DATE'),
                ('notes', 'TEXT'),
                ('updated_at', 'TIMESTAMP DEFAULT NOW()'),
            ]
            for col_name, col_type in new_columns:
                try:
                    cur.execute(f'ALTER TABLE storage_facilities ADD COLUMN IF NOT EXISTS {col_name} {col_type}')
                except Exception as e:
                    pass  # Column may already exist
            print('  [OK] Existing table migrated')
            return

    # Create new table if it doesn't exist
    cur.execute('''
        CREATE TABLE IF NOT EXISTS storage_facilities (
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

            -- Identification
            facility_name VARCHAR(200) NOT NULL,
            brand VARCHAR(100),
            brand_type VARCHAR(50),

            -- Facility details
            facility_type VARCHAR(50),
            stories INT,
            year_built INT,
            year_expanded INT,

            -- Capacity
            total_sqft INT,
            rentable_sqft INT,
            unit_count INT,
            unit_mix JSONB,

            -- Climate control
            has_climate_control BOOLEAN,
            climate_sqft INT,
            climate_pct INT,

            -- Amenities
            has_security_gate BOOLEAN,
            has_cameras BOOLEAN,
            has_onsite_manager BOOLEAN,
            has_truck_rental BOOLEAN,
            has_packing_supplies BOOLEAN,
            access_hours VARCHAR(100),

            -- Current rates
            rate_10x10 DECIMAL,
            rate_10x10_climate DECIMAL,
            rate_5x5 DECIMAL,
            rate_5x10 DECIMAL,
            rate_10x15 DECIMAL,
            rate_10x20 DECIMAL,
            rate_10x30 DECIMAL,
            rate_source VARCHAR(50),
            rate_date DATE,

            -- Occupancy
            occupancy_pct INT,
            occupancy_source VARCHAR(50),
            occupancy_date DATE,

            -- Competitive position
            google_rating DECIMAL,
            google_reviews INT,
            competitive_position VARCHAR(20),

            -- Data sources
            source VARCHAR(100),
            source_url VARCHAR(500),
            verified BOOLEAN DEFAULT FALSE,
            verified_date DATE,

            -- Metadata
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(state, county_fips, facility_name, address)
        )
    ''')

    # Create indexes
    cur.execute('CREATE INDEX IF NOT EXISTS idx_sf_county ON storage_facilities(county_fips)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_sf_zip ON storage_facilities(zip)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_sf_brand ON storage_facilities(brand_type)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_sf_location ON storage_facilities(lat, lon)')

    print('  [OK] storage_facilities table created')


def create_market_demographics_table(cur):
    """Create market demographics table."""
    print('Creating market_demographics table...')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS market_demographics (
            id SERIAL PRIMARY KEY,

            -- Geography
            geo_type VARCHAR(20) NOT NULL,
            geo_id VARCHAR(20) NOT NULL,
            geo_name VARCHAR(100),
            state VARCHAR(2),

            -- Population
            population INT,
            households INT,
            population_density DECIMAL,

            -- Age distribution
            median_age DECIMAL,
            pct_18_34 DECIMAL,
            pct_35_54 DECIMAL,
            pct_55_plus DECIMAL,
            pct_65_plus DECIMAL,

            -- Housing
            total_housing_units INT,
            occupied_units INT,
            owner_occupied INT,
            renter_occupied INT,
            renter_pct DECIMAL,

            -- Housing types (KEY DEMAND DRIVERS)
            sfh_units INT,
            townhome_units INT,
            apartment_units INT,
            condo_units INT,
            mobile_home_units INT,

            -- Storage demand factors
            no_garage_units INT,
            no_garage_pct DECIMAL,

            -- Income
            median_income INT,
            mean_income INT,
            pct_income_under_25k DECIMAL,
            pct_income_25k_50k DECIMAL,
            pct_income_50k_75k DECIMAL,
            pct_income_75k_100k DECIMAL,
            pct_income_over_100k DECIMAL,

            -- Employment
            labor_force INT,
            employed INT,
            unemployment_rate DECIMAL,

            -- Mobility (KEY INDICATOR)
            moved_within_county INT,
            moved_from_other_county INT,
            moved_from_other_state INT,
            total_movers INT,
            mover_pct DECIMAL,

            -- Education
            pct_bachelors_plus DECIMAL,

            -- Military
            military_population INT,
            veteran_population INT,

            -- Data vintage
            data_year INT,
            data_source VARCHAR(50),

            -- Metadata
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(geo_type, geo_id)
        )
    ''')

    cur.execute('CREATE INDEX IF NOT EXISTS idx_md_geo ON market_demographics(geo_type, geo_id)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_md_county ON market_demographics(geo_id) WHERE geo_type = \'county\'')

    print('  [OK] market_demographics table created')


def create_market_analysis_table(cur):
    """Create market analysis table."""
    print('Creating market_analysis table...')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS market_analysis (
            id SERIAL PRIMARY KEY,

            -- Geography
            geo_type VARCHAR(20) NOT NULL,
            geo_id VARCHAR(20) NOT NULL,
            geo_name VARCHAR(100),
            state VARCHAR(2),
            analysis_date DATE DEFAULT CURRENT_DATE,

            -- SUPPLY METRICS
            facility_count INT,
            total_supply_sqft BIGINT,
            climate_supply_sqft BIGINT,
            climate_pct DECIMAL,
            reit_facilities INT,
            independent_facilities INT,

            -- Supply concentration
            top_operator VARCHAR(100),
            top_operator_sqft BIGINT,
            top_operator_pct DECIMAL,
            hhi_index INT,

            -- DEMAND METRICS
            population INT,
            households INT,

            -- Demand drivers
            high_demand_units INT,
            low_demand_units INT,
            demand_weighted_units DECIMAL,

            -- Calculated demand
            base_demand_sqft BIGINT,
            adjusted_demand_sqft BIGINT,

            -- SATURATION METRICS
            sqft_per_capita DECIMAL,
            sqft_per_household DECIMAL,

            -- Saturation classification
            saturation_level VARCHAR(20),
            saturation_score INT,

            -- RENT METRICS
            avg_rent_10x10 DECIMAL,
            median_rent_10x10 DECIMAL,
            min_rent_10x10 DECIMAL,
            max_rent_10x10 DECIMAL,
            rent_per_sqft DECIMAL,

            -- Rent relative to region
            regional_avg_rent DECIMAL,
            rent_index DECIMAL,

            -- ABSORPTION ESTIMATE
            avg_occupancy_pct DECIMAL,
            absorption_rate VARCHAR(20),

            -- COMPETITIVE DYNAMICS
            newest_facility_year INT,
            oldest_facility_year INT,
            avg_facility_age INT,
            facilities_last_5_years INT,

            -- MARKET HEALTH SCORE
            market_health_score INT,
            market_health_rating VARCHAR(20),

            -- Key insights
            primary_opportunity TEXT,
            primary_risk TEXT,

            -- Metadata
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(geo_type, geo_id, analysis_date)
        )
    ''')

    cur.execute('CREATE INDEX IF NOT EXISTS idx_ma_geo ON market_analysis(geo_type, geo_id)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_ma_saturation ON market_analysis(saturation_level)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_ma_health ON market_analysis(market_health_rating)')

    print('  [OK] market_analysis table created')


def create_supply_metrics_function(cur):
    """Create function to calculate supply metrics."""
    print('Creating calculate_supply_metrics function...')

    # Note: existing table uses 'name' not 'facility_name', 'asking_rent_10x10' not 'rate_10x10'
    cur.execute('''
        CREATE OR REPLACE FUNCTION calculate_supply_metrics(
            p_geo_type VARCHAR(20),
            p_geo_id VARCHAR(20)
        )
        RETURNS TABLE(
            facility_count INT,
            total_supply_sqft BIGINT,
            climate_supply_sqft BIGINT,
            reit_count INT,
            independent_count INT,
            top_operator VARCHAR(100),
            top_operator_sqft BIGINT,
            avg_rent_10x10 DECIMAL,
            newest_year INT,
            oldest_year INT
        ) AS $func$
        BEGIN
            RETURN QUERY
            WITH filtered AS (
                SELECT sf.*
                FROM storage_facilities sf
                WHERE CASE
                    WHEN p_geo_type = 'county' THEN sf.county_fips = p_geo_id
                    WHEN p_geo_type = 'zip' THEN sf.zip = p_geo_id
                    ELSE FALSE
                END
            ),
            operator_ranks AS (
                SELECT
                    COALESCE(brand, owner_operator, 'Independent') as operator,
                    SUM(COALESCE(rentable_sqft, total_sqft, 0)) as op_sqft,
                    ROW_NUMBER() OVER (ORDER BY SUM(COALESCE(rentable_sqft, total_sqft, 0)) DESC) as rn
                FROM filtered
                GROUP BY COALESCE(brand, owner_operator, 'Independent')
            )
            SELECT
                COUNT(f.id)::INT as facility_count,
                COALESCE(SUM(COALESCE(f.rentable_sqft, f.total_sqft, 0)), 0)::BIGINT as total_supply_sqft,
                COALESCE(SUM(COALESCE(f.climate_sqft, 0)), 0)::BIGINT as climate_supply_sqft,
                COUNT(CASE WHEN f.brand_type = 'reit' THEN 1 END)::INT as reit_count,
                COUNT(CASE WHEN f.brand_type = 'independent' OR f.brand_type IS NULL THEN 1 END)::INT as independent_count,
                (SELECT operator FROM operator_ranks WHERE rn = 1) as top_operator,
                COALESCE((SELECT op_sqft FROM operator_ranks WHERE rn = 1), 0)::BIGINT as top_operator_sqft,
                ROUND(AVG(f.asking_rent_10x10), 2) as avg_rent_10x10,
                MAX(f.year_built)::INT as newest_year,
                MIN(f.year_built)::INT as oldest_year
            FROM filtered f;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] calculate_supply_metrics function created')


def create_demand_metrics_function(cur):
    """Create function to calculate demand metrics."""
    print('Creating calculate_demand_metrics function...')

    cur.execute('''
        CREATE OR REPLACE FUNCTION calculate_demand_metrics(
            p_geo_type VARCHAR(20),
            p_geo_id VARCHAR(20)
        )
        RETURNS TABLE(
            population INT,
            households INT,
            high_demand_units INT,
            low_demand_units INT,
            demand_weighted_units DECIMAL,
            renter_pct DECIMAL,
            mover_pct DECIMAL,
            base_demand_sqft BIGINT,
            adjusted_demand_sqft BIGINT
        ) AS $func$
        DECLARE
            v_demo market_demographics%ROWTYPE;
            v_high_units INT;
            v_low_units INT;
            v_weighted DECIMAL;
            v_base_demand BIGINT;
            v_adjusted_demand BIGINT;
            v_demand_factor DECIMAL;
        BEGIN
            -- Get demographics
            SELECT * INTO v_demo
            FROM market_demographics
            WHERE geo_type = p_geo_type AND geo_id = p_geo_id;

            IF NOT FOUND THEN
                RETURN;
            END IF;

            -- Calculate high/low demand units
            v_high_units := COALESCE(v_demo.apartment_units, 0) +
                            COALESCE(v_demo.townhome_units, 0) +
                            COALESCE(v_demo.condo_units, 0);
            v_low_units := COALESCE(v_demo.sfh_units, 0);

            -- Weighted demand (6 sq ft for high demand, 2 for low)
            v_weighted := (v_high_units * 6.0) + (v_low_units * 2.0);

            -- Base demand at national average (7 sq ft per capita)
            v_base_demand := (COALESCE(v_demo.population, 0) * 7)::BIGINT;

            -- Adjusted demand based on housing mix, renters, movers
            v_demand_factor := 1.0;

            IF COALESCE(v_demo.renter_pct, 0) > 40 THEN
                v_demand_factor := v_demand_factor + 0.20;
            ELSIF COALESCE(v_demo.renter_pct, 0) > 30 THEN
                v_demand_factor := v_demand_factor + 0.10;
            END IF;

            IF COALESCE(v_demo.mover_pct, 0) > 15 THEN
                v_demand_factor := v_demand_factor + 0.15;
            ELSIF COALESCE(v_demo.mover_pct, 0) > 10 THEN
                v_demand_factor := v_demand_factor + 0.08;
            END IF;

            IF v_demo.total_housing_units > 0 AND
               (v_high_units::DECIMAL / v_demo.total_housing_units) > 0.30 THEN
                v_demand_factor := v_demand_factor + 0.25;
            ELSIF v_demo.total_housing_units > 0 AND
                  (v_high_units::DECIMAL / v_demo.total_housing_units) > 0.20 THEN
                v_demand_factor := v_demand_factor + 0.15;
            END IF;

            v_adjusted_demand := (v_base_demand * v_demand_factor)::BIGINT;

            RETURN QUERY SELECT
                v_demo.population,
                v_demo.households,
                v_high_units,
                v_low_units,
                v_weighted,
                v_demo.renter_pct,
                v_demo.mover_pct,
                v_base_demand,
                v_adjusted_demand;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] calculate_demand_metrics function created')


def create_analyze_market_function(cur):
    """Create comprehensive market analysis function."""
    print('Creating analyze_market function...')

    cur.execute('''
        CREATE OR REPLACE FUNCTION analyze_market(
            p_geo_type VARCHAR(20),
            p_geo_id VARCHAR(20),
            p_geo_name VARCHAR(100) DEFAULT NULL,
            p_state VARCHAR(2) DEFAULT NULL
        )
        RETURNS INT AS $func$
        DECLARE
            v_supply RECORD;
            v_demand RECORD;
            v_sqft_per_capita DECIMAL;
            v_sqft_per_hh DECIMAL;
            v_saturation_level VARCHAR(20);
            v_saturation_score INT;
            v_health_score INT;
            v_health_rating VARCHAR(20);
            v_analysis_id INT;
            v_primary_opportunity TEXT;
            v_primary_risk TEXT;
        BEGIN
            -- Get supply metrics
            SELECT * INTO v_supply FROM calculate_supply_metrics(p_geo_type, p_geo_id);

            -- Get demand metrics
            SELECT * INTO v_demand FROM calculate_demand_metrics(p_geo_type, p_geo_id);

            -- Calculate saturation
            IF COALESCE(v_demand.population, 0) > 0 THEN
                v_sqft_per_capita := ROUND(COALESCE(v_supply.total_supply_sqft, 0)::DECIMAL / v_demand.population, 2);
            ELSE
                v_sqft_per_capita := 0;
            END IF;

            IF COALESCE(v_demand.households, 0) > 0 THEN
                v_sqft_per_hh := ROUND(COALESCE(v_supply.total_supply_sqft, 0)::DECIMAL / v_demand.households, 2);
            ELSE
                v_sqft_per_hh := 0;
            END IF;

            -- Classify saturation (national avg ~7 sq ft per capita)
            v_saturation_level := CASE
                WHEN v_sqft_per_capita < 4 THEN 'undersupplied'
                WHEN v_sqft_per_capita < 7 THEN 'balanced'
                WHEN v_sqft_per_capita < 10 THEN 'oversupplied'
                ELSE 'saturated'
            END;

            -- Saturation score (0 = great opportunity, 100 = no opportunity)
            v_saturation_score := LEAST(GREATEST((v_sqft_per_capita / 12 * 100)::INT, 0), 100);

            -- Calculate market health score
            v_health_score := 100;

            -- Saturation impact (40 pts)
            v_health_score := v_health_score - (v_saturation_score * 0.4)::INT;

            -- Rent impact (30 pts)
            IF v_supply.avg_rent_10x10 IS NOT NULL THEN
                IF v_supply.avg_rent_10x10 >= 100 THEN
                    v_health_score := v_health_score;
                ELSIF v_supply.avg_rent_10x10 >= 80 THEN
                    v_health_score := v_health_score - 5;
                ELSIF v_supply.avg_rent_10x10 >= 60 THEN
                    v_health_score := v_health_score - 15;
                ELSE
                    v_health_score := v_health_score - 25;
                END IF;
            END IF;

            -- Facility age impact (15 pts)
            IF v_supply.newest_year IS NOT NULL AND v_supply.newest_year >= EXTRACT(YEAR FROM CURRENT_DATE) - 3 THEN
                v_health_score := v_health_score - 10;
            END IF;

            -- Demand driver impact (15 pts)
            IF v_demand.renter_pct > 35 THEN
                v_health_score := v_health_score + 5;
            END IF;
            IF v_demand.high_demand_units > v_demand.low_demand_units * 0.3 THEN
                v_health_score := v_health_score + 5;
            END IF;

            v_health_score := LEAST(GREATEST(v_health_score, 0), 100);

            v_health_rating := CASE
                WHEN v_health_score >= 75 THEN 'excellent'
                WHEN v_health_score >= 55 THEN 'good'
                WHEN v_health_score >= 35 THEN 'fair'
                ELSE 'poor'
            END;

            -- Determine primary opportunity and risk
            v_primary_opportunity := CASE
                WHEN v_saturation_level = 'undersupplied' THEN 'Significant undersupply - strong new facility opportunity'
                WHEN v_demand.high_demand_units > v_demand.low_demand_units * 0.4 THEN 'High concentration of apartments/townhomes driving demand'
                WHEN v_demand.renter_pct > 40 THEN 'High renter population creates storage demand'
                WHEN v_supply.avg_rent_10x10 > 90 THEN 'Strong rental rates indicate healthy market'
                ELSE 'Moderate market with potential for well-positioned facility'
            END;

            v_primary_risk := CASE
                WHEN v_saturation_level = 'saturated' THEN 'Market oversupplied - new entry very risky'
                WHEN v_saturation_level = 'oversupplied' THEN 'Above-average supply - differentiation required'
                WHEN v_supply.newest_year >= EXTRACT(YEAR FROM CURRENT_DATE) - 2 THEN 'Recent new supply may indicate competition'
                WHEN v_supply.avg_rent_10x10 < 70 THEN 'Weak rental rates may indicate soft demand'
                WHEN v_supply.reit_count > v_supply.independent_count THEN 'REIT-dominated market - pricing pressure likely'
                ELSE 'Standard market risks apply'
            END;

            -- Insert or update analysis
            INSERT INTO market_analysis (
                geo_type, geo_id, geo_name, state, analysis_date,
                facility_count, total_supply_sqft, climate_supply_sqft,
                climate_pct,
                reit_facilities, independent_facilities,
                top_operator, top_operator_sqft,
                top_operator_pct,
                population, households,
                high_demand_units, low_demand_units, demand_weighted_units,
                base_demand_sqft, adjusted_demand_sqft,
                sqft_per_capita, sqft_per_household,
                saturation_level, saturation_score,
                avg_rent_10x10, rent_per_sqft,
                newest_facility_year, oldest_facility_year,
                market_health_score, market_health_rating,
                primary_opportunity, primary_risk
            ) VALUES (
                p_geo_type, p_geo_id, p_geo_name, p_state, CURRENT_DATE,
                v_supply.facility_count, v_supply.total_supply_sqft, v_supply.climate_supply_sqft,
                CASE WHEN v_supply.total_supply_sqft > 0
                     THEN ROUND(v_supply.climate_supply_sqft::DECIMAL / v_supply.total_supply_sqft * 100, 1)
                     ELSE 0 END,
                v_supply.reit_count, v_supply.independent_count,
                v_supply.top_operator, v_supply.top_operator_sqft,
                CASE WHEN v_supply.total_supply_sqft > 0
                     THEN ROUND(v_supply.top_operator_sqft::DECIMAL / v_supply.total_supply_sqft * 100, 1)
                     ELSE 0 END,
                v_demand.population, v_demand.households,
                v_demand.high_demand_units, v_demand.low_demand_units, v_demand.demand_weighted_units,
                v_demand.base_demand_sqft, v_demand.adjusted_demand_sqft,
                v_sqft_per_capita, v_sqft_per_hh,
                v_saturation_level, v_saturation_score,
                v_supply.avg_rent_10x10,
                CASE WHEN v_supply.avg_rent_10x10 IS NOT NULL THEN ROUND(v_supply.avg_rent_10x10 / 100, 2) ELSE NULL END,
                v_supply.newest_year, v_supply.oldest_year,
                v_health_score, v_health_rating,
                v_primary_opportunity, v_primary_risk
            )
            ON CONFLICT (geo_type, geo_id, analysis_date) DO UPDATE SET
                facility_count = EXCLUDED.facility_count,
                total_supply_sqft = EXCLUDED.total_supply_sqft,
                population = EXCLUDED.population,
                sqft_per_capita = EXCLUDED.sqft_per_capita,
                saturation_level = EXCLUDED.saturation_level,
                market_health_score = EXCLUDED.market_health_score,
                market_health_rating = EXCLUDED.market_health_rating,
                primary_opportunity = EXCLUDED.primary_opportunity,
                primary_risk = EXCLUDED.primary_risk
            RETURNING id INTO v_analysis_id;

            RETURN v_analysis_id;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] analyze_market function created')


def create_analyze_all_markets_function(cur):
    """Create batch market analysis function."""
    print('Creating analyze_all_markets function...')

    cur.execute('''
        CREATE OR REPLACE FUNCTION analyze_all_markets()
        RETURNS TABLE(
            geo_id VARCHAR(20),
            geo_name VARCHAR(100),
            analysis_id INT,
            sqft_per_capita DECIMAL,
            saturation VARCHAR(20),
            health_score INT,
            health_rating VARCHAR(20)
        ) AS $func$
        DECLARE
            v_county RECORD;
            v_analysis_id INT;
        BEGIN
            -- Get unique counties from jurisdiction_cards
            FOR v_county IN
                SELECT DISTINCT county_fips, county_name, state
                FROM jurisdiction_cards
                ORDER BY state, county_name
            LOOP
                v_analysis_id := analyze_market('county', v_county.county_fips, v_county.county_name, v_county.state);

                RETURN QUERY
                SELECT
                    v_county.county_fips::VARCHAR(20),
                    v_county.county_name::VARCHAR(100),
                    v_analysis_id,
                    ma.sqft_per_capita,
                    ma.saturation_level::VARCHAR(20),
                    ma.market_health_score,
                    ma.market_health_rating::VARCHAR(20)
                FROM market_analysis ma
                WHERE ma.id = v_analysis_id;
            END LOOP;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] analyze_all_markets function created')


def create_views(cur):
    """Create market summary views."""
    print('Creating views...')

    # Drop existing views
    views_to_drop = [
        'v_market_overview',
        'v_demand_drivers',
        'v_supply_detail',
        'v_competitive_landscape',
        'v_market_opportunity_ranking'
    ]
    for view in views_to_drop:
        cur.execute(f'DROP VIEW IF EXISTS {view}')

    # Market overview
    cur.execute('''
        CREATE VIEW v_market_overview AS
        SELECT
            state,
            geo_name as county,
            population,
            households,
            facility_count as facilities,
            total_supply_sqft as supply_sqft,
            ROUND(sqft_per_capita, 1) as sqft_per_cap,
            saturation_level,
            CASE saturation_level
                WHEN 'undersupplied' THEN '[GREEN]'
                WHEN 'balanced' THEN '[YELLOW]'
                WHEN 'oversupplied' THEN '[ORANGE]'
                WHEN 'saturated' THEN '[RED]'
            END as saturation_icon,
            avg_rent_10x10 as rent_10x10,
            market_health_score as health_score,
            market_health_rating as health,
            primary_opportunity,
            primary_risk,
            analysis_date
        FROM market_analysis
        WHERE geo_type = 'county'
        ORDER BY market_health_score DESC
    ''')

    # Demand drivers detail
    cur.execute('''
        CREATE VIEW v_demand_drivers AS
        SELECT
            md.state,
            md.geo_name as county,
            md.population,
            md.households,
            md.sfh_units,
            md.townhome_units,
            md.apartment_units,
            md.condo_units,
            COALESCE(md.townhome_units, 0) + COALESCE(md.apartment_units, 0) + COALESCE(md.condo_units, 0) as high_demand_units,
            ROUND(100.0 * (COALESCE(md.townhome_units, 0) + COALESCE(md.apartment_units, 0) + COALESCE(md.condo_units, 0)) / NULLIF(md.total_housing_units, 0), 1) as high_demand_pct,
            md.renter_pct,
            md.mover_pct,
            md.median_income,
            ma.adjusted_demand_sqft,
            ma.sqft_per_capita,
            ma.saturation_level
        FROM market_demographics md
        LEFT JOIN market_analysis ma ON md.geo_type = ma.geo_type AND md.geo_id = ma.geo_id
        WHERE md.geo_type = 'county'
        ORDER BY high_demand_pct DESC NULLS LAST
    ''')

    # Supply detail - use existing column names (name, asking_rent_10x10, rating)
    cur.execute('''
        CREATE VIEW v_supply_detail AS
        SELECT
            sf.state,
            sf.county_fips,
            sf.name as facility_name,
            COALESCE(sf.brand, sf.owner_operator) as brand,
            sf.brand_type,
            sf.facility_type,
            COALESCE(sf.rentable_sqft, sf.total_sqft) as rentable_sqft,
            sf.unit_count,
            COALESCE(sf.has_climate_control, sf.climate_controlled) as has_climate_control,
            sf.asking_rent_10x10 as rate_10x10,
            sf.year_built,
            COALESCE(sf.google_rating, sf.rating) as google_rating,
            sf.competitive_position,
            sf.address,
            sf.city
        FROM storage_facilities sf
        ORDER BY sf.state, sf.county_fips, sf.rentable_sqft DESC NULLS LAST
    ''')

    # Competitive landscape - use existing column names
    cur.execute('''
        CREATE VIEW v_competitive_landscape AS
        SELECT
            state,
            county_fips,
            COALESCE(brand, owner_operator, 'Independent') as operator,
            brand_type,
            COUNT(*) as facility_count,
            SUM(COALESCE(rentable_sqft, total_sqft, 0)) as total_sqft,
            ROUND(AVG(asking_rent_10x10), 2) as avg_rent,
            ROUND(AVG(COALESCE(google_rating, rating)), 1) as avg_rating,
            MIN(year_built) as oldest,
            MAX(year_built) as newest
        FROM storage_facilities
        GROUP BY state, county_fips, COALESCE(brand, owner_operator, 'Independent'), brand_type
        ORDER BY state, county_fips, total_sqft DESC
    ''')

    # Market opportunity ranking
    cur.execute('''
        CREATE VIEW v_market_opportunity_ranking AS
        SELECT
            ROW_NUMBER() OVER (ORDER BY
                CASE saturation_level
                    WHEN 'undersupplied' THEN 1
                    WHEN 'balanced' THEN 2
                    WHEN 'oversupplied' THEN 3
                    WHEN 'saturated' THEN 4
                END,
                market_health_score DESC
            ) as rank,
            state,
            geo_name as county,
            sqft_per_capita,
            saturation_level,
            market_health_score,
            market_health_rating,
            high_demand_units,
            avg_rent_10x10,
            primary_opportunity
        FROM market_analysis
        WHERE geo_type = 'county'
        ORDER BY rank
    ''')

    print('  [OK] Views created')


def insert_sample_data(cur):
    """Insert sample data for testing."""
    print('Inserting sample data...')

    # Sample storage facilities - use existing column names (name, asking_rent_10x10, rating)
    facilities = [
        ('WV', '54003', 'Martinsburg', '25401', '100 Storage Lane',
         'Public Storage Martinsburg', 'Public Storage', 'reit', 'mixed',
         65000, 60000, 450, 1, 2015, True, 20000, 95, 65, 165, 4.2, 128),
        ('WV', '54003', 'Martinsburg', '25401', '200 Industrial Blvd',
         'Extra Space Storage', 'Extra Space', 'reit', 'climate',
         55000, 50000, 380, 3, 2019, True, 50000, 115, 75, 195, 4.5, 89),
        ('WV', '54003', 'Inwood', '25428', '500 Route 11',
         'Inwood Self Storage', None, 'independent', 'drive_up',
         35000, 32000, 220, 1, 2005, False, 0, 75, 50, 130, 4.0, 45),
        ('WV', '54003', 'Falling Waters', '25419', '123 Storage Dr',
         'Falling Waters Mini Storage', None, 'independent', 'drive_up',
         28000, 25000, 180, 1, 2010, False, 0, 70, 48, 120, 3.8, 32),
        ('WV', '54037', 'Charles Town', '25414', '300 Main St',
         'CubeSmart Charles Town', 'CubeSmart', 'reit', 'mixed',
         45000, 42000, 320, 2, 2018, True, 18000, 105, 70, 180, 4.4, 67),
        ('WV', '54037', 'Shepherdstown', '25443', '150 Storage Way',
         'Valley Storage', None, 'independent', 'drive_up',
         22000, 20000, 140, 1, 2008, False, 0, 80, 55, 140, 4.1, 28),
        ('WV', '54065', 'Berkeley Springs', '25411', '200 Spa Rd',
         'Morgan County Storage', None, 'independent', 'drive_up',
         18000, 16000, 110, 1, 2012, False, 0, 65, 45, 110, 3.9, 19),
    ]

    for f in facilities:
        cur.execute('''
            INSERT INTO storage_facilities (
                state, county_fips, city, zip, address,
                name, brand, brand_type, facility_type,
                total_sqft, rentable_sqft, unit_count, stories, year_built,
                has_climate_control, climate_sqft, asking_rent_10x10, rate_5x10, asking_rent_10x20,
                rating, review_count
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        ''', f)

    print('  [OK] {} sample facilities inserted'.format(len(facilities)))

    # Sample demographics
    demographics = [
        ('county', '54003', 'Berkeley County', 'WV',
         122000, 45000, 280, 38.5, 22.0, 28.0, 30.0,
         48000, 45000, 31000, 14000, 31.1,
         32000, 4500, 6200, 1800, 3500,
         62000, 78000, 5500, 3200, 2100, 10800, 8.9, 1200, 8500, 2022, 'acs_5yr'),
        ('county', '54037', 'Jefferson County', 'WV',
         58000, 22000, 195, 42.0, 18.0, 26.0, 35.0,
         24000, 22000, 16500, 5500, 25.0,
         16000, 2200, 2800, 800, 2200,
         72000, 92000, 2200, 1800, 1500, 5500, 9.5, 600, 5200, 2022, 'acs_5yr'),
        ('county', '54065', 'Morgan County', 'WV',
         18000, 7200, 45, 48.0, 14.0, 24.0, 42.0,
         9500, 7200, 5800, 1400, 19.4,
         6200, 400, 350, 150, 2400,
         48000, 58000, 600, 400, 300, 1300, 7.2, 100, 2100, 2022, 'acs_5yr'),
    ]

    for d in demographics:
        cur.execute('''
            INSERT INTO market_demographics (
                geo_type, geo_id, geo_name, state,
                population, households, population_density, median_age, pct_18_34, pct_35_54, pct_55_plus,
                total_housing_units, occupied_units, owner_occupied, renter_occupied, renter_pct,
                sfh_units, townhome_units, apartment_units, condo_units, mobile_home_units,
                median_income, mean_income, moved_within_county, moved_from_other_county, moved_from_other_state,
                total_movers, mover_pct, military_population, veteran_population, data_year, data_source
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (geo_type, geo_id) DO NOTHING
        ''', d)

    print('  [OK] {} sample demographics inserted'.format(len(demographics)))


def run_test(cur):
    """Run market analysis test."""
    print('\nRunning market analysis test...')

    # Analyze all markets
    cur.execute('SELECT * FROM analyze_all_markets()')
    results = cur.fetchall()

    print('\nMarket Analysis Results:')
    for r in results:
        print(f'  {r[1]} ({r[0]}):')
        print(f'    Sq Ft/Capita: {r[3]}, Saturation: {r[4]}')
        print(f'    Health Score: {r[5]}, Rating: {r[6]}')

    # Show market overview
    print('\nMarket Overview:')
    cur.execute('SELECT county, sqft_per_cap, saturation_icon, saturation_level, health_score, health, rent_10x10 FROM v_market_overview')
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]} sqft/cap {row[2]} {row[3]}, Health: {row[4]} ({row[5]}), Rent: ${row[6]}')

    # Show demand drivers
    print('\nDemand Drivers:')
    cur.execute('SELECT county, high_demand_units, high_demand_pct, renter_pct FROM v_demand_drivers')
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]} high-demand units ({row[2]}%), {row[3]}% renters')

    # Show competitive landscape
    print('\nCompetitive Landscape:')
    cur.execute('SELECT county_fips, operator, facility_count, total_sqft, avg_rent FROM v_competitive_landscape')
    for row in cur.fetchall():
        print(f'  {row[0]} - {row[1]}: {row[2]} facilities, {row[3]:,} sqft, ${row[4]} avg rent')

    # Show opportunity ranking
    print('\nOpportunity Ranking:')
    cur.execute('SELECT rank, county, sqft_per_capita, saturation_level, market_health_score FROM v_market_opportunity_ranking')
    for row in cur.fetchall():
        print(f'  #{row[0]} {row[1]}: {row[2]} sqft/cap, {row[3]}, Health: {row[4]}')


def main():
    conn = psycopg2.connect(CONNECTION_STRING)
    conn.autocommit = True
    cur = conn.cursor()

    print('='*70)
    print('PROMPT 14: CURRENT STATE MARKET MODEL')
    print('='*70)

    # Create tables
    create_storage_facilities_table(cur)
    create_market_demographics_table(cur)
    create_market_analysis_table(cur)

    # Create functions
    create_supply_metrics_function(cur)
    create_demand_metrics_function(cur)
    create_analyze_market_function(cur)
    create_analyze_all_markets_function(cur)

    # Create views
    create_views(cur)

    # Insert sample data and test
    insert_sample_data(cur)
    run_test(cur)

    print('\n' + '='*70)
    print('SETUP COMPLETE')
    print('='*70)
    print('\nTables created:')
    print('  - storage_facilities')
    print('  - market_demographics')
    print('  - market_analysis')
    print('\nFunctions created:')
    print('  - calculate_supply_metrics(geo_type, geo_id)')
    print('  - calculate_demand_metrics(geo_type, geo_id)')
    print('  - analyze_market(geo_type, geo_id, geo_name, state)')
    print('  - analyze_all_markets()')
    print('\nViews created:')
    print('  - v_market_overview')
    print('  - v_demand_drivers')
    print('  - v_supply_detail')
    print('  - v_competitive_landscape')
    print('  - v_market_opportunity_ranking')
    print('\nSaturation levels:')
    print('  [GREEN] undersupplied (<4 sqft/cap) - Strong opportunity')
    print('  [YELLOW] balanced (4-7 sqft/cap) - Normal market')
    print('  [ORANGE] oversupplied (7-10 sqft/cap) - Caution')
    print('  [RED] saturated (>10 sqft/cap) - Avoid')

    conn.close()


if __name__ == '__main__':
    main()
