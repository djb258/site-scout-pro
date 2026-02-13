# Hub Compliance Checklist — PASS15_RENT_RECON_HUB

**Doctrine ID:** SS.015.00
**Last Updated:** 2026-02-13
**Status:** IN REVIEW

---

This checklist must be completed before any changes to PASS15_RENT_RECON_HUB can ship.
No exceptions. No partial compliance.

---

## Conformance

| Field | Value |
|-------|-------|
| **Doctrine Version** | 2.0.0 |
| **CTB Version** | 2.0.0 |
| **Hub Name** | Barton Storage System |
| **Hub ID** | barton-storage |
| **Pass** | Pass 1.5 — Rent Reconciliation |

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
| A.1.2 | Constants (inputs) are declared | [ ] | See PRD_PASS15_RENT_RECON_HUB.md Section 5 |
| A.1.3 | Variables (outputs) are declared | [ ] | See PRD_PASS15_RENT_RECON_HUB.md Section 6 |
| A.1.4 | CONST -> VAR transformation is defined | [ ] | See PRD_PASS15_RENT_RECON_HUB.md Section 3 |

---

## SS A.2 — PRD Compliance (Behavioral Proof)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| A.2.1 | PRD exists and follows v2.0.0 template | [ ] | docs/prd/PRD_PASS15_RENT_RECON_HUB.md |
| A.2.2 | HSS section is present in PRD | [ ] | HSS section |
| A.2.3 | All 15 sections present | [ ] | Sections 1-15 |
| A.2.4 | OSAM Compliance Declaration present | [ ] | OSAM section in PRD |

---

## SS A.3 — ERD Compliance (Structural Proof)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| A.3.1 | ERD exists for this pass | [ ] | docs/erd/ERD_SubHub1_Market.md |
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

These sections verify the pass is ready to ship.
Part B assumes Part A passes.

---

## Pre-Ship Checklist

### 1. Documentation

- [x] Hub purpose and boundary defined
- [x] Hub PRD exists and is versioned (`docs/prd/PRD_PASS15_RENT_RECON_HUB.md`)
- [x] Spokes (capabilities) explicitly listed
- [x] Connectors (API / CSV / Event) defined
- [x] Approved tools listed at hub level

### 2. Architecture

- [x] No sideways hub-to-hub calls
- [x] All spokes inherit tools from hub (no spoke-level tool registration)
- [x] IMO-RA architecture file updated (`imo-architecture.json`)
- [x] Doctrine IDs assigned to all spokes

### 3. Safety Controls

- [x] Guard rails implemented (schema, validation, permissions)
- [x] Kill switch defined and testable
- [x] Rate limits configured for external APIs (Retell.ai, Firecrawl)
- [x] Timeouts set for all spokes

### 4. Quality Gates

- [x] Promotion gates defined (G1-G5)
- [ ] All unit tests passing
- [ ] Integration tests with orchestrator passing
- [ ] Staging deployment verified

### 5. Observability

- [x] Logging implemented (`[PASS15_RENT_RECON_HUB]` prefix)
- [x] Metrics defined and tracked
- [x] Alerts configured for critical failures
- [x] Master Failure Hub integration

### 6. Failure Handling

- [x] Failure modes documented
- [x] Auto-repair hooks configured where applicable
- [x] Remediation steps defined
- [x] Human override rules defined

### 7. Security

- [ ] No secrets in code
- [ ] Environment variables for credentials
- [ ] API keys rotatable
- [ ] Audit trail for overrides

---

## Spoke Compliance

| Spoke | Doctrine ID | Tools Inherited | Failures Documented | Tests |
|-------|-------------|-----------------|--------------------:|-------|
| PublishedRateScraper | SS.015.01 | [x] | [x] | [ ] |
| AICallWorkOrders | SS.015.02 | [x] | [x] | [ ] |
| RateEvidenceNormalizer | SS.015.03 | [x] | [x] | [ ] |
| CoverageConfidence | SS.015.04 | [x] | [x] | [ ] |
| PromotionGate | SS.015.05 | [x] | [x] | [ ] |

---

## Tool Registry

| Tool | ADR | Rate Limited | Kill Switch |
|------|-----|--------------|-------------|
| firecrawl | ADR-009 | [x] | [x] |
| sparefoot_api | - | [x] | [x] |
| selfstorage_api | - | [x] | [x] |
| retell_ai | ADR-005 | [x] | [x] |
| call_scheduler | - | N/A | N/A |
| rate_normalizer | - | N/A | N/A |
| coverage_calculator | - | N/A | N/A |
| validator | - | N/A | N/A |

---

## Rate Collection Compliance

| Check | Status |
|-------|--------|
| AI call concurrency limit (20) | [x] |
| AI call duration limit (180s) | [x] |
| Minimum coverage threshold (60%) | [x] |
| Multi-source verification required | [x] |
| Call transcripts stored | [x] |

---

## Coverage Scoring Compliance

| Check | Status |
|-------|--------|
| Coverage weights sum to 100% | [x] |
| Coverage thresholds defined (high/medium/low) | [x] |
| Confidence levels defined | [x] |
| Override audit trail implemented | [x] |

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
