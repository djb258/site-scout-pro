# Enforcement Rules Doctrine

**Authority**: CONSTITUTIONAL
**Version**: 1.0.0
**Status**: ACTIVE

---

## Purpose

This document defines the **zero-tolerance enforcement rules** for all audits, checklists, and compliance attestations across the IMO-Creator system. These rules are **NON-NEGOTIABLE** and apply to all child repositories.

---

## Core Principle

> **You cannot claim compliance you do not have.**
> **A failure is a failure. Mark it. Fix it. Then mark it passed.**
> **There is no "mostly compliant." There is no "good enough."**

---

## Status Indicators

### For Checklists

| Symbol | Meaning | Ship Status |
|--------|---------|-------------|
| `[x]` | Item verified and compliant | OK to ship |
| `[ ]` | Item NOT verified or NOT compliant | 🚨 **BLOCKS SHIP** |

### For Audits and Attestations

| Symbol | Meaning | Action Required |
|--------|---------|-----------------|
| `[x] PASS` | Verified compliant | None |
| `🚨 FAIL` | Failed verification | **MUST FIX** |
| `[ ] N/A` | Not applicable | Document why |

---

## The Five Enforcement Rules

### Rule 1: No False Passes

You **CANNOT** mark an item as checked/passed unless:
- The item has been **actually verified** (not assumed)
- The verification shows **compliance** (not partial)
- **Evidence exists** (code, file, test result, screenshot)

**Marking a failing item as passed is a doctrine violation.**

```
WRONG: "I think this is probably fine" → [x]
RIGHT: "I verified file X exists and contains Y" → [x]
RIGHT: "File X is missing" → [ ] + document in violations
```

### Rule 2: Failures Block Ship

Any unchecked item or `🚨 FAIL` status means:
- The hub is **NON-COMPLIANT**
- The hub **CANNOT SHIP**
- Remediation is **REQUIRED**

**There are NO exceptions for CRITICAL items.**

### Rule 3: Partial Is Fail

| Scenario | Status |
|----------|--------|
| 4/4 items pass | `[x] PASS` |
| 3/4 items pass | `🚨 FAIL` |
| 1/4 items pass | `🚨 FAIL` |
| 0/4 items pass | `🚨 FAIL` |

**Partial compliance = Non-compliance. Fix ALL items.**

### Rule 4: Document All Failures

Every failure MUST be documented with:

| Field | Required | Description |
|-------|----------|-------------|
| Violation ID | YES | Unique identifier |
| Description | YES | What failed |
| Category | YES | Which section/rule |
| Severity | YES | CRITICAL/HIGH/MEDIUM |
| Remediation | YES | What must be done to fix |
| Target Date | Recommended | When it will be fixed |
| Owner | Recommended | Who is responsible |

### Rule 5: Re-Audit After Fix

After fixing a failure:
1. **Re-run** the specific verification
2. **Confirm** the fix resolves the issue
3. **Update** the status to PASS
4. **Document** the resolution date

**Do NOT change status without re-verification.**

---

## Severity Levels

| Severity | Symbol | Meaning | Can Ship? |
|----------|--------|---------|-----------|
| **CRITICAL** | 🚨 | Fundamental doctrine violation | **NEVER** |
| **HIGH** | ⚠️ | Significant operational risk | Only with ADR exception |
| **MEDIUM** | ℹ️ | Should fix before prod | Yes, but document |
| **LOW** | 📝 | Nice to have | Yes |

### Escalation Rules

- **CRITICAL failures** require immediate attention — no other work until resolved
- **3+ HIGH failures** in same hub escalate to CRITICAL status
- **Unresolved failures > 7 days** escalate one severity level
- **Repeated failures** (same issue 3+ times) escalate to next level

---

## Red Flags (Automatic FAIL)

The following conditions are **immediate 🚨 FAIL**:

| Red Flag | Why It's Critical | Section |
|----------|-------------------|---------|
| No PRD exists | CC-02 violation | §A.2 |
| No ERD exists | Structural proof missing | §A.3 |
| Forbidden folder exists | CTB violation | §B.3 |
| Logic in I or O layer | IMO violation | §B.4 |
| Tool without ADR | Traceability violation | §B.6 |
| Sideways hub call | Isolation violation | §B.7 |
| No kill switch | Operational safety | §B.9 |
| Secrets in code | Security violation | — |
| Unchecked CRITICAL item | Compliance violation | — |

---

## Audit Trail Requirements

Every audit MUST record:

| Field | Purpose |
|-------|---------|
| Audit Date | When verification occurred |
| Auditor | Who performed verification |
| Evidence | What was checked |
| Result | PASS or FAIL |
| Notes | Additional context |

**Audits without trails are INVALID.**

---

## Compliance Reporting Format

### Passing Report

```
Part A: Constitutional Validity
  §A.1 [x] PASS | §A.2 [x] PASS | §A.3 [x] PASS
  §A.4 [x] PASS | §A.5 [x] PASS | §A.6 [x] PASS

Part A Status: 6/6 COMPLETE ✅

OVERALL: COMPLIANT ✅
```

### Failing Report

```
Part A: Constitutional Validity
  §A.1 [x] PASS | §A.2 🚨 FAIL | §A.3 [x] PASS
  §A.4 [x] PASS | §A.5 [x] PASS | §A.6 [x] PASS

Part A Status: 5/6 🚨 BLOCKED

OVERALL: NON-COMPLIANT 🚨
REMEDIATION REQUIRED: See Violations Table
```

---

## Prohibited Behaviors

The following are **DOCTRINE VIOLATIONS**:

| Behavior | Why It's Prohibited |
|----------|---------------------|
| Checking boxes without verification | False compliance claim |
| Marking partial as pass | Misrepresents state |
| Skipping CRITICAL items | Safety bypass |
| Shipping with known failures | Operational risk |
| Hiding failures in notes | Audit evasion |
| Removing failed items from checklist | Evidence tampering |
| "We'll fix it later" without documentation | Uncommitted remediation |

---

## AI/Agent Enforcement

When AI agents perform audits:

1. **Same rules apply** — AI cannot mark false passes
2. **Must show evidence** — AI must cite what was verified
3. **Must document failures** — AI must log all failures found
4. **Cannot skip items** — AI must evaluate all checklist items
5. **Cannot ship with failures** — AI cannot approve non-compliant hubs

---

## Human Override

Human override is permitted ONLY when:
- Override is documented in an ADR
- Override has explicit sovereign (CC-01) approval
- Override does not bypass CRITICAL safety items
- Override has an expiration date

**Override without documentation is a doctrine violation.**

---

## Final Declaration

> **Compliance is binary: PASS or FAIL.**
> **There is no "mostly compliant."**
> **There is no "good enough."**
> **There is no "we'll fix it later."**
> **Fix failures. Document. Re-verify. Then ship.**

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-01-29 |
| Authority | CONSTITUTIONAL |
| Applies To | All IMO-Creator child repositories |
| References | HUB_COMPLIANCE.md, CONSTITUTIONAL_AUDIT_ATTESTATION.md |
| Change Protocol | Requires ADR + Sovereign (CC-01) Approval |
