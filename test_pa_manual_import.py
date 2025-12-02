"""
Test script for manual PA jurisdiction data import.
This simulates importing from an Excel file exported from the PA DCED portal.
"""

import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_URL = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Sample data structure based on PA DCED report format
# This is what we expect from the Excel export
SAMPLE_DATA = {
    'County': ['BERKS', 'BERKS', 'BERKS'],
    'Municipality': ['Reading', 'West Reading', 'Wyomissing'],
    'Municipality Class': ['City', 'Borough', 'Borough'],
    'Has Zoning': ['Yes', 'Yes', 'Yes'],
    'Has Planning': ['Yes', 'Yes', 'Yes'],
    'Has Building Code': ['Yes', 'Yes', 'Yes'],
    'Building Code Type': ['UCC', 'UCC', 'UCC'],
    'Permit Office': ['Building Department', 'Code Enforcement', 'Zoning Office'],
    'Permit Office Phone': ['610-655-6200', '610-678-6889', '610-374-6100']
}

def create_sample_excel():
    """Create a sample Excel file for testing"""
    df = pd.DataFrame(SAMPLE_DATA)
    df.to_excel('pa_jurisdictions_sample.xlsx', index=False)
    logger.info("Created sample Excel file: pa_jurisdictions_sample.xlsx")
    return df

def test_import_from_excel(file_path: str):
    """Test importing from Excel file"""
    logger.info(f"Reading Excel file: {file_path}")
    
    # Read Excel
    df = pd.read_excel(file_path)
    logger.info(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    logger.info(f"Columns: {list(df.columns)}")
    
    # Show first few rows
    print("\nFirst 5 rows:")
    print(df.head())
    
    # Parse using the main script's function
    from scrape_pa_jurisdiction_data import parse_jurisdiction_data, insert_jurisdiction_cards
    
    jurisdictions = parse_jurisdiction_data(df)
    logger.info(f"Parsed {len(jurisdictions)} jurisdictions")
    
    if jurisdictions:
        print("\nSample parsed jurisdiction:")
        print(jurisdictions[0])
        
        # Test database insert
        conn = psycopg2.connect(DB_URL)
        try:
            inserted, updated = insert_jurisdiction_cards(jurisdictions, conn)
            logger.info(f"✅ Inserted {inserted} new, updated {updated} existing")
        finally:
            conn.close()
    else:
        logger.warning("No jurisdictions parsed - check column mapping")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Import from provided file
        test_import_from_excel(sys.argv[1])
    else:
        # Create sample and test
        print("Creating sample Excel file for testing...")
        df = create_sample_excel()
        print("\nTo test with real data:")
        print("1. Visit: https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel")
        print("2. Select 'All Counties' and export to Excel")
        print("3. Run: python test_pa_manual_import.py path/to/exported_file.xlsx")
        print("\nTesting with sample data...")
        test_import_from_excel('pa_jurisdictions_sample.xlsx')

