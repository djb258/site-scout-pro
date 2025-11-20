"""
Site candidate database model.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class SiteCandidate(BaseModel):
    """Site candidate model."""
    id: Optional[int] = None
    address: Optional[str] = None
    county: Optional[str] = None
    state: Optional[str] = None
    zipcode: Optional[str] = None
    acreage: Optional[float] = None
    traffic_count: Optional[int] = None
    population: Optional[int] = None
    households: Optional[int] = None
    sqft_required: Optional[int] = None
    sqft_existing: Optional[int] = None
    saturation_score: Optional[int] = None
    county_difficulty: Optional[int] = None
    shape_score: Optional[int] = None
    slope_score: Optional[int] = None
    access_score: Optional[int] = None
    parcel_score: Optional[int] = None
    floodplain: bool = False
    rent_low: Optional[float] = None
    rent_med: Optional[float] = None
    rent_high: Optional[float] = None
    financial_score: Optional[int] = None
    final_score: Optional[int] = None
    uhaul_index: Optional[int] = None
    dot_corridor: bool = False
    status: str = "pending"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

