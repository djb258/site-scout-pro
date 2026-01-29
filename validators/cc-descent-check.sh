#!/bin/bash
# CC Descent Gate Validation Script
# Authority: imo-creator doctrine
# Hub: barton-storage

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERRORS=0
WARNINGS=0

echo "═══════════════════════════════════════════════════════════════"
echo "CC DESCENT GATE VALIDATION"
echo "Hub: barton-storage"
echo "Doctrine: 1.4.0"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Gate 1: CC-01 Sovereign Reference
echo "[GATE CC-01] Sovereign Declaration"
if [ -f "$REPO_ROOT/IMO_CONTROL.json" ]; then
    SOVEREIGN=$(grep -o '"id": *"[^"]*"' "$REPO_ROOT/IMO_CONTROL.json" | head -1 | cut -d'"' -f4)
    if [ -n "$SOVEREIGN" ]; then
        echo "  ✓ Sovereign declared: $SOVEREIGN"
    else
        echo "  ✗ Sovereign ID not found in IMO_CONTROL.json"
        ((ERRORS++))
    fi
else
    echo "  ✗ IMO_CONTROL.json not found"
    ((ERRORS++))
fi
echo ""

# Gate 2: CC-02 Hub Identity
echo "[GATE CC-02] Hub Identity"
if [ -f "$REPO_ROOT/REGISTRY.yaml" ]; then
    echo "  ✓ REGISTRY.yaml exists"
    HUB_ID=$(grep "id:" "$REPO_ROOT/REGISTRY.yaml" | head -1 | awk '{print $2}' | tr -d '"')
    if [ -n "$HUB_ID" ]; then
        echo "  ✓ Hub ID: $HUB_ID"
    fi
else
    echo "  ✗ REGISTRY.yaml not found — CC-02 VIOLATION"
    ((ERRORS++))
fi

# Check PRD exists before code
echo ""
echo "[GATE CC-02] PRD Before Code"
if [ -f "$REPO_ROOT/docs/prd/PRD_BARTON_STORAGE_HUB.md" ]; then
    echo "  ✓ Main hub PRD exists"
else
    echo "  ✗ Main hub PRD missing — CC-02 VIOLATION"
    ((ERRORS++))
fi
echo ""

# Gate 3: CC-03 Context (ADRs)
echo "[GATE CC-03] Architecture Decision Records"
ADR_COUNT=$(find "$REPO_ROOT/docs/adr" -name "ADR-*.md" 2>/dev/null | wc -l)
if [ "$ADR_COUNT" -gt 0 ]; then
    echo "  ✓ Found $ADR_COUNT ADR(s)"
else
    echo "  ✗ No ADRs found — CC-03 VIOLATION"
    ((ERRORS++))
fi

# Check ERDs exist
echo ""
echo "[GATE CC-03] ERD Documentation"
ERD_COUNT=$(find "$REPO_ROOT/docs/erd" -name "ERD_*.md" 2>/dev/null | wc -l)
if [ "$ERD_COUNT" -gt 0 ]; then
    echo "  ✓ Found $ERD_COUNT ERD(s)"
else
    echo "  ✗ No ERDs found — CC-03 VIOLATION"
    ((ERRORS++))
fi
echo ""

# Gate 4: CC-04 Process
echo "[GATE CC-04] Process Declarations"
if [ -f "$REPO_ROOT/ctb/process_registry.yaml" ]; then
    echo "  ✓ Process registry exists"
else
    echo "  ⚠ Process registry not found (optional)"
    ((WARNINGS++))
fi
echo ""

# Descent Rule Validation
echo "[DESCENT RULE] Artifact Sequence"
echo "  Checking: CC-01 → CC-02 → CC-03 → CC-04"

# Check sequence
CC01_OK=0
CC02_OK=0
CC03_OK=0
CC04_OK=0

[ -f "$REPO_ROOT/IMO_CONTROL.json" ] && CC01_OK=1
[ -f "$REPO_ROOT/REGISTRY.yaml" ] && [ -f "$REPO_ROOT/docs/prd/PRD_BARTON_STORAGE_HUB.md" ] && CC02_OK=1
[ "$ADR_COUNT" -gt 0 ] && [ "$ERD_COUNT" -gt 0 ] && CC03_OK=1
[ -d "$REPO_ROOT/src" ] && CC04_OK=1

if [ "$CC01_OK" -eq 1 ]; then
    echo "  ✓ CC-01 (Sovereign): PASSED"
else
    echo "  ✗ CC-01 (Sovereign): FAILED"
fi

if [ "$CC02_OK" -eq 1 ]; then
    echo "  ✓ CC-02 (Hub): PASSED"
else
    echo "  ✗ CC-02 (Hub): FAILED"
fi

if [ "$CC03_OK" -eq 1 ]; then
    echo "  ✓ CC-03 (Context): PASSED"
else
    echo "  ✗ CC-03 (Context): FAILED"
fi

if [ "$CC04_OK" -eq 1 ]; then
    echo "  ✓ CC-04 (Process): PASSED"
else
    echo "  ✗ CC-04 (Process): FAILED"
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
    echo "RESULT: ✅ CC DESCENT GATES VALID"
    exit 0
else
    echo "RESULT: ❌ CC DESCENT GATES INVALID"
    exit 1
fi
