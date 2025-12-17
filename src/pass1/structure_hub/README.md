# Pass-1 Structure Hub

## PRD Reference
- **PRD:** [`docs/prd/PRD_PASS1_STRUCTURE_HUB.md`](../../../docs/prd/PRD_PASS1_STRUCTURE_HUB.md)
- **Doctrine ID:** SS.01.00
- **Hub Name:** PASS1_STRUCTURE_HUB
- **Official Name:** PASS 1 - STRUCTURE HUB (Constants)

## Purpose

The Pass-1 Structure Hub performs market reconnaissance and hotspot identification for self-storage site scouting. It takes a ZIP code input and produces an enriched OpportunityObject containing demand/supply metrics, competitor analysis, and a viability score.

## Boundary

**This hub owns:**
- All reconnaissance and initial screening logic
- ZIP code hydration and demographics
- Radius building and county adjacency
- Macro demand calculation (population x 6 sqft)
- Competitor discovery and registry
- Local amenity scanning
- Hotspot scoring and tier assignment
- Validation gate for Pass-1.5 promotion

**This hub does NOT own:**
- Momentum signal aggregation (Pass-0)
- Rate verification (Pass-1.5)
- Underwriting calculations (Pass-2)
- Feasibility analysis (Pass-2)
- Final GO/NOGO verdicts (Pass-2)
- Pro forma modeling (Pass-3)

## Directory Structure

```
/pass1/structure_hub/
  /orchestrator/
    Pass1Orchestrator.ts    # Main orchestration logic
  /spokes/
    ZipHydration.ts         # SS.01.01 - Census data fetching
    RadiusBuilder.ts        # SS.01.02 - 120-mile radius building
    MacroDemand.ts          # SS.01.03 - Demand calculation
    MacroSupply.ts          # SS.01.04 - Competitor discovery
    CompetitorRegistry.ts   # SS.01.05 - Brand classification
    LocalScan.ts            # SS.01.06 - Amenity scanning
    HotspotScoring.ts       # SS.01.07 - Score calculation
    ValidationGate.ts       # SS.01.08 - Promotion decision
  /edge/
    start_pass1.ts          # Edge function entry point
  /types/
    pass1_types.ts          # Type definitions
```

## Spokes

| Spoke | Doctrine ID | Capability |
|-------|-------------|------------|
| ZipHydration | SS.01.01 | Fetch ZIP metadata from census (city, county, population, income, coordinates) |
| RadiusBuilder | SS.01.02 | Build 120-mile county radius using Haversine distance |
| MacroDemand | SS.01.03 | Calculate population-based demand (pop x 6 sqft), employment growth |
| MacroSupply | SS.01.04 | Fetch competitors via Google Places, calculate supply sqft |
| CompetitorRegistry | SS.01.05 | Build competitor inventory with brand breakdown (national/regional/local) |
| LocalScan | SS.01.06 | Scan for local amenities, traffic, visibility, access scores |
| HotspotScoring | SS.01.07 | Generate composite viability score (0-100) and tier (A/B/C/D) |
| ValidationGate | SS.01.08 | Validate OpportunityObject, decide promotion to Pass-1.5 |

## Input/Output

**Input:**
- ZIP code (5-digit string)
- State (2-letter code)

**Output:**
- OpportunityObject (enriched with all reconnaissance data)
- Hotspot score (0-100)
- Tier (A/B/C/D)
- Promotion decision (PROMOTE/REVIEW/REJECT)

## Scoring Weights

| Factor | Weight |
|--------|--------|
| Demand Score | 40% |
| Supply Gap | 35% |
| Competition Intensity | 25% |

## Import Rules (Non-Negotiable)

- This hub MAY import from `/src/shared/*`
- This hub MUST NOT import from any other `/src/passX/*` directory
- Cross-pass imports are forbidden and considered architecture violations

## Related Documentation

- ADR-001: Census API Integration
- ADR-002: Google Places API
- ADR-003: Scoring Engine
