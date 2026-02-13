# Hub Compliance Checklist — DATA_LAYER_HUB

**Doctrine ID:** SS.03.00
**Last Updated:** 2026-02-13
**Status:** IN REVIEW

---

This checklist must be completed before any changes to DATA_LAYER_HUB can ship.
No exceptions. No partial compliance.

---

## Conformance

| Field | Value |
|-------|-------|
| **Doctrine Version** | 2.0.0 |
| **CTB Version** | 2.0.0 |
| **Hub Name** | Barton Storage System |
| **Hub ID** | barton-storage |
| **Pass** | Data Layer — Shared Infrastructure |

---

# PART A — CONSTITUTIONAL VALIDITY

These sections verify the hub satisfies the Transformation Law.
Failure in Part A invalidates the hub regardless of Part B status.

**Section Anchors**: SS A.1 through SS A.7

---

## SS A.1 — Constitutional Validity (CONST -> VAR)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| A.1.1 | Constitution exists and is LOCKED | [ ] | BARTON_STORAGE_SYSTEM_CONSTITUTION.md |
| A.1.2 | Constants (inputs) are declared | [ ] | See PRD_DATA_LAYER_HUB.md Section 5 |
| A.1.3 | Variables (outputs) are declared | [ ] | See PRD_DATA_LAYER_HUB.md Section 6 |
| A.1.4 | CONST -> VAR transformation is defined | [ ] | See PRD_DATA_LAYER_HUB.md Section 3 |

---

## SS A.2 — PRD Compliance (Behavioral Proof)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| A.2.1 | PRD exists and follows v2.0.0 template | [ ] | docs/prd/PRD_DATA_LAYER_HUB.md |
| A.2.2 | HSS section is present in PRD | [ ] | HSS section |
| A.2.3 | All 15 sections present | [ ] | Sections 1-15 |
| A.2.4 | OSAM Compliance Declaration present | [ ] | OSAM section in PRD |

---

## SS A.3 — ERD Compliance (Structural Proof)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| A.3.1 | ERD exists for this layer | [ ] | docs/erd/ERD_Shared_Ref.md |
| A.3.2 | Mermaid companion files exist | [ ] | docs/erd/*.mermaid |
| A.3.3 | Tables trace to PRD constants | [ ] | Pressure Test Q1 |
| A.3.4 | Tables produce PRD variables | [ ] | Pressure Test Q2 |

---

## SS A.4 — ERD Pressure Test

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| A.4.1 | Q1: Every table traces to a PRD constant | [ ] | |
| A.4.2 | Q2: Every table produces a PRD variable | [ ] | |
| A.4.3 | Q3: Every table has pass ownership | [ ] | |
| A.4.4 | Q4: Every table has lineage mechanism | [ ] | |

---

## SS A.5 — ERD Upstream Flow Test

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| A.5.1 | All FKs resolve to valid PKs | [ ] | |
| A.5.2 | No orphaned references | [ ] | |
| A.5.3 | Cross-hub joins are declared | [ ] | |

---

## SS A.6 — OSAM Compliance (Semantic Access Map)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| A.6.1 | OSAM exists | [ ] | docs/semantic/OSAM_BARTON_STORAGE.md |
| A.6.2 | Universal join key declared | [ ] | sovereign_id |
| A.6.3 | All tables classified | [ ] | OSAM table classification |
| A.6.4 | No undeclared joins in ERDs | [ ] | |

---

## SS A.7 — Process Compliance (Execution Declaration)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| A.7.1 | Process declarations exist for each pass | [ ] | docs/process/ |
| A.7.2 | CAPTURE/COMPUTE/GOVERN sequences declared | [ ] | |
| A.7.3 | Governing PRD/ERD references present | [ ] | |

---

# PART B — OPERATIONAL COMPLIANCE

These sections verify the data layer is ready to ship.
Part B assumes Part A passes.

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

## Compliance Gate Verification

| Gate | Requirement | Status |
|------|-------------|--------|
| Part A — All CRITICAL items checked | Zero unchecked CRITICAL items in Part A | [ ] |
| Part B — All CRITICAL items checked | Zero unchecked CRITICAL items in Part B | [ ] |
| Zero-tolerance enforcement | No forbidden folders, no doctrine violations | [ ] |

## AI Agent Acknowledgment

I, the AI agent, confirm:
- [ ] I have read and understood the governing doctrine (v2.0.0)
- [ ] I have not fabricated any compliance evidence
- [ ] All unchecked items are genuinely incomplete

## Document Control

| Field | Value |
|-------|-------|
| Last Modified | 2026-02-13 |
| Version | 2.0.0 |
| Status | IN REVIEW |
