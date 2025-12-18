#!/usr/bin/env python3
"""
Populate pass1_census_snapshot table with Census Bureau ACS 5-Year data.
Uses direct Census API or Composio Census integration.

Design Principle:
- ref schema = static geography (immutable)
- pass1_census_snapshot = time-variant Census data (per-run)
"""
import os
import sys
import asyncio
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import psycopg2
from psycopg2.extras import execute_values
import aiohttp
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Census API Configuration
CENSUS_BASE_URL = "https://api.census.gov/data"
CENSUS_API_KEY = os.environ.get("CENSUS_API_KEY", "8e42aa570992dcc0798224911a7072b0112bfb0c")
CENSUS_VINTAGE_YEAR = 2022  # ACS 5-Year estimates

# Extended ACS 5-Year variable codes
CENSUS_VARIABLES = {
    # Population & Age
    "B01003_001E": "population",
    "B01002_001E": "median_age",
    "B01001_003E": "pop_under_18",  # Males under 5 (need to sum ranges)

    # Income
    "B19013_001E": "median_household_income",
    "B25077_001E": "median_home_value",
    "B25064_001E": "median_rent",

    # Housing
    "B25001_001E": "housing_units",
    "B25002_002E": "occupied_housing_units",
    "B25003_002E": "owner_occupied_units",
    "B25003_003E": "renter_occupied_units",
    "B25004_001E": "vacancy_rate_denom",  # For calculating vacancy
    "B25004_008E": "vacant_units",

    # Education
    "B15003_022E": "edu_bachelors",
    "B15003_023E": "edu_masters",
    "B15003_024E": "edu_professional",
    "B15003_025E": "edu_doctorate",
    "B15003_001E": "edu_total",

    # Employment
    "B23025_005E": "unemployed",
    "B23025_002E": "labor_force",

    # Household composition
    "B25010_001E": "avg_household_size",
    "B11001_002E": "family_households",
    "B11001_007E": "nonfamily_households",

    # Age distribution (need aggregation)
    "B01001_020E": "pop_65_plus_male",
    "B01001_044E": "pop_65_plus_female",

    # Housing structure
    "B25024_002E": "single_family_units",
    "B25024_003E": "single_family_attached",
    "B25024_004E": "multi_2_units",
    "B25024_005E": "multi_3_4_units",
    "B25024_006E": "multi_5_9_units",
    "B25024_007E": "multi_10_19_units",
    "B25024_008E": "multi_20_plus_units",
    "B25024_010E": "mobile_homes",

    # Income distribution
    "B19001_002E": "hh_income_under_10k",
    "B19001_003E": "hh_income_10k_15k",
    "B19001_004E": "hh_income_15k_20k",
    "B19001_005E": "hh_income_20k_25k",
    "B19001_006E": "hh_income_25k_30k",
    "B19001_007E": "hh_income_30k_35k",
    "B19001_008E": "hh_income_35k_40k",
    "B19001_009E": "hh_income_40k_45k",
    "B19001_010E": "hh_income_45k_50k",
    "B19001_011E": "hh_income_50k_60k",
    "B19001_012E": "hh_income_60k_75k",
    "B19001_013E": "hh_income_75k_100k",
    "B19001_014E": "hh_income_100k_125k",
    "B19001_015E": "hh_income_125k_150k",
    "B19001_016E": "hh_income_150k_200k",
    "B19001_017E": "hh_income_200k_plus",
}


def get_db_connection():
    """Get Neon PostgreSQL connection."""
    conn_string = os.environ.get('NEON_DATABASE_URL') or os.environ.get('DATABASE_URL')
    if not conn_string:
        conn_string = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
    return psycopg2.connect(conn_string)


def get_all_zip_codes(conn) -> List[str]:
    """Fetch all ZIP codes from zips_master."""
    with conn.cursor() as cur:
        cur.execute("SELECT zip FROM public.zips_master ORDER BY zip")
        return [row[0] for row in cur.fetchall()]


def safe_int(value: Any) -> Optional[int]:
    """Safely convert to int."""
    try:
        if value is None or value == '' or value == -666666666:
            return None
        return int(float(value))
    except (ValueError, TypeError):
        return None


def safe_float(value: Any) -> Optional[float]:
    """Safely convert to float."""
    try:
        if value is None or value == '' or value == -666666666.0:
            return None
        return float(value)
    except (ValueError, TypeError):
        return None


def calculate_rate(numerator: Any, denominator: Any) -> Optional[float]:
    """Calculate rate safely."""
    num = safe_int(numerator)
    denom = safe_int(denominator)
    if num is not None and denom is not None and denom > 0:
        return round((num / denom) * 100, 2)
    return None


