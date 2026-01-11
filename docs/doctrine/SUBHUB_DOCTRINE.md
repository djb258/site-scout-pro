# SubHub Doctrine

**Defines the anchor-based architecture for the Storage Site Go/No-Go Engine.**

## Conformance

| Field | Value |
|-------|-------|
| **Doctrine Version** | 1.2.0 |
| **Authority** | Hub-Spoke Architecture Doctrine |
| **CC Layer** | CC-03 |
| **Status** | LOCKED |

---

## Overview

SubHubs are **workers** within the parent Hub. They are not independent applications — they are bounded contexts with explicit **anchors** that define their data boundaries and responsibilities.

> **Mental Model:**
> - SubHubs are **workers**
> - Anchors do **not move**
> - Sovereign IDs come from **intent**, not data

---

## 1. Anchor Definitions (AUTHORITATIVE)

| Anchor | Type | Role | Immutability |
|--------|------|------|--------------|
| **ZIP** | Atomic | Data ingest & search anchor | Immutable after ingest |
| **County FIPS** | Jurisdiction | Jurisdiction & rules anchor | Derived from ZIP, immutable |
| **SVA** | Sovereign | Decision container (intent) | Minted by user intent |
| **Parcel ID** | Asset | Promoted asset identity | Post-discovery only |

### Anchor Invariants

1. **No data without anchor** — Every piece of data must trace to an anchor
2. **Anchors do not move** — Once assigned, anchors are immutable
3. **SVA comes from intent** — Sovereign IDs are minted by user action, not derived from data
4. **Parcel ID is earned** — Only exists after promotion through SubHub4

---

## 2. SubHub Definitions (LOCKED)

### SubHub0_Signals

| Field | Value |
|-------|-------|
| **Anchor** | ZIP + County FIPS |
| **Scope** | Signals, inspections, permits chatter |
| **Constraint** | NO CALCULATIONS |

### SubHub1_Market

| Field | Value |
|-------|-------|
| **Anchor** | ZIP |
| **Scope** | Demand, population, competitors |
| **Constraint** | NO ZONING OR RULES |

### SubHub2_CountyCard

| Field | Value |
|-------|-------|
| **Anchor** | County FIPS |
| **Scope** | Zoning, ordinances, build constants, cost indices |
| **Constraint** | NO MATH |

### SubHub3_Calculators

| Field | Value |
|-------|-------|
| **Anchor** | SVA |
| **Scope** | Feasibility, ROI, density math |
| **Constraint** | READ-ONLY (no geography writes) |

### SubHub4_ParcelDiscovery

| Field | Value |
|-------|-------|
| **Anchor** | ZIP (search) -> Parcel ID (promotion) |
| **Scope** | Parcel scanning & gating |
| **Constraint** | ZIP-bounded search only |

### SubHub5_DealGate

| Field | Value |
|-------|-------|
| **Anchor** | SVA + Parcel ID |
| **Scope** | Doctrine enforcement |
| **Output** | GOOD_DEAL / BAD_DEAL (binary) |

---

## 3. Data Flow

```
           ZIP
            │
    ┌───────┴───────┐
    │               │
    ▼               ▼
SubHub0         SubHub1
(Signals)       (Market)
    │               │
    │   FIPS        │
    │     │         │
    ▼     ▼         │
  SubHub2           │
  (CountyCard)      │
    │               │
    └───────┬───────┘
            │
            ▼
        SVA (intent)
            │
            ▼
        SubHub3
      (Calculators)
            │
            │     ZIP
            │      │
            │      ▼
            │   SubHub4
            │   (ParcelDiscovery)
            │      │
            │      ▼ Parcel ID
            │      │
            └──────┤
                   │
                   ▼
               SubHub5
             (DealGate)
                   │
                   ▼
           GOOD_DEAL / BAD_DEAL
```

---

## 4. Anchor Validation Rules

### ZIP Anchor
```
- Format: 5-digit US ZIP code
- Validation: Census API lookup
- Immutable: After first ingest
```

### County FIPS Anchor
```
- Format: 5-digit FIPS code (2 state + 3 county)
- Derivation: From ZIP via Census crosswalk
- Immutable: Derived, never modified
```

### SVA (Sovereign ID) Anchor
```
- Format: SVA-{TIMESTAMP}-{USER_ID}-{RANDOM}
- Minting: User intent (search initiation)
- Immutable: From creation
```

### Parcel ID Anchor
```
- Format: {FIPS}-{APN}
- Minting: Only via SubHub4 promotion gate
- Immutable: After promotion
```

---

## 5. Constraint Enforcement

| SubHub | Constraint | Enforcement |
|--------|------------|-------------|
| SubHub0 | NO_CALCULATIONS | Static analysis: no math operators |
| SubHub1 | NO_ZONING | Import guard: no FIPS-based rules |
| SubHub2 | NO_MATH | Static analysis: rules only |
| SubHub3 | READ_ONLY | Runtime guard: no geography mutations |
| SubHub4 | ZIP_BOUNDED | Query guard: ZIP in WHERE clause |
| SubHub5 | BINARY_OUTPUT | Type enforcement: verdict enum only |

---

## 6. Hard Violations

| Violation | Type | Example |
|-----------|------|---------|
| Anchor mutation | ANCHOR_VIOLATION | Changing ZIP after ingest |
| Cross-anchor access | BOUNDARY_VIOLATION | SubHub1 reading FIPS data |
| Orphan data | DATA_VIOLATION | Parcel without ZIP origin |
| Constraint breach | CONSTRAINT_VIOLATION | Math in SubHub2 |
| Partial verdict | OUTPUT_VIOLATION | Non-binary DealGate output |

---

## Traceability

| Artifact | Reference |
|----------|-----------|
| Hub-Spoke Architecture | templates/doctrine/HUB_SPOKE_ARCHITECTURE.md |
| Canonical Architecture | templates/doctrine/CANONICAL_ARCHITECTURE_DOCTRINE.md |
| REGISTRY | REGISTRY.yaml |

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-01-11 |
| Last Modified | 2026-01-11 |
| Doctrine Version | 1.2.0 |
| Status | LOCKED |
| Change Protocol | ADR-triggered only |
