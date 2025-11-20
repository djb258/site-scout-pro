"""
Parcel-related API endpoints.
"""
from fastapi import APIRouter, HTTPException
from backend.schemas.parcels import ParcelRequest, ParcelResponse
from backend.db.connection import get_db_connection
from backend.core.parcel_screening import screen_parcel
from backend.utils.process_logger import log_process_step
from backend.config.settings import GLOBAL_CONFIG
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/parcels", response_model=ParcelResponse)
async def screen_parcel_endpoint(request: ParcelRequest):
    """
    Screen a parcel for viability.
    
    Evaluates shape, slope, access, and floodplain status.
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
            
            # Screen parcel
            parcel_result = await screen_parcel(
                shape_score=request.shape_score,
                slope_score=request.slope_score,
                access_score=request.access_score,
                floodplain=request.floodplain
            )
            
            # Update candidate
            await conn.execute(
                """
                UPDATE site_candidate
                SET shape_score = $1,
                    slope_score = $2,
                    access_score = $3,
                    floodplain = $4
                WHERE id = $5
                """,
                request.shape_score,
                request.slope_score,
                request.access_score,
                request.floodplain,
                request.candidate_id
            )
            
            # Log process step
            await log_process_step(
                conn=conn,
                candidate_id=request.candidate_id,
                stage="parcel_screening",
                status="completed",
                data=parcel_result
            )
            
            return ParcelResponse(
                candidate_id=request.candidate_id,
                shape_score=request.shape_score,
                slope_score=request.slope_score,
                access_score=request.access_score,
                floodplain=request.floodplain,
                parcel_viable=parcel_result["viable"]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Parcel screening error for candidate {request.candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

