"""
Saturation API schemas.
"""
from pydantic import BaseModel, Field


class SaturationRequest(BaseModel):
    """Saturation request schema."""
    candidate_id: int = Field(..., description="Candidate ID to calculate saturation for")


class SaturationResponse(BaseModel):
    """Saturation response schema."""
    candidate_id: int
    sqft_required: int
    sqft_existing: int
    saturation_ratio: float
    saturation_score: int

