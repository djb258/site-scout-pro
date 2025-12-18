# Storage Site Scout — Hub-and-Spoke ERD

## Architecture Overview

```
                                    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
                                    │                                         MASTER FAILURE HUB                                                      │
                                    │                                    (Centralized Error Aggregation)                                              │
                                    └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                    │
        ┌───────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┐
        │                                                                           │                                                                           │
        ▼                                                                           ▼                                                                           ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   REF SCHEMA  │     │   PASS 0      │     │   PASS 1      │     │  PASS 1.5     │     │   PASS 2      │     │   PASS 3      │     │  DATA LAYER   │
│   (Static)    │────▶│  RADAR HUB    │────▶│ STRUCTURE HUB │────▶│ RENT RECON    │────▶│ UNDERWRITING  │────▶│  DESIGN HUB   │────▶│    (Vault)    │
│               │     │               │     │               │     │               │     │               │     │               │     │               │
└───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘
```

---

## Column Layout: Tables by Pass

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│   REF SCHEMA    │    PASS 0       │    PASS 1       │   PASS 1.5      │    PASS 2       │    PASS 3       │   DATA LAYER    │
│   (Immutable)   │   (Momentum)    │   (Structure)   │  (Rent Recon)   │ (Underwriting)  │    (Design)     │    (Vault)      │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│                 │                 │                 │                 │                 │                 │                 │
│ ref_country     │ pass0_runs      │ pass1_runs      │ pass15_runs     │ pass2_runs      │ pass3_runs      │ site_candidate  │
│ ├─country_id PK │ ├─run_id PK     │ ├─run_id PK     │ ├─run_id PK     │ ├─run_id PK     │ ├─run_id PK     │ ├─id PK         │
│ └─country_name  │ ├─zip_code      │ ├─zip_code      │ ├─zip_code      │ ├─zip_code      │ ├─zip_code      │ ├─address       │
│                 │ ├─created_at    │ ├─created_at    │ ├─created_at    │ ├─created_at    │ ├─created_at    │ ├─county        │
│ ref_state       │ ├─status        │ ├─status        │ ├─status        │ ├─status        │ ├─status        │ ├─state         │
│ ├─state_id PK   │ └─momentum_data │ ├─macro_demand  │ ├─rate_evidence │ ├─verdict       │ ├─unit_mix      │ ├─zipcode       │
│ ├─country_id FK │                 │ ├─macro_supply  │ ├─coverage_pct  │ ├─deal_index    │ ├─build_cost    │ ├─acreage       │
│ ├─state_code    │ pass0_momentum  │ ├─hotspot_score │ ├─confidence    │ ├─feasibility   │ ├─noi_estimate  │ ├─final_score   │
│ └─state_name    │ ├─id PK         │ ├─competitors[] │ └─promoted      │ ├─zoning_ok     │ ├─irr_estimate  │ ├─status        │
│                 │ ├─zip_code      │ └─validated     │                 │ └─civil_ok      │ ├─max_land_px   │ └─created_at    │
│ ref_county      │ ├─signal_type   │                 │ rate_evidence   │                 │ └─phase_plan    │                 │
│ ├─county_id PK  │ ├─signal_value  │ pass1_census_   │ ├─id PK         │ pass2_verdict   │                 │ vault           │
│ ├─state_id FK   │ ├─source        │ snapshot        │ ├─zip_code      │ ├─id PK         │ pass3_proforma  │ ├─id PK         │
│ ├─county_fips   │ └─detected_at   │ ├─snapshot_id   │ ├─source        │ ├─run_id FK     │ ├─id PK         │ ├─stamped_data  │
│ └─county_name   │                 │ ├─zip_code      │ ├─unit_size     │ ├─verdict       │ ├─run_id FK     │ ├─version       │
│                 │ pass0_signals   │ ├─vintage_year  │ ├─rate_psf      │ ├─score         │ ├─noi           │ └─created_at    │
│ ref_zip         │ ├─id PK         │ ├─population    │ ├─climate_ctrl  │ ├─reasoning     │ ├─irr           │                 │
│ ├─zip_id PK     │ ├─momentum_id   │ ├─median_income │ └─observed_at   │ └─created_at    │ ├─max_land      │ vault_history   │
│ ├─state_id FK   │ ├─spoke         │ ├─median_age    │                 │                 │ ├─debt_service  │ ├─id PK         │
│ ├─lat           │ ├─signal_name   │ ├─housing_units │ rate_benchmarks │ pass2_civil     │ └─created_at    │ ├─vault_id FK   │
│ └─lon           │ └─weight        │ ├─vacancy_rate  │ ├─id PK         │ ├─id PK         │                 │ ├─version       │
│                 │                 │ └─run_id        │ ├─zip_code      │ ├─run_id FK     │ pass3_unit_mix  │ └─snapshot      │
│ ref_zip_county_ │                 │                 │ ├─unit_size     │ ├─flood_zone    │ ├─id PK         │                 │
│ map             │                 │ pass1_skip_log  │ ├─avg_rate      │ ├─slope_pct     │ ├─run_id FK     │ master_failure_ │
│ ├─zip_id PK,FK  │                 │ ├─id PK         │ ├─sample_count  │ ├─wetlands      │ ├─size_code     │ log             │
│ ├─county_id FK  │                 │ ├─zip_code      │ └─updated_at    │ ├─easements     │ ├─quantity      │ ├─id PK         │
│ └─is_primary    │                 │ ├─run_id        │                 │ └─constraints[] │ ├─rate_psf      │ ├─process_id    │
│                 │                 │ └─skip_reason   │                 │                 │ └─revenue       │ ├─pass          │
│ ref_asset_class │                 │                 │                 │ pass2_zoning    │                 │ ├─spoke         │
│ ├─asset_class_  │                 │ competitor_     │                 │ ├─id PK         │ pass3_phases    │ ├─error_code    │
│ │ id PK         │                 │ registry        │                 │ ├─run_id FK     │ ├─id PK         │ ├─severity      │
│ ├─asset_class_  │                 │ ├─id PK         │                 │ ├─zone_code     │ ├─run_id FK     │ ├─message       │
│ │ code          │                 │ ├─zip_code      │                 │ ├─storage_ok    │ ├─phase_num     │ └─created_at    │
│ └─description   │                 │ ├─name          │                 │ ├─setbacks      │ ├─sqft          │                 │
│                 │                 │ ├─address       │                 │ ├─height_limit  │ ├─start_month   │ process_log     │
│ ref_unit_type   │                 │ ├─brand         │                 │ └─conditions[]  │ └─cost          │ ├─id PK         │
│ ├─unit_type_id  │                 │ ├─grade (A/B/C) │                 │                 │                 │ ├─candidate_id  │
│ │ PK            │                 │ ├─sqft          │                 │ pass2_pricing   │                 │ ├─stage         │
│ ├─unit_type_    │                 │ ├─climate_ctrl  │                 │ ├─id PK         │                 │ ├─status        │
│ │ code          │                 │ └─distance_mi   │                 │ ├─run_id FK     │                 │ ├─input_data    │
│ └─climate_      │                 │                 │                 │ ├─verified_rate │                 │ └─output_data   │
│   controlled    │                 │ saturation_     │                 │ ├─confidence    │                 │                 │
│                 │                 │ matrix          │                 │ └─comp_count    │                 │ engine_logs     │
│ ref_unit_size   │                 │ ├─id PK         │                 │                 │                 │ ├─id PK         │
│ ├─unit_size_id  │                 │ ├─zip_code      │                 │ pass2_          │                 │ ├─level         │
│ │ PK            │                 │ ├─demand_sqft   │                 │ feasibility     │                 │ ├─message       │
│ ├─unit_size_    │                 │ ├─supply_sqft   │                 │ ├─id PK         │                 │ └─created_at    │
│ │ code          │                 │ ├─gap_sqft      │                 │ ├─run_id FK     │                 │                 │
│ ├─width_ft      │                 │ └─saturation_%  │                 │ ├─dscr          │                 │                 │
│ ├─depth_ft      │                 │                 │                 │ ├─noi_acre      │                 │                 │
│ └─sqft_computed │                 │                 │                 │ ├─yield_on_cost │                 │                 │
│                 │                 │                 │                 │ └─pass_fail     │                 │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

