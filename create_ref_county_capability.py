"""
Create ref.county_capability table in Neon
Matches Claude Code database specification exactly.

CCA Doctrine: "Claude thinks. Neon remembers. Lovable orchestrates."

Purpose: Dispatch table. HOW to collect data. TTL-governed. Cross-pass.
"""
import psycopg2

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def create_schema():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()

    print("=" * 60)
    print("PHASE 1: Creating ref.county_capability schema")
    print("=" * 60)

    # =========================================================================
    # STEP 1: Create ref schema if not exists
    # =========================================================================
    print("\n[1/8] Creating ref schema...")
    cur.execute("CREATE SCHEMA IF NOT EXISTS ref")
    conn.commit()

    # =========================================================================
    # STEP 2: Create ENUM types in ref schema
    # =========================================================================
    print("[2/8] Creating ENUM types...")
    
    # Drop existing types if they exist (for idempotency)
    cur.execute("DROP TYPE IF EXISTS ref.automation_method CASCADE")
    cur.execute("DROP TYPE IF EXISTS ref.coverage_level CASCADE")
    cur.execute("DROP TYPE IF EXISTS ref.recon_confidence CASCADE")
    conn.commit()
    
    cur.execute("""
        CREATE TYPE ref.automation_method AS ENUM ('api', 'scrape', 'portal', 'manual')
    """)
    cur.execute("""
        CREATE TYPE ref.coverage_level AS ENUM ('full', 'partial', 'insufficient')
    """)
    cur.execute("""
        CREATE TYPE ref.recon_confidence AS ENUM ('low', 'medium', 'high')
    """)
    conn.commit()
    print("  ✓ Created: ref.automation_method, ref.coverage_level, ref.recon_confidence")

    # =========================================================================
    # STEP 3: Drop existing table (migrate from cca_county_profile if needed)
    # =========================================================================
    print("[3/8] Dropping existing tables...")
    cur.execute("DROP TABLE IF EXISTS ref.county_capability CASCADE")
    cur.execute("DROP TABLE IF EXISTS ref.cca_county_profile CASCADE")
    conn.commit()

    # =========================================================================
    # STEP 4: Create ref.county_capability table
    # =========================================================================
    print("[4/8] Creating ref.county_capability table...")
    cur.execute("""
        CREATE TABLE ref.county_capability (
            -- Primary Key
            id BIGSERIAL PRIMARY KEY,
            
            -- Identity (immutable, unique)
            county_id BIGINT UNIQUE NOT NULL,
            state VARCHAR(2) NOT NULL,
            county_name VARCHAR(100) NOT NULL,
            county_fips VARCHAR(5),
            
            -- =================================================================
            -- Pass 0 Capability (Permits & Inspections)
            -- =================================================================
            pass0_method ref.automation_method NOT NULL DEFAULT 'manual',
            pass0_source_pointer TEXT,
            pass0_coverage ref.coverage_level DEFAULT 'insufficient',
            pass0_notes TEXT,
            pass0_vendor VARCHAR(50),
            pass0_has_api BOOLEAN DEFAULT FALSE,
            pass0_has_portal BOOLEAN DEFAULT FALSE,
            pass0_inspections_linked BOOLEAN,  -- NULL = unknown
            
            -- =================================================================
            -- Pass 2 Capability (Jurisdiction Facts)
            -- =================================================================
            pass2_method ref.automation_method NOT NULL DEFAULT 'manual',
            pass2_source_pointer TEXT,
            pass2_coverage ref.coverage_level DEFAULT 'insufficient',
            pass2_notes TEXT,
            pass2_zoning_model_detected VARCHAR(50),  -- What CCA detected (NOT the fact)
            pass2_ordinance_format VARCHAR(20),  -- 'html', 'pdf_searchable', etc.
            pass2_planning_url TEXT,
            pass2_ordinance_url TEXT,
            pass2_zoning_map_url TEXT,
            
            -- =================================================================
            -- Meta
            -- =================================================================
            confidence ref.recon_confidence DEFAULT 'low',
            evidence_links TEXT[],
            verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            ttl_months SMALLINT NOT NULL DEFAULT 12,
            expires_at TIMESTAMPTZ GENERATED ALWAYS AS (verified_at + (ttl_months || ' months')::interval) STORED,
            version INTEGER NOT NULL DEFAULT 1,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            
            -- Constraints
            UNIQUE(state, county_name)
        )
    """)
    conn.commit()
    print("  ✓ Created ref.county_capability with all Claude Code columns")

    # =========================================================================
    # STEP 5: Create indexes
    # =========================================================================
    print("[5/8] Creating indexes...")
    cur.execute("CREATE INDEX idx_cc_state ON ref.county_capability (state)")
    cur.execute("CREATE INDEX idx_cc_county_fips ON ref.county_capability (county_fips)")
    cur.execute("CREATE INDEX idx_cc_pass0_method ON ref.county_capability (pass0_method)")
    cur.execute("CREATE INDEX idx_cc_pass2_method ON ref.county_capability (pass2_method)")
    cur.execute("CREATE INDEX idx_cc_expires_at ON ref.county_capability (expires_at)")
    cur.execute("CREATE INDEX idx_cc_stale ON ref.county_capability (expires_at) WHERE expires_at <= now()")
    conn.commit()
    print("  ✓ Created 6 indexes")

    # =========================================================================
    # STEP 6: Create updated_at trigger
    # =========================================================================
    print("[6/8] Creating updated_at trigger...")
    cur.execute("""
        CREATE OR REPLACE FUNCTION ref.update_county_capability_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    cur.execute("""
        CREATE TRIGGER trg_county_capability_updated_at
        BEFORE UPDATE ON ref.county_capability
        FOR EACH ROW
        EXECUTE FUNCTION ref.update_county_capability_updated_at()
    """)
    conn.commit()
    print("  ✓ Created updated_at trigger")

    # =========================================================================
    # STEP 7: Create ref.v_cca_dispatch view
    # =========================================================================
    print("[7/8] Creating ref.v_cca_dispatch view...")
    cur.execute("""
        CREATE OR REPLACE VIEW ref.v_cca_dispatch AS
        SELECT
            county_id,
            state,
            county_name,
            county_fips,
            
            -- Pass 0 dispatch info
            pass0_method,
            pass0_coverage,
            pass0_vendor,
            pass0_source_pointer AS pass0_source_url,
            pass0_has_api,
            pass0_has_portal,
            
            -- Pass 2 dispatch info
            pass2_method,
            pass2_coverage,
            pass2_planning_url,
            pass2_ordinance_url,
            pass2_zoning_map_url,
            pass2_source_pointer AS pass2_source_url,
            
            -- TTL status
            confidence,
            verified_at,
            expires_at,
            (expires_at <= now()) AS is_expired,
            (expires_at <= now() + interval '30 days') AS expires_soon,
            EXTRACT(EPOCH FROM (expires_at - now())) / 86400 AS days_until_expiry,
            version
        FROM ref.county_capability
    """)
    conn.commit()
    print("  ✓ Created ref.v_cca_dispatch view")

    # =========================================================================
    # STEP 8: Create ref.needs_refresh() function
    # =========================================================================
    print("[8/8] Creating ref.needs_refresh() function...")
    cur.execute("""
        CREATE OR REPLACE FUNCTION ref.needs_refresh(p_county_id BIGINT)
        RETURNS BOOLEAN AS $$
        DECLARE
            v_expires_at TIMESTAMPTZ;
        BEGIN
            SELECT expires_at INTO v_expires_at
            FROM ref.county_capability
            WHERE county_id = p_county_id;
            
            -- If no profile exists, needs refresh
            IF v_expires_at IS NULL THEN
                RETURN TRUE;
            END IF;
            
            -- If expired, needs refresh
            RETURN v_expires_at <= now();
        END;
        $$ LANGUAGE plpgsql
    """)
    conn.commit()
    print("  ✓ Created ref.needs_refresh() function")

    # =========================================================================
    # Summary
    # =========================================================================
    print("\n" + "=" * 60)
    print("✅ PHASE 1 COMPLETE: ref.county_capability schema created")
    print("=" * 60)
    
    print("\nTable structure:")
    cur.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'ref' AND table_name = 'county_capability'
        ORDER BY ordinal_position
    """)
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]} (nullable: {row[2]})")

    cur.close()
    conn.close()

if __name__ == "__main__":
    create_schema()
