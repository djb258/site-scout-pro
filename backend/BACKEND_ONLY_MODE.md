# 🚀 BACKEND-ONLY MODE - STRICT ENFORCEMENT

## ⚠️ CRITICAL RULE

**You are ONLY allowed to modify backend code.**

**You may NOT modify any front-end, UI, components, pages, or client-side files.**

## 🚫 FORBIDDEN PATHS

Ignore ANY files under:
- `/src`
- `/app`
- `/components`
- `/pages`
- `/public`
- `/styles`
- `/ui`
- `/assets`
- Any front-end directory

## ✅ ALLOWED BACKEND PATHS

You must operate EXCLUSIVELY inside:
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

## ✅ ALLOWED BACKEND TASKS

You may implement or modify:

### Core Logic
- ✅ Scoring logic
- ✅ Saturation logic
- ✅ Parcel evaluation
- ✅ Financial modeling
- ✅ Calculation functions
- ✅ Business rules
- ✅ Validators

### Database
- ✅ Database migrations
- ✅ Neon write/read logic
- ✅ Schema changes
- ✅ Query optimization
- ✅ Connection pooling

### API Layer
- ✅ API endpoints (FastAPI only)
- ✅ Request/response schemas
- ✅ Error handlers
- ✅ Middleware
- ✅ Route handlers

### Services
- ✅ Service integrations (Census, U-Haul, DOT, etc.)
- ✅ External API clients
- ✅ Data processors
- ✅ Background workers

### Infrastructure
- ✅ Pipeline steps
- ✅ Process registry
- ✅ Global config handling
- ✅ Async functions
- ✅ Processors for IMO-Creator
- ✅ Logging layers
- ✅ Constants/rules

### Testing
- ✅ Backend unit tests
- ✅ Integration tests
- ✅ API tests

## ❌ FORBIDDEN FRONTEND TASKS

**Disallowed:**
- ❌ React components
- ❌ TypeScript UI
- ❌ Tailwind CSS
- ❌ Client-side routing
- ❌ Client services
- ❌ Payload assemblers
- ❌ Supabase UI helpers
- ❌ Anything user-facing
- ❌ Frontend state management
- ❌ UI components
- ❌ Styling files

**If a change "looks UI-ish," reject it.**

## 🧱 BACKEND CONTEXT

- **Framework**: FastAPI (async)
- **Database**: Neon (Postgres)
- **Connection**: asyncpg
- **Process Engine**: IMO-Creator
- **Doctrine**: Enforced via Global Config + CTB + Altitude
- **Front-end**: Lovable.dev (OFF-LIMITS)

## 🔧 ENFORCEMENT CHECK

Before applying ANY code change, verify:

```python
FORBIDDEN_PATHS = [
    "/src",
    "/pages",
    "/components",
    "/app",
    "/public",
    "/ui",
    "/styles",
    "/assets"
]

def is_backend_only(file_path: str) -> bool:
    """Check if file path is backend-only."""
    for forbidden in FORBIDDEN_PATHS:
        if file_path.startswith(forbidden):
            return False
    return True
```

**If file path starts with any forbidden path:**
- **REJECT CHANGE**
- Print: "Front-end modification is not allowed. Backend-only mode is active."

## 🧨 FINAL DIRECTIVE

**Operate in BACKEND-ONLY MODE.**

Do not modify, delete, or generate UI/front-end code under ANY circumstances.

All work must stay within the backend architecture.

Implement requested changes strictly on the backend side.

