# Hub Compliance Checklist — PASS3_DESIGN_HUB

**Doctrine ID:** SS.03.00
**Last Updated:** 2025-12-19
**Status:** [ ] Compliant / [ ] Non-Compliant

---

> **IMPORTANT (2025-12-19):** Pass 3 spokes are **VAULT LOGGERS**, not calculators.
> All calculations are performed in Lovable.dev. Pass 3 receives results and
> persists them to Neon vault via `logXxxToVault()` functions.
>
> See: ADR-025 (Vault Guardian Doctrine)

---

This checklist must be completed before any changes to PASS3_DESIGN_HUB can ship.
No exceptions. No partial compliance.

---

## Pre-Ship Checklist

### 1. Documentation

- [x] Hub purpose and boundary defined
- [x] Hub PRD exists and is versioned (`docs/prd/PRD_PASS3_DESIGN_HUB.md`)
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

- [x] Logging implemented (`[PASS3_DESIGN_HUB]` prefix)
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
| SetbackEngine | SS.03.01 | [x] | [x] | [ ] |
| CoverageEngine | SS.03.02 | [x] | [x] | [ ] |
| UnitMixOptimizer | SS.03.03 | [x] | [x] | [ ] |
| PhasePlanner | SS.03.04 | [x] | [x] | [ ] |
| BuildCostModel | SS.03.05 | [x] | [x] | [ ] |
| NOIEngine | SS.03.06 | [x] | [x] | [ ] |
| DebtModel | SS.03.07 | [x] | [x] | [ ] |
| MaxLandPrice | SS.03.08 | [x] | [x] | [ ] |
| IRRModel | SS.03.09 | [x] | [x] | [ ] |

---

## Tool Registry

| Tool | ADR | Rate Limited | Kill Switch |
|------|-----|--------------|-------------|
| geometry_engine | - | N/A | N/A |
| parcel_api | - | [x] | [x] |
| coverage_calculator | - | N/A | N/A |
| mix_optimizer | ADR-010 | N/A | N/A |
| phase_engine | - | N/A | N/A |
| cost_calculator | ADR-011 | N/A | N/A |
| noi_calculator | - | N/A | N/A |
| debt_calculator | - | N/A | N/A |
| residual_calculator | - | N/A | N/A |
| irr_calculator | ADR-012 | N/A | N/A |

---

## Financial Model Compliance

| Check | Status |
|-------|--------|
| Build cost maximum ($27/sqft) | [x] |
| Dirt work maximum (20%) | [x] |
| DSCR minimum (1.25x) | [x] |
| Phase 1 timeline (90 days) | [x] |
| Target cap rate (6.5%+) | [x] |
| Stabilization occupancy (85%) | [x] |

---

## Return Threshold Compliance

| Check | Status |
|-------|--------|
| Unlevered IRR minimum (8%) | [x] |
| Levered IRR minimum (12%) | [x] |
| Cash-on-cash Y1 minimum (6%) | [x] |
| Equity multiple minimum (1.5x) | [x] |

---

## Barton Doctrine Compliance

| Check | Status |
|-------|--------|
| $5,000/month per acre minimum | [x] |
| Phase-first construction (20-40 units) | [x] |
| 25% NOI haircut stress test | [x] |
| Debt survivability at 6%/25yr | [x] |
| 85% occupancy phase trigger | [x] |

---

## Vault Guardian Compliance (CRITICAL)

> Per ADR-025, Pass 3 spokes are **VAULT LOGGERS** that receive results from
> Lovable.dev and persist them to Neon vault.

### Vault Logger Architecture

- [x] Pass 3 spokes do NOT perform calculations
- [x] Pass 3 receives results from Lovable.dev
- [x] Pass 3 writes via `logXxxToVault()` functions ONLY
- [x] Each spoke exports `logXxxToVault(opportunityId, result)` function
- [x] Legacy `runXxx()` functions marked deprecated

### Approved Vault Operations

| Spoke | Vault Function |
|-------|---------------|
| SetbackEngine | `logSetbackToVault()` |
| CoverageEngine | `logCoverageToVault()` |
| UnitMixOptimizer | `logUnitMixToVault()` |
| PhasePlanner | `logPhasePlanToVault()` |
| BuildCostModel | `logBuildCostToVault()` |
| NOIEngine | `logNOIToVault()` |
| DebtModel | `logDebtModelToVault()` |
| MaxLandPrice | `logMaxLandPriceToVault()` |
| IRRModel | `logIRRModelToVault()` |

### Database Access Rules

- [x] Pass 3 CAN import `NeonAdapter` (for vault writes)
- [x] Pass 3 writes to `vault.opportunities` ONLY
- [x] All writes use `neonAdapter.insertVaultRecord()`
- [x] CI guard `check_vault_write_pattern.sh` passes

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
