"""
IMO-Creator credential and configuration loader.
Loads credentials and hub settings from global_config.yaml and environment variables.
"""
import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


def get_project_root() -> Path:
    """Get the project root directory."""
    # Try multiple possible locations
    possible_paths = [
        Path(__file__).parent.parent.parent,  # storage container go-nogo/
        Path(__file__).parent.parent.parent.parent / "storage container go-nogo",
        Path.cwd(),
    ]

    for path in possible_paths:
        config_path = path / "config" / "global_config.yaml"
        if config_path.exists():
            return path

    return Path(__file__).parent.parent.parent


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


def load_global_config() -> Dict[str, Any]:
    """
    Load the global configuration from global_config.yaml.

    Returns:
        Dictionary with all configuration settings
    """
    project_root = get_project_root()
    config_path = project_root / "config" / "global_config.yaml"

    if config_path.exists():
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f) or {}
            logger.info(f"Loaded global config from {config_path}")
            return config
        except Exception as e:
            logger.warning(f"Failed to load global config: {e}")

    logger.warning("global_config.yaml not found, using defaults")
    return {}


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


# ============================================================================
# PASS-1 HUB CONFIGURATION
# ============================================================================

def get_pass1_config() -> Dict[str, Any]:
    """
    Get Pass-1 Hub configuration.

    Returns:
        Dictionary with Pass-1 hub settings
    """
    config = load_global_config()
    return config.get("pass1_hub", {
        "enabled": True,
        "spokes": [
            "ZipHydration", "RadiusBuilder", "MacroDemand", "MacroSupply",
            "HotspotScoring", "LocalScan", "CallSheet", "CompetitorEnrichment",
            "ValidationGate"
        ],
        "macro_demand": {"sqft_per_capita": 6, "sqft_per_household": 15},
        "macro_supply": {"default_sqft_per_competitor": 45000},
        "hotspot_scoring": {
            "weights": {
                "population": 0.25, "competition": 0.25, "industrial": 0.20,
                "multifamily": 0.15, "recreation": 0.15
            },
            "tier_thresholds": {"A": 80, "B": 65, "C": 50, "D": 0}
        },
        "validation_gate": {
            "min_population": 1000,
            "min_income": 25000,
            "min_viability_score": 20,
            "min_competitors_for_pricing": 3
        }
    })


# ============================================================================
# PASS-2 HUB CONFIGURATION
# ============================================================================

def get_pass2_config() -> Dict[str, Any]:
    """
    Get Pass-2 Hub configuration.

    Returns:
        Dictionary with Pass-2 hub settings
    """
    config = load_global_config()
    return config.get("pass2_hub", {
        "enabled": True,
        "spokes": [
            "Zoning", "CivilConstraints", "Permits", "PricingVerification",
            "Momentum", "FusionDemand", "CompetitivePressure", "Feasibility",
            "ReverseFeasibility", "Verdict", "VaultMapper"
        ],
        "civil_constraints": {
            "parking": {"sqft_per_stall": 180, "cost_per_ada_space": 2500},
            "lot_coverage": {"default_max_pct": 50, "building_efficiency": 0.40},
            "topography": {"grading_cost_per_acre": 5000},
            "stormwater": {"bmp_cost_per_acre": 15000},
            "bonding": {
                "high_requirement_states": ["TX", "CA", "FL"],
                "high_bond_amount": 25000,
                "default_bond_amount": 20000
            }
        },
        "feasibility": {
            "defaults": {
                "construction_cost_sqft": 30,
                "cap_rate_target": 0.065,
                "expense_ratio": 0.35,
                "target_occupancy": 0.88,
                "ltv_ratio": 0.70,
                "debt_rate": 0.07
            },
            "viability": {"min_cap_rate": 6.5, "min_roi_5yr": 25, "min_dscr": 1.25}
        },
        "verdict": {
            "weights": {
                "feasibility": 0.30, "fusion_demand": 0.25, "zoning": 0.15,
                "permits": 0.15, "civil": 0.15
            },
            "thresholds": {"proceed": 75, "evaluate": 50, "walk": 0},
            "fatal_flaws": [
                "lot_coverage_infeasible", "zoning_prohibited",
                "prohibitive_topography", "negative_dscr"
            ]
        }
    })


