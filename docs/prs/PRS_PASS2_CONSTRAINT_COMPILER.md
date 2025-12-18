# PRS: Pass 2 Constraint Compiler Execution Specification

**Document ID:** PRS-PASS2-001
**Doctrine ID:** SS.02.00
**Status:** Derived from implementation
**Source:** `src/pass2/underwriting_hub/`

---

## 1. Purpose

This document describes the **exact runtime behavior** of the Pass 2 Constraint Compiler.

Pass 2 compiles jurisdiction + geometric constraints into a buildability envelope. It does NOT perform financial modeling.

---

## 2. Input Contract

**Source:** `contracts/pass2_input.ts`

### Required Fields

| Field | Type | Validation |
|-------|------|------------|
| `zip_code` | `string` | Must be 5 digits (`/^\d{5}$/`) |
| `asset_class` | `AssetClass` | Must be `self_storage`, `rv_storage`, or `boat_storage` |
| `run_id` | `string` | Must be non-empty |

### Optional Fields

| Field | Type | Notes |
|-------|------|-------|
| `requested_acres` | `number` | Must be positive if provided. Required for envelope calculation. |
| `pass1_run_id` | `string` | Links to Pass 1 output |
| `parcel_id` | `string` | Enables parcel-specific lookup |
| `latitude` | `number` | For geo-based lookups |
| `longitude` | `number` | For geo-based lookups |
| `state` | `string` | 2-letter code for jurisdiction resolution |
| `county` | `string` | County name for card lookup |

### Validation Behavior

```typescript
// From validatePass2Input()
if (!input.zip_code) → error: 'zip_code is required'
if (!/^\d{5}$/.test(input.zip_code)) → error: 'zip_code must be 5 digits'
if (!input.asset_class) → error: 'asset_class is required'
if (!['self_storage', 'rv_storage', 'boat_storage'].includes(input.asset_class)) → error
if (!input.run_id) → error: 'run_id is required'
if (input.requested_acres !== undefined && input.requested_acres <= 0) → error
```

If validation fails:
- Status = `HOLD_INCOMPLETE`
- `errors` array populated with validation messages
- Compilation halts immediately

---

## 3. Constraint Spoke Execution Order

**Source:** `orchestrator/Pass2ConstraintCompiler.ts`

Spokes execute sequentially. Each spoke depends on previous spoke outputs.

| Order | Spoke ID | Name | Dependency |
|-------|----------|------|------------|
| 1 | SS.02.01 | JurisdictionResolver | None |
| 2 | SS.02.02 | JurisdictionCardReader | Requires `jurisdiction.primary_jurisdiction` |
| 3 | SS.02.03 | ZoningConstraints | Requires `jurisdiction.primary_jurisdiction` |
| 4 | SS.02.04 | SitePlanConstraints | Requires `jurisdiction.primary_jurisdiction` |
| 5 | SS.02.05 | StormwaterConstraints | Requires `jurisdiction.primary_jurisdiction` |
| 6 | SS.02.06 | FireAccessConstraints | Requires `jurisdiction.primary_jurisdiction` |
| 7 | SS.02.07 | PermittingChecklist | Requires `zoning`, `stormwater`, `fireAccess` |
| 8 | SS.02.08 | EnvelopeReducer | Requires `requested_acres`, `zoning`, `sitePlan`, `stormwater`, `fireAccess` |
| 9 | SS.02.09 | ConstraintVerdict | Requires all previous spokes |

### Spoke Failure Behavior

- If a spoke throws an exception, the error is captured in `this.errors[]`
- Compilation continues with remaining spokes
- If required spoke outputs are missing, downstream spokes are skipped

---

## 4. Jurisdiction Resolution Flow

**Source:** `spokes/JurisdictionResolver.ts`

1. Input: `zip_code`, optional `state`, `county`, `latitude`, `longitude`
2. ZIP code resolves to one or more counties
3. Output: `primary_jurisdiction` with `jurisdiction_id`, `state`, `county`
4. `provenance.counties_consulted` populated from result

If resolution fails:
- Subsequent spokes requiring `jurisdiction.primary_jurisdiction` are skipped
- Status will be `HOLD_INCOMPLETE`

---

