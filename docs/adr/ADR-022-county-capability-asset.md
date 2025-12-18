# ADR-022: County Capability Asset (CCA) as Cross-Pass Infrastructure

## Status

**ACCEPTED** — Locked as spine infrastructure

## Date

2024-12-18

## Context

The system needs to know **how** to get information from a county before attempting automation. This knowledge must be shared across multiple passes:

- **Pass 0** needs to know if permit signals can be trusted
- **Pass 2** needs to know how to hydrate jurisdiction cards
- **Future passes** will need the same institutional knowledge

The question arose: where does this capability data live?

### Options Considered

1. **Inside Pass 0** — Pass 0 owns capability detection
2. **Inside Pass 2** — Part of jurisdiction card infrastructure
3. **Cross-pass reference layer** — Shared infrastructure above all passes

## Decision

### CCA is Cross-Pass Infrastructure

The County Capability Asset (CCA) sits **above Pass 0**, not inside any pass.

```
┌─────────────────────────────────────────────────┐
│              COUNTY CAPABILITY ASSET            │
│         ref.ref_county_capability               │
│                                                 │
│  - Zoning model (countywide/municipal/none)     │
│  - Permit system (api/portal/pdf/manual)        │
│  - Document quality (html/searchable/scanned)   │
│  - Automation viability (computed)              │
│  - 12-month TTL                                 │
└─────────────────────────────────────────────────┘
                        │
           ┌────────────┴────────────┐
           │                         │
           ▼                         ▼
    ┌─────────────┐           ┌─────────────┐
    │   Pass 0    │           │   Pass 2    │
    │             │           │             │
    │ READS CCA   │           │ READS CCA   │
    │ to throttle │           │ to route    │
    │ confidence  │           │ hydration   │
    └─────────────┘           └─────────────┘
```

### Schema Placement: `ref` Schema

```sql
ref
├── ref_country
├── ref_state
├── ref_county
├── ref_zip
└── ref_county_capability   ← CCA lives here
```

**Rationale:**
- Shared across ALL passes
- Slow-changing institutional memory
- Auditable and versionable
- Prevents Pass 0 writing into Pass 2 land

---

## Key Decisions

### 1. CCA Answers "How", Not "What"

**Decision:** CCA describes county capability, not jurisdiction rules.

| CCA Answers | CCA Does NOT Answer |
|-------------|---------------------|
| Can we scrape this county? | What are the setbacks? |
| What vendor do they use? | Is storage allowed? |
| Are documents searchable? | What permits are needed? |
| Is there an API? | What are the fees? |

**Rationale:**
- Capability is stable (changes annually at most)
- Rules change more frequently
- Different ownership boundaries

### 2. Only CapabilityProbe Writes CCA

**Decision:** No pass mutates CCA directly. Only CapabilityProbe updates profiles.

**Rationale:**
- Single source of truth
- Prevents cross-pass coupling
- Clear ownership boundary
- Auditable mutation history

### 3. Pass 0 Uses CCA as a Throttle

**Decision:** Pass 0 reads CCA to determine signal confidence.

| County Capability | Pass 0 Behavior |
|-------------------|-----------------|
| api / portal_scrape | Full automation allowed |
| pdf_logs | Weak signal only |
| manual_only | Human-only signal (low confidence) |
| unknown | Try cheap probe first |

**Critical Guarantee:**

> **Pass 0 may NOT emit high-confidence signals from counties whose capability is `manual_only` or `unknown`.**

**Rationale:**
- Prevents false precision on manual-only counties
- Stops downstream systems from trusting garbage
- Single sentence prevents months of bad data

### 4. CCA is a Throttle, Not a Gate

**Decision:** Low-capability counties don't block Pass 0; they reduce confidence.

**Rationale:**
- Some signal is better than no signal
- Clear provenance allows downstream filtering
- Avoids creating blind spots

### 5. 12-Month TTL with Automatic Expiration

**Decision:** Profiles expire 12 months after `last_verified_at`. Expired = unknown.

**Rationale:**
- County systems change (new vendors, new portals)
- Forces periodic revalidation
- Prevents stale data from masquerading as current

### 6. "No Zoning" is a First-Class Model

**Decision:** `zoning_model = 'no_zoning'` is valid, not an error.

**Rationale:**
- Many rural counties (TX, MT, etc.) have no zoning
- This is legitimate, not missing data
- Must be representable without special-casing

---

## Consequences

### Positive

- Clear separation between capability and rules
- Shared institutional knowledge across passes
- Pass 0 stops lying about manual-only counties
- Pass 2 routes hydration correctly
- Single mutation point (CapabilityProbe)
- 12-month TTL forces freshness

### Negative

- Cold start problem (must probe before first run)
- Additional infrastructure to maintain
- Requires periodic re-probing

### Neutral

- Adds one more table to `ref` schema
- Requires CapabilityProbe integration in Pass 0 and Pass 2

---

## Compliance Requirements

### Pass 0 Integration

```typescript
// Before emitting signals
const capability = await getCountyCapability(countyId);

if (capability.permit_system === 'manual_only' || capability.permit_system === 'unknown') {
  // MUST reduce confidence
  signal.confidence = 'low';
  signal.provenance.capability_limited = true;
}
```

### Pass 2 Integration

```typescript
// Before hydration routing
const capability = await getCountyCapability(countyId);

if (capability.automation_viable) {
  return routeToFirecrawl();
} else {
  return routeToRetellOrManual();
}
```

### Probe Updates Only

```typescript
// WRONG: Direct mutation
await db.update('ref.ref_county_capability', { ... });

// RIGHT: Via CapabilityProbe
const result = await runCapabilityProbe(input);
await persistCapabilityProfile(result.profile);
```

---

## References

- Doctrine: `docs/doctrine/CountyCapabilityAsset.md`
- Migration: `supabase/migrations/20251218_county_capability_profiles.sql`
- Types: `src/capability/types.ts`
- Probe: `src/capability/CapabilityProbe.ts`
- ADR-021: Jurisdiction Card Hydration Pipeline (consumes CCA)