def get_civil_constraints_config() -> Dict[str, Any]:
    """Get civil constraints configuration."""
    pass2 = get_pass2_config()
    return pass2.get("civil_constraints", {})


def get_feasibility_defaults() -> Dict[str, Any]:
    """Get feasibility default values."""
    pass2 = get_pass2_config()
    return pass2.get("feasibility", {}).get("defaults", {})


def get_verdict_config() -> Dict[str, Any]:
    """Get verdict scoring configuration."""
    pass2 = get_pass2_config()
    return pass2.get("verdict", {})


# ============================================================================
# STATE RULES CONFIGURATION
# ============================================================================

def get_state_rules() -> Dict[str, Dict[str, Any]]:
    """
    Get state-level rules.

    Returns:
        Dictionary of state rules
    """
    config = load_global_config()
    return config.get("states", {}).get("rules", {})


def get_state_rule(state: str) -> Dict[str, Any]:
    """
    Get rules for a specific state.

    Args:
        state: State abbreviation (e.g., "TX", "VA")

    Returns:
        Dictionary with state-specific rules
    """
    rules = get_state_rules()
    return rules.get(state, {
        "default_county_difficulty": 50,
        "rent_multiplier": 1.0,
        "area_code": "000"
    })


def get_supported_states() -> List[str]:
    """Get list of supported states."""
    config = load_global_config()
    return config.get("states", {}).get("supported", ["WV", "PA", "MD", "VA"])


def get_bonding_amount(state: str) -> int:
    """
    Get construction bonding amount for a state.

    Args:
        state: State abbreviation

    Returns:
        Bonding amount in dollars
    """
    civil = get_civil_constraints_config()
    bonding = civil.get("bonding", {})

    if state in bonding.get("high_requirement_states", []):
        return bonding.get("high_bond_amount", 25000)
    if state in bonding.get("medium_requirement_states", []):
        return bonding.get("medium_bond_amount", 35000)
    return bonding.get("default_bond_amount", 20000)


# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================

def get_database_config() -> Dict[str, Any]:
    """
    Get database configuration.

    Returns:
        Dictionary with database settings
    """
    config = load_global_config()
    return config.get("database", {
        "pool_min_size": 2,
        "pool_max_size": 10,
        "command_timeout": 60,
        "tables": {
            "pass1_runs": "pass1_runs",
            "pass2_runs": "pass2_runs",
            "staging_payload": "staging_payload",
            "vault": "vault",
            "engine_logs": "engine_logs"
        }
    })


def get_table_name(table: str) -> str:
    """Get the actual table name for a logical table."""
    db_config = get_database_config()
    tables = db_config.get("tables", {})
    return tables.get(table, table)


