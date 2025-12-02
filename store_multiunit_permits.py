"""
Store multi-unit housing permits in Neon PostgreSQL database
Creates a dedicated table for housing pipeline tracking
"""

import os
import requests
import re
from datetime import datetime
from collections import defaultdict
import psycopg2
from psycopg2.extras import execute_values

# Database connection
CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def get_db_connection():
    return psycopg2.connect(CONNECTION_STRING)

def create_housing_pipeline_table():
    """Create table for tracking multi-unit housing developments"""
    conn = get_db_connection()
    cur = conn.cursor()

    # Create table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS housing_pipeline (
            id SERIAL PRIMARY KEY,
            jurisdiction_id VARCHAR(20) NOT NULL,
            permit_number VARCHAR(50) NOT NULL,
            permit_type VARCHAR(100),
            development_name VARCHAR(200),
            property_address TEXT,
            owner_name VARCHAR(200),
            estimated_value NUMERIC(12,2),
            issue_date DATE,
            report_month VARCHAR(20),
            unit_type VARCHAR(50),
            pipeline_status VARCHAR(20) DEFAULT 'GREEN',
            last_inspection_date DATE,
            last_inspection_type VARCHAR(100),
            days_since_activity INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(jurisdiction_id, permit_number)
        )
    """)
    conn.commit()

    # Create indexes separately
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_housing_pipeline_jurisdiction
        ON housing_pipeline(jurisdiction_id)
    """)
    conn.commit()

    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_housing_pipeline_development
        ON housing_pipeline(development_name)
    """)
    conn.commit()

    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_housing_pipeline_status
        ON housing_pipeline(pipeline_status)
    """)
    conn.commit()

    cur.close()
    conn.close()
    print("Housing pipeline table created/verified")

def extract_permits_from_pdf(pdf_path):
    """Extract multi-unit permits from a Frederick VA permit PDF"""
    from PyPDF2 import PdfReader

    reader = PdfReader(pdf_path)
    all_text = ''
    for page in reader.pages:
        all_text += page.extract_text() + '\n'

    # Find all permit blocks
    permit_blocks = re.split(r'(?=PermitNo\.:\d+-\d+)', all_text)

    # Multi-unit keywords
    multiunit_keywords = [
        'townho', 'town ho', 'townhouse',
        'duplex', 'triplex', 'quadplex',
        'apartment', 'multi-family', 'multifamily',
        'condo', 'condominium',
        'attached'
    ]

    # Exclusion keywords
    exclude_keywords = [
        'single family', 'singlefamily', 'sfh',
        'detached dwelling', 'single-family'
    ]

    # Development patterns
    development_patterns = {
        'STEPHENSON': 'Stephenson Village',
        'LAKE FREDERICK': 'Lake Frederick',
        'PATRIOT': 'Lake Frederick',
        'ABRAMS': 'Abrams Pointe',
        'OPEQUON': 'Opequon Crossing',
        'WILLOW RUN': 'Willow Run',
        'SENSENY': 'Senseny Glen',
        'WINDSTONE': 'Windstone',
        'ZEPHYR': 'Windstone',
        'VALLEYPIKE': 'Valley Pike',
        'VALLEY PIKE': 'Valley Pike',
        'BOWERS': 'Valley Pike',
        'PARK PLACE': 'Park Place Condominiums',
        'BROOKLAND': 'Park Place Condominiums',
        'SHENANDOAH': 'Shenandoah',
        'STONEWALL': 'Stonewall',
        'SNOWDEN': 'Snowden Bridge',
        'CLEARBROOK': 'Clearbrook',
    }

    permits = []

    for block in permit_blocks[1:]:
        block_lower = block.lower()

        # Skip single-family
        is_excluded = any(excl in block_lower for excl in exclude_keywords)
        if is_excluded:
            continue

        # Check for multi-unit keywords
        for kw in multiunit_keywords:
            if kw in block_lower:
                permit_match = re.search(r'PermitNo\.:\s*(\d+-\d+)', block)
                permit_no = permit_match.group(1) if permit_match else None

                if not permit_no:
                    continue

                addr_match = re.search(r'SiteAddress:\s*([^\n]+)', block)
                address = addr_match.group(1).strip() if addr_match else None

                owner_match = re.search(r'OwnerName:\s*([^\n]+)', block)
                owner = owner_match.group(1).strip() if owner_match else None

                type_match = re.search(r'BUILDINGPERMIT([A-Za-z/]+)', block)
                permit_type = type_match.group(1) if type_match else None

                value_match = re.search(r'\$([\d,]+\.?\d*)', block)
                value = None
                if value_match:
                    try:
                        value = float(value_match.group(1).replace(',', ''))
                    except:
                        pass

                # Identify development
                dev_name = "Other"
                if address:
                    address_upper = address.upper().replace(' ', '')
                    for pattern, name in development_patterns.items():
                        if pattern.replace(' ', '') in address_upper:
                            dev_name = name
                            break

                # Determine unit type
                unit_type = 'Unknown'
                if 'duplex' in kw:
                    unit_type = 'Duplex'
                elif 'townho' in kw or 'town ho' in kw:
                    unit_type = 'Townhouse'
                elif 'apartment' in kw or 'multi' in kw:
                    unit_type = 'Apartment'
                elif 'condo' in kw:
                    unit_type = 'Condo'

                permits.append({
                    'permit_number': permit_no,
                    'permit_type': permit_type,
                    'development_name': dev_name,
                    'property_address': address,
                    'owner_name': owner,
                    'estimated_value': value,
                    'unit_type': unit_type
                })
                break

    return permits

