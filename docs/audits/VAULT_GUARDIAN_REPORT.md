# VAULT GUARDIAN AUDIT REPORT

**Audit Date:** 2025-12-19
**Auditor:** Vault Guardian Mode
**Status:** VIOLATIONS DETECTED

---

## EXECUTIVE SUMMARY

| Category | Count | Severity |
|----------|-------|----------|
| CRITICAL VIOLATIONS | 3 | FAIL HARD |
| DOCTRINE CONFLICTS | 2 | REQUIRES RESOLUTION |
| COMPLIANT PATHS | 9 | APPROVED |

---

## SECTION 1: VIOLATION REPORT

### VIOLATION V-001: Pass 2 Direct Neon Writes

**Severity:** CRITICAL
**Location:** `src/shared/data_layer/adapters/NeonAdapter.ts:371-468`

**Evidence:**
```typescript
// Lines 371-411
async upsertJurisdictionScope(data: {...}): Promise<void> {
  await this.executeRaw(
    `INSERT INTO pass2.jurisdiction_scope (...) VALUES (...)
     ON CONFLICT (county_id) DO UPDATE SET ...`
  );
}

// Lines 416-468
async upsertZoningEnvelope(data: {...}): Promise<void> {
  await this.executeRaw(
    `INSERT INTO pass2.zoning_envelope (...) VALUES (...)
     ON CONFLICT (county_id) DO UPDATE SET ...`
  );
}
```

**Violation:** Pass 2 MUST stage to Supabase, NOT write directly to Neon vault.

**Doctrine Reference:** JURISDICTION_CARD_SPEC.md Section 7.2:
> "NO Neon writes — All writes to Supabase staging tables"

---

### VIOLATION V-002: Pass 2 JurisdictionCardReader Reads from Neon

**Severity:** CRITICAL
**Location:** `src/pass2/underwriting_hub/spokes/JurisdictionCardReader.ts:21, 62`

**Evidence:**
```typescript
// Line 21
import { neonAdapter, JurisdictionCardRecord } from '../../../shared/data_layer/adapters/NeonAdapter';

// Line 62
const record = await neonAdapter.getJurisdictionCard(countyId);
```

**Violation:** Pass 2 spoke is reading directly from Neon vault. Pass 2 should read/write to Supabase staging only. Only Pass 3 should read from Neon.

---

### VIOLATION V-003: NeonAdapter Header Claims Pass 2 Can Write

**Severity:** DOCTRINE CONFLICT
**Location:** `src/shared/data_layer/adapters/NeonAdapter.ts:9-15`

**Evidence:**
```typescript
// Lines 9-15
// THIS ADAPTER MAY ONLY BE USED BY:
// - Pass 1 Structure Hub orchestrator
// - Pass 1.5 Rent Recon Hub orchestrator
// - Pass 2 Underwriting Hub orchestrator (primary consumer)  <-- VIOLATION
// - Pass 3 Design Hub orchestrator
// - save_to_vault edge function
// - CCA Service (for ref.county_capability)
```

**Conflict:** The NeonAdapter explicitly allows Pass 2, but JURISDICTION_CARD_SPEC forbids Pass 2 Neon writes.

---

### VIOLATION V-004: SetbackEngine Previously Read from Neon

**Severity:** RESOLVED (but residual code exists)
**Location:** `src/pass3/design_hub/spokes/SetbackEngine.ts`

**Status:** This was corrected when Pass 3 spokes were converted to vault loggers. The current code is compliant.

---

## SECTION 2: COMPLIANT PATHS (APPROVED)

| File | Operation | Status |
|------|-----------|--------|
| `src/pass3/design_hub/spokes/DebtModel.ts` | Vault write via `logDebtModelToVault()` | ✅ APPROVED |
| `src/pass3/design_hub/spokes/IRRModel.ts` | Vault write via `logIRRModelToVault()` | ✅ APPROVED |
| `src/pass3/design_hub/spokes/NOIEngine.ts` | Vault write via `logNOIToVault()` | ✅ APPROVED |
| `src/pass3/design_hub/spokes/SetbackEngine.ts` | Vault write via `logSetbackToVault()` | ✅ APPROVED |
| `src/pass3/design_hub/spokes/CoverageEngine.ts` | Vault write via `logCoverageToVault()` | ✅ APPROVED |
| `src/pass3/design_hub/spokes/BuildCostModel.ts` | Vault write via `logBuildCostToVault()` | ✅ APPROVED |
| `src/pass3/design_hub/spokes/UnitMixOptimizer.ts` | Vault write via `logUnitMixToVault()` | ✅ APPROVED |
| `src/pass3/design_hub/spokes/PhasePlanner.ts` | Vault write via `logPhasePlanToVault()` | ✅ APPROVED |
| `src/pass3/design_hub/spokes/MaxLandPrice.ts` | Vault write via `logMaxLandPriceToVault()` | ✅ APPROVED |
| `src/cca/service/CcaService.ts` | CCA write to `ref.county_capability` | ✅ APPROVED* |

