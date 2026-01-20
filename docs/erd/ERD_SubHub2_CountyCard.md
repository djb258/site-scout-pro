# ERD: Sub-Hub 2 — County Card / Jurisdiction Rules

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)  
> **CC Layer:** CC-03 (Context Artifacts)

## Ownership Declaration

- **Hub:** Sub-Hub 2
- **Anchor:** County FIPS
- **Anchor Invariant:** All rows must trace to exactly one County FIPS.
- **Authority:** WRITE for owned tables, READ-ONLY for referenced tables
- **Purpose:** Collect and validate jurisdiction rules (zoning, permitting, setbacks)

---

## Tables Owned (WRITE)

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `county_card_master` | `county_fips` (string) | Canonical jurisdiction rules per county |
| `county_card_raw` | `raw_id` (UUID) | Append-only raw evidence collection |
| `county_card_sources` | `raw_id` + `county_fips` | Links raw evidence to master records |
| `jurisdiction_card_drafts` | `id` (UUID) | Draft jurisdiction cards (staging) |
| `jurisdiction_collection_log` | `id` (UUID) | Collection run tracking |

---

## Tables Referenced (READ-ONLY)

| Table | Owner | Purpose |
|-------|-------|---------|
| `sovereign_id_counties` | Shared/Ref | SVA → County scope mapping |
| `ref_zip_replica` | Shared/Ref | ZIP → County resolution |
| `competitor_facilities` | Sub-Hub 1 | County context for facilities |

---

## Key Relationships

```
county_card_sources.county_fips → county_card_master.county_fips
county_card_sources.raw_id → county_card_raw.raw_id
jurisdiction_card_drafts.county_id → (external county reference)
```

---

## Mermaid ERD

See: [ERD_SubHub2_CountyCard.mermaid](./ERD_SubHub2_CountyCard.mermaid)

---

## Cross-Hub Rules

- Sub-Hub 3 (Calculators) may READ county_card_master for zoning constraints
- Sub-Hub 4 (Parcel) may READ county_card_master for site evaluation
- No other sub-hub may WRITE to these tables

---

## Raw → Master Architecture

Following Pass 3 doctrine:
1. **Raw (append-only):** `county_card_raw` stores immutable evidence
2. **Master (canonical):** `county_card_master` stores validated facts
3. **Sources (links):** `county_card_sources` traces every fact to evidence
