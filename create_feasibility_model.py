"""
Prompt 16: Build Feasibility Model
Creates comprehensive build feasibility model combining jurisdiction regulations,
market conditions, and investment returns.

Key outputs: total investment, projected yield, breakeven rent, rent cushion, go/no-go
Target: 12% minimum yield, 15%+ preferred
"""

import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection
DB_URL = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"


def get_connection():
    return psycopg2.connect(DB_URL)


def create_tables(cur):
    """Create feasibility analysis and scenarios tables"""

    # Main feasibility analysis table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS feasibility_analysis (
            id SERIAL PRIMARY KEY,

            -- REFERENCES
            jurisdiction_card_id INT REFERENCES jurisdiction_cards(id),
            build_impact_id INT REFERENCES build_impact_analysis(id),
            market_analysis_id INT,
            market_projection_id INT,

            -- GEOGRAPHY
            state VARCHAR(2),
            county_fips VARCHAR(5),
            county_name VARCHAR(100),
            jurisdiction VARCHAR(100),
            analysis_date DATE DEFAULT CURRENT_DATE,

            -- INPUT ASSUMPTIONS
            lot_acres DECIMAL,
            lot_cost_per_acre INT,
            lot_cost_total INT,

            -- CAPACITY (from build impact)
            building_count INT,
            unit_count INT,
            rentable_sqft INT,
            capacity_loss_pct DECIMAL,

            -- CONSTRUCTION COSTS
            site_work_cost INT,
            building_cost INT,
            regulation_added_costs INT,
            soft_costs INT,
            contingency INT,
            total_construction_cost INT,

            -- TOTAL INVESTMENT
            total_investment INT,
            cost_per_unit INT,
            cost_per_sqft INT,

            -- MARKET RENTS (from market analysis)
            market_rent_10x10 DECIMAL,
            market_rent_per_sqft DECIMAL,
            rent_source VARCHAR(50),
            rent_confidence VARCHAR(20),

            -- REVENUE PROJECTIONS - Year 1 (lease-up)
            y1_occupancy_pct DECIMAL,
            y1_effective_rent DECIMAL,
            y1_gross_revenue INT,
            y1_vacancy_loss INT,
            y1_effective_gross_income INT,

            -- Year 2 (stabilizing)
            y2_occupancy_pct DECIMAL,
            y2_rent_growth_pct DECIMAL,
            y2_effective_rent DECIMAL,
            y2_gross_revenue INT,
            y2_effective_gross_income INT,

            -- Year 3 (stabilized)
            y3_occupancy_pct DECIMAL,
            y3_rent_growth_pct DECIMAL,
            y3_effective_rent DECIMAL,
            y3_gross_revenue INT,
            y3_effective_gross_income INT,

            -- OPERATING EXPENSES
            expense_ratio DECIMAL,
            y1_expenses INT,
            y2_expenses INT,
            y3_expenses INT,

            -- NET OPERATING INCOME
            y1_noi INT,
            y2_noi INT,
            y3_noi INT,
            stabilized_noi INT,

            -- RETURN METRICS
            y1_yield_pct DECIMAL,
            y2_yield_pct DECIMAL,
            y3_yield_pct DECIMAL,
            stabilized_yield_pct DECIMAL,

            -- BREAKEVEN ANALYSIS
            target_yield_pct DECIMAL DEFAULT 0.12,
            breakeven_rent_per_unit INT,
            breakeven_rent_per_sqft DECIMAL,

            -- CUSHION ANALYSIS
            rent_cushion_per_unit INT,
            rent_cushion_pct DECIMAL,
            cushion_rating VARCHAR(20),

            -- SENSITIVITY ANALYSIS
            rent_for_10pct_yield INT,
            rent_for_12pct_yield INT,
            rent_for_15pct_yield INT,
            occupancy_breakeven_pct DECIMAL,

            -- PAYBACK ANALYSIS
            simple_payback_years DECIMAL,

            -- MARKET CONTEXT
            market_saturation VARCHAR(20),
            market_trajectory VARCHAR(20),
            market_opportunity_score INT,

            -- RISK FACTORS
            regulation_risk VARCHAR(20),
            market_risk VARCHAR(20),
            execution_risk VARCHAR(20),
            overall_risk VARCHAR(20),

            -- SCORING
            financial_score INT,
            market_score INT,
            regulation_score INT,
            composite_score INT,

            -- VERDICT
            financial_verdict VARCHAR(20),
            overall_verdict VARCHAR(20),
            verdict_summary TEXT,

            -- KEY DRIVERS
            primary_strength TEXT,
            primary_weakness TEXT,
            key_assumptions TEXT,

            -- RECOMMENDATIONS
            recommended_action VARCHAR(50),
            conditions TEXT,
            next_steps TEXT,

            -- METADATA
            analyst_notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(jurisdiction_card_id, analysis_date)
        );
    """)

    # Indexes
    cur.execute("CREATE INDEX IF NOT EXISTS idx_fa_jurisdiction ON feasibility_analysis(jurisdiction_card_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_fa_county ON feasibility_analysis(county_fips);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_fa_verdict ON feasibility_analysis(overall_verdict);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_fa_score ON feasibility_analysis(composite_score);")

    print("Created feasibility_analysis table")

    # Scenario modeling table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS feasibility_scenarios (
            id SERIAL PRIMARY KEY,
            feasibility_id INT REFERENCES feasibility_analysis(id),

            scenario_name VARCHAR(100) NOT NULL,
            scenario_type VARCHAR(50),

            -- Assumptions varied
            lot_acres DECIMAL,
            lot_cost_per_acre INT,
            unit_count INT,
            market_rent DECIMAL,
            occupancy_pct DECIMAL,
            expense_ratio DECIMAL,
            rent_growth_pct DECIMAL,

            -- Calculated outputs
            total_investment INT,
            stabilized_noi INT,
            stabilized_yield_pct DECIMAL,
            breakeven_rent INT,
            rent_cushion_pct DECIMAL,

            -- Verdict
            meets_target BOOLEAN,
            scenario_verdict VARCHAR(20),

            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_fs_feasibility ON feasibility_scenarios(feasibility_id);")

    print("Created feasibility_scenarios table")


def create_functions(cur):
    """Create feasibility analysis functions"""

    # Check if build_model_defaults has site_work_cost column
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'build_model_defaults';
    """)
    columns = [row[0] for row in cur.fetchall()]
    print(f"build_model_defaults columns: {columns}")

    # Main feasibility analysis function
    cur.execute("""
        CREATE OR REPLACE FUNCTION analyze_feasibility(
            p_jurisdiction_card_id INT,
            p_lot_acres DECIMAL DEFAULT 1.5,
            p_lot_cost_per_acre INT DEFAULT 100000
        )
        RETURNS INT AS $func$
        DECLARE
            v_jc jurisdiction_cards%ROWTYPE;
            v_bia build_impact_analysis%ROWTYPE;
            v_ma market_analysis%ROWTYPE;
            v_mp market_projections%ROWTYPE;
            v_model build_model_defaults%ROWTYPE;

            -- Calculated values
            v_lot_cost INT;
            v_site_work INT;
            v_building_cost INT;
            v_regulation_costs INT;
            v_soft_costs INT;
            v_contingency INT;
            v_total_construction INT;
            v_total_investment INT;

            v_unit_count INT;
            v_rentable_sqft INT;
            v_market_rent DECIMAL;

            -- Revenue/NOI
            -- LEASE-UP MODELING: Dynamic occupancy based on market saturation and trajectory
            -- Replaces static 50%/80%/90% with market-conditioned lease-up periods
            -- Logic: Lower saturation + improving trajectory = faster lease-up = higher early occupancy
            v_lease_up_months INT;
            v_saturation_sqft_per_capita DECIMAL;
            v_trajectory VARCHAR(20);
            v_y1_occupancy DECIMAL;
            v_y2_occupancy DECIMAL;
            v_y3_occupancy DECIMAL;
            v_rent_growth DECIMAL := 0.03;
            v_expense_ratio DECIMAL := 0.35;

            v_y1_revenue INT;
            v_y2_revenue INT;
            v_y3_revenue INT;
            v_y1_egi INT;
            v_y2_egi INT;
            v_y3_egi INT;
            v_y1_expenses INT;
            v_y2_expenses INT;
            v_y3_expenses INT;
            v_y1_noi INT;
            v_y2_noi INT;
            v_y3_noi INT;

            -- Returns
            v_y1_yield DECIMAL;
            v_y2_yield DECIMAL;
            v_y3_yield DECIMAL;
            v_target_yield DECIMAL := 0.12;
            v_breakeven_rent INT;
            v_cushion INT;
            v_cushion_pct DECIMAL;
            v_cushion_rating VARCHAR(20);

            -- Scores
            v_financial_score INT;
            v_market_score INT;
            v_regulation_score INT;
            v_composite_score INT;

            -- Verdicts
            v_financial_verdict VARCHAR(20);
            v_overall_verdict VARCHAR(20);
            v_verdict_summary TEXT;
            v_primary_strength TEXT;
            v_primary_weakness TEXT;
            v_recommended_action VARCHAR(50);
            v_conditions TEXT;

            v_feasibility_id INT;
        BEGIN
            -- Get jurisdiction card
            SELECT * INTO v_jc FROM jurisdiction_cards WHERE id = p_jurisdiction_card_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Jurisdiction card not found: %', p_jurisdiction_card_id;
            END IF;

            -- Get or create build impact analysis
            SELECT * INTO v_bia
            FROM build_impact_analysis
            WHERE jurisdiction_card_id = p_jurisdiction_card_id
            ORDER BY id DESC
            LIMIT 1;

            -- Get market analysis
            SELECT * INTO v_ma
            FROM market_analysis
            WHERE geo_type = 'county' AND geo_id = v_jc.county_fips
            ORDER BY analysis_date DESC
            LIMIT 1;

            -- Get market projection
            SELECT * INTO v_mp
            FROM market_projections
            WHERE geo_type = 'county' AND geo_id = v_jc.county_fips
            ORDER BY projection_date DESC
            LIMIT 1;

            -- Get base model
            SELECT * INTO v_model FROM build_model_defaults WHERE is_active = TRUE LIMIT 1;

            -- LEASE-UP CALCULATION: Get saturation (sqft per capita) and trajectory from market data
            v_saturation_sqft_per_capita := COALESCE(v_ma.sqft_per_capita, 7.0);
            v_trajectory := COALESCE(v_mp.trajectory, 'stable');
            
            -- Calculate lease-up months based on market conditions
            -- <5 sqft/capita + improving = 18 months (hot market)
            -- <7 sqft/capita = 24 months (undersupplied)
            -- <9 sqft/capita = 36 months (balanced)
            -- >=9 sqft/capita = 48 months (oversupplied, slower lease-up)
            v_lease_up_months := CASE
                WHEN v_saturation_sqft_per_capita < 5 AND v_trajectory = 'improving' THEN 18
                WHEN v_saturation_sqft_per_capita < 7 THEN 24
                WHEN v_saturation_sqft_per_capita < 9 THEN 36
                ELSE 48
            END;
            
            -- Calculate Y1/Y2/Y3 occupancy based on lease-up period
            -- Longer lease-up = lower early occupancy (S-curve approximation)
            v_y1_occupancy := CASE
                WHEN v_lease_up_months <= 18 THEN 0.65  -- Fast lease-up: 65% Y1 avg
                WHEN v_lease_up_months <= 24 THEN 0.55  -- Moderate: 55% Y1 avg
                WHEN v_lease_up_months <= 36 THEN 0.45  -- Slower: 45% Y1 avg
                ELSE 0.40  -- Slow lease-up: 40% Y1 avg
            END;
            
            v_y2_occupancy := CASE
                WHEN v_lease_up_months <= 18 THEN 0.85  -- Fast: 85% Y2
                WHEN v_lease_up_months <= 24 THEN 0.80  -- Moderate: 80% Y2
                WHEN v_lease_up_months <= 36 THEN 0.75  -- Slower: 75% Y2
                ELSE 0.70  -- Slow: 70% Y2
            END;
            
            v_y3_occupancy := 0.90;  -- Stabilized occupancy (regardless of lease-up speed)

            -- INVESTMENT CALCULATION
            v_lot_cost := (p_lot_acres * p_lot_cost_per_acre)::INT;
            v_site_work := 50000;  -- Base site work cost
            v_building_cost := COALESCE(v_bia.adjusted_building_count, 4) * COALESCE(v_model.building_cost_per_building, 100000);
            v_regulation_costs := COALESCE(v_bia.total_added_costs, 0);
            v_soft_costs := 50000 + CASE WHEN v_jc.public_hearing_required THEN 10000 ELSE 0 END;
            v_contingency := ((v_site_work + v_building_cost + v_regulation_costs) * 0.10)::INT;
            v_total_construction := v_site_work + v_building_cost + v_regulation_costs + v_soft_costs + v_contingency;
            v_total_investment := v_lot_cost + v_total_construction;

            -- CAPACITY
            v_unit_count := COALESCE(v_bia.adjusted_unit_count, 160);
            v_rentable_sqft := v_unit_count * 100;  -- 10x10 units

            -- MARKET RENT
            v_market_rent := COALESCE(v_ma.avg_rent_10x10, 80);

            -- REVENUE PROJECTIONS
            -- Year 1: 50% average occupancy (lease-up)
            v_y1_revenue := (v_unit_count * v_market_rent * 12)::INT;
            v_y1_egi := (v_y1_revenue * v_y1_occupancy)::INT;
            v_y1_expenses := (v_y1_egi * v_expense_ratio)::INT;
            v_y1_noi := v_y1_egi - v_y1_expenses;

            -- Year 2: 80% occupancy, 3% rent growth
            v_y2_revenue := (v_unit_count * v_market_rent * (1 + v_rent_growth) * 12)::INT;
            v_y2_egi := (v_y2_revenue * v_y2_occupancy)::INT;
            v_y2_expenses := (v_y2_egi * v_expense_ratio)::INT;
            v_y2_noi := v_y2_egi - v_y2_expenses;

            -- Year 3: 90% occupancy (stabilized), 3% rent growth
            v_y3_revenue := (v_unit_count * v_market_rent * POWER(1 + v_rent_growth, 2) * 12)::INT;
            v_y3_egi := (v_y3_revenue * v_y3_occupancy)::INT;
            v_y3_expenses := (v_y3_egi * v_expense_ratio)::INT;
            v_y3_noi := v_y3_egi - v_y3_expenses;

            -- YIELDS
            v_y1_yield := CASE WHEN v_total_investment > 0 THEN v_y1_noi::DECIMAL / v_total_investment ELSE 0 END;
            v_y2_yield := CASE WHEN v_total_investment > 0 THEN v_y2_noi::DECIMAL / v_total_investment ELSE 0 END;
            v_y3_yield := CASE WHEN v_total_investment > 0 THEN v_y3_noi::DECIMAL / v_total_investment ELSE 0 END;

            -- BREAKEVEN RENT (rent needed for 12% stabilized yield at 90% occupancy)
            v_breakeven_rent := CEIL(
                (v_total_investment * v_target_yield) /
                (1 - v_expense_ratio) /
                v_y3_occupancy /
                v_unit_count / 12
            );

            -- CUSHION
            v_cushion := v_market_rent::INT - v_breakeven_rent;
            v_cushion_pct := CASE WHEN v_market_rent > 0 THEN v_cushion::DECIMAL / v_market_rent ELSE 0 END;
            v_cushion_rating := CASE
                WHEN v_cushion_pct >= 0.20 THEN 'strong'
                WHEN v_cushion_pct >= 0.10 THEN 'adequate'
                WHEN v_cushion_pct >= 0 THEN 'thin'
                ELSE 'negative'
            END;

            -- FINANCIAL SCORE (0-100)
            v_financial_score := 50;

            -- Yield contribution (40 pts)
            IF v_y3_yield >= 0.18 THEN v_financial_score := v_financial_score + 40;
            ELSIF v_y3_yield >= 0.15 THEN v_financial_score := v_financial_score + 30;
            ELSIF v_y3_yield >= 0.12 THEN v_financial_score := v_financial_score + 20;
            ELSIF v_y3_yield >= 0.10 THEN v_financial_score := v_financial_score + 10;
            ELSE v_financial_score := v_financial_score - 20;
            END IF;

            -- Cushion contribution (30 pts)
            IF v_cushion_rating = 'strong' THEN v_financial_score := v_financial_score + 30;
            ELSIF v_cushion_rating = 'adequate' THEN v_financial_score := v_financial_score + 20;
            ELSIF v_cushion_rating = 'thin' THEN v_financial_score := v_financial_score + 5;
            ELSE v_financial_score := v_financial_score - 20;
            END IF;

            -- Cost per unit penalty (-20 pts max)
            IF v_unit_count > 0 AND (v_total_investment / v_unit_count) > 5000 THEN
                v_financial_score := v_financial_score - 10;
            END IF;
            IF v_unit_count > 0 AND (v_total_investment / v_unit_count) > 6000 THEN
                v_financial_score := v_financial_score - 10;
            END IF;

            v_financial_score := LEAST(GREATEST(v_financial_score, 0), 100);

            -- MARKET SCORE (from projection)
            v_market_score := COALESCE(v_mp.opportunity_score, 50);

            -- REGULATION SCORE (inverse of difficulty)
            v_regulation_score := 100 - COALESCE(v_jc.difficulty_score, 50);

            -- COMPOSITE SCORE (weighted)
            v_composite_score := (
                (v_financial_score * 0.50) +
                (v_market_score * 0.30) +
                (v_regulation_score * 0.20)
            )::INT;

            -- FINANCIAL VERDICT
            v_financial_verdict := CASE
                WHEN v_y3_yield >= 0.15 AND v_cushion_rating IN ('strong', 'adequate') THEN 'strong'
                WHEN v_y3_yield >= 0.12 AND v_cushion_rating != 'negative' THEN 'acceptable'
                WHEN v_y3_yield >= 0.10 THEN 'marginal'
                ELSE 'fail'
            END;

            -- OVERALL VERDICT
            v_overall_verdict := CASE
                WHEN v_composite_score >= 75 AND v_financial_verdict IN ('strong', 'acceptable') THEN 'strong_go'
                WHEN v_composite_score >= 60 AND v_financial_verdict != 'fail' THEN 'go'
                WHEN v_composite_score >= 45 AND v_financial_verdict = 'marginal' THEN 'conditional'
                ELSE 'no_go'
            END;

            -- VERDICT SUMMARY
            v_verdict_summary := 'Y3 Yield: ' || ROUND(v_y3_yield * 100, 1) || '% (target 12%). ' ||
                'Market rent $' || v_market_rent::INT || ', breakeven $' || v_breakeven_rent ||
                ' (' || v_cushion_rating || ' cushion). Composite score: ' || v_composite_score || '/100.';

            -- PRIMARY STRENGTH
            v_primary_strength := CASE
                WHEN v_y3_yield >= 0.15 THEN 'Strong returns at ' || ROUND(v_y3_yield * 100, 1) || '% stabilized yield'
                WHEN v_cushion_rating = 'strong' THEN 'Strong rent cushion of $' || v_cushion || '/unit (' || ROUND(v_cushion_pct * 100) || '%)'
                WHEN v_market_score >= 70 THEN 'Favorable market dynamics with demand growth'
                WHEN v_regulation_score >= 70 THEN 'Favorable regulatory environment'
                ELSE 'Moderate overall opportunity'
            END;

            -- PRIMARY WEAKNESS
            v_primary_weakness := CASE
                WHEN v_cushion_rating = 'negative' THEN 'Breakeven rent exceeds market rent - not viable'
                WHEN v_cushion_rating = 'thin' THEN 'Thin rent cushion leaves little margin for error'
                WHEN v_y3_yield < 0.10 THEN 'Weak returns at ' || ROUND(v_y3_yield * 100, 1) || '% yield'
                WHEN v_regulation_score < 40 THEN 'Challenging regulatory environment adds cost/risk'
                WHEN COALESCE(v_mp.trajectory, 'stable') = 'deteriorating' THEN 'Market trajectory shows deteriorating conditions'
                ELSE 'Standard execution risk'
            END;

            -- RECOMMENDED ACTION
            v_recommended_action := CASE v_overall_verdict
                WHEN 'strong_go' THEN 'proceed'
                WHEN 'go' THEN 'proceed'
                WHEN 'conditional' THEN 'proceed_with_conditions'
                ELSE 'pass'
            END;

            -- CONDITIONS
            v_conditions := CASE v_overall_verdict
                WHEN 'conditional' THEN
                    CASE
                        WHEN v_cushion_rating = 'thin' THEN 'Secure land at lower cost or confirm rent growth trajectory'
                        WHEN v_y3_yield < 0.12 THEN 'Reduce costs or confirm premium rent potential'
                        ELSE 'Validate key assumptions before proceeding'
                    END
                ELSE NULL
            END;

            -- DELETE existing analysis for same date
            DELETE FROM feasibility_scenarios
            WHERE feasibility_id IN (
                SELECT id FROM feasibility_analysis
                WHERE jurisdiction_card_id = p_jurisdiction_card_id
                AND analysis_date = CURRENT_DATE
            );
            DELETE FROM feasibility_analysis
            WHERE jurisdiction_card_id = p_jurisdiction_card_id
            AND analysis_date = CURRENT_DATE;

            -- INSERT ANALYSIS
            INSERT INTO feasibility_analysis (
                jurisdiction_card_id, build_impact_id, market_analysis_id, market_projection_id,
                state, county_fips, county_name, jurisdiction, analysis_date,
                lot_acres, lot_cost_per_acre, lot_cost_total,
                building_count, unit_count, rentable_sqft, capacity_loss_pct,
                site_work_cost, building_cost, regulation_added_costs, soft_costs, contingency, total_construction_cost,
                total_investment, cost_per_unit, cost_per_sqft,
                market_rent_10x10, market_rent_per_sqft, rent_source, rent_confidence,
                y1_occupancy_pct, y1_effective_rent, y1_gross_revenue, y1_effective_gross_income,
                y2_occupancy_pct, y2_rent_growth_pct, y2_effective_rent, y2_gross_revenue, y2_effective_gross_income,
                y3_occupancy_pct, y3_rent_growth_pct, y3_effective_rent, y3_gross_revenue, y3_effective_gross_income,
                expense_ratio,
                y1_expenses, y2_expenses, y3_expenses,
                y1_noi, y2_noi, y3_noi, stabilized_noi,
                y1_yield_pct, y2_yield_pct, y3_yield_pct, stabilized_yield_pct,
                target_yield_pct, breakeven_rent_per_unit, breakeven_rent_per_sqft,
                rent_cushion_per_unit, rent_cushion_pct, cushion_rating,
                rent_for_10pct_yield, rent_for_12pct_yield, rent_for_15pct_yield,
                occupancy_breakeven_pct,
                simple_payback_years,
                market_saturation, market_trajectory, market_opportunity_score,
                regulation_risk, market_risk, execution_risk, overall_risk,
                financial_score, market_score, regulation_score, composite_score,
                financial_verdict, overall_verdict, verdict_summary,
                primary_strength, primary_weakness,
                recommended_action, conditions
            ) VALUES (
                p_jurisdiction_card_id, v_bia.id, v_ma.id, v_mp.id,
                v_jc.state, v_jc.county_fips, v_jc.county_name, v_jc.jurisdiction, CURRENT_DATE,
                p_lot_acres, p_lot_cost_per_acre, v_lot_cost,
                COALESCE(v_bia.adjusted_building_count, 4), v_unit_count, v_rentable_sqft, COALESCE(v_bia.capacity_loss_pct, 0),
                v_site_work, v_building_cost, v_regulation_costs, v_soft_costs, v_contingency, v_total_construction,
                v_total_investment,
                CASE WHEN v_unit_count > 0 THEN v_total_investment / v_unit_count ELSE 0 END,
                CASE WHEN v_rentable_sqft > 0 THEN v_total_investment / v_rentable_sqft ELSE 0 END,
                v_market_rent, v_market_rent / 100,
                CASE WHEN v_ma.avg_rent_10x10 IS NOT NULL THEN 'market_analysis' ELSE 'default' END,
                CASE WHEN v_ma.avg_rent_10x10 IS NOT NULL THEN 'estimated' ELSE 'projected' END,
                v_y1_occupancy, v_market_rent * v_y1_occupancy, v_y1_revenue, v_y1_egi,
                v_y2_occupancy, v_rent_growth, v_market_rent * (1 + v_rent_growth), v_y2_revenue, v_y2_egi,
                v_y3_occupancy, v_rent_growth, v_market_rent * POWER(1 + v_rent_growth, 2), v_y3_revenue, v_y3_egi,
                v_expense_ratio,
                v_y1_expenses, v_y2_expenses, v_y3_expenses,
                v_y1_noi, v_y2_noi, v_y3_noi, v_y3_noi,
                v_y1_yield, v_y2_yield, v_y3_yield, v_y3_yield,
                v_target_yield, v_breakeven_rent, v_breakeven_rent::DECIMAL / 100,
                v_cushion, v_cushion_pct, v_cushion_rating,
                -- Sensitivity rents
                CEIL((v_total_investment * 0.10) / (1 - v_expense_ratio) / v_y3_occupancy / v_unit_count / 12),
                v_breakeven_rent,
                CEIL((v_total_investment * 0.15) / (1 - v_expense_ratio) / v_y3_occupancy / v_unit_count / 12),
                -- Occupancy breakeven
                CASE WHEN v_y3_revenue > 0
                     THEN (v_total_investment * v_target_yield / (1 - v_expense_ratio)) / v_y3_revenue
                     ELSE 1 END,
                -- Payback
                CASE WHEN v_y3_noi > 0 THEN ROUND(v_total_investment::DECIMAL / v_y3_noi, 1) ELSE 99 END,
                COALESCE(v_ma.saturation_level, 'unknown'),
                COALESCE(v_mp.trajectory, 'unknown'),
                COALESCE(v_mp.opportunity_score, 50),
                CASE WHEN v_jc.difficulty_score > 60 THEN 'high' WHEN v_jc.difficulty_score > 30 THEN 'medium' ELSE 'low' END,
                COALESCE(v_mp.overall_risk, 'medium'),
                CASE WHEN COALESCE(v_bia.capacity_loss_pct, 0) > 0.25 THEN 'high'
                     WHEN COALESCE(v_bia.capacity_loss_pct, 0) > 0.10 THEN 'medium' ELSE 'low' END,
                CASE
                    WHEN v_jc.difficulty_score > 60 OR COALESCE(v_mp.overall_risk, 'medium') = 'high' THEN 'high'
                    WHEN v_jc.difficulty_score > 30 OR COALESCE(v_mp.overall_risk, 'medium') = 'medium' THEN 'medium'
                    ELSE 'low'
                END,
                v_financial_score, v_market_score, v_regulation_score, v_composite_score,
                v_financial_verdict, v_overall_verdict, v_verdict_summary,
                v_primary_strength, v_primary_weakness,
                v_recommended_action, v_conditions
            )
            RETURNING id INTO v_feasibility_id;

            -- Create scenarios
            PERFORM create_feasibility_scenarios(v_feasibility_id);

            RETURN v_feasibility_id;
        END;
        $func$ LANGUAGE plpgsql;
    """)
    print("Created analyze_feasibility() function")

    # Scenario generation function
    cur.execute("""
        CREATE OR REPLACE FUNCTION create_feasibility_scenarios(p_feasibility_id INT)
        RETURNS VOID AS $func$
        DECLARE
            v_fa feasibility_analysis%ROWTYPE;
            v_scenario_noi INT;
            v_scenario_yield DECIMAL;
        BEGIN
            SELECT * INTO v_fa FROM feasibility_analysis WHERE id = p_feasibility_id;

            -- UPSIDE SCENARIO: Higher rent, lower costs
            v_scenario_noi := ((v_fa.unit_count * (v_fa.market_rent_10x10 * 1.10) * 12 * 0.92) * (1 - v_fa.expense_ratio))::INT;
            v_scenario_yield := v_scenario_noi::DECIMAL / (v_fa.total_investment * 0.95);

            INSERT INTO feasibility_scenarios (
                feasibility_id, scenario_name, scenario_type,
                lot_acres, lot_cost_per_acre, unit_count,
                market_rent, occupancy_pct, expense_ratio, rent_growth_pct,
                total_investment, stabilized_noi, stabilized_yield_pct,
                breakeven_rent, rent_cushion_pct,
                meets_target, scenario_verdict, notes
            ) VALUES (
                p_feasibility_id, 'Upside', 'optimistic',
                v_fa.lot_acres, v_fa.lot_cost_per_acre * 0.90, v_fa.unit_count,
                v_fa.market_rent_10x10 * 1.10, 0.92, v_fa.expense_ratio, 0.04,
                (v_fa.total_investment * 0.95)::INT, v_scenario_noi, v_scenario_yield,
                v_fa.breakeven_rent_per_unit,
                CASE WHEN v_fa.market_rent_10x10 > 0
                     THEN (v_fa.market_rent_10x10 * 1.10 - v_fa.breakeven_rent_per_unit) / (v_fa.market_rent_10x10 * 1.10)
                     ELSE 0 END,
                v_scenario_yield >= 0.12,
                CASE WHEN v_scenario_yield >= 0.15 THEN 'strong'
                     WHEN v_scenario_yield >= 0.12 THEN 'pass' ELSE 'marginal' END,
                '10% rent premium, 5% cost reduction, 92% occupancy, 4% rent growth'
            );

            -- DOWNSIDE SCENARIO: Lower rent, higher costs
            v_scenario_noi := ((v_fa.unit_count * (v_fa.market_rent_10x10 * 0.90) * 12 * 0.85) * (1 - v_fa.expense_ratio - 0.05))::INT;
            v_scenario_yield := v_scenario_noi::DECIMAL / (v_fa.total_investment * 1.10);

            INSERT INTO feasibility_scenarios (
                feasibility_id, scenario_name, scenario_type,
                lot_acres, lot_cost_per_acre, unit_count,
                market_rent, occupancy_pct, expense_ratio, rent_growth_pct,
                total_investment, stabilized_noi, stabilized_yield_pct,
                breakeven_rent, rent_cushion_pct,
                meets_target, scenario_verdict, notes
            ) VALUES (
                p_feasibility_id, 'Downside', 'pessimistic',
                v_fa.lot_acres, v_fa.lot_cost_per_acre * 1.10, v_fa.unit_count,
                v_fa.market_rent_10x10 * 0.90, 0.85, v_fa.expense_ratio + 0.05, 0.02,
                (v_fa.total_investment * 1.10)::INT, v_scenario_noi, v_scenario_yield,
                v_fa.breakeven_rent_per_unit,
                CASE WHEN v_fa.market_rent_10x10 > 0
                     THEN (v_fa.market_rent_10x10 * 0.90 - v_fa.breakeven_rent_per_unit) / (v_fa.market_rent_10x10 * 0.90)
                     ELSE 0 END,
                v_scenario_yield >= 0.12,
                CASE WHEN v_scenario_yield >= 0.12 THEN 'pass'
                     WHEN v_scenario_yield >= 0.08 THEN 'marginal' ELSE 'fail' END,
                '10% rent reduction, 10% cost increase, 85% occupancy, 40% expense ratio'
            );

            -- STRESS SCENARIO: Worst case
            v_scenario_noi := ((v_fa.unit_count * (v_fa.market_rent_10x10 * 0.80) * 12 * 0.75) * (1 - v_fa.expense_ratio - 0.10))::INT;
            v_scenario_yield := v_scenario_noi::DECIMAL / (v_fa.total_investment * 1.15);

            INSERT INTO feasibility_scenarios (
                feasibility_id, scenario_name, scenario_type,
                lot_acres, lot_cost_per_acre, unit_count,
                market_rent, occupancy_pct, expense_ratio, rent_growth_pct,
                total_investment, stabilized_noi, stabilized_yield_pct,
                breakeven_rent, rent_cushion_pct,
                meets_target, scenario_verdict, notes
            ) VALUES (
                p_feasibility_id, 'Stress', 'stress_test',
                v_fa.lot_acres, v_fa.lot_cost_per_acre * 1.15, v_fa.unit_count,
                v_fa.market_rent_10x10 * 0.80, 0.75, v_fa.expense_ratio + 0.10, 0.00,
                (v_fa.total_investment * 1.15)::INT, v_scenario_noi, v_scenario_yield,
                v_fa.breakeven_rent_per_unit,
                CASE WHEN v_fa.market_rent_10x10 > 0
                     THEN (v_fa.market_rent_10x10 * 0.80 - v_fa.breakeven_rent_per_unit) / (v_fa.market_rent_10x10 * 0.80)
                     ELSE 0 END,
                v_scenario_yield >= 0.12,
                CASE WHEN v_scenario_yield >= 0.08 THEN 'survive'
                     WHEN v_scenario_yield >= 0.05 THEN 'struggle' ELSE 'fail' END,
                '20% rent reduction, 15% cost increase, 75% occupancy, 45% expense ratio, 0% rent growth'
            );
        END;
        $func$ LANGUAGE plpgsql;
    """)
    print("Created create_feasibility_scenarios() function")

    # Batch analysis function - drop first to change return type
    cur.execute("DROP FUNCTION IF EXISTS analyze_all_feasibility(DECIMAL, INT);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION analyze_all_feasibility(
            p_lot_acres DECIMAL DEFAULT 1.5,
            p_lot_cost_per_acre INT DEFAULT 100000
        )
        RETURNS TABLE(
            out_jurisdiction VARCHAR,
            out_county VARCHAR,
            out_investment INT,
            out_stabilized_yield DECIMAL,
            out_breakeven_rent INT,
            out_cushion_rating VARCHAR,
            out_composite_score INT,
            out_verdict VARCHAR
        ) AS $func$
        DECLARE
            v_jc RECORD;
            v_feasibility_id INT;
        BEGIN
            FOR v_jc IN SELECT jc.id, jc.jurisdiction as j_name, jc.county_name FROM jurisdiction_cards jc
            LOOP
                v_feasibility_id := analyze_feasibility(v_jc.id, p_lot_acres, p_lot_cost_per_acre);

                RETURN QUERY
                SELECT
                    v_jc.j_name::VARCHAR,
                    v_jc.county_name::VARCHAR,
                    fa.total_investment,
                    fa.stabilized_yield_pct,
                    fa.breakeven_rent_per_unit,
                    fa.cushion_rating::VARCHAR,
                    fa.composite_score,
                    fa.overall_verdict::VARCHAR
                FROM feasibility_analysis fa
                WHERE fa.id = v_feasibility_id;
            END LOOP;
        END;
        $func$ LANGUAGE plpgsql;
    """)
    print("Created analyze_all_feasibility() function")


def create_views(cur):
    """Create feasibility views"""

    # Feasibility summary view
    cur.execute("""
        CREATE OR REPLACE VIEW v_feasibility_summary AS
        SELECT
            state,
            county_name,
            jurisdiction,
            -- Investment
            '$' || TO_CHAR(total_investment, 'FM999,999') as investment,
            unit_count as units,
            '$' || cost_per_unit as cost_per_unit,
            -- Returns
            ROUND(stabilized_yield_pct * 100, 1) || '%' as yield,
            -- Breakeven
            '$' || breakeven_rent_per_unit as breakeven,
            '$' || market_rent_10x10::INT as market_rent,
            '$' || rent_cushion_per_unit as cushion,
            cushion_rating,
            CASE cushion_rating
                WHEN 'strong' THEN 'GREEN'
                WHEN 'adequate' THEN 'YELLOW'
                WHEN 'thin' THEN 'ORANGE'
                WHEN 'negative' THEN 'RED'
            END as cushion_status,
            -- Scores
            composite_score,
            financial_score as fin_score,
            market_score as mkt_score,
            regulation_score as reg_score,
            -- Verdict
            overall_verdict,
            CASE overall_verdict
                WHEN 'strong_go' THEN 'STRONG GO'
                WHEN 'go' THEN 'GO'
                WHEN 'conditional' THEN 'CONDITIONAL'
                WHEN 'no_go' THEN 'NO GO'
            END as verdict_text,
            recommended_action,
            analysis_date
        FROM feasibility_analysis
        ORDER BY composite_score DESC;
    """)
    print("Created v_feasibility_summary view")

    # Investment breakdown view
    cur.execute("""
        CREATE OR REPLACE VIEW v_investment_breakdown AS
        SELECT
            jurisdiction,
            county_name,
            lot_acres,
            '$' || TO_CHAR(lot_cost_total, 'FM999,999') as land_cost,
            '$' || TO_CHAR(site_work_cost, 'FM999,999') as site_work,
            '$' || TO_CHAR(building_cost, 'FM999,999') as buildings,
            '$' || TO_CHAR(regulation_added_costs, 'FM999,999') as reg_costs,
            '$' || TO_CHAR(soft_costs, 'FM999,999') as soft_costs,
            '$' || TO_CHAR(contingency, 'FM999,999') as contingency,
            '$' || TO_CHAR(total_investment, 'FM999,999') as total,
            unit_count as units,
            '$' || cost_per_unit as per_unit
        FROM feasibility_analysis
        ORDER BY total_investment DESC;
    """)
    print("Created v_investment_breakdown view")

    # Pro forma summary view
    cur.execute("""
        CREATE OR REPLACE VIEW v_proforma_summary AS
        SELECT
            jurisdiction,
            county_name,
            unit_count,
            '$' || market_rent_10x10::INT as rent,
            -- Year 1
            ROUND(y1_occupancy_pct * 100) || '%' as y1_occ,
            '$' || TO_CHAR(y1_noi, 'FM999,999') as y1_noi,
            ROUND(y1_yield_pct * 100, 1) || '%' as y1_yield,
            -- Year 2
            ROUND(y2_occupancy_pct * 100) || '%' as y2_occ,
            '$' || TO_CHAR(y2_noi, 'FM999,999') as y2_noi,
            ROUND(y2_yield_pct * 100, 1) || '%' as y2_yield,
            -- Year 3 (Stabilized)
            ROUND(y3_occupancy_pct * 100) || '%' as y3_occ,
            '$' || TO_CHAR(y3_noi, 'FM999,999') as y3_noi,
            ROUND(y3_yield_pct * 100, 1) || '%' as y3_yield,
            -- Payback
            simple_payback_years || ' yrs' as payback
        FROM feasibility_analysis
        ORDER BY y3_yield_pct DESC;
    """)
    print("Created v_proforma_summary view")

    # Scenario comparison view
    cur.execute("""
        CREATE OR REPLACE VIEW v_scenario_comparison AS
        SELECT
            fa.jurisdiction,
            fa.county_name,
            fs.scenario_name,
            '$' || TO_CHAR(fs.total_investment, 'FM999,999') as investment,
            '$' || fs.market_rent::INT as rent,
            ROUND(fs.occupancy_pct * 100) || '%' as occupancy,
            '$' || TO_CHAR(fs.stabilized_noi, 'FM999,999') as noi,
            ROUND(fs.stabilized_yield_pct * 100, 1) || '%' as yield,
            fs.meets_target,
            fs.scenario_verdict,
            CASE fs.scenario_verdict
                WHEN 'strong' THEN 'STRONG'
                WHEN 'pass' THEN 'PASS'
                WHEN 'marginal' THEN 'MARGINAL'
                WHEN 'survive' THEN 'SURVIVE'
                WHEN 'struggle' THEN 'STRUGGLE'
                WHEN 'fail' THEN 'FAIL'
            END as verdict_text
        FROM feasibility_scenarios fs
        JOIN feasibility_analysis fa ON fs.feasibility_id = fa.id
        ORDER BY fa.composite_score DESC,
            CASE fs.scenario_name WHEN 'Upside' THEN 1 WHEN 'Downside' THEN 2 ELSE 3 END;
    """)
    print("Created v_scenario_comparison view")

    # Opportunity dashboard view
    cur.execute("""
        CREATE OR REPLACE VIEW v_opportunity_dashboard AS
        SELECT
            ROW_NUMBER() OVER (ORDER BY fa.composite_score DESC) as rank,
            fa.state,
            fa.county_name,
            fa.jurisdiction,
            -- Verdict
            fa.overall_verdict,
            CASE fa.overall_verdict
                WHEN 'strong_go' THEN 'STRONG GO'
                WHEN 'go' THEN 'GO'
                WHEN 'conditional' THEN 'CONDITIONAL'
                WHEN 'no_go' THEN 'NO GO'
            END as verdict_text,
            -- Scores
            fa.composite_score,
            fa.financial_score,
            fa.market_score,
            fa.regulation_score,
            -- Key metrics
            ROUND(fa.stabilized_yield_pct * 100, 1) as yield_pct,
            fa.cushion_rating,
            fa.market_saturation,
            fa.market_trajectory,
            -- Risk
            fa.overall_risk,
            -- Action
            fa.recommended_action,
            fa.conditions,
            fa.primary_strength,
            fa.primary_weakness
        FROM feasibility_analysis fa
        ORDER BY fa.composite_score DESC;
    """)
    print("Created v_opportunity_dashboard view")


def run_tests(cur):
    """Run feasibility analysis and display results"""

    print("\n" + "="*80)
    print("RUNNING FEASIBILITY ANALYSIS")
    print("="*80)

    # Analyze all jurisdictions
    print("\nAnalyzing all jurisdictions (1.5 acres, $100k/acre)...")
    cur.execute("SELECT * FROM analyze_all_feasibility(1.5, 100000);")
    results = cur.fetchall()

    print("\n--- Feasibility Analysis Results ---")
    print(f"{'Jurisdiction':<20} {'County':<15} {'Investment':>12} {'Yield':>8} {'Breakeven':>10} {'Cushion':>10} {'Score':>6} {'Verdict':<12}")
    print("-" * 100)
    for row in results:
        print(f"{row[0]:<20} {row[1]:<15} ${row[2]:>10,} {row[3]*100:>7.1f}% ${row[4]:>8} {row[5]:>10} {row[6]:>6} {row[7]:<12}")

    # View summary
    print("\n--- Feasibility Summary View ---")
    cur.execute("SELECT jurisdiction, investment, yield, breakeven, market_rent, cushion, cushion_status, verdict_text FROM v_feasibility_summary;")
    for row in cur.fetchall():
        print(f"{row[0]}: {row[1]} investment, {row[2]} yield, {row[3]} breakeven vs {row[4]} market ({row[5]} cushion - {row[6]}) -> {row[7]}")

    # View investment breakdown
    print("\n--- Investment Breakdown ---")
    cur.execute("SELECT jurisdiction, land_cost, site_work, buildings, reg_costs, soft_costs, contingency, total, per_unit FROM v_investment_breakdown;")
    for row in cur.fetchall():
        print(f"{row[0]}: Land={row[1]}, Site={row[2]}, Bldg={row[3]}, Reg={row[4]}, Soft={row[5]}, Conting={row[6]} -> Total={row[7]} ({row[8]}/unit)")

    # View pro forma
    print("\n--- Pro Forma Summary ---")
    cur.execute("SELECT jurisdiction, unit_count, rent, y1_occ, y1_noi, y1_yield, y2_occ, y2_noi, y2_yield, y3_occ, y3_noi, y3_yield, payback FROM v_proforma_summary;")
    for row in cur.fetchall():
        print(f"{row[0]} ({row[1]} units @ {row[2]})")
        print(f"  Y1: {row[3]} occ, {row[4]} NOI, {row[5]} yield")
        print(f"  Y2: {row[6]} occ, {row[7]} NOI, {row[8]} yield")
        print(f"  Y3: {row[9]} occ, {row[10]} NOI, {row[11]} yield | Payback: {row[12]}")

    # View scenarios
    print("\n--- Scenario Comparison ---")
    cur.execute("SELECT jurisdiction, scenario_name, investment, rent, occupancy, noi, yield, meets_target, verdict_text FROM v_scenario_comparison;")
    current_j = None
    for row in cur.fetchall():
        if row[0] != current_j:
            current_j = row[0]
            print(f"\n{current_j}:")
        meets = "YES" if row[7] else "NO"
        print(f"  {row[1]:<10}: {row[2]} inv, {row[3]} rent, {row[4]} occ -> {row[5]} NOI, {row[6]} yield (meets target: {meets}) -> {row[8]}")

    # View opportunity dashboard
    print("\n--- Opportunity Dashboard ---")
    cur.execute("""
        SELECT rank, jurisdiction, verdict_text, composite_score, financial_score, market_score, regulation_score,
               yield_pct, cushion_rating, market_saturation, market_trajectory, overall_risk,
               recommended_action, primary_strength, primary_weakness
        FROM v_opportunity_dashboard;
    """)
    for row in cur.fetchall():
        print(f"\n#{row[0]} {row[1]} - {row[2]}")
        print(f"   Scores: Composite={row[3]}, Financial={row[4]}, Market={row[5]}, Regulation={row[6]}")
        print(f"   Metrics: {row[7]}% yield, {row[8]} cushion, {row[9]} saturation, {row[10]} trajectory")
        print(f"   Risk: {row[11]} | Action: {row[12]}")
        print(f"   Strength: {row[13]}")
        print(f"   Weakness: {row[14]}")

    # Table counts
    print("\n--- Table Counts ---")
    cur.execute("""
        SELECT 'feasibility_analysis' as table_name, COUNT(*) as rows FROM feasibility_analysis
        UNION ALL
        SELECT 'feasibility_scenarios', COUNT(*) FROM feasibility_scenarios;
    """)
    for row in cur.fetchall():
        print(f"{row[0]}: {row[1]} rows")

    # Verdict distribution
    print("\n--- Verdict Distribution ---")
    cur.execute("""
        SELECT
            overall_verdict,
            CASE overall_verdict
                WHEN 'strong_go' THEN 'STRONG GO'
                WHEN 'go' THEN 'GO'
                WHEN 'conditional' THEN 'CONDITIONAL'
                WHEN 'no_go' THEN 'NO GO'
            END as verdict_text,
            COUNT(*) as jurisdictions,
            ROUND(AVG(composite_score)) as avg_score,
            ROUND(AVG(stabilized_yield_pct * 100), 1) as avg_yield
        FROM feasibility_analysis
        GROUP BY overall_verdict
        ORDER BY
            CASE overall_verdict
                WHEN 'strong_go' THEN 1
                WHEN 'go' THEN 2
                WHEN 'conditional' THEN 3
                ELSE 4
            END;
    """)
    for row in cur.fetchall():
        print(f"{row[1]}: {row[2]} jurisdictions, avg score={row[3]}, avg yield={row[4]}%")

    # Cushion distribution
    print("\n--- Cushion Distribution ---")
    cur.execute("""
        SELECT
            cushion_rating,
            CASE cushion_rating
                WHEN 'strong' THEN 'STRONG (GREEN)'
                WHEN 'adequate' THEN 'ADEQUATE (YELLOW)'
                WHEN 'thin' THEN 'THIN (ORANGE)'
                WHEN 'negative' THEN 'NEGATIVE (RED)'
            END as rating_text,
            COUNT(*) as jurisdictions,
            ROUND(AVG(rent_cushion_per_unit)) as avg_cushion,
            ROUND(AVG(stabilized_yield_pct * 100), 1) as avg_yield
        FROM feasibility_analysis
        GROUP BY cushion_rating
        ORDER BY
            CASE cushion_rating
                WHEN 'strong' THEN 1
                WHEN 'adequate' THEN 2
                WHEN 'thin' THEN 3
                ELSE 4
            END;
    """)
    for row in cur.fetchall():
        print(f"{row[1]}: {row[2]} jurisdictions, avg cushion=${row[3]}/unit, avg yield={row[4]}%")


def main():
    conn = get_connection()
    cur = conn.cursor()

    try:
        print("="*80)
        print("PROMPT 16: BUILD FEASIBILITY MODEL")
        print("="*80)

        # Create tables
        print("\n1. Creating tables...")
        create_tables(cur)
        conn.commit()

        # Create functions
        print("\n2. Creating functions...")
        create_functions(cur)
        conn.commit()

        # Create views
        print("\n3. Creating views...")
        create_views(cur)
        conn.commit()

        # Run tests
        print("\n4. Running tests...")
        run_tests(cur)
        conn.commit()

        print("\n" + "="*80)
        print("PROMPT 16 COMPLETE")
        print("="*80)

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
