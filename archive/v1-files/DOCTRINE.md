# Doctrine Reference

This repo conforms to **IMO-Creator Doctrine v3.5.0**.

## Conformance Declaration

| Field | Value |
|-------|-------|
| Parent | imo-creator |
| Doctrine Version | 3.5.0 |
| CTB Version | 3.5.0 |
| Upstream Commit | 4237f041a0af3577df602c97646725f0d89f20bd |
| Last Synced | 2026-03-14 |

## Source of Truth

```
imo-creator/templates/doctrine/
├── ARCHITECTURE.md                    ← UNIFIED DOCTRINE (v2.1.0)
├── EXECUTION_SURFACE_LAW.md           ← Execution containment (v1.0.0)
├── CTB_REGISTRY_ENFORCEMENT.md        ← Registry-first + RAW lockdown + vendor JSON + bootstrap (v1.5.0)
├── FAIL_CLOSED_CI_CONTRACT.md         ← Fail-closed CI + bootstrap guarantees (v1.1.0)
├── LEGACY_COLLAPSE_PLAYBOOK.md        ← Legacy migration (v1.0.0)
└── ROLLBACK_PROTOCOL.md               ← Doctrine sync rollback procedure
```

## Three-Tier Loading System

| Tier | Files | When Loaded |
|------|-------|-------------|
| **Tier 1 — Mandatory** | IMO_CONTROL.json, CC_OPERATIONAL_DIGEST.md, CLAUDE.md | Every session start |
| **Tier 2 — On Demand** | DOCTRINE.md, REGISTRY.yaml, doctrine/REPO_DOMAIN_SPEC.md, law/IMO_SYSTEM_SPEC.md | When task requires |
| **Tier 3 — Audit Only** | law/AI_EMPLOYEE_OPERATING_CONTRACT.md, law/GUARDSPEC.md, law/ai-employee/AI_EMPLOYEE_PROTOCOL.md | Audit/compliance checks |

## Governance Files

| File | Purpose |
|------|---------|
| `IMO_CONTROL.json` | Structural governance contract |
| `REGISTRY.yaml` | Hub component registry |
| `CC_OPERATIONAL_DIGEST.md` | Operational rules digest |
| `STARTUP_PROTOCOL.md` | Session startup sequence |
| `DOCTRINE_CHECKPOINT.yaml` | Doctrine freshness tracking |
| `HUB_DESIGN_DECLARATION.yaml` | Hub-and-Spoke Setup (HSS) declaration |
| `CONSTANTS_VARIABLES_BLOCK.md` | Transformation Law compliance |
| `doctrine/REPO_DOMAIN_SPEC.md` | Repository domain specification |
| `heir.doctrine.yaml` | HEIR compliance configuration |
| `doppler.yaml` | Secrets management config |

## Rule

Do not duplicate. Reference and obey.

If any content in this repository conflicts with imo-creator doctrine, the canonical doctrine wins. No exceptions.
