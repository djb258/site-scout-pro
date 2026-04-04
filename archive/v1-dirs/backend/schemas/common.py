"""
Common API schemas.
"""
from typing import Optional, Any, Dict
from pydantic import BaseModel


class SuccessResponse(BaseModel):
    """Standard success response."""
    success: bool = True
    data: Optional[Any] = None
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standard error response."""
    success: bool = False
    error: str
    detail: Optional[str] = None
    status_code: int = 500


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int

