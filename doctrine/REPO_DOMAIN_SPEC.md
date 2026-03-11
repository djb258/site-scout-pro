# Repository Domain Specification

**Repository**: barton-storage (site-scout-pro)
**Domain**: self-storage investment analysis
**Parent**: IMO-Creator
**Status**: ACTIVE
**Authority**: barton-family-office (CC-01)
**Hub**: barton-storage (CC-02)
**Doctrine Version**: 2.0.0

---

## CRITICAL: What This File MUST NOT Contain

- NO SQL statements
- NO code snippets or functions
- NO workflow logic or decision trees
- NO scoring formulas or calculations
- NO implementation details
- NO prose descriptions of "how it works"

This file contains BINDINGS ONLY -- mapping generic roles to domain-specific names.

---

## Domain Identity

| Field | Value |
|-------|-------|
| Domain Name | self-storage |
| Sovereign Reference | barton-family-office (CC-01) |
| Hub ID | barton-storage (CC-02) |

---

## Hub and Sub-Hub Structure

| Hub/Sub-Hub | ID | Purpose (10 words max) |
|-------------|----|-----------------------|
| Barton Storage System | barton-storage | Self-storage investment analysis and deal screening |
| Pass 0 Signal Radar | pass0-signals | ZIP-level signal detection and scoring |
| Pass 1 Market Structure | pass1-market | Market demographics, supply, and demand analysis |
| Pass 1.5 Rent Reconciliation | pass15-rent-recon | Competitor rate validation and gap resolution |
| Pass 2 Underwriting | pass2-county-card | Jurisdiction rules and zoning validation |
| Pass 3 Design & Feasibility | pass3-calculators | Financial modeling and unit optimization |
| Pass 4 Parcel | pass4-parcel | Site-specific parcel evaluation |
| Pass 5 Deal Gate | pass5-deal-gate | Final go/no-go investment decision |

---

## Transformation Declaration (CONST -> VAR)

> This system transforms **market signals, demographic data, zoning constraints, and site characteristics** (constants) into **investment verdicts, feasibility scores, and deal recommendations** (variables).

---

## Fact Schema Bindings

| Generic Role | Domain Table | Owner Schema | Description (10 words max) |
|--------------|--------------|--------------|---------------------------|
| FACT_TABLE | zip_scores | public | ZIP-level signal and market scores |

---

## Intent Layer Bindings

| Generic Role | Domain Column/Table | Data Type | Description (10 words max) |
|--------------|---------------------|-----------|---------------------------|
| LIFECYCLE_STATE | pass_status | enum | Pass pipeline progression state |

---

## Constants (Inputs)

| Constant | Source | Domain |
|----------|--------|--------|
| Market signals | Google Trends, permits, news | Market Intelligence |
| Demographics | Census API | Population Data |
| Zoning data | Regrid API | Land Use |
| Flood zones | FEMA API | Risk Assessment |
| Elevation data | USGS DEM API | Site Characteristics |
| Competitor rents | Firecrawl, manual entry | Market Pricing |
| Parcel geometry | County GIS | Site Characteristics |

---

## Variables (Outputs)

| Variable | Destination | Domain |
|----------|-------------|--------|
| ZIP signal scores | Pass 0 output | Market Screening |
| Market saturation metrics | Pass 1 output | Supply/Demand |
| Reconciled rent data | Pass 1.5 output | Pricing Analysis |
| Jurisdiction difficulty scores | Pass 2 output | Regulatory Risk |
| Feasibility verdicts | Pass 3 output | Investment Decision |
| Go/No-Go recommendations | Pass 5 output | Deal Gate |

---

## External Boundaries

| External System | Direction | Data Exchanged | Boundary Type |
|-----------------|-----------|----------------|---------------|
| Census API | INGRESS | Demographics data | API |
| Google Places API | INGRESS | Location/competitor data | API |
| Regrid API | INGRESS | Zoning/parcel data | API |
| FEMA Flood API | INGRESS | Flood zone data | API |
| USGS DEM API | INGRESS | Elevation data | API |
| Google Trends API | INGRESS | Market signal data | API |
| Firecrawl | INGRESS | Web-scraped competitor data | API |
| Retell AI | EGRESS | Voice call interactions | API |
| CF D1/KV | INGRESS/EGRESS | Working database + state | DB |
| Neon Database | INGRESS/EGRESS | PostgreSQL vault/archive | DB |
| CF R2 | EGRESS | File/object storage | Storage |
| Obsidian Vault | EGRESS | Deal reports | File |

