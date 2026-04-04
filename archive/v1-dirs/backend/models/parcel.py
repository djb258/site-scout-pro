"""
Parcel database model.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class Parcel(BaseModel):
    """Parcel model."""
    id: Optional[int] = None
    candidate_id: int
    shape_score: Optional[int] = None
    slope_score: Optional[int] = None
    access_score: Optional[int] = None
    floodplain: bool = False
    soil_quality: Optional[str] = None
    rock_presence: Optional[bool] = None
    viable: Optional[bool] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