def store_permits(permits, report_month):
    """Store permits in database"""
    conn = get_db_connection()
    cur = conn.cursor()

    insert_sql = """
        INSERT INTO housing_pipeline
        (jurisdiction_id, permit_number, permit_type, development_name,
         property_address, owner_name, estimated_value, report_month,
         unit_type, pipeline_status)
        VALUES %s
        ON CONFLICT (jurisdiction_id, permit_number)
        DO UPDATE SET
            permit_type = EXCLUDED.permit_type,
            development_name = EXCLUDED.development_name,
            property_address = EXCLUDED.property_address,
            owner_name = EXCLUDED.owner_name,
            estimated_value = EXCLUDED.estimated_value,
            updated_at = CURRENT_TIMESTAMP
    """

    values = [
        ('VA-FREDERICK', p['permit_number'], p['permit_type'],
         p['development_name'], p['property_address'], p['owner_name'],
         p['estimated_value'], report_month, p['unit_type'], 'GREEN')
        for p in permits
    ]

    execute_values(cur, insert_sql, values)
    conn.commit()

    print(f"Stored {len(permits)} permits for {report_month}")

    cur.close()
    conn.close()

def main():
    print("=" * 70)
    print("HOUSING PIPELINE DATABASE LOADER")
    print("=" * 70)
    print()

    # Create table
    create_housing_pipeline_table()

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    # Download October 2025 report
    url = 'https://www.fcva.us/home/showpublisheddocument/29614/638977571436800000'
    print("Downloading October 2025 permit report...")
    response = session.get(url, timeout=30)

    pdf_path = 'temp_permits.pdf'
    with open(pdf_path, 'wb') as f:
        f.write(response.content)

    # Extract permits
    print("Extracting multi-unit housing permits...")
    permits = extract_permits_from_pdf(pdf_path)
    print(f"Found {len(permits)} multi-unit permits")

    # Store in database
    store_permits(permits, 'October 2025')

    # Clean up
    os.remove(pdf_path)

    # Show summary
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT development_name, COUNT(*), SUM(estimated_value)
        FROM housing_pipeline
        WHERE jurisdiction_id = 'VA-FREDERICK'
        GROUP BY development_name
        ORDER BY COUNT(*) DESC
    """)

    print("\n" + "=" * 70)
    print("DATABASE SUMMARY - Frederick County VA Multi-Unit Housing")
    print("=" * 70)

    for row in cur.fetchall():
        dev_name, count, total_value = row
        value_str = f"${total_value:,.0f}" if total_value else "N/A"
        print(f"  {dev_name}: {count} permits ({value_str})")

    cur.execute("SELECT COUNT(*) FROM housing_pipeline WHERE jurisdiction_id = 'VA-FREDERICK'")
    total = cur.fetchone()[0]
    print(f"\nTotal permits in database: {total}")

    cur.close()
    conn.close()

    print("\n" + "=" * 70)
    print("SUCCESS! Data stored in housing_pipeline table")
    print("=" * 70)

if __name__ == "__main__":
    main()
