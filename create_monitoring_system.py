"""
Prompt 17: Investment & News Monitoring
Creates monitoring system for economic catalysts, major investments, policy changes,
and news that impact storage demand.

Key outputs: economic catalysts, news tracking, policy impacts, employer monitoring
Demand scoring: jobs -> housing units -> storage sq ft
"""

import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection
DB_URL = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"


def get_connection():
    return psycopg2.connect(DB_URL)


def create_tables(cur):
    """Create monitoring tables"""

    # Economic catalysts table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS economic_catalysts (
            id SERIAL PRIMARY KEY,

            -- IDENTIFICATION
            catalyst_name VARCHAR(300) NOT NULL,
            catalyst_type VARCHAR(50) NOT NULL,
            catalyst_subtype VARCHAR(100),

            -- LOCATION
            state VARCHAR(2),
            county_fips VARCHAR(5),
            county_name VARCHAR(100),
            city VARCHAR(100),
            zip VARCHAR(10),
            address VARCHAR(300),
            lat DECIMAL,
            lon DECIMAL,

            -- Impact geography
            impact_radius_miles INT,
            impacted_counties TEXT[],

            -- COMPANY/ENTITY
            company_name VARCHAR(200),
            company_industry VARCHAR(100),
            company_type VARCHAR(50),

            -- ANNOUNCEMENT
            announcement_date DATE,
            announcement_source VARCHAR(200),
            announcement_url VARCHAR(500),

            -- TIMELINE
            status VARCHAR(50),
            status_date DATE,
            groundbreaking_date DATE,
            completion_date DATE,
            expected_completion DATE,

            -- INVESTMENT DETAILS
            investment_amount BIGINT,
            investment_source VARCHAR(100),

            -- JOB IMPACT
            jobs_announced INT,
            jobs_phase_1 INT,
            jobs_construction INT,
            avg_salary INT,
            job_types TEXT,

            -- FACILITY DETAILS
            facility_sqft INT,
            facility_acres DECIMAL,
            facility_type VARCHAR(100),

            -- DEMAND IMPACT SCORING
            demand_impact VARCHAR(20),
            demand_score INT,
            housing_demand_units INT,
            storage_demand_sqft INT,

            -- TIMING
            demand_timing VARCHAR(50),
            peak_impact_year INT,

            -- RELATED CATALYSTS
            related_catalyst_ids INT[],

            -- VERIFICATION
            verified BOOLEAN DEFAULT FALSE,
            verified_date DATE,
            verified_source VARCHAR(200),
            confidence VARCHAR(20),

            -- TRACKING
            last_update_date DATE,
            update_notes TEXT,
            is_active BOOLEAN DEFAULT TRUE,

            -- SOURCE
            source VARCHAR(100),
            source_url VARCHAR(500),
            notes TEXT,

            -- METADATA
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(catalyst_name, county_fips, announcement_date)
        );
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_ec_county ON economic_catalysts(county_fips);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ec_type ON economic_catalysts(catalyst_type);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ec_status ON economic_catalysts(status);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ec_impact ON economic_catalysts(demand_impact);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ec_date ON economic_catalysts(announcement_date);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ec_company ON economic_catalysts(company_name);")

    print("Created economic_catalysts table")

    # News articles table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS news_articles (
            id SERIAL PRIMARY KEY,

            -- ARTICLE INFO
            headline VARCHAR(500) NOT NULL,
            summary TEXT,
            full_text TEXT,

            -- SOURCE
            source_name VARCHAR(200),
            source_url VARCHAR(500) NOT NULL,
            author VARCHAR(200),
            published_date DATE,
            fetched_at TIMESTAMP DEFAULT NOW(),

            -- CATEGORIZATION
            category VARCHAR(50),
            subcategory VARCHAR(100),
            relevance_score INT,

            -- GEOGRAPHY
            state VARCHAR(2),
            county_fips VARCHAR(5),
            county_name VARCHAR(100),
            city VARCHAR(100),

            -- EXTRACTED ENTITIES
            companies_mentioned TEXT[],
            people_mentioned TEXT[],
            locations_mentioned TEXT[],
            amounts_mentioned TEXT[],

            -- LINKAGE
            catalyst_id INT REFERENCES economic_catalysts(id),
            is_catalyst_source BOOLEAN DEFAULT FALSE,

            -- PROCESSING
            is_processed BOOLEAN DEFAULT FALSE,
            is_relevant BOOLEAN,
            action_required VARCHAR(50),

            -- METADATA
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(source_url)
        );
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_na_county ON news_articles(county_fips);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_na_category ON news_articles(category);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_na_date ON news_articles(published_date);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_na_processed ON news_articles(is_processed);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_na_relevant ON news_articles(is_relevant);")

    print("Created news_articles table")

    # Policy tracking table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS policy_tracking (
            id SERIAL PRIMARY KEY,

            -- POLICY IDENTIFICATION
            policy_name VARCHAR(300) NOT NULL,
            policy_type VARCHAR(50) NOT NULL,
            policy_category VARCHAR(100),

            -- JURISDICTION
            jurisdiction_level VARCHAR(20),
            state VARCHAR(2),
            county_fips VARCHAR(5),
            county_name VARCHAR(100),
            municipality VARCHAR(100),

            -- STATUS
            status VARCHAR(50),
            status_date DATE,
            effective_date DATE,
            expiration_date DATE,

            -- DESCRIPTION
            description TEXT,
            key_provisions TEXT,

            -- IMPACT ASSESSMENT
            impact_type VARCHAR(50),
            impact_areas TEXT[],
            impact_score INT,

            -- STORAGE SPECIFIC IMPACT
            storage_impact VARCHAR(100),
            storage_impact_description TEXT,

            -- SOURCE
            source VARCHAR(200),
            source_url VARCHAR(500),

            -- TRACKING
            is_active BOOLEAN DEFAULT TRUE,
            last_review_date DATE,
            next_review_date DATE,
            notes TEXT,

            -- METADATA
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_pt_type ON policy_tracking(policy_type);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_pt_status ON policy_tracking(status);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_pt_state ON policy_tracking(state);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_pt_county ON policy_tracking(county_fips);")

    print("Created policy_tracking table")

    # Employer tracking table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS employer_tracking (
            id SERIAL PRIMARY KEY,

            -- COMPANY INFO
            company_name VARCHAR(200) NOT NULL,
            parent_company VARCHAR(200),
            industry VARCHAR(100),
            naics_code VARCHAR(10),
            company_size VARCHAR(50),
            is_public BOOLEAN,
            ticker_symbol VARCHAR(10),

            -- LOCATION
            state VARCHAR(2),
            county_fips VARCHAR(5),
            county_name VARCHAR(100),
            city VARCHAR(100),
            address VARCHAR(300),

            -- EMPLOYMENT
            current_employees INT,
            employee_trend VARCHAR(20),
            growth_rate_pct DECIMAL,

            -- FACILITY
            facility_type VARCHAR(100),
            facility_sqft INT,

            -- SIGNIFICANCE
            is_major_employer BOOLEAN,
            employer_rank INT,

            -- RECENT ACTIVITY
            last_announcement_date DATE,
            last_announcement_type VARCHAR(100),
            last_announcement_jobs INT,

            -- RISK ASSESSMENT
            stability_score INT,
            expansion_likelihood VARCHAR(20),
            contraction_risk VARCHAR(20),

            -- DEMAND IMPACT
            storage_demand_factor DECIMAL,
            estimated_storage_demand_sqft INT,

            -- SOURCE
            source VARCHAR(200),
            source_url VARCHAR(500),
            data_date DATE,

            -- METADATA
            is_active BOOLEAN DEFAULT TRUE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),

            UNIQUE(company_name, county_fips)
        );
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_et_county ON employer_tracking(county_fips);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_et_industry ON employer_tracking(industry);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_et_size ON employer_tracking(company_size);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_et_trend ON employer_tracking(employee_trend);")

    print("Created employer_tracking table")


