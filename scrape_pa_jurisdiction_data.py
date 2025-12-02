"""
Scrape Pennsylvania County/Municipal Planning, Zoning & Building Code Data
from DCED Municipal Statistics portal.

Source: https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel

This script will:
1. Scrape jurisdiction data for all PA counties/municipalities
2. Populate jurisdiction_cards table
3. Populate zoning_cache table
4. Populate county_gis_portals table (if URLs are available)
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import logging
from typing import Dict, List, Optional
import re

# Database connection
DB_URL = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# PA County FIPS codes (for reference)
PA_COUNTIES = {
    "ADAMS": "42001", "ALLEGHENY": "42003", "ARMSTRONG": "42005",
    "BEAVER": "42007", "BEDFORD": "42009", "BERKS": "42011",
    "BLAIR": "42013", "BRADFORD": "42015", "BUCKS": "42017",
    "BUTLER": "42019", "CAMBRIA": "42021", "CAMERON": "42023",
    "CARBON": "42025", "CENTRE": "42027", "CHESTER": "42029",
    "CLARION": "42031", "CLEARFIELD": "42033", "CLINTON": "42035",
    "COLUMBIA": "42037", "CRAWFORD": "42039", "CUMBERLAND": "42041",
    "DAUPHIN": "42043", "DELAWARE": "42045", "ELK": "42047",
    "ERIE": "42049", "FAYETTE": "42051", "FOREST": "42053",
    "FRANKLIN": "42055", "FULTON": "42057", "GREENE": "42059",
    "HUNTINGDON": "42061", "INDIANA": "42063", "JEFFERSON": "42065",
    "JUNIATA": "42067", "LACKAWANNA": "42069", "LANCASTER": "42071",
    "LAWRENCE": "42073", "LEBANON": "42075", "LEHIGH": "42077",
    "LUZERNE": "42079", "LYCOMING": "42081", "MCKEAN": "42083",
    "MERCER": "42085", "MIFFLIN": "42087", "MONROE": "42089",
    "MONTGOMERY": "42091", "MONTOUR": "42093", "NORTHAMPTON": "42095",
    "NORTHUMBERLAND": "42097", "PERRY": "42099", "PHILADELPHIA": "42101",
    "PIKE": "42103", "POTTER": "42105", "SCHUYLKILL": "42107",
    "SNYDER": "42109", "SOMERSET": "42111", "SULLIVAN": "42113",
    "SUSQUEHANNA": "42115", "TIOGA": "42117", "UNION": "42119",
    "VENANGO": "42121", "WARREN": "42123", "WASHINGTON": "42125",
    "WAYNE": "42127", "WESTMORELAND": "42129", "WYOMING": "42131",
    "YORK": "42133"
}


def get_connection():
    """Get database connection"""
    return psycopg2.connect(DB_URL)


def scrape_pa_jurisdiction_report(county: str = None) -> Optional[pd.DataFrame]:
    """
    Scrape the PA DCED Municipal Statistics report.
    
    The report appears to be a SQL Server Reporting Services (SSRS) report
    that requires form submission. We'll need to:
    1. POST to the report URL with county/municipality parameters
    2. Parse the Excel export or HTML table response
    
    Args:
        county: County name (optional, if None gets all)
    
    Returns:
        DataFrame with jurisdiction data
    """
    base_url = "https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx"
    report_name = "CountyMuniBuilding_Excel"
    
    # The site uses ASP.NET ViewState, so we need to handle that
    # For now, we'll try to get the Excel export directly
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    
    try:
        # First, get the page to establish session
        response = session.get(f"{base_url}?report={report_name}")
        response.raise_for_status()
        
        # Parse the page to get ViewState and other form fields
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find form fields needed for POST
        viewstate = soup.find('input', {'name': '__VIEWSTATE'})
        viewstate_value = viewstate['value'] if viewstate else None
        
        event_validation = soup.find('input', {'name': '__EVENTVALIDATION'})
        event_validation_value = event_validation['value'] if event_validation else None
        
        # Try to find the Excel export link or form
        # The report viewer might have an export button we can trigger
        
        logger.info(f"Attempting to scrape PA jurisdiction data for county: {county or 'ALL'}")
        
        # Alternative approach: Try to access Excel export directly
        # Many SSRS reports allow direct Excel export via URL parameters
        excel_url = f"{base_url}?report={report_name}&rs:Format=EXCEL"
        
        if county:
            # Try to add county parameter
            excel_url += f"&County={county}"
        
        response = session.get(excel_url)
        
        if response.status_code == 200 and 'application/vnd.ms-excel' in response.headers.get('Content-Type', ''):
            # Successfully got Excel file
            logger.info("Successfully retrieved Excel export")
            
            # Read Excel into DataFrame
            import io
            df = pd.read_excel(io.BytesIO(response.content))
            return df
        
        # If direct Excel doesn't work, try parsing HTML table
        logger.warning("Excel export failed, attempting HTML table parsing")
        response = session.get(f"{base_url}?report={report_name}")
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find table in report viewer - SSRS reports often have nested tables
        # Look for the actual data table (usually has many rows)
        tables = soup.find_all('table')
        if tables:
            # Try each table, find the one with actual data
            for table in tables:
                try:
                    from io import StringIO
                    temp_df = pd.read_html(StringIO(str(table)))[0]
                    # If table has reasonable number of columns and rows, use it
                    if len(temp_df.columns) >= 3 and len(temp_df) > 1:
                        # Check if first row might be headers
                        if temp_df.iloc[0].dtype == 'object':
                            # Use first row as headers
                            temp_df.columns = temp_df.iloc[0]
                            temp_df = temp_df[1:].reset_index(drop=True)
                        return temp_df
                except Exception as e:
                    logger.debug(f"Error parsing table: {e}")
                    continue
        
        logger.error("Could not extract data from report")
        return None
        
    except Exception as e:
        logger.error(f"Error scraping PA jurisdiction data: {e}")
        return None


def parse_jurisdiction_data(df: pd.DataFrame, is_scraped_html: bool = False) -> List[Dict]:
    """
    Parse scraped DataFrame into jurisdiction card records.
    
    Expected columns (may vary):
    - County
    - Municipality
    - Municipality Class (Borough, City, Township, etc.)
    - Has Zoning
    - Has Planning
    - Has Building Code
    - Building Code Type
    - Permit Office
    - Permit Office Phone
    - GIS Portal URL (if available)
    
    Returns:
        List of jurisdiction dictionaries
    """
    jurisdictions = []
    
    if df is None or df.empty:
        return jurisdictions
    
    # If this is scraped HTML data, it may need special handling
    if is_scraped_html:
        # Headers might be in row 1, data starts at row 2
        if len(df) > 1 and df.iloc[0].isna().all():
            # First row is empty, headers likely in row 1
            headers = df.iloc[1].tolist()
            # Check if row 1 looks like headers (contains text like COUNTY_NAME, etc.)
            if any('COUNTY' in str(h).upper() or 'MUNICIPALITY' in str(h).upper() for h in headers if pd.notna(h)):
                # Use row 1 as headers, data starts at row 2
                df.columns = [str(h).strip().upper().replace(' ', '_') if pd.notna(h) else f'col_{i}' 
                             for i, h in enumerate(headers)]
                df = df.iloc[2:].reset_index(drop=True)
                # Remove rows that are all NaN
                df = df.dropna(how='all')
    
    # Normalize column names (handle variations)
    # Convert to string first in case columns are numeric
    df.columns = [str(col).strip().lower().replace(' ', '_') if pd.notna(col) else f'col_{i}' 
                 for i, col in enumerate(df.columns)]
    
    # Map common column name variations
    column_mapping = {
        'county': ['county', 'county_name'],
        'municipality': ['municipality', 'municipality_name', 'municipal_name'],
        'municipality_class': ['municipality_class', 'class', 'muni_class'],
        'has_zoning': ['has_zoning', 'zoning', 'zoning_ordinance'],
        'has_planning': ['has_planning', 'planning', 'planning_commission'],
        'has_building_code': ['has_building_code', 'building_code', 'building_ordinance', 'ucc_code'],
        'building_code_type': ['building_code_type', 'code_type'],
        'permit_office': ['permit_office', 'permit_office_name', 'building_official', 'ucc_inspector'],
        'permit_phone': ['permit_phone', 'permit_office_phone', 'phone'],
        'gis_url': ['gis_url', 'gis_portal_url', 'mapping_url']
    }
    
    for _, row in df.iterrows():
        try:
            # Extract county - try multiple column name variations
            county_name = None
            for col in column_mapping['county']:
                if col in df.columns:
                    val = row[col]
                    if pd.notna(val):
                        county_name = str(val).strip().upper()
                        break
            
            # Also try uppercase column names (from scraped HTML)
            if not county_name:
                for col in df.columns:
                    if 'county_name' in str(col).lower():
                        val = row[col]
                        if pd.notna(val):
                            county_name = str(val).strip().upper()
                            break
            
            if not county_name or county_name == 'NAN' or county_name == '':
                continue
            
            # Extract municipality
            jurisdiction_name = None
            for col in column_mapping['municipality']:
                if col in df.columns:
                    val = row[col]
                    if pd.notna(val):
                        jurisdiction_name = str(val).strip()
                        break
            
            # Also try uppercase column names
            if not jurisdiction_name:
                for col in df.columns:
                    if 'municipality_name' in str(col).lower():
                        val = row[col]
                        if pd.notna(val):
                            jurisdiction_name = str(val).strip()
                            break
            
            if not jurisdiction_name or jurisdiction_name == 'NAN' or jurisdiction_name == '':
                continue
            
            # Extract municipality class - try to infer from name
            jurisdiction_type = None
            for col in column_mapping['municipality_class']:
                if col in df.columns:
                    val = row[col]
                    if pd.notna(val):
                        jurisdiction_type = str(val).strip()
                        break
            
            # If not found, try to infer from jurisdiction name
            if not jurisdiction_type or jurisdiction_type == 'Unknown':
                name_upper = jurisdiction_name.upper()
                if 'BORO' in name_upper or 'BOROUGH' in name_upper:
                    jurisdiction_type = 'Borough'
                elif 'TWP' in name_upper or 'TOWNSHIP' in name_upper:
                    jurisdiction_type = 'Township'
                elif 'CITY' in name_upper:
                    jurisdiction_type = 'City'
                elif 'COUNTY' in name_upper:
                    jurisdiction_type = 'County'
                else:
                    jurisdiction_type = 'Unknown'
            
            # Extract zoning info
            has_zoning = False
            for col in column_mapping['has_zoning']:
                if col in df.columns:
                    val = row[col]
                    if pd.notna(val):
                        val_str = str(val).strip().upper()
                        has_zoning = val_str in ['YES', 'Y', 'TRUE', '1', 'X']
                        break
            
            # Also check ZONING_ORDINANCE column
            if not has_zoning:
                for col in df.columns:
                    if 'zoning_ordinance' in str(col).lower():
                        val = row[col]
                        if pd.notna(val):
                            val_str = str(val).strip().upper()
                            has_zoning = val_str in ['YES', 'Y', 'TRUE', '1', 'X']
                            break
            
            # Extract building code info (UCC_CODE)
            has_building_code = False
            building_code_type = None
            for col in column_mapping['has_building_code']:
                if col in df.columns:
                    val = row[col]
                    if pd.notna(val):
                        val_str = str(val).strip().upper()
                        has_building_code = val_str in ['YES', 'Y', 'TRUE', '1', 'X']
                        if has_building_code:
                            building_code_type = 'UCC'  # PA uses Uniform Construction Code
                        break
            
            for col in column_mapping['building_code_type']:
                if col in df.columns:
                    building_code_type = str(row[col]).strip()
                    break
            
            # Extract permit office info
            permit_office_name = None
            permit_office_phone = None
            for col in column_mapping['permit_office']:
                if col in df.columns:
                    permit_office_name = str(row[col]).strip()
                    break
            
            for col in column_mapping['permit_phone']:
                if col in df.columns:
                    permit_office_phone = str(row[col]).strip()
                    break
            
            # Get county FIPS
            county_fips = PA_COUNTIES.get(county_name, None)
            
            jurisdiction = {
                'state': 'PA',
                'county_fips': county_fips,
                'county_name': county_name,
                'jurisdiction': jurisdiction_name,
                'jurisdiction_type': jurisdiction_type or 'Unknown',
                'has_zoning': has_zoning,
                'permit_office_name': permit_office_name,
                'permit_office_phone': permit_office_phone,
                'source_url': 'https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel'
            }
            
            jurisdictions.append(jurisdiction)
            
        except Exception as e:
            logger.warning(f"Error parsing row: {e}")
            continue
    
    return jurisdictions


def insert_jurisdiction_cards(jurisdictions: List[Dict], conn):
    """Insert jurisdiction cards into database"""
    cur = conn.cursor()
    
    inserted = 0
    updated = 0
    
    for j in jurisdictions:
        try:
            # Check if exists
            cur.execute("""
                SELECT id FROM jurisdiction_cards
                WHERE state = %s AND county_fips = %s AND jurisdiction = %s
            """, (j['state'], j['county_fips'], j['jurisdiction']))
            
            existing = cur.fetchone()
            
            if existing:
                # Update existing
                cur.execute("""
                    UPDATE jurisdiction_cards
                    SET jurisdiction_type = %s,
                        has_zoning = %s,
                        permit_office_name = %s,
                        permit_office_phone = %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (
                    j['jurisdiction_type'],
                    j['has_zoning'],
                    j['permit_office_name'],
                    j['permit_office_phone'],
                    existing[0]
                ))
                updated += 1
            else:
                # Insert new
                cur.execute("""
                    INSERT INTO jurisdiction_cards (
                        state, county_fips, county_name, jurisdiction,
                        jurisdiction_type, has_zoning,
                        permit_office_name, permit_office_phone,
                        regulations_url, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
                    )
                    RETURNING id
                """, (
                    j['state'],
                    j['county_fips'],
                    j['county_name'],
                    j['jurisdiction'],
                    j['jurisdiction_type'],
                    j['has_zoning'],
                    j['permit_office_name'],
                    j['permit_office_phone'],
                    j.get('source_url', 'https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel')
                ))
                inserted += 1
            
        except Exception as e:
            logger.error(f"Error inserting jurisdiction {j['jurisdiction']}: {e}")
            continue
    
    conn.commit()
    logger.info(f"Inserted {inserted} new jurisdictions, updated {updated} existing")
    
    return inserted, updated


