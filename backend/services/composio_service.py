"""
Composio API orchestration service integration.
"""
import os
import httpx
from typing import Dict, Any, Optional
import logging
from backend.config.settings import GLOBAL_CONFIG

# Try to import IMO-Creator credentials
try:
    from imo_creator.config.credentials import get_composio_credentials
    IMO_CREDENTIALS_AVAILABLE = True
except ImportError:
    IMO_CREDENTIALS_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning(
        "IMO-Creator credentials module not available, "
        "using environment/config only"
    )

logger = logging.getLogger(__name__)


def get_composio_config() -> Dict[str, Any]:
    """
    Get Composio configuration from IMO-Creator credentials, environment, and global config.
    
    Priority:
    1. IMO-Creator credentials.yaml
    2. Environment variables
    3. Global config
    """
    # Try to load from IMO-Creator credentials first
    if IMO_CREDENTIALS_AVAILABLE:
        try:
            imo_creds = get_composio_credentials()
            if imo_creds.get("api_key") or imo_creds.get("workspace_id"):
                logger.info("Using Composio credentials from IMO-Creator")
                return {
                    "base_url": imo_creds.get(
                        "base_url", "https://api.composio.dev"
                    ),
                    "api_key": imo_creds.get("api_key", ""),
                    "workspace_id": imo_creds.get("workspace_id", ""),
                    "timeout": imo_creds.get("timeout", 30),
                    "max_retries": imo_creds.get("max_retries", 3),
                    "retry_delay": imo_creds.get("retry_delay", 1),
                    "apps": imo_creds.get("apps", {}),
                    "enabled": os.getenv(
                        "COMPOSIO_ENABLED", "true"
                    ).lower() == "true"
                }
        except Exception as e:
            logger.warning(f"Failed to load IMO-Creator Composio credentials: {e}")
    
    # Fallback to environment and global config
    composio_config = GLOBAL_CONFIG.get("composio", {})
    
    return {
        "base_url": os.getenv(
            "COMPOSIO_BASE_URL",
            composio_config.get("base_url", "https://api.composio.dev")
        ),
        "api_key": os.getenv(
            "COMPOSIO_API_KEY", composio_config.get("api_key", "")
        ),
        "workspace_id": os.getenv(
            "COMPOSIO_WORKSPACE_ID",
            composio_config.get("workspace_id", "")
        ),
        "timeout": int(os.getenv(
            "COMPOSIO_TIMEOUT", composio_config.get("timeout", 30)
        )),
        "max_retries": int(os.getenv(
            "COMPOSIO_MAX_RETRIES", composio_config.get("max_retries", 3)
        )),
        "retry_delay": int(os.getenv(
            "COMPOSIO_RETRY_DELAY", composio_config.get("retry_delay", 1)
        )),
        "apps": composio_config.get("apps", {}),
        "enabled": os.getenv(
            "COMPOSIO_ENABLED", "true"
        ).lower() == "true"
    }


def get_app_id(app_name: str) -> Optional[str]:
    """
    Get Composio app ID for a service.
    
    Priority:
    1. IMO-Creator credentials.yaml
    2. Environment variables
    3. Global config
    
    Args:
        app_name: Name of the app (census, uhaul, dot, rent, geospatial)
    
    Returns:
        App ID or None
    """
    # Try IMO-Creator credentials first
    if IMO_CREDENTIALS_AVAILABLE:
        try:
            config = get_composio_config()
            apps = config.get("apps", {})
            app_id = apps.get(app_name.lower())
            if app_id:
                return app_id
        except Exception:
            pass
    
    # Try environment variable
    env_key = f"COMPOSIO_APP_{app_name.upper()}"
    app_id = os.getenv(env_key)
    
    if app_id:
        return app_id
    
    # Try global config
    apps = GLOBAL_CONFIG.get("composio", {}).get("apps", {})
    return apps.get(app_name.lower())


async def call_composio_app(
    app_name: str,
    action: str,
    parameters: Optional[Dict[str, Any]] = None,
    app_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Call a Composio-connected app to execute an action.
    
    Args:
        app_name: Name of the app (census, uhaul, dot, rent, geospatial)
        action: Action to execute (e.g., "get_population", "get_migration_data")
        parameters: Parameters for the action
        app_id: Optional app ID (overrides lookup)
    
    Returns:
        Action execution result
    """
    config = get_composio_config()
    
    if not config["enabled"]:
        logger.warning("Composio is disabled in configuration")
        return {"status": "disabled", "message": "Composio integration is disabled"}
    
    # Get app ID
    if not app_id:
        app_id = get_app_id(app_name)
        if not app_id:
            raise ValueError(f"Composio app ID not configured for: {app_name}")
    
    if not config["api_key"]:
        raise ValueError("COMPOSIO_API_KEY not configured")
    
    if not config["workspace_id"]:
        raise ValueError("COMPOSIO_WORKSPACE_ID not configured")
    
    url = f"{config['base_url']}/v1/actions/{app_id}/{action}"
    
    try:
        async with httpx.AsyncClient(timeout=config["timeout"]) as client:
            response = await client.post(
                url,
                json={
                    "parameters": parameters or {},
                    "workspace_id": config["workspace_id"]
                },
                headers={
                    "Authorization": f"Bearer {config['api_key']}",
                    "Content-Type": "application/json"
                }
            )
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Composio action executed successfully: {app_name}.{action}")
            return {
                "status": "success",
                "app": app_name,
                "action": action,
                "data": result
            }
            
    except httpx.HTTPError as e:
        logger.error(f"Composio action failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "app": app_name,
            "action": action
        }
    except Exception as e:
        logger.error(f"Unexpected error calling Composio: {e}")
        raise


async def check_composio_connection() -> Dict[str, Any]:
    """
    Check Composio connection and authentication.
    
    Returns:
        Connection test result
    """
    config = get_composio_config()
    
    if not config["enabled"]:
        return {"status": "disabled", "message": "Composio is disabled"}
    
    if not config["api_key"]:
        return {"status": "error", "error": "COMPOSIO_API_KEY not configured"}
    
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            # Test connection to Composio API
            response = await client.get(
                f"{config['base_url']}/v1/workspaces/{config['workspace_id']}",
                headers={
                    "Authorization": f"Bearer {config['api_key']}"
                }
            )
            response.raise_for_status()
            
            return {
                "status": "connected",
                "base_url": config["base_url"],
                "workspace_id": config["workspace_id"],
                "message": "Composio connection successful"
            }
            
    except Exception as e:
        logger.error(f"Composio connection check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "base_url": config["base_url"]
        }

