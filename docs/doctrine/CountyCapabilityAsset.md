# County Capability Asset (CCA)

## Cross-Pass Reference Primitive

The County Capability Asset (CCA) is a **cross-pass reference primitive** that sits **ABOVE Pass 0**, not inside any pass.

It answers **how** information can be obtained from a county, **not what** the rules are.

## What This Is NOT

- This is NOT Pass 2
- This is NOT inside Pass 0
- This is NOT jurisdiction constraints
- This is NOT financial modeling

## Schema Placement

```
ref
├── ref_country
├── ref_state
├── ref_county
├── ref_zip
└── ref_county_capability   ← CCA lives here
```

**Why ref schema:**
- Shared across ALL passes (Pass 0, Pass 2, future passes)
- Slow-changing institutional memory
- Auditable and versionable
- Avoids Pass 0 writing into Pass 2 land (doctrinally wrong)

## Purpose

The CCA exists to:

1. **Decide automation vs manual research** — before committing resources
2. **Control cost** — prevent expensive scraping on counties that can't be automated
3. **Prevent impossible automation attempts** — don't try to scrape what can't be scraped
4. **Feed Pass 0 signal viability** — throttle confidence based on capability
5. **Feed Pass 2 hydration routing** — route to the right data gathering method

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

---

## Cross-Pass Integration Rules

### Who Reads CCA

| Pass | Question CCA Answers |
|------|---------------------|
| Pass 0 | "Can I trust signals from here?" |
| Pass 2 | "How do I fill the jurisdiction card?" |
| Future Passes | Reuse institutional knowledge |

### Who Writes CCA

**Only CapabilityProbe updates CCA.**

No pass mutates CCA directly. This prevents:
- Pass 0 writing into Pass 2 land
- Cross-pass coupling
- State divergence

---

## Pass 0 Integration

### Pass 0 Does NOT Need Rules

It needs **expectations**.

Before Pass 0 tries to:
- scrape permits
- infer inspections
- read zoning headlines
- trust "permit activity" signals

It asks:
```ts
can_automate_permits?
can_scrape_documents?
is_manual_only?
```

### Pass 0 Behavior Matrix

| County Capability | Pass 0 Behavior |
|-------------------|-----------------|
| api / portal_scrape | Full automation allowed |
| pdf_logs | Weak signal only |
| manual_only | Human-only signal (low confidence) |
| unknown | Try cheap probe first |

### DOCTRINE GUARANTEE (Critical)

> **Pass 0 may NOT emit high-confidence signals from counties whose capability is `manual_only` or `unknown`.**

This single rule prevents months of downstream garbage data.

### CCA is a Throttle, Not a Gate

Pass 0 can still surface ideas from low-capability counties, but with:
- Lower confidence
- Clear provenance
- No false precision

---

## Pass 2 Integration

Pass 2 reads CCA to determine hydration strategy:

| automation_viable | Hydration Strategy |
|-------------------|-------------------|
| true | Firecrawl scraping |
| false | Retell voice calls or manual queue |

Retell/manual research is **ONLY** allowed if:
- `permit_system = 'manual_only'`
- OR `document_quality = 'scanned_pdf'`
- OR `automation_viable = false`

---

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

---

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

---

## Database Table

```sql
ref.ref_county_capability
├── county_id (PK, FK to ref_county)
├── zoning_model (cca_zoning_model enum)
├── permit_system (cca_permit_system enum)
├── document_quality (cca_document_quality enum)
├── inspections_linked (boolean)
├── automation_viable (computed boolean)
├── last_verified_at (timestamptz)
├── expires_at (timestamptz, auto-calculated)
├── confidence_level (cca_confidence_level enum)
├── detected_vendor (text)
├── planning_url (text)
├── permits_url (text)
└── notes (text)
```

---

## Testing Requirements

Tests must verify:

1. Expired profiles force re-probe
2. "no_zoning" is a valid first-class model
3. `automation_viable` computed correctly
4. CapabilityProbe never scrapes PDFs
5. Determinism: same inputs → same outputs

---

## Files

| File | Purpose |
|------|---------|
| `src/capability/types.ts` | Type definitions |
| `src/capability/CapabilityProbe.ts` | Main probe orchestrator |
| `src/capability/detectors/` | Individual detector modules |
| `tests/capability/` | Test suite |
| `supabase/migrations/20251218_county_capability_profiles.sql` | Database migration |

---

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

CCA is a **spine asset** that will be reused for 10+ years.

Do not invent data. Do not infer rules. Do not optimize prematurely.

If capability is unknown, say **unknown**.
