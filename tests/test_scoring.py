"""
Tests for scoring calculations.
"""
import pytest
from backend.core.calculations import (
    calculate_parcel_viability,
    calculate_county_difficulty,
    calculate_financial_score,
    calculate_final_score
)


@pytest.mark.asyncio
async def test_calculate_parcel_viability():
    """Test parcel viability calculation."""
    score = await calculate_parcel_viability(
        shape_score=80,
        slope_score=70,
        access_score=90,
        floodplain=False
    )
    assert 0 <= score <= 100
    assert score > 0


@pytest.mark.asyncio
async def test_calculate_parcel_viability_floodplain():
    """Test parcel viability with floodplain."""
    score = await calculate_parcel_viability(
        shape_score=80,
        slope_score=70,
        access_score=90,
        floodplain=True
    )
    assert score == 0


@pytest.mark.asyncio
async def test_calculate_financial_score():
    """Test financial score calculation."""
    score = await calculate_financial_score(
        rent_low=80,
        rent_med=100,
        rent_high=120
    )
    assert 0 <= score <= 100


@pytest.mark.asyncio
async def test_calculate_final_score():
    """Test final score calculation."""
    score = await calculate_final_score(
        saturation_score=75,
        parcel_score=80,
        county_difficulty=70,
        financial_score=85
    )
    assert 0 <= score <= 100

