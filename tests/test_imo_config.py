"""
Tests for IMO-Creator global configuration integration.
"""
import pytest
from backend.config.settings import load_global_config, GLOBAL_CONFIG, get_config_value
from backend.config.constants import (
    SCORE_WEIGHTS,
    SQFT_PER_PERSON,
    FINANCIAL_UNITS,
    SUPPORTED_STATES
)


def test_global_config_loads():
    """Test that global configuration loads successfully."""
    config = load_global_config()
    assert config is not None
    assert isinstance(config, dict)
    assert "scoring" in config
    assert "saturation" in config
    assert "financial" in config


def test_global_config_has_doctrine_flags():
    """Test that doctrine flags are present in config."""
    config = load_global_config()
    assert "doctrine" in config
    assert "BARTON_DOCTRINE" in config["doctrine"]


def test_config_value_access():
    """Test accessing config values by path."""
    saturation = get_config_value("saturation.sqft_per_person")
    assert saturation == 6
    
    weights = get_config_value("scoring.weights")
    assert isinstance(weights, dict)
    assert "saturation" in weights


def test_constants_loaded_from_config():
    """Test that constants are loaded from global config."""
    assert SQFT_PER_PERSON == 6
    assert FINANCIAL_UNITS == 116
    assert isinstance(SCORE_WEIGHTS, dict)
    assert "saturation" in SCORE_WEIGHTS


def test_supported_states():
    """Test supported states configuration."""
    assert isinstance(SUPPORTED_STATES, list)
    assert len(SUPPORTED_STATES) > 0
    assert "WV" in SUPPORTED_STATES

