# ADR-003: Hotspot Scoring Engine

**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.01.T10

---

## Context

The Pass-1 Structure Hub requires a standardized scoring mechanism to evaluate market viability and assign tier rankings to potential storage sites. This score determines whether an opportunity proceeds to Pass-1.5 for rate verification.

## Decision

We will implement a **weighted scoring engine** that produces a 0-100 score and assigns tier rankings (A/B/C/D).

### Scoring Formula

| Factor | Weight | Source Spoke |
|--------|--------|--------------|
| Demand Score | 40% | MacroDemand |
| Supply Gap | 35% | MacroSupply |
| Competition Intensity | 25% | CompetitorRegistry |

### Tier Assignment

| Tier | Score Range | Action |
|------|-------------|--------|
| A | >= 80 | Auto-promote to Pass-1.5 |
| B | 60-79 | Auto-promote to Pass-1.5 |
| C | 40-59 | Manual review required |
| D | < 40 | Auto-reject |

### Implementation

```typescript
interface HotspotScore {
  totalScore: number;        // 0-100
  tier: 'A' | 'B' | 'C' | 'D';
  demandComponent: number;   // 0-40
  supplyGapComponent: number;  // 0-35
  competitionComponent: number; // 0-25
  promotionDecision: 'PROMOTE' | 'REVIEW' | 'REJECT';
}

function calculateHotspotScore(
  demandMetrics: DemandMetrics,
  supplyMetrics: SupplyMetrics,
  competitorMetrics: CompetitorMetrics
): HotspotScore
```

## Rationale

1. **Objectivity**: Removes emotion from site evaluation (Barton Doctrine)
2. **Reproducibility**: Same inputs always produce same outputs
3. **Transparency**: Component scores explain final result
4. **Thresholds**: Clear gates for promotion decisions

## Consequences

### Positive
- Consistent evaluation across all sites
- Explainable decisions with component breakdown
- Aligns with Barton Doctrine "No-Emotion Rule"

### Negative
- May miss nuanced opportunities
- Requires calibration as market changes
- Fixed weights may not suit all markets

## Score Component Calculations

### Demand Score (0-40 points)
```
Base: Population × 6 sqft demand factor
Modifiers:
  +10: Population growth > 2%/year
  +5: Median income > $75,000
  -10: Population decline
  -5: Low income area (< $40,000)
```

### Supply Gap Score (0-35 points)
```
Base: (Demand sqft - Supply sqft) / Demand sqft × 35
Modifiers:
  +10: sqft/capita < 5
  +5: No new permits in 2 years
  -10: sqft/capita > 10
  -15: New megastore permitted
```

### Competition Intensity (0-25 points)
```
Base: Inverse of competitor count within 5 miles
Modifiers:
  +10: < 3 competitors
  +5: No national brands
  -10: > 10 competitors
  -15: Multiple national brands
```

## Compliance

- [ ] Weights sum to 100%
- [ ] All component scores bounded
- [ ] Tier thresholds enforced
- [ ] Override audit trail implemented

## Related Documents

- PRD_PASS1_STRUCTURE_HUB.md
- BARTON_STORAGE_DOCTRINE.md (No-Emotion Rule)
- HotspotScoring spoke implementation
