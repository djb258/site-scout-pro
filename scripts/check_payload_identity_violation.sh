#!/bin/bash
# ============================================================================
# CI GUARD: Payload Identity Field Violation Check
# ============================================================================
# 
# This script fails the build if card_payload is used for identity fields
# (e.g., county_name) instead of the first-class structural columns.
#
# DOCTRINE: Identity fields MUST be structural columns, not payload spelunking.
#           String matching on card_payload violates authority-first doctrine.
#
# ============================================================================

set -e

echo "=============================================="
echo "PAYLOAD IDENTITY VIOLATION CHECK"
echo "=============================================="
echo ""

# Search for violations in src/ and supabase/functions/
# Excludes lines with "// ALLOWED:" comment (for rare exceptions)
# Excludes lines in types.ts (auto-generated)

VIOLATIONS=$(grep -rn "card_payload.*county_name" \
  --include="*.ts" \
  --include="*.tsx" \
  src/ supabase/functions/ 2>/dev/null | \
  grep -v "// ALLOWED:" | \
  grep -v "types.ts" | \
  grep -v "\.test\." || true)

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: card_payload used for identity field lookup"
  echo ""
  echo "The following files use card_payload.county_name instead of the"
  echo "first-class county_name column. This violates authority-first doctrine."
  echo ""
  echo "VIOLATIONS:"
  echo "$VIOLATIONS"
  echo ""
  echo "FIX: Use the structural county_name column instead:"
  echo "  - Bad:  card_payload->>'county_name' or card_payload.county_name"
  echo "  - Good: county_name (direct column reference)"
  echo ""
  echo "If this is a legitimate exception, add '// ALLOWED: reason' comment."
  exit 1
fi

echo "No payload identity violations found."
echo "All identity fields use structural columns."
exit 0
