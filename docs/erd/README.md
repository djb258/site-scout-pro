# ERD Directory — Sub-Hub Data Ownership

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)  
> **CC Layer:** CC-03 (Context Artifacts)  
> **Status:** EXECUTABLE LAW

## Purpose

This directory contains Entity-Relationship Diagrams (ERDs) for each Sub-Hub in the Barton Storage System. Each ERD documents:

- Tables **owned** (WRITE authority) by that sub-hub
- Tables **referenced** (READ-ONLY) from other sub-hubs
- Primary keys, foreign keys, and cardinality
- Ownership annotations

## Sub-Hub ERD Index

| Sub-Hub | ERD File | Anchor Entity | Primary Tables |
|---------|----------|---------------|----------------|
| 0 | [ERD_SubHub0_Signals](./ERD_SubHub0_Signals.md) | ZIP | pass0_signals, pass0_run_log |
| 1 | [ERD_SubHub1_Market](./ERD_SubHub1_Market.md) | ZIP | pass1_*, facility_*, competitor_facilities |
| 2 | [ERD_SubHub2_CountyCard](./ERD_SubHub2_CountyCard.md) | County FIPS | county_card_*, jurisdiction_* |
| 3 | [ERD_SubHub3_Calculators](./ERD_SubHub3_Calculators.md) | SVA | calculators_state, pass2_* |
| 4 | [ERD_SubHub4_Parcel](./ERD_SubHub4_Parcel.md) | Parcel ID | site_*_staging |
| 5 | [ERD_SubHub5_DealGate](./ERD_SubHub5_DealGate.md) | SVA | (decision logs - future) |
| Shared | [ERD_Shared_Ref](./ERD_Shared_Ref.md) | Multiple | sovereign_ids, ref_zip_replica |

## Governance Rules

See [ERD_DISCIPLINE.md](./ERD_DISCIPLINE.md) for enforcement rules.

## File Format

Each sub-hub has two files:
- `ERD_SubHubX_{Name}.md` — Documentation with ownership table
- `ERD_SubHubX_{Name}.mermaid` — Mermaid diagram source

## Cross-Hub Ownership Rule

**If a table appears in multiple sub-hubs, it is WRITE in exactly one and READ-ONLY everywhere else.**

No exceptions. No shared writes. No ambiguity.
