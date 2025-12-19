# PRD: CCA Recon Agent

## Document Info
| Field | Value |
|-------|-------|
| Status | Active |
| Owner | System Architecture |
| Last Updated | 2024-12-19 |
| Related ADRs | ADR-022, ADR-023 |

---

## Executive Summary

The CCA (County Capability Asset) Recon Agent is a standalone service that runs **UPFRONT** before any pass. It determines the **most automatable way** to collect county-level information for Pass 0 and Pass 2.

> **"Claude thinks. Neon remembers. Lovable orchestrates."**

---

## Problem Statement

Before collecting permit data (Pass 0) or jurisdiction facts (Pass 2), we need to know:
1. **HOW** can we collect this data?
2. **WHAT** data is available to collect?
3. **WHERE** are the source systems?

Without this capability assessment, we waste resources trying to automate counties that require manual research.

---

## Solution Overview

### CCA Answers HOW, Not WHAT

| CCA Answers | Pass 0/2 Answers |
|-------------|------------------|
| Can we automate? | What are the permits? |
| Where is the portal? | What are the setbacks? |
| What vendor system? | Is storage allowed? |
| Is there an API? | What's the fire code? |

### Automation Selection Rule (MANDATORY)

Pick the **highest viable method** in strict order:
```
API → Scrape → Portal → Manual
```

One primary method per pass. No mixing.

---

## System Flow

```
┌──────────────────────────┐
│      Lovable.dev         │
│   (UI / Orchestrator)    │
└───────────┬──────────────┘
            │
            │ 1️⃣ User inputs ZIP + radius
            ▼
┌──────────────────────────┐
│    County Resolver       │
│  (ZIP → Radius → Counties)│
└───────────┬──────────────┘
            │
            │ 2️⃣ Deduplicate against Neon
            │    (county_id + TTL check)
            ▼
┌──────────────────────────┐
│    CCA Recon Agent       │
│      (Claude Code)       │
│                          │
│  • Probes county sources │
│  • Selects best method   │
│  • Emits structured JSON │
│  • NO persistence        │
└───────────┬──────────────┘
            │
            │ 3️⃣ Structured JSON output
            ▼
┌──────────────────────────┐
│         Neon             │
│  (ref.county_capability) │
│                          │
│  • Single source of truth│
│  • TTL-governed          │
│  • Immutable county_id   │
└───────────┬──────────────┘
            │
            │ 4️⃣ Dispatch based on method
            ▼
┌──────────────────────────┐
│      Lovable.dev         │
│   Pass 0 / Pass 2 UI     │
│                          │
│  • Shows collection method│
│  • Dispatches workers    │
│  • Manual → human queue  │
└──────────────────────────┘
```

---

## Input Payload

```typescript
interface CcaReconInput {
  county_id: number;    // Immutable, unique
  state: string;        // State code (TX, FL)
  county_name: string;  // County name
}
```

---

## Output Contract

```json
{
  "county_id": 123,
  "state": "TX",
  "county_name": "Harris",

  "pass0_method": "scrape",
  "pass0_source_pointer": "https://citizenaccess.harriscountytx.gov",
  "pass0_coverage": "full",
  "pass0_notes": "Vendor: accela; Inspections linked",

  "pass2_method": "scrape",
  "pass2_source_pointer": "https://planning.harriscountytx.gov",
  "pass2_coverage": "partial",
  "pass2_notes": "Zoning model: county; Ordinance: html",

  "confidence": "medium",
  "evidence_links": ["https://..."],
  "verified_at": "2024-12-19T10:30:00Z"
}
```

---

## Database Schema

### Table: `ref.county_capability`

| Column | Type | Description |
|--------|------|-------------|
| `county_id` | BIGINT | Immutable, unique |
| `state` | VARCHAR(2) | State code |
| `county_name` | VARCHAR(100) | County name |
| `pass0_method` | ENUM | api \| scrape \| portal \| manual |
| `pass0_source_pointer` | TEXT | URL or system ID |
| `pass0_coverage` | ENUM | full \| partial \| insufficient |
| `pass0_vendor` | VARCHAR(50) | e.g., 'accela', 'tyler' |
| `pass2_method` | ENUM | api \| scrape \| portal \| manual |
| `pass2_source_pointer` | TEXT | URL or system ID |
| `pass2_coverage` | ENUM | full \| partial \| insufficient |
| `pass2_planning_url` | TEXT | Planning department URL |
| `confidence` | ENUM | low \| medium \| high |
| `verified_at` | TIMESTAMPTZ | When CCA was verified |
| `expires_at` | TIMESTAMPTZ | Computed TTL expiration |

---

## Key Contracts

### CCA Recon Agent
- Performs reconnaissance
- Selects best automatable method per pass
- Emits structured JSON only
- **NO persistence authority**

### Lovable
- Resolves counties from ZIP
- Dedupes via `county_id`
- Triggers CCA recon when expired
- Dispatches workers based on method
- **Never decides automation**

### Neon
- Single source of truth
- Immutable `county_id`
- TTL-governed refresh
- Blocks re-recon unless stale

---

## Agent Constraints

### MUST Do
- Probe official county and state sources
- Determine if automation is feasible
- Select best method per pass (API → Scrape → Portal → Manual)
- Document WHERE and WHY

### MUST NOT Do
- Collect real permit, zoning, or inspection data
- Merge Pass 0 and Pass 2 logic
- Guess or hallucinate capabilities
- Write directly to databases

---

## Success Criteria

1. Each county fingerprinted **once** per TTL period
2. Output is deterministic and reusable
3. Downstream systems can execute **without rethinking**
4. Manual counties correctly identified and routed

---

## Implementation

### TypeScript
```
src/cca/
├── agent/
│   ├── types.ts              # CcaReconInput, CcaReconOutput
│   ├── CcaReconAgent.ts      # Main agent class
│   └── index.ts
├── probes/
│   ├── Pass0DataProbe.ts     # Permit portal detection
│   └── Pass2DataProbe.ts     # Planning dept detection
├── consumers/
│   ├── Pass0Consumer.ts      # Read-only API for Pass 0
│   └── Pass2Consumer.ts      # Read-only API for Pass 2
└── index.ts
```

### SQL
```
supabase/migrations/20251219_cca_and_pass2_schema.sql
```

---

## Related Documents

- [ADR-022: County Capability Asset](../adr/ADR-022-county-capability-asset.md)
- [ADR-023: CCA and Pass 2 Schema Separation](../adr/ADR-023-cca-pass2-schema-separation.md)
- [Lovable Schema Reference](../LOVABLE_SCHEMA_REFERENCE.md)
