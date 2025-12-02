"""
Insert Pennsylvania Tier 2-3 jurisdictions into database
Counties: Fulton, Huntingdon, Indiana, Greene, Mifflin, Perry, Clearfield, Juniata, Clinton
"""

import psycopg2
from datetime import date

CONNECTION_STRING = "postgresql://neondb_owner:npg_ToBJraVD83YX@ep-rapid-dream-aelbcqxw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

def insert_jurisdictions():
    conn = psycopg2.connect(CONNECTION_STRING)
    cur = conn.cursor()

    # Pennsylvania Tier 2-3 Counties Data
    jurisdictions = [
        ('PA-FULTON', 'Fulton', 'PA', 'Pennsylvania', 'HYBRID', 12, 'MEDIUM', 'MEDIUM', 'Rural county, MD border. County Planning Commission at 219 N 2nd St, McConnellsburg. GIS web tool available.'),
        ('PA-HUNTINGDON', 'Huntingdon', 'PA', 'Pennsylvania', 'MUNICIPAL', 48, 'MEDIUM', 'MEDIUM', 'Rural, SAP&DC region. Model Zoning Ordinance available. 30 of 48 municipalities have SALDO. ArcGIS Hub mapping.'),
        ('PA-INDIANA', 'Indiana', 'PA', 'Pennsylvania', 'HYBRID', 38, 'HIGH', 'HIGH', 'ICOPD administers UCC for 32 of 38 municipalities. New SALDO adopted August 2023. Strong county permit system.'),
        ('PA-GREENE', 'Greene', 'PA', 'Pennsylvania', 'HYBRID', 26, 'MEDIUM', 'HIGH', 'WV border. Planning Commission at 93 E High St, Waynesburg. Vision Government Solutions GIS. Tax abatement program.'),
        ('PA-MIFFLIN', 'Mifflin', 'PA', 'Pennsylvania', 'HYBRID', 15, 'MEDIUM', 'HIGH', '10 municipalities have own SALDO, 5 use county. Lewistown has zoning viewer. GIS portal available.'),
        ('PA-PERRY', 'Perry', 'PA', 'Pennsylvania', 'MUNICIPAL', 29, 'MEDIUM', 'MEDIUM', 'CK-COG region. Planning Commission at 20 W McClure St, New Bloomfield. BIU is TPA for some townships.'),
        ('PA-CLEARFIELD', 'Clearfield', 'PA', 'Pennsylvania', 'HYBRID', 51, 'MEDIUM', 'HIGH', 'I-80 corridor. ArcGIS Online Mapping Viewer. Digital GIS data for purchase. 70,000 parcels.'),
        ('PA-JUNIATA', 'Juniata', 'PA', 'Pennsylvania', 'MUNICIPAL', 17, 'MEDIUM', 'LOW', 'Small rural county. Assessment & GIS at 26 N Main St, Mifflintown. Uses PASDA for state-level GIS.'),
        ('PA-CLINTON', 'Clinton', 'PA', 'Pennsylvania', 'HYBRID', 29, 'MEDIUM', 'HIGH', 'County zoning covers 7 municipalities, SALDO covers 15. ArcGIS parcel viewer. Vision Government Solutions GIS.'),
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
        ('PA-FULTON', True, 'https://www.co.fulton.pa.us/files/live-folders/mcconnellsburg/McConnellsburg%20Zoning%20Ordinance%20-%201995.pdf', 'County Website', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'McConnellsburg Borough has 1995 Zoning Ordinance. Contact Planning at 717-485-3717.', 'MEDIUM'),
        ('PA-HUNTINGDON', True, 'https://www.huntingdoncounty.net/departments/planning-and-development', 'County Website', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Model Zoning Ordinance developed 2007. 30 of 48 municipalities have SALDO. Alleghenies Ahead regional plan.', 'MEDIUM'),
        ('PA-INDIANA', True, 'https://www.icopd.org/zoning.html', 'ICOPD Website', True, 'self-storage', 'Buffer Zone, Conservation Zone (county parks)', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'County zoning around parks only. SALDO 2023-0412 adopted April 2023. ICOPD handles UCC.', 'HIGH'),
        ('PA-GREENE', True, 'https://greenecountypa.gov/department-planning-commission', 'County Website', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Planning Commission reviews subdivisions. Tax abatement program available.', 'MEDIUM'),
        ('PA-MIFFLIN', True, 'https://www.mifflincountypa.gov/planning/subdivision-and-land-development-ordinance', 'County Website', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'SALDO adopted 1995, updated 2003, amended 2006. 10 municipalities have own ordinance.', 'MEDIUM'),
        ('PA-PERRY', True, 'https://perryco.org/departments/planning-commission/', 'County Website', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Central Keystone COG region. Contact Planning at 717-582-5124. BIU handles UCC for some townships.', 'MEDIUM'),
        ('PA-CLEARFIELD', True, 'https://clearfieldcountypa.gov/211/Digital-GIS-Data', 'County Website', False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'I-80 corridor. Assessment Office maintains parcel data. GIS Department provides mapping services.', 'MEDIUM'),
        ('PA-JUNIATA', False, None, None, False, None, 'NOT SPECIFIED', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'Small rural county. Contact municipalities directly for zoning. Assessment at 26 N Main St, Mifflintown.', 'LOW'),
        ('PA-CLINTON', True, 'https://www.clintoncountypa.gov/departments/planning-grants-zoning/ordinances-maps', 'County Website', True, 'zoning permit', 'Varies by municipality', 'NOT SPECIFIED', 'NOT SPECIFIED', False, None, 'County zoning covers 7 municipalities. 29 municipal ordinances posted online. Zoning permit $35-$75.', 'HIGH'),
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

    # Insert GIS data
    gis_data = [
        ('PA-FULTON', True, 'https://www.co.fulton.pa.us/planning-commission.php', 'County Web Tool', False, True, True, False, False, None, 'MEDIUM'),
        ('PA-HUNTINGDON', True, 'https://huntingdoncounty.maps.arcgis.com/', 'ArcGIS Hub', False, True, True, False, False, None, 'MEDIUM'),
        ('PA-INDIANA', True, 'https://www.indianacountypa.gov/departments/planning-and-development/', 'Custom', False, True, True, False, False, None, 'HIGH'),
        ('PA-GREENE', True, 'https://gis.vgsi.com/greenecountypa/', 'Vision Government Solutions', False, True, True, True, False, None, 'HIGH'),
        ('PA-MIFFLIN', True, 'https://gisportal.co.mifflin.pa.us/portal/apps/webappviewer/', 'ArcGIS Portal', True, True, True, True, False, None, 'HIGH'),
        ('PA-PERRY', True, 'https://perryco.org/', 'County Website', False, True, True, False, False, None, 'MEDIUM'),
        ('PA-CLEARFIELD', True, 'https://arcgis.clearfieldco.org/ccportal/apps/webappviewer/', 'ArcGIS', False, True, True, True, True, 'Shapefile purchase available', 'HIGH'),
        ('PA-JUNIATA', True, 'https://www.juniataco.org/departments/assessment-gis/', 'County Website', False, True, True, False, False, None, 'LOW'),
        ('PA-CLINTON', True, 'https://gis.vgsi.com/clintoncountypa/', 'Vision Government Solutions', False, True, True, True, False, None, 'HIGH'),
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

    # Insert permit data
    permit_data = [
        ('PA-FULTON', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-HUNTINGDON', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-INDIANA', True, 'https://www.icopd.org/building-permits.html', 'ICOPD Portal', True, True, True, True, False, True, True, False, False, False, False, False, None, 'NO', False, 'HIGH'),
        ('PA-GREENE', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-MIFFLIN', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-PERRY', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-CLEARFIELD', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'MEDIUM'),
        ('PA-JUNIATA', False, None, None, False, False, False, False, False, False, False, False, False, False, False, False, None, 'NO', True, 'LOW'),
        ('PA-CLINTON', True, 'https://www.clintoncountypa.gov/departments/planning-grants-zoning/request-a-zoning-building-permit', 'County Portal', True, True, False, False, False, False, False, False, False, False, False, False, None, 'NO', False, 'HIGH'),
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

    # Insert TPA data
    tpa_data = [
        ('PA-FULTON', False, 'MUNICIPAL VARIES', None, None, None, None, None, 'FRAGMENTED', None, 'Contact Planning Office at 717-485-3717 for permit info.'),
        ('PA-HUNTINGDON', False, 'MUNICIPAL VARIES', None, None, None, None, None, 'FRAGMENTED', None, 'Contact Planning Director Laurie Nearhood at lnearhood@huntingdoncounty.net'),
        ('PA-INDIANA', True, 'Indiana County Office of Planning & Development (ICOPD)', 'https://www.icopd.org/', 'https://www.icopd.org/building-permits.html', '724-465-3879', None, None, 'SINGLE', 1, 'ICOPD administers UCC for 32 of 38 municipalities. MuniciPay online payments available.'),
        ('PA-GREENE', False, 'MUNICIPAL VARIES', None, None, '724-852-5300', 'klamb@greenecountypa.gov', '93 E High St, Waynesburg, PA 15370', 'FRAGMENTED', None, 'Contact Planning Director for GIS services and permit info.'),
        ('PA-MIFFLIN', False, 'MUNICIPAL VARIES', None, None, '717-242-1145', None, '2 East Third St, Lewistown, PA 17044', 'FRAGMENTED', None, 'Contact Lewistown Borough Codes Office for borough permits. County handles subdivisions.'),
        ('PA-PERRY', True, 'Building Inspection Underwriters (BIU)', None, None, None, None, 'New Bloomfield, PA', 'PARTIAL', None, 'BIU handles UCC for some townships (e.g., Rye Township). Contact CK-COG for info.'),
        ('PA-CLEARFIELD', False, 'MUNICIPAL VARIES', None, None, None, 'gis@clearfieldco.org', None, 'FRAGMENTED', None, 'Contact GIS Department for mapping. Assessment Office at 814-765-2641.'),
        ('PA-JUNIATA', False, 'MUNICIPAL VARIES', None, None, '717-436-7740', None, '26 North Main St, Mifflintown, PA 17059', 'FRAGMENTED', None, 'Contact Assessment Office for property info.'),
        ('PA-CLINTON', True, 'County Planning Office', 'https://www.clintoncountypa.gov/', 'https://www.clintoncountypa.gov/departments/planning-grants-zoning/request-a-zoning-building-permit', '570-893-4080', 'planning@clintoncountypa.gov', '2 Piper Way Suite 244, Lock Haven, PA 17745', 'PARTIAL', 1, 'Zoning covers 7 municipalities. UCC handled separately by municipalities.'),
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
