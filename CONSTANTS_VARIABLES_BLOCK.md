# Constants and Variables Block

**Hub**: Barton Storage System
**Hub ID**: barton-storage
**Version**: 1.0.0
**Last Updated**: 2026-03-14

> Per PSB-CONST-001 Part I: Nothing may exist unless it transforms declared constants into declared variables.

---

## Transformation Statement

This hub transforms **market signals, demographic data, zoning constraints, and site characteristics** into **investment verdicts, feasibility scores, and deal recommendations**.

---

## CONSTANTS BLOCK

Everything that does NOT change at runtime. These are the declared inputs, rules, and boundaries that are fixed before execution begins.

| Constant ID | Name | Type | Value / Source | Description |
|-------------|------|------|----------------|-------------|
| CONST-001 | sovereign_ref | sovereign_ref | barton-family-office | CC-01 sovereign reference |
| CONST-002 | hub_id | hub_id | barton-storage | Hub identity anchor |
| CONST-003 | cc_layer | cc_layer | CC-02 | Authority layer |
| CONST-004 | orbt_mode | orbt_mode | build | Operational intent |
| CONST-005 | domain_context | domain_context | self-storage | Self-storage investment analysis domain |
| CONST-006 | authority_scope | authority_scope | Deal screening, market analysis, feasibility | What this hub is authorized to govern |

**Validation**: Every constant MUST have a non-placeholder value before the hub definition passes audit. No brackets in final values.

---

## VARIABLES BLOCK

Everything that is instantiated at deployment time. These are the runtime slots that get filled when the hub executes.

| Variable ID | Name | Type | Populated By | Description |
|-------------|------|------|--------------|-------------|
| VAR-001 | heir_record | heir_record | Garage mount | Complete 8-field HEIR |
| VAR-002 | ctb_placement | ctb_placement | Hub definition | Branch under src/ |
| VAR-003 | prd_artifact | prd_artifact | Planner | PRD with HSS worksheet |
| VAR-004 | osam_contract | osam_contract | Hub definition | Query routing contract (if data branch) |
| VAR-005 | audit_certification | audit_certification | Auditor | PASS or FAIL with doctrine references |

**Validation**: Every variable MUST declare how it gets populated. No orphan variables (populated by nothing). No shadow variables (populated but never consumed).

---

## Transformation Verification

| Check | Status |
|-------|--------|
| Every constant has a fixed value | [ ] |
| Every variable has a declared source | [ ] |
| The transformation statement is reducible to CONST → VAR | [ ] |
| No constant is actually variable (changes at runtime) | [ ] |
| No variable is actually constant (never changes) | [ ] |

---

## Document Control

| Field | Value |
|-------|-------|
| Template Source | `fleet/car-template/CONSTANTS_VARIABLES_BLOCK.md.template` |
| Doctrine Reference | PSB-CONST-001 Part I, Part XV Change 2 |
| Authority | imo-creator (CC-01 Sovereign) |
