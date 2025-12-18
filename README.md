# Storage Site Scouting Backend

Fully asynchronous FastAPI + asyncpg backend for Storage Site Scouting & Process of Elimination Engine.

**Repository**: [https://github.com/djb258/site-scout-pro.git](https://github.com/djb258/site-scout-pro.git)

## Architecture

- **Framework**: FastAPI (fully async)
- **Database**: Neon PostgreSQL via asyncpg
- **Architecture**: CTB (Christmas Tree Backbone) + Altitude model
- **Pattern**: Fully asynchronous throughout
- **Frontend**: Lovable.dev (React/TypeScript) - see frontend files in `src/`

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment:
```bash
cp env.example .env
# Edit .env with your Neon database connection string
```

3. Run migrations:
```bash
# Apply migrations to Neon database
psql $NEON_DATABASE_URL -f backend/db/migrations/001_init.sql
psql $NEON_DATABASE_URL -f backend/db/migrations/002_scoring_tables.sql
psql $NEON_DATABASE_URL -f backend/db/migrations/003_parcel_tables.sql
```

4. Start the server:
```bash
uvicorn backend.main:app --reload
```

## API Endpoints

- `POST /api/screening` - Run initial screening
- `POST /api/saturation` - Calculate saturation metrics
- `POST /api/score` - Calculate final scoring
- `POST /api/financials` - Calculate financial viability
- `POST /api/parcels` - Screen parcel viability
- `GET /health` - Health check

## Testing

```bash
pytest tests/
```

## Project Structure

- `/ctb` - CTB documentation and Altitude files
- `/backend` - Main application code (FastAPI) - **BACKEND-ONLY MODE**
- `/src` - Frontend code (React/TypeScript via Lovable.dev) - **OFF-LIMITS**
- `/tests` - Test files
- `/config` - Global configuration (IMO-Creator)
- `/imo_creator` - IMO-Creator integration

## ⚠️ Backend-Only Mode

This repository operates in **BACKEND-ONLY MODE** for AI-assisted development.

**Allowed**: All modifications to `/backend`, `/config`, `/ctb`, `/imo_creator`, `/tests`
**Forbidden**: Any modifications to `/src`, `/components`, `/pages`, `/public`, or any frontend files

See `backend/BACKEND_ONLY_MODE.md` for complete rules.

## ⚠️ ZIP Replica Sync Doctrine (SS.REF.SYNC.01)

**CRITICAL: Read before modifying any ZIP-related code.**

The `us_zip_codes` table is **DEPRECATED**. All ZIP lookups must use:

| Use Case | Table | Schema |
|----------|-------|--------|
| Geography lookup (lat/lon) | `ref.ref_zip_replica` | geography only |
| Census/demographic data | `pass1_census_snapshot` | time-variant |

### Non-Negotiable Invariants

1. **Neon = Vault (authoritative)** — All ref data lives in Neon
2. **Lovable = Workbench (read-only)** — Execution cache only
3. **ref schema = geography ONLY** — NO census/demographic data
4. **Manual sync only** — No automated sync jobs

### Deprecated Functions (DO NOT USE)

- `syncZipsFromNeon` — Use `scripts/sync_zip_replica.py`
- `bulkLoadZips` — Use `scripts/sync_zip_replica.py`
- `uploadZipCodes` — Use `scripts/sync_zip_replica.py`

### Required Before Pass Execution

```typescript
// Version check REQUIRED before execution
await supabase.rpc('ref.require_valid_replica');
```

**Full Doctrine:** [docs/doctrine/ZIP_REPLICA_SYNC_DOCTRINE.md](docs/doctrine/ZIP_REPLICA_SYNC_DOCTRINE.md)

## Frontend

The frontend is built with Lovable.dev using React, TypeScript, and Tailwind CSS. To run the frontend:

```bash
npm install
npm run dev
```
