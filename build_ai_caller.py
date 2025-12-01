"""
AI Caller for Facility Pricing
Collects actual rental rates via AI voice calls to storage facilities.

Supports:
- Bland AI (~$0.09/min)
- Vapi (~$0.05/min)
- Manual CSV import

Pipeline:
1. Add missing columns to storage_facilities
2. Create facility_call_results table
3. Fetch phone numbers from Google Places Details API
4. Export call list
5. Process call results
6. Update storage_facilities with pricing
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import json
import csv
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyAWS3lz7Tk-61z82gMN-Ck1-nxTzUVxjU4")

# API endpoints
GOOGLE_PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

# Rate limiting
REQUESTS_PER_SECOND = 10
LAST_REQUEST_TIME = 0


def get_connection():
    return psycopg2.connect(CONNECTION_STRING)


def rate_limit():
    """Enforce rate limiting."""
    global LAST_REQUEST_TIME
    current_time = time.time()
    elapsed = current_time - LAST_REQUEST_TIME
    min_interval = 1.0 / REQUESTS_PER_SECOND

    if elapsed < min_interval:
        time.sleep(min_interval - elapsed)

    LAST_REQUEST_TIME = time.time()


def add_missing_columns():
    """Add missing columns to storage_facilities table for AI caller data."""
    conn = get_connection()
    cursor = conn.cursor()

    print("=" * 70)
    print("ADDING MISSING COLUMNS TO storage_facilities")
    print("=" * 70)

    columns_to_add = [
        ("phone_number", "VARCHAR(20)"),
        ("has_climate_control", "BOOLEAN"),
        ("climate_premium", "INT"),
        ("move_in_special", "TEXT"),
        ("availability_status", "VARCHAR(20)"),
        ("pricing_source", "VARCHAR(20)"),
        ("pricing_fetched_at", "TIMESTAMP"),
    ]

    for col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"""
                ALTER TABLE storage_facilities
                ADD COLUMN IF NOT EXISTS {col_name} {col_type}
            """)
            print(f"   [OK] Added/verified: {col_name} ({col_type})")
        except Exception as e:
            print(f"   [WARN] {col_name}: {e}")

    conn.commit()
    conn.close()
    print("\n   [OK] Column updates complete")


def create_call_results_table():
    """Create facility_call_results table."""
    conn = get_connection()
    cursor = conn.cursor()

    print("\n" + "=" * 70)
    print("CREATING facility_call_results TABLE")
    print("=" * 70)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS facility_call_results (
            id SERIAL PRIMARY KEY,
            facility_id INT REFERENCES storage_facilities(id),
            call_datetime TIMESTAMP,
            call_duration_seconds INT,
            call_status VARCHAR(20),  -- 'completed', 'no_answer', 'voicemail', 'busy', 'invalid'

            -- Availability
            availability_10x10 VARCHAR(20),  -- 'available', 'unavailable', 'waitlist'
            availability_10x20 VARCHAR(20),

            -- Pricing
            rate_10x10 INT,
            rate_10x20 INT,
            rate_5x10 INT,
            rate_10x15 INT,

            -- Climate control
            has_climate_control BOOLEAN,
            climate_premium INT,  -- Additional $/mo or NULL

            -- Specials
            move_in_special TEXT,

            -- Raw data
            transcript TEXT,
            call_notes TEXT,

            -- Metadata
            caller_service VARCHAR(50),  -- 'bland', 'vapi', 'retell', 'manual'
            call_id VARCHAR(100),  -- External call ID from service
            retry_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)

    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_fcr_facility ON facility_call_results(facility_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_fcr_status ON facility_call_results(call_status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_fcr_datetime ON facility_call_results(call_datetime)")

    conn.commit()
    conn.close()
    print("   [OK] facility_call_results table created")
    print("   [OK] Indexes created")


def fetch_phone_numbers(limit: int = None, dry_run: bool = False):
    """
    Fetch phone numbers from Google Places Details API for facilities without them.

    Args:
        limit: Max facilities to process (None = all)
        dry_run: If True, don't update database
    """
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("FETCHING PHONE NUMBERS FROM GOOGLE PLACES")
    print("=" * 70)

    # Get facilities without phone numbers
    query = """
        SELECT id, place_id, name, city, state
        FROM storage_facilities
        WHERE phone_number IS NULL
        AND place_id IS NOT NULL
    """
    if limit:
        query += f" LIMIT {limit}"

    cursor.execute(query)
    facilities = cursor.fetchall()

    print(f"\n   Facilities without phone: {len(facilities)}")

    if dry_run:
        print("   [DRY RUN - no updates will be made]")

    stats = {
        "processed": 0,
        "found": 0,
        "not_found": 0,
        "errors": 0
    }

    for i, facility in enumerate(facilities):
        rate_limit()

        try:
            params = {
                "place_id": facility['place_id'],
                "fields": "formatted_phone_number,international_phone_number",
                "key": GOOGLE_API_KEY
            }

            response = requests.get(GOOGLE_PLACE_DETAILS_URL, params=params, timeout=30)

            if response.status_code == 200:
                data = response.json()

                if data.get("status") == "OK":
                    result = data.get("result", {})
                    phone = result.get("formatted_phone_number") or result.get("international_phone_number")

                    if phone:
                        if not dry_run:
                            cursor.execute("""
                                UPDATE storage_facilities
                                SET phone_number = %s
                                WHERE id = %s
                            """, (phone, facility['id']))

                        stats["found"] += 1
                        print(f"   [{i+1}/{len(facilities)}] {facility['name'][:40]}: {phone}")
                    else:
                        stats["not_found"] += 1
                        print(f"   [{i+1}/{len(facilities)}] {facility['name'][:40]}: No phone found")
                else:
                    stats["errors"] += 1
                    print(f"   [{i+1}/{len(facilities)}] {facility['name'][:40]}: API error - {data.get('status')}")
            else:
                stats["errors"] += 1
                print(f"   [{i+1}/{len(facilities)}] {facility['name'][:40]}: HTTP {response.status_code}")

        except Exception as e:
            stats["errors"] += 1
            print(f"   [{i+1}/{len(facilities)}] {facility['name'][:40]}: Error - {e}")

        stats["processed"] += 1

        # Commit every 50 updates
        if not dry_run and stats["found"] % 50 == 0:
            conn.commit()

    if not dry_run:
        conn.commit()

    conn.close()

    print(f"\n   Summary:")
    print(f"      Processed: {stats['processed']}")
    print(f"      Found: {stats['found']}")
    print(f"      Not Found: {stats['not_found']}")
    print(f"      Errors: {stats['errors']}")

    return stats


def export_call_list(output_file: str = "facility_call_list.csv"):
    """
    Export facility call list to CSV for AI caller batch upload.

    Bland AI format: name, phone
    Vapi format: name, phone_number, facility_id
    """
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("EXPORTING CALL LIST")
    print("=" * 70)

    # Get facilities with phone numbers that haven't been called
    cursor.execute("""
        SELECT
            sf.id,
            sf.name,
            sf.phone_number,
            sf.address,
            sf.city,
            sf.state,
            sf.county_fips,
            lc.county_name
        FROM storage_facilities sf
        LEFT JOIN layer_3_counties lc ON sf.county_fips = lc.county_fips
        WHERE sf.phone_number IS NOT NULL
        AND sf.id NOT IN (
            SELECT facility_id FROM facility_call_results
            WHERE call_status = 'completed'
        )
        ORDER BY sf.county_fips, sf.name
    """)

    facilities = cursor.fetchall()
    conn.close()

    print(f"\n   Facilities to call: {len(facilities)}")

    # Export to CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)

        # Header for Bland AI / Vapi
        writer.writerow([
            'facility_id', 'name', 'phone_number',
            'address', 'city', 'state', 'county'
        ])

        for facility in facilities:
            writer.writerow([
                facility['id'],
                facility['name'],
                facility['phone_number'],
                facility['address'],
                facility['city'],
                facility['state'],
                facility['county_name']
            ])

    print(f"   [OK] Exported to: {output_file}")

    # Generate summary by county
    county_counts = {}
    for f in facilities:
        county = f"{f['county_name']}, {f['state']}"
        county_counts[county] = county_counts.get(county, 0) + 1

    print(f"\n   Facilities by County:")
    for county, count in sorted(county_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"      {county}: {count}")

    return output_file


def import_call_results(input_file: str, caller_service: str = "bland"):
    """
    Import call results from AI caller CSV export.

    Expected columns:
    - facility_id (or name + phone for matching)
    - call_datetime
    - call_duration_seconds
    - call_status
    - rate_10x10
    - rate_10x20
    - has_climate_control
    - climate_premium
    - move_in_special
    - transcript
    - call_notes
    """
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print(f"IMPORTING CALL RESULTS FROM {input_file}")
    print("=" * 70)

    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"\n   Rows to import: {len(rows)}")

    stats = {
        "imported": 0,
        "errors": 0,
        "skipped": 0
    }

    for row in rows:
        try:
            # Get facility_id (direct or by phone match)
            facility_id = row.get('facility_id')

            if not facility_id:
                # Try to match by phone
                phone = row.get('phone_number') or row.get('phone')
                cursor.execute("""
                    SELECT id FROM storage_facilities WHERE phone_number = %s
                """, (phone,))
                result = cursor.fetchone()
                if result:
                    facility_id = result['id']

            if not facility_id:
                stats["skipped"] += 1
                continue

            # Parse values
            call_datetime = row.get('call_datetime') or datetime.now().isoformat()
            call_status = row.get('call_status', 'completed')

            # Parse rates (handle various formats)
            rate_10x10 = parse_dollar_amount(row.get('rate_10x10'))
            rate_10x20 = parse_dollar_amount(row.get('rate_10x20'))
            rate_5x10 = parse_dollar_amount(row.get('rate_5x10'))
            rate_10x15 = parse_dollar_amount(row.get('rate_10x15'))

            # Parse climate control
            has_climate = parse_boolean(row.get('has_climate_control'))
            climate_premium = parse_dollar_amount(row.get('climate_premium'))

            # Insert result
            cursor.execute("""
                INSERT INTO facility_call_results (
                    facility_id, call_datetime, call_duration_seconds, call_status,
                    availability_10x10, availability_10x20,
                    rate_10x10, rate_10x20, rate_5x10, rate_10x15,
                    has_climate_control, climate_premium,
                    move_in_special, transcript, call_notes,
                    caller_service, call_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                facility_id,
                call_datetime,
                row.get('call_duration_seconds', 0),
                call_status,
                row.get('availability_10x10'),
                row.get('availability_10x20'),
                rate_10x10, rate_10x20, rate_5x10, rate_10x15,
                has_climate,
                climate_premium,
                row.get('move_in_special'),
                row.get('transcript'),
                row.get('call_notes'),
                caller_service,
                row.get('call_id')
            ))

            stats["imported"] += 1

        except Exception as e:
            print(f"   Error importing row: {e}")
            stats["errors"] += 1

    conn.commit()
    conn.close()

    print(f"\n   Summary:")
    print(f"      Imported: {stats['imported']}")
    print(f"      Skipped: {stats['skipped']}")
    print(f"      Errors: {stats['errors']}")

    return stats


