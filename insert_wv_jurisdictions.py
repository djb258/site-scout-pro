"""
Insert West Virginia jurisdictions into database
Counties: Berkeley, Jefferson, Morgan (Tier 1), Hampshire, Mineral, Hardy, Randolph, Preston, Marion, Harrison (Tier 2), Grant, Pendleton, Tucker, Pocahontas, Monongalia
"""

import psycopg2
from datetime import date

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def insert_jurisdictions():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()

    # West Virginia Counties - Note: WV is opt-in for zoning, many have NO zoning
    # Insert zoning data for WV counties
    zoning_data = [
        # Eastern Panhandle (Tier 1)
        ('WV-BERKELEY', True, 'https://www.berkeleywv.org/295/Zoning', 'County Website', True, 'mini-warehouse', 'C-2, I-1, I-2', 'I-1, I-2', 'C-2', True, 'Front: 50ft, Side: 15ft, Rear: 25ft (I-1)', 'MOSTLY UNZONED. Only 3 of 17 municipalities have zoning. Storage allowed in Commercial/Industrial.', 'HIGH'),
        ('WV-JEFFERSON', True, 'https://www.jeffersoncountywv.org/county-government/departments/planning-and-zoning-department/ordinances-and-regulations', 'County Website', True, 'self-storage', 'B-2, I-1, I-2', 'I-1, I-2', 'B-2', True, 'Front: 35ft, Side: 15ft, Rear: 25ft', 'County-wide zoning adopted 2019. MGO Connect portal launched Aug 2025. Best overall transparency.', 'HIGH'),
        ('WV-MORGAN', True, 'https://morgancountywv.gov/county-commission/county-ordinances/', 'County Website', True, 'storage facility', 'Commercial, Industrial', 'Industrial', 'Commercial', True, 'Front: 40ft, Side: 15ft, Rear: 20ft', 'County-level zoning with explicit self-storage allowance. Berkeley Springs municipality has separate rules.', 'HIGH'),

        # Tier 1 - Monongalia (WVU)
        ('WV-54061', True, 'https://www.monongaliacounty.gov/moncpc/', 'County Website', False, None, 'County zones vary', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'WVU area, major growth. County Planning Commission active. Check individual municipality zoning.', 'MEDIUM'),

        # Tier 2 counties
        ('WV-54027', False, None, None, False, None, 'NO ZONING', 'N/A', 'N/A', False, None, 'NO COUNTY ZONING. Oldest WV county. Romney is county seat. Very business-friendly.', 'HIGH'),
        ('WV-54057', True, 'https://mineralcountywv.gov/', 'County Website', False, None, 'County zones vary', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Potomac State College area. Keyser is county seat. Coal and rail history.', 'MEDIUM'),
        ('WV-54031', True, 'https://www.hardycounty.com/', 'County Website', False, None, 'Limited zoning', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Moorefield seat. Major poultry processing hub. Limited county zoning.', 'MEDIUM'),
        ('WV-54083', True, 'https://www.randolphcountywv.com/', 'County Website', False, None, 'Limited zoning', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Elkins seat. Davis & Elkins College. Rail hub. National Forest area.', 'MEDIUM'),
        ('WV-54077', False, None, None, False, None, 'NO ZONING', 'N/A', 'N/A', False, None, 'Kingwood seat. Adjacent Monongalia. No county-wide zoning.', 'MEDIUM'),
        ('WV-54049', True, 'https://www.marioncountywv.com/', 'County Website', False, None, 'Limited zoning', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Fairmont seat. Fairmont State University. I-79 corridor.', 'MEDIUM'),
        ('WV-54033', True, 'https://harrisoncountywv.com/', 'County Website', False, None, 'Limited zoning', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Clarksburg seat. I-79 corridor. FBI CJIS Division headquarters.', 'MEDIUM'),

        # Tier 3 - Rural/Remote
        ('WV-54023', False, None, None, False, None, 'NO ZONING', 'N/A', 'N/A', False, None, 'NO COUNTY ZONING. Petersburg seat. Very rural. Monongahela National Forest.', 'HIGH'),
        ('WV-54071', False, None, None, False, None, 'NO ZONING', 'N/A', 'N/A', False, None, 'NO COUNTY ZONING. Franklin seat. Most remote WV county. Spruce Knob area.', 'HIGH'),
        ('WV-54093', True, 'https://tuckercountywv.gov/', 'County Website', False, None, 'Limited zoning', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Parsons seat. Canaan Valley tourism. Blackwater Falls area.', 'MEDIUM'),
        ('WV-54075', False, None, None, False, None, 'NO ZONING', 'N/A', 'N/A', False, None, 'NO COUNTY ZONING. Marlinton seat. Largest WV county by area. National Forest.', 'HIGH'),
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
    print(f"Inserted/updated {len(zoning_data)} WV zoning records")

    # Insert GIS data for WV counties
    gis_data = [
        ('WV-BERKELEY', True, 'https://maps.berkeleywv.org/berkeleyonline/', 'Berkeley Online', False, True, True, True, False, None, 'HIGH'),
        ('WV-JEFFERSON', True, 'https://od-jcwvgis.opendata.arcgis.com/', 'ArcGIS Open Data', True, True, True, True, True, 'Open Data Portal', 'HIGH'),
        ('WV-MORGAN', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, True, True, False, None, 'MEDIUM'),
        ('WV-54061', True, 'https://www.monongaliacounty.gov/', 'County Website', False, True, True, False, False, None, 'MEDIUM'),
        ('WV-54027', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, True, False, False, None, 'LOW'),
        ('WV-54057', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, True, False, False, None, 'LOW'),
        ('WV-54031', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, True, False, False, None, 'LOW'),
        ('WV-54083', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, True, False, False, None, 'LOW'),
        ('WV-54077', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, True, False, False, None, 'LOW'),
        ('WV-54049', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, True, False, False, None, 'LOW'),
        ('WV-54033', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, True, False, False, None, 'LOW'),
        ('WV-54023', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, False, False, False, None, 'LOW'),
        ('WV-54071', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, False, False, False, None, 'LOW'),
        ('WV-54093', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, True, False, False, None, 'LOW'),
        ('WV-54075', True, 'http://www.mapwv.gov/parcel/', 'WV Property Viewer', False, True, False, False, False, None, 'LOW'),
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
    print(f"Inserted/updated {len(gis_data)} WV GIS records")

    # Insert permit data for WV counties
    permit_data = [
        ('WV-BERKELEY', True, 'https://onestop.berkeleywv.org/', 'OneStop Portal', True, True, True, True, True, True, True, True, True, False, False, False, None, 'NO', False, 'HIGH'),
        ('WV-JEFFERSON', True, 'https://www.jeffersoncountywv.org/county-government/departments/engineering-department/building-permits-new', 'MGO Connect', True, True, True, True, False, True, True, True, False, False, False, False, None, 'NO', False, 'HIGH'),
        ('WV-MORGAN', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('WV-54061', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('WV-54027', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('WV-54057', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('WV-54031', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('WV-54083', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('WV-54077', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('WV-54049', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('WV-54033', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('WV-54023', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('WV-54071', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('WV-54093', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('WV-54075', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
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
    print(f"Inserted/updated {len(permit_data)} WV permit records")

    # Insert TPA data for WV counties - WV uses State Fire Marshal for building codes
    tpa_data = [
        ('WV-BERKELEY', True, 'Berkeley County Building Permits & Inspections', 'https://www.berkeleywv.org/580/Building-Permit-Process', 'https://onestop.berkeleywv.org/', '304-264-1963', None, '400 West Stephen Street, Suite 202, Martinsburg, WV 25401', 'SINGLE', 1, 'OneStop portal for permits. IBC/IRC adopted.'),
        ('WV-JEFFERSON', True, 'Jefferson County Building Permits & Inspections', 'https://www.jeffersoncountywv.org/', None, '304-728-3228', None, '116 East Washington Street, Charles Town, WV 25414', 'SINGLE', 1, 'MGO Connect portal launched Aug 2025. IBC/IRC adopted.'),
        ('WV-MORGAN', True, 'Morgan County Building Inspector', 'https://morgancountywv.gov/', None, '304-258-8546', None, '35 North Mercer Street, Berkeley Springs, WV 25411', 'SINGLE', 1, 'County-level building inspection. IBC/IRC adopted.'),
        ('WV-54061', True, 'Monongalia County Building Inspection', 'https://www.monongaliacounty.gov/', None, '304-291-7207', None, '243 High Street, Morgantown, WV 26505', 'SINGLE', 1, 'County building inspection. Morgantown has separate city permits.'),
        ('WV-54027', False, 'WV State Fire Marshal', 'https://firemarshal.wv.gov/', None, '304-558-2191', None, 'Charleston, WV', 'STATE', None, 'NO LOCAL BUILDING DEPT. State Fire Marshal for commercial. Very limited regulation.'),
        ('WV-54057', True, 'Mineral County Building Inspector', None, None, '304-788-1562', None, 'Keyser, WV', 'SINGLE', 1, 'County building inspection. Contact county office.'),
        ('WV-54031', True, 'Hardy County Building Inspector', None, None, '304-530-0200', None, 'Moorefield, WV', 'SINGLE', 1, 'County building inspection. Contact county office.'),
        ('WV-54083', True, 'Randolph County Building Inspector', None, None, '304-636-2112', None, 'Elkins, WV', 'SINGLE', 1, 'County building inspection. Contact county office.'),
        ('WV-54077', False, 'WV State Fire Marshal', 'https://firemarshal.wv.gov/', None, '304-558-2191', None, 'Charleston, WV', 'STATE', None, 'NO LOCAL BUILDING DEPT. State Fire Marshal for commercial.'),
        ('WV-54049', True, 'Marion County Building Inspector', None, None, '304-367-5420', None, 'Fairmont, WV', 'SINGLE', 1, 'County building inspection. Contact county office.'),
        ('WV-54033', True, 'Harrison County Building Inspector', None, None, '304-624-8500', None, 'Clarksburg, WV', 'SINGLE', 1, 'County building inspection. Contact county office.'),
        ('WV-54023', False, 'WV State Fire Marshal', 'https://firemarshal.wv.gov/', None, '304-558-2191', None, 'Charleston, WV', 'STATE', None, 'NO LOCAL BUILDING DEPT. State Fire Marshal for commercial.'),
        ('WV-54071', False, 'WV State Fire Marshal', 'https://firemarshal.wv.gov/', None, '304-558-2191', None, 'Charleston, WV', 'STATE', None, 'NO LOCAL BUILDING DEPT. State Fire Marshal for commercial.'),
        ('WV-54093', True, 'Tucker County Building Inspector', None, None, '304-478-2866', None, 'Parsons, WV', 'SINGLE', 1, 'County building inspection. Contact county office.'),
        ('WV-54075', False, 'WV State Fire Marshal', 'https://firemarshal.wv.gov/', None, '304-558-2191', None, 'Charleston, WV', 'STATE', None, 'NO LOCAL BUILDING DEPT. State Fire Marshal for commercial.'),
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
    print(f"Inserted/updated {len(tpa_data)} WV TPA records")

    # Final count
    cur.execute("SELECT COUNT(*) FROM jurisdiction_zoning WHERE jurisdiction_id LIKE 'WV%'")
    print(f"\nWV zoning records: {cur.fetchone()[0]}")

    cur.execute("SELECT COUNT(*) FROM jurisdiction_gis WHERE jurisdiction_id LIKE 'WV%'")
    print(f"WV GIS records: {cur.fetchone()[0]}")

    cur.execute("SELECT COUNT(*) FROM jurisdiction_permits WHERE jurisdiction_id LIKE 'WV%'")
    print(f"WV permit records: {cur.fetchone()[0]}")

    cur.execute("SELECT COUNT(*) FROM jurisdiction_tpa WHERE jurisdiction_id LIKE 'WV%'")
    print(f"WV TPA records: {cur.fetchone()[0]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    insert_jurisdictions()