---

## Hub-and-Spoke Detail View

### Pass 0: Radar Hub (Momentum Detection)
```
                                    ┌─────────────────┐
                                    │   PASS 0 HUB    │
                                    │  (Radar/Recon)  │
                                    └────────┬────────┘
                                             │
           ┌─────────────┬─────────────┬─────┴─────┬─────────────┬─────────────┐
           │             │             │           │             │             │
           ▼             ▼             ▼           ▼             ▼             ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
    │  Housing   │ │ Industrial │ │   Permit   │ │   News     │ │   Trend    │ │  Momentum  │
    │  Pipeline  │ │ Logistics  │ │  Activity  │ │  Events    │ │  Signal    │ │  Fusion    │
    └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘
           │             │             │           │             │             │
           └─────────────┴─────────────┴─────┬─────┴─────────────┴─────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  pass0_runs     │
                                    │  pass0_momentum │
                                    │  pass0_signals  │
                                    └─────────────────┘
```

### Pass 1: Structure Hub (Market Analysis)
```
                                    ┌─────────────────┐
                                    │   PASS 1 HUB    │
                                    │   (Structure)   │
                                    └────────┬────────┘
                                             │
     ┌───────────┬───────────┬───────────┬───┴───┬───────────┬───────────┬───────────┬───────────┐
     │           │           │           │       │           │           │           │           │
     ▼           ▼           ▼           ▼       ▼           ▼           ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│   ZIP   │ │ Radius  │ │  Macro  │ │  Macro  │ │ Hotspot │ │  Local  │ │Competitor│ │Validation│
│Hydration│ │ Builder │ │ Demand  │ │ Supply  │ │ Scoring │ │  Scan   │ │ Registry │ │  Gate   │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
     │           │           │           │       │           │           │           │
     └───────────┴───────────┴───────────┴───┬───┴───────────┴───────────┴───────────┘
                                             │
                                             ▼
                                    ┌─────────────────────────┐
                                    │  pass1_runs             │
                                    │  pass1_census_snapshot  │
                                    │  competitor_registry    │
                                    │  saturation_matrix      │
                                    └─────────────────────────┘
```