async def fetch_census_batch(
    session: aiohttp.ClientSession,
    zip_codes: List[str],
    year: int = CENSUS_VINTAGE_YEAR
) -> Tuple[Dict[str, Dict], List[str]]:
    """
    Fetch Census data for a batch of ZIP codes.

    Returns:
        Tuple of (data dict by ZIP, list of failed ZIPs)
    """
    variables = ",".join(CENSUS_VARIABLES.keys())
    zip_list = ",".join(zip_codes)

    url = f"{CENSUS_BASE_URL}/{year}/acs/acs5"
    params = {
        "get": variables,
        "for": f"zip code tabulation area:{zip_list}",
        "key": CENSUS_API_KEY
    }

    results = {}
    failed = []

    try:
        async with session.get(url, params=params, timeout=60) as response:
            if response.status == 200:
                data = await response.json()
                if data and len(data) > 1:
                    # First row is headers
                    headers = data[0]
                    zip_idx = headers.index("zip code tabulation area")

                    for row in data[1:]:
                        try:
                            zip_code = str(row[zip_idx]).zfill(5)
                            parsed = parse_census_row(headers, row)
                            results[zip_code] = parsed
                        except Exception as e:
                            logger.warning(f"Failed to parse row: {e}")
                            continue
            else:
                error_text = await response.text()
                logger.error(f"Census API error {response.status}: {error_text[:200]}")
                failed.extend(zip_codes)

    except asyncio.TimeoutError:
        logger.error(f"Timeout fetching batch of {len(zip_codes)} ZIPs")
        failed.extend(zip_codes)
    except Exception as e:
        logger.error(f"Error fetching Census data: {e}")
        failed.extend(zip_codes)

    # Mark ZIPs not in results as failed
    for z in zip_codes:
        if z not in results and z not in failed:
            failed.append(z)

    return results, failed


def parse_census_row(headers: List[str], row: List) -> Dict[str, Any]:
    """Parse a Census API response row into snapshot fields."""
    # Create mapping from variable code to value
    var_values = {}
    for i, header in enumerate(headers):
        if header in CENSUS_VARIABLES:
            var_values[CENSUS_VARIABLES[header]] = row[i]

    # Calculate derived fields
    edu_bachelors_plus = sum([
        safe_int(var_values.get("edu_bachelors")) or 0,
        safe_int(var_values.get("edu_masters")) or 0,
        safe_int(var_values.get("edu_professional")) or 0,
        safe_int(var_values.get("edu_doctorate")) or 0
    ])
    edu_total = safe_int(var_values.get("edu_total"))

    multi_family = sum([
        safe_int(var_values.get("multi_2_units")) or 0,
        safe_int(var_values.get("multi_3_4_units")) or 0,
        safe_int(var_values.get("multi_5_9_units")) or 0,
        safe_int(var_values.get("multi_10_19_units")) or 0,
        safe_int(var_values.get("multi_20_plus_units")) or 0,
    ])

    single_family = (safe_int(var_values.get("single_family_units")) or 0) + \
                    (safe_int(var_values.get("single_family_attached")) or 0)

    pop_65_plus = (safe_int(var_values.get("pop_65_plus_male")) or 0) + \
                  (safe_int(var_values.get("pop_65_plus_female")) or 0)

    # Income distribution aggregation
    hh_under_25k = sum([
        safe_int(var_values.get("hh_income_under_10k")) or 0,
        safe_int(var_values.get("hh_income_10k_15k")) or 0,
        safe_int(var_values.get("hh_income_15k_20k")) or 0,
        safe_int(var_values.get("hh_income_20k_25k")) or 0,
    ])

    hh_25k_50k = sum([
        safe_int(var_values.get("hh_income_25k_30k")) or 0,
        safe_int(var_values.get("hh_income_30k_35k")) or 0,
        safe_int(var_values.get("hh_income_35k_40k")) or 0,
        safe_int(var_values.get("hh_income_40k_45k")) or 0,
        safe_int(var_values.get("hh_income_45k_50k")) or 0,
    ])

    hh_50k_75k = sum([
        safe_int(var_values.get("hh_income_50k_60k")) or 0,
        safe_int(var_values.get("hh_income_60k_75k")) or 0,
    ])

    hh_75k_100k = safe_int(var_values.get("hh_income_75k_100k")) or 0

    hh_100k_plus = sum([
        safe_int(var_values.get("hh_income_100k_125k")) or 0,
        safe_int(var_values.get("hh_income_125k_150k")) or 0,
        safe_int(var_values.get("hh_income_150k_200k")) or 0,
        safe_int(var_values.get("hh_income_200k_plus")) or 0,
    ])

    return {
        "population": safe_int(var_values.get("population")),
        "population_density": None,  # Needs land area calculation
        "median_age": safe_float(var_values.get("median_age")),
        "median_household_income": safe_int(var_values.get("median_household_income")),
        "median_home_value": safe_int(var_values.get("median_home_value")),
        "median_rent": safe_int(var_values.get("median_rent")),
        "housing_units": safe_int(var_values.get("housing_units")),
        "occupied_housing_units": safe_int(var_values.get("occupied_housing_units")),
        "owner_occupied_units": safe_int(var_values.get("owner_occupied_units")),
        "renter_occupied_units": safe_int(var_values.get("renter_occupied_units")),
        "vacancy_rate": calculate_rate(
            var_values.get("vacant_units"),
            var_values.get("vacancy_rate_denom")
        ),
        "education_bachelors_plus": calculate_rate(edu_bachelors_plus, edu_total),
        "unemployment_rate": calculate_rate(
            var_values.get("unemployed"),
            var_values.get("labor_force")
        ),
        "avg_household_size": safe_float(var_values.get("avg_household_size")),
        "family_households": safe_int(var_values.get("family_households")),
        "nonfamily_households": safe_int(var_values.get("nonfamily_households")),
        "pop_under_18": None,  # Would need full age breakdown
        "pop_18_to_34": None,
        "pop_35_to_54": None,
        "pop_55_to_64": None,
        "pop_65_plus": pop_65_plus if pop_65_plus > 0 else None,
        "single_family_units": single_family if single_family > 0 else None,
        "multi_family_units": multi_family if multi_family > 0 else None,
        "mobile_homes": safe_int(var_values.get("mobile_homes")),
        "households_under_25k": hh_under_25k if hh_under_25k > 0 else None,
        "households_25k_to_50k": hh_25k_50k if hh_25k_50k > 0 else None,
        "households_50k_to_75k": hh_50k_75k if hh_50k_75k > 0 else None,
        "households_75k_to_100k": hh_75k_100k if hh_75k_100k > 0 else None,
        "households_100k_plus": hh_100k_plus if hh_100k_plus > 0 else None,
    }


