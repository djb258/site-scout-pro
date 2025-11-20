"""
Saturation API endpoint for market saturation calculations.
"""
from fastapi import APIRouter, HTTPException
from backend.schemas.saturation import SaturationRequest, SaturationResponse
from backend.db.connection import get_db_connection
from backend.core.saturation import calculate_saturation
from backend.utils.process_logger import log_process_step
from backend.config.settings import GLOBAL_CONFIG
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/saturation", response_model=SaturationResponse)
async def run_saturation(request: SaturationRequest):
    """
    Calculate market saturation metrics for a candidate.
    
    Uses the 6 sq ft per person formula to determine saturation ratio.
    """
    try:
        async with get_db_connection() as conn:
            # Fetch candidate
            candidate = await conn.fetchrow(
                "SELECT * FROM site_candidate WHERE id = $1",
                request.candidate_id
            )
            
            if not candidate:
                raise HTTPException(status_code=404, detail="Candidate not found")
            
            if not candidate["population"]:
                raise HTTPException(
                    status_code=400,
                    detail="Population data required. Run screening first."
                )
            
            # Calculate saturation
            saturation_result = await calculate_saturation(
                population=candidate["population"],
                existing_sqft=candidate.get("sqft_existing", 0)
            )
            
            # Update candidate
            await conn.execute(
                """
                UPDATE site_candidate
                SET sqft_required = $1,
                    sqft_existing = $2,
                    saturation_score = $3,
                    status = 'saturation'
                WHERE id = $4
                """,
                saturation_result["sqft_required"],
                saturation_result["sqft_existing"],
                saturation_result["saturation_score"],
                request.candidate_id
            )
            
            # Log process step
            await log_process_step(
                conn=conn,
                candidate_id=request.candidate_id,
                stage="saturation",
                status="completed",
                data=saturation_result
            )
            
            return SaturationResponse(
                candidate_id=request.candidate_id,
                sqft_required=saturation_result["sqft_required"],
                sqft_existing=saturation_result["sqft_existing"],
                saturation_ratio=saturation_result["saturation_ratio"],
                saturation_score=saturation_result["saturation_score"]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Saturation error for candidate {request.candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

