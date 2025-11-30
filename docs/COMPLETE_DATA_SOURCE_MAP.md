# Complete Data Source Integration Map

> **Project:** ZIP Code Screener for Self-Storage Site Selection
> **Target States:** Pennsylvania, West Virginia, Virginia, Maryland
> **Last Updated:** 2025-11-29

---

## Stage 0: Geography Filter

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| Population Density | Census Bureau ACS | National | API Key | Table B01003 / land area |
| MSA/CBSA Designations | Census Bureau | National | None | Delineation files (annual update) |
| Drive Time to Metro | OSRM (self-host) or Google | National | None / API Key | Routing calculation |
| Tourism Flags | BLS QCEW (Leisure/Hospitality) | National | None | Employment concentration proxy |

---

## Stage 1: Demographics

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| ZIP Population | Census Bureau ACS | National | API Key | Table B01003 |
| 5-Mile Radius Population | Census Bureau ACS | National | API Key | Block groups + spatial buffer |
| Median Household Income | Census Bureau ACS | National | API Key | Table B19013 |
| Poverty Rate | Census Bureau ACS | National | API Key | Table S1701 / B17001 |
| 5-Year Population Growth | Census Bureau ACS | National | API Key | Compare vintages |
| Renter Percentage | Census Bureau ACS | National | API Key | Table B25003 |
| Age Distribution | Census Bureau ACS | National | API Key | Table B01001 |

---

## Stage 2: Rough Saturation

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| Facility Count | Google Places API | National | API Key | "self storage" keyword |
| Facility Count (alt) | SpareFoot | National | Scrape | Listing counts |
| Facility Details | Google Places Details | National | API Key | Address, reviews, hours |

---

## Stage 3: Zoning

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| Zoning Codes | Municode | National | None/Scrape | Municipal code library |
| Zoning Maps | County GIS | Per-county | None | Parcel-level zoning |
| Moratorium Tracking | Manual research | Per-county | None | News, planning dept |

---

## Stage 4: True Saturation

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| Actual Facility Sq Ft | Radius+ | National | Paid API | Primary source |
| Actual Facility Sq Ft (alt) | Yardi Matrix | National | Paid API | Alternative |
| Actual Facility Sq Ft (alt) | SpareFoot | National | Scrape | Unit counts → estimate |

---

## Stage 5: Pricing & Yield

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| 10×10 Unit Rents | SpareFoot | National | Scrape/API | Primary source |
| 10×10 Unit Rents (alt) | Competitor Websites | Per-facility | Scrape | Direct pricing |
| 10×10 Unit Rents (alt) | Phone Surveys | Per-facility | None | Manual |
| Land Prices | Zillow | National | API | Listings data |
| Land Prices (alt) | LandWatch | National | Scrape | Rural land focus |
| Land Prices (alt) | County Assessor | Per-county | None | Tax assessments |
| Construction Costs | RSMeans | National | Paid | Regional cost indices |

---

## Stage 6: Traffic & Access

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| AADT Traffic Counts | State DOT | Per-state | None | See state list below |
| Road Visibility | Google Street View API | National | API Key | Image analysis |
| Turn Count | Google Directions API | National | API Key | Route steps |
| Road Classification | HPMS (FHWA) | National | None | Federal highway data |

### State DOT Traffic Data Sources

| State | Source | URL | Format |
|-------|--------|-----|--------|
| WV | WV DOT | https://transportation.wv.gov/highways/traffic | GIS/PDF |
| PA | PennDOT | https://gis.penndot.gov | GIS REST |
| VA | VDOT | https://www.virginiadot.org/info/ct-TrafficCounts.asp | GIS/CSV |
| MD | MDOT SHA | https://roads.maryland.gov | GIS |
| OH | ODOT | https://gis.dot.state.oh.us/tims | GIS REST |
| KY | KYTC | https://transportation.ky.gov | GIS/PDF |
| NC | NCDOT | https://connect.ncdot.gov/resources/State-Mapping | GIS REST |
| TN | TDOT | https://www.tn.gov/tdot/traffic-operations-division | GIS/PDF |
| TX | TxDOT | https://www.txdot.gov/data-maps/traffic-counts.html | GIS REST |
| FL | FDOT | https://tdaappsprod.dot.state.fl.us/fto/ | GIS REST |
| GA | GDOT | https://www.dot.ga.gov/GDOT/Pages/TrafficData.aspx | GIS |
| SC | SCDOT | https://www.scdot.org/travel/travel-trafficcounts.aspx | GIS/PDF |
| AL | ALDOT | https://aldotgis.dot.state.al.us | GIS |
| AZ | ADOT | https://adot.maps.arcgis.com | GIS REST |
| NV | NDOT | https://www.dot.nv.gov/doing-business/about-ndot/ndot-divisions/traffic-operations | GIS |
| National | HPMS (FHWA) | https://www.fhwa.dot.gov/policyinformation/hpms.cfm | Download |