### Pass 1.5: Rent Recon Hub (Rate Evidence)
```
                                    ┌─────────────────┐
                                    │  PASS 1.5 HUB   │
                                    │  (Rent Recon)   │
                                    └────────┬────────┘
                                             │
              ┌─────────────────┬────────────┴────────────┬─────────────────┬─────────────────┐
              │                 │                         │                 │                 │
              ▼                 ▼                         ▼                 ▼                 ▼
       ┌────────────┐    ┌────────────┐           ┌────────────┐    ┌────────────┐    ┌────────────┐
       │ Published  │    │    Rate    │           │   AI Call  │    │  Coverage  │    │ Promotion  │
       │   Rate     │    │  Evidence  │           │    Work    │    │ Confidence │    │    Gate    │
       │  Scraper   │    │ Normalizer │           │   Orders   │    │            │    │            │
       └────────────┘    └────────────┘           └────────────┘    └────────────┘    └────────────┘
              │                 │                         │                 │                 │
              └─────────────────┴────────────┬────────────┴─────────────────┴─────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  pass15_runs    │
                                    │  rate_evidence  │
                                    │  rate_benchmarks│
                                    └─────────────────┘
```

### Pass 2: Underwriting Hub (Site Feasibility)
```
                                    ┌─────────────────┐
                                    │   PASS 2 HUB    │
                                    │ (Underwriting)  │
                                    └────────┬────────┘
                                             │
    ┌─────────┬─────────┬─────────┬─────────┬┴────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
    │         │         │         │         │         │         │         │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼         ▼         ▼         ▼         ▼         ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│Zoning │ │ Civil │ │Permits│ │Momentum│ │Fusion │ │Compet.│ │Pricing│ │Feasib.│ │Reverse│ │Verdict│ │ Vault │
│       │ │Constr.│ │Static │ │Reader │ │Demand │ │Pressure│ │Verify │ │       │ │Feasib.│ │       │ │Mapper │
└───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘
    │         │         │         │         │         │         │         │         │         │         │
    └─────────┴─────────┴─────────┴─────────┴────┬────┴─────────┴─────────┴─────────┴─────────┴─────────┘
                                                 │
                                                 ▼
                                    ┌──────────────────────┐
                                    │  pass2_runs          │
                                    │  pass2_verdict       │
                                    │  pass2_civil         │
                                    │  pass2_zoning        │
                                    │  pass2_pricing       │
                                    │  pass2_feasibility   │
                                    └──────────────────────┘
```

