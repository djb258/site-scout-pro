"""
Prompt 18: STIP Road Projects (Infrastructure Catalyst Extension)
Extends economic catalysts system to track STIP road/highway projects as infrastructure indicators.

STIP = State Transportation Improvement Program (federally required 4-year plan)
Key insight: New interchanges, widening, bypasses = commercial development follows
"""

import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection
DB_URL = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"


def get_connection():
    return psycopg2.connect(DB_URL)


def create_tables(cur):
    """Create infrastructure projects table"""

    cur.execute("""
        CREATE TABLE IF NOT EXISTS infrastructure_projects (
            id SERIAL PRIMARY KEY,
            catalyst_id INT REFERENCES economic_catalysts(id),

            -- PROJECT IDENTIFICATION
            stip_id VARCHAR(50),
            federal_project_id VARCHAR(50),
            project_name VARCHAR(300),

            -- CLASSIFICATION
            project_type VARCHAR(50) NOT NULL,
            project_subtype VARCHAR(100),

            -- ROUTE INFO
            route_name VARCHAR(100),
            route_type VARCHAR(20),
            route_number VARCHAR(20),

            -- LOCATION
            begin_mile_marker DECIMAL,
            end_mile_marker DECIMAL,
            begin_description VARCHAR(200),
            end_description VARCHAR(200),
            length_miles DECIMAL,

            -- IMPROVEMENT DETAILS
            existing_lanes INT,
            proposed_lanes INT,
            lanes_added INT,

            is_new_interchange BOOLEAN DEFAULT FALSE,
            interchange_type VARCHAR(50),

            is_new_alignment BOOLEAN DEFAULT FALSE,
            is_widening BOOLEAN DEFAULT FALSE,
            is_bridge BOOLEAN DEFAULT FALSE,
            is_safety_improvement BOOLEAN DEFAULT FALSE,

            -- CAPACITY IMPACT
            current_aadt INT,
            projected_aadt INT,
            capacity_increase_pct DECIMAL,

            -- FUNDING
            total_cost BIGINT,
            federal_funding BIGINT,
            state_funding BIGINT,
            local_funding BIGINT,
            funding_program VARCHAR(100),

            -- PHASES
            pe_start_date DATE,
            pe_end_date DATE,
            row_start_date DATE,
            row_end_date DATE,
            construction_start_date DATE,
            construction_end_date DATE,

            current_phase VARCHAR(50),

            -- STIP PROGRAM YEAR
            stip_year INT,
            fiscal_year_programmed INT,

            -- DEVELOPMENT IMPACT
            enables_development BOOLEAN,
            development_acres_opened INT,
            commercial_frontage_feet INT,

            -- STORAGE RELEVANCE
            storage_site_relevance VARCHAR(20),
            storage_relevance_notes TEXT,

            -- SOURCE
            mpo VARCHAR(100),
            data_source VARCHAR(200),
            source_url VARCHAR(500),

            -- METADATA
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_ip_catalyst ON infrastructure_projects(catalyst_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ip_route ON infrastructure_projects(route_name);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ip_type ON infrastructure_projects(project_type);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ip_phase ON infrastructure_projects(current_phase);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ip_stip ON infrastructure_projects(stip_id);")

    print("Created infrastructure_projects table")


def create_functions(cur):
    """Create infrastructure functions"""

    # Add infrastructure catalyst function
    cur.execute("""
        CREATE OR REPLACE FUNCTION add_infrastructure_catalyst(
            p_state VARCHAR(2),
            p_county_fips VARCHAR(5),
            p_county_name VARCHAR(100),
            p_city VARCHAR(100),
            p_stip_id VARCHAR(50),
            p_project_name VARCHAR(300),
            p_project_type VARCHAR(50),
            p_project_subtype VARCHAR(100),
            p_route_name VARCHAR(100),
            p_route_type VARCHAR(20),
            p_length_miles DECIMAL,
            p_total_cost BIGINT,
            p_is_new_interchange BOOLEAN DEFAULT FALSE,
            p_is_widening BOOLEAN DEFAULT FALSE,
            p_lanes_added INT DEFAULT 0,
            p_current_phase VARCHAR(50) DEFAULT 'planning',
            p_construction_start DATE DEFAULT NULL,
            p_construction_end DATE DEFAULT NULL,
            p_source VARCHAR(200) DEFAULT NULL
        )
        RETURNS INT AS $func$
        DECLARE
            v_catalyst_id INT;
            v_infra_id INT;
            v_catalyst_name VARCHAR(300);
            v_demand_impact VARCHAR(20);
            v_storage_relevance VARCHAR(20);
            v_housing_demand INT;
            v_storage_demand INT;
            v_status VARCHAR(50);
        BEGIN
            -- Determine status from phase
            v_status := CASE p_current_phase
                WHEN 'complete' THEN 'operational'
                WHEN 'construction' THEN 'under_construction'
                WHEN 'row' THEN 'approved'
                WHEN 'pe' THEN 'approved'
                ELSE 'announced'
            END;

            -- Build catalyst name
            v_catalyst_name := p_route_name || ' ' || INITCAP(REPLACE(p_project_subtype, '_', ' ')) ||
                               CASE WHEN p_is_new_interchange THEN ' - New Interchange' ELSE '' END;

            -- Determine demand impact based on project type and size
            v_demand_impact := CASE
                WHEN p_is_new_interchange AND p_route_type = 'interstate' THEN 'major'
                WHEN p_is_new_interchange THEN 'significant'
                WHEN p_is_widening AND p_lanes_added >= 2 THEN 'significant'
                WHEN p_is_widening THEN 'moderate'
                WHEN p_total_cost >= 100000000 THEN 'significant'
                WHEN p_total_cost >= 50000000 THEN 'moderate'
                ELSE 'minor'
            END;

            -- Storage site relevance
            v_storage_relevance := CASE
                WHEN p_is_new_interchange THEN 'high'
                WHEN p_is_widening AND p_route_type IN ('interstate', 'us_route') THEN 'high'
                WHEN p_project_type = 'highway' AND p_total_cost >= 50000000 THEN 'medium'
                ELSE 'low'
            END;

            -- Estimate housing demand (infrastructure enables development)
            v_housing_demand := CASE
                WHEN p_is_new_interchange AND p_route_type = 'interstate' THEN 2000
                WHEN p_is_new_interchange THEN 1000
                WHEN p_is_widening AND p_lanes_added >= 2 THEN 500
                WHEN p_is_widening THEN 200
                ELSE 100
            END;

            v_storage_demand := v_housing_demand * 6;

            -- Insert catalyst
            INSERT INTO economic_catalysts (
                catalyst_name, catalyst_type, catalyst_subtype,
                state, county_fips, county_name, city,
                company_name, company_industry, company_type,
                announcement_date, status, status_date,
                investment_amount,
                jobs_announced,
                facility_sqft,
                demand_impact, demand_timing,
                housing_demand_units, storage_demand_sqft,
                source, confidence
            ) VALUES (
                v_catalyst_name, 'infrastructure', p_project_type,
                p_state, p_county_fips, p_county_name, p_city,
                p_state || ' DOT', 'Transportation', 'government',
                COALESCE(p_construction_start, CURRENT_DATE), v_status, CURRENT_DATE,
                p_total_cost,
                GREATEST(50, (p_total_cost / 1000000)::INT),
                NULL,
                v_demand_impact,
                CASE v_status
                    WHEN 'operational' THEN 'immediate'
                    WHEN 'under_construction' THEN '1_year'
                    WHEN 'approved' THEN '2_years'
                    ELSE '3_plus_years'
                END,
                v_housing_demand,
                v_storage_demand,
                p_source, 'confirmed'
            )
            RETURNING id INTO v_catalyst_id;

            -- Insert infrastructure details
            INSERT INTO infrastructure_projects (
                catalyst_id,
                stip_id, project_name,
                project_type, project_subtype,
                route_name, route_type,
                length_miles,
                is_new_interchange, is_widening,
                lanes_added,
                total_cost,
                current_phase,
                construction_start_date, construction_end_date,
                storage_site_relevance,
                data_source
            ) VALUES (
                v_catalyst_id,
                p_stip_id, p_project_name,
                p_project_type, p_project_subtype,
                p_route_name, p_route_type,
                p_length_miles,
                p_is_new_interchange, p_is_widening,
                p_lanes_added,
                p_total_cost,
                p_current_phase,
                p_construction_start, p_construction_end,
                v_storage_relevance,
                p_source
            )
            RETURNING id INTO v_infra_id;

            RETURN v_catalyst_id;
        END;
        $func$ LANGUAGE plpgsql;
    """)
    print("Created add_infrastructure_catalyst() function")

    # Bulk import function for STIP data
    cur.execute("""
        CREATE OR REPLACE FUNCTION import_stip_projects(p_projects JSONB)
        RETURNS TABLE(
            stip_id VARCHAR(50),
            catalyst_id INT,
            status VARCHAR(20)
        ) AS $func$
        DECLARE
            v_project JSONB;
            v_catalyst_id INT;
        BEGIN
            FOR v_project IN SELECT * FROM jsonb_array_elements(p_projects)
            LOOP
                BEGIN
                    v_catalyst_id := add_infrastructure_catalyst(
                        v_project->>'state',
                        v_project->>'county_fips',
                        v_project->>'county_name',
                        v_project->>'city',
                        v_project->>'stip_id',
                        v_project->>'project_name',
                        COALESCE(v_project->>'project_type', 'highway'),
                        v_project->>'project_subtype',
                        v_project->>'route_name',
                        COALESCE(v_project->>'route_type', 'state_route'),
                        (v_project->>'length_miles')::DECIMAL,
                        (v_project->>'total_cost')::BIGINT,
                        COALESCE((v_project->>'is_new_interchange')::BOOLEAN, FALSE),
                        COALESCE((v_project->>'is_widening')::BOOLEAN, FALSE),
                        COALESCE((v_project->>'lanes_added')::INT, 0),
                        COALESCE(v_project->>'current_phase', 'planning'),
                        (v_project->>'construction_start')::DATE,
                        (v_project->>'construction_end')::DATE,
                        v_project->>'source'
                    );

                    RETURN QUERY SELECT
                        (v_project->>'stip_id')::VARCHAR(50),
                        v_catalyst_id,
                        'created'::VARCHAR(20);

                EXCEPTION WHEN OTHERS THEN
                    RETURN QUERY SELECT
                        (v_project->>'stip_id')::VARCHAR(50),
                        NULL::INT,
                        'error'::VARCHAR(20);
                END;
            END LOOP;
        END;
        $func$ LANGUAGE plpgsql;
    """)
    print("Created import_stip_projects() function")

    # Identify infrastructure opportunities
    cur.execute("""
        CREATE OR REPLACE FUNCTION identify_infrastructure_opportunities(
            p_county_fips VARCHAR(5) DEFAULT NULL
        )
        RETURNS TABLE(
            opportunity_rank INT,
            route_name VARCHAR(100),
            project_name VARCHAR(300),
            county_name VARCHAR(100),
            state VARCHAR(2),
            opportunity_type VARCHAR(50),
            timing VARCHAR(50),
            storage_relevance VARCHAR(20),
            housing_enabled INT,
            storage_demand INT,
            investment BIGINT,
            notes TEXT
        ) AS $func$
        BEGIN
            RETURN QUERY
            SELECT
                ROW_NUMBER() OVER (ORDER BY
                    CASE ip.storage_site_relevance WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                    ec.storage_demand_sqft DESC
                )::INT as opportunity_rank,
                ip.route_name,
                ec.catalyst_name,
                ec.county_name,
                ec.state,
                CASE
                    WHEN ip.is_new_interchange THEN 'New Interchange'
                    WHEN ip.is_widening THEN 'Corridor Widening'
                    ELSE 'Infrastructure Improvement'
                END::VARCHAR(50) as opportunity_type,
                ec.demand_timing,
                ip.storage_site_relevance,
                ec.housing_demand_units,
                ec.storage_demand_sqft,
                ip.total_cost,
                CASE
                    WHEN ip.is_new_interchange THEN 'Prime location for storage at new interchange'
                    WHEN ip.is_widening AND ip.route_type = 'interstate' THEN 'Improved visibility and access on major corridor'
                    WHEN ip.is_widening THEN 'Enhanced access on growing corridor'
                    ELSE 'Monitor for development potential'
                END::TEXT as notes
            FROM infrastructure_projects ip
            JOIN economic_catalysts ec ON ip.catalyst_id = ec.id
            WHERE ec.is_active = TRUE
            AND ip.storage_site_relevance IN ('high', 'medium')
            AND (p_county_fips IS NULL OR ec.county_fips = p_county_fips)
            ORDER BY
                CASE ip.storage_site_relevance WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                ec.storage_demand_sqft DESC;
        END;
        $func$ LANGUAGE plpgsql;
    """)
    print("Created identify_infrastructure_opportunities() function")


def create_views(cur):
    """Create infrastructure views"""

    # STIP dashboard view
    cur.execute("""
        CREATE OR REPLACE VIEW v_stip_dashboard AS
        SELECT
            ec.id,
            ip.stip_id,
            ec.catalyst_name as project_name,
            ip.route_name,
            ip.route_type,
            CASE ip.route_type
                WHEN 'interstate' THEN 'INTERSTATE'
                WHEN 'us_route' THEN 'US ROUTE'
                WHEN 'state_route' THEN 'STATE ROUTE'
                ELSE 'OTHER'
            END as route_type_text,
            ip.project_type,
            ip.project_subtype,
            ec.state,
            ec.county_name,
            ip.current_phase,
            CASE ip.current_phase
                WHEN 'complete' THEN 'COMPLETE'
                WHEN 'construction' THEN 'CONSTRUCTION'
                WHEN 'row' THEN 'ROW'
                WHEN 'pe' THEN 'PE'
                ELSE 'PLANNING'
            END as phase_text,
            ip.length_miles,
            ip.lanes_added,
            ip.is_new_interchange,
            ip.is_widening,
            '$' || TO_CHAR(ip.total_cost / 1000000, 'FM999') || 'M' as cost,
            ip.construction_start_date,
            ip.construction_end_date,
            ip.storage_site_relevance,
            CASE ip.storage_site_relevance
                WHEN 'high' THEN 'HIGH'
                WHEN 'medium' THEN 'MEDIUM'
                ELSE 'LOW'
            END as relevance_text,
            ec.demand_impact,
            ec.housing_demand_units,
            ec.storage_demand_sqft
        FROM infrastructure_projects ip
        JOIN economic_catalysts ec ON ip.catalyst_id = ec.id
        WHERE ec.is_active = TRUE
        ORDER BY
            CASE ip.storage_site_relevance WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            ip.total_cost DESC;
    """)
    print("Created v_stip_dashboard view")

    # Infrastructure by route view
    cur.execute("""
        CREATE OR REPLACE VIEW v_infrastructure_by_route AS
        SELECT
            ip.route_name,
            ip.route_type,
            COUNT(*) as projects,
            SUM(ip.length_miles) as total_miles,
            SUM(ip.lanes_added) as total_lanes_added,
            SUM(CASE WHEN ip.is_new_interchange THEN 1 ELSE 0 END) as new_interchanges,
            SUM(ip.total_cost) as total_investment,
            STRING_AGG(DISTINCT ec.county_name, ', ') as counties,
            STRING_AGG(DISTINCT ip.current_phase, ', ') as phases,
            MAX(CASE WHEN ip.storage_site_relevance = 'high' THEN 1 ELSE 0 END) as has_high_relevance
        FROM infrastructure_projects ip
        JOIN economic_catalysts ec ON ip.catalyst_id = ec.id
        WHERE ec.is_active = TRUE
        GROUP BY ip.route_name, ip.route_type
        ORDER BY total_investment DESC;
    """)
    print("Created v_infrastructure_by_route view")

    # Infrastructure by county view
    cur.execute("""
        CREATE OR REPLACE VIEW v_infrastructure_by_county AS
        SELECT
            ec.state,
            ec.county_fips,
            ec.county_name,
            COUNT(*) as total_projects,
            SUM(CASE WHEN ip.is_new_interchange THEN 1 ELSE 0 END) as new_interchanges,
            SUM(CASE WHEN ip.is_widening THEN 1 ELSE 0 END) as widening_projects,
            SUM(ip.length_miles) as total_miles,
            SUM(ip.total_cost) as total_investment,
            SUM(ec.housing_demand_units) as housing_enabled,
            SUM(ec.storage_demand_sqft) as storage_demand,
            COUNT(CASE WHEN ip.storage_site_relevance = 'high' THEN 1 END) as high_relevance_projects,
            COUNT(CASE WHEN ip.current_phase = 'construction' THEN 1 END) as under_construction,
            STRING_AGG(DISTINCT ip.route_name, ', ') as routes_affected
        FROM infrastructure_projects ip
        JOIN economic_catalysts ec ON ip.catalyst_id = ec.id
        WHERE ec.is_active = TRUE
        GROUP BY ec.state, ec.county_fips, ec.county_name
        ORDER BY total_investment DESC;
    """)
    print("Created v_infrastructure_by_county view")

    # High-relevance infrastructure view
    cur.execute("""
        CREATE OR REPLACE VIEW v_high_relevance_infrastructure AS
        SELECT
            ec.state,
            ec.county_name,
            ec.city,
            ip.route_name,
            ip.project_subtype,
            ip.is_new_interchange,
            ec.catalyst_name as project_name,
            ip.current_phase,
            ip.construction_end_date as expected_completion,
            ip.storage_site_relevance,
            ip.storage_relevance_notes,
            ec.housing_demand_units,
            ec.storage_demand_sqft,
            ec.demand_timing,
            '$' || TO_CHAR(ip.total_cost / 1000000, 'FM999') || 'M' as investment
        FROM infrastructure_projects ip
        JOIN economic_catalysts ec ON ip.catalyst_id = ec.id
        WHERE ec.is_active = TRUE
        AND ip.storage_site_relevance IN ('high', 'medium')
        ORDER BY
            CASE ip.storage_site_relevance WHEN 'high' THEN 1 ELSE 2 END,
            ec.storage_demand_sqft DESC;
    """)
    print("Created v_high_relevance_infrastructure view")


def seed_sample_data(cur):
    """Seed sample STIP data for target areas"""

    print("\nSeeding STIP projects...")

    # I-81 Widening - Martinsburg to Falling Waters
    cur.execute("""
        SELECT add_infrastructure_catalyst(
            'WV', '54003', 'Berkeley', 'Martinsburg',
            'WV-2024-081-001',
            'I-81 Widening - Martinsburg to Falling Waters',
            'highway', 'widening',
            'I-81', 'interstate',
            8.5,
            185000000,
            FALSE, TRUE, 2,
            'construction',
            '2023-06-01', '2026-12-01',
            'WVDOT STIP 2024-2027'
        );
    """)
    print("  Added: I-81 Widening - Martinsburg to Falling Waters")

    # I-81 Exit 5 Interchange Improvements
    cur.execute("""
        SELECT add_infrastructure_catalyst(
            'WV', '54003', 'Berkeley', 'Inwood',
            'WV-2024-081-002',
            'I-81 Exit 5 Interchange Improvements',
            'interchange', 'new_construction',
            'I-81', 'interstate',
            0.5,
            45000000,
            TRUE, FALSE, 0,
            'pe',
            '2025-01-01', '2027-06-01',
            'WVDOT STIP 2024-2027'
        );
    """)
    print("  Added: I-81 Exit 5 Interchange Improvements")

    # US-11 Widening
    cur.execute("""
        SELECT add_infrastructure_catalyst(
            'WV', '54003', 'Berkeley', 'Martinsburg',
            'WV-2024-011-001',
            'US-11 Widening - Martinsburg Bypass Extension',
            'highway', 'widening',
            'US-11', 'us_route',
            4.2,
            65000000,
            FALSE, TRUE, 2,
            'row',
            '2024-06-01', '2027-12-01',
            'WVDOT STIP 2024-2027'
        );
    """)
    print("  Added: US-11 Widening - Martinsburg Bypass Extension")

    # WV-9 Charles Town Bypass Phase 2
    cur.execute("""
        SELECT add_infrastructure_catalyst(
            'WV', '54037', 'Jefferson', 'Charles Town',
            'WV-2024-009-001',
            'WV-9 Charles Town Bypass Phase 2',
            'highway', 'new_construction',
            'WV-9', 'state_route',
            6.8,
            120000000,
            TRUE, FALSE, 0,
            'construction',
            '2022-09-01', '2025-12-01',
            'WVDOT STIP 2024-2027'
        );
    """)
    print("  Added: WV-9 Charles Town Bypass Phase 2")

    # WV-9/US-340 Interchange
    cur.execute("""
        SELECT add_infrastructure_catalyst(
            'WV', '54037', 'Jefferson', 'Ranson',
            'WV-2024-009-002',
            'WV-9/US-340 Interchange',
            'interchange', 'new_construction',
            'WV-9', 'state_route',
            0.3,
            55000000,
            TRUE, FALSE, 0,
            'pe',
            '2025-06-01', '2028-06-01',
            'WVDOT STIP 2024-2027'
        );
    """)
    print("  Added: WV-9/US-340 Interchange")

    # MD project - I-81/I-70 Interchange
    cur.execute("""
        SELECT add_infrastructure_catalyst(
            'MD', '24043', 'Washington', 'Hagerstown',
            'MD-2024-081-001',
            'I-81/I-70 Interchange Reconstruction',
            'interchange', 'reconstruction',
            'I-81', 'interstate',
            1.2,
            225000000,
            TRUE, FALSE, 0,
            'construction',
            '2023-01-01', '2026-06-01',
            'MDOT SHA STIP'
        );
    """)
    print("  Added: I-81/I-70 Interchange Reconstruction (MD)")

    print("Seeded 6 STIP projects")


def run_tests(cur):
    """Run tests and display results"""

    print("\n" + "="*80)
    print("TESTING STIP/INFRASTRUCTURE SYSTEM")
    print("="*80)

    # View STIP dashboard
    print("\n--- STIP Dashboard ---")
    cur.execute("""
        SELECT stip_id, project_name, route_name, route_type_text, county_name, state,
               phase_text, cost, relevance_text, demand_impact, housing_demand_units, storage_demand_sqft
        FROM v_stip_dashboard;
    """)
    for row in cur.fetchall():
        interchange = ""
        print(f"{row[0]}: {row[1][:45]:<47}")
        print(f"   Route: {row[2]} ({row[3]}) | {row[4]}, {row[5]} | Phase: {row[6]} | Cost: {row[7]}")
        print(f"   Relevance: {row[8]} | Impact: {row[9]} | Housing: {row[10]} units | Storage: {row[11]:,} sqft")

    # View by route
    print("\n--- Infrastructure by Route ---")
    cur.execute("""
        SELECT route_name, route_type, projects, total_miles, total_lanes_added, new_interchanges,
               total_investment, counties, has_high_relevance
        FROM v_infrastructure_by_route;
    """)
    for row in cur.fetchall():
        inv_m = (row[6] or 0) / 1000000
        high_rel = "YES" if row[8] else "NO"
        print(f"{row[0]} ({row[1]}): {row[2]} projects, {row[3] or 0:.1f} miles, {row[4] or 0} lanes added, {row[5]} interchanges")
        print(f"   Investment: ${inv_m:,.0f}M | Counties: {row[7]} | High Relevance: {high_rel}")

    # View by county
    print("\n--- Infrastructure by County ---")
    cur.execute("""
        SELECT state, county_name, total_projects, new_interchanges, widening_projects,
               total_miles, total_investment, housing_enabled, storage_demand,
               high_relevance_projects, under_construction, routes_affected
        FROM v_infrastructure_by_county;
    """)
    for row in cur.fetchall():
        inv_m = (row[6] or 0) / 1000000
        print(f"{row[0]} {row[1]}: {row[2]} projects ({row[3]} interchanges, {row[4]} widening)")
        print(f"   Miles: {row[5] or 0:.1f} | Investment: ${inv_m:,.0f}M | Housing: {row[7]} | Storage: {row[8]:,} sqft")
        print(f"   High Relevance: {row[9]} | Under Construction: {row[10]} | Routes: {row[11]}")

    # View high-relevance sites
    print("\n--- High Relevance Infrastructure Sites ---")
    cur.execute("""
        SELECT state, county_name, route_name, project_name, current_phase,
               storage_site_relevance, housing_demand_units, storage_demand_sqft, demand_timing, investment
        FROM v_high_relevance_infrastructure;
    """)
    for row in cur.fetchall():
        print(f"{row[0]} {row[1]} - {row[2]}: {row[3][:40]}")
        print(f"   Phase: {row[4]} | Relevance: {row[5]} | Housing: {row[6]} | Storage: {row[7]:,} sqft | Timing: {row[8]} | {row[9]}")

    # Identify opportunities
    print("\n--- Infrastructure Opportunities (All Counties) ---")
    cur.execute("SELECT * FROM identify_infrastructure_opportunities();")
    for row in cur.fetchall():
        inv_m = (row[10] or 0) / 1000000
        print(f"#{row[0]} {row[1]} - {row[2][:40]}")
        print(f"   {row[4]} {row[3]} | Type: {row[5]} | Timing: {row[6]} | Relevance: {row[7]}")
        print(f"   Housing: {row[8]} | Storage: {row[9]:,} sqft | Investment: ${inv_m:,.0f}M")
        print(f"   Notes: {row[11]}")

    # Berkeley County opportunities only
    print("\n--- Berkeley County (54003) Opportunities ---")
    cur.execute("SELECT * FROM identify_infrastructure_opportunities('54003');")
    for row in cur.fetchall():
        inv_m = (row[10] or 0) / 1000000
        print(f"#{row[0]} {row[1]}: {row[5]} | {row[7]} relevance | {row[9]:,} sqft storage demand")

    # Show all catalysts by type
    print("\n--- All Catalysts by Type (including Infrastructure) ---")
    cur.execute("""
        SELECT
            catalyst_type,
            catalyst_subtype,
            COUNT(*) as count,
            SUM(housing_demand_units) as housing_demand,
            SUM(storage_demand_sqft) as storage_demand,
            SUM(investment_amount) as total_investment
        FROM economic_catalysts
        WHERE is_active = TRUE
        GROUP BY catalyst_type, catalyst_subtype
        ORDER BY catalyst_type, storage_demand DESC;
    """)
    for row in cur.fetchall():
        inv_m = (row[5] or 0) / 1000000
        print(f"{row[0]}/{row[1]}: {row[2]} catalysts | Housing: {row[3] or 0} | Storage: {row[4] or 0:,} sqft | Investment: ${inv_m:,.0f}M")

    # Table counts
    print("\n--- Table Counts ---")
    cur.execute("SELECT 'infrastructure_projects' as table_name, COUNT(*) as rows FROM infrastructure_projects;")
    row = cur.fetchone()
    print(f"{row[0]}: {row[1]} rows")

    # Phase distribution
    print("\n--- Project Phase Distribution ---")
    cur.execute("""
        SELECT
            ip.current_phase,
            CASE ip.current_phase
                WHEN 'complete' THEN 'COMPLETE'
                WHEN 'construction' THEN 'CONSTRUCTION'
                WHEN 'row' THEN 'ROW'
                WHEN 'pe' THEN 'PE'
                ELSE 'PLANNING'
            END as phase_text,
            COUNT(*) as projects,
            SUM(ip.total_cost) as investment,
            COUNT(CASE WHEN ip.storage_site_relevance = 'high' THEN 1 END) as high_relevance
        FROM infrastructure_projects ip
        JOIN economic_catalysts ec ON ip.catalyst_id = ec.id
        WHERE ec.is_active = TRUE
        GROUP BY ip.current_phase
        ORDER BY
            CASE ip.current_phase
                WHEN 'construction' THEN 1
                WHEN 'row' THEN 2
                WHEN 'pe' THEN 3
                ELSE 4
            END;
    """)
    for row in cur.fetchall():
        inv_m = (row[3] or 0) / 1000000
        print(f"{row[1]}: {row[2]} projects | ${inv_m:,.0f}M investment | {row[4]} high relevance")


def main():
    conn = get_connection()
    cur = conn.cursor()

    try:
        print("="*80)
        print("PROMPT 18: STIP ROAD PROJECTS")
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

        # Seed sample data
        print("\n4. Seeding sample STIP data...")
        seed_sample_data(cur)
        conn.commit()

        # Run tests
        print("\n5. Running tests...")
        run_tests(cur)
        conn.commit()

        print("\n" + "="*80)
        print("PROMPT 18 COMPLETE")
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
