#!/usr/bin/env python3
"""
Utility functions for Neon PostgreSQL database operations
ZIP Code Screener System
"""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
import os

# Connection string - use environment variable in production
CONN_STRING = os.getenv(
    'NEON_CONNECTION_STRING',
    "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
)


class NeonDB:
    """Database connection and operations wrapper"""

    def __init__(self, connection_string: str = CONN_STRING):
        self.connection_string = connection_string
        self.conn = None

    def connect(self):
        """Establish database connection"""
        if not self.conn or self.conn.closed:
            self.conn = psycopg2.connect(self.connection_string)
            self.conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        return self.conn

    def close(self):
        """Close database connection"""
        if self.conn and not self.conn.closed:
            self.conn.close()

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    # ========== RUN OPERATIONS ==========

    def start_run(self, target_states: List[str], config: Dict[str, Any], created_by: str = 'system') -> str:
        """
        Start a new screening run

        Args:
            target_states: List of state codes (e.g., ['TX', 'FL'])
            config: Configuration dictionary
            created_by: User identifier

        Returns:
            UUID string of the new run
        """
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT start_run(%s::VARCHAR[], %s::JSONB, %s)",
                (target_states, json.dumps(config), created_by)
            )
            run_id = cur.fetchone()[0]
            return str(run_id)

    def complete_run(self, run_id: str):
        """Mark a run as complete"""
        with self.conn.cursor() as cur:
            cur.execute("SELECT complete_run(%s::UUID)", (run_id,))

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get run details"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM runs WHERE run_id = %s::UUID",
                (run_id,)
            )
            result = cur.fetchone()
            return dict(result) if result else None

    def list_runs(self, status: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """List runs, optionally filtered by status"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            if status:
                cur.execute(
                    "SELECT * FROM runs WHERE status = %s ORDER BY created_at DESC LIMIT %s",
                    (status, limit)
                )
            else:
                cur.execute(
                    "SELECT * FROM runs ORDER BY created_at DESC LIMIT %s",
                    (limit,)
                )
            return [dict(row) for row in cur.fetchall()]

    def get_run_progress(self, run_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get run progress view data"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            if run_id:
                cur.execute(
                    "SELECT * FROM v_run_progress WHERE run_id = %s::UUID",
                    (run_id,)
                )
            else:
                cur.execute("SELECT * FROM v_run_progress LIMIT 10")
            return [dict(row) for row in cur.fetchall()]

    # ========== ZIP OPERATIONS ==========

    def kill_zip(self, run_id: str, zip_code: str, stage: int, step: str,
                 reason: str, threshold: float, value: float):
        """Mark a ZIP code as eliminated"""
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT kill_zip(%s::UUID, %s, %s, %s, %s, %s, %s)",
                (run_id, zip_code, stage, step, reason, threshold, value)
            )

    def update_zip_metrics(self, run_id: str, zip_code: str, stage: int, metrics: Dict[str, Any]):
        """Update metrics for a ZIP code"""
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT update_zip_metrics(%s::UUID, %s, %s, %s::JSONB)",
                (run_id, zip_code, stage, json.dumps(metrics))
            )

    def get_zip_result(self, run_id: str, zip_code: str) -> Optional[Dict[str, Any]]:
        """Get result for a specific ZIP in a run"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM zip_results WHERE run_id = %s::UUID AND zip = %s",
                (run_id, zip_code)
            )
            result = cur.fetchone()
            return dict(result) if result else None

    def get_surviving_zips(self, run_id: str) -> List[Dict[str, Any]]:
        """Get all surviving (non-killed) ZIPs for a run"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM zip_results WHERE run_id = %s::UUID AND killed = FALSE",
                (run_id,)
            )
            return [dict(row) for row in cur.fetchall()]

    def get_killed_zips(self, run_id: str, stage: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get killed ZIPs, optionally filtered by stage"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            if stage is not None:
                cur.execute(
                    "SELECT * FROM zip_results WHERE run_id = %s::UUID AND killed = TRUE AND kill_stage = %s",
                    (run_id, stage)
                )
            else:
                cur.execute(
                    "SELECT * FROM zip_results WHERE run_id = %s::UUID AND killed = TRUE",
                    (run_id,)
                )
            return [dict(row) for row in cur.fetchall()]

    # ========== STAGE OPERATIONS ==========

    def log_stage(self, run_id: str, stage: int, zips_input: int, zips_output: int):
        """Log completion of a stage"""
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT log_stage(%s::UUID, %s, %s, %s)",
                (run_id, stage, zips_input, zips_output)
            )

    def get_stage_logs(self, run_id: str) -> List[Dict[str, Any]]:
        """Get all stage logs for a run"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM stage_log WHERE run_id = %s::UUID ORDER BY stage",
                (run_id,)
            )
            return [dict(row) for row in cur.fetchall()]

    # ========== TIER OPERATIONS ==========

    def assign_tiers(self, run_id: str, tier1_count: int = 20, tier2_count: int = 30):
        """Assign tier rankings to ZIPs"""
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT assign_tiers(%s::UUID, %s, %s)",
                (run_id, tier1_count, tier2_count)
            )

    def get_tier1_zips(self, run_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get Tier 1 ZIPs"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            if run_id:
                cur.execute(
                    "SELECT * FROM v_tier1 WHERE run_id = %s::UUID",
                    (run_id,)
                )
            else:
                cur.execute("SELECT * FROM v_tier1 LIMIT 20")
            return [dict(row) for row in cur.fetchall()]

    def get_tier2_zips(self, run_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get Tier 2 ZIPs"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            if run_id:
                cur.execute(
                    "SELECT * FROM v_tier2 WHERE run_id = %s::UUID",
                    (run_id,)
                )
            else:
                cur.execute("SELECT * FROM v_tier2 LIMIT 30")
            return [dict(row) for row in cur.fetchall()]

    def get_kill_summary(self, run_id: str) -> List[Dict[str, Any]]:
        """Get kill summary statistics"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM v_kill_summary WHERE run_id = %s::UUID",
                (run_id,)
            )
            return [dict(row) for row in cur.fetchall()]

    # ========== CACHE OPERATIONS ==========

    def get_zoning(self, county_fips: str) -> Optional[Dict[str, Any]]:
        """Get cached zoning data for a county"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM zoning_cache WHERE county_fips = %s",
                (county_fips,)
            )
            result = cur.fetchone()
            return dict(result) if result else None

    def set_zoning(self, county_fips: str, state: str, data: Dict[str, Any]):
        """Set/update zoning cache data"""
        with self.conn.cursor() as cur:
            cur.execute("""
                INSERT INTO zoning_cache (
                    county_fips, state, county_name, storage_allowed, moratorium,
                    conditional_notes, source_url, notes, researched_by, researched_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (county_fips) DO UPDATE SET
                    state = EXCLUDED.state,
                    county_name = EXCLUDED.county_name,
                    storage_allowed = EXCLUDED.storage_allowed,
                    moratorium = EXCLUDED.moratorium,
                    conditional_notes = EXCLUDED.conditional_notes,
                    source_url = EXCLUDED.source_url,
                    notes = EXCLUDED.notes,
                    researched_by = EXCLUDED.researched_by,
                    researched_at = EXCLUDED.researched_at,
                    updated_at = NOW()
            """, (
                county_fips, state, data.get('county_name'), data.get('storage_allowed'),
                data.get('moratorium', False), data.get('conditional_notes'),
                data.get('source_url'), data.get('notes'), data.get('researched_by'),
                data.get('researched_at')
            ))

    def get_api_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached API response"""
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM api_cache WHERE cache_key = %s AND (expires_at IS NULL OR expires_at > NOW())",
                (cache_key,)
            )
            result = cur.fetchone()
            return dict(result) if result else None

    def set_api_cache(self, cache_key: str, endpoint: str, request_params: Dict[str, Any],
                      response: Dict[str, Any], expires_at: Optional[datetime] = None):
        """Set API cache entry"""
        with self.conn.cursor() as cur:
            cur.execute("""
                INSERT INTO api_cache (cache_key, endpoint, request_params, response, expires_at)
                VALUES (%s, %s, %s::JSONB, %s::JSONB, %s)
                ON CONFLICT (cache_key) DO UPDATE SET
                    endpoint = EXCLUDED.endpoint,
                    request_params = EXCLUDED.request_params,
                    response = EXCLUDED.response,
                    fetched_at = NOW(),
                    expires_at = EXCLUDED.expires_at
            """, (
                cache_key, endpoint, json.dumps(request_params),
                json.dumps(response), expires_at
            ))


# ========== COMMAND LINE INTERFACE ==========

def main():
    """CLI for testing database operations"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python neon_db_utils.py <command> [args...]")
        print("\nCommands:")
        print("  list_runs [status]           - List runs")
        print("  get_run <run_id>             - Get run details")
        print("  get_progress [run_id]        - Get run progress")
        print("  get_tier1 [run_id]           - Get Tier 1 ZIPs")
        print("  get_tier2 [run_id]           - Get Tier 2 ZIPs")
        print("  get_kill_summary <run_id>    - Get kill statistics")
        print("  get_stage_logs <run_id>      - Get stage logs")
        return

    command = sys.argv[1]

    with NeonDB() as db:
        if command == 'list_runs':
            status = sys.argv[2] if len(sys.argv) > 2 else None
            runs = db.list_runs(status=status)
            print(json.dumps(runs, indent=2, default=str))

        elif command == 'get_run':
            if len(sys.argv) < 3:
                print("Error: run_id required")
                return
            run = db.get_run(sys.argv[2])
            print(json.dumps(run, indent=2, default=str))

        elif command == 'get_progress':
            run_id = sys.argv[2] if len(sys.argv) > 2 else None
            progress = db.get_run_progress(run_id)
            print(json.dumps(progress, indent=2, default=str))

        elif command == 'get_tier1':
            run_id = sys.argv[2] if len(sys.argv) > 2 else None
            tier1 = db.get_tier1_zips(run_id)
            print(json.dumps(tier1, indent=2, default=str))

        elif command == 'get_tier2':
            run_id = sys.argv[2] if len(sys.argv) > 2 else None
            tier2 = db.get_tier2_zips(run_id)
            print(json.dumps(tier2, indent=2, default=str))

        elif command == 'get_kill_summary':
            if len(sys.argv) < 3:
                print("Error: run_id required")
                return
            summary = db.get_kill_summary(sys.argv[2])
            print(json.dumps(summary, indent=2, default=str))

        elif command == 'get_stage_logs':
            if len(sys.argv) < 3:
                print("Error: run_id required")
                return
            logs = db.get_stage_logs(sys.argv[2])
            print(json.dumps(logs, indent=2, default=str))

        else:
            print(f"Unknown command: {command}")


if __name__ == '__main__':
    main()
