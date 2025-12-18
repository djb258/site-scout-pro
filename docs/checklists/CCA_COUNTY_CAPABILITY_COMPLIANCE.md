# County Capability Asset (CCA) — Compliance Checklist

**Doctrine ID:** REF.CCA.00
**Last Updated:** 2025-12-18
**Status:** [ ] Compliant / [ ] Non-Compliant

---

This checklist must be completed before any changes to the County Capability Asset can ship.
No exceptions. No partial compliance.

**Reference Documents:**
- ADR-022: County Capability Asset as Cross-Pass Infrastructure
- Doctrine: `docs/doctrine/CountyCapabilityAsset.md`
- Migration: `supabase/migrations/20251218_county_capability_profiles.sql`

---

## Pre-Ship Checklist

### 1. Architectural Position (CRITICAL)

- [ ] CCA is in `ref` schema, NOT inside any pass
- [ ] CCA is keyed by `county_id` (FK to `ref.ref_county`)
- [ ] CCA answers HOW to get data, NOT what the rules are
- [ ] CCA is shared across Pass 0 AND Pass 2 (cross-pass)
- [ ] CCA is NOT inside Pass 2 (doctrinally wrong)

### 2. Schema Compliance

**Required ENUMs (in ref schema):**
- [ ] `ref.cca_zoning_model` (countywide/municipal_only/overlay_based/no_zoning/unknown)
- [ ] `ref.cca_permit_system` (api/portal_scrape/pdf_logs/manual_only/unknown)
- [ ] `ref.cca_document_quality` (structured_html/searchable_pdf/scanned_pdf/none/unknown)
- [ ] `ref.cca_confidence_level` (low/medium/high)

**Required Table Fields:**
- [ ] `county_id` (PK, FK to ref_county)
- [ ] `zoning_model` (NOT NULL, default 'unknown')
- [ ] `permit_system` (NOT NULL, default 'unknown')
- [ ] `document_quality` (NOT NULL, default 'unknown')
- [ ] `automation_viable` (COMPUTED, not manually set)
- [ ] `last_verified_at` (timestamptz)
- [ ] `expires_at` (auto-calculated, 12 months after verification)

### 3. TTL Enforcement (12 Months)

- [ ] Expired profiles are treated as `unknown`
- [ ] Expiration trigger calculates `expires_at = last_verified_at + 12 months`
- [ ] `cca_is_profile_expired()` function exists and works
- [ ] `cca_get_effective_capability()` returns unknowns for expired profiles
- [ ] No profile operates without TTL enforcement

### 4. Automation Viability (Computed)

- [ ] `automation_viable` is a GENERATED column
- [ ] Formula: `permit_system IN ('api', 'portal_scrape') AND document_quality IN ('structured_html', 'searchable_pdf')`
- [ ] Never set manually — always computed
- [ ] Returns FALSE if profile is expired

### 5. First-Class States

- [ ] `'unknown'` is a valid state (not an error)
- [ ] `'no_zoning'` is a valid zoning_model (Texas, Montana counties)
- [ ] Missing profiles are treated as `unknown`, not failures
- [ ] Blocked values are not conflated with unknown

### 6. CapabilityProbe Constraints

- [ ] Only CapabilityProbe writes to CCA (no pass mutations)
- [ ] Probe is cheap and deterministic
- [ ] Probe does NOT scrape ordinances
- [ ] Probe does NOT parse PDFs
- [ ] Probe does NOT call external APIs (beyond HEAD requests)
- [ ] Probe does NOT estimate or guess values
- [ ] Same inputs produce same outputs (determinism test passes)

### 7. Pass 0 Integration

- [ ] Pass 0 reads CCA via `getCountyCapability()`
- [ ] Pass 0 does NOT write to CCA
- [ ] `manual_only` capability → low confidence signals
- [ ] `unknown` capability → low confidence signals
- [ ] **DOCTRINE:** Pass 0 may NOT emit high-confidence signals from manual_only/unknown counties

### 8. Pass 2 Integration

- [ ] Pass 2 reads CCA before hydration routing
- [ ] Pass 2 does NOT write to CCA
- [ ] `automation_viable = true` → routes to Firecrawl
- [ ] `automation_viable = false` → routes to Retell/manual
- [ ] Retell/manual ONLY used when automation is not viable

### 9. Failure Handling

- [ ] Missing profile → treat as unknown, trigger probe
- [ ] Expired profile → treat as unknown, trigger re-probe
- [ ] Probe failure → leave as unknown (never guess)
- [ ] Never substitute defaults for unknown values

### 10. Testing Requirements

- [ ] All unit tests passing
- [ ] Expiration tests passing
- [ ] `no_zoning` first-class model tests passing
- [ ] `automation_viable` computed correctly tests passing
- [ ] CapabilityProbe never scrapes PDFs tests passing
- [ ] Determinism tests passing

---

## Doctrine Violations (Auto-Reject)

Any of these trigger automatic rejection:

| Violation | Description |
|-----------|-------------|
| `CCA_IN_PASS` | CCA placed inside Pass 0, Pass 2, or any pass |
| `PASS_WRITES_CCA` | Pass 0 or Pass 2 writes directly to CCA |
| `MANUAL_SET_VIABLE` | `automation_viable` set manually instead of computed |
| `NO_TTL` | Profile created without expiration enforcement |
| `GUESSING` | Probe estimates or infers values |
| `PDF_SCRAPING` | Probe parses PDF content |
| `HIGH_CONFIDENCE_MANUAL` | Pass 0 emits high-confidence from manual_only county |

---

## Cross-Pass Invariants

These rules MUST hold across all passes:

1. **CCA is read-only for passes** — Only CapabilityProbe writes
2. **Expired = Unknown** — No pass may trust expired profiles
3. **No high confidence from manual counties** — Pass 0 signal cap
4. **Capability ≠ Rules** — CCA says HOW, not WHAT

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Doctrine Owner | | | |
| Reviewer | | | |
| QA | | | |

---

## Compliance Rule

**If any required box is unchecked, this change may not ship.**

> **CCA is infrastructure, not a feature. It will be reused for 10+ years.**
