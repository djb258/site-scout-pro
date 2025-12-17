# ADR-017: Supabase Integration

**Status:** Accepted
**Date:** 2025-12-17
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.DL.02

---

## Context

The Storage Site Scout application requires a real-time database layer for the Lovable.dev frontend, authentication, and scratchpad storage during pipeline execution. Supabase provides these capabilities as a managed service.

## Decision

We will use **Supabase** as our real-time database and authentication layer, complementing Neon for persistent vault storage.

### Architecture Split

| Layer | Database | Purpose |
|-------|----------|---------|
| Scratchpad | Supabase | Real-time UI, in-progress data |
| Vault | Neon | Permanent storage, audit trail |
| Auth | Supabase | User authentication |
| Edge Logs | Supabase | Engine logs, metrics |

### Why Supabase

1. **Lovable.dev Native**: First-class support in Lovable.dev
2. **Real-time**: WebSocket subscriptions for live updates
3. **Auth**: Built-in authentication
4. **Edge Functions**: Serverless function hosting
5. **Storage**: File storage for reports/documents

### Connection Configuration

```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### Tables in Supabase

```
supabase/
├── Scratchpad Tables
│   ├── pass1_runs              -- In-progress Pass-1 executions
│   ├── pass2_runs              -- In-progress Pass-2 executions
│   ├── staged_opportunities    -- Opportunities between passes
│   └── staged_results          -- Intermediate results
├── Logging Tables
│   ├── engine_logs             -- Pipeline execution logs
│   └── api_call_logs           -- External API call tracking
├── Auth Tables
│   └── [Supabase managed]
└── Real-time Subscriptions
    ├── pass_status_updates
    └── opportunity_changes
```

### Usage Patterns

**1. LovableAdapter (Edge Function Support)**
```typescript
// src/shared/adapters/LovableAdapter.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const TABLES = {
  PASS1_RUNS: 'pass1_runs',
  PASS2_RUNS: 'pass2_runs',
  STAGED_OPPORTUNITIES: 'staged_opportunities',
  ENGINE_LOGS: 'engine_logs',
};

export async function createRun(
  table: string,
  zipCode: string,
  metadata: Record<string, unknown>
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from(table)
    .insert({
      zip_code: zipCode,
      status: 'pending',
      metadata,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id };
}
```

**2. Real-time Subscriptions (Frontend)**
```typescript
// Subscribe to pass status updates
const subscription = supabase
  .channel('pass-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'pass1_runs',
      filter: `id=eq.${runId}`,
    },
    (payload) => {
      console.log('Pass status updated:', payload.new.status);
      updateUI(payload.new);
    }
  )
  .subscribe();
```

**3. Engine Logging**
```typescript
export async function writeLog(
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  await supabase.from('engine_logs').insert({
    event,
    data,
    timestamp: new Date().toISOString(),
  });
}

export async function writeErrorLog(
  event: string,
  error: Error | string,
  context?: Record<string, unknown>
): Promise<void> {
  await supabase.from('engine_logs').insert({
    event,
    level: 'error',
    data: {
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    },
    timestamp: new Date().toISOString(),
  });
}
```

### Data Flow Between Supabase and Neon

```
User Request
    │
    ▼
┌─────────────────┐
│   Supabase      │  ◄── Real-time UI updates
│   (Scratchpad)  │  ◄── In-progress data
└────────┬────────┘
         │
         │  Pass completes
         ▼
┌─────────────────┐
│     Neon        │  ◄── Permanent storage
│    (Vault)      │  ◄── Audit trail
└─────────────────┘
```

### Environment Variables

```env
# Supabase (Frontend + Edge)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Supabase (Server-side)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Neon (Vault)
NEON_DATABASE_URL=postgres://...
```

## Rationale

1. **Separation of Concerns**: Scratchpad vs. permanent storage
2. **Real-time**: Live UI updates without polling
3. **Lovable.dev Integration**: Native support
4. **Auth**: No need to build authentication
5. **Edge Support**: Works with Cloudflare Workers

## Consequences

### Positive
- Real-time UI updates
- Built-in authentication
- Managed infrastructure
- Excellent DX with Supabase client

### Negative
- Two databases to manage
- Data sync complexity between Supabase and Neon
- Cost at scale (two services)

## Migration Pattern

Data flows from Supabase (scratchpad) to Neon (vault):

```typescript
// After Pass-2 completes successfully
async function promoteToVault(
  opportunity: OpportunityObject,
  underwritingPackage: UnderwritingPackage
): Promise<void> {
  // 1. Write to Neon vault
  const vaultId = await saveToVault(underwritingPackage);

  // 2. Update Supabase scratchpad with vault reference
  await supabase
    .from('staged_opportunities')
    .update({ vault_id: vaultId, status: 'vaulted' })
    .eq('id', opportunity.id);

  // 3. Clean up scratchpad (optional, based on retention policy)
  // await cleanupScratchpad(opportunity.id);
}
```

## Related Documents

- src/integrations/supabase/client.ts
- src/shared/adapters/LovableAdapter.ts
- ADR-016-neon-database.md
- PRD_DATA_LAYER_HUB.md