def create_functions(cur):
    """Create monitoring functions"""

    # Calculate catalyst demand impact
    cur.execute("""
        CREATE OR REPLACE FUNCTION calculate_catalyst_demand_impact(p_catalyst_id INT)
        RETURNS TABLE(
            housing_demand_units INT,
            storage_demand_sqft INT,
            demand_score INT,
            demand_impact VARCHAR(20),
            demand_timing VARCHAR(50)
        ) AS $func$
        DECLARE
            v_cat economic_catalysts%ROWTYPE;
            v_housing_units INT;
            v_storage_sqft INT;
            v_score INT;
            v_impact VARCHAR(20);
            v_timing VARCHAR(50);
            v_jobs INT;
            v_housing_per_job DECIMAL := 0.4;
            v_storage_per_unit DECIMAL := 6;
        BEGIN
            SELECT * INTO v_cat FROM economic_catalysts WHERE id = p_catalyst_id;

            -- Get job count
            v_jobs := COALESCE(v_cat.jobs_announced, v_cat.jobs_phase_1, 0);

            -- Calculate housing demand
            v_housing_units := (v_jobs * v_housing_per_job)::INT;

            -- Calculate storage demand
            v_storage_sqft := (v_housing_units * v_storage_per_unit)::INT;

            -- Add direct storage demand for certain facility types
            IF v_cat.catalyst_subtype IN ('distribution', 'warehouse', 'logistics') THEN
                v_storage_sqft := v_storage_sqft + (v_jobs * 2)::INT;
            END IF;

            -- Calculate score (0-100)
            v_score := LEAST(100,
                CASE
                    WHEN v_jobs >= 5000 THEN 90
                    WHEN v_jobs >= 2000 THEN 75
                    WHEN v_jobs >= 1000 THEN 60
                    WHEN v_jobs >= 500 THEN 45
                    WHEN v_jobs >= 200 THEN 30
                    WHEN v_jobs >= 100 THEN 20
                    ELSE 10
                END +
                CASE
                    WHEN v_cat.investment_amount >= 1000000000 THEN 10
                    WHEN v_cat.investment_amount >= 500000000 THEN 7
                    WHEN v_cat.investment_amount >= 100000000 THEN 5
                    ELSE 0
                END
            );

            -- Determine impact level
            v_impact := CASE
                WHEN v_score >= 75 THEN 'major'
                WHEN v_score >= 50 THEN 'significant'
                WHEN v_score >= 25 THEN 'moderate'
                ELSE 'minor'
            END;

            -- Determine timing based on status
            v_timing := CASE v_cat.status
                WHEN 'operational' THEN 'immediate'
                WHEN 'under_construction' THEN '1_year'
                WHEN 'approved' THEN '2_years'
                WHEN 'announced' THEN '3_plus_years'
                ELSE '3_plus_years'
            END;

            RETURN QUERY SELECT v_housing_units, v_storage_sqft, v_score, v_impact, v_timing;
        END;
        $func$ LANGUAGE plpgsql;
    """)
    print("Created calculate_catalyst_demand_impact() function")

    # Update catalyst demand
    cur.execute("""
        CREATE OR REPLACE FUNCTION update_catalyst_demand(p_catalyst_id INT)
        RETURNS VOID AS $func$
        DECLARE
            v_demand RECORD;
        BEGIN
            SELECT * INTO v_demand FROM calculate_catalyst_demand_impact(p_catalyst_id);

            UPDATE economic_catalysts SET
                housing_demand_units = v_demand.housing_demand_units,
                storage_demand_sqft = v_demand.storage_demand_sqft,
                demand_score = v_demand.demand_score,
                demand_impact = v_demand.demand_impact,
                demand_timing = v_demand.demand_timing,
                updated_at = NOW()
            WHERE id = p_catalyst_id;
        END;
        $func$ LANGUAGE plpgsql;
    """)
    print("Created update_catalyst_demand() function")

    # Get county catalyst summary
    cur.execute("""
        CREATE OR REPLACE FUNCTION get_county_catalyst_summary(p_county_fips VARCHAR(5))
        RETURNS TABLE(
            total_catalysts INT,
            major_catalysts INT,
            total_jobs_announced INT,
            total_investment BIGINT,
            total_housing_demand INT,
            total_storage_demand INT,
            catalyst_score INT
        ) AS $func$
        BEGIN
            RETURN QUERY
            SELECT
                COUNT(*)::INT as total_catalysts,
                COUNT(CASE WHEN ec.demand_impact IN ('major', 'significant') THEN 1 END)::INT as major_catalysts,
                COALESCE(SUM(ec.jobs_announced), 0)::INT as total_jobs_announced,
                COALESCE(SUM(ec.investment_amount), 0)::BIGINT as total_investment,
                COALESCE(SUM(ec.housing_demand_units), 0)::INT as total_housing_demand,
                COALESCE(SUM(ec.storage_demand_sqft), 0)::INT as total_storage_demand,
                LEAST(100, (
                    COUNT(CASE WHEN ec.demand_impact = 'major' THEN 1 END) * 25 +
                    COUNT(CASE WHEN ec.demand_impact = 'significant' THEN 1 END) * 15 +
                    COUNT(CASE WHEN ec.demand_impact = 'moderate' THEN 1 END) * 8 +
                    COUNT(CASE WHEN ec.demand_impact = 'minor' THEN 1 END) * 3
                ))::INT as catalyst_score
            FROM economic_catalysts ec
            WHERE ec.county_fips = p_county_fips
            AND ec.is_active = TRUE
            AND ec.status NOT IN ('cancelled', 'rumored');
        END;
        $func$ LANGUAGE plpgsql;
    """)
    print("Created get_county_catalyst_summary() function")

    # Apply catalysts to projection
    cur.execute("""
        CREATE OR REPLACE FUNCTION apply_catalysts_to_projection(p_county_fips VARCHAR(5))
        RETURNS VOID AS $func$
        DECLARE
            v_catalyst_summary RECORD;
            v_mp market_projections%ROWTYPE;
            v_top_catalyst VARCHAR(300);
        BEGIN
            -- Get catalyst summary
            SELECT * INTO v_catalyst_summary FROM get_county_catalyst_summary(p_county_fips);

            -- Get current projection
            SELECT * INTO v_mp
            FROM market_projections
            WHERE geo_type = 'county' AND geo_id = p_county_fips
            ORDER BY projection_date DESC
            LIMIT 1;

            IF FOUND AND v_catalyst_summary.total_storage_demand > 0 THEN
                -- Get top catalyst name
                SELECT catalyst_name INTO v_top_catalyst
                FROM economic_catalysts
                WHERE county_fips = p_county_fips
                AND is_active = TRUE
                ORDER BY demand_score DESC
                LIMIT 1;

                -- Update projection with catalyst-driven demand
                UPDATE market_projections SET
                    pipeline_demand_sqft = COALESCE(pipeline_demand_sqft, 0) + v_catalyst_summary.total_storage_demand,
                    opportunity_score = LEAST(100, opportunity_score + (v_catalyst_summary.catalyst_score / 4)),
                    primary_catalyst = COALESCE(v_top_catalyst, primary_catalyst),
                    notes = COALESCE(notes, '') ||
                            E'\n[Catalysts] ' || v_catalyst_summary.total_catalysts || ' catalysts, ' ||
                            v_catalyst_summary.total_jobs_announced || ' jobs, $' ||
                            (v_catalyst_summary.total_investment / 1000000)::INT || 'M investment'
                WHERE id = v_mp.id;
            END IF;
        END;
        $func$ LANGUAGE plpgsql;
    """)
    print("Created apply_catalysts_to_projection() function")