---

## Data Classes Owned

| Data Class | Tables | Owner Hub | Mutability |
|------------|--------|-----------|------------|
| Signal Scores | zip_scores, signal_events | pass0-signals | VAR |
| Market Data | market_structure, supply_data | pass1-market | VAR |
| Rent Data | competitor_rates, rent_gaps | pass15-rent-recon | VAR |
| Jurisdiction Data | county_cards, zoning_rules | pass2-county-card | VAR |
| Feasibility Data | feasibility_runs, unit_mixes | pass3-calculators | VAR |

---

## Approved Tools (Snap-On IDs)

| Tool ID | Purpose | Usage Layer |
|---------|---------|-------------|
| ADR-001 | Census demographics | MIDDLE |
| ADR-002 | Google Places location data | MIDDLE |
| ADR-003 | Pass scoring engine | MIDDLE |
| ADR-004 | Regrid zoning data | MIDDLE |
| ADR-005 | Retell AI voice calls | MIDDLE |
| ADR-006 | Feasibility engine | MIDDLE |
| ADR-007 | Verdict engine | MIDDLE |
| ADR-008 | Google Trends signals | MIDDLE |
| ADR-009 | Firecrawl web scraping | MIDDLE |
| ADR-010 | Unit mix optimizer | MIDDLE |
| ADR-011 | Build cost calculator | MIDDLE |
| ADR-012 | IRR calculator | MIDDLE |
| ADR-014 | FEMA flood zone | MIDDLE |
| ADR-015 | USGS DEM elevation | MIDDLE |
| ADR-016 | Neon vault/archive | MIDDLE |
| ADR-017 | CF D1/KV working database | MIDDLE |
| ADR-018 | CF R2 file storage | MIDDLE |

**Reference**: templates/SNAP_ON_TOOLBOX.yaml

---

## Pass Structure

| Pass | Type | IMO Layer | Transformation |
|------|------|-----------|----------------|
| Pass 0 | CAPTURE | I | Signals -> Signal Scores |
| Pass 1 | COMPUTE | M | Demographics -> Market Structure |
| Pass 1.5 | COMPUTE | M | Raw Rents -> Reconciled Rents |
| Pass 2 | COMPUTE | M | Zoning Data -> Jurisdiction Scores |
| Pass 3 | COMPUTE | M | Site Data -> Feasibility Verdicts |
| Pass 4 | COMPUTE | M | Parcels -> Site Viability |
| Pass 5 | GOVERN | O | All Scores -> Go/No-Go Decision |

---

## Domain Boundaries

### In Scope

- Self-storage facility site screening
- Market saturation analysis
- Rent rate reconciliation
- Zoning and permit feasibility
- Financial pro forma modeling
- Investment verdict generation

### Out of Scope

| Excluded Scope | Reason |
|----------------|--------|
| Property management | Post-acquisition operations are out of scope |
| Tenant management | This is analysis only, not operations |
| Construction management | Physical build is downstream of deal gate |
| Legal document generation | Legal is separate system |

---

## Domain Lifecycle States

| State | Maps To Canonical | Description |
|-------|-------------------|-------------|
| Signal Detected | DRAFT | ZIP identified via Pass 0 radar |
| Under Analysis | ACTIVE | Passes 1-3 in progress |
| Deal Gate | ACTIVE | Pass 4-5 go/no-go evaluation |
| Approved | ACTIVE | Deal approved for execution |
| Rejected | TERMINATED | Deal rejected at any pass |
| On Hold | SUSPENDED | Analysis paused pending data |

**Validation**: All states MUST map to canonical states.

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-01-29 |
| Last Modified | 2026-02-12 |
| Version | 2.0.0 |
| Status | ACTIVE |
| Parent Doctrine | IMO-Creator v2.0.0 |
