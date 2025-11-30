# IMO-Creator Credentials Configuration

## Where to Place Credentials

Place your `credentials.yaml` file in one of these locations (checked in order):

1. `imo_creator/config/credentials.yaml` (recommended)
2. `imo_creator/global/credentials.yaml`
3. `imo_creator/credentials.yaml`

## Credential File Format

Copy `imo_creator/config/credentials.yaml.example` to `credentials.yaml` and fill in your actual credentials:

```yaml
# n8n Configuration
n8n:
  base_url: "http://localhost:5678"
  api_key: "your_actual_n8n_api_key"
  webhooks:
    screening: "https://your-n8n-instance.com/webhook/screening"
    saturation: "https://your-n8n-instance.com/webhook/saturation"
    scoring: "https://your-n8n-instance.com/webhook/scoring"
    parcel: "https://your-n8n-instance.com/webhook/parcel"

# Composio Configuration
composio:
  base_url: "https://api.composio.dev"
  api_key: "your_actual_composio_api_key"
  workspace_id: "your_actual_workspace_id"
  apps:
    census: "your_actual_census_app_id"
    uhaul: "your_actual_uhaul_app_id"
    dot: "your_actual_dot_app_id"
    rent: "your_actual_rent_app_id"
    geospatial: "your_actual_geospatial_app_id"
```

## Credential Loading Priority

The system loads credentials in this order:

1. **IMO-Creator credentials.yaml** (highest priority)
2. Environment variables (`.env` file)
3. Global config (`config/global_config.yaml`)

## Security

- **DO NOT** commit `credentials.yaml` to git
- The file is already in `.gitignore`
- Use `credentials.yaml.example` as a template
- Keep credentials secure and rotate them regularly

## Testing

After placing your credentials file, run:

```bash
python backend/scripts/test_integrations.py
```

This will verify that credentials are loaded correctly and connections work.

