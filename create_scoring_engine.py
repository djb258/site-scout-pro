"""
Prompt 19: Scoring Engine
Creates comprehensive scoring system that combines all data layers into unified market ranking.

Tables: scoring_weights, market_scores
Functions: calculate_market_score, score_all_markets
Views: v_market_leaderboard, v_score_breakdown, v_scoring_inputs, v_tier_summary, v_recommendation_summary
"""

import psycopg2
from datetime import datetime

# Database connection
DATABASE_URL = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def create_scoring_weights_table(cur):
    """Create scoring_weights table for configurable weight sets."""
    print("Creating scoring_weights table...")

    cur.execute("DROP TABLE IF EXISTS scoring_weights CASCADE;")

    cur.execute("""
        CREATE TABLE scoring_weights (
            id SERIAL PRIMARY KEY,
            weight_set_name VARCHAR(50) NOT NULL UNIQUE,
            description TEXT,

            -- Component weights (must sum to 1.0)
            financial_weight DECIMAL(4,3) NOT NULL DEFAULT 0.35,
            market_weight DECIMAL(4,3) NOT NULL DEFAULT 0.25,
            trajectory_weight DECIMAL(4,3) NOT NULL DEFAULT 0.20,
            catalyst_weight DECIMAL(4,3) NOT NULL DEFAULT 0.10,
            regulation_weight DECIMAL(4,3) NOT NULL DEFAULT 0.10,

            -- Sub-component weights for financial (must sum to 1.0)
            yield_weight DECIMAL(4,3) NOT NULL DEFAULT 0.40,
            cushion_weight DECIMAL(4,3) NOT NULL DEFAULT 0.30,
            breakeven_weight DECIMAL(4,3) NOT NULL DEFAULT 0.30,

            -- Sub-component weights for market (must sum to 1.0)
            saturation_weight DECIMAL(4,3) NOT NULL DEFAULT 0.35,
            rent_weight DECIMAL(4,3) NOT NULL DEFAULT 0.35,
            demand_weight DECIMAL(4,3) NOT NULL DEFAULT 0.30,

            -- Sub-component weights for trajectory (must sum to 1.0)
            population_growth_weight DECIMAL(4,3) NOT NULL DEFAULT 0.40,
            income_growth_weight DECIMAL(4,3) NOT NULL DEFAULT 0.30,
            housing_growth_weight DECIMAL(4,3) NOT NULL DEFAULT 0.30,

            -- Tier thresholds
            tier_a_threshold INT NOT NULL DEFAULT 80,
            tier_b_threshold INT NOT NULL DEFAULT 65,
            tier_c_threshold INT NOT NULL DEFAULT 50,
            tier_d_threshold INT NOT NULL DEFAULT 35,

            -- Fatal flaw thresholds
            min_yield_threshold DECIMAL(5,2) NOT NULL DEFAULT 10.00,
            max_saturation_threshold DECIMAL(5,2) NOT NULL DEFAULT 12.00,
            min_cushion_threshold DECIMAL(6,2) NOT NULL DEFAULT 0.00,

            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            CONSTRAINT weights_sum_check CHECK (
                ABS(financial_weight + market_weight + trajectory_weight + catalyst_weight + regulation_weight - 1.0) < 0.01
            ),
            CONSTRAINT financial_sub_check CHECK (
                ABS(yield_weight + cushion_weight + breakeven_weight - 1.0) < 0.01
            ),
            CONSTRAINT market_sub_check CHECK (
                ABS(saturation_weight + rent_weight + demand_weight - 1.0) < 0.01
            ),
            CONSTRAINT trajectory_sub_check CHECK (
                ABS(population_growth_weight + income_growth_weight + housing_growth_weight - 1.0) < 0.01
            )
        );
    """)

    # Insert default weight set
    cur.execute("""
        INSERT INTO scoring_weights (
            weight_set_name, description,
            financial_weight, market_weight, trajectory_weight, catalyst_weight, regulation_weight,
            yield_weight, cushion_weight, breakeven_weight,
            saturation_weight, rent_weight, demand_weight,
            population_growth_weight, income_growth_weight, housing_growth_weight
        ) VALUES (
            'default', 'Standard balanced weighting for storage facility site selection',
            0.35, 0.25, 0.20, 0.10, 0.10,
            0.40, 0.30, 0.30,
            0.35, 0.35, 0.30,
            0.40, 0.30, 0.30
        );
    """)

    # Insert aggressive/financial-focused weight set
    cur.execute("""
        INSERT INTO scoring_weights (
            weight_set_name, description,
            financial_weight, market_weight, trajectory_weight, catalyst_weight, regulation_weight,
            yield_weight, cushion_weight, breakeven_weight,
            saturation_weight, rent_weight, demand_weight,
            population_growth_weight, income_growth_weight, housing_growth_weight,
            is_active
        ) VALUES (
            'financial_focus', 'Aggressive weighting prioritizing financial returns',
            0.50, 0.20, 0.15, 0.10, 0.05,
            0.50, 0.30, 0.20,
            0.35, 0.35, 0.30,
            0.40, 0.30, 0.30,
            false
        );
    """)

    # Insert growth-focused weight set
    cur.execute("""
        INSERT INTO scoring_weights (
            weight_set_name, description,
            financial_weight, market_weight, trajectory_weight, catalyst_weight, regulation_weight,
            yield_weight, cushion_weight, breakeven_weight,
            saturation_weight, rent_weight, demand_weight,
            population_growth_weight, income_growth_weight, housing_growth_weight,
            is_active
        ) VALUES (
            'growth_focus', 'Long-term growth focused weighting',
            0.25, 0.20, 0.30, 0.15, 0.10,
            0.40, 0.30, 0.30,
            0.30, 0.30, 0.40,
            0.50, 0.25, 0.25,
            false
        );
    """)

    print("  Created scoring_weights table with 3 weight sets")


