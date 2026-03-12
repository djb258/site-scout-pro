# OSAM — Barton Storage System

**Status**: DRAFT
**Authority**: CONSTITUTIONAL
**Version**: 1.0.0
**Change Protocol**: ADR + HUMAN APPROVAL REQUIRED

---

## Purpose & Scope

The **Operational Semantic Access Map (OSAM)** is the authoritative query-routing contract for the Barton Storage System. It defines:

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
BARTON_STORAGE_SYSTEM_CONSTITUTION.md (Transformation Law)
    │
    ▼
PRD_BARTON_STORAGE_HUB.md (Behavioral Proof — WHAT transformation occurs)
    │
    ▼
OSAM_BARTON_STORAGE.md (Semantic Access Map — WHERE to query, HOW to join) ← THIS DOCUMENT
    │
    ▼
ERD_SubHub*.md (Structural Proof — WHAT tables implement OSAM contracts)
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
Barton Storage System (CC-02)
    │
    ▼ owns
    │
deal_analyses (Universal Join Key: sovereign_id)
    │
    ├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
    ▼          ▼          ▼          ▼          ▼          ▼          ▼          ▼
Sub-Hub 0  Sub-Hub 1  Sub-Hub 1.5  Sub-Hub 2  Sub-Hub 3  Sub-Hub 4  Sub-Hub 5
Signals    Market     Rent Recon   County     Calculators Parcel    Deal Gate
    │          │          │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼          ▼          ▼
[canonical] [canonical] [canonical] [canonical] [canonical] [canonical] [canonical]
[errors]    [errors]    [errors]    [errors]    [errors]    [errors]    [errors]
```

### Authority Rules

| Rule | Description |
|------|-------------|
| Single Spine | `deal_analyses` is the ONE spine table |
| Universal Key | All sub-hub tables join to spine via `sovereign_id` |
| No Cross-Sub-Hub Joins | Sub-hubs may not join directly to each other |
| Spine Owns Identity | `deal_analyses` is the authoritative source of deal identity |
| Two Tables Per Sub-Hub | Each sub-hub owns exactly ONE canonical table + ONE error table |

---

## Universal Join Key Declaration

```yaml
universal_join_key:
  name: "sovereign_id"
  type: "UUID"
  source_table: "deal_analyses"
  description: "Minted when a user initiates a search (zip + radius + facility type). The single key that connects all tables in this hub."
```

### Join Key Rules

| Rule | Enforcement |
|------|-------------|
| Single Source | `sovereign_id` is minted ONLY in `deal_analyses` |
| Immutable | Once assigned, a sovereign_id cannot change |
| Propagated | All sub-hub tables receive sovereign_id via FK relationship |
| Required | No table may exist without relationship to sovereign_id |

---

## Spine Table

```yaml
spine_table:
  name: "deal_analyses"
  purpose: "Authoritative source of deal identity — minted at search initiation"
  primary_key: "sovereign_id"
  query_surface: true
  columns:
    - name: "sovereign_id"
      type: "UUID"
      role: "Universal join key — minted at search initiation"
    - name: "input_zip"
      type: "VARCHAR(10)"
      role: "User-supplied target ZIP code"
    - name: "radius_miles"
      type: "INTEGER"
      role: "Search radius in miles"
    - name: "facility_type"
      type: "VARCHAR(50)"
      role: "Storage type: regular, boat, rv, climate_controlled, etc."
    - name: "status"
      type: "ENUM"
      role: "Pipeline status: INITIATED, IN_PROGRESS, COMPLETED, REJECTED"
    - name: "created_at"
      type: "TIMESTAMPTZ"
      role: "When the search was initiated"
    - name: "updated_at"
      type: "TIMESTAMPTZ"
      role: "Last pipeline activity"
