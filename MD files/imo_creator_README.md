# IMO-Creator Integration

IMO-Creator system integrated into Storage Site Scouting Backend.

**Repository**: [https://github.com/djb258/site-scout-pro.git](https://github.com/djb258/site-scout-pro.git)

## Structure

- `/config` - Configuration files
- `/templates` - Template engine
- `/processors` - Data processors
- `/utils` - Utility functions
- `/pipeline` - Pipeline execution engine
- `/global` - Global constants and settings

## Usage

IMO-Creator is integrated into the backend through:
- Global configuration system
- Pipeline execution engine
- Template rendering engine
- Process registry

## External Integrations

IMO-Creator connects to external automation platforms:

### n8n (Workflow Automation)
- **Purpose**: Workflow orchestration and automation
- **Configuration**: See `INTEGRATIONS.md` for setup
- **Environment Variables**: `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WEBHOOK_*`
- **Service**: `backend/services/n8n_service.py`

### Composio (API Orchestration)
- **Purpose**: API integration management
- **Configuration**: See `INTEGRATIONS.md` for setup
- **Environment Variables**: `COMPOSIO_API_KEY`, `COMPOSIO_BASE_URL`, `COMPOSIO_APP_*`
- **Service**: `backend/services/composio_service.py`

**Full documentation**: See [INTEGRATIONS.md](INTEGRATIONS.md) for complete setup instructions.

