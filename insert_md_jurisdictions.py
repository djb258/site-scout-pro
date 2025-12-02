"""
Insert Maryland jurisdictions into database
Counties: Washington, Frederick, Allegany (Tier 1), Garrett, Carroll (Tier 2)
"""

import psycopg2
from datetime import date

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def insert_jurisdictions():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()

    # Maryland Counties - County-level zoning
    # Maryland uses IBC/IRC adopted statewide

    # Insert zoning data for MD counties
    zoning_data = [
        # Tier 1 - Growth corridors
        ('MD-24043', True, 'https://www.washco-md.net/planning-zoning/', 'County Website', True, 'self-storage', 'BG, IG, HI', 'IG, HI', 'BG (conditional)', True, 'Front: 50ft, Side: 30ft, Rear: 30ft (IG)', 'I-70/I-81 hub. Hagerstown seat. Major growth market. Good GIS portal.', 'HIGH'),
        ('MD-24021', True, 'https://www.frederickcountymd.gov/7974/Permits-and-Inspections', 'County Website', True, 'mini-warehouse', 'GC, LI, GI', 'LI, GI', 'GC (SUP)', True, 'Front: 35ft, Side: 25ft, Rear: 25ft', 'DC suburbs, explosive growth. Frederick seat. Premium market.', 'HIGH'),
        ('MD-24001', True, 'https://alleganyco.gov/planning/', 'County Website', True, 'storage facility', 'C-2, I-1, I-2', 'I-1, I-2', 'C-2', True, 'Varies by district', 'I-68 corridor, adjacent PA. Cumberland seat. Western MD regional hub.', 'MEDIUM'),

        # Tier 2 - Secondary markets
        ('MD-24023', True, 'https://www.garrettcounty.org/planning-land-development', 'County Website', False, None, 'C-2, I-1', 'I-1', 'C-2 (conditional)', True, 'Varies', 'Deep Creek Lake tourism. Oakland seat. Seasonal demand.', 'MEDIUM'),
        ('MD-24013', True, 'https://www.carrollcountymd.gov/government/directory/planning/', 'County Website', True, 'self-storage', 'B-G, I-G, I-R', 'I-G, I-R', 'B-G (conditional)', True, 'Front: 50ft, Side: 25ft, Rear: 40ft', 'Baltimore exurbs. Westminster seat. Agricultural preservation focus.', 'MEDIUM'),
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
    print(f"Inserted/updated {len(zoning_data)} MD zoning records")

    # Insert GIS data for MD counties
    gis_data = [
        ('MD-24043', True, 'https://gis.washco-md.net/', 'ArcGIS', True, True, True, True, True, 'Open Data Hub', 'HIGH'),
        ('MD-24021', True, 'https://gis.frederickcountymd.gov/', 'ArcGIS', True, True, True, True, True, 'Open Data Portal', 'HIGH'),
        ('MD-24001', True, 'https://www.alleganyco.gov/gis/', 'ArcGIS', True, True, True, True, False, None, 'MEDIUM'),
        ('MD-24023', True, 'https://www.garrettcounty.org/gis', 'ArcGIS', True, True, True, True, False, None, 'MEDIUM'),
        ('MD-24013', True, 'https://gis.carrollcountymd.gov/', 'ArcGIS', True, True, True, True, True, 'Open Data', 'HIGH'),
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
    print(f"Inserted/updated {len(gis_data)} MD GIS records")

    # Insert permit data for MD counties
    permit_data = [
        ('MD-24043', True, 'https://www.washco-md.net/permits-and-inspections/', 'Custom Portal', True, True, True, True, True, True, True, True, False, False, False, False, None, 'NO', False, 'HIGH'),
        ('MD-24021', True, 'https://www.frederickcountymd.gov/7974/Permits-and-Inspections', 'Custom Portal', True, True, True, True, True, True, True, True, True, False, True, False, None, 'NO', False, 'HIGH'),
        ('MD-24001', True, 'https://alleganyco.gov/permits-inspections/', 'Custom', True, True, True, True, False, True, True, False, False, False, False, False, None, 'NO', False, 'MEDIUM'),
        ('MD-24023', True, 'https://www.garrettcounty.org/planning-land-development/permits', 'Custom', True, False, True, True, False, True, True, False, False, False, False, False, None, 'NO', False, 'MEDIUM'),
        ('MD-24013', True, 'https://www.carrollcountymd.gov/government/directory/permits-and-inspections/', 'Custom Portal', True, True, True, True, True, True, True, True, False, False, False, False, None, 'NO', False, 'HIGH'),
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
    print(f"Inserted/updated {len(permit_data)} MD permit records")

    # Insert TPA data for MD counties - Maryland has county-level building departments
    tpa_data = [
        ('MD-24043', True, 'Washington County Permits & Inspections', 'https://www.washco-md.net/', 'https://www.washco-md.net/permits-and-inspections/', '240-313-2460', None, '100 W. Washington St, Hagerstown, MD 21740', 'SINGLE', 1, 'County-level permits. IBC/IRC adopted. Good online system.'),
        ('MD-24021', True, 'Frederick County Permits & Inspections', 'https://www.frederickcountymd.gov/', 'https://www.frederickcountymd.gov/7974/Permits-and-Inspections', '301-600-1723', None, '30 N. Market St, Frederick, MD 21701', 'SINGLE', 1, 'County-level permits. IBC/IRC adopted. Excellent online portal.'),
        ('MD-24001', True, 'Allegany County Permits & Inspections', 'https://alleganyco.gov/', 'https://alleganyco.gov/permits-inspections/', '301-777-5922', None, '701 Kelly Rd, Cumberland, MD 21502', 'SINGLE', 1, 'County-level permits. IBC/IRC adopted.'),
        ('MD-24023', True, 'Garrett County Planning & Land Development', 'https://www.garrettcounty.org/', 'https://www.garrettcounty.org/planning-land-development/permits', '301-334-1920', None, '203 S. Fourth St, Oakland, MD 21550', 'SINGLE', 1, 'County-level permits. IBC/IRC adopted.'),
        ('MD-24013', True, 'Carroll County Permits & Inspections', 'https://www.carrollcountymd.gov/', 'https://www.carrollcountymd.gov/government/directory/permits-and-inspections/', '410-386-2674', None, '225 N. Center St, Westminster, MD 21157', 'SINGLE', 1, 'County-level permits. IBC/IRC adopted. Good online system.'),
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
    print(f"Inserted/updated {len(tpa_data)} MD TPA records")

    # Final count
    cur.execute("SELECT COUNT(*) FROM jurisdiction_zoning WHERE jurisdiction_id LIKE 'MD%'")
    print(f"\nMD zoning records: {cur.fetchone()[0]}")

    cur.execute("SELECT COUNT(*) FROM jurisdiction_gis WHERE jurisdiction_id LIKE 'MD%'")
    print(f"MD GIS records: {cur.fetchone()[0]}")

    cur.execute("SELECT COUNT(*) FROM jurisdiction_permits WHERE jurisdiction_id LIKE 'MD%'")
    print(f"MD permit records: {cur.fetchone()[0]}")

    cur.execute("SELECT COUNT(*) FROM jurisdiction_tpa WHERE jurisdiction_id LIKE 'MD%'")
    print(f"MD TPA records: {cur.fetchone()[0]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    insert_jurisdictions()
