# 🚀 CURSOR BACKEND-ONLY SUPER-PROMPT

**Copy/paste this directly into Cursor (or any LLM-driven IDE):**

---

You are ONLY allowed to modify backend code.

You may NOT modify any front-end, UI, components, pages, or client-side files.

Ignore ANY files under: `/src`, `/app`, `/components`, `/pages`, `/public`, `/styles`, `/ui`, `/assets`, or any front-end directory.

You must operate EXCLUSIVELY inside the backend folder.

## Backend directory includes:

- `/backend`
- `/backend/api`
- `/backend/core`
- `/backend/db`
- `/backend/models`
- `/backend/schemas`
- `/backend/services`
- `/backend/utils`
- `/backend/pipeline`
- `/backend/config`
- `/backend/renderer`
- `/imo_creator`
- `/config`
- `/ctb`
- `/tests` (backend tests only)

## Your responsibilities:

### ✅ 1. You may edit backend compute logic ONLY

You may implement or modify:

- Scoring logic
- Saturation logic
- Parcel evaluation
- Financial modeling
- Database migrations
- Pipeline steps
- Service integrations
- Process registry
- Global config handling
- Neon write/read logic
- Async functions
- API endpoints (FastAPI only)
- Background workers
- Processors for IMO-Creator
- Error handlers
- Logging layers
- Constants/rules

### ❌ 2. You may NOT modify front-end

**Disallowed:**

- React components
- TypeScript UI
- Tailwind
- Routing
- Client services
- Payload assemblers
- Supabase UI helpers
- Anything user-facing

**If a change "looks UI-ish," reject it.**

### ❌ 3. Do NOT create new front-end files

Everything you generate must live inside backend, never UI.

## ⚙️ Cursor Must Enforce This Rule Automatically

Before applying ANY code change, Cursor must internally verify:

```
IF file_path STARTS WITH:
  /src
  /pages
  /components
  /app
  /public
  /ui
  /styles
THEN:
  REJECT CHANGE
```

Cursor must print:

**"Front-end modification is not allowed. Backend-only mode is active."**

## 🔧 Allowed Tasks (Backend Only)

You may:

- Add new backend endpoints
- Add new Neon queries
- Add new tables/migrations
- Add new scoring modules
- Add new parsers/validators
- Add new services (Census, U-Haul, DOT, etc.)
- Add pipeline steps
- Patch calculation bugs
- Add logging/auditing
- Improve async performance
- Add tests
- Add new backend folders

All of this must stay inside `/backend`.

## 🧱 Backend Context You Must Assume

- Backend is FastAPI (async)
- Database is Neon (Postgres)
- Connection is asyncpg
- Process engine is IMO-Creator
- Doctrine enforced via Global Config + CTB + Altitude
- Front-end is Lovable.dev and off-limits

## 🧨 FINAL DIRECTIVE

Operate in BACKEND-ONLY MODE.

Do not modify, delete, or generate UI/front-end code under ANY circumstances.

All work must stay within the backend architecture.

Implement requested changes strictly on the backend side.

---

**See `backend/BACKEND_ONLY_MODE.md` for complete documentation.**

