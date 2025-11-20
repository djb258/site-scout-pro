"""
IMO-Creator template engine wrapper.
"""
from typing import Dict, Any, Optional
from pathlib import Path
import json
import logging
from backend.config.settings import GLOBAL_CONFIG

logger = logging.getLogger(__name__)


def render_template(template_name: str, data: Dict[str, Any]) -> str:
    """
    Render a template with data.
    
    Args:
        template_name: Name of the template
        data: Data to render
    
    Returns:
        Rendered template string
    """
    try:
        # Get template directory from config
        template_dir = GLOBAL_CONFIG.get("imo_creator", {}).get("template_dir", "imo_creator/templates")
        template_path = Path(template_dir) / f"{template_name}.json"
        
        if template_path.exists():
            # Load template
            with open(template_path, 'r') as f:
                template = json.load(f)
            
            # Render template
            return render_json_template(template, data)
        else:
            # Use default template rendering
            return render_default_template(template_name, data)
            
    except Exception as e:
        logger.error(f"Failed to render template {template_name}: {e}")
        return render_default_template(template_name, data)


def render_json_template(template: Dict[str, Any], data: Dict[str, Any]) -> str:
    """Render a JSON template."""
    result = {}
    
    for key, value in template.items():
        if isinstance(value, str) and value.startswith("{{") and value.endswith("}}"):
            # Template variable
            var_path = value[2:-2].strip()
            result[key] = get_nested_value(data, var_path)
        elif isinstance(value, dict):
            result[key] = render_json_template(value, data)
        elif isinstance(value, list):
            result[key] = [render_json_template(item, data) if isinstance(item, dict) else item for item in value]
        else:
            result[key] = value
    
    return json.dumps(result, indent=2)


def get_nested_value(data: Dict[str, Any], path: str) -> Any:
    """Get a nested value from data using dot notation."""
    keys = path.split('.')
    value = data
    
    for key in keys:
        if isinstance(value, dict) and key in value:
            value = value[key]
        else:
            return None
    
    return value


def render_default_template(template_name: str, data: Dict[str, Any]) -> str:
    """Render a default template."""
    if template_name == "score_summary":
        return json.dumps({
            "template": "score_summary",
            "candidate_id": data.get("candidate_id"),
            "final_score": data.get("final_score"),
            "component_scores": {
                "saturation": data.get("saturation_score"),
                "parcel": data.get("parcel_score"),
                "county": data.get("county_difficulty"),
                "financial": data.get("financial_score")
            },
            "status": data.get("status")
        }, indent=2)
    
    elif template_name == "elimination_report":
        return json.dumps({
            "template": "elimination_report",
            "candidate_id": data.get("candidate_id"),
            "eliminated": data.get("eliminated", False),
            "reasons": data.get("reasons", []),
            "stage": data.get("stage")
        }, indent=2)
    
    elif template_name == "audit_log":
        return json.dumps({
            "template": "audit_log",
            "timestamp": data.get("timestamp"),
            "stage": data.get("stage"),
            "status": data.get("status"),
            "data": data.get("data", {})
        }, indent=2)
    
    else:
        # Generic template
        return json.dumps(data, indent=2)

