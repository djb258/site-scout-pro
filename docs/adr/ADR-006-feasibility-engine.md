# ADR-006: Feasibility Engine

**Status:** Partially Superseded by [ADR-018](./ADR-018-pass2-pass3-feasibility-realignment.md)
**Date:** 2025-12-17
**Updated:** 2025-12-18
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.03.07 (moved from SS.02.T11)

---

> **UPDATE 2025-12-18:** Financial calculations have been relocated to Pass 3 (SS.03.07).
> Pass 2 now only performs constraint validation. See ADR-018 for details.

## Context

The ~~Pass-2 Underwriting Hub~~ **Pass-3 Design/Calculator Hub** performs financial feasibility calculations to determine if a site meets the Barton Doctrine's minimum thresholds. This includes NOI calculation, DSCR analysis, and the critical $5,000/month per acre minimum.

## Decision

We will implement a **Feasibility Engine** that calculates all financial viability metrics per Barton Doctrine requirements.

### Core Calculations

| Metric | Formula | Threshold |
|--------|---------|-----------|
| Gross Potential Rent | Units × Avg Rent × 12 | - |
| Effective Gross Income | GPR × (1 - Vacancy) × (1 - Collection Loss) | - |
| Net Operating Income | EGI - OpEx | - |
| NOI per Acre | NOI / Acreage / 12 | >= $5,000/month |
| Stressed NOI | NOI × 0.75 | >= $3,750/month |
| DSCR | NOI / Annual Debt Service | >= 1.25 |
| Cap Rate | NOI / Property Value | >= 6.5% |

### Implementation

```typescript
interface FeasibilityInput {
  acreage: number;
  buildableSqft: number;
  unitMix: UnitMix[];
  marketRates: MarketRates;
  constructionCost: number;
  landPrice: number;
}

interface FeasibilityResult {
  // Revenue
  grossPotentialRent: number;
  vacancyFactor: number;      // 10% default
  collectionLoss: number;     // 2% default
  effectiveGrossIncome: number;

  // Expenses
  operatingExpenses: number;
  opExRatio: number;          // 30-35%

  // NOI
  netOperatingIncome: number;
  noiPerAcre: number;
  noiPerAcreMonthly: number;
  stressedNOI: number;        // 25% haircut
  stressedNOIPerAcre: number;

  // Returns
  capRate: number;
  cashOnCash: number;

  // Debt
  loanAmount: number;
  annualDebtService: number;
  dscr: number;

  // Verdict
  passesDoctrineMinimum: boolean;
  passesStressTest: boolean;
  passesDSCR: boolean;
}

function calculateFeasibility(input: FeasibilityInput): FeasibilityResult
```

## Rationale

1. **Doctrine Compliance**: Enforces $5,000/acre minimum
2. **Stress Testing**: 25% NOI haircut per Barton Doctrine
3. **Debt Analysis**: DSCR at 6%/25yr amortization
4. **Transparency**: All calculations are auditable

## Barton Doctrine Thresholds

| Metric | Minimum | Fatal Flaw Code |
|--------|---------|-----------------|
| NOI/Acre/Month | $5,000 | `NOI_BELOW_DOCTRINE` |
| Stressed NOI/Acre/Month | $3,750 | `STRESSED_NOI_FAILURE` |
| DSCR | 1.25x | `DSCR_BELOW_THRESHOLD` |
| Cap Rate | 6.5% | (Warning only) |

## Fatal Flaw Triggers

```typescript
function checkFeasibilityFatalFlaws(result: FeasibilityResult): FatalFlaw[] {
  const flaws: FatalFlaw[] = [];

  // Barton Doctrine: $5,000/acre minimum
  if (result.noiPerAcreMonthly < 5000) {
    flaws.push({
      code: 'NOI_BELOW_DOCTRINE',
      severity: 'critical',
      message: `NOI of $${result.noiPerAcreMonthly}/acre/month is below $5,000 minimum`
    });
  }

  // Stressed NOI must survive 25% haircut
  if (result.stressedNOIPerAcre < 3750) {
    flaws.push({
      code: 'STRESSED_NOI_FAILURE',
      severity: 'critical',
      message: `Stressed NOI fails debt survivability test`
    });
  }

  // Negative NOI is automatic fail
  if (result.netOperatingIncome < 0) {
    flaws.push({
      code: 'NEGATIVE_NOI',
      severity: 'critical',
      message: `Negative NOI - site is not viable`
    });
  }

  return flaws;
}
```

## Default Assumptions

| Assumption | Value | Adjustable |
|------------|-------|------------|
| Vacancy | 10% | Yes |
| Collection Loss | 2% | Yes |
| OpEx Ratio | 30-35% | Yes |
| Stabilization Occupancy | 85% | No |
| Interest Rate | 6.0% | Yes |
| Amortization | 25 years | No |
| LTV Target | 70% | Yes |

## Consequences

### Positive
- Enforces Barton Doctrine quantitatively
- Produces consistent, comparable results
- Full audit trail of assumptions
- Stress testing catches marginal deals

### Negative
- Fixed assumptions may not fit all markets
- Requires accurate input data
- May reject deals that could work with creativity

## Compliance

- [ ] $5,000/acre minimum enforced
- [ ] 25% haircut stress test implemented
- [ ] DSCR calculation at 6%/25yr
- [ ] All inputs/outputs logged
- [ ] Override audit trail for exceptions

## Related Documents

- PRD_PASS2_UNDERWRITING_HUB.md
- BARTON_STORAGE_DOCTRINE.md
- Feasibility spoke implementation
- ADR-007 (Verdict Engine)
