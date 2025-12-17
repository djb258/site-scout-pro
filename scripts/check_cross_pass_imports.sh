#!/bin/bash
# ============================================================================
# CROSS-PASS IMPORT CHECK
# ============================================================================
#
# This script FAILS the build if any hub imports from another hub directly.
#
# ALLOWED:
#   - /src/pass0/** may import from /src/shared/**
#   - /src/pass1/** may import from /src/shared/**
#   - /src/passX/** may import from /src/shared/**
#
# FORBIDDEN:
#   - /src/pass0/** importing from /src/pass1/**
#   - /src/pass1/** importing from /src/pass2/**
#   - Any cross-pass direct imports
#
# DOCTRINE: Passes communicate via data handoffs, not direct imports.
#
# ============================================================================

set -e

echo "=============================================="
echo "CROSS-PASS IMPORT CHECK"
echo "=============================================="
echo ""

VIOLATIONS=0

# Function to check imports in a directory
check_imports() {
    local SOURCE_DIR=$1
    local SOURCE_PASS=$2

    echo "Checking $SOURCE_DIR for cross-pass imports..."

    # Find all TypeScript files in the source directory
    while IFS= read -r -d '' FILE; do
        # Check for imports from other pass directories
        for TARGET_PASS in pass0 pass1 pass15 pass2 pass3; do
            # Skip if checking own pass
            if [ "$TARGET_PASS" == "$SOURCE_PASS" ]; then
                continue
            fi

            # Look for imports from other passes
            IMPORT_MATCH=$(grep -E "from ['\"].*/${TARGET_PASS}/" "$FILE" 2>/dev/null || true)
            if [ -n "$IMPORT_MATCH" ]; then
                echo "VIOLATION in $FILE:"
                echo "  Cross-pass import from $TARGET_PASS:"
                echo "  $IMPORT_MATCH"
                VIOLATIONS=$((VIOLATIONS + 1))
            fi

            # Also check relative imports that might cross boundaries
            RELATIVE_MATCH=$(grep -E "from ['\"]\.\..*/${TARGET_PASS}/" "$FILE" 2>/dev/null || true)
            if [ -n "$RELATIVE_MATCH" ]; then
                echo "VIOLATION in $FILE:"
                echo "  Relative cross-pass import from $TARGET_PASS:"
                echo "  $RELATIVE_MATCH"
                VIOLATIONS=$((VIOLATIONS + 1))
            fi
        done
    done < <(find "$SOURCE_DIR" -name "*.ts" -o -name "*.tsx" -print0 2>/dev/null)
}

# Check each pass directory
if [ -d "src/pass0" ]; then
    check_imports "src/pass0" "pass0"
fi

if [ -d "src/pass1" ]; then
    check_imports "src/pass1" "pass1"
fi

if [ -d "src/pass15" ]; then
    check_imports "src/pass15" "pass15"
fi

if [ -d "src/pass2" ]; then
    check_imports "src/pass2" "pass2"
fi

if [ -d "src/pass3" ]; then
    check_imports "src/pass3" "pass3"
fi

echo ""
echo "=============================================="

if [ $VIOLATIONS -gt 0 ]; then
    echo "FAILED: $VIOLATIONS cross-pass import violation(s) found"
    echo ""
    echo "Passes MUST NOT import directly from each other."
    echo "Use /src/shared/* for cross-cutting concerns."
    echo "Data flows between passes via handoff objects."
    exit 1
else
    echo "PASSED: No cross-pass import violations"
    exit 0
fi
