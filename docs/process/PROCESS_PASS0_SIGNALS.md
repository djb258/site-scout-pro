# PROCESS: Pass 0 — Signal Radar

## Conformance

| Field | Value |
|-------|-------|
| Doctrine Version | 2.0.0 |
| CTB Version | 2.0.0 |
| CC Layer | CC-04 |
| Governing Hub | barton-storage (CC-02) |
| Governing Context | pass0-signals (CC-03) |

## Identity

| Field | Value |
|-------|-------|
| Process ID | PROC-PASS0-SIGNALS |
| Pass | Pass 0 |
| Purpose | Aggregate momentum signals and market variables before site-specific analysis |
| Governing PRD | docs/prd/PRD_PASS0_RADAR_HUB.md |
| Governing ERD | docs/erd/ERD_SubHub0_Signals.md |
| Governing OSAM | docs/semantic/OSAM_BARTON_STORAGE.md |

---

## Transformation Summary

> This process executes the transformation of **ZIP codes and news/narrative URLs** into **ZIP-level signal scores and trend indicators**.

---

## Constants (Inputs)

| # | Constant | Source | Type |
|---|----------|--------|------|
| 1 | ZIP code + State | User input / SVA definition | string |
| 2 | News/narrative URLs | pass0_url_queue (Supabase) | string[] |
| 3 | Google Trends keywords | Config (pass0-source-registry.json) | string[] |
| 4 | Permit activity data | Census Building Permits API | JSON |
| 5 | Geographic patterns | Config (pass0-geo-patterns.json) | JSON |

## Variables (Outputs)

| # | Variable | Destination | Type |
|---|----------|-------------|------|
| 1 | Signal strength score | pass0_signals (Supabase) | number (0-100) |
| 2 | Trend direction | pass0_signals (Supabase) | enum (rising/stable/declining) |
| 3 | Search interest index | pass0_signals (Supabase) | number (0-100) |
| 4 | Permit growth rate | pass0_signals (Supabase) | number (%) |
| 5 | Geo-resolved ZIP assignments | pass0_signals (Supabase) | string[] |
| 6 | Data quality indicator | pass0_signals (Supabase) | enum (high/medium/low) |

---

## Pass Sequence

### CAPTURE (Ingress)

Receive constants from external sources:
1. Fetch news/narrative URLs from `pass0_url_queue`
2. Call Google Trends API for storage-related search terms by region
3. Query Census Building Permits API for commercial permit activity
4. Retrieve geographic patterns from `pass0-geo-patterns.json` config

### COMPUTE (Middle)

Transform constants into variables:
1. Parse news content and extract storage-related signals (content parser)
2. Geo-resolve article locations to ZIP codes (geo resolver)
3. Score signal strength based on relevance, recency, and source quality
4. Calculate permit growth rates by county
5. Aggregate search interest indices by ZIP
6. Fuse multi-source signals into composite momentum score

### GOVERN (Egress)

Emit governed variables:
1. Validate all signals have geo-resolution (no orphaned signals)
2. Verify signal scores are within valid range (0-100)
3. Write scored signals to `pass0_signals` table
4. Log process execution to `process_log`
5. Emit data quality indicator for downstream consumers

---

## Tool Binding (Optional)

| Tool | ADR | Pass Implemented |
|------|-----|-----------------|
| Google Trends API | ADR-008 | CAPTURE |
| Firecrawl | ADR-009 | CAPTURE |
| Census API | ADR-001 | CAPTURE |
| Scoring Engine | ADR-003 | COMPUTE |
| Supabase | ADR-017 | GOVERN |

---

## OSAM Alignment

| Check | Status |
|-------|--------|
| All tables in this process declared in OSAM | [ ] |
| No undeclared joins | [ ] |
| Join key is sovereign_id | [ ] |

---

## Process Validity

**VALID** — This process can be summarized as: "This process executes the transformation of ZIP codes and news/narrative URLs into ZIP-level signal scores and trend indicators."

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-02-13 |
| Last Modified | 2026-02-13 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authority | barton-family-office (CC-01) |
