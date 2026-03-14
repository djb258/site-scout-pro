# CLAUDE.md — Barton Storage System

## IDENTITY

This is a **child repo** that CONFORMS to imo-creator doctrine. All templates, structures, and rules derive from the parent.

**Authority**: Hub (CC-02)
**Sovereign**: barton-family-office (CC-01)
**Hub ID**: barton-storage
**Purpose**: Self-storage investment analysis and deal screening pipeline
**Doctrine Version**: 3.5.0

---

## THREE-TIER LOADING

| Tier | Files | When |
|------|-------|------|
| **1 — Mandatory** | `IMO_CONTROL.json`, `CC_OPERATIONAL_DIGEST.md`, `CLAUDE.md` | Every session start |
| **2 — On Demand** | `DOCTRINE.md`, `REGISTRY.yaml`, `doctrine/REPO_DOMAIN_SPEC.md`, `law/IMO_SYSTEM_SPEC.md` | When task requires |
| **3 — Audit Only** | `law/AI_EMPLOYEE_OPERATING_CONTRACT.md`, `law/GUARDSPEC.md`, `law/ai-employee/AI_EMPLOYEE_PROTOCOL.md` | Audit/compliance checks |

---

## PARENT-CHILD RELATIONSHIP

```
imo-creator (PARENT)  ───PULL ONLY───►  barton-storage (CHILD)

• Parent is SOURCE OF TRUTH for all doctrine and templates
• Child PULLS updates from parent
• Child NEVER pushes changes to parent
• Doctrine changes MUST originate in parent repo
```

| Direction | Allowed | Action |
|-----------|---------|--------|
| Parent → Child | YES | Pull template updates |
| Child → Parent | **NEVER** | Do not push doctrine changes upstream |

---

## CANONICAL REFERENCE

This repo conforms to imo-creator templates at the following versions:

| Template | imo-creator Path | Version |
|----------|------------------|---------|
| Architecture | templates/doctrine/ARCHITECTURE.md | 2.1.0 |
| Execution Surface | templates/doctrine/EXECUTION_SURFACE_LAW.md | 1.0.0 |
| CTB Registry | templates/doctrine/CTB_REGISTRY_ENFORCEMENT.md | 1.5.0 |
| Fail-Closed CI | templates/doctrine/FAIL_CLOSED_CI_CONTRACT.md | 1.1.0 |
| Tools | templates/integrations/TOOLS.md | 1.1.0 |
| OSAM | templates/semantic/OSAM.md | 1.1.0 |
| PRD | templates/prd/PRD_HUB.md | 1.0.0 |
| ADR | templates/adr/ADR.md | 1.0.0 |
| Checklist | templates/checklists/HUB_COMPLIANCE.md | 1.0.0 |
| Snap-On Toolbox | templates/SNAP_ON_TOOLBOX.yaml | 1.0.0 |

---

## GOVERNANCE FILES

| File | Purpose | Status |
|------|---------|--------|
| `IMO_CONTROL.json` | Structural governance contract | ACTIVE |
| `REGISTRY.yaml` | Hub component registry | ACTIVE |
| `DOCTRINE.md` | Doctrine conformance declaration | ACTIVE |
| `CC_OPERATIONAL_DIGEST.md` | Operational rules digest | ACTIVE |
| `STARTUP_PROTOCOL.md` | Session startup sequence | ACTIVE |
| `DOCTRINE_CHECKPOINT.yaml` | Doctrine freshness tracking | ACTIVE |
| `HUB_DESIGN_DECLARATION.yaml` | Hub-and-Spoke Setup declaration | DRAFT |
| `CONSTANTS_VARIABLES_BLOCK.md` | Transformation Law compliance | ACTIVE |
| `doctrine/REPO_DOMAIN_SPEC.md` | Repository domain specification | ACTIVE |
| `BARTON_STORAGE_SYSTEM_CONSTITUTION.md` | Business doctrine | LOCKED |
| `heir.doctrine.yaml` | HEIR compliance configuration | ACTIVE |
| `doppler.yaml` | Secrets management config | ACTIVE |

---

## CTB STRUCTURE

```
src/
├── sys/      ← System infrastructure (config, bootstraps, env)
├── data/     ← Data layer (schemas, queries, migrations, repositories)
├── app/      ← Application logic (services, workflows)
├── ai/       ← AI components (agents, prompts)
└── ui/       ← User interface (components, pages, hooks)
```

