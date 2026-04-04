# Setup script for Cursor Global Agents Configuration (PowerShell)
# This script helps set up environment variables and global configuration on Windows

Write-Host "🚀 Cursor Global Agents Setup" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host ""

# Function to add environment variable
function Add-EnvVar {
    param(
        [string]$VarName,
        [string]$PromptText
    )
    
    Write-Host $PromptText -ForegroundColor Yellow
    $value = Read-Host "Enter $VarName (or press Enter to skip)"
    
    if ($value) {
        # Check if already exists
        $existing = [Environment]::GetEnvironmentVariable($VarName, "User")
        if ($existing) {
            Write-Host "  ⚠️  $VarName already exists: $existing" -ForegroundColor Yellow
            $replace = Read-Host "  Replace it? (y/n)"
            if ($replace -eq "y") {
                [Environment]::SetEnvironmentVariable($VarName, $value, "User")
                Write-Host "  ✅ Updated $VarName" -ForegroundColor Green
            } else {
                Write-Host "  ⏭️  Skipped $VarName" -ForegroundColor Gray
            }
        } else {
            [Environment]::SetEnvironmentVariable($VarName, $value, "User")
            Write-Host "  ✅ Added $VarName" -ForegroundColor Green
        }
    } else {
        Write-Host "  ⏭️  Skipped $VarName" -ForegroundColor Gray
    }
    Write-Host ""
}

# Setup API Keys
Write-Host "📝 Setting up API Keys" -ForegroundColor Cyan
Write-Host "----------------------" -ForegroundColor Cyan
Write-Host "Note: Claude and Gemini use sign-in accounts (configure in Cursor Settings)" -ForegroundColor Yellow
Write-Host "Only Codex uses an API key." -ForegroundColor Yellow
Write-Host ""
Add-EnvVar "OPENAI_API_KEY" "Codex (OpenAI) API Key"
Write-Host ""
Write-Host "⚠️  IMPORTANT: Claude and Gemini must be configured via sign-in in Cursor Settings:" -ForegroundColor Yellow
Write-Host "   1. Open Cursor Settings (Ctrl+,)" -ForegroundColor Yellow
Write-Host "   2. Go to Features → AI" -ForegroundColor Yellow
Write-Host "   3. Sign in to Claude and Gemini accounts" -ForegroundColor Yellow
Write-Host ""

# Setup Obsidian
Write-Host "📚 Setting up Obsidian" -ForegroundColor Cyan
Write-Host "----------------------" -ForegroundColor Cyan
$obsidianPath = Read-Host "Enter your Obsidian vault path (or press Enter to skip)"

if ($obsidianPath) {
    # Expand path if it contains ~
    if ($obsidianPath -like "*~*") {
        $obsidianPath = $obsidianPath -replace "~", $env:USERPROFILE
    }
    
    # Check if path exists
    if (Test-Path $obsidianPath) {
        $existing = [Environment]::GetEnvironmentVariable("OBSIDIAN_VAULT_PATH", "User")
        if ($existing) {
            Write-Host "  ⚠️  OBSIDIAN_VAULT_PATH already exists: $existing" -ForegroundColor Yellow
            $replace = Read-Host "  Replace it? (y/n)"
            if ($replace -eq "y") {
                [Environment]::SetEnvironmentVariable("OBSIDIAN_VAULT_PATH", $obsidianPath, "User")
                Write-Host "  ✅ Updated OBSIDIAN_VAULT_PATH" -ForegroundColor Green
            }
        } else {
            [Environment]::SetEnvironmentVariable("OBSIDIAN_VAULT_PATH", $obsidianPath, "User")
            Write-Host "  ✅ Added OBSIDIAN_VAULT_PATH" -ForegroundColor Green
        }
    } else {
        Write-Host "  ⚠️  Warning: Path does not exist: $obsidianPath" -ForegroundColor Yellow
        $addAnyway = Read-Host "  Add anyway? (y/n)"
        if ($addAnyway -eq "y") {
            [Environment]::SetEnvironmentVariable("OBSIDIAN_VAULT_PATH", $obsidianPath, "User")
            Write-Host "  ✅ Added OBSIDIAN_VAULT_PATH (path will be created if needed)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  ⏭️  Skipped Obsidian vault path" -ForegroundColor Gray
}
Write-Host ""

# Copy global cursorrules
Write-Host "📋 Setting up Global .cursorrules" -ForegroundColor Cyan
Write-Host "----------------------------------" -ForegroundColor Cyan
$globalRules = "$env:USERPROFILE\.cursorrules.global"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (Test-Path "$scriptDir\.cursorrules.global") {
    Copy-Item "$scriptDir\.cursorrules.global" $globalRules -Force
    Write-Host "  ✅ Copied .cursorrules.global to $globalRules" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  .cursorrules.global not found in script directory" -ForegroundColor Yellow
    Write-Host "  📝 Creating template at $globalRules" -ForegroundColor Cyan
    @"
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
"@ | Out-File -FilePath $globalRules -Encoding UTF8
    Write-Host "  ✅ Created template .cursorrules.global" -ForegroundColor Green
}
Write-Host ""

# Summary
Write-Host "✨ Setup Complete!" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Restart your PowerShell session (or restart Cursor)"
Write-Host "2. Configure API keys in Cursor Settings (if not using env vars)"
Write-Host "3. Restart Cursor IDE"
Write-Host "4. Test agents in any repository"
Write-Host ""
Write-Host "For detailed instructions, see: CURSOR_GLOBAL_AGENTS_SETUP.md"
Write-Host ""

