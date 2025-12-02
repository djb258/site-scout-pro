"""
Test connections to all county permit systems, GIS portals, and data sources.
Generates a comprehensive report of what's accessible and what method to use.
"""

import requests
import time
import json
from datetime import datetime
from typing import Dict, List, Tuple

# Suppress SSL warnings for testing
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class CountyConnectionTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })
        self.results = {}

    def test_url(self, url: str, timeout: int = 15) -> Dict:
        """Test a single URL and return results"""
        result = {
            'url': url,
            'status': None,
            'accessible': False,
            'error': None,
            'content_type': None,
            'is_pdf': False,
            'response_time': None,
        }

        try:
            start = time.time()
            r = self.session.get(url, timeout=timeout, allow_redirects=True, verify=False)
            result['response_time'] = round(time.time() - start, 2)
            result['status'] = r.status_code
            result['accessible'] = r.status_code == 200
            result['content_type'] = r.headers.get('Content-Type', '')
            result['final_url'] = r.url

            # Check if PDF
            if 'pdf' in result['content_type'].lower() or (len(r.content) > 4 and r.content[:4] == b'%PDF'):
                result['is_pdf'] = True
                result['size_bytes'] = len(r.content)

            # Check for common blocking patterns
            if r.status_code == 200:
                text_lower = r.text.lower() if hasattr(r, 'text') else ''
                if 'captcha' in text_lower or 'cloudflare' in text_lower:
                    result['blocked_by'] = 'CAPTCHA/Cloudflare'
                    result['accessible'] = False

        except requests.exceptions.Timeout:
            result['error'] = 'TIMEOUT'
        except requests.exceptions.ConnectionError as e:
            if 'NameResolution' in str(e) or 'getaddrinfo' in str(e):
                result['error'] = 'DNS_FAIL'
            else:
                result['error'] = 'CONNECTION_ERROR'
        except Exception as e:
            result['error'] = str(e)[:100]

        return result

    def test_county(self, county_id: str, county_name: str, state: str, urls: Dict) -> Dict:
        """Test all URLs for a county"""
        print(f"\n  Testing {county_name}, {state}...", end=" ", flush=True)

        county_result = {
            'county_id': county_id,
            'county_name': county_name,
            'state': state,
            'tests': {},
            'summary': {
                'permit_portal': 'UNKNOWN',
                'gis_portal': 'UNKNOWN',
                'documents': 'UNKNOWN',
                'recommended_method': 'MANUAL',
            }
        }

        for test_name, url in urls.items():
            if url:
                county_result['tests'][test_name] = self.test_url(url)
                time.sleep(0.5)  # Be polite

        # Analyze results
        tests = county_result['tests']

        # Permit portal status
        if 'permit_portal' in tests:
            if tests['permit_portal']['accessible']:
                county_result['summary']['permit_portal'] = 'WORKING'
                county_result['summary']['recommended_method'] = 'SCRAPER'
            elif tests['permit_portal']['error'] == 'DNS_FAIL':
                county_result['summary']['permit_portal'] = 'DNS_FAIL'
            elif tests['permit_portal']['status'] == 403:
                county_result['summary']['permit_portal'] = 'BLOCKED_403'
                county_result['summary']['recommended_method'] = 'BROWSER_AUTOMATION'
            else:
                county_result['summary']['permit_portal'] = 'FAILED'

        # GIS portal status
        if 'gis_portal' in tests:
            if tests['gis_portal']['accessible']:
                county_result['summary']['gis_portal'] = 'WORKING'
            else:
                county_result['summary']['gis_portal'] = 'FAILED'

        # Document status
        doc_tests = [k for k in tests.keys() if 'doc' in k.lower() or 'pdf' in k.lower() or 'ordinance' in k.lower()]
        if doc_tests:
            working_docs = sum(1 for k in doc_tests if tests[k]['accessible'])
            county_result['summary']['documents'] = f'{working_docs}/{len(doc_tests)} ACCESSIBLE'

        status = "OK" if county_result['summary']['permit_portal'] == 'WORKING' else county_result['summary']['permit_portal']
        print(status)

        return county_result