def create_market_scores_table(cur):
    """Create market_scores table for storing calculated scores."""
    print("Creating market_scores table...")

    cur.execute("DROP TABLE IF EXISTS market_scores CASCADE;")

    cur.execute("""
        CREATE TABLE market_scores (
            id SERIAL PRIMARY KEY,
            county_fips VARCHAR(5) NOT NULL REFERENCES layer_3_counties(county_fips),
            weight_set_id INT NOT NULL REFERENCES scoring_weights(id),

            -- Raw input values (for transparency)
            raw_projected_yield DECIMAL(5,2),
            raw_rent_cushion DECIMAL(6,2),
            raw_breakeven_rent DECIMAL(6,2),
            raw_market_rent DECIMAL(6,2),
            raw_saturation_ratio DECIMAL(6,2),
            raw_demand_score DECIMAL(5,2),
            raw_population_growth DECIMAL(5,2),
            raw_income_growth DECIMAL(5,2),
            raw_housing_growth DECIMAL(5,2),
            raw_catalyst_impact DECIMAL(10,2),
            raw_regulation_score DECIMAL(5,2),

            -- Component scores (0-100)
            financial_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            market_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            trajectory_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            catalyst_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            regulation_score DECIMAL(5,2) NOT NULL DEFAULT 0,

            -- Sub-component scores for financial (0-100)
            yield_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            cushion_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            breakeven_score DECIMAL(5,2) NOT NULL DEFAULT 0,

            -- Sub-component scores for market (0-100)
            saturation_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            rent_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            demand_score DECIMAL(5,2) NOT NULL DEFAULT 0,

            -- Sub-component scores for trajectory (0-100)
            population_growth_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            income_growth_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            housing_growth_score DECIMAL(5,2) NOT NULL DEFAULT 0,

            -- Final composite
            composite_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            market_rank INT,

            -- Classification
            tier VARCHAR(1) NOT NULL DEFAULT 'F',
            recommendation VARCHAR(20) NOT NULL DEFAULT 'avoid',

            -- Fatal flaws
            has_fatal_flaw BOOLEAN NOT NULL DEFAULT false,
            fatal_flaw_reasons TEXT[],

            -- Metadata
            scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            data_freshness_days INT,

            UNIQUE(county_fips, weight_set_id)
        );

        CREATE INDEX idx_market_scores_composite ON market_scores(composite_score DESC);
        CREATE INDEX idx_market_scores_tier ON market_scores(tier);
        CREATE INDEX idx_market_scores_recommendation ON market_scores(recommendation);
    """)

    print("  Created market_scores table")


