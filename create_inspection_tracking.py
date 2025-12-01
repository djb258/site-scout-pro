"""
Prompt 13: Inspection Tracking for Pipeline Status Updates
Creates inspection tracking system that links to permits and updates housing pipeline status.
Status flow: permitted (green) -> site_work (yellow) -> vertical (red) -> existing (black)
"""
import psycopg2

CONNECTION_STRING = 'postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'


def update_housing_pipeline_table(cur):
    """Add columns needed for inspection tracking to housing_pipeline."""
    print('Updating housing_pipeline table structure...')

    # Add new columns if they don't exist
    columns_to_add = [
        ('status', 'VARCHAR(20)', "'permitted'"),
        ('status_color', 'VARCHAR(20)', "'green'"),
        ('permit_date', 'DATE', None),
        ('site_work_date', 'DATE', None),
        ('vertical_date', 'DATE', None),
        ('completion_date', 'DATE', None),
        ('primary_permit_id', 'INT', None),
        ('permit_numbers', 'TEXT[]', None),
        ('project_address', 'TEXT', None),
        ('parcel_id', 'VARCHAR(50)', None),
    ]

    for col_name, col_type, default in columns_to_add:
        try:
            if default:
                cur.execute(f'''
                    ALTER TABLE housing_pipeline
                    ADD COLUMN IF NOT EXISTS {col_name} {col_type} DEFAULT {default}
                ''')
            else:
                cur.execute(f'''
                    ALTER TABLE housing_pipeline
                    ADD COLUMN IF NOT EXISTS {col_name} {col_type}
                ''')
        except Exception as e:
            if 'already exists' not in str(e).lower():
                print(f'  Warning adding {col_name}: {e}')

    # Update existing records to set permit_date from application_date
    cur.execute('''
        UPDATE housing_pipeline
        SET permit_date = application_date
        WHERE permit_date IS NULL AND application_date IS NOT NULL
    ''')

    # Update project_address from address if not set
    cur.execute('''
        UPDATE housing_pipeline
        SET project_address = address
        WHERE project_address IS NULL AND address IS NOT NULL
    ''')

    print('  [OK] housing_pipeline table updated')


