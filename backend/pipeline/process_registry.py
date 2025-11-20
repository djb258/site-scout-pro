"""
Process registry for IMO-Creator pipelines.
"""
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
import logging
from backend.config.settings import GLOBAL_CONFIG

logger = logging.getLogger(__name__)

PROCESS_REGISTRY: Dict[str, Any] = {}


def get_registry_path() -> Path:
    """Get the path to process_registry.yaml."""
    registry_file = GLOBAL_CONFIG.get("process_registry", {}).get("registry_file", "ctb/process_registry.yaml")
    
    possible_paths = [
        Path(__file__).parent.parent.parent / registry_file,
        Path(__file__).parent.parent / registry_file,
        Path(registry_file),
    ]
    
    for path in possible_paths:
        if path.exists():
            return path
    
    # Return default path
    return Path(__file__).parent.parent.parent / "ctb" / "process_registry.yaml"


def load_process_registry(registry_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Load process registry from YAML file.
    
    Args:
        registry_path: Optional path to registry file
    
    Returns:
        Process registry dictionary
    """
    global PROCESS_REGISTRY
    
    if PROCESS_REGISTRY:
        return PROCESS_REGISTRY
    
    if registry_path is None:
        registry_path = get_registry_path()
    
    try:
        if not registry_path.exists():
            logger.warning(f"Registry file not found at {registry_path}, using defaults")
            PROCESS_REGISTRY = get_default_registry()
            return PROCESS_REGISTRY
        
        with open(registry_path, 'r') as f:
            PROCESS_REGISTRY = yaml.safe_load(f) or {}
        
        logger.info(f"Process registry loaded from {registry_path}")
        return PROCESS_REGISTRY
        
    except Exception as e:
        logger.error(f"Failed to load registry from {registry_path}: {e}")
        logger.info("Using default process registry")
        PROCESS_REGISTRY = get_default_registry()
        return PROCESS_REGISTRY


def get_default_registry() -> Dict[str, Any]:
    """Get default process registry."""
    return {
        "site_scoring_pipeline": {
            "altitude_layer": "20k",
            "doctrine_reference": "Barton Doctrine - Systematic Elimination",
            "api_endpoint": "/api/score",
            "neon_table": "site_candidate",
            "process_logging": True,
            "steps": [
                {
                    "name": "saturation_calculation",
                    "type": "processor",
                    "processor": "backend.core.saturation.calculate_saturation"
                },
                {
                    "name": "parcel_viability",
                    "type": "processor",
                    "processor": "backend.core.calculations.calculate_parcel_viability"
                },
                {
                    "name": "financial_score",
                    "type": "processor",
                    "processor": "backend.core.calculations.calculate_financial_score"
                },
                {
                    "name": "final_score",
                    "type": "processor",
                    "processor": "backend.core.calculations.calculate_final_score"
                }
            ]
        },
        "saturation_pipeline": {
            "altitude_layer": "20k",
            "doctrine_reference": "Saturation Analysis",
            "api_endpoint": "/api/saturation",
            "neon_table": "saturation_matrix",
            "process_logging": True,
            "steps": [
                {
                    "name": "calculate_saturation",
                    "type": "processor",
                    "processor": "backend.core.saturation.calculate_saturation"
                }
            ]
        },
        "parcel_screening_pipeline": {
            "altitude_layer": "20k",
            "doctrine_reference": "Parcel Viability Analysis",
            "api_endpoint": "/api/parcels",
            "neon_table": "parcel_screening",
            "process_logging": True,
            "steps": [
                {
                    "name": "screen_parcel",
                    "type": "processor",
                    "processor": "backend.core.parcel_screening.screen_parcel"
                }
            ]
        },
        "county_scoring_pipeline": {
            "altitude_layer": "30k",
            "doctrine_reference": "County Rules Analysis",
            "api_endpoint": "/api/county",
            "neon_table": "county_score",
            "process_logging": True,
            "steps": [
                {
                    "name": "county_difficulty",
                    "type": "processor",
                    "processor": "backend.core.calculations.calculate_county_difficulty"
                }
            ]
        },
        "final_elimination_pipeline": {
            "altitude_layer": "20k",
            "doctrine_reference": "Final Elimination Process",
            "api_endpoint": "/api/elimination",
            "neon_table": "site_candidate",
            "process_logging": True,
            "steps": [
                {
                    "name": "validate_final_score",
                    "type": "validator",
                    "rules": {
                        "final_score": {
                            "type": int,
                            "required": True,
                            "min": 0,
                            "max": 100
                        }
                    }
                },
                {
                    "name": "apply_elimination_rules",
                    "type": "processor",
                    "processor": "backend.core.rules.should_eliminate_by_final_score"
                }
            ]
        }
    }


# Load registry on import
PROCESS_REGISTRY = load_process_registry()

