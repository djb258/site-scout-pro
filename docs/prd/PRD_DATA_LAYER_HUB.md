# PRD — Data Layer Hub

## 1. Overview

- **System Name:** Storage Site Scout
- **Hub Name:** DATA_LAYER_HUB
- **Owner:** Barton Enterprises / SVG Agency
- **Version:** 1.2.0
- **Doctrine ID:** SS.DL.00

---

## 2. Purpose

The Data Layer Hub manages all database connections and persistence operations across the Storage Site Scout system. It provides unified adapters for Supabase (Lovable.DB) and Neon PostgreSQL (STAMPED vault + static reference schema).

**Boundary:** This hub owns all database connections, schema management, and data persistence. It does NOT own business logic, calculations, or verdicts (those belong to Pass-1 and Pass-2).

**NOTE:** Firebase is NOT used in this system. All persistence goes through Supabase or Neon.

**Input:** Data objects from Pass-1 and Pass-2 spokes
**Output:** Persisted records, query results, connection health status

---

## 3. Spokes (Components)

| Component Name | Doctrine ID | Capability | Tools |
|----------------|-------------|------------|-------|
| SUPABASE_ADAPTER | SS.DL.01 | Supabase/Lovable.DB adapter for pass runs, staging | supabase_client |
| NEON_VAULT | SS.DL.02 | Neon PostgreSQL for STAMPED vault data | neon_client, pg_client |
| NEON_REF_SCHEMA | SS.DL.03 | Static reference tables (geography, asset types) | neon_client |

---

## 4. Connectors

| Connector | Type | Direction | Contract |
|-----------|------|-----------|----------|
| Supabase REST | API | Bidirectional | PostgREST endpoints for all tables |
| Neon PostgreSQL | Direct | Bidirectional | pg connection string, SQL queries |
| Pass-0 Hub | Internal | Inbound | Read ref schema (momentum signals) |
| Pass-1 Hub | Internal | Inbound | Read ref schema, write pass1_runs |
| Pass-2 Hub | Internal | Inbound | Write pass2_runs, vault |

---

## 5. Tools

| Tool | Doctrine ID | Owner | ADR |
|------|-------------|-------|-----|
| supabase_client | SS.DL.T01 | This Hub | ADR-017 |
| neon_client | SS.DL.T02 | This Hub | ADR-016 |
| pg_client | SS.DL.T03 | This Hub | ADR-016 |
| lovable_adapter | SS.DL.T04 | This Hub | - |

---

## 6. Guard Rails

| Guard Rail | Type | Threshold |
|------------|------|-----------|
| Connection Pool Size | Resource | Min: 2, Max: 10 |
| Query Timeout | Timeout | 60 seconds |
| Write Retry | Retry | 3 attempts with exponential backoff |
| Connection Health Check | Validation | Every 30 seconds |
| Transaction Isolation | Validation | Read Committed |

---

## 7. Kill Switch

- **Endpoint:** `/api/admin/datalayer/kill`
- **Activation Criteria:**
  - All database connections failing
  - Write queue exceeding 1000 pending operations
  - Connection pool exhausted
- **Emergency Contact:** System Admin via Slack #storage-alerts
- **Recovery:** Failover to backup connections, manual restart

---

## 8. Promotion Gates

| Gate | Requirement |
|------|-------------|
| G1 | All unit tests pass |
| G2 | Hub compliance checklist complete |
| G3 | Migration scripts tested |
| G4 | Backup/restore verified |
| G5 | Connection failover tested |

---

## 9. Failure Modes

| Failure Code | Component | Severity | Remediation |
|--------------|-----------|----------|-------------|
| SUPABASE_CONNECTION_FAILED | SUPABASE_ADAPTER | critical | Check credentials, verify service status |
| NEON_CONNECTION_FAILED | NEON_VAULT | critical | Check connection string, verify service status |
| FIREBASE_AUTH_FAILED | FIREBASE_REALTIME | critical | Check credentials, verify project ID |
| DATA_LAYER_DEGRADED | Hub | error | Activate fallback data sources, queue writes |
| WRITE_TIMEOUT | Any | error | Retry with backoff, log for investigation |
| CONNECTION_POOL_EXHAUSTED | Any | critical | Scale pool, investigate connection leaks |

---

## 10. Human Override Rules

| Override | Condition | Approver |
|----------|-----------|----------|
| Force Reconnect | Connection stuck in bad state | System Admin |
| Bypass Write Queue | Critical data must persist immediately | Hub Owner |
| Manual Migration | Schema change outside normal deploy | System Admin |

---

## 11. Observability

- **Logs:**
  - Connection events (connect, disconnect, error)
  - Query performance (slow queries > 1s)
  - Write failures with payloads

- **Metrics:**
  - `connection_pool_usage` - Active vs available connections
  - `query_latency_p95` - 95th percentile query time
  - `write_success_rate` - % of successful writes
  - `connection_error_rate` - Connection failures per minute

- **Alerts:**
  - Slack #storage-alerts for connection failures
  - PagerDuty for DATA_LAYER_DEGRADED
  - Master Failure Hub aggregation

---

## 12. Database Schema

### Supabase (Lovable.DB)

