---
name: storage-neon
description: >
  Neon dev/secondary database for the Storage Container Go-NoGo feasibility analysis tool.
  Trigger on: Neon, dev database, secondary database, ZIP screening schema, zips_master,
  us_zip_codes, runs table, zip_results, stage_log, zoning_cache, api_cache, pricing_data,
  traffic_data, screening pipeline data, kill log, tier scoring, or any reference to the
  PostgreSQL layer that holds the ZIP code screening system. Also trigger when discussing
  database migrations, connection strings, branching for dev environments, or cold-start
  behavior on the storage screening backend. If someone mentions "the database" in this repo
  and it is about ZIP master data or screening run history, this skill applies.
master_skill: IMO-Creator/skills/neon/SKILL.md
---

# Storage Neon — Car Skill

Neon serves as the **dev/secondary database** for the Storage Container Go-NoGo system.
Supabase is the **primary production database**. Neon holds the original ZIP screening
schema (runs, zip_results, stage_log, caches) and the authoritative `us_zip_codes` master
table that replicates to Supabase as `ref_zip_replica`.

## What This Repo Uses

| Layer | Platform | Role |
|-------|----------|------|
| Primary DB | Supabase (PostgreSQL) | Production data, auth, edge functions, Sub-Hub tables |
| Dev/Secondary DB | Neon (PostgreSQL) | ZIP master authority, screening runs, dev branches |
| UI | Lovable (exported) | React frontend via Vite + ShadCN |

**Supabase project:** `vxjidpggoemouqrjtkpt` (URL: `https://vxjidpggoemouqrjtkpt.supabase.co`)

There is no master Supabase skill. Supabase config lives in `.env` as `VITE_SUPABASE_URL`
and `VITE_SUPABASE_PUBLISHABLE_KEY`. Supabase migrations live in `supabase/migrations/`.

## Connection Configuration

Environment variables (from `env.example`):

```
NEON_DATABASE_URL=postgresql://user:password@host/database?sslmode=require
NEON_CONNECTION_STRING=postgresql://user:password@host/database?sslmode=require
```

**Driver:** `@neondatabase/serverless` v0.9.0 (in devDependencies)

**Connection pattern:** This repo uses the Neon serverless driver for edge/serverless
queries. For migrations and admin operations, use the direct (non-pooler) connection string.

**Important:** If routing through Cloudflare Hyperdrive in the future, switch to `pg` or
Postgres.js — do NOT use `@neondatabase/serverless` through Hyperdrive. See master skill
for details.

## Schema / Data Model

Neon hosts the original screening schema. The full ERD is documented at:
- `docs/ERD.md` — Complete entity-relationship diagram
- `docs/neon-schema-spec.md` — Full Neon schema specification with SQL
- `docs/erd/` — Per-sub-hub ERD breakdowns (6 sub-hubs + shared references)

### Core Tables (Neon Origin)

| Table | PK | Purpose |
|-------|-----|---------|
| `us_zip_codes` / `zips_master` | `zip` (VARCHAR 5) | Master ZIP list — authority lives in Neon |
| `runs` | `run_id` (UUID) | Screening run tracking |
| `zip_results` | `id` (SERIAL), unique on `(run_id, zip)` | Per-ZIP results per run |
| `stage_log` | `id` (SERIAL) | Stage execution log per run |
| `zoning_cache` | `county_fips` (VARCHAR 5) | County-level zoning research cache |
| `api_cache` | `cache_key` (VARCHAR 255) | External API response cache |
| `pricing_data` | `id` (SERIAL) | Manual pricing research |
| `traffic_data` | `id` (SERIAL) | Manual traffic/access research |

### Supabase Sub-Hub Tables (Production)

The production schema has expanded into 6 sub-hubs on Supabase:

| Sub-Hub | Anchor | Key Tables |
|---------|--------|------------|
| 0 — Signals | ZIP | `pass0_signals`, `pass0_narrative_pins`, `pass0_run_log` |
| 1 — Market | ZIP | `pass1_*`, `facility_*`, `competitor_facilities` |
| 2 — CountyCard | County FIPS | `county_card_*`, `jurisdiction_*` |
| 3 — Calculators | SVA | `calculators_state`, `pass2_*` |
| 4 — Parcel | Parcel ID | `site_*_staging` |
| 5 — DealGate | SVA | Decision logs (future) |
| Shared | Multiple | `sovereign_ids`, `ref_zip_replica`, `master_failure_log` |

### Sync Pattern

```
Neon (us_zip_codes) → system sync → Supabase (ref_zip_replica)
```

All sub-hubs read from `ref_zip_replica`. Neon remains the authority for ZIP master data.

### Key Views (Neon)

| View | Purpose |
|------|---------|
| `v_tier1` | Tier 1 results for most recent run |
| `v_tier2` | Tier 2 results for most recent run |
| `v_kill_summary` | Kill counts by stage per run |
| `v_run_progress` | Run status with tier counts |
| `v_zoning_gaps` | Counties missing zoning research |

### Key Functions (Neon)

| Function | Purpose |
|----------|---------|
| `start_run()` | Initialize a screening run, populate zip_results |
| `complete_run()` | Finalize run, count survivors |
| `log_stage()` | Record stage completion stats |
| `kill_zip()` | Eliminate a ZIP with reason tracking |
| `update_zip_metrics()` | Append JSONB metrics to a ZIP result |
| `assign_tiers()` | Rank survivors into Tier 1/2 |

For full schema reference, see `skills/storage-neon/references/schema.md`.

## Operational Patterns

### Screening Pipeline Flow

1. `start_run()` initializes run + populates `zip_results` for target states
2. Stages 0-8 execute sequentially, each calling `kill_zip()` for eliminations
3. Surviving ZIPs accumulate metrics via `update_zip_metrics()`
4. `assign_tiers()` ranks survivors into Tier 1 (top 20) and Tier 2 (next 30)
5. `complete_run()` finalizes the run

### Branching for Dev

Use Neon branches for safe development:
```bash
neonctl branches create --name feature-x --parent main
neonctl connection-string feature-x
# develop against branch
neonctl branches delete feature-x
```

### JSONB Usage

`zip_results.metrics` and `zip_results.scores` use JSONB for flexible, evolving data.
`runs.config` stores the snapshot of screening constants at run time.
`api_cache.response` and `api_cache.request_params` store cached API data.

**Note:** In the Supabase production schema, vendor JSON is contained per CTB doctrine
(vendor JSON only in `vendor_claude_*` tables, bridge functions for extraction).

## Known Issues

- **Cold starts:** Neon scale-to-zero means first query after idle period takes a few
  seconds. PgBouncer masks most of this. For the screening pipeline (batch process), this
  is a non-issue. For interactive queries, add timeout handling.
- **Connection limits:** Free plan = 0.25 CU = 97 direct connections max. Screening
  pipeline is single-threaded so this is sufficient.
- **Storage limit:** Free plan = 0.5GB. If ZIP data + screening history exceeds this,
  upgrade to Launch plan.
- **No superuser:** Cannot install arbitrary extensions. PostGIS is supported if needed
  for geospatial queries.

## Cost Profile

| Component | Current Plan | Monthly Cost | Notes |
|-----------|-------------|-------------|-------|
| Neon | Free | $0 | 100 CU-hr/mo, 0.5GB storage |
| Supabase | Free/Pro | $0-$25 | Primary DB — separate billing |

**Scale trigger:** If screening runs exceed 100 CU-hr/month or storage exceeds 0.5GB,
upgrade Neon to Launch ($19/mo). The Supabase production schema is the heavier consumer.