*CCA writes to `ref` schema which is allowed per doctrine.

---

## SECTION 3: DIFF PLAN

### Fix V-001 & V-002: Remove Pass 2 Neon Paths

#### Step 1: Remove Pass 2 upsert functions from NeonAdapter

```diff
// src/shared/data_layer/adapters/NeonAdapter.ts

- /**
-  * Upsert jurisdiction scope.
-  */
- async upsertJurisdictionScope(data: {...}): Promise<void> {
-   await this.executeRaw(...);
- }
-
- /**
-  * Upsert zoning envelope.
-  */
- async upsertZoningEnvelope(data: {...}): Promise<void> {
-   await this.executeRaw(...);
- }
```

#### Step 2: Update JurisdictionCardReader to use Supabase

```diff
// src/pass2/underwriting_hub/spokes/JurisdictionCardReader.ts

- import { neonAdapter, JurisdictionCardRecord } from '../../../shared/data_layer/adapters/NeonAdapter';
+ import { getSupabase } from '../../../shared/data_layer/ConnectionFactory';

export async function runJurisdictionCardReader(...) {
-   const record = await neonAdapter.getJurisdictionCard(countyId);
+   const supabase = getSupabase();
+   const { data: record } = await supabase
+     .from('staging_jurisdiction_card_drafts')
+     .select('*')
+     .eq('county_id', countyId)
+     .eq('status', 'validated')
+     .maybeSingle();
}
```

#### Step 3: Update NeonAdapter header

```diff
// src/shared/data_layer/adapters/NeonAdapter.ts

// THIS ADAPTER MAY ONLY BE USED BY:
- // - Pass 1 Structure Hub orchestrator
- // - Pass 1.5 Rent Recon Hub orchestrator
- // - Pass 2 Underwriting Hub orchestrator (primary consumer)
+ // - Pass 3 Design Hub orchestrator (VAULT WRITES ONLY)
+ // - Vault promotion functions (promoteXxxToVault)
// - save_to_vault edge function
// - CCA Service (for ref.county_capability)
+
+ // FORBIDDEN CONSUMERS:
+ // - Pass 0 (HARD BAN)
+ // - Pass 1 (use Supabase)
+ // - Pass 1.5 (use Supabase)
+ // - Pass 2 (use Supabase staging)
+ // - UI (read-only via API)
```

#### Step 4: Create Supabase staging table

```sql
-- Create staging table for Pass 2 jurisdiction card drafts
CREATE TABLE IF NOT EXISTS staging.jurisdiction_card_drafts (
  draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_id INTEGER NOT NULL,
  asset_class TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, validated, promoted, rejected
  payload JSONB NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  promoted_at TIMESTAMPTZ,
  rejection_reason TEXT,
  UNIQUE (county_id, asset_class, status)
);
```

#### Step 5: Create explicit promotion function

```typescript
// src/shared/data_layer/promoters/promoteJurisdictionCardToVault.ts

/**
 * PROMOTE JURISDICTION CARD TO VAULT
 *
 * This is the ONLY path for Pass 2 data to enter Neon.
 * Called AFTER validation, NEVER during collection.
 */
export async function promoteJurisdictionCardToVault(
  draftId: string
): Promise<{ promoted: boolean; reason?: string }> {
  // 1. Read from Supabase staging
  // 2. Validate completeness (envelope_complete = true)
  // 3. Check no fatal prohibitions
  // 4. Write to Neon pass2.* tables
  // 5. Mark staging record as promoted
  // 6. Log promotion audit entry
}
```

---

## SECTION 4: CONFIRMATION MATRIX

### Pass 2 Neon Writes

| Check | Status |
|-------|--------|
| Pass 2 has direct Neon INSERT | ❌ VIOLATION FOUND |
| Pass 2 has direct Neon UPDATE | ❌ VIOLATION FOUND |
| Pass 2 has direct Neon SELECT | ❌ VIOLATION FOUND |
| Pass 2 imports NeonAdapter | ❌ VIOLATION FOUND |

**Required State:**
| Check | Required Status |
|-------|-----------------|
| Pass 2 Neon writes | ZERO |
| Pass 2 Neon reads | ZERO |
| Pass 2 NeonAdapter imports | ZERO |

---

### Pass 3 Vault Writes

| Check | Status |
|-------|--------|
| Pass 3 writes via `logXxxToVault()` | ✅ COMPLIANT |
| Pass 3 uses `neonAdapter.insertVaultRecord()` | ✅ COMPLIANT |
| Pass 3 does NOT calculate | ✅ COMPLIANT (vault loggers only) |

---

### UI Read-Only

| Check | Status |
|-------|--------|
| UI imports NeonAdapter | ✅ NOT FOUND |
| UI has Neon writes | ✅ NOT FOUND |
| UI reads from Supabase only | ✅ COMPLIANT |

---

## SECTION 5: CI GUARD RECOMMENDATIONS

### Guard 1: Pass 0 Neon Ban (EXISTING)

**File:** `scripts/check_pass0_neon_ban.sh`

