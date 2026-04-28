# Storage Hub
## Edge worker for the storage real-estate silo, exposing pass pipeline state from D1 over a small Hono API.
### Status: BUILD
### Medium: worker
### Business: real-estate

---

# IDENTITY (Thing — what this IS)

_Everything in this cluster answers: what exists? These are constants that don't change regardless of who reads this or when._

## 1. IDENTITY

| Field | Value |
|-------|-------|
| ID | storage-hub |
| Name | Storage Hub Worker |
| Medium | worker |
| Business Silo | real-estate |
| CTB Position | leaf / workers/storage-hub |
| ORBT | BUILD |
| Strikes | 0 |
| Authority | inherited — imo-creator real-estate silo |
| Last Modified | 2026-04-12 |
| BAR Reference | BAR-272 |

### HEIR (8 fields — Aviation Model, Bedrock §8)

| Field | Value |
|-------|-------|
| sovereign_ref | imo-creator |
| hub_id | storage-hub |
| ctb_placement | leaf |
| imo_topology | middle |
| cc_layer | CC-03 context |
| services | Cloudflare Workers, Hono, D1 SQLite |
| secrets_provider | doppler |
| acceptance_criteria | `/health` returns 200, requested route groups compile, core D1 schema exists for six storage tables, and bindings resolve to `storage-ops` plus `D1_GLOBAL` |

---

## 2. PURPOSE

_What breaks without it. What business outcome it serves._

Storage Hub gives the storage container go-nogo stack a conforming IMO-Creator edge API and working database surface inside the `workers/` tree. Without it, the storage pass pipeline remains trapped in a separate repo and cannot read or write ZIP, facility, parcel, pass, and deal state through the Cloudflare infrastructure already used by the rest of the system.

---

## 3. RESOURCES

_Everything this depends on. A mechanic reads this and knows exactly what to set up before it can run._

### Dependencies

| Dependency | Type | What It Provides | Status |
|-----------|------|-----------------|--------|
| `storage container go-nogo` | repository | Source schema intent, pass ownership, parcel API behavior | DONE |
| D1 `storage-ops` | database | Working store for storage pass entities | PENDING |
| D1 `D1_GLOBAL` | database | Shared ZIP/global reference database | DONE |
| Hono | library | Worker routing and JSON responses | DONE |
| Wrangler | tool | Dev, migration apply, deploy | DONE |
| Doppler | secret provider | `GLOBAL_CLOUDFLARE_API_TOKEN`, `STORAGE_DATABASE_URL` | BLOCKED |

### Downstream Consumers

| Consumer | What It Needs |
|----------|--------------|
| Storage frontend in go-nogo repo | `/api/zips`, `/api/facilities`, `/api/parcels`, `/api/deals` |
| Pass pipeline operators | D1-backed state for market screening and deal tracking |
| Mission Control / future real-estate UI | health check plus edge-readable storage records |

### Tools & Integrations

| Item | Type | Cost Tier | Credentials | What It Does |
|------|------|-----------|-------------|-------------|
| Cloudflare Workers | edge runtime | usage-based | Cloudflare account | Runs the storage API |
| Cloudflare D1 | database | usage-based | D1 bindings | Stores storage pass entities |
| Doppler CLI | secret manager | paid | project token | Supplies Neon and Cloudflare secrets |
| Neon Postgres | source database | usage-based | `STORAGE_DATABASE_URL` | Existing storage schema to mirror |

### Secrets

| Secret | Doppler Project | Config | Used By |
|--------|----------------|--------|---------|
| `STORAGE_DATABASE_URL` | imo-creator | dev | Neon table discovery and schema comparison |
| `GLOBAL_CLOUDFLARE_API_TOKEN` | imo-creator | dev | D1 create + deploy |

---

# CONTRACT (Flow — what flows through this)

_Everything in this cluster answers: what moves? How does data/work enter, get processed, and exit?_

## 4. IMO — Input, Middle, Output

### Two-Question Intake (Bedrock §3)
1. **"What triggers this?"** — HTTP requests into the storage API or migration/deploy actions through Wrangler.
2. **"How do we get it?"** — Cloudflare routes requests to the worker, and Wrangler applies migrations to the `storage-ops` D1 database.

### Input
JSON requests to the storage routes, plus D1 migration files that define the storage pass schema. Read filters come through query params such as `state`, `zip`, `status`, `limit`, and `offset`.

### Middle

| Step | Input | What Happens | Output | Tool Used |
|------|-------|-------------|--------|-----------|
| 1 | HTTP request | Hono matches `/health` or `/api/*` | Route dispatch | Hono |
| 2 | Route params/body | Handler validates filters or payload | SQL + bindings | TypeScript |
| 3 | SQL request | `STORAGE_OPS` executes reads or inserts | row set / mutation | D1 |
| 4 | D1 result | Worker serializes JSON fields and deal joins | API response | Hono |

