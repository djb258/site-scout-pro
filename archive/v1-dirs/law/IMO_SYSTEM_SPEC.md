# IMO System Specification

**Authority**: imo-creator (Constitutional)
**Version**: 1.0.0
**Status**: ACTIVE
**Purpose**: Compiled system index — canonical vocabulary, schema roles, CTB branches, IMO layers, lane isolation rules, OSAM precedence, violation categories, halt conditions

---

> **This is a compiled reference. It does NOT replace parent doctrine. If conflict exists, parent doctrine wins.**

---

## §1 — Canonical Vocabulary

### System Terms

| Term | Definition | Authority |
|------|------------|-----------|
| CTB | Christmas Tree Backbone — structural placement system | ARCHITECTURE.md |
| CC | Constitutional Containment — authority layer system | ARCHITECTURE.md |
| IMO | Ingress-Middle-Egress — data flow pattern | ARCHITECTURE.md |
| OSAM | Operational Semantic Access Map — query routing contract | OSAM.md |
| PID | Process ID — unique execution instance identifier | ARCHITECTURE.md |
| Hub | Logic-owning bounded context | ARCHITECTURE.md |
| Spoke | Interface-only data carrier (Ingress or Egress) | ARCHITECTURE.md |
| Sovereign | Root human authority (CC-01) | ARCHITECTURE.md |
| Constant | Design-time fixed value, ADR-gated | ARCHITECTURE.md |
| Variable | Runtime-mutable value within declared bounds | ARCHITECTURE.md |
| HEIR | Hub Entity Identity Record — 8-field identity | HEIR.md |

### Data Terms

| Term | Definition | Authority |
|------|------------|-----------|
| Spine | Single authoritative table per hub | OSAM.md |
| Universal Join Key | Single key connecting all sub-hub tables to spine | OSAM.md |
| Query Surface | Table classified as QUERY in OSAM | OSAM.md |
| Source Table | Ingestion-only table, NOT a query surface | OSAM.md |
| Enrichment Table | Join-only table, NOT a query surface | OSAM.md |
| Leaf Type | Table classification: CANONICAL, ERROR, STAGING, MV, REGISTRY | CTB_REGISTRY_ENFORCEMENT.md |
| Column Registry | `column_registry.yml` — canonical schema spine | CTB_REGISTRY_ENFORCEMENT.md |
| Projection | Generated file derived from registry (never hand-edited) | CTB_REGISTRY_ENFORCEMENT.md |

---

## §2 — Schema Roles

### Table Leaf Types

| Leaf Type | Purpose | Cardinality Per Sub-Hub |
|-----------|---------|------------------------|
| CANONICAL | Authoritative business data | Exactly 1 |
| ERROR | Fault records for this sub-hub | Exactly 1 |
| STAGING | Temporary processing data | 0-2 (ADR required) |
| MV | Materialized view for performance | 0+ (ADR required) |
| REGISTRY | Configuration/lookup data | 0+ (ADR required) |

### Column Semantic Roles

| Role | Purpose | Example |
|------|---------|---------|
| identifier | Primary identity column | `id`, `zip_score_id` |
| foreign_key | Reference to another table | `company_id`, `hub_id` |
| attribute | Descriptive property | `name`, `status`, `description` |
| metric | Quantitative measure | `score`, `count`, `amount` |

### Column Formats

| Format | Example | Validation |
|--------|---------|------------|
| UUID | `550e8400-e29b-41d4-a716-446655440000` | RFC 4122 |
| ISO-8601 | `2026-01-15T10:30:00Z` | Date/datetime |
| USD_CENTS | `150000` | Integer cents |
| EMAIL | `user@example.com` | RFC 5322 |
| ENUM | `ACTIVE`, `DRAFT` | Declared values only |
| JSON | `{"key": "value"}` | Valid JSON |
| BOOLEAN | `true`, `false` | Strict boolean |
| STRING | `"any text"` | UTF-8 |
| INTEGER | `42` | Whole number |

---

## §3 — CTB Branch Definitions

### The Five Branches

| Branch | Path | Contains | Never Contains |
|--------|------|----------|----------------|
| sys | `src/sys/` | Env loaders, bootstraps, config readers | Business logic |
| data | `src/data/` | Schemas, queries, migrations, repositories | UI components |
| app | `src/app/` | Modules, services, workflows, business logic | Infrastructure |
| ai | `src/ai/` | Agents, routers, prompts, LLM integrations | Raw data access |
| ui | `src/ui/` | Pages, components, layouts, styles | Backend logic |

### Placement Rules

| Rule | Description |
|------|-------------|
| Every source file maps to exactly one branch | No cross-branch files |
| Support folders exist at repo root | `docs/`, `config/`, `scripts/`, `ops/` |
| No files at `src/` root | Must be in a branch subfolder |
| No forbidden folders anywhere | `utils/`, `helpers/`, `common/`, `shared/`, `lib/`, `misc/` |

---

## §4 — IMO Layer Definitions

### Layer Contracts

| Layer | Name | Owns | Must NOT |
|-------|------|------|----------|
| I | Ingress | Schema validation, data acceptance | Make decisions, mutate business state, invoke tools |
| M | Middle | All logic, all decisions, all state, all tools | Exist outside hub boundary |
| O | Egress | Read-only views, exports, notifications | Contain logic, mutate state |

### Layer-to-CTB Mapping

| IMO Layer | Primary CTB Branch | Secondary CTB Branch |
|-----------|-------------------|---------------------|
| Ingress | `ui/` (forms), `sys/` (webhooks) | `data/` (schema validation) |
| Middle | `app/` (logic), `ai/` (agents) | `data/` (queries, repositories) |
| Egress | `ui/` (display), `sys/` (exports) | — |

---

