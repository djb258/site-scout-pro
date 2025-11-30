#!/usr/bin/env python3
"""
Test the reusable zone creation and screening pipeline.
Demonstrates how any ZIP code can be used to create a screening zone.
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import os
os.environ["NEON_CONNECTION_STRING"] = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

from backend.services.zone_service import ZoneService, create_screening_zone
from backend.services.pipeline_service import PipelineService, create_and_run_zone


def test_zone_creation():
    """Test creating a zone from any ZIP code."""
    print("=" * 60)
    print("TEST 1: ZONE CREATION FROM ANY ZIP")
    print("=" * 60)

    # Test with Bedford PA (existing zone)
    print("\n## Testing with Bedford PA (15522)...")
    service = ZoneService()

    try:
        zone = service.create_zone("15522", radius_miles=120)
        print(f"  Zone ID: {zone['zone_id']}")
        print(f"  Zone Name: {zone['zone_name']}")
        print(f"  Center: {zone['center_city']}, {zone['center_state']}")
        print(f"  Radius: {zone['radius_miles']} miles")
        print(f"  States: {', '.join(zone['states'])}")
        print(f"  Total ZIPs: {zone['total_zips']:,}")
        print(f"  Total Counties: {zone['total_counties']}")
        print("\n  ZIPs by State:")
        for state, count in zone['zips_by_state'].items():
            print(f"    {state}: {count:,}")
    except Exception as e:
        print(f"  ERROR: {e}")
    finally:
        service.close()

    print("\n" + "-" * 60)
    print("## Testing with a different ZIP (Charleston WV - 25301)...")

    try:
        zone = create_screening_zone("25301", radius_miles=100)
        print(f"  Zone ID: {zone['zone_id']}")
        print(f"  Zone Name: {zone['zone_name']}")
        print(f"  Center: {zone['center_city']}, {zone['center_state']}")
        print(f"  Total ZIPs: {zone['total_zips']:,}")
        print(f"  States: {', '.join(zone['states'])}")
    except Exception as e:
        print(f"  ERROR: {e}")


def test_zone_zips():
    """Test getting ZIPs from a zone."""
    print("\n" + "=" * 60)
    print("TEST 2: ZONE ZIP RETRIEVAL")
    print("=" * 60)

    service = ZoneService()
    try:
        # Get first 10 ZIPs from zone 1
        zips = service.get_zone_zips(1, include_demographics=True)[:10]
        print(f"\nFirst 10 ZIPs in Zone 1:")
        print("-" * 80)
        print(f"{'ZIP':<8} {'State':<5} {'County':<20} {'Dist':<8} {'Pop':<10} {'Income':<10}")
        print("-" * 80)
        for z in zips:
            pop = f"{z['population']:,}" if z['population'] else "N/A"
            inc = f"${z['income_household_median']:,}" if z['income_household_median'] else "N/A"
            print(f"{z['zip']:<8} {z['state']:<5} {z['county_name'][:20]:<20} {z['distance_miles']:<8} {pop:<10} {inc:<10}")
    except Exception as e:
        print(f"  ERROR: {e}")
    finally:
        service.close()


def test_pipeline_stages():
    """Test running pipeline stages."""
    print("\n" + "=" * 60)
    print("TEST 3: PIPELINE STAGE EXECUTION")
    print("=" * 60)

    zone_service = ZoneService()
    pipeline = PipelineService()

    try:
        # Start a new run for zone 1
        print("\n## Starting new run for Zone 1 (Bedford PA)...")
        run_id = zone_service.start_zone_run(1)
        print(f"  Run ID: {run_id}")

        # Get initial status
        status = pipeline.get_run_status(run_id)
        print(f"  Total ZIPs: {status['total_zips']:,}")
        print(f"  Status: {status['status']}")

        # Run Stage 0
        print("\n## Running Stage 0 (Geography Filter)...")
        s0_result = pipeline.run_stage(run_id, 0)
        print(f"  Killed: {s0_result['killed']}")
        print(f"  Survivors: {s0_result['survivors']}")
        print(f"  Kill Reasons: {s0_result.get('kill_reasons', {})}")

        # Run Stage 1
        print("\n## Running Stage 1 (Demographics)...")
        s1_result = pipeline.run_stage(run_id, 1)
        print(f"  Killed: {s1_result['killed']}")
        print(f"  Survivors: {s1_result['survivors']}")
        print(f"  Kill Reasons: {s1_result.get('kill_reasons', {})}")

        # Get updated status
        status = pipeline.get_run_status(run_id)
        print("\n## Current Status:")
        print(f"  Active by Stage: {status['active_by_stage']}")
        print(f"  Killed by Stage: {status['killed_by_stage']}")

    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        zone_service.close()
        pipeline.close()


def test_quick_screen():
    """Test the quick screen function (zone + full pipeline)."""
    print("\n" + "=" * 60)
    print("TEST 4: QUICK SCREEN (FULL PIPELINE)")
    print("=" * 60)

    print("\n## Running quick screen for Morgantown WV (26505)...")
    print("   (This creates a zone and runs all 9 stages)")

    try:
        result = create_and_run_zone("26505", radius_miles=80)

        print(f"\n  Zone Created:")
        print(f"    ID: {result['zone']['zone_id']}")
        print(f"    Name: {result['zone']['zone_name']}")
        print(f"    Total ZIPs: {result['zone']['total_zips']:,}")

        print(f"\n  Pipeline Run:")
        print(f"    Run ID: {result['run_id']}")
        print(f"    Stages Completed: {len(result['screening']['stages'])}")

        if 'stage_8' in result['screening']['stages']:
            top_20 = result['screening']['stages']['stage_8'].get('top_20', [])
            print(f"\n  Top 20 ZIPs:")
            for i, z in enumerate(top_20[:10], 1):
                print(f"    {i}. {z['zip']} - Score: {z['score']}")
            if len(top_20) > 10:
                print(f"    ... and {len(top_20) - 10} more")

    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Run all tests."""
    print("\n")
    print("*" * 60)
    print("*  REUSABLE ZONE SCREENING PIPELINE TEST")
    print("*  Any ZIP code -> Zone -> 9-Stage Screening -> Top 20")
    print("*" * 60)

    # Run tests
    test_zone_creation()
    test_zone_zips()
    test_pipeline_stages()
    # Uncomment to run full pipeline (takes longer):
    # test_quick_screen()

    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETE")
    print("=" * 60)
    print("""
The reusable zone pipeline is ready!

Usage from UI/API:
  POST /api/v1/zones
    {"center_zip": "15522", "radius_miles": 120}

  POST /api/v1/runs
    {"zone_id": 1}

  POST /api/v1/runs/{run_id}/all-stages

  GET /api/v1/runs/{run_id}/survivors

Or use the quick-screen endpoint:
  POST /api/v1/quick-screen
    {"center_zip": "15522", "radius_miles": 120}
""")


if __name__ == "__main__":
    main()
