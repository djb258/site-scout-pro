# PROCESS: Pass 3 — Design & Feasibility

## Conformance

| Field | Value |
|-------|-------|
| Doctrine Version | 2.0.0 |
| CTB Version | 2.0.0 |
| CC Layer | CC-04 |
| Governing Hub | barton-storage (CC-02) |
| Governing Context | pass3-design (CC-03) |

## Identity

| Field | Value |
|-------|-------|
| Process ID | PROC-PASS3-DESIGN |
| Pass | Pass 3 |
| Purpose | Detailed pro forma modeling and financial analysis for GO/MAYBE sites |
| Governing PRD | docs/prd/PRD_PASS3_DESIGN_HUB.md |
| Governing ERD | docs/erd/ERD_SubHub3_Calculators.md |
| Governing OSAM | docs/semantic/OSAM_BARTON_STORAGE.md |

---

## Transformation Summary

> This process executes the transformation of **underwriting package from Pass 2** into **complete pro forma package with financial projections, construction costs, and investment returns**.

---

## Constants (Inputs)

| # | Constant | Source | Type |
|---|----------|--------|------|
| 1 | Underwriting package | Pass 2 output (pass2_results) | object |
| 2 | Parcel geometry | Regrid API / Pass 2 cache | GeoJSON |
| 3 | Zoning setback requirements | county_card_master (Supabase) | object |
| 4 | Verified market rates | Pass 1.5 output (facility_unit_pricing) | object[] |
| 5 | Construction cost data | Build cost models (internal) | object |
| 6 | Financing parameters | Debt model assumptions | object |
| 7 | Site dimensions | Parcel screening (Neon) | object |

## Variables (Outputs)

| # | Variable | Destination | Type |
|---|----------|-------------|------|
| 1 | Buildable area (post-setback) | solver_results (Supabase) | number (sqft) |
| 2 | Coverage ratio | solver_results (Supabase) | number (%) |
| 3 | Optimized unit mix | solver_results (Supabase) | object[] |
| 4 | Phase plan | solver_results (Supabase) | object[] |
| 5 | Total build cost | solver_results (Supabase) | number ($) |
| 6 | Net operating income (NOI) | solver_results (Supabase) | number ($) |
| 7 | Debt service coverage ratio (DSCR) | solver_results (Supabase) | number |
| 8 | Maximum land price | solver_results (Supabase) | number ($) |
| 9 | Internal rate of return (IRR) | solver_results (Supabase) | number (%) |
| 10 | Investment memo | solver_results (Supabase) | object |

---

## Pass Sequence

### CAPTURE (Ingress)

Receive constants from external sources:
1. Load underwriting package from Pass 2 (GO or MAYBE verdict only)
2. Load parcel geometry and dimensions
3. Load zoning setback requirements from county card
4. Load verified market rates from Pass 1.5
5. Load construction cost parameters (regional adjustments)
6. Load financing assumptions (interest rate, LTV, amortization)

### COMPUTE (Middle)

Transform constants into variables:
1. **SetbackEngine**: Calculate buildable area by subtracting required setbacks from parcel geometry
2. **CoverageEngine**: Determine maximum building footprint within lot coverage limits
3. **UnitMixOptimizer**: Optimize unit mix (5x5 through 10x30) for revenue maximization within buildable area
4. **PhasePlanner**: Plan construction phases if multi-phase development
5. **BuildCostModel**: Estimate total construction cost (foundation, steel, electrical, HVAC, paving)
6. **NOIEngine**: Project net operating income (gross revenue - vacancy - OpEx)
7. **DebtModel**: Calculate debt service and DSCR at target leverage
8. **MaxLandPrice**: Back-solve maximum land acquisition price at target returns
9. **IRRModel**: Calculate 10-year levered IRR with exit cap rate assumptions

### GOVERN (Egress)

Emit governed variables:
1. Validate DSCR meets minimum threshold (1.25x)
2. Validate IRR meets minimum hurdle rate
3. Verify unit mix fits within buildable area
4. Verify build cost within reasonable per-sqft range
5. Write all solver outputs to `solver_results`
6. Generate investment memo
7. Log process execution to `process_log`

---

## Tool Binding (Optional)

| Tool | ADR | Pass Implemented |
|------|-----|-----------------|
| Unit Mix Optimizer | ADR-010 | COMPUTE |
| Build Cost Calculator | ADR-011 | COMPUTE |
| IRR Calculator | ADR-012 | COMPUTE |
| Feasibility Engine | ADR-006 | COMPUTE |
| Verdict Engine | ADR-007 | GOVERN |
| Supabase | ADR-017 | GOVERN |
| Neon Database | ADR-016 | GOVERN |

---

## OSAM Alignment

| Check | Status |
|-------|--------|
| All tables in this process declared in OSAM | [ ] |
| No undeclared joins | [ ] |
| Join key is sovereign_id | [ ] |

---

## Process Validity

**VALID** — This process can be summarized as: "This process executes the transformation of underwriting package into complete pro forma package with financial projections, construction costs, and investment returns."

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-02-13 |
| Last Modified | 2026-02-13 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authority | barton-family-office (CC-01) |
