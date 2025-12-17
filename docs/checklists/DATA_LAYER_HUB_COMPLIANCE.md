# Hub Compliance Checklist — DATA_LAYER_HUB

**Doctrine ID:** SS.03.00
**Last Updated:** 2025-12-15
**Status:** [ ] Compliant / [ ] Non-Compliant

---

This checklist must be completed before any changes to DATA_LAYER_HUB can ship.
No exceptions. No partial compliance.

---

## Pre-Ship Checklist

### 1. Documentation

- [x] Hub purpose and boundary defined
- [x] Hub PRD exists and is versioned (`docs/prd/PRD_DATA_LAYER_HUB.md`)
- [x] Components explicitly listed
- [x] Connectors (API / Direct) defined
- [x] Approved tools listed at hub level

### 2. Architecture

- [x] No sideways hub-to-hub calls
- [x] All components properly isolated
- [x] IMO-RA architecture file updated (`imo-architecture.json`)
- [x] Doctrine IDs assigned to all components

### 3. Safety Controls

- [x] Guard rails implemented (connection pools, timeouts)
- [x] Kill switch defined and testable
- [x] Connection health checks configured
- [x] Retry policies with exponential backoff

### 4. Quality Gates

- [x] Promotion gates defined (G1-G5)
- [ ] All unit tests passing
- [ ] Migration scripts tested
- [ ] Backup/restore verified

### 5. Observability

- [x] Logging implemented for connection events
- [x] Metrics defined (pool usage, query latency)
- [x] Alerts configured for connection failures
- [x] Master Failure Hub integration

### 6. Failure Handling

- [x] Failure modes documented
- [x] Auto-repair hooks for reconnection
- [x] Remediation steps defined
- [x] Failover procedures documented

### 7. Security

- [ ] No secrets in code
- [ ] Connection strings in environment variables
- [ ] Credentials rotatable
- [ ] Audit trail for schema changes

---

## Component Compliance

| Component | Doctrine ID | Connection Verified | Health Check | Failover |
|-----------|-------------|--------------------:|-------------:|----------|
| SUPABASE_ADAPTER | SS.03.01 | [x] | [x] | [ ] |
| NEON_VAULT | SS.03.02 | [x] | [x] | [ ] |
| FIREBASE_REALTIME | SS.03.03 | [x] | [x] | [ ] |

---

## Database Schema Compliance

### Supabase Tables

| Table | Schema Documented | Indexes | RLS Policies |
|-------|-------------------|---------|--------------|
| pass1_runs | [x] | [ ] | [ ] |
| pass2_runs | [x] | [ ] | [ ] |
| staging_payload | [x] | [ ] | [ ] |
| engine_logs | [x] | [ ] | [ ] |
| jurisdiction_cards | [x] | [ ] | [ ] |
| rate_observations | [x] | [ ] | [ ] |
| rent_benchmarks | [x] | [ ] | [ ] |

### Neon Tables

| Table | Schema Documented | Indexes | Versioning |
|-------|-------------------|---------|------------|
| vault | [x] | [ ] | [x] |
| vault_history | [x] | [ ] | [x] |

---

## Connection Pool Settings

| Database | Min Pool | Max Pool | Timeout | Health Interval |
|----------|----------|----------|---------|-----------------|
| Supabase | 2 | 10 | 60s | 30s |
| Neon | 2 | 10 | 60s | 30s |
| Firebase | N/A | N/A | 30s | 30s |

---

## Compliance Rule

**If any required box is unchecked, this hub may not ship.**

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Hub Owner | | | |
| DBA | | | |
| Reviewer | | | |
