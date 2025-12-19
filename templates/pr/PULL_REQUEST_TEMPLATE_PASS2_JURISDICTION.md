# Pass 2 Jurisdiction Card Pull Request

## Summary
<!-- Brief description of changes -->

## Type of Change
- [ ] Jurisdiction Card schema change
- [ ] Hydration logic change
- [ ] Provenance handling change
- [ ] View/function change
- [ ] TypeScript types change

---

## Doctrine Compliance

### Critical Rule Check
> "Pass 2 defines WHAT is true. CCA defines HOW to collect it."

- [ ] Pass 2 stores facts + provenance only
- [ ] No pipeline hints (method, coverage) in pass2 tables
- [ ] Unknown is valid and expected everywhere
- [ ] No numeric value inferred

### Table Affected
Which pass2 table(s) does this PR modify?
- [ ] `pass2.jurisdiction_scope`
- [ ] `pass2.use_viability`
- [ ] `pass2.zoning_envelope`
- [ ] `pass2.fire_life_safety`
- [ ] `pass2.stormwater_environmental`
- [ ] `pass2.parking_access`

---

## Provenance Pattern Compliance

If adding new fields:
- [ ] `field_state` column added (knowledge_state enum)
- [ ] `field_source` column added (source_type enum)
- [ ] `field_ref` column added (TEXT)
- [ ] Default is 'unknown' for _state column

---

## REQUIRED_FOR_ENVELOPE Impact

If modifying zoning_envelope:
- [ ] setback_front unchanged
- [ ] setback_side unchanged
- [ ] setback_rear unchanged
- [ ] max_lot_coverage unchanged
- [ ] max_height unchanged
- [ ] `is_envelope_complete()` function updated (if needed)
- [ ] `v_jurisdiction_card_for_pass3` view updated (if needed)

---

## Schema Impact

### If adding new columns:
- [ ] Migration file created in `supabase/migrations/`
- [ ] Default allows incremental hydration
- [ ] No table-level enforcement added

### If modifying enums:
- [ ] Enum changes are backwards compatible
- [ ] Existing data won't be orphaned

---

## View Impact

### v_jurisdiction_card_for_pass3
- [ ] View returns new columns (if applicable)
- [ ] `envelope_complete` computation correct
- [ ] `last_updated` includes all table updated_at columns

---

## TypeScript Sync

- [ ] `src/pass2/types/jurisdiction_card.ts` updated
- [ ] `src/pass2/factories/jurisdiction_card_factory.ts` updated
- [ ] Types match new schema exactly

---

## Testing

- [ ] Tested incremental hydration (partial data works)
- [ ] Tested `is_envelope_complete()` function
- [ ] Tested view output
- [ ] Pass 3 consumption tested (if applicable)

---

## Documentation Updated

- [ ] ADR-019 or ADR-023 referenced
- [ ] PASS2_JURISDICTION_CARD_COMPLIANCE.md updated
- [ ] PASS2_JURISDICTION_CARD.md updated (if adding fields)
- [ ] LOVABLE_SCHEMA_REFERENCE.md updated
- [ ] PRD_PASS2_JURISDICTION_CARD.md updated (if major change)

---

## Deployment Notes
<!-- Any special deployment considerations -->
