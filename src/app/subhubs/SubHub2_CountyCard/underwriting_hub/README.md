# Pass-2 Underwriting Hub

## PRD Reference
- **PRD:** [`docs/prd/PRD_PASS2_UNDERWRITING_HUB.md`](../../../docs/prd/PRD_PASS2_UNDERWRITING_HUB.md)
- **Doctrine ID:** SS.02.00
- **Hub Name:** PASS2_UNDERWRITING_HUB
- **Official Name:** PASS 2 - UNDERWRITING HUB

## Purpose

The Pass-2 Underwriting Hub performs site-specific underwriting and feasibility analysis. It receives validated rate evidence from Pass-1.5 and produces a comprehensive underwriting package with financial feasibility metrics and the final GO/NO_GO/MAYBE verdict.

## Boundary

**This hub owns:**
- All underwriting, feasibility calculations, and verdict decisions
- Zoning verification (by-right, conditional, prohibited)
- Civil constraints checking (flood, slope, soil, utilities)
- Permit environment research
- Pricing verification from Pass-1.5 data
- Demand fusion scoring
- Competitive pressure analysis
- NOI calculation and Barton Doctrine validation
- Reverse feasibility (max land price)
- Final verdict generation
- Vault persistence

**This hub does NOT own:**
- Market reconnaissance (Pass-1)
- Rate verification (Pass-1.5)
- Detailed pro forma modeling (Pass-3)
- Construction cost estimation (Pass-3)
- IRR calculations (Pass-3)

## Directory Structure

```
/pass2/underwriting_hub/
  /orchestrator/
    Pass2Orchestrator.ts      # Main orchestration logic
  /spokes/
    Zoning.ts                 # SS.02.01 - Zoning verification
    CivilConstraints.ts       # SS.02.02 - Flood, slope, soil
    PermitsStatic.ts          # SS.02.03 - Permit history
    PricingVerification.ts    # SS.02.04 - Rate verification
    FusionDemand.ts           # SS.02.05 - Demand fusion
    CompetitivePressure.ts    # SS.02.06 - Competition analysis
    Feasibility.ts            # SS.02.07 - NOI calculation
    ReverseFeasibility.ts     # SS.02.08 - Max land price
    MomentumReader.ts         # SS.02.09 - Pass-0 integration
    Verdict.ts                # SS.02.10 - Final verdict
    VaultMapper.ts            # SS.02.11 - Vault persistence
  /edge/
    start_pass2.ts            # Edge function entry point
    save_to_vault.ts          # Vault save edge function
  /types/
    pass2_types.ts            # Type definitions
```

## Spokes

| Spoke | Doctrine ID | Capability |
|-------|-------------|------------|
| Zoning | SS.02.01 | Fetch zoning code, check storage permitted, setbacks, height limits |
| CivilConstraints | SS.02.02 | Flood zone, wetlands, slope, soil type, utilities availability |
| PermitsStatic | SS.02.03 | Recent permit history, avg permit time, jurisdiction difficulty |
| PricingVerification | SS.02.04 | Verify rates from Pass-1.5, calculate market averages |
| FusionDemand | SS.02.05 | Fuse demand signals, population density, household growth |
| CompetitivePressure | SS.02.06 | Pressure score, nearest competitor, saturation level |
| Feasibility | SS.02.07 | Units, sqft, revenue, NOI, cap rate, DSCR |
| ReverseFeasibility | SS.02.08 | Max land price, break-even occupancy, sensitivity |
| MomentumReader | SS.02.09 | Read Pass-0 momentum score, trend direction |
| Verdict | SS.02.10 | Generate GO/NO_GO/MAYBE, fatal flaws, strengths/weaknesses |
| VaultMapper | SS.02.11 | Map results to Neon vault schema, stamp fields |

## Input/Output

**Input:**
- OpportunityObject from Pass-1
- RateEvidencePackage from Pass-1.5

**Output:**
- UnderwritingPackage
- GO/NO_GO/MAYBE verdict
- Deal Index (0-100)
- STAMPED vault record

## Verdict Scoring Weights

| Factor | Weight |
|--------|--------|
| Feasibility Score | 30% |
| Fusion Demand Score | 25% |
| Competitive Pressure | 20% |
| Zoning Score | 15% |
| Momentum Score | 10% |

## Barton Doctrine Thresholds

| Metric | Minimum | Fatal Flaw |
|--------|---------|------------|
| NOI/Acre/Month | $5,000 | `NOI_BELOW_DOCTRINE` |
| Stressed NOI | $3,750 | `STRESSED_NOI_FAILURE` |
| DSCR | 1.25x | Warning (not fatal) |

## Fatal Flaws (Auto-WALK)

- `ZONING_PROHIBITED`: Storage not permitted in zoning district
- `FLOOD_ZONE_HIGH_RISK`: Site in FEMA Zone A or V
- `PROHIBITIVE_TOPOGRAPHY`: Slope exceeds 15%
- `NEGATIVE_NOI`: NOI calculation is negative
- `NOI_BELOW_DOCTRINE`: NOI < $5,000/acre/month

## Import Rules (Non-Negotiable)

- This hub MAY import from `/src/shared/*`
- This hub MUST NOT import from any other `/src/passX/*` directory
- Cross-pass imports are forbidden and considered architecture violations

## Related Documentation

- ADR-006: Feasibility Engine
- ADR-007: Verdict Engine
- ADR-011: Neon Vault Integration
