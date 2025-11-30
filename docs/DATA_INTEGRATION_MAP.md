# Data Source Integration Map

> **Project:** ZIP Code Screener for Self-Storage Site Selection
> **Last Updated:** 2025-11-29

---

## External APIs (Need Connections)

| Data | Source | Used In | Endpoint/Notes |
|------|--------|---------|----------------|
| ZIP Population | Census Bureau | Stage 1 | ACS 5-yr, Table B01003 |
| 5-mi Radius Population | Census Bureau | Stage 1 | ACS 5-yr, Block Groups + spatial buffer |
| Median Household Income | Census Bureau | Stage 1 | ACS 5-yr, Table B19013 |
| Poverty Rate | Census Bureau | Stage 1 | ACS 5-yr, Table S1701 or B17001 |
| 5-Year Population Growth | Census Bureau | Stage 1 | Compare ACS vintages (2018 vs 2023) |
| Renter Percentage | Census Bureau | Stage 1 | ACS 5-yr, Table B25003 |
| Population Density | Census Bureau | Stage 0 | Derived: pop / land area |
| MSA/CBSA Designations | Census Bureau | Stage 0 | Delineation files |
| Competitor Facility Count | Google Places API | Stage 2 | "self storage" near ZIP centroid |
| Competitor Facility Sq Ft | Radius+ or Yardi Matrix | Stage 4 | Paid API (or manual) |
| Local Rents | SpareFoot | Stage 5 | Scrape or API |
| AADT Traffic Counts | State DOT | Stage 6 | WV/PA/VA DOT GIS portals |
| Flood Zones | FEMA | Stage 7 | NFHL REST API |
| Crime Rates | FBI UCR | Stage 7 | Uniform Crime Reporting API |
| Drive Time to Metro | OSRM or Google Distance Matrix | Stage 0 | Routing API |
| Highway Expansion Projects | State DOT STIP | Stage 8 | Manual or GIS |
| Manufacturing Announcements | SelectUSA, State EDA | Stage 8 | RSS/scrape |
| Lake/Marina Proximity | Google Maps or USGS | Stage 8 | Places API or NHD dataset |
| Military Bases | DoD | Stage 8 | Public installations list |
| University Enrollment | NCES IPEDS | Stage 8 | Public dataset |

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL DATA SOURCES                        │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────┤
│ Census   │ Google   │ FEMA     │ FBI UCR  │ State    │ Paid    │
│ Bureau   │ Places   │ NFHL     │          │ DOTs     │ APIs    │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬────┘
     │          │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COMPOSIO MCP SERVER                           │
│  - Unified API connections                                       │
│  - Auth management                                               │
│  - Rate limiting                                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         n8n WORKFLOWS                            │
│  - Batch processing                                              │
│  - Data transformation                                           │
│  - Error handling                                                │
│  - Caching layer                                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        NEON (Postgres)                           │
│  - zips_master (already populated)                               │
│  - zip_results (per-run metrics)                                 │
│  - api_cache (cached responses)                                  │
│  - zoning_cache, pricing_data, traffic_data                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CLAUDE CODE                                │
│  - Stage execution                                               │
│  - Kill switch logic                                             │
│  - Scoring algorithms                                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        REPLIT (UI)                               │
│  - Dashboard                                                     │
│  - Trigger runs                                                  │
│  - View results                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Composio MCP Server — Connections Needed

| Connection ID | Service | Auth Type | Purpose |
|---------------|---------|-----------|---------|
| `census` | Census Bureau API | API Key | Demographics (Stage 0-1) |
| `google_places` | Google Places API | API Key | Facility counts (Stage 2) |
| `google_distance` | Google Distance Matrix | API Key | Drive time (Stage 0) |
| `fema` | FEMA NFHL | None (public) | Flood zones (Stage 7) |
| `fbi_ucr` | FBI Crime Data | None (public) | Crime rates (Stage 7) |
| `sparefoot` | SpareFoot | Scrape/API | Rents, facility data (Stage 4-5) |
| `radius_plus` | Radius+ | API Key (paid) | True sq ft (Stage 4) |
| `osrm` | OSRM (self-hosted or public) | None | Drive time alt (Stage 0) |

---

## n8n Workflows Needed

| Workflow ID | Trigger | Action | Output |
|-------------|---------|--------|--------|
| `wf_census_demographics` | Webhook (ZIP list) | Batch pull Census data | Write to `api_cache` |
| `wf_google_places_facilities` | Webhook (ZIP list) | Search facilities per ZIP | Write to `api_cache` |
| `wf_fema_flood` | Webhook (ZIP list) | Lookup flood zones | Write to `api_cache` |
| `wf_fbi_crime` | Webhook (county list) | Lookup crime rates | Write to `api_cache` |
| `wf_dot_traffic` | Scheduled (weekly) | Pull state DOT traffic data | Write to `traffic_data` |
| `wf_sparefoot_rents` | Webhook (ZIP list) | Scrape/pull rents | Write to `pricing_data` |
| `wf_selectusa_mfg` | Scheduled (daily) | Scrape manufacturing announcements | Write to scoring reference table |

---

## Claude Code Data Connection Prompt