### Pass 3: Design Hub (Pro Forma Modeling)
```
                                    ┌─────────────────┐
                                    │   PASS 3 HUB    │
                                    │    (Design)     │
                                    └────────┬────────┘
                                             │
        ┌─────────────┬─────────────┬────────┴────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
        │             │             │                 │             │             │             │             │             │             │
        ▼             ▼             ▼                 ▼             ▼             ▼             ▼             ▼             ▼             ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐     ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Setback  │  │  Unit    │  │ Coverage │     │  Build   │  │   NOI    │  │   Debt   │  │   IRR    │  │ Max Land │  │  Phase   │
  │  Engine  │  │   Mix    │  │  Engine  │     │   Cost   │  │  Engine  │  │  Model   │  │  Model   │  │  Price   │  │ Planner  │
  │          │  │Optimizer │  │          │     │  Model   │  │          │  │          │  │          │  │          │  │          │
  └──────────┘  └──────────┘  └──────────┘     └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
        │             │             │                 │             │             │             │             │             │
        └─────────────┴─────────────┴────────┬────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  pass3_runs     │
                                    │  pass3_proforma │
                                    │  pass3_unit_mix │
                                    │  pass3_phases   │
                                    └─────────────────┘
```

---

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           ENTITY RELATIONSHIP DIAGRAM                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

                                              REF SCHEMA (Static)
                                    ┌─────────────────────────────────────┐
                                    │                                     │
                                    │  ┌───────────┐                      │
                                    │  │ref_country│                      │
                                    │  │ PK: id    │                      │
                                    │  └─────┬─────┘                      │
                                    │        │ 1                          │
                                    │        │                            │
                                    │        │ *                          │
                                    │  ┌─────┴─────┐                      │
                                    │  │ ref_state │                      │
                                    │  │ PK: id    │                      │
                                    │  │ FK: cntry │                      │
                                    │  └─────┬─────┘                      │
                                    │        │ 1                          │
                                    │    ┌───┴───┐                        │
                                    │    │       │                        │
                                    │    │ *     │ *                      │
                                    │  ┌─┴───┐ ┌─┴───┐                    │
                                    │  │county│ │ zip │                   │
                                    │  │PK:id │ │PK:id│                   │
                                    │  │FK:st │ │FK:st│                   │
                                    │  └──┬───┘ └──┬──┘                   │
                                    │     │        │                      │
                                    │     │ 1    * │                      │
                                    │     │  ┌─────┘                      │
                                    │     │  │                            │
                                    │   ┌─┴──┴──┐                         │
                                    │   │zip_cty│                         │
                                    │   │  map  │                         │
                                    │   └───────┘                         │
                                    └─────────────────────────────────────┘
                                                    │
                                                    │ LOOKUP
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                              PASS FLOW (Left to Right)                                               │
│                                                                                                                      │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐          │
│   │  pass0_runs  │      │  pass1_runs  │      │ pass15_runs  │      │  pass2_runs  │      │  pass3_runs  │          │
│   │  PK: run_id  │─────▶│  PK: run_id  │─────▶│  PK: run_id  │─────▶│  PK: run_id  │─────▶│  PK: run_id  │          │
│   │  zip_code    │      │  zip_code    │      │  zip_code    │      │  zip_code    │      │  zip_code    │          │
│   └──────┬───────┘      └──────┬───────┘      └──────┬───────┘      └──────┬───────┘      └──────┬───────┘          │
│          │                     │                     │                     │                     │                   │
│          │ 1                   │ 1                   │ 1                   │ 1                   │ 1                 │
│          │                     │                     │                     │                     │                   │
│          │ *                   │ *                   │ *                   │ *                   │ *                 │
│   ┌──────┴───────┐      ┌──────┴───────┐      ┌──────┴───────┐      ┌──────┴───────┐      ┌──────┴───────┐          │
│   │pass0_momentum│      │pass1_census_ │      │rate_evidence │      │pass2_verdict │      │pass3_proforma│          │
│   │pass0_signals │      │  snapshot    │      │rate_benchmark│      │pass2_civil   │      │pass3_unit_mix│          │
│   └──────────────┘      │competitor_   │      └──────────────┘      │pass2_zoning  │      │pass3_phases  │          │
│                         │  registry    │                            │pass2_pricing │      └──────────────┘          │
│                         │saturation_   │                            │pass2_feasib  │                                 │
│                         │  matrix      │                            └──────────────┘                                 │
│                         └──────────────┘                                                                             │
│                                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    │ PROMOTE
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                              DATA LAYER (Vault)                                                      │
│                                                                                                                      │
│   ┌────────────────┐      ┌────────────────┐      ┌────────────────┐      ┌────────────────┐                        │
│   │ site_candidate │      │     vault      │      │  vault_history │      │master_failure_ │                        │
│   │    PK: id      │─────▶│    PK: id      │─────▶│    PK: id      │      │      log       │                        │
│   │   address      │      │  stamped_data  │      │   vault_id FK  │      │    PK: id      │                        │
│   │   final_score  │      │    version     │      │    version     │      │  pass, spoke   │                        │
│   └────────────────┘      └────────────────┘      └────────────────┘      │  error_code    │                        │
│                                                                            └────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Table Schema Summary

