"""
Parcel API schemas.
"""
from pydantic import BaseModel, Field


class ParcelRequest(BaseModel):
    """Parcel request schema."""
    candidate_id: int = Field(..., description="Candidate ID")
    shape_score: int = Field(..., ge=0, le=100, description="Shape score (0-100)")
    slope_score: int = Field(..., ge=0, le=100, description="Slope score (0-100)")
    access_score: int = Field(..., ge=0, le=100, description="Access score (0-100)")
    floodplain: bool = Field(False, description="Floodplain status")


class ParcelResponse(BaseModel):
    """Parcel response schema."""
    candidate_id: int
    shape_score: int
    slope_score: int
    access_score: int
    floodplain: bool
    parcel_viable: bool

