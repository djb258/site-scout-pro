"""
Create ref.cca_county_profile table in Neon
CCA Recon Flow: Claude thinks. Neon remembers. Lovable orchestrates.
"""
import psycopg2

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def create_cca_profile_table():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()

    print("Creating ref schema if not exists...")
    cur.execute("CREATE SCHEMA IF NOT EXISTS ref")
    conn.commit()

    print("Dropping existing table if exists...")
    cur.execute("DROP TABLE IF EXISTS ref.cca_county_profile CASCADE")
    conn.commit()

    print("Creating ref.cca_county_profile table...")
    cur.execute("""
        CREATE TABLE ref.cca_county_profile (
            -- Identity (immutable)
            county_id TEXT PRIMARY KEY,
            county_name TEXT NOT NULL,
            state TEXT NOT NULL,
            
            -- Pass-specific methods (set by Claude Code only)
            pass0_method TEXT NOT NULL DEFAULT 'manual',
            pass0_source_url TEXT,
            pass0_automation_confidence NUMERIC(3,2),
            pass0_notes TEXT,
            
            pass2_method TEXT NOT NULL DEFAULT 'manual',
            pass2_source_url TEXT,
            pass2_automation_confidence NUMERIC(3,2),
            pass2_notes TEXT,
            
            -- Metadata
            recon_performed_by TEXT,
            recon_notes TEXT,
            source_evidence JSONB DEFAULT '[]'::jsonb,
            
            -- TTL governance
            verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            ttl_days INTEGER NOT NULL DEFAULT 90,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            
            -- Constraints
            UNIQUE(county_name, state),
            CONSTRAINT valid_pass0_method CHECK (
                pass0_method IN ('scrape_energov', 'scrape_onestop', 'scrape_accela', 'api_permit', 'scrape_custom', 'manual')
            ),
            CONSTRAINT valid_pass2_method CHECK (
                pass2_method IN ('api_zoning', 'scrape_gis', 'pdf_ocr', 'scrape_custom', 'manual')
            ),
            CONSTRAINT valid_recon_source CHECK (
                recon_performed_by IS NULL OR recon_performed_by IN ('claude_code', 'manual_override', 'system')
            )
        )
    """)
    conn.commit()

    print("Creating indexes...")
    cur.execute("CREATE INDEX idx_cca_stale ON ref.cca_county_profile ((verified_at + (ttl_days || ' days')::interval))")
    cur.execute("CREATE INDEX idx_cca_county_state ON ref.cca_county_profile (county_name, state)")
    cur.execute("CREATE INDEX idx_cca_pass0_method ON ref.cca_county_profile (pass0_method)")
    cur.execute("CREATE INDEX idx_cca_pass2_method ON ref.cca_county_profile (pass2_method)")
    conn.commit()

    print("Creating updated_at trigger function...")
    cur.execute("""
        CREATE OR REPLACE FUNCTION ref.update_cca_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    conn.commit()

    cur.execute("""
        CREATE TRIGGER trg_cca_updated_at
        BEFORE UPDATE ON ref.cca_county_profile
        FOR EACH ROW
        EXECUTE FUNCTION ref.update_cca_updated_at()
    """)
    conn.commit()

    print("\n✅ ref.cca_county_profile table created successfully!")
    print("\nTable structure:")
    cur.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'ref' AND table_name = 'cca_county_profile'
        ORDER BY ordinal_position
    """)
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]} (nullable: {row[2]}, default: {row[3]})")

    cur.close()
    conn.close()

if __name__ == "__main__":
    create_cca_profile_table()
