# OSAM — Semantic Access Map

**Status**: ACTIVE
**Authority**: Hub (CC-02)
**Version**: 1.0.0
**Hub ID**: barton-storage
**Change Protocol**: ADR + HUMAN APPROVAL REQUIRED
**Conforms To**: imo-creator/templates/semantic/OSAM.md v1.1.0

---

## Purpose & Scope

The **Operational Semantic Access Map (OSAM)** is the authoritative query-routing contract for barton-storage. It defines:

- **Where** data is queried from (query surfaces)
- **Which** tables own which concepts (semantic ownership)
- **Which** join paths are allowed (relationship contracts)
- **When** an agent MUST STOP and ask for clarification (halt conditions)

### What OSAM Is

| OSAM Is | OSAM Is NOT |
|---------|-------------|
| Authoritative query contract | Database schema |
| Semantic ownership map | Implementation guide |
| Join path declaration | Query optimization tool |
| Agent routing instructions | Business logic definition |

### Hierarchical Position

```
CONSTITUTION.md (Transformation Law)
    │
    ▼
PRD (Behavioral Proof — WHAT transformation occurs)
    │
    ▼
OSAM (Semantic Access Map — WHERE to query, HOW to join) ← THIS DOCUMENT
    │
    ▼
ERD (Structural Proof — WHAT tables implement OSAM contracts)
    │
    ▼
PROCESS (Execution Declaration — HOW transformation executes)
```

**OSAM sits ABOVE ERDs and DRIVES them.**
ERDs may only implement relationships that OSAM declares.

---

## Chain of Authority

### Parent → Spine → Sub-Hub Hierarchy

```
barton-storage (CC-02)
    │
    ▼ owns
    │
runs (Universal Join Key: run_id)
    │
    ├──────────────────────────────────────────────┐
    ▼                                              ▼
Screening Pipeline (CC-03)                   Research Cache (CC-03)
    │                                              │
    ▼                                              ▼
[Tables join via run_id or zip]          [Tables keyed by domain entity]
```

### Authority Rules

| Rule | Description |
|------|-------------|
| Single Spine | `runs` is the spine table — every screening execution starts here |
| Universal Key | `run_id` (UUID) connects all pipeline tables |
| Secondary Key | `zip` (VARCHAR(5)) connects research/reference tables to `zips_master` |
| No Cross-Sub-Hub Joins | Pipeline tables do not join directly to cache tables |
| Spine Owns Identity | `runs` is the authoritative source of screening run identity |

---

## Universal Join Key Declaration

```yaml
universal_join_key:
  name: "run_id"
  type: "UUID"
  source_table: "runs"
  description: "The single key that connects all screening pipeline tables"

secondary_join_key:
  name: "zip"
  type: "VARCHAR(5)"
  source_table: "zips_master"
  description: "Connects research/reference tables across runs"
```

### Join Key Rules

| Rule | Enforcement |
|------|-------------|
| Single Source | `run_id` is minted ONLY in the `runs` table via `start_run()` |
| Immutable | Once assigned, a `run_id` cannot change |
| Propagated | `zip_results`, `stage_log` receive `run_id` via FK |
| Required | No pipeline table may exist without relationship to `run_id` |

---

## Query Routing Table

### Structure

| Question Type | Authoritative Table | Join Path | Notes |
|---------------|---------------------|-----------|-------|
| Run status / progress | `runs` | Direct | Check `status`, `current_stage` |
| Run progress detail | `v_run_progress` | View over `runs` + `zip_results` | Runtime, tier counts |
| ZIP screening results | `zip_results` | `runs` → `zip_results` | One row per ZIP per run |
| Tier 1 winners | `v_tier1` | View over `zip_results` + `zips_master` | Tier = 1, ranked |
| Tier 2 winners | `v_tier2` | View over `zip_results` + `zips_master` | Tier = 2, ranked |
| Stage execution log | `stage_log` | `runs` → `stage_log` | Per-stage timing and counts |
| Kill analysis | `v_kill_summary` | View over `zip_results` | Grouped by run, stage, step |
| Zoning status | `zoning_cache` | `zips_master` → `zoning_cache` via `county_fips` | Persists across runs |
| Zoning gaps | `v_zoning_gaps` | View over `zoning_cache` | Counties without research |
| Pricing data | `pricing_data` | `zips_master` → `pricing_data` via `zip` | Manual research |
| Traffic data | `traffic_data` | `zips_master` → `traffic_data` via `zip` | DOT / manual |
| API cache | `api_cache` | Direct by `cache_key` | Keyed by endpoint + params |
| Signal observations | `pass0_signals` | `sovereign_ids` → signals | Supabase sub-hub 0 |
| Market data | `pass1_*` tables | `sovereign_ids` → market | Supabase sub-hub 1 |
| County cards | `county_card_*` | `sovereign_ids` → county | Supabase sub-hub 2 |
| Calculator state | `calculators_state` | `sovereign_ids` → calc | Supabase sub-hub 3 |
| Parcel data | `site_*_staging` | `sovereign_ids` → parcel | Supabase sub-hub 4 |

