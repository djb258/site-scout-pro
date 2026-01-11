# SubHub1_Market — Anchor Definition

## Conformance

| Field | Value |
|-------|-------|
| **SubHub ID** | SubHub1_Market |
| **Doctrine Version** | 1.2.0 |
| **CC Layer** | CC-03 |

---

## Anchors

| Anchor | Type | Role |
|--------|------|------|
| **ZIP** | Primary | Market area definition |

---

## Scope

- Demand analysis (population, demographics)
- Supply analysis (competitors, inventory)
- Market scoring (hotspots)
- Rent reconciliation (rate evidence)
- Coverage confidence

---

## Constraints

- **NO zoning or rules** — market data only
- **NO County FIPS logic** — ZIP-anchored only
- **NO parcel-level data** — market aggregates only

---

## IMO Mapping

| Layer | Components |
|-------|------------|
| **I (Ingress)** | MacroDemand, MacroSupply, CompetitorRegistry |
| **M (Middle)** | HotspotScoring, RadiusBuilder, ZipHydration |
| **O (Egress)** | Market output to SubHub2_CountyCard |

---

## Sub-Components

- `structure_hub/` — Core market analysis
- `rent_recon/` — Rent rate reconciliation (rate evidence, AI calls)

---

## Anchor Invariants

```
ANCHOR_ZIP: defines market boundary
ALL_DATA: must trace to ZIP anchor
```

No market data may exist without a valid ZIP anchor.
