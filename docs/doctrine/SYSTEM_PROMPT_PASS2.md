# Pass 2 Constraint Compiler — System Prompt (Process Lock)

> **READ THIS COMPLETELY BEFORE WRITING OR MODIFYING ANY PASS 2 CODE.**

You are working inside the **Storage Site Scout** system.

You are modifying **Pass 2 only**.

---

## Position in the Pipeline

```
Pass 0   → Momentum & Signals (throttled by County Capability Asset)
Pass 1   → Market Structure
Pass 1.5 → Rate Evidence
Pass 2   → CONSTRAINT COMPILER  ← YOU ARE HERE
Pass 3   → Financial Math & Reverse Solve
```

Pass 2 exists to make Pass 3 boring and deterministic.

---

## What Pass 2 IS

Pass 2 is a **Constraint Compiler**.

Its only job is to:

> Compile **jurisdictional and geometric constraints** into a deterministic, auditable **buildability envelope**.

---

## What Pass 2 IS ALLOWED TO DO

You MAY:

* Resolve ZIP → County
* Load **County Capability Asset (CCA)** from `ref.ref_county_capability`
* Read **Jurisdiction Cards** (`county × asset_class`)
* Detect **missing**, **blocked**, or **stale** constraint fields
* Route hydration based on **capability** (automation vs manual)
* Enforce **constraint criticality**
* Compute **geometry-only envelope**:
  * setbacks
  * coverage
  * buffers
  * net buildable acres
* Emit deterministic status:
  * `ELIGIBLE`
  * `HOLD_INCOMPLETE`
  * `NO_GO`
* Preserve provenance and authority scope

---

## What Pass 2 IS NOT ALLOWED TO DO

You MUST NOT:

* Compute revenue, NOI, DSCR, IRR, yield, or costs
* Estimate timelines or approval duration
* Guess or infer missing constraints
* Override County Capability classifications
* Promote deals or rank sites
* Emit recommendations or deal scores
* Hydrate constraints beyond what capability allows
* Call Pass 3 logic

**If required information is missing, the correct action is HOLD, not estimation.**

---

## Jurisdiction Card Doctrine

* One Jurisdiction Card per **(county × asset_class)**
* Cards are reusable across multiple sites
* Each constraint field includes:
  * `knowledge_state`: `known | unknown | blocked`
  * `criticality`: `REQUIRED_FOR_ENVELOPE | REQUIRED_FOR_APPROVAL | INFORMATIONAL`
  * `authority_scope`
  * provenance (source + verified_at)
* **Unknown ≠ false**
* **Blocked ≠ failed**

Completeness is defined **only** by REQUIRED_FOR_ENVELOPE fields.

---

## County Capability Integration (MANDATORY)

Before attempting any hydration:

```typescript
if (!county_capability.automation_viable) {
  // DO NOT scrape
  // DO NOT infer
  // DO NOT retry
}
```

Manual or Retell pathways must be explicit and logged.

Expired capability records are treated as `unknown`.

---

## Determinism Rules

* Same inputs → same outputs
* No randomness
* No retries inside execution
* No time-based branching

Hydration workflows are **external** to compilation.

---

## Output Contract (STRICT)

Pass 2 output MAY include:

* `jurisdiction_card_complete: boolean`
* `required_fields_missing: string[]`
* `fatal_prohibitions: string[]`
* `net_buildable_acres` **only if complete**

Pass 2 output MUST NOT include:

* Deal scores
* Rankings
* Financial metrics
* Recommendations
* "Good / bad" language

---

## Failure Handling

* Missing required fields → `HOLD_INCOMPLETE`
* Prohibited use → `NO_GO`
* Conflicting authorities → `blocked`
* Stale data → treated as `unknown`

**Never guess. Never smooth over gaps.**

---

## Prime Directive

> **A good Pass 2 makes Pass 3 boring.**

If your change makes Pass 3 more complex or speculative, it is wrong.

---

## Final Instruction

When implementing or modifying Pass 2 code:

* Enforce doctrine over convenience
* Prefer `HOLD` over estimation
* Prefer `unknown` over false certainty
* Prefer traceability over terseness

---

## References

* ADR-019: Pass 2 Really Is
* ADR-020: Pass 2 Constraint Compiler Architectural Position
* ADR-022: County Capability Asset as Cross-Pass Infrastructure
* Doctrine: `docs/doctrine/Pass2ReallyIs.md`
* Doctrine: `docs/doctrine/CountyCapabilityAsset.md`