def create_inspections_raw_table(cur):
    """Create the inspections_raw table."""
    print('Creating inspections_raw table...')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS inspections_raw (
            id SERIAL PRIMARY KEY,

            -- Source
            state VARCHAR(2),
            county_fips VARCHAR(5),
            county_name VARCHAR(100),
            jurisdiction VARCHAR(100),

            -- Permit linkage
            permit_number VARCHAR(100),
            permit_id INT REFERENCES permits_raw(id),

            -- Inspection info
            inspection_number VARCHAR(100),
            inspection_type VARCHAR(100),
            inspection_category VARCHAR(50),
            inspection_description TEXT,

            -- Location
            address VARCHAR(300),
            parcel_id VARCHAR(50),

            -- Scheduling
            requested_date DATE,
            scheduled_date DATE,
            inspection_date DATE,

            -- Inspector
            inspector_name VARCHAR(100),
            inspector_id VARCHAR(50),

            -- Result
            result VARCHAR(50),
            result_code VARCHAR(20),
            result_comments TEXT,
            corrections_required TEXT,
            reinspection_required BOOLEAN,

            -- Status
            inspection_status VARCHAR(50),

            -- Source tracking
            source_url VARCHAR(500),
            source_file VARCHAR(200),
            fetched_at TIMESTAMP DEFAULT NOW(),

            -- Processing
            is_processed BOOLEAN DEFAULT FALSE,
            is_status_trigger BOOLEAN,
            triggered_status VARCHAR(20),
            pipeline_id INT,

            UNIQUE(state, county_fips, inspection_number)
        )
    ''')

    # Create indexes
    cur.execute('CREATE INDEX IF NOT EXISTS idx_ir_county ON inspections_raw(county_fips)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_ir_permit ON inspections_raw(permit_number)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_ir_date ON inspections_raw(inspection_date)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_ir_type ON inspections_raw(inspection_type)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_ir_result ON inspections_raw(result)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_ir_processed ON inspections_raw(is_processed)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_ir_pipeline ON inspections_raw(pipeline_id)')

    print('  [OK] inspections_raw table created')


def create_inspection_type_mapping_table(cur):
    """Create inspection type mapping table with seed data."""
    print('Creating inspection_type_mapping table...')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS inspection_type_mapping (
            id SERIAL PRIMARY KEY,
            keyword VARCHAR(100) NOT NULL,
            category VARCHAR(50),
            phase VARCHAR(20) NOT NULL,
            triggers_status VARCHAR(20),
            phase_order INT,
            is_active BOOLEAN DEFAULT TRUE,
            UNIQUE(keyword, category)
        )
    ''')

    # Seed inspection type mappings
    mappings = [
        # Site work phase (yellow) - phase_order 1-3
        ('erosion', 'site', 'site_work', 'site_work', 1),
        ('grading', 'site', 'site_work', 'site_work', 1),
        ('stormwater', 'site', 'site_work', 'site_work', 1),
        ('sediment', 'site', 'site_work', 'site_work', 1),
        ('excavation', 'site', 'site_work', 'site_work', 2),
        ('utility', 'site', 'site_work', 'site_work', 2),
        ('water tap', 'site', 'site_work', 'site_work', 2),
        ('sewer tap', 'site', 'site_work', 'site_work', 2),
        ('underground', 'site', 'site_work', 'site_work', 2),
        ('footing', 'building', 'site_work', 'site_work', 3),
        ('footer', 'building', 'site_work', 'site_work', 3),
        ('foundation', 'building', 'site_work', 'site_work', 3),
        ('slab', 'building', 'site_work', 'site_work', 3),
        ('concrete', 'building', 'site_work', 'site_work', 3),

        # Vertical construction phase (red) - phase_order 4-6
        ('framing', 'building', 'vertical', 'vertical', 4),
        ('frame', 'building', 'vertical', 'vertical', 4),
        ('structural', 'building', 'vertical', 'vertical', 4),
        ('sheathing', 'building', 'vertical', 'vertical', 4),
        ('rough-in', 'building', 'vertical', 'vertical', 5),
        ('rough in', 'building', 'vertical', 'vertical', 5),
        ('rough', 'building', 'vertical', 'vertical', 5),
        ('electrical rough', 'electrical', 'vertical', 'vertical', 5),
        ('plumbing rough', 'plumbing', 'vertical', 'vertical', 5),
        ('mechanical rough', 'mechanical', 'vertical', 'vertical', 5),
        ('hvac rough', 'mechanical', 'vertical', 'vertical', 5),
        ('insulation', 'building', 'vertical', 'vertical', 6),
        ('drywall', 'building', 'vertical', 'vertical', 6),

        # Finish phase (still red) - phase_order 7
        ('electrical final', 'electrical', 'finish', 'vertical', 7),
        ('plumbing final', 'plumbing', 'finish', 'vertical', 7),
        ('mechanical final', 'mechanical', 'finish', 'vertical', 7),
        ('hvac final', 'mechanical', 'finish', 'vertical', 7),
        ('fire', 'fire', 'finish', 'vertical', 7),
        ('sprinkler', 'fire', 'finish', 'vertical', 7),

        # Final/CO phase (black) - phase_order 8-9
        ('final', 'building', 'final', 'existing', 8),
        ('certificate', 'building', 'final', 'existing', 9),
        ('occupancy', 'building', 'final', 'existing', 9),
        ('c of o', 'building', 'final', 'existing', 9),
        ('c.o.', 'building', 'final', 'existing', 9),
        ('co ', 'building', 'final', 'existing', 9),
        ('tco', 'building', 'final', 'existing', 9),
        ('temporary occupancy', 'building', 'final', 'existing', 9),
    ]

    for m in mappings:
        cur.execute('''
            INSERT INTO inspection_type_mapping (keyword, category, phase, triggers_status, phase_order)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (keyword, category) DO NOTHING
        ''', m)

    print('  [OK] inspection_type_mapping table created with {} mappings'.format(len(mappings)))


