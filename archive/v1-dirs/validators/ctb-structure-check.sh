#!/bin/bash
# CTB Structure Validation Script
# Authority: imo-creator doctrine
# Hub: barton-storage

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERRORS=0
WARNINGS=0

echo "═══════════════════════════════════════════════════════════════"
echo "CTB STRUCTURE VALIDATION"
echo "Hub: barton-storage"
echo "Doctrine: 1.4.0"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check 1: Required CTB branches exist
echo "[CHECK 1] CTB Branch Structure"
CTB_BRANCHES=("sys" "data" "app" "ai" "ui")
for branch in "${CTB_BRANCHES[@]}"; do
    if [ -d "$REPO_ROOT/src/$branch" ]; then
        echo "  ✓ src/$branch/ exists"
    else
        echo "  ✗ src/$branch/ MISSING"
        ((ERRORS++))
    fi
done
echo ""

# Check 2: No forbidden folders
echo "[CHECK 2] Forbidden Folder Check"
FORBIDDEN=("utils" "helpers" "common" "shared" "lib" "misc")
for folder in "${FORBIDDEN[@]}"; do
    if [ -d "$REPO_ROOT/src/$folder" ]; then
        echo "  ✗ FORBIDDEN: src/$folder/ exists — CTB_VIOLATION"
        ((ERRORS++))
    else
        echo "  ✓ No src/$folder/"
    fi
done
echo ""

# Check 3: No loose files in src/ root
echo "[CHECK 3] Loose Files in src/"
LOOSE_FILES=$(find "$REPO_ROOT/src" -maxdepth 1 -type f 2>/dev/null | wc -l)
if [ "$LOOSE_FILES" -gt 0 ]; then
    echo "  ✗ Found $LOOSE_FILES loose file(s) in src/ root — CTB_VIOLATION"
    find "$REPO_ROOT/src" -maxdepth 1 -type f -exec echo "    - {}" \;
    ((ERRORS++))
else
    echo "  ✓ No loose files in src/"
fi
echo ""

# Check 4: Required governance files
echo "[CHECK 4] Governance Files"
REQUIRED_FILES=("IMO_CONTROL.json" "REGISTRY.yaml" "DOCTRINE.md" "heir.doctrine.yaml" "doppler.yaml" "AGENT_CONTEXT.yaml")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$REPO_ROOT/$file" ]; then
        echo "  ✓ $file exists"
    else
        echo "  ✗ $file MISSING"
        ((ERRORS++))
    fi
done
echo ""

# Check 5: Domain spec
echo "[CHECK 5] Domain Specification"
if [ -f "$REPO_ROOT/doctrine/REPO_DOMAIN_SPEC.md" ]; then
    echo "  ✓ doctrine/REPO_DOMAIN_SPEC.md exists"
else
    echo "  ✗ doctrine/REPO_DOMAIN_SPEC.md MISSING"
    ((ERRORS++))
fi
echo ""

# Check 6: PRD directory
echo "[CHECK 6] PRD Directory"
PRD_COUNT=$(find "$REPO_ROOT/docs/prd" -name "*.md" 2>/dev/null | wc -l)
if [ "$PRD_COUNT" -gt 0 ]; then
    echo "  ✓ Found $PRD_COUNT PRD file(s)"
else
    echo "  ✗ No PRD files found in docs/prd/"
    ((ERRORS++))
fi
echo ""

# Check 7: ADR directory
echo "[CHECK 7] ADR Directory"
ADR_COUNT=$(find "$REPO_ROOT/docs/adr" -name "*.md" 2>/dev/null | wc -l)
if [ "$ADR_COUNT" -gt 0 ]; then
    echo "  ✓ Found $ADR_COUNT ADR file(s)"
else
    echo "  ✗ No ADR files found in docs/adr/"
    ((ERRORS++))
fi
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════════"
echo "VALIDATION SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo "Errors:   $ERRORS"
echo "Warnings: $WARNINGS"
echo ""

if [ "$ERRORS" -eq 0 ]; then
    echo "RESULT: ✅ CTB STRUCTURE VALID"
    exit 0
else
    echo "RESULT: ❌ CTB STRUCTURE INVALID"
    exit 1
fi
