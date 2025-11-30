"""
Extract n8n and Composio API keys from original imo-creator .env file.
"""
from pathlib import Path
import sys

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

print("=" * 60)
print("Extracting n8n and Composio API Keys from imo-creator")
print("=" * 60)

# Find original imo-creator .env
parent_dir = project_root.parent
imo_env_path = parent_dir / "imo-creator" / ".env"

if not imo_env_path.exists():
    print(f"\n[ERROR] .env file not found at: {imo_env_path}")
    sys.exit(1)

print(f"\n[FOUND] Reading from: {imo_env_path}")

# Read and extract relevant keys
with open(imo_env_path, 'r') as f:
    content = f.read()

# Extract n8n and Composio related variables
n8n_keys = {}
composio_keys = {}

for line in content.split('\n'):
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    
    if '=' in line:
        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        
        if 'N8N' in key.upper():
            n8n_keys[key] = value
        elif 'COMPOSIO' in key.upper():
            composio_keys[key] = value

print("\n" + "=" * 60)
print("n8n Configuration:")
print("=" * 60)
if n8n_keys:
    for key, value in sorted(n8n_keys.items()):
        if 'KEY' in key.upper() or 'SECRET' in key.upper() or 'TOKEN' in key.upper():
            # Mask sensitive values
            masked = value[:8] + '*' * (len(value) - 8) if len(value) > 8 else '*' * len(value)
            print(f"  {key}: {masked}")
        else:
            print(f"  {key}: {value}")
else:
    print("  No n8n keys found")

print("\n" + "=" * 60)
print("Composio Configuration:")
print("=" * 60)
if composio_keys:
    for key, value in sorted(composio_keys.items()):
        if 'KEY' in key.upper() or 'SECRET' in key.upper() or 'TOKEN' in key.upper() or 'ID' in key.upper():
            # Mask sensitive values
            masked = value[:8] + '*' * (len(value) - 8) if len(value) > 8 else '*' * len(value)
            print(f"  {key}: {masked}")
        else:
            print(f"  {key}: {value}")
else:
    print("  No Composio keys found")

# Generate credentials.yaml content
print("\n" + "=" * 60)
print("Generated credentials.yaml content:")
print("=" * 60)
print("\n# Copy this to imo_creator/config/credentials.yaml\n")

yaml_content = "# IMO-Creator Credentials Configuration\n"
yaml_content += "# Extracted from original imo-creator .env file\n\n"

if n8n_keys:
    yaml_content += "# n8n Configuration\n"
    yaml_content += "n8n:\n"
    yaml_content += f"  base_url: \"{n8n_keys.get('N8N_BASE_URL', 'http://localhost:5678')}\"\n"
    yaml_content += f"  api_key: \"{n8n_keys.get('N8N_API_KEY', '')}\"\n"
    yaml_content += "  timeout: 30\n"
    yaml_content += "  webhooks:\n"
    for key, value in sorted(n8n_keys.items()):
        if 'WEBHOOK' in key:
            webhook_name = key.replace('N8N_WEBHOOK_', '').lower()
            yaml_content += f"    {webhook_name}: \"{value}\"\n"

if composio_keys:
    yaml_content += "\n# Composio Configuration\n"
    yaml_content += "composio:\n"
    yaml_content += f"  base_url: \"{composio_keys.get('COMPOSIO_BASE_URL', 'https://api.composio.dev')}\"\n"
    yaml_content += f"  api_key: \"{composio_keys.get('COMPOSIO_API_KEY', '')}\"\n"
    yaml_content += f"  workspace_id: \"{composio_keys.get('COMPOSIO_WORKSPACE_ID', '')}\"\n"
    yaml_content += "  timeout: 30\n"
    yaml_content += "  max_retries: 3\n"
    yaml_content += "  retry_delay: 1\n"
    yaml_content += "  apps:\n"
    for key, value in sorted(composio_keys.items()):
        if 'APP' in key:
            app_name = key.replace('COMPOSIO_APP_', '').lower()
            yaml_content += f"    {app_name}: \"{value}\"\n"

print(yaml_content)

# Optionally write to file
output_path = project_root / "imo_creator" / "config" / "credentials.yaml"
print(f"\n[INFO] To save, run:")
print(f"  python backend/scripts/extract_credentials.py --save")
print(f"  (Will write to: {output_path})")

if len(sys.argv) > 1 and sys.argv[1] == '--save':
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        f.write(yaml_content)
    print(f"\n[SUCCESS] Credentials saved to: {output_path}")

