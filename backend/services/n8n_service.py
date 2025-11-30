"""
n8n workflow automation service integration.
"""
import os
import httpx
from typing import Dict, Any, Optional
import logging
from backend.config.settings import GLOBAL_CONFIG, get_config_value

# Try to import IMO-Creator credentials
try:
    from imo_creator.config.credentials import get_n8n_credentials
    IMO_CREDENTIALS_AVAILABLE = True
except ImportError:
    IMO_CREDENTIALS_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("IMO-Creator credentials module not available, using environment/config only")

logger = logging.getLogger(__name__)


def get_n8n_config() -> Dict[str, Any]:
    """
    Get n8n configuration from IMO-Creator credentials, environment, and global config.
    
    Priority:
    1. IMO-Creator credentials.yaml
    2. Environment variables
    3. Global config
    """
    # Try to load from IMO-Creator credentials first
    if IMO_CREDENTIALS_AVAILABLE:
        try:
            imo_creds = get_n8n_credentials()
            if imo_creds.get("api_key") or imo_creds.get("base_url") != "http://localhost:5678":
                logger.info("Using n8n credentials from IMO-Creator")
                return {
                    "base_url": imo_creds.get("base_url", "http://localhost:5678"),
                    "api_key": imo_creds.get("api_key", ""),
                    "username": imo_creds.get("username", ""),
                    "password": imo_creds.get("password", ""),
                    "timeout": imo_creds.get("timeout", 30),
                    "webhooks": imo_creds.get("webhooks", {}),
                    "enabled": os.getenv("N8N_ENABLED", "true").lower() == "true"
                }
        except Exception as e:
            logger.warning(f"Failed to load IMO-Creator n8n credentials: {e}")
    
    # Fallback to environment and global config
    n8n_config = GLOBAL_CONFIG.get("n8n", {})
    
    return {
        "base_url": os.getenv("N8N_BASE_URL", n8n_config.get("base_url", "http://localhost:5678")),
        "api_key": os.getenv("N8N_API_KEY", n8n_config.get("api_key", "")),
        "username": os.getenv("N8N_USERNAME", ""),
        "password": os.getenv("N8N_PASSWORD", ""),
        "timeout": int(os.getenv("N8N_TIMEOUT", n8n_config.get("timeout", 30))),
        "webhooks": {},
        "enabled": os.getenv("N8N_ENABLED", "true").lower() == "true"
    }


async def trigger_workflow(
    webhook_url: Optional[str] = None,
    workflow_name: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Trigger an n8n workflow via webhook or API.
    
    Args:
        webhook_url: Direct webhook URL (overrides workflow_name)
        workflow_name: Name of workflow (uses configured webhook)
        data: Data to send to workflow
    
    Returns:
        Workflow execution result
    """
    config = get_n8n_config()
    
    if not config["enabled"]:
        logger.warning("n8n is disabled in configuration")
        return {"status": "disabled", "message": "n8n integration is disabled"}
    
    # Determine webhook URL
    if webhook_url:
        url = webhook_url
    elif workflow_name:
        # Get webhook URL from config (check IMO-Creator credentials first, then global config, then env)
        config = get_n8n_config()
        webhooks = config.get("webhooks", {})
        url = webhooks.get(workflow_name) or os.getenv(f"N8N_WEBHOOK_{workflow_name.upper()}")
        
        # Fallback to global config
        if not url:
            webhooks = GLOBAL_CONFIG.get("n8n", {}).get("webhooks", {})
            url = webhooks.get(workflow_name)
        
        if not url:
            raise ValueError(f"Webhook URL not configured for workflow: {workflow_name}")
    else:
        raise ValueError("Either webhook_url or workflow_name must be provided")
    
    try:
        async with httpx.AsyncClient(timeout=config["timeout"]) as client:
            response = await client.post(
                url,
                json=data or {},
                headers={
                    "Content-Type": "application/json"
                }
            )
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"n8n workflow triggered successfully: {workflow_name or webhook_url}")
            return {
                "status": "success",
                "workflow": workflow_name,
                "data": result
            }
            
    except httpx.HTTPError as e:
        logger.error(f"n8n workflow trigger failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "workflow": workflow_name
        }
    except Exception as e:
        logger.error(f"Unexpected error triggering n8n workflow: {e}")
        raise


async def check_n8n_connection() -> Dict[str, Any]:
    """
    Check n8n connection and authentication.
    
    Returns:
        Connection test result
    """
    config = get_n8n_config()
    
    if not config["enabled"]:
        return {"status": "disabled", "message": "n8n is disabled"}
    
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            # Test connection to n8n API
            if config["api_key"]:
                response = await client.get(
                    f"{config['base_url']}/api/v1/workflows",
                    headers={
                        "X-N8N-API-KEY": config["api_key"]
                    }
                )
            else:
                # Test basic connectivity
                response = await client.get(f"{config['base_url']}/healthz")
            
            response.raise_for_status()
            
            return {
                "status": "connected",
                "base_url": config["base_url"],
                "message": "n8n connection successful"
            }
            
    except Exception as e:
        logger.error(f"n8n connection check failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "base_url": config["base_url"]
        }

