"""
IMO-Creator pipeline driver.
"""
from typing import Dict, Any, List, Optional
import logging
from backend.config.settings import GLOBAL_CONFIG
from backend.db.connection import get_db_connection
from backend.utils.process_logger import log_process_step, log_error

logger = logging.getLogger(__name__)


async def run_pipeline(
    pipeline_name: str,
    input_data: Dict[str, Any],
    candidate_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Run an IMO-Creator pipeline.
    
    Args:
        pipeline_name: Name of the pipeline to run
        input_data: Input data for the pipeline
        candidate_id: Optional candidate ID for logging
    
    Returns:
        Pipeline output data
    """
    try:
        logger.info(f"Running pipeline: {pipeline_name}")
        
        # Load pipeline steps from registry
        from backend.pipeline.process_registry import PROCESS_REGISTRY
        
        if pipeline_name not in PROCESS_REGISTRY:
            raise ValueError(f"Pipeline '{pipeline_name}' not found in registry")
        
        pipeline_config = PROCESS_REGISTRY[pipeline_name]
        steps = pipeline_config.get("steps", [])
        
        # Initialize output
        output_data = input_data.copy()
        
        # Execute each step
        for step in steps:
            step_name = step.get("name", "unknown")
            step_type = step.get("type", "processor")
            
            logger.debug(f"Executing step: {step_name} (type: {step_type})")
            
            # Execute step based on type
            if step_type == "processor":
                output_data = await execute_processor_step(step, output_data)
            elif step_type == "validator":
                await execute_validator_step(step, output_data)
            elif step_type == "transformer":
                output_data = await execute_transformer_step(step, output_data)
            
            # Log step execution
            if candidate_id:
                async with get_db_connection() as conn:
                    await log_process_step(
                        conn=conn,
                        candidate_id=candidate_id,
                        stage=f"pipeline_{pipeline_name}_{step_name}",
                        status="completed",
                        data={"step_output": output_data}
                    )
        
        logger.info(f"Pipeline {pipeline_name} completed successfully")
        return output_data
        
    except Exception as e:
        logger.error(f"Pipeline {pipeline_name} failed: {e}")
        
        # Log error
        if candidate_id:
            try:
                async with get_db_connection() as conn:
                    await log_error(
                        conn=conn,
                        candidate_id=candidate_id,
                        error_type=type(e).__name__,
                        error_message=str(e),
                        context_data={"pipeline": pipeline_name, "input_data": input_data}
                    )
            except Exception as log_err:
                logger.error(f"Failed to log error: {log_err}")
        
        raise


async def execute_processor_step(step: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a processor step."""
    processor_name = step.get("processor")
    
    # Import and execute processor
    try:
        from imo_creator.processors import get_processor
        processor = get_processor(processor_name)
        return await processor(data)
    except Exception as e:
        logger.error(f"Processor {processor_name} failed: {e}")
        raise


async def execute_validator_step(step: Dict[str, Any], data: Dict[str, Any]) -> None:
    """Execute a validator step."""
    validator_name = step.get("validator")
    rules = step.get("rules", {})
    
    # Validate data against rules
    for field, rule in rules.items():
        if field not in data:
            if rule.get("required", False):
                raise ValueError(f"Required field '{field}' missing")
        
        value = data.get(field)
        if value is not None:
            # Type validation
            expected_type = rule.get("type")
            if expected_type and not isinstance(value, expected_type):
                raise TypeError(f"Field '{field}' must be of type {expected_type}")
            
            # Range validation
            if "min" in rule and value < rule["min"]:
                raise ValueError(f"Field '{field}' must be >= {rule['min']}")
            if "max" in rule and value > rule["max"]:
                raise ValueError(f"Field '{field}' must be <= {rule['max']}")


async def execute_transformer_step(step: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a transformer step."""
    transformer_name = step.get("transformer")
    config = step.get("config", {})
    
    # Apply transformation
    # For now, return data as-is (stub)
    logger.debug(f"Transforming with {transformer_name}")
    return data

