# ADR-020: Pass 2 Constraint Compiler Architectural Position

## Status

**ACCEPTED** — Supplementary to ADR-019

## Date

2024-12-18

## Context

ADR-019 defines WHAT Pass 2 is (Jurisdiction Card Completion Engine). This ADR explains WHY Pass 2 exists in this form.

## Decisions

### Why Pass 2 Is Not Financial

**Decision:** Pass 2 performs zero financial calculations.

**Rationale:**
- Financial modeling requires complete buildability data as input
- Calculating NOI on incomplete constraints produces misleading numbers
- Mixing constraint compilation with financial modeling creates coupled, untestable code
- Pass 3 owns financial modeling; Pass 2 owns constraint compilation

**Evidence from code:**
```typescript
// contracts/pass2_output.ts
// NO dollars. NO NOI. NO timelines. NO revenue projections.
// If you feel tempted to add financial math, STOP.
```

---

### Why Jurisdiction Cards Are Reusable

**Decision:** Jurisdiction Cards are keyed by (county × asset class), not by parcel.

**Rationale:**
- Zoning codes, setbacks, and fire requirements are jurisdiction-level, not parcel-level
- Researching jurisdiction data is expensive (manual, multi-source)
- The same card applies to every site in that jurisdiction
- Incremental research is cheaper than starting over

**Evidence from code:**
```typescript
// types/jurisdiction_card.ts
card_id: string;
jurisdiction_id: string;
state: string;
county: string;
asset_class: AssetClass;  // 'self_storage' | 'rv_storage' | 'boat_storage'
```

**Consequence:** Pass 2 builds institutional knowledge over time.

---

### Why Geometry-Only Math Is Allowed

**Decision:** EnvelopeReducer calculates geometry (net_buildable_acres, max_buildable_sqft) but not economics.

**Rationale:**
- Pass 3 needs to know physical capacity before it can calculate revenue
- Geometry is derived from constraints (setbacks, coverage, stormwater), not assumptions
- The formula is deterministic: `net_buildable = gross - reductions`
- This is constraint reduction, not financial projection

**Evidence from code:**
```typescript
// spokes/EnvelopeReducer.ts
// This is GEOMETRY ONLY. No financial calculations.
// Reduces gross acres to net buildable sqft based on constraints.
```

**Boundary:** EnvelopeReducer never outputs dollars, timelines, or deal quality.

---

### Why Missing Data Propagates Forward

**Decision:** Unknown fields are reported as `null`, never substituted with defaults.

**Rationale:**
- Unknown ≠ false (ADR-019 guardrail)
- Substituting defaults hides data gaps from downstream systems
- Pass 3 needs to know what's known vs. assumed
- Silent estimation produces silent failures

**Evidence from code:**
```typescript
// contracts/pass2_output.ts
// null means unknown/not yet researched.

// types/guardrails.ts
export type FieldKnowledgeState = 'known' | 'unknown' | 'blocked';
```

**Enforcement:** EnvelopeReducer refuses to calculate if required fields are unknown.

---

### Why Pass 3 Trusts Pass 2 Blindly

**Decision:** If Pass 2 returns `ELIGIBLE`, Pass 3 proceeds without re-validating constraints.

**Rationale:**
- Validation belongs in one place (Pass 2)
- Re-validation in Pass 3 creates coupling and duplication
- Pass 2's `jurisdiction_card_complete = true` is the contract
- If Pass 2 lies, the bug is in Pass 2, not Pass 3

**Evidence from code:**
```typescript
// orchestrator/Pass2ConstraintCompiler.ts
// DOCTRINE: Populate primary signals
output.jurisdiction_card_complete = verdict.status === 'ELIGIBLE';
```

**Consequence:** Pass 2 must be correct. There is no safety net.

---

### Why Pass 2 Is County × Asset Class

**Decision:** Jurisdiction Cards are scoped to (county × asset_class).

**Rationale:**
- Different asset classes have different zoning requirements
- Self-storage has different fire access rules than RV storage
- County is the primary jurisdictional boundary
- Municipality/watershed are secondary (captured as authority_scope)

**Evidence from code:**
```typescript
// spokes/JurisdictionCardReader.ts
card = await runJurisdictionCardReader({
  jurisdiction_id: jurisdiction.primary_jurisdiction.jurisdiction_id,
  asset_class: input.asset_class,  // Different card per asset class
});
```

---

## Consequences

### Positive

- Clear separation between constraint compilation and financial modeling
- Reusable jurisdiction intelligence reduces research burden
- Deterministic geometry calculations
- Explicit unknowns prevent silent failures
- Pass 3 has a simple contract to depend on

### Negative

- Pass 2 cannot provide "quick estimates" — it's complete or HOLD
- Every jurisdiction needs a card built (cold start problem)
- Multiple authority scopes increase complexity

### Neutral

- Three-pass architecture is more complex than single-pass
- Documentation burden to explain the separation

## Compliance

Code that violates these positions must be:
1. Moved to Pass 3 (if financial)
2. Removed entirely (if speculative)
3. Flagged as `HOLD_INCOMPLETE` (if unknown)

## References

- ADR-019: Pass 2 Really Is (WHAT Pass 2 is)
- Doctrine: `docs/doctrine/Pass2ReallyIs.md`
- PRS-PASS2-001: Execution Specification
- PRD-PASS2-001: Product Requirements
