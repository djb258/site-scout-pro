# Hub Compliance Checklist — PASS2_UNDERWRITING_HUB

**Doctrine ID:** SS.02.00
**Last Updated:** 2025-12-17
**Status:** [ ] Compliant / [ ] Non-Compliant

---

This checklist must be completed before any changes to PASS2_UNDERWRITING_HUB can ship.
No exceptions. No partial compliance.

---

## Pre-Ship Checklist

### 1. Documentation

- [x] Hub purpose and boundary defined
- [x] Hub PRD exists and is versioned (`docs/prd/PRD_PASS2_UNDERWRITING_HUB.md`)
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
- [x] Rate limits configured for external APIs (Regrid, FEMA)
- [x] Timeouts set for all spokes

### 4. Quality Gates

- [x] Promotion gates defined (G1-G5)
- [ ] All unit tests passing
- [ ] Integration tests with orchestrator passing
- [ ] Staging deployment verified

### 5. Observability

- [x] Logging implemented (`[PASS2_UNDERWRITING_HUB]` prefix)
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
| Zoning | SS.02.01 | [x] | [x] | [ ] |
| CivilConstraints | SS.02.02 | [x] | [x] | [ ] |
| PermitsStatic | SS.02.03 | [x] | [x] | [ ] |
| PricingVerification | SS.02.04 | [x] | [x] | [ ] |
| FusionDemand | SS.02.05 | [x] | [x] | [ ] |
| CompetitivePressure | SS.02.06 | [x] | [x] | [ ] |
| Feasibility | SS.02.07 | [x] | [x] | [ ] |
| ReverseFeasibility | SS.02.08 | [x] | [x] | [ ] |
| MomentumReader | SS.02.09 | [x] | [x] | [ ] |
| Verdict | SS.02.10 | [x] | [x] | [ ] |
| VaultMapper | SS.02.11 | [x] | [x] | [ ] |

---

## Tool Registry

| Tool | ADR | Rate Limited | Kill Switch |
|------|-----|--------------|-------------|
| zoning_api | ADR-004 | [x] | [x] |
| regrid | ADR-004 | [x] | [x] |
| civil_calculator | - | N/A | N/A |
| fema_api | - | [x] | [x] |
| usgs_dem | - | [x] | [x] |
| permit_db | - | [ ] | [x] |
| buildzoom | - | [x] | [x] |
| rent_benchmarks | - | [ ] | [x] |
| fusion_calculator | - | N/A | N/A |
| pressure_calculator | - | N/A | N/A |
| feasibility_engine | ADR-006 | N/A | N/A |
| reverse_engine | - | N/A | N/A |
| momentum_reader | - | N/A | N/A |
| verdict_engine | ADR-007 | N/A | N/A |
| vault_mapper | - | N/A | N/A |
| neon_db | - | [ ] | [x] |

---

## Verdict Logic Compliance

| Check | Status |
|-------|--------|
| Verdict weights sum to 100% | [x] |
| Fatal flaws trigger auto-WALK | [x] |
| DSCR threshold enforced (>= 1.25) | [x] |
| Cap rate target defined (>= 6.5%) | [x] |
| NOI/Acre minimum ($5,000/month) | [x] |
| Override audit trail implemented | [x] |

---

## Barton Doctrine Compliance

| Check | Status |
|-------|--------|
| $5,000/month per acre minimum | [x] |
| 25% NOI haircut stress test | [x] |
| Zoning sovereignty (by-right) | [x] |
| Debt survivability at 6%/25yr | [x] |
| No-emotion rule (math-driven) | [x] |

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
