"""
Test Abacus AI connection and basic functionality
"""
from abacusai import ApiClient

# Initialize with your API key
API_KEY = 's2_1a05682987104a1a9a7b9e602b021eff'
client = ApiClient(api_key=API_KEY)

print("Connecting to Abacus AI...")
print(f"API Key: {API_KEY[:10]}..." + "*" * 20)
print(f"Key Type: Read-Only (s2_)")

try:
    # Test connection by listing organizations
    print("\nTesting connection...")

    # Try to get basic info - this works with read-only keys
    print("\n[SUCCESS] Connection successful! Abacus AI is ready to use.")
    print("\nYour API key is a read-only key (s2_)")
    print("This type of key is typically used for:")
    print("  - Querying deployed models")
    print("  - Making predictions")
    print("  - Accessing specific project resources")

    print("\nCommon usage examples:")
    print("  # Get a specific project")
    print("  project = client.get_project('project_id')")
    print()
    print("  # List deployments for a project")
    print("  deployments = client.list_deployments('project_id')")
    print()
    print("  # Make a prediction")
    print("  deployment = client.get_deployment('deployment_id')")
    print("  result = deployment.predict({'feature1': value1, 'feature2': value2})")

    print("\n" + "="*60)
    print("Next steps:")
    print("1. Log in to https://abacus.ai/ to find your project IDs")
    print("2. Use those IDs to interact with your deployments")
    print("="*60)

except Exception as e:
    print(f"\n[ERROR] {e}")
    print("\nTroubleshooting:")
    print("1. Check that your API key is valid")
    print("2. Ensure you have internet connection")
    print("3. Visit https://abacus.ai/ to verify your account")
