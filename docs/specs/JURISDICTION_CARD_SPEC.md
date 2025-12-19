# JURISDICTION CARD REQUIREMENTS SPECIFICATION

**Version:** 1.0.0
**Date:** 2025-12-19
**Status:** CANONICAL
**Audience:** Lovable.DAVE Cloud Functions Implementation

---

## DOCTRINE SUMMARY

| Principle | Enforcement |
|-----------|-------------|
| Pass 2 collects WHAT | Facts only, never calculations |
| Unknown stays unknown | Never infer, estimate, or assume |
| Supabase staging only | NO Neon writes from Pass 2 |
| Pass 3 trusts blindly | Pass 2 is authoritative |
| Provenance is mandatory | Every value has source + authority + timestamp |

---

## SECTION 1: JURISDICTION CARD SCHEMA

### 1.1 Identity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `card_id` | UUID | Y | Primary key (auto-generated) |
| `county_id` | INTEGER | Y | FK to ref.ref_county |
| `state_code` | TEXT | Y | Two-letter state code |
| `asset_class` | ENUM | Y | `self_storage` \| `rv_storage` \| `boat_storage` |
| `authority_model` | ENUM | Y | `county` \| `municipal` \| `mixed` \| `none` |
| `zoning_model` | ENUM | Y | `no_zoning` \| `county` \| `municipal` \| `mixed` |
| `card_complete` | BOOLEAN | Y | All fields researched (may still be unknown) |
| `envelope_complete` | BOOLEAN | Y | All REQUIRED_FOR_ENVELOPE fields are `known` |
| `version` | INTEGER | Y | Optimistic locking version |
| `created_at` | TIMESTAMPTZ | Y | Auto-generated |
| `updated_at` | TIMESTAMPTZ | Y | Auto-updated |

### 1.2 Use Viability Fields

| Field | Type | Criticality | Description |
|-------|------|-------------|-------------|
| `storage_allowed_somewhere` | TERNARY | REQUIRED_FOR_APPROVAL | Storage permitted in some zone |
| `fatal_prohibition` | TERNARY | KILL_SWITCH | Explicit prohibition exists |
| `prohibition_notes` | TEXT | INFORMATIONAL | Description of prohibition |
| `storage_by_right` | TERNARY | REQUIRED_FOR_APPROVAL | No special approval needed |
| `conditional_use_required` | TERNARY | REQUIRED_FOR_APPROVAL | CUP required |
| `special_exception_required` | TERNARY | INFORMATIONAL | Variance/exception needed |

### 1.3 Envelope Constraints (REQUIRED_FOR_ENVELOPE)

Every numeric field follows the pattern:
- `{field}_ft` or `{field}_pct` — The value
- `{field}_knowledge` — `known` | `unknown` | `blocked`
- `{field}_source` — Source URL or reference
- `{field}_authority` — Which authority provided
- `{field}_verified_at` — When verified

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `front_setback_min_ft` | NUMERIC | feet | Front setback requirement |
| `side_setback_min_ft` | NUMERIC | feet | Side setback requirement |
| `rear_setback_min_ft` | NUMERIC | feet | Rear setback requirement |
| `max_lot_coverage_pct` | NUMERIC | % | Maximum lot coverage (0-100) |
| `min_open_space_pct` | NUMERIC | % | Minimum open space (0-100) |
| `max_impervious_pct` | NUMERIC | % | Maximum impervious surface (0-100) |
| `buffer_width_min_ft` | NUMERIC | feet | Required buffer width |
| `landscape_buffer_min_ft` | NUMERIC | feet | Landscape buffer requirement |
| `fire_lane_width_min_ft` | NUMERIC | feet | Minimum fire lane width |
| `fire_hydrant_spacing_max_ft` | NUMERIC | feet | Maximum hydrant spacing |
| `max_height_ft` | NUMERIC | feet | Maximum building height |
| `max_stories` | INTEGER | count | Maximum number of stories |
| `floor_area_ratio` | NUMERIC | ratio | FAR limit |