```
You have access to external data through Composio MCP Server and self-hosted n8n workflows.

## COMPOSIO MCP CONNECTIONS

| Connection | Endpoint | Auth |
|------------|----------|------|
| census | https://api.census.gov/data/2022/acs/acs5 | API Key: ${CENSUS_API_KEY} |
| google_places | https://maps.googleapis.com/maps/api/place/nearbysearch | API Key: ${GOOGLE_API_KEY} |
| google_distance | https://maps.googleapis.com/maps/api/distancematrix | API Key: ${GOOGLE_API_KEY} |
| fema | https://hazards.fema.gov/gis/nfhl/rest/services | None |
| fbi_ucr | https://api.usa.gov/crime/fbi/cde | None |
| osrm | https://router.project-osrm.org/route/v1 | None |

## n8n WEBHOOK ENDPOINTS

| Workflow | Endpoint | Payload |
|----------|----------|---------|
| Census Demographics | POST ${N8N_BASE_URL}/webhook/census-demographics | { "zips": ["26101", "26102", ...] } |
| Google Places Facilities | POST ${N8N_BASE_URL}/webhook/google-places | { "zips": ["26101", ...], "radius": 8046 } |
| FEMA Flood Lookup | POST ${N8N_BASE_URL}/webhook/fema-flood | { "zips": ["26101", ...] } |
| FBI Crime Lookup | POST ${N8N_BASE_URL}/webhook/fbi-crime | { "county_fips": ["54001", ...] } |

## DATA FLOW

When running a stage that needs external data:

1. Check `api_cache` first for existing data
2. If cache miss or expired, call Composio MCP or trigger n8n workflow
3. n8n writes results to `api_cache` or direct to target table
4. Claude Code reads from Neon and continues processing

## CACHE KEYS

Format: `{source}:{table}:{identifier}`

Examples:
- `census:B01003:26101` — Population for ZIP 26101
- `census:B19013:26101` — Median income for ZIP 26101
- `google_places:self_storage:26101` — Facility count for ZIP 26101
- `fema:flood_zone:26101` — Flood zone for ZIP 26101

## ENVIRONMENT VARIABLES NEEDED

- CENSUS_API_KEY
- GOOGLE_API_KEY
- N8N_BASE_URL
- NEON_CONNECTION_STRING
```

---

## Cache Key Formats

| Source | Key Format | Example |
|--------|------------|---------|
| Census Population | `census:B01003:{zip}` | `census:B01003:26101` |
| Census Income | `census:B19013:{zip}` | `census:B19013:26101` |
| Census Poverty | `census:S1701:{zip}` | `census:S1701:26101` |
| Census Renters | `census:B25003:{zip}` | `census:B25003:26101` |
| Google Places | `google_places:self_storage:{zip}` | `google_places:self_storage:26101` |
| FEMA Flood | `fema:flood_zone:{zip}` | `fema:flood_zone:26101` |
| FBI Crime | `fbi:crime:{county_fips}` | `fbi:crime:54001` |
| OSRM Distance | `osrm:distance:{zip}:{dest}` | `osrm:distance:26101:DC` |

---

## Next Steps

| Step | Task | Owner |
|------|------|-------|
| 1 | Set up Composio MCP Server | User |
| 2 | Configure API keys in Composio | User |
| 3 | Build n8n workflows (start with `wf_census_demographics`) | n8n |
| 4 | Give Claude Code the connection prompt above | User |
| 5 | Run Stage 0-1 with live Census data | Claude Code |

---

## Census API Quick Reference

### Tables Used

| Table | Data | Endpoint |
|-------|------|----------|
| B01003 | Total Population | `/data/2022/acs/acs5?get=B01003_001E&for=zip%20code%20tabulation%20area:*` |
| B19013 | Median Household Income | `/data/2022/acs/acs5?get=B19013_001E&for=zip%20code%20tabulation%20area:*` |
| B17001 | Poverty Status | `/data/2022/acs/acs5?get=B17001_001E,B17001_002E&for=zip%20code%20tabulation%20area:*` |
| B25003 | Housing Tenure (Renters) | `/data/2022/acs/acs5?get=B25003_001E,B25003_003E&for=zip%20code%20tabulation%20area:*` |
| S1701 | Poverty Rate | `/data/2022/acs/acs5/subject?get=S1701_C03_001E&for=zip%20code%20tabulation%20area:*` |

### Example Request

```bash
curl "https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B19013_001E&for=zip%20code%20tabulation%20area:26101&key=${CENSUS_API_KEY}"
```

### Response Format

```json
[
  ["B01003_001E", "B19013_001E", "zip code tabulation area"],
  ["12345", "55000", "26101"]
]
```

---

## Google Places API Quick Reference

### Nearby Search for Self Storage

```bash
curl "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=39.2667,-81.5615&radius=8046&keyword=self%20storage&key=${GOOGLE_API_KEY}"
```

- `radius`: 8046 meters = 5 miles
- `keyword`: "self storage"
- Returns up to 20 results per page (use `next_page_token` for pagination)

### Response Fields Needed

```json
{
  "results": [
    {
      "name": "Public Storage",
      "place_id": "ChIJ...",
      "geometry": { "location": { "lat": 39.27, "lng": -81.56 } },
      "vicinity": "123 Main St, Parkersburg"
    }
  ]
}
```