# ============================================================================
# N8N CREDENTIALS
# ============================================================================

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

    # Load from global config
    global_config = load_global_config()
    n8n_config = global_config.get("n8n", {})

    # Override with environment variables if present
    result = {
        "enabled": n8n_config.get("enabled", True),
        "base_url": os.getenv("N8N_BASE_URL", n8n_creds.get("base_url", n8n_config.get("base_url", "http://localhost:5678"))),
        "api_key": os.getenv("N8N_API_KEY", n8n_creds.get("api_key", "")),
        "username": os.getenv("N8N_USERNAME", n8n_creds.get("username", "")),
        "password": os.getenv("N8N_PASSWORD", n8n_creds.get("password", "")),
        "timeout": int(os.getenv("N8N_TIMEOUT", n8n_creds.get("timeout", n8n_config.get("timeout", 30)))),
        "webhooks": {
            "screening": os.getenv("N8N_WEBHOOK_SCREENING", n8n_creds.get("webhooks", {}).get("screening", "")),
            "saturation": os.getenv("N8N_WEBHOOK_SATURATION", n8n_creds.get("webhooks", {}).get("saturation", "")),
            "scoring": os.getenv("N8N_WEBHOOK_SCORING", n8n_creds.get("webhooks", {}).get("scoring", "")),
            "parcel": os.getenv("N8N_WEBHOOK_PARCEL", n8n_creds.get("webhooks", {}).get("parcel", "")),
            "pass1_complete": os.getenv("N8N_WEBHOOK_PASS1_COMPLETE", n8n_creds.get("webhooks", {}).get("pass1_complete", "")),
            "pass2_complete": os.getenv("N8N_WEBHOOK_PASS2_COMPLETE", n8n_creds.get("webhooks", {}).get("pass2_complete", "")),
            "retell_callback": os.getenv("N8N_WEBHOOK_RETELL_CALLBACK", n8n_creds.get("webhooks", {}).get("retell_callback", "")),
        }
    }

    return result


# ============================================================================
# COMPOSIO CREDENTIALS
# ============================================================================

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

    # Load from global config
    global_config = load_global_config()
    composio_config = global_config.get("composio", {})

    # Override with environment variables if present
    apps = composio_creds.get("apps", composio_config.get("apps", {}))

    result = {
        "enabled": composio_config.get("enabled", True),
        "base_url": os.getenv("COMPOSIO_BASE_URL", composio_creds.get("base_url", composio_config.get("base_url", "https://api.composio.dev"))),
        "api_key": os.getenv("COMPOSIO_API_KEY", composio_creds.get("api_key", "")),
        "workspace_id": os.getenv("COMPOSIO_WORKSPACE_ID", composio_creds.get("workspace_id", "")),
        "timeout": int(os.getenv("COMPOSIO_TIMEOUT", composio_creds.get("timeout", composio_config.get("timeout", 30)))),
        "max_retries": int(os.getenv("COMPOSIO_MAX_RETRIES", composio_creds.get("max_retries", composio_config.get("max_retries", 3)))),
        "retry_delay": int(os.getenv("COMPOSIO_RETRY_DELAY", composio_creds.get("retry_delay", composio_config.get("retry_delay", 1)))),
        "apps": {
            "census": os.getenv("COMPOSIO_APP_CENSUS", apps.get("census", "")),
            "uhaul": os.getenv("COMPOSIO_APP_UHAUL", apps.get("uhaul", "")),
            "dot": os.getenv("COMPOSIO_APP_DOT", apps.get("dot", "")),
            "rent": os.getenv("COMPOSIO_APP_RENT", apps.get("rent", "")),
            "geospatial": os.getenv("COMPOSIO_APP_GEOSPATIAL", apps.get("geospatial", "")),
        }
    }

    return result


# ============================================================================
# RETELL.AI CREDENTIALS
# ============================================================================

