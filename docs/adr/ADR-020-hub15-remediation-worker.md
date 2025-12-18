# ADR-020: Hub 1.5 Remediation Worker

**Status:** Accepted  
**Date:** 2025-12-18  
**Author:** System Architect  
**Version:** v0.1.0 (SHELL ONLY)

## Context

Hub 1 (Pass 1) analysis produces competition data with varying confidence levels. When confidence is below threshold ("low" or "medium") or rate data is missing entirely, the analysis cannot proceed to Pass 2 with acceptable certainty. This creates a gap between initial discovery and underwriting-ready data.

The industry standard for resolving these gaps involves:
1. Web scraping competitor rate pages
2. AI-powered phone calls to collect verbal rate quotes
3. Manual research as a fallback

Hub 1.5 serves as the remediation layer between Pass 1 and Pass 2, responsible for systematically resolving data gaps through automated workers.

## Decision

We will implement Hub 1.5 as a **Remediation Worker Shell** with the following architecture:

### Core Principles

1. **Shell Only** — No business logic in this iteration. All worker implementations return stub responses.
2. **Ephemeral Workspace** — Queue and attempt logs live in Lovable Cloud only, with 7-day TTL.
3. **Append-Only Vault** — Resolved data writes to Neon as `pass_1_5_addendum` records (NOT YET IMPLEMENTED).
4. **Deterministic Output** — Workers produce resolved values OR explicit failures. No partial data.
5. **Observable** — Every attempt is logged. Every cost is tracked. Every failure is recorded.

### Database Schema

#### Lovable Cloud (ephemeral)

```sql
-- Gap queue: tracks pending remediation work
CREATE TABLE pass_1_5_gap_queue (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL,
  pass1_run_id UUID NOT NULL,
  gap_type TEXT NOT NULL,        -- 'missing_rate', 'low_confidence', 'no_phone'
  competitor_id TEXT NOT NULL,
  competitor_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved', 'failed', 'killed'
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  ttl_expires_at TIMESTAMPTZ     -- 7-day TTL
);

-- Attempt log: audit trail
CREATE TABLE pass_1_5_attempt_log (
  id UUID PRIMARY KEY,
  gap_queue_id UUID REFERENCES pass_1_5_gap_queue(id),
  worker_type TEXT NOT NULL,     -- 'scraper', 'ai_caller', 'manual'
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,          -- 'started', 'completed', 'failed', 'timeout', 'killed'
  duration_ms INTEGER,
  cost_cents INTEGER,
  transcript_hash TEXT           -- SHA256 for audit
);
```

#### Neon Vault (append-only) — NOT YET IMPLEMENTED

```sql
-- Addendum: final resolved data
CREATE TABLE pass_1_5_addendum (
  id UUID PRIMARY KEY,
  pass1_run_id UUID NOT NULL,
  competitor_id TEXT NOT NULL,
  resolved_value JSONB NOT NULL,
  source TEXT NOT NULL,          -- 'scrape', 'ai_call', 'manual'
  confidence NUMERIC NOT NULL,
  transcript_hash TEXT,
  resolved_at TIMESTAMPTZ NOT NULL
);
```

### Edge Functions

| Function | Purpose | Status |
|----------|---------|--------|
| `hub15_orchestrator` | Thin controller for workflow | STUB |
| `hub15_enqueue_gaps` | Queue population from Pass 1 | STUB |
| `hub15_rate_scraper` | Web scraping worker | STUB (TODO: Firecrawl) |
| `hub15_ai_caller` | Voice call worker | STUB (TODO: Retell.ai) |
| `hub15_resolve_gap` | Mark resolved, queue for vault | STUB |
| `hub15_kill_switch` | Emergency halt | STUB |
| `hub15_log_attempt` | Audit trail logger | STUB |
| `hub15_get_dashboard` | Read-only dashboard API | STUB |

### Guard Rails

| Threshold | Value | Action |
|-----------|-------|--------|
| Retry cap | 3 attempts max | Move to failed |
| Cost cap | $50/run | Trigger kill switch |
| Concurrent calls | 20 max | Queue additional |
| Call timeout | 180s | Auto-terminate |
| Daily call limit | 500/day | Pause until next day |
| Failure rate | >70% | Trigger kill switch |

### Worker Contract

**Input (from Pass 1):**
```typescript
interface GapFlag {
  pass1RunId: string;
  competitorId: string;
  competitorName: string;
  gapType: 'missing_rate' | 'low_confidence' | 'no_phone' | 'no_scrape_data';
  phoneNumber?: string;
  targetUnitSizes: string[];
}
```

**Output:**
```typescript
// Success
interface ResolvedGap {
  status: 'resolved';
  value: {
    rates: { unitSize: string; rate: number; climate: boolean }[];
    confidence: number;
    source: 'scrape' | 'ai_call';
  };
  transcriptHash?: string;
  attemptCount: number;
}

// Failure
interface FailedGap {
  status: 'failed';
  reason: string;
  errorCode: string;
  attemptCount: number;
}
```

## Consequences

### Positive

1. **Clean separation** — Hub 1.5 isolates remediation logic from Pass 1 analysis and Pass 2 underwriting.
2. **Observable** — Full audit trail enables debugging and compliance.
3. **Cost-controlled** — Guard rails prevent runaway spending.
4. **Resumable** — Queue-based architecture allows retry and resume.

### Negative

1. **Additional latency** — Remediation adds time between Pass 1 and Pass 2.
2. **External dependencies** — Retell.ai and Firecrawl introduce third-party failure modes.
3. **Cost** — AI calling incurs per-minute charges.

### Neutral

1. **Shell only** — This ADR documents the shell architecture. Worker implementation is deferred.

## Non-Goals

The following are explicitly **out of scope** for Hub 1.5:

- ❌ Scoring or ranking competitors
- ❌ Making go/no-go recommendations
- ❌ Promoting data to Pass 2 (that's Pass 1's job via promotion payload)
- ❌ Direct Neon writes (all writes via vault queue pattern)
- ❌ Real-time updates (batch processing only)
- ❌ Manual data entry UI (read-only dashboard only)

## Related Documents

- [ADR-005: Retell.ai Voice Integration](./ADR-005-retell-ai.md)
- [ADR-009: Firecrawl Web Scraping](./ADR-009-firecrawl.md)
- [PRD: Pass 1.5 Rent Recon Hub](../prd/PRD_PASS15_RENT_RECON_HUB.md)
- [Hub 1 Pass 1 Canonical Schema](../../memories/architecture/hub1-pass1-canonical-schema.md)

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| v0.1.0 | 2025-12-18 | Initial shell architecture |
