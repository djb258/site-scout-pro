# PASS-1 → PASS-2 HANDOFF VALIDATOR

## Implementation Report

**Date**: 2025-12-09
**Status**: Complete
**Version**: 1.0

---

## Overview

The Pass-1 → Pass-2 Handoff Validator ensures that an OpportunityObject from Pass-1 has sufficient data to proceed to Pass-2 underwriting. It provides a gating mechanism with clear feedback on what's missing or problematic.

---

## File Locations

| File | Purpose |
|------|---------|
| `src/engine/shared/validators/p1_to_p2_validator.ts` | Core validator module |
| `supabase/functions/start_pass2/index.ts` | Edge function with validation gate |
| `src/engine/pass2_hub/orchestrators/pass2_orchestrator.ts` | Orchestrator with Step 0 validation |
| `src/engine/pass2_hub/types/pass2_types.ts` | TypeScript types for validation |

---

## Validation Interface

```typescript
interface Pass1ToPass2Validation {
  /** Overall pass/fail - true if no blockers exist */
  ok: boolean;

  /** Critical issues that MUST be resolved before Pass-2 */
  blockers: string[];

  /** Non-critical issues that should be addressed but don't block Pass-2 */
  warnings: string[];

  /** Fields that are present and valid */
  required_fields: string[];

  /** Optional fields that are missing but not blocking */
  optional_fields: string[];

  /** Enrichment status for downstream spokes */
  enrichment_status: {
    competitor_enrichment_ready: boolean;
    call_sheet_ready: boolean;
  };

  /** Validation metadata */
  validation_meta: {
    validated_at: string;
    pass1_id: string;
    zip: string;
    validation_score: number; // 0-100 completeness
  };
}
```

---

## Validation Logic

### Required Identity Fields (Blockers if missing)

| Field | Type | Description |
|-------|------|-------------|
| `zip` | string | 5-digit ZIP code |
| `city` | string | City name |
| `county` | string | County name |
| `state` | string | State name |
| `state_id` | string | 2-letter state code |
| `lat` | number | Latitude |
| `lng` | number | Longitude |

### Required Macro Fields (Blockers if missing)

| Field | Type | Description |
|-------|------|-------------|
| `zip_metadata` | object | Population, income, home value |
| `macro_demand` | object | demand_sqft, population, households |
| `macro_supply` | object | competitor_count, total_supply_sqft |
| `hotspot_score` | object | overall_score, tier (A/B/C/D) |

### Thresholds

| Check | Threshold | Result |
|-------|-----------|--------|
| Population | < 1,000 | Warning |
| Median Income | < $25,000 | Warning |
| Viability Score | < 20 | Warning |
| Competitors | 0 | Warning |
| Competitors | < 3 | Warning |
| Status | not in [complete, pass1_complete, local_scan_complete] | Blocker |

---

## Blocker Codes

| Code | Description |
|------|-------------|
| `IDENTITY_MISSING` | No identity block found |
| `IDENTITY_FIELD_MISSING` | Required identity field is missing |
| `PASS1_MACRO_MISSING` | No Pass-1 macro results found |
| `MACRO_FIELD_MISSING` | Required macro field is missing |
| `ZIP_METADATA_FIELD_MISSING` | Required zip_metadata field is missing |
| `DEMAND_INVALID` | demand_sqft or population is <= 0 |
| `HOTSPOT_INVALID` | overall_score or tier is missing |
| `RECOMMENDATION_MISSING` | No Pass-1 recommendation found |
| `RECOMMENDATION_INVALID` | viability_score or tier is missing |
| `STATUS_INVALID` | Status is not valid for Pass-2 |

---

## Warning Codes

| Code | Description |
|------|-------------|
| `IDENTITY_COORDS_SUSPECT` | Coordinates outside US bounds |
| `LOW_POPULATION` | Population below threshold |
| `LOW_INCOME` | Median income below threshold |
| `LOW_VIABILITY` | Pass-1 score below threshold |
| `PASS1_RECOMMENDED_SKIP` | Pass-1 said don't proceed |
| `PASS2_READY_FALSE` | pass2_ready flag is false |
| `PREREQ_MISSING` | has_competitor_list or has_pricing_data is false |
| `NO_COMPETITORS` | No competitors found |
| `FEW_COMPETITORS` | Fewer than 3 competitors |
| `SUPPLY_INCOMPLETE` | macro_supply fields missing |

