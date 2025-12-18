# ZIP Replica Doctrine Violations Audit

**Date:** 2025-12-18
**Doctrine:** SS.REF.SYNC.01
**Status:** REMEDIATED

---

## Summary

The following files have been remediated to comply with the ZIP Replica Sync Doctrine.

---

## Remediation Status

### Pass 1 Function — MIGRATED

| File | Status | Changes |
|------|--------|---------|
| `supabase/functions/startPass1/index.ts` | **COMPLIANT** | Uses `ref.ref_zip_replica` for geography, `pass1_census_snapshot` for census data |

**Implementation Details:**
- Geography from `ref.ref_zip_replica` (zip_id, state_id, lat, lon)
- State info from `ref.ref_state_replica` (state_code, state_name)
- Census data from `pass1_census_snapshot` (population, income, etc.)
- Version check via `check_replica_version()` RPC before execution
- Logs to `master_failure_log` on validation failures

### Deprecated Functions — MARKED

| File | Status | Reason |
|------|--------|--------|
| `supabase/functions/syncZipsFromNeon/index.ts` | **DEPRECATED** | Writes demographics to `us_zip_codes` |
| `supabase/functions/bulkLoadZips/index.ts` | **DEPRECATED** | Bulk loads 30+ demographic columns |
| `supabase/functions/uploadZipCodes/index.ts` | **DEPRECATED** | Uploads demographics to `us_zip_codes` |

**Replacement:** Use `scripts/sync_zip_replica.py` for all ZIP replica sync operations.

---

## New Tables Created

| Table | Purpose | Migration |
|-------|---------|-----------|
| `ref.ref_zip_replica` | Geography only (lat, lon, state_id) | `20251218_zip_replica_sync.sql` |
| `ref.ref_state_replica` | State reference data | `20251218_zip_replica_sync.sql` |
| `ref.ref_sync_manifest` | Sync version tracking | `20251218_zip_replica_sync.sql` |
| `public.pass1_census_snapshot` | Time-variant census data | `20251218_pass1_census_snapshot.sql` |

---

## Deprecated Tables

| Table | Status | Replacement |
|-------|--------|-------------|
| `us_zip_codes` | DEPRECATED | `ref.ref_zip_replica` + `pass1_census_snapshot` |
| `zips_master` (Lovable) | FORBIDDEN | `ref.ref_zip_replica` |

---

## Version Check Implementation

Pass 1 now validates replica version before execution:

```typescript
// STEP 0: Validate replica version (Doctrine Requirement)
const { data: versionCheck, error: versionError } = await supabase
  .rpc('check_replica_version', {
    p_expected_version: EXPECTED_REPLICA_VERSION,
    p_table_name: 'ref_zip_replica'
  });

if (versionCheck && !versionCheck.valid) {
  // Returns 503 Service Unavailable with hint to sync
  return new Response(
    JSON.stringify({
      error: 'ZIP replica validation failed',
      code: versionCheck.error_code,
      hint: 'Run scripts/sync_zip_replica.py to sync replica from Neon'
    }),
    { status: 503 }
  );
}
```

---

## Enforcement Checklist

- [x] Add TODO comments to violating files (2025-12-18)
- [x] Update Pass 1 to use `ref.ref_zip_replica` (2025-12-18) — **MIGRATED**
- [x] Update Pass 1.5 to use `ref.ref_zip_replica` (TODO added)
- [x] Add version check before execution (2025-12-18) — **IMPLEMENTED**
- [x] Deprecate old sync functions (headers added)
- [x] Create `pass1_census_snapshot` table (2025-12-18)
- [ ] Remove `us_zip_codes` table (after full migration verification)
- [ ] Populate `pass1_census_snapshot` with Census API data

---

## References

- [ZIP_REPLICA_SYNC_DOCTRINE.md](ZIP_REPLICA_SYNC_DOCTRINE.md)
- [supabase/migrations/20251218_zip_replica_sync.sql](../../supabase/migrations/20251218_zip_replica_sync.sql)
- [supabase/migrations/20251218_pass1_census_snapshot.sql](../../supabase/migrations/20251218_pass1_census_snapshot.sql)
- [scripts/sync_zip_replica.py](../../scripts/sync_zip_replica.py)
