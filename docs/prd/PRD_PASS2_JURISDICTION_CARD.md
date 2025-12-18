# PRD: Pass 2 Jurisdiction Card Completion Engine

**Document ID:** PRD-PASS2-001
**Status:** Derived from implementation
**Reference:** ADR-019, `docs/doctrine/Pass2ReallyIs.md`

---

## Problem Statement

Before financial modeling can occur in Pass 3, the system must know **what can physically be built** on a site. This requires:

1. Knowing which jurisdiction governs the site
2. Knowing that jurisdiction's zoning, setback, coverage, stormwater, and fire access rules
3. Confirming whether storage use is even permitted

Without this knowledge, Pass 3 would be guessing — and guesses produce bad deals.

The problem: jurisdiction data is scattered across counties, municipalities, watersheds, fire districts, and state agencies. Researching this data is expensive and time-consuming. Repeating this research for every site in the same jurisdiction is wasteful.

---

## What Pass 2 Is

**Pass 2 = Jurisdiction Card Completion Engine**

Pass 2 exists solely to answer one question:

> *"Do we know enough about this jurisdiction to model a site?"*

Pass 2 compiles jurisdiction + geometric constraints into a **Jurisdiction Card** — a reusable artifact containing all regulatory constants needed for financial modeling.

### Pass 2 Responsibilities

1. Resolve ZIP code to jurisdiction(s)
2. Look up or create a Jurisdiction Card for (county × asset class)
3. Compile constraint values from the card
4. Calculate a buildability envelope (geometry only)
5. Determine if the card is complete enough for Pass 3
6. Flag missing data requiring manual research

### Pass 2 Outputs

- `jurisdiction_card_complete: boolean` — PRIMARY signal
- `required_fields_missing: string[]` — what's still needed
- `fatal_prohibitions: string[]` — e.g., "storage not permitted"
- `buildability: BuildabilityEnvelope` — physical limits
- `approval_checklist: ApprovalItem[]` — what permits are needed
- `provenance` — where the data came from

---

## What Pass 2 Is NOT

Pass 2 does **not**:

| Forbidden | Why |
|-----------|-----|
| Decide if a deal is good | That's Pass 3's job |
| Run financial math | No NOI, DSCR, IRR, revenue, costs |
| Estimate timelines | No permit durations, construction schedules |
| Score ROI | That's Pass 3 |
| Optimize layouts | That's Pass 3 |
| Guess missing inputs | Unknown ≠ false |

If a constraint value is unknown, Pass 2 reports it as unknown. It does not substitute a default or estimate.

---

## Jurisdiction Card Definition

A Jurisdiction Card is a **reusable data artifact** containing regulatory constants for a specific (county × asset class) combination.

### Card Identity

- `jurisdiction_id`: Unique ID for the jurisdiction
- `state`: 2-letter state code
- `county`: County name
- `municipality`: Municipality (if applicable)
- `asset_class`: `self_storage`, `rv_storage`, or `boat_storage`

### Card Contents — Allowed

| Category | Fields |
|----------|--------|
| **Zoning** | `storage_allowed`, `zoning_code`, setbacks (front/side/rear), `max_height_ft`, `max_stories`, `max_lot_coverage_pct`, `floor_area_ratio` |
| **Site Plan** | `min_parking_spaces`, `landscape_buffer_ft`, `landscape_pct_required`, `max_impervious_pct` |
| **Stormwater** | `stormwater_plan_required`, `detention_required`, `retention_required`, `infiltration_allowed`, `design_storm_event` |
| **Fire Access** | `fire_lane_required`, `fire_lane_width_ft`, `hydrant_spacing_ft`, `sprinkler_required` |
| **Grading** | `max_slope_pct`, `cut_fill_permit_required`, `erosion_control_required` |
| **Bonding** | `performance_bond_required`, `completion_bond_required`, `bond_amount_formula` |
| **Permits** | List of required permits with authority and description |
| **Provenance** | `source`, `confidence`, `verified_at`, `revalidation_required` |

### Card Contents — Forbidden

- Rent assumptions
- NOI / DSCR / IRR
- Timelines or permit durations
- Soft cost estimates
- Market demand data
- Parcel-specific engineering

**Cards store constants, not outcomes.**

---

## What "Complete" Means

A Jurisdiction Card is complete when:

1. All `REQUIRED_FOR_ENVELOPE` fields are known (not null, not blocked, not stale)
2. Zoning allowance is determined (`storage_allowed` is true/false, not null)
3. No `revalidation_required` flags are set on critical fields

### Required for Envelope

These fields MUST be known to calculate buildability:

- `setback_front_ft`
- `setback_side_ft`
- `setback_rear_ft`
- `max_lot_coverage_pct`
- `stormwater_plan_required`
- `fire_lane_required`

If ANY of these are unknown, EnvelopeReducer refuses to calculate and returns `HOLD_INCOMPLETE`.

### Completeness Status

| Status | Meaning |
|--------|---------|
| `ELIGIBLE` | Card is complete. Pass 3 can run. |
| `HOLD_INCOMPLETE` | Missing critical fields. Manual research required. |
| `NO_GO` | Fatal prohibition (e.g., storage not allowed). |

---

## How Pass 2 Enables Pass 3

Pass 3 is the financial modeling engine. It calculates:
- Build costs
- NOI projections
- DSCR
- IRR
- Max land price

But Pass 3 cannot run without knowing:
- How much can be built (buildability envelope)
- What permits are needed (affects soft costs and timeline risk)
- Whether the use is even permitted (fatal prohibition)

**Pass 2 gives Pass 3 clean, trusted constants.**

If `jurisdiction_card_complete = true`, Pass 3 can trust that:
- The envelope is calculable
- No critical data is missing
- The site is not fatally flawed

**A good Pass 2 makes Pass 3 boring.**

---

## Non-Goals and Explicit Exclusions

### Non-Goals

1. **Market analysis** — Pass 2 does not assess demand or competition
2. **Deal scoring** — Pass 2 does not rate deals as good/bad
3. **Timeline estimation** — Pass 2 does not estimate permit timelines
4. **Cost estimation** — Pass 2 does not estimate construction costs
5. **Layout optimization** — Pass 2 does not design the building

### Explicit Exclusions

1. **No financial fields** in input or output contracts
2. **No revenue projections** of any kind
3. **No timeline estimates** for permits or construction
4. **No soft cost estimates** for engineering, legal, etc.
5. **No deal recommendations** (go/no-go is constraint-based only)

---

## Success Criteria

Pass 2 is successful if:

| Criterion | Measure |
|-----------|---------|
| Answers the right question | "Do we know enough to model?" not "Is this a good deal?" |
| Never guesses | Unknown fields reported as unknown, not estimated |
| Produces reusable artifacts | Same card used for multiple sites in jurisdiction |
| Reduces research overhead | Incremental card updates, not full re-research |
| Pass 3 trusts blindly | If `ELIGIBLE`, Pass 3 can proceed without validation |
| Deterministic | Same input → same output |
| No financial contamination | Zero NOI, DSCR, IRR, revenue, cost fields |

---

## References

- ADR-019: Pass 2 Really Is
- ADR-020: Pass 2 Architectural Position
- PRS-PASS2-001: Pass 2 Execution Specification
- Doctrine: `docs/doctrine/Pass2ReallyIs.md`