def create_pipeline_status_log_table(cur):
    """Create pipeline status change log table."""
    print('Creating pipeline_status_log table...')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS pipeline_status_log (
            id SERIAL PRIMARY KEY,
            pipeline_id INT,
            old_status VARCHAR(20),
            new_status VARCHAR(20),
            changed_at TIMESTAMP DEFAULT NOW(),
            trigger_inspection_id INT,
            trigger_source VARCHAR(50),
            notes TEXT
        )
    ''')

    cur.execute('CREATE INDEX IF NOT EXISTS idx_psl_pipeline ON pipeline_status_log(pipeline_id)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_psl_date ON pipeline_status_log(changed_at)')

    print('  [OK] pipeline_status_log table created')


def create_classify_inspection_function(cur):
    """Create function to classify inspections by phase."""
    print('Creating classify_inspection function...')

    cur.execute('''
        CREATE OR REPLACE FUNCTION classify_inspection(p_inspection_id INT)
        RETURNS TABLE(
            phase VARCHAR(20),
            triggers_status VARCHAR(20),
            phase_order INT,
            matched_keyword VARCHAR(100)
        ) AS $func$
        DECLARE
            v_inspection inspections_raw%ROWTYPE;
            v_text TEXT;
            v_mapping RECORD;
            v_best_phase VARCHAR(20);
            v_best_status VARCHAR(20);
            v_best_order INT := 0;
            v_best_keyword VARCHAR(100);
        BEGIN
            -- Get inspection
            SELECT * INTO v_inspection FROM inspections_raw WHERE id = p_inspection_id;

            -- Combine searchable text
            v_text := LOWER(COALESCE(v_inspection.inspection_type, '') || ' ' ||
                            COALESCE(v_inspection.inspection_description, '') || ' ' ||
                            COALESCE(v_inspection.inspection_category, ''));

            -- Find best matching phase (highest phase_order wins)
            FOR v_mapping IN
                SELECT keyword, itm.phase, itm.triggers_status, itm.phase_order
                FROM inspection_type_mapping itm
                WHERE is_active = TRUE
                ORDER BY phase_order DESC
            LOOP
                IF v_text ILIKE '%' || v_mapping.keyword || '%' THEN
                    IF v_mapping.phase_order > v_best_order THEN
                        v_best_order := v_mapping.phase_order;
                        v_best_phase := v_mapping.phase;
                        v_best_status := v_mapping.triggers_status;
                        v_best_keyword := v_mapping.keyword;
                    END IF;
                END IF;
            END LOOP;

            RETURN QUERY SELECT v_best_phase, v_best_status, v_best_order, v_best_keyword;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] classify_inspection function created')