def create_calculate_market_score_function(cur):
    """Create function to calculate market score for a single county."""
    print("Creating calculate_market_score function...")

    cur.execute("DROP FUNCTION IF EXISTS calculate_market_score(VARCHAR, INT);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION calculate_market_score(
            p_county_fips VARCHAR(5),
            p_weight_set_id INT DEFAULT NULL
        )
        RETURNS market_scores AS $func$
        DECLARE
            v_weights scoring_weights%ROWTYPE;
            v_result market_scores%ROWTYPE;
            v_feasibility feasibility_analysis%ROWTYPE;
            v_market market_analysis%ROWTYPE;
            v_projection market_projections%ROWTYPE;
            v_jurisdiction jurisdiction_cards%ROWTYPE;
            v_catalyst_summary RECORD;
            v_fatal_reasons TEXT[] := '{}';
            v_weight_id INT;
        BEGIN
            -- Get active weight set or specified one
            IF p_weight_set_id IS NULL THEN
                SELECT id INTO v_weight_id FROM scoring_weights WHERE is_active = true LIMIT 1;
            ELSE
                v_weight_id := p_weight_set_id;
            END IF;

            SELECT * INTO v_weights FROM scoring_weights WHERE id = v_weight_id;

            IF v_weights IS NULL THEN
                RAISE EXCEPTION 'No scoring weights found';
            END IF;

            -- Get feasibility data
            SELECT * INTO v_feasibility
            FROM feasibility_analysis
            WHERE county_fips = p_county_fips
            ORDER BY created_at DESC LIMIT 1;

            -- Get market analysis data (uses geo_id instead of county_fips)
            SELECT * INTO v_market
            FROM market_analysis
            WHERE geo_id = p_county_fips AND geo_type = 'county'
            ORDER BY analysis_date DESC LIMIT 1;

            -- Get projection data (uses geo_id instead of county_fips)
            SELECT * INTO v_projection
            FROM market_projections
            WHERE geo_id = p_county_fips AND geo_type = 'county'
            ORDER BY projection_date DESC LIMIT 1;

            -- Get jurisdiction data
            SELECT * INTO v_jurisdiction
            FROM jurisdiction_cards
            WHERE county_fips = p_county_fips
            LIMIT 1;

            -- Get catalyst summary
            SELECT
                COALESCE(SUM(storage_demand_sqft), 0) as total_sqft_demand,
                COUNT(*) as catalyst_count
            INTO v_catalyst_summary
            FROM economic_catalysts
            WHERE county_fips = p_county_fips
            AND status IN ('announced', 'planned', 'under_construction');

            -- Initialize result
            v_result.county_fips := p_county_fips;
            v_result.weight_set_id := v_weight_id;
            v_result.scored_at := NOW();

            -- Store raw values (note: yield is stored as decimal 0.15 = 15%, convert to percentage)
            v_result.raw_projected_yield := COALESCE(v_feasibility.stabilized_yield_pct * 100, 0);
            v_result.raw_rent_cushion := COALESCE(v_feasibility.rent_cushion_per_unit, 0);
            v_result.raw_breakeven_rent := COALESCE(v_feasibility.breakeven_rent_per_unit, 0);
            v_result.raw_market_rent := COALESCE(v_market.avg_rent_10x10, 80);
            v_result.raw_saturation_ratio := COALESCE(v_market.saturation_score, 10);
            v_result.raw_demand_score := COALESCE(v_market.market_health_score, 50);
            -- Note: market_projections has trajectory_score (0-2) and opportunity_score (0-100)
            -- Use trajectory_score as a growth indicator, scaled
            v_result.raw_population_growth := COALESCE(v_projection.trajectory_score::DECIMAL * 1.5, 0);
            v_result.raw_income_growth := COALESCE(v_projection.trajectory_score::DECIMAL * 1.5, 0);
            v_result.raw_housing_growth := COALESCE(v_projection.trajectory_score::DECIMAL * 1.5, 0);
            v_result.raw_catalyst_impact := COALESCE(v_catalyst_summary.total_sqft_demand, 0);

            -- Calculate regulation score from jurisdiction
            -- difficulty_rating: easy, moderate, difficult, very_difficult
            -- Lower difficulty = higher score
            IF v_jurisdiction.id IS NOT NULL THEN
                v_result.raw_regulation_score := CASE v_jurisdiction.difficulty_rating
                    WHEN 'easy' THEN 95
                    WHEN 'moderate' THEN 70
                    WHEN 'difficult' THEN 45
                    WHEN 'very_difficult' THEN 20
                    ELSE 60  -- default when no rating
                END;
            ELSE
                v_result.raw_regulation_score := 50;
            END IF;

            -- ===== CALCULATE SUB-COMPONENT SCORES =====

            -- Financial sub-scores
            -- Yield score: 15%+ = 100, 10% = 50, <5% = 0
            v_result.yield_score := LEAST(100, GREATEST(0,
                CASE
                    WHEN v_result.raw_projected_yield >= 15 THEN 100
                    WHEN v_result.raw_projected_yield >= 10 THEN 50 + (v_result.raw_projected_yield - 10) * 10
                    WHEN v_result.raw_projected_yield >= 5 THEN (v_result.raw_projected_yield - 5) * 10
                    ELSE 0
                END
            ));

            -- Cushion score: $30+ = 100, $0 = 50, negative = penalty
            v_result.cushion_score := LEAST(100, GREATEST(0,
                CASE
                    WHEN v_result.raw_rent_cushion >= 30 THEN 100
                    WHEN v_result.raw_rent_cushion >= 0 THEN 50 + (v_result.raw_rent_cushion / 30) * 50
                    ELSE 50 + (v_result.raw_rent_cushion * 2)  -- Negative cushion penalized
                END
            ));

            -- Breakeven score: lower is better (relative to market rent)
            v_result.breakeven_score := LEAST(100, GREATEST(0,
                CASE
                    WHEN v_result.raw_market_rent > 0 THEN
                        100 - ((v_result.raw_breakeven_rent / v_result.raw_market_rent) * 50)
                    ELSE 50
                END
            ));

            -- Market sub-scores
            -- Saturation score: <6 = 100, 6-10 = good, >12 = poor
            v_result.saturation_score := LEAST(100, GREATEST(0,
                CASE
                    WHEN v_result.raw_saturation_ratio <= 6 THEN 100
                    WHEN v_result.raw_saturation_ratio <= 10 THEN 100 - ((v_result.raw_saturation_ratio - 6) * 12.5)
                    WHEN v_result.raw_saturation_ratio <= 15 THEN 50 - ((v_result.raw_saturation_ratio - 10) * 10)
                    ELSE 0
                END
            ));

            -- Rent score: $100+ = 100, $80 = 70, $60 = 40
            v_result.rent_score := LEAST(100, GREATEST(0,
                CASE
                    WHEN v_result.raw_market_rent >= 100 THEN 100
                    WHEN v_result.raw_market_rent >= 60 THEN 40 + ((v_result.raw_market_rent - 60) * 1.5)
                    ELSE v_result.raw_market_rent * 0.67
                END
            ));

            -- Demand score (already 0-100 from market analysis)
            v_result.demand_score := COALESCE(v_result.raw_demand_score, 50);

            -- Trajectory sub-scores
            -- Population growth: 2%+ = 100, 0% = 50, negative = penalty
            v_result.population_growth_score := LEAST(100, GREATEST(0,
                50 + (v_result.raw_population_growth * 25)
            ));

            -- Income growth: 3%+ = 100, 0% = 50, negative = penalty
            v_result.income_growth_score := LEAST(100, GREATEST(0,
                50 + (v_result.raw_income_growth * 16.67)
            ));

            -- Housing growth: 3%+ = 100, 0% = 50, negative = penalty
            v_result.housing_growth_score := LEAST(100, GREATEST(0,
                50 + (v_result.raw_housing_growth * 16.67)
            ));

            -- ===== CALCULATE COMPONENT SCORES =====

            -- Financial score (weighted average of sub-scores)
            v_result.financial_score :=
                v_result.yield_score * v_weights.yield_weight +
                v_result.cushion_score * v_weights.cushion_weight +
                v_result.breakeven_score * v_weights.breakeven_weight;

            -- Market score
            v_result.market_score :=
                v_result.saturation_score * v_weights.saturation_weight +
                v_result.rent_score * v_weights.rent_weight +
                v_result.demand_score * v_weights.demand_weight;

            -- Trajectory score
            v_result.trajectory_score :=
                v_result.population_growth_score * v_weights.population_growth_weight +
                v_result.income_growth_score * v_weights.income_growth_weight +
                v_result.housing_growth_score * v_weights.housing_growth_weight;

            -- Catalyst score: based on sqft demand impact
            v_result.catalyst_score := LEAST(100, GREATEST(0,
                CASE
                    WHEN v_result.raw_catalyst_impact >= 50000 THEN 100
                    WHEN v_result.raw_catalyst_impact >= 25000 THEN 75 + ((v_result.raw_catalyst_impact - 25000) / 25000) * 25
                    WHEN v_result.raw_catalyst_impact >= 10000 THEN 50 + ((v_result.raw_catalyst_impact - 10000) / 15000) * 25
                    WHEN v_result.raw_catalyst_impact > 0 THEN 25 + (v_result.raw_catalyst_impact / 10000) * 25
                    ELSE 25  -- Base score even without catalysts
                END
            ));

            -- Regulation score (already calculated from jurisdiction)
            v_result.regulation_score := v_result.raw_regulation_score;

            -- ===== CALCULATE COMPOSITE SCORE =====
            v_result.composite_score :=
                v_result.financial_score * v_weights.financial_weight +
                v_result.market_score * v_weights.market_weight +
                v_result.trajectory_score * v_weights.trajectory_weight +
                v_result.catalyst_score * v_weights.catalyst_weight +
                v_result.regulation_score * v_weights.regulation_weight;

            -- ===== CHECK FOR FATAL FLAWS =====
            v_result.has_fatal_flaw := false;

            -- Check yield threshold
            IF v_result.raw_projected_yield < v_weights.min_yield_threshold THEN
                v_result.has_fatal_flaw := true;
                v_fatal_reasons := array_append(v_fatal_reasons,
                    'Yield ' || ROUND(v_result.raw_projected_yield, 1) || '% below minimum ' ||
                    ROUND(v_weights.min_yield_threshold, 1) || '%');
            END IF;

            -- Check saturation threshold
            IF v_result.raw_saturation_ratio > v_weights.max_saturation_threshold THEN
                v_result.has_fatal_flaw := true;
                v_fatal_reasons := array_append(v_fatal_reasons,
                    'Saturation ' || ROUND(v_result.raw_saturation_ratio, 1) || ' exceeds maximum ' ||
                    ROUND(v_weights.max_saturation_threshold, 1));
            END IF;

            -- Check cushion threshold
            IF v_result.raw_rent_cushion < v_weights.min_cushion_threshold THEN
                v_result.has_fatal_flaw := true;
                v_fatal_reasons := array_append(v_fatal_reasons,
                    'Rent cushion $' || ROUND(v_result.raw_rent_cushion, 0) || ' below minimum $' ||
                    ROUND(v_weights.min_cushion_threshold, 0));
            END IF;

            v_result.fatal_flaw_reasons := v_fatal_reasons;

            -- ===== DETERMINE TIER =====
            IF v_result.has_fatal_flaw THEN
                v_result.tier := 'F';
            ELSIF v_result.composite_score >= v_weights.tier_a_threshold THEN
                v_result.tier := 'A';
            ELSIF v_result.composite_score >= v_weights.tier_b_threshold THEN
                v_result.tier := 'B';
            ELSIF v_result.composite_score >= v_weights.tier_c_threshold THEN
                v_result.tier := 'C';
            ELSIF v_result.composite_score >= v_weights.tier_d_threshold THEN
                v_result.tier := 'D';
            ELSE
                v_result.tier := 'F';
            END IF;

            -- ===== DETERMINE RECOMMENDATION =====
            v_result.recommendation := CASE
                WHEN v_result.has_fatal_flaw THEN 'avoid'
                WHEN v_result.tier = 'A' THEN 'strong_pursue'
                WHEN v_result.tier = 'B' THEN 'pursue'
                WHEN v_result.tier = 'C' THEN 'monitor'
                ELSE 'avoid'
            END;

            -- Calculate data freshness
            v_result.data_freshness_days := EXTRACT(DAY FROM NOW() - COALESCE(
                v_feasibility.created_at,
                v_market.analysis_date::TIMESTAMP,
                NOW() - INTERVAL '30 days'
            ))::INT;

            RETURN v_result;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created calculate_market_score function")


