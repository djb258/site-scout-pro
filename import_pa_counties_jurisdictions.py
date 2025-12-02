"""
Import jurisdiction data for all Pennsylvania counties in the system.

This script:
1. Gets list of PA counties from layer_3_counties
2. Provides instructions for exporting data from PA DCED portal
3. Imports jurisdiction data for those counties
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
import logging
from scrape_pa_jurisdiction_data import parse_jurisdiction_data, insert_jurisdiction_cards, get_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_URL = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Reverse mapping: FIPS to County Name (for filtering)
FIPS_TO_COUNTY = {
    "42001": "ADAMS", "42003": "ALLEGHENY", "42005": "ARMSTRONG",
    "42007": "BEAVER", "42009": "BEDFORD", "42011": "BERKS",
    "42013": "BLAIR", "42015": "BRADFORD", "42017": "BUCKS",
    "42019": "BUTLER", "42021": "CAMBRIA", "42023": "CAMERON",
    "42025": "CARBON", "42027": "CENTRE", "42029": "CHESTER",
    "42031": "CLARION", "42033": "CLEARFIELD", "42035": "CLINTON",
    "42037": "COLUMBIA", "42039": "CRAWFORD", "42041": "CUMBERLAND",
    "42043": "DAUPHIN", "42045": "DELAWARE", "42047": "ELK",
    "42049": "ERIE", "42051": "FAYETTE", "42053": "FOREST",
    "42055": "FRANKLIN", "42057": "FULTON", "42059": "GREENE",
    "42061": "HUNTINGDON", "42063": "INDIANA", "42065": "JEFFERSON",
    "42067": "JUNIATA", "42069": "LACKAWANNA", "42071": "LANCASTER",
    "42073": "LAWRENCE", "42075": "LEBANON", "42077": "LEHIGH",
    "42079": "LUZERNE", "42081": "LYCOMING", "42083": "MCKEAN",
    "42085": "MERCER", "42087": "MIFFLIN", "42089": "MONROE",
    "42091": "MONTGOMERY", "42093": "MONTOUR", "42095": "NORTHAMPTON",
    "42097": "NORTHUMBERLAND", "42099": "PERRY", "42101": "PHILADELPHIA",
    "42103": "PIKE", "42105": "POTTER", "42107": "SCHUYLKILL",
    "42109": "SNYDER", "42111": "SOMERSET", "42113": "SULLIVAN",
    "42115": "SUSQUEHANNA", "42117": "TIOGA", "42119": "UNION",
    "42121": "VENANGO", "42123": "WARREN", "42125": "WASHINGTON",
    "42127": "WAYNE", "42129": "WESTMORELAND", "42131": "WYOMING",
    "42133": "YORK"
}


def get_pa_counties_in_system():
    """Get list of PA counties from layer_3_counties"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT DISTINCT county_fips, county_name, state
        FROM layer_3_counties
        WHERE state = 'PA'
        ORDER BY county_name;
    """)
    
    counties = cur.fetchall()
    cur.close()
    conn.close()
    
    return counties


def filter_jurisdictions_by_counties(df, target_counties):
    """Filter DataFrame to only include target counties"""
    if df is None or df.empty:
        return df
    
    # Normalize county column
    county_col = None
    for col in df.columns:
        if 'county' in str(col).lower():
            county_col = col
            break
    
    if county_col is None:
        logger.warning("Could not find county column in data")
        return df
    
    # Get county names (uppercase)
    target_county_names = [c['county_name'].upper() for c in target_counties]
    
    # Filter
    df_filtered = df[df[county_col].str.upper().isin(target_county_names)]
    
    logger.info(f"Filtered to {len(df_filtered)} jurisdictions in target counties (from {len(df)} total)")
    
    return df_filtered


def import_pa_jurisdictions_from_file(file_path: str, filter_to_system_counties: bool = True):
    """
    Import PA jurisdiction data from Excel file.
    
    Args:
        file_path: Path to Excel file exported from PA DCED portal
        filter_to_system_counties: If True, only import counties in layer_3_counties
    """
    logger.info(f"Reading PA jurisdiction data from: {file_path}")
    
    # Read file (Excel or CSV)
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
        logger.info(f"Loaded {len(df)} rows, {len(df.columns)} columns")
        logger.info(f"Columns: {list(df.columns)}")
    except Exception as e:
        logger.error(f"Error reading file: {e}")
        return
    
    # Filter to counties in system if requested
    if filter_to_system_counties:
        counties_in_system = get_pa_counties_in_system()
        logger.info(f"Found {len(counties_in_system)} PA counties in system")
        df = filter_jurisdictions_by_counties(df, counties_in_system)
    
    if df is None or df.empty:
        logger.warning("No data to import after filtering")
        return
    
    # Parse jurisdictions
    jurisdictions = parse_jurisdiction_data(df)
    logger.info(f"Parsed {len(jurisdictions)} jurisdictions")
    
    if not jurisdictions:
        logger.warning("No jurisdictions parsed from data")
        return
    
    # Show sample
    logger.info("Sample jurisdiction:")
    logger.info(f"  {jurisdictions[0]}")
    
    # Import to database
    conn = get_connection()
    try:
        inserted, updated = insert_jurisdiction_cards(jurisdictions, conn)
        logger.info(f"✅ Successfully imported: {inserted} new, {updated} updated")
        
        # Show summary by county
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT county_name, COUNT(*) as jurisdiction_count
            FROM jurisdiction_cards
            WHERE state = 'PA'
            GROUP BY county_name
            ORDER BY jurisdiction_count DESC;
        """)
        
        summary = cur.fetchall()
        logger.info("\nJurisdiction counts by county:")
        for row in summary:
            logger.info(f"  {row['county_name']}: {row['jurisdiction_count']} jurisdictions")
        
        cur.close()
        
    except Exception as e:
        logger.error(f"Error importing to database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()


def print_export_instructions():
    """Print instructions for exporting data from PA DCED portal"""
    counties = get_pa_counties_in_system()
    
    print("\n" + "="*80)
    print("PA JURISDICTION DATA EXPORT INSTRUCTIONS")
    print("="*80)
    print("\n1. Visit: https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel")
    print("\n2. Select parameters:")
    print("   - County: Select 'All Counties' (or specific counties below)")
    print("   - Entity Type: Municipality")
    print("   - Municipality Class: All Classes")
    print("\n3. Click 'View Report' or export to Excel")
    print("\n4. Save the Excel file")
    print("\n5. Run: python import_pa_counties_jurisdictions.py path/to/file.xlsx")
    print("\n" + "="*80)
    print(f"COUNTIES IN SYSTEM ({len(counties)}):")
    print("="*80)
    for c in counties:
        print(f"  {c['county_fips']} - {c['county_name']}")
    print("\n" + "="*80)


def main():
    import sys
    
    if len(sys.argv) > 1:
        # Import from file
        file_path = sys.argv[1]
        filter_counties = '--all-counties' not in sys.argv
        
        if filter_counties:
            logger.info("Filtering to counties in system (use --all-counties to import all PA counties)")
        else:
            logger.info("Importing ALL PA counties (not filtering)")
        
        import_pa_jurisdictions_from_file(file_path, filter_to_system_counties=filter_counties)
    else:
        # Show instructions
        print_export_instructions()
        
        # Show current status
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT COUNT(DISTINCT county_fips) as county_count,
                   COUNT(*) as total_jurisdictions
            FROM jurisdiction_cards
            WHERE state = 'PA';
        """)
        
        status = cur.fetchone()
        print(f"\nCurrent Status:")
        print(f"  Counties with data: {status['county_count']}")
        print(f"  Total jurisdictions: {status['total_jurisdictions']}")
        
        counties = get_pa_counties_in_system()
        print(f"\n  Counties in system: {len(counties)}")
        print(f"  Counties needing data: {len(counties) - status['county_count']}")
        
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()

