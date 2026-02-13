# PROCESS: Pass 1 — Market Structure

## Conformance

| Field | Value |
|-------|-------|
| Doctrine Version | 2.0.0 |
| CTB Version | 2.0.0 |
| CC Layer | CC-04 |
| Governing Hub | barton-storage (CC-02) |
| Governing Context | pass1-market (CC-03) |

## Identity

| Field | Value |
|-------|-------|
| Process ID | PROC-PASS1-MARKET |
| Pass | Pass 1 |
| Purpose | Perform market reconnaissance and hotspot identification for self-storage site scouting |
| Governing PRD | docs/prd/PRD_PASS1_STRUCTURE_HUB.md |
| Governing ERD | docs/erd/ERD_SubHub1_Market.md |
| Governing OSAM | docs/semantic/OSAM_BARTON_STORAGE.md |

---

## Transformation Summary

> This process executes the transformation of **ZIP code + State** into **an enriched OpportunityObject containing demand/supply metrics, competitor analysis, and viability score**.

---

## Constants (Inputs)

| # | Constant | Source | Type |
|---|----------|--------|------|
| 1 | ZIP code | User input / Pass 0 output | string (5-digit) |
| 2 | State | User input / Pass 0 output | string (2-letter) |
| 3 | Census ACS 5-year data | Census Bureau API | JSON |
| 4 | Google Places facility data | Google Places API | JSON |
| 5 | U-Haul migration data | U-Haul API | JSON |
| 6 | OpenStreetMap facility data | OSM/Overpass API | JSON |

## Variables (Outputs)

| # | Variable | Destination | Type |
|---|----------|-------------|------|
| 1 | Population metrics | pass1_census_snapshot (Supabase) | object |
| 2 | Median household income | pass1_census_snapshot (Supabase) | number |
| 3 | Competitor facility list | competitor_facilities (Supabase) | object[] |
| 4 | Supply sqft per capita | pass1_supply_snapshot (Supabase) | number |
| 5 | Demand score | pass1_results (Supabase) | number (0-100) |
| 6 | Migration propensity index | pass1_results (Supabase) | number |
| 7 | OpportunityObject | pass1_results (Supabase) | object |
| 8 | Viability score | pass1_results (Supabase) | number (0-100) |

---

## Pass Sequence

### CAPTURE (Ingress)

Receive constants from external sources:
1. Call Census ACS 5-Year API for population (B01003), income (B19013), poverty (B17001), tenure (B25003)
2. Geocode ZIP centroid via Census Geocoder
3. Query Google Places API for "self storage" facilities within radius
4. Query OSM/Overpass for additional facility data
5. Fetch U-Haul migration propensity data

### COMPUTE (Middle)

Transform constants into variables:
1. **ZipHydration**: Enrich ZIP with demographics, coordinates, FIPS code
2. **CensusSnapshot**: Calculate population density, growth rates, income brackets
3. **SupplyEnumeration**: Deduplicate facilities, calculate total sqft, sqft per capita
4. **DemandCalculation**: Score demand based on population, income, migration, housing
5. **ViabilityScoring**: Composite score from supply/demand balance, market saturation
6. **OpportunityObject Assembly**: Merge all spoke outputs into unified object

### GOVERN (Egress)

Emit governed variables:
1. Validate population meets minimum threshold (5,000)
2. Verify all competitor facilities have geocoded coordinates
3. Check sqft per capita against saturation threshold (6.0)
4. Write snapshots to `pass1_census_snapshot`, `pass1_supply_snapshot`
5. Write assembled OpportunityObject to `pass1_results`
6. Log process execution to `process_log`

---

## Tool Binding (Optional)

| Tool | ADR | Pass Implemented |
|------|-----|-----------------|
| Census API | ADR-001 | CAPTURE |
| Google Places API | ADR-002 | CAPTURE |
| Scoring Engine | ADR-003 | COMPUTE |
| Supabase | ADR-017 | GOVERN |
| Neon Database | ADR-016 | GOVERN |

---

## OSAM Alignment

| Check | Status |
|-------|--------|
| All tables in this process declared in OSAM | [ ] |
| No undeclared joins | [ ] |
| Join key is sovereign_id | [ ] |

---

## Process Validity

**VALID** — This process can be summarized as: "This process executes the transformation of ZIP code + State into an enriched OpportunityObject containing demand/supply metrics, competitor analysis, and viability score."

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-02-13 |
| Last Modified | 2026-02-13 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authority | barton-family-office (CC-01) |
