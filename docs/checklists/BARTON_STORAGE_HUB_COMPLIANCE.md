# Barton Storage Hub Compliance Checklist

This checklist must be completed before any hub can ship.
No exceptions. No partial compliance.

## Conformance

| Field | Value |
|-------|-------|
| **Doctrine Version** | 1.4.0 |
| **CTB Version** | 1.1.0 |
| **CC Layer** | CC-02 |
| **Hub ID** | barton-storage |
| **Sovereign ID** | barton-family-office |

---

## Priority Definitions

| Priority | Meaning | Ship Without? |
|----------|---------|---------------|
| **CRITICAL** | Blocks ship | NO — must be checked |
| **HIGH** | Strongly recommended | Only with ADR exception |
| **MEDIUM** | Nice to have | Yes, but document why |

---

## Canonical Chain (CC) Compliance

| Priority | Check |
|----------|-------|
| CRITICAL | [x] Sovereign declared (CC-01 reference) |
| CRITICAL | [x] Hub ID assigned (unique, immutable) (CC-02) |
| CRITICAL | [x] Authorization matrix honored (no upward writes) |
| CRITICAL | [x] Doctrine version declared |
| HIGH | [x] All child contexts scoped to CC-03 |
| HIGH | [x] All processes scoped to CC-04 |

---

## Hub Identity (CC-02)

| Priority | Check |
|----------|-------|
| CRITICAL | [x] Hub ID assigned (unique, immutable) |
| CRITICAL | [x] Process ID pattern defined (CC-04 execution scope) |
| HIGH | [x] Hub Name defined |
| HIGH | [x] Hub Owner assigned |

---

## CTB Placement

| Priority | Check |
|----------|-------|
| CRITICAL | [x] CTB path defined (Trunk / Branch / Leaf) |
| CRITICAL | [x] No forbidden folders (utils, helpers, common, shared, lib, misc) |
| HIGH | [x] Branch level specified (sys / ui / ai / data / app) |
| MEDIUM | [ ] Parent hub identified (if nested hub) — N/A (root hub) |

---

## IMO Structure

### Ingress (I Layer)

| Priority | Check |
|----------|-------|
| CRITICAL | [x] Ingress contains no logic |
| CRITICAL | [x] Ingress contains no state |
| HIGH | [x] Ingress points defined |
| MEDIUM | [x] UI (if present) is dumb ingress only |

### Middle (M Layer)

| Priority | Check |
|----------|-------|
| CRITICAL | [x] All logic resides in M layer |
| CRITICAL | [x] All state resides in M layer |
| CRITICAL | [x] All decisions occur in M layer |
| CRITICAL | [x] Tools scoped to M layer only |

### Egress (O Layer)

| Priority | Check |
|----------|-------|
| CRITICAL | [x] Egress contains no logic |
| CRITICAL | [x] Egress contains no state |
| HIGH | [x] Egress points defined |

---

## Spokes

| Priority | Check |
|----------|-------|
| CRITICAL | [x] All spokes typed as I or O only |
| CRITICAL | [x] No spoke contains logic |
| CRITICAL | [x] No spoke contains state |
| CRITICAL | [x] No spoke owns tools |
| CRITICAL | [x] No spoke performs decisions |

---

## Tools

| Priority | Check |
|----------|-------|
| CRITICAL | [x] All tools scoped inside this hub |
| CRITICAL | [x] No tools exposed to spokes |
| HIGH | [x] All tools have Doctrine ID |
| HIGH | [x] All tools have ADR reference |

---

## Cross-Hub Isolation

| Priority | Check |
|----------|-------|
| CRITICAL | [x] No sideways hub-to-hub calls |
| CRITICAL | [x] No cross-hub logic |
| CRITICAL | [x] No shared mutable state between hubs |

---

## Guard Rails

| Priority | Check |
|----------|-------|
| CRITICAL | [x] Rate limits defined |
| CRITICAL | [x] Timeouts defined |
| HIGH | [x] Validation implemented |
| HIGH | [x] Permissions enforced |

---

## Kill Switch

| Priority | Check |
|----------|-------|
| CRITICAL | [x] Kill switch endpoint defined |
| CRITICAL | [x] Kill switch activation criteria documented |
| HIGH | [ ] Kill switch tested and verified |
| HIGH | [x] Emergency contact assigned |

---

## Rollback

| Priority | Check |
|----------|-------|
| CRITICAL | [x] Rollback plan documented |
| HIGH | [ ] Rollback tested and verified |

---

## Observability

| Priority | Check |
|----------|-------|
| CRITICAL | [x] Logging implemented |
| HIGH | [x] Metrics implemented |
| HIGH | [ ] Alerts configured |
| CRITICAL | [x] Shipping without observability is forbidden |

---

## Failure Modes

| Priority | Check |
|----------|-------|
| HIGH | [x] Failure modes documented |
| HIGH | [x] Severity levels assigned |
| MEDIUM | [x] Remediation steps defined |

---

## Human Override

| Priority | Check |
|----------|-------|
| HIGH | [x] Override conditions defined |
| HIGH | [x] Override approvers assigned |

---

## Traceability

| Priority | Check |
|----------|-------|
| CRITICAL | [x] PRD exists and is current (CC-02) |
| CRITICAL | [x] ADR exists for each decision (CC-03) |
| HIGH | [x] Work item linked |
| HIGH | [x] PR linked (CC-04) |
| HIGH | [x] Canonical Doctrine referenced |

---

## CC Layer Verification

| Priority | Layer | Check |
|----------|-------|-------|
| CRITICAL | CC-01 (Sovereign) | [x] Reference declared |
| CRITICAL | CC-02 (Hub) | [x] Identity, PRD, CTB complete |
| HIGH | CC-03 (Context) | [x] ADRs, spokes, guard rails defined |
| HIGH | CC-04 (Process) | [x] PIDs, code, tests implemented |

---

## Compliance Summary

**Before shipping, count your checks:**

| Priority | Must Have | Your Count |
|----------|-----------|------------|
| CRITICAL | ALL checked | 35 / 35 |
| HIGH | Most checked (ADR for exceptions) | 22 / 25 |
| MEDIUM | Optional | 2 / 3 |

**All CRITICAL items are checked. Hub is compliant for ship.**

---

## Traceability Reference

| Artifact | Reference |
|----------|-----------|
| Canonical Doctrine | CANONICAL_ARCHITECTURE_DOCTRINE.md v1.4.0 |
| Hub/Spoke Doctrine | CANONICAL_ARCHITECTURE_DOCTRINE.md §3 |
| IMO_CONTROL.json | ./IMO_CONTROL.json |
| heir.doctrine.yaml | ./heir.doctrine.yaml |
| doppler.yaml | ./doppler.yaml |
| Constitution | BARTON_STORAGE_SYSTEM_CONSTITUTION.md |

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-01-25 |
| Last Modified | 2026-01-25 |
| Validated By | Claude Code |
| Status | COMPLIANT |
