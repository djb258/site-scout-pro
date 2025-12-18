# ZIP Replica Sync Doctrine

**Doctrine ID:** SS.REF.SYNC.01
**Version:** 1.0.0
**Date:** 2025-12-18
**Status:** LOCKED

---

## Mental Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AUTHORITATIVE FLOW                             │
│                                                                          │
│   NEON (Vault)                              LOVABLE.DAVE (Workbench)    │
│   ════════════                              ════════════════════════    │
│                                                                          │
│   ref.ref_zip ─────────── SYNC ──────────▶ ref.ref_zip_replica          │
│   (WRITABLE)              (Manual)          (READ-ONLY)                  │
│                                                                          │
│   ref.ref_state ────────── SYNC ──────────▶ ref.ref_state_replica       │
│   (WRITABLE)              (Manual)          (READ-ONLY)                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

Neon = Vault (authoritative, writable)
Lovable = Workbench (execution cache, read-only)
ZIP Replica = Cached map, NOT a notebook
```

---

## 1. Authoritative Source

| Database | Schema | Table | Access |
|----------|--------|-------|--------|
| **Neon** | `ref` | `ref_zip` | READ/WRITE (authoritative) |
| **Neon** | `ref` | `ref_state` | READ/WRITE (authoritative) |
| **Lovable** | `ref` | `ref_zip_replica` | READ-ONLY (cache) |
| **Lovable** | `ref` | `ref_state_replica` | READ-ONLY (cache) |

### Rule: Single Source of Truth

```
NEON.ref.ref_zip is the ONLY writable source for ZIP geography.
LOVABLE.ref.ref_zip_replica is a READ-ONLY execution cache.
```

---

## 2. Replica Schema

### ref.ref_zip_replica

```sql
CREATE TABLE ref.ref_zip_replica (
    -- Core geography (mirrors neon.ref_zip exactly)
    zip_id CHAR(5) PRIMARY KEY,
    state_id INTEGER NOT NULL,
    lat NUMERIC(9,6),
    lon NUMERIC(10,6),

    -- REQUIRED: Replica sync metadata
    source_version TEXT NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL,
    source_table TEXT NOT NULL DEFAULT 'neon.ref_zip',
    checksum TEXT NULL,

    -- Sync tracking
    sync_run_id UUID NULL,
    row_hash TEXT GENERATED ALWAYS AS (MD5(...)) STORED
);
```

### ref.ref_sync_manifest

```sql
CREATE TABLE ref.ref_sync_manifest (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL UNIQUE,
    source_version TEXT NOT NULL,
    source_checksum TEXT NULL,
    row_count INTEGER NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL,
    synced_by TEXT NOT NULL,
    sync_run_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'STALE', 'INVALID'))
);
```

---

## 3. Drift Prevention Rules

### 3.1 Read-Only Enforcement

| Operation | Allowed | Enforcement |
|-----------|---------|-------------|
| SELECT | YES | RLS Policy |
| INSERT | NO | REVOKE + RLS |
| UPDATE | NO | REVOKE + RLS |
| DELETE | NO | REVOKE + RLS |

```sql
-- Database-level enforcement
REVOKE INSERT, UPDATE, DELETE ON ref.ref_zip_replica FROM anon, authenticated;
ALTER TABLE ref.ref_zip_replica ENABLE ROW LEVEL SECURITY;
```

### 3.2 Version Mismatch Handling

When `source_version` does not match expected version:

1. **BLOCK** execution immediately
2. **EMIT** failure log event to `master_failure_log`
3. **RETURN** error code `VERSION_MISMATCH`

```sql
-- Check before any Pass 1/1.5 execution
SELECT ref.require_valid_replica('v2025.12.18');
-- Raises exception if version mismatch
```

### 3.3 Drift Detection Function

```sql
SELECT ref.check_replica_version('v2025.12.18');
-- Returns: {"valid": false, "error_code": "VERSION_MISMATCH", ...}
```

---

## 4. Sync Doctrine

### 4.1 When Sync Occurs

| Trigger | Type | Frequency |
|---------|------|-----------|
| Manual sync | REQUIRED | On-demand by authorized operator |
| Scheduled sync | OPTIONAL | Weekly at most (if implemented) |
| Auto-sync | FORBIDDEN | Never automatic |

**Rule:** Sync is a deliberate, audited operation. No background auto-sync.

### 4.2 Who Can Run Sync

| Role | Can Sync | Notes |
|------|----------|-------|
| Service Role | YES | Only via `sync_zip_replica_from_neon()` |
| Authenticated User | NO | No direct write access |
| Anonymous User | NO | Read-only access only |
| System Admin | YES | Via service role credentials |
| Claude Code | YES | Via approved sync script |

### 4.3 Version Bump Protocol

```
1. Update ref.ref_zip in Neon (authoritative)
2. Generate new version string: v{YYYY}.{MM}.{DD}.{seq}
3. Run sync function with new version
4. Verify checksum matches
5. Update manifest to ACTIVE
```

**Version Format:** `v2025.12.18.001`

### 4.4 Schema Change Protocol

If Neon `ref.ref_zip` schema changes:

```
1. HALT all Pass 1/1.5 execution in Lovable
2. Apply migration to Lovable replica table
3. Run full sync with new version
4. Validate row counts and checksums match
5. Resume execution
```

**Rule:** Schema changes require coordinated migration. No drift allowed.

---

## 5. Invariants (Non-Negotiable)

### INV-001: Single Authoritative Source
```
Neon.ref.ref_zip is the ONLY writable source.
Lovable.ref.ref_zip_replica is NEVER writable.
```

### INV-002: Read-Only Enforcement
```
INSERT/UPDATE/DELETE on ref_zip_replica MUST fail at database level.
No application-level-only enforcement.
```

### INV-003: Version Check Before Execution
```
Pass 1 and Pass 1.5 MUST validate replica version before execution.
Mismatch = execution blocked + failure logged.
```

### INV-004: No Census Data
```
Replica contains GEOGRAPHY ONLY: zip_id, state_id, lat, lon.
NO population, income, or demographic fields.
```

### INV-005: No Lovable Fork
```
Lovable replica MUST be a pure copy of Neon source.
NO local modifications, additions, or deletions.
```

### INV-006: Audit Trail Required
```
Every sync operation MUST record:
- synced_by (operator identity)
- sync_run_id (unique identifier)
- synced_at (timestamp)
- source_version (version string)
```

### INV-007: Manual Sync Only
```
Sync is triggered by deliberate operator action.
NO automatic background sync.
```

### INV-008: Checksum Validation
```
After sync, row_hash checksums MUST match source.
Mismatch = sync marked INVALID.
```

---

## 6. Failure Codes

| Code | Meaning | Action |
|------|---------|--------|
| `REPLICA_NOT_INITIALIZED` | Replica never synced | Run initial sync |
| `REPLICA_STALE` | Manifest marked stale | Run sync |
| `REPLICA_INVALID` | Checksum mismatch | Investigate + re-sync |
| `VERSION_MISMATCH` | Expected != current | Sync to expected version |

---

## 7. Health Monitoring

### Health View

```sql
SELECT * FROM ref.replica_health;
```

| health_status | Meaning |
|---------------|---------|
| `HEALTHY` | Active, synced < 24h |
| `WARN_STALE` | Active, synced 1-7 days |
| `STALE` | Marked stale in manifest |
| `CRITICAL` | Invalid or very old |

---

## 8. Sync Execution

### Manual Sync Command

```bash
# From authorized environment with service role
python scripts/sync_zip_replica.py --version v2025.12.18.001
```

### Sync Function (Service Role Only)

```sql
SELECT ref.sync_zip_replica_from_neon(
    'v2025.12.18.001',
    'operator@barton.enterprises',
    '[{"zip_id": "00601", "state_id": 52, "lat": 18.18, "lon": -66.75}, ...]'::jsonb
);
```

---

## 9. Related Documents

| Document | Path |
|----------|------|
| ERD Hub-Spoke | `docs/ERD_HUB_SPOKE.md` |
| ADR-016 Neon Database | `docs/adr/ADR-016-neon-database.md` |
| PRD Data Layer Hub | `docs/prd/PRD_DATA_LAYER_HUB.md` |
| Migration SQL | `supabase/migrations/20251218_zip_replica_sync.sql` |

---

## 10. Approval

| Role | Name | Date |
|------|------|------|
| Doctrine Owner | Barton Enterprises | 2025-12-18 |
| Technical Reviewer | | |

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2025-12-18 | Initial doctrine lock |
