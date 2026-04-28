#!/usr/bin/env python3
"""
Traffic Count Data Ingester — pub_traffic_data
Sources:
  - OKDOT (Oklahoma DOT) ArcGIS REST API: Tulsa market
  - PennDOT ArcGIS REST API: Bedford PA market

Both are free public APIs, no auth required.
Inserts into svg-d1-storage pub_traffic_data via wrangler d1 execute.

Usage:
  python3 ingest_traffic_data.py [--market tulsa|bedford|all] [--dry-run]

AADT field notes:
  - OKDOT HISTORY_1 = most recent year count, format "21,200\t (2023)"
  - PennDOT CUR_AADT = integer, BASE_ADT_YR = year integer
"""

import json
import math
import re
import subprocess
import sys
import time
import urllib.request
from datetime import datetime

# ── constants ──────────────────────────────────────────────────────────────

OKDOT_URL = (
    "https://services6.arcgis.com/RBtoEUQ2lmN0K3GY/arcgis/rest/services"
    "/AADT_Historic/FeatureServer/0/query"
)

PENNDOT_URL = (
    "https://gis.penndot.gov/arcgis/rest/services/opendata/roadwaytraffic"
    "/MapServer/0/query"
)

# Bedford County PA = CTY_CODE 05
BEDFORD_COUNTY_CODE = "05"

# Wrangler DB and CWD
D1_DB = "svg-d1-storage"
WRANGLER_CWD = "/Users/employeeai/Documents/imo-creator-v2-20260317/workers/storage-hub"

# Market ZIP labels — best representative ZIP for each market
# Traffic data is point/line on roads, not ZIP-native.
# We assign the primary commercial ZIP for the market as context label.
MARKET_ZIPS = {
    "tulsa": "74103",   # Downtown Tulsa core
    "bedford": "15522", # Bedford PA borough core
}


# ── helpers ────────────────────────────────────────────────────────────────

