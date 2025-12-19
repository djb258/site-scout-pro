# Pass 2 Jurisdiction Card Compliance Checklist

**Last Updated:** 2024-12-19
**Related:** ADR-019, ADR-023, PRD_PASS2_JURISDICTION_CARD

---

## Critical Doctrine

> **Pass 2 defines WHAT is true. CCA defines HOW to collect it.**

---

## Schema Compliance

### pass2.jurisdiction_scope (Table A)

- [ ] Table exists in `pass2` schema
- [ ] `county_id` FKs to `ref.county_capability(county_id)`
- [ ] `county_name`, `state`, `county_fips` present
- [ ] `asset_class` uses `pass2.asset_class` enum
- [ ] `authority_model` has provenance columns (_state, _source, _ref)
- [ ] `zoning_model` has provenance columns (_state, _source, _ref)
- [ ] `controlling_authority_name` present
- [ ] `controlling_authority_contact` present

### pass2.use_viability (Table B)

- [ ] Table exists
- [ ] `county_id` FKs to `ref.county_capability(county_id)`
- [ ] `storage_allowed` uses `pass2.ternary` enum
- [ ] `storage_allowed` has provenance columns
- [ ] `fatal_prohibition` uses `pass2.ternary` enum
- [ ] `fatal_prohibition_description` is TEXT
- [ ] `conditional_use_required` uses `pass2.ternary` enum
- [ ] `discretionary_required` uses `pass2.ternary` enum
- [ ] `general_notes` is TEXT

### pass2.zoning_envelope (Table C)

- [ ] Table exists
- [ ] `county_id` FKs to `ref.county_capability(county_id)`

**REQUIRED_FOR_ENVELOPE fields:**
- [ ] `setback_front` is NUMERIC(8,2) with provenance
- [ ] `setback_side` is NUMERIC(8,2) with provenance
- [ ] `setback_rear` is NUMERIC(8,2) with provenance
- [ ] `max_lot_coverage` is NUMERIC(5,2) with provenance
- [ ] `max_height` is NUMERIC(8,2) with provenance

**Other fields:**
- [ ] `max_far` is NUMERIC(5,2) with provenance
- [ ] `min_open_space` is NUMERIC(5,2) with provenance
- [ ] `max_stories` is SMALLINT with provenance
- [ ] `buffer_residential` is NUMERIC(8,2) with provenance
- [ ] `buffer_waterway` is NUMERIC(8,2) with provenance
- [ ] `buffer_roadway` is NUMERIC(8,2) with provenance

**Enforcement:**
- [ ] `envelope_complete` is NOT stored in table
- [ ] `envelope_complete` computed in view only

### pass2.fire_life_safety (Table D)

- [ ] Table exists
- [ ] `county_id` FKs to `ref.county_capability(county_id)`
- [ ] `fire_lane_required` uses `pass2.ternary` with provenance
- [ ] `min_fire_lane_width` is NUMERIC(6,2) with provenance
- [ ] `max_hydrant_spacing` is NUMERIC(8,2) with provenance
- [ ] `fire_dept_access_required` uses `pass2.ternary` with provenance
- [ ] `sprinkler_required` uses `pass2.ternary` with provenance
- [ ] `adopted_fire_code` is VARCHAR(50) with provenance

### pass2.stormwater_environmental (Table E)

- [ ] Table exists
- [ ] `county_id` FKs to `ref.county_capability(county_id)`
- [ ] `detention_required` uses `pass2.ternary` with provenance
- [ ] `retention_required` uses `pass2.ternary` with provenance
- [ ] `max_impervious` is NUMERIC(5,2) with provenance
- [ ] `watershed_overlay` uses `pass2.ternary` with provenance
- [ ] `floodplain_overlay` uses `pass2.ternary` with provenance
- [ ] `environmental_notes` is TEXT

### pass2.parking_access (Table F)

- [ ] Table exists
- [ ] `county_id` FKs to `ref.county_capability(county_id)`
- [ ] `parking_required` uses `pass2.ternary` with provenance
- [ ] `parking_ratio` is NUMERIC(8,4)
- [ ] `parking_ratio_unit` is VARCHAR(20)
- [ ] `truck_access_required` uses `pass2.ternary` with provenance
- [ ] `min_driveway_width` is NUMERIC(6,2) with provenance

---

## Enum Compliance

### pass2 schema enums

