"""
Create pass2 schema with 6 jurisdiction tables in Neon
Matches Claude Code database specification exactly.

CCA Doctrine: "Claude thinks. Neon remembers. Lovable orchestrates."

Purpose: WHAT is true about a jurisdiction. Facts + Provenance only.
Key Doctrine:
  - Tables store FACTS, not pipeline hints
  - Unknown is valid everywhere (incremental hydration)
  - REQUIRED_FOR_ENVELOPE enforced at view/function level only
  - All tables FK to ref.county_capability(county_id)
"""
import psycopg2

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def create_schema():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()

    print("=" * 60)
    print("PHASE 2: Creating pass2 schema (6 Jurisdiction Tables)")
    print("=" * 60)

    # =========================================================================
    # STEP 1: Create pass2 schema
    # =========================================================================
    print("\n[1/10] Creating pass2 schema...")
    cur.execute("CREATE SCHEMA IF NOT EXISTS pass2")
    conn.commit()

    # =========================================================================
    # STEP 2: Create ENUM types in pass2 schema
    # =========================================================================
    print("[2/10] Creating ENUM types...")
    
    # Drop existing types if they exist (for idempotency)
    enums = ['ternary', 'knowledge_state', 'source_type', 'authority_scope', 
             'authority_model', 'zoning_model', 'asset_class']
    for enum in enums:
        cur.execute(f"DROP TYPE IF EXISTS pass2.{enum} CASCADE")
    conn.commit()
    
    cur.execute("CREATE TYPE pass2.ternary AS ENUM ('yes', 'no', 'unknown')")
    cur.execute("CREATE TYPE pass2.knowledge_state AS ENUM ('known', 'unknown', 'blocked')")
    cur.execute("CREATE TYPE pass2.source_type AS ENUM ('ordinance', 'pdf', 'portal', 'human')")
    cur.execute("CREATE TYPE pass2.authority_scope AS ENUM ('county', 'municipal', 'fire_district', 'state')")
    cur.execute("CREATE TYPE pass2.authority_model AS ENUM ('county', 'municipal', 'mixed', 'none')")
    cur.execute("CREATE TYPE pass2.zoning_model AS ENUM ('no_zoning', 'county', 'municipal', 'mixed')")
    cur.execute("CREATE TYPE pass2.asset_class AS ENUM ('self_storage', 'rv_storage', 'trailer_yard', 'boat_storage', 'other')")
    conn.commit()
    print("  ✓ Created 7 ENUM types")

    # =========================================================================
    # STEP 3: Drop existing tables
    # =========================================================================
    print("[3/10] Dropping existing pass2 tables...")
    tables = ['parking_access', 'stormwater_environmental', 'fire_life_safety',
              'zoning_envelope', 'use_viability', 'jurisdiction_scope']
    for table in tables:
        cur.execute(f"DROP TABLE IF EXISTS pass2.{table} CASCADE")
    conn.commit()

    # =========================================================================
    # TABLE A: pass2.jurisdiction_scope
    # Purpose: Who governs and at what level
    # =========================================================================
    print("[4/10] Creating pass2.jurisdiction_scope...")
    cur.execute("""
        CREATE TABLE pass2.jurisdiction_scope (
            id BIGSERIAL PRIMARY KEY,
            county_id BIGINT NOT NULL REFERENCES ref.county_capability(county_id),
            
            -- Denormalized for convenience
            county_name VARCHAR(100),
            state VARCHAR(2),
            county_fips VARCHAR(5),
            
            -- Asset class
            asset_class pass2.asset_class DEFAULT 'self_storage',
            
            -- Authority model with provenance
            authority_model pass2.authority_model,
            authority_model_state pass2.knowledge_state DEFAULT 'unknown',
            authority_model_source pass2.source_type,
            authority_model_ref TEXT,
            
            -- Zoning model with provenance
            zoning_model pass2.zoning_model,
            zoning_model_state pass2.knowledge_state DEFAULT 'unknown',
            zoning_model_source pass2.source_type,
            zoning_model_ref TEXT,
            
            -- Controlling authority
            controlling_authority_name TEXT,
            controlling_authority_contact TEXT,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            
            UNIQUE(county_id, asset_class)
        )
    """)
    conn.commit()

    # =========================================================================
    # TABLE B: pass2.use_viability
    # Purpose: Binary gating - should we continue?
    # =========================================================================
    print("[5/10] Creating pass2.use_viability...")
    cur.execute("""
        CREATE TABLE pass2.use_viability (
            id BIGSERIAL PRIMARY KEY,
            county_id BIGINT NOT NULL REFERENCES ref.county_capability(county_id),
            
            -- Storage allowed with provenance
            storage_allowed pass2.ternary DEFAULT 'unknown',
            storage_allowed_state pass2.knowledge_state DEFAULT 'unknown',
            storage_allowed_source pass2.source_type,
            storage_allowed_ref TEXT,
            storage_allowed_scope pass2.authority_scope,
            
            -- Fatal prohibition
            fatal_prohibition pass2.ternary DEFAULT 'unknown',
            fatal_prohibition_description TEXT,
            
            -- Conditional use
            conditional_use_required pass2.ternary DEFAULT 'unknown',
            
            -- Discretionary
            discretionary_required pass2.ternary DEFAULT 'unknown',
            
            -- General notes
            general_notes TEXT,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            
            UNIQUE(county_id)
        )
    """)
    conn.commit()

    # =========================================================================
    # TABLE C: pass2.zoning_envelope
    # Purpose: Numeric constraints for geometry. REQUIRED_FOR_ENVELOPE at view level.
    # =========================================================================
    print("[6/10] Creating pass2.zoning_envelope...")
    cur.execute("""
        CREATE TABLE pass2.zoning_envelope (
            id BIGSERIAL PRIMARY KEY,
            county_id BIGINT NOT NULL REFERENCES ref.county_capability(county_id),
            
            -- =================================================================
            -- Setbacks (feet) - REQUIRED_FOR_ENVELOPE
            -- =================================================================
            setback_front NUMERIC(8,2),
            setback_front_state pass2.knowledge_state DEFAULT 'unknown',
            setback_front_source pass2.source_type,
            setback_front_ref TEXT,
            
            setback_side NUMERIC(8,2),
            setback_side_state pass2.knowledge_state DEFAULT 'unknown',
            setback_side_source pass2.source_type,
            setback_side_ref TEXT,
            
            setback_rear NUMERIC(8,2),
            setback_rear_state pass2.knowledge_state DEFAULT 'unknown',
            setback_rear_source pass2.source_type,
            setback_rear_ref TEXT,
            
            -- =================================================================
            -- Coverage / Intensity
            -- =================================================================
            max_lot_coverage NUMERIC(5,2),  -- percentage - REQUIRED_FOR_ENVELOPE
            max_lot_coverage_state pass2.knowledge_state DEFAULT 'unknown',
            max_lot_coverage_source pass2.source_type,
            max_lot_coverage_ref TEXT,
            
            max_far NUMERIC(5,2),
            max_far_state pass2.knowledge_state DEFAULT 'unknown',
            max_far_source pass2.source_type,
            max_far_ref TEXT,
            
            min_open_space NUMERIC(5,2),  -- percentage
            min_open_space_state pass2.knowledge_state DEFAULT 'unknown',
            min_open_space_source pass2.source_type,
            min_open_space_ref TEXT,
            
            max_height NUMERIC(8,2),  -- feet - REQUIRED_FOR_ENVELOPE
            max_height_state pass2.knowledge_state DEFAULT 'unknown',
            max_height_source pass2.source_type,
            max_height_ref TEXT,
            
            max_stories SMALLINT,
            max_stories_state pass2.knowledge_state DEFAULT 'unknown',
            max_stories_source pass2.source_type,
            max_stories_ref TEXT,
            
            -- =================================================================
            -- Buffers (feet)
            -- =================================================================
            buffer_residential NUMERIC(8,2),
            buffer_residential_state pass2.knowledge_state DEFAULT 'unknown',
            buffer_residential_source pass2.source_type,
            buffer_residential_ref TEXT,
            
            buffer_waterway NUMERIC(8,2),
            buffer_waterway_state pass2.knowledge_state DEFAULT 'unknown',
            buffer_waterway_source pass2.source_type,
            buffer_waterway_ref TEXT,
            
            buffer_roadway NUMERIC(8,2),
            buffer_roadway_state pass2.knowledge_state DEFAULT 'unknown',
            buffer_roadway_source pass2.source_type,
            buffer_roadway_ref TEXT,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            
            UNIQUE(county_id)
        )
    """)
    conn.commit()

    # =========================================================================
    # TABLE D: pass2.fire_life_safety
    # Purpose: Fire and life safety constraints
    # =========================================================================
    print("[7/10] Creating pass2.fire_life_safety...")
    cur.execute("""
        CREATE TABLE pass2.fire_life_safety (
            id BIGSERIAL PRIMARY KEY,
            county_id BIGINT NOT NULL REFERENCES ref.county_capability(county_id),
            
            fire_lane_required pass2.ternary DEFAULT 'unknown',
            fire_lane_required_state pass2.knowledge_state DEFAULT 'unknown',
            fire_lane_required_source pass2.source_type,
            fire_lane_required_ref TEXT,
            
            min_fire_lane_width NUMERIC(6,2),  -- feet
            min_fire_lane_width_state pass2.knowledge_state DEFAULT 'unknown',
            min_fire_lane_width_source pass2.source_type,
            min_fire_lane_width_ref TEXT,
            
            max_hydrant_spacing NUMERIC(8,2),  -- feet
            max_hydrant_spacing_state pass2.knowledge_state DEFAULT 'unknown',
            max_hydrant_spacing_source pass2.source_type,
            max_hydrant_spacing_ref TEXT,
            
            fire_dept_access_required pass2.ternary DEFAULT 'unknown',
            fire_dept_access_required_state pass2.knowledge_state DEFAULT 'unknown',
            fire_dept_access_required_source pass2.source_type,
            fire_dept_access_required_ref TEXT,
            
            sprinkler_required pass2.ternary DEFAULT 'unknown',
            sprinkler_required_state pass2.knowledge_state DEFAULT 'unknown',
            sprinkler_required_source pass2.source_type,
            sprinkler_required_ref TEXT,
            
            adopted_fire_code VARCHAR(50),
            adopted_fire_code_state pass2.knowledge_state DEFAULT 'unknown',
            adopted_fire_code_source pass2.source_type,
            adopted_fire_code_ref TEXT,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            
            UNIQUE(county_id)
        )
    """)
    conn.commit()

    # =========================================================================
    # TABLE E: pass2.stormwater_environmental
    # Purpose: Stormwater and environmental constraints
    # =========================================================================
    print("[8/10] Creating pass2.stormwater_environmental...")
    cur.execute("""
        CREATE TABLE pass2.stormwater_environmental (
            id BIGSERIAL PRIMARY KEY,
            county_id BIGINT NOT NULL REFERENCES ref.county_capability(county_id),
            
            detention_required pass2.ternary DEFAULT 'unknown',
            detention_required_state pass2.knowledge_state DEFAULT 'unknown',
            detention_required_source pass2.source_type,
            detention_required_ref TEXT,
            
            retention_required pass2.ternary DEFAULT 'unknown',
            retention_required_state pass2.knowledge_state DEFAULT 'unknown',
            retention_required_source pass2.source_type,
            retention_required_ref TEXT,
            
            max_impervious NUMERIC(5,2),  -- percentage
            max_impervious_state pass2.knowledge_state DEFAULT 'unknown',
            max_impervious_source pass2.source_type,
            max_impervious_ref TEXT,
            
            watershed_overlay pass2.ternary DEFAULT 'unknown',
            watershed_overlay_state pass2.knowledge_state DEFAULT 'unknown',
            watershed_overlay_source pass2.source_type,
            watershed_overlay_ref TEXT,
            
            floodplain_overlay pass2.ternary DEFAULT 'unknown',
            floodplain_overlay_state pass2.knowledge_state DEFAULT 'unknown',
            floodplain_overlay_source pass2.source_type,
            floodplain_overlay_ref TEXT,
            
            environmental_notes TEXT,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            
            UNIQUE(county_id)
        )
    """)
    conn.commit()

    # =========================================================================
    # TABLE F: pass2.parking_access
    # Purpose: Parking and access requirements
    # =========================================================================
    print("[9/10] Creating pass2.parking_access...")
    cur.execute("""
        CREATE TABLE pass2.parking_access (
            id BIGSERIAL PRIMARY KEY,
            county_id BIGINT NOT NULL REFERENCES ref.county_capability(county_id),
            
            parking_required pass2.ternary DEFAULT 'unknown',
            parking_required_state pass2.knowledge_state DEFAULT 'unknown',
            parking_required_source pass2.source_type,
            parking_required_ref TEXT,
            
            parking_ratio NUMERIC(8,4),
            parking_ratio_state pass2.knowledge_state DEFAULT 'unknown',
            parking_ratio_source pass2.source_type,
            parking_ratio_ref TEXT,
            
            parking_ratio_unit VARCHAR(20),  -- e.g., 'per 1000 sqft'
            
            truck_access_required pass2.ternary DEFAULT 'unknown',
            truck_access_required_state pass2.knowledge_state DEFAULT 'unknown',
            truck_access_required_source pass2.source_type,
            truck_access_required_ref TEXT,
            
            min_driveway_width NUMERIC(6,2),  -- feet
            min_driveway_width_state pass2.knowledge_state DEFAULT 'unknown',
            min_driveway_width_source pass2.source_type,
            min_driveway_width_ref TEXT,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            
            UNIQUE(county_id)
        )
    """)
    conn.commit()

    # =========================================================================
    # STEP 10: Create views and functions
    # =========================================================================
    print("[10/10] Creating views and helper functions...")
    
    # Create pass2.v_jurisdiction_card_for_pass3 view
    cur.execute("""
        CREATE OR REPLACE VIEW pass2.v_jurisdiction_card_for_pass3 AS
        SELECT
            cc.county_id,
            cc.state,
            cc.county_name,
            cc.county_fips,
            
            -- Scope
            js.authority_model,
            js.authority_model_state,
            js.zoning_model,
            js.zoning_model_state,
            js.controlling_authority_name,
            
            -- Viability
            uv.storage_allowed,
            uv.storage_allowed_state,
            uv.fatal_prohibition,
            uv.fatal_prohibition_description,
            uv.conditional_use_required,
            uv.discretionary_required,
            
            -- Envelope (REQUIRED_FOR_ENVELOPE fields)
            ze.setback_front,
            ze.setback_front_state,
            ze.setback_side,
            ze.setback_side_state,
            ze.setback_rear,
            ze.setback_rear_state,
            ze.max_lot_coverage,
            ze.max_lot_coverage_state,
            ze.max_height,
            ze.max_height_state,
            ze.max_stories,
            ze.max_far,
            ze.buffer_residential,
            ze.buffer_waterway,
            ze.buffer_roadway,
            
            -- Fire/Life Safety
            fls.fire_lane_required,
            fls.min_fire_lane_width,
            fls.sprinkler_required,
            fls.adopted_fire_code,
            
            -- Stormwater
            se.detention_required,
            se.retention_required,
            se.max_impervious,
            se.watershed_overlay,
            se.floodplain_overlay,
            
            -- Parking
            pa.parking_required,
            pa.parking_ratio,
            pa.parking_ratio_unit,
            pa.truck_access_required,
            pa.min_driveway_width,
            
            -- COMPUTED: envelope_complete
            (
                ze.setback_front_state = 'known' AND
                ze.setback_side_state = 'known' AND
                ze.setback_rear_state = 'known' AND
                ze.max_lot_coverage_state = 'known' AND
                ze.max_height_state = 'known'
            ) AS envelope_complete,
            
            -- COMPUTED: has_fatal_prohibition
            (uv.fatal_prohibition = 'yes') AS has_fatal_prohibition,
            
            -- COMPUTED: is_storage_allowed
            uv.storage_allowed AS is_storage_allowed
            
        FROM ref.county_capability cc
        LEFT JOIN pass2.jurisdiction_scope js ON js.county_id = cc.county_id
        LEFT JOIN pass2.use_viability uv ON uv.county_id = cc.county_id
        LEFT JOIN pass2.zoning_envelope ze ON ze.county_id = cc.county_id
        LEFT JOIN pass2.fire_life_safety fls ON fls.county_id = cc.county_id
        LEFT JOIN pass2.stormwater_environmental se ON se.county_id = cc.county_id
        LEFT JOIN pass2.parking_access pa ON pa.county_id = cc.county_id
    """)
    conn.commit()
    print("  ✓ Created pass2.v_jurisdiction_card_for_pass3 view")
    
    # Create helper functions
    cur.execute("""
        CREATE OR REPLACE FUNCTION pass2.is_envelope_complete(p_county_id BIGINT)
        RETURNS BOOLEAN AS $$
        DECLARE
            v_complete BOOLEAN;
        BEGIN
            SELECT envelope_complete INTO v_complete
            FROM pass2.v_jurisdiction_card_for_pass3
            WHERE county_id = p_county_id;
            
            RETURN COALESCE(v_complete, FALSE);
        END;
        $$ LANGUAGE plpgsql
    """)
    
    cur.execute("""
        CREATE OR REPLACE FUNCTION pass2.has_fatal_prohibition(p_county_id BIGINT)
        RETURNS BOOLEAN AS $$
        DECLARE
            v_fatal BOOLEAN;
        BEGIN
            SELECT has_fatal_prohibition INTO v_fatal
            FROM pass2.v_jurisdiction_card_for_pass3
            WHERE county_id = p_county_id;
            
            RETURN COALESCE(v_fatal, FALSE);
        END;
        $$ LANGUAGE plpgsql
    """)
    
    cur.execute("""
        CREATE OR REPLACE FUNCTION pass2.is_storage_allowed(p_county_id BIGINT)
        RETURNS pass2.ternary AS $$
        DECLARE
            v_allowed pass2.ternary;
        BEGIN
            SELECT is_storage_allowed INTO v_allowed
            FROM pass2.v_jurisdiction_card_for_pass3
            WHERE county_id = p_county_id;
            
            RETURN COALESCE(v_allowed, 'unknown');
        END;
        $$ LANGUAGE plpgsql
    """)
    conn.commit()
    print("  ✓ Created helper functions: is_envelope_complete, has_fatal_prohibition, is_storage_allowed")

    # Create updated_at triggers for all tables
    for table in ['jurisdiction_scope', 'use_viability', 'zoning_envelope', 
                  'fire_life_safety', 'stormwater_environmental', 'parking_access']:
        cur.execute(f"""
            CREATE OR REPLACE FUNCTION pass2.update_{table}_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = now();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        """)
        cur.execute(f"""
            CREATE TRIGGER trg_{table}_updated_at
            BEFORE UPDATE ON pass2.{table}
            FOR EACH ROW
            EXECUTE FUNCTION pass2.update_{table}_updated_at()
        """)
    conn.commit()
    print("  ✓ Created updated_at triggers for all 6 tables")

    # =========================================================================
    # Summary
    # =========================================================================
    print("\n" + "=" * 60)
    print("✅ PHASE 2 COMPLETE: pass2 schema created with 6 tables")
    print("=" * 60)
    
    print("\nTables created:")
    for table in tables[::-1]:  # Reverse to show in creation order
        cur.execute(f"""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'pass2' AND table_name = '{table}'
        """)
        col_count = cur.fetchone()[0]
        print(f"  • pass2.{table}: {col_count} columns")

    print("\nViews created:")
    print("  • pass2.v_jurisdiction_card_for_pass3")
    
    print("\nFunctions created:")
    print("  • pass2.is_envelope_complete(county_id)")
    print("  • pass2.has_fatal_prohibition(county_id)")
    print("  • pass2.is_storage_allowed(county_id)")

    cur.close()
    conn.close()

if __name__ == "__main__":
    create_schema()
