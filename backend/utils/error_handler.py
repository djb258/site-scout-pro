"""
Error handling middleware and utilities.
"""
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from backend.utils.errors import (
    StorageScoutingError,
    ValidationError,
    DatabaseError,
    CandidateNotFoundError
)
from backend.utils.response import error_response
import logging
import traceback

logger = logging.getLogger(__name__)


def setup_error_handlers(app: FastAPI) -> None:
    """Setup error handlers for the FastAPI app."""
    
    @app.exception_handler(ValidationError)
    async def validation_error_handler(request: Request, exc: ValidationError):
        """Handle validation errors."""
        return error_response(
            error="Validation Error",
            detail=str(exc),
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
        )
    
    @app.exception_handler(CandidateNotFoundError)
    async def candidate_not_found_handler(request: Request, exc: CandidateNotFoundError):
        """Handle candidate not found errors."""
        return error_response(
            error="Candidate Not Found",
            detail=str(exc),
            status_code=status.HTTP_404_NOT_FOUND
        )
    
    @app.exception_handler(DatabaseError)
    async def database_error_handler(request: Request, exc: DatabaseError):
        """Handle database errors."""
        logger.error(f"Database error: {exc}")
        return error_response(
            error="Database Error",
            detail="An error occurred while accessing the database",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    @app.exception_handler(StorageScoutingError)
    async def storage_scouting_error_handler(request: Request, exc: StorageScoutingError):
        """Handle general storage scouting errors."""
        logger.error(f"Storage scouting error: {exc}")
        return error_response(
            error="Processing Error",
            detail=str(exc),
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle all other exceptions."""
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return error_response(
            error="Internal Server Error",
            detail="An unexpected error occurred",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