---

## Example Blocked Response

```json
{
  "ok": false,
  "blockers": [
    "IDENTITY_FIELD_MISSING: identity.county is required",
    "MACRO_FIELD_MISSING: pass1_macro.macro_demand is required",
    "HOTSPOT_INVALID: hotspot_score.overall_score is required"
  ],
  "warnings": [
    "LOW_POPULATION: Population 850 is below threshold (1000). Market may be too small.",
    "NO_COMPETITORS: No competitors found. Pricing verification will use market defaults."
  ],
  "required_fields": [
    "identity.zip",
    "identity.city",
    "identity.state",
    "identity.state_id",
    "identity.lat",
    "identity.lng",
    "pass1_macro.zip_metadata",
    "pass1_macro.macro_supply",
    "pass1_macro.hotspot_score"
  ],
  "optional_fields": [
    "pass1_macro.competitors",
    "pass1_macro.competitor_enrichment",
    "local_scan.call_sheet"
  ],
  "enrichment_status": {
    "competitor_enrichment_ready": false,
    "call_sheet_ready": false
  },
  "validation_meta": {
    "validated_at": "2025-01-15T10:30:00.000Z",
    "pass1_id": "abc123",
    "zip": "75001",
    "validation_score": 65
  }
}
```

---

## Example Passed Response

```json
{
  "ok": true,
  "blockers": [],
  "warnings": [
    "FEW_COMPETITORS: Only 2 competitors found. Pricing confidence may be limited."
  ],
  "required_fields": [
    "identity.zip",
    "identity.city",
    "identity.county",
    "identity.state",
    "identity.state_id",
    "identity.lat",
    "identity.lng",
    "pass1_macro.zip_metadata",
    "pass1_macro.macro_demand",
    "pass1_macro.macro_supply",
    "pass1_macro.hotspot_score",
    "zip_metadata.population",
    "zip_metadata.income_household_median",
    "zip_metadata.home_value",
    "pass1_recommendation.viability_score",
    "pass1_recommendation.tier",
    "status"
  ],
  "optional_fields": [
    "pass1_macro.competitor_enrichment",
    "local_scan.call_sheet"
  ],
  "enrichment_status": {
    "competitor_enrichment_ready": true,
    "call_sheet_ready": false
  },
  "validation_meta": {
    "validated_at": "2025-01-15T10:30:00.000Z",
    "pass1_id": "def456",
    "zip": "75001",
    "validation_score": 100
  }
}
```

---

## Integration Points

### 1. Edge Function (`start_pass2`)

```typescript
// Validation runs BEFORE creating pass2_runs record
const validation = validatePass1Data(pass1Run);

if (!validation.ok && !skip_validation) {
  return new Response(
    JSON.stringify({
      error: 'Pass-1 validation failed. Cannot proceed to Pass-2.',
      validation,
      blockers: validation.blockers,
      warnings: validation.warnings,
    }),
    { status: 422 }
  );
}
```

HTTP Status: **422 Unprocessable Entity** when blocked.

### 2. Orchestrator (`runPass2Shell`)

```typescript
// Step 0: Validation Gate
const validation = validatePass1ToPass2(opportunity);

if (!validation.ok && !skip_validation) {
  return {
    success: false,
    error: `Validation failed: ${validation.blockers.join('; ')}`,
    validation,
    // ... stub results
  };
}
```

### 3. UI Integration (Lovable)

```jsx
// Disable Pass-2 button unless validation.ok === true
<Button
  disabled={!validation.ok}
  onClick={startPass2}
>
  Start Pass-2
</Button>

// Show blockers in red alert
{validation.blockers.length > 0 && (
  <Alert variant="destructive">
    <AlertTitle>Cannot proceed to Pass-2</AlertTitle>
    {validation.blockers.map(b => <p key={b}>{b}</p>)}
  </Alert>
)}

// Show warnings in yellow
{validation.warnings.length > 0 && (
  <Alert variant="warning">
    <AlertTitle>Warnings</AlertTitle>
    {validation.warnings.map(w => <p key={w}>{w}</p>)}
  </Alert>
)}

// Show validation score as progress
<Progress value={validation.validation_meta.validation_score} />
```