def parse_dollar_amount(value) -> Optional[int]:
    """Parse dollar amount from various formats."""
    if not value:
        return None

    if isinstance(value, (int, float)):
        return int(value)

    # Remove $ and other characters
    clean = str(value).replace('$', '').replace(',', '').strip()

    try:
        return int(float(clean))
    except:
        return None


def parse_boolean(value) -> Optional[bool]:
    """Parse boolean from various formats."""
    if value is None:
        return None

    if isinstance(value, bool):
        return value

    str_val = str(value).lower().strip()

    if str_val in ('yes', 'true', '1', 'y'):
        return True
    elif str_val in ('no', 'false', '0', 'n'):
        return False

    return None


def update_facilities_from_calls():
    """Update storage_facilities with data from completed calls."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("UPDATING storage_facilities FROM CALL RESULTS")
    print("=" * 70)

    # Update from completed calls
    cursor.execute("""
        UPDATE storage_facilities sf
        SET
            asking_rent_10x10 = fcr.rate_10x10,
            asking_rent_10x20 = fcr.rate_10x20,
            has_climate_control = fcr.has_climate_control,
            climate_premium = fcr.climate_premium,
            move_in_special = fcr.move_in_special,
            availability_status = fcr.availability_10x10,
            pricing_source = 'ai_call',
            pricing_fetched_at = fcr.call_datetime
        FROM (
            SELECT DISTINCT ON (facility_id)
                facility_id, rate_10x10, rate_10x20,
                has_climate_control, climate_premium,
                move_in_special, availability_10x10,
                call_datetime
            FROM facility_call_results
            WHERE call_status = 'completed'
            ORDER BY facility_id, call_datetime DESC
        ) fcr
        WHERE sf.id = fcr.facility_id
    """)

    updated = cursor.rowcount
    conn.commit()
    conn.close()

    print(f"\n   [OK] Updated {updated} facilities with pricing data")

    return updated


def generate_call_report():
    """Generate summary report of call results."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "=" * 70)
    print("CALL RESULTS SUMMARY REPORT")
    print("=" * 70)

    # Overall stats by status
    cursor.execute("""
        SELECT
            call_status,
            COUNT(*) as count,
            ROUND(AVG(rate_10x10)) as avg_10x10,
            ROUND(AVG(rate_10x20)) as avg_10x20,
            ROUND(AVG(call_duration_seconds)) as avg_duration
        FROM facility_call_results
        GROUP BY call_status
        ORDER BY count DESC
    """)

    results = cursor.fetchall()

    print(f"\n   Results by Status:")
    print(f"   {'Status':<15} {'Count':<8} {'Avg 10x10':<12} {'Avg 10x20':<12} {'Avg Duration'}")
    print(f"   {'-'*15} {'-'*8} {'-'*12} {'-'*12} {'-'*12}")

    for row in results:
        avg_10x10 = f"${row['avg_10x10']}" if row['avg_10x10'] else "-"
        avg_10x20 = f"${row['avg_10x20']}" if row['avg_10x20'] else "-"
        avg_dur = f"{row['avg_duration']}s" if row['avg_duration'] else "-"
        print(f"   {row['call_status']:<15} {row['count']:<8} {avg_10x10:<12} {avg_10x20:<12} {avg_dur}")

    # By county
    cursor.execute("""
        SELECT
            c.county_name,
            c.state,
            COUNT(fcr.id) as calls_completed,
            ROUND(AVG(fcr.rate_10x10)) as avg_10x10,
            MIN(fcr.rate_10x10) as min_10x10,
            MAX(fcr.rate_10x10) as max_10x10
        FROM facility_call_results fcr
        JOIN storage_facilities sf ON fcr.facility_id = sf.id
        JOIN layer_3_counties c ON sf.county_fips = c.county_fips
        WHERE fcr.call_status = 'completed'
        AND fcr.rate_10x10 IS NOT NULL
        GROUP BY c.county_name, c.state
        ORDER BY avg_10x10 DESC
    """)

    results = cursor.fetchall()

    if results:
        print(f"\n   Pricing by County (10x10 rates):")
        print(f"   {'County':<20} {'ST':<4} {'Calls':<8} {'Avg':<10} {'Min':<10} {'Max'}")
        print(f"   {'-'*20} {'-'*4} {'-'*8} {'-'*10} {'-'*10} {'-'*10}")

        for row in results:
            print(f"   {row['county_name'][:20]:<20} {row['state']:<4} {row['calls_completed']:<8} ${row['avg_10x10']:<9} ${row['min_10x10']:<9} ${row['max_10x10']}")

    # Climate control stats
    cursor.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN has_climate_control = true THEN 1 END) as with_climate,
            ROUND(AVG(climate_premium)) as avg_premium
        FROM facility_call_results
        WHERE call_status = 'completed'
    """)

    climate = cursor.fetchone()

    print(f"\n   Climate Control Stats:")
    print(f"      Total completed calls: {climate['total']}")
    print(f"      Facilities with climate: {climate['with_climate']}")
    if climate['avg_premium']:
        print(f"      Average climate premium: ${climate['avg_premium']}/mo")

    # Move-in specials
    cursor.execute("""
        SELECT move_in_special, COUNT(*) as count
        FROM facility_call_results
        WHERE call_status = 'completed'
        AND move_in_special IS NOT NULL
        AND move_in_special != 'none'
        GROUP BY move_in_special
        ORDER BY count DESC
        LIMIT 10
    """)

    specials = cursor.fetchall()

    if specials:
        print(f"\n   Top Move-In Specials:")
        for row in specials:
            print(f"      [{row['count']}x] {row['move_in_special'][:60]}")

    conn.close()


def get_call_script():
    """Return the AI caller script configuration."""

    script = {
        "opening": (
            "Hi, I'm looking for storage in the area and wanted to "
            "check on availability and pricing."
        ),

        "questions": [
            {
                "text": "Do you have any 10 by 10 units available?",
                "capture_field": "availability_10x10",
                "capture_type": "enum",
                "options": ["available", "unavailable", "waitlist"]
            },
            {
                "text": "What's the monthly rate for a 10 by 10?",
                "capture_field": "rate_10x10",
                "capture_type": "dollar_amount"
            },
            {
                "text": "And what about a 10 by 20?",
                "capture_field": "rate_10x20",
                "capture_type": "dollar_amount"
            },
            {
                "text": "Do you have climate controlled units? What's the rate difference for those?",
                "capture_fields": ["has_climate_control", "climate_premium"],
                "capture_types": ["boolean", "dollar_amount"]
            },
            {
                "text": "Are there any move-in specials right now?",
                "capture_field": "move_in_special",
                "capture_type": "text"
            }
        ],

        "closing": "Great, thank you so much for the information!",

        "edge_cases": {
            "no_answer": "Mark for retry (max 2 attempts)",
            "voicemail": "Mark as 'voicemail', don't leave message",
            "call_back": "Note in call_notes",
            "price_varies": "Capture range or 'varies'",
            "refused_price": "Mark in call_notes"
        },

        "timing": {
            "best_days": ["Tuesday", "Wednesday", "Thursday"],
            "best_hours": "10am-3pm local time",
            "avoid": "Mondays (busy), Fridays (early close)",
            "rate_limit": "1 call per 2 minutes (be polite)"
        }
    }

    return script


def print_bland_ai_setup():
    """Print setup instructions for Bland AI."""

    print("\n" + "=" * 70)
    print("BLAND AI SETUP INSTRUCTIONS")
    print("=" * 70)

    print("""
   1. Sign up at: https://www.bland.ai/

   2. Create a new Agent:
      - Name: "Storage Pricing Caller"
      - Voice: Natural, professional

   3. Configure the Pathway (Script):

      OPENING:
      "Hi, I'm looking for storage in the area and wanted to
      check on availability and pricing."

      QUESTION 1:
      "Do you have any 10 by 10 units available?"
      [Capture: availability_10x10 - yes/no/waitlist]

      QUESTION 2:
      "What's the monthly rate for a 10 by 10?"
      [Capture: rate_10x10 - dollar amount]

      QUESTION 3:
      "And what about a 10 by 20?"
      [Capture: rate_10x20 - dollar amount]

      QUESTION 4:
      "Do you have climate controlled units? What's the
      rate difference for those?"
      [Capture: has_climate - yes/no, climate_premium - dollar amount]

      QUESTION 5:
      "Are there any move-in specials right now?"
      [Capture: move_in_special - text]

      CLOSING:
      "Great, thank you so much for the information!"

   4. Upload facility_call_list.csv to start batch

   5. Download results CSV when complete

   6. Run: python build_ai_caller.py --import results.csv

   COST ESTIMATE:
   - ~200 facilities
   - ~90 seconds avg call
   - ~300 minutes total
   - ~$27-30 total (at $0.09/min)
