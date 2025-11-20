"""
Screening API endpoint for initial candidate evaluation.
"""
from fastapi import APIRouter, HTTPException, Depends
from backend.schemas.screening import ScreeningRequest, ScreeningResponse
from backend.schemas.common import ErrorResponse
from backend.db.connection import get_db_connection
from backend.services.census_service import get_population_data
from backend.services.uhaul_service import get_uhaul_index
from backend.utils.response import success_response, error_response
from backend.utils.process_logger import log_process_step
from backend.utils.errors import ValidationError, DatabaseError
from backend.config.settings import GLOBAL_CONFIG
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/screening", response_model=ScreeningResponse)
async def run_screening(request: ScreeningRequest):
    """
    Run initial screening process for a candidate.
    
    Fetches population data, U-Haul migration data, and performs basic validation.
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
            
            # Fetch external data
            population_data = await get_population_data(
                county=candidate["county"],
                state=candidate["state"]
            )
            
            uhaul_index = await get_uhaul_index(
                county=candidate["county"],
                state=candidate["state"]
            )
            
            # Update candidate with screening data
            await conn.execute(
                """
                UPDATE site_candidate
                SET population = $1,
                    households = $2,
                    uhaul_index = $3,
                    status = 'screening'
                WHERE id = $4
                """,
                population_data.get("population", 0),
                population_data.get("households", 0),
                uhaul_index,
                request.candidate_id
            )
            
            # Log process step
            await log_process_step(
                conn=conn,
                candidate_id=request.candidate_id,
                stage="screening",
                status="completed",
                data={
                    "population": population_data.get("population"),
                    "households": population_data.get("households"),
                    "uhaul_index": uhaul_index
                }
            )
            
            # Fetch updated candidate
            updated = await conn.fetchrow(
                "SELECT * FROM site_candidate WHERE id = $1",
                request.candidate_id
            )
            
            return ScreeningResponse(
                candidate_id=request.candidate_id,
                status=updated["status"],
                population=updated["population"],
                households=updated["households"],
                uhaul_index=updated["uhaul_index"]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Screening error for candidate {request.candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

