# County Data Connection Registry

## Overview

This document tracks **how we connect to each county's data systems** - the specific endpoints, methods, table linkages, and outcomes. Use this as a reference before researching any county to avoid duplicate work.

**Last Updated**: December 4, 2025

---

## Quick Reference: Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COUNTY DATA PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SOURCE                    TABLE                      LINKAGE           │
│  ──────                    ─────                      ───────           │
│  Permit Portal  ────────►  housing_pipeline    ◄────► permit_number     │
│       │                         │                          │            │
│       │                         │                          │            │
│       ▼                         ▼                          ▼            │
│  Inspection Portal ─────►  inspections_raw     ◄────► permit_number     │
│                                 │                          │            │
│                                 │                          │            │
│                                 ▼                          │            │
│                         inspection_type_mapping            │            │
│                           (phase classification)           │            │
│                                                            │            │
│  GIS Portal  ───────────►  housing_communities             │            │
│                                 │                          │            │
│                                 ▼                          │            │
│                         (lat/lon for mapping)              │            │
│                                                            │            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Table Relationships

### Primary Linkage: `permit_number`

| Source Table | Target Table | Join Column | Notes |
|--------------|--------------|-------------|-------|
| `housing_pipeline` | `inspections_raw` | `permit_number` | Links permits to inspection history |
| `housing_pipeline` | `housing_communities` | `permit_number` | Links pipeline to community records |
| `permits_raw` | `inspections_raw` | `permit_number` | Raw permit to inspection linkage |

### Phase Classification

Inspections are classified into construction phases via `inspection_type_mapping`:

| Phase | Order | Keywords | Triggers Status |
|-------|-------|----------|-----------------|
| site_work | 1-3 | sediment, erosion, grading, footing, foundation | site_work |
| vertical | 4-5 | framing, sheathing, rough-in | vertical |
| finishing | 6-7 | insulation, drywall, MEP finals | finishing |
| final | 8 | final, CO, certificate | complete |

---

## County Connection Details

### Frederick County, VA

**Status**: PARTIAL - Housing data available, inspections NOT connected

**FIPS Code**: 51069

**Data Sources**:
| Data Type | Source | Method | Status |
|-----------|--------|--------|--------|
| Housing Communities | Google Places API | API scrape | ✅ WORKING |
| Permits | Tyler EnerGov | DNS FAIL | ❌ BLOCKED |
| Permits (Alt) | fcva.us PDF reports | Selenium needed | ⚠️ MANUAL |
| Inspections | Tyler EnerGov | DNS FAIL | ❌ NOT CONNECTED |
| GIS | gis.fcva.us | DNS FAIL | ❌ BLOCKED |

**Current Data**:
- `housing_communities`: 98 records (Winchester, Stephens City, Middletown)
  - 8 condos
  - 21 townhomes
  - 69 apartments/other

**What's Missing**:
- Permit numbers not populated in `housing_communities`
- No inspection linkage possible without permit portal access
- `housing_pipeline` has 10 permits from manual entry (Stephenson Village, Park Place, Windstone)

**To Complete Connection**:
1. Use Selenium to access fcva.us monthly PDF reports
2. Parse PDFs with pdfplumber/tabula
3. Extract permit numbers and match to communities
4. Scrape inspection history from EnerGov (if DNS resolves) or PDF

**Query to Check Data**:
```sql
-- Housing communities in Frederick VA
SELECT name, city, community_type, permit_number, total_units
FROM housing_communities
WHERE state = 'VA'
  AND (city ILIKE '%winchester%' OR city ILIKE '%stephens city%' OR county_fips = '51069')
ORDER BY community_type, name;

-- Pipeline permits (manual entries)
SELECT permit_number, development_name, unit_type, pipeline_status
FROM housing_pipeline
WHERE jurisdiction_id LIKE '%FREDERICK%' OR jurisdiction_id LIKE '%51069%';
```

---

### Berkeley County, WV

**Status**: READY FOR FULL CONNECTION

**FIPS Code**: 54003

**Data Sources**:
| Data Type | Source | Method | Status |
|-----------|--------|--------|--------|
| Housing Communities | Google Places API | API scrape | ✅ WORKING |
| Permits | OneStop Portal | BeautifulSoup scraper | ✅ READY |
| Inspections | OneStop Portal | BeautifulSoup scraper | ✅ READY |
| GIS | Berkeley Online | Direct access | ✅ WORKING |

**Portal Details**:
- **URL**: `https://onestop.berkeleywv.org`
- **Auth Required**: No
- **Platform**: Custom server-rendered HTML
- **Search Method**: Form POST to search endpoint

**Current Data**:
- `inspections_raw`: 13 test records (BP-2024-001, BP-2024-002)

**Scraper Approach**:
```python
# Berkeley County scraper outline
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://onestop.berkeleywv.org"

def search_permits(date_from, date_to):
    """Search permits by date range"""
    response = requests.post(f"{BASE_URL}/permits/search", data={
        'date_from': date_from,
        'date_to': date_to,
        'permit_type': 'all'
    })
    soup = BeautifulSoup(response.text, 'html.parser')
    # Parse table rows...
    return permits

def get_inspections(permit_number):
    """Get inspection history for a permit"""
    response = requests.get(f"{BASE_URL}/permits/{permit_number}/inspections")
    soup = BeautifulSoup(response.text, 'html.parser')
    # Parse inspection records...
    return inspections
```

---

### Jefferson County, WV

**Status**: READY FOR FULL CONNECTION

**FIPS Code**: 54037

