#!/bin/bash
# ==============================================================================
# VAULT GUARDIAN: Vault Write Pattern Enforcement
# ==============================================================================
# Doctrine: All Neon vault writes MUST go through:
#   - promoteXxxToVault() functions (explicit promotion)
#   - logXxxToVault() functions (Pass 3 vault logging)
#
# Direct insertVaultRecord/updateVaultRecord calls outside these patterns
# are violations.
# ==============================================================================

set -e

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  VAULT GUARDIAN: Checking Vault Write Patterns                        ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Files allowed to call insertVaultRecord directly
# - NeonAdapter.ts: Definition file
# - ToVault: Promotion/logging functions (promoteXxxToVault, logXxxToVault)
# - promote: Promotion functions
# - pass3/design_hub/spokes: Pass 3 vault loggers (contain logXxxToVault functions)
ALLOWED_PATTERNS="NeonAdapter.ts|ToVault|promote|pass3/design_hub/spokes"

# Find violations
VIOLATIONS=$(grep -rn "insertVaultRecord\|updateVaultRecord" src/ 2>/dev/null | grep -vE "$ALLOWED_PATTERNS" || true)

if [ -n "$VIOLATIONS" ]; then
    echo "❌ VIOLATION DETECTED: Direct vault write found"
    echo ""
    echo "Vault writes MUST use one of these patterns:"
    echo "  - promoteXxxToVault() - Explicit promotion from staging"
    echo "  - logXxxToVault()     - Pass 3 vault logging"
    echo ""
    echo "Direct insertVaultRecord/updateVaultRecord calls are FORBIDDEN."
    echo ""
    echo "Violations found:"
    echo "─────────────────────────────────────────────────────────────────────────"
    echo "$VIOLATIONS"
    echo "─────────────────────────────────────────────────────────────────────────"
    echo ""
    exit 1
else
    echo "✅ Vault Write Pattern: COMPLIANT"
    echo "   All vault writes use approved patterns"
    echo ""
fi
