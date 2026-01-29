# CLAUDE.md — Barton Storage System

## IDENTITY

This is a **child repo** that CONFORMS to imo-creator doctrine. All templates, structures, and rules derive from the parent.

**Authority**: Hub (CC-02)
**Sovereign**: barton-family-office (CC-01)
**Hub ID**: barton-storage
**Purpose**: Self-storage investment analysis and deal screening pipeline

---

## PARENT-CHILD RELATIONSHIP

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         DATA FLOW DIRECTION                                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   imo-creator (PARENT)  ───PULL ONLY───►  barton-storage (CHILD)             ║
║                                                                               ║
║   • Parent is SOURCE OF TRUTH for all doctrine and templates                 ║
║   • Child PULLS updates from parent                                          ║
║   • Child NEVER pushes changes to parent                                     ║
║   • Doctrine changes MUST originate in parent repo                           ║
║                                                                               ║
║   LOCAL COPY: imo_creator/templates/                                         ║
║   This folder is a READ-ONLY copy of parent templates.                       ║
║   Update by: git fetch imo-creator master && checkout templates              ║
║                                                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

| Direction | Allowed | Action |
|-----------|---------|--------|
| Parent → Child | ✅ YES | Pull template updates |
| Child → Parent | 🚨 **NEVER** | Do not push doctrine changes upstream |

**If you need to change doctrine**: Make the change in imo-creator first, then pull to child repos.

---

## CANONICAL REFERENCE

This repo conforms to imo-creator templates at the following versions:

| Template | imo-creator Path | Version |
|----------|------------------|---------|
| Doctrine | templates/doctrine/CANONICAL_ARCHITECTURE_DOCTRINE.md | 1.4.0 |
| Hub-Spoke | templates/doctrine/HUB_SPOKE_ARCHITECTURE.md | 1.1.0 |
| Descent | templates/doctrine/ALTITUDE_DESCENT_MODEL.md | 1.1.0 |
| Tools | templates/integrations/TOOLS.md | 1.1.0 |
| PRD | templates/prd/PRD_HUB.md | 1.0.0 |
| ADR | templates/adr/ADR.md | 1.0.0 |
| Checklist | templates/checklists/HUB_COMPLIANCE.md | 1.0.0 |
| Snap-On Toolbox | templates/SNAP_ON_TOOLBOX.yaml | 1.0.0 |

**If imo-creator updates a template version, this repo must update or be NON-COMPLIANT.**

---

## GOVERNANCE FILES

| File | Purpose | Status |
|------|---------|--------|
| `IMO_CONTROL.json` | Structural governance contract | ACTIVE |
| `heir.doctrine.yaml` | HEIR compliance configuration | ACTIVE |
| `doppler.yaml` | Secrets management config | ACTIVE |
| `BARTON_STORAGE_SYSTEM_CONSTITUTION.md` | Business doctrine | LOCKED |

---

## CTB STRUCTURE

This repo follows the Christmas Tree Backbone (CTB) structure:

```
src/
├── sys/      ← System infrastructure (config, bootstraps, env)
├── data/     ← Data layer (integrations, scrapers, repositories)
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

All tools in this hub are registered with ADRs:

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
| Neon Database | ADR-016 | PostgreSQL storage | CHEAP |
| Supabase | ADR-017 | Auth + realtime | CHEAP |

---

## PASS PIPELINE

| Pass | Purpose | PRD | Checklist |
|------|---------|-----|-----------|
| Pass 0 | Signal radar, ZIP scoring | PRD_PASS0_RADAR_HUB.md | PASS0_RADAR_HUB_COMPLIANCE.md |
| Pass 1 | Market structure, demographics | PRD_PASS1_STRUCTURE_HUB.md | PASS1_STRUCTURE_HUB_COMPLIANCE.md |
| Pass 1.5 | Rent reconciliation | PRD_PASS15_RENT_RECON_HUB.md | PASS15_RENT_RECON_HUB_COMPLIANCE.md |
| Pass 2 | Underwriting, jurisdiction | PRD_PASS2_UNDERWRITING_HUB.md | PASS2_UNDERWRITING_HUB_COMPLIANCE.md |
| Pass 3 | Design, feasibility | PRD_PASS3_DESIGN_HUB.md | PASS3_DESIGN_HUB_COMPLIANCE.md |
| Pass 4 | Deal gate (pending) | — | — |
| Pass 5 | Execution (pending) | — | — |

---

## WHAT CLAUDE CODE CAN DO

| Action | Permitted |
|--------|-----------|
| Read all files | ✅ YES |
| Edit source code in CTB branches | ✅ YES |
| Create new components/pages/hooks | ✅ YES |
| Add new ADRs | ✅ YES (follow template) |
| Run builds and tests | ✅ YES |
| Query Neon database (read) | ✅ YES |
| Query Supabase (read) | ✅ YES |

---

## WHAT CLAUDE CODE CANNOT DO

| Action | Prohibited | Reason |
|--------|------------|--------|
| Modify `imo_creator/templates/` folder | ❌ NO | Doctrine source - pull only from parent |
| Push changes to imo-creator repo | 🚨 **NEVER** | Child cannot modify parent |
| Modify `BARTON_STORAGE_SYSTEM_CONSTITUTION.md` | ❌ NO | Business law - human only |
| Create forbidden folders | ❌ NO | CTB violation |
| Add tools without ADR | ❌ NO | Tool doctrine |
| Use LLM as primary decision maker | ❌ NO | LLM is tail, not head |
| DROP Neon tables without approval | ❌ NO | DBA doctrine |
| Push to main without PR | ❌ NO | Governance |

**CRITICAL**: The `imo_creator/` folder is a LOCAL COPY of the parent repo's templates. To update it:
1. Fetch from parent: `git fetch imo-creator master`
2. Checkout templates: `git checkout imo-creator/master -- templates/`
3. Move to correct location: `mv templates/* imo_creator/templates/`
4. Commit as "sync from upstream"

**NEVER create changes in this repo and push them to imo-creator.**

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
| Last Modified | 2026-01-25 |
| Doctrine Version | 1.4.0 |
| Status | ACTIVE |
| Authority | barton-family-office (CC-01) |