### 1.4 Fire/Safety Fields

| Field | Type | Criticality | Description |
|-------|------|-------------|-------------|
| `sprinkler_required` | TERNARY | REQUIRED_FOR_ENVELOPE | Sprinkler system required |
| `fire_alarm_required` | TERNARY | INFORMATIONAL | Fire alarm required |
| `knox_box_required` | TERNARY | INFORMATIONAL | Knox box required |
| `fire_lane_turnaround_required` | TERNARY | INFORMATIONAL | Turnaround area required |

### 1.5 Stormwater Fields

| Field | Type | Criticality | Description |
|-------|------|-------------|-------------|
| `stormwater_detention_required` | TERNARY | REQUIRED_FOR_ENVELOPE | Detention required |
| `stormwater_retention_required` | TERNARY | INFORMATIONAL | Retention required |
| `infiltration_allowed` | TERNARY | INFORMATIONAL | Infiltration permitted |
| `design_storm_event` | TEXT | INFORMATIONAL | e.g., "100-year, 24-hour" |
| `water_quality_required` | TERNARY | INFORMATIONAL | Water quality treatment |

### 1.6 Ternary Type Definition

```typescript
type Ternary = 'yes' | 'no' | 'unknown';
```

**DOCTRINE:** `unknown` is a FIRST-CLASS VALUE, not an error state.

### 1.7 Knowledge State Definition

```typescript
type KnowledgeState = 'known' | 'unknown' | 'blocked';
```

| State | Meaning |
|-------|---------|
| `known` | Value confirmed from authoritative source |
| `unknown` | Research not yet attempted |
| `blocked` | Research attempted, value could not be determined |

---

## SECTION 2: SOURCE MAP

### 2.1 Allowed Source Types

| Source Type | Code | Description |
|-------------|------|-------------|
| Ordinance Document | `ordinance` | Municipal/county code document |
| PDF Document | `pdf` | Downloaded PDF (UDO, zoning code) |
| Planning Portal | `portal` | Online planning/zoning portal |
| GIS System | `gis` | County/municipal GIS layer |
| Phone Call | `phone` | Verbal confirmation from staff |
| Human Research | `human` | Manual research by operator |
| API Response | `api` | Programmatic data source |

### 2.2 Field → Source Matrix

| Field Category | Primary Source | Fallback Source | Prohibited Source |
|----------------|----------------|-----------------|-------------------|
| Setbacks | `ordinance`, `pdf` | `portal`, `phone` | inference |
| Coverage/FAR | `ordinance`, `pdf` | `gis` | estimation |
| Height Limits | `ordinance`, `pdf` | `portal` | assumption |
| Fire Code | `ordinance`, `pdf` | `phone` (fire marshal) | defaults |
| Stormwater | `ordinance`, `pdf` | `portal` (NPDES) | — |
| Use Viability | `ordinance`, `pdf` | `portal`, `phone` | — |
| Prohibitions | `ordinance` only | — | — |

### 2.3 Source Reference Format

```json
{
  "source_type": "ordinance",
  "source_url": "https://county.gov/code/chapter-42",
  "source_section": "Section 42.05.03(b)",
  "source_text_snippet": "Front setback shall be no less than 25 feet",
  "captured_at": "2025-12-19T14:30:00Z"
}
```

**DOCTRINE:** Every `known` value MUST have a valid source reference.

---

## SECTION 3: CONFIDENCE & GATES

### 3.1 Confidence Scoring

| Level | Code | Criteria |
|-------|------|----------|
| GREEN | `verified` | Value from ordinance, verified < 365 days |
| YELLOW | `stale` | Value verified but > 365 days old |
| RED | `unknown` | No research attempted |
| RED | `blocked` | Research attempted, could not determine |

### 3.2 Gate Logic