def create_link_inspection_function(cur):
    """Create function to link inspections to pipeline projects."""
    print('Creating link_inspection_to_pipeline function...')

    # First enable pg_trgm extension for fuzzy matching (may already exist)
    try:
        cur.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    except:
        pass

    cur.execute('''
        CREATE OR REPLACE FUNCTION link_inspection_to_pipeline(p_inspection_id INT)
        RETURNS INT AS $func$
        DECLARE
            v_inspection inspections_raw%ROWTYPE;
            v_pipeline_id INT;
        BEGIN
            SELECT * INTO v_inspection FROM inspections_raw WHERE id = p_inspection_id;

            -- First try: match by permit number through permits_raw -> housing_pipeline
            IF v_inspection.permit_number IS NOT NULL THEN
                -- Try array match if permit_numbers column exists
                SELECT hp.id INTO v_pipeline_id
                FROM housing_pipeline hp
                WHERE v_inspection.permit_number = ANY(hp.permit_numbers)
                LIMIT 1;

                IF v_pipeline_id IS NOT NULL THEN
                    RETURN v_pipeline_id;
                END IF;

                -- Try through permits_raw linkage
                SELECT hp.id INTO v_pipeline_id
                FROM permits_raw pr
                JOIN housing_pipeline hp ON hp.permit_id = pr.id
                WHERE pr.permit_number = v_inspection.permit_number
                AND pr.county_fips = v_inspection.county_fips
                LIMIT 1;

                IF v_pipeline_id IS NOT NULL THEN
                    RETURN v_pipeline_id;
                END IF;
            END IF;

            -- Second try: match by address (fuzzy)
            IF v_inspection.address IS NOT NULL THEN
                SELECT hp.id INTO v_pipeline_id
                FROM housing_pipeline hp
                WHERE hp.state = v_inspection.state
                AND hp.county_fips = v_inspection.county_fips
                AND (
                    hp.project_address ILIKE '%' || v_inspection.address || '%'
                    OR v_inspection.address ILIKE '%' || hp.project_address || '%'
                    OR hp.address ILIKE '%' || v_inspection.address || '%'
                    OR v_inspection.address ILIKE '%' || hp.address || '%'
                )
                LIMIT 1;

                IF v_pipeline_id IS NOT NULL THEN
                    RETURN v_pipeline_id;
                END IF;
            END IF;

            -- Third try: match by parcel ID
            IF v_inspection.parcel_id IS NOT NULL THEN
                SELECT hp.id INTO v_pipeline_id
                FROM housing_pipeline hp
                WHERE hp.parcel_id = v_inspection.parcel_id
                LIMIT 1;

                IF v_pipeline_id IS NOT NULL THEN
                    RETURN v_pipeline_id;
                END IF;
            END IF;

            RETURN NULL;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] link_inspection_to_pipeline function created')


def create_update_pipeline_status_function(cur):
    """Create enhanced pipeline status update function with logging."""
    print('Creating update_pipeline_status function...')

    # Drop old function if exists (may have different signature)
    cur.execute('DROP FUNCTION IF EXISTS update_pipeline_status(INT, VARCHAR, TEXT)')

    cur.execute('''
        CREATE OR REPLACE FUNCTION update_pipeline_status(
            p_pipeline_id INT,
            p_new_status VARCHAR(20),
            p_change_date DATE DEFAULT CURRENT_DATE,
            p_inspection_id INT DEFAULT NULL,
            p_source VARCHAR(50) DEFAULT 'inspection'
        )
        RETURNS VOID AS $func$
        DECLARE
            v_old_status VARCHAR(20);
        BEGIN
            -- Get current status
            SELECT status INTO v_old_status FROM housing_pipeline WHERE id = p_pipeline_id;

            -- Skip if no change
            IF v_old_status = p_new_status THEN
                RETURN;
            END IF;

            -- Update pipeline
            UPDATE housing_pipeline SET
                status = p_new_status,
                status_color = CASE p_new_status
                    WHEN 'permitted' THEN 'green'
                    WHEN 'site_work' THEN 'yellow'
                    WHEN 'vertical' THEN 'red'
                    WHEN 'existing' THEN 'black'
                    ELSE status_color
                END,
                site_work_date = CASE WHEN p_new_status = 'site_work' AND site_work_date IS NULL THEN p_change_date ELSE site_work_date END,
                vertical_date = CASE WHEN p_new_status = 'vertical' AND vertical_date IS NULL THEN p_change_date ELSE vertical_date END,
                completion_date = CASE WHEN p_new_status = 'existing' AND completion_date IS NULL THEN p_change_date ELSE completion_date END,
                updated_at = NOW()
            WHERE id = p_pipeline_id;

            -- Log the change
            INSERT INTO pipeline_status_log (pipeline_id, old_status, new_status, trigger_inspection_id, trigger_source)
            VALUES (p_pipeline_id, v_old_status, p_new_status, p_inspection_id, p_source);
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] update_pipeline_status function created')


