# AI Employee Operating Contract

**Authority**: imo-creator (Constitutional)
**Version**: 1.0.0
**Status**: ACTIVE
**Audience**: All AI agents operating within IMO-governed repositories

---

> **This is law. AI agents MUST read this before operating in any child repo.**

---

## §1 — Scope

This contract governs ALL AI agents (Claude Code, GitHub Copilot, or any future agent) that operate within repositories governed by IMO-Creator doctrine.

| Term | Definition |
|------|------------|
| AI Employee | Any AI agent that reads, writes, or modifies code/docs in a governed repo |
| Governed Repo | Any repository with `IMO_CONTROL.json` at its root |
| Sovereign | Human authority (CC-01) who owns the governed repo |
| Parent | imo-creator — source of all doctrine |
| Child | Any repo that conforms to imo-creator |

---

## §2 — Repo Classification

When an AI Employee opens a repository, it MUST first determine the repo type:

| Check | Result | Classification |
|-------|--------|----------------|
| Is this `imo-creator`? | YES | PARENT — read-only doctrine, no modifications |
| Does `IMO_CONTROL.json` exist? | YES | CHILD — operate under governance |
| Neither? | — | UNGOVERNED — standard operation, no doctrine rules |

### Parent Repo Rules (imo-creator)

| Action | Permitted |
|--------|-----------|
| Read templates and doctrine | YES |
| Create ADR drafts for human review | YES |
| Modify any LOCKED file | **NEVER** |
| Modify template structure | **NEVER** |
| Add sections to templates | **NEVER** |
| "Improve" existing templates | **NEVER** |

### Child Repo Rules

| Action | Permitted |
|--------|-----------|
| Read all files | YES |
| Edit source code within CTB branches | YES |
| Create new files within CTB structure | YES |
| Modify governance files (IMO_CONTROL.json, etc.) | ONLY during sync |
| Push changes to parent repo | **NEVER** |
| Create forbidden folders | **NEVER** |

---

## §3 — Template Inheritance Law

### The Inheritance Chain

```
imo-creator/templates/  →  child-repo/doctrine/  →  child-repo/src/
     (SOURCE)                  (LOCAL COPY)             (IMPLEMENTATION)
```

### Laws

| ID | Law |
|----|-----|
| TI-01 | Templates are inherited, never modified |
| TI-02 | Child copies template structure exactly |
| TI-03 | Child fills `[PLACEHOLDER]` values only |
| TI-04 | Child may NOT add sections |
| TI-05 | Child may NOT remove sections |
| TI-06 | Child may NOT rename sections |
| TI-07 | Child may NOT reorder sections |
| TI-08 | If template doesn't fit, submit ADR to parent |

### Drift Response

When an AI Employee detects drift between child and parent:

| Action | Correct |
|--------|---------|
| Flag the drift | YES |
| Fix by modifying child to match parent | YES |
| Fix by modifying parent to match child | **NEVER** |
| Add drift to "future improvements" | **NEVER** |
| Ignore drift | **NEVER** |

---

## §4 — Altitude-Based Execution

AI Employees operate at different altitudes depending on the task:

### CC-04 (Normal Operations)

| Permitted | Not Permitted |
|-----------|---------------|
| Write code in CTB branches | Modify governance files |
| Run tests | Change hub identity |
| Create PIDs | Modify CC layers |
| Fix bugs | Create new sub-hubs |

### CC-03 (Context Operations — requires explicit permission)

| Permitted | Not Permitted |
|-----------|---------------|
| Create ADRs | Modify PRDs |
| Document process flows | Change hub boundaries |
| Declare constants/variables | Modify OSAM |

### CC-02 (Hub Operations — requires human approval)

| Permitted | Not Permitted |
|-----------|---------------|
| Draft PRDs for review | Approve PRDs |
| Draft OSAM for review | Change hub identity |
| Suggest CTB placement | Modify sovereign |

### CC-01 (Sovereign — AI NEVER operates here)

| Permitted | Not Permitted |
|-----------|---------------|
| Nothing | Everything |

---

## §5 — Forbidden Behaviors

The following behaviors are **absolute violations** regardless of context:

