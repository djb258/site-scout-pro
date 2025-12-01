"""
Prompt 12: Permit Filtering for Housing Pipeline
Creates tables, functions, and views for tracking residential development permits.
"""
import psycopg2

CONNECTION_STRING = 'postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'

def create_permits_raw_table(cur):
    """Create the permits_raw table for raw permit ingestion."""
    print('Creating permits_raw table...')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS permits_raw (
            id SERIAL PRIMARY KEY,
            state VARCHAR(2),
            county_fips VARCHAR(5),
            county_name VARCHAR(100),

            -- Permit identifiers
            permit_number VARCHAR(100),
            permit_type VARCHAR(100),
            permit_subtype VARCHAR(100),

            -- Description (key for classification)
            description TEXT,
            project_name VARCHAR(255),

            -- Location
            address TEXT,
            city VARCHAR(100),
            zip_code VARCHAR(10),
            parcel_id VARCHAR(50),
            latitude DECIMAL(10, 7),
            longitude DECIMAL(10, 7),

            -- Dates
            application_date DATE,
            issue_date DATE,
            expiration_date DATE,
            final_date DATE,

            -- Financials
            valuation DECIMAL(15, 2),
            fee_amount DECIMAL(10, 2),

            -- Scope
            unit_count INT,
            building_sqft INT,
            lot_sqft INT,
            stories INT,

            -- Applicant
            applicant_name VARCHAR(255),
            contractor_name VARCHAR(255),
            owner_name VARCHAR(255),

            -- Status
            permit_status VARCHAR(50),

            -- Classification (set by our function)
            is_housing_related BOOLEAN DEFAULT FALSE,
            housing_type VARCHAR(50),
            classification_confidence DECIMAL(3, 2),
            classification_keywords TEXT[],

            -- Metadata
            source_url TEXT,
            source_name VARCHAR(100),
            raw_json JSONB,
            fetched_at TIMESTAMP DEFAULT NOW(),
            processed_at TIMESTAMP,

            -- Deduplication
            source_hash VARCHAR(64),

            UNIQUE(county_fips, permit_number)
        )
    ''')

    # Create indexes
    cur.execute('CREATE INDEX IF NOT EXISTS idx_permits_raw_county ON permits_raw(county_fips)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_permits_raw_housing ON permits_raw(is_housing_related) WHERE is_housing_related = TRUE')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_permits_raw_dates ON permits_raw(application_date, issue_date)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_permits_raw_type ON permits_raw(permit_type)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_permits_raw_hash ON permits_raw(source_hash)')

    print('  [OK] permits_raw table created')


def create_housing_pipeline_table(cur):
    """Create the housing_pipeline table for tracked developments."""
    print('Creating housing_pipeline table...')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS housing_pipeline (
            id SERIAL PRIMARY KEY,
            permit_id INT REFERENCES permits_raw(id),

            -- Location
            county_fips VARCHAR(5),
            county_name VARCHAR(100),
            state VARCHAR(2),
            address TEXT,
            city VARCHAR(100),
            latitude DECIMAL(10, 7),
            longitude DECIMAL(10, 7),

            -- Project details
            project_name VARCHAR(255),
            housing_type VARCHAR(50),
            unit_count INT,
            building_sqft INT,
            lot_acres DECIMAL(10, 2),
            stories INT,
            valuation DECIMAL(15, 2),

            -- Timeline
            application_date DATE,
            approved_date DATE,
            construction_start DATE,
            estimated_completion DATE,
            actual_completion DATE,

            -- Status tracking with colors
            -- green = active/proceeding
            -- yellow = delayed/stalled
            -- red = cancelled/denied
            -- black = completed
            pipeline_status VARCHAR(20) DEFAULT 'green',
            status_reason TEXT,
            status_updated_at TIMESTAMP DEFAULT NOW(),

            -- Impact assessment
            distance_miles DECIMAL(5, 2),
            demand_impact VARCHAR(20),
            notes TEXT,

            -- Metadata
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),

            -- Link back to permit
            UNIQUE(permit_id)
        )
    ''')

    # Create indexes
    cur.execute('CREATE INDEX IF NOT EXISTS idx_housing_pipeline_county ON housing_pipeline(county_fips)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_housing_pipeline_status ON housing_pipeline(pipeline_status)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_housing_pipeline_type ON housing_pipeline(housing_type)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_housing_pipeline_location ON housing_pipeline(latitude, longitude)')

    print('  [OK] housing_pipeline table created')