**Forbidden folders**: `utils/`, `helpers/`, `common/`, `shared/`, `lib/`, `misc/`

---

## IMO STRUCTURE

| Layer | Purpose | Contains Logic? |
|-------|---------|-----------------|
| **I - Ingress** | UI forms, API endpoints, webhooks | NO |
| **M - Middle** | Pass pipeline (0-5), scoring, decisions | YES |
| **O - Egress** | Reports, exports, Obsidian sync | NO |

---

## TOOL LEDGER

| Tool | ADR | Purpose | Tier |
|------|-----|---------|------|
| Census API | ADR-001 | Demographics data | FREE |
| Google Places API | ADR-002 | Location data | CHEAP |
| Scoring Engine | ADR-003 | Pass scoring | INTERNAL |
| Regrid API | ADR-004 | Zoning data | SURGICAL |
| Retell AI | ADR-005 | Voice calls | SURGICAL |
| Feasibility Engine | ADR-006 | Financial modeling | INTERNAL |
| Verdict Engine | ADR-007 | Go/No-Go decisions | INTERNAL |
| Google Trends API | ADR-008 | Market signals | FREE |
| Firecrawl | ADR-009 | Web scraping | CHEAP |
| Unit Mix Optimizer | ADR-010 | Unit planning | INTERNAL |
| Build Cost Calculator | ADR-011 | Cost estimation | INTERNAL |
| IRR Calculator | ADR-012 | Financial returns | INTERNAL |
| FEMA Flood API | ADR-014 | Flood zone data | FREE |
| USGS DEM API | ADR-015 | Elevation data | FREE |
| Neon Database | ADR-016 | PostgreSQL vault/archive | CHEAP |
| CF D1/KV | — | Working database + state | CHEAP |
| CF R2 | — | File storage | CHEAP |
| CF Workers | — | Compute + hosting | CHEAP |

---

## PASS PIPELINE

| Pass | Purpose | PRD |
|------|---------|-----|
| Pass 0 | Signal radar, ZIP scoring | PRD_PASS0_RADAR_HUB.md |
| Pass 1 | Market structure, demographics | PRD_PASS1_STRUCTURE_HUB.md |
| Pass 1.5 | Rent reconciliation | PRD_PASS15_RENT_RECON_HUB.md |
| Pass 2 | Underwriting, jurisdiction | PRD_PASS2_UNDERWRITING_HUB.md |
| Pass 3 | Design, feasibility | PRD_PASS3_DESIGN_HUB.md |
| Pass 4 | Parcel evaluation | (pending) |
| Pass 5 | Deal gate | (pending) |

---

## WHAT CLAUDE CODE CAN DO

| Action | Permitted |
|--------|-----------|
| Read all files | YES |
| Edit source code in CTB branches | YES |
| Create new components/pages/hooks | YES |
| Add new ADRs (follow template) | YES |
| Run builds and tests | YES |
| Query Neon vault (read) | YES |
| Query CF D1/KV (read) | YES |

---

## WHAT CLAUDE CODE CANNOT DO

| Action | Prohibited | Reason |
|--------|------------|--------|
| Modify locked doctrine files | NO | Doctrine source — pull only from parent |
| Push changes to imo-creator repo | **NEVER** | Child cannot modify parent |
| Modify `BARTON_STORAGE_SYSTEM_CONSTITUTION.md` | NO | Business law — human only |
| Create forbidden folders | NO | CTB violation |
| Add tools without ADR | NO | Tool doctrine |
| Use LLM as primary decision maker | NO | LLM is tail, not head |
| DROP tables without approval | NO | DBA doctrine |
| Push to main without PR | NO | Governance |

---

## SECRETS MANAGEMENT

Secrets are managed via Doppler:

| Project | Config | Status |
|---------|--------|--------|
| barton-storage | dev | ACTIVE |

**Never commit secrets to repo. Use `doppler run --` prefix.**

---

## DRIFT DETECTION

If you detect drift from imo-creator templates:

1. **Flag it** — Report the specific drift
2. **Do NOT "fix" by modifying templates** — Templates are correct
3. **Recommend conformance** — Child must adapt to parent
4. **Log in Master Error Log format** — If doctrine violation

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-01-25 |
| Last Modified | 2026-03-14 |
| Doctrine Version | 3.5.0 |
| Status | ACTIVE |
| Authority | barton-family-office (CC-01) |
