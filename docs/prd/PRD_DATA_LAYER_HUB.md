# PRD — Data Layer Hub

## 1. Overview

- **System Name:** Storage Site Scout
- **Hub Name:** DATA_LAYER_HUB
- **Owner:** Barton Enterprises / SVG Agency
- **Version:** 1.0.0
- **Doctrine ID:** SS.03.00

---

## 2. Purpose

The Data Layer Hub manages all database connections and persistence operations across the Storage Site Scout system. It provides unified adapters for Supabase (Lovable.DB), Neon PostgreSQL (STAMPED vault), and Firebase (SPVPET realtime working memory).

**Boundary:** This hub owns all database connections, schema management, and data persistence. It does NOT own business logic, calculations, or verdicts (those belong to Pass-1 and Pass-2).

**Input:** Data objects from Pass-1 and Pass-2 spokes
**Output:** Persisted records, query results, connection health status

---

## 3. Spokes (Components)

| Component Name | Doctrine ID | Capability | Tools |
|----------------|-------------|------------|-------|
| SUPABASE_ADAPTER | SS.03.01 | Supabase/Lovable.DB adapter for pass1_runs, pass2_runs, staging | supabase_client |
| NEON_VAULT | SS.03.02 | Neon PostgreSQL for STAMPED vault data | neon_client, pg_client |
| FIREBASE_REALTIME | SS.03.03 | Firebase for SPVPET realtime working memory | firebase_client |

---

## 4. Connectors

| Connector | Type | Direction | Contract |
|-----------|------|-----------|----------|
| Supabase REST | API | Bidirectional | PostgREST endpoints for all tables |
| Neon PostgreSQL | Direct | Bidirectional | pg connection string, SQL queries |
| Firebase Realtime DB | API | Bidirectional | JSON read/write, listeners |
| Pass-1 Hub | Internal | Inbound | Write pass1_runs, staging_payload |
| Pass-2 Hub | Internal | Inbound | Write pass2_runs, vault |

---

## 5. Tools

| Tool | Doctrine ID | Owner | ADR |
|------|-------------|-------|-----|
| supabase_client | SS.03.T01 | This Hub | ADR-008 |
| neon_client | SS.03.T02 | This Hub | ADR-009 |
| pg_client | SS.03.T03 | This Hub | - |
| firebase_client | SS.03.T04 | This Hub | ADR-010 |
| lovable_adapter | SS.03.T05 | This Hub | - |

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

### Firebase (SPVPET)

| Path | Purpose |
|------|---------|
| /working_memory/{session_id} | Active session state |
| /pipeline_status/{run_id} | Real-time pipeline progress |

---

## 13. Connection Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA_LAYER_HUB                           │
│                     (SS.03.00)                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ SUPABASE_ADAPTER│  │   NEON_VAULT    │  │  FIREBASE   │ │
│  │   (SS.03.01)    │  │   (SS.03.02)    │  │ (SS.03.03)  │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                    │                   │        │
└───────────┼────────────────────┼───────────────────┼────────┘
            │                    │                   │
            ▼                    ▼                   ▼
    ┌───────────────┐    ┌───────────────┐   ┌─────────────┐
    │   Supabase    │    │     Neon      │   │  Firebase   │
    │  (Lovable.DB) │    │  PostgreSQL   │   │  Realtime   │
    │               │    │               │   │             │
    │ - pass1_runs  │    │ - vault       │   │ - working   │
    │ - pass2_runs  │    │ - vault_hist  │   │   memory    │
    │ - staging     │    │               │   │ - pipeline  │
    │ - engine_logs │    │               │   │   status    │
    └───────────────┘    └───────────────┘   └─────────────┘
```

---

## 14. Data Flow

```
Pass-1 Hub                          Pass-2 Hub
    │                                   │
    │ write pass1_runs                  │ write pass2_runs
    │ write staging_payload             │ write vault
    ▼                                   ▼
┌─────────────────────────────────────────────────────────┐
│                    DATA_LAYER_HUB                       │
│                                                         │
│  ┌──────────────┐                                       │
│  │ LovableAdapter│◀─────────────────────────────────┐   │
│  └──────┬───────┘                                   │   │
│         │                                           │   │
│         ▼                                           │   │
│  ┌──────────────┐     ┌──────────────┐     ┌───────┴─┐ │
│  │   Supabase   │     │     Neon     │     │ Firebase│ │
│  │    Client    │     │    Client    │     │  Client │ │
│  └──────────────┘     └──────────────┘     └─────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Approval

| Role | Name | Date |
|------|------|------|
| Owner | Barton Enterprises | 2025-12-15 |
| Reviewer | | |