def create_score_all_markets_function(cur):
    """Create function to score all markets and update rankings."""
    print("Creating score_all_markets function...")

    cur.execute("DROP FUNCTION IF EXISTS score_all_markets(INT);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION score_all_markets(
            p_weight_set_id INT DEFAULT NULL
        )
        RETURNS TABLE (
            county_fips VARCHAR(5),
            county_name VARCHAR(100),
            composite_score DECIMAL(5,2),
            tier VARCHAR(1),
            recommendation VARCHAR(20),
            market_rank INT
        ) AS $func$
        DECLARE
            v_county RECORD;
            v_score market_scores%ROWTYPE;
            v_weight_id INT;
            v_rank INT := 0;
        BEGIN
            -- Get active weight set or specified one
            IF p_weight_set_id IS NULL THEN
                SELECT id INTO v_weight_id FROM scoring_weights WHERE is_active = true LIMIT 1;
            ELSE
                v_weight_id := p_weight_set_id;
            END IF;

            -- Delete existing scores for this weight set
            DELETE FROM market_scores WHERE weight_set_id = v_weight_id;

            -- Calculate scores for all counties with feasibility analysis
            FOR v_county IN
                SELECT DISTINCT fa.county_fips, c.county_name
                FROM feasibility_analysis fa
                JOIN layer_3_counties c ON fa.county_fips = c.county_fips
            LOOP
                v_score := calculate_market_score(v_county.county_fips, v_weight_id);

                INSERT INTO market_scores (
                    county_fips, weight_set_id,
                    raw_projected_yield, raw_rent_cushion, raw_breakeven_rent, raw_market_rent,
                    raw_saturation_ratio, raw_demand_score, raw_population_growth,
                    raw_income_growth, raw_housing_growth, raw_catalyst_impact, raw_regulation_score,
                    financial_score, market_score, trajectory_score, catalyst_score, regulation_score,
                    yield_score, cushion_score, breakeven_score,
                    saturation_score, rent_score, demand_score,
                    population_growth_score, income_growth_score, housing_growth_score,
                    composite_score, tier, recommendation,
                    has_fatal_flaw, fatal_flaw_reasons, data_freshness_days
                ) VALUES (
                    v_score.county_fips, v_score.weight_set_id,
                    v_score.raw_projected_yield, v_score.raw_rent_cushion, v_score.raw_breakeven_rent, v_score.raw_market_rent,
                    v_score.raw_saturation_ratio, v_score.raw_demand_score, v_score.raw_population_growth,
                    v_score.raw_income_growth, v_score.raw_housing_growth, v_score.raw_catalyst_impact, v_score.raw_regulation_score,
                    v_score.financial_score, v_score.market_score, v_score.trajectory_score, v_score.catalyst_score, v_score.regulation_score,
                    v_score.yield_score, v_score.cushion_score, v_score.breakeven_score,
                    v_score.saturation_score, v_score.rent_score, v_score.demand_score,
                    v_score.population_growth_score, v_score.income_growth_score, v_score.housing_growth_score,
                    v_score.composite_score, v_score.tier, v_score.recommendation,
                    v_score.has_fatal_flaw, v_score.fatal_flaw_reasons, v_score.data_freshness_days
                );
            END LOOP;

            -- Update rankings (excluding fatal flaw markets from ranking)
            UPDATE market_scores ms
            SET market_rank = ranked.rank
            FROM (
                SELECT ms2.id,
                    ROW_NUMBER() OVER (ORDER BY ms2.composite_score DESC) as rank
                FROM market_scores ms2
                WHERE ms2.weight_set_id = v_weight_id
                AND NOT ms2.has_fatal_flaw
            ) ranked
            WHERE ms.id = ranked.id;

            -- Return results
            RETURN QUERY
            SELECT
                ms.county_fips,
                c.county_name,
                ms.composite_score,
                ms.tier,
                ms.recommendation,
                ms.market_rank
            FROM market_scores ms
            JOIN layer_3_counties c ON ms.county_fips = c.county_fips
            WHERE ms.weight_set_id = v_weight_id
            ORDER BY ms.composite_score DESC;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created score_all_markets function")


