"""
Structured logging setup.
"""
import logging
import sys
import os
from typing import Optional
from datetime import datetime
from backend.config.constants import LOG_LEVEL, LOG_FORMAT, LOG_DATEFMT


def setup_logging(level: Optional[str] = None) -> logging.Logger:
    """
    Setup structured logging.
    
    Args:
        level: Optional logging level override (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    
    Returns:
        Configured logger
    """
    # Use config level or environment variable or default
    log_level = level or os.getenv("LOG_LEVEL", LOG_LEVEL)
    log_format = os.getenv("LOG_FORMAT", LOG_FORMAT)
    log_datefmt = os.getenv("LOG_DATEFMT", LOG_DATEFMT)
    
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format=log_format,
        datefmt=log_datefmt,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    logger = logging.getLogger("storage_scouting")
    logger.info("Logging initialized")
    
    return logger

