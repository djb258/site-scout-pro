# Quick Start: Cursor Global Agents Setup

## 🚀 5-Minute Setup

### Step 1: Run Setup Script

**Windows (PowerShell):**
```powershell
.\setup_cursor_agents.ps1
```

**macOS/Linux:**
```bash
./setup_cursor_agents.sh
```

### Step 2: Configure Agent Authentication in Cursor

1. Open Cursor IDE
2. Press `Ctrl+,` (or `Cmd+,` on Mac) to open Settings
3. Search for "AI" or go to **Features** → **AI**
4. Configure each agent:
   - **Claude**: Click "Sign In" and enter your Anthropic account credentials
   - **Gemini**: Click "Sign In" and enter your Google account credentials
   - **Codex**: Enter your **OpenAI API Key** (get it from https://platform.openai.com/api-keys)

### Step 3: Set Obsidian Vault Path

If you didn't set it in the script, set it now:

**Windows (PowerShell):**
```powershell
[Environment]::SetEnvironmentVariable("OBSIDIAN_VAULT_PATH", "C:\path\to\your\vault", "User")
```

**macOS/Linux:**
```bash
export OBSIDIAN_VAULT_PATH="/path/to/your/vault"
echo 'export OBSIDIAN_VAULT_PATH="/path/to/your/vault"' >> ~/.bashrc  # or ~/.zshrc
```

### Step 4: Restart Cursor

Close and reopen Cursor IDE to load the new configuration.

### Step 5: Test in Any Repository

Open any repository and try:

```
/claude Explain this code
/gemini Generate a test for this function
/codex Optimize this code
/obsidian Search for previous solutions
```

## ✅ Verification Checklist

- [ ] Claude sign-in account configured in Cursor Settings
- [ ] Gemini sign-in account configured in Cursor Settings
- [ ] Codex API key configured in Cursor Settings (or environment variable)
- [ ] Obsidian vault path configured
- [ ] `.cursorrules.global` copied to home directory
- [ ] Cursor IDE restarted
- [ ] Tested agent switching in a repository

## 📚 Full Documentation

See `CURSOR_GLOBAL_AGENTS_SETUP.md` for complete documentation.

## 🆘 Troubleshooting

**Agents not showing up?**
- **Claude/Gemini**: Check sign-in credentials in Cursor Settings → Features → AI
- **Codex**: Check API key in Cursor Settings or `OPENAI_API_KEY` environment variable
- Verify billing/quota on provider websites (especially Codex)
- Re-authenticate if sign-in has expired
- Restart Cursor

**Obsidian not connecting?**
- Verify vault path is correct
- Check file permissions
- Ensure Obsidian is installed

**Need help?**
- Review `CURSOR_GLOBAL_AGENTS_SETUP.md`
- Check Cursor documentation: https://cursor.sh/docs

