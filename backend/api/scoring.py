"""
Scoring API endpoint for final candidate scoring.
"""
from fastapi import APIRouter, HTTPException
from backend.schemas.scoring import ScoringRequest, ScoringResponse
from backend.db.connection import get_db_connection
from backend.core.calculations import (
    calculate_parcel_viability,
    calculate_county_difficulty,
    calculate_financial_score,
    calculate_final_score
)
from backend.utils.process_logger import log_process_step
from backend.config.settings import GLOBAL_CONFIG
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/score", response_model=ScoringResponse)
async def run_scoring(request: ScoringRequest):
    """
    Calculate final scoring for a candidate.
    
    Combines parcel viability, county difficulty, financial score, and saturation
    into a final weighted score.
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
            
            # Calculate component scores
            parcel_score = await calculate_parcel_viability(
                shape_score=candidate.get("shape_score", 0),
                slope_score=candidate.get("slope_score", 0),
                access_score=candidate.get("access_score", 0),
                floodplain=candidate.get("floodplain", False)
            )
            
            county_difficulty = await calculate_county_difficulty(
                county=candidate["county"],
                state=candidate["state"]
            )
            
            financial_score = await calculate_financial_score(
                rent_low=candidate.get("rent_low", 0),
                rent_med=candidate.get("rent_med", 0),
                rent_high=candidate.get("rent_high", 0)
            )
            
            # Calculate final score
            final_score = await calculate_final_score(
                saturation_score=candidate.get("saturation_score", 0),
                parcel_score=parcel_score,
                county_difficulty=county_difficulty,
                financial_score=financial_score
            )
            
            # Update candidate
            await conn.execute(
                """
                UPDATE site_candidate
                SET parcel_score = $1,
                    county_difficulty = $2,
                    financial_score = $3,
                    final_score = $4,
                    status = 'completed'
                WHERE id = $5
                """,
                parcel_score,
                county_difficulty,
                financial_score,
                final_score,
                request.candidate_id
            )
            
            # Log process step
            await log_process_step(
                conn=conn,
                candidate_id=request.candidate_id,
                stage="scoring",
                status="completed",
                data={
                    "parcel_score": parcel_score,
                    "county_difficulty": county_difficulty,
                    "financial_score": financial_score,
                    "final_score": final_score
                }
            )
            
            return ScoringResponse(
                candidate_id=request.candidate_id,
                parcel_score=parcel_score,
                county_difficulty=county_difficulty,
                financial_score=financial_score,
                final_score=final_score,
                status="completed"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scoring error for candidate {request.candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

