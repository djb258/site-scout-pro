# Hub Compliance Checklist — PASS15_RENT_RECON_HUB

**Doctrine ID:** SS.015.00
**Last Updated:** 2025-12-17
**Status:** [ ] Compliant / [ ] Non-Compliant

---

This checklist must be completed before any changes to PASS15_RENT_RECON_HUB can ship.
No exceptions. No partial compliance.

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

## Compliance Rule

**If any required box is unchecked, this hub may not ship.**

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Hub Owner | | | |
| Reviewer | | | |
| QA | | | |
