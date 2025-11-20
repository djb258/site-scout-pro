"""
Process loader for IMO-Creator processes.
"""
import importlib
import inspect
from typing import Dict, Any, Callable, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def load_process(process_path: str) -> Optional[Callable]:
    """
    Load a process function from a module path.
    
    Args:
        process_path: Dot-separated path to process (e.g., "imo_creator.processors.saturation")
    
    Returns:
        Process function or None
    """
    try:
        module_path, function_name = process_path.rsplit('.', 1)
        module = importlib.import_module(module_path)
        process = getattr(module, function_name, None)
        
        if process and callable(process):
            return process
        
        logger.warning(f"Process function '{function_name}' not found in {module_path}")
        return None
        
    except Exception as e:
        logger.error(f"Failed to load process {process_path}: {e}")
        return None


def discover_processes(directory: Path) -> Dict[str, Callable]:
    """
    Discover all process functions in a directory.
    
    Args:
        directory: Directory to search
    
    Returns:
        Dictionary mapping process names to functions
    """
    processes = {}
    
    if not directory.exists():
        return processes
    
    for file_path in directory.rglob("*.py"):
        if file_path.name == "__init__.py":
            continue
        
        try:
            # Convert file path to module path
            relative_path = file_path.relative_to(Path.cwd())
            module_path = str(relative_path.with_suffix("")).replace("/", ".").replace("\\", ".")
            
            module = importlib.import_module(module_path)
            
            # Find all async functions
            for name, obj in inspect.getmembers(module, inspect.isfunction):
                if inspect.iscoroutinefunction(obj):
                    process_name = f"{module_path}.{name}"
                    processes[process_name] = obj
                    
        except Exception as e:
            logger.warning(f"Failed to load processes from {file_path}: {e}")
    
    return processes

