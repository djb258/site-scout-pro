# Pass 2 Constraint Compiler — Compliance Checklist

**Doctrine ID:** SS.02.00
**Last Updated:** 2025-12-18
**Status:** [ ] Compliant / [ ] Non-Compliant
**Supersedes:** PASS2_UNDERWRITING_HUB_COMPLIANCE.md (deprecated)

---

This checklist must be completed before any changes to Pass 2 can ship.
No exceptions. No partial compliance.

**Reference Documents:**
- ADR-019: Pass 2 Really Is
- ADR-020: Pass 2 Constraint Compiler Architectural Position
- ADR-022: County Capability Asset
- Doctrine: `SYSTEM_PROMPT_PASS2.md`

---

## Pre-Ship Checklist

### 1. Doctrine Compliance (CRITICAL)

- [ ] Pass 2 performs **NO financial calculations** (no NOI, DSCR, IRR, costs)
- [ ] Pass 2 performs **NO timeline estimations** (no permit durations)
- [ ] Pass 2 performs **NO deal scoring or rankings**
- [ ] Pass 2 performs **NO recommendations** (no "good/bad" language)
- [ ] Missing constraints result in `HOLD_INCOMPLETE`, not estimation
- [ ] Unknown values are `null`, never substituted with defaults

### 2. Jurisdiction Card Enforcement

- [ ] Cards are keyed by **(county × asset_class)**
- [ ] Each constraint field has `knowledge_state` (known/unknown/blocked)
- [ ] Each constraint field has `criticality` level
- [ ] Each constraint field has `authority_scope`
- [ ] Each constraint field has provenance (source + verified_at)
- [ ] Completeness defined ONLY by `REQUIRED_FOR_ENVELOPE` fields
- [ ] Staleness check: `revalidation_required` treated as unknown

### 3. County Capability Asset Integration

- [ ] CCA is read from `ref.ref_county_capability`
- [ ] CCA is consulted BEFORE any hydration attempt
- [ ] If `automation_viable = false`, no scraping attempted
- [ ] Expired CCA profiles (>12 months) treated as unknown
- [ ] CCA is never mutated by Pass 2 (read-only)

### 4. EnvelopeReducer Guardrails

- [ ] REFUSES calculation if ANY `REQUIRED_FOR_ENVELOPE` field is unknown
- [ ] REFUSES calculation if ANY `REQUIRED_FOR_ENVELOPE` field is blocked
- [ ] REFUSES calculation if ANY `REQUIRED_FOR_ENVELOPE` field is stale
- [ ] Returns `envelope_valid: false` with reasons when refusing
- [ ] Only calculates geometry (setbacks, coverage, net acres)
- [ ] NO financial calculations in EnvelopeReducer

### 5. Output Contract Compliance

**ALLOWED fields:**
- [ ] `jurisdiction_card_complete: boolean`
- [ ] `required_fields_missing: string[]`
- [ ] `fatal_prohibitions: string[]`
- [ ] `net_buildable_acres` (only if complete)
- [ ] `max_buildable_sqft` (only if complete)
- [ ] `status: 'ELIGIBLE' | 'HOLD_INCOMPLETE' | 'NO_GO'`

**FORBIDDEN fields (must NOT exist):**
- [ ] NO `noi` or any NOI derivative
- [ ] NO `dscr` or debt calculations
- [ ] NO `cap_rate` or valuation
- [ ] NO `deal_index` or scoring
- [ ] NO `verdict: GO/MAYBE` (only ELIGIBLE/HOLD/NO_GO)
- [ ] NO financial recommendations

### 6. Determinism Verification

- [ ] Same inputs produce identical outputs (excluding timestamps)
- [ ] No randomness in any calculation
- [ ] No retries inside execution path
- [ ] No time-based branching
- [ ] Hydration workflows are external to compilation

### 7. Spoke Compliance (9 Spokes)

| Spoke | Doctrine ID | No Finance | No Guessing | Tests |
|-------|-------------|------------|-------------|-------|
| JurisdictionResolver | SS.02.01 | [ ] | [ ] | [ ] |
| JurisdictionCardReader | SS.02.02 | [ ] | [ ] | [ ] |
| ZoningConstraints | SS.02.03 | [ ] | [ ] | [ ] |
| SitePlanConstraints | SS.02.04 | [ ] | [ ] | [ ] |
| StormwaterConstraints | SS.02.05 | [ ] | [ ] | [ ] |
| FireAccessConstraints | SS.02.06 | [ ] | [ ] | [ ] |
| PermittingChecklist | SS.02.07 | [ ] | [ ] | [ ] |
| EnvelopeReducer | SS.02.08 | [ ] | [ ] | [ ] |
| ConstraintVerdict | SS.02.09 | [ ] | [ ] | [ ] |

### 8. Failure Handling

- [ ] Missing required fields → `HOLD_INCOMPLETE`
- [ ] Prohibited use → `NO_GO`
- [ ] Conflicting authorities → `blocked`
- [ ] Stale data → treated as `unknown`
- [ ] Never guess, never smooth over gaps

### 9. Testing Requirements

- [ ] All unit tests passing
- [ ] Guardrail tests passing (EnvelopeReducer refusal)
- [ ] Determinism tests passing
- [ ] Doctrine compliance tests passing
- [ ] No financial calculations anywhere in test assertions

---

## Doctrine Violations (Auto-Reject)

Any of these trigger automatic rejection:

| Violation | Description |
|-----------|-------------|
| `FINANCE_IN_PASS2` | NOI, DSCR, IRR, or cost calculations in Pass 2 |
| `ESTIMATION` | Guessing or inferring missing constraints |
| `DEAL_SCORING` | Rankings, scores, or recommendations |
| `CCA_MUTATION` | Pass 2 writes to County Capability Asset |
| `TIMELINE_ESTIMATION` | Permit duration or construction timeline |
| `FALSE_CERTAINTY` | Substituting defaults for unknown values |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Doctrine Owner | | | |
| Reviewer | | | |
| QA | | | |

---

## Compliance Rule

**If any required box is unchecked, this change may not ship.**

> **A good Pass 2 makes Pass 3 boring.**
