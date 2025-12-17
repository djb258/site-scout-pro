# ADR-011: Build Cost Calculator

**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.03.T06

---

## Context

The Pass-3 Design Hub requires accurate construction cost estimation to determine project feasibility. The Barton Doctrine sets a hard maximum of $27/sqft for total build cost, with dirt work limited to 20% of project cost.

## Decision

We will implement a **Build Cost Calculator** that estimates total project cost based on regional factors, site conditions, and construction type.

### Cost Categories

| Category | Components | Target | Maximum |
|----------|------------|--------|---------|
| Hard Costs | Building, paving, utilities | $20-22/sqft | $25/sqft |
| Soft Costs | Permits, design, fees | $3-4/sqft | $5/sqft |
| Contingency | Unforeseen costs | 5% | 10% |
| **Total** | | **$24-26/sqft** | **$27/sqft** |
| Dirt Work | Grading, excavation | < 10% | 20% (Kill Switch) |

### Implementation

```typescript
interface BuildCostInput {
  totalBuildableSqft: number;
  constructionType: 'single_story' | 'multi_story' | 'drive_up_only';
  climateControlledPct: number;
  siteConditions: {
    slope: number;              // percentage
    soilType: 'standard' | 'rock' | 'fill_required';
    demolitionRequired: boolean;
    utilitiesOnSite: boolean;
  };
  region: string;               // For regional cost factors
  acreage: number;
}

interface BuildCostResult {
  // Hard Costs
  buildingCost: number;
  pavingCost: number;
  utilityCost: number;
  siteworkCost: number;
  totalHardCost: number;
  hardCostPerSqft: number;

  // Soft Costs
  permitFees: number;
  architecturalDesign: number;
  engineering: number;
  legalFees: number;
  totalSoftCost: number;
  softCostPerSqft: number;

  // Dirt Work (separate tracking for Kill Switch)
  gradingCost: number;
  excavationCost: number;
  totalDirtWork: number;
  dirtWorkPct: number;          // % of total project

  // Totals
  subtotal: number;
  contingency: number;
  contingencyPct: number;
  totalProjectCost: number;
  costPerSqft: number;

  // Compliance
  passesDoctrineMaximum: boolean;
  passesDirtWorkLimit: boolean;
  warnings: string[];
}

function calculateBuildCost(input: BuildCostInput): BuildCostResult
```

## Rationale

1. **Doctrine Compliance**: Enforces $27/sqft maximum
2. **Dirt Work Tracking**: Separate tracking for 20% kill switch
3. **Regional Factors**: Adjusts for local labor/material costs
4. **Transparency**: Itemized costs for audit

## Regional Cost Factors

| Region | Multiplier | Notes |
|--------|------------|-------|
| Texas (non-metro) | 0.85 | Below national average |
| Texas (metro) | 1.00 | Baseline |
| Southeast | 0.90 | Lower labor costs |
| Midwest | 0.95 | Moderate costs |
| West Coast | 1.25 | Higher labor/materials |
| Northeast | 1.20 | Higher costs |

## Cost Estimation Logic

```typescript
function calculateBuildCost(input: BuildCostInput): BuildCostResult {
  const regionalFactor = getRegionalFactor(input.region);

  // Base building cost
  const baseBuildingCost = input.constructionType === 'multi_story'
    ? 18.00  // Multi-story base
    : 15.00; // Single-story/drive-up base

  // Climate control premium
  const climatePremium = input.climateControlledPct * 0.03; // $3/sqft premium

  // Site conditions adjustments
  let siteAdjustment = 0;
  if (input.siteConditions.slope > 5) siteAdjustment += 1.50;
  if (input.siteConditions.slope > 10) siteAdjustment += 2.00;
  if (input.siteConditions.soilType === 'rock') siteAdjustment += 3.00;
  if (input.siteConditions.soilType === 'fill_required') siteAdjustment += 2.50;
  if (input.siteConditions.demolitionRequired) siteAdjustment += 1.00;
  if (!input.siteConditions.utilitiesOnSite) siteAdjustment += 1.50;

  // Calculate dirt work separately
  const dirtWorkBase = input.siteConditions.slope * 0.5; // $0.50/sqft per % slope
  const dirtWorkCost = dirtWorkBase * input.totalBuildableSqft * regionalFactor;

  // ... continue with full calculation
}
```

## Dirt Work Kill Switch

```typescript
function checkDirtWorkLimit(result: BuildCostResult): FatalFlaw | null {
  if (result.dirtWorkPct > 20) {
    return {
      code: 'EXCESSIVE_DIRT_WORK',
      severity: 'critical',
      message: `Dirt work at ${result.dirtWorkPct.toFixed(1)}% exceeds 20% maximum`,
      recommendation: 'Site requires excessive grading - recommend WALK'
    };
  }
  return null;
}
```

## Consequences

### Positive
- Enforces Barton Doctrine cost limits
- Catches expensive sites early
- Regional cost accuracy
- Itemized for negotiation

### Negative
- Estimates may vary from actual bids
- Regional factors need periodic updates
- Some site conditions hard to estimate remotely

## Compliance

- [ ] $27/sqft maximum enforced
- [ ] Dirt work tracked separately
- [ ] 20% dirt work kill switch implemented
- [ ] Regional factors applied
- [ ] All estimates logged

## Related Documents

- PRD_PASS3_DESIGN_HUB.md
- BARTON_STORAGE_DOCTRINE.md
- BuildCostModel spoke implementation
