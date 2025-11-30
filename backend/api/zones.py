"""
Zone Management API endpoints.
Create zones from any ZIP code and run screening pipelines.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ZoneCreateRequest(BaseModel):
    """Request to create a new screening zone."""
    center_zip: str = Field(..., description="Center ZIP code (5 digits)", min_length=5, max_length=5)
    radius_miles: int = Field(default=120, description="Radius in miles", ge=10, le=500)
    zone_name: Optional[str] = Field(default=None, description="Custom zone name")
    states: Optional[List[str]] = Field(default=None, description="States to include (auto-detected if not provided)")


class ZoneResponse(BaseModel):
    """Response for zone creation."""
    zone_id: int
    zone_name: str
    center_zip: str
    center_city: str
    center_state: str
    center_lat: float
    center_lon: float
    radius_miles: int
    states: List[str]
    total_zips: int
    total_counties: int
    zips_by_state: Dict[str, int]
    counties_by_state: Dict[str, int]


class RunStartRequest(BaseModel):
    """Request to start a screening run."""
    zone_id: int = Field(..., description="Zone ID")
    config: Optional[Dict[str, Any]] = Field(default=None, description="Optional config overrides")


class RunStartResponse(BaseModel):
    """Response for run start."""
    run_id: str
    zone_id: int
    total_zips: int
    status: str


class RunStatusResponse(BaseModel):
    """Response for run status."""
    run_id: str
    status: str
    total_zips: int
    target_states: List[str]
    created_at: str
    ended_at: Optional[str]
    active_by_stage: Dict[int, int]
    killed_by_stage: Dict[int, int]


class StageRunRequest(BaseModel):
    """Request to run a specific stage."""
    run_id: str = Field(..., description="Run UUID")
    stage: int = Field(..., description="Stage number (0-8)", ge=0, le=8)


class QuickScreenRequest(BaseModel):
    """Request for quick zone creation and screening."""
    center_zip: str = Field(..., description="Center ZIP code", min_length=5, max_length=5)
    radius_miles: int = Field(default=120, description="Radius in miles", ge=10, le=500)


@router.post("/zones", response_model=ZoneResponse)
async def create_zone(request: ZoneCreateRequest):
    """
    Create a new screening zone from any ZIP code.

    The zone will automatically:
    - Look up the ZIP's coordinates
    - Find all ZIPs within the radius
    - Auto-detect which states are included
    - Count ZIPs and counties by state
    """
    from backend.services.zone_service import ZoneService

    try:
        service = ZoneService()
        zone = service.create_zone(
            center_zip=request.center_zip,
            radius_miles=request.radius_miles,
            zone_name=request.zone_name,
            states=request.states
        )
        service.close()

        return ZoneResponse(**zone)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Zone creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/zones", response_model=List[Dict[str, Any]])
async def list_zones():
    """List all defined screening zones."""
    from backend.services.zone_service import ZoneService

    try:
        service = ZoneService()
        zones = service.list_zones()
        service.close()
        return zones
    except Exception as e:
        logger.error(f"Zone list failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/zones/{zone_id}", response_model=ZoneResponse)
async def get_zone(zone_id: int):
    """Get details of a specific zone."""
    from backend.services.zone_service import ZoneService

    try:
        service = ZoneService()
        # Get zone info
        cursor = service.conn.cursor()
        from psycopg2.extras import RealDictCursor
        cursor = service.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT zone_id, zone_name, center_zip, center_lat, center_lon, radius_miles, states
            FROM target_zones WHERE zone_id = %s
        """, (zone_id,))
        zone = cursor.fetchone()

        if not zone:
            raise HTTPException(status_code=404, detail="Zone not found")

        # Get ZIP info for center
        zip_info = service.get_zip_info(zone['center_zip'])

        # Get stats
        stats = service.get_zone_stats(zone_id)
        service.close()

        return ZoneResponse(
            zone_id=zone['zone_id'],
            zone_name=zone['zone_name'],
            center_zip=zone['center_zip'],
            center_city=zip_info['city'] if zip_info else "",
            center_state=zip_info['state'] if zip_info else "",
            center_lat=float(zone['center_lat']),
            center_lon=float(zone['center_lon']),
            radius_miles=zone['radius_miles'],
            states=zone['states'],
            **stats
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Zone get failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: int):
    """Delete a zone (does not delete associated runs)."""
    from backend.services.zone_service import ZoneService

    try:
        service = ZoneService()
        deleted = service.delete_zone(zone_id)
        service.close()

        if not deleted:
            raise HTTPException(status_code=404, detail="Zone not found")

        return {"message": f"Zone {zone_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Zone delete failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/zones/{zone_id}/zips")