def create_views(cur):
    """Create monitoring views"""

    # Catalyst dashboard view
    cur.execute("""
        CREATE OR REPLACE VIEW v_catalyst_dashboard AS
        SELECT
            id,
            catalyst_name,
            catalyst_type,
            catalyst_subtype,
            state,
            county_name,
            city,
            company_name,
            status,
            CASE status
                WHEN 'operational' THEN 'OPERATIONAL'
                WHEN 'under_construction' THEN 'CONSTRUCTION'
                WHEN 'approved' THEN 'APPROVED'
                WHEN 'announced' THEN 'ANNOUNCED'
                WHEN 'cancelled' THEN 'CANCELLED'
            END as status_text,
            announcement_date,
            jobs_announced,
            '$' || TO_CHAR(investment_amount / 1000000, 'FM999,999') || 'M' as investment,
            demand_impact,
            CASE demand_impact
                WHEN 'major' THEN 'MAJOR'
                WHEN 'significant' THEN 'SIGNIFICANT'
                WHEN 'moderate' THEN 'MODERATE'
                WHEN 'minor' THEN 'MINOR'
            END as impact_text,
            demand_score,
            housing_demand_units as housing_units,
            storage_demand_sqft as storage_sqft,
            demand_timing,
            confidence
        FROM economic_catalysts
        WHERE is_active = TRUE
        ORDER BY demand_score DESC, announcement_date DESC;
    """)
    print("Created v_catalyst_dashboard view")

    # County catalyst summary view
    cur.execute("""
        CREATE OR REPLACE VIEW v_county_catalyst_summary AS
        SELECT
            ec.state,
            ec.county_fips,
            ec.county_name,
            COUNT(*) as total_catalysts,
            COUNT(CASE WHEN demand_impact IN ('major', 'significant') THEN 1 END) as major_catalysts,
            SUM(jobs_announced) as total_jobs,
            SUM(investment_amount) as total_investment,
            SUM(housing_demand_units) as housing_demand,
            SUM(storage_demand_sqft) as storage_demand,
            MAX(demand_score) as top_catalyst_score,
            STRING_AGG(DISTINCT demand_timing, ', ' ORDER BY demand_timing) as demand_timings
        FROM economic_catalysts ec
        WHERE is_active = TRUE
        AND status NOT IN ('cancelled')
        GROUP BY ec.state, ec.county_fips, ec.county_name
        ORDER BY SUM(storage_demand_sqft) DESC NULLS LAST;
    """)
    print("Created v_county_catalyst_summary view")

    # Recent announcements view
    cur.execute("""
        CREATE OR REPLACE VIEW v_recent_announcements AS
        SELECT
            announcement_date,
            catalyst_name,
            company_name,
            catalyst_type,
            county_name,
            state,
            jobs_announced,
            investment_amount,
            demand_impact,
            status,
            source,
            EXTRACT(DAY FROM NOW() - announcement_date)::INT as days_ago
        FROM economic_catalysts
        WHERE announcement_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY announcement_date DESC;
    """)
    print("Created v_recent_announcements view")

    # Policy impacts view
    cur.execute("""
        CREATE OR REPLACE VIEW v_policy_impacts AS
        SELECT
            policy_name,
            policy_type,
            policy_category,
            jurisdiction_level,
            state,
            county_name,
            status,
            effective_date,
            impact_type,
            CASE impact_type
                WHEN 'positive' THEN 'POSITIVE'
                WHEN 'negative' THEN 'NEGATIVE'
                WHEN 'neutral' THEN 'NEUTRAL'
                WHEN 'mixed' THEN 'MIXED'
            END as impact_text,
            impact_score,
            storage_impact,
            key_provisions
        FROM policy_tracking
        WHERE is_active = TRUE
        ORDER BY
            CASE impact_type WHEN 'positive' THEN 1 WHEN 'mixed' THEN 2 WHEN 'neutral' THEN 3 ELSE 4 END,
            effective_date DESC;
    """)
    print("Created v_policy_impacts view")

    # Employer watchlist view
    cur.execute("""
        CREATE OR REPLACE VIEW v_employer_watchlist AS
        SELECT
            company_name,
            industry,
            county_name,
            state,
            current_employees,
            employee_trend,
            CASE employee_trend
                WHEN 'growing' THEN 'GROWING'
                WHEN 'stable' THEN 'STABLE'
                WHEN 'declining' THEN 'DECLINING'
                ELSE 'UNKNOWN'
            END as trend_text,
            is_major_employer,
            employer_rank,
            last_announcement_type,
            last_announcement_date,
            last_announcement_jobs,
            expansion_likelihood,
            contraction_risk,
            estimated_storage_demand_sqft
        FROM employer_tracking
        WHERE is_active = TRUE
        ORDER BY current_employees DESC NULLS LAST;
    """)
    print("Created v_employer_watchlist view")

    # News feed view
    cur.execute("""
        CREATE OR REPLACE VIEW v_news_feed AS
        SELECT
            id,
            headline,
            source_name,
            published_date,
            category,
            county_name,
            state,
            relevance_score,
            is_relevant,
            action_required,
            CASE action_required
                WHEN 'create_catalyst' THEN 'NEW'
                WHEN 'update_catalyst' THEN 'UPDATE'
                WHEN 'monitor' THEN 'MONITOR'
                ELSE '-'
            END as action_text,
            source_url
        FROM news_articles
        WHERE published_date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY published_date DESC, relevance_score DESC;
    """)
    print("Created v_news_feed view")


