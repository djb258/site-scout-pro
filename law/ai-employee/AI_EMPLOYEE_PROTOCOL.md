# AI Employee Protocol

**Authority**: imo-creator (Constitutional)
**Version**: 1.0.0
**Status**: ACTIVE
**Purpose**: Operational protocol for AI employees working within IMO-governed repositories

---

> **Every AI agent MUST follow this protocol. No exceptions. No interpretation.**

---

## §1 — Repository Detection

When an AI Employee opens a repository, execute this detection sequence:

### Step 1: Check for IMO_CONTROL.json

```
IF IMO_CONTROL.json exists at repo root:
    → This is a GOVERNED repository
    → Load Three-Tier system
    → Follow all protocol rules below

IF IMO_CONTROL.json does NOT exist:
    → This is an UNGOVERNED repository
    → Standard operation (no doctrine rules apply)
    → STOP reading this protocol
```

### Step 2: Determine Repo Type

```
IF repo name == "imo-creator":
    → PARENT repo — READ ONLY for doctrine
    → Do NOT modify any LOCKED files

ELSE:
    → CHILD repo — operate under governance
    → Load Tier 1 files immediately
```

### Step 3: Load Tier 1 (Mandatory)

| File | Purpose | On Missing |
|------|---------|------------|
| `IMO_CONTROL.json` | Identity + governance contract | HALT — repo not properly bootstrapped |
| `CC_OPERATIONAL_DIGEST.md` | All operational rules | HALT — cannot operate safely |
| `CLAUDE.md` | AI permissions + repo-specific rules | WARN — proceed with caution |

---

## §2 — Metrics Sync

### Doctrine Checkpoint

Before any work, verify `DOCTRINE_CHECKPOINT.yaml`:

| Check | Action |
|-------|--------|
| File exists | Proceed to freshness check |
| File missing | Create from template, fill fields |
| `last_verified` > 24 hours ago | Refresh — ask what work is planned |
| `last_verified` < 24 hours ago | Proceed |
| Any field has `[PLACEHOLDER]` | Fill before proceeding |

### Version Check

| Check | Action |
|-------|--------|
| Child doctrine version matches parent | Proceed |
| Child doctrine version < parent | WARN — sync recommended |
| Parent not accessible | WARN — proceed with local doctrine |

---

## §3 — Task Acceptance

### The Five Gates

Before accepting ANY task, verify these gates IN ORDER:

| Gate | Check | On Fail |
|------|-------|---------|
| G1 — Identity | Is the hub/sub-hub identified? | ASK — "Which hub does this belong to?" |
| G2 — CTB Placement | Is the target CTB branch clear? | ASK — "Which branch: sys, data, app, ai, ui?" |
| G3 — Transformation | Can this be stated as CONST → VAR? | ASK — "What does this transform?" |
| G4 — Authority | Is this within CC-04 scope? | ESCALATE — if CC-03 or above, ask human |
| G5 — Tooling | Are all required tools approved? | CHECK — verify against tool ledger |

### Gate Failure Response

```
G1 fails → Cannot proceed. Identity is required for all work.
G2 fails → Cannot proceed. Files have nowhere to go.
G3 fails → Cannot proceed. Work must serve transformation.
G4 fails → Escalate to human. Beyond AI authority.
G5 fails → Request ADR for unapproved tools.
```

---

## §4 — Execution Protocol

### Before Writing Code

| Step | Action |
|------|--------|
| 1 | Verify DOCTRINE_CHECKPOINT.yaml is current |
| 2 | Identify target CTB branch |
| 3 | Check if PRD exists for this work |
| 4 | Check if ADR exists for any tools needed |
| 5 | Verify no forbidden folders will be created |

### While Writing Code

| Rule | Enforcement |
|------|-------------|
| Stay in declared CTB branch | Do not create files outside target branch |
| Respect IMO layers | Logic in M only, validation in I, read-only in O |
| Use approved tools only | Check tool ledger before any new dependency |
| No junk drawer folders | Never create utils/, helpers/, common/, shared/, lib/, misc/ |
| Log decisions | Comment non-obvious architectural choices |

### After Writing Code

| Step | Action |
|------|--------|
| 1 | Verify all files are in correct CTB branch |
| 2 | Verify no forbidden folders created |
| 3 | Verify no logic in I or O layers |
| 4 | Verify no secrets in committed files |
| 5 | Update DOCTRINE_CHECKPOINT.yaml if needed |

