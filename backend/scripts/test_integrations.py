"""
Script to test n8n and Composio service connections.
Run this script to verify your integrations are configured correctly.
"""
import asyncio
import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.services.n8n_service import check_n8n_connection, trigger_workflow
from backend.services.composio_service import check_composio_connection, call_composio_app, get_app_id
from backend.config.settings import load_global_config


async def test_n8n():
    """Test n8n connection and workflow triggering."""
    print("\n" + "="*60)
    print("Testing n8n Integration")
    print("="*60)
    
    # Test connection
    print("\n1. Testing n8n connection...")
    connection_result = await check_n8n_connection()
    print(f"   Status: {connection_result.get('status')}")
    print(f"   Message: {connection_result.get('message', connection_result.get('error', 'N/A'))}")
    
    if connection_result.get('status') == 'connected':
        print("   [OK] n8n connection successful!")
    elif connection_result.get('status') == 'disabled':
        print("   [WARN] n8n is disabled in configuration")
    else:
        print("   [ERROR] n8n connection failed")
        print(f"   Error: {connection_result.get('error', 'Unknown error')}")
        print("\n   To fix:")
        print("   - Ensure n8n is running")
        print("   - Set N8N_BASE_URL in .env")
        print("   - Set N8N_API_KEY in .env (optional, for API access)")
    
    # Test workflow triggering (if webhook configured)
    print("\n2. Testing workflow trigger...")
    webhook_url = os.getenv("N8N_WEBHOOK_SCREENING")
    if webhook_url:
        print(f"   Using webhook: {webhook_url}")
        try:
            workflow_result = await trigger_workflow(
                webhook_url=webhook_url,
                data={"test": True, "candidate_id": 999}
            )
            print(f"   Status: {workflow_result.get('status')}")
            if workflow_result.get('status') == 'success':
                print("   [OK] Workflow triggered successfully!")
            else:
                print(f"   [WARN] Workflow trigger returned: {workflow_result.get('error', 'Unknown')}")
        except Exception as e:
            print(f"   [ERROR] Workflow trigger failed: {e}")
    else:
        print("   [WARN] No webhook URL configured (N8N_WEBHOOK_SCREENING)")
        print("   Set N8N_WEBHOOK_* variables in .env to test workflow triggering")


async def test_composio():
    """Test Composio connection and app calls."""
    print("\n" + "="*60)
    print("Testing Composio Integration")
    print("="*60)
    
    # Test connection
    print("\n1. Testing Composio connection...")
    connection_result = await check_composio_connection()
    print(f"   Status: {connection_result.get('status')}")
    print(f"   Message: {connection_result.get('message', connection_result.get('error', 'N/A'))}")
    
    if connection_result.get('status') == 'connected':
        print("   [OK] Composio connection successful!")
        print(f"   Workspace ID: {connection_result.get('workspace_id', 'N/A')}")
    elif connection_result.get('status') == 'disabled':
        print("   [WARN] Composio is disabled in configuration")
    else:
        print("   [ERROR] Composio connection failed")
        print(f"   Error: {connection_result.get('error', 'Unknown error')}")
        print("\n   To fix:")
        print("   - Set COMPOSIO_API_KEY in .env")
        print("   - Set COMPOSIO_BASE_URL in .env")
        print("   - Set COMPOSIO_WORKSPACE_ID in .env")
    
    # Test app ID retrieval
    print("\n2. Testing app ID configuration...")
    apps_to_test = ["census", "uhaul", "dot", "rent", "geospatial"]
    for app_name in apps_to_test:
        app_id = get_app_id(app_name)
        if app_id and app_id and not app_id.startswith("${"):
            print(f"   [OK] {app_name}: {app_id}")
        else:
            print(f"   [WARN] {app_name}: Not configured (set COMPOSIO_APP_{app_name.upper()})")
    
    # Test app call (if configured)
    print("\n3. Testing Composio app call...")
    census_app_id = get_app_id("census")
    if census_app_id:
        print(f"   Attempting to call Census app ({census_app_id})...")
        try:
            app_result = await call_composio_app(
                app_name="census",
                action="test",
                parameters={"test": True}
            )
            print(f"   Status: {app_result.get('status')}")
            if app_result.get('status') == 'success':
                print("   [OK] App call successful!")
            else:
                print(f"   [WARN] App call returned: {app_result.get('error', 'Unknown')}")
        except Exception as e:
            print(f"   [ERROR] App call failed: {e}")
    else:
        print("   [WARN] Census app not configured")
        print("   Set COMPOSIO_APP_CENSUS in .env to test app calls")


async def main():
    """Run all integration tests."""
    print("\n" + "="*60)
    print("IMO-Creator Integration Test Suite")
    print("="*60)
    print("\nLoading global configuration...")
    
    try:
        config = load_global_config()
        print(f"[OK] Configuration loaded ({len(config)} sections)")
    except Exception as e:
        print(f"[WARN] Configuration load warning: {e}")
    
    # Test n8n
    await test_n8n()
    
    # Test Composio
    await test_composio()
    
    print("\n" + "="*60)
    print("Test Suite Complete")
    print("="*60)
    print("\nFor detailed setup instructions, see:")
    print("  - imo_creator/INTEGRATIONS.md")
    print("  - imo_creator/SETUP_GUIDE.md")
    print("\n")


if __name__ == "__main__":
    asyncio.run(main())