### Routing Rules

| Rule | Description |
|------|-------------|
| One Table Per Question | Each question type has exactly ONE authoritative table |
| Explicit Paths Only | Only declared join paths may be used |
| No Discovery | Agents may not discover new query paths at runtime |
| HALT on Unknown | If a question cannot be routed, agent MUST HALT |

---

## Hub Definitions

### Parent Hub

```yaml
parent_hub:
  name: "barton-storage"
  cc_layer: CC-02
  spine_table: "runs"
  universal_join_key: "run_id"
  owns:
    - "screening-pipeline"
    - "research-cache"
    - "supabase-sub-hubs"
```

### Spine Table

```yaml
spine_table:
  name: "runs"
  purpose: "Authoritative source of screening run identity"
  primary_key: "run_id"
  query_surface: true
  columns:
    - name: "run_id"
      type: "UUID"
      role: "Universal join key — minted by start_run()"
    - name: "target_states"
      type: "VARCHAR[]"
      role: "Which states this run screens"
    - name: "status"
      type: "VARCHAR(20)"
      role: "Run lifecycle: pending → running → complete | failed"
    - name: "current_stage"
      type: "INT"
      role: "Progress tracker: 0-8"
    - name: "config"
      type: "JSONB"
      role: "Snapshot of screening constants at run time"
```

### Sub-Hubs

```yaml
sub_hubs:
  - name: "screening-pipeline"
    cc_layer: CC-03
    purpose: "8-stage ZIP screening pipeline with kill/survive mechanics"
    joins_to_spine_via: "run_id"
    tables:
      - "zip_results"
      - "stage_log"

  - name: "research-cache"
    cc_layer: CC-03
    purpose: "Persistent research data that spans across runs"
    joins_to_spine_via: "zip (via zips_master)"
    tables:
      - "zoning_cache"
      - "pricing_data"
      - "traffic_data"
      - "api_cache"

  - name: "supabase-sub-hubs"
    cc_layer: CC-03
    purpose: "6 Supabase-hosted sub-hubs (Pass 0-5) anchored by sovereign_ids"
    joins_to_spine_via: "sva_id (sovereign_ids)"
    tables:
      - "sovereign_ids"
      - "pass0_signals"
      - "pass1_* (market)"
      - "county_card_* (county)"
      - "calculators_state"
      - "site_*_staging (parcel)"
```

---

## Allowed Join Paths

### Declared Joins

Only joins declared in this section are permitted. All other joins are INVALID.

| From Table | To Table | Join Key | Direction | Purpose |
|------------|----------|----------|-----------|---------|
| `runs` | `zip_results` | `run_id` | 1:N | All ZIP results for a run |
| `runs` | `stage_log` | `run_id` | 1:N | Stage execution history |
| `zips_master` | `zip_results` | `zip` | 1:N | ZIP reference data |
| `zips_master` | `pricing_data` | `zip` | 1:N | Pricing research |
| `zips_master` | `traffic_data` | `zip` | 1:N | Traffic research |
| `zips_master` | `zoning_cache` | `county_fips` | N:1 | County zoning (via county_fips) |
| `sovereign_ids` | `sovereign_id_zips` | `sva_id` | 1:N | SVA → ZIP mapping |
| `sovereign_ids` | `sovereign_id_counties` | `sva_id` | 1:N | SVA → county mapping |
| `sovereign_ids` | `pass0_signals` | `sva_id` | 1:N | Signal observations |

### Join Rules

| Rule | Enforcement |
|------|-------------|
| Declared Only | If a join is not in this table, it is INVALID |
| No Ad-Hoc Joins | Agents may not invent joins at runtime |
| ERD Must Implement | ERDs may only contain joins declared here |
| ADR for New Joins | Adding a new join requires ADR approval |

### Forbidden Joins

| From | To | Reason |
|------|----|--------|
| `zip_results` | `pricing_data` (direct) | Must go through `zips_master` |
| `zip_results` | `traffic_data` (direct) | Must go through `zips_master` |
| Pipeline tables | Supabase tables (direct) | Cross-sub-hub isolation |
| Any table | `api_cache` (via join) | Cache is keyed by `cache_key`, not entity FK |

---

## Source / Enrichment Table Classification

