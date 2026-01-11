# SubHub3_Calculators — Anchor Definition

## Conformance

| Field | Value |
|-------|-------|
| **SubHub ID** | SubHub3_Calculators |
| **Doctrine Version** | 1.2.0 |
| **CC Layer** | CC-03 |

---

## Anchors

| Anchor | Type | Role |
|--------|------|------|
| **SVA (Sovereign ID)** | Primary | Decision container (intent) |

---

## Scope

- Feasibility calculations
- ROI modeling
- Density math
- Build cost modeling
- NOI projections
- IRR calculations
- Max land price derivation

---

## Constraints

- **READ-ONLY** — no geographic writes
- **NO data ingest** — consumes from SubHub0-2
- **PURE MATH** — calculations only

---

## IMO Mapping

| Layer | Components |
|-------|------------|
| **I (Ingress)** | Market data (SubHub1), CountyCard (SubHub2) |
| **M (Middle)** | CoverageEngine, NOIEngine, IRRModel, DebtModel |
| **O (Egress)** | Feasibility output to SubHub5_DealGate |

---

## Calculator Components

- `BuildCostModel.ts` — Construction cost estimation
- `CoverageEngine.ts` — Site coverage optimization
- `NOIEngine.ts` — Net Operating Income projection
- `IRRModel.ts` — Internal Rate of Return calculation
- `DebtModel.ts` — Financing structure modeling
- `MaxLandPrice.ts` — Residual land value derivation
- `UnitMixOptimizer.ts` — Unit mix optimization

---

## Anchor Invariants

```
ANCHOR_SVA: defines decision boundary
ALL_CALCS: must trace to SVA anchor
NO_GEO_WRITES: read-only from SubHub0-2
```

No calculation may execute without a valid SVA (Sovereign ID) anchor.