---

## API Usage

### From UI/Client

```typescript
// Call start_pass2 edge function
const response = await fetch('/functions/v1/start_pass2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pass1_id: 'abc123' }),
});

const data = await response.json();

if (response.status === 422) {
  // Validation failed
  console.log('Blockers:', data.blockers);
  console.log('Warnings:', data.warnings);
} else if (data.pass2_id) {
  // Success
  console.log('Pass-2 started:', data.pass2_id);
}
```

### Skip Validation (Testing Only)

```typescript
// Use skip_validation: true for testing/override
const response = await fetch('/functions/v1/start_pass2', {
  method: 'POST',
  body: JSON.stringify({
    pass1_id: 'abc123',
    skip_validation: true
  }),
});
```

---

## Helper Functions

```typescript
import {
  validatePass1ToPass2,
  isPass2Ready,
  getBlockerMessages,
  getWarningMessages,
  createValidationSummary,
} from '@/engine/shared/validators/p1_to_p2_validator';

// Quick boolean check
if (isPass2Ready(opportunity)) {
  // Can proceed
}

// Get formatted messages for UI
const blockerMessages = getBlockerMessages(validation);
const warningMessages = getWarningMessages(validation);

// Logging summary
console.log(createValidationSummary(validation));
// Output: "[P1→P2 Validation] PASS | Score: 100% | Blockers: 0 | Warnings: 1 | ZIP: 75001"
```

---

## Database Schema Notes

### pass2_runs - New Columns

```sql
ALTER TABLE pass2_runs ADD COLUMN IF NOT EXISTS validation_passed BOOLEAN;
ALTER TABLE pass2_runs ADD COLUMN IF NOT EXISTS validation_score INTEGER;
ALTER TABLE pass2_runs ADD COLUMN IF NOT EXISTS warning_count INTEGER;
```

### engine_logs - Validation Events

Events logged:
- `validation_check` - Every validation attempt
- `pass2_validation_failed` - When validation blocks Pass-2

---

## Architecture Notes

### No Database Access

The validator does NOT hit the database. It operates entirely on the OpportunityObject passed to it. All DB access happens in edge functions before/after validation.

### Static Imports Only

Cloudflare Workers compatible - no dynamic imports.

### JSON-Serializable

All validation results are JSON-serializable for API responses.

---

## TODOs

| Priority | TODO | Notes |
|----------|------|-------|
| HIGH | Add UI validation display | Show blockers/warnings in Lovable |
| HIGH | Run migrations for pass2_runs columns | validation_passed, validation_score |
| MEDIUM | Add pre-flight validation endpoint | GET /validate-pass1/:id |
| MEDIUM | Add validation metrics dashboard | Track failure rates |
| LOW | Add configurable thresholds | Admin can adjust MIN_POPULATION, etc. |

---

## Testing

### Test Cases

1. **Valid opportunity** - All required fields present → `ok: true`
2. **Missing identity.county** → Blocker
3. **Missing macro_demand** → Blocker
4. **Population < 1000** → Warning (not blocker)
5. **Status = "pending"** → Blocker
6. **proceed_to_pass2 = false** → Warning
7. **No competitors** → Warning
8. **Invalid coordinates** → Warning

### Manual Testing

```bash
# Call start_pass2 with test pass1_id
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"pass1_id": "test-123"}' \
  https://your-project.supabase.co/functions/v1/start_pass2
```

---

## Summary

The Pass-1 → Pass-2 Handoff Validator provides:

1. **Clear gating** - Prevents Pass-2 from running on incomplete data
2. **Actionable feedback** - Blockers and warnings with specific messages
3. **Validation score** - 0-100% completeness indicator
4. **Enrichment status** - Shows which optional enrichments are ready
5. **UI integration** - Disable button, show alerts, progress indicator
6. **Logging** - All validation attempts are logged for analytics