""")


def print_vapi_setup():
    """Print setup instructions for Vapi."""

    print("\n" + "=" * 70)
    print("VAPI SETUP INSTRUCTIONS")
    print("=" * 70)

    print("""
   1. Sign up at: https://vapi.ai/

   2. Create an Assistant:
      - Name: "Storage Pricing Caller"
      - Model: gpt-4 or claude
      - Voice: Select natural voice

   3. Configure System Prompt:
      "You are calling storage facilities to gather pricing information.
       Be polite, professional, and concise. Extract the following:
       - 10x10 availability and rate
       - 10x20 rate
       - Climate control availability and premium
       - Move-in specials"

   4. Configure Functions to extract data:
      - rate_10x10 (integer)
      - rate_10x20 (integer)
      - has_climate_control (boolean)
      - climate_premium (integer)
      - move_in_special (string)

   5. API Integration:

      POST https://api.vapi.ai/call
      Headers:
        Authorization: Bearer YOUR_API_KEY
      Body:
        {
          "assistant_id": "YOUR_ASSISTANT_ID",
          "phone_number_id": "YOUR_PHONE_ID",
          "customer": {
            "number": "+1XXXXXXXXXX"
          },
          "metadata": {
            "facility_id": "123"
          }
        }

   6. Configure Webhook for results:
      - URL: Your endpoint
      - Events: call.ended

   COST ESTIMATE:
   - ~200 facilities
   - ~90 seconds avg call
   - ~300 minutes total
   - ~$15-20 total (at $0.05/min)
