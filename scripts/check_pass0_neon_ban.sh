#!/bin/bash
# ============================================================================
# PASS 0 NEON BAN CHECK
# ============================================================================
#
# This script FAILS the build if any file under /src/pass0/** contains:
# - Imports of Neon client libraries (@neondatabase/serverless)
# - References to NeonAdapter
# - References to database credentials or vault-related env vars
#
# DOCTRINE: Pass 0 Radar Hub CANNOT write to Neon under any condition.
#           This is a hard architectural constraint, not a guideline.
#
# ============================================================================

set -e

echo "=============================================="
echo "PASS 0 NEON BAN CHECK"
echo "=============================================="
echo ""

VIOLATIONS=0
PASS0_DIR="src/pass0"

# Check if pass0 directory exists
if [ ! -d "$PASS0_DIR" ]; then
    echo "WARN: $PASS0_DIR directory not found. Skipping check."
    exit 0
fi

echo "Scanning $PASS0_DIR for Neon violations..."
echo ""

# Pattern 1: Direct Neon imports
echo "Checking for @neondatabase imports..."
NEON_IMPORTS=$(grep -r "@neondatabase" "$PASS0_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -n "$NEON_IMPORTS" ]; then
    echo "VIOLATION: @neondatabase import found in Pass 0:"
    echo "$NEON_IMPORTS"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Pattern 2: NeonAdapter references
echo "Checking for NeonAdapter references..."
NEON_ADAPTER=$(grep -r "NeonAdapter" "$PASS0_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -n "$NEON_ADAPTER" ]; then
    echo "VIOLATION: NeonAdapter reference found in Pass 0:"
    echo "$NEON_ADAPTER"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Pattern 3: neonAdapter (lowercase instance)
echo "Checking for neonAdapter instance references..."
NEON_ADAPTER_INSTANCE=$(grep -r "neonAdapter" "$PASS0_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -n "$NEON_ADAPTER_INSTANCE" ]; then
    echo "VIOLATION: neonAdapter instance found in Pass 0:"
    echo "$NEON_ADAPTER_INSTANCE"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Pattern 4: Neon connection string env vars
echo "Checking for Neon connection string references..."
NEON_ENV=$(grep -rE "(NEON_|DATABASE_URL|POSTGRES_)" "$PASS0_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -n "$NEON_ENV" ]; then
    echo "VIOLATION: Neon/Postgres environment variable reference found in Pass 0:"
    echo "$NEON_ENV"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Pattern 5: Direct vault table references
echo "Checking for vault table references..."
VAULT_REFS=$(grep -rE "(vault|VAULT)" "$PASS0_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "README" | grep -v "\.md" || true)
if [ -n "$VAULT_REFS" ]; then
    # Filter out false positives (comments, etc.)
    REAL_VAULT=$(echo "$VAULT_REFS" | grep -E "from.*vault|import.*vault|\.vault|VAULT\." || true)
    if [ -n "$REAL_VAULT" ]; then
        echo "VIOLATION: Vault reference found in Pass 0:"
        echo "$REAL_VAULT"
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
fi

# Pattern 6: saveToVault function calls
echo "Checking for saveToVault function calls..."
SAVE_VAULT=$(grep -r "saveToVault" "$PASS0_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -n "$SAVE_VAULT" ]; then
    echo "VIOLATION: saveToVault call found in Pass 0:"
    echo "$SAVE_VAULT"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

echo ""
echo "=============================================="

if [ $VIOLATIONS -gt 0 ]; then
    echo "FAILED: $VIOLATIONS Neon violation(s) found in Pass 0"
    echo ""
    echo "Pass 0 Radar Hub CANNOT access Neon database."
    echo "This is a hard architectural constraint."
    echo ""
    echo "See: src/pass0/radar_hub/README.md"
    echo "See: src/shared/data_layer/adapters/NeonAdapter.ts"
    exit 1
else
    echo "PASSED: No Neon violations in Pass 0"
    exit 0
fi
