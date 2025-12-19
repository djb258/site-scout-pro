#!/bin/bash
# ==============================================================================
# VAULT GUARDIAN: Pass 2 Neon Ban Enforcement
# ==============================================================================
# Doctrine: Pass 2 MUST NOT write to Neon. All Pass 2 data goes to Supabase
#           staging tables and is promoted via explicit promotion functions.
#
# This script fails if Pass 2 code contains any NeonAdapter references.
# ==============================================================================

set -e

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  VAULT GUARDIAN: Checking Pass 2 Neon Ban                             ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check for NeonAdapter imports in Pass 2
VIOLATIONS=$(grep -rn "neonAdapter\|NeonAdapter\|@neondatabase" src/pass2/ 2>/dev/null || true)

if [ -n "$VIOLATIONS" ]; then
    echo "❌ VIOLATION DETECTED: Pass 2 contains Neon references"
    echo ""
    echo "Pass 2 MUST NOT:"
    echo "  - Import NeonAdapter"
    echo "  - Import @neondatabase/serverless"
    echo "  - Write to any Neon tables"
    echo "  - Read from Neon vault (use Supabase staging)"
    echo ""
    echo "Violations found:"
    echo "─────────────────────────────────────────────────────────────────────────"
    echo "$VIOLATIONS"
    echo "─────────────────────────────────────────────────────────────────────────"
    echo ""
    echo "FIX: Move Neon operations to promotion functions or read from Supabase."
    echo ""
    exit 1
else
    echo "✅ Pass 2 Neon Ban: COMPLIANT"
    echo "   No NeonAdapter references found in src/pass2/"
    echo ""
fi
