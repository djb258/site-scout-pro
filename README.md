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
- `/backend` - Main application code (FastAPI)
- `/src` - Frontend code (React/TypeScript via Lovable.dev)
- `/tests` - Test files
- `/config` - Global configuration (IMO-Creator)
- `/imo_creator` - IMO-Creator integration

## Frontend

The frontend is built with Lovable.dev using React, TypeScript, and Tailwind CSS. To run the frontend:

```bash
npm install
npm run dev
```