def fetch_json(url, params):
    """HTTP GET with query params, return parsed JSON."""
    from urllib.parse import urlencode
    full_url = url + "?" + urlencode(params)
    req = urllib.request.Request(full_url, headers={"User-Agent": "imo-traffic-ingest/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def web_mercator_midpoint_to_latlon(paths):
    """
    Convert a Web Mercator polyline to approximate lat/lon centroid.
    Takes the midpoint vertex of the first path.
    EPSG:3857 → EPSG:4326
    """
    if not paths:
        return None, None
    path = paths[0]
    if not path:
        return None, None
    # use the midpoint vertex
    mid = path[len(path) // 2]
    x, y = mid[0], mid[1]
    # inverse Web Mercator
    lon = math.degrees(x / 6378137.0)
    lat = math.degrees(2 * math.atan(math.exp(y / 6378137.0)) - math.pi / 2)
    return round(lat, 6), round(lon, 6)


def parse_okdot_aadt(history_str):
    """Parse OKDOT history string like '21,200\t (2023)' → (aadt_int, year_int)."""
    if not history_str:
        return None, None
    history_str = str(history_str).strip()
    # extract year
    year_match = re.search(r'\((\d{4})\)', history_str)
    year = int(year_match.group(1)) if year_match else None
    # extract aadt
    aadt_str = re.sub(r'[^\d]', '', history_str.split('\t')[0].strip())
    if not aadt_str:
        # try splitting on tab first
        parts = history_str.split('\t')
        aadt_str = re.sub(r'[^\d]', '', parts[0]) if parts else ''
    aadt = int(aadt_str) if aadt_str else None
    return aadt, year


def paginated_query(url, base_params, result_offset=0, max_records=2000):
    """
    Fetch all records using ArcGIS pagination.
    Returns list of feature attribute dicts.
    """
    records = []
    offset = result_offset
    page_size = 1000
    while True:
        params = dict(base_params)
        params["resultOffset"] = offset
        params["resultRecordCount"] = page_size
        data = fetch_json(url, params)
        features = data.get("features", [])
        if not features:
            break
        records.extend(features)
        print(f"  fetched {len(records)} records so far...")
        if len(features) < page_size:
            break
        if len(records) >= max_records:
            print(f"  hit max_records cap ({max_records}), stopping.")
            break
        offset += page_size
        time.sleep(0.5)  # be polite
    return records


# ── market fetchers ────────────────────────────────────────────────────────

def fetch_tulsa_records():
    """Pull all Tulsa County AADT records from OKDOT."""
    print("Fetching OKDOT Tulsa county records...")
    base_params = {
        "where": "COUNTY='Tulsa'",
        "outFields": "SITE_ID,COUNTY,ROUTE,LATITUDE,LONGITUDE,LOCATION,HISTORY_1,COUNT_CYCLE",
        "returnGeometry": "false",
        "f": "json",
    }
    features = paginated_query(OKDOT_URL, base_params, max_records=3000)
    print(f"  Total Tulsa records: {len(features)}")

    rows = []
    for feat in features:
        attrs = feat.get("attributes", {})
        aadt, year = parse_okdot_aadt(attrs.get("HISTORY_1"))
        if aadt is None:
            continue
        lat = attrs.get("LATITUDE")
        lon = attrs.get("LONGITUDE")
        if lat is None or lon is None:
            continue
        route = attrs.get("ROUTE") or ""
        location = attrs.get("LOCATION") or route
        road_name = location.strip() if location.strip() and location.strip() != "-" else route.strip()
        rows.append({
            "zip": MARKET_ZIPS["tulsa"],
            "road_name": road_name[:200] if road_name else None,
            "aadt": aadt,
            "aadt_year": year,
            "visibility_ok": 1 if aadt >= 5000 else 0,
            "turn_count": None,
            "source": "OKDOT-ArcGIS",
            "notes": f"site_id={attrs.get('SITE_ID')} county=Tulsa lat={lat} lon={lon}",
            "researched_by": "ingest_traffic_data.py",
            "researched_at": datetime.utcnow().isoformat(),
        })
    return rows


def fetch_bedford_records():
    """Pull all Bedford County AADT records from PennDOT."""
    print("Fetching PennDOT Bedford County records...")
    base_params = {
        "where": f"CTY_CODE='{BEDFORD_COUNTY_CODE}'",
        "outFields": "CTY_CODE,ST_RT_NO,CUR_AADT,BASE_ADT_YR,JURIS",
        "returnGeometry": "true",
        "geometryPrecision": "6",
        "f": "json",
    }
    features = paginated_query(PENNDOT_URL, base_params, max_records=2000)
    print(f"  Total Bedford records: {len(features)}")

    rows = []
    for feat in features:
        attrs = feat.get("attributes", {})
        aadt = attrs.get("CUR_AADT")
        year = attrs.get("BASE_ADT_YR")
        if aadt is None:
            continue
        # extract lat/lon from Web Mercator polyline
        geom = feat.get("geometry", {})
        paths = geom.get("paths", [])
        lat, lon = web_mercator_midpoint_to_latlon(paths)
        route = attrs.get("ST_RT_NO") or ""
        road_name = f"SR-{route.lstrip('0') or route}" if route else None
        rows.append({
            "zip": MARKET_ZIPS["bedford"],
            "road_name": road_name,
            "aadt": int(aadt),
            "aadt_year": int(year) if year else None,
            "visibility_ok": 1 if aadt >= 5000 else 0,
            "turn_count": None,
            "source": "PennDOT-ArcGIS",
            "notes": f"cty=05 rt={route} lat={lat} lon={lon}",
            "researched_by": "ingest_traffic_data.py",
            "researched_at": datetime.utcnow().isoformat(),
        })
    return rows


# ── d1 writer ──────────────────────────────────────────────────────────────

def escape_sql_str(val):
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def rows_to_sql_inserts(rows, batch_size=100):
    """Yield batched INSERT statements."""
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        values_list = []
        for r in batch:
            values_list.append(
                "({zip},{road_name},{aadt},{aadt_year},{visibility_ok},"
                "{turn_count},{source},{notes},{researched_by},{researched_at})".format(
                    zip=escape_sql_str(r["zip"]),
                    road_name=escape_sql_str(r["road_name"]),
                    aadt=str(r["aadt"]) if r["aadt"] is not None else "NULL",
                    aadt_year=str(r["aadt_year"]) if r["aadt_year"] is not None else "NULL",
                    visibility_ok=str(r["visibility_ok"]) if r["visibility_ok"] is not None else "NULL",
                    turn_count="NULL",
                    source=escape_sql_str(r["source"]),
                    notes=escape_sql_str(r["notes"]),
                    researched_by=escape_sql_str(r["researched_by"]),
                    researched_at=escape_sql_str(r["researched_at"]),
                )
            )
        sql = (
            "INSERT INTO pub_traffic_data "
            "(zip,road_name,aadt,aadt_year,visibility_ok,turn_count,source,notes,researched_by,researched_at) "
            "VALUES " + ",\n".join(values_list) + ";"
        )
        yield sql


def run_wrangler_sql(sql, dry_run=False):
    """Execute SQL via wrangler d1 execute."""
    if dry_run:
        print("[DRY RUN] SQL (first 300 chars):", sql[:300])
        return True
    cmd = [
        "npx", "wrangler", "d1", "execute", D1_DB,
        "--remote",
        "--command", sql,
    ]
    result = subprocess.run(cmd, cwd=WRANGLER_CWD, capture_output=True, text=True)
    if result.returncode != 0:
        print("ERROR:", result.stderr[-500:])
        return False
    return True


# ── main ───────────────────────────────────────────────────────────────────

def main():
    dry_run = "--dry-run" in sys.argv
    market_arg = None
    for i, arg in enumerate(sys.argv[1:]):
        if arg == "--market" and i + 1 < len(sys.argv) - 1:
            market_arg = sys.argv[i + 2]
    if market_arg is None:
        market_arg = "all"

    all_rows = []

    if market_arg in ("tulsa", "all"):
        tulsa_rows = fetch_tulsa_records()
        print(f"  Tulsa: {len(tulsa_rows)} rows ready to insert")
        all_rows.extend(tulsa_rows)

    if market_arg in ("bedford", "all"):
        bedford_rows = fetch_bedford_records()
        print(f"  Bedford: {len(bedford_rows)} rows ready to insert")
        all_rows.extend(bedford_rows)

    print(f"\nTotal rows: {len(all_rows)}")
    if not all_rows:
        print("Nothing to insert.")
        return

    print(f"Inserting in batches of 100...")
    success = 0
    fail = 0
    for batch_num, sql in enumerate(rows_to_sql_inserts(all_rows, batch_size=100)):
        print(f"  batch {batch_num + 1}...", end=" ")
        ok = run_wrangler_sql(sql, dry_run=dry_run)
        if ok:
            success += 1
            print("OK")
        else:
            fail += 1
            print("FAIL")

    print(f"\nDone. {success} batches OK, {fail} batches failed.")
    print(f"Approx {success * 100} rows inserted.")


if __name__ == "__main__":
    main()
