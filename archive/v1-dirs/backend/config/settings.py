"""
Global configuration loader and settings management.
"""
import yaml
import os
from pathlib import Path
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

_GLOBAL_CONFIG: Optional[Dict[str, Any]] = None


def get_config_path() -> Path:
    """Get the path to global_config.yaml."""
    # Try multiple possible locations
    possible_paths = [
        Path(__file__).parent.parent.parent / "config" / "global_config.yaml",
        Path(__file__).parent.parent / "config" / "global_config.yaml",
        Path("config") / "global_config.yaml",
        Path("global_config.yaml"),
    ]
    
    for path in possible_paths:
        if path.exists():
            return path
    
    # Return default path
    return Path(__file__).parent.parent.parent / "config" / "global_config.yaml"


def load_global_config(config_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Load global configuration from YAML file.
    
    Args:
        config_path: Optional path to config file
    
    Returns:
        Configuration dictionary
    """
    global _GLOBAL_CONFIG
    
    if _GLOBAL_CONFIG is not None:
        return _GLOBAL_CONFIG
    
    if config_path is None:
        config_path = get_config_path()
    
    try:
        if not config_path.exists():
            logger.warning(f"Config file not found at {config_path}, using defaults")
            _GLOBAL_CONFIG = get_default_config()
            return _GLOBAL_CONFIG
        
        with open(config_path, 'r') as f:
            _GLOBAL_CONFIG = yaml.safe_load(f) or {}
        
        # Merge with defaults to ensure all keys exist
        defaults = get_default_config()
        _GLOBAL_CONFIG = merge_config(defaults, _GLOBAL_CONFIG)
        
        logger.info(f"Global configuration loaded from {config_path}")
        return _GLOBAL_CONFIG
        
    except Exception as e:
        logger.error(f"Failed to load config from {config_path}: {e}")
        logger.info("Using default configuration")
        _GLOBAL_CONFIG = get_default_config()
        return _GLOBAL_CONFIG


def get_default_config() -> Dict[str, Any]:
    """Get default configuration values."""
    return {
        "doctrine": {
            "STAMPED": True,
            "SPVPET": True,
            "STACKED": True,
            "BARTON_DOCTRINE": True
        },
        "scoring": {
            "weights": {
                "saturation": 0.25,
                "parcel": 0.25,
                "county": 0.20,
                "financial": 0.30
            }
        },
        "saturation": {
            "sqft_per_person": 6,
            "undersupplied_threshold": 0.7,
            "oversupplied_threshold": 1.1,
            "elimination_threshold": 1.1
        },
        "financial": {
            "units": 116,
            "vacancy_rate": 0.20,
            "rented_units": 92,
            "build_cost": 400000,
            "loan_payment": 2577,
            "rent_low": 80,
            "rent_high": 120,
            "min_dscr": 1.0
        },
        "parcel": {
            "shape_threshold": 50,
            "slope_threshold": 50,
            "access_threshold": 50,
            "floodplain_elimination": True
        },
        "elimination": {
            "min_population": 5000,
            "min_households": 2000,
            "min_traffic_count": 5000,
            "max_county_difficulty": 50,
            "min_final_score": 60
        },
        "states": {
            "supported": ["WV", "PA", "MD", "VA"],
            "rules": {}
        },
        "county": {
            "default_difficulty": 50,
            "fast_permitting_score": 80,
            "slow_permitting_score": 20
        },
        "api": {
            "prefix": "/api",
            "version": "1.0.0",
            "title": "Storage Site Scouting API"
        },
        "database": {
            "pool_min_size": 2,
            "pool_max_size": 10,
            "command_timeout": 60,
            "table_prefix": ""
        },
        "logging": {
            "level": "INFO",
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S"
        },
        "process_registry": {
            "enabled": True,
            "auto_load": True,
            "registry_file": "ctb/process_registry.yaml"
        },
        "imo_creator": {
            "enabled": True,
            "template_dir": "imo_creator/templates",
            "processor_dir": "imo_creator/processors",
            "pipeline_dir": "imo_creator/pipeline"
        },
        "n8n": {
            "enabled": True,
            "base_url": "http://localhost:5678",
            "api_key": "",
            "timeout": 30
        },
        "composio": {
            "enabled": True,
            "base_url": "https://api.composio.dev",
            "api_key": "",
            "workspace_id": "",
            "timeout": 30,
            "max_retries": 3,
            "retry_delay": 1
        }
    }


def merge_config(default: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively merge two configuration dictionaries."""
    result = default.copy()
    
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_config(result[key], value)
        else:
            result[key] = value
    
    return result


def get_config_value(key_path: str, default: Any = None) -> Any:
    """
    Get a configuration value by dot-separated key path.
    
    Args:
        key_path: Dot-separated path (e.g., "scoring.weights.saturation")
        default: Default value if key not found
    
    Returns:
        Configuration value or default
    """
    config = load_global_config()
    keys = key_path.split('.')
    value = config
    
    for key in keys:
        if isinstance(value, dict) and key in value:
            value = value[key]
        else:
            return default
    
    return value


# Global config instance
GLOBAL_CONFIG = load_global_config()

