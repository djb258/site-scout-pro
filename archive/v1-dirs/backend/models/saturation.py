"""
Saturation database model.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class Saturation(BaseModel):
    """Saturation model."""
    id: Optional[int] = None
    candidate_id: int
    population: Optional[int] = None
    sqft_required: Optional[int] = None
    sqft_existing: Optional[int] = None
    saturation_ratio: Optional[float] = None
    saturation_score: Optional[int] = None
    market_status: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

