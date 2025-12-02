"""
Extract ALL 2025 multi-unit housing permits from Frederick County VA
Downloads and processes all monthly permit reports
"""

import os
import requests
import re
from datetime import datetime
from collections import defaultdict
import psycopg2
from psycopg2.extras import execute_values
from bs4 import BeautifulSoup
import time

# Database connection
CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def get_db_connection():
    return psycopg2.connect(CONNECTION_STRING)

def find_permit_reports():
    """Find all monthly permit report PDFs on Frederick County website"""
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    # Try to find the permit reports listing page
    base_url = "https://www.fcva.us/departments/building-inspections/permit-reports"

    print("Searching for monthly permit reports...")

    response = session.get(base_url, timeout=30)
    soup = BeautifulSoup(response.text, 'html.parser')

    # Find all PDF links
    reports = []
    for link in soup.find_all('a', href=True):
        href = link.get('href', '')
        text = link.get_text(strip=True).lower()

        # Look for monthly report links
        if 'showpublisheddocument' in href or '.pdf' in href.lower():
            if any(month in text for month in ['january', 'february', 'march', 'april',
                   'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']):
                if '2025' in text or '2025' in href:
                    full_url = href if href.startswith('http') else f"https://www.fcva.us{href}"
                    reports.append({
                        'url': full_url,
                        'text': link.get_text(strip=True)
                    })

    return reports

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
    if not permits:
        return 0

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
    cur.close()
    conn.close()

    return len(permits)

def main():
    print("=" * 70)
    print("FREDERICK COUNTY VA - FULL 2025 MULTI-UNIT HOUSING EXTRACTION")
    print("=" * 70)
    print()

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    # Known 2025 monthly report URLs (discovered from county website)
    # Format: https://www.fcva.us/home/showpublisheddocument/{id}/{timestamp}
    monthly_reports = {
        'October 2025': 'https://www.fcva.us/home/showpublisheddocument/29614/638977571436800000',
        # Add more as we discover them from the website
    }

    # Try to find more reports from the permits page
    print("Searching for available monthly reports...")
    base_url = "https://www.fcva.us/departments/building-inspections/permit-reports"

    try:
        response = session.get(base_url, timeout=30)
        soup = BeautifulSoup(response.text, 'html.parser')

        # Find all document links
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            text = link.get_text(strip=True)

            if 'showpublisheddocument' in href.lower():
                # Check for 2025 monthly reports
                text_lower = text.lower()
                months = ['january', 'february', 'march', 'april', 'may', 'june',
                         'july', 'august', 'september', 'october', 'november', 'december']

                for month in months:
                    if month in text_lower and '2025' in text_lower:
                        full_url = href if href.startswith('http') else f"https://www.fcva.us{href}"
                        month_name = f"{month.capitalize()} 2025"
                        if month_name not in monthly_reports:
                            monthly_reports[month_name] = full_url
                            print(f"  Found: {month_name}")

    except Exception as e:
        print(f"Warning: Could not scan reports page: {e}")

    print(f"\nFound {len(monthly_reports)} monthly reports to process")
    print()

    # Process each report
    total_permits = 0
    all_developments = defaultdict(int)

    for month_name, url in sorted(monthly_reports.items()):
        print(f"Processing {month_name}...")

        try:
            response = session.get(url, timeout=60)
            pdf_path = 'temp_permits.pdf'

            with open(pdf_path, 'wb') as f:
                f.write(response.content)

            permits = extract_permits_from_pdf(pdf_path)
            stored = store_permits(permits, month_name)

            print(f"  Extracted {len(permits)} multi-unit permits, stored {stored}")

            # Track developments
            for p in permits:
                all_developments[p['development_name']] += 1

            total_permits += stored
            os.remove(pdf_path)
            time.sleep(1)  # Rate limit

        except Exception as e:
            print(f"  Error: {e}")

    # Final summary
    print("\n" + "=" * 70)
    print("EXTRACTION COMPLETE")
    print("=" * 70)
    print(f"\nTotal multi-unit permits stored: {total_permits}")
    print("\nDevelopments found:")
    for dev, count in sorted(all_developments.items(), key=lambda x: -x[1]):
        print(f"  {dev}: {count} permits")

    # Query database for full summary
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT development_name, unit_type, COUNT(*), SUM(estimated_value)
        FROM housing_pipeline
        WHERE jurisdiction_id = 'VA-FREDERICK'
        GROUP BY development_name, unit_type
        ORDER BY development_name, unit_type
    """)

    print("\n" + "=" * 70)
    print("DATABASE SUMMARY BY DEVELOPMENT AND UNIT TYPE")
    print("=" * 70)

    current_dev = None
    for row in cur.fetchall():
        dev, unit_type, count, value = row
        if dev != current_dev:
            print(f"\n{dev}:")
            current_dev = dev
        value_str = f"${value:,.0f}" if value else "N/A"
        print(f"  {unit_type}: {count} permits ({value_str})")

    cur.close()
    conn.close()

    print("\n" + "=" * 70)
    print("SUCCESS! Run this script monthly to update the pipeline")
    print("=" * 70)

if __name__ == "__main__":
    main()