def create_process_inspections_function(cur):
    """Create batch inspection processing function."""
    print('Creating process_inspections function...')

    cur.execute('''
        CREATE OR REPLACE FUNCTION process_inspections()
        RETURNS TABLE(
            total_processed INT,
            linked_to_pipeline INT,
            status_updates INT,
            unlinked INT
        ) AS $func$
        DECLARE
            v_inspection RECORD;
            v_classification RECORD;
            v_pipeline_id INT;
            v_current_status VARCHAR(20);
            v_current_order INT;
            v_total INT := 0;
            v_linked INT := 0;
            v_updated INT := 0;
            v_unlinked INT := 0;
        BEGIN
            FOR v_inspection IN
                SELECT * FROM inspections_raw
                WHERE is_processed = FALSE
                AND LOWER(result) IN ('passed', 'approved', 'pass', 'complete', 'completed')
            LOOP
                v_total := v_total + 1;

                -- Classify the inspection
                SELECT * INTO v_classification FROM classify_inspection(v_inspection.id);

                -- Try to link to pipeline
                v_pipeline_id := link_inspection_to_pipeline(v_inspection.id);

                IF v_pipeline_id IS NOT NULL THEN
                    v_linked := v_linked + 1;

                    -- Get current pipeline status
                    SELECT status INTO v_current_status FROM housing_pipeline WHERE id = v_pipeline_id;

                    -- Determine current status order
                    v_current_order := CASE v_current_status
                        WHEN 'permitted' THEN 0
                        WHEN 'site_work' THEN 3
                        WHEN 'vertical' THEN 5
                        WHEN 'existing' THEN 9
                        ELSE 0
                    END;

                    -- Only update if new status is further along
                    IF v_classification.phase_order IS NOT NULL
                       AND v_classification.phase_order > v_current_order
                       AND v_classification.triggers_status IS NOT NULL THEN

                        PERFORM update_pipeline_status(
                            v_pipeline_id,
                            v_classification.triggers_status,
                            v_inspection.inspection_date,
                            v_inspection.id,
                            'inspection'
                        );

                        v_updated := v_updated + 1;

                        -- Mark as status trigger
                        UPDATE inspections_raw SET
                            is_status_trigger = TRUE,
                            triggered_status = v_classification.triggers_status
                        WHERE id = v_inspection.id;
                    END IF;

                    -- Update inspection with linkage
                    UPDATE inspections_raw SET
                        is_processed = TRUE,
                        pipeline_id = v_pipeline_id
                    WHERE id = v_inspection.id;
                ELSE
                    v_unlinked := v_unlinked + 1;
                    UPDATE inspections_raw SET is_processed = TRUE WHERE id = v_inspection.id;
                END IF;
            END LOOP;

            RETURN QUERY SELECT v_total, v_linked, v_updated, v_unlinked;
        END;
        $func$ LANGUAGE plpgsql;
    ''')

    print('  [OK] process_inspections function created')


