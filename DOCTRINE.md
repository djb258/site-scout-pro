# Doctrine Reference

This repo conforms to IMO-Creator Doctrine v1.4.0.

## Source of Truth

```
imo-creator/templates/doctrine/
├── CANONICAL_ARCHITECTURE_DOCTRINE.md
├── ALTITUDE_DESCENT_MODEL.md
├── HUB_SPOKE_ARCHITECTURE.md
├── REPO_REFACTOR_PROTOCOL.md
├── PRD_CONSTITUTION.md
├── ERD_CONSTITUTION.md
├── ERD_DOCTRINE.md
├── PROCESS_DOCTRINE.md
├── DBA_ENFORCEMENT_DOCTRINE.md
└── DOCUMENTATION_ERD_DOCTRINE.md
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

## Rule

Do not duplicate. Reference and obey.

If any content in this repository conflicts with `imo_creator/templates/doctrine/CANONICAL_ARCHITECTURE_DOCTRINE.md`, the canonical doctrine wins. No exceptions.
