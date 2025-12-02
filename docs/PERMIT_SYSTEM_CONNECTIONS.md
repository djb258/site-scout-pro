# Permit System Connection Test Results

## Overview

Comprehensive connection tests for all **56 counties** across 4 states. Tests performed December 2, 2025.

---

## Executive Summary

| Category | Count | Notes |
|----------|-------|-------|
| **Total Counties** | 56 | PA: 23, WV: 15, VA: 13, MD: 5 |
| **Permit Portals Working** | 8 | Ready for scraper development |
| **Permit Portals Blocked (403)** | 3 | Need browser automation |
| **Permit Portals DNS Fail** | 1 | Frederick VA - hostname issue |
| **No Online Permit System** | 44 | Manual research required |
| **GIS Portals Working** | 34 | 61% accessible |
| **GIS Portals Failed** | 22 | DNS/403/404 errors |

---

## Recommended Actions by Method

### SCRAPER (8 counties) - Ready for Development

| County | State | Permit Portal | GIS Portal | Priority |
|--------|-------|---------------|------------|----------|
| **Berkeley** | WV | OneStop Portal | Berkeley Online | HIGH |
| **Jefferson** | WV | MGO Connect | ArcGIS Open Data | HIGH |
| **Franklin** | PA | PMCA Portal | ArcGIS | MEDIUM |
| **Adams** | PA | PMCA Portal | ArcGIS Hub | MEDIUM |
| **Fayette** | PA | County UCC | Custom | MEDIUM |
| **Indiana** | PA | ICOPD Portal | Custom | MEDIUM |
| **Rockingham** | VA | Custom | ArcGIS | MEDIUM |
| **Frederick** | MD | County Portal | ArcGIS | HIGH |

### BROWSER AUTOMATION (3 counties) - Blocked by Bot Protection

| County | State | Issue | Solution |
|--------|-------|-------|----------|
| **Clinton** | PA | 403 Forbidden | Selenium/Playwright |
| **Augusta** | VA | 403 Forbidden | Selenium/Playwright |
| **Allegany** | MD | 403 Forbidden | Selenium/Playwright |

### MANUAL (45 counties) - No Online Permit System

Most PA counties (19), most WV counties (13), several VA/MD counties have no online permit search. These require:
- Phone calls to planning/building departments
- In-person records requests
- RTK (Right-to-Know) requests for permit data

---

## State-by-State Results

### Pennsylvania (23 Counties)

#### Permit Portal Status

| County | Portal | Status | Method | GIS Status |
|--------|--------|--------|--------|------------|
| Somerset | None | N/A | MANUAL | WORKING |
| **Franklin** | PMCA | **WORKING** | SCRAPER | WORKING |
| Westmoreland | None | N/A | MANUAL | WORKING |
| **Fayette** | County UCC | **WORKING** | SCRAPER | WORKING* |
| Washington | Custom | FAILED | MANUAL | WORKING |
| Centre | None | N/A | MANUAL | WORKING |
| Cumberland | None | N/A | MANUAL | WORKING |
| **Adams** | PMCA | **WORKING** | SCRAPER | WORKING |
| York | None | N/A | MANUAL | WORKING |
| Dauphin | None | N/A | MANUAL | FAILED |
| **Indiana** | ICOPD | **WORKING** | SCRAPER | WORKING* |
| Fulton | None | N/A | MANUAL | WORKING |
| Huntingdon | None | N/A | MANUAL | WORKING |
| Greene | None | N/A | MANUAL | WORKING |
| Mifflin | None | N/A | MANUAL | WORKING |
| Perry | None | N/A | MANUAL | WORKING* |
| Clearfield | None | N/A | MANUAL | WORKING |
| Juniata | None | N/A | MANUAL | BLOCKED |
| **Clinton** | County | **BLOCKED** | BROWSER | WORKING |
| Bedford | None | N/A | MANUAL | WORKING |
| Blair | None | N/A | MANUAL | WORKING |
| Cambria | None | N/A | MANUAL | WORKING |
| Allegheny | None | N/A | MANUAL | WORKING |

*Working but returns 200 with non-map content

#### PA Key Findings
- **4 counties have working permit portals**: Franklin, Adams (both PMCA), Fayette, Indiana (ICOPD)
- **1 county blocked**: Clinton (403)
- **18 counties have no online permit system** - typical for PA's fragmented municipal structure
- **18 of 23 GIS portals working** (78%)
- **PMCA (PA Municipal Code Alliance)** serves Franklin and Adams - single portal for multiple counties

---

### West Virginia (15 Counties)