def create_views(cur):
    """Create inspection tracking views."""
    print('Creating views...')

    # Drop existing views first
    views_to_drop = [
        'v_pipeline_inspection_history',
        'v_pipeline_timeline',
        'v_inspections_unlinked',
        'v_recent_status_changes',
        'v_county_inspection_activity'
    ]
    for view in views_to_drop:
        cur.execute(f'DROP VIEW IF EXISTS {view}')

    # Pipeline inspection history view
    cur.execute('''
        CREATE VIEW v_pipeline_inspection_history AS
        SELECT
            hp.id as pipeline_id,
            hp.project_name,
            hp.status as current_status,
            hp.status_color,
            ir.inspection_number,
            ir.inspection_type,
            ir.inspection_category,
            ir.inspection_date,
            ir.result,
            ir.is_status_trigger,
            ir.triggered_status,
            CASE
                WHEN ir.is_status_trigger THEN '[TRIGGER]'
                WHEN LOWER(ir.result) IN ('passed', 'approved', 'pass') THEN '[PASS]'
                WHEN LOWER(ir.result) IN ('failed', 'fail') THEN '[FAIL]'
                ELSE '[PENDING]'
            END as result_icon,
            ir.result_comments
        FROM housing_pipeline hp
        LEFT JOIN inspections_raw ir ON ir.pipeline_id = hp.id
        WHERE ir.id IS NOT NULL
        ORDER BY hp.id, ir.inspection_date DESC
    ''')

    # Pipeline timeline view
    cur.execute('''
        CREATE VIEW v_pipeline_timeline AS
        SELECT
            id,
            project_name,
            county_name,
            housing_type,
            unit_count as total_units,
            status,
            status_color,
            CASE status
                WHEN 'permitted' THEN '[GREEN]'
                WHEN 'site_work' THEN '[YELLOW]'
                WHEN 'vertical' THEN '[RED]'
                WHEN 'existing' THEN '[BLACK]'
            END as status_icon,
            permit_date,
            site_work_date,
            vertical_date,
            completion_date,
            CASE WHEN site_work_date IS NOT NULL
                 THEN site_work_date - permit_date
                 WHEN permit_date IS NOT NULL THEN CURRENT_DATE - permit_date
                 ELSE NULL
            END as days_permitted,
            CASE WHEN vertical_date IS NOT NULL AND site_work_date IS NOT NULL
                 THEN vertical_date - site_work_date
                 WHEN site_work_date IS NOT NULL
                 THEN CURRENT_DATE - site_work_date
                 ELSE NULL
            END as days_site_work,
            CASE WHEN completion_date IS NOT NULL AND vertical_date IS NOT NULL
                 THEN completion_date - vertical_date
                 WHEN vertical_date IS NOT NULL
                 THEN CURRENT_DATE - vertical_date
                 ELSE NULL
            END as days_vertical,
            CASE WHEN completion_date IS NOT NULL AND permit_date IS NOT NULL
                 THEN completion_date - permit_date
                 WHEN permit_date IS NOT NULL THEN CURRENT_DATE - permit_date
                 ELSE NULL
            END as total_days
        FROM housing_pipeline
        ORDER BY
            CASE status
                WHEN 'vertical' THEN 1
                WHEN 'site_work' THEN 2
                WHEN 'permitted' THEN 3
                WHEN 'existing' THEN 4
            END,
            permit_date DESC
    ''')

    # Inspections needing review (passed but not linked)
    cur.execute('''
        CREATE VIEW v_inspections_unlinked AS
        SELECT
            ir.id,
            ir.county_name,
            ir.permit_number,
            ir.address,
            ir.inspection_type,
            ir.inspection_date,
            ir.result,
            itm.triggers_status as would_trigger
        FROM inspections_raw ir
        LEFT JOIN inspection_type_mapping itm ON
            LOWER(ir.inspection_type) ILIKE '%' || itm.keyword || '%'
        WHERE ir.is_processed = TRUE
        AND ir.pipeline_id IS NULL
        AND LOWER(ir.result) IN ('passed', 'approved', 'pass')
        AND itm.triggers_status IS NOT NULL
        ORDER BY ir.inspection_date DESC
    ''')

    # Recent status changes
    cur.execute('''
        CREATE VIEW v_recent_status_changes AS
        SELECT
            psl.changed_at,
            hp.project_name,
            hp.county_name,
            psl.old_status,
            psl.new_status,
            CASE psl.new_status
                WHEN 'permitted' THEN '[GREEN]'
                WHEN 'site_work' THEN '[YELLOW]'
                WHEN 'vertical' THEN '[RED]'
                WHEN 'existing' THEN '[BLACK]'
            END as new_status_icon,
            hp.unit_count as total_units,
            psl.trigger_source,
            ir.inspection_type
        FROM pipeline_status_log psl
        JOIN housing_pipeline hp ON hp.id = psl.pipeline_id
        LEFT JOIN inspections_raw ir ON ir.id = psl.trigger_inspection_id
        ORDER BY psl.changed_at DESC
        LIMIT 50
    ''')

    # County inspection activity
    cur.execute('''
        CREATE VIEW v_county_inspection_activity AS
        SELECT
            county_name,
            COUNT(*) as total_inspections,
            SUM(CASE WHEN LOWER(result) IN ('passed', 'approved', 'pass') THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN LOWER(result) IN ('failed', 'fail') THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN is_status_trigger THEN 1 ELSE 0 END) as status_triggers,
            SUM(CASE WHEN pipeline_id IS NOT NULL THEN 1 ELSE 0 END) as linked_to_pipeline,
            MIN(inspection_date) as earliest,
            MAX(inspection_date) as latest
        FROM inspections_raw
        WHERE is_processed = TRUE
        GROUP BY county_name
        ORDER BY county_name
    ''')

    print('  [OK] Views created')