### REF Schema (Neon - Static, Geography Only)

| Table | PK | Key Columns | Records |
|-------|----|----|---------|
| ref_country | country_id | country_name | 1 |
| ref_state | state_id | country_id FK, state_code, state_name | 51 |
| ref_county | county_id | state_id FK, county_fips, county_name | 3,132 |
| ref_zip | zip_id | state_id FK, lat, lon | 40,745 |
| ref_zip_county_map | (zip_id, county_id) | is_primary | 40,728 |
| ref_asset_class | asset_class_id | asset_class_code, description | 4 |
| ref_unit_type | unit_type_id | unit_type_code, climate_controlled | 5 |
| ref_unit_size | unit_size_id | width_ft, depth_ft, sqft_computed | 9 |

### Pass Tables (Supabase)

| Pass | Run Table | Detail Tables |
|------|-----------|---------------|
| Pass 0 | pass0_runs | pass0_momentum, pass0_signals |
| Pass 1 | pass1_runs | pass1_census_snapshot, competitor_registry, saturation_matrix |
| Pass 1.5 | pass15_runs | rate_evidence, rate_benchmarks |
| Pass 2 | pass2_runs | pass2_verdict, pass2_civil, pass2_zoning, pass2_pricing, pass2_feasibility |
| Pass 3 | pass3_runs | pass3_proforma, pass3_unit_mix, pass3_phases |

### Data Layer (Neon - Vault)

| Table | Purpose |
|-------|---------|
| site_candidate | Main opportunity tracking |
| vault | STAMPED final records |
| vault_history | Version history |
| master_failure_log | Centralized error aggregation |
| process_log | Audit trail |

---

## Data Flow Summary

```
ZIP Code Input
      │
      ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PASS 0    │────▶│   PASS 1    │────▶│  PASS 1.5   │────▶│   PASS 2    │────▶│   PASS 3    │
│  Momentum   │     │  Structure  │     │  Rent Recon │     │ Underwrite  │     │   Design    │
│             │     │             │     │             │     │             │     │             │
│ Verdict:    │     │ Verdict:    │     │ Verdict:    │     │ Verdict:    │     │ Verdict:    │
│ PROMOTE/    │     │ PROMOTE/    │     │ PROMOTE/    │     │ GO/HOLD/    │     │ READY/      │
│ SKIP        │     │ HOLD/KILL   │     │ HOLD/KILL   │     │ NO-GO       │     │ REFINE      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │                   │
      │                   │                   │                   │                   │
      └───────────────────┴───────────────────┴───────────────────┴───────────────────┘
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │      VAULT      │
                                    │ (Final Record)  │
                                    └─────────────────┘
```

---

## Version

- **Document:** ERD_HUB_SPOKE.md
- **Version:** 1.0.0
- **Date:** 2025-12-18
- **Author:** Barton Enterprises Engineering
