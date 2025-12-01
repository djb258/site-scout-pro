"""
Prompt 21: Rental Rate Intelligence
Creates comprehensive rate collection, normalization, and scoring system for competitive pricing data.

Tables: rate_observations, facility_rate_summary, market_rate_benchmarks
Functions: normalize_rate_observation (trigger), update_facility_rate_summary,
           calculate_market_rate_benchmark, import_rate_call_result, get_stale_rate_facilities,
           calculate_rate_score
Views: v_rate_collection_status, v_facility_rates, v_market_rate_comparison
"""

import psycopg2
from datetime import datetime
import json

# Database connection
DATABASE_URL = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def create_rate_observations_table(cur):
    """Create rate_observations table for individual rate data points."""
    print("Creating rate_observations table...")

    cur.execute("DROP TABLE IF EXISTS rate_observations CASCADE;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS rate_observations (
            id SERIAL PRIMARY KEY,

            -- Facility linkage
            facility_id INT REFERENCES storage_facilities(id),

            -- Collection info
            collection_method VARCHAR(50) NOT NULL,
            collection_date DATE NOT NULL,
            collected_by VARCHAR(100),
            call_id VARCHAR(100),
            call_duration_seconds INT,
            call_recording_url VARCHAR(500),

            -- Unit details
            unit_size VARCHAR(20) NOT NULL,
            unit_sqft INT,
            is_climate_control BOOLEAN DEFAULT FALSE,
            is_drive_up BOOLEAN,
            is_interior BOOLEAN,
            floor_level VARCHAR(20),

            -- Pricing
            advertised_rate DECIMAL(8,2),
            web_rate DECIMAL(8,2),
            walk_in_rate DECIMAL(8,2),

            -- Promos
            has_promo BOOLEAN DEFAULT FALSE,
            promo_description TEXT,
            promo_months INT,
            promo_discount_pct DECIMAL(5,2),
            effective_rate_with_promo DECIMAL(8,2),

            -- Fees
            admin_fee DECIMAL(8,2),
            insurance_required BOOLEAN,
            insurance_monthly DECIMAL(8,2),

            -- Availability
            is_available BOOLEAN,
            units_available INT,
            waitlist BOOLEAN,

            -- Normalized
            rate_per_sqft DECIMAL(6,2),
            effective_rate_per_sqft DECIMAL(6,2),

            -- Quality flags
            confidence VARCHAR(20),
            needs_verification BOOLEAN DEFAULT FALSE,
            verification_notes TEXT,

            -- Raw data
            raw_response JSONB,

            -- Metadata
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(facility_id, unit_size, is_climate_control, collection_date, collection_method)
        );

        CREATE INDEX idx_ro_facility ON rate_observations(facility_id);
        CREATE INDEX idx_ro_date ON rate_observations(collection_date);
        CREATE INDEX idx_ro_size ON rate_observations(unit_size);
        CREATE INDEX idx_ro_method ON rate_observations(collection_method);
    """)

    print("  Created rate_observations table")


def create_facility_rate_summary_table(cur):
    """Create facility_rate_summary table for current best knowledge per facility."""
    print("Creating facility_rate_summary table...")

    cur.execute("DROP TABLE IF EXISTS facility_rate_summary CASCADE;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS facility_rate_summary (
            id SERIAL PRIMARY KEY,

            facility_id INT REFERENCES storage_facilities(id) UNIQUE,

            -- Last update
            last_rate_date DATE,
            last_rate_method VARCHAR(50),
            rate_age_days INT,

            -- Standard unit rates (non-climate)
            rate_5x5 DECIMAL(8,2),
            rate_5x10 DECIMAL(8,2),
            rate_10x10 DECIMAL(8,2),
            rate_10x15 DECIMAL(8,2),
            rate_10x20 DECIMAL(8,2),
            rate_10x30 DECIMAL(8,2),

            -- Climate control rates
            rate_5x5_climate DECIMAL(8,2),
            rate_5x10_climate DECIMAL(8,2),
            rate_10x10_climate DECIMAL(8,2),
            rate_10x15_climate DECIMAL(8,2),
            rate_10x20_climate DECIMAL(8,2),

            -- Per sq ft metrics
            avg_rate_per_sqft DECIMAL(6,2),
            avg_rate_per_sqft_climate DECIMAL(6,2),
            min_rate_per_sqft DECIMAL(6,2),
            max_rate_per_sqft DECIMAL(6,2),

            -- Promo activity
            has_active_promos BOOLEAN,
            typical_promo_type VARCHAR(100),
            promo_aggressiveness VARCHAR(20),

            -- Fees
            admin_fee DECIMAL(8,2),
            requires_insurance BOOLEAN,

            -- Availability snapshot
            availability_status VARCHAR(20),

            -- Pricing position
            pricing_tier VARCHAR(20),

            -- Data quality
            rate_confidence VARCHAR(20),
            data_completeness_pct INT,

            -- Metadata
            updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX idx_frs_facility ON facility_rate_summary(facility_id);
        CREATE INDEX idx_frs_date ON facility_rate_summary(last_rate_date);
    """)

    print("  Created facility_rate_summary table")


