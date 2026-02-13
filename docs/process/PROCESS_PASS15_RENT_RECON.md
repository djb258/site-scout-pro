# PROCESS: Pass 1.5 — Rent Reconciliation

## Conformance

| Field | Value |
|-------|-------|
| Doctrine Version | 2.0.0 |
| CTB Version | 2.0.0 |
| CC Layer | CC-04 |
| Governing Hub | barton-storage (CC-02) |
| Governing Context | pass15-rent-recon (CC-03) |

## Identity

| Field | Value |
|-------|-------|
| Process ID | PROC-PASS15-RENT-RECON |
| Pass | Pass 1.5 |
| Purpose | Collect and verify competitor rate evidence before underwriting |
| Governing PRD | docs/prd/PRD_PASS15_RENT_RECON_HUB.md |
| Governing ERD | docs/erd/ERD_SubHub1_Market.md |
| Governing OSAM | docs/semantic/OSAM_BARTON_STORAGE.md |

---

## Transformation Summary

> This process executes the transformation of **competitor facility list from Pass 1** into **verified rate evidence and coverage confidence scores for Pass 2**.

---

## Constants (Inputs)

| # | Constant | Source | Type |
|---|----------|--------|------|
| 1 | OpportunityObject | Pass 1 output (pass1_results) | object |
| 2 | Competitor facility list | competitor_facilities (Supabase) | object[] |
| 3 | Aggregator platform rates | SpareFoot API, SelfStorage.com | JSON |
| 4 | Direct website pricing | Firecrawl web scraping | HTML/JSON |
| 5 | Phone-verified rates | Retell AI voice calls | audio/transcript |

## Variables (Outputs)

| # | Variable | Destination | Type |
|---|----------|-------------|------|
| 1 | Verified unit rates by size | facility_unit_pricing (Supabase) | object[] |
| 2 | Rate coverage percentage | pass_1_5_gap_queue (Supabase) | number (%) |
| 3 | Gap resolution status | pass_1_5_attempt_log (Supabase) | enum |
| 4 | Confidence score | pass1_results (Supabase, updated) | number (0-100) |
| 5 | Normalized rate benchmarks | facility_unit_pricing (Supabase) | object |
| 6 | Promotion/discount data | facility_unit_pricing (Supabase) | object[] |

---

## Pass Sequence

### CAPTURE (Ingress)

Receive constants from external sources:
1. Load competitor list from Pass 1 output
2. Query aggregator platforms (SpareFoot, SelfStorage.com) for published rates
3. Scrape competitor websites directly via Firecrawl for rate pages
4. Deploy Retell AI voice caller for facilities with missing rates
5. Log all collection attempts to `pass_1_5_attempt_log`

### COMPUTE (Middle)

Transform constants into variables:
1. **Rate Matching**: Match scraped rates to known unit sizes (5x5, 10x10, 10x15, 10x20, 10x30)
2. **Rate Normalization**: Standardize rates to monthly, remove promotion distortion
3. **Gap Detection**: Identify facilities with missing size tiers
4. **Gap Resolution**: Dispatch remediation workers (AI caller, secondary scrape, manual queue)
5. **Coverage Calculation**: Compute percentage of facilities with verified rates
6. **Confidence Scoring**: Score based on coverage %, source quality, recency

### GOVERN (Egress)

Emit governed variables:
1. Validate minimum rate coverage threshold (80% of facilities)
2. Verify rate normalization (no outliers beyond 3 sigma)
3. Write verified rates to `facility_unit_pricing`
4. Update gap queue status in `pass_1_5_gap_queue`
5. Write attempt log to `pass_1_5_attempt_log`
6. Emit confidence score for Pass 2 consumption
7. Log process execution to `process_log`

---

## Tool Binding (Optional)

| Tool | ADR | Pass Implemented |
|------|-----|-----------------|
| Firecrawl | ADR-009 | CAPTURE |
| Retell AI | ADR-005 | CAPTURE |
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

**VALID** — This process can be summarized as: "This process executes the transformation of competitor facility list into verified rate evidence and coverage confidence scores."

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-02-13 |
| Last Modified | 2026-02-13 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authority | barton-family-office (CC-01) |