```
GATE: ENVELOPE_COMPLETE
  PASS IF: ALL of REQUIRED_FOR_ENVELOPE fields have knowledge_state = 'known'
  FAIL IF: ANY of REQUIRED_FOR_ENVELOPE fields have knowledge_state IN ('unknown', 'blocked')

GATE: CARD_COMPLETE
  PASS IF: ALL fields have been researched (knowledge_state IN ('known', 'blocked'))
  FAIL IF: ANY field has knowledge_state = 'unknown'

GATE: FATAL_PROHIBITION
  KILL IF: fatal_prohibition = 'yes'
  PASS IF: fatal_prohibition IN ('no', 'unknown')
```

### 3.3 Required for Envelope (MUST be `known`)

```typescript
const REQUIRED_FOR_ENVELOPE: string[] = [
  'front_setback_min_ft',
  'side_setback_min_ft',
  'rear_setback_min_ft',
  'max_lot_coverage_pct',
  'max_height_ft',
];
```

### 3.4 Required for Approval (MUST be `known` or `blocked`)

```typescript
const REQUIRED_FOR_APPROVAL: string[] = [
  'storage_allowed_somewhere',
  'storage_by_right',
  'conditional_use_required',
  'sprinkler_required',
  'stormwater_detention_required',
];
```

---

## SECTION 4: KILL SWITCH CONDITIONS

### 4.1 Fatal Prohibitions (Immediate KILL)

| Condition | Detection | Action |
|-----------|-----------|--------|
| Storage prohibited | `fatal_prohibition = 'yes'` | KILL — Do not promote |
| Zoning prohibits | `storage_allowed_somewhere = 'no'` | KILL — Do not promote |

### 4.2 Envelope Blockers (HOLD for Research)

| Condition | Detection | Action |
|-----------|-----------|--------|
| Missing setbacks | Any setback `knowledge = 'unknown'` | HOLD_INCOMPLETE |
| Missing coverage | `max_lot_coverage_pct` unknown | HOLD_INCOMPLETE |
| Missing height | `max_height_ft` unknown | HOLD_INCOMPLETE |
| Research blocked | Any REQUIRED_FOR_ENVELOPE `knowledge = 'blocked'` | HOLD_BLOCKED |

### 4.3 Staleness Kill Switch

| Condition | Detection | Action |
|-----------|-----------|--------|
| Stale card | `verified_at` > 365 days old | HOLD_STALE |
| Revalidation required | `revalidation_required = true` | HOLD_REVALIDATION |

### 4.4 Verdict Matrix

| fatal_prohibition | envelope_complete | Result |
|-------------------|-------------------|--------|
| yes | * | KILL |
| no | true | PROMOTE |
| no | false | HOLD_INCOMPLETE |
| unknown | true | PROMOTE_WITH_WARNING |
| unknown | false | HOLD_INCOMPLETE |

---

## SECTION 5: NORMALIZATION RULES

### 5.1 Numeric Normalization

| Input | Normalized Output |
|-------|-------------------|
| "25 ft" | `25.0` (unit: `ft`) |
| "25'" | `25.0` (unit: `ft`) |
| "25 feet" | `25.0` (unit: `ft`) |
| "65%" | `65.0` (unit: `%`) |
| "0.65" (in context of coverage) | `65.0` (unit: `%`) |
| "N/A" | `null` (knowledge: `blocked`) |
| "Not applicable" | `null` (knowledge: `blocked`) |
| "Varies" | `null` (knowledge: `blocked`, note: "varies by zone") |

### 5.2 Ternary Normalization

| Input | Normalized Output |
|-------|-------------------|
| "Yes", "Required", "Mandatory" | `yes` |
| "No", "Not required", "Exempt" | `no` |
| "Varies", "Depends", "See code" | `unknown` |
| Empty, null, not found | `unknown` |

### 5.3 Prohibited Normalizations

| Pattern | Why Prohibited |
|---------|----------------|
| "Assumed 25 ft" | Inference is prohibited |
| "Typically 30 ft" | Estimation is prohibited |
| "Default value" | Defaults are prohibited |
| "Best guess" | Guessing is prohibited |
| Copying from adjacent jurisdiction | Cross-jurisdiction inference prohibited |

