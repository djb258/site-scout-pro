# PROCESS: Pass 2 — Underwriting

## Conformance

| Field | Value |
|-------|-------|
| Doctrine Version | 2.0.0 |
| CTB Version | 2.0.0 |
| CC Layer | CC-04 |
| Governing Hub | barton-storage (CC-02) |
| Governing Context | pass2-underwriting (CC-03) |

## Identity

| Field | Value |
|-------|-------|
| Process ID | PROC-PASS2-UNDERWRITING |
| Pass | Pass 2 |
| Purpose | Perform site-specific underwriting and feasibility analysis with GO/NO_GO/MAYBE verdict |
| Governing PRD | docs/prd/PRD_PASS2_UNDERWRITING_HUB.md |
| Governing ERD | docs/erd/ERD_SubHub2_CountyCard.md |
| Governing OSAM | docs/semantic/OSAM_BARTON_STORAGE.md |

---

## Transformation Summary

> This process executes the transformation of **validated OpportunityObject + rate evidence** into **underwriting verdict (GO/NO_GO/MAYBE) and STAMPED vault record**.

---

## Constants (Inputs)

| # | Constant | Source | Type |
|---|----------|--------|------|
| 1 | OpportunityObject | Pass 1 output (pass1_results) | object |
| 2 | Rate evidence package | Pass 1.5 output (facility_unit_pricing) | object |
| 3 | Parcel/zoning data | Regrid API | JSON |
| 4 | Flood zone data | FEMA Flood API | JSON |
| 5 | Elevation data | USGS DEM API | JSON |
| 6 | County zoning rules | county_card_master (Supabase) | object |
| 7 | Jurisdiction permit data | County permit systems | JSON |

## Variables (Outputs)

| # | Variable | Destination | Type |
|---|----------|-------------|------|
| 1 | Zoning classification | pass2_results (Supabase) | enum (by_right/conditional/prohibited) |
| 2 | Storage permission status | pass2_results (Supabase) | enum |
| 3 | Flood zone classification | pass2_results (Supabase) | string |
| 4 | County card (canonical) | county_card_master (Supabase) | object |
| 5 | Permitting difficulty score | county_score (Neon) | number (0-100) |
| 6 | Parcel viability score | parcel_screening (Neon) | number (0-100) |
| 7 | Underwriting verdict | pass2_results (Supabase) | enum (GO/NO_GO/MAYBE) |
| 8 | STAMPED vault record | site_candidate (Neon) | object |

---

## Pass Sequence

### CAPTURE (Ingress)

Receive constants from external sources:
1. Load OpportunityObject and rate evidence from Pass 1 / Pass 1.5
2. Query Regrid API for parcel geometry, zoning code, ownership
3. Query FEMA Flood API for flood zone classification
4. Query USGS DEM API for elevation and slope data
5. Load county card rules from `county_card_master`
6. Query jurisdiction permit systems for permit history

### COMPUTE (Middle)

Transform constants into variables:
1. **Zoning Classification**: Classify storage permission (by_right, conditional, prohibited)
2. **Flood Assessment**: Evaluate flood zone risk (Zone A = prohibited, Zone X = clear)
3. **County Card Compilation**: Assemble canonical zoning rules per county
4. **Permitting Scoring**: Score county permitting difficulty (0-100)
5. **Parcel Viability**: Score parcel on shape, slope, access, flood (50 pts each)
6. **Saturation Analysis**: Compute sqft per person against threshold (6.0)
7. **Financial Feasibility**: Calculate preliminary DSCR, cap rate
8. **Verdict Determination**: Apply elimination gates, compute final score, issue GO/NO_GO/MAYBE

### GOVERN (Egress)

Emit governed variables:
1. Validate against hard elimination gates (min_population: 5,000, min_final_score: 60)
2. Verify zoning is not prohibited
3. Verify flood zone is not Zone A
4. Write county card to `county_card_master`
5. Write scores to `county_score`, `parcel_screening` (Neon vault)
6. Write verdict to `pass2_results`
7. STAMP approved candidates to `site_candidate` (Neon vault)
8. Log process execution to `process_log`

---

## Tool Binding (Optional)

| Tool | ADR | Pass Implemented |
|------|-----|-----------------|
| Regrid API | ADR-004 | CAPTURE |
| FEMA Flood API | ADR-014 | CAPTURE |
| USGS DEM API | ADR-015 | CAPTURE |
| Census API | ADR-001 | CAPTURE |
| Scoring Engine | ADR-003 | COMPUTE |
| Verdict Engine | ADR-007 | COMPUTE |
| Neon Database | ADR-016 | GOVERN |
| Supabase | ADR-017 | GOVERN |

---

## OSAM Alignment

| Check | Status |
|-------|--------|
| All tables in this process declared in OSAM | [ ] |
| No undeclared joins | [ ] |
| Join key is sovereign_id | [ ] |

---

## Process Validity

**VALID** — This process can be summarized as: "This process executes the transformation of validated OpportunityObject and rate evidence into underwriting verdict (GO/NO_GO/MAYBE) and STAMPED vault record."

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-02-13 |
| Last Modified | 2026-02-13 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authority | barton-family-office (CC-01) |
