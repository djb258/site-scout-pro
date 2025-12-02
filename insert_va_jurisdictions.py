"""
Insert Virginia jurisdictions into database
Counties: Frederick (Tier 1), Warren, Shenandoah, Rockingham, Augusta, Clarke, Page, Alleghany, Rockbridge, Botetourt, Highland, Bath, Amherst
"""

import psycopg2
from datetime import date

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def insert_jurisdictions():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()

    # Virginia Counties - County-level zoning (Dillon Rule state)
    # Virginia uses Uniform Statewide Building Code (USBC) enforced at local level

    # Insert zoning data for VA counties
    zoning_data = [
        # Frederick County (already in system, most detailed)
        ('VA-FREDERICK', True, 'https://www.fcva.us/departments/planning-development', 'County Website', True, 'self-storage', 'B-2, B-3, M-1, M-2', 'M-1, M-2', 'B-2, B-3 (SUP)', True, 'Front: 50ft, Side: 25ft, Rear: 35ft (M-1)', 'Best overall system. Tyler-EnerGov portal. Monthly permit reports. Self-storage by-right in industrial.', 'HIGH'),

        # Tier 1 - Shenandoah Valley I-81 Corridor
        ('VA-51187', True, 'https://www.warrencountyva.gov/government/departments/planning_zoning/index.php', 'County Website', True, 'mini-warehouse', 'B-2, I-1, I-2', 'I-1, I-2', 'B-2', True, 'Varies by district', 'Shenandoah gateway. Front Royal seat. I-66/I-81 junction. Growing market.', 'MEDIUM'),
        ('VA-51171', True, 'https://www.shenandoahcountyva.us/planning/', 'County Website', True, 'self-storage', 'B-2, M-1, M-2', 'M-1, M-2', 'B-2 (SUP)', True, 'Front: 35ft, Side: 15ft, Rear: 25ft', 'I-81 corridor. Woodstock seat. Rural character with growth pressure.', 'MEDIUM'),
        ('VA-51165', True, 'https://www.rockinghamcountyva.gov/171/Planning-Zoning', 'County Website', True, 'mini-storage', 'B-2, M-1, M-2', 'M-1, M-2', 'B-2', True, 'Varies by district', 'JMU, Harrisonburg. Major poultry hub. Good GIS portal.', 'MEDIUM'),
        ('VA-51015', True, 'https://www.co.augusta.va.us/government/planning-development', 'County Website', True, 'storage facility', 'B-2, M-1, M-2', 'M-1, M-2', 'B-2 (SUP)', True, 'Front: 50ft, Side: 25ft, Rear: 35ft', 'I-81/I-64 junction. Staunton/Waynesboro area. Growing logistics hub.', 'MEDIUM'),

        # Tier 2 - Secondary markets
        ('VA-51043', True, 'https://www.clarkecounty.gov/government/departments/planning_and_zoning', 'County Website', False, None, 'B-2, I-1', 'I-1', 'B-2 (SUP)', True, 'Varies', 'Small county, DC exurbs. Berryville seat. Very rural/residential focus.', 'MEDIUM'),
        ('VA-51139', True, 'https://www.pagecounty.virginia.gov/167/Planning-Zoning', 'County Website', True, 'mini-warehouse', 'B-2, M-1', 'M-1', 'B-2', True, 'Varies', 'Luray Caverns tourism. Shenandoah National Park. Luray seat.', 'MEDIUM'),
        ('VA-51005', True, 'https://www.alleghanycounty-va.gov/departments/planning', 'County Website', False, None, 'B-2, M-1', 'M-1', 'B-2', False, None, 'Covington seat. Paper mill town. I-64 corridor.', 'LOW'),
        ('VA-51163', True, 'https://www.rockbridgecountyva.gov/government/departments/community_development', 'County Website', False, None, 'B-2, M-1', 'M-1', 'B-2', False, None, 'Lexington seat. VMI and W&L University. Historic district considerations.', 'MEDIUM'),
        ('VA-51023', True, 'https://www.botetourt.org/government/departments/planning_and_zoning', 'County Website', True, 'self-storage', 'B-2, M-1, M-2', 'M-1, M-2', 'B-2', True, 'Front: 50ft, Side: 20ft, Rear: 30ft', 'Roanoke adjacent. Fincastle seat. Growing suburban market.', 'MEDIUM'),

        # Tier 3 - Rural/Remote
        ('VA-51091', True, 'https://www.highlandcova.org/government/departments/planning', 'County Website', False, None, 'Limited zoning', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Most rural VA county. Monterey seat. ~2,200 population. Very limited development.', 'LOW'),
        ('VA-51017', True, 'https://www.bathcountyva.org/', 'County Website', False, None, 'Limited zoning', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Hot Springs resort area. Warm Springs seat. Tourism-focused. The Homestead.', 'LOW'),
        ('VA-51009', True, 'https://www.countyofamherst.com/government/departments/planning_and_zoning', 'County Website', False, None, 'B-2, M-1', 'M-1', 'B-2', False, None, 'Amherst seat. Edge of target radius. Sweet Briar College area.', 'LOW'),
    ]

    for z in zoning_data:
        cur.execute("DELETE FROM jurisdiction_zoning WHERE jurisdiction_id = %s", (z[0],))
        cur.execute("""
            INSERT INTO jurisdiction_zoning (
                jurisdiction_id, ordinance_online, ordinance_url, ordinance_platform,
                self_storage_defined, self_storage_term, zones_allowed, by_right_zones,
                conditional_zones, setback_requirements, setback_details, special_restrictions,
                confidence_rating
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, z)

    conn.commit()
    print(f"Inserted/updated {len(zoning_data)} VA zoning records")

    # Insert GIS data for VA counties
    gis_data = [
        ('VA-FREDERICK', True, 'https://gis.fcva.us/', 'ArcGIS', True, True, True, True, True, 'Open Data', 'HIGH'),
        ('VA-51187', True, 'https://www.warrencountyva.gov/government/departments/gis', 'ArcGIS', True, True, True, True, False, None, 'MEDIUM'),
        ('VA-51171', True, 'https://www.shenandoahcountyva.us/gis/', 'ArcGIS', True, True, True, True, False, None, 'MEDIUM'),
        ('VA-51165', True, 'https://gis.rockinghamcountyva.gov/', 'ArcGIS', True, True, True, True, True, 'Open Data Portal', 'HIGH'),
        ('VA-51015', True, 'https://gis.co.augusta.va.us/', 'ArcGIS', True, True, True, True, False, None, 'MEDIUM'),
        ('VA-51043', True, 'https://www.clarkecounty.gov/government/gis', 'ArcGIS', False, True, True, False, False, None, 'MEDIUM'),
        ('VA-51139', True, 'https://www.pagecounty.virginia.gov/264/GIS-Mapping', 'ArcGIS', True, True, True, True, False, None, 'MEDIUM'),
        ('VA-51005', True, 'https://www.alleghanycounty-va.gov/', 'County Website', False, True, True, False, False, None, 'LOW'),
        ('VA-51163', True, 'https://gis.rockbridgecountyva.gov/', 'ArcGIS', True, True, True, True, False, None, 'MEDIUM'),
        ('VA-51023', True, 'https://gis.botetourt.org/', 'ArcGIS', True, True, True, True, False, None, 'MEDIUM'),
        ('VA-51091', True, 'https://www.highlandcova.org/', 'County Website', False, True, False, False, False, None, 'LOW'),
        ('VA-51017', True, 'https://www.bathcountyva.org/', 'County Website', False, True, False, False, False, None, 'LOW'),
        ('VA-51009', True, 'https://www.countyofamherst.com/government/gis', 'ArcGIS', False, True, True, False, False, None, 'MEDIUM'),
    ]

    for g in gis_data:
        cur.execute("DELETE FROM jurisdiction_gis WHERE jurisdiction_id = %s", (g[0],))
        cur.execute("""
            INSERT INTO jurisdiction_gis (
                jurisdiction_id, portal_exists, portal_url, platform,
                has_zoning_layer, has_parcel_layer, has_owner_info, has_flood_layer,
                downloadable_data, download_sources, confidence_rating
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, g)

    conn.commit()
    print(f"Inserted/updated {len(gis_data)} VA GIS records")

    # Insert permit data for VA counties
    permit_data = [
        ('VA-FREDERICK', True, 'https://energov.frederickcountyva.gov/', 'Tyler EnerGov', True, True, True, True, True, True, True, True, True, False, True, True, 'https://www.fcva.us/departments/building-inspections/permit-reports', 'NO', False, 'HIGH'),
        ('VA-51187', True, 'https://www.warrencountyva.gov/government/departments/building_inspections', 'Custom', True, False, True, True, False, True, True, False, False, False, False, False, None, 'NO', False, 'MEDIUM'),
        ('VA-51171', True, 'https://www.shenandoahcountyva.us/building/', 'Custom', True, False, True, True, False, True, True, False, False, False, False, False, None, 'NO', False, 'MEDIUM'),
        ('VA-51165', True, 'https://www.rockinghamcountyva.gov/306/Building-Inspection', 'Custom', True, True, True, True, False, True, True, False, False, False, False, False, None, 'NO', False, 'MEDIUM'),
        ('VA-51015', True, 'https://www.co.augusta.va.us/government/building-inspections', 'Custom', True, False, True, True, False, True, True, False, False, False, False, False, None, 'NO', False, 'MEDIUM'),
        ('VA-51043', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('VA-51139', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('VA-51005', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('VA-51163', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('VA-51023', True, 'https://www.botetourt.org/government/departments/building_inspection', 'Custom', True, False, True, True, False, True, True, False, False, False, False, False, None, 'NO', False, 'MEDIUM'),
        ('VA-51091', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('VA-51017', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('VA-51009', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
    ]

    for p in permit_data:
        cur.execute("DELETE FROM jurisdiction_permits WHERE jurisdiction_id = %s", (p[0],))
        cur.execute("""
            INSERT INTO jurisdiction_permits (
                jurisdiction_id, online_system_exists, portal_url, platform,
                public_search, public_apply, search_by_address, search_by_permit_number,
                search_by_date_range, search_by_type, shows_status, shows_inspection_history,
                shows_inspection_results, shows_inspector_notes, data_exportable,
                monthly_reports_available, monthly_reports_url, api_available, rtk_required,
                confidence_rating
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, p)

    conn.commit()
    print(f"Inserted/updated {len(permit_data)} VA permit records")

    # Insert TPA data for VA counties - Virginia uses USBC enforced at county level
    tpa_data = [
        ('VA-FREDERICK', True, 'Frederick County Building Inspections', 'https://www.fcva.us/departments/building-inspections', 'https://energov.frederickcountyva.gov/', '540-665-5600', None, '107 N. Kent Street, Winchester, VA 22601', 'SINGLE', 1, 'Tyler EnerGov system. Monthly PDF reports. Best transparency in region.'),
        ('VA-51187', True, 'Warren County Building Inspections', 'https://www.warrencountyva.gov/', None, '540-636-4600', None, '220 N. Commerce Ave, Front Royal, VA 22630', 'SINGLE', 1, 'County building department. USBC adopted.'),
        ('VA-51171', True, 'Shenandoah County Building Inspections', 'https://www.shenandoahcountyva.us/', None, '540-459-6225', None, '600 N. Main St, Woodstock, VA 22664', 'SINGLE', 1, 'County building department. USBC adopted.'),
        ('VA-51165', True, 'Rockingham County Building Inspections', 'https://www.rockinghamcountyva.gov/', None, '540-564-3030', None, '20 E. Gay St, Harrisonburg, VA 22802', 'SINGLE', 1, 'County building department. USBC adopted. Good online resources.'),
        ('VA-51015', True, 'Augusta County Building Inspections', 'https://www.co.augusta.va.us/', None, '540-245-5700', None, '18 Government Center Lane, Verona, VA 24482', 'SINGLE', 1, 'County building department. USBC adopted.'),
        ('VA-51043', True, 'Clarke County Building Official', 'https://www.clarkecounty.gov/', None, '540-955-5176', None, '101 Chalmers Court, Berryville, VA 22611', 'SINGLE', 1, 'Small county office. Contact for permits.'),
        ('VA-51139', True, 'Page County Building Inspections', 'https://www.pagecounty.virginia.gov/', None, '540-743-3840', None, '103 S. Court St, Luray, VA 22835', 'SINGLE', 1, 'County building department. USBC adopted.'),
        ('VA-51005', True, 'Alleghany County Building Official', 'https://www.alleghanycounty-va.gov/', None, '540-863-6600', None, '9212 Winterberry Ave, Covington, VA 24426', 'SINGLE', 1, 'Small county office. Contact for permits.'),
        ('VA-51163', True, 'Rockbridge County Building Inspections', 'https://www.rockbridgecountyva.gov/', None, '540-464-2213', None, '150 S. Main St, Lexington, VA 24450', 'SINGLE', 1, 'County building department. Historic district considerations.'),
        ('VA-51023', True, 'Botetourt County Building Inspections', 'https://www.botetourt.org/', None, '540-928-2050', None, '1 W. Main St, Fincastle, VA 24090', 'SINGLE', 1, 'County building department. USBC adopted.'),
        ('VA-51091', True, 'Highland County Building Official', 'https://www.highlandcova.org/', None, '540-468-2447', None, '1 Court St, Monterey, VA 24465', 'SINGLE', 1, 'Very small office. Most rural VA county.'),
        ('VA-51017', True, 'Bath County Building Official', 'https://www.bathcountyva.org/', None, '540-839-7221', None, '85 Courthouse Hill Rd, Warm Springs, VA 24484', 'SINGLE', 1, 'Small county office. Tourism focus.'),
        ('VA-51009', True, 'Amherst County Building Inspections', 'https://www.countyofamherst.com/', None, '434-946-9310', None, '153 Washington St, Amherst, VA 24521', 'SINGLE', 1, 'County building department. USBC adopted.'),
    ]

    for t in tpa_data:
        cur.execute("DELETE FROM jurisdiction_tpa WHERE jurisdiction_id = %s", (t[0],))
        cur.execute("""
            INSERT INTO jurisdiction_tpa (
                jurisdiction_id, uses_tpa, tpa_name, tpa_website, tpa_portal_url,
                tpa_phone, tpa_email, tpa_address, coverage_type, tpa_count, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, t)

    conn.commit()
    print(f"Inserted/updated {len(tpa_data)} VA TPA records")

    # Final count
    cur.execute("SELECT COUNT(*) FROM jurisdiction_zoning WHERE jurisdiction_id LIKE 'VA%'")
    print(f"\nVA zoning records: {cur.fetchone()[0]}")

    cur.execute("SELECT COUNT(*) FROM jurisdiction_gis WHERE jurisdiction_id LIKE 'VA%'")
    print(f"VA GIS records: {cur.fetchone()[0]}")

    cur.execute("SELECT COUNT(*) FROM jurisdiction_permits WHERE jurisdiction_id LIKE 'VA%'")
    print(f"VA permit records: {cur.fetchone()[0]}")

    cur.execute("SELECT COUNT(*) FROM jurisdiction_tpa WHERE jurisdiction_id LIKE 'VA%'")
    print(f"VA TPA records: {cur.fetchone()[0]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    insert_jurisdictions()
