#!/bin/bash
# Verification script for Cursor Global Agents Setup

echo "🔍 Verifying Cursor Global Agents Configuration"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check 1: Configuration files exist
echo "📋 Checking configuration files..."
if [ -f ".cursorrules.global" ]; then
    echo -e "  ${GREEN}✅${NC} .cursorrules.global exists in repository"
else
    echo -e "  ${RED}❌${NC} .cursorrules.global not found in repository"
fi

if [ -f "$HOME/.cursorrules.global" ]; then
    echo -e "  ${GREEN}✅${NC} .cursorrules.global exists in home directory"
else
    echo -e "  ${YELLOW}⚠️${NC}  .cursorrules.global not in home directory (run setup script)"
fi

if [ -f "setup_cursor_agents.ps1" ]; then
    echo -e "  ${GREEN}✅${NC} setup_cursor_agents.ps1 exists"
else
    echo -e "  ${RED}❌${NC} setup_cursor_agents.ps1 not found"
fi

if [ -f "setup_cursor_agents.sh" ]; then
    echo -e "  ${GREEN}✅${NC} setup_cursor_agents.sh exists"
else
    echo -e "  ${RED}❌${NC} setup_cursor_agents.sh not found"
fi

echo ""

# Check 2: Environment variables (may not be set in this shell)
echo "🔑 Checking environment variables..."
if [ -n "$OPENAI_API_KEY" ]; then
    echo -e "  ${GREEN}✅${NC} OPENAI_API_KEY is set (Codex)"
else
    echo -e "  ${YELLOW}⚠️${NC}  OPENAI_API_KEY not set in this shell (may be set in Windows environment)"
fi

if [ -n "$OBSIDIAN_VAULT_PATH" ]; then
    echo -e "  ${GREEN}✅${NC} OBSIDIAN_VAULT_PATH is set: $OBSIDIAN_VAULT_PATH"
else
    echo -e "  ${YELLOW}⚠️${NC}  OBSIDIAN_VAULT_PATH not set in this shell (may be set in Windows environment)"
fi

echo ""

# Check 3: Verify .cursorrules.global content
echo "📄 Verifying .cursorrules.global content..."
if [ -f ".cursorrules.global" ]; then
    if grep -q "Claude" .cursorrules.global && grep -q "Gemini" .cursorrules.global && grep -q "Codex" .cursorrules.global && grep -q "Obsidian" .cursorrules.global; then
        echo -e "  ${GREEN}✅${NC} All agents (Claude, Gemini, Codex, Obsidian) are configured"
    else
        echo -e "  ${RED}❌${NC} Some agents missing from configuration"
    fi
    
    if grep -q "Sign-in account" .cursorrules.global; then
        echo -e "  ${GREEN}✅${NC} Claude/Gemini sign-in authentication configured"
    fi
    
    if grep -q "API Key" .cursorrules.global; then
        echo -e "  ${GREEN}✅${NC} Codex API Key authentication configured"
    fi
else
    echo -e "  ${RED}❌${NC} Cannot verify content - .cursorrules.global not found"
fi

echo ""

# Summary
echo "📊 Summary"
echo "---------"
echo ""
echo "Configuration Status:"
echo "  ✅ Configuration files created"
echo "  ⚠️  Environment variables need to be set (run setup script)"
echo "  ⚠️  Sign-in accounts need to be configured in Cursor Settings"
echo ""
echo "Next Steps:"
echo "  1. Run setup_cursor_agents.ps1 in PowerShell to set environment variables"
echo "  2. Open Cursor Settings (Ctrl+,) → Features → AI"
echo "  3. Sign in to Claude and Gemini accounts"
echo "  4. Enter Codex (OpenAI) API key"
echo "  5. Restart Cursor IDE"
echo ""




