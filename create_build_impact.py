"""
Create build impact calculator functions and views.
"""
import psycopg2

CONNECTION_STRING = 'postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'

def main():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()

    # 3. Create calculate_build_impact function
    print('Creating calculate_build_impact function...')

    sql = """
CREATE OR REPLACE FUNCTION calculate_build_impact(
    p_jurisdiction_card_id INT,
    p_lot_acres DECIMAL DEFAULT 1.5,
    p_lot_width_ft INT DEFAULT 200,
    p_lot_depth_ft INT DEFAULT 327,
    p_market_rent INT DEFAULT 80
)
RETURNS INT AS $$
DECLARE
    v_card jurisdiction_cards%ROWTYPE;
    v_model build_model_defaults%ROWTYPE;
    v_analysis_id INT;

    v_lot_sqft INT;
    v_setback_loss_front INT;
    v_setback_loss_rear INT;
    v_setback_loss_sides INT;
    v_total_setback_loss INT;
    v_landscape_loss INT;
    v_stormwater_area INT;
    v_parking_area INT;
    v_total_buffer_loss INT;
    v_total_loss INT;
    v_net_buildable INT;
    v_max_footprint INT;
    v_row_depth_base INT;
    v_row_depth_required INT;
    v_rows_base INT;
    v_rows_required INT;
    v_aisle_loss_pct DECIMAL;
    v_height_multiplier DECIMAL;
    v_adjusted_buildings INT;
    v_adjusted_units INT;
    v_capacity_loss_pct DECIMAL;

    v_landscape_cost INT;
    v_fence_cost INT;
    v_fence_cost_per_ft INT;
    v_masonry_cost INT;
    v_stormwater_cost INT;
    v_total_added_costs INT;
    v_adjusted_investment INT;

    v_adjusted_revenue INT;
    v_adjusted_expenses INT;
    v_adjusted_noi INT;
    v_adjusted_yield DECIMAL;
    v_breakeven_rent INT;

    v_capacity_impact VARCHAR(20);
    v_cost_impact VARCHAR(20);
    v_overall_verdict VARCHAR(20);
    v_verdict_reason TEXT;

BEGIN
    SELECT * INTO v_card FROM jurisdiction_cards WHERE id = p_jurisdiction_card_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Jurisdiction card not found: %', p_jurisdiction_card_id;
    END IF;

    SELECT * INTO v_model FROM build_model_defaults WHERE is_active = TRUE LIMIT 1;

    v_lot_sqft := (p_lot_acres * 43560)::INT;

    v_setback_loss_front := COALESCE(v_card.setback_front_ft, 25) * p_lot_width_ft;
    v_setback_loss_rear := COALESCE(v_card.setback_rear_ft, 20) * p_lot_width_ft;
    v_setback_loss_sides := COALESCE(v_card.setback_side_ft, 15) * 2 * (p_lot_depth_ft - COALESCE(v_card.setback_front_ft, 25) - COALESCE(v_card.setback_rear_ft, 20));
    v_total_setback_loss := v_setback_loss_front + v_setback_loss_rear + v_setback_loss_sides;

    v_landscape_loss := COALESCE(v_card.landscape_buffer_front_ft, 0) * p_lot_width_ft;
    v_stormwater_area := CASE WHEN COALESCE(v_card.stormwater_required, FALSE) THEN 5000 ELSE 0 END;
    v_parking_area := COALESCE(v_card.parking_spaces_required, 5) * 180;
    v_total_buffer_loss := v_landscape_loss + v_stormwater_area + v_parking_area;

    v_total_loss := v_total_setback_loss + v_total_buffer_loss;
    v_net_buildable := GREATEST(v_lot_sqft - v_total_loss, 0);

    v_max_footprint := (v_net_buildable * COALESCE(v_card.max_lot_coverage_pct, 80) / 100)::INT;

    v_row_depth_base := v_model.building_width_ft * 2 + v_model.base_aisle_width_ft;
    v_row_depth_required := v_model.building_width_ft * 2 + COALESCE(v_card.min_aisle_width_ft, 24);

    v_rows_base := FLOOR((p_lot_depth_ft - COALESCE(v_card.setback_front_ft, 25) - COALESCE(v_card.setback_rear_ft, 20)) / v_row_depth_base);
    v_rows_required := FLOOR((p_lot_depth_ft - COALESCE(v_card.setback_front_ft, 25) - COALESCE(v_card.setback_rear_ft, 20)) / v_row_depth_required);

    IF v_rows_base > 0 THEN
        v_aisle_loss_pct := 1.0 - (v_rows_required::DECIMAL / v_rows_base::DECIMAL);
    ELSE
        v_aisle_loss_pct := 0;
    END IF;

    -- Single-story standard for self storage
    v_height_multiplier := 1.0;

    -- Adjusted capacity - use minimum of constraints, capped at base model
    v_adjusted_buildings := LEAST(
        v_rows_required * 2,
        FLOOR(v_max_footprint / v_model.building_sqft)::INT,
        v_model.building_count
    );
    v_adjusted_buildings := GREATEST(v_adjusted_buildings, 1);
    v_adjusted_units := (v_adjusted_buildings * v_model.units_per_building * v_height_multiplier)::INT;

    IF v_model.total_units > 0 THEN
        v_capacity_loss_pct := GREATEST(0, 1.0 - (v_adjusted_units::DECIMAL / v_model.total_units::DECIMAL));
    ELSE
        v_capacity_loss_pct := 0;
    END IF;

    v_landscape_cost := CASE
        WHEN COALESCE(v_card.landscape_buffer_front_ft, 0) > 0
        THEN ((p_lot_width_ft + p_lot_depth_ft * 2) * 25)::INT +
             (FLOOR((p_lot_width_ft + p_lot_depth_ft * 2) / 40) * 250)::INT
        ELSE 0
    END;

    IF COALESCE(v_card.fence_required, FALSE) THEN
        v_fence_cost_per_ft := CASE
            WHEN v_card.fence_type ILIKE '%masonry%' THEN 150
            WHEN v_card.fence_type ILIKE '%wood%' THEN 35
            ELSE 20
        END;
        v_fence_cost := ((p_lot_width_ft * 2 + p_lot_depth_ft * 2) * v_fence_cost_per_ft)::INT;
    ELSE
        v_fence_cost := 0;
    END IF;

    IF COALESCE(v_card.masonry_required, FALSE) THEN
        v_masonry_cost := (v_adjusted_buildings * v_model.building_length_ft * 10 *
                          COALESCE(v_card.masonry_pct, 25) / 100 * 35)::INT;
    ELSE
        v_masonry_cost := 0;
    END IF;

    v_stormwater_cost := CASE
        WHEN COALESCE(v_card.stormwater_required, FALSE) THEN
            CASE
                WHEN v_card.stormwater_method ILIKE '%retention%' THEN 35000
                WHEN v_card.stormwater_method ILIKE '%detention%' THEN 25000
                ELSE 15000
            END
        ELSE 0
    END;

    v_total_added_costs := v_landscape_cost + v_fence_cost + v_masonry_cost + v_stormwater_cost +
                          CASE WHEN v_card.public_hearing_required THEN 5000 ELSE 1000 END +
                          CASE WHEN v_card.engineer_stamp_required THEN 8000 ELSE 3000 END;

    v_adjusted_investment := (p_lot_acres / v_model.base_lot_acres * v_model.land_cost_per_acre * v_model.base_lot_acres)::INT +
                             v_model.site_work_cost +
                             (v_adjusted_buildings * v_model.building_cost_per_building) +
                             v_total_added_costs;

    v_adjusted_revenue := (v_adjusted_units * p_market_rent * 12)::INT;
    v_adjusted_expenses := (v_adjusted_revenue * v_model.expense_ratio)::INT;
    v_adjusted_noi := v_adjusted_revenue - v_adjusted_expenses;

    IF v_adjusted_investment > 0 THEN
        v_adjusted_yield := v_adjusted_noi::DECIMAL / v_adjusted_investment::DECIMAL;
    ELSE
        v_adjusted_yield := 0;
    END IF;

    IF v_adjusted_units > 0 THEN
        v_breakeven_rent := CEIL((v_adjusted_investment * 0.12 / (1 - v_model.expense_ratio)) / v_adjusted_units / 12);
    ELSE
        v_breakeven_rent := 9999;
    END IF;

    v_capacity_impact := CASE
        WHEN v_capacity_loss_pct <= 0.10 THEN 'minimal'
        WHEN v_capacity_loss_pct <= 0.25 THEN 'moderate'
        WHEN v_capacity_loss_pct <= 0.50 THEN 'significant'
        ELSE 'prohibitive'
    END;

    v_cost_impact := CASE
        WHEN v_total_added_costs <= 20000 THEN 'minimal'
        WHEN v_total_added_costs <= 50000 THEN 'moderate'
        WHEN v_total_added_costs <= 100000 THEN 'significant'
        ELSE 'prohibitive'
    END;

    v_overall_verdict := CASE
        WHEN v_adjusted_yield >= 0.15 THEN 'strong_go'
        WHEN v_adjusted_yield >= 0.12 THEN 'go'
        WHEN v_adjusted_yield >= 0.10 THEN 'marginal'
        ELSE 'no_go'
    END;

    v_verdict_reason := FORMAT(
        'Units: %s (%s%% loss), Invest: $%s (+$%s), Yield: %s%%',
        v_adjusted_units,
        ROUND(v_capacity_loss_pct * 100),
        v_adjusted_investment,
        v_total_added_costs,
        ROUND(v_adjusted_yield * 100, 1)
    );

    -- Delete previous analysis for this jurisdiction
    DELETE FROM build_impact_analysis WHERE jurisdiction_card_id = p_jurisdiction_card_id;

    INSERT INTO build_impact_analysis (
        jurisdiction_card_id, build_model_id, county_fips, jurisdiction,
        input_lot_acres, input_lot_sqft, input_lot_width_ft, input_lot_depth_ft,
        setback_front_ft, setback_rear_ft, setback_side_ft,
        setback_loss_front_sqft, setback_loss_rear_sqft, setback_loss_sides_sqft, total_setback_loss_sqft,
        landscape_buffer_front_ft, landscape_loss_sqft, stormwater_area_sqft, parking_area_sqft, total_buffer_loss_sqft,
        gross_lot_sqft, total_loss_sqft, net_buildable_sqft, net_buildable_acres, buildable_pct,
        max_lot_coverage_pct, max_building_footprint_sqft,
        base_aisle_width_ft, required_aisle_width_ft, aisle_width_delta_ft,
        row_depth_with_base_aisle_ft, row_depth_with_required_aisle_ft,
        rows_with_base_aisle, rows_with_required_aisle, aisle_capacity_loss_pct,
        max_height_ft, max_stories, height_multiplier,
        base_building_count, adjusted_building_count, base_unit_count, adjusted_unit_count,
        capacity_loss_units, capacity_loss_pct,
        total_landscape_cost, fence_required, fence_cost, masonry_required, masonry_cost,
        stormwater_required, stormwater_cost, total_added_costs, added_cost_pct,
        base_investment, adjusted_investment, cost_per_unit,
        rent_per_unit, adjusted_gross_revenue_annual,
        expense_ratio, adjusted_expenses_annual, adjusted_noi_annual, adjusted_yield_pct,
        target_yield_pct, yield_vs_target, meets_target, breakeven_rent, rent_cushion,
        timeline_days,
        capacity_impact, cost_impact, overall_verdict, verdict_reason
    ) VALUES (
        p_jurisdiction_card_id, v_model.id, v_card.county_fips, v_card.jurisdiction,
        p_lot_acres, v_lot_sqft, p_lot_width_ft, p_lot_depth_ft,
        v_card.setback_front_ft, v_card.setback_rear_ft, v_card.setback_side_ft,
        v_setback_loss_front, v_setback_loss_rear, v_setback_loss_sides, v_total_setback_loss,
        v_card.landscape_buffer_front_ft, v_landscape_loss, v_stormwater_area, v_parking_area, v_total_buffer_loss,
        v_lot_sqft, v_total_loss, v_net_buildable, v_net_buildable::DECIMAL / 43560, v_net_buildable::DECIMAL / v_lot_sqft,
        v_card.max_lot_coverage_pct, v_max_footprint,
        v_model.base_aisle_width_ft, COALESCE(v_card.min_aisle_width_ft, 24), COALESCE(v_card.min_aisle_width_ft, 24) - v_model.base_aisle_width_ft,
        v_row_depth_base, v_row_depth_required,
        v_rows_base, v_rows_required, v_aisle_loss_pct,
        v_card.max_building_height_ft, v_card.max_stories, v_height_multiplier,
        v_model.building_count, v_adjusted_buildings, v_model.total_units, v_adjusted_units,
        v_model.total_units - v_adjusted_units, v_capacity_loss_pct,
        v_landscape_cost, v_card.fence_required, v_fence_cost, v_card.masonry_required, v_masonry_cost,
        v_card.stormwater_required, v_stormwater_cost, v_total_added_costs, v_total_added_costs::DECIMAL / v_model.base_total_investment,
        v_model.base_total_investment, v_adjusted_investment,
        CASE WHEN v_adjusted_units > 0 THEN v_adjusted_investment / v_adjusted_units ELSE 0 END,
        p_market_rent, v_adjusted_revenue,
        v_model.expense_ratio, v_adjusted_expenses, v_adjusted_noi, v_adjusted_yield,
        0.12, v_adjusted_yield - 0.12, v_adjusted_yield >= 0.12, v_breakeven_rent, p_market_rent - v_breakeven_rent,
        COALESCE(v_card.approval_timeline_days, 30),
        v_capacity_impact, v_cost_impact, v_overall_verdict, v_verdict_reason
    )
    RETURNING id INTO v_analysis_id;

    RETURN v_analysis_id;
END;
$$ LANGUAGE plpgsql;
"""

    cur.execute(sql)
    conn.commit()
    print('[OK] calculate_build_impact function created')

    # 4. Create analyze_all_jurisdictions helper function
    print('Creating analyze_all_jurisdictions function...')

    sql2 = """
CREATE OR REPLACE FUNCTION analyze_all_jurisdictions(
    p_lot_acres DECIMAL DEFAULT 1.5,
    p_market_rent INT DEFAULT 80
)
RETURNS TABLE(
    jurisdiction_card_id INT,
    jurisdiction VARCHAR,
    county_name VARCHAR,
    analysis_id INT,
    adjusted_units INT,
    capacity_loss_pct DECIMAL,
    adjusted_investment INT,
    added_costs INT,
    adjusted_yield DECIMAL,
    verdict VARCHAR
) AS $$
DECLARE
    v_card RECORD;
    v_analysis_id INT;
BEGIN
    FOR v_card IN SELECT id, jc.jurisdiction as j_name, jc.county_name as c_name FROM jurisdiction_cards jc
    LOOP
        v_analysis_id := calculate_build_impact(v_card.id, p_lot_acres, 200, 327, p_market_rent);

        RETURN QUERY
        SELECT
            v_card.id,
            v_card.j_name::VARCHAR,
            v_card.c_name::VARCHAR,
            v_analysis_id,
            bia.adjusted_unit_count,
            bia.capacity_loss_pct,
            bia.adjusted_investment,
            bia.total_added_costs,
            bia.adjusted_yield_pct,
            bia.overall_verdict::VARCHAR
        FROM build_impact_analysis bia
        WHERE bia.id = v_analysis_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
"""

    cur.execute(sql2)
    conn.commit()
    print('[OK] analyze_all_jurisdictions function created')

    # 5. Create summary view
    print('Creating v_build_impact_summary view...')

    sql3 = """
DROP VIEW IF EXISTS v_build_impact_summary;
CREATE OR REPLACE VIEW v_build_impact_summary AS
SELECT
    bia.id as analysis_id,
    jc.state,
    jc.county_name,
    jc.jurisdiction,
    jc.difficulty_score,
    jc.difficulty_rating,
    bia.input_lot_acres,
    bia.base_unit_count,
    bia.adjusted_unit_count,
    bia.capacity_loss_pct,
    ROUND(bia.capacity_loss_pct * 100) || '%' as capacity_loss_display,
    bia.capacity_impact,
    bia.base_investment,
    bia.total_added_costs,
    bia.adjusted_investment,
    bia.cost_impact,
    bia.rent_per_unit,
    bia.adjusted_noi_annual,
    ROUND(bia.adjusted_yield_pct * 100, 1) || '%' as yield_display,
    bia.breakeven_rent,
    bia.rent_cushion,
    bia.overall_verdict,
    bia.verdict_reason,
    bia.analysis_date
FROM build_impact_analysis bia
JOIN jurisdiction_cards jc ON bia.jurisdiction_card_id = jc.id
ORDER BY bia.adjusted_yield_pct DESC;
"""

    cur.execute(sql3)
    conn.commit()
    print('[OK] v_build_impact_summary view created')

    # 6. Create comparison view
    print('Creating v_jurisdiction_comparison view...')

    sql4 = """
DROP VIEW IF EXISTS v_jurisdiction_comparison;
CREATE OR REPLACE VIEW v_jurisdiction_comparison AS
SELECT
    jc.state,
    jc.county_name,
    jc.jurisdiction,
    jc.storage_allowed,
    jc.approval_process,
    jc.min_aisle_width_ft,
    jc.setback_front_ft,
    jc.max_lot_coverage_pct,
    jc.max_building_height_ft,
    jc.landscape_buffer_front_ft,
    jc.fence_required,
    jc.masonry_required,
    jc.stormwater_required,
    jc.difficulty_score,
    jc.difficulty_rating,
    bia.adjusted_unit_count,
    bia.capacity_loss_pct,
    bia.total_added_costs,
    bia.adjusted_yield_pct,
    bia.breakeven_rent,
    bia.rent_cushion,
    bia.overall_verdict
FROM jurisdiction_cards jc
LEFT JOIN build_impact_analysis bia ON jc.id = bia.jurisdiction_card_id
    AND bia.id = (SELECT MAX(id) FROM build_impact_analysis WHERE jurisdiction_card_id = jc.id)
ORDER BY jc.difficulty_score, jc.state, jc.county_name;
"""

    cur.execute(sql4)
    conn.commit()
    print('[OK] v_jurisdiction_comparison view created')

    # 7. Create find_min_lot_for_capacity function
    print('Creating find_min_lot_for_capacity function...')

    sql5 = """
CREATE OR REPLACE FUNCTION find_min_lot_for_capacity(
    p_jurisdiction_card_id INT,
    p_target_units INT DEFAULT 160,
    p_market_rent INT DEFAULT 80
)
RETURNS TABLE(
    min_lot_acres DECIMAL,
    achievable_units INT,
    investment INT,
    yield_pct DECIMAL,
    verdict VARCHAR
) AS $$
DECLARE
    v_lot_acres DECIMAL := 1.0;
    v_analysis_id INT;
    v_units INT;
    v_max_iterations INT := 20;
    v_iteration INT := 0;
BEGIN
    WHILE v_iteration < v_max_iterations LOOP
        v_analysis_id := calculate_build_impact(p_jurisdiction_card_id, v_lot_acres, 200, (v_lot_acres * 43560 / 200)::INT, p_market_rent);

        SELECT adjusted_unit_count INTO v_units FROM build_impact_analysis WHERE id = v_analysis_id;

        IF v_units >= p_target_units THEN
            RETURN QUERY
            SELECT
                v_lot_acres,
                bia.adjusted_unit_count,
                bia.adjusted_investment,
                bia.adjusted_yield_pct,
                bia.overall_verdict::VARCHAR
            FROM build_impact_analysis bia
            WHERE bia.id = v_analysis_id;
            RETURN;
        END IF;

        v_lot_acres := v_lot_acres + 0.25;
        v_iteration := v_iteration + 1;
    END LOOP;

    RETURN QUERY
    SELECT
        v_lot_acres,
        bia.adjusted_unit_count,
        bia.adjusted_investment,
        bia.adjusted_yield_pct,
        bia.overall_verdict::VARCHAR
    FROM build_impact_analysis bia
    WHERE bia.id = v_analysis_id;
END;
$$ LANGUAGE plpgsql;
"""

    cur.execute(sql5)
    conn.commit()
    print('[OK] find_min_lot_for_capacity function created')

    conn.close()
    print('\n[OK] All functions and views created successfully!')


if __name__ == '__main__':
    main()
