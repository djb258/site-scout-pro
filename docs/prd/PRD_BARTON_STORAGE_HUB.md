# PRD — Barton Storage Hub

## Conformance

| Field | Value |
|-------|-------|
| **Doctrine Version** | 2.0.0 |
| **CTB Version** | 2.0.0 |
| **CC Layer** | CC-02 |
| **Governing Hub** | barton-storage (CC-02) |
| **CTB Governance** | templates/config/CTB_GOVERNANCE.md |

---

## HSS — Hub-and-Spoke Set Up

| Field | Value |
|-------|-------|
| HSS Source | HUB_DESIGN_DECLARATION.yaml |
| HSS Status | DRAFT |
| Hub Name | Barton Storage System |
| Hub ID | barton-storage |

---

## 1. Sovereign Reference (CC-01)

| Field | Value |
|-------|-------|
| **Sovereign ID** | barton-family-office |
| **Sovereign Boundary** | Barton Family Office investment systems |

---

## 2. Hub Identity (CC-02)

| Field | Value |
|-------|-------|
| **Hub Name** | Barton Storage System |
| **Hub ID** | barton-storage |
| **Owner** | Barton Family Office |
| **Version** | 1.0.0 |

---

## 3. Purpose & Transformation Declaration

This hub screens self-storage investment opportunities through a progressive pass pipeline, eliminating unviable sites at each stage.

### Transformation Statement (REQUIRED)

| Field | Value |
|-------|-------|
| **Transformation Summary** | This system transforms market signals, demographic data, zoning constraints, and site characteristics into investment verdicts, feasibility scores, and deal recommendations. |

### Constants (Inputs)

| Constant | Source | Description |
|----------|--------|-------------|
| Market signals | Google Trends, permits, news | Momentum indicators for storage demand |
| Demographics | Census API | Population, income, housing data by geography |
| Zoning data | Regrid API | Parcel zoning classifications and restrictions |
| Flood zones | FEMA API | Flood risk designations |
| Elevation data | USGS DEM API | Terrain slope and grade |
| Competitor rents | Firecrawl, manual | Current market rental rates |
| Parcel geometry | County GIS | Lot dimensions, shape, access |

### Variables (Outputs)

| Variable | Destination | Description |
|----------|-------------|-------------|
| Signal scores | Pass 0 tables | ZIP-level momentum scores |
| Market metrics | Pass 1 tables | Saturation, supply gap, demand indicators |
| Reconciled rents | Pass 1.5 tables | Validated, normalized rent data |
| Jurisdiction scores | Pass 2 tables | Regulatory difficulty ratings |
| Feasibility verdicts | Pass 3 tables | Financial viability assessments |
| Site viability | Pass 4 tables | Parcel-level screening results |
| Deal recommendations | Pass 5 tables | Go/No-Go investment decisions |

### Pass Structure

| Pass | Type | IMO Layer | Description |
|------|------|-----------|-------------|
| Pass 0 | CAPTURE | I (Ingress) | Ingest market signals, score ZIP momentum |
| Pass 1 | COMPUTE | M (Middle) | Analyze demographics, calculate market saturation |
| Pass 1.5 | COMPUTE | M (Middle) | Reconcile and validate competitor rent data |
| Pass 2 | COMPUTE | M (Middle) | Evaluate zoning, permits, jurisdiction difficulty |
| Pass 3 | COMPUTE | M (Middle) | Model financials, unit mix, construction costs |
| Pass 4 | COMPUTE | M (Middle) | Screen individual parcels for viability |
| Pass 5 | GOVERN | O (Egress) | Apply decision rules, emit Go/No-Go verdict |

### Scope Boundary

| Scope | Description |
|-------|-------------|
| **IN SCOPE** | Site screening, market analysis, rent reconciliation, zoning feasibility, financial modeling, investment verdicts |
| **OUT OF SCOPE** | Construction management, property acquisition, tenant management, facility operations, legal documents |

---

## 4. CTB Placement

| Field | Value | CC Layer |
|-------|-------|----------|
| **Trunk** | barton-family-office | CC-02 |
| **Branch** | investments | CC-02 |
| **Leaf** | storage | CC-02 |

---

## 5. IMO Structure (CC-02)

| Layer | Role | Description | CC Layer |
|-------|------|-------------|----------|
| **I — Ingress** | Dumb input only | UI dashboard, API intake, webhook receivers | CC-02 |
| **M — Middle** | Logic, decisions, state | Pass pipeline (0-5), scoring engines, decision logic | CC-02 |
| **O — Egress** | Output only | Reports, Obsidian export, notifications | CC-02 |

---

## 6. Spokes (CC-03 Interfaces)

| Spoke Name | Type | Direction | Contract | CC Layer |
|------------|------|-----------|----------|----------|
| ui-dashboard | I | Inbound | React UI for pipeline interaction | CC-03 |
| api-intake | I | Inbound | Supabase Edge Functions for ingestion | CC-03 |
| obsidian-export | O | Outbound | Markdown export to knowledge vault | CC-03 |
| report-generator | O | Outbound | Deal package and analysis reports | CC-03 |

---

## 7. Constants vs Variables

