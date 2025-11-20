"""
Domain-specific exceptions.
"""


class StorageScoutingError(Exception):
    """Base exception for storage scouting errors."""
    pass


class ValidationError(StorageScoutingError):
    """Validation error."""
    pass


class DatabaseError(StorageScoutingError):
    """Database operation error."""
    pass


class ScoringError(StorageScoutingError):
    """Scoring calculation error."""
    pass


class ExternalServiceError(StorageScoutingError):
    """External service integration error."""
    pass


class CandidateNotFoundError(StorageScoutingError):
    """Candidate not found error."""
    pass

