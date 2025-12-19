# CCA (County Capability Asset) Pull Request

## Summary
<!-- Brief description of changes -->

## Type of Change
- [ ] CCA Recon Agent change
- [ ] CCA schema change (ref.county_capability)
- [ ] CCA probe change (Pass0DataProbe / Pass2DataProbe)
- [ ] CCA consumer change
- [ ] TTL/expiration logic change

---

## Doctrine Compliance

### Prime Rule Check
> "Claude thinks. Neon remembers. Lovable orchestrates."

- [ ] CCA determines HOW to collect (not WHAT)
- [ ] No persistence authority in agent (Neon handles that)
- [ ] Lovable orchestrates dispatch based on CCA output

### Automation Selection Rule
- [ ] Agent picks highest viable: API → Scrape → Portal → Manual
- [ ] One primary method per pass
- [ ] No mixing of methods

### MUST NOT Violations
- [ ] Does NOT collect real permit data
- [ ] Does NOT collect zoning/setback data
- [ ] Does NOT merge Pass 0 and Pass 2 logic
- [ ] Does NOT guess or hallucinate capabilities

---

## Schema Impact

### If modifying ref.county_capability:
- [ ] Migration file created in `supabase/migrations/`
- [ ] `expires_at` computation unchanged
- [ ] `county_id` remains immutable
- [ ] New columns documented in LOVABLE_SCHEMA_REFERENCE.md

### If modifying enums:
- [ ] Enum changes are backwards compatible
- [ ] Existing data won't be orphaned

---

## Output Contract

### If changing CcaReconOutput:
- [ ] All required fields still present
- [ ] New fields documented
- [ ] TypeScript types updated in `src/cca/agent/types.ts`

---

## Testing

- [ ] Tested with real county (which one: _____________)
- [ ] Tested TTL expiration logic
- [ ] Tested batch processing (if applicable)

---

## Documentation Updated

- [ ] ADR-022 or ADR-023 referenced
- [ ] CCA_RECON_AGENT_COMPLIANCE.md updated
- [ ] LOVABLE_SCHEMA_REFERENCE.md updated
- [ ] PRD_CCA_RECON_AGENT.md updated (if major change)

---

## Deployment Notes
<!-- Any special deployment considerations -->
