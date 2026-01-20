# ERD: Sub-Hub 0 — Signals/Smoke Radar

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)  
> **CC Layer:** CC-03 (Context Artifacts)

## Ownership Declaration

- **Hub:** Sub-Hub 0
- **Anchor:** ZIP Code
- **Authority:** WRITE for owned tables, READ-ONLY for referenced tables
- **Purpose:** Detect early "smoke" signals that indicate market opportunity

---

## Tables Owned (WRITE)

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `pass0_signals` | `signal_id` (UUID) | Append-only signal observations anchored to ZIP + SVA |
| `pass0_narrative_pins` | `id` (UUID) | Geographic pins from narrative sources |
| `pass0_run_log` | `id` (UUID) | Orchestrator run tracking |
| `pass0_url_queue` | `id` (UUID) | URL queue for signal source processing |
| `hub0_event_log` | `id` (UUID) | Event log for Hub 0 operations |

---

## Tables Referenced (READ-ONLY)

| Table | Owner | Purpose |
|-------|-------|---------|
| `ref_zip_replica` | Shared/Ref | ZIP centroid coordinates for geo resolution |
| `sovereign_id_zips` | Shared/Ref | SVA → ZIP scope mapping |
| `sovereign_ids` | Shared/Ref | SVA identity container |

---

## Key Relationships

```
pass0_signals.zip_code → ref_zip_replica.zip (READ-ONLY lookup)
pass0_signals.sovereign_id → sovereign_ids.sva_id (READ-ONLY lookup)
pass0_narrative_pins.zip_id → ref_zip_replica.zip (READ-ONLY lookup)
pass0_narrative_pins.run_id → pass0_run_log.run_id
```

---

## Mermaid ERD

See: [ERD_SubHub0_Signals.mermaid](./ERD_SubHub0_Signals.mermaid)

---

## Cross-Hub Rules

- `pass0_signals` is **APPEND-ONLY** — UPDATE/DELETE blocked by trigger
- Other sub-hubs may READ from `pass0_signals` but never WRITE
- Sub-Hub 1 reads signals to inform market analysis

---

## Immutability Enforcement

```sql
CREATE TRIGGER trg_pass0_signals_immutable 
BEFORE UPDATE OR DELETE ON pass0_signals 
FOR EACH ROW EXECUTE FUNCTION prevent_signal_mutation();
```
