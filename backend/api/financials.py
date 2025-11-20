"""
Financial calculations API endpoint.
"""
from fastapi import APIRouter, HTTPException
from backend.schemas.financials import FinancialRequest, FinancialResponse
from backend.db.connection import get_db_connection
from backend.core.calculations import calculate_financial_score
from backend.utils.process_logger import log_process_step
from backend.config.settings import GLOBAL_CONFIG
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/financials", response_model=FinancialResponse)
async def calculate_financials(request: FinancialRequest):
    """
    Calculate financial viability score for a candidate.
    
    Uses rent data to determine debt service coverage and profitability.
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
            
            # Calculate financial score
            financial_score = await calculate_financial_score(
                rent_low=request.rent_low or candidate.get("rent_low", 0),
                rent_med=request.rent_med or candidate.get("rent_med", 0),
                rent_high=request.rent_high or candidate.get("rent_high", 0)
            )
            
            # Update candidate if rent data provided
            if request.rent_low or request.rent_med or request.rent_high:
                await conn.execute(
                    """
                    UPDATE site_candidate
                    SET rent_low = COALESCE($1, rent_low),
                        rent_med = COALESCE($2, rent_med),
                        rent_high = COALESCE($3, rent_high),
                        financial_score = $4
                    WHERE id = $5
                    """,
                    request.rent_low,
                    request.rent_med,
                    request.rent_high,
                    financial_score,
                    request.candidate_id
                )
            
            return FinancialResponse(
                candidate_id=request.candidate_id,
                rent_low=request.rent_low or candidate.get("rent_low", 0),
                rent_med=request.rent_med or candidate.get("rent_med", 0),
                rent_high=request.rent_high or candidate.get("rent_high", 0),
                financial_score=financial_score
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Financial calculation error for candidate {request.candidate_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

