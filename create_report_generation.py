"""
Prompt 20: Report Generation
Creates comprehensive market analysis report generation system.

Tables: report_templates, generated_reports
Functions: generate_executive_summary, generate_full_analysis, generate_comparison_report,
           generate_markdown_report, generate_due_diligence_checklist, save_report
Views: v_report_history
"""

import psycopg2
from datetime import datetime

# Database connection
DATABASE_URL = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def create_report_templates_table(cur):
    """Create report_templates table for configurable report types."""
    print("Creating report_templates table...")

    cur.execute("DROP TABLE IF EXISTS report_templates CASCADE;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS report_templates (
            id SERIAL PRIMARY KEY,

            template_name VARCHAR(100) NOT NULL,
            template_type VARCHAR(50) NOT NULL,

            -- Sections included
            include_executive_summary BOOLEAN DEFAULT TRUE,
            include_market_overview BOOLEAN DEFAULT TRUE,
            include_supply_analysis BOOLEAN DEFAULT TRUE,
            include_demand_analysis BOOLEAN DEFAULT TRUE,
            include_pipeline_analysis BOOLEAN DEFAULT TRUE,
            include_catalyst_analysis BOOLEAN DEFAULT TRUE,
            include_regulatory_analysis BOOLEAN DEFAULT TRUE,
            include_financial_analysis BOOLEAN DEFAULT TRUE,
            include_risk_assessment BOOLEAN DEFAULT TRUE,
            include_recommendation BOOLEAN DEFAULT TRUE,
            include_appendix BOOLEAN DEFAULT FALSE,

            -- Formatting
            include_charts BOOLEAN DEFAULT TRUE,
            include_tables BOOLEAN DEFAULT TRUE,
            include_maps BOOLEAN DEFAULT TRUE,

            -- Metadata
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(template_name)
        );
    """)

    # Insert default templates
    cur.execute("""
        INSERT INTO report_templates (template_name, template_type, description) VALUES
        ('Executive Summary', 'executive_summary', '1-2 page high-level overview for quick decision-making'),
        ('Full Market Analysis', 'full_analysis', 'Comprehensive analysis with all sections and data'),
        ('Market Comparison', 'comparison', 'Side-by-side comparison of multiple markets'),
        ('Due Diligence Checklist', 'due_diligence', 'Pre-acquisition checklist and verification items')
        ON CONFLICT DO NOTHING;
    """)

    print("  Created report_templates table with 4 default templates")


def create_generated_reports_table(cur):
    """Create generated_reports table for storing generated reports."""
    print("Creating generated_reports table...")

    cur.execute("DROP TABLE IF EXISTS generated_reports CASCADE;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS generated_reports (
            id SERIAL PRIMARY KEY,

            -- Report identification
            report_uuid UUID DEFAULT gen_random_uuid(),
            report_name VARCHAR(200) NOT NULL,
            report_type VARCHAR(50) NOT NULL,
            template_id INT REFERENCES report_templates(id),

            -- Scope
            geo_type VARCHAR(20),
            geo_ids TEXT[],
            county_fips_list TEXT[],

            -- Content
            report_json JSONB,
            report_markdown TEXT,

            -- Metadata
            generated_at TIMESTAMP DEFAULT NOW(),
            generated_by VARCHAR(100),

            -- Status
            is_draft BOOLEAN DEFAULT FALSE,
            is_archived BOOLEAN DEFAULT FALSE,

            notes TEXT
        );

        CREATE INDEX idx_gr_uuid ON generated_reports(report_uuid);
        CREATE INDEX idx_gr_type ON generated_reports(report_type);
        CREATE INDEX idx_gr_date ON generated_reports(generated_at);
    """)

    print("  Created generated_reports table")


