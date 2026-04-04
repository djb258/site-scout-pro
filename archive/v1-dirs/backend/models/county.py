"""
County database model.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class County(BaseModel):
    """County model."""
    id: Optional[int] = None
    county: str
    state: str
    zoning_difficulty: Optional[int] = None
    permitting_speed: Optional[int] = None
    stormwater_difficulty: Optional[int] = None
    overall_difficulty: Optional[int] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

