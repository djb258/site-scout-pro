# ADR-010: Unit Mix Optimizer

**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.03.T04

---

## Context

The Pass-3 Design Hub requires optimization of storage unit mix to maximize revenue per square foot while meeting market demand. Different unit sizes have different rent/sqft ratios and demand profiles.

## Decision

We will implement a **Unit Mix Optimizer** that balances revenue optimization with market demand signals.

### Optimization Goals

1. **Maximize Revenue/SqFt** - Smaller units have higher rent/sqft
2. **Match Market Demand** - Don't overbuild unpopular sizes
3. **Minimize Vacancy Risk** - Diversify across size categories
4. **Meet Barton Doctrine** - Achieve $5,000/acre/month NOI

### Implementation

```typescript
interface UnitMixInput {
  totalBuildableSqft: number;
  marketRates: MarketRateData;
  demandProfile: DemandProfile;
  constraints: {
    minUnitCount: number;
    maxUnitCount: number;
    climateControlledPct: number;
  };
}

interface OptimizedUnitMix {
  units: UnitAllocation[];
  totalUnits: number;
  totalSqft: number;
  projectedGPR: number;
  avgRentPerSqft: number;
  revenueBySize: Record<string, number>;
}

interface UnitAllocation {
  size: string;           // '5x5', '10x10', etc.
  sqft: number;
  count: number;
  climateControlled: boolean;
  monthlyRate: number;
  rentPerSqft: number;
  percentOfMix: number;
}

function optimizeUnitMix(input: UnitMixInput): OptimizedUnitMix
```

## Rationale

1. **Revenue Optimization**: Smaller units = higher rent/sqft
2. **Demand Alignment**: Match local market preferences
3. **Risk Mitigation**: Diversified mix reduces vacancy risk
4. **Doctrine Compliance**: Ensures NOI targets are achievable

## Standard Unit Sizes

| Size | SqFt | Typical Rent/SqFt | Demand Profile |
|------|------|-------------------|----------------|
| 5x5 | 25 | $2.50-3.50 | High demand, quick turnover |
| 5x10 | 50 | $2.00-2.80 | High demand |
| 10x10 | 100 | $1.50-2.20 | Most popular size |
| 10x15 | 150 | $1.30-1.80 | Good demand |
| 10x20 | 200 | $1.10-1.50 | Moderate demand |
| 10x30 | 300 | $0.90-1.20 | Lower demand, longer stays |

## Optimization Algorithm

```typescript
function optimizeUnitMix(input: UnitMixInput): OptimizedUnitMix {
  const { totalBuildableSqft, marketRates, demandProfile } = input;

  // Step 1: Calculate revenue-weighted scores
  const sizeScores = calculateSizeScores(marketRates, demandProfile);

  // Step 2: Apply demand constraints
  const demandAdjusted = applyDemandConstraints(sizeScores, demandProfile);

  // Step 3: Optimize allocation
  const allocation = linearOptimize({
    objective: 'maximize_revenue',
    constraints: [
      { type: 'sqft_limit', value: totalBuildableSqft },
      { type: 'min_diversity', value: 4 },  // At least 4 sizes
      { type: 'max_any_size', value: 0.35 } // No size > 35% of mix
    ],
    weights: demandAdjusted
  });

  return buildUnitMix(allocation, marketRates);
}
```

## Default Mix Templates

### Standard Self-Storage
| Size | % of SqFt | Climate Split |
|------|-----------|---------------|
| 5x5 | 8% | 70% climate |
| 5x10 | 18% | 60% climate |
| 10x10 | 28% | 50% climate |
| 10x15 | 22% | 40% climate |
| 10x20 | 18% | 30% climate |
| 10x30 | 6% | 0% climate |

### Climate-Heavy Market
| Size | % of SqFt | Climate Split |
|------|-----------|---------------|
| 5x5 | 10% | 90% climate |
| 5x10 | 22% | 80% climate |
| 10x10 | 30% | 70% climate |
| 10x15 | 20% | 60% climate |
| 10x20 | 15% | 50% climate |
| 10x30 | 3% | 20% climate |

## Consequences

### Positive
- Data-driven unit mix decisions
- Revenue optimization
- Reduced vacancy risk
- Consistent methodology

### Negative
- May not capture local nuances
- Requires accurate market rate data
- Fixed templates may need adjustment

## Compliance

- [ ] Mix must support $5,000/acre NOI target
- [ ] Minimum 4 unit size categories
- [ ] No single size > 35% of total sqft
- [ ] Climate-controlled % configurable
- [ ] Optimization logged for audit

## Related Documents

- PRD_PASS3_DESIGN_HUB.md
- UnitMixOptimizer spoke implementation
- Market rate analysis
