# Permit System Connection Test Results

## Overview

This document tracks connection tests to county permit systems, GIS portals, and data sources. Tests performed December 2, 2025.

---

## Summary Table

| County | State | Permit Portal | Status | GIS Portal | Status | Method |
|--------|-------|---------------|--------|------------|--------|--------|
| Frederick | VA | Tyler EnerGov | DNS FAIL | gis.fcva.us | UNTESTED | PDF Reports |
| Jefferson | WV | MGO Connect | WORKING | ArcGIS Open Data | WORKING | Portal Scrape |
| Berkeley | WV | OneStop | WORKING | Berkeley Online | WORKING | Portal Scrape |

---

## Frederick County, VA

### System Info
- **Portal**: Tyler EnerGov Self-Service
- **URL**: `https://energov.frederickcountyva.gov/`
- **Platform**: Tyler Technologies EnerGov

### Connection Test Results

| Test | URL | Status | Result |
|------|-----|--------|--------|
| EnerGov Portal | `energov.frederickcountyva.gov` | DNS FAIL | Cannot resolve hostname |
| Monthly PDF Reports | `fcva.us/...showpublisheddocument` | 403 | Blocked (needs browser) |
| Permit Reports Page | `fcva.us/.../permit-reports` | 403 | Blocked (needs browser) |

### Findings
- **EnerGov API**: Domain `energov.frederickcountyva.gov` fails DNS resolution
  - May be internal-only or recently changed
  - Need to verify correct hostname
- **Website**: `fcva.us` blocks programmatic requests (403 Forbidden)
  - Likely has bot protection
  - Works in browser

### Recommended Approach
1. **Browser automation** (Selenium/Playwright) for PDF downloads
2. **Monthly PDF extraction** - Parse permit data from PDF reports
3. **Manual download** + automated parsing as fallback

### Scraper Status
- File: `scrapers/frederick_energov.py`
- Status: **NEEDS UPDATE** - DNS issue with API endpoint
- Alternative: PDF extraction from monthly reports (test shows working)

---

## Jefferson County, WV

### System Info
- **Portal**: MGO Connect (MyGovernmentOnline)
- **URL**: `https://www.mgoconnect.org/cp?JID=171`
- **Platform**: MGO Connect by MyGovernmentOnline

### Connection Test Results

| Test | URL | Status | Result |
|------|-----|--------|--------|
| County Website | `jeffersoncountywv.org` | 200 | ACCESSIBLE |
| Building Permits Page | `.../building-permits-new` | 200 | ACCESSIBLE |
| MGO Connect Portal | `mgoconnect.org/cp?JID=171` | 200 | **WORKING** |
| GIS Open Data | `od-jcwvgis.opendata.arcgis.com` | 200 | **WORKING** |
| Zoning Ordinance PDF | `.../showdocument?id=12211` | 200 | PDF downloadable |

### Findings
- **MGO Connect Portal**: Fully accessible, contains permit search
- **GIS Portal**: ArcGIS Open Data hub with zoning layers
- **Documents**: Zoning ordinance PDF downloadable

### Portal Details
- Portal launched: August 2025
- Features: Permit search, application status, inspection scheduling
- Public access: Yes
- Authentication: Not required for search

### Recommended Approach
1. **MGO Connect API** - Investigate REST endpoints
2. **Web scraping** - Parse permit listings from portal
3. **GIS data** - Download parcel/zoning from Open Data hub

### Scraper Status
- File: `scrapers/jefferson_mgo.py`
- Status: **READY TO TEST** - Portal accessible
- Next: Implement search/scrape logic

---

## Berkeley County, WV

### System Info
- **Portal**: OneStop Portal
- **URL**: `https://onestop.berkeleywv.org/`
- **Platform**: Custom government portal

### Connection Test Results

