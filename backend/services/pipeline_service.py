"""
Screening Pipeline Service.
Orchestrates the 9-stage screening process for any zone.
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, List, Optional
import logging
import json
from datetime import datetime
from decimal import Decimal

logger = logging.getLogger(__name__)


def decimal_to_float(obj):
    """Convert Decimal to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [decimal_to_float(i) for i in obj]
    return obj

# Database connection
NEON_CONNECTION_STRING = os.environ.get(
    "NEON_CONNECTION_STRING",
    os.environ.get("DATABASE_URL", "")
)

# Default screening configuration
DEFAULT_CONFIG = {
    "LOT_SIZE_ACRES": 1,
    "UNITS_PER_ACRE": 120,
    "TARGET_RENT": 80,
    "TARGET_OCCUPANCY": 0.85,
    "OPEX_RATIO": 0.25,
    "MIN_YIELD": 0.12,
    "DEMAND_SQFT_PER_PERSON": 6,
    "RENTABLE_SQFT_PER_ACRE": 12000
}

# Kill switch thresholds by stage
KILL_THRESHOLDS = {
    # Stage 0: Geography
    "S0_URBAN_DENSITY": 3500,       # people/sq mi - kill if above
    "S0_DRIVE_TIME": 120,           # minutes to nearest metro

    # Stage 1: Demographics
    "S1_ZIP_POPULATION": 8000,      # minimum ZIP population
    "S1_5MI_POPULATION": 25000,     # minimum 5-mile radius pop
    "S1_INCOME": 40000,             # minimum median HH income
    "S1_POVERTY_RATE": 25,          # max poverty rate %
    "S1_GROWTH_RATE": 0,            # minimum growth rate %
    "S1_RENTER_PCT": 20,            # minimum renter percentage

    # Stage 2: Rough Saturation
    "S2_ROUGH_SATURATION": 1.4,     # max sq ft per capita

    # Stage 4: True Saturation
    "S4_TRUE_SATURATION": 1.1,      # max actual sq ft per capita
    "S4_SUPPORTABLE_ACRES": 1.0,    # min supportable acres

    # Stage 5: Pricing & Yield
    "S5_RENT_PSF": 0.70,            # min rent per sq ft
    "S5_YIELD": 0.12,               # min yield (12%)

    # Stage 6: Traffic & Access
    "S6_AADT": 10000,               # min avg annual daily traffic
    "S6_TURN_COUNT": 3,             # max turns from main road

    # Stage 7: Risk & Buildability
    "S7_FLOOD_PCT": 50,             # max % in flood zone
    "S7_CRIME_RATIO": 2.0           # max crime ratio vs national avg
}


