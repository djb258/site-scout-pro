"""
Insert Pennsylvania Tier 1 jurisdictions into database
Counties: Somerset, Franklin, Westmoreland, Fayette, Washington, Centre, Cumberland, Adams, York, Dauphin
"""

import psycopg2
from datetime import date

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def insert_jurisdictions():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()

    # Pennsylvania Tier 1 Counties Data
    jurisdictions = [
        ('PA-SOMERSET', 'Somerset', 'PA', 'Pennsylvania', 'HYBRID', 50, 'HIGH', 'MEDIUM', 'Adjacent Bedford, good GIS. County has interchange area zoning. Most municipalities have no zoning.'),
        ('PA-FRANKLIN', 'Franklin', 'PA', 'Pennsylvania', 'MUNICIPAL', 22, 'HIGH', 'HIGH', 'I-81 corridor, major warehouse growth. PMCA serves multiple municipalities. Strong GIS portal.'),
        ('PA-WESTMORELAND', 'Westmoreland', 'PA', 'Pennsylvania', 'MUNICIPAL', 65, 'HIGH', 'HIGH', 'Suburban Pittsburgh. County has no countywide zoning. Self-storage requires 5+ acres in Penn Twp. Strong GIS.'),
        ('PA-FAYETTE', 'Fayette', 'PA', 'Pennsylvania', 'HYBRID', 42, 'HIGH', 'MEDIUM', 'Adjacent WV/MD. County administers UCC for some municipalities. Good property GIS.'),
        ('PA-WASHINGTON', 'Washington', 'PA', 'Pennsylvania', 'MUNICIPAL', 66, 'HIGH', 'HIGH', 'SW PA growth corridor. Harshman CE Group is TPA for City of Washington. Strong GIS Hub on ArcGIS.'),
        ('PA-CENTRE', 'Centre', 'PA', 'Pennsylvania', 'MUNICIPAL', 35, 'HIGH', 'HIGH', 'Penn State, growth market. Planning Commission assists 35 municipalities. Good GIS open data portal.'),
        ('PA-CUMBERLAND', 'Cumberland', 'PA', 'Pennsylvania', 'MUNICIPAL', 33, 'HIGH', 'HIGH', 'I-81 growth corridor, major distribution hub. 30 of 33 municipalities have zoning. Excellent GIS with zoning search tool.'),
        ('PA-ADAMS', 'Adams', 'PA', 'Pennsylvania', 'HYBRID', 34, 'HIGH', 'HIGH', 'MD border, growing. County zoning applies only to Germany and Menallen Townships. PMCA is TPA. Good GIS Hub.'),
        ('PA-YORK', 'York', 'PA', 'Pennsylvania', 'MUNICIPAL', 72, 'HIGH', 'HIGH', 'Major market. York County Planning Commission coordinates. Excellent GIS Portal with zoning layer.'),
        ('PA-DAUPHIN', 'Dauphin', 'PA', 'Pennsylvania', 'MUNICIPAL', 40, 'HIGH', 'HIGH', 'State capital. Tri-County Regional Planning Commission serves Dauphin and Perry. Good parcel viewer and open data.'),
    ]

    # Insert jurisdictions
    for j in jurisdictions:
        cur.execute("""
            INSERT INTO jurisdictions (
                jurisdiction_id, county_name, state_code, state_name,
                zoning_authority, municipality_count, pipeline_priority,
                data_quality_rating, notes, research_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (jurisdiction_id) DO UPDATE SET
                county_name = EXCLUDED.county_name,
                zoning_authority = EXCLUDED.zoning_authority,
                municipality_count = EXCLUDED.municipality_count,
                pipeline_priority = EXCLUDED.pipeline_priority,
                data_quality_rating = EXCLUDED.data_quality_rating,
                notes = EXCLUDED.notes,
                research_date = EXCLUDED.research_date,
                updated_at = CURRENT_TIMESTAMP
        """, (*j, date.today()))

    conn.commit()
    print(f"Inserted/updated {len(jurisdictions)} jurisdictions")

    # Insert zoning data
    zoning_data = [
        ('PA-SOMERSET', True, 'http://www.co.somerset.pa.us/department.asp?deptnum=104', 'County Website', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'County has interchange area zoning. Most municipalities have no zoning.', 'MEDIUM'),
        ('PA-FRANKLIN', True, 'https://www.franklincountypa.gov/index.php?section=departments_planning', 'County Website', True, 'self-storage', 'Commercial (varies by municipality)', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Penn Township allows self-storage with 5 acre minimum.', 'MEDIUM'),
        ('PA-WESTMORELAND', True, 'https://www.westmorelandcountypa.gov/1475/Subdivision-Development-Zoning', 'County Website', True, 'self-storage development', 'Rural Resource (Penn Twp)', 'Rural Resource (5 acre min)', 'NOT SPECIFIED', False, None, 'No countywide zoning. Penn Township allows self-storage in Rural Resource with 5 acre minimum.', 'MEDIUM'),
        ('PA-FAYETTE', True, 'https://www.fayettecountypa.org/259/Zoning-Planning', 'County Website', False, None, 'Commercial (varies)', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, '8 municipalities have zoning including Uniontown, Connellsville, and several townships.', 'MEDIUM'),
        ('PA-WASHINGTON', True, 'https://washingtonpa.us/codes-and-ordinances/', 'City Website', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'City of Washington has multi-municipal zoning ordinance with East Washington (April 2017).', 'MEDIUM'),
        ('PA-CENTRE', True, 'https://centrecountypa.gov/219/Municipal-Ordinances', 'County Website', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Planning Commission assists 35 municipalities. Each has own zoning ordinance.', 'MEDIUM'),
        ('PA-CUMBERLAND', True, 'https://gis.ccpa.net/maps/zoning-search/', 'GIS Portal', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, '30 of 33 municipalities have zoning. County provides digital zoning maps.', 'MEDIUM'),
        ('PA-ADAMS', True, 'https://www.adamscountypa.gov/departments/officeofplanninganddevelopment/zoning', 'County Website', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'County zoning applies only in Germany and Menallen Townships. Contact county for permits.', 'MEDIUM'),
        ('PA-YORK', True, 'https://www.ycpc.org/473/Current-Zoning-Maps', 'Planning Commission', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'York County Planning Commission maintains current zoning maps. 72 municipalities.', 'MEDIUM'),
        ('PA-DAUPHIN', True, 'https://www.tcrpc-pa.org/gis', 'Regional Planning', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Tri-County Regional Planning Commission serves Dauphin. Zoning varies by municipality.', 'MEDIUM'),
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
    print(f"Inserted/updated {len(zoning_data)} zoning records")

    # Insert GIS data (matching actual schema: portal_exists, portal_url, platform, has_zoning_layer, has_parcel_layer, has_owner_info, has_flood_layer, downloadable_data, download_sources, confidence_rating)
    gis_data = [
        ('PA-SOMERSET', True, 'https://somerset.maps.arcgis.com/', 'ArcGIS', False, True, True, True, False, None, 'MEDIUM'),
        ('PA-FRANKLIN', True, 'https://gisportal.franklincountypa.gov/', 'ArcGIS', False, True, True, True, False, None, 'HIGH'),
        ('PA-WESTMORELAND', True, 'https://gis.westmorelandcountypa.gov/apps/public/', 'ArcGIS', False, True, True, True, False, None, 'HIGH'),
        ('PA-FAYETTE', True, 'http://property.co.fayette.pa.us/map.aspx', 'Custom', False, True, True, True, False, None, 'MEDIUM'),
        ('PA-WASHINGTON', True, 'https://wcpagis-washcodps.hub.arcgis.com/', 'ArcGIS Hub', False, True, True, True, True, 'ArcGIS Hub downloads', 'HIGH'),
        ('PA-CENTRE', True, 'https://gisdata-centrecountygov.opendata.arcgis.com/', 'ArcGIS Open Data', False, True, True, True, True, 'Open Data Portal', 'HIGH'),
        ('PA-CUMBERLAND', True, 'https://gis.ccpa.net/propertymapper/', 'ArcGIS', True, True, True, True, False, None, 'HIGH'),
        ('PA-ADAMS', True, 'https://gis-hub-adamsgis.hub.arcgis.com/', 'ArcGIS Hub', False, True, True, True, True, 'ArcGIS Hub downloads', 'HIGH'),
        ('PA-YORK', True, 'https://york-county-pa-gis-portal-yorkcountypa.hub.arcgis.com/', 'ArcGIS Hub', True, True, True, True, True, 'ArcGIS Hub downloads', 'HIGH'),
        ('PA-DAUPHIN', True, 'https://gis.dauphincounty.org/', 'ArcGIS', True, True, True, True, True, 'Open Data Portal', 'HIGH'),
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
    print(f"Inserted/updated {len(gis_data)} GIS records")

    # Insert permit data (matching actual schema)
    permit_data = [
        ('PA-SOMERSET', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-FRANKLIN', True, 'https://pacodealliance.com/permit-applications/', 'PMCA Portal', True, True, True, True, False, True, True, False, False, False, False, False, None, 'NO', True, 'HIGH'),
        ('PA-WESTMORELAND', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-FAYETTE', True, 'https://www.fayettecountypa.org/280/Uniform-Construction-Code-Administration', 'Custom', False, True, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-WASHINGTON', True, 'https://washingtonpa.us/codes-and-ordinances/', 'Custom', False, True, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-CENTRE', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-CUMBERLAND', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-ADAMS', True, 'https://www.gettysburgpa.gov/permits-and-licenses', 'PMCA Portal', False, True, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'HIGH'),
        ('PA-YORK', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-DAUPHIN', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
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
    print(f"Inserted/updated {len(permit_data)} permit records")

    # Insert TPA data (matching actual schema: uses_tpa, tpa_name, tpa_website, tpa_portal_url, tpa_phone, tpa_email, tpa_address, coverage_type, tpa_count, notes)
    tpa_data = [
        ('PA-SOMERSET', True, 'PA Municipal Code Alliance (PMCA)', 'https://pacodealliance.com/', 'https://pacodealliance.com/permit-applications/', '814-444-6112', 'pmca@pacodealliance.com', '510 Georgian Place, Somerset, PA', 'SINGLE', 1, None),
        ('PA-FRANKLIN', True, 'PA Municipal Code Alliance (PMCA)', 'https://pacodealliance.com/', 'https://pacodealliance.com/permit-applications/', '717-496-4996', 'pmca@pacodealliance.com', '1013 Wayne Avenue, Chambersburg, PA 17201', 'SINGLE', 1, None),
        ('PA-WESTMORELAND', False, 'MUNICIPAL VARIES', None, None, None, None, None, 'FRAGMENTED', None, 'No county-wide TPA. Contact individual municipalities.'),
        ('PA-FAYETTE', True, 'County UCC Administration', None, None, '724-430-1213', None, '2 West Main St Suite 211, Uniontown, PA 15401', 'SINGLE', 1, None),
        ('PA-WASHINGTON', True, 'Harshman CE Group LLC', None, None, None, 'permits@harshmanllc.com', None, 'SINGLE', 1, 'City of Washington uses Harshman CE Group'),
        ('PA-CENTRE', False, 'MUNICIPAL VARIES', None, None, None, None, None, 'FRAGMENTED', None, 'No county-wide TPA. Contact individual municipalities.'),
        ('PA-CUMBERLAND', False, 'MUNICIPAL VARIES', None, None, None, None, None, 'FRAGMENTED', None, 'No county-wide TPA. Contact individual municipalities.'),
        ('PA-ADAMS', True, 'PA Municipal Code Alliance (PMCA)', 'https://pacodealliance.com/', 'https://pacodealliance.com/permit-applications/', '717-321-9046', 'pmca@pacodealliance.com', '1895B York Road, Gettysburg, PA', 'SINGLE', 1, None),
        ('PA-YORK', False, 'MUNICIPAL VARIES', None, None, None, None, None, 'FRAGMENTED', None, 'No county-wide TPA. Contact individual municipalities.'),
        ('PA-DAUPHIN', False, 'MUNICIPAL VARIES', None, None, None, None, None, 'FRAGMENTED', None, 'No county-wide TPA. Contact individual municipalities.'),
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
    print(f"Inserted/updated {len(tpa_data)} TPA records")

    # Final count
    cur.execute("SELECT COUNT(*) FROM jurisdictions")
    total = cur.fetchone()[0]
    print(f"\nTotal jurisdictions in database: {total}")

    # Show all jurisdictions
    cur.execute("SELECT jurisdiction_id, county_name, state_code, pipeline_priority FROM jurisdictions ORDER BY state_code, county_name")
    print("\nAll jurisdictions:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}, {row[2]} - Priority: {row[3]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    insert_jurisdictions()