- [ ] `pass2.ternary` = ('yes', 'no', 'unknown')
- [ ] `pass2.knowledge_state` = ('known', 'unknown', 'blocked')
- [ ] `pass2.source_type` = ('ordinance', 'pdf', 'portal', 'human')
- [ ] `pass2.authority_scope` = ('county', 'municipal', 'fire_district', 'state')
- [ ] `pass2.authority_model` = ('county', 'municipal', 'mixed', 'none')
- [ ] `pass2.zoning_model` = ('no_zoning', 'county', 'municipal', 'mixed')
- [ ] `pass2.asset_class` = ('self_storage', 'rv_storage', 'trailer_yard', 'boat_storage', 'other')

---

## Provenance Pattern Compliance

Every fact field must have:
- [ ] `field_state` column using `knowledge_state` enum
- [ ] `field_source` column using `source_type` enum
- [ ] `field_ref` column as TEXT

Example:
```sql
setback_front NUMERIC(8,2),
setback_front_state knowledge_state DEFAULT 'unknown',
setback_front_source source_type,
setback_front_ref TEXT
```

---

## View Compliance

### pass2.v_jurisdiction_card_for_pass3

- [ ] View exists
- [ ] Joins all 6 tables on county_id
- [ ] Computes `envelope_complete` as:
  ```sql
  (setback_front_state = 'known' AND
   setback_side_state = 'known' AND
   setback_rear_state = 'known' AND
   max_lot_coverage_state = 'known' AND
   max_height_state = 'known')
  ```
- [ ] Includes `last_updated` as GREATEST of all updated_at columns
- [ ] Does NOT include provenance columns (facts only)

---

## Function Compliance

### pass2.is_envelope_complete(county_id)

- [ ] Function exists
- [ ] Returns BOOLEAN
- [ ] Checks all REQUIRED_FOR_ENVELOPE fields are 'known'

### pass2.has_fatal_prohibition(county_id)

- [ ] Function exists
- [ ] Returns BOOLEAN
- [ ] Returns TRUE only if fatal_prohibition = 'yes'

### pass2.is_storage_allowed(county_id)

- [ ] Function exists
- [ ] Returns `pass2.ternary`
- [ ] Returns COALESCE(value, 'unknown')

---

## Doctrine Compliance

### What Pass 2 Owns

- [ ] Stores WHAT is true (facts)
- [ ] Stores provenance for each fact
- [ ] Does NOT store HOW data was collected
- [ ] Does NOT store pipeline hints

### What Pass 2 Does NOT Own

- [ ] No `method` columns in pass2 tables
- [ ] No `coverage` columns in pass2 tables
- [ ] No `source_pointer` columns in pass2 tables
- [ ] All collection mechanics are in CCA

### Incremental Hydration

- [ ] All fields default to 'unknown'
- [ ] Tables allow partial data
- [ ] No table-level enforcement of completeness
- [ ] Enforcement only at view/function level

### Pass 3 Consumption

- [ ] Pass 3 reads `v_jurisdiction_card_for_pass3` only
- [ ] Pass 3 never references CCA
- [ ] Pass 3 trusts the view blindly
- [ ] If Pass 2 lies, that's a Pass 2 bug

---

## TypeScript Compliance

### Files Exist

- [ ] `src/pass2/types/jurisdiction_card.ts`
- [ ] `src/pass2/factories/jurisdiction_card_factory.ts`
- [ ] `src/pass2/index.ts`

### Types Match Schema

- [ ] `JurisdictionScope` matches `pass2.jurisdiction_scope`
- [ ] `UseViability` matches `pass2.use_viability`
- [ ] `ZoningEnvelope` matches `pass2.zoning_envelope`
- [ ] `FireLifeSafety` matches `pass2.fire_life_safety`
- [ ] `StormwaterEnvironmental` matches `pass2.stormwater_environmental`
- [ ] `ParkingAccess` matches `pass2.parking_access`

### Exports Available

- [ ] `JurisdictionCard` interface exported
- [ ] `createEmptyJurisdictionCard()` function exported
- [ ] `isEnvelopeComplete()` function exported
- [ ] `hasFatalProhibition()` function exported

---

## Enforcement Rules

- [ ] No numeric value may be inferred
- [ ] `unknown` is valid and expected
- [ ] REQUIRED_FOR_ENVELOPE checked at view level
- [ ] Card is county-scoped, not parcel-scoped
- [ ] New fields require explicit doctrine change