def seed_sample_data(cur):
    """Seed sample economic catalysts and policies"""

    # Sample economic catalysts
    cur.execute("""
        INSERT INTO economic_catalysts (
            catalyst_name, catalyst_type, catalyst_subtype,
            state, county_fips, county_name, city,
            company_name, company_industry, company_type,
            announcement_date, status, status_date,
            investment_amount, jobs_announced, avg_salary,
            facility_sqft, facility_type,
            source, confidence
        ) VALUES
        -- Berkeley County, WV
        ('Procter & Gamble Distribution Center', 'investment', 'distribution',
         'WV', '54003', 'Berkeley', 'Martinsburg',
         'Procter & Gamble', 'Consumer Goods', 'fortune_500',
         '2023-06-15', 'operational', '2024-01-01',
         150000000, 800, 55000,
         1200000, 'Distribution Center',
         'WV Commerce', 'confirmed'),

        ('Amazon Fulfillment Center Expansion', 'investment', 'distribution',
         'WV', '54003', 'Berkeley', 'Martinsburg',
         'Amazon', 'E-commerce', 'fortune_500',
         '2024-03-01', 'under_construction', '2024-06-01',
         200000000, 1500, 42000,
         850000, 'Fulfillment Center',
         'Herald-Mail Media', 'confirmed'),

        ('Macy''s Regional Distribution', 'investment', 'distribution',
         'WV', '54003', 'Berkeley', 'Martinsburg',
         'Macy''s', 'Retail', 'fortune_500',
         '2022-01-01', 'operational', '2023-06-01',
         100000000, 600, 45000,
         700000, 'Distribution Center',
         'WV Commerce', 'confirmed'),

        -- Jefferson County, WV
        ('Hollywood Casino Expansion', 'investment', 'hospitality',
         'WV', '54037', 'Jefferson', 'Charles Town',
         'Penn Entertainment', 'Gaming', 'large',
         '2024-01-15', 'approved', '2024-04-01',
         75000000, 300, 38000,
         150000, 'Casino/Hotel',
         'Journal News', 'confirmed'),

        ('American Public University Growth', 'employer', 'education',
         'WV', '54037', 'Jefferson', 'Charles Town',
         'American Public University System', 'Education', 'large',
         '2024-02-01', 'announced', '2024-02-01',
         25000000, 200, 65000,
         100000, 'Office',
         'APUS Press Release', 'confirmed')
        ON CONFLICT DO NOTHING;
    """)
    print("Seeded economic catalysts")

    # Update demand scores for all catalysts
    cur.execute("""
        DO $update_loop$
        DECLARE
            v_cat RECORD;
        BEGIN
            FOR v_cat IN SELECT id FROM economic_catalysts
            LOOP
                PERFORM update_catalyst_demand(v_cat.id);
            END LOOP;
        END $update_loop$;
    """)
    print("Updated catalyst demand scores")

    # Sample policy tracking
    cur.execute("""
        INSERT INTO policy_tracking (
            policy_name, policy_type, policy_category,
            jurisdiction_level, state,
            status, status_date, effective_date,
            description, key_provisions,
            impact_type, impact_score, storage_impact,
            source
        ) VALUES
        ('West Virginia Business Investment Act', 'state', 'incentive',
         'state', 'WV',
         'enacted', '2023-01-01', '2023-01-01',
         'Tax incentives for job-creating investments in WV',
         'Property tax abatements, job creation tax credits, infrastructure grants',
         'positive', 25, 'Encourages major employer relocations, driving housing and storage demand',
         'WV Legislature'),

        ('Section 301 Tariffs - Electronics', 'federal', 'trade',
         'federal', NULL,
         'enacted', '2024-01-01', '2024-01-01',
         'Increased tariffs on Chinese electronics and components',
         '25-100% tariffs on electronics, semiconductors, solar panels',
         'positive', 30, 'Encourages domestic manufacturing reshoring, creating jobs in target markets',
         'USTR')
        ON CONFLICT DO NOTHING;
    """)
    print("Seeded policy tracking")


