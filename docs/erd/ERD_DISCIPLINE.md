# ERD Discipline Enforcement

> **Authority:** IMO_CONTROL.json (CONSTITUTIONAL)  
> **CC Layer:** CC-03 (Context Artifacts)  
> **Status:** EXECUTABLE LAW

## Purpose

This document establishes mandatory rules for ERD maintenance and database schema changes.

---

## Rule 1: No Migration Without ERD

**No table creation or migration may occur without a corresponding ERD entry.**

Before any database migration:
1. Identify which sub-hub owns the table
2. Update the corresponding `ERD_SubHubX.md` file
3. Update the corresponding `ERD_SubHubX.mermaid` file
4. Only then create the migration

Violations will be detected by CI guards.

---

## Rule 2: ERD Must Match Reality

**Each ERD must map cleanly to existing database tables.**

- Every table listed in an ERD must exist in the database
- Every table in the database must appear in exactly one ERD (as WRITE owner)
- Column names, types, and relationships must match

---

## Rule 3: Mismatch Detection Protocol

**If a mismatch is detected between ERD and database:**

1. **STOP** — Do not proceed with any changes
2. **REPORT** — Document the mismatch in detail
3. **DO NOT AUTO-CORRECT** — Wait for human instruction

Mismatches require explicit resolution, not silent fixes.

---

## Rule 4: ERDs Are CC-03 Artifacts

ERDs are Context-level artifacts under the Altitude Descent Model.

- Modification requires ADR approval (CC-03 gate)
- No ERD changes during CC-04 (implementation) work
- ERD changes must precede related code changes

---

## Rule 5: Cross-Hub Ownership

**A table may have exactly one WRITE owner.**

- The owning sub-hub has WRITE authority
- All other sub-hubs have READ-ONLY access
- Cross-hub writes are forbidden
- If ownership is unclear → STOP and escalate

---

## Rule 6: ERD Contents

Each ERD file must contain ONLY:

✅ Tables owned by that sub-hub  
✅ Primary keys  
✅ Foreign keys  
✅ Cardinality relationships  
✅ Ownership annotations (WRITE / READ-ONLY)

❌ No workflows  
❌ No calculations  
❌ No speculative tables  
❌ No business logic descriptions  
❌ No cross-hub ownership

---

## Enforcement Mechanism

Future CI guards will:
1. Parse all `docs/erd/*.mermaid` files
2. Compare against database schema
3. Block PRs that introduce schema changes without ERD updates
4. Block PRs that modify ERDs without ADR reference

---

## Violations

| Violation | Consequence |
|-----------|-------------|
| Migration without ERD | PR blocked |
| ERD/schema mismatch | PR blocked |
| Cross-hub WRITE declared | PR blocked |
| ERD modified without ADR | Warning (escalate) |

---

## Success Criteria

The system is compliant when:

- ✅ Every sub-hub has an ERD
- ✅ Every database table appears in exactly one ERD (as WRITE)
- ✅ ERDs match actual database schema
- ✅ No ambiguous ownership
- ✅ CI guards are active (future)
