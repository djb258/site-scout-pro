# ADR-023: CCA and Pass 2 Schema Separation

## Status
**Accepted**

## Date
2024-12-19

## Context

The system requires clear separation between:
1. **HOW** we collect county-level data (discovery mechanics)
2. **WHAT** the jurisdiction facts are (authoritative truth)

Previous implementations mixed these concerns, leading to:
- Pass 2 tables containing pipeline hints (method, coverage)
- Unclear ownership of zoning model detection vs. authoritative zoning model
- Table-level enforcement that blocked incremental hydration
- Confusion about what Pass 3 should consume

## Decision

### Prime Rule
> **"Claude thinks. Neon remembers. Lovable orchestrates."**

### Schema Separation

#### `ref.county_capability` (CCA Table)
- **Owns**: HOW to collect data
- **Contains**: Dispatch mechanics only
- **Governance**: TTL-governed, cross-pass
- **Consumers**: Lovable (dispatch), Pass 0 (permit collection), Pass 2 (hydration routing)

| What CCA Owns | Example |
|---------------|---------|
| `pass0_method` | `api`, `scrape`, `portal`, `manual` |
| `pass2_method` | `api`, `scrape`, `portal`, `manual` |
| `pass2_zoning_model_detected` | What probe found (NOT authoritative) |
| `pass2_planning_url` | Where to scrape |
| `expires_at` | When to re-probe |

#### `pass2.*` (6 Jurisdiction Card Tables)
- **Owns**: WHAT is true about a jurisdiction
- **Contains**: Facts + provenance only
- **Governance**: Incremental hydration allowed
- **Consumers**: Pass 3 (blindly via view)

| What Pass 2 Owns | Example |
|------------------|---------|
| `zoning_model` | The FACT (with provenance) |
| `setback_front` | Numeric constraint + source |
| `fatal_prohibition` | yes/no/unknown + citation |

### Table Structure

```
ref.county_capability (CCA)
    │
    └──► county_id (FK target)
              │
              ├── pass2.jurisdiction_scope
              ├── pass2.use_viability
              ├── pass2.zoning_envelope
              ├── pass2.fire_life_safety
              ├── pass2.stormwater_environmental
              └── pass2.parking_access
                        │
                        ▼
              pass2.v_jurisdiction_card_for_pass3
                        │
                        ▼
                     Pass 3
```

### Enforcement Rules

1. **REQUIRED_FOR_ENVELOPE enforced at view/function level only**
   - Tables allow `unknown` everywhere
   - Enables incremental hydration without schema churn
   - `envelope_complete` computed in view, not stored

2. **Per-field provenance columns**
   - `field_state` (known | unknown | blocked)
   - `field_source` (ordinance | pdf | portal | human)
   - `field_ref` (URL, document, section)

3. **Pass 3 reads blindly**
   - Only sees `pass2.v_jurisdiction_card_for_pass3`
   - Never references CCA
   - If Pass 2 lies, that's a Pass 2 bug

## Consequences

### Positive
- Clean separation of concerns
- Incremental hydration without schema changes
- Clear audit trail via provenance columns
- Pass 3 isolation from collection mechanics
- TTL-governed refresh without touching Pass 2

### Negative
- More tables to manage (6 instead of 1 monolith)
- Provenance columns increase storage
- Joins required for complete view

### Neutral
- Lovable must check `v_cca_dispatch.is_expired` before dispatch
- CCA must be probed before Pass 2 can hydrate

## Related ADRs
- ADR-019: What Pass 2 Really Is
- ADR-020: Pass 2 Constraint Compiler Position
- ADR-021: Jurisdiction Card Hydration Pipeline
- ADR-022: County Capability Asset

## Implementation

### Migration
`supabase/migrations/20251219_cca_and_pass2_schema.sql`

### TypeScript Types
- `src/cca/` - CCA service and types
- `src/pass2/types/jurisdiction_card.ts` - Pass 2 types

### Documentation
- `docs/LOVABLE_SCHEMA_REFERENCE.md` - Schema for Lovable.dev
- `docs/PASS2_JURISDICTION_CARD.md` - What to collect
