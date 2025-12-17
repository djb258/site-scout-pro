# Pass-3 Design/Calculator Hub

## PRD Reference
- **PRD:** [`docs/prd/PRD_PASS3_DESIGN_HUB.md`](../../../docs/prd/PRD_PASS3_DESIGN_HUB.md)
- **Doctrine ID:** SS.03.00
- **Hub Name:** PASS3_DESIGN_HUB
- **Official Name:** PASS 3 - DESIGN/CALCULATOR HUB

## Purpose

The Pass-3 Design/Calculator Hub performs detailed pro forma modeling and financial analysis for sites that receive a GO or MAYBE verdict from Pass-2. It produces comprehensive financial projections, construction cost estimates, and investment return calculations.

## Boundary

**This hub owns:**
- All detailed financial modeling
- Setback and buildable area calculation
- Coverage and lot efficiency
- Unit mix optimization
- Phase planning (multi-phase development)
- Construction cost estimation
- NOI engine and income projections
- Debt modeling
- Maximum land price calculation
- IRR and investment return analysis

**This hub does NOT own:**
- Market reconnaissance (Pass-1)
- Rate verification (Pass-1.5)
- Site screening and verdicts (Pass-2)
- Data persistence decisions (Data Layer Hub)

## Directory Structure

```
/pass3/design_hub/
  /orchestrator/
    Pass3Orchestrator.ts      # Main orchestration logic
  /spokes/
    SetbackEngine.ts          # SS.03.01 - Buildable area calculation
    CoverageEngine.ts         # SS.03.02 - Lot coverage analysis
    UnitMixOptimizer.ts       # SS.03.03 - Revenue-optimized unit mix
    PhasePlanner.ts           # SS.03.04 - Multi-phase development
    BuildCostModel.ts         # SS.03.05 - Construction cost estimation
    NOIEngine.ts              # SS.03.06 - Income/expense projections
    DebtModel.ts              # SS.03.07 - Financing calculations
    MaxLandPrice.ts           # SS.03.08 - Maximum land acquisition price
    IRRModel.ts               # SS.03.09 - Investment return analysis
  /edge/
    start_pass3.ts            # Edge function entry point
  /types/
    pass3_types.ts            # Type definitions
```

## Spokes

| Spoke | Doctrine ID | Capability |
|-------|-------------|------------|
| SetbackEngine | SS.03.01 | Calculate buildable area after setbacks |
| CoverageEngine | SS.03.02 | Determine max buildable sqft based on lot coverage, height |
| UnitMixOptimizer | SS.03.03 | Optimize unit mix to maximize revenue per sqft |
| PhasePlanner | SS.03.04 | Plan construction phases with 85% occupancy triggers |
| BuildCostModel | SS.03.05 | Calculate construction costs, enforce $27/sqft max |
| NOIEngine | SS.03.06 | Calculate GPR, EGI, OpEx, NOI with 5-year projections |
| DebtModel | SS.03.07 | Model debt service, DSCR, LTV constraints |
| MaxLandPrice | SS.03.08 | Calculate maximum supportable land acquisition price |
| IRRModel | SS.03.09 | Calculate levered and unlevered IRR |

## Input/Output

**Input:**
- UnderwritingPackage from Pass-2 (GO or MAYBE verdict)
- OpportunityObject from Pass-1
- RateEvidencePackage from Pass-1.5

**Output:**
- ProFormaPackage with complete financial projections
- Unit mix recommendation
- Phase plan
- Build cost breakdown
- 5-year NOI projections
- IRR analysis

## Barton Doctrine Build Cost Rules

| Metric | Maximum | Fatal Flaw |
|--------|---------|------------|
| Build Cost/sqft | $27 | `BUILD_COST_EXCEEDS_MAXIMUM` |
| Dirt Work % | 20% | `EXCESSIVE_DIRT_WORK` |

## Construction Types

| Type | Efficiency | Stories | Site Requirements |
|------|------------|---------|-------------------|
| Drive-up Only | 60% | 1 | Any |
| Single Story | 75% | 1 | >= 1.5 acres, <= 10% slope |
| Multi-story | 70% per floor | 2-3 | >= 3 acres, <= 5% slope |

## Import Rules (Non-Negotiable)

- This hub MAY import from `/src/shared/*`
- This hub MUST NOT import from any other `/src/passX/*` directory
- Cross-pass imports are forbidden and considered architecture violations

## Related Documentation

- ADR-012: Build Cost Model
- ADR-014: IRR Calculation
