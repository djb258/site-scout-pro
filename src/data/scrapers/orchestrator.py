"""
HIVE Scraper Orchestrator
Manages scraper execution, scheduling, and database operations
"""

import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import psycopg2
from psycopg2.extras import RealDictCursor, Json

from .frederick_energov import FrederickEnerGovScraper
from .jefferson_mgo import JeffersonMGOScraper
from .berkeley_onestop import BerkeleyOneStopScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('hive_orchestrator')

# Database connection
CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Kill switch settings
MAX_CONSECUTIVE_ERRORS = 3
ERROR_COOLDOWN_HOURS = 24


class HiveScraperOrchestrator:
    """
    Orchestrates scraper execution across all jurisdictions

    Features:
    - Database upsert operations
    - Pipeline status determination
    - Kill switch for failing scrapers
    - Run logging
    """

    def __init__(self):
        self.conn = psycopg2.connect(CONNECTION_STRING)
        self.scrapers = {
            'VA-FREDERICK': FrederickEnerGovScraper(),
            'WV-JEFFERSON': JeffersonMGOScraper(),
            'WV-BERKELEY': BerkeleyOneStopScraper()
        }

    def get_cursor(self) -> RealDictCursor:
        """Get a database cursor"""
        return self.conn.cursor(cursor_factory=RealDictCursor)

    def run_scraper(self, jurisdiction_id: str, run_type: str = 'INCREMENTAL') -> Dict:
        """
        Execute scraper for a single jurisdiction

        Args:
            jurisdiction_id: Target jurisdiction (e.g., 'VA-FREDERICK')
            run_type: FULL (365 days), MONTHLY_REPORT (31 days), INCREMENTAL (7 days)

        Returns:
            Dict with run results
        """
        run_id = self._log_run_start(jurisdiction_id, run_type)

        result = {
            'jurisdiction_id': jurisdiction_id,
            'run_id': run_id,
            'run_type': run_type,
            'status': 'FAILED',
            'found': 0,
            'inserted': 0,
            'updated': 0,
            'errors': []
        }

        try:
            # Check kill switch
            if self._check_kill_switch(jurisdiction_id):
                raise Exception("Kill switch active - too many consecutive failures")

            # Get scraper
            scraper = self.scrapers.get(jurisdiction_id)
            if not scraper:
                raise ValueError(f"No scraper configured for {jurisdiction_id}")

            # Determine date range
            days_back = {
                'FULL': 365,
                'MONTHLY_REPORT': 31,
                'INCREMENTAL': 7
            }.get(run_type, 7)

            logger.info(f"Running {run_type} scrape for {jurisdiction_id} ({days_back} days back)")

            # Extract permits
            permits = scraper.extract_housing_permits(days_back)
            result['found'] = len(permits)

            # Insert to database
            inserted, updated = self._upsert_permits(permits)
            result['inserted'] = inserted
            result['updated'] = updated

            # Log success
            self._log_run_complete(run_id, len(permits), inserted, updated)
            result['status'] = 'SUCCESS'

            logger.info(f"{jurisdiction_id}: {len(permits)} found, {inserted} inserted, {updated} updated")

        except Exception as e:
            error_msg = str(e)
            logger.error(f"{jurisdiction_id} scraper failed: {error_msg}")
            self._log_run_error(run_id, error_msg)
            result['errors'].append(error_msg)

        return result

    def _upsert_permits(self, permits: List[Dict]) -> Tuple[int, int]:
        """Insert or update permits in database"""
        cursor = self.get_cursor()
        inserted = 0
        updated = 0

        for p in permits:
            try:
                # Check if exists
                cursor.execute("""
                    SELECT raw_id FROM permit_raw
                    WHERE jurisdiction_id = %s AND permit_number = %s
                """, (p['jurisdiction_id'], p['permit_number']))
                existing = cursor.fetchone()

                # Clean raw_json for JSONB
                raw_json = p.get('raw_json', {})
                if 'inspections' in p:
                    raw_json['inspections'] = p['inspections']

                if existing:
                    # Update existing record
                    cursor.execute("""
                        UPDATE permit_raw SET
                            permit_status = %(permit_status)s,
                            final_date = %(final_date)s,
                            inspection_count = %(inspection_count)s,
                            last_inspection_date = %(last_inspection_date)s,
                            last_inspection_type = %(last_inspection_type)s,
                            last_inspection_result = %(last_inspection_result)s,
                            raw_json = %(raw_json)s,
                            scraped_at = NOW(),
                            processed = FALSE
                        WHERE jurisdiction_id = %(jurisdiction_id)s
                        AND permit_number = %(permit_number)s
                    """, {
                        'permit_status': p.get('permit_status'),
                        'final_date': p.get('final_date'),
                        'inspection_count': p.get('inspection_count', 0),
                        'last_inspection_date': p.get('last_inspection_date'),
                        'last_inspection_type': p.get('last_inspection_type'),
                        'last_inspection_result': p.get('last_inspection_result'),
                        'raw_json': Json(raw_json),
                        'jurisdiction_id': p['jurisdiction_id'],
                        'permit_number': p['permit_number']
                    })
                    updated += 1
                else:
                    # Insert new record
                    cursor.execute("""
                        INSERT INTO permit_raw (
                            jurisdiction_id, source_system, permit_number, permit_type,
                            permit_subtype, permit_status, application_date, issue_date,
                            final_date, expiration_date, property_address, parcel_id,
                            owner_name, contractor_name, project_description, estimated_cost,
                            square_footage, unit_count, stories, inspection_count,
                            last_inspection_date, last_inspection_type,
                            last_inspection_result, raw_json
                        ) VALUES (
                            %(jurisdiction_id)s, %(source_system)s, %(permit_number)s,
                            %(permit_type)s, %(permit_subtype)s, %(permit_status)s,
                            %(application_date)s, %(issue_date)s, %(final_date)s,
                            %(expiration_date)s, %(property_address)s, %(parcel_id)s,
                            %(owner_name)s, %(contractor_name)s, %(project_description)s,
                            %(estimated_cost)s, %(square_footage)s, %(unit_count)s,
                            %(stories)s, %(inspection_count)s, %(last_inspection_date)s,
                            %(last_inspection_type)s, %(last_inspection_result)s, %(raw_json)s
                        )
                    """, {
                        **p,
                        'raw_json': Json(raw_json),
                        'inspection_count': p.get('inspection_count', 0),
                        'stories': p.get('stories'),
                        'expiration_date': p.get('expiration_date')
                    })
                    inserted += 1

            except Exception as e:
                logger.warning(f"Error upserting permit {p.get('permit_number')}: {e}")
                continue

        self.conn.commit()
        return inserted, updated

    def process_to_pipeline(self) -> int:
        """
        Process raw permits to housing pipeline table

        Determines pipeline status based on inspections:
        - GREEN: Permitted (no inspections)
        - YELLOW: Site work begun (foundation passed)
        - RED: Vertical construction (framing passed)
        """
        cursor = self.get_cursor()
        processed_count = 0

        # Get unprocessed residential permits
        cursor.execute("""
            SELECT pr.*, ptm.normalized_type, ptm.include_in_pipeline
            FROM permit_raw pr
            LEFT JOIN permit_type_mapping ptm
                ON pr.source_system = ptm.source_system
                AND pr.permit_type = ptm.source_type
            WHERE pr.processed = FALSE
            AND (ptm.include_in_pipeline = TRUE OR ptm.include_in_pipeline IS NULL)
        """)
        unprocessed = cursor.fetchall()

        for permit in unprocessed:
            try:
                # Determine pipeline status from inspections
                raw_json = permit.get('raw_json', {})
                inspections = raw_json.get('inspections', []) if raw_json else []
                status = self._determine_pipeline_status(inspections)

                # Calculate demand factor (6 sqft per unit)
                unit_count = permit.get('unit_count') or 1
                demand_factor = unit_count * 6.0

                # Project type
                project_type = permit.get('normalized_type') or 'SINGLE_FAMILY'

                # Upsert to housing pipeline
                cursor.execute("""
                    INSERT INTO scraper_housing_pipeline (
                        jurisdiction_id, permit_number, property_address, parcel_id,
                        project_type, unit_count, square_footage, pipeline_status,
                        permit_date, demand_factor_sqft
                    ) VALUES (
                        %(jurisdiction_id)s, %(permit_number)s, %(property_address)s,
                        %(parcel_id)s, %(project_type)s, %(unit_count)s, %(square_footage)s,
                        %(status)s, %(issue_date)s, %(demand_factor)s
                    )
                    ON CONFLICT (jurisdiction_id, permit_number) DO UPDATE SET
                        pipeline_status = EXCLUDED.pipeline_status,
                        updated_at = NOW()
                """, {
                    'jurisdiction_id': permit['jurisdiction_id'],
                    'permit_number': permit['permit_number'],
                    'property_address': permit['property_address'],
                    'parcel_id': permit['parcel_id'],
                    'project_type': project_type,
                    'unit_count': unit_count,
                    'square_footage': permit.get('square_footage'),
                    'status': status,
                    'issue_date': permit.get('issue_date'),
                    'demand_factor': demand_factor
                })

                # Mark as processed
                cursor.execute(
                    "UPDATE permit_raw SET processed = TRUE WHERE raw_id = %s",
                    (permit['raw_id'],)
                )
                processed_count += 1

            except Exception as e:
                logger.warning(f"Error processing permit {permit.get('permit_number')}: {e}")
                continue

        self.conn.commit()
        logger.info(f"Processed {processed_count} permits to pipeline")
        return processed_count

    def _determine_pipeline_status(self, inspections: List[Dict]) -> str:
        """Determine pipeline status based on inspection history"""
        if not inspections:
            return 'GREEN'

        passed_types = []
        for i in inspections:
            result = str(i.get('Result', '') or i.get('result', '')).upper()
            if result in ['PASS', 'PASSED', 'APPROVED']:
                insp_type = str(i.get('InspectionType', '') or i.get('inspection_type', '')).lower()
                passed_types.append(insp_type)

        passed_str = ' '.join(passed_types)

        # Red indicators (vertical construction)
        red_keywords = ['framing', 'rough', 'electrical rough', 'plumbing rough',
                       'hvac rough', 'sheathing', 'roof', 'drywall']
        if any(kw in passed_str for kw in red_keywords):
            return 'RED'

        # Yellow indicators (site work)
        yellow_keywords = ['foundation', 'footing', 'slab', 'footer',
                          'excavation', 'grade', 'erosion']
        if any(kw in passed_str for kw in yellow_keywords):
            return 'YELLOW'

        return 'GREEN'

    def _check_kill_switch(self, jurisdiction_id: str) -> bool:
        """Check if scraper should be disabled due to consecutive errors"""
        cursor = self.get_cursor()
        cursor.execute("""
            SELECT status FROM scraper_runs
            WHERE jurisdiction_id = %s
            ORDER BY started_at DESC
            LIMIT %s
        """, (jurisdiction_id, MAX_CONSECUTIVE_ERRORS))
        recent_runs = cursor.fetchall()

        if len(recent_runs) >= MAX_CONSECUTIVE_ERRORS:
            if all(r['status'] == 'FAILED' for r in recent_runs):
                logger.warning(f"Kill switch triggered for {jurisdiction_id}")
                return True

        # Check cooldown
        cursor.execute("""
            SELECT completed_at FROM scraper_runs
            WHERE jurisdiction_id = %s AND status = 'FAILED'
            ORDER BY completed_at DESC LIMIT 1
        """, (jurisdiction_id,))
        last_error = cursor.fetchone()

        if last_error and last_error['completed_at']:
            cooldown_until = last_error['completed_at'] + timedelta(hours=ERROR_COOLDOWN_HOURS)
            if datetime.now() < cooldown_until:
                logger.info(f"Skipping {jurisdiction_id} - in cooldown until {cooldown_until}")
                return True

        return False

    def _log_run_start(self, jurisdiction_id: str, run_type: str) -> int:
        """Log scraper run start"""
        cursor = self.get_cursor()
        scraper = self.scrapers.get(jurisdiction_id)
        source_system = scraper.source_system if scraper else 'UNKNOWN'

        cursor.execute("""
            INSERT INTO scraper_runs (jurisdiction_id, source_system, run_type, started_at, status)
            VALUES (%s, %s, %s, NOW(), 'RUNNING')
            RETURNING run_id
        """, (jurisdiction_id, source_system, run_type))
        self.conn.commit()
        return cursor.fetchone()['run_id']

    def _log_run_complete(self, run_id: int, found: int, inserted: int, updated: int):
        """Log successful completion"""
        cursor = self.get_cursor()
        cursor.execute("""
            UPDATE scraper_runs SET
                completed_at = NOW(),
                records_found = %s,
                records_inserted = %s,
                records_updated = %s,
                status = 'SUCCESS'
            WHERE run_id = %s
        """, (found, inserted, updated, run_id))
        self.conn.commit()

    def _log_run_error(self, run_id: int, error: str):
        """Log error"""
        cursor = self.get_cursor()
        cursor.execute("""
            UPDATE scraper_runs SET
                completed_at = NOW(),
                errors = 1,
                error_details = %s,
                status = 'FAILED'
            WHERE run_id = %s
        """, (Json({'error': error}), run_id))
        self.conn.commit()

    def run_all(self, run_type: str = 'INCREMENTAL') -> List[Dict]:
        """Run scrapers for all configured jurisdictions"""
        results = []
        for jurisdiction_id in self.scrapers.keys():
            result = self.run_scraper(jurisdiction_id, run_type)
            results.append(result)
            time.sleep(5)  # Pause between jurisdictions
        return results

    def get_scraper_health(self) -> List[Dict]:
        """Get health status for all scrapers"""
        cursor = self.get_cursor()
        cursor.execute("""
            SELECT
                jurisdiction_id,
                COUNT(*) as total_runs,
                SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successes,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failures,
                MAX(completed_at) as last_run
            FROM scraper_runs
            WHERE started_at > NOW() - INTERVAL '30 days'
            GROUP BY jurisdiction_id
        """)
        return cursor.fetchall()

    def get_pipeline_summary(self) -> List[Dict]:
        """Get pipeline summary by jurisdiction and status"""
        cursor = self.get_cursor()
        cursor.execute("""
            SELECT
                jurisdiction_id,
                pipeline_status,
                project_type,
                COUNT(*) as count,
                SUM(unit_count) as total_units,
                SUM(demand_factor_sqft) as total_demand_sqft
            FROM scraper_housing_pipeline
            GROUP BY jurisdiction_id, pipeline_status, project_type
            ORDER BY jurisdiction_id, pipeline_status
        """)
        return cursor.fetchall()

    def close(self):
        """Close database connection"""
        self.conn.close()