### Output
Structured JSON for ZIP scores, facilities, parcels, and deal pipeline records, with pass result context joined onto deal views.

### Circle (Bedrock §5)
Pipeline state enters through route writes or remote data sync, D1 persists the canonical working set, consumers read the updated records, and subsequent pass stages use that response state to drive the next request or promotion.

---

## 5. DATA SCHEMA

_Where the data lives. What's read, written, joined. The plumbing._

### READ Access

| Source | What It Provides | Join Key |
|--------|-----------------|----------|
| `zip_scores` | ZIP-level signal and market status | `zip_code` |
| `market_data` | Market metrics for a ZIP | `market_data_id`, `zip_code` |
| `facilities` | Competitor / market facility records | `facility_id`, `zip_code` |
| `parcels` | Parcel screening candidates | `parcel_id`, `zip_code` |
| `deal_pipeline` | Deal tracker rows | `deal_id`, `zip_code` |
| `pass_results` | Stage-by-stage outcomes per deal | `deal_id`, `run_id` |
| `D1_GLOBAL` | Shared ZIP/global reference data | ZIP code |

### WRITE Access

| Target | What It Writes | When |
|--------|---------------|------|
| `facilities` | New or enriched facility rows | `POST /api/facilities` |
| `parcels` | Parcel candidate rows | `POST /api/parcels` |
| `deal_pipeline` | Deal tracker rows | `POST /api/deals` |
| `pass_results` | Immediate stage snapshot when a deal post includes stage/status | `POST /api/deals` |
| `workers/storage-hub/*` | Worker code, migration, and config | build time |

### Join Chain

```text
zip_scores
  -> market_data (market_data_id)
    -> facilities (zip_code, market_data_id)
      -> deal_pipeline (zip_code, facility_id, parcel_id)
        -> pass_results (deal_id)
```

### Forbidden Paths

| Action | Why |
|--------|-----|
| Modifying `/Users/employeeai/Documents/storage container go-nogo/` | Task explicitly forbids it |
| Modifying Tier 0 constants or locked doctrine files | Human-only constants |
| Shipping with a fake D1 database ID while claiming deployment complete | Configuration would be false |

---

## 6. DMJ — Define, Map, Join (law/doctrine/DMJ.md)

_Three steps. In order. Can't skip._

### 6a. DEFINE (Build the Key)

| Element | ID | Format | Description | C or V |
|---------|-----|--------|-------------|--------|
| Worker | WRK-STR-01 | `storage-hub` | Cloudflare Worker name | C |
| Primary D1 binding | DB-STR-01 | `STORAGE_OPS` | Storage working database | C |
| Global D1 binding | DB-GLB-01 | `D1_GLOBAL` | Shared ZIP/global reference database | C |
| ZIP route | ROUTE-STR-01 | `/api/zips` | ZIP score reads | C |
| Facility route | ROUTE-STR-02 | `/api/facilities` | Facility reads/writes | C |
| Parcel route | ROUTE-STR-03 | `/api/parcels` | Parcel reads/writes | C |
| Deal route | ROUTE-STR-04 | `/api/deals` | Deal pipeline reads/writes | C |
| Core schema | SCH-STR-01 | six SQLite tables | Minimal pass pipeline persistence | V |

### 6b. MAP (Connect Key to Structure)

| Source | Target | Transform |
|--------|--------|-----------|
| Neon/Postgres schema intent | D1 migration | PostgreSQL concepts reduced to SQLite-safe columns |
| Storage pass docs | Route surface | Domain nouns mapped to `/api/zips`, `/api/facilities`, `/api/parcels`, `/api/deals` |
| `wrangler.toml` | runtime env | D1 bindings injected into `Env` |
| Deal POST body | `deal_pipeline` + `pass_results` | create deal row and optional initial pass snapshot |

### 6c. JOIN (Path to Spine)

| Join Path | Type | Description |
|-----------|------|-------------|
| `zip_scores -> market_data` | Direct | ZIP metrics join to market details |
| `facilities -> zip_scores` | Direct | Facilities attach to their market ZIP |
| `parcels -> zip_scores` | Direct | Parcels belong to a screened ZIP |
| `deal_pipeline -> pass_results` | Direct | Deal rows read latest and historical pass outcomes |

---

## 7. CONSTANTS & VARIABLES (Bedrock §2)

### Constants (structure — never changes)
- Worker path: `workers/storage-hub/`
- Runtime: Cloudflare Workers + Hono + TypeScript
- Required bindings: `STORAGE_OPS`, `D1_GLOBAL`
- Route set: `/health`, `/api/zips`, `/api/facilities`, `/api/parcels`, `/api/deals`

