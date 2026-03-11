# Storage Site Scouting Backend

Fully asynchronous FastAPI + asyncpg backend for Storage Site Scouting & Process of Elimination Engine.

**Repository**: [https://github.com/djb258/site-scout-pro.git](https://github.com/djb258/site-scout-pro.git)

## Architecture

- **Framework**: FastAPI (async) + CF Workers (compute + hosting)
- **Database**: CF D1/KV (working) + Neon PostgreSQL (vault/archive)
- **Architecture**: CTB (Christmas Tree Backbone) + Altitude model
- **Pattern**: Fully asynchronous throughout
- **Frontend**: Figma UI (design) → CF Workers/Pages (hosting)
- **File Storage**: CF R2

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
- `/src` - Frontend code (React/TypeScript via Figma UI) - **OFF-LIMITS**
- `/tests` - Test files
- `/config` - Global configuration (IMO-Creator)
- `/imo_creator` - IMO-Creator integration

## ⚠️ Backend-Only Mode

This repository operates in **BACKEND-ONLY MODE** for AI-assisted development.

**Allowed**: All modifications to `/backend`, `/config`, `/ctb`, `/imo_creator`, `/tests`
**Forbidden**: Any modifications to `/src`, `/components`, `/pages`, `/public`, or any frontend files

See `backend/BACKEND_ONLY_MODE.md` for complete rules.

## Frontend

The frontend is designed in Figma UI and built with React, TypeScript, and Tailwind CSS, hosted on CF Workers/Pages. To run the frontend locally:

```bash
npm install
npm run dev
```