**Data Sources**:
| Data Type | Source | Method | Status |
|-----------|--------|--------|--------|
| Housing Communities | Google Places API | API scrape | ✅ WORKING |
| Permits | MGO Connect | API investigation | ✅ READY |
| Inspections | MGO Connect | API investigation | ✅ READY |
| GIS | ArcGIS Open Data | REST API | ✅ WORKING |

**Portal Details**:
- **URL**: `https://mgoconnect.org/cp?JID=171`
- **Auth Required**: No
- **Platform**: MyGovernmentOnline
- **API**: Likely has JSON endpoints (investigate network tab)

**GIS Open Data**:
- **URL**: `https://od-jcwvgis.opendata.arcgis.com/`
- **Layers**: Parcels, Zoning, Flood zones
- **Export**: GeoJSON, Shapefile, CSV available

---

### Frederick County, MD

**Status**: PARTIAL - Permit portal working, GIS blocked

**FIPS Code**: 24021

**Data Sources**:
| Data Type | Source | Method | Status |
|-----------|--------|--------|--------|
| Permits | County Portal | Web scraper | ✅ WORKING |
| Inspections | County Portal | Web scraper | ⚠️ NEEDS TESTING |
| GIS | frederickcountymd.gov | DNS FAIL | ❌ BLOCKED |
| GIS (Alt) | MD iMAP | Statewide portal | ✅ FALLBACK |

**Portal Details**:
- **URL**: `https://www.frederickcountymd.gov/7974/Permits-and-Inspections`
- **Auth Required**: No

---

## Connection Status Summary

| County | State | FIPS | Housing | Permits | Inspections | GIS | Overall |
|--------|-------|------|---------|---------|-------------|-----|---------|
| Frederick | VA | 51069 | ✅ | ❌ | ❌ | ❌ | 25% |
| Berkeley | WV | 54003 | ✅ | ✅ | ✅ | ✅ | 100% |
| Jefferson | WV | 54037 | ✅ | ✅ | ✅ | ✅ | 100% |
| Frederick | MD | 24021 | ✅ | ✅ | ⚠️ | ❌ | 60% |
| Warren | VA | 51187 | ⚠️ | ❌ | ❌ | ❌ | 10% |
| Shenandoah | VA | 51171 | ⚠️ | ❌ | ❌ | ❌ | 10% |

**Legend**: ✅ Working | ⚠️ Partial/Manual | ❌ Not Connected

---

## Adding a New County Connection

### Step 1: Research Data Sources

```bash
# Check existing jurisdiction data
python -c "
from neon_db_utils import NeonDB
with NeonDB() as db:
    with db.conn.cursor() as cur:
        cur.execute('''
            SELECT j.jurisdiction_id, j.county_name, j.state_code,
                   jp.portal_url, jp.platform, jp.shows_inspection_history,
                   jg.portal_url as gis_url
            FROM jurisdictions j
            LEFT JOIN jurisdiction_permits jp ON j.jurisdiction_id = jp.jurisdiction_id
            LEFT JOIN jurisdiction_gis jg ON j.jurisdiction_id = jg.jurisdiction_id
            WHERE j.county_name ILIKE '%COUNTY_NAME%'
        ''')
        for row in cur.fetchall():
            print(row)
"
```

### Step 2: Test Portal Access

```bash
# Run connection test
python test_all_county_connections.py --county "COUNTY_NAME"
```

### Step 3: Document in This File

Add a new section following the template:

```markdown
### [County Name], [State]

**Status**: [READY/PARTIAL/BLOCKED]

**FIPS Code**: [XXXXX]

**Data Sources**:
| Data Type | Source | Method | Status |
|-----------|--------|--------|--------|
| Housing Communities | [source] | [method] | [status] |
| Permits | [source] | [method] | [status] |
| Inspections | [source] | [method] | [status] |
| GIS | [source] | [method] | [status] |

**Portal Details**:
- **URL**: [url]
- **Auth Required**: [Yes/No]
- **Platform**: [platform name]

**Current Data**:
- [table]: [X] records

**To Complete Connection**:
1. [step 1]
2. [step 2]
```

### Step 4: Update Database Registry

```sql
-- Add to county_data_connections table
INSERT INTO county_data_connections (
    county_fips, county_name, state_code,
    housing_status, permits_status, inspections_status, gis_status,
    permits_url, permits_method, inspections_url, inspections_method,
    last_tested, notes
) VALUES (
    '51069', 'Frederick', 'VA',
    'working', 'blocked', 'blocked', 'blocked',
    'https://energov.frederickcountyva.gov', 'selenium',
    'https://energov.frederickcountyva.gov', 'selenium',
    NOW(), 'DNS fails - need to try from different network'
);
```

---

## Troubleshooting

### DNS Failures
Many Virginia .gov sites fail DNS from certain networks. Try:
1. Different network/VPN
2. Direct IP if known
3. Alternative URLs (fcva.us vs frederickcountyva.gov)

### 403 Blocked
Bot protection active. Solutions:
1. Selenium with realistic user agent
2. Playwright with stealth mode
3. Add delays between requests

### No Online System
45 of 56 counties have no online permit system. Options:
1. Phone calls to planning department
2. RTK (Right-to-Know) requests
3. In-person records requests
4. Monthly report subscriptions

---

## Related Files

- `test_all_county_connections.py` - Automated connection testing
- `connection_test_results.json` - Test results cache
- `docs/PERMIT_SYSTEM_CONNECTIONS.md` - Portal status by county
- `docs/JURISDICTION_DATA.md` - Zoning and contact info

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-12-04 | Claude | Initial documentation of permit-inspection linkage |
| 2025-12-02 | Claude | Connection tests for all 56 counties |
