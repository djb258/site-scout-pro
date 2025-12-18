# ZIP Replica Doctrine Violations Audit

**Date:** 2025-12-18
**Doctrine:** SS.REF.SYNC.01
**Status:** VIOLATIONS IDENTIFIED

---

## Summary

The following files violate the ZIP Replica Sync Doctrine by referencing unauthorized tables or performing unauthorized operations.

---

## Violations

### CRITICAL: Direct `us_zip_codes` Access

| File | Violation | Required Action |
|------|-----------|-----------------|
| `supabase/functions/startPass1/index.ts` | Reads from `us_zip_codes` | Must use `ref.ref_zip_replica` |
| `supabase/functions/syncZipsFromNeon/index.ts` | Writes to `us_zip_codes` with demographics | DEPRECATED - use `sync_zip_replica.py` |
| `supabase/functions/bulkLoadZips/index.ts` | Bulk loads to `us_zip_codes` | DEPRECATED - use `sync_zip_replica.py` |
| `supabase/functions/uploadZipCodes/index.ts` | Uploads to `us_zip_codes` | DEPRECATED - use `sync_zip_replica.py` |

### CRITICAL: Census/Demographic Data in ZIP Table

| File | Violation |
|------|-----------|
| `syncZipsFromNeon/index.ts` | Syncs population, income, age, etc. to `us_zip_codes` |
| `bulkLoadZips/index.ts` | Loads 30+ demographic columns |

**Doctrine Rule:** ZIP replica contains GEOGRAPHY ONLY (zip_id, state_id, lat, lon)

---

## Deprecated Tables

| Table | Status | Replacement |
|-------|--------|-------------|
| `us_zip_codes` | DEPRECATED | `ref.ref_zip_replica` |
| `zips_master` (Lovable) | FORBIDDEN | `ref.ref_zip_replica` |

---

## Required Migrations

### 1. Pass 1 Function Update

```typescript
// BEFORE (VIOLATION)
const { data: zipData } = await supabase
  .from('us_zip_codes')
  .select('*')
  .eq('zip', zip_code);

// AFTER (COMPLIANT)
const { data: zipData } = await supabase
  .from('ref_zip_replica')
  .select('zip_id, state_id, lat, lon')
  .eq('zip_id', zip_code);

// Census data must come from pass1_census_snapshot
const { data: censusData } = await supabase
  .from('pass1_census_snapshot')
  .select('*')
  .eq('zip_code', zip_code)
  .order('vintage_year', { ascending: false })
  .limit(1);
```

### 2. Deprecated Functions

These functions should be marked deprecated and eventually removed:

- `syncZipsFromNeon` → Use `scripts/sync_zip_replica.py`
- `bulkLoadZips` → Use `scripts/sync_zip_replica.py`
- `uploadZipCodes` → Use `scripts/sync_zip_replica.py`

---

## Enforcement Checklist

- [x] Add TODO comments to violating files (2025-12-18)
- [x] Update Pass 1 to use `ref.ref_zip_replica` (TODO added)
- [x] Update Pass 1.5 to use `ref.ref_zip_replica` (TODO added)
- [ ] Add version check before execution
- [x] Deprecate old sync functions (headers added)
- [ ] Remove `us_zip_codes` table (after migration)

---

## References

- [ZIP_REPLICA_SYNC_DOCTRINE.md](ZIP_REPLICA_SYNC_DOCTRINE.md)
- [supabase/migrations/20251218_zip_replica_sync.sql](../../supabase/migrations/20251218_zip_replica_sync.sql)