---

## §5 — Progress Reporting

### Report Events

| Event | Format | To Whom |
|-------|--------|---------|
| Task started | `[STARTED] Task description` | Console |
| Milestone | `[MILESTONE] What was completed` | Console |
| Blocked | `[BLOCKED] What blocks progress` | Human |
| Violation detected | `[VIOLATION] Type, file, line` | Human |
| Task completed | `[COMPLETED] Summary of changes` | Console |
| Task failed | `[FAILED] What went wrong, what was tried` | Human |

### Escalation Protocol

| Severity | Response Time | Action |
|----------|---------------|--------|
| CRITICAL (violation) | Immediate | STOP work, report to human |
| HIGH (blocked) | Immediate | Report to human, wait for guidance |
| MEDIUM (question) | Next interaction | Ask human at next opportunity |
| LOW (suggestion) | End of task | Include in completion report |

---

## §6 — FAIL HARD Protocol

### Conditions That Trigger FAIL HARD

| Condition | Response |
|-----------|----------|
| Action cannot be traced to CONST → VAR transformation | STOP — untraceable work is invalid |
| Action would create a new source of truth | STOP — sources of truth are declared, not created |
| Action violates CTB placement | STOP — relocate before continuing |
| Action missing `derived_from` reference | STOP — all artifacts must cite their source |
| Action's PASS owner is not declared | STOP — every check must have an owner |

### FAIL HARD Response

```
1. STOP all work immediately
2. DO NOT attempt to fix the violation
3. Report the exact violation with:
   - What was attempted
   - Which FAIL HARD condition triggered
   - What file/line is involved
4. Wait for human guidance
5. Do NOT resume until human approves
```

---

## §7 — Completion Protocol

### Task Completion Checklist

Before declaring a task complete:

| Check | Required |
|-------|----------|
| All files in correct CTB branch | YES |
| No forbidden folders created | YES |
| No logic in I or O layers | YES |
| No tools in spokes | YES |
| No secrets in committed files | YES |
| DOCTRINE_CHECKPOINT.yaml updated | YES |
| Changes serve declared transformation | YES |
| All new dependencies have ADRs | YES |

### Completion Report Format

```
[COMPLETED] Task: <description>
  Files modified: <count>
  Files created: <count>
  CTB branch: <branch>
  Hub/Sub-hub: <id>
  Transformation served: <CONST → VAR statement>
  Violations: <none | list>
  Notes: <any observations>
```

---

## §8 — Autonomy Levels

| Level | Name | Permitted Actions | Human Interaction |
|-------|------|-------------------|-------------------|
| 0 | Supervised | Read only, suggest changes | Every action approved |
| 1 | Guided | Read + write within CTB | Major decisions approved |
| 2 | Autonomous | Full CC-04 operations | Report on completion |
| 3 | Trusted | CC-04 + draft CC-03 artifacts | Report on completion |

### Default Level

AI Employees start at **Level 1 (Guided)** unless explicitly promoted by human.

### Level Promotion

| From → To | Required |
|-----------|----------|
| 0 → 1 | Human says "you can make changes" |
| 1 → 2 | Human says "go ahead and implement" |
| 2 → 3 | Human explicitly grants CC-03 draft access |

### Level Demotion

| Trigger | Action |
|---------|--------|
| Any CRITICAL violation | Demote to Level 0 immediately |
| Two HIGH violations in one session | Demote one level |
| Human request | Immediate |

---

## §9 — Emergency Procedures

### Kill Switch

If the AI Employee detects any of these conditions, STOP ALL WORK:

| Condition | Action |
|-----------|--------|
| About to delete governance files | STOP — these are protected |
| About to push to parent repo | STOP — child never pushes to parent |
| About to commit secrets | STOP — rotate and report |
| About to create structural change at CC-04 | STOP — escalate to CC-02 |
| Infinite loop detected | STOP — report and wait |
| Cost threshold approaching | STOP — report to human |

### Recovery

After a kill switch event:

1. Report what triggered the stop
2. Do NOT attempt to continue the task
3. Wait for human assessment
4. Human decides: resume, modify, or abandon

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-03-14 |
| Last Modified | 2026-03-14 |
| Version | 1.0.0 |
| Status | ACTIVE |
| Authority | imo-creator (CC-01 Sovereign) |
