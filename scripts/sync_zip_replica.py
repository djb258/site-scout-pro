#!/usr/bin/env python3
"""
ZIP Replica Sync Script

Syncs ref.ref_zip from Neon (authoritative) to Lovable.DAVE (execution cache).
This is a MANUAL sync operation - no auto-sync allowed per doctrine.

Doctrine: SS.REF.SYNC.01
"""
import os
import sys
import json
import argparse
from datetime import datetime
from typing import Dict, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import httpx

# Configuration
NEON_DATABASE_URL = os.environ.get('NEON_DATABASE_URL') or os.environ.get('DATABASE_URL')
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

# Fallback for development
if not NEON_DATABASE_URL:
    NEON_DATABASE_URL = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"


def get_neon_connection():
    """Connect to Neon (authoritative source)."""
    return psycopg2.connect(NEON_DATABASE_URL, cursor_factory=RealDictCursor)


def fetch_neon_data() -> Dict[str, Any]:
    """Fetch all ZIP and state data from Neon."""
    conn = get_neon_connection()

    with conn.cursor() as cur:
        # Fetch states
        cur.execute("""
            SELECT state_id, country_id, state_code, state_name
            FROM ref.ref_state
            ORDER BY state_id
        """)
        states = [dict(row) for row in cur.fetchall()]

        # Fetch ZIPs
        cur.execute("""
            SELECT zip_id, state_id, lat, lon
            FROM ref.ref_zip
            ORDER BY zip_id
        """)
        zips = [dict(row) for row in cur.fetchall()]

        # Get counts
        cur.execute("SELECT COUNT(*) FROM ref.ref_zip")
        zip_count = cur.fetchone()['count']

        cur.execute("SELECT COUNT(*) FROM ref.ref_state")
        state_count = cur.fetchone()['count']

    conn.close()

    return {
        'states': states,
        'zips': zips,
        'zip_count': zip_count,
        'state_count': state_count
    }


def sync_to_lovable(
    version: str,
    operator: str,
    data: Dict[str, Any],
    dry_run: bool = False
) -> Dict[str, Any]:
    """Sync data to Lovable via Supabase RPC."""

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")

    # Prepare payload
    payload = {
        'p_version': version,
        'p_synced_by': operator,
        'p_zip_data': data['zips'],
        'p_state_data': data['states']
    }

    if dry_run:
        return {
            'success': True,
            'dry_run': True,
            'version': version,
            'zip_count': len(data['zips']),
            'state_count': len(data['states'])
        }

    # Call Supabase RPC function
    url = f"{SUPABASE_URL}/rest/v1/rpc/sync_zip_replica_from_neon"
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json'
    }

    response = httpx.post(url, json=payload, headers=headers, timeout=300)

    if response.status_code != 200:
        raise Exception(f"Sync failed: {response.status_code} - {response.text}")

    return response.json()


def validate_sync(version: str) -> Dict[str, Any]:
    """Validate the sync completed successfully."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return {'valid': False, 'error': 'Supabase credentials not configured'}

    url = f"{SUPABASE_URL}/rest/v1/rpc/check_replica_version"
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json'
    }

    response = httpx.post(url, json={'p_expected_version': version}, headers=headers)

    if response.status_code != 200:
        return {'valid': False, 'error': response.text}

    return response.json()


def main():
    parser = argparse.ArgumentParser(
        description='Sync ZIP replica from Neon to Lovable.DAVE'
    )
    parser.add_argument(
        '--version', '-v',
        type=str,
        default=f"v{datetime.now().strftime('%Y.%m.%d')}.001",
        help='Version string (default: vYYYY.MM.DD.001)'
    )
    parser.add_argument(
        '--operator', '-o',
        type=str,
        default=os.environ.get('USER', 'unknown'),
        help='Operator identity for audit trail'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Fetch data but do not sync'
    )
    parser.add_argument(
        '--validate-only',
        action='store_true',
        help='Only validate existing replica version'
    )

    args = parser.parse_args()

    print("=" * 60)
    print("ZIP REPLICA SYNC")
    print("=" * 60)
    print(f"\nVersion: {args.version}")
    print(f"Operator: {args.operator}")
    print(f"Dry Run: {args.dry_run}")

    # Validate only mode
    if args.validate_only:
        print("\n[1] Validating replica version...")
        result = validate_sync(args.version)
        print(f"\nResult: {json.dumps(result, indent=2)}")
        return 0 if result.get('valid') else 1

    # Fetch from Neon
    print("\n[1] Fetching data from Neon (authoritative)...")
    try:
        data = fetch_neon_data()
        print(f"    States: {data['state_count']}")
        print(f"    ZIPs: {data['zip_count']}")
    except Exception as e:
        print(f"    [ERROR] Failed to fetch from Neon: {e}")
        return 1

    # Sync to Lovable
    print("\n[2] Syncing to Lovable.DAVE...")
    try:
        result = sync_to_lovable(
            version=args.version,
            operator=args.operator,
            data=data,
            dry_run=args.dry_run
        )
        print(f"    Result: {json.dumps(result, indent=2)}")
    except Exception as e:
        print(f"    [ERROR] Sync failed: {e}")
        return 1

    # Validate (if not dry run)
    if not args.dry_run:
        print("\n[3] Validating sync...")
        validation = validate_sync(args.version)
        if validation.get('valid'):
            print("    [OK] Replica validated")
        else:
            print(f"    [WARN] Validation issue: {validation}")

    print("\n" + "=" * 60)
    print("SYNC COMPLETE")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
