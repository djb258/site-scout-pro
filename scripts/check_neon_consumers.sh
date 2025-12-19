#!/bin/bash
# ==============================================================================
# VAULT GUARDIAN: NeonAdapter Consumer Enforcement
# ==============================================================================
# Doctrine: Only these consumers may import NeonAdapter:
#   - Pass 3 Design Hub (vault logging)
#   - CCA Service (ref.county_capability)
#   - save_to_vault edge function
#   - Promotion functions (promoteXxxToVault)
#
# FORBIDDEN consumers:
#   - Pass 0 (HARD BAN - edge function)
#   - Pass 1 (use Supabase)
#   - Pass 1.5 (use Supabase)
#   - Pass 2 (use Supabase staging)
#   - UI components (read-only via API)
# ==============================================================================

set -e

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  VAULT GUARDIAN: Checking NeonAdapter Consumers                       ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

VIOLATIONS=0

# Check Pass 0 (exclude markdown files - documentation about the ban is ok)
echo "Checking Pass 0..."
if grep -rq "neonAdapter\|NeonAdapter\|@neondatabase" src/pass0/ --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null; then
    echo "  ❌ VIOLATION: Pass 0 contains Neon references"
    grep -rn "neonAdapter\|NeonAdapter\|@neondatabase" src/pass0/ --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null || true
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "  ✅ Pass 0: Clean"
fi

# Check Pass 1
echo "Checking Pass 1..."
if grep -rq "neonAdapter\|NeonAdapter" src/pass1/ 2>/dev/null; then
    echo "  ❌ VIOLATION: Pass 1 contains Neon references"
    grep -rn "neonAdapter\|NeonAdapter" src/pass1/ 2>/dev/null || true
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "  ✅ Pass 1: Clean"
fi

# Check Pass 1.5
echo "Checking Pass 1.5..."
if grep -rq "neonAdapter\|NeonAdapter" src/pass15/ 2>/dev/null; then
    echo "  ❌ VIOLATION: Pass 1.5 contains Neon references"
    grep -rn "neonAdapter\|NeonAdapter" src/pass15/ 2>/dev/null || true
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "  ✅ Pass 1.5: Clean"
fi

# Check Pass 2
echo "Checking Pass 2..."
if grep -rq "neonAdapter\|NeonAdapter" src/pass2/ 2>/dev/null; then
    echo "  ❌ VIOLATION: Pass 2 contains Neon references"
    grep -rn "neonAdapter\|NeonAdapter" src/pass2/ 2>/dev/null || true
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "  ✅ Pass 2: Clean"
fi

# Check UI
echo "Checking UI..."
if grep -rq "neonAdapter\|NeonAdapter" src/ui/ 2>/dev/null; then
    echo "  ❌ VIOLATION: UI contains Neon references"
    grep -rn "neonAdapter\|NeonAdapter" src/ui/ 2>/dev/null || true
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "  ✅ UI: Clean"
fi

echo ""

if [ "$VIOLATIONS" -gt 0 ]; then
    echo "═══════════════════════════════════════════════════════════════════════"
    echo "❌ FAILED: $VIOLATIONS violation(s) detected"
    echo "═══════════════════════════════════════════════════════════════════════"
    echo ""
    echo "DOCTRINE: Neon is a VAULT. Only Pass 3 and CCA may write."
    echo "FIX: Remove NeonAdapter imports from violating files."
    echo ""
    exit 1
else
    echo "═══════════════════════════════════════════════════════════════════════"
    echo "✅ PASSED: All NeonAdapter consumers are compliant"
    echo "═══════════════════════════════════════════════════════════════════════"
    echo ""
fi