def main():
    """Main entry point for running scrapers"""
    import argparse

    parser = argparse.ArgumentParser(description='HIVE Permit Scraper Orchestrator')
    parser.add_argument('--jurisdiction', '-j', help='Specific jurisdiction to scrape')
    parser.add_argument('--run-type', '-t', default='INCREMENTAL',
                       choices=['FULL', 'MONTHLY_REPORT', 'INCREMENTAL'],
                       help='Type of scrape run')
    parser.add_argument('--process', '-p', action='store_true',
                       help='Process raw permits to pipeline')
    parser.add_argument('--health', action='store_true',
                       help='Show scraper health status')
    parser.add_argument('--summary', action='store_true',
                       help='Show pipeline summary')

    args = parser.parse_args()

    orchestrator = HiveScraperOrchestrator()

    try:
        if args.health:
            print("\nScraper Health (Last 30 Days)")
            print("=" * 60)
            health = orchestrator.get_scraper_health()
            for h in health:
                print(f"{h['jurisdiction_id']}: {h['successes']}/{h['total_runs']} success, last run: {h['last_run']}")

        elif args.summary:
            print("\nPipeline Summary")
            print("=" * 60)
            summary = orchestrator.get_pipeline_summary()
            for s in summary:
                print(f"{s['jurisdiction_id']} | {s['pipeline_status']} | {s['project_type']}: {s['count']} permits, {s['total_units']} units")

        elif args.process:
            print("Processing raw permits to pipeline...")
            count = orchestrator.process_to_pipeline()
            print(f"Processed {count} permits")

        elif args.jurisdiction:
            print(f"Running {args.run_type} scrape for {args.jurisdiction}")
            result = orchestrator.run_scraper(args.jurisdiction, args.run_type)
            print(f"Result: {result}")

        else:
            print(f"Running {args.run_type} scrape for all jurisdictions")
            results = orchestrator.run_all(args.run_type)
            for r in results:
                print(f"{r['jurisdiction_id']}: {r['status']} - {r['found']} found, {r['inserted']} inserted")

    finally:
        orchestrator.close()


if __name__ == "__main__":
    main()
