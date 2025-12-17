# Pass-0 Radar Hub

## PRD Reference
- **PRD:** [`docs/prd/PRD_PASS0_RADAR_HUB.md`](../../../docs/prd/PRD_PASS0_RADAR_HUB.md)
- **Doctrine ID:** SS.00.00
- **Hub Name:** PASS0_RADAR_HUB
- **Official Name:** PASS 0 - RADAR HUB (Variables)

## Purpose

The Pass-0 Radar Hub aggregates momentum signals and market variables before site-specific analysis begins. It scans for leading indicators of storage demand including permit activity, news events, industrial logistics trends, and housing pipeline data.

## Boundary

**This hub owns:**
- Macro-level momentum and trend detection
- Google Trends search interest tracking
- Permit activity monitoring
- News sentiment analysis
- Industrial logistics trends
- Housing pipeline tracking
- Momentum fusion scoring

**This hub does NOT own:**
- Site-specific analysis (Pass-1)
- Competitor research (Pass-1)
- Rate verification (Pass-1.5)
- Underwriting (Pass-2)
- Pro forma modeling (Pass-3)

## Directory Structure

```
/pass0/radar_hub/
  /orchestrator/
    Pass0Orchestrator.ts    # Main orchestration logic
  /spokes/
    TrendSignal.ts          # SS.00.01 - Google Trends tracking
    PermitActivity.ts       # SS.00.02 - Permit growth rates
    NewsEvents.ts           # SS.00.03 - News sentiment analysis
    IndustrialLogistics.ts  # SS.00.04 - Warehouse/logistics trends
    HousingPipeline.ts      # SS.00.05 - Housing starts tracking
    MomentumFusion.ts       # SS.00.06 - Score fusion calculation
  /edge/
    start_pass0.ts          # Edge function entry point
  /types/
    pass0_types.ts          # Type definitions
```

## Spokes

| Spoke | Doctrine ID | Capability |
|-------|-------------|------------|
| TrendSignal | SS.00.01 | Google Trends index, search volume growth tracking |
| PermitActivity | SS.00.02 | Commercial/residential permit tracking and growth rates |
| NewsEvents | SS.00.03 | Major employer announcements, infrastructure projects, sentiment |
| IndustrialLogistics | SS.00.04 | Warehouse vacancy rates, new logistics facilities, freight volume |
| HousingPipeline | SS.00.05 | Multifamily units permitted, single-family starts, supply pressure |
| MomentumFusion | SS.00.06 | Fused momentum score calculation, confidence level, top contributors |

## Input/Output

**Input:**
- ZIP code (5-digit string)
- State (2-letter code)

**Output:**
- MomentumAnalysis object
- Fused momentum score (0-100)
- Confidence level (high/medium/low)
- Top contributing signals

## Edge Function Constraints

Pass-0 executes in edge/cloud function context with the following constraints:
- **CANNOT** write to Neon database
- **CANNOT** import @neondatabase/serverless
- **CANNOT** promote opportunities to Pass-1
- Failures log to console only (not database)

## Import Rules (Non-Negotiable)

- This hub MAY import from `/src/shared/*`
- This hub MUST NOT import from any other `/src/passX/*` directory
- Cross-pass imports are forbidden and considered architecture violations

### Pass 0 Specific Restrictions (Hard Violations)

Pass 0 Radar Hub is **FORBIDDEN** from:
- Importing `NeonAdapter` or `@neondatabase/serverless`
- Referencing Neon connection strings or vault-related env vars
- Writing to any vault tables
- Promoting opportunities to persistent storage

**CI checks enforce these constraints. Violations fail the build.**

## Related Documentation

- ADR-008: Google Trends API Integration
- ADR-009: Firecrawl Web Scraping
