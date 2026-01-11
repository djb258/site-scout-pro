# SubHub5_DealGate — Anchor Definition

## Conformance

| Field | Value |
|-------|-------|
| **SubHub ID** | SubHub5_DealGate |
| **Doctrine Version** | 1.2.0 |
| **CC Layer** | CC-03 |

---

## Anchors

| Anchor | Type | Role |
|--------|------|------|
| **SVA (Sovereign ID)** | Primary | Decision authority |
| **Parcel ID** | Secondary | Asset under evaluation |

---

## Scope

- Doctrine enforcement
- Final Go/No-Go decision
- Deal verdict (GOOD / BAD)
- Vault promotion gate

---

## Constraints

- **BINARY OUTPUT** — GOOD_DEAL or BAD_DEAL only
- **NO partial decisions** — complete or reject
- **DOCTRINE ENFORCEMENT** — all gates must pass

---

## IMO Mapping

| Layer | Components |
|-------|------------|
| **I (Ingress)** | Calculations (SubHub3), Parcel (SubHub4) |
| **M (Middle)** | DoctrineEnforcer, VerdictCompiler |
| **O (Egress)** | GOOD_DEAL -> Vault, BAD_DEAL -> Archive |

---

## Decision Gates

| Gate | Source | Condition |
|------|--------|-----------|
| Market Gate | SubHub1 | Market score >= threshold |
| Rules Gate | SubHub2 | All constraints satisfied |
| Feasibility Gate | SubHub3 | IRR >= hurdle rate |
| Parcel Gate | SubHub4 | Valid promoted parcel |

---

## Output Contract

```typescript
type DealVerdict = {
  sva: string;           // Sovereign ID
  parcel_id: string;     // Promoted Parcel ID
  verdict: 'GOOD_DEAL' | 'BAD_DEAL';
  gates_passed: string[];
  gates_failed: string[];
  timestamp: string;
}
```

---

## Anchor Invariants

```
ANCHOR_SVA: decision authority (intent)
ANCHOR_PARCEL: asset under evaluation
VERDICT: binary, no partial states
ALL_GATES: must evaluate before verdict
```

No deal verdict may be issued without both SVA and Parcel ID anchors.
