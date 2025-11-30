"""
IMO-Creator credential loader.
Loads n8n and Composio credentials from IMO-Creator configuration.
"""
import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


def get_imo_creator_root() -> Path:
    """Get the IMO-Creator root directory."""
    # Try multiple possible locations
    possible_paths = [
        Path(__file__).parent.parent,  # imo_creator/
        Path(__file__).parent.parent.parent / "imo_creator",
        Path("imo_creator"),
    ]
    
    for path in possible_paths:
        if path.exists() and path.is_dir():
            return path
    
    return Path(__file__).parent.parent


def load_credentials_from_file(credential_file: str = "credentials.yaml") -> Dict[str, Any]:
    """
    Load credentials from IMO-Creator credential file.
    
    Args:
        credential_file: Name of credential file to load
    
    Returns:
        Dictionary of credentials
    """
    imo_root = get_imo_creator_root()
    credential_paths = [
        imo_root / "config" / credential_file,
        imo_root / "global" / credential_file,
        imo_root / credential_file,
        Path("imo_creator") / "config" / credential_file,
        Path("imo_creator") / "global" / credential_file,
    ]
    
    for path in credential_paths:
        if path.exists():
            try:
                with open(path, 'r') as f:
                    credentials = yaml.safe_load(f) or {}
                logger.info(f"Loaded credentials from {path}")
                return credentials
            except Exception as e:
                logger.warning(f"Failed to load credentials from {path}: {e}")
    
    logger.warning(f"Credential file {credential_file} not found in IMO-Creator")
    return {}


def get_n8n_credentials() -> Dict[str, Any]:
    """
    Get n8n credentials from IMO-Creator.
    
    Checks:
    1. IMO-Creator credentials.yaml
    2. Environment variables
    3. Global config
    
    Returns:
        Dictionary with n8n credentials
    """
    # Load from IMO-Creator credentials file
    credentials = load_credentials_from_file()
    n8n_creds = credentials.get("n8n", {})
    
    # Override with environment variables if present
    result = {
        "base_url": os.getenv("N8N_BASE_URL", n8n_creds.get("base_url", "http://localhost:5678")),
        "api_key": os.getenv("N8N_API_KEY", n8n_creds.get("api_key", "")),
        "username": os.getenv("N8N_USERNAME", n8n_creds.get("username", "")),
        "password": os.getenv("N8N_PASSWORD", n8n_creds.get("password", "")),
        "timeout": int(os.getenv("N8N_TIMEOUT", n8n_creds.get("timeout", 30))),
        "webhooks": {
            "screening": os.getenv("N8N_WEBHOOK_SCREENING", n8n_creds.get("webhooks", {}).get("screening", "")),
            "saturation": os.getenv("N8N_WEBHOOK_SATURATION", n8n_creds.get("webhooks", {}).get("saturation", "")),
            "scoring": os.getenv("N8N_WEBHOOK_SCORING", n8n_creds.get("webhooks", {}).get("scoring", "")),
            "parcel": os.getenv("N8N_WEBHOOK_PARCEL", n8n_creds.get("webhooks", {}).get("parcel", "")),
        }
    }
    
    return result


def get_composio_credentials() -> Dict[str, Any]:
    """
    Get Composio credentials from IMO-Creator.
    
    Checks:
    1. IMO-Creator credentials.yaml
    2. Environment variables
    3. Global config
    
    Returns:
        Dictionary with Composio credentials
    """
    # Load from IMO-Creator credentials file
    credentials = load_credentials_from_file()
    composio_creds = credentials.get("composio", {})
    
    # Override with environment variables if present
    apps = composio_creds.get("apps", {})
    
    result = {
        "base_url": os.getenv("COMPOSIO_BASE_URL", composio_creds.get("base_url", "https://api.composio.dev")),
        "api_key": os.getenv("COMPOSIO_API_KEY", composio_creds.get("api_key", "")),
        "workspace_id": os.getenv("COMPOSIO_WORKSPACE_ID", composio_creds.get("workspace_id", "")),
        "timeout": int(os.getenv("COMPOSIO_TIMEOUT", composio_creds.get("timeout", 30))),
        "max_retries": int(os.getenv("COMPOSIO_MAX_RETRIES", composio_creds.get("max_retries", 3))),
        "retry_delay": int(os.getenv("COMPOSIO_RETRY_DELAY", composio_creds.get("retry_delay", 1))),
        "apps": {
            "census": os.getenv("COMPOSIO_APP_CENSUS", apps.get("census", "")),
            "uhaul": os.getenv("COMPOSIO_APP_UHAUL", apps.get("uhaul", "")),
            "dot": os.getenv("COMPOSIO_APP_DOT", apps.get("dot", "")),
            "rent": os.getenv("COMPOSIO_APP_RENT", apps.get("rent", "")),
            "geospatial": os.getenv("COMPOSIO_APP_GEOSPATIAL", apps.get("geospatial", "")),
        }
    }
    
    return result