| Element | Type | Mutability | CC Layer |
|---------|------|------------|----------|
| Hub ID | Constant | Immutable | CC-02 |
| Hub Name | Constant | ADR-gated | CC-02 |
| Pass sequence | Constant | ADR-gated | CC-02 |
| Scoring thresholds | Variable | Configuration | CC-03 |
| API rate limits | Variable | Configuration | CC-03 |

---

## 8. Tools

| Tool | Solution Type | CC Layer | IMO Layer | ADR Reference |
|------|---------------|----------|-----------|---------------|
| Census API | Deterministic | CC-02 | M | ADR-001 |
| Google Places API | Deterministic | CC-02 | M | ADR-002 |
| Scoring Engine | Deterministic | CC-02 | M | ADR-003 |
| Regrid API | Deterministic | CC-02 | M | ADR-004 |
| Retell AI | LLM-tail | CC-02 | M | ADR-005 |
| Feasibility Engine | Deterministic | CC-02 | M | ADR-006 |
| Verdict Engine | Deterministic | CC-02 | M | ADR-007 |
| Google Trends API | Deterministic | CC-02 | M | ADR-008 |
| Firecrawl | Deterministic | CC-02 | M | ADR-009 |
| Unit Mix Optimizer | Deterministic | CC-02 | M | ADR-010 |
| Build Cost Calculator | Deterministic | CC-02 | M | ADR-011 |
| IRR Calculator | Deterministic | CC-02 | M | ADR-012 |
| FEMA Flood API | Deterministic | CC-02 | M | ADR-014 |
| USGS DEM API | Deterministic | CC-02 | M | ADR-015 |
| Neon Database | Deterministic | CC-02 | M | ADR-016 |
| Supabase | Deterministic | CC-02 | M | ADR-017 |

---

## 9. Guard Rails

| Guard Rail | Type | Threshold | CC Layer |
|------------|------|-----------|----------|
| API rate limit | Rate Limit | 60 calls/min | CC-03 |
| AI rate limit | Rate Limit | 10 calls/min | CC-03 |
| Default timeout | Timeout | 30,000 ms | CC-04 |
| AI call timeout | Timeout | 120,000 ms | CC-04 |

---

## 10. Kill Switch

| Field | Value |
|-------|-------|
| **Activation Criteria** | Cost exceeds $100/day, Error rate exceeds 10%, Manual trigger by sovereign |
| **Trigger Authority** | CC-01 (Sovereign) |
| **Emergency Contact** | barton-family-office |

---

## 11. Promotion Gates

| Gate | Artifact | CC Layer | Requirement |
|------|----------|----------|-------------|
| G1 | PRD | CC-02 | Hub definition approved |
| G2 | ADR | CC-03 | Architecture decision recorded |
| G3 | Work Item | CC-04 | Execution item created |
| G4 | PR | CC-04 | Code reviewed and merged |
| G5 | Checklist | CC-04 | Compliance verification complete |

---

## 12. Failure Modes

| Failure | Severity | CC Layer | Remediation |
|---------|----------|----------|-------------|
| API timeout | MEDIUM | CC-04 | Retry with backoff |
| Rate limit exceeded | LOW | CC-04 | Queue and defer |
| Database connection lost | HIGH | CC-04 | Failover to read replica |
| Kill switch activated | CRITICAL | CC-02 | Manual intervention required |

---

## 13. PID Scope (CC-04)

| Field | Value |
|-------|-------|
| **PID Pattern** | `barton-storage-${TIMESTAMP}-${RANDOM_HEX}` |
| **Retry Policy** | New PID per retry |
| **Audit Trail** | Required |

---

## 14. Human Override Rules

| Condition | Override Authority | Approval Required |
|-----------|-------------------|-------------------|
| Kill switch activation | CC-01 (Sovereign) | Yes |
| Pass bypass | CC-02 (Hub Owner) | Yes |
| Scoring threshold change | CC-02 (Hub Owner) | ADR |

---

## 15. Observability

| Type | Description | CC Layer |
|------|-------------|----------|
| **Logs** | All pass executions, API calls, errors | CC-04 |
| **Metrics** | Pass completion rates, API latency, error rates | CC-04 |
| **Alerts** | Kill switch triggers, error rate thresholds | CC-03 |

---

## Approval

| Role | Name | Date |
|------|------|------|
| Sovereign (CC-01) | Barton Family Office | |
| Hub Owner (CC-02) | | |
| Reviewer | | |

---

## Traceability

| Artifact | Reference |
|----------|-----------|
| Canonical Doctrine | ARCHITECTURE.md v2.0.0 |
| Hub/Spoke Geometry | ARCHITECTURE.md Part IV |
| Registry | REGISTRY.yaml |
| Domain Spec | doctrine/REPO_DOMAIN_SPEC.md |
| Governing OSAM | docs/semantic/OSAM_BARTON_STORAGE.md |
| OSAM Version | DRAFT |
| Governing ERD | docs/erd/ERD_SubHub*.md |
| Governing Process | docs/process/ |

---

## OSAM Compliance Declaration

| Field | Value |
|-------|-------|
| Governing OSAM | docs/semantic/OSAM_BARTON_STORAGE.md |
| OSAM Version | DRAFT |
| All tables declared in OSAM | [ ] Verified |
| No undeclared joins | [ ] Verified |

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-01-25 |
| Last Modified | 2026-02-13 |
| Version | 2.0.0 |
| Status | ACTIVE |
| Authority | barton-family-office (CC-01) |
