"""
Tests for IMO-Creator loader integration.
"""
import pytest
from backend.pipeline.process_loader import load_process, discover_processes
from pathlib import Path


def test_load_process():
    """Test loading a process function."""
    # Test loading a known backend function
    process = load_process("backend.core.saturation.calculate_saturation")
    assert process is not None
    assert callable(process)


def test_load_nonexistent_process():
    """Test loading a non-existent process returns None."""
    process = load_process("nonexistent.module.function")
    assert process is None


def test_discover_processes():
    """Test discovering processes in a directory."""
    # This will return empty if directory doesn't exist, which is fine
    processes = discover_processes(Path("imo_creator/processors"))
    assert isinstance(processes, dict)

