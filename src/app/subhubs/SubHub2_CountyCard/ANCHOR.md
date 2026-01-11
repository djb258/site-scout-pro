# SubHub2_CountyCard — Anchor Definition

## Conformance

| Field | Value |
|-------|-------|
| **SubHub ID** | SubHub2_CountyCard |
| **Doctrine Version** | 1.2.0 |
| **CC Layer** | CC-03 |

---

## Anchors

| Anchor | Type | Role |
|--------|------|------|
| **County FIPS** | Primary | Jurisdiction & rules anchor |

---

## Scope

- Zoning regulations
- Ordinances & codes
- Build constants (setbacks, heights, FAR)
- Cost indices
- Permitting requirements
- Jurisdiction constraints

---

## Constraints

- **NO math/calculations** — rules and constants only
- **NO market data** — jurisdiction data only
- **NO parcel-level logic** — county-wide rules only

---

## IMO Mapping

| Layer | Components |
|-------|------------|
| **I (Ingress)** | JurisdictionResolver, JurisdictionCardReader |
| **M (Middle)** | ZoningConstraints, FireAccessConstraints, SitePlanConstraints |
| **O (Egress)** | CountyCard output to SubHub3_Calculators |

---

## Data Structures

- `jurisdiction_card.ts` — County rule container
- `constraint_types.ts` — Constraint definitions
- `guardrails.ts` — Hard limits from jurisdiction

---

## Anchor Invariants

```
ANCHOR_FIPS: defines jurisdiction boundary
ALL_RULES: must trace to County FIPS anchor
NO_MATH: rules only, calculations in SubHub3
```

No jurisdiction data may exist without a valid County FIPS anchor.