```bash
#!/bin/bash
# Ensure Pass 0 never imports Neon
if grep -r "neonAdapter\|NeonAdapter\|@neondatabase" src/pass0/; then
  echo "FAIL: Pass 0 contains Neon references"
  exit 1
fi
```

### Guard 2: Pass 2 Neon Ban (NEW)

**File:** `scripts/check_pass2_neon_ban.sh`

```bash
#!/bin/bash
# Ensure Pass 2 never writes to Neon
VIOLATIONS=$(grep -rn "neonAdapter\|NeonAdapter" src/pass2/ | grep -v "// ALLOWED:" | wc -l)
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: Pass 2 contains unauthorized Neon references"
  grep -rn "neonAdapter\|NeonAdapter" src/pass2/ | grep -v "// ALLOWED:"
  exit 1
fi
```

### Guard 3: Vault Write Pattern Enforcement (NEW)

**File:** `scripts/check_vault_write_pattern.sh`

```bash
#!/bin/bash
# All Neon writes must be via promote* or log*ToVault functions
VIOLATIONS=$(grep -rn "insertVaultRecord\|updateVaultRecord" src/ | grep -v "promote\|ToVault\|NeonAdapter.ts" | wc -l)
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: Vault writes must use promote*() or log*ToVault() pattern"
  grep -rn "insertVaultRecord\|updateVaultRecord" src/ | grep -v "promote\|ToVault\|NeonAdapter.ts"
  exit 1
fi
```

### Guard 4: GitHub Actions Workflow

**File:** `.github/workflows/vault-guardian.yml`

```yaml
name: Vault Guardian

on: [push, pull_request]

jobs:
  vault-doctrine:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check Pass 0 Neon Ban
        run: ./scripts/check_pass0_neon_ban.sh

      - name: Check Pass 2 Neon Ban
        run: ./scripts/check_pass2_neon_ban.sh

      - name: Check Vault Write Pattern
        run: ./scripts/check_vault_write_pattern.sh

      - name: Verify NeonAdapter Consumers
        run: |
          # Only allowed consumers
          ALLOWED="pass3|cca|save_to_vault|promote"
          VIOLATIONS=$(grep -rn "import.*neonAdapter" src/ | grep -vE "$ALLOWED" | wc -l)
          if [ "$VIOLATIONS" -gt 0 ]; then
            echo "FAIL: Unauthorized NeonAdapter consumers detected"
            exit 1
          fi
```

---

## SECTION 6: FINAL DOCTRINE STATEMENT

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║  NEON IS A VAULT                                                          ║
║                                                                           ║
║  A vault does not:                                                        ║
║    - Fetch                                                                ║
║    - Scrape                                                               ║
║    - Infer                                                                ║
║    - Calculate                                                            ║
║    - Enrich                                                               ║
║    - Normalize                                                            ║
║    - Decide                                                               ║
║                                                                           ║
║  A vault only accepts:                                                    ║
║    - Promoted records                                                     ║
║    - Validated records                                                    ║
║    - Immutable records                                                    ║
║    - Records with provenance                                              ║
║                                                                           ║
║  If you are unsure whether something belongs in Neon:                     ║
║    IT DOES NOT.                                                           ║
║                                                                           ║
║  Enforce this. No exceptions.                                             ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## APPENDIX A: Complete Neon Write Paths (Current State)

| File | Function | Writes To | Status |
|------|----------|-----------|--------|
| `NeonAdapter.ts` | `upsertCcaProfile()` | `ref.county_capability` | ✅ ALLOWED (CCA) |
| `NeonAdapter.ts` | `upsertJurisdictionScope()` | `pass2.jurisdiction_scope` | ❌ VIOLATION |
| `NeonAdapter.ts` | `upsertZoningEnvelope()` | `pass2.zoning_envelope` | ❌ VIOLATION |
| `NeonAdapter.ts` | `insertVaultRecord()` | `vault.opportunities` | ✅ ALLOWED (Vault) |
| `NeonAdapter.ts` | `updateVaultRecord()` | `vault.opportunities` | ✅ ALLOWED (Vault) |
| `Pass3 Spokes` | `logXxxToVault()` | `vault.opportunities` | ✅ ALLOWED (Vault) |
| `CcaService.ts` | `storeProfile()` | `ref.county_capability` | ✅ ALLOWED (CCA) |

---

## APPENDIX B: Required Actions

1. [ ] Remove `upsertJurisdictionScope()` from NeonAdapter
2. [ ] Remove `upsertZoningEnvelope()` from NeonAdapter
3. [ ] Update JurisdictionCardReader to use Supabase
4. [ ] Create `staging.jurisdiction_card_drafts` table
5. [ ] Create `promoteJurisdictionCardToVault()` function
6. [ ] Update NeonAdapter header to reflect true allowed consumers
7. [ ] Add `check_pass2_neon_ban.sh` script
8. [ ] Add `check_vault_write_pattern.sh` script
9. [ ] Update GitHub Actions workflow

---

**Report Complete. Violations must be resolved before deployment.**
