# IMO-Creator Integrations: n8n & Composio

This document explains how to connect IMO-Creator to n8n (workflow automation) and Composio (API orchestration).

## Overview

IMO-Creator integrates with two key automation platforms:

1. **n8n**: Workflow automation and orchestration
2. **Composio**: API integration management and orchestration

## n8n Integration

### What is n8n?

n8n is an open-source workflow automation tool that allows you to connect different services and automate tasks. In IMO-Creator, n8n is used to:

- Trigger workflows from pipeline steps
- Orchestrate complex multi-step processes
- Handle external API calls
- Manage data transformations
- Schedule automated tasks

### Setup Instructions

#### 1. Install n8n

```bash
# Using npm
npm install n8n -g

# Using Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

#### 2. Access n8n

Navigate to `http://localhost:5678` and complete the initial setup.

#### 3. Create API Key

1. Go to **Settings** > **API**
2. Click **Create API Key**
3. Copy the API key

#### 4. Configure Environment Variables

Add to your `.env` file:

```bash
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_api_key_here
```

#### 5. Create Webhook Workflows

For each pipeline step that needs n8n integration:

1. Create a new workflow in n8n
2. Add a **Webhook** node as the trigger
3. Configure the webhook URL (e.g., `/webhook/screening`)
4. Add processing nodes (HTTP requests, data transformations, etc.)
5. Save the workflow
6. Activate the workflow

#### 6. Add Webhook URLs to .env

```bash
N8N_WEBHOOK_SCREENING=https://your-n8n-instance.com/webhook/screening
N8N_WEBHOOK_SATURATION=https://your-n8n-instance.com/webhook/saturation
N8N_WEBHOOK_SCORING=https://your-n8n-instance.com/webhook/scoring
N8N_WEBHOOK_PARCEL=https://your-n8n-instance.com/webhook/parcel
```

### Usage in IMO-Creator

n8n workflows are triggered automatically from pipeline steps:

```python
# In backend/pipeline/imo_driver.py
# n8n webhooks are called when pipeline steps execute
```

### Example n8n Workflow

**Screening Workflow:**
1. Webhook receives candidate data
2. HTTP Request to Census API
3. HTTP Request to U-Haul API
4. Data transformation
5. HTTP Request back to backend API
6. Store results in Neon database

## Composio Integration

### What is Composio?

Composio is an API orchestration platform that manages integrations with hundreds of services. In IMO-Creator, Composio is used to:

- Manage external API connections (Census, U-Haul, DOT, etc.)
- Handle authentication and token management
- Provide unified API interface
- Manage rate limiting and retries
- Handle webhook subscriptions

### Setup Instructions

#### 1. Create Composio Account

1. Go to [Composio](https://composio.dev)
2. Sign up for an account
3. Create a workspace

#### 2. Get API Key

1. Navigate to **Settings** > **API Keys**
2. Click **Create API Key**
3. Copy the API key and workspace ID

#### 3. Connect Apps

For each external service:

1. Go to **Apps** in Composio dashboard
2. Search for the app (e.g., "Census", "U-Haul")
3. Click **Connect**
4. Complete OAuth flow or API key setup
5. Copy the App ID

#### 4. Configure Environment Variables

Add to your `.env` file:

```bash
COMPOSIO_API_KEY=your_api_key_here
COMPOSIO_BASE_URL=https://api.composio.dev
COMPOSIO_WORKSPACE_ID=your_workspace_id
COMPOSIO_APP_CENSUS=your_census_app_id
COMPOSIO_APP_UHAUL=your_uhaul_app_id
COMPOSIO_APP_DOT=your_dot_app_id
COMPOSIO_APP_RENT=your_rent_app_id
COMPOSIO_APP_GEOSPATIAL=your_geospatial_app_id
```

### Usage in IMO-Creator

Composio apps are accessed through the service layer:

```python
# In backend/services/census_service.py
# Composio is used to make API calls to external services
```

### Example Composio Integration

**Census Service:**
1. IMO-Creator pipeline calls `get_population_data()`
2. Service uses Composio to call Census API
3. Composio handles authentication
4. Data is returned to pipeline
5. Results stored in Neon database

## Configuration Files

### IMO-Creator Credentials (Recommended)

**Place credentials in IMO-Creator directory:**

Create `imo_creator/config/credentials.yaml`:

```yaml
n8n:
  base_url: "http://localhost:5678"
  api_key: "your_actual_api_key"
  webhooks:
    screening: "https://your-n8n-instance.com/webhook/screening"
    # ... etc

composio:
  base_url: "https://api.composio.dev"
  api_key: "your_actual_api_key"
  workspace_id: "your_workspace_id"
  apps:
    census: "your_app_id"
    # ... etc
```

**See [CREDENTIALS.md](CREDENTIALS.md) for complete instructions.**

### Environment Variables (.env)

Alternative: Store credentials in `.env`:

```bash
# n8n Configuration
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_api_key
N8N_WEBHOOK_SCREENING=https://...

# Composio Configuration
COMPOSIO_API_KEY=your_api_key
COMPOSIO_BASE_URL=https://api.composio.dev
COMPOSIO_WORKSPACE_ID=your_workspace_id
COMPOSIO_APP_CENSUS=your_app_id
```

### Global Config (config/global_config.yaml)

Configuration is also available in global config:

```yaml
n8n:
  enabled: true
  base_url: "${N8N_BASE_URL}"
  api_key: "${N8N_API_KEY}"

composio:
  enabled: true
  base_url: "${COMPOSIO_BASE_URL}"
  api_key: "${COMPOSIO_API_KEY}"
```

### Credential Loading Priority

1. **IMO-Creator credentials.yaml** (highest priority)
2. Environment variables (`.env`)
3. Global config (`config/global_config.yaml`)

## Service Implementation

### n8n Service

Located in: `backend/services/n8n_service.py`

```python
async def trigger_workflow(webhook_url: str, data: dict) -> dict:
    """Trigger an n8n workflow via webhook."""
    # Implementation uses N8N_WEBHOOK_* environment variables
```

### Composio Service

Located in: `backend/services/composio_service.py`

```python
async def call_composio_app(app_id: str, action: str, params: dict) -> dict:
    """Call a Composio-connected app."""
    # Implementation uses COMPOSIO_APP_* environment variables
```

## Testing Connections

### Test n8n Connection

```python
from backend.services.n8n_service import test_n8n_connection

# Test connection
result = await test_n8n_connection()
print(result)
```

### Test Composio Connection

```python
from backend.services.composio_service import test_composio_connection

# Test connection
result = await test_composio_connection()
print(result)
```

## Troubleshooting

### n8n Issues

- **Connection refused**: Check if n8n is running on the configured port
- **Webhook not found**: Ensure workflow is activated in n8n
- **Authentication failed**: Verify API key in `.env`

### Composio Issues

- **Invalid API key**: Regenerate API key in Composio dashboard
- **App not connected**: Reconnect app in Composio dashboard
- **Rate limiting**: Check Composio usage limits

## Security Notes

- Never commit `.env` file to git
- Rotate API keys regularly
- Use environment-specific configurations
- Store secrets in secure vault (e.g., AWS Secrets Manager)

## Additional Resources

- [n8n Documentation](https://docs.n8n.io)
- [Composio Documentation](https://docs.composio.dev)
- [IMO-Creator Pipeline Documentation](backend/pipeline/README.md)

