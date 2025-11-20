"""
IMO-Creator processors module.
"""
from typing import Dict, Any, Callable, Optional
import importlib

_PROCESSORS: Dict[str, Callable] = {}


def get_processor(processor_path: str) -> Optional[Callable]:
    """
    Get a processor function by path.
    
    Args:
        processor_path: Dot-separated path to processor
    
    Returns:
        Processor function or None
    """
    if processor_path in _PROCESSORS:
        return _PROCESSORS[processor_path]
    
    try:
        module_path, function_name = processor_path.rsplit('.', 1)
        module = importlib.import_module(module_path)
        processor = getattr(module, function_name, None)
        
        if processor and callable(processor):
            _PROCESSORS[processor_path] = processor
            return processor
        
        return None
        
    except Exception:
        return None
