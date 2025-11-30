# Storage Site Screener - Entity Relationship Diagram

## Full Database ERD

```mermaid
erDiagram
    %% =====================================================
    %% CORE ZONE & RUN MANAGEMENT
    %% =====================================================

    target_zones {
        int zone_id PK
        varchar zone_name
        varchar center_zip
        numeric center_lat
        numeric center_lon
        int radius_miles
        array states
        timestamp created_at
    }

    runs {
        uuid run_id PK
        timestamp created_at
        varchar created_by
        array target_states
        jsonb config
        varchar status
        int current_stage
        int total_zips
        int surviving_zips
        timestamp completed_at
        text error_message
    }

    stage_log {
        int id PK
        uuid run_id FK
        int stage
        timestamp started_at
        timestamp completed_at
        int zips_input
        int zips_output
        int zips_killed
        varchar status
        text error_message
    }

    zip_results {
        int id PK
        uuid run_id FK
        varchar zip
        int stage_reached
        boolean killed
        int kill_stage
        varchar kill_step
        text kill_reason
        numeric kill_threshold
        numeric kill_value
        jsonb metrics
        jsonb scores
        numeric final_score
        int tier
        int rank
    }

    %% =====================================================
    %% MASTER DATA - ZIP CODES
    %% =====================================================

    zips_master {
        varchar zip PK
        numeric lat
        numeric lng
        varchar city
        varchar state
        varchar county_fips
        varchar county_name
        int population
        numeric density
        int income_household_median
        numeric home_ownership
        int home_value
        numeric age_median
    }

    zone_zips {
        int id PK
        int zone_id FK
        varchar zip
        numeric distance_miles
        boolean included
    }

    %% =====================================================
    %% SCREENING PIPELINE LAYERS
    %% =====================================================

    layer_1_geography {
        varchar zip PK
        int zone_id FK
        varchar state
        varchar county_fips
        varchar county_name
        numeric centroid_lat
        numeric centroid_lon
        numeric distance_miles
        boolean passed
        varchar kill_reason
    }

    layer_2_demographics {
        varchar zip PK
        int population
        int median_income
        numeric poverty_rate
        numeric renter_pct
        numeric median_age
        int housing_units
        int sfh_units
        int townhome_units
        int apartment_units
        int mobile_home_units
        boolean passed
        varchar kill_reason
    }

    layer_3_counties {
        varchar county_fips PK
        varchar state
        varchar county_name
        int surviving_zips
        int total_population
        int total_housing_units
        int total_sfh
        int total_townhome
        int total_apartment
        int total_mobile_home
        int avg_income
        numeric avg_poverty
        numeric avg_renter_pct
        bigint demand_sqft
        int high_demand_units
    }

    county_scoring {
        varchar county_fips PK
        int demand_score
        int supply_score
        int growth_score
        int risk_score
        int access_score
        int total_score
        int tier
        text notes
        timestamp scored_at
    }

    %% =====================================================
    %% SUPPLY DATA - EXISTING FACILITIES
    %% =====================================================

    storage_facilities {
        int id PK
        varchar place_id
        varchar name
        varchar address
        varchar city
        varchar state
        varchar zip
        varchar county_fips
        numeric lat
        numeric lon
        int total_sqft
        int unit_count
        int year_built
        boolean climate_controlled
        boolean drive_up
        boolean rv_boat
        varchar owner_operator
        numeric rating
        int review_count
        int asking_rent_10x10
        int asking_rent_10x20
        boolean no_competition_5mi
        numeric nearest_competitor_miles
    }

    pricing_data {
        int id PK
        varchar zip
        varchar facility_name
        varchar unit_size
        numeric monthly_rent
        varchar source
        date researched_at
    }

    %% =====================================================
    %% DEMAND DRIVERS
    %% =====================================================

    housing_communities {
        int id PK
        varchar name
        varchar address
        varchar city
        varchar state
        varchar zip
        varchar county_fips
        numeric lat
        numeric lon
        varchar community_type
        varchar status
        int total_units
        int year_built
        date permit_date
        date completion_date
        varchar builder
    }

    demand_anchors {
        int id PK
        varchar place_id
        varchar name
        varchar anchor_type
        varchar address
        varchar city
        varchar state
        varchar zip
        varchar county_fips
        numeric lat
        numeric lon
        varchar size_estimate
        int student_count
        int employee_count
        int unit_count
    }

    universities {
        int id PK
        varchar name
        varchar ipeds_id
        varchar institution_type
        varchar state
        varchar county
        varchar city
        int total_enrollment
        int undergrad_enrollment
        int has_dorms
        int dorm_capacity
        numeric lat
        numeric lng
    }

    military_bases {
        int id PK
        varchar name
        varchar branch
        varchar installation_type
        varchar state
        varchar county
        int military_personnel
        int civilian_personnel
        int total_personnel
        numeric lat
        numeric lng
    }

    distribution_centers {
        int id PK
        varchar company
        varchar facility_name
        varchar facility_type
        varchar state
        varchar county
        varchar city
        int sqft
        int employees
        int opened_year
        numeric lat
        numeric lng
    }

    %% =====================================================
    %% GROWTH INDICATORS
    %% =====================================================

    mfg_announcements {
        int id PK
        varchar state
        varchar company_name
        varchar project_name
        varchar city
        varchar county
        date announcement_date
        int jobs_created
        numeric investment_amount
        varchar industry
        boolean is_chips_act
        boolean is_ira
        boolean is_reshoring
    }

    stip_projects {
        int id PK
        varchar state
        varchar project_id
        varchar project_name
        varchar route
        varchar county
        text description
        varchar project_type
        numeric estimated_cost
        int start_year
        int completion_year
    }

    migration_data {
        int id PK
        int data_year
        varchar origin_state
        varchar origin_county_fips
        varchar dest_state
        varchar dest_county_fips
        int returns
        int exemptions
        numeric agi
        varchar flow_direction
    }

    employment_data {
        int id PK
        int data_year
        int data_quarter
        varchar state
        varchar county_fips
        varchar naics_code
        varchar naics_title
        int establishments
        int employment
        numeric total_wages
        numeric avg_weekly_wage
    }

    %% =====================================================
    %% RV/BOAT DEMAND DRIVERS
    %% =====================================================

    water_bodies {
        int id PK
        varchar name
        varchar water_type
        varchar state
        varchar county
        numeric area_acres
        numeric perimeter_miles
        boolean has_public_access
        boolean has_marina
        boolean has_boat_launch
        numeric centroid_lat
        numeric centroid_lng
    }

    campgrounds {
        int id PK
        varchar name
        varchar campground_type
        varchar state
        varchar county
        varchar city
        int total_sites
        int rv_sites
        boolean has_hookups
        numeric lat
        numeric lng
        numeric google_rating
        int google_review_count
    }

    %% =====================================================
    %% REGULATORY & RISK
    %% =====================================================

    zoning_cache {
        varchar county_fips PK
        varchar state
        varchar county_name
        varchar storage_allowed
        boolean moratorium
        text conditional_notes
        varchar source_url
        varchar researched_by
        date researched_at
    }

    county_gis_portals {
        int id PK
        varchar state
        varchar county_fips
        varchar county_name
        varchar gis_portal_url
        varchar zoning_map_url
        varchar parcel_search_url
        varchar planning_dept_url
    }

    flood_zones {
        int id PK
        varchar zone_id
        varchar county_fips
        varchar risk_level
        text geometry_json
    }

    traffic_data {
        int id PK
        varchar zip
        varchar road_name
        int aadt
        int aadt_year
        boolean visibility_ok
        int turn_count
    }

    %% =====================================================
    %% SYSTEM TABLES
    %% =====================================================

    api_cache {
        varchar cache_key PK
        varchar endpoint
        jsonb request_params
        jsonb response
        timestamp fetched_at
        timestamp expires_at
    }

    data_dictionary {
        varchar column_id PK
        varchar table_name
        varchar column_name
        varchar data_type
        varchar display_name
        text description
        text example_value
        varchar source
        text business_logic
    }

    table_dictionary {
        varchar table_id PK
        varchar table_name
        varchar display_name
        text description
        text purpose
        varchar layer
        varchar data_source
        varchar refresh_frequency
    }

    %% =====================================================
    %% RELATIONSHIPS
    %% =====================================================

    runs ||--o{ stage_log : "tracks stages"
    runs ||--o{ zip_results : "contains results"

    target_zones ||--o{ zone_zips : "contains"
    target_zones ||--o{ layer_1_geography : "filters"

    zips_master ||--o| layer_1_geography : "screened in"
    zips_master ||--o| layer_2_demographics : "demographics"

    layer_3_counties ||--o{ storage_facilities : "has"
    layer_3_counties ||--o{ housing_communities : "has"
    layer_3_counties ||--o{ demand_anchors : "has"
    layer_3_counties ||--o| county_scoring : "scored"
    layer_3_counties ||--o| zoning_cache : "zoning"
```

