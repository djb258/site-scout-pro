"""
Constants and configuration values.
DEPRECATED: This module is maintained for backward compatibility.
All constants now come from backend.config.constants which loads from global_config.yaml.
"""

# Re-export from config.constants for backward compatibility
from backend.config.constants import (
    # Saturation constants
    SQFT_PER_PERSON,
    SATURATION_UNDERSUPPLIED_THRESHOLD,
    SATURATION_OVERSUPPLIED_THRESHOLD,
    # Financial constants
    FINANCIAL_UNITS,
    FINANCIAL_VACANCY_RATE,
    FINANCIAL_RENTED_UNITS,
    FINANCIAL_BUILD_COST,
    FINANCIAL_LOAN_PAYMENT,
    FINANCIAL_RENT_LOW,
    FINANCIAL_RENT_HIGH,
    # Parcel scoring thresholds
    PARCEL_SHAPE_THRESHOLD,
    PARCEL_SLOPE_THRESHOLD,
    PARCEL_ACCESS_THRESHOLD,
    # Score weights
    SCORE_WEIGHTS,
    # States supported
    SUPPORTED_STATES,
    # Status values
    STATUS_PENDING,
    STATUS_SCREENING,
    STATUS_SATURATION,
    STATUS_SCORING,
    STATUS_COMPLETED,
    STATUS_ELIMINATED,
)

# Calculate derived constant
FINANCIAL_RENTED_UNITS = int(FINANCIAL_UNITS * (1 - FINANCIAL_VACANCY_RATE))

