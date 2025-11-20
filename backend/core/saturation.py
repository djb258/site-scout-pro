"""
Saturation calculation module.
"""
from typing import Dict, Any
from backend.config.constants import (
    SQFT_PER_PERSON,
    SATURATION_UNDERSUPPLIED_THRESHOLD,
    SATURATION_OVERSUPPLIED_THRESHOLD
)


async def calculate_saturation(
    population: int,
    existing_sqft: int = 0
) -> Dict[str, Any]:
    """
    Calculate market saturation metrics.
    
    Formula:
    - required = population * 6
    - ratio = existing / required
    
    Scoring:
    - ratio < 0.7 → undersupplied (high score)
    - ratio 0.7-1.1 → balanced (medium score)
    - ratio > 1.1 → oversupplied (low score)
    
    Args:
        population: Population count
        existing_sqft: Existing storage square footage
    
    Returns:
        Dictionary with sqft_required, sqft_existing, saturation_ratio, saturation_score
    """
    # Calculate required sqft
    sqft_required = population * SQFT_PER_PERSON
    
    # Calculate saturation ratio
    if sqft_required > 0:
        saturation_ratio = existing_sqft / sqft_required
    else:
        saturation_ratio = 0
    
    # Calculate saturation score
    if saturation_ratio < SATURATION_UNDERSUPPLIED_THRESHOLD:
        # Undersupplied market
        saturation_score = 100
        market_status = "undersupplied"
    elif saturation_ratio <= SATURATION_OVERSUPPLIED_THRESHOLD:
        # Balanced market
        saturation_score = 50
        market_status = "balanced"
    else:
        # Oversupplied market
        saturation_score = 0
        market_status = "oversupplied"
    
    return {
        "sqft_required": sqft_required,
        "sqft_existing": existing_sqft,
        "saturation_ratio": round(saturation_ratio, 3),
        "saturation_score": saturation_score,
        "market_status": market_status
    }