def insert_snapshot_batch(
    conn,
    snapshots: List[Tuple],
    run_id: str,
    vintage_year: int
):
    """Insert batch of snapshots into pass1_census_snapshot."""
    insert_sql = """
        INSERT INTO public.pass1_census_snapshot (
            zip_code, vintage_year, run_id, retrieved_at,
            population, population_density, median_age,
            median_household_income, median_home_value, median_rent,
            housing_units, occupied_housing_units, owner_occupied_units,
            renter_occupied_units, vacancy_rate, education_bachelors_plus,
            unemployment_rate, avg_household_size, family_households,
            nonfamily_households, pop_under_18, pop_18_to_34, pop_35_to_54,
            pop_55_to_64, pop_65_plus, single_family_units, multi_family_units,
            mobile_homes, households_under_25k, households_25k_to_50k,
            households_50k_to_75k, households_75k_to_100k, households_100k_plus,
            source
        ) VALUES %s
        ON CONFLICT (zip_code, vintage_year, run_id) DO NOTHING
    """

    rows = []
    for zip_code, data in snapshots:
        rows.append((
            zip_code,
            vintage_year,
            run_id,
            datetime.now(),
            data.get("population"),
            data.get("population_density"),
            data.get("median_age"),
            data.get("median_household_income"),
            data.get("median_home_value"),
            data.get("median_rent"),
            data.get("housing_units"),
            data.get("occupied_housing_units"),
            data.get("owner_occupied_units"),
            data.get("renter_occupied_units"),
            data.get("vacancy_rate"),
            data.get("education_bachelors_plus"),
            data.get("unemployment_rate"),
            data.get("avg_household_size"),
            data.get("family_households"),
            data.get("nonfamily_households"),
            data.get("pop_under_18"),
            data.get("pop_18_to_34"),
            data.get("pop_35_to_54"),
            data.get("pop_55_to_64"),
            data.get("pop_65_plus"),
            data.get("single_family_units"),
            data.get("multi_family_units"),
            data.get("mobile_homes"),
            data.get("households_under_25k"),
            data.get("households_25k_to_50k"),
            data.get("households_50k_to_75k"),
            data.get("households_75k_to_100k"),
            data.get("households_100k_plus"),
            "CENSUS_ACS5"
        ))

    with conn.cursor() as cur:
        execute_values(cur, insert_sql, rows)
    conn.commit()


