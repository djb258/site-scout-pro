"""
Frederick County, VA - Tyler EnerGov Scraper
GOLD TIER: Best transparency, monthly reports, full API access
"""

import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from .base import BaseScraper

logger = logging.getLogger('hive_scraper')


class FrederickEnerGovScraper(BaseScraper):
    """
    Scraper for Frederick County, VA Tyler-EnerGov system

    Portal: https://energov.frederickcountyva.gov/energov_prod/selfservice#/home
    Monthly Reports: https://www.fcva.us/departments/building-inspections

    Features:
    - REST API backend
    - No authentication required
    - Full permit search with filters
    - Inspection history available
    - Monthly PDF/Excel reports (backup source)
    """

    def __init__(self):
        super().__init__(
            jurisdiction_id='VA-FREDERICK',
            source_system='TYLER_ENERGOV'
        )
        self.base_url = "https://energov.frederickcountyva.gov/energov_prod/selfservice/api"
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Origin': 'https://energov.frederickcountyva.gov',
            'Referer': 'https://energov.frederickcountyva.gov/energov_prod/selfservice/'
        })

        # Residential permit types to search
        self.residential_types = [
            'New Single Family',
            'New Townhouse',
            'New Multi-Family',
            'New Apartment',
            'New Duplex',
            'Residential New Construction'
        ]

    def search_permits(self, start_date: datetime, end_date: datetime,
                       permit_type: str = None) -> List[Dict]:
        """
        Search permits via EnerGov API

        API Endpoint: POST /energov/search/search
        """
        all_results = []

        # Search each residential type
        search_types = [permit_type] if permit_type else self.residential_types

        for ptype in search_types:
            logger.info(f"Searching permits: {ptype}")

            payload = {
                "Module": "Permit",
                "Type": ptype,
                "DateFrom": start_date.strftime("%m/%d/%Y"),
                "DateTo": end_date.strftime("%m/%d/%Y"),
                "PageNumber": 1,
                "PageSize": 100,
                "SortColumn": "DateEntered",
                "SortDirection": "DESC"
            }

            has_more = True
            while has_more:
                try:
                    response = self.session.post(
                        f"{self.base_url}/energov/search/search",
                        json=payload,
                        timeout=30
                    )

                    if response.status_code == 200:
                        data = response.json()
                        results = data.get('Result', [])
                        all_results.extend(results)

                        # Check pagination
                        total = data.get('TotalCount', 0)
                        has_more = len(all_results) < total and len(results) > 0
                        payload['PageNumber'] += 1

                        logger.debug(f"Page {payload['PageNumber']-1}: {len(results)} results, total so far: {len(all_results)}")
                    else:
                        logger.warning(f"Search failed for {ptype}: {response.status_code}")
                        has_more = False

                except Exception as e:
                    logger.error(f"Search error for {ptype}: {e}")
                    has_more = False

                time.sleep(self.rate_limit_delay)

        logger.info(f"Total permits found: {len(all_results)}")
        return all_results

    def get_permit_details(self, case_id: str) -> Optional[Dict]:
        """
        Get full permit details including inspections

        API Endpoints:
        - GET /energov/case/{caseId}
        - GET /energov/case/{caseId}/inspections
        """
        try:
            # Get permit details
            response = self.session.get(
                f"{self.base_url}/energov/case/{case_id}",
                timeout=30
            )

            if response.status_code != 200:
                logger.warning(f"Failed to get permit {case_id}: {response.status_code}")
                return None

            permit = response.json()
            time.sleep(0.5)

            # Get inspections
            insp_response = self.session.get(
                f"{self.base_url}/energov/case/{case_id}/inspections",
                timeout=30
            )

            if insp_response.status_code == 200:
                inspections = insp_response.json()
                permit['inspections'] = inspections if isinstance(inspections, list) else []
            else:
                permit['inspections'] = []

            return permit

        except Exception as e:
            logger.error(f"Error getting permit {case_id}: {e}")
            return None

    def needs_detail_fetch(self, permit: Dict) -> bool:
        """Always fetch details for inspection history"""
        return True

    def normalize_permit(self, raw: Dict) -> Dict:
        """Normalize EnerGov permit to standard schema"""

        # Get last inspection info
        inspections = raw.get('inspections', [])
        last_inspection = None
        if inspections:
            sorted_insp = sorted(
                inspections,
                key=lambda x: x.get('InspectionDate', '') or '',
                reverse=True
            )
            last_inspection = sorted_insp[0] if sorted_insp else None

        return {
            'jurisdiction_id': self.jurisdiction_id,
            'source_system': self.source_system,
            'permit_number': raw.get('CaseNumber'),
            'permit_type': raw.get('CaseType'),
            'permit_subtype': raw.get('CaseSubType'),
            'permit_status': raw.get('CaseStatus'),
            'application_date': self.parse_date(raw.get('DateEntered')),
            'issue_date': self.parse_date(raw.get('DateIssued')),
            'final_date': self.parse_date(raw.get('DateFinaled')),
            'expiration_date': self.parse_date(raw.get('ExpirationDate')),
            'property_address': raw.get('Address'),
            'parcel_id': raw.get('ParcelNumber'),
            'owner_name': raw.get('OwnerName'),
            'contractor_name': raw.get('ContractorName'),
            'project_description': raw.get('Description'),
            'estimated_cost': self.parse_currency(raw.get('JobValue')),
            'square_footage': self.parse_int(raw.get('SquareFootage')),
            'unit_count': self.extract_unit_count(raw),
            'stories': self.parse_int(raw.get('Stories')),
            'inspection_count': len(inspections),
            'last_inspection_date': self.parse_date(
                last_inspection.get('InspectionDate') if last_inspection else None
            ),
            'last_inspection_type': last_inspection.get('InspectionType') if last_inspection else None,
            'last_inspection_result': last_inspection.get('Result') if last_inspection else None,
            'inspections': inspections,  # Keep for pipeline status
            'raw_json': raw
        }

    def scrape_monthly_report(self, month: int = None, year: int = None) -> List[Dict]:
        """
        Fallback: Scrape monthly permit reports from county website

        URL: https://www.fcva.us/departments/building-inspections/permitreports

        Note: This is a backup method if API is unavailable.
        Monthly reports are typically PDF or Excel format.
        """
        # TODO: Implement monthly report scraping
        # 1. Navigate to permit reports page
        # 2. Find current month's report link
        # 3. Download and parse PDF/Excel
        logger.info("Monthly report scraping not yet implemented")
        return []


if __name__ == "__main__":
    # Test the scraper
    scraper = FrederickEnerGovScraper()

    # Test search (last 7 days)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)

    print(f"Searching permits from {start_date.date()} to {end_date.date()}...")
    permits = scraper.search_permits(start_date, end_date)
    print(f"Found {len(permits)} permits")

    # Show sample
    if permits:
        print("\nSample permit:")
        sample = permits[0]
        for k, v in sample.items():
            if k != 'raw_json':
                print(f"  {k}: {v}")
