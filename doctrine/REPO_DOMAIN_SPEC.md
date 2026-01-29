# Repository Domain Specification

**Status**: ACTIVE
**Authority**: barton-family-office (CC-01)
**Hub**: barton-storage (CC-02)
**Doctrine Version**: 1.4.0

---

## Domain Binding

| Field | Value |
|-------|-------|
| **Primary Domain** | Real Estate Investment |
| **Sub-Domain** | Self-Storage Facilities |
| **Scope** | Site screening, market analysis, deal feasibility |

---

## Transformation Declaration

### CONST → VAR Statement

> This system transforms **market signals, demographic data, zoning constraints, and site characteristics** (constants) into **investment verdicts, feasibility scores, and deal recommendations** (variables).

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

## Pass Structure

| Pass | Type | IMO Layer | Transformation |
|------|------|-----------|----------------|
| Pass 0 | CAPTURE | I | Signals → Signal Scores |
| Pass 1 | COMPUTE | M | Demographics → Market Structure |
| Pass 1.5 | COMPUTE | M | Raw Rents → Reconciled Rents |
| Pass 2 | COMPUTE | M | Zoning Data → Jurisdiction Scores |
| Pass 3 | COMPUTE | M | Site Data → Feasibility Verdicts |
| Pass 4 | COMPUTE | M | Parcels → Site Viability |
| Pass 5 | GOVERN | O | All Scores → Go/No-Go Decision |

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

- Facility construction management
- Property acquisition execution
- Tenant management systems
- Facility operations software
- Legal document generation

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-01-29 |
| Last Modified | 2026-01-29 |
| Version | 1.0.0 |
| Status | ACTIVE |
