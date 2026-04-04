"""
Parcel screening module.
"""
from typing import Dict, Any
from backend.config.constants import (
    PARCEL_SHAPE_THRESHOLD,
    PARCEL_SLOPE_THRESHOLD,
    PARCEL_ACCESS_THRESHOLD,
    FLOODPLAIN_ELIMINATION
)


async def screen_parcel(
    shape_score: int,
    slope_score: int,
    access_score: int,
    floodplain: bool
) -> Dict[str, Any]:
    """
    Screen a parcel for viability.
    
    Evaluates shape, slope, access, and floodplain status.
    
    Args:
        shape_score: Shape efficiency score (0-100)
        slope_score: Slope analysis score (0-100)
        access_score: Access quality score (0-100)
        floodplain: Whether parcel is in floodplain
    
    Returns:
        Dictionary with viable flag and scores
    """
    # Automatic elimination if in floodplain (if enabled in config)
    if FLOODPLAIN_ELIMINATION and floodplain:
        return {
            "viable": False,
            "reason": "floodplain",
            "shape_score": shape_score,
            "slope_score": slope_score,
            "access_score": access_score,
            "floodplain": floodplain
        }
    
    # Check thresholds
    viable = (
        shape_score >= PARCEL_SHAPE_THRESHOLD and
        slope_score >= PARCEL_SLOPE_THRESHOLD and
        access_score >= PARCEL_ACCESS_THRESHOLD
    )
    
    reason = None
    if not viable:
        reasons = []
        if shape_score < PARCEL_SHAPE_THRESHOLD:
            reasons.append("shape")
        if slope_score < PARCEL_SLOPE_THRESHOLD:
            reasons.append("slope")
        if access_score < PARCEL_ACCESS_THRESHOLD:
            reasons.append("access")
        reason = ", ".join(reasons)
    
    return {
        "viable": viable,
        "reason": reason,
        "shape_score": shape_score,
        "slope_score": slope_score,
        "access_score": access_score,
        "floodplain": floodplain
    }

