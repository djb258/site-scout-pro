"""
Tests for Composio service integration.
"""
import pytest
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from unittest.mock import patch, AsyncMock
from backend.services.composio_service import (
    get_composio_config,
    get_app_id,
    call_composio_app,
    check_composio_connection
)


def test_get_composio_config():
    """Test Composio configuration retrieval."""
    config = get_composio_config()
    
    assert "base_url" in config
    assert "api_key" in config
    assert "workspace_id" in config
    assert "timeout" in config
    assert "max_retries" in config
    assert "retry_delay" in config
    assert "enabled" in config
    assert isinstance(config["timeout"], int)
    assert isinstance(config["enabled"], bool)


def test_get_app_id_from_env():
    """Test getting app ID from environment variable."""
    with patch("backend.services.composio_service.os.getenv", return_value="test_app_id"):
        app_id = get_app_id("census")
        assert app_id == "test_app_id"


def test_get_app_id_from_config():
    """Test getting app ID from global config."""
    with patch("backend.services.composio_service.os.getenv", return_value=None):
        with patch("backend.services.composio_service.GLOBAL_CONFIG", {
            "composio": {
                "apps": {
                    "census": "config_app_id"
                }
            }
        }):
            app_id = get_app_id("census")
            assert app_id == "config_app_id"


@pytest.mark.asyncio
async def test_call_composio_app():
    """Test calling a Composio app."""
    with patch("backend.services.composio_service.httpx.AsyncClient") as mock_client:
        mock_response = AsyncMock()
        mock_response.json.return_value = {"data": {"population": 10000}}
        mock_response.raise_for_status = AsyncMock()
        
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        with patch("backend.services.composio_service.get_app_id", return_value="test_app_id"):
            with patch("backend.services.composio_service.get_composio_config", return_value={
                "enabled": True,
                "base_url": "https://api.composio.dev",
                "api_key": "test_key",
                "workspace_id": "test_workspace",
                "timeout": 30,
                "max_retries": 3,
                "retry_delay": 1
            }):
                result = await call_composio_app(
                    app_name="census",
                    action="get_population",
                    parameters={"county": "Test", "state": "WV"}
                )
                
                assert result["status"] == "success"
                assert result["app"] == "census"
                assert result["action"] == "get_population"


@pytest.mark.asyncio
async def test_call_composio_app_disabled():
    """Test that disabled Composio returns appropriate message."""
    with patch("backend.services.composio_service.get_composio_config", return_value={
        "enabled": False,
        "base_url": "https://api.composio.dev",
        "api_key": "",
        "workspace_id": "",
        "timeout": 30,
        "max_retries": 3,
        "retry_delay": 1
    }):
        result = await call_composio_app(
            app_name="census",
            action="test",
            app_id="test_id"
        )
        
        assert result["status"] == "disabled"


@pytest.mark.asyncio
async def test_check_composio_connection():
    """Test Composio connection check function."""
    with patch("backend.services.composio_service.httpx.AsyncClient") as mock_client:
        mock_response = AsyncMock()
        mock_response.raise_for_status = AsyncMock()
        
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_response
        )
        
        with patch("backend.services.composio_service.get_composio_config", return_value={
            "enabled": True,
            "base_url": "https://api.composio.dev",
            "api_key": "test_key",
            "workspace_id": "test_workspace",
            "timeout": 5,
            "max_retries": 3,
            "retry_delay": 1
        }):
            result = await check_composio_connection()
            
            assert "status" in result
            assert result["status"] in ["connected", "error", "disabled"]