def create_keyword_tables(cur):
    """Create keyword classification tables."""
    print('Creating keyword classification tables...')

    # Include keywords (positive signals)
    cur.execute('''
        CREATE TABLE IF NOT EXISTS housing_keywords_include (
            id SERIAL PRIMARY KEY,
            keyword VARCHAR(100) NOT NULL UNIQUE,
            housing_type VARCHAR(50),
            weight DECIMAL(3, 2) DEFAULT 1.0,
            is_phrase BOOLEAN DEFAULT FALSE,
            notes TEXT
        )
    ''')

    # Exclude keywords (negative signals)
    cur.execute('''
        CREATE TABLE IF NOT EXISTS housing_keywords_exclude (
            id SERIAL PRIMARY KEY,
            keyword VARCHAR(100) NOT NULL UNIQUE,
            reason VARCHAR(100),
            weight DECIMAL(3, 2) DEFAULT 1.0,
            notes TEXT
        )
    ''')

    # Seed include keywords
    include_keywords = [
        # Single family
        ('single family', 'single_family', 1.0, True),
        ('sfr', 'single_family', 0.9, False),
        ('detached', 'single_family', 0.7, False),
        ('residence', 'single_family', 0.6, False),
        ('dwelling', 'single_family', 0.6, False),
        ('house', 'single_family', 0.5, False),
        ('home', 'single_family', 0.5, False),

        # Multi-family
        ('apartment', 'multi_family', 1.0, False),
        ('apartments', 'multi_family', 1.0, False),
        ('multi-family', 'multi_family', 1.0, True),
        ('multifamily', 'multi_family', 1.0, False),
        ('multi family', 'multi_family', 1.0, True),
        ('duplex', 'multi_family', 1.0, False),
        ('triplex', 'multi_family', 1.0, False),
        ('fourplex', 'multi_family', 1.0, False),
        ('quadplex', 'multi_family', 1.0, False),
        ('townhouse', 'multi_family', 0.9, False),
        ('townhome', 'multi_family', 0.9, False),
        ('condo', 'multi_family', 0.9, False),
        ('condominium', 'multi_family', 0.9, False),

        # Subdivisions
        ('subdivision', 'subdivision', 1.0, False),
        ('plat', 'subdivision', 0.8, False),
        ('lot split', 'subdivision', 0.9, True),
        ('phase', 'subdivision', 0.6, False),

        # Senior/55+
        ('senior living', 'senior', 1.0, True),
        ('55+', 'senior', 1.0, False),
        ('assisted living', 'senior', 1.0, True),
        ('retirement', 'senior', 0.8, False),
        ('active adult', 'senior', 1.0, True),

        # Mixed use
        ('mixed use', 'mixed_use', 1.0, True),
        ('mixed-use', 'mixed_use', 1.0, False),
        ('live-work', 'mixed_use', 1.0, False),

        # General residential
        ('residential', 'residential', 0.7, False),
        ('housing', 'residential', 0.8, False),
        ('new construction', 'residential', 0.5, True),
    ]

    for kw in include_keywords:
        cur.execute('''
            INSERT INTO housing_keywords_include (keyword, housing_type, weight, is_phrase)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (keyword) DO NOTHING
        ''', kw)

    # Seed exclude keywords
    exclude_keywords = [
        ('commercial', 'non-residential'),
        ('industrial', 'non-residential'),
        ('warehouse', 'non-residential'),
        ('office', 'non-residential'),
        ('retail', 'non-residential'),
        ('restaurant', 'non-residential'),
        ('church', 'non-residential'),
        ('school', 'non-residential'),
        ('hospital', 'non-residential'),
        ('storage', 'competitor'),
        ('self-storage', 'competitor'),
        ('self storage', 'competitor'),
        ('mini storage', 'competitor'),
        ('rv storage', 'competitor'),
        ('boat storage', 'competitor'),
        ('renovation', 'not new'),
        ('remodel', 'not new'),
        ('repair', 'not new'),
        ('addition', 'not new'),
        ('alteration', 'not new'),
        ('reroof', 'not new'),
        ('roofing', 'not new'),
        ('hvac', 'not new'),
        ('plumbing', 'not new'),
        ('electrical', 'not new'),
        ('fence', 'not new'),
        ('deck', 'not new'),
        ('pool', 'not new'),
        ('garage', 'not new'),
        ('shed', 'not new'),
        ('demolition', 'not new'),
        ('demo', 'not new'),
        ('sign', 'non-residential'),
        ('signage', 'non-residential'),
        ('antenna', 'non-residential'),
        ('tower', 'non-residential'),
        ('solar', 'not new'),
        ('photovoltaic', 'not new'),
    ]

    for kw in exclude_keywords:
        cur.execute('''
            INSERT INTO housing_keywords_exclude (keyword, reason)
            VALUES (%s, %s)
            ON CONFLICT (keyword) DO NOTHING
        ''', kw)

    print('  [OK] Keyword tables created and seeded')


