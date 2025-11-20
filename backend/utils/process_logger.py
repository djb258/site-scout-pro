"""
Process logging utilities for audit trail.
"""
from typing import Dict, Any, Optional
import asyncpg
import json
import logging

logger = logging.getLogger(__name__)


async def log_process_step(
    conn: asyncpg.Connection,
    candidate_id: int,
    stage: str,
    status: str,
    data: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None
) -> None:
    """
    Log a process step to the process_log table.
    
    Args:
        conn: Database connection
        candidate_id: Candidate ID
        stage: Process stage name
        status: Status (completed, failed, etc.)
        data: Optional output data
        error_message: Optional error message
    """
    try:
        await conn.execute(
            """
            INSERT INTO process_log (
                candidate_id, stage, status, input_data, output_data, error_message
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            candidate_id,
            stage,
            status,
            None,  # input_data - can be populated if needed
            json.dumps(data) if data else None,
            error_message
        )
    except Exception as e:
        logger.error(f"Failed to log process step: {e}")


async def log_error(
    conn: asyncpg.Connection,
    candidate_id: Optional[int],
    error_type: str,
    error_message: str,
    stack_trace: Optional[str] = None,
    context_data: Optional[Dict[str, Any]] = None
) -> None:
    """
    Log an error to the error_log table.
    
    Args:
        conn: Database connection
        candidate_id: Optional candidate ID
        error_type: Error type/class name
        error_message: Error message
        stack_trace: Optional stack trace
        context_data: Optional context data
    """
    try:
        await conn.execute(
            """
            INSERT INTO error_log (
                candidate_id, error_type, error_message, stack_trace, context_data
            )
            VALUES ($1, $2, $3, $4, $5)
            """,
            candidate_id,
            error_type,
            error_message,
            stack_trace,
            json.dumps(context_data) if context_data else None
        )
    except Exception as e:
        logger.error(f"Failed to log error: {e}")