---

## Stage 7: Risk & Buildability

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| Flood Zones | FEMA NFHL | National | None | REST API |
| Flood Zones (alt) | FEMA MSC | National | None | Map Service Center |
| Violent Crime Rates | FBI UCR | National | None | Uniform Crime Reports |
| Crime Rates (alt) | NeighborhoodScout | National | Paid | Per-ZIP index |
| Wetlands | USFWS NWI | National | None | National Wetlands Inventory |
| Superfund/Brownfields | EPA Envirofacts | National | None | Contaminated sites |
| Terrain/Slope | USGS NED | National | None | Elevation data |
| Wildfire Risk | USFS Wildfire Risk | National | None | Risk index |
| Earthquake Risk | USGS Seismic Hazard | National | None | Hazard maps |
| Insurance Rates | NAIC | National | Paid | State rate filings |

---

## Stage 8: Strategic Scoring

### Highway Expansion Projects (Per-State DOT STIP/LRTP)

| State | Source | URL | Update Cycle |
|-------|--------|-----|--------------|
| WV | WV DOT STIP | https://transportation.wv.gov/highways/programplanning/STIP | Annual |
| PA | PennDOT TIP | https://www.penndot.pa.gov/ProjectAndPrograms/tip | 4-year cycle |
| VA | VDOT SYIP | https://www.virginiadot.org/projects/syip | Annual |
| MD | MDOT CTP | https://www.mdot.maryland.gov/ctp | Annual |
| OH | ODOT STIP | https://www.transportation.ohio.gov/programs/stip | 4-year cycle |
| KY | KYTC STIP | https://transportation.ky.gov/Program-Management | Annual |
| NC | NCDOT STIP | https://connect.ncdot.gov/projects/planning/STIPDocuments | Annual |
| TN | TDOT STIP | https://www.tn.gov/tdot/long-range-planning-home/transportation-plans | Annual |
| TX | TxDOT UTP | https://www.txdot.gov/projects/planning/utp.html | 10-year rolling |
| FL | FDOT Work Program | https://www.fdot.gov/workprogram | 5-year cycle |
| GA | GDOT STIP | https://www.dot.ga.gov/InvestSmart/STIP | 4-year cycle |
| SC | SCDOT STIP | https://www.scdot.org/inside/planning-stip.aspx | Annual |
| National | FHWA STIP Database | https://www.fhwa.dot.gov/planning/stip/ | Reference |

### Manufacturing & Economic Development

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| FDI Announcements | SelectUSA | National | None | https://www.selectusa.gov |
| CHIPS Act Recipients | Commerce.gov | National | None | https://www.commerce.gov/chips |
| IRA Projects | DOE | National | None | Clean energy investments |
| State EDA Announcements | Per-state | Per-state | None | See list below |
| Megadeals Database | Good Jobs First | National | None | https://www.goodjobsfirst.org/megadeals |
| Reshoring Projects | Reshoring Initiative | National | None | https://reshorenow.org |
| Site Selection Magazine | Site Selection | National | None | Project announcements |

### State Economic Development Agencies

| State | Agency | URL |
|-------|--------|-----|
| WV | WV Development Office | https://westvirginia.gov/business |
| PA | DCED | https://dced.pa.gov |
| VA | VEDP | https://www.vedp.org |
| MD | Commerce Maryland | https://commerce.maryland.gov |
| OH | JobsOhio | https://www.jobsohio.com |
| KY | Cabinet for Economic Dev | https://ced.ky.gov |
| NC | EDPNC | https://edpnc.com |
| TN | TNECD | https://www.tn.gov/ecd |
| TX | Office of the Governor - Economic Dev | https://gov.texas.gov/business |
| FL | Enterprise Florida | https://www.enterpriseflorida.com |
| GA | Georgia Dept of Economic Dev | https://www.georgia.org |
| SC | SC Commerce | https://www.sccommerce.com |
| AL | Made in Alabama | https://www.madeinalabama.com |
| AZ | Arizona Commerce Authority | https://www.azcommerce.com |