class PipelineService:
    """Service for running the screening pipeline."""

    def __init__(self, connection_string: Optional[str] = None):
        """Initialize pipeline service with database connection."""
        self.conn_string = connection_string or NEON_CONNECTION_STRING
        self._conn = None

    @property
    def conn(self):
        """Get or create database connection."""
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self.conn_string)
        return self._conn

    def close(self):
        """Close database connection."""
        if self._conn:
            self._conn.close()

    def run_stage(self, run_id: str, stage: int) -> Dict[str, Any]:
        """
        Run a specific stage of the screening pipeline.

        Args:
            run_id: UUID of the screening run
            stage: Stage number (0-8)

        Returns:
            Dictionary with stage results
        """
        stage_methods = {
            0: self._run_stage_0_geography,
            1: self._run_stage_1_demographics,
            2: self._run_stage_2_rough_saturation,
            3: self._run_stage_3_zoning,
            4: self._run_stage_4_true_saturation,
            5: self._run_stage_5_pricing,
            6: self._run_stage_6_traffic,
            7: self._run_stage_7_risk,
            8: self._run_stage_8_scoring
        }

        if stage not in stage_methods:
            raise ValueError(f"Invalid stage: {stage}")

        logger.info(f"Running Stage {stage} for run {run_id}")
        return stage_methods[stage](run_id)

    def run_all_stages(self, run_id: str, stop_on_zero: bool = True) -> Dict[str, Any]:
        """
        Run all stages sequentially.

        Args:
            run_id: UUID of the screening run
            stop_on_zero: Stop if a stage results in zero survivors

        Returns:
            Dictionary with all stage results
        """
        results = {"run_id": run_id, "stages": {}}

        for stage in range(9):
            stage_result = self.run_stage(run_id, stage)
            results["stages"][f"stage_{stage}"] = stage_result

            if stop_on_zero and stage_result.get("survivors", 0) == 0:
                logger.warning(f"No survivors after Stage {stage}, stopping pipeline")
                break

        # Update run status
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE runs SET status = 'completed', ended_at = NOW()
            WHERE run_id = %s
        """, (run_id,))
        self.conn.commit()

        return results

    def _run_stage_0_geography(self, run_id: str) -> Dict[str, Any]:
        """Stage 0: Geography Filter - Urban density, MSA, drive time."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        # Get run config
        cursor.execute("SELECT config FROM runs WHERE run_id = %s", (run_id,))
        run = cursor.fetchone()
        thresholds = run['config'].get('kill_thresholds', KILL_THRESHOLDS)

        killed = 0
        survivors = 0
        kill_reasons = {"density": 0, "msa_core": 0, "drive_time": 0}

        # Get all pending ZIPs for this run with demographics
        # Using actual schema: stage_reached, killed, kill_stage, metrics
        cursor.execute("""
            SELECT zr.zip, zm.density, zm.population
            FROM zip_results zr
            JOIN zips_master zm ON zr.zip = zm.zip
            WHERE zr.run_id = %s AND (zr.stage_reached = 0 OR zr.stage_reached IS NULL) AND zr.killed = FALSE
        """, (run_id,))
        zips = cursor.fetchall()

        for z in zips:
            kill_reason = None
            stage_metrics = {}

            # Check urban density
            density = z['density'] or 0
            stage_metrics['density'] = density
            if density > thresholds['S0_URBAN_DENSITY']:
                kill_reason = f"urban_density_{density:.0f}"
                kill_reasons["density"] += 1

            # Note: MSA and drive time checks would require additional data
            # For now, we use density as the primary Stage 0 filter

            # Convert Decimals to floats for JSON
            stage_metrics = decimal_to_float(stage_metrics)

            if kill_reason:
                cursor.execute("""
                    UPDATE zip_results
                    SET killed = TRUE, kill_stage = 0, kill_reason = %s,
                        metrics = COALESCE(metrics, '{}'::jsonb) || %s
                    WHERE run_id = %s AND zip = %s
                """, (kill_reason, json.dumps({"S0": stage_metrics}), run_id, z['zip']))
                killed += 1
            else:
                cursor.execute("""
                    UPDATE zip_results
                    SET stage_reached = 1, metrics = COALESCE(metrics, '{}'::jsonb) || %s
                    WHERE run_id = %s AND zip = %s
                """, (json.dumps({"S0": stage_metrics}), run_id, z['zip']))
                survivors += 1

        self.conn.commit()

        # Log stage completion
        self._log_stage(run_id, 0, killed, survivors)

        return {
            "stage": 0,
            "name": "Geography Filter",
            "killed": killed,
            "survivors": survivors,
            "kill_reasons": kill_reasons
        }

    def _run_stage_1_demographics(self, run_id: str) -> Dict[str, Any]:
        """Stage 1: Demographics - Population, income, growth, renters."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("SELECT config FROM runs WHERE run_id = %s", (run_id,))
        run = cursor.fetchone()
        thresholds = run['config'].get('kill_thresholds', KILL_THRESHOLDS)

        killed = 0
        survivors = 0
        kill_reasons = {"population": 0, "income": 0, "poverty": 0, "renters": 0}

        # Get Stage 1 candidates
        cursor.execute("""
            SELECT zr.zip, zm.population, zm.income_household_median,
                   zm.home_ownership, zm.rent_median
            FROM zip_results zr
            JOIN zips_master zm ON zr.zip = zm.zip
            WHERE zr.run_id = %s AND zr.stage_reached = 1 AND zr.killed = FALSE
        """, (run_id,))
        zips = cursor.fetchall()

        for z in zips:
            kill_reason = None
            stage_metrics = {
                "population": z['population'],
                "income": z['income_household_median'],
                "home_ownership": z['home_ownership']
            }

            # Calculate renter percentage
            renter_pct = 100 - (z['home_ownership'] or 50)
            stage_metrics['renter_pct'] = renter_pct

            # Check population
            if (z['population'] or 0) < thresholds['S1_ZIP_POPULATION']:
                kill_reason = f"low_population_{z['population']}"
                kill_reasons["population"] += 1
            # Check income
            elif (z['income_household_median'] or 0) < thresholds['S1_INCOME']:
                kill_reason = f"low_income_{z['income_household_median']}"
                kill_reasons["income"] += 1
            # Check renter percentage
            elif renter_pct < thresholds['S1_RENTER_PCT']:
                kill_reason = f"low_renters_{renter_pct:.1f}pct"
                kill_reasons["renters"] += 1

            # Convert Decimals to floats for JSON
            stage_metrics = decimal_to_float(stage_metrics)

            if kill_reason:
                cursor.execute("""
                    UPDATE zip_results
                    SET killed = TRUE, kill_stage = 1, kill_reason = %s,
                        metrics = COALESCE(metrics, '{}'::jsonb) || %s
                    WHERE run_id = %s AND zip = %s
                """, (kill_reason, json.dumps({"S1": stage_metrics}), run_id, z['zip']))
                killed += 1
            else:
                cursor.execute("""
                    UPDATE zip_results
                    SET stage_reached = 2, metrics = COALESCE(metrics, '{}'::jsonb) || %s
                    WHERE run_id = %s AND zip = %s
                """, (json.dumps({"S1": stage_metrics}), run_id, z['zip']))
                survivors += 1

        self.conn.commit()
        self._log_stage(run_id, 1, killed, survivors)

        return {
            "stage": 1,
            "name": "Demographics",
            "killed": killed,
            "survivors": survivors,
            "kill_reasons": kill_reasons
        }

    def _run_stage_2_rough_saturation(self, run_id: str) -> Dict[str, Any]:
        """Stage 2: Rough Saturation - Facility count via Google Places."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        # Get Stage 2 candidates
        cursor.execute("""
            SELECT zr.zip, zm.population
            FROM zip_results zr
            JOIN zips_master zm ON zr.zip = zm.zip
            WHERE zr.run_id = %s AND zr.stage_reached = 2 AND zr.killed = FALSE
        """, (run_id,))
        zips = cursor.fetchall()

        killed = 0
        survivors = 0

        # Without Google API, we pass all through for now
        for z in zips:
            stage_metrics = {"note": "awaiting_google_api"}
            cursor.execute("""
                UPDATE zip_results
                SET stage_reached = 3, metrics = COALESCE(metrics, '{}'::jsonb) || %s
                WHERE run_id = %s AND zip = %s
            """, (json.dumps({"S2": stage_metrics}), run_id, z['zip']))
            survivors += 1

        self.conn.commit()
        self._log_stage(run_id, 2, killed, survivors)

        return {
            "stage": 2,
            "name": "Rough Saturation",
            "killed": killed,
            "survivors": survivors,
            "note": "Requires Google Places API key"
        }

    def _run_stage_3_zoning(self, run_id: str) -> Dict[str, Any]:
        """Stage 3: Zoning - Check for industrial/commercial zoning."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT zip FROM zip_results
            WHERE run_id = %s AND stage_reached = 3 AND killed = FALSE
        """, (run_id,))
        zips = cursor.fetchall()

        killed = 0
        survivors = 0

        # Without zoning data, pass all through
        for z in zips:
            stage_metrics = {"note": "awaiting_zoning_data"}
            cursor.execute("""
                UPDATE zip_results
                SET stage_reached = 4, metrics = COALESCE(metrics, '{}'::jsonb) || %s
                WHERE run_id = %s AND zip = %s
            """, (json.dumps({"S3": stage_metrics}), run_id, z['zip']))
            survivors += 1

        self.conn.commit()
        self._log_stage(run_id, 3, killed, survivors)

        return {
            "stage": 3,
            "name": "Zoning",
            "killed": killed,
            "survivors": survivors,
            "note": "Requires county GIS data"
        }

    def _run_stage_4_true_saturation(self, run_id: str) -> Dict[str, Any]:
        """Stage 4: True Saturation - Actual sq ft per capita."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT zip FROM zip_results
            WHERE run_id = %s AND stage_reached = 4 AND killed = FALSE
        """, (run_id,))
        zips = cursor.fetchall()

        killed = 0
        survivors = 0

        for z in zips:
            stage_metrics = {"note": "awaiting_radius_plus"}
            cursor.execute("""
                UPDATE zip_results
                SET stage_reached = 5, metrics = COALESCE(metrics, '{}'::jsonb) || %s
                WHERE run_id = %s AND zip = %s
            """, (json.dumps({"S4": stage_metrics}), run_id, z['zip']))
            survivors += 1

        self.conn.commit()
        self._log_stage(run_id, 4, killed, survivors)

        return {
            "stage": 4,
            "name": "True Saturation",
            "killed": killed,
            "survivors": survivors,
            "note": "Requires Radius+ API"
        }

    def _run_stage_5_pricing(self, run_id: str) -> Dict[str, Any]:
        """Stage 5: Pricing & Yield - Rent PSF, land prices, yield calc."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT zip FROM zip_results
            WHERE run_id = %s AND stage_reached = 5 AND killed = FALSE
        """, (run_id,))
        zips = cursor.fetchall()

        killed = 0
        survivors = 0

        for z in zips:
            stage_metrics = {"note": "awaiting_sparefoot_data"}
            cursor.execute("""
                UPDATE zip_results
                SET stage_reached = 6, metrics = COALESCE(metrics, '{}'::jsonb) || %s
                WHERE run_id = %s AND zip = %s
            """, (json.dumps({"S5": stage_metrics}), run_id, z['zip']))
            survivors += 1

        self.conn.commit()
        self._log_stage(run_id, 5, killed, survivors)

        return {
            "stage": 5,
            "name": "Pricing & Yield",
            "killed": killed,
            "survivors": survivors,
            "note": "Requires SpareFoot scraping"
        }

    def _run_stage_6_traffic(self, run_id: str) -> Dict[str, Any]:
        """Stage 6: Traffic & Access - AADT, visibility, turns."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT zip FROM zip_results
            WHERE run_id = %s AND stage_reached = 6 AND killed = FALSE
        """, (run_id,))
        zips = cursor.fetchall()

        killed = 0
        survivors = 0

        for z in zips:
            stage_metrics = {"note": "awaiting_dot_data"}
            cursor.execute("""
                UPDATE zip_results
                SET stage_reached = 7, metrics = COALESCE(metrics, '{}'::jsonb) || %s
                WHERE run_id = %s AND zip = %s
            """, (json.dumps({"S6": stage_metrics}), run_id, z['zip']))
            survivors += 1

        self.conn.commit()
        self._log_stage(run_id, 6, killed, survivors)

        return {
            "stage": 6,
            "name": "Traffic & Access",
            "killed": killed,
            "survivors": survivors,
            "note": "Requires DOT traffic data"
        }

    def _run_stage_7_risk(self, run_id: str) -> Dict[str, Any]:
        """Stage 7: Risk & Buildability - Flood, crime, wetlands."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT zip FROM zip_results
            WHERE run_id = %s AND stage_reached = 7 AND killed = FALSE
        """, (run_id,))
        zips = cursor.fetchall()

        killed = 0
        survivors = 0

        for z in zips:
            stage_metrics = {"note": "awaiting_fema_fbi_data"}
            cursor.execute("""
                UPDATE zip_results
                SET stage_reached = 8, metrics = COALESCE(metrics, '{}'::jsonb) || %s
                WHERE run_id = %s AND zip = %s
            """, (json.dumps({"S7": stage_metrics}), run_id, z['zip']))
            survivors += 1

        self.conn.commit()
        self._log_stage(run_id, 7, killed, survivors)

        return {
            "stage": 7,
            "name": "Risk & Buildability",
            "killed": killed,
            "survivors": survivors,
            "note": "Requires FEMA/FBI APIs"
        }

    def _run_stage_8_scoring(self, run_id: str) -> Dict[str, Any]:
        """Stage 8: Strategic Scoring - Final weighted scoring."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        # Get all survivors at Stage 8
        cursor.execute("""
            SELECT zr.zip, zr.metrics, zm.population, zm.income_household_median
            FROM zip_results zr
            JOIN zips_master zm ON zr.zip = zm.zip
            WHERE zr.run_id = %s AND zr.stage_reached = 8 AND zr.killed = FALSE
        """, (run_id,))
        zips = cursor.fetchall()

        scored = 0
        top_zips = []

        for z in zips:
            # Basic scoring based on available data
            pop_score = min((z['population'] or 0) / 50000 * 25, 25)
            income_score = min((z['income_household_median'] or 0) / 80000 * 25, 25)

            # Placeholder scores for missing data
            saturation_score = 15  # Would come from S4
            yield_score = 15       # Would come from S5
            traffic_score = 10     # Would come from S6
            risk_score = 10        # Would come from S7

            total_score = pop_score + income_score + saturation_score + yield_score + traffic_score + risk_score

            stage_metrics = {
                "pop_score": round(pop_score, 1),
                "income_score": round(income_score, 1),
                "total_score": round(total_score, 1)
            }

            cursor.execute("""
                UPDATE zip_results
                SET final_score = %s, scores = COALESCE(scores, '{}'::jsonb) || %s
                WHERE run_id = %s AND zip = %s
            """, (total_score, json.dumps({"S8": stage_metrics}), run_id, z['zip']))

            scored += 1
            top_zips.append({"zip": z['zip'], "score": round(total_score, 1)})

        # Sort and get top 20
        top_zips.sort(key=lambda x: x['score'], reverse=True)
        top_20 = top_zips[:20]

        self.conn.commit()
        self._log_stage(run_id, 8, 0, scored)

        return {
            "stage": 8,
            "name": "Strategic Scoring",
            "scored": scored,
            "top_20": top_20
        }

    def _log_stage(self, run_id: str, stage: int, killed: int, survivors: int):
        """Log stage completion to stage_log table."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO stage_log (run_id, stage, zips_input, zips_killed, zips_output, started_at, completed_at, status)
            VALUES (%s, %s, %s, %s, %s, NOW(), NOW(), 'completed')
        """, (run_id, stage, killed + survivors, killed, survivors))
        self.conn.commit()

    def get_run_status(self, run_id: str) -> Dict[str, Any]:
        """Get current status of a run."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        # Get run info
        cursor.execute("""
            SELECT run_id, target_states, status, total_zips, created_at, ended_at, config
            FROM runs WHERE run_id = %s
        """, (run_id,))
        run = cursor.fetchone()

        if not run:
            return {"error": "Run not found"}

        # Get stage counts (using stage_reached column)
        cursor.execute("""
            SELECT stage_reached, COUNT(*) as count
            FROM zip_results
            WHERE run_id = %s AND killed = FALSE
            GROUP BY stage_reached
            ORDER BY stage_reached
        """, (run_id,))
        stages = cursor.fetchall()

        # Get killed counts by stage (using kill_stage column)
        cursor.execute("""
            SELECT kill_stage, COUNT(*) as count
            FROM zip_results
            WHERE run_id = %s AND killed = TRUE
            GROUP BY kill_stage
            ORDER BY kill_stage
        """, (run_id,))
        killed = cursor.fetchall()

        return {
            "run_id": str(run['run_id']),
            "status": run['status'],
            "total_zips": run['total_zips'],
            "target_states": run['target_states'],
            "created_at": str(run['created_at']),
            "ended_at": str(run['ended_at']) if run['ended_at'] else None,
            "active_by_stage": {s['stage_reached']: s['count'] for s in stages},
            "killed_by_stage": {k['kill_stage']: k['count'] for k in killed}
        }

    def get_survivors(self, run_id: str, min_score: float = 0) -> List[Dict]:
        """Get all surviving ZIPs with scores."""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT zr.zip, zr.final_score, zr.metrics,
                   zm.city, zm.state, zm.county_name, zm.population,
                   zm.income_household_median
            FROM zip_results zr
            JOIN zips_master zm ON zr.zip = zm.zip
            WHERE zr.run_id = %s
            AND zr.killed = FALSE
            AND (zr.final_score >= %s OR zr.final_score IS NULL)
            ORDER BY zr.final_score DESC NULLS LAST
        """, (run_id, min_score))

        return [dict(row) for row in cursor.fetchall()]


# Convenience functions
def run_zone_screening(zone_id: int, connection_string: Optional[str] = None) -> Dict[str, Any]:
    """
    Run complete screening for a zone.

    Args:
        zone_id: Zone ID from target_zones
        connection_string: Optional database connection string

    Returns:
        Dictionary with run results

    Example:
        results = run_zone_screening(1)
        print(f"Top ZIPs: {results['stages']['stage_8']['top_20']}")
    """
    from backend.services.zone_service import ZoneService

    zone_svc = ZoneService(connection_string)
    pipeline = PipelineService(connection_string)

    try:
        # Start run for zone
        run_id = zone_svc.start_zone_run(zone_id)

        # Run all stages
        results = pipeline.run_all_stages(run_id)

        return results
    finally:
        zone_svc.close()
        pipeline.close()


def create_and_run_zone(center_zip: str, radius_miles: int = 120,
                        connection_string: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a zone from a ZIP code and run full screening.

    Args:
        center_zip: Center ZIP code
        radius_miles: Radius in miles
        connection_string: Optional database connection string

    Returns:
        Dictionary with zone info and screening results

    Example:
        results = create_and_run_zone("15522", 120)
        print(f"Zone: {results['zone']['zone_name']}")
        print(f"Top ZIPs: {results['screening']['stages']['stage_8']['top_20']}")
    """
    from backend.services.zone_service import ZoneService

    zone_svc = ZoneService(connection_string)
    pipeline = PipelineService(connection_string)

    try:
        # Create zone
        zone = zone_svc.create_zone(center_zip, radius_miles)

        # Start and run screening
        run_id = zone_svc.start_zone_run(zone['zone_id'])
        screening = pipeline.run_all_stages(run_id)

        return {
            "zone": zone,
            "run_id": run_id,
            "screening": screening
        }
    finally:
        zone_svc.close()
        pipeline.close()