def insert_sample_data(cur):
    """Insert sample inspection data for testing."""
    print('Inserting sample inspection data...')

    # First, update existing pipeline records with permit numbers for matching
    cur.execute('''
        UPDATE housing_pipeline hp
        SET permit_numbers = ARRAY[pr.permit_number],
            primary_permit_id = pr.id
        FROM permits_raw pr
        WHERE hp.permit_id = pr.id
        AND hp.permit_numbers IS NULL
    ''')

    sample_inspections = [
        # Berkeley County inspections - match to BP-2024-001 (single family)
        ('WV', '54003', 'Berkeley', 'BP-2024-001', 'INS-001', 'Grading', 'site', '2024-07-15', 'passed'),
        ('WV', '54003', 'Berkeley', 'BP-2024-001', 'INS-002', 'Footing', 'building', '2024-08-01', 'passed'),
        ('WV', '54003', 'Berkeley', 'BP-2024-001', 'INS-003', 'Foundation', 'building', '2024-08-20', 'passed'),
        ('WV', '54003', 'Berkeley', 'BP-2024-001', 'INS-004', 'Framing', 'building', '2024-09-15', 'passed'),

        # Berkeley County inspections - match to BP-2024-002 (apartments)
        ('WV', '54003', 'Berkeley', 'BP-2024-002', 'INS-005', 'Erosion Control', 'site', '2024-08-01', 'passed'),
        ('WV', '54003', 'Berkeley', 'BP-2024-002', 'INS-006', 'Footing', 'building', '2024-08-25', 'passed'),

        # Jefferson County inspections - match to JP-2024-101 (single family)
        ('WV', '54037', 'Jefferson', 'JP-2024-101', 'INS-007', 'Foundation', 'building', '2024-06-15', 'passed'),
        ('WV', '54037', 'Jefferson', 'JP-2024-101', 'INS-008', 'Framing', 'building', '2024-07-20', 'passed'),
        ('WV', '54037', 'Jefferson', 'JP-2024-101', 'INS-009', 'Rough Electrical', 'electrical', '2024-08-15', 'passed'),
        ('WV', '54037', 'Jefferson', 'JP-2024-101', 'INS-010', 'Final Building', 'building', '2024-10-01', 'passed'),

        # Jefferson County - subdivision plat (JP-2024-102) - site work only
        ('WV', '54037', 'Jefferson', 'JP-2024-102', 'INS-011', 'Grading', 'site', '2024-07-01', 'passed'),
        ('WV', '54037', 'Jefferson', 'JP-2024-102', 'INS-012', 'Stormwater', 'site', '2024-07-15', 'passed'),

        # Jefferson County - senior living (JP-2024-103) - still permitted
        ('WV', '54037', 'Jefferson', 'JP-2024-103', 'INS-013', 'Erosion Control', 'site', '2024-10-01', 'passed'),
    ]

    for insp in sample_inspections:
        cur.execute('''
            INSERT INTO inspections_raw (
                state, county_fips, county_name, permit_number, inspection_number,
                inspection_type, inspection_category, inspection_date, result
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (state, county_fips, inspection_number) DO NOTHING
        ''', insp)

    print('  [OK] Sample inspections inserted (13 inspections)')


