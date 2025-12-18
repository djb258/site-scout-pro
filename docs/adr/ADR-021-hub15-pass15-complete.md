# ADR-021: Hub 1.5 Remediation Worker - PASS 1.5 COMPLETE

**Status:** FROZEN  
**Version:** v1.0.0  
**Date:** 2025-12-18  
**Author:** System  

---

## PASS 1.5 COMPLETE

This ADR documents the completion and freeze of Hub 1.5 (Pass 1.5) Remediation Worker.

---

## Context

Hub 1.5 sits between Pass 1 (Exploration) and Pass 2 (Underwriting) to remediate data gaps in competition analysis. When Pass 1 identifies competitors with missing or low-confidence rate data, Hub 1.5 provides a systematic mechanism to resolve these gaps through automated workers (scraper, AI caller).

---

## Decision

Hub 1.5 is implemented as a **Remediation Worker Shell** with the following locked components:

### Frozen Functions (v1.0.0)

| Function | Version | Purpose |
|----------|---------|---------|
| `hub15_enqueue_gaps` | 1.0.0 | Translate Pass 1 gap flags into remediation queue |
| `hub15_log_attempt` | 1.1.0 | Authoritative audit trail with atomic gap status updates |
| `hub15_resolve_gap` | 1.0.0 | Convert successful remediation to vault-ready addendum |
| `hub15_get_dashboard` | 1.1.0 | Read-only observability endpoint |

### Shell Functions (NOT in v1.0.0 scope)

| Function | Version | Status |
|----------|---------|--------|
| `hub15_orchestrator` | 0.1.0 | SHELL - Worker dispatch logic deferred |
| `hub15_kill_switch` | 0.1.0 | SHELL - Emergency halt logic deferred |
| `hub15_ai_caller` | - | NOT IMPLEMENTED - Retell integration deferred |
| `hub15_rate_scraper` | - | NOT IMPLEMENTED - Web scraping deferred |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         HUB 1.5 BOUNDARY                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Pass 1 Gap Flags                                              │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────┐                                           │
│   │ hub15_enqueue   │ ──▶ pass_1_5_gap_queue                    │
│   │     _gaps       │                                           │
│   └─────────────────┘                                           │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────┐     ┌─────────────────┐                   │
│   │ [WORKER SHELL]  │ ──▶ │ hub15_log       │                   │
│   │ ai_caller/      │     │    _attempt     │                   │
│   │ scraper         │     └─────────────────┘                   │
│   └─────────────────┘            │                              │
│         │                        ▼                              │
│         │               pass_1_5_attempt_log                    │
│         ▼                                                       │
│   ┌─────────────────┐                                           │
│   │ hub15_resolve   │ ──▶ vault_push_queue                      │
│   │     _gap        │     (NO DIRECT NEON)                      │
│   └─────────────────┘                                           │
│                                                                 │
│   ┌─────────────────┐                                           │
│   │ hub15_get       │ ◀── READ ONLY                             │
│   │   _dashboard    │                                           │
│   └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Lovable Cloud Only)

### pass_1_5_gap_queue
- `id` (UUID, PK)
- `run_id` (UUID) - Remediation batch ID
- `pass1_run_id` (UUID) - Source Pass 1 run
- `competitor_id` (TEXT)
- `competitor_name` (TEXT)
- `competitor_address` (TEXT, nullable)
- `phone_number` (TEXT, nullable)
- `gap_type` (TEXT) - missing_rate | low_confidence | no_phone | no_scrape_data
- `target_unit_sizes` (TEXT[])
- `priority` (TEXT) - high | normal | low
- `status` (TEXT) - pending | in_progress | resolved | failed | killed
- `assigned_worker` (TEXT, nullable) - ai_caller | scraper
- `attempt_count` (INT, default 0)
- `max_attempts` (INT, default 3)
- `ttl_expires_at` (TIMESTAMPTZ) - 7-day TTL

### pass_1_5_attempt_log
- `id` (UUID, PK)
- `gap_queue_id` (UUID, FK)
- `run_id` (UUID)
- `worker_type` (TEXT) - scraper | ai_caller | manual
- `attempt_number` (INT)
- `status` (TEXT) - started | completed | failed | timeout | killed | cost_exceeded
- `duration_ms` (INT, nullable)
- `cost_cents` (INT, default 0)
- `error_code` (TEXT, nullable)
- `error_message` (TEXT, nullable)
- `transcript_hash` (TEXT, nullable)
- `source_url` (TEXT, nullable)
- `metadata` (JSONB)

---

## Guard Rails

| Threshold | Value | Enforcement |
|-----------|-------|-------------|
| Max attempts per gap | 3 | hub15_log_attempt |
| Daily cost cap | $50 (5000 cents) | hub15_get_dashboard |
| Daily call limit | 500 | hub15_get_dashboard |
| Failure rate threshold | 40% | hub15_get_dashboard |
| Confidence floor | 50% | hub15_resolve_gap |

---

## Hard Rules (IMMUTABLE)

1. **No scoring** - Hub 1.5 does not score or rank gaps
2. **No ranking** - Priority is deterministic from gap_type only
3. **No underwriting logic** - No feasibility, no financial calculations
4. **No direct Neon writes** - All resolved data goes to vault_push_queue
5. **No new integrations** - No external APIs beyond Retell (deferred)
6. **Append-only logging** - Attempt logs are never modified
7. **Idempotent operations** - All writes are safe to retry

---

## Priority Mapping (Frozen)

| gap_type | priority | assigned_worker |
|----------|----------|-----------------|
| missing_rate | high | ai_caller |
| low_confidence | normal | ai_caller |
| no_phone | low | scraper |
| no_scrape_data | normal | ai_caller |

---

## E2E Flow Verification

### Test Sequence (Manual)

1. **Enqueue**: POST to `hub15_enqueue_gaps` with sample gap flags
2. **Verify Queue**: Check `pass_1_5_gap_queue` for inserted rows
3. **Log Start**: POST to `hub15_log_attempt` with status="started"
4. **Verify Status**: Confirm gap status changed to "in_progress"
5. **Log Complete**: POST to `hub15_log_attempt` with status="completed"
6. **Resolve**: POST to `hub15_resolve_gap` with rate data
7. **Verify Vault Queue**: Check `vault_push_queue` for addendum
8. **Dashboard**: GET `hub15_get_dashboard` to verify aggregations

### Expected Results

- Gaps deduplicated by (pass1_run_id, competitor_id, gap_type)
- Attempt count incremented atomically
- Status transitions enforced (pending → in_progress → resolved/failed)
- Confidence floor (50%) enforced on resolution
- Dashboard reflects accurate counts and costs

---

## What's NOT in v1.0.0

The following are explicitly deferred:

1. **Worker dispatch** - Orchestrator remains a shell
2. **Retell integration** - AI caller not wired to Retell API
3. **Web scraper** - Rate scraping not implemented
4. **Kill switch logic** - Emergency halt is a stub
5. **Real-time worker coordination** - No WebSocket/polling
6. **Pass 2 handoff automation** - Manual promotion only

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-18 | Initial freeze - core functions complete |

---

## References

- [ADR-020: Hub 1.5 Remediation Worker Architecture](./ADR-020-hub15-remediation-worker.md)
- [Retell Script Configuration](../RETELL_SCRIPT_CONFIG.md)
- [Pass 1 Structure PRD](../prd/PRD_PASS1_STRUCTURE_HUB.md)

---

## Sign-off

**PASS 1.5 COMPLETE** — No new features beyond this point.

Functions are version-locked with `// DOCTRINE LOCKED` headers.