def log_skipped_zips(conn, skipped: List[Tuple[str, str]], run_id: str):
    """Log skipped ZIPs to pass1_census_skip_log."""
    if not skipped:
        return

    insert_sql = """
        INSERT INTO public.pass1_census_skip_log (zip_code, run_id, skip_reason)
        VALUES %s
    """

    rows = [(zip_code, run_id, reason) for zip_code, reason in skipped]

    with conn.cursor() as cur:
        execute_values(cur, insert_sql, rows)
    conn.commit()


async def populate_census_snapshots(
    batch_size: int = 50,
    max_zips: Optional[int] = None,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Main function to populate Census snapshots for all ZIPs.

    Args:
        batch_size: Number of ZIPs per Census API request
        max_zips: Limit number of ZIPs (for testing)
        dry_run: If True, don't write to database

    Returns:
        Summary statistics
    """
    run_id = str(uuid.uuid4())
    start_time = datetime.now()

    print("=" * 60)
    print("POPULATING PASS1 CENSUS SNAPSHOTS")
    print("=" * 60)
    print(f"\nRun ID: {run_id}")
    print(f"Vintage Year: {CENSUS_VINTAGE_YEAR}")
    print(f"Batch Size: {batch_size}")
    print(f"Dry Run: {dry_run}")

    # Get database connection
    conn = get_db_connection()

    # Get all ZIP codes
    all_zips = get_all_zip_codes(conn)
    if max_zips:
        all_zips = all_zips[:max_zips]

    total_zips = len(all_zips)
    print(f"\nTotal ZIPs to process: {total_zips:,}")

    # Track statistics
    successful = 0
    failed = 0
    skipped_zips = []

    # Process in batches
    async with aiohttp.ClientSession() as session:
        for i in range(0, total_zips, batch_size):
            batch = all_zips[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total_zips + batch_size - 1) // batch_size

            print(f"\n[{batch_num}/{total_batches}] Processing ZIPs {i+1} to {min(i+batch_size, total_zips)}...")

            # Fetch Census data
            results, failures = await fetch_census_batch(session, batch, CENSUS_VINTAGE_YEAR)

            # Insert successful results
            if results and not dry_run:
                snapshots = [(z, data) for z, data in results.items()]
                insert_snapshot_batch(conn, snapshots, run_id, CENSUS_VINTAGE_YEAR)

            successful += len(results)
            failed += len(failures)

            # Track skipped ZIPs
            for z in failures:
                skipped_zips.append((z, "Census API returned no data"))

            print(f"    Fetched: {len(results)}, Failed: {len(failures)}")

            # Rate limiting - Census API is generous but be polite
            await asyncio.sleep(0.5)

    # Log skipped ZIPs
    if skipped_zips and not dry_run:
        log_skipped_zips(conn, skipped_zips, run_id)

    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()

    # Get final count from database
    final_count = 0
    if not dry_run:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM public.pass1_census_snapshot WHERE run_id = %s",
                (run_id,)
            )
            final_count = cur.fetchone()[0]

    conn.close()

    # Summary
    print("\n" + "=" * 60)
    print("POPULATION COMPLETE")
    print("=" * 60)
    print(f"\nRun ID: {run_id}")
    print(f"Duration: {duration:.1f} seconds")
    print(f"\nResults:")
    print(f"  Total ZIPs: {total_zips:,}")
    print(f"  Successful: {successful:,}")
    print(f"  Failed: {failed:,}")
    print(f"  Success Rate: {(successful/total_zips*100):.1f}%")
    if not dry_run:
        print(f"\n  Rows inserted: {final_count:,}")
        print(f"  Skips logged: {len(skipped_zips):,}")

    return {
        "run_id": run_id,
        "vintage_year": CENSUS_VINTAGE_YEAR,
        "total_zips": total_zips,
        "successful": successful,
        "failed": failed,
        "duration_seconds": duration,
        "rows_inserted": final_count,
        "skips_logged": len(skipped_zips)
    }


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Populate pass1_census_snapshot table with Census ACS data"
    )
    parser.add_argument(
        "--batch-size", type=int, default=50,
        help="Number of ZIPs per API request (default: 50)"
    )
    parser.add_argument(
        "--max-zips", type=int, default=None,
        help="Limit number of ZIPs to process (for testing)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Don't write to database, just test API calls"
    )

    args = parser.parse_args()

    # Run async main
    result = asyncio.run(populate_census_snapshots(
        batch_size=args.batch_size,
        max_zips=args.max_zips,
        dry_run=args.dry_run
    ))

    return 0 if result["failed"] < result["total_zips"] * 0.1 else 1


if __name__ == "__main__":
    sys.exit(main())