""")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='AI Caller for Facility Pricing')
    parser.add_argument('--setup', action='store_true', help='Run initial setup (add columns, create table)')
    parser.add_argument('--fetch-phones', action='store_true', help='Fetch phone numbers from Google Places')
    parser.add_argument('--phone-limit', type=int, help='Limit phone fetch to N facilities')
    parser.add_argument('--dry-run', action='store_true', help='Dry run (no database changes)')
    parser.add_argument('--export', action='store_true', help='Export call list to CSV')
    parser.add_argument('--export-file', type=str, default='facility_call_list.csv', help='Export filename')
    parser.add_argument('--import-file', type=str, help='Import call results from CSV')
    parser.add_argument('--caller', type=str, default='bland', help='Caller service (bland, vapi, manual)')
    parser.add_argument('--update', action='store_true', help='Update storage_facilities from call results')
    parser.add_argument('--report', action='store_true', help='Generate call report')
    parser.add_argument('--show-script', action='store_true', help='Show call script')
    parser.add_argument('--show-bland', action='store_true', help='Show Bland AI setup')
    parser.add_argument('--show-vapi', action='store_true', help='Show Vapi setup')
    parser.add_argument('--all', action='store_true', help='Run full pipeline (setup + fetch phones + export)')

    args = parser.parse_args()

    if args.all:
        add_missing_columns()
        create_call_results_table()
        fetch_phone_numbers(limit=args.phone_limit, dry_run=args.dry_run)
        export_call_list(args.export_file)
        print_bland_ai_setup()
        return

    if args.setup:
        add_missing_columns()
        create_call_results_table()

    if args.fetch_phones:
        fetch_phone_numbers(limit=args.phone_limit, dry_run=args.dry_run)

    if args.export:
        export_call_list(args.export_file)

    if args.import_file:
        import_call_results(args.import_file, args.caller)
        update_facilities_from_calls()
        generate_call_report()

    if args.update:
        update_facilities_from_calls()

    if args.report:
        generate_call_report()

    if args.show_script:
        import json
        print(json.dumps(get_call_script(), indent=2))

    if args.show_bland:
        print_bland_ai_setup()

    if args.show_vapi:
        print_vapi_setup()

    # If no args, show help
    if not any(vars(args).values()):
        parser.print_help()


if __name__ == "__main__":
    main()