def run_test(cur):
    """Run inspection processing test."""
    print('\nRunning inspection processing test...')

    # Process all inspections
    cur.execute('SELECT * FROM process_inspections()')
    result = cur.fetchone()
    print(f'  Processed: {result[0]} total')
    print(f'  Linked to pipeline: {result[1]}')
    print(f'  Status updates triggered: {result[2]}')
    print(f'  Unlinked: {result[3]}')

    # Show pipeline status distribution
    print('\nPipeline status distribution:')
    cur.execute('''
        SELECT
            status,
            CASE status
                WHEN 'permitted' THEN '[GREEN]'
                WHEN 'site_work' THEN '[YELLOW]'
                WHEN 'vertical' THEN '[RED]'
                WHEN 'existing' THEN '[BLACK]'
            END as icon,
            COUNT(*) as projects,
            SUM(unit_count) as units
        FROM housing_pipeline
        GROUP BY status
        ORDER BY
            CASE status
                WHEN 'vertical' THEN 1
                WHEN 'site_work' THEN 2
                WHEN 'permitted' THEN 3
                WHEN 'existing' THEN 4
            END
    ''')
    for row in cur.fetchall():
        print(f'  {row[1]} {row[0]}: {row[2]} projects, {row[3] or 0} units')

    # Show recent status changes
    print('\nRecent status changes:')
    cur.execute('SELECT * FROM v_recent_status_changes LIMIT 10')
    for row in cur.fetchall():
        print(f'  {row[1]}: {row[3]} -> {row[4]} {row[5]}')
        if row[8]:
            print(f'    Triggered by: {row[8]}')

    # Show timeline
    print('\nPipeline timeline:')
    cur.execute('SELECT project_name, county_name, status_icon, status, total_units, days_permitted FROM v_pipeline_timeline')
    for row in cur.fetchall():
        print(f'  {row[2]} {row[0]} ({row[1]}): {row[4] or "?"} units, {row[5] or "?"} days since permit')


def main():
    conn = psycopg2.connect(CONNECTION_STRING)
    conn.autocommit = True
    cur = conn.cursor()

    print('='*70)
    print('PROMPT 13: INSPECTION TRACKING')
    print('='*70)

    # Update housing_pipeline first
    update_housing_pipeline_table(cur)

    # Create tables
    create_inspections_raw_table(cur)
    create_inspection_type_mapping_table(cur)
    create_pipeline_status_log_table(cur)

    # Create functions
    create_classify_inspection_function(cur)
    create_link_inspection_function(cur)
    create_update_pipeline_status_function(cur)
    create_process_inspections_function(cur)

    # Create views
    create_views(cur)

    # Insert sample data and test
    insert_sample_data(cur)
    run_test(cur)

    print('\n' + '='*70)
    print('SETUP COMPLETE')
    print('='*70)
    print('\nTables created:')
    print('  - inspections_raw')
    print('  - inspection_type_mapping (42 mappings)')
    print('  - pipeline_status_log')
    print('\nFunctions created:')
    print('  - classify_inspection(inspection_id)')
    print('  - link_inspection_to_pipeline(inspection_id)')
    print('  - update_pipeline_status(pipeline_id, status, date, inspection_id, source)')
    print('  - process_inspections()')
    print('\nViews created:')
    print('  - v_pipeline_inspection_history')
    print('  - v_pipeline_timeline')
    print('  - v_inspections_unlinked')
    print('  - v_recent_status_changes')
    print('  - v_county_inspection_activity')
    print('\nStatus flow:')
    print('  [GREEN] permitted -> [YELLOW] site_work -> [RED] vertical -> [BLACK] existing')

    conn.close()


if __name__ == '__main__':
    main()
