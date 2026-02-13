# ADR-016: Neon PostgreSQL Database

## Conformance

| Field | Value |
|-------|-------|
| Doctrine Version | 2.0.0 |
| CTB Version | 2.0.0 |
| CC Layer | CC-04 |
| Governing Hub | barton-storage (CC-02) |

## Owning Hub

| Field | Value |
|-------|-------|
| Hub ID | barton-storage |
| Hub Name | Barton Storage System |
| CC Layer | CC-02 |

## CC Layer Scope

| Layer | Relevance |
|-------|-----------|
| CC-01 Sovereign | Governed by barton-family-office |
| CC-02 Hub | barton-storage |
| CC-03 Context | All contexts |
| CC-04 Process | Neon Database implementation |

## IMO Layer Scope

| Layer | Impact |
|-------|--------|
| Ingress | No |
| Middle | Yes |
| Egress | Yes |

## Constant vs Variable

| Type | Name | Description |
|------|------|-------------|
| CONST (Input) | Structured records | Consumed by Neon Database |
| VAR (Output) | Persisted vault data | Produced by Neon Database |


**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.DL.01

---

## Context

The Storage Site Scout application requires a persistent database for storing opportunity data, pass results, audit logs, and the master failure log. The database must be serverless-compatible, scalable, and cost-effective.

## Decision

We will use **Neon** as our primary PostgreSQL database for persistent storage ("the Vault").

### Why Neon

| Requirement | Neon Capability |
|-------------|-----------------|
| Serverless | Auto-scaling, pay-per-use |
| PostgreSQL | Full Postgres compatibility |
| Edge-friendly | Low-latency from edge functions |
| Branching | Database branching for testing |
| Cost | Generous free tier, predictable scaling |

### Connection Configuration

```typescript
// Environment variables
NEON_DATABASE_URL=postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb
NEON_POOL_URL=postgres://user:password@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb

// Connection options
const connectionConfig = {
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: true,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10  // Connection pool size
};
```

### Schema Organization

```
neondb/
├── Tables
│   ├── site_candidate          -- Main opportunity tracking
│   ├── rent_comps              -- Rent comparison data
│   ├── population_metrics      -- Census/demographic data
│   ├── county_score            -- County difficulty scores
│   ├── parcel_screening        -- Parcel analysis results
│   ├── saturation_matrix       -- Market saturation data
│   ├── process_log             -- Audit trail
│   ├── error_log               -- Legacy error log
│   └── master_failure_log      -- Centralized failure tracking (ADR-013)
├── Pass Tables
│   ├── pass0_runs              -- Pass-0 execution records
│   ├── pass1_runs              -- Pass-1 execution records
│   ├── pass15_runs             -- Pass-1.5 execution records
│   ├── pass2_runs              -- Pass-2 execution records
│   └── pass3_runs              -- Pass-3 execution records
└── Indexes
    └── [See schema.sql for full index list]
```

### Usage Patterns

**1. VaultMapper Spoke (Pass-2)**
```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

async function saveToVault(underwritingPackage: UnderwritingPackage): Promise<string> {
  const result = await sql`
    INSERT INTO site_candidate (
      address, county, state, zipcode, acreage,
      final_score, status, created_at
    ) VALUES (
      ${underwritingPackage.address},
      ${underwritingPackage.county},
      ${underwritingPackage.state},
      ${underwritingPackage.zipCode},
      ${underwritingPackage.acreage},
      ${underwritingPackage.dealIndex},
      'pass2_complete',
      NOW()
    )
    RETURNING id
  `;
  return result[0].id;
}
```

**2. Master Failure Log**
```typescript
async function logFailure(entry: MasterFailureLogEntry): Promise<string> {
  const result = await sql`
    INSERT INTO master_failure_log (
      process_id, opportunity_id, pass, spoke,
      error_code, severity, message, context
    ) VALUES (
      ${entry.process_id},
      ${entry.opportunity_id},
      ${entry.pass},
      ${entry.spoke},
      ${entry.error_code},
      ${entry.severity},
      ${entry.message},
      ${JSON.stringify(entry.context)}
    )
    RETURNING id
  `;
  return result[0].id;
}
```

**3. Process Log (Audit Trail)**
```typescript
async function logProcess(
  candidateId: number,
  stage: string,
  status: string,
  input: unknown,
  output: unknown
): Promise<void> {
  await sql`
    INSERT INTO process_log (candidate_id, stage, status, input_data, output_data)
    VALUES (${candidateId}, ${stage}, ${status}, ${JSON.stringify(input)}, ${JSON.stringify(output)})
  `;
}
```

### Connection Pooling

For edge functions and serverless environments, use Neon's connection pooler:

```typescript
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.NEON_POOL_URL });

// Use pool for concurrent requests
const client = await pool.connect();
try {
  const result = await client.query('SELECT * FROM site_candidate WHERE id = $1', [id]);
  return result.rows[0];
} finally {
  client.release();
}
```

## Rationale

1. **Serverless-First**: Neon scales to zero, no cold starts
2. **Postgres Ecosystem**: Full SQL support, JSONB for flexible schemas
3. **Edge Compatibility**: Works with Cloudflare Workers, Vercel Edge
4. **Cost Effective**: Free tier covers development, predictable production costs
5. **Branching**: Create database branches for testing without affecting production

## Consequences

### Positive
- No infrastructure management
- Automatic scaling
- Full PostgreSQL compatibility
- Database branching for CI/CD

### Negative
- Vendor lock-in to Neon-specific features
- Cold start latency on free tier (mitigated with pooler)
- Limited to PostgreSQL (no multi-model)

## Migration Strategy

1. Schema managed via `backend/db/schema.sql`
2. Migrations in `backend/db/migrations/`
3. Use Neon branching for staging/testing
4. Promote branches to production via Neon console

## Related Documents

- backend/db/schema.sql
- ADR-013-master-failure-log.md
- PRD_DATA_LAYER_HUB.md


---

## PID Impact

| Pass | Impact |
|------|--------|
| Pass 0 | Yes |
| Pass 1 | Yes |
| Pass 1.5 | Yes |
| Pass 2 | Yes |
| Pass 3 | Yes |

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Author | AI Agent | 2026-02-13 | DRAFTED |
| Reviewer | --- | --- | PENDING |
| Sovereign | barton-family-office | --- | PENDING |