## §5 — Lane Isolation Rules

### Sub-Hub Isolation

| Rule | Description |
|------|-------------|
| No cross-sub-hub direct joins | Sub-hubs join through spine only |
| No cross-sub-hub direct calls | Communication through hub Middle layer |
| Each sub-hub owns its tables | No shared table ownership |
| Each sub-hub has its own error table | Errors are sub-hub-scoped |

### Cross-Hub Isolation

| Rule | Description |
|------|-------------|
| No cross-hub data access without OSAM declaration | All joins must be declared |
| No cross-hub tool sharing | Tools scoped to owning hub |
| No cross-hub state mutation | Each hub owns its state |
| Cross-hub reads via sovereign_id linkage only | Universal identity key |

---

## §6 — OSAM Precedence

### Document Hierarchy

```
CONSTITUTION.md (Transformation Law)
    → PRD (WHAT transformation)
        → OSAM (WHERE to query, HOW to join)
            → ERD (WHAT tables implement OSAM)
                → Process (HOW transformation executes)
                    → Code (IMPLEMENTATION)
```

### OSAM Authority Rules

| Principle | Enforcement |
|-----------|-------------|
| OSAM sits above ERDs | ERDs implement OSAM, never extend it |
| OSAM declares all joins | Undeclared joins are INVALID |
| OSAM classifies all tables | SOURCE/ENRICHMENT tables are NOT query surfaces |
| OSAM routes all questions | If question can't route, HALT |
| PRDs reference OSAM | PRD traceability must cite governing OSAM |

---

## §7 — Violation Categories

| Category | Definition | Severity | Response |
|----------|------------|----------|----------|
| CC_VIOLATION | Unauthorized CC layer interaction | CRITICAL | STOP immediately |
| CTB_VIOLATION | Invalid placement or forbidden folder | CRITICAL | STOP immediately |
| HUB_SPOKE_VIOLATION | Logic in spoke or spoke-to-spoke | CRITICAL | STOP immediately |
| IMO_VIOLATION | Logic in I or O layer | CRITICAL | STOP immediately |
| PID_VIOLATION | PID reuse or invalid promotion | CRITICAL | STOP immediately |
| AUTH_VIOLATION | Unauthorized write attempt | CRITICAL | STOP immediately |
| CONSTANT_VIOLATION | Variable redefining constant | CRITICAL | STOP immediately |
| DESCENT_VIOLATION | Out-of-sequence artifact creation | CRITICAL | STOP immediately |
| TOOL_VIOLATION | Unapproved tool or tool in wrong layer | CRITICAL | STOP immediately |
| OSAM_VIOLATION | Undeclared join or query path | CRITICAL | STOP immediately |
| GOVERNANCE_VIOLATION | Child modifying parent | CRITICAL | STOP immediately |
| SECURITY_VIOLATION | Secrets committed to repo | CRITICAL | STOP immediately |

---

## §8 — Halt Conditions

### Immediate Halt (No Exceptions)

| Condition | Required Action |
|-----------|-----------------|
| Forbidden folder detected | Remove folder, relocate files to correct CTB branch |
| Logic detected in Ingress or Egress | Move logic to Middle layer |
| Tool detected in Spoke | Move tool to Hub M layer |
| Cross-hub direct data access | Route through OSAM-declared path |
| Undeclared join in ERD | Add to OSAM first, then ERD |
| PID reuse detected | Mint new PID |
| Governance file modification (non-sync) | Revert, escalate to human |
| Secret in committed file | Revert immediately, rotate secret |

### Escalation Halt (Ask Human)

| Condition | Required Action |
|-----------|-----------------|
| Task requires new sub-hub | Escalate to CC-02 |
| Task requires new tool | Request ADR |
| Task conflicts with PRD | Flag conflict, wait |
| Uncertainty about CTB placement | Ask human |
| Drift detected from parent | Report, wait for sync decision |

---

## §9 — Constants and Variables

### Layer Assignment

| CC Layer | Default Category | Can Override? |
|----------|------------------|---------------|
| CC-01 | CONSTANT | NO |
| CC-02 | CONSTANT | NO |
| CC-03 | Declared per artifact | YES (with ADR) |
| CC-04 | VARIABLE | NO |

### Inversion Protection

| Rule | Description |
|------|-------------|
| CV-01 | Variables may NEVER redefine constants |
| CV-02 | Variable cannot alter meaning defined by constant |
| CV-03 | Attempted inversion is doctrine violation |
| CV-04 | Runtime config may tune but not redefine |

---

## §10 — Enforcement Mechanisms

### Pre-Commit Gates

| Gate | Check | Failure Response |
|------|-------|-----------------|
| CHECK 1 | Forbidden folders | REJECT commit |
| CHECK 2 | CTB branch placement | REJECT commit |
| CHECK 3 | Import path validation | REJECT commit |
| CHECK 4 | DOCTRINE_CHECKPOINT.yaml freshness | REJECT commit |
| CHECK 5 | No secrets in diff | REJECT commit |

### PR Gates

| Gate | Check | Failure Response |
|------|-------|-----------------|
| GATE A | Doctrine conformance | BLOCK merge |
| GATE B | Schema completeness | BLOCK merge |
| GATE C | OSAM alignment | BLOCK merge |
| GATE D | Compliance checklist | BLOCK merge |
| GATE E | Governance CI verification | BLOCK merge |

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-03-14 |
| Last Modified | 2026-03-14 |
| Version | 1.0.0 |
| Status | ACTIVE |
| Authority | imo-creator (CC-01 Sovereign) |
| Source Documents | ARCHITECTURE.md v2.1.0, TOOLS.md v1.1.0, OSAM.md v1.1.0, CTB_REGISTRY_ENFORCEMENT.md v1.5.0 |
