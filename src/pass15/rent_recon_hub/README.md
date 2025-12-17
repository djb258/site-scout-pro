# Pass-1.5 Rent Recon Hub

## PRD Reference
- **PRD:** [`docs/prd/PRD_PASS15_RENT_RECON_HUB.md`](../../../docs/prd/PRD_PASS15_RENT_RECON_HUB.md)
- **Doctrine ID:** SS.015.00
- **Hub Name:** PASS15_RENT_RECON_HUB
- **Official Name:** PASS 1.5 - RENT RECON HUB

## Purpose

The Pass-1.5 Rent Recon Hub collects and verifies rate evidence from competitors before underwriting begins. It uses web scraping and AI-powered voice calls to gather actual street rates, then normalizes the data to produce reliable pricing benchmarks.

## Boundary

**This hub owns:**
- All rate collection, verification, and normalization
- Web scraping of competitor websites
- Aggregator API integration (SpareFoot, SelfStorage.com)
- AI voice calls via Retell.ai
- Rate evidence normalization by unit size
- Coverage confidence scoring
- Promotion gate for Pass-2

**This hub does NOT own:**
- Competitor discovery (Pass-1)
- Market reconnaissance (Pass-1)
- Underwriting calculations (Pass-2)
- Feasibility analysis (Pass-2)
- Pro forma modeling (Pass-3)

## Directory Structure

```
/pass15/rent_recon_hub/
  /orchestrator/
    Pass15Orchestrator.ts       # Main orchestration logic
  /spokes/
    PublishedRateScraper.ts     # SS.015.01 - Web scraping
    AICallWorkOrders.ts         # SS.015.02 - Retell.ai voice calls
    RateEvidenceNormalizer.ts   # SS.015.03 - Rate normalization
    CoverageConfidence.ts       # SS.015.04 - Coverage scoring
    PromotionGate.ts            # SS.015.05 - Promotion decision
  /edge/
    start_pass15.ts             # Edge function entry point
  /types/
    pass15_types.ts             # Type definitions
```

## Spokes

| Spoke | Doctrine ID | Capability |
|-------|-------------|------------|
| PublishedRateScraper | SS.015.01 | Scrape published rates from competitor websites and aggregators |
| AICallWorkOrders | SS.015.02 | Generate and execute AI voice calls to collect rates |
| RateEvidenceNormalizer | SS.015.03 | Normalize rates by unit size, calculate averages and medians |
| CoverageConfidence | SS.015.04 | Calculate coverage score and confidence level |
| PromotionGate | SS.015.05 | Decide promotion to Pass-2 based on coverage threshold |

## Input/Output

**Input:**
- OpportunityObject from Pass-1
- Competitor list with phone numbers

**Output:**
- RateEvidencePackage
- Normalized rates by unit size
- Coverage confidence score (0-100)
- Market benchmarks (avg 10x10, market position)

## Coverage Confidence Calculation

| Component | Weight |
|-----------|--------|
| Competitor Coverage | 50% |
| Size Coverage | 30% |
| Source Diversity | 20% |

## Coverage Thresholds

| Level | Score | Meaning |
|-------|-------|---------|
| High | >= 80% | Confident pricing, promote immediately |
| Medium | 60-79% | Acceptable, promote with flag |
| Low | < 60% | Insufficient, require override to promote |

## Import Rules (Non-Negotiable)

- This hub MAY import from `/src/shared/*`
- This hub MUST NOT import from any other `/src/passX/*` directory
- Cross-pass imports are forbidden and considered architecture violations

## Related Documentation

- ADR-005: Retell.ai Voice Integration
- ADR-009: Firecrawl Web Scraping
