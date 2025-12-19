# CCA Recon Agent Compliance Checklist

**Last Updated:** 2024-12-19
**Related:** ADR-022, ADR-023, PRD_CCA_RECON_AGENT

---

## Prime Rule

> **"Claude thinks. Neon remembers. Lovable orchestrates."**

---

## Schema Compliance

### ref.county_capability Table

- [ ] Table exists in `ref` schema
- [ ] `county_id` is BIGINT, NOT NULL, UNIQUE
- [ ] `state` is VARCHAR(2), NOT NULL
- [ ] `county_name` is VARCHAR(100), NOT NULL
- [ ] `county_fips` is VARCHAR(5)

### Pass 0 Capability Columns

- [ ] `pass0_method` uses `ref.automation_method` enum
- [ ] `pass0_source_pointer` is TEXT
- [ ] `pass0_coverage` uses `ref.coverage_level` enum
- [ ] `pass0_vendor` is VARCHAR(50)
- [ ] `pass0_has_api` is BOOLEAN
- [ ] `pass0_inspections_linked` is BOOLEAN (NULL = unknown)

### Pass 2 Capability Columns

- [ ] `pass2_method` uses `ref.automation_method` enum
- [ ] `pass2_source_pointer` is TEXT
- [ ] `pass2_coverage` uses `ref.coverage_level` enum
- [ ] `pass2_zoning_model_detected` uses `pass2.zoning_model` enum
- [ ] `pass2_planning_url` is TEXT
- [ ] `pass2_ordinance_url` is TEXT

### TTL Governance

- [ ] `verified_at` is TIMESTAMPTZ with DEFAULT NOW()
- [ ] `ttl_months` is SMALLINT with DEFAULT 12
- [ ] `expires_at` is computed column (verified_at + ttl_months)
- [ ] `ref.needs_refresh(county_id)` function exists

---

## Enum Compliance

### ref schema enums

- [ ] `ref.automation_method` = ('api', 'scrape', 'portal', 'manual')
- [ ] `ref.coverage_level` = ('full', 'partial', 'insufficient')
- [ ] `ref.recon_confidence` = ('low', 'medium', 'high')

---

## Agent Behavior Compliance

### Automation Selection Rule

- [ ] Agent picks highest viable method: API → Scrape → Portal → Manual
- [ ] One primary method per pass
- [ ] No mixing of methods

### MUST Do

- [ ] Probes official county and state sources
- [ ] Determines if automation is feasible
- [ ] Selects best method per pass
- [ ] Documents WHERE (source_pointer) and WHY (notes)

### MUST NOT Do

- [ ] Does NOT collect real permit data
- [ ] Does NOT collect zoning/setback data
- [ ] Does NOT merge Pass 0 and Pass 2 logic
- [ ] Does NOT guess or hallucinate capabilities
- [ ] Does NOT write directly to databases

---

## Output Contract Compliance

### Required Fields

- [ ] `county_id` - number
- [ ] `state` - string
- [ ] `county_name` - string
- [ ] `pass0_method` - 'api' | 'scrape' | 'portal' | 'manual'
- [ ] `pass0_source_pointer` - string
- [ ] `pass0_coverage` - 'full' | 'partial' | 'insufficient'
- [ ] `pass0_notes` - string
- [ ] `pass2_method` - 'api' | 'scrape' | 'portal' | 'manual'
- [ ] `pass2_source_pointer` - string
- [ ] `pass2_coverage` - 'full' | 'partial' | 'insufficient'
- [ ] `pass2_notes` - string
- [ ] `confidence` - 'low' | 'medium' | 'high'
- [ ] `evidence_links` - string[]
- [ ] `verified_at` - ISO timestamp

---

## View Compliance

### ref.v_cca_dispatch

- [ ] View exists
- [ ] Returns `county_id`, `state`, `county_name`
- [ ] Returns `pass0_method`, `pass0_coverage`, `pass0_vendor`
- [ ] Returns `pass2_method`, `pass2_coverage`, `pass2_planning_url`
- [ ] Returns computed `is_expired` boolean
- [ ] Returns computed `expires_soon` boolean

---

## Integration Compliance

### Lovable Integration

- [ ] Lovable can read `ref.v_cca_dispatch`
- [ ] Lovable checks `is_expired` before dispatch
- [ ] Lovable triggers CCA recon when expired
- [ ] Lovable routes based on `pass0_method` / `pass2_method`
- [ ] Lovable routes 'manual' to human queue

### Pass 0 Integration

- [ ] Pass 0 can read CCA for `pass0_method`
- [ ] Pass 0 uses `pass0_source_pointer` for collection
- [ ] Pass 0 respects `pass0_coverage` limitations

### Pass 2 Integration

- [ ] Pass 2 can read CCA for `pass2_method`
- [ ] Pass 2 uses `pass2_planning_url` for hydration
- [ ] Pass 2 does NOT see pipeline hints in its own tables

---

## Doctrine Compliance

### Separation of Concerns

- [ ] CCA owns HOW (dispatch mechanics)
- [ ] Pass 2 owns WHAT (facts + provenance)
- [ ] Pass 3 never references CCA
- [ ] `pass2_zoning_model_detected` is NOT the authoritative fact

### TTL Governance

- [ ] CCA expires based on `ttl_months`
- [ ] Expired CCA triggers re-recon
- [ ] No manual override of expiration

---

## TypeScript Compliance

### Files Exist

- [ ] `src/cca/agent/types.ts`
- [ ] `src/cca/agent/CcaReconAgent.ts`
- [ ] `src/cca/probes/Pass0DataProbe.ts`
- [ ] `src/cca/probes/Pass2DataProbe.ts`
- [ ] `src/cca/consumers/Pass0Consumer.ts`
- [ ] `src/cca/consumers/Pass2Consumer.ts`
- [ ] `src/cca/index.ts`

### Exports Available

- [ ] `CcaReconAgent` class exported
- [ ] `reconCounty()` function exported
- [ ] `reconBatch()` function exported
- [ ] `CcaReconInput` type exported
- [ ] `CcaReconOutput` type exported
