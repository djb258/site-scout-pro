================================================================================
STORAGE FACILITY SITE SCREENER - DATA DICTIONARY
Generated: 2025-11-30 10:09:48
================================================================================

--------------------------------------------------------------------------------
TABLE: target_zones
Display Name: Target Zones
Layer: Configuration
Description: Defines geographic screening zones centered on a ZIP code
Purpose: Configure the center point and radius for site screening analysis
Data Source: User Input
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
TZ_zone_id      zone_id                   integer         Unique identifier for each screening zon [PK]
TZ_center_lat   center_lat                numeric         Latitude coordinate of the zone center p
                                          Unit:           degrees
TZ_center_lon   center_lon                numeric         Longitude coordinate of the zone center 
                                          Unit:           degrees
TZ_center_zip   center_zip                character varying 5-digit ZIP code at the center of the sc
                                          Values:         Valid US 5-digit ZIP codes
TZ_created_at   created_at                timestamp without time zone When this zone was created
TZ_radius_miles radius_miles              integer         Search radius from center point in miles
                                          Unit:           miles
                                          Values:         Typically 50-150
TZ_states       states                    ARRAY           Array of state abbreviations within the 
TZ_zone_name    zone_name                 character varying Human-readable name for the screening zo

--------------------------------------------------------------------------------
TABLE: zone_zips
Display Name: Zone ZIP Codes
Layer: Layer 1 - Geography
Description: Links target zones to all ZIP codes within the radius
Purpose: Map each ZIP code to its parent zone with distance calculation
Data Source: Calculated from zips_master
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
ZZ_id           id                        integer         Auto-incrementing unique identifier [PK]
ZZ_distance_miles distance_miles            numeric         Haversine distance from zone center to Z
                                          Unit:           miles
ZZ_included     included                  boolean         Whether this ZIP is included in screenin
                                          Values:         TRUE, FALSE
ZZ_zip          zip                       character varying 5-digit ZIP code within the zone radius
ZZ_zone_id      zone_id                   integer         Foreign key to target_zones [FK]

--------------------------------------------------------------------------------
TABLE: layer_1_geography
Display Name: Layer 1: Geography
Layer: Layer 1 - Geography
Description: First screening layer with geographic data for each ZIP
Purpose: Filter ZIPs by location criteria (state, county, distance)
Data Source: zips_master + haversine calculation
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
L1G_zip         zip                       character varying 5-digit ZIP code (primary key) [PK]
L1G_centroid_lat centroid_lat              numeric         Latitude of ZIP code geographic center
                                          Unit:           degrees
L1G_centroid_lon centroid_lon              numeric         Longitude of ZIP code geographic center
                                          Unit:           degrees
L1G_county_fips county_fips               character varying 5-digit Federal Information Processing S
                                          Logic:          First 2 digits = state FIPS, last 3 = county
L1G_county_name county_name               character varying Full county name
L1G_distance_miles distance_miles            numeric         Miles from zone center to ZIP centroid
                                          Unit:           miles
L1G_kill_reason kill_reason               character varying Why ZIP was eliminated (if passed=FALSE)
                                          Values:         NULL if passed, reason text if eliminated
L1G_passed      passed                    boolean         Whether ZIP passed Layer 1 screening cri
                                          Values:         TRUE (passed), FALSE (eliminated)
L1G_state       state                     character varying 2-letter state abbreviation
                                          Values:         Valid US state codes
L1G_zone_id     zone_id                   integer         Parent zone this ZIP belongs to [FK]

--------------------------------------------------------------------------------
TABLE: layer_2_demographics
Display Name: Layer 2: Demographics
Layer: Layer 2 - Demographics
Description: Census demographic data for each ZIP code
Purpose: Filter ZIPs by population, income, and housing characteristics
Data Source: US Census Bureau ACS 5-Year Estimates
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
L2D_zip         zip                       character varying 5-digit ZIP code (primary key) [PK]
L2D_apartment_units apartment_units           integer         Number of units in multi-family building
                                          Unit:           units
                                          Logic:          Apartments have minimal storage, highest demand dr