def create_executive_summary_function(cur):
    """Create function to generate executive summary report."""
    print("Creating generate_executive_summary function...")

    cur.execute("DROP FUNCTION IF EXISTS generate_executive_summary(VARCHAR);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION generate_executive_summary(p_county_fips VARCHAR(5))
        RETURNS JSONB AS $func$
        DECLARE
            v_county layer_3_counties%ROWTYPE;
            v_ms market_scores%ROWTYPE;
            v_fa feasibility_analysis%ROWTYPE;
            v_ma market_analysis%ROWTYPE;
            v_mp market_projections%ROWTYPE;
            v_jc jurisdiction_cards%ROWTYPE;
            v_catalyst_count INT;
            v_catalyst_jobs INT;
            v_catalyst_investment BIGINT;
            v_catalyst_sqft INT;
            v_report JSONB;
        BEGIN
            -- Gather all data
            SELECT * INTO v_county FROM layer_3_counties WHERE county_fips = p_county_fips;
            SELECT * INTO v_ms FROM market_scores WHERE county_fips = p_county_fips ORDER BY scored_at DESC LIMIT 1;
            SELECT * INTO v_fa FROM feasibility_analysis WHERE county_fips = p_county_fips ORDER BY created_at DESC LIMIT 1;
            SELECT * INTO v_ma FROM market_analysis WHERE geo_id = p_county_fips AND geo_type = 'county' ORDER BY analysis_date DESC LIMIT 1;
            SELECT * INTO v_mp FROM market_projections WHERE geo_id = p_county_fips AND geo_type = 'county' ORDER BY projection_date DESC LIMIT 1;
            SELECT * INTO v_jc FROM jurisdiction_cards WHERE county_fips = p_county_fips LIMIT 1;

            -- Get catalyst summary
            SELECT
                COUNT(*),
                COALESCE(SUM(jobs_announced), 0),
                COALESCE(SUM(investment_amount), 0),
                COALESCE(SUM(storage_demand_sqft), 0)
            INTO v_catalyst_count, v_catalyst_jobs, v_catalyst_investment, v_catalyst_sqft
            FROM economic_catalysts
            WHERE county_fips = p_county_fips AND is_active = TRUE;

            -- Build report
            v_report := jsonb_build_object(
                'report_type', 'executive_summary',
                'generated_at', NOW(),

                'header', jsonb_build_object(
                    'title', v_county.county_name || ', ' || v_county.state || ' - Market Analysis',
                    'county_fips', p_county_fips,
                    'date', CURRENT_DATE,
                    'score', ROUND(COALESCE(v_ms.composite_score, 0), 1),
                    'tier', COALESCE(v_ms.tier, 'N/A'),
                    'recommendation', COALESCE(v_ms.recommendation, 'N/A')
                ),

                'verdict', jsonb_build_object(
                    'recommendation', COALESCE(v_ms.recommendation, 'N/A'),
                    'recommendation_display', CASE v_ms.recommendation
                        WHEN 'strong_pursue' THEN 'STRONG PURSUE'
                        WHEN 'pursue' THEN 'PURSUE'
                        WHEN 'monitor' THEN 'MONITOR'
                        WHEN 'avoid' THEN 'AVOID'
                        ELSE 'N/A'
                    END,
                    'score', ROUND(COALESCE(v_ms.composite_score, 0), 1),
                    'tier', COALESCE(v_ms.tier, 'N/A'),
                    'tier_display', CASE v_ms.tier
                        WHEN 'A' THEN 'Tier A'
                        WHEN 'B' THEN 'Tier B'
                        WHEN 'C' THEN 'Tier C'
                        WHEN 'D' THEN 'Tier D'
                        WHEN 'F' THEN 'Tier F'
                        ELSE 'N/A'
                    END,
                    'fatal_flaw', COALESCE(v_ms.has_fatal_flaw, FALSE),
                    'fatal_flaw_reasons', COALESCE(v_ms.fatal_flaw_reasons, ARRAY[]::TEXT[])
                ),

                'key_metrics', jsonb_build_object(
                    'yield', jsonb_build_object(
                        'value', ROUND(COALESCE(v_fa.stabilized_yield_pct * 100, 0), 1),
                        'display', ROUND(COALESCE(v_fa.stabilized_yield_pct * 100, 0), 1) || '%',
                        'rating', CASE
                            WHEN v_fa.stabilized_yield_pct >= 0.15 THEN 'excellent'
                            WHEN v_fa.stabilized_yield_pct >= 0.12 THEN 'good'
                            WHEN v_fa.stabilized_yield_pct >= 0.10 THEN 'acceptable'
                            ELSE 'poor'
                        END
                    ),
                    'cushion', jsonb_build_object(
                        'value', ROUND(COALESCE(v_fa.rent_cushion_pct * 100, 0), 1),
                        'display', ROUND(COALESCE(v_fa.rent_cushion_pct * 100, 0), 1) || '%',
                        'dollars', COALESCE(v_fa.rent_cushion_per_unit, 0),
                        'rating', COALESCE(v_fa.cushion_rating, 'N/A')
                    ),
                    'saturation', jsonb_build_object(
                        'value', COALESCE(v_ma.sqft_per_capita, 0),
                        'display', COALESCE(v_ma.sqft_per_capita, 0) || ' sq ft/capita',
                        'level', COALESCE(v_ma.saturation_level, 'N/A'),
                        'rating', CASE v_ma.saturation_level
                            WHEN 'undersupplied' THEN 'excellent'
                            WHEN 'balanced' THEN 'good'
                            WHEN 'oversupplied' THEN 'caution'
                            ELSE 'unknown'
                        END
                    ),
                    'trajectory', jsonb_build_object(
                        'direction', COALESCE(v_mp.trajectory, 'N/A'),
                        'display', CASE v_mp.trajectory
                            WHEN 'improving' THEN 'Improving'
                            WHEN 'stable' THEN 'Stable'
                            WHEN 'deteriorating' THEN 'Deteriorating'
                            ELSE 'N/A'
                        END
                    )
                ),

                'investment_summary', jsonb_build_object(
                    'total_investment', COALESCE(v_fa.total_investment, 0),
                    'total_investment_display', '$' || TO_CHAR(COALESCE(v_fa.total_investment, 0), 'FM999,999,999'),
                    'unit_count', COALESCE(v_fa.unit_count, 0),
                    'cost_per_unit', COALESCE(v_fa.cost_per_unit, 0),
                    'market_rent', COALESCE(v_fa.market_rent_10x10, 0),
                    'breakeven_rent', COALESCE(v_fa.breakeven_rent_per_unit, 0),
                    'stabilized_noi', COALESCE(v_fa.stabilized_noi, 0),
                    'stabilized_noi_display', '$' || TO_CHAR(COALESCE(v_fa.stabilized_noi, 0), 'FM999,999')
                ),

                'market_snapshot', jsonb_build_object(
                    'population', COALESCE(v_ma.population, v_county.total_population),
                    'households', COALESCE(v_ma.households, 0),
                    'existing_facilities', COALESCE(v_ma.facility_count, 0),
                    'existing_supply_sqft', COALESCE(v_ma.total_supply_sqft, 0),
                    'avg_rent', COALESCE(v_ma.avg_rent_10x10, 0),
                    'high_demand_units', COALESCE(v_ma.high_demand_units, 0)
                ),

                'pipeline_snapshot', jsonb_build_object(
                    'housing_units_total', COALESCE(v_mp.pipeline_total_units, 0),
                    'housing_vertical', COALESCE(v_mp.pipeline_vertical_units, 0),
                    'housing_site_work', COALESCE(v_mp.pipeline_site_work_units, 0),
                    'housing_permitted', COALESCE(v_mp.pipeline_permitted_units, 0),
                    'storage_pipeline_sqft', COALESCE(v_mp.storage_pipeline_sqft, 0),
                    'supply_demand_gap', COALESCE(v_mp.supply_demand_gap, 0)
                ),

                'catalyst_snapshot', jsonb_build_object(
                    'total_catalysts', v_catalyst_count,
                    'jobs_announced', v_catalyst_jobs,
                    'total_investment', v_catalyst_investment,
                    'storage_demand_sqft', v_catalyst_sqft
                ),

                'scores', jsonb_build_object(
                    'composite', ROUND(COALESCE(v_ms.composite_score, 0), 1),
                    'financial', ROUND(COALESCE(v_ms.financial_score, 0), 1),
                    'market', ROUND(COALESCE(v_ms.market_score, 0), 1),
                    'trajectory', ROUND(COALESCE(v_ms.trajectory_score, 0), 1),
                    'catalyst', ROUND(COALESCE(v_ms.catalyst_score, 0), 1),
                    'regulation', ROUND(COALESCE(v_ms.regulation_score, 0), 1)
                ),

                'risk_summary', jsonb_build_object(
                    'demand_risk', COALESCE(v_mp.demand_risk, 'N/A'),
                    'supply_risk', COALESCE(v_mp.supply_risk, 'N/A'),
                    'timing_risk', COALESCE(v_mp.timing_risk, 'N/A'),
                    'overall_risk', COALESCE(v_mp.overall_risk, 'N/A'),
                    'regulation_difficulty', COALESCE(v_jc.difficulty_rating, 'N/A')
                )
            );

            RETURN v_report;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created generate_executive_summary function")


def create_full_analysis_function(cur):
    """Create function to generate full market analysis report."""
    print("Creating generate_full_analysis function...")

    cur.execute("DROP FUNCTION IF EXISTS generate_full_analysis(VARCHAR);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION generate_full_analysis(p_county_fips VARCHAR(5))
        RETURNS JSONB AS $func$
        DECLARE
            v_executive JSONB;
            v_county layer_3_counties%ROWTYPE;
            v_fa feasibility_analysis%ROWTYPE;
            v_ma market_analysis%ROWTYPE;
            v_jc jurisdiction_cards%ROWTYPE;
            v_facilities JSONB;
            v_housing_pipeline JSONB;
            v_catalysts JSONB;
            v_infrastructure JSONB;
            v_regulations JSONB;
            v_proforma JSONB;
            v_scenarios JSONB;
            v_report JSONB;
        BEGIN
            -- Get executive summary as base
            v_executive := generate_executive_summary(p_county_fips);

            -- Get core records
            SELECT * INTO v_county FROM layer_3_counties WHERE county_fips = p_county_fips;
            SELECT * INTO v_fa FROM feasibility_analysis WHERE county_fips = p_county_fips ORDER BY created_at DESC LIMIT 1;
            SELECT * INTO v_ma FROM market_analysis WHERE geo_id = p_county_fips AND geo_type = 'county' ORDER BY analysis_date DESC LIMIT 1;
            SELECT * INTO v_jc FROM jurisdiction_cards WHERE county_fips = p_county_fips LIMIT 1;

            -- Gather facilities
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'name', name,
                'address', address,
                'city', city,
                'total_sqft', total_sqft,
                'unit_count', unit_count,
                'climate_controlled', climate_controlled,
                'rating', rating,
                'review_count', review_count
            ) ORDER BY total_sqft DESC NULLS LAST), '[]'::jsonb)
            INTO v_facilities
            FROM storage_facilities
            WHERE county_fips = p_county_fips;

            -- Gather housing pipeline
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'project_name', project_name,
                'housing_type', housing_type,
                'unit_count', unit_count,
                'status', pipeline_status,
                'city', city,
                'permit_date', application_date
            ) ORDER BY unit_count DESC NULLS LAST), '[]'::jsonb)
            INTO v_housing_pipeline
            FROM housing_pipeline
            WHERE county_fips = p_county_fips;

            -- Gather catalysts
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'name', catalyst_name,
                'type', catalyst_type,
                'subtype', catalyst_subtype,
                'company', company_name,
                'jobs', jobs_announced,
                'investment', investment_amount,
                'status', status,
                'demand_impact', demand_impact,
                'storage_demand', storage_demand_sqft
            ) ORDER BY demand_score DESC NULLS LAST), '[]'::jsonb)
            INTO v_catalysts
            FROM economic_catalysts
            WHERE county_fips = p_county_fips AND is_active = TRUE;

            -- Gather infrastructure
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'stip_id', ip.stip_id,
                'route', ip.route_name,
                'project_type', ip.project_subtype,
                'is_new_interchange', ip.is_new_interchange,
                'cost', ip.total_cost,
                'phase', ip.current_phase,
                'storage_relevance', ip.storage_site_relevance
            ) ORDER BY ip.total_cost DESC NULLS LAST), '[]'::jsonb)
            INTO v_infrastructure
            FROM infrastructure_projects ip
            JOIN economic_catalysts ec ON ip.catalyst_id = ec.id
            WHERE ec.county_fips = p_county_fips;

            -- Build regulations section
            v_regulations := jsonb_build_object(
                'jurisdiction', COALESCE(v_jc.jurisdiction, 'Unknown'),
                'storage_allowed', COALESCE(v_jc.storage_allowed, 'Unknown'),
                'storage_zones', COALESCE(v_jc.storage_zones, 'Unknown'),
                'public_hearing_required', COALESCE(v_jc.public_hearing_required, FALSE),
                'setbacks', jsonb_build_object(
                    'front', COALESCE(v_jc.setback_front_ft, 0),
                    'side', COALESCE(v_jc.setback_side_ft, 0),
                    'rear', COALESCE(v_jc.setback_rear_ft, 0)
                ),
                'height_limit', COALESCE(v_jc.max_building_height_ft, 0),
                'lot_coverage_max', COALESCE(v_jc.max_lot_coverage_pct, 0),
                'fence_required', COALESCE(v_jc.fence_required, FALSE),
                'stormwater_required', COALESCE(v_jc.stormwater_required, FALSE),
                'difficulty_score', COALESCE(v_jc.difficulty_score, 0),
                'difficulty_rating', COALESCE(v_jc.difficulty_rating, 'Unknown'),
                'approval_timeline_days', COALESCE(v_jc.approval_timeline_days, 0)
            );

            -- Build pro forma section
            v_proforma := jsonb_build_object(
                'investment', jsonb_build_object(
                    'land', COALESCE(v_fa.lot_cost_total, 0),
                    'site_work', COALESCE(v_fa.site_work_cost, 0),
                    'buildings', COALESCE(v_fa.building_cost, 0),
                    'regulation_costs', COALESCE(v_fa.regulation_added_costs, 0),
                    'soft_costs', COALESCE(v_fa.soft_costs, 0),
                    'contingency', COALESCE(v_fa.contingency, 0),
                    'total', COALESCE(v_fa.total_investment, 0)
                ),
                'capacity', jsonb_build_object(
                    'buildings', COALESCE(v_fa.building_count, 0),
                    'units', COALESCE(v_fa.unit_count, 0),
                    'rentable_sqft', COALESCE(v_fa.rentable_sqft, 0)
                ),
                'year_1', jsonb_build_object(
                    'occupancy', ROUND(COALESCE(v_fa.y1_occupancy_pct * 100, 0)),
                    'noi', COALESCE(v_fa.y1_noi, 0),
                    'yield', ROUND(COALESCE(v_fa.y1_yield_pct * 100, 0), 1)
                ),
                'year_2', jsonb_build_object(
                    'occupancy', ROUND(COALESCE(v_fa.y2_occupancy_pct * 100, 0)),
                    'noi', COALESCE(v_fa.y2_noi, 0),
                    'yield', ROUND(COALESCE(v_fa.y2_yield_pct * 100, 0), 1)
                ),
                'year_3', jsonb_build_object(
                    'occupancy', ROUND(COALESCE(v_fa.y3_occupancy_pct * 100, 0)),
                    'noi', COALESCE(v_fa.y3_noi, 0),
                    'yield', ROUND(COALESCE(v_fa.y3_yield_pct * 100, 0), 1)
                ),
                'breakeven', jsonb_build_object(
                    'rent_per_unit', COALESCE(v_fa.breakeven_rent_per_unit, 0),
                    'occupancy_pct', ROUND(COALESCE(v_fa.occupancy_breakeven_pct * 100, 0), 1)
                ),
                'sensitivity', jsonb_build_object(
                    'rent_for_10pct', COALESCE(v_fa.rent_for_10pct_yield, 0),
                    'rent_for_12pct', COALESCE(v_fa.rent_for_12pct_yield, 0),
                    'rent_for_15pct', COALESCE(v_fa.rent_for_15pct_yield, 0)
                )
            );

            -- Gather scenarios
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'scenario', scenario_name,
                'type', scenario_type,
                'rent', market_rent,
                'occupancy', ROUND(occupancy_pct * 100),
                'investment', total_investment,
                'noi', stabilized_noi,
                'yield', ROUND(stabilized_yield_pct * 100, 1),
                'meets_target', meets_target,
                'verdict', scenario_verdict
            ) ORDER BY
                CASE scenario_name WHEN 'Upside' THEN 1 WHEN 'Downside' THEN 2 ELSE 3 END
            ), '[]'::jsonb)
            INTO v_scenarios
            FROM feasibility_scenarios
            WHERE feasibility_id = v_fa.id;

            -- Combine into full report
            v_report := v_executive || jsonb_build_object(
                'report_type', 'full_analysis',

                'supply_analysis', jsonb_build_object(
                    'summary', jsonb_build_object(
                        'facility_count', COALESCE(v_ma.facility_count, 0),
                        'total_sqft', COALESCE(v_ma.total_supply_sqft, 0),
                        'climate_sqft', COALESCE(v_ma.climate_supply_sqft, 0),
                        'reit_facilities', COALESCE(v_ma.reit_facilities, 0),
                        'independent_facilities', COALESCE(v_ma.independent_facilities, 0),
                        'top_operator', COALESCE(v_ma.top_operator, 'Unknown'),
                        'avg_rent', COALESCE(v_ma.avg_rent_10x10, 0)
                    ),
                    'facilities', v_facilities
                ),

                'demand_analysis', jsonb_build_object(
                    'population', COALESCE(v_ma.population, 0),
                    'households', COALESCE(v_ma.households, 0),
                    'high_demand_units', COALESCE(v_ma.high_demand_units, 0),
                    'low_demand_units', COALESCE(v_ma.low_demand_units, 0),
                    'base_demand_sqft', COALESCE(v_ma.base_demand_sqft, 0),
                    'adjusted_demand_sqft', COALESCE(v_ma.adjusted_demand_sqft, 0)
                ),

                'pipeline_analysis', jsonb_build_object(
                    'housing_projects', v_housing_pipeline
                ),

                'catalyst_analysis', jsonb_build_object(
                    'catalysts', v_catalysts,
                    'infrastructure', v_infrastructure
                ),

                'regulatory_analysis', v_regulations,

                'financial_analysis', jsonb_build_object(
                    'proforma', v_proforma,
                    'scenarios', v_scenarios
                )
            );

            RETURN v_report;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created generate_full_analysis function")