def main():
    """Main execution"""
    logger.info("Starting PA jurisdiction data scrape")
    
    conn = get_connection()
    
    try:
        # Try to scrape all counties (or start with one for testing)
        # For testing, start with a single county
        test_county = "BERKS"  # Change to None for all counties
        
        df = scrape_pa_jurisdiction_report(county=test_county)
        
        if df is None:
            logger.error("Failed to scrape data. The website may require manual interaction.")
            logger.info("""
            MANUAL APPROACH:
            1. Visit: https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel
            2. Select a county (or 'All Counties')
            3. Click 'View Report' or export to Excel
            4. Save the Excel file
            5. Run: python scrape_pa_jurisdiction_data.py --file path/to/excel.xlsx
            """)
            return
        
        logger.info(f"Scraped {len(df)} rows of data")
        logger.info(f"Columns: {list(df.columns)}")
        
        # Parse data
        jurisdictions = parse_jurisdiction_data(df)
        logger.info(f"Parsed {len(jurisdictions)} jurisdictions")
        
        # Insert into database
        if jurisdictions:
            inserted, updated = insert_jurisdiction_cards(jurisdictions, conn)
            logger.info(f"Successfully processed {inserted + updated} jurisdictions")
        else:
            logger.warning("No jurisdictions parsed from data")
        
    except Exception as e:
        logger.error(f"Error in main execution: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()


if __name__ == "__main__":
    import sys
    
    # Allow manual file input for testing
    if len(sys.argv) > 1 and sys.argv[1] == '--file':
        # Read from Excel file instead of scraping
        file_path = sys.argv[2]
        logger.info(f"Reading from file: {file_path}")
        
        df = pd.read_excel(file_path)
        jurisdictions = parse_jurisdiction_data(df)
        
        conn = get_connection()
        try:
            inserted, updated = insert_jurisdiction_cards(jurisdictions, conn)
            logger.info(f"Processed {inserted + updated} jurisdictions from file")
        finally:
            conn.close()
    else:
        main()

