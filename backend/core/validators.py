"""
Input validation functions.
"""
from typing import Optional
from backend.config.constants import SUPPORTED_STATES
from backend.utils.errors import ValidationError


def validate_state(state: str) -> None:
    """Validate state abbreviation."""
    if state.upper() not in SUPPORTED_STATES:
        raise ValidationError(
            f"State {state} not supported. Supported states: {', '.join(SUPPORTED_STATES)}"
        )


def validate_county(county: str) -> None:
    """Validate county name."""
    if not county or len(county.strip()) == 0:
        raise ValidationError("County name is required")


def validate_acreage(acreage: Optional[float]) -> None:
    """Validate acreage value."""
    if acreage is not None and acreage <= 0:
        raise ValidationError("Acreage must be positive")


def validate_zipcode(zipcode: Optional[str]) -> None:
    """Validate zipcode format."""
    if zipcode:
        # Basic validation - 5 digits or 5+4 format
        cleaned = zipcode.replace("-", "").replace(" ", "")
        if not cleaned.isdigit() or len(cleaned) not in [5, 9]:
            raise ValidationError("Invalid zipcode format")


def validate_candidate_id(candidate_id: int) -> None:
    """Validate candidate ID."""
    if candidate_id <= 0:
        raise ValidationError("Candidate ID must be positive")


async def validate_candidate_data(data: dict) -> None:
    """Validate complete candidate data."""
    if "state" in data:
        validate_state(data["state"])
    
    if "county" in data:
        validate_county(data["county"])
    
    if "acreage" in data:
        validate_acreage(data["acreage"])
    
    if "zipcode" in data:
        validate_zipcode(data["zipcode"])

