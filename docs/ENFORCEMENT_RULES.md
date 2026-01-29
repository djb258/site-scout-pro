# Enforcement Rules

**Authority**: CONSTITUTIONAL
**Version**: 1.0.0
**Status**: ACTIVE

---

## Purpose

This document defines the enforcement rules for all audits, checklists, and compliance attestations in this hub. These rules are **NON-NEGOTIABLE**.

---

## Core Principle

> **You cannot claim compliance you do not have.**
> **A failure is a failure. Mark it. Fix it. Then mark it passed.**

---

## Status Indicators

### For Checklists

| Symbol | Meaning | Ship Status |
|--------|---------|-------------|
| `[x]` | Item verified and compliant | OK to ship |
| `[ ]` | Item NOT verified or NOT compliant | **BLOCKS SHIP** |

### For Audits and Attestations

| Symbol | Meaning | Action Required |
|--------|---------|-----------------|
| `[x] PASS` | Verified compliant | None |
| `🚨 FAIL` | Failed verification | **MUST FIX** |
| `[ ] N/A` | Not applicable | Document why |

---

## Enforcement Policy

### Rule 1: No False Passes

You **CANNOT** mark an item as checked/passed unless:
- The item has been actually verified
- The verification shows compliance
- Evidence exists (code, file, test result)

**Marking a failing item as passed is a doctrine violation.**

### Rule 2: Failures Block Ship

Any unchecked item or `🚨 FAIL` status means:
- The hub is **NON-COMPLIANT**
- The hub **CANNOT SHIP**
- Remediation is **REQUIRED**

There are no exceptions for CRITICAL items.

### Rule 3: Partial Is Fail

| Scenario | Status |
|----------|--------|
| 4/4 items pass | `[x] PASS` |
| 3/4 items pass | `🚨 FAIL` |
| 0/4 items pass | `🚨 FAIL` |

Partial compliance = Non-compliance. Fix all items.

### Rule 4: Document All Failures

Every failure must be documented with:

| Field | Required |
|-------|----------|
| Violation ID | Yes |
| Description | Yes |
| Category | Yes |
| Severity | Yes |
| Remediation Required | Yes |
| Target Date | Recommended |
| Owner | Recommended |

### Rule 5: Re-Audit After Fix

After fixing a failure:
1. Re-run the specific verification
2. Confirm the fix resolves the issue
3. Update the status to PASS
4. Document the resolution date

**Do not change status without re-verification.**

---

## Severity Levels

| Severity | Symbol | Meaning | Can Ship? |
|----------|--------|---------|-----------|
| CRITICAL | 🚨 | Fundamental violation | **NEVER** |
| HIGH | ⚠️ | Significant risk | Only with ADR exception |
| MEDIUM | ℹ️ | Should fix | Yes, but document |
| LOW | 📝 | Nice to have | Yes |

### Escalation Rules

- **CRITICAL failures** require immediate attention
- **3+ HIGH failures** escalate to CRITICAL status
- **Unresolved failures > 7 days** escalate one severity level

---

## Audit Trail Requirements

Every audit must record:

| Field | Purpose |
|-------|---------|
| Audit Date | When verification occurred |
| Auditor | Who performed verification |
| Evidence | What was checked |
| Result | PASS or FAIL |
| Notes | Additional context |

**Audits without trails are invalid.**

---

## Checklist Completion Rules

### Before Marking Complete

1. Read the check requirement carefully
2. Verify the requirement is met (don't assume)
3. Check for evidence (file exists, code works, test passes)
4. Mark the checkbox only after verification

### After Finding a Failure

1. Leave the checkbox unchecked
2. Add the failure to the violations table
3. Assign severity and remediation
4. Do NOT proceed to ship

### After Fixing a Failure

1. Re-verify the requirement
2. Confirm fix is complete
3. Mark the checkbox
4. Update the violations table (mark resolved)
5. Note the resolution date

---

## Red Flags

The following are immediate `🚨 FAIL` conditions:

| Red Flag | Why It's Critical |
|----------|-------------------|
| No PRD exists | CC-02 violation |
| No ERD exists | Structural proof missing |
| Forbidden folder exists | CTB violation |
| Logic in I or O layer | IMO violation |
| Tool without ADR | Traceability violation |
| Sideways hub call | Isolation violation |
| No kill switch | Operational safety |
| Secrets in code | Security violation |

---

## Compliance Summary Format

When reporting compliance:

```
Part A: Constitutional Validity
  §A.1 [x] PASS | §A.2 [x] PASS | §A.3 [x] PASS
  §A.4 [x] PASS | §A.5 [x] PASS | §A.6 [x] PASS

Part A Status: 6/6 COMPLETE ✅

Part B: Operational Compliance
  §B.1 [x] PASS | §B.2 [x] PASS | §B.3 [x] PASS
  §B.4 [x] PASS | §B.5 [x] PASS | §B.6 [x] PASS
  §B.7 [x] PASS | §B.8 [x] PASS | §B.9 [x] PASS
  §B.10 [x] PASS | §B.11 [x] PASS

Part B Status: 11/11 COMPLETE ✅

OVERALL: COMPLIANT ✅
```

If ANY item fails:

```
Part A: Constitutional Validity
  §A.1 [x] PASS | §A.2 🚨 FAIL | §A.3 [x] PASS
  §A.4 [x] PASS | §A.5 [x] PASS | §A.6 [x] PASS

Part A Status: 5/6 🚨 BLOCKED

OVERALL: NON-COMPLIANT 🚨
REMEDIATION REQUIRED: See Violations Table
```

---

## Final Declaration

> **Compliance is binary: PASS or FAIL.**
> **There is no "mostly compliant."**
> **There is no "good enough."**
> **Fix failures. Then ship.**

---

## Document Control

| Field | Value |
|-------|-------|
| Created | 2026-01-29 |
| Authority | CONSTITUTIONAL |
| References | HUB_COMPLIANCE.md, CONSTITUTIONAL_AUDIT_ATTESTATION.md |
| Change Protocol | Requires ADR + Human Approval |
