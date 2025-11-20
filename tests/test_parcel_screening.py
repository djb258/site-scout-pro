"""
Tests for parcel screening.
"""
import pytest
from backend.core.parcel_screening import screen_parcel


@pytest.mark.asyncio
async def test_screen_parcel_viable():
    """Test parcel screening for viable parcel."""
    result = await screen_parcel(
        shape_score=80,
        slope_score=70,
        access_score=90,
        floodplain=False
    )
    
    assert result["viable"] is True
    assert result["reason"] is None
    assert result["floodplain"] is False


@pytest.mark.asyncio
async def test_screen_parcel_floodplain():
    """Test parcel screening for floodplain parcel."""
    result = await screen_parcel(
        shape_score=80,
        slope_score=70,
        access_score=90,
        floodplain=True
    )
    
    assert result["viable"] is False
    assert result["reason"] == "floodplain"


@pytest.mark.asyncio
async def test_screen_parcel_low_scores():
    """Test parcel screening for parcel with low scores."""
    result = await screen_parcel(
        shape_score=30,  # Below threshold
        slope_score=40,  # Below threshold
        access_score=90,
        floodplain=False
    )
    
    assert result["viable"] is False
    assert "shape" in result["reason"] or "slope" in result["reason"]

