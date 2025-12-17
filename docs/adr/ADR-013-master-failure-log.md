# ADR-013: Master Failure Log

**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.00.FL

---

## Context

The Storage Site Scout application has 5 passes (Pass-0 through Pass-3) with 39 total spokes. When failures occur, operators need to quickly identify:
1. **Which pass** failed
2. **Which spoke** within that pass
3. **What type of error** occurred
4. **Context** to reproduce/debug the issue

Currently, each pass may log errors independently, making it difficult to get a unified view of system health and troubleshoot issues efficiently.

## Decision

We will implement a **Master Failure Log** - a centralized database table that aggregates all failures from all passes into a single queryable location.

### Core Principle

**One table to find any failure, then go directly to that pass to fix it.**

### Table Schema

```sql
CREATE TABLE IF NOT EXISTS master_failure_log (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Process Identification (CRITICAL for isolation)
    process_id UUID NOT NULL,              -- Unique ID for this specific run/execution
    opportunity_id TEXT,                   -- Which site/opportunity this relates to

    -- Location Identification (WHERE did it fail?)
    pass TEXT NOT NULL,                    -- PASS0, PASS1, PASS1_5, PASS2, PASS3
    spoke TEXT,                            -- Which spoke within the pass (e.g., FEASIBILITY, ZONING)
    orchestrator_run_id TEXT,              -- Links to specific orchestrator execution

    -- Error Classification (WHAT failed?)
    error_code TEXT NOT NULL,              -- Standardized code (e.g., DSCR_BELOW_MINIMUM)
    error_category TEXT,                   -- API_ERROR, VALIDATION_ERROR, TIMEOUT, FATAL_FLAW, etc.
    severity TEXT NOT NULL,                -- info, warning, error, critical

    -- Error Details (WHY did it fail?)
    message TEXT NOT NULL,                 -- Human-readable description
    stack_trace TEXT,                      -- Full stack trace if available

    -- Context (WHAT was happening when it failed?)
    input_payload JSONB,                   -- What inputs were provided to the spoke
    output_payload JSONB,                  -- Partial output if any was generated
    context JSONB,                         -- Additional metadata (API responses, etc.)

    -- Resolution Tracking
    resolution_status TEXT DEFAULT 'open', -- open, acknowledged, in_progress, resolved, auto_repaired
    resolved_at TIMESTAMP,
    resolved_by TEXT,
    resolution_notes TEXT,

    -- Auto-Repair Tracking
    auto_repair_attempted BOOLEAN DEFAULT FALSE,
    auto_repair_succeeded BOOLEAN,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mfl_process_id ON master_failure_log(process_id);
CREATE INDEX IF NOT EXISTS idx_mfl_opportunity_id ON master_failure_log(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_mfl_pass ON master_failure_log(pass);
CREATE INDEX IF NOT EXISTS idx_mfl_pass_spoke ON master_failure_log(pass, spoke);
CREATE INDEX IF NOT EXISTS idx_mfl_severity ON master_failure_log(severity);
CREATE INDEX IF NOT EXISTS idx_mfl_error_code ON master_failure_log(error_code);
CREATE INDEX IF NOT EXISTS idx_mfl_resolution_status ON master_failure_log(resolution_status);
CREATE INDEX IF NOT EXISTS idx_mfl_created_at ON master_failure_log(created_at DESC);

-- Composite index for troubleshooting queries
CREATE INDEX IF NOT EXISTS idx_mfl_troubleshoot
    ON master_failure_log(pass, severity, resolution_status, created_at DESC);
```

### Pass Identifiers

| Pass | Identifier | Description |
|------|------------|-------------|
| Pass-0 | `PASS0` | Radar/Momentum Hub |
| Pass-1 | `PASS1` | Structure/Recon Hub |
| Pass-1.5 | `PASS1_5` | Rent Recon Hub |
| Pass-2 | `PASS2` | Underwriting Hub |
| Pass-3 | `PASS3` | Design/Calculator Hub |
| Data Layer | `DATA_LAYER` | Database operations |
| System | `SYSTEM` | Infrastructure failures |

### Error Categories

| Category | Description |
|----------|-------------|
| `API_ERROR` | External API call failed (Census, Google, Regrid, etc.) |
| `API_TIMEOUT` | External API call timed out |
| `VALIDATION_ERROR` | Input validation failed |
| `FATAL_FLAW` | Doctrine violation (auto-WALK) |
| `CALCULATION_ERROR` | Math/logic error in spoke |
| `DATABASE_ERROR` | Database read/write failure |
| `ORCHESTRATOR_ERROR` | Hub orchestration failure |
| `TIMEOUT` | Spoke or hub timeout |
| `UNKNOWN` | Uncategorized error |

### Severity Levels

| Severity | Description | Alert? | Auto-Repair? |
|----------|-------------|--------|--------------|
| `info` | Informational, no action needed | No | No |
| `warning` | Potential issue, monitor | Yes | No |
| `error` | Failed operation, needs attention | Yes | Yes |
| `critical` | System degraded, immediate action | Yes | Yes |

## Rationale

1. **Single Source of Truth**: One place to look for all failures
2. **Pass Isolation**: Quickly identify which pass failed without searching multiple logs
3. **Process Traceability**: Track failures through the entire pipeline with `process_id`
4. **Debuggability**: Full context captured at time of failure
5. **Auditability**: Resolution tracking for compliance

## Usage Patterns

### 1. Find All Critical Failures
```sql
SELECT * FROM master_failure_log
WHERE severity = 'critical'
  AND resolution_status = 'open'
ORDER BY created_at DESC;
```

