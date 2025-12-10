#!/usr/bin/env python3
"""
Create county_data_connections table to track data pipeline connections per county.
This tracks HOW we connect to each county's systems, what works, and what doesn't.
"""

from neon_db_utils import NeonDB

CREATE_TABLE_SQL = """
-- Drop if exists for clean recreation
DROP TABLE IF EXISTS county_data_connections CASCADE;

-- Create the county data connections registry
CREATE TABLE county_data_connections (
    id SERIAL PRIMARY KEY,

    -- County identification
    county_fips VARCHAR(5) NOT NULL UNIQUE,
    county_name VARCHAR(100) NOT NULL,
    state_code VARCHAR(2) NOT NULL,

    -- Connection status per data type
    housing_status VARCHAR(20) DEFAULT 'unknown',  -- working, partial, blocked, manual, unknown
    permits_status VARCHAR(20) DEFAULT 'unknown',
    inspections_status VARCHAR(20) DEFAULT 'unknown',
    gis_status VARCHAR(20) DEFAULT 'unknown',

    -- Permit portal details
    permits_url VARCHAR(500),
    permits_platform VARCHAR(100),  -- Tyler EnerGov, MGO Connect, OneStop, Custom, etc.
    permits_method VARCHAR(50),     -- api, scraper, selenium, manual, pdf_parse
    permits_auth_required BOOLEAN DEFAULT FALSE,
    permits_notes TEXT,

    -- Inspection portal details
    inspections_url VARCHAR(500),
    inspections_platform VARCHAR(100),
    inspections_method VARCHAR(50),
    inspections_linked_by VARCHAR(50),  -- permit_number, address, parcel_id
    inspections_notes TEXT,

    -- GIS portal details
    gis_url VARCHAR(500),
    gis_platform VARCHAR(100),  -- ArcGIS, MapBlock, Vision, Custom, etc.
    gis_has_zoning BOOLEAN DEFAULT FALSE,
    gis_has_parcels BOOLEAN DEFAULT FALSE,
    gis_downloadable BOOLEAN DEFAULT FALSE,
    gis_notes TEXT,

    -- Data counts (current state)
    housing_record_count INTEGER DEFAULT 0,
    permits_record_count INTEGER DEFAULT 0,
    inspections_record_count INTEGER DEFAULT 0,

    -- Testing metadata
    last_tested TIMESTAMP,
    last_successful_pull TIMESTAMP,
    test_error_message TEXT,

    -- Overall assessment
    overall_status VARCHAR(20) DEFAULT 'unknown',  -- ready, partial, blocked, manual
    overall_pct INTEGER DEFAULT 0,  -- 0-100 connectivity percentage
    priority VARCHAR(10) DEFAULT 'medium',  -- high, medium, low

    -- Audit fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

-- Create indexes
CREATE INDEX idx_county_connections_state ON county_data_connections(state_code);
CREATE INDEX idx_county_connections_status ON county_data_connections(overall_status);
CREATE INDEX idx_county_connections_priority ON county_data_connections(priority);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_county_connections_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_county_connections_updated
    BEFORE UPDATE ON county_data_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_county_connections_timestamp();

-- Insert initial county data based on our research
INSERT INTO county_data_connections (
    county_fips, county_name, state_code,
    housing_status, permits_status, inspections_status, gis_status,
    permits_url, permits_platform, permits_method,
    inspections_url, inspections_linked_by,
    gis_url, gis_platform, gis_has_zoning, gis_has_parcels,
    housing_record_count,
    overall_status, overall_pct, priority, notes
) VALUES
-- Frederick County, VA
('51069', 'Frederick', 'VA',
 'working', 'blocked', 'blocked', 'blocked',
 'https://energov.frederickcountyva.gov', 'Tyler EnerGov', 'selenium',
 'https://energov.frederickcountyva.gov', 'permit_number',
 'https://gis.fcva.us', 'ArcGIS', true, true,
 98,
 'partial', 25, 'high',
 'DNS fails for energov and gis portals. Alternative: fcva.us PDF reports. Housing data from Google Places API.'),

-- Berkeley County, WV
('54003', 'Berkeley', 'WV',
 'working', 'working', 'working', 'working',
 'https://onestop.berkeleywv.org', 'OneStop', 'scraper',
 'https://onestop.berkeleywv.org', 'permit_number',
 'https://maps.berkeleywv.org/berkeleyonline', 'Custom', true, true,
 0,
 'ready', 100, 'high',
 'Full connectivity. BeautifulSoup scraper ready for permits and inspections.'),

-- Jefferson County, WV
('54037', 'Jefferson', 'WV',
 'working', 'working', 'working', 'working',
 'https://mgoconnect.org/cp?JID=171', 'MGO Connect', 'api',
 'https://mgoconnect.org/cp?JID=171', 'permit_number',
 'https://od-jcwvgis.opendata.arcgis.com', 'ArcGIS Open Data', true, true,
 0,
 'ready', 100, 'high',
 'Full connectivity. MGO Connect likely has JSON API. GIS has downloadable data.'),

-- Frederick County, MD
('24021', 'Frederick', 'MD',
 'working', 'working', 'partial', 'blocked',
 'https://www.frederickcountymd.gov/7974/Permits-and-Inspections', 'Custom', 'scraper',
 'https://www.frederickcountymd.gov/7974/Permits-and-Inspections', 'permit_number',
 'https://gis.frederickcountymd.gov', 'ArcGIS', true, true,
 0,
 'partial', 60, 'high',
 'Permit portal working. GIS DNS fails - use MD iMAP as fallback.'),

-- Morgan County, WV
('54065', 'Morgan', 'WV',
 'partial', 'manual', 'manual', 'working',
 NULL, NULL, 'manual',
 NULL, NULL,
 'https://mapwv.gov/parcel', 'MapWV', false, true,
 0,
 'manual', 25, 'medium',
 'No online permit system. County-level zoning. Use state MapWV for parcels.'),

-- Warren County, VA
('51187', 'Warren', 'VA',
 'partial', 'blocked', 'blocked', 'blocked',
 NULL, 'Custom', 'manual',
 NULL, NULL,
 NULL, NULL, false, false,
 0,
 'blocked', 10, 'medium',
 'Custom permit portal failed tests. GIS 404 error.'),

-- Shenandoah County, VA
('51171', 'Shenandoah', 'VA',
 'partial', 'blocked', 'blocked', 'blocked',
 NULL, 'Custom', 'manual',
 NULL, NULL,
 NULL, NULL, false, false,
 0,
 'blocked', 10, 'medium',
 'Custom permit portal failed tests. GIS 404 error.'),

-- Augusta County, VA
('51015', 'Augusta', 'VA',
 'partial', 'blocked', 'blocked', 'working',
 NULL, 'Custom', 'selenium',
 NULL, NULL,
 NULL, 'ArcGIS', true, true,
 0,
 'partial', 30, 'medium',
 'Permit portal returns 403 - needs browser automation. GIS working.'),

-- Rockingham County, VA
('51165', 'Rockingham', 'VA',
 'partial', 'working', 'partial', 'blocked',
 NULL, 'Custom', 'scraper',
 NULL, 'permit_number',
 NULL, 'ArcGIS', true, true,
 0,
 'partial', 40, 'medium',
 'Permit portal working. GIS DNS fails.');
"""

