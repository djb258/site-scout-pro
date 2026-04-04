"""
Core scoring calculations.
"""
from typing import Dict, Any
from backend.config.settings import GLOBAL_CONFIG
from backend.config.constants import (
    FINANCIAL_UNITS,
    FINANCIAL_VACANCY_RATE,
    FINANCIAL_LOAN_PAYMENT,
    FINANCIAL_RENT_LOW,
    FINANCIAL_RENT_HIGH,
    SCORE_WEIGHTS,
    DEFAULT_COUNTY_DIFFICULTY
)


async def calculate_parcel_viability(
    shape_score: int,
    slope_score: int,
    access_score: int,
    floodplain: bool
) -> int:
    """
    Calculate parcel viability score.
    
    Weighted combination of shape, slope, access, and floodplain status.
    
    Args:
        shape_score: Shape efficiency score (0-100)
        slope_score: Slope analysis score (0-100)
        access_score: Access quality score (0-100)
        floodplain: Whether parcel is in floodplain
    
    Returns:
        Parcel viability score (0-100)
    """
    # TODO: Implement full calculation logic
    # Stub implementation
    if floodplain:
        return 0
    
    # Weighted average
    weights = {
        "shape": 0.3,
        "slope": 0.3,
        "access": 0.4
    }
    
    score = (
        shape_score * weights["shape"] +
        slope_score * weights["slope"] +
        access_score * weights["access"]
    )
    
    return int(score)


async def calculate_county_difficulty(
    county: str,
    state: str
) -> int:
    """
    Calculate county difficulty score.
    
    Fast permitting = high score, slow = low score.
    
    Args:
        county: County name
        state: State abbreviation
    
    Returns:
        County difficulty score (0-100, higher = easier)
    """
    # TODO: Implement full calculation logic
    # Stub implementation - fetch from county_score table
    # Use state-level rules from config
    state_rules = GLOBAL_CONFIG.get("states", {}).get("rules", {}).get(state, {})
    default_difficulty = state_rules.get("default_county_difficulty", DEFAULT_COUNTY_DIFFICULTY)
    return default_difficulty


async def calculate_financial_score(
    rent_low: float,
    rent_med: float,
    rent_high: float
) -> int:
    """
    Calculate financial viability score.
    
    Uses:
    - 116 units total
    - 20% vacancy (92 rented)
    - $400k build cost
    - $2,577/mo loan payment
    - $80-$120 rent band
    
    Args:
        rent_low: Low rent estimate
        rent_med: Medium rent estimate
        rent_high: High rent estimate
    
    Returns:
        Financial score (0-100)
    """
    # TODO: Implement full calculation logic
    # Stub implementation
    
    # Validate rent band
    if rent_med < FINANCIAL_RENT_LOW or rent_med > FINANCIAL_RENT_HIGH:
        return 0
    
    # Calculate monthly revenue
    units_rented = FINANCIAL_UNITS * (1 - FINANCIAL_VACANCY_RATE)
    monthly_revenue = units_rented * rent_med
    
    # Calculate debt service coverage
    dscr = monthly_revenue / FINANCIAL_LOAN_PAYMENT if FINANCIAL_LOAN_PAYMENT > 0 else 0
    
    # Score based on DSCR
    if dscr >= 1.5:
        return 100
    elif dscr >= 1.25:
        return 75
    elif dscr >= 1.0:
        return 50
    else:
        return 25


async def calculate_final_score(
    saturation_score: int,
    parcel_score: int,
    county_difficulty: int,
    financial_score: int
) -> int:
    """
    Calculate final weighted score.
    
    Args:
        saturation_score: Market saturation score (0-100)
        parcel_score: Parcel viability score (0-100)
        county_difficulty: County difficulty score (0-100)
        financial_score: Financial viability score (0-100)
    
    Returns:
        Final score (0-100)
    """
    # TODO: Implement full weighted calculation
    # Stub implementation using weights from constants
    
    weights = SCORE_WEIGHTS
    
    final = (
        saturation_score * weights["saturation"] +
        parcel_score * weights["parcel"] +
        county_difficulty * weights["county"] +
        financial_score * weights["financial"]
    )
    
    return int(final)