| Test | URL | Status | Result |
|------|-----|--------|--------|
| County Website | `berkeleywv.org` | 200 | ACCESSIBLE |
| OneStop Portal | `onestop.berkeleywv.org` | 200 | **WORKING** |
| Berkeley Online GIS | `maps.berkeleywv.org/berkeleyonline` | 200 | **WORKING** |
| Building Permits Page | `.../Building-Permit-Process` | 200 | ACCESSIBLE |
| Subdivision Ordinance | `.../DocumentCenter/View/342` | 200 | PDF (~2MB) |
| Zoning Page | `.../295/Zoning` | 404 | Page moved |

### Findings
- **OneStop Portal**: Accessible, has search and permit functionality
- **GIS Portal**: Berkeley Online fully functional
- **Documents**: 2025 Subdivision Ordinance PDF available (1.98 MB)

### Portal Details
- Platform: Server-rendered (not SPA)
- Features: Permit search, application submission
- Scripts: 10 JavaScript files loaded
- Forms: 1 search form detected
- Public access: Yes

### Recommended Approach
1. **Form submission** - POST to search endpoint
2. **HTML parsing** - BeautifulSoup for results
3. **GIS data** - Berkeley Online for parcel info

### Scraper Status
- File: `scrapers/berkeley_onestop.py`
- Status: **READY TO TEST** - Portal accessible
- Next: Map form fields and implement search

---

## GIS Portal Status

### Working Portals

| County | Platform | URL | Zoning | Parcels | Download |
|--------|----------|-----|--------|---------|----------|
| Jefferson, WV | ArcGIS Open Data | `od-jcwvgis.opendata.arcgis.com` | Yes | Yes | Yes |
| Berkeley, WV | Berkeley Online | `maps.berkeleywv.org/berkeleyonline` | No | Yes | No |

### Untested Portals

| County | Platform | URL | Notes |
|--------|----------|-----|-------|
| Frederick, VA | ArcGIS | `gis.fcva.us` | Need to test |

---

## API Endpoint Discovery

### Tested Endpoints

**Berkeley OneStop**:
- `/api/permits` - 404 (not found)
- `/api/search` - 404 (not found)
- `/permits/search` - 404 (not found)
- *Conclusion*: No REST API, use form-based search

**Jefferson MGO Connect**:
- Portal URL: `https://www.mgoconnect.org/cp?JID=171`
- *Conclusion*: Needs further investigation for API

---

## Document Downloads

### Successfully Downloaded

| County | Document | URL | Size | Status |
|--------|----------|-----|------|--------|
| Jefferson, WV | Zoning Ordinance | `jeffersoncountywv.org/.../id=12211` | ~500KB | PDF OK |
| Berkeley, WV | 2025 Subdivision Ordinance | `berkeleywv.org/.../View/342` | 1.98 MB | PDF OK |

### Blocked Downloads

| County | Document | URL | Status | Reason |
|--------|----------|-----|--------|--------|
| Frederick, VA | Monthly Permit Reports | `fcva.us/...` | 403 | Bot protection |

---

## Next Steps

### Immediate Actions
1. **Frederick VA**: Try Selenium/Playwright for PDF downloads
2. **Jefferson WV**: Implement MGO Connect search scraper
3. **Berkeley WV**: Map OneStop form fields, implement scraper

### Future Testing
- Test remaining VA counties (Warren, Shenandoah, etc.)
- Test MD counties (Frederick MD, Washington MD)
- Map API endpoints for working portals

---

## Test Code Reference

### Basic Connection Test
```python
import requests

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
})

r = session.get('https://onestop.berkeleywv.org/', timeout=15)
print(f'Status: {r.status_code}')
```

### PDF Download Test
```python
r = session.get(pdf_url, timeout=15)
is_pdf = r.content[:4] == b'%PDF'
print(f'Is PDF: {is_pdf}, Size: {len(r.content)} bytes')
```

---

## Revision History

| Date | Changes |
|------|---------|
| 2025-12-02 | Initial connection tests for Frederick VA, Jefferson WV, Berkeley WV |
