# County Capability Asset (CCA)

## What This Is

The County Capability Asset (CCA) is a lightweight, reusable, annually-expiring asset that answers **how** information can be obtained from a county, **not what** the rules are.

## What This Is NOT

- This is NOT Pass 2
- This is NOT jurisdiction constraints
- This is NOT financial modeling
- This is NOT zoning rules

## Purpose

The CCA exists to:

1. **Decide automation vs manual research** — before committing resources
2. **Control cost** — prevent expensive scraping on counties that can't be automated
3. **Prevent impossible automation attempts** — don't try to scrape what can't be scraped
4. **Feed Pass 2 hydration routing** — route to the right data gathering method

## Core Doctrine

### Capability ≠ Jurisdiction Rules

| CCA Answers | CCA Does NOT Answer |
|-------------|---------------------|
| Can we scrape this county? | What are the setbacks? |
| What vendor do they use? | Is storage allowed? |
| Are documents searchable? | What permits are needed? |
| Is there an API? | What are the fees? |

### First-Class States

**"Unknown" is valid.** If we don't know a capability, we say `unknown`. We never guess.

**"No zoning" is valid.** Many Texas, Montana, and rural counties have no zoning. This is not an error — it's a legitimate zoning model.

### TTL: 12 Months

- Profiles expire 12 months after `last_verified_at`
- Expired profiles are treated as `unknown`
- Re-probe on: missing, expired, pass2_scope (if low confidence), or manual request

### No Guessing, No Estimation

If the probe cannot determine a value with confidence, it returns `unknown`. The probe does NOT:

- Assume defaults
- Infer from neighboring counties
- Estimate based on state patterns

## Schema

### Zoning Model

| Value | Meaning |
|-------|---------|
| `countywide` | County has unified zoning ordinance |
| `municipal_only` | Zoning delegated to municipalities |
| `overlay_based` | Zoning via overlay districts |
| `no_zoning` | County has no zoning (valid!) |
| `unknown` | Not yet determined |

### Permit System

| Value | Meaning |
|-------|---------|
| `api` | Programmatic API access available |
| `portal_scrape` | Web portal that can be scraped |
| `pdf_logs` | PDF-based permit logs |
| `manual_only` | Phone/in-person only |
| `unknown` | Not yet determined |

### Document Quality

| Value | Meaning |
|-------|---------|
| `structured_html` | Modern HTML with semantic markup |
| `searchable_pdf` | PDF with text layer |
| `scanned_pdf` | Image-only PDF (OCR required) |
| `none` | No online documents |
| `unknown` | Not yet determined |

### Automation Viability (Computed)

```
automation_viable =
  permit_system IN ('api', 'portal_scrape')
  AND document_quality IN ('structured_html', 'searchable_pdf')
```

This is a **computed column** — do not set it manually.

## CapabilityProbe

The CapabilityProbe is a **cheap, deterministic** function that classifies counties.

### Allowed Signals

- Presence of county planning/permits page
- Known vendor detection (Accela, Tyler, Municity, etc.)
- PDF MIME type detection from URLs
- Presence of searchable inputs
- Explicit "no zoning" statements

### Forbidden Actions

- Scrape ordinances
- Parse PDFs
- Call external APIs (beyond HEAD requests)
- Estimate rules
- Hydrate jurisdiction cards

### Determinism Guarantee

Same inputs → same outputs. The probe has no external dependencies that could cause non-determinism.

## Integration Rules

### Pass 2

Pass 2 **READS** capability but does not mutate it.

```typescript
// Pass 2 checks capability before routing
const capability = await getCountyCapability(countyId);

if (capability.automation_viable) {
  // Route to Firecrawl scraping
} else if (capability.permit_system === 'manual_only') {
  // Route to Retell voice call
} else {
  // Queue for manual research
}
```

### JurisdictionCardHydrator

The hydrator **MUST** consult capability before attempting automation.

```typescript
// ADR-021: Hydration Router
if (!capability.automation_viable) {
  // DO NOT attempt Firecrawl
  // Route to Retell or manual queue
}
```

### Retell / Manual Research

Retell and manual research are **ONLY** allowed if:

- `permit_system = 'manual_only'`
- OR `document_quality = 'scanned_pdf'`
- OR `automation_viable = false`

## Database Table

```sql
ref_county_capability.county_capability_profiles
├── county_id (PK, FK to ref_county)
├── zoning_model (enum)
├── permit_system (enum)
├── document_quality (enum)
├── inspections_linked (boolean)
├── automation_viable (computed boolean)
├── last_verified_at (timestamptz)
├── expires_at (timestamptz, auto-calculated)
├── confidence_level (enum: low/medium/high)
├── detected_vendor (text)
├── planning_url (text)
├── permits_url (text)
└── notes (text)
```

## Testing Requirements

Tests must verify:

1. Expired profiles force re-probe
2. "no_zoning" is a valid first-class model
3. `automation_viable` computed correctly
4. CapabilityProbe never scrapes PDFs
5. Determinism: same inputs → same outputs

## Files

| File | Purpose |
|------|---------|
| `src/capability/types.ts` | Type definitions |
| `src/capability/CapabilityProbe.ts` | Main probe orchestrator |
| `src/capability/detectors/` | Individual detector modules |
| `src/capability/__tests__/` | Test suite |
| `supabase/migrations/20251218_county_capability_profiles.sql` | Database migration |

## Non-Goals (Explicit)

- No jurisdiction constraints
- No zoning rules
- No setbacks
- No financial logic
- No timelines
- No human prompts
- No Pass 3 logic

---

**This is infrastructure, not a feature.**

Assume it will be reused for 10+ years. Do not invent data. Do not infer rules. Do not optimize prematurely.

If capability is unknown, say **unknown**.