VIEW_SQL = """
-- Create a view for easy status checking
CREATE OR REPLACE VIEW v_county_connection_status AS
SELECT
    county_fips,
    county_name,
    state_code,
    housing_status,
    permits_status,
    inspections_status,
    gis_status,
    overall_status,
    overall_pct,
    priority,
    CASE
        WHEN permits_status = 'working' AND inspections_status = 'working' THEN 'READY'
        WHEN permits_status = 'working' THEN 'PERMITS ONLY'
        WHEN inspections_status = 'working' THEN 'INSPECTIONS ONLY'
        ELSE 'NEEDS WORK'
    END as pipeline_readiness,
    last_tested,
    notes
FROM county_data_connections
ORDER BY
    CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
    overall_pct DESC;
"""


def main():
    print("Creating county_data_connections table...")

    with NeonDB() as db:
        with db.conn.cursor() as cur:
            # Create table and insert data
            cur.execute(CREATE_TABLE_SQL)
            print("  Table created and initial data inserted")

            # Create view
            cur.execute(VIEW_SQL)
            print("  View v_county_connection_status created")

            # Verify
            cur.execute("SELECT COUNT(*) FROM county_data_connections")
            count = cur.fetchone()[0]
            print(f"\n  Total counties tracked: {count}")

            # Show summary
            cur.execute("""
                SELECT overall_status, COUNT(*) as cnt
                FROM county_data_connections
                GROUP BY overall_status
                ORDER BY cnt DESC
            """)
            print("\n  Status breakdown:")
            for row in cur.fetchall():
                print(f"    {row[0]}: {row[1]}")

            print("\nDone! Query with:")
            print("  SELECT * FROM v_county_connection_status;")


if __name__ == '__main__':
    main()
