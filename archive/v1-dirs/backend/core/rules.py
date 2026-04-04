"""
Business rules and thresholds.
"""
from backend.config.constants import (
    MIN_POPULATION,
    MIN_HOUSEHOLDS,
    SATURATION_ELIMINATION_THRESHOLD,
    FLOODPLAIN_ELIMINATION,
    FINANCIAL_MIN_DSCR,
    FINANCIAL_RENT_LOW,
    FINANCIAL_RENT_HIGH,
    MIN_TRAFFIC_COUNT,
    MAX_COUNTY_DIFFICULTY,
    MIN_FINAL_SCORE
)


def should_eliminate_by_population(population: int) -> bool:
    """Check if candidate should be eliminated due to low population."""
    return population < MIN_POPULATION


def should_eliminate_by_saturation(saturation_ratio: float) -> bool:
    """Check if candidate should be eliminated due to oversupply."""
    from backend.config.settings import get_config_value
    threshold = get_config_value("saturation.elimination_threshold", SATURATION_ELIMINATION_THRESHOLD)
    return saturation_ratio > threshold


def should_eliminate_by_floodplain(floodplain: bool) -> bool:
    """Check if candidate should be eliminated due to floodplain."""
    return FLOODPLAIN_ELIMINATION and floodplain


def should_eliminate_by_final_score(final_score: int) -> bool:
    """Check if candidate should be eliminated due to low final score."""
    return final_score < MIN_FINAL_SCORE