def get_retell_credentials() -> Dict[str, Any]:
    """
    Get Retell.ai credentials from IMO-Creator.

    Checks:
    1. IMO-Creator credentials.yaml
    2. Environment variables
    3. Global config

    Returns:
        Dictionary with Retell.ai credentials
    """
    # Load from IMO-Creator credentials file
    credentials = load_credentials_from_file()
    retell_creds = credentials.get("retell", {})

    # Load from global config
    global_config = load_global_config()
    retell_config = global_config.get("retell", {})

    # Override with environment variables if present
    agent = retell_creds.get("agent", retell_config.get("agent", {}))
    script = retell_config.get("script", {})

    result = {
        "enabled": retell_config.get("enabled", True),
        "api_key": os.getenv("RETELL_API_KEY", retell_creds.get("api_key", "")),
        "base_url": os.getenv("RETELL_BASE_URL", retell_creds.get("base_url", retell_config.get("base_url", "https://api.retellai.com"))),
        "concurrency_limit": int(os.getenv("RETELL_CONCURRENCY_LIMIT", retell_creds.get("concurrency_limit", retell_config.get("concurrency_limit", 20)))),
        "webhook_url": os.getenv("RETELL_WEBHOOK_URL", retell_creds.get("webhook_url", retell_config.get("webhook_url", ""))),
        "agent": {
            "name": agent.get("name", "Storage Rate Collector"),
            "voice_id": agent.get("voice_id", "eleven_labs_amy"),
            "model": agent.get("model", "gpt-4o-mini"),
            "language": agent.get("language", "en-US"),
            "max_call_duration_seconds": agent.get("max_call_duration_seconds", 180),
            "silence_timeout_seconds": agent.get("silence_timeout_seconds", 10),
            "end_call_after_silence": agent.get("end_call_after_silence", True),
        },
        "script": {
            "greeting": script.get("greeting", "Hi, I'm calling to inquire about storage unit rates at your facility."),
            "unit_sizes": script.get("unit_sizes", ["5x5", "5x10", "10x10", "10x15", "10x20", "10x30"]),
            "questions": script.get("questions", [
                "What are your current rates for a {size} unit?",
                "Do you have any move-in specials or promotions?",
                "Is climate control available?",
                "What is the admin fee?"
            ])
        }
    }

    return result


# ============================================================================
# EXTERNAL API CREDENTIALS
# ============================================================================

def get_external_api_credentials() -> Dict[str, Any]:
    """
    Get external API credentials.

    Returns:
        Dictionary with external API keys
    """
    global_config = load_global_config()
    external = global_config.get("external_apis", {})

    return {
        "census": {
            "api_key": os.getenv("CENSUS_API_KEY", external.get("census", {}).get("api_key", "")),
            "base_url": external.get("census", {}).get("base_url", "https://api.census.gov/data")
        },
        "google": {
            "api_key": os.getenv("GOOGLE_API_KEY", external.get("google", {}).get("api_key", "")),
            "places_enabled": external.get("google", {}).get("places_enabled", True),
            "geocoding_enabled": external.get("google", {}).get("geocoding_enabled", True)
        },
        "data_gov": {
            "api_key": os.getenv("DATA_GOV_API_KEY", external.get("data_gov", {}).get("api_key", ""))
        },
        "fbi": {
            "api_key": os.getenv("FBI_API_KEY", external.get("fbi", {}).get("api_key", ""))
        },
        "recreation_gov": {
            "api_key": os.getenv("RECREATION_GOV_API_KEY", external.get("recreation_gov", {}).get("api_key", ""))
        },
        "firecrawl": {
            "api_key": os.getenv("FIRECRAWL_API_KEY", external.get("firecrawl", {}).get("api_key", ""))
        },
        "scraper_api": {
            "api_key": os.getenv("SCRAPER_API_KEY", external.get("scraper_api", {}).get("api_key", ""))
        }
    }


# ============================================================================
# SUPABASE/NEON CREDENTIALS
# ============================================================================

def get_supabase_credentials() -> Dict[str, Any]:
    """Get Supabase credentials."""
    global_config = load_global_config()
    supabase = global_config.get("supabase", {})

    return {
        "url": os.getenv("SUPABASE_URL", supabase.get("url", "")),
        "anon_key": os.getenv("SUPABASE_ANON_KEY", supabase.get("anon_key", "")),
        "service_role_key": os.getenv("SUPABASE_SERVICE_ROLE_KEY", supabase.get("service_role_key", ""))
    }


def get_neon_credentials() -> Dict[str, Any]:
    """Get Neon database credentials."""
    global_config = load_global_config()
    neon = global_config.get("neon", {})

    return {
        "connection_string": os.getenv("NEON_CONNECTION_STRING", neon.get("connection_string", "")),
        "database_url": os.getenv("NEON_DATABASE_URL", neon.get("database_url", "")),
        "pool_size": neon.get("pool_size", 10)
    }