### 2. Find Failures for a Specific Pass
```sql
SELECT * FROM master_failure_log
WHERE pass = 'PASS2'
  AND resolution_status != 'resolved'
ORDER BY created_at DESC;
```

### 3. Find All Failures for a Specific Opportunity
```sql
SELECT * FROM master_failure_log
WHERE opportunity_id = 'OPP-12345'
ORDER BY created_at ASC;
```

### 4. Find Failures by Error Code
```sql
SELECT * FROM master_failure_log
WHERE error_code = 'DSCR_BELOW_MINIMUM'
ORDER BY created_at DESC
LIMIT 100;
```

### 5. Get Failure Stats by Pass
```sql
SELECT
    pass,
    COUNT(*) as total_failures,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE severity = 'error') as error_count,
    COUNT(*) FILTER (WHERE resolution_status = 'open') as open_count
FROM master_failure_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY pass
ORDER BY critical_count DESC, error_count DESC;
```

### 6. Troubleshooting Workflow
```sql
-- Step 1: Get the latest critical failure
SELECT id, pass, spoke, error_code, message, created_at
FROM master_failure_log
WHERE severity = 'critical' AND resolution_status = 'open'
ORDER BY created_at DESC
LIMIT 1;

-- Step 2: Get full context for that failure
SELECT * FROM master_failure_log WHERE id = '<failure-id>';

-- Step 3: Go to that pass's code and fix it
-- (No need to look at other passes!)
```

## TypeScript Integration

```typescript
import { createClient } from '@supabase/supabase-js';

interface MasterFailureLogEntry {
  id?: string;
  process_id: string;
  opportunity_id?: string;
  pass: 'PASS0' | 'PASS1' | 'PASS1_5' | 'PASS2' | 'PASS3' | 'DATA_LAYER' | 'SYSTEM';
  spoke?: string;
  orchestrator_run_id?: string;
  error_code: string;
  error_category?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  stack_trace?: string;
  input_payload?: Record<string, unknown>;
  output_payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
  resolution_status?: 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'auto_repaired';
  auto_repair_attempted?: boolean;
  auto_repair_succeeded?: boolean;
  retry_count?: number;
}

async function logFailure(entry: MasterFailureLogEntry): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { error } = await supabase
    .from('master_failure_log')
    .insert(entry);

  if (error) {
    console.error('[MASTER_FAILURE_LOG] Failed to log failure:', error);
    // Fallback to console logging
    console.error('[MASTER_FAILURE_LOG]', JSON.stringify(entry));
  }
}

// Convenience functions for each pass
export async function logPass0Failure(
  processId: string,
  spoke: string,
  errorCode: string,
  severity: MasterFailureLogEntry['severity'],
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  await logFailure({
    process_id: processId,
    pass: 'PASS0',
    spoke,
    error_code: errorCode,
    severity,
    message,
    context
  });
}

export async function logPass1Failure(
  processId: string,
  spoke: string,
  errorCode: string,
  severity: MasterFailureLogEntry['severity'],
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  await logFailure({
    process_id: processId,
    pass: 'PASS1',
    spoke,
    error_code: errorCode,
    severity,
    message,
    context
  });
}

export async function logPass15Failure(
  processId: string,
  spoke: string,
  errorCode: string,
  severity: MasterFailureLogEntry['severity'],
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  await logFailure({
    process_id: processId,
    pass: 'PASS1_5',
    spoke,
    error_code: errorCode,
    severity,
    message,
    context
  });
}

export async function logPass2Failure(
  processId: string,
  spoke: string,
  errorCode: string,
  severity: MasterFailureLogEntry['severity'],
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  await logFailure({
    process_id: processId,
    pass: 'PASS2',
    spoke,
    error_code: errorCode,
    severity,
    message,
    context
  });
}

export async function logPass3Failure(
  processId: string,
  spoke: string,
  errorCode: string,
  severity: MasterFailureLogEntry['severity'],
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  await logFailure({
    process_id: processId,
    pass: 'PASS3',
    spoke,
    error_code: errorCode,
    severity,
    message,
    context
  });
}
```

## Consequences

### Positive
- **Fast troubleshooting**: One query tells you exactly where to look
- **Pass isolation**: Fix one pass without touching others
- **Full context**: All information captured at time of failure
- **Auditability**: Track who fixed what and when
- **Metrics**: Easy to build dashboards and alerts

### Negative
- **Storage growth**: Need to implement retention policy
- **Write overhead**: Every failure requires a database write
- **Consistency**: Must ensure all passes log failures consistently

## Retention Policy

```sql
-- Delete resolved failures older than 90 days
DELETE FROM master_failure_log
WHERE resolution_status IN ('resolved', 'auto_repaired')
  AND created_at < NOW() - INTERVAL '90 days';

-- Archive critical failures older than 1 year
-- (Move to master_failure_log_archive table)
```

## Compliance

- [ ] All passes log to master_failure_log
- [ ] process_id generated at start of each orchestrator run
- [ ] Error codes standardized across all passes
- [ ] Severity levels consistently applied
- [ ] Resolution workflow documented

## Related Documents

- MasterFailureHub.ts (in-memory implementation)
- PRD_PASS0_RADAR_HUB.md
- PRD_PASS1_STRUCTURE_HUB.md
- PRD_PASS15_RENT_RECON_HUB.md
- PRD_PASS2_UNDERWRITING_HUB.md
- PRD_PASS3_DESIGN_HUB.md