## 5. Jurisdiction Card Read + Completeness

**Source:** `spokes/JurisdictionCardReader.ts`

1. Input: `jurisdiction_id`, `asset_class`
2. Looks up existing card for (jurisdiction × asset_class) combination
3. Output includes:
   - `card_found: boolean`
   - `card: JurisdictionCard | null`
   - `card_age_days: number | null`
   - `card_stale: boolean`

If card found:
- `provenance.jurisdiction_cards_used` populated with card ID

---

## 6. Field Criticality Enforcement

**Source:** `types/guardrails.ts`

### Criticality Levels

| Level | Meaning |
|-------|---------|
| `REQUIRED_FOR_ENVELOPE` | Must be known to calculate buildable area. EnvelopeReducer REFUSES if unknown/blocked. |
| `REQUIRED_FOR_APPROVAL` | Must be known before permitting. Does not block envelope but blocks ELIGIBLE. |
| `INFORMATIONAL` | Nice to have. Does not block anything. |

### Required Fields for Envelope

```typescript
const REQUIRED_FOR_ENVELOPE_FIELDS: string[] = [
  'setback_front_ft',
  'setback_side_ft',
  'setback_rear_ft',
  'max_lot_coverage_pct',
  'stormwater_plan_required',
  'fire_lane_required',
];
```

### Enforcement in EnvelopeReducer

**Source:** `spokes/EnvelopeReducer.ts`

Before any calculation:
1. Check all `REQUIRED_FOR_ENVELOPE` fields
2. If ANY field is `null`, `unknown`, or `blocked`:
   - Return immediately with `envelope_valid: false`
   - `status: 'error'`
   - `missing_constraints` array populated
   - `notes` contains `GUARDRAIL: Envelope calculation refused`

**No silent partial envelopes.**

---

## 7. Staleness / Revalidation Handling

**Source:** `types/guardrails.ts`

### Field Knowledge States

| State | Meaning |
|-------|---------|
| `known` | Value is confirmed and trustworthy |
| `unknown` | Value has not been researched |
| `blocked` | Research attempted but value could not be determined |

### Staleness Rule

```typescript
function isEffectivelyUnknown(field: ConstraintField<any>): boolean {
  if (field.state === 'unknown' || field.state === 'blocked') return true;
  if (field.revalidation_required) return true;
  return false;
}
```

**If `revalidation_required = true`, the field is treated as unknown.**

### Provenance Tracking

- `provenance.stale_fields: string[]` — lists fields requiring revalidation
- `provenance.data_freshness_warning?: string` — warning if card is old

---

## 8. Authority Scope Handling

**Source:** `contracts/pass2_output.ts`, `types/guardrails.ts`

### Authority Types

```typescript
type AuthorityScope =
  | 'county'
  | 'municipality'
  | 'watershed'
  | 'state'
  | 'fire_district'
  | 'dot'
  | 'utility'
  | 'unknown';
```

### Completeness Tracking

```typescript
interface AuthoritiesConsulted {
  county: boolean;
  municipality: boolean;
  watershed: boolean;
  state: boolean;
  fire_district: boolean;
  dot: boolean;
  utility: boolean;
}
```

Default: all `false`. Set to `true` when authority data is consulted.

**Completeness must be checked per authority, not global.**

---

## 9. EnvelopeReducer Behavior

**Source:** `spokes/EnvelopeReducer.ts`

### Preconditions

- `requested_acres` must be provided
- All `REQUIRED_FOR_ENVELOPE` fields must be known

### Calculation Steps

1. **Setback reduction**: Estimate 15% of gross for setbacks
2. **Stormwater reduction**: Use `estimated_detention_acres` or estimate 5%
3. **Fire lane reduction**: Calculate from building perimeter if required
4. **Landscape reduction**: Use `landscape_pct_required` or estimate 10%
5. **Parking reduction**: Estimate based on asset class

### Output

```typescript
net_buildable_acres = gross_acres - total_reductions
sqft_per_acre_ceiling = SQFT_PER_ACRE × coverage × stories × efficiency
max_buildable_sqft = net_buildable_acres × sqft_per_acre_ceiling
```

### Constants