| Table | Purpose | Primary Key |
|-------|---------|-------------|
| pass1_runs | Pass-1 execution results | id (uuid) |
| pass2_runs | Pass-2 execution results | id (uuid) |
| staging_payload | Intermediate data between passes | id (uuid) |
| engine_logs | System logging and audit trail | id (uuid) |
| jurisdiction_cards | Cached jurisdiction data | id (uuid) |
| rate_observations | Collected rate data | id (uuid) |
| rent_benchmarks | Aggregated rent benchmarks | id (uuid) |

### Neon PostgreSQL (STAMPED Vault)

| Table | Purpose | Primary Key |
|-------|---------|-------------|
| vault | Final underwriting records | id (uuid) |
| vault_history | Versioned vault records | id (uuid), version |

### Neon PostgreSQL (ref schema - Static Reference, Geography Only)

| Table | Purpose | Primary Key | Records |
|-------|---------|-------------|---------|
| ref.ref_country | Country geography root | country_id | 1 |
| ref.ref_state | US states (50 + DC) | state_id | 51 |
| ref.ref_county | Counties with FIPS codes | county_id | 3,132 |
| ref.ref_zip | ZIP codes (geography only) | zip_id | 40,745 |
| ref.ref_zip_county_map | ZIP to County linkage | (zip_id, county_id) | 40,728 |
| ref.ref_asset_class | Storage asset classifications | asset_class_id | 4 |
| ref.ref_unit_type | Unit types (climate/non-climate) | unit_type_id | 5 |
| ref.ref_unit_size | Standard unit dimensions | unit_size_id | 9 |

**ref.ref_zip Schema (Hardened 2025-12-18):**
```sql
CREATE TABLE ref.ref_zip (
    zip_id CHAR(5) PRIMARY KEY,
    state_id INTEGER NOT NULL REFERENCES ref.ref_state(state_id),
    lat NUMERIC(9,6),
    lon NUMERIC(10,6)
);
```

**FORBIDDEN in ref schema:** population, income, median_income, home_value, census_data, demographic data

**Note:** The `ref` schema is immutable static reference data containing GEOGRAPHY ONLY. It defines geography (where) and asset intent (what). Census/demographic data lives in `public.pass1_census_snapshot`. Passes decide (whether), calculators compute (how), and parcels come later (commit).

---

## 13. Connection Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA_LAYER_HUB                           │
│                     (SS.DL.00)                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ SUPABASE_ADAPTER│  │   NEON_VAULT    │  │  NEON_REF   │ │
│  │   (SS.DL.01)    │  │   (SS.DL.02)    │  │ (SS.DL.03)  │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                    │                   │        │
└───────────┼────────────────────┼───────────────────┼────────┘
            │                    │                   │
            ▼                    └─────────┬─────────┘
    ┌───────────────┐              ┌───────▼───────┐
    │   Supabase    │              │     Neon      │
    │  (Lovable.DB) │              │  PostgreSQL   │
    │               │              │               │
    │ - pass1_runs  │              │ public schema │
    │ - pass2_runs  │              │ - vault       │
    │ - staging     │              │ - zips_master │
    │ - engine_logs │              │               │
    │               │              │ ref schema    │
    │               │              │ - ref_country │
    │               │              │ - ref_state   │
    │               │              │ - ref_county  │
    │               │              │ - ref_zip     │
    │               │              │ - ref_asset   │
    │               │              │ - ref_unit_*  │
    └───────────────┘              └───────────────┘
```

---

## 14. Data Flow

```
Pass-0 Hub                Pass-1 Hub                Pass-2 Hub
    │                         │                         │
    │ read ref schema         │ read ref schema         │ write pass2_runs
    │                         │ write pass1_runs        │ write vault
    ▼                         ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│                    DATA_LAYER_HUB                       │
│                                                         │
│  ┌──────────────┐     ┌──────────────┐                 │
│  │LovableAdapter│     │  NeonAdapter │                 │
│  └──────┬───────┘     └──────┬───────┘                 │
│         │                    │                          │
│         ▼                    ▼                          │
│  ┌──────────────┐     ┌──────────────┐                 │
│  │   Supabase   │     │     Neon     │                 │
│  │    Client    │     │    Client    │                 │
│  └──────────────┘     └──────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

---

## 15. Related Documents

| Document | Path | Description |
|----------|------|-------------|
| ERD Hub-Spoke | [docs/ERD_HUB_SPOKE.md](../ERD_HUB_SPOKE.md) | Full entity relationship diagram with all passes |
| ZIP Replica Doctrine | [docs/doctrine/ZIP_REPLICA_SYNC_DOCTRINE.md](../doctrine/ZIP_REPLICA_SYNC_DOCTRINE.md) | Neon→Lovable replica sync rules |
| ADR-016 | [docs/adr/ADR-016-neon-database.md](../adr/ADR-016-neon-database.md) | Neon PostgreSQL database decision |
| ADR-013 | [docs/adr/ADR-013-master-failure-log.md](../adr/ADR-013-master-failure-log.md) | Master failure log architecture |
| Ref Schema SQL | [scripts/create_ref_schema.sql](../../scripts/create_ref_schema.sql) | Static reference schema definition |
| Hardening SQL | [scripts/harden_ref_schema.sql](../../scripts/harden_ref_schema.sql) | Ref schema hardening (geography-only) |
| Replica Sync SQL | [supabase/migrations/20251218_zip_replica_sync.sql](../../supabase/migrations/20251218_zip_replica_sync.sql) | Lovable replica tables and policies |

---

## Approval

| Role | Name | Date |
|------|------|------|
| Owner | Barton Enterprises | 2025-12-15 |
| Reviewer | | |
