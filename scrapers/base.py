"""
Base scraper class with common functionality
"""

import requests
import time
import re
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from abc import ABC, abstractmethod

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('hive_scraper')


class BaseScraper(ABC):
    """Base class for all permit scrapers"""

    def __init__(self, jurisdiction_id: str, source_system: str):
        self.jurisdiction_id = jurisdiction_id
        self.source_system = source_system
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'HiveBot/1.0 (housing-pipeline-research)',
            'Accept': 'application/json'
        })
        self.rate_limit_delay = 1.5  # seconds between requests

    @abstractmethod
    def search_permits(self, start_date: datetime, end_date: datetime, **kwargs) -> List[Dict]:
        """Search for permits in date range"""
        pass

    @abstractmethod
    def get_permit_details(self, permit_id: str) -> Optional[Dict]:
        """Get full details for a single permit"""
        pass

    @abstractmethod
    def normalize_permit(self, raw: Dict) -> Dict:
        """Normalize raw permit data to standard schema"""
        pass

    def extract_housing_permits(self, days_back: int = 30) -> List[Dict]:
        """Main extraction method for housing pipeline"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)

        logger.info(f"Extracting permits from {start_date.date()} to {end_date.date()}")

        permits = self.search_permits(start_date, end_date)

        # Enrich with details if needed
        enriched = []
        for p in permits:
            if self.needs_detail_fetch(p):
                details = self.get_permit_details(p.get('permit_id') or p.get('case_id'))
                if details:
                    p.update(details)
                time.sleep(self.rate_limit_delay)

            normalized = self.normalize_permit(p)
            enriched.append(normalized)

        logger.info(f"Extracted {len(enriched)} permits")
        return enriched

    def needs_detail_fetch(self, permit: Dict) -> bool:
        """Override to determine if detail fetch is needed"""
        return False

    def determine_pipeline_status(self, permit: Dict) -> str:
        """
        Determine pipeline status based on inspections
        GREEN = Permitted (no inspections or only admin)
        YELLOW = Site work begun (foundation/footing passed)
        RED = Vertical construction (framing/rough-in)
        """
        inspections = permit.get('inspections', [])

        if not inspections:
            return 'GREEN'

        passed_types = [
            i.get('inspection_type', '').lower()
            for i in inspections
            if str(i.get('result', '')).upper() in ['PASS', 'PASSED', 'APPROVED']
        ]

        passed_str = ' '.join(passed_types)

        # Red indicators (vertical construction)
        red_keywords = ['framing', 'rough', 'electrical rough', 'plumbing rough',
                       'hvac rough', 'sheathing', 'roof', 'drywall']
        if any(kw in passed_str for kw in red_keywords):
            return 'RED'

        # Yellow indicators (site work)
        yellow_keywords = ['foundation', 'footing', 'slab', 'footer',
                          'excavation', 'grade', 'erosion', 'footer']
        if any(kw in passed_str for kw in yellow_keywords):
            return 'YELLOW'

        return 'GREEN'

    def extract_unit_count(self, raw: Dict) -> int:
        """Parse unit count from description or custom fields"""
        desc = str(raw.get('description', '') or raw.get('project_description', '')).lower()

        # Pattern matching: "12 unit", "12-unit", "12 units"
        match = re.search(r'(\d+)\s*-?\s*units?', desc)
        if match:
            return int(match.group(1))

        # Check for explicit unit count field
        if raw.get('unit_count'):
            return int(raw['unit_count'])

        return 1

    def parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse date string to datetime"""
        if not date_str:
            return None

        formats = ['%m/%d/%Y', '%Y-%m-%d', '%m-%d-%Y', '%Y/%m/%d',
                   '%m/%d/%Y %H:%M:%S', '%Y-%m-%dT%H:%M:%S']

        for fmt in formats:
            try:
                return datetime.strptime(str(date_str).split('.')[0], fmt)
            except (ValueError, AttributeError):
                continue

        return None

    def parse_currency(self, val: Any) -> Optional[float]:
        """Parse currency value"""
        if not val:
            return None

        clean = re.sub(r'[^\d.]', '', str(val))
        try:
            return float(clean)
        except (ValueError, TypeError):
            return None

    def parse_int(self, val: Any) -> Optional[int]:
        """Parse integer value"""
        if not val:
            return None

        clean = re.sub(r'[^\d]', '', str(val))
        try:
            return int(clean)
        except (ValueError, TypeError):
            return None
