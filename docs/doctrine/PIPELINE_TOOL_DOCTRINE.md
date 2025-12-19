# Pipeline Tool Doctrine — Storage Site Scout

## Purpose

This repository implements a fixed, doctrine-locked pipeline.
Tool selection is constrained to the approved Tool Ledger below.

**Ordering Rule:** `Deterministic → Scrape → AI-Assisted → Manual`

Claude Code MAY:
- Select tools from the ledger
- Enforce ordering (highest automation first)
- Reject invalid tool usage

Claude Code MAY NOT:
- Invent new tools
- Replace deterministic tools with LLMs
- Reorder pipeline stages
- Skip CCA before Pass 0 or Pass 2

---

## Pipeline Flow

```
                    ┌─────────────────────────┐
                    │      USER INPUT         │
                    │   (ZIP + Radius)        │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │    COUNTY RESOLVER      │
                    │  (ZIP → Counties)       │
                    │  Tool: Deterministic    │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │    CCA RECON AGENT      │
                    │  (HOW to collect)       │
                    │  Tool: Multi-stage      │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
    ┌─────────▼─────────┐             ┌───────────▼───────────┐
    │     PASS 0        │             │       PASS 2          │
    │  (Permits/Signals)│             │  (Jurisdiction Facts) │
    │  Tool: Per-CCA    │             │  Tool: Per-CCA        │
    └─────────┬─────────┘             └───────────┬───────────┘
              │                                   │
              │                       ┌───────────▼───────────┐
              │                       │       PASS 3          │
              │                       │   (Calculations)      │
              │                       │  Tool: Deterministic  │
              └───────────────────────┴───────────────────────┘
```

---

## Approved Tool Ledger (HARD LOCK)

### CCA Stage — County Capability Assessment

| Step | Tool Name | Approved Solution | Fallback |
|------|-----------|-------------------|----------|
| CCA-1 | County Resolver | Deterministic ZIP lookup | None |
| CCA-2 | TTL Checker | DB query on expires_at | None |
| CCA-3 | Permit Portal Detector | Pattern matching + vendor detection | Manual probe |
| CCA-4 | Planning Dept Detector | URL pattern matching | Manual probe |
| CCA-5 | Zoning Model Detector | State rules + HTML parsing | Manual probe |
| CCA-6 | Method Selector | Deterministic priority (API→Scrape→Portal→Manual) | None |

### Pass 0 — Permit & Inspection Signals

| Step | Tool Name | Approved Solution | Fallback |
|------|-----------|-------------------|----------|
| P0-1 | API Fetcher | Direct API call (Accela, Tyler, etc.) | Scrape |
| P0-2 | Portal Scraper | Firecrawl / Puppeteer | Manual |
| P0-3 | Inspection Linker | Deterministic permit→inspection join | Skip |
| P0-4 | Signal Deduplicator | Hash + DB uniqueness | None |
| P0-5 | Trend Signal | Google Trends API | Census fallback |
| P0-6 | Momentum Fusion | Weighted scoring (deterministic) | None |

### Pass 2 — Jurisdiction Card Hydration

| Step | Tool Name | Approved Solution | Fallback |
|------|-----------|-------------------|----------|
| P2-1 | Ordinance Scraper | Firecrawl on HTML | PDF Parser |
| P2-2 | PDF Parser | Searchable PDF extraction | Retell AI |
| P2-3 | Dimensional Extractor | Regex + table parser | Retell AI |
| P2-4 | Use Table Parser | HTML table extraction | Manual |
| P2-5 | Fire Code Lookup | State fire code DB | Firecrawl |
| P2-6 | Retell Voice AI | Phone call to planning dept | Manual queue |
| P2-7 | Provenance Tracker | Deterministic source logging | None |

### Pass 3 — Financial Calculations

| Step | Tool Name | Approved Solution | Fallback |
|------|-----------|-------------------|----------|
| P3-1 | Setback Calculator | Deterministic geometry | None |
| P3-2 | Coverage Calculator | Deterministic geometry | None |
| P3-3 | Unit Mix Optimizer | Deterministic solver | None |
| P3-4 | Build Cost Model | Deterministic formula | None |
| P3-5 | NOI Calculator | Deterministic formula | None |
| P3-6 | DSCR Calculator | Deterministic formula | None |
| P3-7 | IRR Calculator | Deterministic NPV solver | None |
| P3-8 | Max Land Price | Deterministic back-solve | None |

---

## Tool Selection Rules

### Rule 1: Deterministic First
Always attempt deterministic solution before fuzzy or AI.

```
✅ Correct: API → Scrape → Portal → Manual
❌ Wrong:   LLM → API (skips deterministic)
```

### Rule 2: AI is Last Resort
LLM/AI tools (Retell, GPT) only when:
- Deterministic failed
- Scrape failed
- Data is high-value

```
✅ Correct: Firecrawl failed → Try PDF parser → Retell call
❌ Wrong:   Jump straight to Retell for setbacks
```

### Rule 3: Manual is Valid
"Manual" is a valid final answer, not a failure.
Route to human queue, don't hallucinate.

```
✅ Correct: CCA returns pass2_method: "manual"
❌ Wrong:   CCA guesses zoning from county name
```

### Rule 4: Pass 3 is Pure Deterministic
No AI in financial calculations. Ever.

```
✅ Correct: IRR = deterministic NPV solver
❌ Wrong:   "Ask GPT to estimate IRR"
```

---

## Forbidden Patterns

| Pattern | Why Forbidden |
|---------|---------------|
| LLM for calculations | Non-deterministic, non-auditable |
| Skip CCA | Can't dispatch without knowing HOW |
| Guess missing data | Unknown must stay unknown |
| Mix Pass 0/Pass 2 logic | Separate concerns |
| AI for structured data | Regex/parsers are faster, cheaper, auditable |

---

## Integration Points

### n8n Workflows
- Enrichment Queue Manager (Pass 0)
- Retell Call Dispatcher (Pass 2)
- Manual Queue Router (all passes)

### External APIs (Approved)
- Census API (demographics)
- Google Places API (competition)
- Google Trends API (signals)
- Firecrawl (scraping)
- Retell.ai (voice calls)
- FEMA API (flood data)
- USGS API (elevation)

### Databases
- Neon (PostgreSQL) — Source of truth
- Supabase — Edge functions, auth
- Firebase — Real-time UI state

---

## Enforcement

This doctrine is enforced by:
1. `src/cca/agent/CcaReconAgent.ts` — Method selection
2. `pass2.v_jurisdiction_card_for_pass3` — View gating
3. `ref.needs_refresh()` — TTL enforcement
4. PR templates — Human review gates
