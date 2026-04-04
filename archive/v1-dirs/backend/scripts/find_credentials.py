"""
Script to find n8n and Composio API keys in the codebase.
"""
import os
import yaml
from pathlib import Path
import sys

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

print("=" * 60)
print("Searching for n8n and Composio API Keys")
print("=" * 60)

# Check IMO-Creator credentials
print("\n1. Checking IMO-Creator credentials.yaml...")
credential_paths = [
    project_root / "imo_creator" / "config" / "credentials.yaml",
    project_root / "imo_creator" / "global" / "credentials.yaml",
    project_root / "imo_creator" / "credentials.yaml",
]

found_creds = False
for path in credential_paths:
    if path.exists():
        print(f"   [FOUND] {path}")
        try:
            with open(path, 'r') as f:
                creds = yaml.safe_load(f) or {}
            if creds.get("n8n", {}).get("api_key"):
                print(f"   n8n API Key: {creds['n8n']['api_key']}")
            if creds.get("composio", {}).get("api_key"):
                print(f"   Composio API Key: {creds['composio']['api_key']}")
            if creds.get("composio", {}).get("workspace_id"):
                print(f"   Composio Workspace ID: {creds['composio']['workspace_id']}")
            found_creds = True
        except Exception as e:
            print(f"   [ERROR] Failed to read: {e}")
    else:
        print(f"   [NOT FOUND] {path}")

if not found_creds:
    print("   No credentials.yaml file found in IMO-Creator")

# Check environment variables
print("\n2. Checking environment variables...")
n8n_key = os.getenv("N8N_API_KEY")
composio_key = os.getenv("COMPOSIO_API_KEY")
composio_workspace = os.getenv("COMPOSIO_WORKSPACE_ID")

if n8n_key:
    print(f"   [FOUND] N8N_API_KEY: {n8n_key}")
else:
    print("   [NOT SET] N8N_API_KEY")

if composio_key:
    print(f"   [FOUND] COMPOSIO_API_KEY: {composio_key}")
else:
    print("   [NOT SET] COMPOSIO_API_KEY")

if composio_workspace:
    print(f"   [FOUND] COMPOSIO_WORKSPACE_ID: {composio_workspace}")
else:
    print("   [NOT SET] COMPOSIO_WORKSPACE_ID")

# Check global config
print("\n3. Checking global_config.yaml...")
global_config_path = project_root / "config" / "global_config.yaml"
if global_config_path.exists():
    try:
        with open(global_config_path, 'r') as f:
            config = yaml.safe_load(f) or {}
        n8n_config = config.get("n8n", {})
        composio_config = config.get("composio", {})
        
        if n8n_config.get("api_key"):
            print(f"   n8n api_key: {n8n_config['api_key']}")
        else:
            print("   n8n api_key: Not set (uses env var)")
            
        if composio_config.get("api_key"):
            print(f"   Composio api_key: {composio_config['api_key']}")
        else:
            print("   Composio api_key: Not set (uses env var)")
    except Exception as e:
        print(f"   [ERROR] Failed to read: {e}")
else:
    print(f"   [NOT FOUND] {global_config_path}")

print("\n" + "=" * 60)
print("Summary:")
print("=" * 60)
print("The system checks credentials in this order:")
print("1. imo_creator/config/credentials.yaml (highest priority)")
print("2. Environment variables (.env file)")
print("3. config/global_config.yaml")
print("\nTo add credentials, create:")
print("  imo_creator/config/credentials.yaml")
print("  (see imo_creator/config/credentials.yaml.example for format)")

