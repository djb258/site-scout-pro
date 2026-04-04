"""
Tests for n8n service integration.
"""
import pytest
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from unittest.mock import patch, AsyncMock
from backend.services.n8n_service import (
    get_n8n_config,
    trigger_workflow,
    check_n8n_connection
)


def test_get_n8n_config():
    """Test n8n configuration retrieval."""
    config = get_n8n_config()
    
    assert "base_url" in config
    assert "api_key" in config
    assert "timeout" in config
    assert "enabled" in config
    assert isinstance(config["timeout"], int)
    assert isinstance(config["enabled"], bool)


@pytest.mark.asyncio
async def test_trigger_workflow_with_webhook_url():
    """Test triggering n8n workflow with direct webhook URL."""
    test_data = {"candidate_id": 1, "county": "Test County"}
    
    with patch("backend.services.n8n_service.httpx.AsyncClient") as mock_client:
        mock_response = AsyncMock()
        mock_response.json.return_value = {"status": "success", "data": test_data}
        mock_response.raise_for_status = AsyncMock()
        
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        
        result = await trigger_workflow(
            webhook_url="https://test-n8n.com/webhook/test",
            data=test_data
        )
        
        assert result["status"] == "success"
        assert "workflow" in result


@pytest.mark.asyncio
async def test_trigger_workflow_with_workflow_name():
    """Test triggering n8n workflow by name."""
    with patch("backend.services.n8n_service.httpx.AsyncClient") as mock_client:
        with patch("backend.services.n8n_service.GLOBAL_CONFIG", {
            "n8n": {
                "webhooks": {
                    "screening": "https://test-n8n.com/webhook/screening"
                }
            }
        }):
            mock_response = AsyncMock()
            mock_response.json.return_value = {"status": "success"}
            mock_response.raise_for_status = AsyncMock()
            
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            
            result = await trigger_workflow(
                workflow_name="screening",
                data={"test": "data"}
            )
            
            assert result["status"] == "success"


@pytest.mark.asyncio
async def test_trigger_workflow_disabled():
    """Test that disabled n8n returns appropriate message."""
    with patch("backend.services.n8n_service.get_n8n_config", return_value={
        "enabled": False,
        "base_url": "http://localhost:5678",
        "api_key": "",
        "timeout": 30
    }):
        result = await trigger_workflow(
            webhook_url="https://test.com/webhook",
            data={}
        )
        
        assert result["status"] == "disabled"


@pytest.mark.asyncio
async def test_check_n8n_connection():
    """Test n8n connection check function."""
    with patch("backend.services.n8n_service.httpx.AsyncClient") as mock_client:
        mock_response = AsyncMock()
        mock_response.raise_for_status = AsyncMock()
        
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_response
        )
        
        result = await check_n8n_connection()
        
        assert "status" in result
        assert result["status"] in ["connected", "error", "disabled"]

