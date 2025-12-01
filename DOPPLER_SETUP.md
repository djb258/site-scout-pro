# Doppler Global Setup Guide

## Installation Status

✅ Doppler CLI v3.75.1 installed to `~/bin`
✅ PATH updated in `.bashrc`

## Complete Setup (Required)

### Option 1: Run PowerShell Script

Open PowerShell and run:

```powershell
.\setup_doppler_global.ps1
```

This will:
1. Add `~/bin` to your Windows PATH
2. Login to Doppler (opens browser)
3. Configure global scope

### Option 2: Manual Setup

1. **Open a NEW terminal/PowerShell window** (to get updated PATH)

2. **Login to Doppler:**
   ```bash
   doppler login
   ```
   This opens a browser - follow the prompts to authenticate.

3. **Configure global scope:**
   ```bash
   doppler configure set scope global
   ```

## Using Doppler in Any Repository

### Link a Project to a Repo

```bash
cd /path/to/your/repo
doppler setup
```

### Create a New Project

```bash
doppler projects create my-project
```

### Add Secrets

```bash
# Via CLI
doppler secrets set API_KEY=your-key-here

# Or use the Doppler dashboard at https://dashboard.doppler.com
```

### Run Commands with Secrets

```bash
# Inject secrets as environment variables
doppler run -- python backend/main.py

# Or for npm projects
doppler run -- npm run dev
```

### Sync to .env File (for local dev)

```bash
doppler secrets download --no-file --format env > .env
```

## Global Configuration

Your Doppler configuration is stored at:
- Windows: `%USERPROFILE%\.doppler`
- macOS/Linux: `~/.doppler`

This configuration is shared across all repositories.

## Benefits

1. **Centralized secrets** - No more `.env` files in git
2. **Team sync** - Share secrets without manual file sharing
3. **Environment separation** - dev, staging, prod configs
4. **Audit trail** - Track who accessed what
5. **Rotation** - Update secrets in one place

## Migrate from .env

To migrate your existing `.env` file to Doppler:

```bash
# Import .env to Doppler
doppler secrets upload .env

# Or manually add each secret
doppler secrets set NEON_DATABASE_URL=your-value
doppler secrets set N8N_API_KEY=your-value
# ... etc
```

## Troubleshooting

### Doppler not found
Make sure `~/bin` is in your PATH. Open a new terminal after installation.

### Login fails
Try running in PowerShell instead of Git Bash:
```powershell
& "$env:USERPROFILE\bin\doppler.exe" login
```

### Need help?
```bash
doppler help
doppler --help
```

