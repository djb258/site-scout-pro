# Data Layer Hub

## PRD Reference
- **PRD:** [`docs/prd/PRD_DATA_LAYER_HUB.md`](../../../docs/prd/PRD_DATA_LAYER_HUB.md)
- **Doctrine ID:** SS.DL.00
- **Hub Name:** DATA_LAYER_HUB

## Purpose

The Data Layer Hub manages all database connections and persistence operations across the Storage Site Scout system. It provides unified adapters for Supabase (Lovable.DB) and Neon PostgreSQL (STAMPED vault).

**Note:** Firebase is NOT used in this repository. All references to Firebase in the original PRD are superseded.

## Boundary

**This hub owns:**
- All database connections
- Schema management
- Data persistence operations
- Connection pooling and health checks
- Query execution and retry logic

**This hub does NOT own:**
- Business logic
- Calculations
- Verdicts
- Any pass-specific processing

## Directory Structure

```
/shared/data_layer/
  /adapters/
    LovableAdapter.ts         # SS.DL.01 - Supabase/Lovable.DB adapter
    NeonAdapter.ts            # SS.DL.02 - Neon PostgreSQL adapter (STUB)
  README.md
```

## Components

| Component | Doctrine ID | Capability | Status |
|-----------|-------------|------------|--------|
| LovableAdapter | SS.DL.01 | Supabase/Lovable.DB adapter for scratchpad tables | Implemented |
| NeonAdapter | SS.DL.02 | Neon PostgreSQL for STAMPED vault data | Stub (by design) |

## Import Rules (Non-Negotiable)

- This module MAY be imported from any `/src/passX/*` directory
- This module MAY be imported from `/src/ui/*`
- **CRITICAL:** Pass 0 MAY import LovableAdapter for scratchpad operations
- **CRITICAL:** Pass 0 MUST NOT import NeonAdapter under any condition
- NeonAdapter may only be used by Pass 1-3 orchestrators and save_to_vault edge function

### Pass 0 Neon Ban (Hard Violation)

Pass 0 Radar Hub is **FORBIDDEN** from:
- Importing `NeonAdapter`
- Importing `@neondatabase/serverless`
- Referencing Neon connection strings
- Writing to vault tables
- Promoting opportunities to persistent storage

CI checks enforce this constraint. Violations fail the build.

## Database Schema

### Supabase (Lovable.DB)

| Table | Purpose |
|-------|---------|
| pass1_runs | Pass-1 execution results |
| pass2_runs | Pass-2 execution results |
| staging_payload | Intermediate data between passes |
| engine_logs | System logging and audit trail |
| jurisdiction_cards | Cached jurisdiction data |
| rate_observations | Collected rate data |
| rent_benchmarks | Aggregated rent benchmarks |

### Neon PostgreSQL (STAMPED Vault)

| Table | Purpose |
|-------|---------|
| vault | Final underwriting records |
| vault_history | Versioned vault records |

## Guard Rails

| Guard Rail | Threshold |
|------------|-----------|
| Connection Pool Size | Min: 2, Max: 10 |
| Query Timeout | 60 seconds |
| Write Retry | 3 attempts with exponential backoff |
| Connection Health Check | Every 30 seconds |

## Related Documentation

- ADR-008: Supabase Integration
- ADR-009: Neon PostgreSQL Integration