### Classification Table

| Table Name | Classification | Query Surface | Notes |
|------------|----------------|---------------|-------|
| `runs` | QUERY | YES | Spine table |
| `zip_results` | QUERY | YES | Primary screening results |
| `stage_log` | AUDIT | NO | Execution logging only |
| `zips_master` | ENRICHMENT | NO | Reference lookup — never the FROM table |
| `zoning_cache` | QUERY | YES | Persistent research data |
| `pricing_data` | QUERY | YES | Persistent research data |
| `traffic_data` | QUERY | YES | Persistent research data |
| `api_cache` | SOURCE | NO | Raw cached API responses |
| `sovereign_ids` | QUERY | YES | Supabase spine |
| `pass0_signals` | QUERY | YES | Signal observations |

### Classification Rules

| Rule | Enforcement |
|------|-------------|
| SOURCE tables are NEVER query surfaces | Agent MUST HALT if asked to query `api_cache` directly |
| ENRICHMENT tables are joined, not queried | `zips_master` is never the "FROM" table |
| QUERY tables are the only valid query surfaces | All questions route to QUERY tables |
| Misclassified queries are INVALID | Agent rejects and escalates |

---

## STOP Conditions

Agents MUST HALT and request clarification when:

### Query Routing STOP Conditions

| Condition | Action |
|-----------|--------|
| Question cannot be routed to a declared table | HALT — ask human for routing |
| Question requires a join not declared in OSAM | HALT — request ADR |
| Question targets a SOURCE or ENRICHMENT table | HALT — query surfaces only |
| Question requires cross-sub-hub direct join | HALT — isolation violation |

### Semantic STOP Conditions

| Condition | Action |
|-----------|--------|
| Concept not declared in OSAM | HALT — semantic gap |
| Multiple tables claim ownership of concept | HALT — ambiguity resolution required |
| Universal join key not found in query path | HALT — structural violation |

### STOP Output Format

```
OSAM HALT
═════════════════════════════════════════════════════════════════════════════

Reason: [QUERY_UNROUTABLE | JOIN_UNDECLARED | SOURCE_QUERY | ISOLATION_VIOLATION | SEMANTIC_GAP | AMBIGUITY | STRUCTURAL]

Question: "<THE_QUESTION_ASKED>"
Attempted Route: [What the agent tried to do]
OSAM Reference: [Section that applies]

Resolution Required:
  [ ] Human must declare new routing
  [ ] ADR required for new join
  [ ] Clarify which table owns this concept

Agent is HALTED. Awaiting resolution.
```

---

## Registry-First Enforcement

### Canonical Entry Point

`column_registry.yml` is the **canonical entry point** for all data schema in a hub. It is the single source of truth from which all typed artifacts are derived.

| Principle | Rule |
|-----------|------|
| Registry is spine | All table definitions originate in `column_registry.yml` |
| Generated files are projections | TypeScript types and Zod schemas are OUTPUT of the registry, never hand-edited |
| Registry drives OSAM | OSAM query surfaces must correspond to tables declared in the registry |
| Registry drives ERDs | ERD structural proof must reflect registry-declared tables |

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-09 | Claude Code | Initial OSAM declaration for barton-storage |

---

## Validation Checklist

| Check | Status |
|-------|--------|
| [x] Universal join key declared | `run_id` (UUID) |
| [x] Spine table identified | `runs` |
| [x] All sub-hubs listed with table ownership | screening-pipeline, research-cache, supabase-sub-hubs |
| [x] All allowed joins explicitly declared | 9 joins declared |
| [x] All tables classified (QUERY/SOURCE/ENRICHMENT/AUDIT) | 10 tables classified |
| [x] Query routing table complete | 16 question types routed |
| [x] STOP conditions understood | Query + Semantic conditions declared |
| [x] No undeclared joins exist in ERD | Validated against schema |

---

## Relationship to Other Artifacts

| Artifact | OSAM Relationship |
|----------|-------------------|
| **PRD** | PRD declares WHAT transformation (ZIP screening → tiered results). OSAM declares WHERE to query. |
| **ERD** | ERD implements OSAM. ERD may not introduce joins not in OSAM. |
| **Process** | 8-stage screening process queries via OSAM routes. No ad-hoc queries. |
| **Agents** | Agents follow OSAM routing strictly. HALT on unknown routes. |

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-03-09 |
| Last Modified | 2026-03-09 |
| Version | 1.0.0 |
| Status | ACTIVE |
| Authority | Hub (CC-02) |
| Derives From | CONSTITUTION.md (Transformation Law) |
| Change Protocol | ADR + HUMAN APPROVAL REQUIRED |
