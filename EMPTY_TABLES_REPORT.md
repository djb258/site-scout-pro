# Empty Tables Report

## Summary
**13 tables** in the database currently have **zero rows** of data.

---

## Empty Tables (No Data)

### 1. **county_gis_portals**
- **Purpose**: Cache of county GIS portal URLs and access information
- **Data Source**: Manual research/configuration
- **Status**: Not populated

### 2. **employer_tracking**
- **Purpose**: Track major employers by county (for demand analysis)
- **Data Source**: Research/BLS data
- **Status**: Not populated
- **Note**: ERD shows 0 rows expected

### 3. **facility_call_results**
- **Purpose**: Store results from phone calls to storage facilities (rent verification)
- **Data Source**: Manual phone calls
- **Status**: Not populated

### 4. **flood_zones**
- **Purpose**: FEMA flood zone data for parcels
- **Data Source**: FEMA GIS data
- **Status**: Not populated

### 5. **marketing_company_error_log**
- **Purpose**: Error logging for marketing company integrations
- **Data Source**: System-generated
- **Status**: Not populated (no errors yet)

### 6. **mfg_announcements**
- **Purpose**: Manufacturing facility announcements (CHIPS Act, IRA projects)
- **Data Source**: News/research
- **Status**: Not populated
- **Note**: ERD shows 0 rows expected

### 7. **news_articles**
- **Purpose**: News articles related to economic catalysts
- **Data Source**: News feeds
- **Status**: Not populated
- **Note**: ERD shows 0 rows expected

### 8. **pricing_data**
- **Purpose**: Historical pricing data from storage facilities
- **Data Source**: Web scraping/AI calls
- **Status**: Not populated

### 9. **stip_projects**
- **Purpose**: State Transportation Improvement Program (STIP) projects
- **Data Source**: DOT/STIP data
- **Status**: Not populated

### 10. **storage_pipeline**
- **Purpose**: Planned/announced storage facilities (competition pipeline)
- **Data Source**: Permit/news research
- **Status**: Not populated
- **Note**: ERD shows 0 rows expected

### 11. **traffic_data**
- **Purpose**: Traffic count data for roads near parcels
- **Data Source**: DOT/traffic APIs
- **Status**: Not populated

### 12. **zone_zips**
- **Purpose**: Mapping of ZIP codes to target zones
- **Data Source**: Calculated/configured
- **Status**: Not populated

### 13. **zoning_cache**
- **Purpose**: Cached zoning information for jurisdictions
- **Data Source**: County GIS/research
- **Status**: Not populated

---

## Tables with Minimal Data (< 10 rows)

These tables exist but have very little data:

- **generated_reports**: 2 rows
- **policy_tracking**: 2 rows
- **target_zones**: 2 rows
- **water_bodies**: 2 rows
- **build_model_defaults**: 1 row
- **housing_pipeline**: 5 rows
- **infrastructure_projects**: 6 rows
- **runs**: 6 rows
- **pipeline_status_log**: 8 rows
- **feasibility_scenarios**: 9 rows

---

## Most Populated Tables

Top 10 tables by row count:

1. **zips_master**: 41,551 rows
2. **zip_results**: 11,116 rows
3. **housing_communities**: 6,698 rows
4. **migration_data**: 2,720 rows
5. **demand_anchors**: 2,666 rows
6. **api_cache**: 2,655 rows
7. **storage_facilities**: 2,351 rows
8. **layer_1_geography**: 2,053 rows
9. **layer_2_demographics**: 2,053 rows
10. **distribution_centers**: 1,224 rows

---

## Data Collection Priorities

### High Priority (Critical for Analysis)
1. **storage_pipeline** - Competition analysis requires knowing planned facilities
2. **pricing_data** - Rent analysis needs historical pricing
3. **traffic_data** - Parcel scoring needs traffic counts
4. **flood_zones** - Parcel viability requires floodplain data

### Medium Priority (Enhancement)
5. **mfg_announcements** - Economic catalyst tracking
6. **stip_projects** - Infrastructure catalyst tracking
7. **employer_tracking** - Demand driver analysis
8. **news_articles** - Catalyst research

### Low Priority (Nice to Have)
9. **county_gis_portals** - Caching for efficiency
10. **zoning_cache** - Caching for efficiency
11. **facility_call_results** - Manual verification
12. **zone_zips** - Configuration data

---

## Notes

- **Total Tables**: 63 tables in database
- **Empty Tables**: 13 (21%)
- **Populated Tables**: 50 (79%)
- **Tables with < 10 rows**: 10 additional tables

Most core functionality tables are populated. Empty tables are primarily:
- **Data collection tables** (pipeline, pricing, traffic)
- **Research/catalyst tables** (news, announcements, employers)
- **Cache/configuration tables** (zoning_cache, county_gis_portals)

