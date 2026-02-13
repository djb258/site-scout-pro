# ADR-012: IRR Calculator

## Conformance

| Field | Value |
|-------|-------|
| Doctrine Version | 2.0.0 |
| CTB Version | 2.0.0 |
| CC Layer | CC-04 |
| Governing Hub | barton-storage (CC-02) |

## Owning Hub

| Field | Value |
|-------|-------|
| Hub ID | barton-storage |
| Hub Name | Barton Storage System |
| CC Layer | CC-02 |

## CC Layer Scope

| Layer | Relevance |
|-------|-----------|
| CC-01 Sovereign | Governed by barton-family-office |
| CC-02 Hub | barton-storage |
| CC-03 Context | pass3-design |
| CC-04 Process | IRR Calculator implementation |

## IMO Layer Scope

| Layer | Impact |
|-------|--------|
| Ingress | No |
| Middle | Yes |
| Egress | No |

## Constant vs Variable

| Type | Name | Description |
|------|------|-------------|
| CONST (Input) | NOI, build cost, financing | Consumed by IRR Calculator |
| VAR (Output) | IRR, cash-on-cash return | Produced by IRR Calculator |


**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.03.T10

---

## Context

The Pass-3 Design Hub requires investment return calculations to evaluate project viability. IRR (Internal Rate of Return), equity multiple, NPV, and cash-on-cash returns help determine if a project meets investment criteria.

## Decision

We will implement an **IRR Calculator** that models project cash flows and calculates key investment metrics.

### Return Thresholds

| Metric | Minimum | Target | Excellent |
|--------|---------|--------|-----------|
| Unlevered IRR | 8% | 12% | 15%+ |
| Levered IRR | 12% | 18% | 25%+ |
| Cash-on-Cash Y1 | 6% | 10% | 15%+ |
| Equity Multiple | 1.5x | 2.0x | 2.5x+ |

### Implementation

```typescript
interface IRRInput {
  // Investment
  totalProjectCost: number;
  equityContribution: number;
  loanAmount: number;

  // Operating Assumptions
  netOperatingIncome: number;
  noiGrowthRate: number;        // Annual NOI growth (3% typical)

  // Debt Service
  interestRate: number;
  amortizationYears: number;
  loanTerm: number;             // Years until refi/sale

  // Exit
  holdPeriod: number;           // Years
  exitCapRate: number;
  sellingCosts: number;         // % of sale price
}

interface IRRResult {
  // Cash Flows
  yearlyUnleveredCashFlow: number[];
  yearlyLeveredCashFlow: number[];
  yearlyDebtService: number[];

  // Returns
  unleveredIRR: number;
  leveredIRR: number;
  npv: number;
  equityMultiple: number;

  // Cash-on-Cash
  cashOnCashByYear: number[];
  avgCashOnCash: number;

  // Exit
  projectedSalePrice: number;
  netSaleProceeds: number;
  totalProfit: number;

  // Compliance
  meetsMinimumThresholds: boolean;
  warnings: string[];
}

function calculateIRR(input: IRRInput): IRRResult
```

## Rationale

1. **Investment Decision**: Clear go/no-go based on returns
2. **Risk Assessment**: Levered vs unlevered comparison
3. **Exit Modeling**: Realistic sale assumptions
4. **Comparison**: Standard metrics across all projects

## IRR Calculation Logic

```typescript
function calculateIRR(input: IRRInput): IRRResult {
  const {
    totalProjectCost, equityContribution, loanAmount,
    netOperatingIncome, noiGrowthRate,
    interestRate, amortizationYears, loanTerm,
    holdPeriod, exitCapRate, sellingCosts
  } = input;

  // Build cash flow array
  const unleveredCashFlows: number[] = [-totalProjectCost];
  const leveredCashFlows: number[] = [-equityContribution];

  // Annual debt service
  const annualDebtService = calculateDebtService(
    loanAmount, interestRate, amortizationYears
  );

  // Operating years
  let currentNOI = netOperatingIncome;
  for (let year = 1; year <= holdPeriod; year++) {
    // Unlevered: NOI only
    unleveredCashFlows.push(currentNOI);

    // Levered: NOI - Debt Service
    leveredCashFlows.push(currentNOI - annualDebtService);

    // Grow NOI for next year
    currentNOI *= (1 + noiGrowthRate);
  }

  // Exit year
  const exitNOI = currentNOI;
  const salePrice = exitNOI / exitCapRate;
  const netSaleProceeds = salePrice * (1 - sellingCosts);
  const loanPayoff = calculateLoanBalance(loanAmount, interestRate, amortizationYears, holdPeriod);

  // Add sale proceeds to final year
  unleveredCashFlows[holdPeriod] += netSaleProceeds;
  leveredCashFlows[holdPeriod] += (netSaleProceeds - loanPayoff);

  // Calculate IRR using Newton-Raphson method
  const unleveredIRR = calculateIRRFromCashFlows(unleveredCashFlows);
  const leveredIRR = calculateIRRFromCashFlows(leveredCashFlows);

  // Equity multiple
  const totalCashReturned = leveredCashFlows.slice(1).reduce((a, b) => a + b, 0);
  const equityMultiple = totalCashReturned / equityContribution;

  return {
    unleveredIRR,
    leveredIRR,
    equityMultiple,
    // ... other metrics
  };
}
```

## Cash Flow Model

### Year 0 (Construction)
- Equity investment
- Loan proceeds
- Construction costs

### Years 1-N (Operation)
- NOI (growing at growth rate)
- Less: Debt service
- Equals: Cash flow to equity

### Year N (Exit)
- Operating cash flow
- Plus: Net sale proceeds
- Less: Loan payoff
- Equals: Terminal cash flow

## Default Assumptions

| Assumption | Default | Range |
|------------|---------|-------|
| Hold Period | 5 years | 3-10 years |
| NOI Growth | 3%/year | 2-5% |
| Exit Cap Rate | Terminal cap + 0.5% | Market dependent |
| Selling Costs | 3% | 2-5% |
| Discount Rate (NPV) | 10% | 8-15% |

## Consequences

### Positive
- Standard investment analysis
- Compares projects consistently
- Models realistic exit scenarios
- Clear threshold enforcement

### Negative
- Projections are estimates
- Exit cap rate uncertainty
- Doesn't capture all risks
- Assumes stable NOI growth

## Sensitivity Analysis

The calculator also produces sensitivity tables:

```typescript
interface SensitivityAnalysis {
  irrByExitCap: Record<number, number>;      // Exit cap rate scenarios
  irrByNOIGrowth: Record<number, number>;    // Growth rate scenarios
  irrByHoldPeriod: Record<number, number>;   // Hold period scenarios
}
```

## Compliance

- [ ] Minimum IRR thresholds enforced (12% levered)
- [ ] Equity multiple threshold (1.5x)
- [ ] Cash-on-cash threshold (6% Y1)
- [ ] Sensitivity analysis generated
- [ ] All assumptions logged

## Related Documents

- PRD_PASS3_DESIGN_HUB.md
- IRRModel spoke implementation
- ADR-006 (Feasibility Engine)
- ADR-011 (Build Cost Calculator)


---

## PID Impact

| Pass | Impact |
|------|--------|
| Pass 0 | No |
| Pass 1 | No |
| Pass 1.5 | No |
| Pass 2 | No |
| Pass 3 | Yes |

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Author | AI Agent | 2026-02-13 | DRAFTED |
| Reviewer | --- | --- | PENDING |
| Sovereign | barton-family-office | --- | PENDING |