#### Permit Portal Status

| County | Portal | Status | Method | GIS Status | Zoning |
|--------|--------|--------|--------|------------|--------|
| **Berkeley** | OneStop | **WORKING** | SCRAPER | WORKING | Partial |
| **Jefferson** | MGO Connect | **WORKING** | SCRAPER | WORKING | County |
| Morgan | None | N/A | MANUAL | WORKING | County |
| Monongalia | None | N/A | MANUAL | WORKING* | Limited |
| Hampshire | None | N/A | MANUAL | WORKING | **NONE** |
| Mineral | None | N/A | MANUAL | WORKING | Limited |
| Hardy | None | N/A | MANUAL | WORKING | Limited |
| Randolph | None | N/A | MANUAL | WORKING | Limited |
| Preston | None | N/A | MANUAL | WORKING | **NONE** |
| Marion | None | N/A | MANUAL | WORKING | Limited |
| Harrison | None | N/A | MANUAL | WORKING | Limited |
| Grant | None | N/A | MANUAL | WORKING | **NONE** |
| Pendleton | None | N/A | MANUAL | WORKING | **NONE** |
| Tucker | None | N/A | MANUAL | WORKING | Limited |
| Pocahontas | None | N/A | MANUAL | WORKING | **NONE** |

#### WV Key Findings
- **2 counties have working permit portals**: Berkeley (OneStop), Jefferson (MGO Connect)
- **13 counties have no online permit system**
- **All 15 GIS portals working** via WV Property Viewer (mapwv.gov) or county-specific
- **5 counties have NO ZONING**: Hampshire, Preston, Grant, Pendleton, Pocahontas
  - These are the most business-friendly for storage development
  - Only State Fire Marshal approval needed for commercial buildings

---

### Virginia (13 Counties)

#### Permit Portal Status

| County | Portal | Status | Method | GIS Status |
|--------|--------|--------|--------|------------|
| Frederick | Tyler EnerGov | **DNS FAIL** | BROWSER | DNS FAIL |
| Warren | Custom | FAILED | MANUAL | 404 |
| Shenandoah | Custom | FAILED | MANUAL | 404 |
| **Rockingham** | Custom | **WORKING** | SCRAPER | DNS FAIL |
| **Augusta** | Custom | **BLOCKED** | BROWSER | WORKING |
| Clarke | None | N/A | MANUAL | 403 |
| Page | None | N/A | MANUAL | WORKING |
| Alleghany | None | N/A | MANUAL | DNS FAIL |
| Rockbridge | None | N/A | MANUAL | DNS FAIL |
| Botetourt | Custom | FAILED | MANUAL | DNS FAIL |
| Highland | None | N/A | MANUAL | 403 |
| Bath | None | N/A | MANUAL | DNS FAIL |
| Amherst | None | N/A | MANUAL | 404 |

#### VA Key Findings
- **1 county has working permit portal**: Rockingham
- **1 county blocked**: Augusta (403)
- **1 county DNS fail**: Frederick - `energov.frederickcountyva.gov` doesn't resolve
- **10 counties have no working online system**
- **Only 2 GIS portals working**: Augusta, Page (15%)
- **Many Virginia .gov sites have DNS issues** - may be network/firewall related

#### Frederick VA Special Case
- Tyler EnerGov system exists but hostname fails DNS
- Monthly PDF permit reports available at fcva.us (blocked by bot protection)
- **Recommendation**: Use Selenium to download PDF reports, then parse

---

### Maryland (5 Counties)

#### Permit Portal Status

| County | Portal | Status | Method | GIS Status |
|--------|--------|--------|--------|------------|
| Washington | Custom | FAILED | MANUAL | DNS FAIL |
| **Frederick** | Custom | **WORKING** | SCRAPER | DNS FAIL |
| **Allegany** | Custom | **BLOCKED** | BROWSER | 403 |
| Garrett | Custom | FAILED | MANUAL | 404 |
| Carroll | Custom | FAILED | MANUAL | 502 |

#### MD Key Findings
- **1 county has working permit portal**: Frederick MD
- **1 county blocked**: Allegany (403)
- **3 counties failed**: Washington, Garrett, Carroll
- **0 GIS portals accessible** - all DNS fail or errors
- **Maryland sites may have regional network issues** from test location

---

## GIS Portal Summary

### Working GIS Portals (34)