### Variables (fill — changes every task)
- Real `storage-ops` D1 database UUID
- Neon table inventory from `STORAGE_DATABASE_URL`
- Seed data volume and pass-stage payloads
- Deployment timestamp and Workers.dev version

---

## 8. STOP CONDITIONS (Bedrock §6)

| Condition | Action |
|-----------|--------|
| Doppler secrets unavailable | HALT remote creation/deploy and report blocker |
| Cloudflare API unreachable | HALT remote creation/deploy and keep local files only |
| Requested table shape conflicts with source schema evidence | HALT and escalate before inventing columns |
| Any task requires modifying the source repo | REFUSE |
| Same remote failure repeats three times | HALT and escalate |

---

# GOVERNANCE (Change — how this is controlled)

_Everything in this cluster answers: what transforms? How is quality measured, verified, certified?_

## 9. VERIFICATION

_Executable proof that it works. Run these._

```text
1. GET /health -> expected: 200 with storage_ops binding check
2. GET /api/zips?limit=10 -> expected: paginated JSON array
3. POST /api/facilities with zip_code + name -> expected: 201 and stored facility row
4. POST /api/parcels with zip_code -> expected: 201 and stored parcel row
5. POST /api/deals with zip_code + title + stage + status -> expected: 201 and matching deal/pass rows
6. GET /api/deals/:deal_id -> expected: joined deal with pass_results array
```

**Three Primitives Check (Bedrock §1):**
1. **Thing:** Worker files, migration, and bindings exist in the expected path.
2. **Flow:** Requests move from Hono route to D1 query to JSON response.
3. **Change:** Inserts create durable rows in the D1 schema and deal reads reflect pass joins.

---

## 10. ANALYTICS

_The BUILD→OPERATE gate. Three sub-layers._

### 10a. Metrics

| Metric | Unit | Baseline | Target | Tolerance |
|--------|------|----------|--------|-----------|
| Route availability | % | BASELINE | 100% | 0 |
| D1 migration success | runs | BASELINE | 1/1 | 0 |
| Schema coverage for required tables | count | BASELINE | 6/6 | 0 |
| Remote blocker count | count | BASELINE | 0 | 0 |

### 10b. Sigma Tracking (Bedrock §2)

| Metric | Run 1 | Run 2 | Run 3 | Trend | Action |
|--------|-------|-------|-------|-------|--------|
| Route availability | pending | pending | pending | PENDING | Verify after deploy |
| D1 migration success | blocked | pending | pending | PENDING | Re-run once network and secrets exist |

### 10c. ORBT Gate Rules

| From | To | Gate |
|------|-----|------|
| BUILD | OPERATE | D1 created, migration applied, worker deployed, endpoints verified |
| BUILD | REPAIR | Any route or migration fails locally |
| REPAIR | OPERATE | Fix applied and verification rerun |

---

## 11. EXECUTION TRACE

_Append-only. Every action logged. The auditor reads this._

| Field | Format | Required |
|-------|--------|----------|
| trace_id | UUID | Yes |
| run_id | UUID | Yes |
| step | action name | Yes |
| target | measurable | Yes |
| actual | measurable | Yes |
| delta | gap | Yes |
| status | done / failed / skipped | Yes |
| error_code | text or null | If failed |
| error_message | text or null | If failed |
| tools_used | JSON array | Yes |
| duration_ms | integer | Yes |
| cost_cents | integer | Yes |
| timestamp | ISO-8601 | Yes |
| signed_by | agent or manual | Yes |

---

## 12. LOGBOOK (After Certification Only)

_Created ONLY when the auditor certifies (BUILD → OPERATE). Append-only._

No certification entry yet. Worker remains in `BUILD` because remote D1 creation and deployment were blocked by unavailable Doppler auth and Cloudflare network access in the execution environment.

---

## 13. FLEET FAILURE REGISTRY

| Pattern ID | Location | Error Code | First Seen | Occurrences | Strike Count | Status |
|-----------|----------|-----------|-----------|-------------|-------------|--------|
| STR-REMOTE-001 | Doppler CLI | KEYRING_MISSING | 2026-04-12 | 2 | 1 | OPEN |
| STR-REMOTE-002 | Wrangler/Cloudflare | DNS_UNRESOLVED | 2026-04-12 | 1 | 1 | OPEN |

---

## 14. SESSION LOG

| Date | What Was Done | LBB Record |
|------|---------------|-----------|
| 2026-04-12 | Built `workers/storage-hub`, added SQLite migration for six storage core tables, wired Hono routes, documented remote blockers for D1 creation and deploy. | pending |