### 5.4 Unit Canonical Forms

| Field Category | Canonical Unit |
|----------------|----------------|
| Setbacks, buffers, heights | `ft` (feet) |
| Coverage, open space | `%` (0-100 range) |
| FAR | ratio (e.g., `0.65`) |
| Stories | count (integer) |
| Spacing | `ft` (feet) |

---

## SECTION 6: AUDIT REQUIREMENTS

### 6.1 Required Provenance Fields

Every `known` value MUST have:

| Field | Required | Description |
|-------|----------|-------------|
| `source_type` | Y | Type of source |
| `source_url` | Y* | URL if digital source |
| `source_reference` | Y | Section/page reference |
| `source_text_raw` | Y | Verbatim text snippet |
| `authority_scope` | Y | Which authority |
| `verified_at` | Y | ISO timestamp |
| `verified_by` | N | Who performed verification |

*Required if source is digital (`ordinance`, `portal`, `pdf`)

### 6.2 Raw Text Capture Requirements

```json
{
  "field": "front_setback_min_ft",
  "value": 25,
  "raw_capture": {
    "source_text": "All commercial uses in the I-2 district shall maintain a minimum front yard setback of twenty-five (25) feet from the right-of-way line.",
    "source_section": "Article 5, Section 5.4.2(a)(1)",
    "source_url": "https://municode.com/county/zoning-code",
    "captured_at": "2025-12-19T14:30:00Z"
  }
}
```

### 6.3 Audit Trail Schema

```typescript
interface AuditEntry {
  audit_id: string;           // UUID
  card_id: string;            // FK to jurisdiction card
  field_name: string;         // Which field was modified
  old_value: any;             // Previous value
  new_value: any;             // New value
  change_reason: string;      // Why changed
  changed_by: string;         // Who changed
  changed_at: string;         // When changed
  source_reference: string;   // Source for new value
}
```

### 6.4 TTL and Revalidation

| Field Category | Default TTL | Revalidation Trigger |
|----------------|-------------|----------------------|
| Setbacks | 365 days | Code update detected |
| Coverage | 365 days | Code update detected |
| Fire code | 365 days | IFC adoption change |
| Stormwater | 365 days | NPDES permit update |
| Use viability | 180 days | Zoning map amendment |

---

## SECTION 7: RED FLAGS FOR LOVABLE.DAVE

### 7.1 Ambiguous Scenarios Requiring Human Review

| Scenario | Flag Code | Action |
|----------|-----------|--------|
| Multiple conflicting sources | `CONFLICT_DETECTED` | Queue for human review |
| Jurisdiction boundary unclear | `BOUNDARY_AMBIGUOUS` | Queue for human review |
| Code text is conditional | `CONDITIONAL_VALUE` | Capture ALL conditions |
| Value varies by zone | `ZONE_DEPENDENT` | Mark as `blocked` with note |
| Overlay district detected | `OVERLAY_DETECTED` | Research overlay separately |

### 7.2 Implementation Constraints

| Constraint | Enforcement |
|------------|-------------|
| NO calculations | Cloud Function returns raw facts only |
| NO Neon writes | All writes to Supabase staging tables |
| NO cross-county inference | Each jurisdiction card is independent |
| NO default values | Unknown is explicit, never defaulted |
| NO partial writes | Card update is atomic |

### 7.3 Cloud Function Output Contract

```typescript
interface JurisdictionCardCollectionResult {
  status: 'complete' | 'partial' | 'blocked' | 'error';

  // Identity
  county_id: number;
  asset_class: 'self_storage' | 'rv_storage' | 'boat_storage';

  // Completeness
  envelope_complete: boolean;
  card_complete: boolean;

  // Kill switches
  fatal_prohibition: Ternary;

  // Fields with provenance
  fields: {
    [key: string]: {
      value: any;
      knowledge_state: KnowledgeState;
      source: SourceReference | null;
      authority_scope: AuthorityScope;
      verified_at: string | null;
    };
  };

  // Audit
  research_notes: string[];
  red_flags: RedFlag[];

  // Metadata
  collected_at: string;
  collection_duration_ms: number;
}
```

