# ERD: Shared / Reference Tables

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)  
> **CC Layer:** CC-03 (Context Artifacts)

## Ownership Declaration

- **Hub:** Shared (no single owner)
- **Anchor:** Multiple (ZIP, SVA, County FIPS)
- **Anchor Invariant:** Reference tables serve as lookup anchors — no single row ownership.
- **Authority:** READ-ONLY for all sub-hubs, WRITE via system processes only
- **Purpose:** Reference data, identity containers, cross-hub logging

---

## Tables (System-Managed)

| Table | Primary Key | Description | Write Authority |
|-------|-------------|-------------|-----------------|
| `sovereign_ids` | `sva_id` (UUID) | SVA identity container | System (SVA creation) |
| `sovereign_id_zips` | `id` (UUID) | SVA → ZIP mapping | System (SVA creation) |
| `sovereign_id_counties` | `id` (UUID) | SVA → County mapping | System (SVA creation) |
| `ref_zip_replica` | `zip` (string) | ZIP centroid coordinates | System (sync from Neon) |
| `us_zip_codes` | `zip` (string) | Master ZIP list (Neon) | System (Neon authority) |
| `master_failure_log` | `id` (UUID) | Cross-hub error tracking | All sub-hubs (log only) |
| `engine_logs` | `id` (UUID) | System engine logging | System |
| `generic_ingest_log` | `id` (UUID) | Generic ingest tracking | System |
| `ai_cost_tracker` | `id` (UUID) | AI usage cost tracking | System |
| `zip_runs` | `id` (UUID) | ZIP-level run tracking | System (orchestrator) |

---

## Access Pattern

**All sub-hubs have READ-ONLY access to these tables.**

Write operations are performed only by:
- System orchestrators (SVA creation, ZIP sync)
- Error logging functions (master_failure_log)
- Cost tracking functions (ai_cost_tracker)

---

## Key Relationships

```
sovereign_id_zips.sva_id → sovereign_ids.sva_id
sovereign_id_counties.sva_id → sovereign_ids.sva_id
ref_zip_replica.zip ← (synced from us_zip_codes in Neon)
```

---

## Mermaid ERD

See: [ERD_Shared_Ref.mermaid](./ERD_Shared_Ref.mermaid)

---

## Cross-Hub Rules

- **No sub-hub owns these tables**
- All sub-hubs may READ for identity resolution
- Only system processes may WRITE
- `master_failure_log` is the exception: all sub-hubs may append errors

---

## Sync Pattern

Reference data follows the replica pattern:
1. **Authority:** Neon (us_zip_codes)
2. **Replica:** Supabase (ref_zip_replica)
3. **Sync:** System process with version tracking
4. **Access:** Read-only for all application code