def get_all_counties() -> List[Dict]:
    """Define all counties with their test URLs"""

    counties = [
        # ===================== PENNSYLVANIA (23) =====================
        # PA Tier 1
        {'id': 'PA-SOMERSET', 'name': 'Somerset', 'state': 'PA', 'urls': {
            'county_website': 'https://www.co.somerset.pa.us/',
            'gis_portal': 'https://somerset.maps.arcgis.com/',
            'permit_portal': None,  # No online portal
        }},
        {'id': 'PA-FRANKLIN', 'name': 'Franklin', 'state': 'PA', 'urls': {
            'county_website': 'https://www.franklincountypa.gov/',
            'gis_portal': 'https://gisportal.franklincountypa.gov/',
            'permit_portal': 'https://pacodealliance.com/permit-applications/',
        }},
        {'id': 'PA-WESTMORELAND', 'name': 'Westmoreland', 'state': 'PA', 'urls': {
            'county_website': 'https://www.westmorelandcountypa.gov/',
            'gis_portal': 'https://gis.westmorelandcountypa.gov/apps/public/',
            'permit_portal': None,
        }},
        {'id': 'PA-FAYETTE', 'name': 'Fayette', 'state': 'PA', 'urls': {
            'county_website': 'https://www.fayettecountypa.org/',
            'gis_portal': 'http://property.co.fayette.pa.us/map.aspx',
            'permit_portal': 'https://www.fayettecountypa.org/280/Uniform-Construction-Code-Administration',
        }},
        {'id': 'PA-WASHINGTON', 'name': 'Washington', 'state': 'PA', 'urls': {
            'county_website': 'https://www.washingtonpa.us/',
            'gis_portal': 'https://wcpagis-washcodps.hub.arcgis.com/',
            'permit_portal': 'https://washingtonpa.us/codes-and-ordinances/',
        }},
        {'id': 'PA-CENTRE', 'name': 'Centre', 'state': 'PA', 'urls': {
            'county_website': 'https://centrecountypa.gov/',
            'gis_portal': 'https://gisdata-centrecountygov.opendata.arcgis.com/',
            'permit_portal': None,
        }},
        {'id': 'PA-CUMBERLAND', 'name': 'Cumberland', 'state': 'PA', 'urls': {
            'county_website': 'https://www.ccpa.net/',
            'gis_portal': 'https://gis.ccpa.net/propertymapper/',
            'permit_portal': None,
        }},
        {'id': 'PA-ADAMS', 'name': 'Adams', 'state': 'PA', 'urls': {
            'county_website': 'https://www.adamscountypa.gov/',
            'gis_portal': 'https://gis-hub-adamsgis.hub.arcgis.com/',
            'permit_portal': 'https://pacodealliance.com/permit-applications/',
        }},
        {'id': 'PA-YORK', 'name': 'York', 'state': 'PA', 'urls': {
            'county_website': 'https://www.yorkcountypa.gov/',
            'gis_portal': 'https://york-county-pa-gis-portal-yorkcountypa.hub.arcgis.com/',
            'permit_portal': None,
        }},
        {'id': 'PA-DAUPHIN', 'name': 'Dauphin', 'state': 'PA', 'urls': {
            'county_website': 'https://www.dauphincounty.org/',
            'gis_portal': 'https://gis.dauphincounty.org/',
            'permit_portal': None,
        }},
        {'id': 'PA-INDIANA', 'name': 'Indiana', 'state': 'PA', 'urls': {
            'county_website': 'https://www.indianacountypa.gov/',
            'gis_portal': 'https://www.indianacountypa.gov/departments/planning-and-development/',
            'permit_portal': 'https://www.icopd.org/building-permits.html',
        }},
        # PA Tier 2-3
        {'id': 'PA-FULTON', 'name': 'Fulton', 'state': 'PA', 'urls': {
            'county_website': 'https://www.co.fulton.pa.us/',
            'gis_portal': 'https://www.co.fulton.pa.us/planning-commission.php',
            'permit_portal': None,
        }},
        {'id': 'PA-HUNTINGDON', 'name': 'Huntingdon', 'state': 'PA', 'urls': {
            'county_website': 'https://www.huntingdoncounty.net/',
            'gis_portal': 'https://huntingdoncounty.maps.arcgis.com/',
            'permit_portal': None,
        }},
        {'id': 'PA-GREENE', 'name': 'Greene', 'state': 'PA', 'urls': {
            'county_website': 'https://greenecountypa.gov/',
            'gis_portal': 'https://gis.vgsi.com/greenecountypa/',
            'permit_portal': None,
        }},
        {'id': 'PA-MIFFLIN', 'name': 'Mifflin', 'state': 'PA', 'urls': {
            'county_website': 'https://www.mifflincountypa.gov/',
            'gis_portal': 'https://gisportal.co.mifflin.pa.us/portal/apps/webappviewer/',
            'permit_portal': None,
        }},
        {'id': 'PA-PERRY', 'name': 'Perry', 'state': 'PA', 'urls': {
            'county_website': 'https://perryco.org/',
            'gis_portal': 'https://perryco.org/',
            'permit_portal': None,
        }},
        {'id': 'PA-CLEARFIELD', 'name': 'Clearfield', 'state': 'PA', 'urls': {
            'county_website': 'https://clearfieldcountypa.gov/',
            'gis_portal': 'https://arcgis.clearfieldco.org/ccportal/apps/webappviewer/',
            'permit_portal': None,
        }},
        {'id': 'PA-JUNIATA', 'name': 'Juniata', 'state': 'PA', 'urls': {
            'county_website': 'https://www.juniataco.org/',
            'gis_portal': 'https://www.juniataco.org/departments/assessment-gis/',
            'permit_portal': None,
        }},
        {'id': 'PA-CLINTON', 'name': 'Clinton', 'state': 'PA', 'urls': {
            'county_website': 'https://www.clintoncountypa.gov/',
            'gis_portal': 'https://gis.vgsi.com/clintoncountypa/',
            'permit_portal': 'https://www.clintoncountypa.gov/departments/planning-grants-zoning/request-a-zoning-building-permit',
        }},
        {'id': 'PA-BEDFORD', 'name': 'Bedford', 'state': 'PA', 'urls': {
            'county_website': 'https://www.bedfordcountypa.org/',
            'gis_portal': 'https://bedford.mapblock.io/',
            'permit_portal': None,
        }},
        {'id': 'PA-BLAIR', 'name': 'Blair', 'state': 'PA', 'urls': {
            'county_website': 'https://www.blaircountypa.gov/',
            'gis_portal': 'https://gis.blaircountypa.gov/portal',
            'permit_portal': None,
        }},
        {'id': 'PA-CAMBRIA', 'name': 'Cambria', 'state': 'PA', 'urls': {
            'county_website': 'https://www.co.cambria.pa.us/',
            'gis_portal': 'https://cambriapa.maps.arcgis.com/',
            'permit_portal': None,
        }},
        {'id': 'PA-ALLEGHENY', 'name': 'Allegheny', 'state': 'PA', 'urls': {
            'county_website': 'https://www.alleghenycounty.us/',
            'gis_portal': 'https://openac-alcogis.opendata.arcgis.com/',
            'permit_portal': None,  # Highly fragmented - 130 municipalities
        }},

        # ===================== WEST VIRGINIA (15) =====================
        # WV Eastern Panhandle (Tier 1)
        {'id': 'WV-BERKELEY', 'name': 'Berkeley', 'state': 'WV', 'urls': {
            'county_website': 'https://www.berkeleywv.org/',
            'gis_portal': 'https://maps.berkeleywv.org/berkeleyonline/',
            'permit_portal': 'https://onestop.berkeleywv.org/',
            'ordinance_pdf': 'https://berkeleywv.org/DocumentCenter/View/342/2025-Subdivision-and-Land-Use-Ordinance-PDF',
        }},
        {'id': 'WV-JEFFERSON', 'name': 'Jefferson', 'state': 'WV', 'urls': {
            'county_website': 'https://www.jeffersoncountywv.org/',
            'gis_portal': 'https://od-jcwvgis.opendata.arcgis.com/',
            'permit_portal': 'https://www.mgoconnect.org/cp?JID=171',
            'ordinance_pdf': 'http://www.jeffersoncountywv.org/home/showdocument?id=12211',
        }},
        {'id': 'WV-MORGAN', 'name': 'Morgan', 'state': 'WV', 'urls': {
            'county_website': 'https://morgancountywv.gov/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,
        }},
        # WV Tier 1 - Monongalia
        {'id': 'WV-54061', 'name': 'Monongalia', 'state': 'WV', 'urls': {
            'county_website': 'https://www.monongaliacounty.gov/',
            'gis_portal': 'https://www.monongaliacounty.gov/',
            'permit_portal': None,
        }},
        # WV Tier 2
        {'id': 'WV-54027', 'name': 'Hampshire', 'state': 'WV', 'urls': {
            'county_website': 'https://hampshirewv.gov/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,  # NO ZONING
        }},
        {'id': 'WV-54057', 'name': 'Mineral', 'state': 'WV', 'urls': {
            'county_website': 'https://mineralcountywv.gov/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,
        }},
        {'id': 'WV-54031', 'name': 'Hardy', 'state': 'WV', 'urls': {
            'county_website': 'https://www.hardycounty.com/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,
        }},
        {'id': 'WV-54083', 'name': 'Randolph', 'state': 'WV', 'urls': {
            'county_website': 'https://www.randolphcountywv.com/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,
        }},
        {'id': 'WV-54077', 'name': 'Preston', 'state': 'WV', 'urls': {
            'county_website': 'https://prestoncountywv.gov/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,  # NO ZONING
        }},
        {'id': 'WV-54049', 'name': 'Marion', 'state': 'WV', 'urls': {
            'county_website': 'https://www.marioncountywv.com/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,
        }},
        {'id': 'WV-54033', 'name': 'Harrison', 'state': 'WV', 'urls': {
            'county_website': 'https://harrisoncountywv.com/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,
        }},
        # WV Tier 3
        {'id': 'WV-54023', 'name': 'Grant', 'state': 'WV', 'urls': {
            'county_website': 'https://grantcountywv.gov/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,  # NO ZONING
        }},
        {'id': 'WV-54071', 'name': 'Pendleton', 'state': 'WV', 'urls': {
            'county_website': 'https://pendletoncountywv.gov/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,  # NO ZONING
        }},
        {'id': 'WV-54093', 'name': 'Tucker', 'state': 'WV', 'urls': {
            'county_website': 'https://tuckercountywv.gov/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,
        }},
        {'id': 'WV-54075', 'name': 'Pocahontas', 'state': 'WV', 'urls': {
            'county_website': 'https://pocahontascountywv.gov/',
            'gis_portal': 'http://www.mapwv.gov/parcel/',
            'permit_portal': None,  # NO ZONING
        }},

        # ===================== VIRGINIA (13) =====================
        {'id': 'VA-FREDERICK', 'name': 'Frederick', 'state': 'VA', 'urls': {
            'county_website': 'https://www.fcva.us/',
            'gis_portal': 'https://gis.fcva.us/',
            'permit_portal': 'https://energov.frederickcountyva.gov/',
            'permit_reports': 'https://www.fcva.us/departments/building-inspections/permit-reports',
        }},
        {'id': 'VA-51187', 'name': 'Warren', 'state': 'VA', 'urls': {
            'county_website': 'https://www.warrencountyva.gov/',
            'gis_portal': 'https://www.warrencountyva.gov/government/departments/gis',
            'permit_portal': 'https://www.warrencountyva.gov/government/departments/building_inspections',
        }},
        {'id': 'VA-51171', 'name': 'Shenandoah', 'state': 'VA', 'urls': {
            'county_website': 'https://www.shenandoahcountyva.us/',
            'gis_portal': 'https://www.shenandoahcountyva.us/gis/',
            'permit_portal': 'https://www.shenandoahcountyva.us/building/',
        }},
        {'id': 'VA-51165', 'name': 'Rockingham', 'state': 'VA', 'urls': {
            'county_website': 'https://www.rockinghamcountyva.gov/',
            'gis_portal': 'https://gis.rockinghamcountyva.gov/',
            'permit_portal': 'https://www.rockinghamcountyva.gov/306/Building-Inspection',
        }},
        {'id': 'VA-51015', 'name': 'Augusta', 'state': 'VA', 'urls': {
            'county_website': 'https://www.co.augusta.va.us/',
            'gis_portal': 'https://gis.co.augusta.va.us/',
            'permit_portal': 'https://www.co.augusta.va.us/government/building-inspections',
        }},
        {'id': 'VA-51043', 'name': 'Clarke', 'state': 'VA', 'urls': {
            'county_website': 'https://www.clarkecounty.gov/',
            'gis_portal': 'https://www.clarkecounty.gov/government/gis',
            'permit_portal': None,
        }},
        {'id': 'VA-51139', 'name': 'Page', 'state': 'VA', 'urls': {
            'county_website': 'https://www.pagecounty.virginia.gov/',
            'gis_portal': 'https://www.pagecounty.virginia.gov/264/GIS-Mapping',
            'permit_portal': None,
        }},
        {'id': 'VA-51005', 'name': 'Alleghany', 'state': 'VA', 'urls': {
            'county_website': 'https://www.alleghanycounty-va.gov/',
            'gis_portal': 'https://www.alleghanycounty-va.gov/',
            'permit_portal': None,
        }},
        {'id': 'VA-51163', 'name': 'Rockbridge', 'state': 'VA', 'urls': {
            'county_website': 'https://www.rockbridgecountyva.gov/',
            'gis_portal': 'https://gis.rockbridgecountyva.gov/',
            'permit_portal': None,
        }},
        {'id': 'VA-51023', 'name': 'Botetourt', 'state': 'VA', 'urls': {
            'county_website': 'https://www.botetourt.org/',
            'gis_portal': 'https://gis.botetourt.org/',
            'permit_portal': 'https://www.botetourt.org/government/departments/building_inspection',
        }},
        {'id': 'VA-51091', 'name': 'Highland', 'state': 'VA', 'urls': {
            'county_website': 'https://www.highlandcova.org/',
            'gis_portal': 'https://www.highlandcova.org/',
            'permit_portal': None,
        }},
        {'id': 'VA-51017', 'name': 'Bath', 'state': 'VA', 'urls': {
            'county_website': 'https://www.bathcountyva.org/',
            'gis_portal': 'https://www.bathcountyva.org/',
            'permit_portal': None,
        }},
        {'id': 'VA-51009', 'name': 'Amherst', 'state': 'VA', 'urls': {
            'county_website': 'https://www.countyofamherst.com/',
            'gis_portal': 'https://www.countyofamherst.com/government/gis',
            'permit_portal': None,
        }},

        # ===================== MARYLAND (5) =====================
        {'id': 'MD-24043', 'name': 'Washington', 'state': 'MD', 'urls': {
            'county_website': 'https://www.washco-md.net/',
            'gis_portal': 'https://gis.washco-md.net/',
            'permit_portal': 'https://www.washco-md.net/permits-and-inspections/',
        }},
        {'id': 'MD-24021', 'name': 'Frederick', 'state': 'MD', 'urls': {
            'county_website': 'https://www.frederickcountymd.gov/',
            'gis_portal': 'https://gis.frederickcountymd.gov/',
            'permit_portal': 'https://www.frederickcountymd.gov/7974/Permits-and-Inspections',
        }},
        {'id': 'MD-24001', 'name': 'Allegany', 'state': 'MD', 'urls': {
            'county_website': 'https://alleganyco.gov/',
            'gis_portal': 'https://www.alleganyco.gov/gis/',
            'permit_portal': 'https://alleganyco.gov/permits-inspections/',
        }},
        {'id': 'MD-24023', 'name': 'Garrett', 'state': 'MD', 'urls': {
            'county_website': 'https://www.garrettcounty.org/',
            'gis_portal': 'https://www.garrettcounty.org/gis',
            'permit_portal': 'https://www.garrettcounty.org/planning-land-development/permits',
        }},
        {'id': 'MD-24013', 'name': 'Carroll', 'state': 'MD', 'urls': {
            'county_website': 'https://www.carrollcountymd.gov/',
            'gis_portal': 'https://gis.carrollcountymd.gov/',
            'permit_portal': 'https://www.carrollcountymd.gov/government/directory/permits-and-inspections/',
        }},
    ]

    return counties