def run_tests(cur):
    """Run tests and display results"""

    print("\n" + "="*80)
    print("TESTING MONITORING SYSTEM")
    print("="*80)

    # View catalyst dashboard
    print("\n--- Catalyst Dashboard ---")
    cur.execute("SELECT catalyst_name, company_name, status_text, jobs_announced, investment, demand_impact, demand_score, housing_units, storage_sqft, demand_timing FROM v_catalyst_dashboard;")
    for row in cur.fetchall():
        print(f"{row[0][:40]:<42} | {row[1]:<20} | {row[2]:<12} | {row[3] or 0:>5} jobs | {row[4]:<10} | {row[5] or 'N/A':<12} | Score: {row[6] or 0:>3} | {row[7] or 0:>4} units | {row[8] or 0:>6} sqft | {row[9] or 'N/A'}")

    # View county summary
    print("\n--- County Catalyst Summary ---")
    cur.execute("SELECT state, county_name, total_catalysts, major_catalysts, total_jobs, total_investment, housing_demand, storage_demand, top_catalyst_score FROM v_county_catalyst_summary;")
    for row in cur.fetchall():
        inv_m = (row[5] or 0) / 1000000
        print(f"{row[0]} {row[1]:<15}: {row[2]} catalysts ({row[3]} major), {row[4] or 0:,} jobs, ${inv_m:,.0f}M inv, {row[6] or 0} housing units, {row[7] or 0:,} sqft storage, top score: {row[8]}")

    # View recent announcements
    print("\n--- Recent Announcements (Last 90 Days) ---")
    cur.execute("SELECT announcement_date, catalyst_name, company_name, county_name, jobs_announced, demand_impact, days_ago FROM v_recent_announcements;")
    for row in cur.fetchall():
        print(f"{row[0]} ({row[6]} days ago): {row[1][:35]:<37} | {row[2]:<20} | {row[3]:<12} | {row[4] or 0:>5} jobs | {row[5] or 'N/A'}")

    # Get Berkeley County catalyst summary
    print("\n--- Berkeley County (54003) Catalyst Summary ---")
    cur.execute("SELECT * FROM get_county_catalyst_summary('54003');")
    row = cur.fetchone()
    if row:
        print(f"Total Catalysts: {row[0]}")
        print(f"Major Catalysts: {row[1]}")
        print(f"Total Jobs: {row[2]:,}")
        print(f"Total Investment: ${row[3]/1000000:,.0f}M")
        print(f"Housing Demand: {row[4]} units")
        print(f"Storage Demand: {row[5]:,} sq ft")
        print(f"Catalyst Score: {row[6]}")

    # Apply catalysts to projection
    print("\n--- Applying Catalysts to Projections ---")
    cur.execute("SELECT apply_catalysts_to_projection('54003');")
    cur.execute("SELECT apply_catalysts_to_projection('54037');")
    print("Applied catalysts to Berkeley and Jefferson County projections")

    # View policy impacts
    print("\n--- Policy Impacts ---")
    cur.execute("SELECT policy_name, policy_type, jurisdiction_level, impact_text, impact_score, storage_impact FROM v_policy_impacts;")
    for row in cur.fetchall():
        print(f"{row[0][:45]:<47} | {row[1]:<8} | {row[2]:<8} | {row[3]:<10} | Score: {row[4]:>3} | {row[5][:50] if row[5] else 'N/A'}")

    # Table counts
    print("\n--- Table Counts ---")
    cur.execute("""
        SELECT 'economic_catalysts' as table_name, COUNT(*) as rows FROM economic_catalysts
        UNION ALL
        SELECT 'news_articles', COUNT(*) FROM news_articles
        UNION ALL
        SELECT 'policy_tracking', COUNT(*) FROM policy_tracking
        UNION ALL
        SELECT 'employer_tracking', COUNT(*) FROM employer_tracking;
    """)
    for row in cur.fetchall():
        print(f"{row[0]}: {row[1]} rows")

    # Show catalyst impact distribution
    print("\n--- Catalyst Impact Distribution ---")
    cur.execute("""
        SELECT
            demand_impact,
            CASE demand_impact
                WHEN 'major' THEN 'MAJOR'
                WHEN 'significant' THEN 'SIGNIFICANT'
                WHEN 'moderate' THEN 'MODERATE'
                WHEN 'minor' THEN 'MINOR'
            END as impact_text,
            COUNT(*) as catalysts,
            SUM(jobs_announced) as total_jobs,
            SUM(storage_demand_sqft) as total_storage_demand
        FROM economic_catalysts
        WHERE is_active = TRUE
        GROUP BY demand_impact
        ORDER BY
            CASE demand_impact
                WHEN 'major' THEN 1
                WHEN 'significant' THEN 2
                WHEN 'moderate' THEN 3
                ELSE 4
            END;
    """)
    for row in cur.fetchall():
        print(f"{row[1]:<12}: {row[2]} catalysts, {row[3] or 0:,} jobs, {row[4] or 0:,} sqft storage demand")


def main():
    conn = get_connection()
    cur = conn.cursor()

    try:
        print("="*80)
        print("PROMPT 17: INVESTMENT & NEWS MONITORING")
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
        print("\n4. Seeding sample data...")
        seed_sample_data(cur)
        conn.commit()

        # Run tests
        print("\n5. Running tests...")
        run_tests(cur)
        conn.commit()

        print("\n" + "="*80)
        print("PROMPT 17 COMPLETE")
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