L2D_housing_units housing_units             integer         Total number of housing units (occupied 
                                          Unit:           units
L2D_kill_reason kill_reason               character varying Why ZIP was eliminated (if passed=FALSE)
L2D_median_age  median_age                numeric         Median age of population in years
                                          Unit:           years
L2D_median_income median_income             integer         Median annual household income in dollar
                                          Unit:           USD
L2D_mobile_home_units mobile_home_units         integer         Number of mobile/manufactured home units
                                          Unit:           units
                                          Logic:          Mobile homes need external storage for vehicles/eq
L2D_occupied_units occupied_units            integer         Number of occupied housing units
                                          Unit:           units
L2D_passed      passed                    boolean         Whether ZIP passed Layer 2 demographic c
                                          Values:         TRUE, FALSE
L2D_population  population                integer         Total population in the ZIP code
                                          Unit:           persons
L2D_poverty_rate poverty_rate              numeric         Percentage of population below poverty l
                                          Unit:           percent
L2D_renter_pct  renter_pct                numeric         Percentage of occupied housing units tha
                                          Unit:           percent
                                          Logic:          Higher renter % = more storage demand (moving freq
L2D_sfh_units   sfh_units                 integer         Number of detached single-family housing
                                          Unit:           units
                                          Logic:          SFH owners often need storage for lawn equipment, 
L2D_townhome_units townhome_units            integer         Number of attached townhome/rowhouse uni
                                          Unit:           units
                                          Logic:          Townhomes have limited storage, high demand driver

--------------------------------------------------------------------------------
TABLE: layer_3_counties
Display Name: Layer 3: County Aggregation
Layer: Layer 3 - Aggregation
Description: Aggregated data at the county level from surviving ZIPs
Purpose: Roll up ZIP-level data to county for market analysis
Data Source: Aggregated from layer_2_demographics
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
L3C_county_fips county_fips               character varying 5-digit county FIPS code (primary key) [PK]
L3C_avg_income  avg_income                integer         Population-weighted average median incom
                                          Unit:           USD
L3C_avg_poverty avg_poverty               numeric         Population-weighted average poverty rate
                                          Unit:           percent
L3C_avg_renter_pct avg_renter_pct            numeric         Housing-weighted average renter percenta
                                          Unit:           percent
L3C_county_name county_name               character varying Full county name
L3C_state       state                     character varying 2-letter state abbreviation
L3C_surviving_zips surviving_zips            integer         Number of ZIPs that passed Layers 1-2 in
                                          Unit:           count
L3C_total_apartment total_apartment           integer         Sum of apartment units across all surviv
                                          Unit:           units
L3C_total_housing_units total_housing_units       integer         Sum of housing units across all survivin
                                          Unit:           units
L3C_total_mobile_home total_mobile_home         integer         Sum of mobile home units across all surv
                                          Unit:           units
L3C_total_population total_population          integer         Sum of population across all surviving Z
                                          Unit:           persons
L3C_total_sfh   total_sfh                 integer         Sum of SFH units across all surviving ZI
                                          Unit:           units
L3C_total_townhome total_townhome            integer         Sum of townhome units across all survivi
                                          Unit:           units

--------------------------------------------------------------------------------
TABLE: storage_facilities
Display Name: Storage Facilities
Layer: Layer 4 - Supply Analysis
Description: Competitor self-storage facilities in the market
Purpose: Analyze market saturation and competitive landscape
Data Source: Google Places API
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
SF_id           id                        integer         Auto-incrementing unique identifier [PK]
SF_address      address                   character varying Full street address
SF_asking_rent_10x10 asking_rent_10x10         integer         Monthly asking rent for 10x10 unit
                                          Unit:           USD/month
                                          Logic:          Standard unit for price comparison
SF_asking_rent_10x20 asking_rent_10x20         integer         Monthly asking rent for 10x20 unit
                                          Unit:           USD/month
SF_city         city                      character varying City name
SF_climate_controlled climate_controlled        boolean         Whether facility offers climate-controll
                                          Values:         TRUE, FALSE
SF_county_fips  county_fips               character varying 5-digit county FIPS code for aggregation
SF_drive_up     drive_up                  boolean         Whether facility offers drive-up units
                                          Values:         TRUE, FALSE
SF_fetched_at   fetched_at                timestamp without time zone When this data was last retrieved
SF_lat          lat                       numeric         Facility latitude coordinate
                                          Unit:           degrees
SF_lon          lon                       numeric         Facility longitude coordinate
                                          Unit:           degrees
SF_name         name                      character varying Business name of the storage facility
SF_owner_operator owner_operator            character varying Company that owns or operates the facili
SF_place_id     place_id                  character varying Unique Google Places API identifier
SF_rating       rating                    numeric         Average Google review rating (1-5 stars)
                                          Values:         1.0 to 5.0
SF_review_count review_count              integer         Number of Google reviews
                                          Unit:           reviews
SF_rv_boat      rv_boat                   boolean         Whether facility offers RV or boat stora
                                          Values:         TRUE, FALSE
                                          Logic:          Indicates demand for vehicle storage in area
SF_source       source                    character varying Where this data was obtained
                                          Values:         google_places, sparefoot, manual
SF_state        state                     character varying 2-letter state code
SF_total_sqft   total_sqft                integer         Estimated total rentable square footage
                                          Unit:           sq ft
                                          Logic:          Used for saturation calculation (sqft per capita)
SF_unit_count   unit_count                integer         Estimated number of storage units
                                          Unit:           units
SF_year_built   year_built                integer         Year facility was constructed
SF_zip          zip                       character varying 5-digit ZIP code

--------------------------------------------------------------------------------
TABLE: housing_communities
Display Name: Housing Communities
Layer: Layer 5 - Demand Drivers
Description: Existing and pipeline housing developments (demand drivers)
Purpose: Track new housing that will generate storage demand
Data Source: County permit data, building department records
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
HC_id           id                        integer         Auto-incrementing unique identifier [PK]
HC_address      address                   character varying Street address or location description
HC_builder      builder                   character varying Construction company or developer name
HC_city         city                      character varying City name
HC_community_type community_type            character varying Type of housing development
                                          Values:         townhome, condo, apartment, mobile_home, sfh_subdi
                                          Logic:          Different types have different storage demand prof
HC_completion_date completion_date           date            Actual completion date
HC_county_fips  county_fips               character varying 5-digit county FIPS code
HC_created_at   created_at                timestamp without time zone When record was created
HC_expected_completion expected_completion       date            Projected completion date
HC_lat          lat                       numeric         Development latitude
                                          Unit:           degrees
HC_lon          lon                       numeric         Development longitude
                                          Unit:           degrees
HC_name         name                      character varying Name of the housing development
HC_notes        notes                     text            Additional information about the develop
HC_permit_date  permit_date               date            Date building permit was issued
HC_permit_number permit_number             character varying County/city permit reference number
HC_site_work_date site_work_date            date            Date site preparation began
HC_source       source                    character varying Where data was obtained
                                          Values:         county_permits, gis_portal, manual
HC_source_url   source_url                character varying Link to source documentation
HC_state        state                     character varying 2-letter state code
HC_status       status                    character varying Current stage of development
                                          Values:         existing, permitted, site_work, vertical, complete
                                          Logic:          Pipeline status indicates future demand timing
HC_total_units  total_units               integer         Number of housing units planned or built
                                          Unit:           units
HC_updated_at   updated_at                timestamp without time zone When record was last updated
HC_vertical_date vertical_date             date            Date vertical construction began
HC_year_built   year_built                integer         Year of completion (for existing)
HC_zip          zip                       character varying 5-digit ZIP code

--------------------------------------------------------------------------------
TABLE: demand_anchors
Display Name: Demand Anchors
Layer: Layer 5 - Demand Drivers
Description: Points of interest that generate storage demand
Purpose: Identify colleges, military bases, hospitals, and other demand drivers
Data Source: Google Places API, manual research
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
DA_id           id                        integer         Auto-incrementing unique identifier [PK]
DA_address      address                   character varying Street address
DA_anchor_type  anchor_type               character varying Category of demand driver
                                          Values:         college, military, hospital, employer, rv_park, ma
                                          Logic:          Each type has different storage demand characteris
DA_city         city                      character varying City name
DA_county_fips  county_fips               character varying 5-digit county FIPS code
DA_employee_count employee_count            integer         Number of employees (employers, military
                                          Unit:           employees
DA_fetched_at   fetched_at                timestamp without time zone When data was retrieved
DA_lat          lat                       numeric         Location latitude
                                          Unit:           degrees
DA_lon          lon                       numeric         Location longitude
                                          Unit:           degrees
DA_name         name                      character varying Name of the institution or business
DA_place_id     place_id                  character varying Unique Google Places identifier
DA_size_estimate size_estimate             character varying Relative size classification
                                          Values:         small, medium, large
DA_source       source                    character varying Where data was obtained
DA_state        state                     character varying 2-letter state code
DA_student_count student_count             integer         Total enrolled students (colleges only)
                                          Unit:           students
                                          Logic:          Students need summer storage
DA_unit_count   unit_count                integer         Number of units (mobile home parks, RV p
                                          Unit:           units
DA_zip          zip                       character varying 5-digit ZIP code

--------------------------------------------------------------------------------
TABLE: flood_zones
Display Name: Flood Zones
Layer: Layer 8 - Risk Assessment
Description: FEMA flood zone overlays for risk assessment
Purpose: Identify flood-prone areas to avoid or adjust scoring
Data Source: FEMA National Flood Hazard Layer
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
FZ_id           id                        integer         Auto-incrementing unique identifier [PK]
FZ_county_fips  county_fips               character varying 5-digit county FIPS code
FZ_geometry_json geometry_json             text            GeoJSON polygon for map overlay
FZ_risk_level   risk_level                character varying Simplified risk classification
                                          Values:         high, moderate, low, minimal
                                          Logic:          A/V zones = high, X shaded = moderate, X unshaded 
FZ_zone_id      zone_id                   character varying FEMA flood zone designation
                                          Values:         A, AE, AH, AO, V, VE, X (shaded), X (unshaded)

--------------------------------------------------------------------------------
TABLE: county_scoring
Display Name: County Scoring
Layer: Layer 10 - Scoring
Description: Final Go/No-Go scores aggregated at county level
Purpose: Rank and tier counties for investment prioritization
Data Source: Calculated from all layers
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
CS_county_fips  county_fips               character varying 5-digit county FIPS code (primary key) [PK]
CS_access_score access_score              integer         Score based on highways, traffic counts
                                          Values:         0-100
                                          Logic:          Higher = better visibility/access
CS_demand_score demand_score              integer         Score based on housing units, pipeline, 
                                          Values:         0-100
                                          Logic:          Higher = more demand drivers
CS_growth_score growth_score              integer         Score based on permits, population chang
                                          Values:         0-100
                                          Logic:          Higher = more growth potential
CS_notes        notes                     text            Additional scoring notes or overrides
CS_risk_score   risk_score                integer         Score based on flood zones, crime, econo
                                          Values:         0-100
                                          Logic:          Higher = lower risk
CS_scored_at    scored_at                 timestamp without time zone When scoring was calculated
CS_supply_score supply_score              integer         Score based on facility count, saturatio
                                          Values:         0-100
                                          Logic:          Higher = less competition (inverse of saturation)
CS_tier         tier                      integer         Priority tier for investment
                                          Values:         1 (Go), 2 (Maybe), 3 (No-Go)
                                          Logic:          Tier 1 = top 20%, Tier 2 = middle 30%, Tier 3 = bo
CS_total_score  total_score               integer         Weighted sum of all component scores
                                          Values:         0-100
                                          Logic:          Primary ranking metric

--------------------------------------------------------------------------------
TABLE: zips_master
Display Name: ZIP Codes Master
Layer: Reference Data
Description: Master list of all US ZIP codes with demographics
Purpose: Source data for zone creation and demographic lookups
Data Source: SimpleMaps US ZIP Code Database
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
ZM_zip          zip                       character varying 5-digit ZIP code [PK]
ZM_age_median   age_median                numeric         Median age of population
                                          Unit:           years
ZM_city         city                      character varying Primary city name for ZIP
ZM_county_fips  county_fips               character varying 5-digit county FIPS code
ZM_county_name  county_name               character varying Full county name
ZM_density      density                   numeric         People per square mile
                                          Unit:           persons/sq mi
ZM_education_college_or_above education_college_or_above numeric         Percentage with bachelor's degree or hig
                                          Unit:           percent
ZM_home_ownership home_ownership            numeric         Percentage of owner-occupied housing
                                          Unit:           percent
ZM_home_value   home_value                integer         Median value of owner-occupied homes
                                          Unit:           USD
ZM_income_household_median income_household_median   integer         Median annual household income
                                          Unit:           USD
ZM_lat          lat                       numeric         ZIP code centroid latitude
                                          Unit:           degrees
ZM_lng          lng                       numeric         ZIP code centroid longitude
                                          Unit:           degrees
ZM_military     military                  boolean         Whether ZIP contains military installati
                                          Values:         TRUE, FALSE
ZM_parent_zcta  parent_zcta               character varying Parent ZCTA if this is a non-ZCTA ZIP
ZM_population   population                integer         Total population
                                          Unit:           persons
ZM_rent_median  rent_median               integer         Median gross rent
                                          Unit:           USD/month
ZM_state        state                     character varying 2-letter state abbreviation
ZM_state_name   state_name                character varying Full state name
ZM_timezone     timezone                  character varying Primary timezone
ZM_unemployment_rate unemployment_rate         numeric         Percentage of labor force unemployed
                                          Unit:           percent
ZM_zcta         zcta                      boolean         Whether this is a ZIP Code Tabulation Ar
                                          Values:         TRUE, FALSE

--------------------------------------------------------------------------------
TABLE: api_cache
Display Name: API Cache
Layer: System
Description: Cache for external API responses to minimize API calls
Purpose: Reduce API costs and improve performance with TTL-based caching
Data Source: Various APIs (Census, Google, FEMA)
--------------------------------------------------------------------------------

ID              Column                    Type            Description                             
--------------- ------------------------- --------------- ----------------------------------------
AC_cache_key    cache_key                 character varying Unique identifier for cached data
AC_endpoint     endpoint                  character varying The API endpoint that was called
AC_expires_at   expires_at                timestamp without time zone When cached data expires
                                          Logic:          Census: 30 days, Storage: 7 days, FEMA: 7 days
AC_fetched_at   fetched_at                timestamp without time zone When data was retrieved from API
AC_request_params request_params            jsonb           JSON of parameters sent to API
AC_response     response                  jsonb           JSON response from the API