# SubHub4_ParcelDiscovery — Anchor Definition

## Conformance

| Field | Value |
|-------|-------|
| **SubHub ID** | SubHub4_ParcelDiscovery |
| **Doctrine Version** | 1.2.0 |
| **CC Layer** | CC-03 |

---

## Anchors

| Anchor | Type | Role |
|--------|------|------|
| **ZIP** | Search | Initial parcel search anchor |
| **Parcel ID** | Promotion | Promoted asset identity (post-discovery) |

---

## Scope

- Parcel scanning within ZIP boundaries
- Parcel filtering & gating
- Parcel promotion (ZIP -> Parcel ID)
- Site identification

---

## Constraints

- **ZIP-bounded search** — cannot search outside ZIP
- **Parcel ID promotion** — only after discovery gate passes
- **NO calculations** — discovery & filtering only

---

## IMO Mapping

| Layer | Components |
|-------|------------|
| **I (Ingress)** | ZIP boundary, Market data (SubHub1), CountyCard (SubHub2) |
| **M (Middle)** | ParcelScanner, ParcelFilter, PromotionGate |
| **O (Egress)** | Promoted Parcel IDs to SubHub5_DealGate |

---

## Anchor Transition

```
SEARCH_PHASE:
  anchor: ZIP
  scope: all parcels in ZIP

PROMOTION_PHASE:
  anchor: Parcel ID
  scope: individual asset
  condition: passes discovery gate
```

---

## Anchor Invariants

```
ANCHOR_ZIP: bounds search space
ANCHOR_PARCEL: minted only after promotion
NO_ORPHAN_PARCELS: every Parcel ID traces to ZIP origin
```

Parcel IDs may only exist after successful promotion from ZIP-bounded discovery.