def main():
    print("=" * 70)
    print("COUNTY CONNECTION TEST - ALL 56 COUNTIES")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    tester = CountyConnectionTester()
    counties = get_all_counties()

    all_results = []

    # Group by state
    states = {}
    for c in counties:
        state = c['state']
        if state not in states:
            states[state] = []
        states[state].append(c)

    for state, state_counties in states.items():
        print(f"\n{'=' * 70}")
        print(f"TESTING {state} ({len(state_counties)} counties)")
        print("=" * 70)

        for county in state_counties:
            result = tester.test_county(
                county['id'],
                county['name'],
                county['state'],
                county['urls']
            )
            all_results.append(result)

    # Generate summary
    print("\n" + "=" * 70)
    print("SUMMARY REPORT")
    print("=" * 70)

    # Count by status
    permit_working = sum(1 for r in all_results if r['summary']['permit_portal'] == 'WORKING')
    permit_blocked = sum(1 for r in all_results if r['summary']['permit_portal'] == 'BLOCKED_403')
    permit_dns_fail = sum(1 for r in all_results if r['summary']['permit_portal'] == 'DNS_FAIL')
    permit_none = sum(1 for r in all_results if r['summary']['permit_portal'] in ['UNKNOWN', 'FAILED'])

    gis_working = sum(1 for r in all_results if r['summary']['gis_portal'] == 'WORKING')

    print(f"\nPERMIT PORTALS:")
    print(f"  Working: {permit_working}")
    print(f"  Blocked (403): {permit_blocked}")
    print(f"  DNS Fail: {permit_dns_fail}")
    print(f"  None/Failed: {permit_none}")

    print(f"\nGIS PORTALS:")
    print(f"  Working: {gis_working}")
    print(f"  Failed: {len(all_results) - gis_working}")

    print("\n" + "-" * 70)
    print("RECOMMENDED METHODS BY COUNTY:")
    print("-" * 70)

    methods = {'SCRAPER': [], 'BROWSER_AUTOMATION': [], 'MANUAL': []}
    for r in all_results:
        method = r['summary']['recommended_method']
        methods[method].append(f"{r['state']}-{r['county_name']}")

    for method, counties in methods.items():
        print(f"\n{method} ({len(counties)}):")
        for c in counties[:10]:  # Show first 10
            print(f"  - {c}")
        if len(counties) > 10:
            print(f"  ... and {len(counties) - 10} more")

    # Save results to JSON
    output_file = 'connection_test_results.json'
    with open(output_file, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f"\nDetailed results saved to: {output_file}")

    print("\n" + "=" * 70)
    print(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    return all_results


if __name__ == "__main__":
    main()