### Tourism / RV / Boat Indicators

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| Lakes/Rivers | USGS NHD | National | None | National Hydrography Dataset |
| Marinas | Google Places API | National | API Key | "marina" search |
| Campgrounds | Google Places API | National | API Key | "campground" / "RV park" search |
| Campgrounds (alt) | Recreation.gov | National | API | Federal campgrounds |
| Campgrounds (alt) | KOA Directory | National | Scrape | KOA locations |
| RV Dealers | Google Places API | National | API Key | "RV dealer" search |
| Boat Launches | USGS / State DNR | Per-state | None | Public access points |
| State Parks | State DNR | Per-state | None | Park locations |

### Anchor Institutions

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| Military Bases | DoD Installations | National | None | Public list |
| Military Personnel | DMDC | National | None | Base population |
| Universities | NCES IPEDS | National | None | Enrollment data |
| Hospitals | CMS Provider Data | National | None | Hospital locations |
| Amazon Warehouses | MWPVL | National | None | https://www.mwpvl.com/html/amazon_com.html |
| FedEx/UPS Hubs | Company websites | National | None | Distribution centers |

### Competitor Quality

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| Facility Age | County Assessor | Per-county | None | Year built |
| Facility Reviews | Google Places API | National | API Key | Rating, review count |
| Facility Photos | Google Street View | National | API Key | Visual assessment |
| Facility Features | SpareFoot | National | Scrape | Climate control, security, etc. |

### Economic Diversity

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| Employment by Industry | BLS QCEW | National | None | Quarterly Census of Employment |
| Business Patterns | Census CBP | National | None | County Business Patterns |
| Top Employers | State labor depts | Per-state | None | Major employer lists |

### Migration Patterns

| Data | Source | Coverage | Auth | Notes |
|------|--------|----------|------|-------|
| IRS Migration Data | IRS SOI | National | None | County-to-county flows |
| U-Haul Migration Trends | U-Haul | National | None | Annual report |
| Census Migration | Census ACS | National | API Key | Table B07001 |

---

## County GIS Portals (For Zoning, Parcels, Land Data)

| State | Counties | Portal Type |
|-------|----------|-------------|
| WV | All 55 | Mix of individual + WV GIS Tech Center |
| PA | 67 counties | Mix — many on ArcGIS Online |
| VA | 133 counties/cities | VGIN statewide + individual |
| MD | 24 counties | Mix — MDiMap statewide |
| OH | 88 counties | Many on OGRIP or individual |
| KY | 120 counties | KYGIS statewide |
| NC | 100 counties | NC OneMap + individual |
| TN | 95 counties | TN GIS + individual |
| TX | 254 counties | Mix — many on TNRIS |
| FL | 67 counties | Mix — many excellent individual portals |
| GA | 159 counties | Mix — Georgia GIS Clearinghouse |
| SC | 46 counties | Mix — individual portals |

---

## Integration Summary by Stage

| Stage | External Connections Required |
|-------|------------------------------|
| S0 | Census (density), OSRM/Google (drive time), BLS (tourism proxy) |
| S1 | Census (6 tables) |
| S2 | Google Places |
| S3 | Municode, County GIS (55+ per state) |
| S4 | Radius+/Yardi (paid) or SpareFoot |
| S5 | SpareFoot, Zillow/LandWatch, RSMeans |
| S6 | State DOT (per-state), Google Street View, Google Directions |
| S7 | FEMA, FBI UCR, NWI, EPA, USGS |
| S8 | State DOT STIP, SelectUSA, State EDA, BLS QCEW, USGS NHD, IPEDS, DoD, Google Places, County Assessor, IRS |

---

## Composio MCP Connections (Expanded)