### 7.4 Supabase Staging Table

**Table:** `staging.jurisdiction_card_drafts`

Cloud Functions write here. Pass 2 orchestrator promotes to `pass2.*` tables after validation.

```sql
CREATE TABLE staging.jurisdiction_card_drafts (
  draft_id UUID PRIMARY KEY,
  county_id INTEGER NOT NULL,
  asset_class TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'validated', 'promoted', 'rejected'
  payload JSONB NOT NULL, -- Full JurisdictionCardCollectionResult
  collected_at TIMESTAMPTZ NOT NULL,
  validated_at TIMESTAMPTZ,
  promoted_at TIMESTAMPTZ,
  rejection_reason TEXT
);
```

---

## SECTION 8: EXPLICIT NON-GOALS

| What Pass 2 Does NOT Do | Responsible Party |
|-------------------------|-------------------|
| Calculate buildable area | Lovable.dev (Pass 3) |
| Estimate permit timelines | Not calculated |
| Determine permit costs | Not calculated |
| Score site viability | Lovable.dev (Pass 3) |
| Make go/no-go decisions | Lovable.dev (Pass 3) |
| Write to Neon database | Vault writers only |
| Infer missing values | Never |
| Apply default assumptions | Never |

---

## APPENDIX A: Complete Field List (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "JurisdictionCard",
  "type": "object",
  "required": ["card_id", "county_id", "state_code", "asset_class"],
  "properties": {
    "card_id": { "type": "string", "format": "uuid" },
    "county_id": { "type": "integer" },
    "state_code": { "type": "string", "pattern": "^[A-Z]{2}$" },
    "asset_class": { "enum": ["self_storage", "rv_storage", "boat_storage"] },
    "authority_model": { "enum": ["county", "municipal", "mixed", "none"] },
    "zoning_model": { "enum": ["no_zoning", "county", "municipal", "mixed"] },
    "envelope_complete": { "type": "boolean" },
    "card_complete": { "type": "boolean" },

    "use_viability": {
      "type": "object",
      "properties": {
        "storage_allowed_somewhere": { "$ref": "#/definitions/ternary" },
        "fatal_prohibition": { "$ref": "#/definitions/ternary" },
        "prohibition_notes": { "type": ["string", "null"] },
        "storage_by_right": { "$ref": "#/definitions/ternary" },
        "conditional_use_required": { "$ref": "#/definitions/ternary" },
        "special_exception_required": { "$ref": "#/definitions/ternary" }
      }
    },

    "envelope_constraints": {
      "type": "object",
      "properties": {
        "front_setback_min_ft": { "$ref": "#/definitions/numericField" },
        "side_setback_min_ft": { "$ref": "#/definitions/numericField" },
        "rear_setback_min_ft": { "$ref": "#/definitions/numericField" },
        "max_lot_coverage_pct": { "$ref": "#/definitions/numericField" },
        "min_open_space_pct": { "$ref": "#/definitions/numericField" },
        "max_impervious_pct": { "$ref": "#/definitions/numericField" },
        "buffer_width_min_ft": { "$ref": "#/definitions/numericField" },
        "fire_lane_width_min_ft": { "$ref": "#/definitions/numericField" },
        "max_height_ft": { "$ref": "#/definitions/numericField" },
        "max_stories": { "$ref": "#/definitions/numericField" },
        "floor_area_ratio": { "$ref": "#/definitions/numericField" }
      }
    },

    "fire_safety": {
      "type": "object",
      "properties": {
        "sprinkler_required": { "$ref": "#/definitions/ternaryField" },
        "fire_alarm_required": { "$ref": "#/definitions/ternaryField" },
        "knox_box_required": { "$ref": "#/definitions/ternaryField" }
      }
    },

    "stormwater": {
      "type": "object",
      "properties": {
        "detention_required": { "$ref": "#/definitions/ternaryField" },
        "retention_required": { "$ref": "#/definitions/ternaryField" },
        "infiltration_allowed": { "$ref": "#/definitions/ternaryField" }
      }
    }
  },

  "definitions": {
    "ternary": { "enum": ["yes", "no", "unknown"] },
    "knowledgeState": { "enum": ["known", "unknown", "blocked"] },
    "authorityScope": { "enum": ["county", "municipal", "watershed", "state", "fire_district", "dot", "utility", "unknown"] },

    "numericField": {
      "type": "object",
      "properties": {
        "value": { "type": ["number", "null"] },
        "knowledge_state": { "$ref": "#/definitions/knowledgeState" },
        "source_type": { "type": ["string", "null"] },
        "source_url": { "type": ["string", "null"], "format": "uri" },
        "source_reference": { "type": ["string", "null"] },
        "authority_scope": { "$ref": "#/definitions/authorityScope" },
        "verified_at": { "type": ["string", "null"], "format": "date-time" }
      },
      "required": ["value", "knowledge_state"]
    },

    "ternaryField": {
      "type": "object",
      "properties": {
        "value": { "$ref": "#/definitions/ternary" },
        "knowledge_state": { "$ref": "#/definitions/knowledgeState" },
        "source_type": { "type": ["string", "null"] },
        "source_url": { "type": ["string", "null"], "format": "uri" },
        "authority_scope": { "$ref": "#/definitions/authorityScope" },
        "verified_at": { "type": ["string", "null"], "format": "date-time" }
      },
      "required": ["value", "knowledge_state"]
    }
  }
}
```

---

## APPENDIX B: Canonical Constraint Key Registry

| Key | Type | Unit | Criticality |
|-----|------|------|-------------|
| `front_setback_min_ft` | numeric | ft | REQUIRED_FOR_ENVELOPE |
| `side_setback_min_ft` | numeric | ft | REQUIRED_FOR_ENVELOPE |
| `rear_setback_min_ft` | numeric | ft | REQUIRED_FOR_ENVELOPE |
| `max_lot_coverage_pct` | numeric | % | REQUIRED_FOR_ENVELOPE |
| `min_open_space_pct` | numeric | % | REQUIRED_FOR_ENVELOPE |
| `max_impervious_pct` | numeric | % | REQUIRED_FOR_ENVELOPE |
| `buffer_width_min_ft` | numeric | ft | REQUIRED_FOR_ENVELOPE |
| `fire_lane_width_min_ft` | numeric | ft | REQUIRED_FOR_ENVELOPE |
| `max_height_ft` | numeric | ft | REQUIRED_FOR_ENVELOPE |
| `max_stories` | integer | count | REQUIRED_FOR_ENVELOPE |
| `floor_area_ratio` | numeric | ratio | REQUIRED_FOR_ENVELOPE |
| `storage_allowed_somewhere` | ternary | — | REQUIRED_FOR_APPROVAL |
| `fatal_prohibition` | ternary | — | KILL_SWITCH |
| `storage_by_right` | ternary | — | REQUIRED_FOR_APPROVAL |
| `conditional_use_required` | ternary | — | REQUIRED_FOR_APPROVAL |
| `sprinkler_required` | ternary | — | REQUIRED_FOR_APPROVAL |
| `detention_required` | ternary | — | INFORMATIONAL |
| `retention_required` | ternary | — | INFORMATIONAL |
| `infiltration_allowed` | ternary | — | INFORMATIONAL |
| `fire_alarm_required` | ternary | — | INFORMATIONAL |
| `knox_box_required` | ternary | — | INFORMATIONAL |
| `design_storm_event` | text | — | INFORMATIONAL |
| `landscape_pct_required` | numeric | % | INFORMATIONAL |
| `hydrant_spacing_max_ft` | numeric | ft | INFORMATIONAL |

---

**END OF SPECIFICATION**

*This document is the canonical reference for Jurisdiction Card implementation. Any deviation requires explicit doctrine change through ADR process.*
