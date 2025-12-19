# ADR-025: Vault Guardian Doctrine

**Status:** Accepted
**Date:** 2025-12-19
**Deciders:** Barton Enterprises Engineering Team
**Doctrine ID:** SS.DL.03

---

## Context

The Storage Site Scout application uses a hybrid database architecture:
- **Supabase**: Working storage, staging, scratchpad for Pass 0-2
- **Neon**: Permanent vault for validated, promoted records

Prior to this ADR, there was ambiguity about which passes could read/write to Neon. The codebase had violations where Pass 2 was directly reading from and writing to Neon, bypassing the staging layer.

## Decision

We establish the **Vault Guardian Doctrine**: Neon is a VAULT that accepts ONLY promoted, validated, immutable records.

### Core Principles

```
+-----------------------------------------------------------------------+
|                                                                       |
|  NEON IS A VAULT                                                      |
|                                                                       |
|  A vault does not:                                                    |
|    - Fetch                                                            |
|    - Scrape                                                           |
|    - Infer                                                            |
|    - Calculate                                                        |
|    - Enrich                                                           |
|    - Normalize                                                        |
|    - Decide                                                           |
|                                                                       |
|  A vault only accepts:                                                |
|    - Promoted records                                                 |
|    - Validated records                                                |
|    - Immutable records                                                |
|    - Records with provenance                                          |
|                                                                       |
|  If you are unsure whether something belongs in Neon:                 |
|    IT DOES NOT.                                                       |
|                                                                       |
|  Enforce this. No exceptions.                                         |
|                                                                       |
+-----------------------------------------------------------------------+
```

### Allowed NeonAdapter Consumers

| Consumer | Permission | Purpose |
|----------|------------|---------|
| Pass 3 Design Hub | WRITE via `logXxxToVault()` | Vault logging of calculation results |
| Vault promotion functions | WRITE via `promoteXxxToVault()` | Explicit promotion from staging |
| save_to_vault edge function | WRITE | Final vault persistence |
| CCA Service | READ/WRITE | `ref.county_capability` management |

### Forbidden NeonAdapter Consumers

| Consumer | Ban Type | Alternative |
|----------|----------|-------------|
| Pass 0 Radar Hub | **HARD BAN** | Edge-only, no persistence |
| Pass 1 Structure Hub | FORBIDDEN | Use Supabase |
| Pass 1.5 Rent Recon Hub | FORBIDDEN | Use Supabase |
| Pass 2 Underwriting Hub | FORBIDDEN | Use Supabase staging |
| UI Components | FORBIDDEN | Read-only via API |

### Data Flow

```
Cloud Functions → Supabase Staging → Validation → Promotion → Neon Vault
                      ↑                              ↑
                 Pass 0-2                    promoteXxxToVault()
                 work here                   functions ONLY
```

### Pass 2 Staging Pattern

Pass 2 reads and writes to Supabase staging tables:

```typescript
// CORRECT: Pass 2 reads from Supabase staging
const supabase = getSupabase();
const { data } = await supabase
  .from('staging_jurisdiction_card_drafts')
  .select('*')
  .eq('county_id', countyId)
  .in('status', ['validated', 'pending'])
  .maybeSingle();

// INCORRECT: Pass 2 reading from Neon (FORBIDDEN)
// const record = await neonAdapter.getJurisdictionCard(countyId);
```

### Pass 3 Vault Logging Pattern

Pass 3 receives calculation results from Lovable.dev and logs to vault:

```typescript
// Pass 3 spokes are VAULT LOGGERS only
export async function logDebtModelToVault(
  opportunityId: string,
  result: DebtModelResult
): Promise<DebtModelVaultEntry> {
  await neonAdapter.insertVaultRecord({
    opportunity_id: opportunityId,
    spoke_id: 'SS.03.07',
    spoke_name: 'DebtModel',
    pass_number: 3,
    result_json: result,
    status: 'logged',
  });
  return entry;
}
```

### Promotion Pattern

Data enters Neon vault ONLY via explicit promotion functions:

```typescript
// Promotion function - the ONLY path to vault
export async function promoteJurisdictionCardToVault(
  draftId: string
): Promise<{ promoted: boolean; reason?: string }> {
  // 1. Read from Supabase staging
  // 2. Validate completeness
  // 3. Check no fatal prohibitions
  // 4. Write to Neon vault
  // 5. Mark staging record as promoted
  // 6. Log promotion audit entry
}
```

## CI Enforcement

Three guard scripts enforce the doctrine:

### 1. `scripts/check_neon_consumers.sh`
Verifies Pass 0, 1, 1.5, 2, and UI do not import NeonAdapter.

### 2. `scripts/check_pass2_neon_ban.sh`
Ensures Pass 2 code contains zero Neon references.

### 3. `scripts/check_vault_write_pattern.sh`
Ensures all vault writes use approved patterns (`promoteXxx`, `logXxxToVault`).

## Rationale

1. **Data Integrity**: Staging layer allows validation before permanent storage
2. **Auditability**: All vault entries have provenance and promotion timestamps
3. **Isolation**: Edge functions (Pass 0) are completely isolated from vault
4. **Separation of Concerns**: Collection (Supabase) vs. Storage (Neon)
5. **Reversibility**: Staging data can be rejected without vault pollution

## Consequences

### Positive
- Clear separation between working data and permanent records
- Reduced risk of invalid data entering vault
- Audit trail for all promotions
- CI enforcement prevents regressions

### Negative
- Additional complexity in data flow
- Requires explicit promotion step
- Pass 2 cannot directly query vault (must read from staging)

## Violations Fixed (2025-12-19)

| File | Violation | Fix |
|------|-----------|-----|
| `JurisdictionCardReader.ts` | Imported NeonAdapter, read from Neon | Migrated to Supabase staging |
| `NeonAdapter.ts` | Had `upsertJurisdictionScope()` | Removed |
| `NeonAdapter.ts` | Had `upsertZoningEnvelope()` | Removed |
| `NeonAdapter.ts` | Header listed Pass 1/1.5/2 as allowed | Updated to list only approved consumers |

## Related Documents

- [VAULT_GUARDIAN_REPORT.md](../audits/VAULT_GUARDIAN_REPORT.md) - Full audit report
- [JURISDICTION_CARD_SPEC.md](../specs/JURISDICTION_CARD_SPEC.md) - Card specification
- [ADR-016-neon-database.md](ADR-016-neon-database.md) - Neon database setup
- [ADR-017-supabase-integration.md](ADR-017-supabase-integration.md) - Supabase integration

## Approval

| Role | Name | Date |
|------|------|------|
| Owner | Barton Enterprises | 2025-12-19 |
| Reviewer | Vault Guardian Mode | 2025-12-19 |
