# Cursor Global Agents & Obsidian Setup Guide

This guide will help you configure Cursor IDE globally to access multiple AI agents (Claude, Gemini, Codex) and connect to Obsidian across all your repositories.

## Overview

Cursor supports multiple AI providers that can be configured globally. This setup ensures that any repository you open in Cursor will have access to:
- **Claude** (Anthropic)
- **Gemini** (Google)
- **Codex** (OpenAI)
- **Obsidian** (Knowledge Base Integration)

## Step 1: Configure Agent Authentication in Cursor Settings

### Access Cursor Settings
1. Open Cursor IDE
2. Go to **Settings** (Ctrl+, or Cmd+,)
3. Navigate to **Features** → **AI** or search for "AI"

### Configure Each Agent

#### Claude (Anthropic) - Sign-In Account
1. In Cursor Settings, find **Claude** or **Anthropic** section
2. Click **Sign In** or **Connect Account**
3. Enter your Anthropic account email and password
4. Complete the authentication flow
5. Enable Claude models (claude-3-opus, claude-3-sonnet, claude-3-haiku)

#### Gemini (Google) - Sign-In Account
1. In Cursor Settings, find **Gemini** or **Google AI** section
2. Click **Sign In** or **Connect Account**
3. Enter your Google account email and password
4. Complete the authentication flow (may require OAuth)
5. Enable Gemini models (gemini-pro, gemini-ultra)

#### Codex (OpenAI) - API Key
1. In Cursor Settings, find **OpenAI API Key**
2. Enter your OpenAI API key (get it from https://platform.openai.com/api-keys)
3. Enable Codex models (gpt-4, gpt-3.5-turbo, code-davinci-002)

### Alternative: Environment Variable for Codex Only

**Note:** Only Codex uses an API key. Claude and Gemini use sign-in accounts configured in Cursor Settings.

You can set the Codex API key globally via environment variable:

**Windows (PowerShell):**
```powershell
[System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'your-key-here', 'User')
```

**macOS/Linux:**
```bash
export OPENAI_API_KEY="your-key-here"
echo 'export OPENAI_API_KEY="your-key-here"' >> ~/.bashrc  # or ~/.zshrc
```

## Step 2: Configure Obsidian Integration

### Option A: Obsidian URI Protocol (Recommended)
1. Install Obsidian on your system
2. Enable **Obsidian URI** in Obsidian Settings → Community Plugins → Obsidian URI
3. Configure the vault path in Cursor (if supported)

### Option B: Obsidian API (If Available)
1. Install an Obsidian API plugin (like "Obsidian REST API")
2. Configure the API endpoint in Cursor settings
3. Set authentication if required

### Option C: File System Access
1. Set your Obsidian vault path as an environment variable:
   ```bash
   export OBSIDIAN_VAULT_PATH="/path/to/your/vault"
   ```

## Step 3: Create Global .cursorrules Template

Copy the `.cursorrules.global` template (see below) to a location you can reference, or add it to your user home directory as `~/.cursorrules.global`.

## Step 4: Use in Any Repository

For each new repository, you can:

1. **Copy the global template:**
   ```bash
   cp ~/.cursorrules.global .cursorrules
   ```

2. **Or create a symlink:**
   ```bash
   ln -s ~/.cursorrules.global .cursorrules
   ```

3. **Or reference it in your repo's .cursorrules:**
   ```markdown
   # See global agent configuration
   @include ~/.cursorrules.global
   ```

## Step 5: Verify Configuration

### Test Agent Access
1. Open any repository in Cursor
2. Use Cursor's chat/command palette
3. Try switching between agents:
   - `/claude` - Use Claude
   - `/gemini` - Use Gemini  
   - `/codex` - Use Codex/OpenAI
   - `/auto` - Let Cursor choose

### Test Obsidian Connection
1. In Cursor chat, try: "Search Obsidian for [topic]"
2. Or: "Create a note in Obsidian about [topic]"
3. Verify notes are created/accessed in your Obsidian vault

## Troubleshooting

### Agents Not Available
- **Claude/Gemini:** Check sign-in credentials are correctly configured in Cursor Settings
- **Codex:** Check API key is set in Cursor Settings or `OPENAI_API_KEY` environment variable
- **Check billing:** Verify your accounts have credits/quota (especially for Codex)
- **Check model availability:** Some models may be region-restricted
- **Re-authenticate:** If sign-in expires, re-authenticate Claude/Gemini in Cursor Settings

### Obsidian Not Connecting
- **Check vault path:** Ensure the vault path is correct
- **Check permissions:** Ensure Cursor has read/write access to the vault
- **Check Obsidian is running:** Some integrations require Obsidian to be open

### Global Rules Not Loading
- **Check file location:** Ensure `.cursorrules.global` is in an accessible location
- **Check permissions:** Ensure the file is readable
- **Check syntax:** Ensure the markdown syntax is correct

## Advanced Configuration

### Custom Agent Selection Logic
You can add logic to your `.cursorrules` to automatically select agents based on task type:

```markdown
## Agent Selection Rules

- Use **Claude** for: complex reasoning, long-form writing, analysis
- Use **Gemini** for: code generation, technical documentation, research
- Use **Codex** for: code completion, debugging, refactoring
- Use **Obsidian** for: knowledge retrieval, note-taking, documentation
```

### Obsidian Vault Structure
Organize your Obsidian vault with:
- `projects/` - Project-specific notes
- `knowledge/` - General knowledge base
- `code/` - Code documentation
- `meetings/` - Meeting notes

## Next Steps

1. Sign in to Claude and Gemini accounts in Cursor Settings
2. Set up Codex API key in Cursor Settings (or environment variable)
3. Configure Obsidian vault path
4. Copy `.cursorrules.global` template to your home directory
5. Test in a sample repository
6. Apply to all your repositories

## Support

For issues:
- Cursor Documentation: https://cursor.sh/docs
- Anthropic API: https://docs.anthropic.com
- Google AI: https://ai.google.dev/docs
- OpenAI API: https://platform.openai.com/docs
- Obsidian: https://obsidian.md