def create_comparison_report_function(cur):
    """Create function to generate comparison report for multiple markets."""
    print("Creating generate_comparison_report function...")

    cur.execute("DROP FUNCTION IF EXISTS generate_comparison_report(TEXT[]);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION generate_comparison_report(p_county_fips_list TEXT[])
        RETURNS JSONB AS $func$
        DECLARE
            v_fips TEXT;
            v_markets JSONB := '[]'::JSONB;
            v_market JSONB;
            v_summary JSONB;
            v_comparison_table JSONB;
            v_report JSONB;
        BEGIN
            -- Generate executive summary for each market
            FOREACH v_fips IN ARRAY p_county_fips_list
            LOOP
                v_market := generate_executive_summary(v_fips);
                v_markets := v_markets || jsonb_build_array(v_market);
            END LOOP;

            -- Build comparison summary
            SELECT jsonb_build_object(
                'market_count', array_length(p_county_fips_list, 1),
                'top_market', (
                    SELECT c.county_name FROM market_scores ms
                    JOIN layer_3_counties c ON ms.county_fips = c.county_fips
                    WHERE ms.county_fips = ANY(p_county_fips_list)
                    ORDER BY ms.composite_score DESC LIMIT 1
                ),
                'score_range', jsonb_build_object(
                    'min', (SELECT ROUND(MIN(composite_score), 1) FROM market_scores WHERE county_fips = ANY(p_county_fips_list)),
                    'max', (SELECT ROUND(MAX(composite_score), 1) FROM market_scores WHERE county_fips = ANY(p_county_fips_list)),
                    'avg', (SELECT ROUND(AVG(composite_score), 1) FROM market_scores WHERE county_fips = ANY(p_county_fips_list))
                ),
                'recommendations', (
                    SELECT jsonb_object_agg(recommendation, cnt)
                    FROM (
                        SELECT recommendation, COUNT(*) as cnt
                        FROM market_scores
                        WHERE county_fips = ANY(p_county_fips_list)
                        GROUP BY recommendation
                    ) sub
                )
            ) INTO v_summary;

            -- Build comparison table (use subquery to add rank)
            SELECT jsonb_agg(jsonb_build_object(
                'rank', ranked.rn,
                'county', ranked.county_name,
                'state', ranked.state,
                'score', ranked.score,
                'tier', ranked.tier,
                'recommendation', ranked.recommendation,
                'yield', ranked.yield_pct,
                'cushion', ranked.cushion,
                'saturation', ranked.saturation,
                'financial_score', ranked.financial_score,
                'market_score', ranked.market_score,
                'has_fatal_flaw', ranked.has_fatal_flaw
            ) ORDER BY ranked.score DESC)
            INTO v_comparison_table
            FROM (
                SELECT
                    ROW_NUMBER() OVER (ORDER BY ms.composite_score DESC) as rn,
                    c.county_name,
                    c.state,
                    ROUND(ms.composite_score, 1) as score,
                    ms.tier,
                    ms.recommendation,
                    ROUND(ms.raw_projected_yield, 1) as yield_pct,
                    ms.raw_rent_cushion as cushion,
                    ROUND(ms.raw_saturation_ratio, 1) as saturation,
                    ROUND(ms.financial_score, 1) as financial_score,
                    ROUND(ms.market_score, 1) as market_score,
                    ms.has_fatal_flaw
                FROM market_scores ms
                JOIN layer_3_counties c ON ms.county_fips = c.county_fips
                WHERE ms.county_fips = ANY(p_county_fips_list)
            ) ranked;

            -- Build report
            v_report := jsonb_build_object(
                'report_type', 'comparison',
                'generated_at', NOW(),
                'summary', v_summary,
                'markets', v_markets,
                'comparison_table', COALESCE(v_comparison_table, '[]'::jsonb)
            );

            RETURN v_report;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created generate_comparison_report function")


def create_markdown_report_function(cur):
    """Create function to generate markdown report."""
    print("Creating generate_markdown_report function...")

    cur.execute("DROP FUNCTION IF EXISTS generate_markdown_report(VARCHAR);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION generate_markdown_report(p_county_fips VARCHAR(5))
        RETURNS TEXT AS $func$
        DECLARE
            v_json JSONB;
            v_md TEXT;
        BEGIN
            -- Get full analysis JSON
            v_json := generate_full_analysis(p_county_fips);

            -- Build markdown
            v_md := '# ' || (v_json->'header'->>'title') || E'\n\n';
            v_md := v_md || '**Generated:** ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI') || E'\n\n';

            -- Verdict box
            v_md := v_md || '---' || E'\n';
            v_md := v_md || '## ' || (v_json->'verdict'->>'recommendation_display') || E'\n\n';
            v_md := v_md || '**Score:** ' || (v_json->'verdict'->>'score') || '/100 | ';
            v_md := v_md || '**Tier:** ' || (v_json->'verdict'->>'tier_display') || E'\n\n';

            IF (v_json->'verdict'->>'fatal_flaw')::BOOLEAN THEN
                v_md := v_md || '**Fatal Flaw:** ' || array_to_string((
                    SELECT array_agg(elem::TEXT) FROM jsonb_array_elements_text(v_json->'verdict'->'fatal_flaw_reasons') elem
                ), '; ') || E'\n\n';
            END IF;
            v_md := v_md || '---' || E'\n\n';

            -- Key Metrics
            v_md := v_md || '## Key Metrics' || E'\n\n';
            v_md := v_md || '| Metric | Value | Rating |' || E'\n';
            v_md := v_md || '|--------|-------|--------|' || E'\n';
            v_md := v_md || '| Stabilized Yield | ' || (v_json->'key_metrics'->'yield'->>'display') || ' | ' || (v_json->'key_metrics'->'yield'->>'rating') || ' |' || E'\n';
            v_md := v_md || '| Rent Cushion | ' || (v_json->'key_metrics'->'cushion'->>'display') || ' ($' || (v_json->'key_metrics'->'cushion'->>'dollars') || '/unit) | ' || (v_json->'key_metrics'->'cushion'->>'rating') || ' |' || E'\n';
            v_md := v_md || '| Market Saturation | ' || (v_json->'key_metrics'->'saturation'->>'display') || ' | ' || (v_json->'key_metrics'->'saturation'->>'rating') || ' |' || E'\n';
            v_md := v_md || '| Trajectory | ' || (v_json->'key_metrics'->'trajectory'->>'display') || ' | - |' || E'\n\n';

            -- Investment Summary
            v_md := v_md || '## Investment Summary' || E'\n\n';
            v_md := v_md || '- **Total Investment:** ' || (v_json->'investment_summary'->>'total_investment_display') || E'\n';
            v_md := v_md || '- **Units:** ' || (v_json->'investment_summary'->>'unit_count') || ' @ $' || (v_json->'investment_summary'->>'cost_per_unit') || '/unit' || E'\n';
            v_md := v_md || '- **Market Rent:** $' || ROUND((v_json->'investment_summary'->>'market_rent')::DECIMAL) || '/month (10x10)' || E'\n';
            v_md := v_md || '- **Breakeven Rent:** $' || (v_json->'investment_summary'->>'breakeven_rent') || '/month' || E'\n';
            v_md := v_md || '- **Stabilized NOI:** ' || (v_json->'investment_summary'->>'stabilized_noi_display') || E'\n\n';

            -- Score Breakdown
            v_md := v_md || '## Score Breakdown' || E'\n\n';
            v_md := v_md || '| Component | Score |' || E'\n';
            v_md := v_md || '|-----------|-------|' || E'\n';
            v_md := v_md || '| Financial | ' || (v_json->'scores'->>'financial') || '/100 |' || E'\n';
            v_md := v_md || '| Market | ' || (v_json->'scores'->>'market') || '/100 |' || E'\n';
            v_md := v_md || '| Trajectory | ' || (v_json->'scores'->>'trajectory') || '/100 |' || E'\n';
            v_md := v_md || '| Catalyst | ' || (v_json->'scores'->>'catalyst') || '/100 |' || E'\n';
            v_md := v_md || '| Regulation | ' || (v_json->'scores'->>'regulation') || '/100 |' || E'\n';
            v_md := v_md || '| **Composite** | **' || (v_json->'scores'->>'composite') || '/100** |' || E'\n\n';

            -- Market Snapshot
            v_md := v_md || '## Market Snapshot' || E'\n\n';
            v_md := v_md || '- **Population:** ' || TO_CHAR((v_json->'market_snapshot'->>'population')::INT, 'FM999,999') || E'\n';
            v_md := v_md || '- **Households:** ' || TO_CHAR((v_json->'market_snapshot'->>'households')::INT, 'FM999,999') || E'\n';
            v_md := v_md || '- **Existing Facilities:** ' || (v_json->'market_snapshot'->>'existing_facilities') || E'\n';
            v_md := v_md || '- **Existing Supply:** ' || TO_CHAR((v_json->'market_snapshot'->>'existing_supply_sqft')::INT, 'FM999,999') || ' sq ft' || E'\n';
            v_md := v_md || '- **Avg Rent (10x10):** $' || ROUND((v_json->'market_snapshot'->>'avg_rent')::DECIMAL) || '/month' || E'\n';
            v_md := v_md || '- **High Demand Units:** ' || TO_CHAR((v_json->'market_snapshot'->>'high_demand_units')::INT, 'FM999,999') || ' (apt/TH/condo)' || E'\n\n';

            -- Pipeline Snapshot
            v_md := v_md || '## Pipeline Snapshot' || E'\n\n';
            v_md := v_md || '| Status | Units |' || E'\n';
            v_md := v_md || '|--------|-------|' || E'\n';
            v_md := v_md || '| Vertical | ' || COALESCE((v_json->'pipeline_snapshot'->>'housing_vertical'), '0') || ' |' || E'\n';
            v_md := v_md || '| Site Work | ' || COALESCE((v_json->'pipeline_snapshot'->>'housing_site_work'), '0') || ' |' || E'\n';
            v_md := v_md || '| Permitted | ' || COALESCE((v_json->'pipeline_snapshot'->>'housing_permitted'), '0') || ' |' || E'\n';
            v_md := v_md || '| **Total** | **' || COALESCE((v_json->'pipeline_snapshot'->>'housing_units_total'), '0') || '** |' || E'\n\n';
            v_md := v_md || '- **Storage Pipeline:** ' || TO_CHAR(COALESCE((v_json->'pipeline_snapshot'->>'storage_pipeline_sqft')::INT, 0), 'FM999,999') || ' sq ft' || E'\n';
            v_md := v_md || '- **Supply/Demand Gap:** ' || TO_CHAR(COALESCE((v_json->'pipeline_snapshot'->>'supply_demand_gap')::INT, 0), 'FM999,999') || ' sq ft' || E'\n\n';

            -- Catalyst Summary
            v_md := v_md || '## Economic Catalysts' || E'\n\n';
            v_md := v_md || '- **Active Catalysts:** ' || (v_json->'catalyst_snapshot'->>'total_catalysts') || E'\n';
            v_md := v_md || '- **Jobs Announced:** ' || TO_CHAR((v_json->'catalyst_snapshot'->>'jobs_announced')::INT, 'FM999,999') || E'\n';
            v_md := v_md || '- **Total Investment:** $' || TO_CHAR((v_json->'catalyst_snapshot'->>'total_investment')::BIGINT, 'FM999,999,999') || E'\n';
            v_md := v_md || '- **Storage Demand Generated:** ' || TO_CHAR((v_json->'catalyst_snapshot'->>'storage_demand_sqft')::INT, 'FM999,999') || ' sq ft' || E'\n\n';

            -- Risk Summary
            v_md := v_md || '## Risk Assessment' || E'\n\n';
            v_md := v_md || '| Risk Type | Level |' || E'\n';
            v_md := v_md || '|-----------|-------|' || E'\n';
            v_md := v_md || '| Demand Risk | ' || COALESCE((v_json->'risk_summary'->>'demand_risk'), 'N/A') || ' |' || E'\n';
            v_md := v_md || '| Supply Risk | ' || COALESCE((v_json->'risk_summary'->>'supply_risk'), 'N/A') || ' |' || E'\n';
            v_md := v_md || '| Timing Risk | ' || COALESCE((v_json->'risk_summary'->>'timing_risk'), 'N/A') || ' |' || E'\n';
            v_md := v_md || '| Regulation Difficulty | ' || COALESCE((v_json->'risk_summary'->>'regulation_difficulty'), 'N/A') || ' |' || E'\n';
            v_md := v_md || '| **Overall** | **' || COALESCE((v_json->'risk_summary'->>'overall_risk'), 'N/A') || '** |' || E'\n\n';

            -- Footer
            v_md := v_md || '---' || E'\n';
            v_md := v_md || '*Report generated by Storage Site Screener*' || E'\n';

            RETURN v_md;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created generate_markdown_report function")


def create_due_diligence_function(cur):
    """Create function to generate due diligence checklist."""
    print("Creating generate_due_diligence_checklist function...")

    cur.execute("DROP FUNCTION IF EXISTS generate_due_diligence_checklist(VARCHAR);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION generate_due_diligence_checklist(p_county_fips VARCHAR(5))
        RETURNS JSONB AS $func$
        DECLARE
            v_county layer_3_counties%ROWTYPE;
            v_jc jurisdiction_cards%ROWTYPE;
            v_fa feasibility_analysis%ROWTYPE;
            v_checklist JSONB;
        BEGIN
            SELECT * INTO v_county FROM layer_3_counties WHERE county_fips = p_county_fips;
            SELECT * INTO v_jc FROM jurisdiction_cards WHERE county_fips = p_county_fips LIMIT 1;
            SELECT * INTO v_fa FROM feasibility_analysis WHERE county_fips = p_county_fips ORDER BY created_at DESC LIMIT 1;

            v_checklist := jsonb_build_object(
                'report_type', 'due_diligence',
                'generated_at', NOW(),
                'market', v_county.county_name || ', ' || v_county.state,
                'jurisdiction', COALESCE(v_jc.jurisdiction, 'Unknown'),

                'regulatory_checklist', jsonb_build_array(
                    jsonb_build_object('item', 'Verify zoning allows self-storage', 'category', 'zoning', 'priority', 'critical', 'status', 'pending',
                        'notes', 'Allowed zones: ' || COALESCE(v_jc.storage_zones, 'Unknown')),
                    jsonb_build_object('item', 'Confirm special use permit requirement', 'category', 'zoning', 'priority', 'high', 'status', 'pending',
                        'notes', CASE WHEN v_jc.public_hearing_required THEN 'Public hearing may be required' ELSE 'Check local requirements' END),
                    jsonb_build_object('item', 'Review public hearing requirements', 'category', 'zoning', 'priority',
                        CASE WHEN v_jc.public_hearing_required THEN 'high' ELSE 'medium' END, 'status', 'pending',
                        'notes', CASE WHEN v_jc.public_hearing_required THEN 'Public hearing required' ELSE 'No public hearing required' END),
                    jsonb_build_object('item', 'Verify setback requirements', 'category', 'site', 'priority', 'high', 'status', 'pending',
                        'notes', 'Front: ' || COALESCE(v_jc.setback_front_ft::TEXT, '?') || 'ft, Side: ' || COALESCE(v_jc.setback_side_ft::TEXT, '?') || 'ft, Rear: ' || COALESCE(v_jc.setback_rear_ft::TEXT, '?') || 'ft'),
                    jsonb_build_object('item', 'Confirm height restrictions', 'category', 'site', 'priority', 'medium', 'status', 'pending',
                        'notes', 'Max height: ' || COALESCE(v_jc.max_building_height_ft::TEXT, '?') || ' ft'),
                    jsonb_build_object('item', 'Review landscaping requirements', 'category', 'site', 'priority', 'medium', 'status', 'pending',
                        'notes', COALESCE(v_jc.tree_requirements, 'Check local requirements')),
                    jsonb_build_object('item', 'Review stormwater requirements', 'category', 'site', 'priority', 'high', 'status', 'pending',
                        'notes', CASE WHEN v_jc.stormwater_required THEN 'Stormwater management required - ' || COALESCE(v_jc.stormwater_method, 'method TBD') ELSE 'Check local requirements' END),
                    jsonb_build_object('item', 'Confirm fence requirements', 'category', 'site', 'priority', 'medium', 'status', 'pending',
                        'notes', CASE WHEN v_jc.fence_required THEN 'Fence required: ' || COALESCE(v_jc.fence_height_ft::TEXT, '?') || 'ft ' || COALESCE(v_jc.fence_type, '') ELSE 'Check local requirements' END)
                ),

                'site_checklist', jsonb_build_array(
                    jsonb_build_object('item', 'Verify lot size meets minimum', 'category', 'site', 'priority', 'critical', 'status', 'pending',
                        'notes', 'Target: 1.5+ acres, Min: ' || COALESCE(v_jc.min_lot_size_acres::TEXT, '?') || ' acres'),
                    jsonb_build_object('item', 'Confirm road frontage and visibility', 'category', 'site', 'priority', 'high', 'status', 'pending',
                        'notes', 'Prefer main road visibility'),
                    jsonb_build_object('item', 'Verify access (curb cuts, turn lanes)', 'category', 'site', 'priority', 'high', 'status', 'pending',
                        'notes', ''),
                    jsonb_build_object('item', 'Check flood zone status', 'category', 'site', 'priority', 'critical', 'status', 'pending',
                        'notes', 'Verify parcel-level FEMA status'),
                    jsonb_build_object('item', 'Review topography and grading needs', 'category', 'site', 'priority', 'medium', 'status', 'pending',
                        'notes', ''),
                    jsonb_build_object('item', 'Confirm utility availability', 'category', 'site', 'priority', 'high', 'status', 'pending',
                        'notes', 'Water, sewer, electric'),
                    jsonb_build_object('item', 'Check for easements and encumbrances', 'category', 'site', 'priority', 'high', 'status', 'pending',
                        'notes', ''),
                    jsonb_build_object('item', 'Review environmental concerns', 'category', 'site', 'priority', 'high', 'status', 'pending',
                        'notes', 'Phase I ESA recommended'),
                    jsonb_build_object('item', 'Verify wetlands status', 'category', 'site', 'priority', 'high', 'status', 'pending',
                        'notes', '')
                ),

                'market_checklist', jsonb_build_array(
                    jsonb_build_object('item', 'Drive competition and verify rents', 'category', 'market', 'priority', 'high', 'status', 'pending',
                        'notes', 'Verify rent assumptions'),
                    jsonb_build_object('item', 'Call competitors for pricing', 'category', 'market', 'priority', 'high', 'status', 'pending',
                        'notes', 'Get current rates and specials'),
                    jsonb_build_object('item', 'Verify occupancy levels', 'category', 'market', 'priority', 'medium', 'status', 'pending',
                        'notes', 'Ask about availability'),
                    jsonb_build_object('item', 'Check for planned storage facilities', 'category', 'market', 'priority', 'high', 'status', 'pending',
                        'notes', 'Review permits, talk to planning dept'),
                    jsonb_build_object('item', 'Verify housing pipeline projects', 'category', 'market', 'priority', 'medium', 'status', 'pending',
                        'notes', 'Drive by, verify status'),
                    jsonb_build_object('item', 'Confirm major employer status', 'category', 'market', 'priority', 'medium', 'status', 'pending',
                        'notes', 'Verify no major layoffs planned'),
                    jsonb_build_object('item', 'Review infrastructure project timelines', 'category', 'market', 'priority', 'low', 'status', 'pending',
                        'notes', '')
                ),

                'financial_checklist', jsonb_build_array(
                    jsonb_build_object('item', 'Verify land pricing', 'category', 'financial', 'priority', 'critical', 'status', 'pending',
                        'notes', 'Get current comps'),
                    jsonb_build_object('item', 'Get construction bids', 'category', 'financial', 'priority', 'high', 'status', 'pending',
                        'notes', 'Minimum 2 bids'),
                    jsonb_build_object('item', 'Confirm financing terms', 'category', 'financial', 'priority', 'high', 'status', 'pending',
                        'notes', ''),
                    jsonb_build_object('item', 'Review insurance requirements', 'category', 'financial', 'priority', 'medium', 'status', 'pending',
                        'notes', ''),
                    jsonb_build_object('item', 'Verify property tax rates', 'category', 'financial', 'priority', 'medium', 'status', 'pending',
                        'notes', ''),
                    jsonb_build_object('item', 'Confirm operating expense assumptions', 'category', 'financial', 'priority', 'medium', 'status', 'pending',
                        'notes', 'Target 35% expense ratio')
                ),

                'summary', jsonb_build_object(
                    'critical_items', 4,
                    'high_priority_items', 12,
                    'total_items', 24,
                    'estimated_timeline_days', COALESCE(v_jc.approval_timeline_days, 90)
                )
            );

            RETURN v_checklist;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created generate_due_diligence_checklist function")


def create_save_report_function(cur):
    """Create function to save generated reports."""
    print("Creating save_report function...")

    cur.execute("DROP FUNCTION IF EXISTS save_report(VARCHAR, VARCHAR);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION save_report(
            p_county_fips VARCHAR(5),
            p_report_type VARCHAR(50)
        )
        RETURNS UUID AS $func$
        DECLARE
            v_report_json JSONB;
            v_report_md TEXT;
            v_county layer_3_counties%ROWTYPE;
            v_report_uuid UUID;
        BEGIN
            SELECT * INTO v_county FROM layer_3_counties WHERE county_fips = p_county_fips;

            -- Generate report based on type
            IF p_report_type = 'executive_summary' THEN
                v_report_json := generate_executive_summary(p_county_fips);
                v_report_md := generate_markdown_report(p_county_fips);
            ELSIF p_report_type = 'full_analysis' THEN
                v_report_json := generate_full_analysis(p_county_fips);
                v_report_md := generate_markdown_report(p_county_fips);
            ELSIF p_report_type = 'due_diligence' THEN
                v_report_json := generate_due_diligence_checklist(p_county_fips);
                v_report_md := NULL;  -- Due diligence doesn't have markdown version
            ELSE
                RAISE EXCEPTION 'Unknown report type: %', p_report_type;
            END IF;

            -- Save report
            INSERT INTO generated_reports (
                report_name,
                report_type,
                geo_type,
                geo_ids,
                county_fips_list,
                report_json,
                report_markdown
            ) VALUES (
                v_county.county_name || ', ' || v_county.state || ' - ' || INITCAP(REPLACE(p_report_type, '_', ' ')),
                p_report_type,
                'county',
                ARRAY[p_county_fips],
                ARRAY[p_county_fips],
                v_report_json,
                v_report_md
            )
            RETURNING report_uuid INTO v_report_uuid;

            RETURN v_report_uuid;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    # Create save comparison report function
    cur.execute("DROP FUNCTION IF EXISTS save_comparison_report(TEXT[]);")

    cur.execute("""
        CREATE OR REPLACE FUNCTION save_comparison_report(p_county_fips_list TEXT[])
        RETURNS UUID AS $func$
        DECLARE
            v_report_json JSONB;
            v_report_uuid UUID;
            v_county_names TEXT;
        BEGIN
            -- Generate comparison report
            v_report_json := generate_comparison_report(p_county_fips_list);

            -- Get county names for report title
            SELECT string_agg(county_name, ' vs ' ORDER BY county_name)
            INTO v_county_names
            FROM layer_3_counties
            WHERE county_fips = ANY(p_county_fips_list);

            -- Save report
            INSERT INTO generated_reports (
                report_name,
                report_type,
                geo_type,
                geo_ids,
                county_fips_list,
                report_json
            ) VALUES (
                'Market Comparison: ' || v_county_names,
                'comparison',
                'county',
                p_county_fips_list,
                p_county_fips_list,
                v_report_json
            )
            RETURNING report_uuid INTO v_report_uuid;

            RETURN v_report_uuid;
        END;
        $func$ LANGUAGE plpgsql;
    """)

    print("  Created save_report and save_comparison_report functions")


def create_report_views(cur):
    """Create views for report management."""
    print("Creating report views...")

    cur.execute("DROP VIEW IF EXISTS v_report_history CASCADE;")

    cur.execute("""
        CREATE OR REPLACE VIEW v_report_history AS
        SELECT
            report_uuid,
            report_name,
            report_type,
            generated_at,
            CASE
                WHEN EXTRACT(DAY FROM NOW() - generated_at) = 0 THEN 'Today'
                WHEN EXTRACT(DAY FROM NOW() - generated_at) = 1 THEN '1 day ago'
                ELSE EXTRACT(DAY FROM NOW() - generated_at)::INT || ' days ago'
            END as age,
            is_draft,
            is_archived,
            (report_json->'verdict'->>'recommendation') as recommendation,
            (report_json->'verdict'->>'score')::DECIMAL as score,
            (report_json->'verdict'->>'tier') as tier,
            array_length(county_fips_list, 1) as market_count
        FROM generated_reports
        WHERE is_archived = FALSE
        ORDER BY generated_at DESC;
    """)

    # Create view for recent reports by county
    cur.execute("DROP VIEW IF EXISTS v_county_reports CASCADE;")

    cur.execute("""
        CREATE OR REPLACE VIEW v_county_reports AS
        SELECT
            unnest(county_fips_list) as county_fips,
            report_uuid,
            report_name,
            report_type,
            generated_at,
            (report_json->'verdict'->>'recommendation') as recommendation,
            (report_json->'verdict'->>'score')::DECIMAL as score
        FROM generated_reports
        WHERE is_archived = FALSE
        ORDER BY generated_at DESC;
    """)

    print("  Created 2 report views")


def run_report_tests(cur):
    """Test the report generation system."""
    print("\n" + "="*60)
    print("TESTING REPORT GENERATION")
    print("="*60)

    # Test executive summary for Berkeley County
    print("\n--- Executive Summary (Berkeley County) ---")
    cur.execute("SELECT generate_executive_summary('54003');")
    exec_summary = cur.fetchone()[0]
    print(f"Title: {exec_summary['header']['title']}")
    print(f"Score: {exec_summary['verdict']['score']}/100")
    print(f"Tier: {exec_summary['verdict']['tier_display']}")
    print(f"Recommendation: {exec_summary['verdict']['recommendation_display']}")
    print(f"Yield: {exec_summary['key_metrics']['yield']['display']}")
    print(f"Cushion: {exec_summary['key_metrics']['cushion']['display']} (${exec_summary['key_metrics']['cushion']['dollars']}/unit)")

    # Test full analysis
    print("\n--- Full Analysis (Jefferson County) ---")
    cur.execute("SELECT generate_full_analysis('54037');")
    full_analysis = cur.fetchone()[0]
    print(f"Title: {full_analysis['header']['title']}")
    print(f"Facilities count: {full_analysis['supply_analysis']['summary']['facility_count']}")
    print(f"Catalysts count: {len(full_analysis['catalyst_analysis']['catalysts'])}")
    print(f"Regulation difficulty: {full_analysis['regulatory_analysis']['difficulty_rating']}")

    # Test comparison report
    print("\n--- Comparison Report (All 3 Counties) ---")
    cur.execute("SELECT generate_comparison_report(ARRAY['54003', '54037', '54065']);")
    comparison = cur.fetchone()[0]
    print(f"Markets compared: {comparison['summary']['market_count']}")
    print(f"Top market: {comparison['summary']['top_market']}")
    print(f"Score range: {comparison['summary']['score_range']['min']} - {comparison['summary']['score_range']['max']}")
    print("\nComparison Table:")
    for market in comparison['comparison_table']:
        print(f"  {market['rank']}. {market['county']}: {market['score']}/100 ({market['tier']}) - {market['recommendation']}")

    # Test markdown report
    print("\n--- Markdown Report (Berkeley County) ---")
    cur.execute("SELECT generate_markdown_report('54003');")
    markdown = cur.fetchone()[0]
    print(f"Markdown length: {len(markdown)} characters")
    print("\nFirst 500 characters:")
    print(markdown[:500])

    # Test due diligence checklist
    print("\n--- Due Diligence Checklist (Morgan County) ---")
    cur.execute("SELECT generate_due_diligence_checklist('54065');")
    dd_checklist = cur.fetchone()[0]
    print(f"Market: {dd_checklist['market']}")
    print(f"Total checklist items: {dd_checklist['summary']['total_items']}")
    print(f"Critical items: {dd_checklist['summary']['critical_items']}")
    print(f"Estimated timeline: {dd_checklist['summary']['estimated_timeline_days']} days")

    # Test save report
    print("\n--- Saving Reports ---")
    cur.execute("SELECT save_report('54003', 'full_analysis');")
    report_uuid = cur.fetchone()[0]
    print(f"Saved full analysis report: {report_uuid}")

    cur.execute("SELECT save_comparison_report(ARRAY['54003', '54037', '54065']);")
    comparison_uuid = cur.fetchone()[0]
    print(f"Saved comparison report: {comparison_uuid}")

    # Show report history
    print("\n--- Report History ---")
    cur.execute("SELECT * FROM v_report_history;")
    reports = cur.fetchall()
    print(f"{'UUID':<40} {'Name':<50} {'Type':<20} {'Age':<15}")
    print("-" * 125)
    for r in reports:
        print(f"{str(r[0]):<40} {r[1][:48]:<50} {r[2]:<20} {r[4]:<15}")


def main():
    print("="*60)
    print("PROMPT 20: REPORT GENERATION")
    print("="*60)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # Create tables
        create_report_templates_table(cur)
        create_generated_reports_table(cur)
        conn.commit()

        # Create functions
        create_executive_summary_function(cur)
        create_full_analysis_function(cur)
        create_comparison_report_function(cur)
        create_markdown_report_function(cur)
        create_due_diligence_function(cur)
        create_save_report_function(cur)
        conn.commit()

        # Create views
        create_report_views(cur)
        conn.commit()

        # Run tests
        run_report_tests(cur)
        conn.commit()

        print("\n" + "="*60)
        print("REPORT GENERATION COMPLETE")
        print("="*60)

        # Summary
        cur.execute("SELECT COUNT(*) FROM report_templates;")
        template_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM generated_reports;")
        report_count = cur.fetchone()[0]

        print(f"\nCreated:")
        print(f"  - report_templates table ({template_count} templates)")
        print(f"  - generated_reports table ({report_count} reports)")
        print(f"  - generate_executive_summary() function")
        print(f"  - generate_full_analysis() function")
        print(f"  - generate_comparison_report() function")
        print(f"  - generate_markdown_report() function")
        print(f"  - generate_due_diligence_checklist() function")
        print(f"  - save_report() function")
        print(f"  - save_comparison_report() function")
        print(f"  - 2 report views")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