def create_scoring_views(cur):
    """Create views for scoring analysis."""
    print("Creating scoring views...")

    # Market Leaderboard View
    cur.execute("DROP VIEW IF EXISTS v_market_leaderboard CASCADE;")
    cur.execute("""
        CREATE VIEW v_market_leaderboard AS
        SELECT
            ms.market_rank as rank,
            c.county_name as county,
            c.state as state,
            ms.tier,
            ROUND(ms.composite_score, 1) as score,
            ms.recommendation,
            ROUND(ms.financial_score, 1) as financial,
            ROUND(ms.market_score, 1) as market,
            ROUND(ms.trajectory_score, 1) as trajectory,
            ROUND(ms.catalyst_score, 1) as catalyst,
            ROUND(ms.regulation_score, 1) as regulation,
            ms.has_fatal_flaw,
            CASE WHEN ms.has_fatal_flaw
                THEN array_to_string(ms.fatal_flaw_reasons, '; ')
                ELSE NULL
            END as fatal_flaws,
            sw.weight_set_name
        FROM market_scores ms
        JOIN layer_3_counties c ON ms.county_fips = c.county_fips
        JOIN scoring_weights sw ON ms.weight_set_id = sw.id
        WHERE sw.is_active = true
        ORDER BY ms.composite_score DESC;
    """)

    # Score Breakdown View (detailed component analysis)
    cur.execute("DROP VIEW IF EXISTS v_score_breakdown CASCADE;")
    cur.execute("""
        CREATE VIEW v_score_breakdown AS
        SELECT
            c.county_name as county,
            ms.tier,
            ROUND(ms.composite_score, 1) as composite,
            -- Financial breakdown
            ROUND(ms.financial_score, 1) as financial_total,
            ROUND(ms.yield_score, 1) as yield_sub,
            ROUND(ms.cushion_score, 1) as cushion_sub,
            ROUND(ms.breakeven_score, 1) as breakeven_sub,
            -- Market breakdown
            ROUND(ms.market_score, 1) as market_total,
            ROUND(ms.saturation_score, 1) as saturation_sub,
            ROUND(ms.rent_score, 1) as rent_sub,
            ROUND(ms.demand_score, 1) as demand_sub,
            -- Trajectory breakdown
            ROUND(ms.trajectory_score, 1) as trajectory_total,
            ROUND(ms.population_growth_score, 1) as pop_growth_sub,
            ROUND(ms.income_growth_score, 1) as income_growth_sub,
            ROUND(ms.housing_growth_score, 1) as housing_growth_sub,
            -- Other components
            ROUND(ms.catalyst_score, 1) as catalyst,
            ROUND(ms.regulation_score, 1) as regulation
        FROM market_scores ms
        JOIN layer_3_counties c ON ms.county_fips = c.county_fips
        JOIN scoring_weights sw ON ms.weight_set_id = sw.id
        WHERE sw.is_active = true
        ORDER BY ms.composite_score DESC;
    """)

    # Scoring Inputs View (raw data transparency)
    cur.execute("DROP VIEW IF EXISTS v_scoring_inputs CASCADE;")
    cur.execute("""
        CREATE VIEW v_scoring_inputs AS
        SELECT
            c.county_name as county,
            ms.tier,
            -- Financial inputs
            ROUND(ms.raw_projected_yield, 1) || '%' as yield,
            '$' || ROUND(ms.raw_rent_cushion, 0) as cushion,
            '$' || ROUND(ms.raw_breakeven_rent, 0) as breakeven,
            '$' || ROUND(ms.raw_market_rent, 0) as market_rent,
            -- Market inputs
            ROUND(ms.raw_saturation_ratio, 1) as saturation,
            ROUND(ms.raw_demand_score, 0) as demand,
            -- Trajectory inputs
            ROUND(ms.raw_population_growth, 2) || '%' as pop_growth,
            ROUND(ms.raw_income_growth, 2) || '%' as income_growth,
            ROUND(ms.raw_housing_growth, 2) || '%' as housing_growth,
            -- Other inputs
            ROUND(ms.raw_catalyst_impact, 0) || ' sqft' as catalyst_demand,
            ROUND(ms.raw_regulation_score, 0) as reg_score,
            ms.data_freshness_days || ' days' as data_age
        FROM market_scores ms
        JOIN layer_3_counties c ON ms.county_fips = c.county_fips
        JOIN scoring_weights sw ON ms.weight_set_id = sw.id
        WHERE sw.is_active = true
        ORDER BY ms.composite_score DESC;
    """)

    # Tier Summary View
    cur.execute("DROP VIEW IF EXISTS v_tier_summary CASCADE;")
    cur.execute("""
        CREATE VIEW v_tier_summary AS
        SELECT
            ms.tier,
            COUNT(*) as county_count,
            ROUND(AVG(ms.composite_score), 1) as avg_score,
            ROUND(MIN(ms.composite_score), 1) as min_score,
            ROUND(MAX(ms.composite_score), 1) as max_score,
            ROUND(AVG(ms.raw_projected_yield), 1) as avg_yield,
            ROUND(AVG(ms.raw_saturation_ratio), 1) as avg_saturation,
            SUM(CASE WHEN ms.has_fatal_flaw THEN 1 ELSE 0 END) as fatal_flaw_count,
            string_agg(c.county_name, ', ' ORDER BY ms.composite_score DESC) as counties
        FROM market_scores ms
        JOIN layer_3_counties c ON ms.county_fips = c.county_fips
        JOIN scoring_weights sw ON ms.weight_set_id = sw.id
        WHERE sw.is_active = true
        GROUP BY ms.tier
        ORDER BY
            CASE ms.tier
                WHEN 'A' THEN 1
                WHEN 'B' THEN 2
                WHEN 'C' THEN 3
                WHEN 'D' THEN 4
                ELSE 5
            END;
    """)

    # Recommendation Summary View
    cur.execute("DROP VIEW IF EXISTS v_recommendation_summary CASCADE;")
    cur.execute("""
        CREATE VIEW v_recommendation_summary AS
        SELECT
            ms.recommendation,
            COUNT(*) as county_count,
            ROUND(AVG(ms.composite_score), 1) as avg_score,
            ROUND(AVG(ms.raw_projected_yield), 1) as avg_yield,
            ROUND(AVG(ms.raw_rent_cushion), 0) as avg_cushion,
            string_agg(c.county_name || ' (' || ms.tier || ')', ', ' ORDER BY ms.composite_score DESC) as counties
        FROM market_scores ms
        JOIN layer_3_counties c ON ms.county_fips = c.county_fips
        JOIN scoring_weights sw ON ms.weight_set_id = sw.id
        WHERE sw.is_active = true
        GROUP BY ms.recommendation
        ORDER BY
            CASE ms.recommendation
                WHEN 'strong_pursue' THEN 1
                WHEN 'pursue' THEN 2
                WHEN 'monitor' THEN 3
                ELSE 4
            END;
    """)

    # Weight Comparison View (compare scores across weight sets)
    cur.execute("DROP VIEW IF EXISTS v_weight_comparison CASCADE;")
    cur.execute("""
        CREATE VIEW v_weight_comparison AS
        SELECT
            c.county_name as county,
            sw.weight_set_name,
            ROUND(ms.composite_score, 1) as score,
            ms.tier,
            ms.recommendation,
            ROUND(ms.financial_score * sw.financial_weight, 1) as financial_contrib,
            ROUND(ms.market_score * sw.market_weight, 1) as market_contrib,
            ROUND(ms.trajectory_score * sw.trajectory_weight, 1) as trajectory_contrib,
            ROUND(ms.catalyst_score * sw.catalyst_weight, 1) as catalyst_contrib,
            ROUND(ms.regulation_score * sw.regulation_weight, 1) as regulation_contrib
        FROM market_scores ms
        JOIN layer_3_counties c ON ms.county_fips = c.county_fips
        JOIN scoring_weights sw ON ms.weight_set_id = sw.id
        ORDER BY c.county_name, sw.weight_set_name;
    """)

    print("  Created 6 scoring views")


