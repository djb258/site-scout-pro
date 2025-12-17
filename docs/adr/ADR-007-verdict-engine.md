# ADR-007: Verdict Engine

**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.02.T14

---

## Context

The Pass-2 Underwriting Hub requires a final decision mechanism that synthesizes all spoke outputs into a GO/NO_GO/MAYBE verdict. This verdict must be math-driven per the Barton Doctrine's "No-Emotion Rule."

## Decision

We will implement a **Verdict Engine** that produces verdicts based on weighted scoring and fatal flaw detection.

### Verdict Outcomes

| Verdict | Criteria | Action |
|---------|----------|--------|
| GO | Score >= 70, no fatal flaws, NOI >= $5,000/acre | Proceed to Pass-3 |
| MAYBE | Score 50-69, no fatal flaws | Human review recommended |
| NO_GO | Score < 50 OR any fatal flaw | WALK - do not pursue |

### Deal Index (DI) Calculation

| Factor | Weight | Source Spoke |
|--------|--------|--------------|
| Feasibility Score | 30% | Feasibility |
| Fusion Demand Score | 25% | FusionDemand |
| Competitive Pressure | 20% | CompetitivePressure |
| Zoning Score | 15% | Zoning |
| Momentum Score | 10% | MomentumReader |
| **Total** | **100%** | |

### Implementation

```typescript
interface VerdictInput {
  feasibilityScore: number;      // 0-100
  fusionDemandScore: number;     // 0-100
  competitivePressure: number;   // 0-100 (inverted - higher = less pressure)
  zoningScore: number;           // 0-100
  momentumScore: number;         // 0-100
  fatalFlaws: FatalFlaw[];
  noiPerAcreMonthly: number;
}

interface VerdictResult {
  dealIndex: number;             // 0-100
  verdict: 'GO' | 'NO_GO' | 'MAYBE';
  fatalFlaws: FatalFlaw[];
  strengths: string[];
  weaknesses: string[];
  reasoning: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  overrideEligible: boolean;
}

function calculateVerdict(input: VerdictInput): VerdictResult
```

## Rationale

1. **No-Emotion Rule**: Verdict is purely mathematical
2. **Transparency**: Weighted factors are explicit
3. **Fatal Flaw Priority**: Any fatal flaw = automatic NO_GO
4. **Auditability**: Full reasoning trail

## Fatal Flaws (Auto-WALK)

Per Barton Doctrine, these conditions trigger automatic NO_GO regardless of score:

| Fatal Flaw Code | Description | Source |
|-----------------|-------------|--------|
| `ZONING_PROHIBITED` | Storage not permitted | Zoning spoke |
| `FLOOD_ZONE_HIGH_RISK` | Zone A or V | CivilConstraints |
| `PROHIBITIVE_TOPOGRAPHY` | Slope > 15% | CivilConstraints |
| `NEGATIVE_NOI` | NOI < 0 | Feasibility |
| `NOI_BELOW_DOCTRINE` | NOI < $5,000/acre/month | Feasibility |
| `EXCESSIVE_DIRT_WORK` | Grading > 20% of cost | CivilConstraints |

### Fatal Flaw Processing

```typescript
function processVerdict(input: VerdictInput): VerdictResult {
  // STEP 1: Check fatal flaws FIRST
  if (input.fatalFlaws.length > 0) {
    return {
      dealIndex: calculateDealIndex(input), // Still calculate for audit
      verdict: 'NO_GO',
      fatalFlaws: input.fatalFlaws,
      reasoning: `Fatal flaw detected: ${input.fatalFlaws[0].code}`,
      overrideEligible: input.fatalFlaws.some(f => f.overridable)
    };
  }

  // STEP 2: Calculate Deal Index
  const dealIndex = calculateDealIndex(input);

  // STEP 3: Apply threshold logic
  if (dealIndex >= 70 && input.noiPerAcreMonthly >= 5000) {
    return { verdict: 'GO', dealIndex, ... };
  } else if (dealIndex >= 50) {
    return { verdict: 'MAYBE', dealIndex, ... };
  } else {
    return { verdict: 'NO_GO', dealIndex, ... };
  }
}
```

## Consequences

### Positive
- Consistent, reproducible decisions
- Full audit trail
- No emotional bias
- Clear escalation path for MAYBE verdicts

### Negative
- May miss nuanced opportunities
- Requires well-calibrated spoke scores
- No "gut feel" override (by design)

## Override Rules

While verdicts are math-driven, certain overrides are permitted with approval:

| Override | Condition | Approver |
|----------|-----------|----------|
| Force GO | MAYBE verdict but strategic | Investment Committee |
| Override WALK | Fatal flaw is addressable | Hub Owner + Legal |
| Accept Low DSCR | Strong other factors | Hub Owner |

All overrides logged to `engine_logs` with justification.

## Scoring Calibration

### Deal Index Interpretation

| DI Range | Meaning | Historical Success |
|----------|---------|-------------------|
| 90-100 | Exceptional | 95%+ proceed |
| 80-89 | Strong | 85% proceed |
| 70-79 | Solid | 70% proceed |
| 60-69 | Marginal | 40% proceed |
| 50-59 | Weak | 20% proceed |
| < 50 | Poor | 5% proceed |

## Compliance

- [ ] Weights sum to exactly 100%
- [ ] Fatal flaws checked before scoring
- [ ] NOI minimum enforced ($5,000/acre)
- [ ] Override audit trail implemented
- [ ] Verdict logged to Neon vault

## Related Documents

- PRD_PASS2_UNDERWRITING_HUB.md
- BARTON_STORAGE_DOCTRINE.md
- ADR-006 (Feasibility Engine)
- Verdict spoke implementation