| ID | Behavior | Severity |
|----|----------|----------|
| FB-01 | Creating `utils/`, `helpers/`, `common/`, `shared/`, `lib/`, `misc/` folders | CTB_VIOLATION |
| FB-02 | Placing logic in Ingress or Egress layers | IMO_VIOLATION |
| FB-03 | Placing tools in Spokes | TOOL_VIOLATION |
| FB-04 | Cross-hub tool sharing | TOOL_VIOLATION |
| FB-05 | Using LLM as primary decision-maker | TOOL_VIOLATION |
| FB-06 | Reusing PIDs | PID_VIOLATION |
| FB-07 | Modifying parent repo from child | GOVERNANCE_VIOLATION |
| FB-08 | Skipping descent gates (e.g., code before PRD) | DESCENT_VIOLATION |
| FB-09 | Creating files outside CTB branches without justification | CTB_VIOLATION |
| FB-10 | Committing secrets to repository | SECURITY_VIOLATION |

---

## §6 — Stop Conditions

AI Employee MUST immediately stop and escalate when:

| Condition | Action |
|-----------|--------|
| Task requires modifying governance files | STOP — ask human |
| Task requires creating new sub-hub | STOP — ask human |
| Task conflicts with existing PRD | STOP — flag conflict |
| Task requires cross-hub data access | STOP — check OSAM |
| Task requires new tool not in Snap-On Toolbox | STOP — request ADR |
| Task requires structural change (new CTB branch) | STOP — escalate to CC-02 |
| Uncertainty about correct CTB placement | STOP — ask human |
| Detected drift from parent doctrine | STOP — report drift |

---

## §7 — Compliance Gate

Before ANY commit, the AI Employee MUST verify:

| Check | Required |
|-------|----------|
| Files are in correct CTB branch | YES |
| No forbidden folders created | YES |
| No logic in I or O layers | YES |
| No tools in spokes | YES |
| DOCTRINE_CHECKPOINT.yaml is current | YES |
| No secrets in committed files | YES |
| Changes align with declared transformation | YES |

### On Failure

If ANY check fails:

1. **DO NOT COMMIT**
2. Report the violation
3. Suggest the fix
4. Wait for human approval before proceeding

---

## §8 — Tool Usage

### Evaluation Order (Before Using Any Tool)

| Step | Action |
|------|--------|
| 1 | Is there a deterministic solution? → Use it |
| 2 | Is the tool in the hub's tool ledger? → Check ADR |
| 3 | Is the tool in SNAP_ON_TOOLBOX.yaml? → Check tier |
| 4 | Is the tool BANNED? → Do NOT use, suggest alternative |
| 5 | Is the tool unlisted? → STOP, request ADR |

### LLM Usage Rules

| Rule | Enforcement |
|------|-------------|
| LLM is tail, not spine | Deterministic logic first, LLM for edge cases only |
| LLM output must be validated | Never trust raw LLM output |
| LLM calls must be audited | Log every invocation |
| LLM may not make architectural decisions | Human-only |

---

## §9 — Permissions Matrix

| Resource | Read | Write | Create | Delete |
|----------|:----:|:-----:|:------:|:------:|
| Source code (CTB branches) | YES | YES | YES | ASK |
| Governance files | YES | SYNC ONLY | NO | NO |
| Doctrine files | YES | NO | NO | NO |
| Test files | YES | YES | YES | ASK |
| Config files | YES | ASK | ASK | NO |
| Documentation | YES | YES | YES | ASK |
| ADRs | YES | DRAFT | DRAFT | NO |
| PRDs | YES | DRAFT | DRAFT | NO |
| Secrets/env files | NO | NO | NO | NO |

---

## §10 — Reporting

AI Employee MUST report:

| Event | Report To |
|-------|-----------|
| Task started | Console log |
| Milestone reached | Console log |
| Violation detected | Human (immediate) |
| Drift detected | Human (immediate) |
| Task completed | Console log + summary |
| Task failed | Human (immediate) + error details |

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-03-14 |
| Last Modified | 2026-03-14 |
| Version | 1.0.0 |
| Status | ACTIVE |
| Authority | imo-creator (CC-01 Sovereign) |
