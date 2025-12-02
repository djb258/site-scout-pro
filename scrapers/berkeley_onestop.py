"""
Berkeley County, WV - OneStop/Citizenserve Scraper
Good search functionality with exportable reports
"""

import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from bs4 import BeautifulSoup

from .base import BaseScraper

logger = logging.getLogger('hive_scraper')


class BerkeleyOneStopScraper(BaseScraper):
    """
    Scraper for Berkeley County, WV OneStop/Citizenserve system

    Portal: https://onestop.berkeleywv.org/
    Platform: Citizenserve OneStop

    Features:
    - ASP.NET form-based search
    - Public search available
    - Report export functionality
    - Good search filters

    Note: ASP.NET sites require handling ViewState for form submissions
    """

    def __init__(self):
        super().__init__(
            jurisdiction_id='WV-BERKELEY',
            source_system='ONESTOP'
        )
        self.base_url = "https://onestop.berkeleywv.org"
        self.rate_limit_delay = 2.0  # Slightly slower for ASP.NET

        # Update session headers for ASP.NET
        self.session.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })

    def _get_viewstate(self, html: str) -> Dict[str, str]:
        """Extract ASP.NET ViewState and validation tokens"""
        soup = BeautifulSoup(html, 'html.parser')

        tokens = {}

        viewstate = soup.find('input', {'name': '__VIEWSTATE'})
        if viewstate:
            tokens['__VIEWSTATE'] = viewstate.get('value', '')

        viewstate_gen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
        if viewstate_gen:
            tokens['__VIEWSTATEGENERATOR'] = viewstate_gen.get('value', '')

        eventvalidation = soup.find('input', {'name': '__EVENTVALIDATION'})
        if eventvalidation:
            tokens['__EVENTVALIDATION'] = eventvalidation.get('value', '')

        return tokens

    def search_permits(self, start_date: datetime, end_date: datetime,
                       permit_type: str = None, address: str = None) -> List[Dict]:
        """
        Search permits via OneStop form submission

        Citizenserve typically uses form POST for searches
        """
        all_results = []

        try:
            # Step 1: Get search page and extract ViewState
            search_url = f"{self.base_url}/Search.aspx"
            search_page = self.session.get(search_url, timeout=30)

            if search_page.status_code != 200:
                logger.error(f"Failed to load search page: {search_page.status_code}")
                return []

            viewstate = self._get_viewstate(search_page.text)

            # Step 2: Build form data
            # Common Citizenserve form field names (verify actual names)
            form_data = {
                **viewstate,
                'txtAddress': address or '',
                'ddlPermitType': permit_type or '',
                'txtDateFrom': start_date.strftime('%m/%d/%Y'),
                'txtDateTo': end_date.strftime('%m/%d/%Y'),
                'btnSearch': 'Search'
            }

            # Step 3: Submit search
            response = self.session.post(
                search_url,
                data=form_data,
                timeout=30
            )

            if response.status_code == 200:
                results = self._parse_search_results(response.text)
                all_results.extend(results)
                logger.info(f"Found {len(results)} permits")
            else:
                logger.warning(f"Search returned {response.status_code}")

        except Exception as e:
            logger.error(f"OneStop search error: {e}")

        return all_results

    def _parse_search_results(self, html: str) -> List[Dict]:
        """Parse search results table"""
        soup = BeautifulSoup(html, 'html.parser')
        permits = []

        # Common Citizenserve result table patterns
        table = soup.find('table', {'id': 'gvResults'})
        if not table:
            table = soup.find('table', {'class': 'results'})
        if not table:
            table = soup.find('table', {'id': 'ctl00_ContentPlaceHolder1_gvResults'})

        if not table:
            # Try to find any table with permit-like data
            tables = soup.find_all('table')
            for t in tables:
                if t.find(string=lambda x: x and 'Permit' in str(x)):
                    table = t
                    break

        if not table:
            logger.warning("Could not find results table - verify selectors")
            return []

        rows = table.find_all('tr')

        # Skip header row
        for row in rows[1:]:
            cells = row.find_all('td')
            if len(cells) >= 4:
                permit = {
                    'permit_number': cells[0].get_text(strip=True),
                    'permit_type': cells[1].get_text(strip=True) if len(cells) > 1 else None,
                    'property_address': cells[2].get_text(strip=True) if len(cells) > 2 else None,
                    'issue_date': cells[3].get_text(strip=True) if len(cells) > 3 else None,
                    'status': cells[4].get_text(strip=True) if len(cells) > 4 else None,
                }

                # Get detail link if available
                link = cells[0].find('a')
                if link and link.get('href'):
                    permit['detail_url'] = link['href']

                permits.append(permit)

        return permits

    def get_permit_details(self, detail_url: str) -> Optional[Dict]:
        """Fetch full permit details page"""
        try:
            if not detail_url.startswith('http'):
                url = f"{self.base_url}/{detail_url.lstrip('/')}"
            else:
                url = detail_url

            response = self.session.get(url, timeout=30)

            if response.status_code == 200:
                return self._parse_detail_page(response.text)

        except Exception as e:
            logger.error(f"Detail fetch error: {e}")

        return None

    def _parse_detail_page(self, html: str) -> Dict:
        """Extract all fields from permit detail page"""
        soup = BeautifulSoup(html, 'html.parser')
        details = {}

        # Citizenserve typically uses label/value pairs
        # Pattern: <span class="label">Field:</span> <span class="value">Value</span>
        # Or: <td class="label">Field</td><td>Value</td>

        field_mappings = {
            'Permit Number': 'permit_number',
            'Permit Type': 'permit_type',
            'Status': 'permit_status',
            'Application Date': 'application_date',
            'Issue Date': 'issue_date',
            'Final Date': 'final_date',
            'Address': 'property_address',
            'Property Address': 'property_address',
            'Parcel': 'parcel_id',
            'Parcel Number': 'parcel_id',
            'Owner': 'owner_name',
            'Owner Name': 'owner_name',
            'Contractor': 'contractor_name',
            'Contractor Name': 'contractor_name',
            'Description': 'project_description',
            'Project Description': 'project_description',
            'Valuation': 'estimated_cost',
            'Job Value': 'estimated_cost',
            'Square Feet': 'square_footage',
            'Sq Ft': 'square_footage',
        }

        for label_text, field_name in field_mappings.items():
            # Try to find the label and its value
            label = soup.find(string=lambda t: t and label_text in str(t))
            if label:
                # Try next sibling or parent's next sibling
                value_elem = label.find_next(['span', 'td'])
                if value_elem:
                    details[field_name] = value_elem.get_text(strip=True)

        return details

    def needs_detail_fetch(self, permit: Dict) -> bool:
        """Fetch details if we have a detail URL"""
        return bool(permit.get('detail_url'))

    def normalize_permit(self, raw: Dict) -> Dict:
        """Normalize OneStop permit to standard schema"""
        return {
            'jurisdiction_id': self.jurisdiction_id,
            'source_system': self.source_system,
            'permit_number': raw.get('permit_number'),
            'permit_type': raw.get('permit_type'),
            'permit_subtype': None,
            'permit_status': raw.get('status') or raw.get('permit_status'),
            'application_date': self.parse_date(raw.get('application_date')),
            'issue_date': self.parse_date(raw.get('issue_date')),
            'final_date': self.parse_date(raw.get('final_date')),
            'property_address': raw.get('property_address'),
            'parcel_id': raw.get('parcel_id'),
            'owner_name': raw.get('owner_name'),
            'contractor_name': raw.get('contractor_name'),
            'project_description': raw.get('project_description'),
            'estimated_cost': self.parse_currency(raw.get('estimated_cost')),
            'square_footage': self.parse_int(raw.get('square_footage')),
            'unit_count': self.extract_unit_count(raw),
            'raw_json': raw
        }

    def export_report(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        """
        Use built-in export functionality if available

        Citizenserve often has Excel/CSV export buttons on search results
        """
        # TODO: Implement export functionality
        # 1. Perform search
        # 2. Look for export button/link
        # 3. Download and parse file
        logger.info("Report export not yet implemented")
        return []


if __name__ == "__main__":
    # Test the scraper
    scraper = BerkeleyOneStopScraper()

    print("Berkeley County WV (OneStop) Scraper")
    print("=" * 50)

    # Test search (last 30 days)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)

    print(f"Searching permits from {start_date.date()} to {end_date.date()}...")

    try:
        permits = scraper.search_permits(start_date, end_date)
        print(f"Found {len(permits)} permits")

        if permits:
            print("\nSample permit:")
            for k, v in permits[0].items():
                print(f"  {k}: {v}")
    except Exception as e:
        print(f"Test failed: {e}")
        print("\nNote: ASP.NET form field names may need adjustment")
        print("Use browser DevTools to verify actual field names")