def create_market_rate_benchmarks_table(cur):
    """Create market_rate_benchmarks table for geographic aggregations."""
    print("Creating market_rate_benchmarks table...")

    cur.execute("DROP TABLE IF EXISTS market_rate_benchmarks CASCADE;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS market_rate_benchmarks (
            id SERIAL PRIMARY KEY,

            -- Geography
            geo_type VARCHAR(20) NOT NULL,
            geo_id VARCHAR(20) NOT NULL,
            geo_name VARCHAR(100),
            state VARCHAR(2),

            benchmark_date DATE DEFAULT CURRENT_DATE,

            -- Sample info
            facility_count INT,
            facilities_with_rates INT,
            rate_observation_count INT,

            -- 10x10 Non-Climate (baseline)
            avg_10x10 DECIMAL(8,2),
            median_10x10 DECIMAL(8,2),
            min_10x10 DECIMAL(8,2),
            max_10x10 DECIMAL(8,2),
            stddev_10x10 DECIMAL(8,2),

            -- 10x10 Climate
            avg_10x10_climate DECIMAL(8,2),
            median_10x10_climate DECIMAL(8,2),
            climate_premium_pct DECIMAL(5,2),

            -- Per sq ft metrics
            avg_rate_per_sqft DECIMAL(6,2),
            median_rate_per_sqft DECIMAL(6,2),

            -- Rate spread
            rate_spread_pct DECIMAL(5,2),

            -- Promo prevalence
            pct_facilities_with_promos DECIMAL(5,2),
            avg_promo_discount_pct DECIMAL(5,2),

            -- Trend (if historical data)
            yoy_rate_change_pct DECIMAL(5,2),

            -- Confidence
            benchmark_confidence VARCHAR(20),

            -- Metadata
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(geo_type, geo_id, benchmark_date)
        );

        CREATE INDEX idx_mrb_geo ON market_rate_benchmarks(geo_type, geo_id);
    """)

    print("  Created market_rate_benchmarks table")


def create_rate_normalization_trigger(cur):
    """Create trigger to normalize rate observations on insert/update."""
    print("Creating rate normalization trigger...")

    cur.execute("DROP FUNCTION IF EXISTS normalize_rate_observation() CASCADE;")

    cur.execute("""
        CREATE OR REPLACE FUNCTION normalize_rate_observation()
        RETURNS TRIGGER AS $func$
        BEGIN
            -- Calculate unit square footage
            NEW.unit_sqft := CASE NEW.unit_size
                WHEN '5x5' THEN 25
                WHEN '5x10' THEN 50
                WHEN '10x10' THEN 100
                WHEN '10x15' THEN 150
                WHEN '10x20' THEN 200
                WHEN '10x30' THEN 300
                WHEN '10x25' THEN 250
                WHEN '15x20' THEN 300
                WHEN '20x20' THEN 400
                ELSE
                    CASE
                        WHEN NEW.unit_size ~ '^[0-9]+x[0-9]+$' THEN
                            (SPLIT_PART(NEW.unit_size, 'x', 1)::INT * SPLIT_PART(NEW.unit_size, 'x', 2)::INT)
                        ELSE 100  -- Default to 100 sqft
                    END
            END;

            -- Calculate rate per sq ft
            IF NEW.unit_sqft > 0 AND NEW.advertised_rate IS NOT NULL THEN
                NEW.rate_per_sqft := ROUND(NEW.advertised_rate / NEW.unit_sqft, 2);
            END IF;

            -- Calculate effective rate with promos
            IF NEW.has_promo AND COALESCE(NEW.promo_months, 0) > 0 AND COALESCE(NEW.promo_discount_pct, 0) > 0 THEN
                -- Amortize promo over 12 months
                NEW.effective_rate_with_promo := NEW.advertised_rate * (1 - (NEW.promo_discount_pct / 100.0 * NEW.promo_months / 12.0));
                IF NEW.unit_sqft > 0 THEN
                    NEW.effective_rate_per_sqft := ROUND(NEW.effective_rate_with_promo / NEW.unit_sqft, 2);
                END IF;
            ELSE
                NEW.effective_rate_with_promo := NEW.advertised_rate;
                NEW.effective_rate_per_sqft := NEW.rate_per_sqft;
            END IF;

            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_normalize_rate
        BEFORE INSERT OR UPDATE ON rate_observations
        FOR EACH ROW EXECUTE FUNCTION normalize_rate_observation();
    """)

    print("  Created rate normalization trigger")


def create_update_facility_rate_summary_function(cur):
    """Create function to update facility rate summary from observations."""
    print("Creating update_facility_rate_summary function...")

    cur.execute("DROP FUNCTION IF EXISTS update_facility_rate_summary(INT);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION update_facility_rate_summary(p_facility_id INT)
        RETURNS VOID AS $func$
        DECLARE
            v_latest RECORD;
            v_rates RECORD;
            v_completeness INT;
        BEGIN
            -- Get latest rate info
            SELECT
                MAX(collection_date) as last_date,
                (ARRAY_AGG(collection_method ORDER BY collection_date DESC))[1] as last_method
            INTO v_latest
            FROM rate_observations
            WHERE facility_id = p_facility_id;

            IF v_latest.last_date IS NULL THEN
                RETURN;  -- No observations for this facility
            END IF;

            -- Aggregate rates from last 90 days
            SELECT
                MAX(CASE WHEN unit_size = '5x5' AND NOT COALESCE(is_climate_control, FALSE) THEN advertised_rate END) as r_5x5,
                MAX(CASE WHEN unit_size = '5x10' AND NOT COALESCE(is_climate_control, FALSE) THEN advertised_rate END) as r_5x10,
                MAX(CASE WHEN unit_size = '10x10' AND NOT COALESCE(is_climate_control, FALSE) THEN advertised_rate END) as r_10x10,
                MAX(CASE WHEN unit_size = '10x15' AND NOT COALESCE(is_climate_control, FALSE) THEN advertised_rate END) as r_10x15,
                MAX(CASE WHEN unit_size = '10x20' AND NOT COALESCE(is_climate_control, FALSE) THEN advertised_rate END) as r_10x20,
                MAX(CASE WHEN unit_size = '10x30' AND NOT COALESCE(is_climate_control, FALSE) THEN advertised_rate END) as r_10x30,
                MAX(CASE WHEN unit_size = '5x5' AND is_climate_control THEN advertised_rate END) as r_5x5_cc,
                MAX(CASE WHEN unit_size = '5x10' AND is_climate_control THEN advertised_rate END) as r_5x10_cc,
                MAX(CASE WHEN unit_size = '10x10' AND is_climate_control THEN advertised_rate END) as r_10x10_cc,
                MAX(CASE WHEN unit_size = '10x15' AND is_climate_control THEN advertised_rate END) as r_10x15_cc,
                MAX(CASE WHEN unit_size = '10x20' AND is_climate_control THEN advertised_rate END) as r_10x20_cc,
                AVG(rate_per_sqft) FILTER (WHERE NOT COALESCE(is_climate_control, FALSE)) as avg_psf,
                AVG(rate_per_sqft) FILTER (WHERE is_climate_control) as avg_psf_cc,
                MIN(rate_per_sqft) as min_psf,
                MAX(rate_per_sqft) as max_psf,
                BOOL_OR(has_promo) as has_promos,
                MAX(admin_fee) as admin
            INTO v_rates
            FROM rate_observations
            WHERE facility_id = p_facility_id
            AND collection_date >= CURRENT_DATE - INTERVAL '90 days';

            -- Calculate completeness (6 standard sizes)
            v_completeness := (
                (CASE WHEN v_rates.r_5x5 IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN v_rates.r_5x10 IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN v_rates.r_10x10 IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN v_rates.r_10x15 IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN v_rates.r_10x20 IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN v_rates.r_10x30 IS NOT NULL THEN 1 ELSE 0 END)
            ) * 100 / 6;

            -- Upsert summary
            INSERT INTO facility_rate_summary (
                facility_id, last_rate_date, last_rate_method, rate_age_days,
                rate_5x5, rate_5x10, rate_10x10, rate_10x15, rate_10x20, rate_10x30,
                rate_5x5_climate, rate_5x10_climate, rate_10x10_climate, rate_10x15_climate, rate_10x20_climate,
                avg_rate_per_sqft, avg_rate_per_sqft_climate, min_rate_per_sqft, max_rate_per_sqft,
                has_active_promos, admin_fee, data_completeness_pct, updated_at
            ) VALUES (
                p_facility_id, v_latest.last_date, v_latest.last_method,
                CURRENT_DATE - v_latest.last_date,
                v_rates.r_5x5, v_rates.r_5x10, v_rates.r_10x10, v_rates.r_10x15, v_rates.r_10x20, v_rates.r_10x30,
                v_rates.r_5x5_cc, v_rates.r_5x10_cc, v_rates.r_10x10_cc, v_rates.r_10x15_cc, v_rates.r_10x20_cc,
                v_rates.avg_psf, v_rates.avg_psf_cc, v_rates.min_psf, v_rates.max_psf,
                v_rates.has_promos, v_rates.admin, v_completeness, NOW()
            )
            ON CONFLICT (facility_id) DO UPDATE SET
                last_rate_date = EXCLUDED.last_rate_date,
                last_rate_method = EXCLUDED.last_rate_method,
                rate_age_days = EXCLUDED.rate_age_days,
                rate_5x5 = EXCLUDED.rate_5x5,
                rate_5x10 = EXCLUDED.rate_5x10,
                rate_10x10 = EXCLUDED.rate_10x10,
                rate_10x15 = EXCLUDED.rate_10x15,
                rate_10x20 = EXCLUDED.rate_10x20,
                rate_10x30 = EXCLUDED.rate_10x30,
                rate_5x5_climate = EXCLUDED.rate_5x5_climate,
                rate_5x10_climate = EXCLUDED.rate_5x10_climate,
                rate_10x10_climate = EXCLUDED.rate_10x10_climate,
                rate_10x15_climate = EXCLUDED.rate_10x15_climate,
                rate_10x20_climate = EXCLUDED.rate_10x20_climate,
                avg_rate_per_sqft = EXCLUDED.avg_rate_per_sqft,
                avg_rate_per_sqft_climate = EXCLUDED.avg_rate_per_sqft_climate,
                min_rate_per_sqft = EXCLUDED.min_rate_per_sqft,
                max_rate_per_sqft = EXCLUDED.max_rate_per_sqft,
                has_active_promos = EXCLUDED.has_active_promos,
                admin_fee = EXCLUDED.admin_fee,
                data_completeness_pct = EXCLUDED.data_completeness_pct,
                updated_at = NOW();
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created update_facility_rate_summary function")


def create_market_rate_benchmark_function(cur):
    """Create function to calculate market-level rate benchmarks."""
    print("Creating calculate_market_rate_benchmark function...")

    cur.execute("DROP FUNCTION IF EXISTS calculate_market_rate_benchmark(VARCHAR, VARCHAR);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION calculate_market_rate_benchmark(
            p_geo_type VARCHAR(20),
            p_geo_id VARCHAR(20)
        )
        RETURNS INT AS $func$
        DECLARE
            v_benchmark_id INT;
            v_stats RECORD;
            v_geo_name VARCHAR(100);
            v_state VARCHAR(2);
        BEGIN
            -- Get geo info
            IF p_geo_type = 'county' THEN
                SELECT county_name, state INTO v_geo_name, v_state
                FROM layer_3_counties WHERE county_fips = p_geo_id LIMIT 1;
            END IF;

            -- Calculate stats from recent observations
            SELECT
                COUNT(DISTINCT ro.facility_id) as facility_count,
                COUNT(DISTINCT ro.facility_id) FILTER (WHERE ro.advertised_rate IS NOT NULL) as with_rates,
                COUNT(*) as observation_count,
                -- 10x10 non-climate
                AVG(ro.advertised_rate) FILTER (WHERE ro.unit_size = '10x10' AND NOT COALESCE(ro.is_climate_control, FALSE)) as avg_10x10,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ro.advertised_rate)
                    FILTER (WHERE ro.unit_size = '10x10' AND NOT COALESCE(ro.is_climate_control, FALSE)) as median_10x10,
                MIN(ro.advertised_rate) FILTER (WHERE ro.unit_size = '10x10' AND NOT COALESCE(ro.is_climate_control, FALSE)) as min_10x10,
                MAX(ro.advertised_rate) FILTER (WHERE ro.unit_size = '10x10' AND NOT COALESCE(ro.is_climate_control, FALSE)) as max_10x10,
                STDDEV(ro.advertised_rate) FILTER (WHERE ro.unit_size = '10x10' AND NOT COALESCE(ro.is_climate_control, FALSE)) as stddev_10x10,
                -- 10x10 climate
                AVG(ro.advertised_rate) FILTER (WHERE ro.unit_size = '10x10' AND ro.is_climate_control) as avg_10x10_cc,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ro.advertised_rate)
                    FILTER (WHERE ro.unit_size = '10x10' AND ro.is_climate_control) as median_10x10_cc,
                -- Per sq ft
                AVG(ro.rate_per_sqft) as avg_psf,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ro.rate_per_sqft) as median_psf,
                -- Promos
                COUNT(DISTINCT ro.facility_id) FILTER (WHERE ro.has_promo)::DECIMAL /
                    NULLIF(COUNT(DISTINCT ro.facility_id), 0) * 100 as promo_pct,
                AVG(ro.promo_discount_pct) FILTER (WHERE ro.has_promo) as avg_promo_discount
            INTO v_stats
            FROM rate_observations ro
            JOIN storage_facilities sf ON ro.facility_id = sf.id
            WHERE
                CASE
                    WHEN p_geo_type = 'county' THEN sf.county_fips = p_geo_id
                    WHEN p_geo_type = 'zip' THEN sf.zip = p_geo_id
                    ELSE FALSE
                END
            AND ro.collection_date >= CURRENT_DATE - INTERVAL '90 days';

            -- Insert or update benchmark
            INSERT INTO market_rate_benchmarks (
                geo_type, geo_id, geo_name, state, benchmark_date,
                facility_count, facilities_with_rates, rate_observation_count,
                avg_10x10, median_10x10, min_10x10, max_10x10, stddev_10x10,
                avg_10x10_climate, median_10x10_climate, climate_premium_pct,
                avg_rate_per_sqft, median_rate_per_sqft,
                rate_spread_pct,
                pct_facilities_with_promos, avg_promo_discount_pct,
                benchmark_confidence
            ) VALUES (
                p_geo_type, p_geo_id, v_geo_name, v_state, CURRENT_DATE,
                v_stats.facility_count, v_stats.with_rates, v_stats.observation_count,
                ROUND(v_stats.avg_10x10::NUMERIC, 2), ROUND(v_stats.median_10x10::NUMERIC, 2),
                ROUND(v_stats.min_10x10::NUMERIC, 2), ROUND(v_stats.max_10x10::NUMERIC, 2), ROUND(v_stats.stddev_10x10::NUMERIC, 2),
                ROUND(v_stats.avg_10x10_cc::NUMERIC, 2), ROUND(v_stats.median_10x10_cc::NUMERIC, 2),
                CASE WHEN v_stats.avg_10x10 > 0
                     THEN ROUND(((v_stats.avg_10x10_cc - v_stats.avg_10x10) / v_stats.avg_10x10 * 100)::NUMERIC, 1)
                     ELSE NULL END,
                ROUND(v_stats.avg_psf::NUMERIC, 2), ROUND(v_stats.median_psf::NUMERIC, 2),
                CASE WHEN v_stats.avg_10x10 > 0
                     THEN ROUND(((v_stats.max_10x10 - v_stats.min_10x10) / v_stats.avg_10x10 * 100)::NUMERIC, 1)
                     ELSE NULL END,
                ROUND(v_stats.promo_pct::NUMERIC, 1), ROUND(v_stats.avg_promo_discount::NUMERIC, 1),
                CASE
                    WHEN v_stats.with_rates >= 5 THEN 'high'
                    WHEN v_stats.with_rates >= 3 THEN 'medium'
                    ELSE 'low'
                END
            )
            ON CONFLICT (geo_type, geo_id, benchmark_date) DO UPDATE SET
                avg_10x10 = EXCLUDED.avg_10x10,
                median_10x10 = EXCLUDED.median_10x10,
                min_10x10 = EXCLUDED.min_10x10,
                max_10x10 = EXCLUDED.max_10x10,
                facility_count = EXCLUDED.facility_count,
                facilities_with_rates = EXCLUDED.facilities_with_rates,
                benchmark_confidence = EXCLUDED.benchmark_confidence,
                avg_rate_per_sqft = EXCLUDED.avg_rate_per_sqft,
                rate_spread_pct = EXCLUDED.rate_spread_pct,
                pct_facilities_with_promos = EXCLUDED.pct_facilities_with_promos
            RETURNING id INTO v_benchmark_id;

            -- Update market_analysis with benchmark if available
            IF v_stats.avg_10x10 IS NOT NULL THEN
                UPDATE market_analysis SET
                    avg_rent_10x10 = v_stats.avg_10x10,
                    median_rent_10x10 = v_stats.median_10x10,
                    min_rent_10x10 = v_stats.min_10x10,
                    max_rent_10x10 = v_stats.max_10x10,
                    rent_per_sqft = ROUND((v_stats.avg_10x10 / 100)::NUMERIC, 2)
                WHERE geo_type = p_geo_type AND geo_id = p_geo_id;
            END IF;

            RETURN v_benchmark_id;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created calculate_market_rate_benchmark function")


def create_import_rate_call_result_function(cur):
    """Create function to import rate data from AI calls (Bland/Vapi)."""
    print("Creating import_rate_call_result function...")

    cur.execute("DROP FUNCTION IF EXISTS import_rate_call_result(JSONB);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION import_rate_call_result(p_call_data JSONB)
        RETURNS INT AS $func$
        DECLARE
            v_facility_id INT;
            v_observation_id INT;
            v_rate RECORD;
        BEGIN
            -- Find facility by phone or name
            SELECT id INTO v_facility_id
            FROM storage_facilities
            WHERE
                (p_call_data->>'facility_phone' IS NOT NULL AND phone_number = p_call_data->>'facility_phone')
                OR (p_call_data->>'facility_name' IS NOT NULL AND name ILIKE '%' || (p_call_data->>'facility_name') || '%')
            LIMIT 1;

            IF v_facility_id IS NULL THEN
                RAISE WARNING 'Facility not found for call data: %', p_call_data->>'facility_name';
                RETURN NULL;
            END IF;

            -- Insert each rate from the call
            FOR v_rate IN SELECT value FROM jsonb_array_elements(p_call_data->'rates')
            LOOP
                INSERT INTO rate_observations (
                    facility_id,
                    collection_method,
                    collection_date,
                    call_id,
                    call_duration_seconds,
                    call_recording_url,
                    unit_size,
                    is_climate_control,
                    advertised_rate,
                    has_promo,
                    promo_description,
                    promo_months,
                    promo_discount_pct,
                    admin_fee,
                    is_available,
                    units_available,
                    confidence,
                    raw_response
                ) VALUES (
                    v_facility_id,
                    'ai_call',
                    CURRENT_DATE,
                    p_call_data->>'call_id',
                    (p_call_data->>'duration_seconds')::INT,
                    p_call_data->>'recording_url',
                    v_rate.value->>'unit_size',
                    COALESCE((v_rate.value->>'is_climate')::BOOLEAN, FALSE),
                    (v_rate.value->>'rate')::DECIMAL,
                    COALESCE((v_rate.value->>'has_promo')::BOOLEAN, FALSE),
                    v_rate.value->>'promo_description',
                    (v_rate.value->>'promo_months')::INT,
                    (v_rate.value->>'promo_discount_pct')::DECIMAL,
                    (p_call_data->>'admin_fee')::DECIMAL,
                    (v_rate.value->>'available')::BOOLEAN,
                    (v_rate.value->>'units_available')::INT,
                    COALESCE(p_call_data->>'confidence', 'medium'),
                    p_call_data
                )
                ON CONFLICT DO NOTHING
                RETURNING id INTO v_observation_id;
            END LOOP;

            -- Update facility summary
            PERFORM update_facility_rate_summary(v_facility_id);

            RETURN v_facility_id;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created import_rate_call_result function")


def create_stale_facilities_function(cur):
    """Create function to get facilities needing rate collection."""
    print("Creating get_stale_rate_facilities function...")

    cur.execute("DROP FUNCTION IF EXISTS get_stale_rate_facilities(VARCHAR, INT);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION get_stale_rate_facilities(
            p_county_fips VARCHAR(5),
            p_max_age_days INT DEFAULT 30
        )
        RETURNS TABLE(
            facility_id INT,
            facility_name VARCHAR,
            city VARCHAR,
            phone VARCHAR,
            last_rate_date DATE,
            rate_age_days INT,
            has_any_rates BOOLEAN
        ) AS $func$
        BEGIN
            RETURN QUERY
            SELECT
                sf.id,
                sf.name::VARCHAR,
                sf.city::VARCHAR,
                sf.phone_number::VARCHAR,
                frs.last_rate_date,
                COALESCE(frs.rate_age_days, 9999),
                frs.last_rate_date IS NOT NULL
            FROM storage_facilities sf
            LEFT JOIN facility_rate_summary frs ON sf.id = frs.facility_id
            WHERE sf.county_fips = p_county_fips
            AND (frs.last_rate_date IS NULL OR frs.rate_age_days > p_max_age_days)
            ORDER BY frs.rate_age_days DESC NULLS FIRST;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created get_stale_rate_facilities function")


def create_rate_score_function(cur):
    """Create function to calculate rate score for scoring integration."""
    print("Creating calculate_rate_score function...")

    cur.execute("DROP FUNCTION IF EXISTS calculate_rate_score(VARCHAR);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION calculate_rate_score(p_county_fips VARCHAR(5))
        RETURNS INT AS $func$
        DECLARE
            v_benchmark market_rate_benchmarks%ROWTYPE;
            v_score INT := 50;
        BEGIN
            SELECT * INTO v_benchmark
            FROM market_rate_benchmarks
            WHERE geo_type = 'county' AND geo_id = p_county_fips
            ORDER BY benchmark_date DESC LIMIT 1;

            IF NOT FOUND THEN
                RETURN 50;  -- Default if no data
            END IF;

            -- Score based on rent level (higher = better for new entrant margin)
            v_score := CASE
                WHEN v_benchmark.avg_10x10 >= 120 THEN 100
                WHEN v_benchmark.avg_10x10 >= 100 THEN 85
                WHEN v_benchmark.avg_10x10 >= 85 THEN 70
                WHEN v_benchmark.avg_10x10 >= 70 THEN 55
                WHEN v_benchmark.avg_10x10 >= 60 THEN 40
                ELSE 25
            END;

            -- Adjust for rate spread (lower spread = more competitive, harder market)
            IF v_benchmark.rate_spread_pct < 20 THEN
                v_score := v_score - 10;
            ELSIF v_benchmark.rate_spread_pct > 40 THEN
                v_score := v_score + 5;
            END IF;

            -- Adjust for promo aggressiveness (high promos = soft market)
            IF v_benchmark.pct_facilities_with_promos > 60 THEN
                v_score := v_score - 15;
            ELSIF v_benchmark.pct_facilities_with_promos > 40 THEN
                v_score := v_score - 5;
            END IF;

            RETURN LEAST(GREATEST(v_score, 0), 100);
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created calculate_rate_score function")


def create_rate_views(cur):
    """Create views for rate monitoring and analysis."""
    print("Creating rate views...")

    # Rate collection status view
    cur.execute("DROP VIEW IF EXISTS v_rate_collection_status CASCADE;")
    cur.execute("""
        CREATE OR REPLACE VIEW v_rate_collection_status AS
        SELECT
            sf.state,
            sf.county_fips,
            c.county_name,
            COUNT(*) as total_facilities,
            COUNT(frs.id) as facilities_with_rates,
            COUNT(frs.id) FILTER (WHERE frs.rate_age_days <= 30) as fresh_rates,
            COUNT(frs.id) FILTER (WHERE frs.rate_age_days > 30 AND frs.rate_age_days <= 90) as stale_rates,
            COUNT(*) - COUNT(frs.id) as no_rates,
            ROUND(COUNT(frs.id)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1) as coverage_pct,
            ROUND(AVG(frs.data_completeness_pct), 1) as avg_completeness
        FROM storage_facilities sf
        LEFT JOIN facility_rate_summary frs ON sf.id = frs.facility_id
        LEFT JOIN layer_3_counties c ON sf.county_fips = c.county_fips
        GROUP BY sf.state, sf.county_fips, c.county_name
        ORDER BY sf.state, c.county_name;
    """)

    # Facility rates detail view
    cur.execute("DROP VIEW IF EXISTS v_facility_rates CASCADE;")
    cur.execute("""
        CREATE OR REPLACE VIEW v_facility_rates AS
        SELECT
            sf.state,
            c.county_name,
            sf.city,
            sf.name as facility_name,
            frs.rate_5x5,
            frs.rate_5x10,
            frs.rate_10x10,
            frs.rate_10x15,
            frs.rate_10x20,
            frs.rate_10x10_climate,
            ROUND(frs.avg_rate_per_sqft, 2) as avg_per_sqft,
            frs.has_active_promos,
            frs.last_rate_date,
            frs.rate_age_days,
            CASE
                WHEN frs.rate_age_days IS NULL THEN 'No Data'
                WHEN frs.rate_age_days <= 7 THEN 'Fresh'
                WHEN frs.rate_age_days <= 30 THEN 'Recent'
                WHEN frs.rate_age_days <= 90 THEN 'Stale'
                ELSE 'Very Stale'
            END as freshness,
            frs.data_completeness_pct as completeness
        FROM storage_facilities sf
        LEFT JOIN facility_rate_summary frs ON sf.id = frs.facility_id
        LEFT JOIN layer_3_counties c ON sf.county_fips = c.county_fips
        ORDER BY sf.state, c.county_name, sf.name;
    """)

    # Market rate comparison view
    cur.execute("DROP VIEW IF EXISTS v_market_rate_comparison CASCADE;")
    cur.execute("""
        CREATE OR REPLACE VIEW v_market_rate_comparison AS
        SELECT
            geo_name as county,
            state,
            facility_count,
            facilities_with_rates,
            '$' || ROUND(avg_10x10)::INT as avg_10x10,
            '$' || ROUND(median_10x10)::INT as median_10x10,
            '$' || ROUND(min_10x10)::INT || '-$' || ROUND(max_10x10)::INT as range_10x10,
            ROUND(rate_spread_pct, 0) || '%' as spread,
            '$' || ROUND(avg_10x10_climate)::INT as avg_10x10_cc,
            ROUND(climate_premium_pct, 0) || '%' as cc_premium,
            ROUND(pct_facilities_with_promos, 0) || '%' as promo_pct,
            benchmark_confidence as confidence,
            benchmark_date
        FROM market_rate_benchmarks
        WHERE geo_type = 'county'
        ORDER BY avg_10x10 DESC NULLS LAST;
    """)

    print("  Created 3 rate views")


def seed_sample_rate_data(cur):
    """Seed sample rate observations for testing."""
    print("Seeding sample rate data...")

    # Get some facility IDs from our WV counties
    cur.execute("""
        SELECT id, name, county_fips FROM storage_facilities
        WHERE county_fips IN ('54003', '54037', '54065')
        ORDER BY county_fips, name
        LIMIT 15;
    """)
    facilities = cur.fetchall()

    if not facilities:
        print("  No facilities found to seed rate data")
        return

    # Sample rate data for different unit sizes
    rate_data = [
        # (unit_size, base_rate, climate_premium)
        ('5x5', 55, 15),
        ('5x10', 75, 20),
        ('10x10', 95, 30),
        ('10x15', 125, 35),
        ('10x20', 165, 45),
        ('10x30', 220, 0),  # No climate for large units
    ]

    observations_inserted = 0
    for facility_id, name, county_fips in facilities:
        # Base rate modifier by county (Berkeley higher, Morgan lower)
        county_mod = {'54003': 1.0, '54037': 1.05, '54065': 0.75}.get(county_fips, 1.0)

        for unit_size, base_rate, climate_premium in rate_data:
            # Non-climate rate
            rate = round(base_rate * county_mod + (hash(name) % 20 - 10))  # Add some variation

            cur.execute("""
                INSERT INTO rate_observations (
                    facility_id, collection_method, collection_date, unit_size,
                    is_climate_control, advertised_rate, has_promo,
                    promo_description, promo_months, promo_discount_pct,
                    is_available, confidence
                ) VALUES (
                    %s, 'manual', CURRENT_DATE, %s,
                    FALSE, %s, %s,
                    %s, %s, %s,
                    TRUE, 'high'
                )
                ON CONFLICT DO NOTHING;
            """, (
                facility_id, unit_size, rate,
                hash(name) % 3 == 0,  # ~33% have promos
                'First month free' if hash(name) % 3 == 0 else None,
                1 if hash(name) % 3 == 0 else None,
                100 if hash(name) % 3 == 0 else None
            ))
            observations_inserted += 1

            # Climate rate (if applicable)
            if climate_premium > 0:
                climate_rate = rate + climate_premium
                cur.execute("""
                    INSERT INTO rate_observations (
                        facility_id, collection_method, collection_date, unit_size,
                        is_climate_control, advertised_rate, is_available, confidence
                    ) VALUES (
                        %s, 'manual', CURRENT_DATE, %s,
                        TRUE, %s, TRUE, 'high'
                    )
                    ON CONFLICT DO NOTHING;
                """, (facility_id, unit_size, climate_rate))
                observations_inserted += 1

    print(f"  Inserted {observations_inserted} rate observations for {len(facilities)} facilities")

    # Update facility summaries
    for facility_id, _, _ in facilities:
        cur.execute("SELECT update_facility_rate_summary(%s);", (facility_id,))

    print("  Updated facility rate summaries")


def run_rate_tests(cur):
    """Test the rate intelligence system."""
    print("\n" + "="*60)
    print("TESTING RATE INTELLIGENCE SYSTEM")
    print("="*60)

    # Check rate observations
    cur.execute("SELECT COUNT(*) FROM rate_observations;")
    obs_count = cur.fetchone()[0]
    print(f"\nRate observations: {obs_count}")

    # Check facility summaries
    cur.execute("SELECT COUNT(*) FROM facility_rate_summary;")
    summary_count = cur.fetchone()[0]
    print(f"Facility summaries: {summary_count}")

    # Calculate benchmarks for our counties
    print("\n--- Calculating Market Benchmarks ---")
    for county_fips in ['54003', '54037', '54065']:
        cur.execute("SELECT calculate_market_rate_benchmark('county', %s);", (county_fips,))
        benchmark_id = cur.fetchone()[0]
        print(f"  Created benchmark ID {benchmark_id} for county {county_fips}")

    # Show rate collection status
    print("\n--- Rate Collection Status ---")
    cur.execute("SELECT * FROM v_rate_collection_status WHERE county_fips IN ('54003', '54037', '54065');")
    status = cur.fetchall()
    print(f"{'State':<6} {'County':<15} {'Total':<8} {'With Rates':<12} {'Fresh':<8} {'Coverage'}")
    print("-" * 65)
    for row in status:
        print(f"{row[0]:<6} {row[2][:14]:<15} {row[3]:<8} {row[4]:<12} {row[5]:<8} {row[9]}%")

    # Show market rate comparison
    print("\n--- Market Rate Comparison ---")
    cur.execute("SELECT * FROM v_market_rate_comparison WHERE state = 'WV';")
    comparison = cur.fetchall()
    if comparison:
        print(f"{'County':<15} {'Avg 10x10':<12} {'Median':<12} {'Range':<15} {'Spread':<10} {'Promos'}")
        print("-" * 80)
        for row in comparison:
            avg = str(row[4]) if row[4] else 'N/A'
            median = str(row[5]) if row[5] else 'N/A'
            range_val = str(row[6]) if row[6] else 'N/A'
            spread = str(row[7]) if row[7] else 'N/A'
            promos = str(row[10]) if row[10] else 'N/A'
            county = row[0][:14] if row[0] else 'Unknown'
            print(f"{county:<15} {avg:<12} {median:<12} {range_val:<15} {spread:<10} {promos}")

    # Test stale facilities function
    print("\n--- Facilities Needing Rate Collection (Berkeley) ---")
    cur.execute("SELECT * FROM get_stale_rate_facilities('54003', 7) LIMIT 5;")
    stale = cur.fetchall()
    if stale:
        print(f"{'Facility':<40} {'City':<15} {'Last Rate':<12} {'Age (days)'}")
        print("-" * 80)
        for row in stale:
            last_date = str(row[4]) if row[4] else 'Never'
            age = str(row[5]) if row[5] != 9999 else 'N/A'
            print(f"{row[1][:38]:<40} {row[2][:14]:<15} {last_date:<12} {age}")
    else:
        print("  All facilities have fresh rates!")

    # Test rate score function
    print("\n--- Rate Scores by County ---")
    for county_fips, county_name in [('54003', 'Berkeley'), ('54037', 'Jefferson'), ('54065', 'Morgan')]:
        cur.execute("SELECT calculate_rate_score(%s);", (county_fips,))
        score = cur.fetchone()[0]
        print(f"  {county_name}: {score}/100")

    # Test import function with sample call data
    print("\n--- Testing AI Call Import ---")
    sample_call = {
        "call_id": "test_call_001",
        "facility_name": "Public Storage",
        "duration_seconds": 180,
        "confidence": "high",
        "admin_fee": 29,
        "rates": [
            {"unit_size": "5x5", "rate": 65, "is_climate": False, "available": True},
            {"unit_size": "10x10", "rate": 115, "is_climate": False, "available": True, "has_promo": True, "promo_description": "First month 50% off", "promo_months": 1, "promo_discount_pct": 50}
        ]
    }

    cur.execute("SELECT import_rate_call_result(%s::JSONB);", (json.dumps(sample_call),))
    result = cur.fetchone()[0]
    if result:
        print(f"  Successfully imported call data for facility ID: {result}")
    else:
        print("  Note: No matching facility found for test call (expected in test)")


def main():
    print("="*60)
    print("PROMPT 21: RENTAL RATE INTELLIGENCE")
    print("="*60)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # Create tables
        create_rate_observations_table(cur)
        create_facility_rate_summary_table(cur)
        create_market_rate_benchmarks_table(cur)
        conn.commit()

        # Create trigger
        create_rate_normalization_trigger(cur)
        conn.commit()

        # Create functions
        create_update_facility_rate_summary_function(cur)
        create_market_rate_benchmark_function(cur)
        create_import_rate_call_result_function(cur)
        create_stale_facilities_function(cur)
        create_rate_score_function(cur)
        conn.commit()

        # Create views
        create_rate_views(cur)
        conn.commit()

        # Seed sample data
        seed_sample_rate_data(cur)
        conn.commit()

        # Run tests
        run_rate_tests(cur)
        conn.commit()

        print("\n" + "="*60)
        print("RATE INTELLIGENCE COMPLETE")
        print("="*60)

        # Summary
        cur.execute("SELECT COUNT(*) FROM rate_observations;")
        obs_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM facility_rate_summary;")
        summary_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM market_rate_benchmarks;")
        benchmark_count = cur.fetchone()[0]

        print(f"\nCreated:")
        print(f"  - rate_observations table ({obs_count} observations)")
        print(f"  - facility_rate_summary table ({summary_count} summaries)")
        print(f"  - market_rate_benchmarks table ({benchmark_count} benchmarks)")
        print(f"  - normalize_rate_observation() trigger")
        print(f"  - update_facility_rate_summary() function")
        print(f"  - calculate_market_rate_benchmark() function")
        print(f"  - import_rate_call_result() function")
        print(f"  - get_stale_rate_facilities() function")
        print(f"  - calculate_rate_score() function")
        print(f"  - 3 rate views")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
