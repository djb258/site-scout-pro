# ADR: Supply Gap UI Panel

> **Status:** [x] Accepted
> **Date:** 2024-12-18
> **Freeze Tag:** `pass1hub_supply_gap_panel@v1.0.0` ✅ FROZEN

---

## Context

Hub 1 Pass 1 pipeline computes demand and supply aggregates per distance band. A read-only UI panel was needed to visualize the gap between baseline demand and existing supply, with confidence indicators, without any write or recalculation capability.

---

## Decision

| Field | Value |
|-------|-------|
| **Component Name** | Supply Gap Panel |
| **Doctrine ID** | HUB1.PASS1.UI.SUPPLY_GAP.v1.0 |
| **Parent Hub** | Hub 1 (Pass 1 Exploration) |
| **Location** | `src/pages/hub/Pass1Hub.tsx` |
| **Type** | [x] Read-Only Instrument Panel |

---

## Specification

### Data Sources (Read-Only)

| Table | Fields Used |
|-------|-------------|
| `pass1_demand_agg` | `distance_band`, `baseline_demand_sqft`, `population_total` |
| `pass1_supply_agg` | `distance_band`, `facility_count`, `supply_sqft_total`, `gap_sqft`, `confidence` |

### Query Rules

- Filter by active `run_id`
- Join on `distance_band`
- **Do NOT recompute math** — use stored `gap_sqft` value
- Band order fixed: `0-30`, `30-60`, `60-120`

### Render Modes

**Mode 1: Demand Only (supply not computed)**
- Show demand table with population and baseline demand
- Display inline note: "Supply not computed for this run"

**Mode 2: Full Gap Table (both exist)**
- 3-row table with columns: Band, Demand, Supply, Gap, Confidence
- Gap coloring: green if > 0, red if < 0
- Confidence badges: `low` or `medium` only (never `high`)

### Table Schema

| Column | Source | Notes |
|--------|--------|-------|
| Band | `distance_band` | Fixed order: 0-30, 30-60, 60-120 |
| Baseline Demand (sqft) | `pass1_demand_agg.baseline_demand_sqft` | Formatted with commas |
| Supply (sqft) | `pass1_supply_agg.supply_sqft_total` | Formatted with commas |
| Gap (sqft) | `pass1_supply_agg.gap_sqft` | Green if +, Red if - |
| Confidence | `pass1_supply_agg.confidence` | Pill badge |

---

## Alternatives Considered

| Option | Why Not Chosen |
|--------|----------------|
| Inline in scoring card | Too cluttered, separate concern |
| Separate page | Overkill for read-only display |
| Editable panel | Violates doctrine (no recalculation) |
| Do Nothing | Blocks visibility into supply gap data |

---

## Consequences

### Enables

- Visual inspection of demand vs supply per band
- Confidence transparency (low/medium badges)
- Clear "supply not computed" state indication
- Band-level gap analysis

### Prevents

- Accidental data mutation
- Math recalculation in UI
- Confidence inflation (high never shown)
- Write operations from panel

---

## Guard Rails

| Type | Value |
|------|-------|
| Write Access | ❌ None — read-only |
| Recalculation | ❌ None — uses stored values |
| Controls | ❌ None — no sliders, buttons |
| Confidence Cap | `low` or `medium` only |

---

## Hard Rules (Doctrine Compliance)

- ✅ Read-only (no writes)
- ✅ No recalculation (use stored `gap_sqft`)
- ✅ No sliders or controls
- ✅ Band order fixed: 0-30, 30-60, 60-120
- ✅ Confidence ≠ "high" (never displayed)
- ✅ Does NOT reference: rents, competition scores, pass/fail logic
- ✅ Does NOT call orchestrator

---

## Rollback

Remove the Supply Gap Panel card from `Pass1Hub.tsx`. No data migration required — panel is purely presentational.

---

## Approval

| Role | Name | Date |
|------|------|------|
| Hub Owner | System | 2024-12-18 |
| Reviewer | Doctrine Audit | 2024-12-18 |

---

## Freeze Declaration

```
pass1hub_supply_gap_panel@v1.0.0 ✅ FROZEN
DO NOT MODIFY visual layout or data sources without new ADR
```
