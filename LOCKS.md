# LOCKS.md — Doctrine-Locked Artifacts

> **DO NOT MODIFY** without ADR approval and doctrine review.

---

## Enums (Schema-Locked)

These enums are used across multiple systems. Changing them breaks contracts.

| Enum | Schema | Used By | Lock Level |
|------|--------|---------|------------|
| `ref.automation_method` | ref | CCA, Lovable dispatch | 🔴 HARD |
| `ref.coverage_level` | ref | CCA | 🔴 HARD |
| `ref.recon_confidence` | ref | CCA | 🔴 HARD |
| `pass2.ternary` | pass2 | All Pass 2 tables | 🔴 HARD |
| `pass2.knowledge_state` | pass2 | All Pass 2 provenance | 🔴 HARD |
| `pass2.source_type` | pass2 | All Pass 2 provenance | 🔴 HARD |
| `pass2.authority_scope` | pass2 | Pass 2 jurisdiction | 🔴 HARD |
| `pass2.authority_model` | pass2 | Pass 2 jurisdiction | 🔴 HARD |
| `pass2.zoning_model` | pass2 | Pass 2, CCA detection | 🔴 HARD |
| `pass2.asset_class` | pass2 | Pass 2 scope | 🟡 SOFT |

**To add a new enum value:** Create ADR, update migration, update all consumers.

---

## Single-Writer Functions

Only ONE system may write to these. All others are read-only.

| Table/Function | Writer | Readers | Violation = |
|----------------|--------|---------|-------------|
| `ref.county_capability` | CCA Recon Agent | Pass 0, Pass 2, Lovable | Data corruption |
| `pass2.jurisdiction_scope` | Pass 2 Hydrator | Pass 3 | Trust violation |
| `pass2.use_viability` | Pass 2 Hydrator | Pass 3 | Trust violation |
| `pass2.zoning_envelope` | Pass 2 Hydrator | Pass 3 | Trust violation |
| `pass2.fire_life_safety` | Pass 2 Hydrator | Pass 3 | Trust violation |
| `pass2.stormwater_environmental` | Pass 2 Hydrator | Pass 3 | Trust violation |
| `pass2.parking_access` | Pass 2 Hydrator | Pass 3 | Trust violation |

**Lovable/UI may NEVER write to these tables directly.**

---

## Confidence Rules (Logic-Locked)

These rules are doctrine. Changing them changes system behavior.

### Confidence Can Only Go Down

```
high → medium → low → unknown
  ↓       ↓       ↓
  OK      OK      OK

unknown → low → medium → high
    ↓      ↓       ↓       ↓
    OK     ❌      ❌      ❌  (NEVER upgrade without citation)
```

### REQUIRED_FOR_ENVELOPE (Geometry Gating)

Pass 3 CANNOT run without these being `known`:
- `setback_front`
- `setback_side`
- `setback_rear`
- `max_lot_coverage`
- `max_height`

**Enforcement:** `pass2.is_envelope_complete()` function, `v_jurisdiction_card_for_pass3` view.

---

## Tool Selection Priority (Order-Locked)

```
1. API          (deterministic)
2. Scrape       (Firecrawl)
3. Portal       (interactive)
4. AI-Assisted  (Retell — LAST RESORT)
5. Manual       (human queue)
```

**Pass 3 tools:** Deterministic ONLY. No AI. Ever.

---

## Import Restrictions

### Stage-1 Writers (CCA, Pass 2 Hydrator)

These modules have write access. UI/Lovable must NOT import them.

```
🚫 DO NOT IMPORT FROM UI/LOVABLE:
├── src/cca/service/CcaService.ts (write methods)
├── src/cca/agent/CcaReconAgent.ts
├── src/pass2/hydrators/*  (when created)
└── Any function that INSERTs or UPDATEs ref.* or pass2.*
```

### Safe Imports (Read-Only)

```
✅ SAFE FOR UI/LOVABLE:
├── src/cca/consumers/Pass0Consumer.ts
├── src/cca/consumers/Pass2Consumer.ts
├── src/pass2/types/*
└── Any SELECT-only view or function
```

---

## TTL Rules (Time-Locked)

| Asset | Default TTL | Refresh Trigger |
|-------|-------------|-----------------|
| CCA | 12 months | `ref.needs_refresh()` returns TRUE |
| Pass 2 facts | None (manual) | Field-level `ttl_date` |

**CCA expiration triggers re-recon, NOT data deletion.**

---

## View Contracts (Interface-Locked)

These views are consumed by downstream systems. Column changes break contracts.

| View | Consumer | Contract |
|------|----------|----------|
| `ref.v_cca_dispatch` | Lovable | Dispatch decisions |
| `pass2.v_jurisdiction_card_for_pass3` | Pass 3 | All facts for calculations |

**To add columns:** OK (additive).
**To remove/rename columns:** ADR required, consumer update required.

---

## Prime Rules (Doctrine-Locked)

These are not code — they are laws.

1. **"Claude thinks. Neon remembers. Lovable orchestrates."**
2. **"Pass 2 defines WHAT is true. CCA defines HOW to collect it."**
3. **"Pass 3 is boring by design."**
4. **"Unknown is valid. Guessing is forbidden."**
5. **"If Pass 2 lies, that's a Pass 2 bug — not Pass 3's problem."**

---

## Lock Levels

| Level | Meaning | Change Process |
|-------|---------|----------------|
| 🔴 HARD | Breaking change | ADR + migration + all consumers |
| 🟡 SOFT | Additive OK | ADR + migration |
| 🟢 OPEN | Free to modify | PR review |
