# Lovable.dev Database Schema Reference

> **"Claude thinks. Neon remembers. Lovable orchestrates."**

This document defines the database schema that Lovable.dev must mirror in its Supabase/Neon instance.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              LOVABLE.DEV                                 │
│                          (UI / Orchestrator)                             │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
         ┌──────────────────┐            ┌──────────────────┐
         │   ref schema     │            │   pass2 schema   │
         │   (CCA Table)    │            │   (6 Tables)     │
         │                  │            │                  │
         │  HOW to collect  │◄──FK───────│  WHAT is true    │
         │  Dispatch-only   │            │  Facts only      │
         │  TTL-governed    │            │  + Provenance    │
         └──────────────────┘            └──────────────────┘
                                                  │
                                                  ▼
                                    ┌──────────────────────────┐
                                    │ pass2.v_jurisdiction_    │
                                    │   card_for_pass3         │
                                    │                          │
                                    │  (Pass 3 reads blindly)  │
                                    └──────────────────────────┘
```

---

## Schema 1: `ref.county_capability` (CCA)

**Purpose:** Dispatch table. HOW to collect data. TTL-governed. Cross-pass.

### Table: `ref.county_capability`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `county_id` | BIGINT | **Immutable, unique** - FK target for all pass2 tables |
| `state` | VARCHAR(2) | State code (TX, FL, etc.) |
| `county_name` | VARCHAR(100) | County name |
| `county_fips` | VARCHAR(5) | FIPS code |

#### Pass 0 Capability (Permits & Inspections)

| Column | Type | Description |
|--------|------|-------------|
| `pass0_method` | ENUM | `api \| scrape \| portal \| manual` |
| `pass0_source_pointer` | TEXT | URL or system identifier |
| `pass0_coverage` | ENUM | `full \| partial \| insufficient` |
| `pass0_notes` | TEXT | Notes about capability |
| `pass0_vendor` | VARCHAR(50) | e.g., 'accela', 'tyler' |
| `pass0_has_api` | BOOLEAN | API available? |
| `pass0_has_portal` | BOOLEAN | Portal available? |
| `pass0_inspections_linked` | BOOLEAN | NULL = unknown |

#### Pass 2 Capability (Jurisdiction Facts)

| Column | Type | Description |
|--------|------|-------------|
| `pass2_method` | ENUM | `api \| scrape \| portal \| manual` |
| `pass2_source_pointer` | TEXT | URL or system identifier |
| `pass2_coverage` | ENUM | `full \| partial \| insufficient` |
| `pass2_notes` | TEXT | Notes about capability |
| `pass2_zoning_model_detected` | ENUM | What CCA detected (NOT the fact) |
| `pass2_ordinance_format` | VARCHAR(20) | 'html', 'pdf_searchable', etc. |
| `pass2_planning_url` | TEXT | Planning department URL |
| `pass2_ordinance_url` | TEXT | Zoning ordinance URL |
| `pass2_zoning_map_url` | TEXT | Zoning map URL |

#### Meta

| Column | Type | Description |
|--------|------|-------------|
| `confidence` | ENUM | `low \| medium \| high` |
| `evidence_links` | TEXT[] | Array of evidence URLs |
| `verified_at` | TIMESTAMPTZ | When CCA was verified |
| `ttl_months` | SMALLINT | TTL in months (default 12) |
| `expires_at` | TIMESTAMPTZ | **COMPUTED**: verified_at + ttl_months |
| `version` | INTEGER | Optimistic locking |

---

## Schema 2: `pass2.*` (Jurisdiction Card - 6 Tables)

**Purpose:** WHAT is true about a jurisdiction. Facts + Provenance only.

**Key Doctrine:**
- Tables store FACTS, not pipeline hints
- Unknown is valid everywhere (incremental hydration)
- REQUIRED_FOR_ENVELOPE enforced at view/function level only
- All tables FK to `ref.county_capability(county_id)`

### Provenance Pattern (every field)

For each fact field, include these columns:
```
field_name              TYPE,
field_name_state        knowledge_state DEFAULT 'unknown',
field_name_source       source_type,
field_name_ref          TEXT
```

---

### Table A: `pass2.jurisdiction_scope`

**Purpose:** Who governs and at what level

| Column | Type | Description |
|--------|------|-------------|
| `county_id` | BIGINT | FK → ref.county_capability |
| `county_name` | VARCHAR(100) | Denormalized |
| `state` | VARCHAR(2) | Denormalized |
| `county_fips` | VARCHAR(5) | Denormalized |
| `asset_class` | ENUM | `self_storage \| rv_storage \| trailer_yard \| boat_storage \| other` |
| `authority_model` | ENUM | `county \| municipal \| mixed \| none` |
| `authority_model_state` | ENUM | `known \| unknown \| blocked` |
| `authority_model_source` | ENUM | `ordinance \| pdf \| portal \| human` |
| `authority_model_ref` | TEXT | Source reference |
| `zoning_model` | ENUM | `no_zoning \| county \| municipal \| mixed` |
| `zoning_model_state` | ENUM | knowledge_state |
| `zoning_model_source` | ENUM | source_type |
| `zoning_model_ref` | TEXT | Source reference |
| `controlling_authority_name` | TEXT | Authority name |
| `controlling_authority_contact` | TEXT | Contact info |

---

### Table B: `pass2.use_viability`

**Purpose:** Binary gating - should we continue?

| Column | Type | Description |
|--------|------|-------------|
| `storage_allowed` | ENUM | `yes \| no \| unknown` |
| `storage_allowed_state` | ENUM | knowledge_state |
| `storage_allowed_source` | ENUM | source_type |
| `storage_allowed_ref` | TEXT | |
| `storage_allowed_scope` | ENUM | `county \| municipal \| fire_district \| state` |
| `fatal_prohibition` | ENUM | `yes \| no \| unknown` |
| `fatal_prohibition_description` | TEXT | What the prohibition is |
| `conditional_use_required` | ENUM | `yes \| no \| unknown` |
| `discretionary_required` | ENUM | `yes \| no \| unknown` |
| `general_notes` | TEXT | |

---

### Table C: `pass2.zoning_envelope`

**Purpose:** Numeric constraints for geometry. REQUIRED_FOR_ENVELOPE enforced at view level.

#### Setbacks (feet)
| Column | Type | REQUIRED_FOR_ENVELOPE |
|--------|------|----------------------|
| `setback_front` | NUMERIC(8,2) | **YES** |
| `setback_side` | NUMERIC(8,2) | **YES** |
| `setback_rear` | NUMERIC(8,2) | **YES** |

#### Coverage / Intensity
| Column | Type | REQUIRED_FOR_ENVELOPE |
|--------|------|----------------------|
| `max_lot_coverage` | NUMERIC(5,2) % | **YES** |
| `max_far` | NUMERIC(5,2) | No |
| `min_open_space` | NUMERIC(5,2) % | No |
| `max_height` | NUMERIC(8,2) ft | **YES** |
| `max_stories` | SMALLINT | No |

#### Buffers (feet)
| Column | Type |
|--------|------|
| `buffer_residential` | NUMERIC(8,2) |
| `buffer_waterway` | NUMERIC(8,2) |
| `buffer_roadway` | NUMERIC(8,2) |

**Note:** `envelope_complete` is NOT stored - computed in view.

---

### Table D: `pass2.fire_life_safety`

**Purpose:** Fire and life safety constraints

| Column | Type |
|--------|------|
| `fire_lane_required` | ternary |
| `min_fire_lane_width` | NUMERIC(6,2) ft |
| `max_hydrant_spacing` | NUMERIC(8,2) ft |
| `fire_dept_access_required` | ternary |
| `sprinkler_required` | ternary |
| `adopted_fire_code` | VARCHAR(50) |

---

### Table E: `pass2.stormwater_environmental`

**Purpose:** Stormwater and environmental constraints

| Column | Type |
|--------|------|
| `detention_required` | ternary |
| `retention_required` | ternary |
| `max_impervious` | NUMERIC(5,2) % |
| `watershed_overlay` | ternary |
| `floodplain_overlay` | ternary |
| `environmental_notes` | TEXT |

---

### Table F: `pass2.parking_access`

**Purpose:** Parking and access requirements

| Column | Type |
|--------|------|
| `parking_required` | ternary |
| `parking_ratio` | NUMERIC(8,4) |
| `parking_ratio_unit` | VARCHAR(20) |
| `truck_access_required` | ternary |
| `min_driveway_width` | NUMERIC(6,2) ft |

---

## Enum Types

### ref schema
```sql
CREATE TYPE ref.automation_method AS ENUM ('api', 'scrape', 'portal', 'manual');
CREATE TYPE ref.coverage_level AS ENUM ('full', 'partial', 'insufficient');
CREATE TYPE ref.recon_confidence AS ENUM ('low', 'medium', 'high');
```

### pass2 schema
```sql
CREATE TYPE pass2.ternary AS ENUM ('yes', 'no', 'unknown');
CREATE TYPE pass2.knowledge_state AS ENUM ('known', 'unknown', 'blocked');
CREATE TYPE pass2.source_type AS ENUM ('ordinance', 'pdf', 'portal', 'human');
CREATE TYPE pass2.authority_scope AS ENUM ('county', 'municipal', 'fire_district', 'state');
CREATE TYPE pass2.authority_model AS ENUM ('county', 'municipal', 'mixed', 'none');
CREATE TYPE pass2.zoning_model AS ENUM ('no_zoning', 'county', 'municipal', 'mixed');
CREATE TYPE pass2.asset_class AS ENUM ('self_storage', 'rv_storage', 'trailer_yard', 'boat_storage', 'other');
```

---

## Views

### `ref.v_cca_dispatch`

For Lovable dispatch decisions. Returns:
- `county_id`, `state`, `county_name`
- `pass0_method`, `pass0_coverage`, `pass0_vendor`
- `pass2_method`, `pass2_coverage`, `pass2_planning_url`
- `is_expired`, `expires_soon`

### `pass2.v_jurisdiction_card_for_pass3`

For Pass 3 consumption. Pass 3 reads this **blindly**.

Includes computed field:
```sql
(
  setback_front_state = 'known' AND
  setback_side_state = 'known' AND
  setback_rear_state = 'known' AND
  max_lot_coverage_state = 'known' AND
  max_height_state = 'known'
) AS envelope_complete
```

---

## Functions

### `ref.needs_refresh(county_id)`
Returns TRUE if CCA is expired or doesn't exist.

### `pass2.is_envelope_complete(county_id)`
Returns TRUE if REQUIRED_FOR_ENVELOPE fields are all 'known'.

### `pass2.has_fatal_prohibition(county_id)`
Returns TRUE if fatal_prohibition = 'yes'.

### `pass2.is_storage_allowed(county_id)`
Returns ternary: 'yes', 'no', or 'unknown'.

---

## Key Doctrine Rules

1. **CCA owns HOW** - All discovery mechanics live in `ref.county_capability`
2. **Pass 2 owns WHAT** - Only facts + provenance, no pipeline hints
3. **Unknown is valid** - Tables allow unknown everywhere
4. **Enforcement at view level** - REQUIRED_FOR_ENVELOPE not enforced in tables
5. **Pass 3 reads blindly** - If Pass 2 lies, that's a Pass 2 bug
6. **TTL-governed** - CCA expires, triggers re-recon

---

## Lovable Responsibilities

1. **Resolve counties** from ZIP + radius
2. **Dedupe** via `county_id` against Neon
3. **Check TTL** via `ref.v_cca_dispatch.is_expired`
4. **Trigger CCA recon** when needed
5. **Dispatch workers** based on `pass0_method` / `pass2_method`
6. **Route manual** to human queue
7. **Never decide automation** - CCA decides that
