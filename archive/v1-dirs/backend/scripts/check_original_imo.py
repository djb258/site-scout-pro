"""
Check the original imo-creator directory for credentials.
"""
from pathlib import Path
import yaml
import sys

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

print("=" * 60)
print("Checking Original imo-creator Directory for Credentials")
print("=" * 60)

# Check parent directory for imo-creator
parent_dir = project_root.parent
imo_creator_paths = [
    parent_dir / "imo-creator",
    parent_dir / "imo_creator",
    Path("../imo-creator").resolve(),
    Path("../../imo-creator").resolve(),
]

found_imo = None
for path in imo_creator_paths:
    if path.exists() and path.is_dir():
        found_imo = path
        print(f"\n[FOUND] imo-creator directory: {path}")
        break

if not found_imo:
    print("\n[NOT FOUND] imo-creator directory in parent locations")
    print("Checked:")
    for path in imo_creator_paths:
        print(f"  - {path}")
    sys.exit(0)

# Check for credentials.yaml
credential_locations = [
    found_imo / "config" / "credentials.yaml",
    found_imo / "global" / "credentials.yaml",
    found_imo / "credentials.yaml",
    found_imo / ".env",
]

print("\nChecking for credential files...")
for cred_path in credential_locations:
    if cred_path.exists():
        print(f"\n[FOUND] {cred_path}")
        try:
            if cred_path.suffix == '.yaml' or cred_path.suffix == '.yml':
                with open(cred_path, 'r') as f:
                    creds = yaml.safe_load(f) or {}
                print("\nContents:")
                if creds.get("n8n", {}).get("api_key"):
                    print(f"  n8n API Key: {creds['n8n']['api_key']}")
                if creds.get("composio", {}).get("api_key"):
                    print(f"  Composio API Key: {creds['composio']['api_key']}")
                if creds.get("composio", {}).get("workspace_id"):
                    print(f"  Composio Workspace ID: {creds['composio']['workspace_id']}")
            elif cred_path.name == '.env':
                with open(cred_path, 'r') as f:
                    content = f.read()
                if 'N8N_API_KEY' in content:
                    for line in content.split('\n'):
                        if 'N8N_API_KEY' in line and '=' in line:
                            print(f"  {line.split('=')[0]}: {'*' * 20}")
                if 'COMPOSIO_API_KEY' in content:
                    for line in content.split('\n'):
                        if 'COMPOSIO_API_KEY' in line and '=' in line:
                            print(f"  {line.split('=')[0]}: {'*' * 20}")
        except Exception as e:
            print(f"  [ERROR] Failed to read: {e}")
    else:
        print(f"[NOT FOUND] {cred_path}")

print("\n" + "=" * 60)
print("Summary:")
print("=" * 60)
if found_imo:
    print(f"Original imo-creator found at: {found_imo}")
    print("\nTo copy credentials to this project:")
    print("1. Copy credentials.yaml from original imo-creator")
    print("2. Place in: imo_creator/config/credentials.yaml")
    print("3. Or set environment variables in .env file")

