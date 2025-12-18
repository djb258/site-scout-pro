# ADR: Hub 1 Pass 1 Orchestrator v1.1

> **Status:** [x] Accepted
> **Date:** 2024-12-18
> **Freeze Tag:** `hub1_pass1_orchestrator_v1_1@v1.1.0` ✅ FROZEN

---

## Context

Hub 1 Pass 1 pipeline required optional supply gap computation without breaking existing v1.0.0 behavior. The orchestrator needed to support A/B testing of supply quality while maintaining backward compatibility and doctrine compliance.

---

## Decision

| Field | Value |
|-------|-------|
| **Tool Name** | hub1_pass1_orchestrator_v1_1 |
| **Doctrine ID** | HUB1.PASS1.ORCH.v1.1 |
| **Parent Hub** | Hub 1 (Pass 1 Exploration) |
| **Source** | [x] Custom Edge Function |

---

## Specification

### Input Contract
```json
{
  "run_id": "UUID",
  "origin_zip": "5-digit ZIP",
  "include_supply": false  // optional, defaults to false
}
```

### Execution Sequence
1. **hub1_pass1_radius** — `{ run_id, origin_zip, radius_miles: 120 }`
2. **hub1_pass1_census** — `{ run_id }`
3. **hub1_pass1_demand** — `{ run_id, origin_zip }`
4. **hub1_pass1_supply** (conditional) — only if `include_supply=true`

### Response Shapes

**Success:**
```json
{
  "run_id": "...",
  "origin_zip": "...",
  "status": "completed",
  "include_supply": true,
  "steps": [
    {"step": "radius", "status": "completed"},
    {"step": "census", "status": "completed"},
    {"step": "demand", "status": "completed"},
    {"step": "supply", "status": "completed"}
  ],
  "completed_at": "ISO-8601"
}
```

**Failure:**
```json
{
  "run_id": "...",
  "origin_zip": "...",
  "status": "failed",
  "failed_step": "demand",
  "error": "CENSUS_NOT_FOUND",
  "message": "hub1_pass1_demand failed — pipeline halted",
  "steps": [
    {"step": "radius", "status": "completed"},
    {"step": "census", "status": "completed"},
    {"step": "demand", "status": "failed", "error": "CENSUS_NOT_FOUND"}
  ],
  "failed_at": "ISO-8601"
}
```

---

## Alternatives Considered

| Option | Why Not Chosen |
|--------|----------------|
| Modify v1.0.0 | Breaking change risk, doctrine violation |
| Separate supply orchestrator | Duplication, harder to maintain |
| Do Nothing | Blocks supply gap feature development |

---

## Consequences

### Enables

- Optional supply gap computation per run
- A/B testing of supply data quality
- Backward-compatible pipeline extension
- Step-level observability with `steps[]` array

### Prevents

- Breaking existing v1.0.0 behavior
- Silent failures (hard-stop on any spoke failure)
- Uncontrolled pipeline execution

---

## Guard Rails

| Type | Value |
|------|-------|
| Rate Limit | None (inherits from spokes) |
| Timeout | 30s per spoke |
| Kill Switch | Hard-stop on any spoke failure |
| Backward Compat | `include_supply=false` identical to v1.0.0 |

---

## Hard Rules (Doctrine Compliance)

- ✅ Thin controller only — no compute, no score, no DB access
- ✅ Fixed sequence: radius → census → demand → (supply)
- ✅ No retries, no branching
- ✅ Hard stop on any spoke failure
- ✅ Returns `steps[]` with 3 or 4 entries depending on flag
- ✅ v1.0 behavior preserved when `include_supply=false`

---

## Rollback

Revert to calling `hub1_pass1_orchestrator` (v1.0.0) directly. No data migration required — orchestrator is stateless.

---

## Approval

| Role | Name | Date |
|------|------|------|
| Hub Owner | System | 2024-12-18 |
| Reviewer | Doctrine Audit | 2024-12-18 |

---

## Freeze Declaration

```
hub1_pass1_orchestrator_v1_1@v1.1.0 ✅ FROZEN
DO NOT MODIFY — downstream depends on this shape
```
