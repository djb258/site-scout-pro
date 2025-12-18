# Pass 2 Really Is — Jurisdiction Card Completion Engine

**Doctrine Lock — Read Before Any Pass 2 Coding**

---

## WHAT PASS 2 REALLY IS

**Pass 2 = Jurisdiction Card Completion Engine**

Nothing more. Nothing less.

Pass 2 does **not**:

* Decide if a deal is good
* Run financial math
* Estimate timelines
* Score ROI
* Optimize layouts
* Guess missing inputs

Pass 2 exists solely to **fill deterministic input blocks** required by Pass 3.

---

## PASS 2 SINGLE RESPONSIBILITY

> Given a ZIP code and asset class, determine whether the **jurisdiction knowledge required to model a site is complete**, and if not, **what specific inputs are missing**.

End state:

* A **county x asset class jurisdiction card**
* With known, unknown, and blocked fields explicitly marked

---

## WHAT A JURISDICTION CARD CONTAINS

Jurisdiction Cards store **constants**, not outcomes.

### Allowed content:

* Zoning allowance (by-right or prohibited)
* Setbacks, buffers, coverage, impervious limits
* Slope and grading restrictions
* Stormwater design requirements (event, release, infiltration)
* ADA / fire access rules *specific to storage*
* Bonding and financial assurance requirements
* Permit acquisition checklist (what approvals exist, not duration)
* Authority scope (county / municipal / watershed / DOT)
* Storage-specific code references
* Provenance (source, confidence, verified_at)

### Explicitly forbidden content:

* Rent assumptions
* NOI / DSCR / IRR
* Timelines
* Soft cost estimates
* Market demand
* Parcel-specific engineering

---

## HOW PASS 2 IS TRIGGERED

1. ZIP code enters system (from Pass 1)
2. ZIP resolves to one or more counties
3. For each county:
   * If a jurisdiction card exists → check completeness
   * If incomplete → research *only missing fields*
   * If missing → build card incrementally
4. Pass 2 outputs:
   * Completed fields
   * Missing fields
   * Manual research requirements

Pass 2 **never "runs analysis."**
It only **completes knowledge**.

---

## PASS 2 OUTPUT CONTRACT

Pass 2 returns **no conclusions**, only facts:

* `jurisdiction_card_complete: boolean`
* `required_fields_missing[]`
* `manual_research_required: boolean`
* `geometry_constraints` (if complete)
* `approval_checklist`
* `fatal_prohibitions` (e.g., storage not permitted)

If required geometry inputs are missing:

* Pass 2 must halt and return `HOLD_INCOMPLETE`

---

## HARD GUARDRAILS (NON-NEGOTIABLE)

* Unknown ≠ false
* Missing data must propagate forward
* Cards can be partial and must be reusable
* Geometry may be calculated **only to define buildable envelope**, never economics
* Pass 3 must be able to trust Pass 2 blindly

If you feel tempted to "just add a little math," stop.

---

## DEFINITION OF DONE

Pass 2 is correct if:

* It can answer: *"Do we know enough to model this site?"*
* It never answers: *"Is this a good deal?"*
* It produces reusable jurisdiction intelligence
* It reduces repeated research over time

A good Pass 2 makes Pass 3 boring.

---

## CONFLICT RESOLUTION

If any instruction conflicts with existing code, **pause and explain the conflict** before proceeding.

If existing code violates this doctrine:
1. Move financial logic to Pass 3
2. Remove speculative logic entirely
3. Flag unknowns as `HOLD_INCOMPLETE`

---

## REFERENCES

* ADR-019: Pass 2 Really Is
* ADR-018: Pass 2 vs Pass 3 Feasibility Realignment
* PRD-002: Pass 2 Underwriting Hub