def create_classify_function(cur):
    """Create the classify_permit function."""
    print('Creating classify_permit function...')

    cur.execute('''
        CREATE OR REPLACE FUNCTION classify_permit(p_permit_id INT)
        RETURNS BOOLEAN AS $func$
        DECLARE
            v_description TEXT;
            v_permit_type TEXT;
            v_project_name TEXT;
            v_combined_text TEXT;
            v_include_score DECIMAL := 0;
            v_exclude_score DECIMAL := 0;
            v_matched_keywords TEXT[] := ARRAY[]::TEXT[];
            v_housing_type VARCHAR(50);
            v_confidence DECIMAL;
            v_is_housing BOOLEAN;
            v_kw RECORD;
        BEGIN
            -- Get permit details
            SELECT
                LOWER(COALESCE(description, '')),
                LOWER(COALESCE(permit_type, '')),
                LOWER(COALESCE(project_name, ''))
            INTO v_description, v_permit_type, v_project_name
            FROM permits_raw
            WHERE id = p_permit_id;

            IF v_description IS NULL THEN
                RETURN FALSE;
            END IF;

            -- Combine text for matching
            v_combined_text := v_description || ' ' || v_permit_type || ' ' || v_project_name;

            -- Check exclude keywords first (disqualifiers)
            FOR v_kw IN SELECT keyword, weight FROM housing_keywords_exclude LOOP
                IF v_combined_text LIKE '%' || v_kw.keyword || '%' THEN
                    v_exclude_score := v_exclude_score + v_kw.weight;
                END IF;
            END LOOP;

            -- If strong exclusion signal, mark as not housing
            IF v_exclude_score >= 1.0 THEN
                UPDATE permits_raw
                SET is_housing_related = FALSE,
                    classification_confidence = 0,
                    processed_at = NOW()
                WHERE id = p_permit_id;
                RETURN FALSE;
            END IF;

            -- Check include keywords
            FOR v_kw IN SELECT keyword, housing_type, weight, is_phrase FROM housing_keywords_include LOOP
                IF v_kw.is_phrase THEN
                    -- Exact phrase match
                    IF v_combined_text LIKE '%' || v_kw.keyword || '%' THEN
                        v_include_score := v_include_score + v_kw.weight;
                        v_matched_keywords := array_append(v_matched_keywords, v_kw.keyword);
                        -- Set housing type from highest weight match
                        IF v_housing_type IS NULL OR v_kw.weight > 0.8 THEN
                            v_housing_type := v_kw.housing_type;
                        END IF;
                    END IF;
                ELSE
                    -- Word boundary match (simple)
                    IF v_combined_text ~ ('(^|[^a-z])' || v_kw.keyword || '([^a-z]|$)') THEN
                        v_include_score := v_include_score + v_kw.weight;
                        v_matched_keywords := array_append(v_matched_keywords, v_kw.keyword);
                        IF v_housing_type IS NULL OR v_kw.weight > 0.8 THEN
                            v_housing_type := v_kw.housing_type;
                        END IF;
                    END IF;
                END IF;
            END LOOP;

            -- Calculate confidence (0-1)
            v_confidence := LEAST(v_include_score / 2.0, 1.0);

            -- Determine if housing related
            v_is_housing := v_include_score >= 0.5 AND v_exclude_score < 0.5;

            -- Update permit record
            UPDATE permits_raw
            SET is_housing_related = v_is_housing,
                housing_type = v_housing_type,
                classification_confidence = v_confidence,
                classification_keywords = v_matched_keywords,
                processed_at = NOW()
            WHERE id = p_permit_id;

            RETURN v_is_housing;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] classify_permit function created')


def create_batch_functions(cur):
    """Create batch processing and promotion functions."""
    print('Creating batch processing functions...')

    # Batch classify function
    cur.execute('''
        CREATE OR REPLACE FUNCTION classify_permits_batch(p_county_fips VARCHAR DEFAULT NULL)
        RETURNS TABLE(total INT, housing INT, non_housing INT) AS $func$
        DECLARE
            v_total INT := 0;
            v_housing INT := 0;
            v_permit RECORD;
        BEGIN
            -- Process unprocessed permits
            FOR v_permit IN
                SELECT id
                FROM permits_raw
                WHERE processed_at IS NULL
                AND (p_county_fips IS NULL OR county_fips = p_county_fips)
            LOOP
                v_total := v_total + 1;
                IF classify_permit(v_permit.id) THEN
                    v_housing := v_housing + 1;
                END IF;
            END LOOP;

            RETURN QUERY SELECT v_total, v_housing, v_total - v_housing;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    # Promote to pipeline function
    cur.execute('''
        CREATE OR REPLACE FUNCTION promote_to_pipeline(p_permit_id INT)
        RETURNS INT AS $func$
        DECLARE
            v_pipeline_id INT;
            v_permit RECORD;
        BEGIN
            -- Get permit details
            SELECT * INTO v_permit
            FROM permits_raw
            WHERE id = p_permit_id
            AND is_housing_related = TRUE;

            IF v_permit.id IS NULL THEN
                RAISE EXCEPTION 'Permit % not found or not housing-related', p_permit_id;
            END IF;

            -- Insert into pipeline
            INSERT INTO housing_pipeline (
                permit_id,
                county_fips,
                county_name,
                state,
                address,
                city,
                latitude,
                longitude,
                project_name,
                housing_type,
                unit_count,
                building_sqft,
                lot_acres,
                stories,
                valuation,
                application_date,
                pipeline_status
            )
            VALUES (
                v_permit.id,
                v_permit.county_fips,
                v_permit.county_name,
                v_permit.state,
                v_permit.address,
                v_permit.city,
                v_permit.latitude,
                v_permit.longitude,
                v_permit.project_name,
                v_permit.housing_type,
                v_permit.unit_count,
                v_permit.building_sqft,
                CASE WHEN v_permit.lot_sqft > 0 THEN v_permit.lot_sqft / 43560.0 ELSE NULL END,
                v_permit.stories,
                v_permit.valuation,
                v_permit.application_date,
                'green'
            )
            ON CONFLICT (permit_id) DO UPDATE
            SET updated_at = NOW()
            RETURNING id INTO v_pipeline_id;

            RETURN v_pipeline_id;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    # Batch promote function
    cur.execute('''
        CREATE OR REPLACE FUNCTION promote_all_housing(
            p_county_fips VARCHAR DEFAULT NULL,
            p_min_confidence DECIMAL DEFAULT 0.7
        )
        RETURNS INT AS $func$
        DECLARE
            v_count INT := 0;
            v_permit RECORD;
        BEGIN
            FOR v_permit IN
                SELECT id
                FROM permits_raw
                WHERE is_housing_related = TRUE
                AND classification_confidence >= p_min_confidence
                AND (p_county_fips IS NULL OR county_fips = p_county_fips)
                AND id NOT IN (SELECT permit_id FROM housing_pipeline WHERE permit_id IS NOT NULL)
            LOOP
                PERFORM promote_to_pipeline(v_permit.id);
                v_count := v_count + 1;
            END LOOP;

            RETURN v_count;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    # Update pipeline status function
    cur.execute('''
        CREATE OR REPLACE FUNCTION update_pipeline_status(
            p_pipeline_id INT,
            p_new_status VARCHAR(20),
            p_reason TEXT DEFAULT NULL
        )
        RETURNS VOID AS $func$
        BEGIN
            UPDATE housing_pipeline
            SET pipeline_status = p_new_status,
                status_reason = p_reason,
                status_updated_at = NOW(),
                updated_at = NOW(),
                actual_completion = CASE WHEN p_new_status = 'black' THEN NOW()::DATE ELSE actual_completion END
            WHERE id = p_pipeline_id;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] Batch functions created')


def create_views(cur):
    """Create summary views."""
    print('Creating views...')

    # Drop existing views first
    cur.execute('DROP VIEW IF EXISTS v_pipeline_summary')
    cur.execute('DROP VIEW IF EXISTS v_housing_by_county')
    cur.execute('DROP VIEW IF EXISTS v_permit_classification_stats')

    # Pipeline summary view
    cur.execute('''
        CREATE VIEW v_pipeline_summary AS
        SELECT
            county_fips,
            county_name,
            state,
            pipeline_status,
            CASE pipeline_status
                WHEN 'green' THEN 'Active/Proceeding'
                WHEN 'yellow' THEN 'Delayed/Stalled'
                WHEN 'red' THEN 'Cancelled/Denied'
                WHEN 'black' THEN 'Completed'
                ELSE 'Unknown'
            END as status_description,
            COUNT(*) as project_count,
            SUM(unit_count) as total_units,
            SUM(valuation) as total_valuation,
            AVG(unit_count) as avg_units_per_project
        FROM housing_pipeline
        GROUP BY county_fips, county_name, state, pipeline_status
        ORDER BY county_name, pipeline_status;
    ''')

    # Housing by county view
    cur.execute('''
        CREATE VIEW v_housing_by_county AS
        SELECT
            hp.county_fips,
            hp.county_name,
            hp.state,
            COUNT(*) as total_projects,
            SUM(CASE WHEN pipeline_status = 'green' THEN 1 ELSE 0 END) as active_projects,
            SUM(CASE WHEN pipeline_status = 'black' THEN 1 ELSE 0 END) as completed_projects,
            SUM(hp.unit_count) as total_units,
            SUM(CASE WHEN pipeline_status = 'green' THEN hp.unit_count ELSE 0 END) as active_units,
            SUM(CASE WHEN pipeline_status = 'black' THEN hp.unit_count ELSE 0 END) as completed_units,
            SUM(hp.valuation) as total_valuation,
            COUNT(DISTINCT hp.housing_type) as housing_type_count,
            ARRAY_AGG(DISTINCT hp.housing_type) as housing_types
        FROM housing_pipeline hp
        GROUP BY hp.county_fips, hp.county_name, hp.state
        ORDER BY total_units DESC;
    ''')

    # Permit classification stats
    cur.execute('''
        CREATE VIEW v_permit_classification_stats AS
        SELECT
            county_fips,
            county_name,
            COUNT(*) as total_permits,
            SUM(CASE WHEN processed_at IS NOT NULL THEN 1 ELSE 0 END) as processed,
            SUM(CASE WHEN is_housing_related THEN 1 ELSE 0 END) as housing_related,
            ROUND(AVG(CASE WHEN is_housing_related THEN classification_confidence ELSE NULL END)::NUMERIC, 2) as avg_confidence,
            COUNT(DISTINCT housing_type) as housing_type_count
        FROM permits_raw
        GROUP BY county_fips, county_name
        ORDER BY housing_related DESC;
    ''')

    print('  [OK] Views created')


def insert_sample_data(cur):
    """Insert sample permit data for testing."""
    print('Inserting sample data...')

    sample_permits = [
        # Berkeley County, WV - housing permits
        ('WV', '54003', 'Berkeley', 'BP-2024-001', 'Building', 'New Construction',
         'New single family residence, 3 bedroom, 2 bath, 2200 sqft',
         'Meadow Ridge Estates', '123 Oak Lane', 'Martinsburg', '25401',
         '2024-06-15', 350000, 2200, 1, None, None),

        ('WV', '54003', 'Berkeley', 'BP-2024-002', 'Building', 'New Construction',
         'New apartment complex, 48 units, 3 story building',
         'Parkview Apartments Phase II', '500 Industrial Blvd', 'Martinsburg', '25401',
         '2024-07-01', 8500000, 52000, 48, None, None),

        ('WV', '54003', 'Berkeley', 'BP-2024-003', 'Building', 'New Construction',
         'New townhouse development, 12 units',
         'Harper Glen Townhomes', '200 Spring Street', 'Inwood', '25428',
         '2024-08-10', 2400000, 18000, 12, None, None),

        # Jefferson County, WV - housing permits
        ('WV', '54037', 'Jefferson', 'JP-2024-101', 'Building', 'Residential',
         'New single family dwelling, 4BR/3BA, basement',
         None, '456 Mountain View Dr', 'Charles Town', '25414',
         '2024-05-20', 425000, 2800, 1, None, None),

        ('WV', '54037', 'Jefferson', 'JP-2024-102', 'Subdivision', 'Plat',
         'Major subdivision, 24 lot residential plat',
         'Shenandoah Hills Subdivision', 'Blue Ridge Road', 'Shepherdstown', '25443',
         '2024-06-01', None, None, 24, None, None),

        ('WV', '54037', 'Jefferson', 'JP-2024-103', 'Building', 'Commercial',
         'New 55+ active adult community, 120 units',
         'Jefferson Senior Village', '789 Peaceful Lane', 'Ranson', '25438',
         '2024-09-01', 18000000, 95000, 120, None, None),

        # Morgan County, WV - housing permits
        ('WV', '54065', 'Morgan', 'MP-2024-050', 'Building', 'New Construction',
         'New home construction, 3BR, 2BA ranch style',
         None, '321 River Road', 'Berkeley Springs', '25411',
         '2024-07-15', 285000, 1800, 1, None, None),

        # Non-housing permits (should be excluded)
        ('WV', '54003', 'Berkeley', 'BP-2024-500', 'Building', 'Commercial',
         'New retail shopping center, 25000 sqft',
         'Martinsburg Marketplace', '1000 Mall Drive', 'Martinsburg', '25401',
         '2024-06-01', 4500000, 25000, None, None, None),

        ('WV', '54003', 'Berkeley', 'BP-2024-501', 'Building', 'Commercial',
         'New self-storage facility, 150 units',
         'EZ Storage Martinsburg', '555 Storage Lane', 'Martinsburg', '25401',
         '2024-08-01', 1200000, 45000, None, None, None),

        ('WV', '54037', 'Jefferson', 'JP-2024-500', 'Building', 'Renovation',
         'Kitchen and bathroom remodel, existing residence',
         None, '789 Main Street', 'Charles Town', '25414',
         '2024-05-01', 45000, None, None, None, None),

        ('WV', '54065', 'Morgan', 'MP-2024-500', 'Building', 'Addition',
         'New deck addition to existing home',
         None, '100 Lake View', 'Berkeley Springs', '25411',
         '2024-04-15', 8000, 400, None, None, None),
    ]

    for p in sample_permits:
        cur.execute('''
            INSERT INTO permits_raw (
                state, county_fips, county_name, permit_number, permit_type, permit_subtype,
                description, project_name, address, city, zip_code,
                application_date, valuation, building_sqft, unit_count, latitude, longitude
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (county_fips, permit_number) DO NOTHING
        ''', p)

    print('  [OK] Sample data inserted (11 permits)')


def run_test(cur):
    """Run classification test on sample data."""
    print('\nRunning classification test...')

    # Classify all permits
    cur.execute('SELECT * FROM classify_permits_batch()')
    result = cur.fetchone()
    print(f'  Processed: {result[0]} total, {result[1]} housing, {result[2]} non-housing')

    # Show classified permits
    print('\nClassified housing permits:')
    cur.execute('''
        SELECT
            county_name,
            permit_number,
            housing_type,
            ROUND(classification_confidence::NUMERIC * 100) as confidence,
            array_to_string(classification_keywords, ', ') as keywords,
            LEFT(description, 50) as description
        FROM permits_raw
        WHERE is_housing_related = TRUE
        ORDER BY county_name, permit_number
    ''')

    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]}')
        print(f'    Type: {row[2]}, Confidence: {row[3]}%')
        print(f'    Keywords: {row[4]}')
        print(f'    Desc: {row[5]}...')

    # Promote to pipeline
    print('\nPromoting to pipeline...')
    cur.execute('SELECT promote_all_housing(NULL, 0.5)')
    promoted = cur.fetchone()[0]
    print(f'  Promoted {promoted} projects to pipeline')

    # Show pipeline summary
    print('\nPipeline summary by county:')
    cur.execute('SELECT * FROM v_housing_by_county')
    for row in cur.fetchall():
        print(f'  {row[1]}, {row[2]}: {row[3]} projects, {row[6]} total units')


def main():
    conn = psycopg2.connect(CONNECTION_STRING)
    conn.autocommit = True
    cur = conn.cursor()

    print('='*70)
    print('PROMPT 12: PERMIT FILTERING FOR HOUSING PIPELINE')
    print('='*70)

    # Create all components
    create_permits_raw_table(cur)
    create_housing_pipeline_table(cur)
    create_keyword_tables(cur)
    create_classify_function(cur)
    create_batch_functions(cur)
    create_views(cur)

    # Insert sample data and test
    insert_sample_data(cur)
    run_test(cur)

    print('\n' + '='*70)
    print('SETUP COMPLETE')
    print('='*70)
    print('\nTables created:')
    print('  - permits_raw')
    print('  - housing_pipeline')
    print('  - housing_keywords_include')
    print('  - housing_keywords_exclude')
    print('\nFunctions created:')
    print('  - classify_permit(permit_id)')
    print('  - classify_permits_batch(county_fips)')
    print('  - promote_to_pipeline(permit_id)')
    print('  - promote_all_housing(county_fips, min_confidence)')
    print('  - update_pipeline_status(pipeline_id, status, reason)')
    print('\nViews created:')
    print('  - v_pipeline_summary')
    print('  - v_housing_by_county')
    print('  - v_permit_classification_stats')

    conn.close()


if __name__ == '__main__':
    main()
