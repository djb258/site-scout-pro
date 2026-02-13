# ERD: Sub-Hub 5 — Deal Gate

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)
> **CC Layer:** CC-03 (Context Artifacts)

## Ownership Declaration

- **Hub:** Sub-Hub 5
- **Anchor:** SVA (Sovereign ID)
- **Anchor Invariant:** All rows must trace to exactly one SVA (Sovereign ID).
- **Authority:** WRITE for owned tables, READ-ONLY for all prior sub-hub outputs
- **Purpose:** Final promotion gate, deal decision logging, vault writes

---

## Tables Owned (WRITE)

| Table | Primary Key | Description |
|-------|-------------|-------------|
| *(Future)* `deal_decisions` | TBD | Final go/no-go decision logs |
| *(Future)* `vault_push_queue` | TBD | Queue for Neon vault writes |

**Note:** Sub-Hub 5 is currently minimal. Decision logging tables will be added as the system matures.

---

## Tables Referenced (READ-ONLY)

| Table | Owner | Purpose |
|-------|-------|---------|
| `sovereign_ids` | Shared/Ref | SVA identity container |
| `pass0_signals` | Sub-Hub 0 | Original smoke signals |
| `pass1_results` | Sub-Hub 1 | Market reality |
| `pass2_results` | Sub-Hub 3 | Feasibility/verdict |
| `site_results_staging` | Sub-Hub 4 | Parcel scores |
| `county_card_master` | Sub-Hub 2 | Jurisdiction constraints |

---

## Mermaid ERD

See: [ERD_SubHub5_DealGate.mermaid](./ERD_SubHub5_DealGate.mermaid)

---

## Cross-Hub Rules

- Sub-Hub 5 is the **terminal consumer** of all prior sub-hub outputs
- All inputs are READ-ONLY — no upstream mutations allowed
- Deal decisions trigger vault promotion (Neon writes)

---

## Promotion Authority

Only Sub-Hub 5 may:
1. Authorize promotion from staging to vault
2. Log final deal decisions
3. Trigger async vault writes

This is the "last gate" before data becomes permanent record.

---

## Pressure Test

### Q1: Does every table trace to a PRD constant?

| Table | PRD Constant | Traced? |
|-------|-------------|---------|
| `deal_decisions` (Future) | All upstream constants (composite of Pass 0-4 outputs) | [ ] |
| `vault_push_queue` (Future) | All upstream constants (promotion queue for vault writes) | [ ] |

### Q2: Does every table produce a PRD variable?

| Table | PRD Variable | Produces? |
|-------|-------------|-----------|
| `deal_decisions` (Future) | Deal recommendations (Go/No-Go investment decisions) | [ ] |
| `vault_push_queue` (Future) | Deal recommendations (vault promotion records) | [ ] |

### Q3: Does every table have pass ownership?

| Table | Owning Pass | Declared? |
|-------|------------|-----------|
| `deal_decisions` (Future) | Pass 5 (GOVERN) | [ ] |
| `vault_push_queue` (Future) | Pass 5 (GOVERN) | [ ] |

### Q4: Does every table have a lineage mechanism?

| Table | Lineage Field | Present? |
|-------|--------------|----------|
| `deal_decisions` (Future) | TBD (pending table creation) | [ ] |
| `vault_push_queue` (Future) | TBD (pending table creation) | [ ] |

## OSAM Alignment

| Check | Status |
|-------|--------|
| All tables declared in OSAM | [ ] |
| No undeclared joins exist | [ ] |
| Join key is sovereign_id | [ ] |

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-01-25 |
| Last Modified | 2026-02-13 |
| Doctrine Version | 2.0.0 |
| Status | ACTIVE |
| Governing PRD | Pending (Pass 5 PRD not yet created) |
| Authority | barton-storage (CC-02) |
