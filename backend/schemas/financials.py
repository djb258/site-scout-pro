"""
Financial API schemas.
"""
from typing import Optional
from pydantic import BaseModel, Field


class FinancialRequest(BaseModel):
    """Financial request schema."""
    candidate_id: int = Field(..., description="Candidate ID")
    rent_low: Optional[float] = Field(None, description="Low rent estimate")
    rent_med: Optional[float] = Field(None, description="Medium rent estimate")
    rent_high: Optional[float] = Field(None, description="High rent estimate")


class FinancialResponse(BaseModel):
    """Financial response schema."""
    candidate_id: int
    rent_low: float
    rent_med: float
    rent_high: float
    financial_score: int