- `SQFT_PER_ACRE = 43560`
- `SELF_STORAGE_EFFICIENCY = 0.85`
- `OUTDOOR_STORAGE_EFFICIENCY = 0.90`
- `DEFAULT_SQFT_PER_ACRE_SINGLE_STORY = 25000`

---

## 10. Output Contract

**Source:** `contracts/pass2_output.ts`

### Status Values

| Status | Meaning |
|--------|---------|
| `ELIGIBLE` | All required constraints collected. Ready for Pass 3. |
| `HOLD_INCOMPLETE` | Missing critical constraints. Manual research required. |
| `NO_GO` | Fatal constraint violation. Site cannot be developed. |

### Primary Signals (ADR-019)

| Field | Type | Meaning |
|-------|------|---------|
| `jurisdiction_card_complete` | `boolean` | PRIMARY signal — is card complete enough for Pass 3? |
| `required_fields_missing` | `string[]` | Fields Pass 3 needs before it can run |
| `fatal_prohibitions` | `string[]` | e.g., "Storage use is prohibited" |

### Buildability Envelope

| Field | Type | Notes |
|-------|------|-------|
| `gross_acres` | `number` | From input or estimated |
| `net_buildable_acres` | `number \| null` | null if cannot calculate |
| `sqft_per_acre_ceiling` | `number \| null` | Based on constraints |
| `max_buildable_sqft` | `number \| null` | net × ceiling |
| `envelope_valid` | `boolean` | false if critical constraints missing |
| `envelope_invalid_reason` | `string?` | Reason if invalid |

### Default Output State

```typescript
// From createDefaultPass2Output()
status: 'HOLD_INCOMPLETE'
jurisdiction_card_complete: false
required_fields_missing: ['ALL — card not yet researched']
envelope_valid: false
manual_research_required: true
```

**Pass 2 must PROVE completeness, not assume it.**

---

## 11. Determinism Guarantees

**Verified by:** `tests/pass2/Pass2Shell.test.ts`

- Identical inputs produce identical outputs (excluding timestamps)
- Same `status`, `buildability`, `fatal_flaws`, `unknowns` for same input
- No external state dependency beyond input

---

## 12. Error and HOLD Conditions

### HOLD_INCOMPLETE Triggers

1. Input validation fails
2. JurisdictionResolver cannot resolve ZIP to jurisdiction
3. Any `REQUIRED_FOR_ENVELOPE` field is unknown/blocked/stale
4. EnvelopeReducer refuses due to missing constraints
5. Any spoke fails with exception
6. Required spoke outputs missing for ConstraintVerdict

### NO_GO Triggers

1. `storage_allowed === false` (zoning prohibition)
2. `net_buildable_acres <= 0`
3. `max_buildable_sqft < 10000` (below viable minimum)

### Error Propagation

- All spoke exceptions captured in `output.errors[]`
- Compilation continues after non-fatal errors
- `summary` field describes final state

---

## 13. Constraint Values Collected

**Source:** `contracts/pass2_output.ts`

### Zoning

- `zoning_code`, `storage_allowed`, `conditional_use_required`
- Setbacks: `front_ft`, `side_ft`, `rear_ft`, `combined_ft`
- Coverage: `max_lot_coverage_pct`, `max_impervious_pct`, `max_building_height_ft`, `max_stories`, `floor_area_ratio`

### Site Plan

- `min_parking_spaces`, `ada_parking_required`
- `landscape_buffer_ft`, `landscape_pct_required`

### Fire Access

- `fire_lane_required`, `fire_lane_width_ft`
- `hydrant_spacing_ft`, `sprinkler_required`

### Stormwater

- `stormwater_required`, `detention_required`, `retention_required`, `infiltration_allowed`

### Civil/Environmental

- `flood_zone`, `wetlands_present`, `slope_limit_pct`, `soil_limitations`

### Utilities

- `water_available`, `sewer_available`, `electric_available`, `gas_available`

All values are `T | null`. `null` means unknown/not researched.

---

## 14. References

- ADR-019: Pass 2 Really Is
- Doctrine: `docs/doctrine/Pass2ReallyIs.md`
- Tests: `tests/pass2/Pass2Shell.test.ts`, `tests/pass2/Guardrails.test.ts`
