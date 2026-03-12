# Doctrine Reference

This repo conforms to IMO-Creator Doctrine v2.0.0.

## Source of Truth

> **CTB Hardening v2.0.0**: Architecture doctrine has been consolidated into a single file.

```
imo-creator/templates/doctrine/
├── ARCHITECTURE.md                    ← UNIFIED DOCTRINE (v2.0.0)
├── CANONICAL_ARCHITECTURE_DOCTRINE.md ← REDIRECT → ARCHITECTURE.md
├── HUB_SPOKE_ARCHITECTURE.md          ← REDIRECT → ARCHITECTURE.md Part IV
├── ALTITUDE_DESCENT_MODEL.md          ← REDIRECT → ARCHITECTURE.md Part VI
├── REPO_REFACTOR_PROTOCOL.md
├── PRD_CONSTITUTION.md
├── ERD_CONSTITUTION.md
├── ERD_DOCTRINE.md
├── PROCESS_DOCTRINE.md
├── DBA_ENFORCEMENT_DOCTRINE.md
├── DOCUMENTATION_ERD_DOCTRINE.md
└── TEMPLATE_IMMUTABILITY.md
```

## Local Doctrine Path

```
imo_creator/templates/doctrine/
```

## Governance Files

| File | Purpose |
|------|---------|
| `IMO_CONTROL.json` | Control plane binding |
| `REGISTRY.yaml` | Hub component registry |
| `heir.doctrine.yaml` | HEIR compliance configuration |
| `doppler.yaml` | Secrets management |
| `HUB_DESIGN_DECLARATION.yaml` | Hub-and-Spoke Setup (HSS) declaration |
| `doctrine/REPO_DOMAIN_SPEC.md` | Repository domain specification |

## New in v2.0.0

| Change | Detail |
|--------|--------|
| Consolidated doctrine | Three files merged into `ARCHITECTURE.md` |
| OSAM | Operational Semantic Access Map now required |
| HSS | Hub-and-Spoke Setup declaration mandatory before PRDs |
| CTB Governance | Database governance template added |
| PRD_HUB.md | HSS section now mandatory at top of every PRD |
| Compliance Checklist | New SS A.6 (OSAM) and SS A.7 (Process) sections |

## Rule

Do not duplicate. Reference and obey.

If any content in this repository conflicts with `imo_creator/templates/doctrine/ARCHITECTURE.md`, the canonical doctrine wins. No exceptions.
