"""
Tests for saturation calculations.
"""
import pytest
from backend.core.saturation import calculate_saturation


@pytest.mark.asyncio
async def test_calculate_saturation_undersupplied():
    """Test saturation calculation for undersupplied market."""
    result = await calculate_saturation(
        population=10000,
        existing_sqft=30000  # 0.5 ratio - undersupplied
    )
    
    assert result["sqft_required"] == 60000
    assert result["saturation_ratio"] == 0.5
    assert result["saturation_score"] == 100
    assert result["market_status"] == "undersupplied"


@pytest.mark.asyncio
async def test_calculate_saturation_balanced():
    """Test saturation calculation for balanced market."""
    result = await calculate_saturation(
        population=10000,
        existing_sqft=60000  # 1.0 ratio - balanced
    )
    
    assert result["sqft_required"] == 60000
    assert result["saturation_ratio"] == 1.0
    assert result["saturation_score"] == 50
    assert result["market_status"] == "balanced"


@pytest.mark.asyncio
async def test_calculate_saturation_oversupplied():
    """Test saturation calculation for oversupplied market."""
    result = await calculate_saturation(
        population=10000,
        existing_sqft=80000  # 1.33 ratio - oversupplied
    )
    
    assert result["sqft_required"] == 60000
    assert result["saturation_ratio"] > 1.1
    assert result["saturation_score"] == 0
    assert result["market_status"] == "oversupplied"

