#!/bin/bash
# Setup script for Cursor Global Agents Configuration
# This script helps set up environment variables and global configuration

set -e

echo "🚀 Cursor Global Agents Setup"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect shell
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_RC="$HOME/.bashrc"
else
    SHELL_RC="$HOME/.profile"
fi

echo "Detected shell config: $SHELL_RC"
echo ""

# Function to add environment variable
add_env_var() {
    local var_name=$1
    local var_value=$2
    local prompt_text=$3
    
    echo -e "${YELLOW}$prompt_text${NC}"
    read -p "Enter $var_name (or press Enter to skip): " input_value
    
    if [ -n "$input_value" ]; then
        # Check if already exists
        if grep -q "export $var_name=" "$SHELL_RC" 2>/dev/null; then
            echo "  ⚠️  $var_name already exists in $SHELL_RC"
            read -p "  Replace it? (y/n): " replace
            if [ "$replace" = "y" ]; then
                # Remove old line
                sed -i.bak "/export $var_name=/d" "$SHELL_RC"
                echo "export $var_name=\"$input_value\"" >> "$SHELL_RC"
                echo "  ✅ Updated $var_name"
            else
                echo "  ⏭️  Skipped $var_name"
            fi
        else
            echo "export $var_name=\"$input_value\"" >> "$SHELL_RC"
            echo "  ✅ Added $var_name"
        fi
    else
        echo "  ⏭️  Skipped $var_name"
    fi
    echo ""
}

# Setup API Keys
echo "📝 Setting up API Keys"
echo "----------------------"
echo "Note: Claude and Gemini use sign-in accounts (configure in Cursor Settings)"
echo "Only Codex uses an API key."
echo ""
add_env_var "OPENAI_API_KEY" "" "Codex (OpenAI) API Key"
echo ""
echo "⚠️  IMPORTANT: Claude and Gemini must be configured via sign-in in Cursor Settings:"
echo "   1. Open Cursor Settings (Ctrl+, or Cmd+,)"
echo "   2. Go to Features → AI"
echo "   3. Sign in to Claude and Gemini accounts"
echo ""

# Setup Obsidian
echo "📚 Setting up Obsidian"
echo "----------------------"
read -p "Enter your Obsidian vault path (or press Enter to skip): " obsidian_path

if [ -n "$obsidian_path" ]; then
    # Expand path if it starts with ~
    if [[ "$obsidian_path" == ~* ]]; then
        obsidian_path="${obsidian_path/#\~/$HOME}"
    fi
    
    # Check if path exists
    if [ -d "$obsidian_path" ]; then
        if grep -q "export OBSIDIAN_VAULT_PATH=" "$SHELL_RC" 2>/dev/null; then
            read -p "  OBSIDIAN_VAULT_PATH already exists. Replace it? (y/n): " replace
            if [ "$replace" = "y" ]; then
                sed -i.bak "/export OBSIDIAN_VAULT_PATH=/d" "$SHELL_RC"
                echo "export OBSIDIAN_VAULT_PATH=\"$obsidian_path\"" >> "$SHELL_RC"
                echo "  ✅ Updated OBSIDIAN_VAULT_PATH"
            fi
        else
            echo "export OBSIDIAN_VAULT_PATH=\"$obsidian_path\"" >> "$SHELL_RC"
            echo "  ✅ Added OBSIDIAN_VAULT_PATH"
        fi
    else
        echo "  ⚠️  Warning: Path does not exist: $obsidian_path"
        read -p "  Add anyway? (y/n): " add_anyway
        if [ "$add_anyway" = "y" ]; then
            echo "export OBSIDIAN_VAULT_PATH=\"$obsidian_path\"" >> "$SHELL_RC"
            echo "  ✅ Added OBSIDIAN_VAULT_PATH (path will be created if needed)"
        fi
    fi
else
    echo "  ⏭️  Skipped Obsidian vault path"
fi
echo ""

# Copy global cursorrules
echo "📋 Setting up Global .cursorrules"
echo "----------------------------------"
GLOBAL_RULES="$HOME/.cursorrules.global"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ -f "$SCRIPT_DIR/.cursorrules.global" ]; then
    cp "$SCRIPT_DIR/.cursorrules.global" "$GLOBAL_RULES"
    echo "  ✅ Copied .cursorrules.global to $GLOBAL_RULES"
else
    echo "  ⚠️  .cursorrules.global not found in script directory"
    echo "  📝 Creating template at $GLOBAL_RULES"
    cat > "$GLOBAL_RULES" << 'EOF'
# Global Cursor Rules - AI Agents & Obsidian Integration
# See CURSOR_GLOBAL_AGENTS_SETUP.md for full documentation

## Available Agents
- Claude (Anthropic): Use /claude (Sign-in account)
- Gemini (Google): Use /gemini (Sign-in account)
- Codex (OpenAI): Use /codex (API Key)
- Obsidian: Use /obsidian

## Authentication
- Claude & Gemini: Sign-in accounts configured in Cursor Settings
- Codex: API key configured in Cursor Settings or OPENAI_API_KEY env var

## Agent Selection
- Complex reasoning → Claude
- Code generation → Gemini/Codex
- Knowledge retrieval → Obsidian
EOF
    echo "  ✅ Created template .cursorrules.global"
fi
echo ""

# Summary
echo "✨ Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Reload your shell: source $SHELL_RC"
echo "2. Configure API keys in Cursor Settings (if not using env vars)"
echo "3. Restart Cursor IDE"
echo "4. Test agents in any repository"
echo ""
echo "For detailed instructions, see: CURSOR_GLOBAL_AGENTS_SETUP.md"
echo ""

