# ADR-018: Pass 2 / Pass 3 Feasibility Realignment

**Status:** Accepted
**Date:** 2025-12-18
**Deciders:** Barton Enterprises Engineering Team
**Supersedes:** Partial update to ADR-006

---

## Context

During implementation review, it was identified that the Feasibility Engine (financial calculations) was incorrectly placed in Pass 2 (Underwriting Hub). This violates the fundamental doctrinal separation of concerns:

- **Pass 2** = Constraint & Eligibility Hub (site-specific constraints)
- **Pass 3** = Financial Modeling & Capital Truth (pro forma modeling)

Placing financial calculations in Pass 2 created architectural debt and violated the principle that Pass 2 should answer "Can we build here?" while Pass 3 answers "Should we build here financially?"

## Decision

We will **relocate all financial modeling from Pass 2 to Pass 3**:

### Pass 2 (SS.02.07) — Constraint Gate Only

```
src/pass2/underwriting_hub/spokes/Feasibility.ts
```

Now only validates:
- Required inputs are present (acreage, zoning, civil constraints)
- No fatal constraint violations (zoning prohibited, civil prohibitive)
- Site is eligible for Pass 3 financial analysis

Returns:
```typescript
interface FeasibilityConstraintOutput {
  spokeId: 'SS.02.07';
  constraints_satisfied: boolean;
  fatal_flaws: ConstraintFatalFlaw[];
  warnings: ConstraintWarning[];
  unknowns: ConstraintUnknown[];
  eligible_for_pass3: boolean;
  pass3_ready: boolean;
  notes: string;
}
```

### Pass 3 (SS.03.07) — Full Financial Engine

```
src/pass3/design_hub/spokes/Feasibility.ts
```

Contains the complete financial modeling:
- Revenue calculations (GPR, EGI)
- NOI calculations with Barton Doctrine thresholds
- DSCR and debt service calculations
- Yield on cost and cap rate
- Stressed NOI (25% haircut)
- Fatal flaw detection for financial metrics

Returns full `FeasibilityOutput` with all financial fields.

## Rationale

1. **Separation of Concerns**: Constraints vs. financials are fundamentally different questions
2. **Pipeline Clarity**: Pass 2 gates eligibility, Pass 3 models economics
3. **Doctrine Alignment**: "Can we build?" (Pass 2) vs "Is it profitable?" (Pass 3)
4. **Test Organization**: Financial tests belong with financial code
5. **Future Flexibility**: Constraint validation can evolve independently of financial models

## Migration Details

### Files Moved

| From | To |
|------|-----|
| `src/pass2/underwriting_hub/spokes/Feasibility.ts` | `src/pass3/design_hub/spokes/Feasibility.ts` |
| `tests/pass2/Feasibility.test.ts` | `tests/pass3/Feasibility.test.ts` |

### Spoke ID Mapping

| Old | New | Purpose |
|-----|-----|---------|
| SS.02.07 | SS.02.07 | Constraint Gate (new stub) |
| - | SS.03.07 | Financial Feasibility (moved code) |

### Backward Compatibility

Pass 2 Feasibility re-exports Pass 3 types for consumers that imported from Pass 2:

```typescript
export {
  runFeasibility as runPass3Feasibility,
  DOCTRINE_MIN_NOI_PER_ACRE_MONTHLY,
  // ... other exports
  type FeasibilityOutput as Pass3FeasibilityOutput,
} from '../../../pass3/design_hub/spokes/Feasibility';
```

## Consequences

### Positive
- Clear doctrinal separation of concerns
- Simpler Pass 2 (constraints only, no math)
- Financial tests co-located with financial code
- Pass 3 owns all pro forma modeling

### Negative
- Additional spoke in Pass 3
- Consumers importing from Pass 2 need import path updates
- ReverseFeasibility should also move to Pass 3 (future task)

## Compliance Checklist

- [x] Pass 2 Feasibility converted to constraint-only gate
- [x] Pass 3 Feasibility contains full financial engine
- [x] Spoke IDs updated (SS.03.07 for Pass 3)
- [x] Tests moved to tests/pass3/
- [x] Pass 2 constraint tests created
- [x] Barton Doctrine thresholds preserved in Pass 3
- [ ] ReverseFeasibility migration (future ADR)
- [ ] Pass 3 orchestrator integration verified

## Related Documents

- [ADR-006: Feasibility Engine](./ADR-006-feasibility-engine.md) — Original (partially superseded)
- PRD_PASS2_UNDERWRITING_HUB.md
- PRD_PASS3_DESIGN_HUB.md
- BARTON_STORAGE_DOCTRINE.md