```

---

## Hub Definitions

### Parent Hub

```yaml
parent_hub:
  name: "barton-storage"
  cc_layer: CC-02
  spine_table: "deal_analyses"
  universal_join_key: "sovereign_id"
  owns:
    - "sub-hub-0-signals"
    - "sub-hub-1-market"
    - "sub-hub-15-rent-recon"
    - "sub-hub-2-county-card"
    - "sub-hub-3-calculators"
    - "sub-hub-4-parcel"
    - "sub-hub-5-deal-gate"
```

### Sub-Hubs

```yaml
sub_hubs:
  - name: "sub-hub-0-signals"
    cc_layer: CC-03
    purpose: "ZIP-level signal detection and momentum scoring"
    joins_to_spine_via: "sovereign_id"
    tables:
      - "signal_scores"
      - "signal_errors"

  - name: "sub-hub-1-market"
    cc_layer: CC-03
    purpose: "Market demographics, supply/demand, ZIP expansion from radius"
    joins_to_spine_via: "sovereign_id"
    tables:
      - "market_structure"
      - "market_errors"

  - name: "sub-hub-15-rent-recon"
    cc_layer: CC-03
    purpose: "Competitor rate validation and rent gap resolution"
    joins_to_spine_via: "sovereign_id"
    tables:
      - "rent_reconciliation"
      - "rent_errors"

  - name: "sub-hub-2-county-card"
    cc_layer: CC-03
    purpose: "Jurisdiction rules, zoning validation, permit difficulty"
    joins_to_spine_via: "sovereign_id"
    tables:
      - "jurisdiction_cards"
      - "jurisdiction_errors"

  - name: "sub-hub-3-calculators"
    cc_layer: CC-03
    purpose: "Financial modeling, unit mix optimization, feasibility"
    joins_to_spine_via: "sovereign_id"
    tables:
      - "feasibility_runs"
      - "feasibility_errors"

  - name: "sub-hub-4-parcel"
    cc_layer: CC-03
    purpose: "Site-specific parcel evaluation and viability screening"
    joins_to_spine_via: "sovereign_id"
    tables:
      - "parcel_evaluations"
      - "parcel_errors"

  - name: "sub-hub-5-deal-gate"
    cc_layer: CC-03
    purpose: "Final go/no-go investment verdict"
    joins_to_spine_via: "sovereign_id"
    tables:
      - "deal_verdicts"
      - "deal_errors"
