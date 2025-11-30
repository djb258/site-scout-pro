# Bedford PA 120-Mile Zone — Data Source Master List

> **Zone:** Bedford PA 120mi (Zone ID: 1)
> **Coverage:** 2,053 ZIPs across PA, WV, MD, VA
> **Last Updated:** 2025-11-29

---

## Connection Methods Key

| Method | Tool | Use Case |
|--------|------|----------|
| **API** | Composio MCP / Direct | Structured APIs with keys |
| **n8n** | Self-hosted n8n | Scheduled jobs, webhooks, transforms |
| **Firecrawl** | Firecrawl API | JavaScript-heavy sites, structured extraction |
| **Scraper API** | Scraper API | Anti-bot sites, rotating proxies |
| **Direct Download** | Cursor/Claude Code | CSV/GIS file downloads |
| **Manual** | You | Phone calls, PDF reading |

---

## Complete API Key List

### Required API Keys

```bash
# Census Bureau (FREE)
CENSUS_API_KEY=
# Get at: https://api.census.gov/data/key_signup.html

# Google Maps Platform (PAID - ~$200/mo)
GOOGLE_API_KEY=
# Get at: https://console.cloud.google.com/apis/credentials
# Enable: Places, Directions, Distance Matrix, Street View, Geocoding

# FBI Crime Data Explorer (FREE)
FBI_API_KEY=
# Get at: https://api.usa.gov/crime/fbi/cde

# Recreation.gov (FREE)
RECREATION_GOV_API_KEY=
# Get at: https://ridb.recreation.gov/docs

# Firecrawl (PAID - ~$50/mo)
FIRECRAWL_API_KEY=
# Get at: https://www.firecrawl.dev/

# Scraper API (PAID - ~$50/mo)
SCRAPER_API_KEY=
# Get at: https://www.scraperapi.com/
```

### Optional Paid Providers

```bash
# Radius+ (PAID - ~$500/mo)
RADIUS_PLUS_API_KEY=
# Contact: sales@radiusplus.com

# Yardi Matrix (PAID - varies)
YARDI_MATRIX_API_KEY=
# Contact: yardimatrix.com
```

---

## Data Sources by Stage

### Stage 0: Geography Filter

| Data | Source | Auth | Method |
|------|--------|------|--------|
| Population Density | Census Bureau ACS | API Key | API |
| MSA/CBSA Designations | Census Bureau | None | Direct Download |
| Drive Time to Metro | OSRM | None | API |
| Drive Time (alt) | Google Distance Matrix | API Key | API |
| Tourism Employment | BLS QCEW | None | Direct Download |

### Stage 1: Demographics

| Data | Source | Census Table | Auth |
|------|--------|--------------|------|
| ZIP Population | Census ACS | B01003 | API Key |
| 5-Mile Radius Pop | Census ACS | B01003 + spatial | API Key |
| Median HH Income | Census ACS | B19013 | API Key |
| Poverty Rate | Census ACS | S1701 | API Key |
| 5-Year Pop Growth | Census ACS | B01003 (compare) | API Key |
| Renter Percentage | Census ACS | B25003 | API Key |

### Stage 2: Rough Saturation

| Data | Source | Auth | Method |
|------|--------|------|--------|
| Facility Count | Google Places API | API Key | API |
| Facility Count (alt) | SpareFoot | None | Firecrawl |

### Stage 3: Zoning

| Data | Source | Auth | Method |
|------|--------|------|--------|
| County Zoning Codes | Municode | None | Firecrawl |
| PA County GIS | PASDA | None | Direct Download |
| WV County GIS | WV GIS Tech Center | None | Direct Download |
| VA County GIS | VGIN | None | API |
| MD County GIS | MDiMap | None | API |

### Stage 4: True Saturation

| Data | Source | Auth | Method |
|------|--------|------|--------|
| Actual Facility Sq Ft | Radius+ | Paid API | API |
| Facility Details | SpareFoot | None | Firecrawl |

### Stage 5: Pricing & Yield

| Data | Source | Auth | Method |
|------|--------|------|--------|
| 10×10 Unit Rents | SpareFoot | None | Firecrawl |
| Land Prices | Zillow | None | Scraper API |
| Land Prices (alt) | LandWatch | None | Firecrawl |
| Construction Costs | RSMeans | Paid | Manual |

### Stage 6: Traffic & Access

| Data | Source | Auth | Method |
|------|--------|------|--------|
| PA Traffic Counts | PennDOT | None | API |
| WV Traffic Counts | WV DOT | None | Direct Download |
| VA Traffic Counts | VDOT | None | Direct Download |
| MD Traffic Counts | MDOT SHA | None | Direct Download |
| Road Visibility | Google Street View | API Key | API |
| Turn Count | Google Directions | API Key | API |

### Stage 7: Risk & Buildability

| Data | Source | Auth | Method |
|------|--------|------|--------|
| Flood Zones | FEMA NFHL | None | API |
| Violent Crime | FBI Crime Data | API Key | API |
| Wetlands | USFWS NWI | None | API |
| Brownfields | EPA Envirofacts | None | API |
| Terrain/Slope | USGS NED | None | API |

### Stage 8: Strategic Scoring

| Data | Source | Auth | Method |
|------|--------|------|--------|
| Highway Projects | State DOT STIPs | None | Firecrawl |
| Manufacturing | SelectUSA, State EDAs | None | Firecrawl |
| Lakes/Rivers | USGS NHD | None | API |
| Campgrounds | Recreation.gov | API Key | API |
| Military Bases | DoD | None | Firecrawl |
| Universities | NCES IPEDS | None | Direct Download |
| Distribution Centers | MWPVL | None | Firecrawl |
| Employment | BLS QCEW | None | Direct Download |
| Migration | IRS SOI | None | Direct Download |

---

## n8n Workflow Summary

| Workflow | Trigger | Method | Target Table |
|----------|---------|--------|--------------|
| wf_census_demographics | Webhook | API | api_cache |
| wf_google_places_facilities | Webhook | API | api_cache |
| wf_sparefoot_facilities | Webhook | Firecrawl | api_cache |
| wf_sparefoot_pricing | Webhook | Firecrawl | pricing_data |
| wf_land_prices | Webhook | Scraper API | api_cache |
| wf_municode_zoning | Scheduled | Firecrawl | zoning_cache |
| wf_dot_traffic_* | Scheduled | API/Download | traffic_data |
| wf_stip_* | Scheduled | Firecrawl | stip_projects |
| wf_eda_announcements | Scheduled | Firecrawl | mfg_announcements |
| wf_fema_flood | Webhook | API | api_cache |
| wf_fbi_crime | Webhook | API | api_cache |
| wf_usgs_water | One-time | API | water_bodies |
| wf_campgrounds | One-time | API | campgrounds |
| wf_universities | One-time | Download | universities |
| wf_distribution_centers | Scheduled | Firecrawl | distribution_centers |
| wf_bls_employment | Quarterly | Download | employment_data |
| wf_irs_migration | Annual | IRS SOI | migration_data |

---

## Priority Setup Order

| Priority | Task | Time |
|----------|------|------|
| 1 | Get Census API key | 5 min |
| 2 | Get Google Maps API key | 10 min |
| 3 | Get FBI API key | 5 min |
| 4 | Get Firecrawl API key | 5 min |
| 5 | Set up Composio MCP | 30 min |
| 6 | Build wf_census_demographics | 1 hr |
| 7 | Build wf_google_places_facilities | 1 hr |
| 8 | Run Stage 0-1 with live data | 30 min |