## Simplified Pipeline View

```mermaid
flowchart TB
    subgraph Input["Input Layer"]
        TZ[target_zones]
        ZM[zips_master<br/>41,551 ZIPs]
    end

    subgraph Pipeline["Screening Pipeline"]
        L1[layer_1_geography<br/>Distance + Density Filter]
        L2[layer_2_demographics<br/>Population/Income/Poverty]
        L3[layer_3_counties<br/>County Aggregation]
    end

    subgraph Supply["Supply Analysis"]
        SF[storage_facilities<br/>Google Places]
        PD[pricing_data<br/>Market Rents]
    end

    subgraph Demand["Demand Drivers"]
        HC[housing_communities]
        DA[demand_anchors]
        UN[universities]
        MB[military_bases]
        DC[distribution_centers]
    end

    subgraph Growth["Growth Indicators"]
        MFG[mfg_announcements]
        STIP[stip_projects]
        MIG[migration_data]
        EMP[employment_data]
    end

    subgraph RVBoat["RV/Boat Demand"]
        WB[water_bodies]
        CG[campgrounds]
    end

    subgraph Regulatory["Regulatory"]
        ZC[zoning_cache]
        FZ[flood_zones]
        GIS[county_gis_portals]
    end

    subgraph Scoring["Output"]
        CS[county_scoring]
        ZR[zip_results]
    end

    TZ --> L1
    ZM --> L1
    L1 --> L2
    L2 --> L3

    L3 --> CS
    SF --> CS
    PD --> CS
    HC --> CS
    DA --> CS

    MFG --> CS
    STIP --> CS

    ZC --> CS

    CS --> ZR
```

