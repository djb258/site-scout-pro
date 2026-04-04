"""
Scoring API schemas.
"""
from pydantic import BaseModel, Field


class ScoringRequest(BaseModel):
    """Scoring request schema."""
    candidate_id: int = Field(..., description="Candidate ID to score")


class ScoringResponse(BaseModel):
    """Scoring response schema."""
    candidate_id: int
    parcel_score: int
    county_difficulty: int
    financial_score: int
    final_score: int
    status: str

