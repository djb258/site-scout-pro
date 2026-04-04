# IMO-Creator Setup Guide: n8n & Composio

Quick setup guide for connecting IMO-Creator to n8n and Composio.

## Quick Start

### 1. Copy Environment Template

```bash
cp env.example .env
```

### 2. Configure n8n

1. Install n8n: `npm install n8n -g` or use Docker
2. Start n8n: `n8n start` (runs on http://localhost:5678)
3. Create API key in n8n Settings > API
4. Add to `.env`:
   ```bash
   N8N_BASE_URL=http://localhost:5678
   N8N_API_KEY=your_api_key_here
   ```

### 3. Configure Composio

1. Sign up at [composio.dev](https://composio.dev)
2. Create workspace and get API key
3. Connect apps (Census, U-Haul, DOT, etc.)
4. Add to `.env`:
   ```bash
   COMPOSIO_API_KEY=your_api_key_here
   COMPOSIO_BASE_URL=https://api.composio.dev
   COMPOSIO_WORKSPACE_ID=your_workspace_id
   COMPOSIO_APP_CENSUS=your_census_app_id
   COMPOSIO_APP_UHAUL=your_uhaul_app_id
   # ... etc
   ```

### 4. Test Connections

```python
# Test n8n
from backend.services.n8n_service import test_n8n_connection
result = await test_n8n_connection()
print(result)

# Test Composio
from backend.services.composio_service import test_composio_connection
result = await test_composio_connection()
print(result)
```

## Full Documentation

See [INTEGRATIONS.md](INTEGRATIONS.md) for complete setup instructions.

## Environment Variables Reference

All required environment variables are documented in `env.example`.

