# Hub Compliance Checklist — PASS1_STRUCTURE_HUB

**Doctrine ID:** SS.01.00
**Last Updated:** 2025-12-17
**Status:** [ ] Compliant / [ ] Non-Compliant

---

This checklist must be completed before any changes to PASS1_STRUCTURE_HUB can ship.
No exceptions. No partial compliance.

---

## Pre-Ship Checklist

### 1. Documentation

- [x] Hub purpose and boundary defined
- [x] Hub PRD exists and is versioned (`docs/prd/PRD_PASS1_STRUCTURE_HUB.md`)
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

- [x] Logging implemented (`[PASS1_STRUCTURE_HUB]` prefix)
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
| ZipHydration | SS.01.01 | [x] | [x] | [ ] |
| RadiusBuilder | SS.01.02 | [x] | [x] | [ ] |
| MacroDemand | SS.01.03 | [x] | [x] | [ ] |
| MacroSupply | SS.01.04 | [x] | [x] | [ ] |
| CompetitorRegistry | SS.01.05 | [x] | [x] | [ ] |
| LocalScan | SS.01.06 | [x] | [x] | [ ] |
| HotspotScoring | SS.01.07 | [x] | [x] | [ ] |
| ValidationGate | SS.01.08 | [x] | [x] | [ ] |

---

## Tool Registry

| Tool | ADR | Rate Limited | Kill Switch |
|------|-----|--------------|-------------|
| census_api | ADR-001 | [x] | [x] |
| lovable_db | - | [ ] | [x] |
| haversine_calc | - | N/A | N/A |
| county_adjacency | - | N/A | N/A |
| demand_calculator | - | N/A | N/A |
| google_places | ADR-002 | [x] | [x] |
| competitor_db | - | [ ] | [x] |
| brand_classifier | - | N/A | N/A |
| local_scanner | - | N/A | N/A |
| scoring_engine | ADR-003 | N/A | N/A |
| validator | - | N/A | N/A |

---

## Hotspot Scoring Compliance

| Check | Status |
|-------|--------|
| Scoring weights sum to 100% | [x] |
| Tier thresholds defined (A/B/C/D) | [x] |
| Promotion criteria (>= 60 score) | [x] |
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
