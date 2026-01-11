# SubHub0_Signals — Anchor Definition

## Conformance

| Field | Value |
|-------|-------|
| **SubHub ID** | SubHub0_Signals |
| **Doctrine Version** | 1.2.0 |
| **CC Layer** | CC-03 |

---

## Anchors

| Anchor | Type | Role |
|--------|------|------|
| **ZIP** | Primary | Atomic data ingest & search anchor |
| **County FIPS** | Secondary | Jurisdiction & rules anchor |

---

## Scope

- Signals detection
- Permit activity monitoring
- Inspection chatter
- News & events tracking
- Trend signals

---

## Constraints

- **NO calculations** — signals only
- **NO geographic writes** — read-only from data sources
- **NO decision logic** — observation only

---

## IMO Mapping

| Layer | Components |
|-------|------------|
| **I (Ingress)** | PermitActivity, NewsEvents, TrendSignal |
| **M (Middle)** | MomentumFusion (aggregation only) |
| **O (Egress)** | Signal output to SubHub1_Market |

---

## Anchor Invariants

```
ANCHOR_ZIP: immutable after ingest
ANCHOR_FIPS: derived from ZIP, immutable
```

No data may exist in this SubHub without a valid ZIP anchor.