async def get_zone_zips(zone_id: int, include_demographics: bool = True):
    """Get all ZIPs in a zone with optional demographic data."""
    from backend.services.zone_service import ZoneService

    try:
        service = ZoneService()
        zips = service.get_zone_zips(zone_id, include_demographics)
        service.close()
        return {"zone_id": zone_id, "count": len(zips), "zips": zips}
    except Exception as e:
        logger.error(f"Zone ZIPs fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/zones/{zone_id}/counties")
async def get_zone_counties(zone_id: int):
    """Get all counties in a zone."""
    from backend.services.zone_service import ZoneService

    try:
        service = ZoneService()
        counties = service.get_zone_counties(zone_id)
        service.close()
        return {"zone_id": zone_id, "count": len(counties), "counties": counties}
    except Exception as e:
        logger.error(f"Zone counties fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ RUN ENDPOINTS ============

@router.post("/runs", response_model=RunStartResponse)
async def start_run(request: RunStartRequest):
    """Start a screening run for a zone."""
    from backend.services.zone_service import ZoneService

    try:
        service = ZoneService()
        run_id = service.start_zone_run(request.zone_id, request.config)

        # Get zone info for response
        cursor = service.conn.cursor()
        from psycopg2.extras import RealDictCursor
        cursor = service.conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT total_zips FROM runs WHERE run_id = %s", (run_id,))
        run = cursor.fetchone()

        service.close()

        return RunStartResponse(
            run_id=run_id,
            zone_id=request.zone_id,
            total_zips=run['total_zips'],
            status="running"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Run start failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/{run_id}", response_model=RunStatusResponse)
async def get_run_status(run_id: str):
    """Get status of a screening run."""
    from backend.services.pipeline_service import PipelineService

    try:
        service = PipelineService()
        status = service.get_run_status(run_id)
        service.close()

        if "error" in status:
            raise HTTPException(status_code=404, detail=status["error"])

        return RunStatusResponse(**status)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Run status fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runs/{run_id}/stage")
async def run_stage(run_id: str, request: StageRunRequest):
    """Run a specific stage of the screening pipeline."""
    from backend.services.pipeline_service import PipelineService

    try:
        service = PipelineService()
        result = service.run_stage(run_id, request.stage)
        service.close()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Stage run failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runs/{run_id}/all-stages")
async def run_all_stages(run_id: str, background_tasks: BackgroundTasks):
    """Run all stages of the screening pipeline."""
    from backend.services.pipeline_service import PipelineService

    try:
        service = PipelineService()
        result = service.run_all_stages(run_id)
        service.close()
        return result
    except Exception as e:
        logger.error(f"All stages run failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/{run_id}/survivors")
async def get_survivors(run_id: str, min_score: float = 0):
    """Get all surviving ZIPs with their scores."""
    from backend.services.pipeline_service import PipelineService

    try:
        service = PipelineService()
        survivors = service.get_survivors(run_id, min_score)
        service.close()
        return {"run_id": run_id, "count": len(survivors), "survivors": survivors}
    except Exception as e:
        logger.error(f"Survivors fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ QUICK SCREEN ENDPOINT ============

@router.post("/quick-screen")
async def quick_screen(request: QuickScreenRequest):
    """
    Create a zone and run full screening in one call.

    This is the main endpoint for the UI - just provide a ZIP code
    and get back the top 20 locations.
    """
    from backend.services.pipeline_service import create_and_run_zone

    try:
        result = create_and_run_zone(
            center_zip=request.center_zip,
            radius_miles=request.radius_miles
        )

        return {
            "zone": {
                "zone_id": result["zone"]["zone_id"],
                "zone_name": result["zone"]["zone_name"],
                "center_zip": result["zone"]["center_zip"],
                "total_zips": result["zone"]["total_zips"],
                "states": result["zone"]["states"]
            },
            "run_id": result["run_id"],
            "stages_completed": len(result["screening"]["stages"]),
            "top_20": result["screening"]["stages"].get("stage_8", {}).get("top_20", [])
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Quick screen failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
