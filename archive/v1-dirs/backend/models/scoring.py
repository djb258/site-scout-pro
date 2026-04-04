"""
Scoring database models.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class Scoring(BaseModel):
    """Scoring model."""
    candidate_id: int
    parcel_score: Optional[int] = None
    county_difficulty: Optional[int] = None
    financial_score: Optional[int] = None
    final_score: Optional[int] = None
    saturation_score: Optional[int] = None
    
    class Config:
        from_attributes = True

