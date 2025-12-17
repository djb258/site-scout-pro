# Hub Compliance Checklist — PASS0_RADAR_HUB

**Doctrine ID:** SS.00.00
**Last Updated:** 2025-12-17
**Status:** [ ] Compliant / [ ] Non-Compliant

---

This checklist must be completed before any changes to PASS0_RADAR_HUB can ship.
No exceptions. No partial compliance.

---

## Pre-Ship Checklist

### 1. Documentation

- [x] Hub purpose and boundary defined
- [x] Hub PRD exists and is versioned (`docs/prd/PRD_PASS0_RADAR_HUB.md`)
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
- [x] Rate limits configured for external APIs
- [x] Timeouts set for all spokes

### 4. Quality Gates

- [x] Promotion gates defined (G1-G5)
- [ ] All unit tests passing
- [ ] Integration tests with orchestrator passing
- [ ] Staging deployment verified

### 5. Observability

- [x] Logging implemented (`[PASS0_RADAR_HUB]` prefix)
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
| TrendSignal | SS.00.01 | [x] | [x] | [ ] |
| PermitActivity | SS.00.02 | [x] | [x] | [ ] |
| NewsEvents | SS.00.03 | [x] | [x] | [ ] |
| IndustrialLogistics | SS.00.04 | [x] | [x] | [ ] |
| HousingPipeline | SS.00.05 | [x] | [x] | [ ] |
| MomentumFusion | SS.00.06 | [x] | [x] | [ ] |

---

## Tool Registry

| Tool | ADR | Rate Limited | Kill Switch |
|------|-----|--------------|-------------|
| google_trends_api | ADR-008 | [x] | [x] |
| permit_api | - | [x] | [x] |
| census_building_permits | - | [x] | [x] |
| news_api | - | [x] | [x] |
| firecrawl | ADR-009 | [x] | [x] |
| costar_api | - | [x] | [x] |
| logistics_db | - | [ ] | [x] |
| census_housing | - | [x] | [x] |
| housing_db | - | [ ] | [x] |
| fusion_engine | - | N/A | N/A |

---

## Momentum Scoring Compliance

| Check | Status |
|-------|--------|
| Signal weights sum to 100% | [x] |
| Minimum 3 spokes required for valid fusion | [x] |
| Confidence levels defined (high/medium/low) | [x] |
| Top contributors tracked | [x] |

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