| State | Platform | Counties |
|-------|----------|----------|
| **PA** | ArcGIS/Hub | Somerset, Franklin, Westmoreland, Washington, Centre, Cumberland, Adams, York, Fulton, Huntingdon, Greene, Mifflin, Clearfield, Clinton, Bedford, Blair, Cambria, Allegheny (18) |
| **WV** | MapWV/Custom | All 15 counties via mapwv.gov/parcel or county-specific |
| **VA** | ArcGIS | Augusta, Page (2) |
| **MD** | None working | (0) |

### GIS Platforms Used

| Platform | Count | Notes |
|----------|-------|-------|
| ArcGIS Hub | 8 | Best for data downloads |
| ArcGIS Portal | 6 | Good parcel search |
| Vision Government Solutions | 3 | Greene, Clinton, etc. |
| MapWV (State) | 12 | All WV counties fallback |
| MapBlock | 1 | Bedford |
| Custom | 4 | Various |

---

## Detailed County Profiles

### Berkeley County, WV - READY FOR SCRAPER

**Permit System**
- Portal: OneStop (`onestop.berkeleywv.org`)
- Status: **WORKING**
- Platform: Custom server-rendered
- Features: Permit search, application submission
- Authentication: Not required

**GIS**
- Portal: Berkeley Online (`maps.berkeleywv.org/berkeleyonline`)
- Status: **WORKING**
- Features: Parcel search by ID, owner search

**Documents**
- 2025 Subdivision Ordinance: **DOWNLOADABLE** (1.98 MB PDF)

**Scraper Approach**
1. Form submission to search endpoint
2. BeautifulSoup HTML parsing
3. Extract permit records from table

---

### Jefferson County, WV - READY FOR SCRAPER

**Permit System**
- Portal: MGO Connect (`mgoconnect.org/cp?JID=171`)
- Status: **WORKING**
- Platform: MyGovernmentOnline
- Features: Permit search, status tracking
- Authentication: Not required

**GIS**
- Portal: ArcGIS Open Data (`od-jcwvgis.opendata.arcgis.com`)
- Status: **WORKING**
- Features: Zoning layers, parcel data, downloadable

**Documents**
- Zoning Ordinance: **DOWNLOADABLE** (~500KB PDF)

**Scraper Approach**
1. Investigate MGO Connect API endpoints
2. Parse permit listings
3. Download GIS data from Open Data hub

---

### Frederick County, VA - NEEDS BROWSER AUTOMATION

**Permit System**
- Portal: Tyler EnerGov
- Status: **DNS FAIL** - `energov.frederickcountyva.gov` doesn't resolve
- Alternative: Monthly PDF reports at fcva.us

**GIS**
- Portal: `gis.fcva.us`
- Status: **DNS FAIL**

**Documents**
- Monthly permit reports: Available but **403 BLOCKED**

**Approach**
1. Use Selenium/Playwright to access fcva.us
2. Download monthly PDF permit reports
3. Parse PDFs for permit data (pdfplumber/tabula)

---

### Frederick County, MD - READY FOR SCRAPER

**Permit System**
- Portal: County Permits (`frederickcountymd.gov/7974/Permits-and-Inspections`)
- Status: **WORKING**
- Platform: Custom

**GIS**
- Portal: `gis.frederickcountymd.gov`
- Status: **DNS FAIL** from test location

**Approach**
1. Scrape permit search page
2. Alternative GIS via MD iMAP statewide

---

## Implementation Priority

### Phase 1 - High Value Targets (Ready Now)
1. **Berkeley WV** - OneStop portal accessible, form-based scraper
2. **Jefferson WV** - MGO Connect accessible, API investigation
3. **Frederick MD** - County portal accessible

### Phase 2 - PA Third-Party Portals
4. **Franklin PA** - PMCA portal (serves multiple counties)
5. **Adams PA** - PMCA portal
6. **Indiana PA** - ICOPD portal

### Phase 3 - Browser Automation
7. **Frederick VA** - Selenium for PDF reports
8. **Clinton PA** - Selenium for blocked portal
9. **Augusta VA** - Selenium for blocked portal
10. **Allegany MD** - Selenium for blocked portal

### Phase 4 - Manual Research
- Remaining 45 counties without online systems
- Phone/email outreach to planning departments
- RTK requests for permit data

---

## Test Script

The comprehensive test script is available at:
```
test_all_county_connections.py
```

Results saved to:
```
connection_test_results.json
```

### Running Tests
```bash
python test_all_county_connections.py
```

---

## Revision History

| Date | Changes |
|------|---------|
| 2025-12-02 | Comprehensive test of all 56 counties |
| 2025-12-02 | Initial connection tests for Frederick VA, Jefferson WV, Berkeley WV |