```

---

## Query Routing Table

| Question Type | Authoritative Table | Join Path | Notes |
|---------------|---------------------|-----------|-------|
| What search was initiated? | `deal_analyses` | Direct (spine) | Input zip, radius, facility type |
| What signals exist for this deal? | `signal_scores` | `deal_analyses` → `signal_scores` | ZIP momentum scores |
| What is the market structure? | `market_structure` | `deal_analyses` → `market_structure` | Demographics, supply gap, expanded ZIP list |
| What are the reconciled rents? | `rent_reconciliation` | `deal_analyses` → `rent_reconciliation` | Validated competitor rates |
| What are the jurisdiction rules? | `jurisdiction_cards` | `deal_analyses` → `jurisdiction_cards` | Zoning, permits, difficulty scores |
| What is the feasibility verdict? | `feasibility_runs` | `deal_analyses` → `feasibility_runs` | Financial modeling, unit mix, IRR |
| What parcels are viable? | `parcel_evaluations` | `deal_analyses` → `parcel_evaluations` | Site-specific screening |
| What is the Go/No-Go decision? | `deal_verdicts` | `deal_analyses` → `deal_verdicts` | Final investment verdict |
| What errors occurred at signal stage? | `signal_errors` | `deal_analyses` → `signal_errors` | Pass 0 failures |
| What errors occurred at market stage? | `market_errors` | `deal_analyses` → `market_errors` | Pass 1 failures |
| What errors occurred at rent stage? | `rent_errors` | `deal_analyses` → `rent_errors` | Pass 1.5 failures |
| What errors occurred at jurisdiction stage? | `jurisdiction_errors` | `deal_analyses` → `jurisdiction_errors` | Pass 2 failures |
| What errors occurred at feasibility stage? | `feasibility_errors` | `deal_analyses` → `feasibility_errors` | Pass 3 failures |
| What errors occurred at parcel stage? | `parcel_errors` | `deal_analyses` → `parcel_errors` | Pass 4 failures |
| What errors occurred at deal gate? | `deal_errors` | `deal_analyses` → `deal_errors` | Pass 5 failures |

### Routing Rules

| Rule | Description |
|------|-------------|
| One Table Per Question | Each question type has exactly ONE authoritative table |
| Explicit Paths Only | Only declared join paths may be used |
| No Discovery | Agents may not discover new query paths at runtime |
| HALT on Unknown | If a question cannot be routed, agent MUST HALT |

---

## Allowed Join Paths

### Declared Joins

Only joins declared in this section are permitted. All other joins are INVALID.

| From Table | To Table | Join Key | Direction | Purpose |
|------------|----------|----------|-----------|---------|
| `deal_analyses` | `signal_scores` | `sovereign_id` | 1:1 | Pass 0 output for this deal |
| `deal_analyses` | `signal_errors` | `sovereign_id` | 1:N | Pass 0 failures |
| `deal_analyses` | `market_structure` | `sovereign_id` | 1:1 | Pass 1 output for this deal |
| `deal_analyses` | `market_errors` | `sovereign_id` | 1:N | Pass 1 failures |
| `deal_analyses` | `rent_reconciliation` | `sovereign_id` | 1:1 | Pass 1.5 output for this deal |
| `deal_analyses` | `rent_errors` | `sovereign_id` | 1:N | Pass 1.5 failures |
| `deal_analyses` | `jurisdiction_cards` | `sovereign_id` | 1:1 | Pass 2 output for this deal |
| `deal_analyses` | `jurisdiction_errors` | `sovereign_id` | 1:N | Pass 2 failures |
| `deal_analyses` | `feasibility_runs` | `sovereign_id` | 1:1 | Pass 3 output for this deal |
| `deal_analyses` | `feasibility_errors` | `sovereign_id` | 1:N | Pass 3 failures |
| `deal_analyses` | `parcel_evaluations` | `sovereign_id` | 1:1 | Pass 4 output for this deal |
| `deal_analyses` | `parcel_errors` | `sovereign_id` | 1:N | Pass 4 failures |
| `deal_analyses` | `deal_verdicts` | `sovereign_id` | 1:1 | Pass 5 output for this deal |
| `deal_analyses` | `deal_errors` | `sovereign_id` | 1:N | Pass 5 failures |

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
| `signal_scores` | `market_structure` (direct) | Cross-sub-hub isolation — must go through spine |
| `market_structure` | `jurisdiction_cards` (direct) | Cross-sub-hub isolation |
| Any canonical table | Any other canonical table (direct) | All paths must route through `deal_analyses` |
| Any table | SOURCE/ENRICHMENT tables | Source tables are not query surfaces |

---

## Source / Enrichment Table Classification

### Table Classifications

| Classification | Query Surface | Description |
|----------------|---------------|-------------|
| **QUERY** | YES | Tables that answer questions — canonical + error tables |
| **SOURCE** | NO | Raw ingested data; not for direct query |
| **ENRICHMENT** | NO | Lookup/reference data; joined for enrichment only |
| **AUDIT** | NO | Logging/tracking; not for business queries |

### Classification Table

#### QUERY Tables (Canonical + Error) — The Only Query Surfaces

| Table Name | Sub-Hub | Leaf Type | Notes |
|------------|---------|-----------|-------|
| `deal_analyses` | Spine | CANONICAL | Universal identity — mints sovereign_id |
| `signal_scores` | 0 | CANONICAL | Pass 0 canonical output |
| `signal_errors` | 0 | ERROR | Pass 0 failure tracking |
| `market_structure` | 1 | CANONICAL | Pass 1 canonical output |
| `market_errors` | 1 | ERROR | Pass 1 failure tracking |
| `rent_reconciliation` | 1.5 | CANONICAL | Pass 1.5 canonical output |
| `rent_errors` | 1.5 | ERROR | Pass 1.5 failure tracking |
| `jurisdiction_cards` | 2 | CANONICAL | Pass 2 canonical output |
| `jurisdiction_errors` | 2 | ERROR | Pass 2 failure tracking |
| `feasibility_runs` | 3 | CANONICAL | Pass 3 canonical output |
| `feasibility_errors` | 3 | ERROR | Pass 3 failure tracking |
| `parcel_evaluations` | 4 | CANONICAL | Pass 4 canonical output |
| `parcel_errors` | 4 | ERROR | Pass 4 failure tracking |
| `deal_verdicts` | 5 | CANONICAL | Pass 5 canonical output |
| `deal_errors` | 5 | ERROR | Pass 5 failure tracking |

**QUERY Total**: 1 spine + 7 canonical + 7 error = **15 tables**

#### SOURCE Tables — Raw/Intermediate Data (NOT Query Surfaces)

These tables feed INTO the canonical tables. They are never queried directly.

| Table Name | Sub-Hub | Purpose | Feeds Into |
|------------|---------|---------|------------|
| `pass0_signals` | 0 | Raw signal observations per ZIP | `signal_scores` |
| `pass0_narrative_pins` | 0 | Geographic pins from narrative sources | `signal_scores` |
| `pass0_url_queue` | 0 | URL queue for signal source processing | `signal_scores` |
| `pass1_census_snapshot` | 1 | Census data snapshot per ZIP per run | `market_structure` |
| `pass1_demand_agg` | 1 | Aggregated demand by distance band | `market_structure` |
| `pass1_radius_zip` | 1 | ZIPs within radius of origin | `market_structure` |
| `pass1_supply_agg` | 1 | Aggregated supply by distance band | `market_structure` |
| `pass1_supply_snapshot` | 1 | Facility supply snapshot per run | `market_structure` |
| `facility_raw` | 1 | Raw facility discovery data | `market_structure` |
| `competitor_facilities` | 1 | Competitor facility details | `market_structure` |
| `pass_1_5_gap_queue` | 1.5 | Gap queue for rent remediation | `rent_reconciliation` |
| `pass_1_5_attempt_log` | 1.5 | Attempt tracking for gap resolution | `rent_reconciliation` |
| `county_card_raw` | 2 | Append-only raw evidence collection | `jurisdiction_cards` |
| `county_card_sources` | 2 | Links raw evidence to master records | `jurisdiction_cards` |
| `jurisdiction_card_drafts` | 2 | Draft jurisdiction cards (staging) | `jurisdiction_cards` |
| `rent_band_staging` | 3 | Rent band calculation staging | `feasibility_runs` |
| `site_intake_staging` | 4 | Raw parcel intake data | `parcel_evaluations` |
| `site_demand_staging` | 4 | Demand metrics for parcel | `parcel_evaluations` |
| `site_results_staging` | 4 | Scored parcel results | `parcel_evaluations` |
| `vault_push_queue` | 5 | Queue for Neon vault writes (Future) | `deal_verdicts` |

**SOURCE Total**: **20 tables**

#### ENRICHMENT Tables — Lookup/Reference (NOT Query Surfaces)

These tables are joined for enrichment only. Never the "FROM" table.

| Table Name | Sub-Hub | Purpose | Used By |
|------------|---------|---------|---------|
| `sovereign_ids` | Shared | SVA identity container | All sub-hubs |
| `sovereign_id_zips` | Shared | SVA → ZIP scope mapping | Sub-Hub 0, 1, 4 |
| `sovereign_id_counties` | Shared | SVA → County scope mapping | Sub-Hub 2 |
| `ref_zip_replica` | Shared | ZIP centroid coordinates | Sub-Hub 0, 1, 2 |
| `us_zip_codes` | Shared | Master ZIP list (Neon) | Sub-Hub 1 |
| `facility_master` | 1 | Canonical facility identity | Sub-Hub 1, 1.5 |
| `facility_totals` | 1 | Facility aggregate metrics | Sub-Hub 1 |
| `facility_unit_pricing` | 1 | Unit-level pricing data | Sub-Hub 1.5, 3 |
| `county_card_master` | 2 | Canonical jurisdiction rules per county | Sub-Hub 3, 4, 5 |
| `calculators_state` | 3 | User-configurable calculator inputs | Sub-Hub 3 |

**ENRICHMENT Total**: **10 tables**

#### AUDIT Tables — Logging/Tracking (NOT Query Surfaces)

| Table Name | Sub-Hub | Purpose |
|------------|---------|---------|
| `pass0_run_log` | 0 | Orchestrator run tracking |
| `hub0_event_log` | 0 | Event log for Hub 0 operations |
| `hub1_pass1_run_log` | 1 | Hub 1 run tracking |
| `hub1_pass1_error_log` | 1 | Hub 1 error tracking (migrates → `market_errors`) |
| `pass1_skip_log` | 1 | Skipped ZIP logging |
| `jurisdiction_collection_log` | 2 | Collection run tracking |
| `pass2_runs` | 3 | Pass 2 run metadata |
| `master_failure_log` | Shared | Cross-hub error tracking |
| `engine_logs` | Shared | System engine logging |
| `generic_ingest_log` | Shared | Generic ingest tracking |
| `ai_cost_tracker` | Shared | AI usage cost tracking |
| `zip_runs` | Shared | ZIP-level run tracking |

**AUDIT Total**: **12 tables**

#### DEPRECATED Tables

| Table Name | Sub-Hub | Reason |
|------------|---------|--------|
| `pass1_runs` | 1 | Legacy run metadata — replaced by `hub1_pass1_run_log` |
| `pass1_results` | 1 | Replaced by `market_structure` canonical table |
| `pass2_results` | 3 | Replaced by `feasibility_runs` canonical table |
| `deal_decisions` | 5 | Future table — replaced by `deal_verdicts` |

**DEPRECATED Total**: **4 tables**

---

**Grand Total**: 15 QUERY + 20 SOURCE + 10 ENRICHMENT + 12 AUDIT + 4 DEPRECATED = **61 table classifications**

Only the **15 QUERY tables** are query surfaces. Everything else is supportive.

### Classification Rules

| Rule | Enforcement |
|------|-------------|
| SOURCE tables are NEVER query surfaces | Agent MUST HALT if asked to query SOURCE |
| ENRICHMENT tables are joined, not queried | Never the "FROM" table |
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
| Universal join key (sovereign_id) not found in query path | HALT — structural violation |

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

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-12 | Claude Code | Initial OSAM declaration |

---

## Validation Checklist

Before OSAM is considered valid:

| Check | Status |
|-------|--------|
| [x] Universal join key declared | `sovereign_id` (UUID) |
| [x] Spine table identified | `deal_analyses` |
| [x] All sub-hubs listed with table ownership | 7 sub-hubs, 2 tables each |
| [x] All allowed joins explicitly declared | 14 joins (7 canonical + 7 error) |
| [x] All tables classified (QUERY/SOURCE/ENRICHMENT/AUDIT) | 15 tables classified |
| [x] Query routing table complete | 15 question types routed |
| [x] STOP conditions understood | Query + Semantic conditions declared |
| [ ] No undeclared joins exist in ERD | ERDs must be updated to conform |

---

## Relationship to Other Artifacts

| Artifact | OSAM Relationship |
|----------|-------------------|
| **PRD** | PRD declares WHAT transformation. OSAM declares WHERE to query. PRD must reference OSAM. |
| **ERD** | ERD implements OSAM. ERD may not introduce joins not in OSAM. |
| **Process** | Processes query via OSAM routes. No ad-hoc queries. |
| **Agents** | Agents follow OSAM routing strictly. HALT on unknown routes. |

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-02-12 |
| Last Modified | 2026-02-12 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authority | CONSTITUTIONAL |
| Derives From | BARTON_STORAGE_SYSTEM_CONSTITUTION.md |
| Change Protocol | ADR + HUMAN APPROVAL REQUIRED |
