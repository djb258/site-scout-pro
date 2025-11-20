"""
Standardized API response utilities.
"""
from typing import Any, Optional
from fastapi.responses import JSONResponse
from backend.schemas.common import SuccessResponse, ErrorResponse


def success_response(
    data: Any = None,
    message: Optional[str] = None,
    status_code: int = 200
) -> JSONResponse:
    """
    Create a standardized success response.
    
    Args:
        data: Response data
        message: Optional message
        status_code: HTTP status code
    
    Returns:
        JSONResponse
    """
    response = SuccessResponse(data=data, message=message)
    return JSONResponse(
        content=response.model_dump(exclude_none=True),
        status_code=status_code
    )


def error_response(
    error: str,
    detail: Optional[str] = None,
    status_code: int = 500
) -> JSONResponse:
    """
    Create a standardized error response.
    
    Args:
        error: Error message
        detail: Optional error detail
        status_code: HTTP status code
    
    Returns:
        JSONResponse
    """
    response = ErrorResponse(error=error, detail=detail, status_code=status_code)
    return JSONResponse(
        content=response.model_dump(exclude_none=True),
        status_code=status_code
    )

