#!/bin/bash
# ============================================================================
# PRD OWNERSHIP ENFORCEMENT CHECK
# ============================================================================
#
# This script FAILS the build if:
# - A hub directory exists under /src/passX/**
# - AND the hub README.md does NOT reference a PRD ID it implements
#
# DOCTRINE: All hub code must be traceable to a PRD.
#           Undocumented hubs are architecture violations.
#
# ============================================================================

set -e

echo "=============================================="
echo "PRD OWNERSHIP ENFORCEMENT CHECK"
echo "=============================================="
echo ""

VIOLATIONS=0

# Define expected hub directories and their PRD references
declare -A HUBS
HUBS["src/pass0/radar_hub"]="PRD_PASS0_RADAR_HUB"
HUBS["src/pass1/structure_hub"]="PRD_PASS1_STRUCTURE_HUB"
HUBS["src/pass15/rent_recon_hub"]="PRD_PASS15_RENT_RECON_HUB"
HUBS["src/pass2/underwriting_hub"]="PRD_PASS2_UNDERWRITING_HUB"
HUBS["src/pass3/design_hub"]="PRD_PASS3_DESIGN_HUB"
HUBS["src/shared/data_layer"]="PRD_DATA_LAYER_HUB"

echo "Checking PRD references in hub READMEs..."
echo ""

for HUB_DIR in "${!HUBS[@]}"; do
    PRD_ID="${HUBS[$HUB_DIR]}"
    README_PATH="$HUB_DIR/README.md"

    echo "Checking $HUB_DIR..."

    # Check if hub directory exists
    if [ ! -d "$HUB_DIR" ]; then
        echo "  WARN: Hub directory not found: $HUB_DIR"
        continue
    fi

    # Check if README exists
    if [ ! -f "$README_PATH" ]; then
        echo "  VIOLATION: No README.md found in $HUB_DIR"
        VIOLATIONS=$((VIOLATIONS + 1))
        continue
    fi

    # Check if README references the PRD
    if ! grep -q "$PRD_ID" "$README_PATH"; then
        echo "  VIOLATION: README does not reference $PRD_ID"
        VIOLATIONS=$((VIOLATIONS + 1))
    else
        echo "  OK: References $PRD_ID"
    fi
done

echo ""

# Check for undocumented hub directories
echo "Checking for undocumented hub directories..."
echo ""

# Find all hub-like directories
for PASS_DIR in src/pass0 src/pass1 src/pass15 src/pass2 src/pass3; do
    if [ -d "$PASS_DIR" ]; then
        for HUB in "$PASS_DIR"/*_hub; do
            if [ -d "$HUB" ]; then
                # Check if this hub is in our known list
                if [ -z "${HUBS[$HUB]}" ]; then
                    echo "VIOLATION: Undocumented hub found: $HUB"
                    echo "  All hubs must be mapped to a PRD in PRD_CANONICAL_MAP.md"
                    VIOLATIONS=$((VIOLATIONS + 1))
                fi
            fi
        done
    fi
done

echo ""
echo "=============================================="

if [ $VIOLATIONS -gt 0 ]; then
    echo "FAILED: $VIOLATIONS PRD ownership violation(s) found"
    echo ""
    echo "All hub directories must:"
    echo "1. Have a README.md file"
    echo "2. Reference their owning PRD ID"
    echo "3. Be listed in PRD_CANONICAL_MAP.md"
    exit 1
else
    echo "PASSED: All hubs properly reference their PRDs"
    exit 0
fi
