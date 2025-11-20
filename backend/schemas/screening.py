"""
Screening API schemas.
"""
from pydantic import BaseModel, Field


class ScreeningRequest(BaseModel):
    """Screening request schema."""
    candidate_id: int = Field(..., description="Candidate ID to screen")


class ScreeningResponse(BaseModel):
    """Screening response schema."""
    candidate_id: int
    status: str
    population: int
    households: int
    uhaul_index: int

