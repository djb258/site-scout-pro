"""
API router module.

Endpoints:
- /zones - Zone creation and management
- /runs - Screening run management
- /quick-screen - One-call zone creation + full screening
- /screening - Legacy individual candidate screening
- /saturation - Market saturation analysis
- /parcels - Parcel data
- /financials - Financial calculations
- /scoring - Location scoring
"""

from fastapi import APIRouter

# Import routers
from backend.api.zones import router as zones_router
from backend.api.screening import router as screening_router
from backend.api.saturation import router as saturation_router
from backend.api.parcels import router as parcels_router
from backend.api.financials import router as financials_router
from backend.api.scoring import router as scoring_router

# Create main router
api_router = APIRouter()

# Include all routers
api_router.include_router(zones_router, prefix="/api/v1", tags=["zones"])
api_router.include_router(screening_router, prefix="/api/v1", tags=["screening"])
api_router.include_router(saturation_router, prefix="/api/v1", tags=["saturation"])
api_router.include_router(parcels_router, prefix="/api/v1", tags=["parcels"])
api_router.include_router(financials_router, prefix="/api/v1", tags=["financials"])
api_router.include_router(scoring_router, prefix="/api/v1", tags=["scoring"])