def run_scoring_test(cur):
    """Test the scoring engine with our 3 WV counties."""
    print("\n" + "="*60)
    print("TESTING SCORING ENGINE")
    print("="*60)

    # Run scoring for all markets
    print("\nRunning score_all_markets()...")
    cur.execute("SELECT * FROM score_all_markets();")
    results = cur.fetchall()

    print("\n--- Market Rankings ---")
    print(f"{'Rank':<6} {'County':<20} {'Score':<8} {'Tier':<6} {'Recommendation':<15}")
    print("-" * 60)
    for row in results:
        rank = row[5] if row[5] else '-'
        print(f"{rank:<6} {row[1]:<20} {row[2]:<8.1f} {row[3]:<6} {row[4]:<15}")

    # Show detailed breakdown
    print("\n--- Score Breakdown ---")
    cur.execute("SELECT * FROM v_score_breakdown;")
    breakdown = cur.fetchall()
    for row in breakdown:
        print(f"\n{row[0]} (Tier {row[1]}, Composite: {row[2]})")
        print(f"  Financial: {row[3]} (Yield: {row[4]}, Cushion: {row[5]}, Breakeven: {row[6]})")
        print(f"  Market: {row[7]} (Saturation: {row[8]}, Rent: {row[9]}, Demand: {row[10]})")
        print(f"  Trajectory: {row[11]} (Pop: {row[12]}, Income: {row[13]}, Housing: {row[14]})")
        print(f"  Catalyst: {row[15]}, Regulation: {row[16]}")

    # Show raw inputs
    print("\n--- Raw Scoring Inputs ---")
    cur.execute("SELECT * FROM v_scoring_inputs;")
    inputs = cur.fetchall()
    for row in inputs:
        print(f"\n{row[0]} (Tier {row[1]})")
        print(f"  Yield: {row[2]}, Cushion: {row[3]}, Breakeven: {row[4]}, Market Rent: {row[5]}")
        print(f"  Saturation: {row[6]}, Demand: {row[7]}")
        print(f"  Growth - Pop: {row[8]}, Income: {row[9]}, Housing: {row[10]}")
        print(f"  Catalyst Demand: {row[11]}, Reg Score: {row[12]}, Data Age: {row[13]}")

    # Show tier summary
    print("\n--- Tier Summary ---")
    cur.execute("SELECT * FROM v_tier_summary;")
    tiers = cur.fetchall()
    for row in tiers:
        print(f"Tier {row[0]}: {row[1]} counties, Avg Score: {row[2]}, Yield: {row[5]}%, Sat: {row[6]}")
        print(f"  Counties: {row[8]}")

    # Show recommendation summary
    print("\n--- Recommendation Summary ---")
    cur.execute("SELECT * FROM v_recommendation_summary;")
    recs = cur.fetchall()
    for row in recs:
        print(f"{row[0].upper()}: {row[1]} counties, Avg Score: {row[2]}, Yield: {row[3]}%, Cushion: ${row[4]}")
        print(f"  Counties: {row[5]}")

    # Show weight sets
    print("\n--- Available Weight Sets ---")
    cur.execute("""
        SELECT weight_set_name, description, is_active,
               financial_weight, market_weight, trajectory_weight, catalyst_weight, regulation_weight
        FROM scoring_weights
        ORDER BY is_active DESC, weight_set_name;
    """)
    weights = cur.fetchall()
    for row in weights:
        active = " (ACTIVE)" if row[2] else ""
        print(f"\n{row[0]}{active}: {row[1]}")
        print(f"  Weights: Financial={row[3]}, Market={row[4]}, Trajectory={row[5]}, Catalyst={row[6]}, Regulation={row[7]}")


def main():
    print("="*60)
    print("PROMPT 19: SCORING ENGINE")
    print("="*60)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # Create tables
        create_scoring_weights_table(cur)
        create_market_scores_table(cur)
        conn.commit()

        # Create functions
        create_calculate_market_score_function(cur)
        create_score_all_markets_function(cur)
        conn.commit()

        # Create views
        create_scoring_views(cur)
        conn.commit()

        # Run tests
        run_scoring_test(cur)
        conn.commit()

        print("\n" + "="*60)
        print("SCORING ENGINE COMPLETE")
        print("="*60)

        # Summary
        cur.execute("SELECT COUNT(*) FROM scoring_weights;")
        weight_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM market_scores;")
        score_count = cur.fetchone()[0]

        print(f"\nCreated:")
        print(f"  - scoring_weights table ({weight_count} weight sets)")
        print(f"  - market_scores table ({score_count} scored markets)")
        print(f"  - calculate_market_score() function")
        print(f"  - score_all_markets() function")
        print(f"  - 6 scoring views")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
