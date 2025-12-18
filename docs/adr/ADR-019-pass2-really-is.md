# ADR-019: Pass 2 Really Is — Jurisdiction Card Completion Engine

## Status
**ACCEPTED** — Doctrine Lock

## Date
2024-12-18

## Context

Pass 2 has historically drifted toward becoming a "mini Pass 3" — adding financial calculations, timeline estimates, and deal-quality assessments that belong elsewhere.

This drift creates:
- Coupled logic that's hard to test
- Repeated research for the same jurisdictions
- Unclear boundaries between constraint compilation and financial modeling
- Claude Code confusion about what Pass 2 should do

This ADR permanently defines what Pass 2 **really is**.

## Decision

### Pass 2 = Jurisdiction Card Completion Engine

Nothing more. Nothing less.

**Pass 2 exists solely to fill deterministic input blocks required by Pass 3.**

### Single Responsibility

> Given a ZIP code and asset class, determine whether the **jurisdiction knowledge required to model a site is complete**, and if not, **what specific inputs are missing**.

End state:
- A **county × asset class jurisdiction card**
- With known, unknown, and blocked fields explicitly marked

### What Pass 2 Does NOT Do

| Forbidden | Reason |
|-----------|--------|
| Decide if a deal is good | That's Pass 3's job |
| Run financial math | No NOI, DSCR, IRR, revenue, costs |
| Estimate timelines | No permit durations, construction schedules |
| Score ROI | That's Pass 3 |
| Optimize layouts | That's Pass 3 |
| Guess missing inputs | Unknown ≠ false |

### Jurisdiction Card Contents

**Allowed content (constants, not outcomes):**
- Zoning allowance (by-right or prohibited)
- Setbacks, buffers, coverage, impervious limits
- Slope and grading restrictions
- Stormwater design requirements (event, release, infiltration)
- ADA / fire access rules specific to storage
- Bonding and financial assurance requirements
- Permit acquisition checklist (what approvals exist, not duration)
- Authority scope (county / municipal / watershed / DOT)
- Storage-specific code references
- Provenance (source, confidence, verified_at)

**Explicitly forbidden content:**
- Rent assumptions
- NOI / DSCR / IRR
- Timelines
- Soft cost estimates
- Market demand
- Parcel-specific engineering

### Pass 2 Trigger Flow

1. ZIP code enters system (from Pass 1)
2. ZIP resolves to one or more counties
3. For each county:
   - If jurisdiction card exists → check completeness
   - If incomplete → research *only missing fields*
   - If missing → build card incrementally
4. Pass 2 outputs:
   - Completed fields
   - Missing fields
   - Manual research requirements

**Pass 2 never "runs analysis." It only completes knowledge.**

### Output Contract

Pass 2 returns **no conclusions**, only facts:

```typescript
interface Pass2Output {
  // Card completeness
  jurisdiction_card_complete: boolean;
  required_fields_missing: string[];
  manual_research_required: boolean;

  // Geometry (if complete)
  geometry_constraints: GeometryConstraints | null;

  // Approval requirements
  approval_checklist: ApprovalItem[];

  // Fatal prohibitions
  fatal_prohibitions: string[];  // e.g., "storage not permitted"

  // Status
  status: 'ELIGIBLE' | 'HOLD_INCOMPLETE' | 'NO_GO';
}
```

If required geometry inputs are missing:
- Pass 2 must halt and return `HOLD_INCOMPLETE`

### Hard Guardrails (Non-Negotiable)

1. **Unknown ≠ false** — Missing data must propagate forward
2. **Cards can be partial** — Must be reusable across sites
3. **Geometry for envelope only** — Never economics
4. **Pass 3 trusts blindly** — If Pass 2 says complete, it's complete

### Definition of Done

Pass 2 is correct if:
- It can answer: *"Do we know enough to model this site?"*
- It never answers: *"Is this a good deal?"*
- It produces reusable jurisdiction intelligence
- It reduces repeated research over time

**A good Pass 2 makes Pass 3 boring.**

## Consequences

### Positive
- Clear separation of concerns
- Reusable jurisdiction cards across multiple sites
- Testable, deterministic constraint compilation
- Pass 3 receives clean, trusted inputs
- Claude Code has unambiguous instructions

### Negative
- Requires discipline to not add "helpful" financial math
- May feel incomplete to users expecting a deal verdict

### Neutral
- Existing Pass 2 code may need refactoring to align
- Jurisdiction cards become first-class entities

## Compliance

Any code that violates this doctrine must be:
1. Moved to Pass 3 (if financial)
2. Removed entirely (if speculative)
3. Flagged as `HOLD_INCOMPLETE` (if unknown)

## References

- ADR-018: Pass 2 vs Pass 3 Feasibility Realignment
- PRD-002: Pass 2 Underwriting Hub
- Doctrine File: `docs/doctrine/Pass2ReallyIs.md`