| Connection ID | Service | Auth | Stages |
|---------------|---------|------|--------|
| `census_acs` | Census Bureau ACS | API Key | S0, S1 |
| `census_tiger` | Census TIGER/Line | None | S0, S1 |
| `google_places` | Google Places API | API Key | S2, S8 |
| `google_directions` | Google Directions API | API Key | S0, S6 |
| `google_streetview` | Google Street View API | API Key | S6, S8 |
| `google_distance` | Google Distance Matrix | API Key | S0 |
| `osrm` | OSRM (self-host or public) | None | S0 |
| `fema_nfhl` | FEMA Flood Maps | None | S7 |
| `fbi_ucr` | FBI Crime Data | None | S7 |
| `epa_envirofacts` | EPA Envirofacts | None | S7 |
| `usgs_nhd` | USGS Hydrography | None | S8 |
| `usgs_ned` | USGS Elevation | None | S7 |
| `usfws_nwi` | Wetlands Inventory | None | S7 |
| `bls_qcew` | BLS Employment | None | S0, S8 |
| `nces_ipeds` | University Data | None | S8 |
| `irs_soi` | IRS Migration | None | S8 |
| `sparefoot` | SpareFoot | Scrape | S2, S4, S5 |
| `radius_plus` | Radius+ | Paid API | S4 |
| `zillow` | Zillow | API | S5 |
| `landwatch` | LandWatch | Scrape | S5 |
| `selectusa` | SelectUSA | Scrape/RSS | S8 |
| `goodjobsfirst` | Megadeals DB | None | S8 |

### Per-State Connections

| Connection ID | Service | Stages |
|---------------|---------|--------|
| `dot_wv` | WV DOT Traffic/STIP | S6, S8 |
| `dot_pa` | PennDOT Traffic/TIP | S6, S8 |
| `dot_va` | VDOT Traffic/SYIP | S6, S8 |
| `dot_md` | MDOT Traffic/CTP | S6, S8 |
| `eda_wv` | WV Development Office | S8 |
| `eda_pa` | PA DCED | S8 |
| `eda_va` | VEDP | S8 |
| `eda_md` | Commerce Maryland | S8 |

---

## n8n Workflows (Expanded)

| Workflow ID | Trigger | Sources | Target Table |
|-------------|---------|---------|--------------|
| `wf_census_demographics` | Webhook | Census ACS | `api_cache` |
| `wf_census_density` | Webhook | Census ACS | `api_cache` |
| `wf_drive_time` | Webhook | OSRM/Google | `api_cache` |
| `wf_google_places_facilities` | Webhook | Google Places | `api_cache` |
| `wf_sparefoot_facilities` | Webhook | SpareFoot | `api_cache` |
| `wf_sparefoot_pricing` | Webhook | SpareFoot | `pricing_data` |
| `wf_radius_sqft` | Webhook | Radius+ | `api_cache` |
| `wf_fema_flood` | Webhook | FEMA NFHL | `api_cache` |
| `wf_fbi_crime` | Webhook | FBI UCR | `api_cache` |
| `wf_wetlands` | Webhook | NWI | `api_cache` |
| `wf_epa_brownfields` | Webhook | EPA | `api_cache` |
| `wf_dot_traffic_{state}` | Scheduled | State DOT | `traffic_data` |
| `wf_dot_stip_{state}` | Scheduled | State DOT STIP | `stip_projects` |
| `wf_eda_announcements_{state}` | Scheduled | State EDA | `mfg_announcements` |
| `wf_selectusa` | Scheduled | SelectUSA | `mfg_announcements` |
| `wf_usgs_lakes` | One-time | USGS NHD | `water_bodies` |
| `wf_campgrounds` | One-time | Recreation.gov + Google | `campgrounds` |
| `wf_military_bases` | One-time | DoD | `military_bases` |
| `wf_universities` | One-time | IPEDS | `universities` |
| `wf_amazon_warehouses` | Scheduled | MWPVL | `distribution_centers` |
| `wf_irs_migration` | Annual | IRS SOI | `migration_data` |
| `wf_bls_employment` | Quarterly | BLS QCEW | `employment_data` |

---

## New Tables Needed

| Table | Purpose | Stage |
|-------|---------|-------|
| `stip_projects` | Highway expansion projects | S8 |
| `mfg_announcements` | Manufacturing/FDI announcements | S8 |
| `water_bodies` | Lakes, rivers for RV/boat scoring | S8 |
| `campgrounds` | RV parks, campgrounds | S8 |
| `military_bases` | DoD installations | S8 |
| `universities` | Colleges with enrollment | S8 |
| `distribution_centers` | Amazon, FedEx, UPS facilities | S8 |
| `migration_data` | IRS county-to-county flows | S8 |
| `employment_data` | BLS QCEW by industry | S8 |
| `county_gis_portals` | Links to county GIS for zoning research | S3 |

---

## Total Connection Count

| Category | Count |
|----------|-------|
| National APIs | 22 |
| State DOT (traffic) | 15+ |
| State DOT (STIP) | 15+ |
| State EDA | 15+ |
| County GIS | 100s (varies by coverage) |
| **Total unique sources** | **70+ APIs/portals** |