## Kill Switch Flow

```mermaid
flowchart LR
    subgraph Stage0["Stage 0: Pre-Filter"]
        S0[41,551 ZIPs]
    end

    subgraph Stage1["Layer 1: Geography"]
        D1{Distance > 120mi?}
        D2{Density > 3,500/sqmi?}
    end

    subgraph Stage2["Layer 2: Demographics"]
        D3{Population < 5,000?}
        D4{Income < $40,000?}
        D5{Poverty > 25%?}
        D6{Renter < 15%?}
    end

    subgraph Stage3["Layer 3: County"]
        D7{Avg Density > 750/sqmi?}
    end

    subgraph Output["Surviving"]
        OUT[74 Counties<br/>~4,000 ZIPs]
    end

    S0 --> D1
    D1 -->|KILL| X1[Too Far]
    D1 -->|Pass| D2
    D2 -->|KILL| X2[Urban ZIP]
    D2 -->|Pass| D3

    D3 -->|KILL| X3[Low Pop]
    D3 -->|Pass| D4
    D4 -->|KILL| X4[Low Income]
    D4 -->|Pass| D5
    D5 -->|KILL| X5[High Poverty]
    D5 -->|Pass| D6
    D6 -->|KILL| X6[Low Renter]
    D6 -->|Pass| D7

    D7 -->|KILL| X7[Urban County]
    D7 -->|Pass| OUT
```

## Data Source Map

```mermaid
flowchart TB
    subgraph APIs["External APIs"]
        CENSUS[Census ACS API]
        GOOGLE[Google Places API]
        SPAREFOOT[SpareFoot Scrape]
        USGS[USGS Water Bodies]
        FEMA[FEMA Flood API]
    end

    subgraph Internal["Internal/Manual"]
        CSV[uszips.csv<br/>41,551 records]
        MANUAL[Manual Research]
    end

    subgraph Cache["API Cache"]
        AC[(api_cache<br/>30-day TTL)]
    end

    subgraph Tables["Database Tables"]
        ZM[(zips_master)]
        L2[(layer_2_demographics)]
        SF[(storage_facilities)]
        HC[(housing_communities)]
        DA[(demand_anchors)]
        WB[(water_bodies)]
        FZ[(flood_zones)]
        ZC[(zoning_cache)]
    end

    CSV --> ZM

    CENSUS --> AC --> L2
    GOOGLE --> AC --> SF
    GOOGLE --> AC --> HC
    GOOGLE --> AC --> DA
    SPAREFOOT --> AC --> SF
    USGS --> WB
    FEMA --> FZ

    MANUAL --> ZC
```

## Table Counts

| Table | Records | Source |
|-------|---------|--------|
| zips_master | 41,551 | uszips.csv |
| layer_1_geography | ~4,000 | Filtered ZIPs |
| layer_2_demographics | ~4,000 | Census ACS |
| layer_3_counties | 74 | Aggregated |
| storage_facilities | 2,344 | Google Places |
| housing_communities | 6,698 | Google Places |
| demand_anchors | 2,666 | Google Places |
| api_cache | varies | API responses |
