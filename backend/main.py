"""
FastAPI main application entry point with async lifespan management.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.db.connection import init_db_pool, close_db_pool
from backend.api import screening, saturation, scoring, financials, parcels
from backend.utils.error_handler import setup_error_handlers
from backend.utils.logger import setup_logging
from backend.config.settings import load_global_config, GLOBAL_CONFIG
from backend.pipeline.process_registry import load_process_registry, PROCESS_REGISTRY
from backend.config.constants import API_PREFIX, API_TITLE, API_VERSION

import logging

logger = setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan: startup and shutdown."""
    # Startup
    logger.info("Starting application...")
    
    # Load global configuration
    logger.info("Loading global configuration...")
    global_config = load_global_config()
    logger.info(f"Global configuration loaded: {len(global_config)} sections")
    
    # Load process registry
    logger.info("Loading process registry...")
    process_registry = load_process_registry()
    logger.info(f"Process registry loaded: {len(process_registry)} pipelines")
    
    # Initialize database connection pool
    logger.info("Initializing database connection pool...")
    await init_db_pool()
    logger.info("Database connection pool initialized")
    
    # IMO-Creator context initialized
    logger.info("IMO-Creator context initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down application...")
    await close_db_pool()
    logger.info("Database connection pool closed")


app = FastAPI(
    title=API_TITLE,
    description="Storage Site Scouting & Process of Elimination Engine",
    version=API_VERSION,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup error handlers
setup_error_handlers(app)

# Include routers (using API_PREFIX from config)
app.include_router(screening.router, prefix=API_PREFIX, tags=["screening"])
app.include_router(saturation.router, prefix=API_PREFIX, tags=["saturation"])
app.include_router(scoring.router, prefix=API_PREFIX, tags=["scoring"])
app.include_router(financials.router, prefix=API_PREFIX, tags=["financials"])
app.include_router(parcels.router, prefix=API_PREFIX, tags=["parcels"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Storage Site Scouting API", "status": "operational"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    from backend.db.connection import get_pool
    pool = get_pool()
    if pool is None:
        return {"status": "unhealthy", "database": "not_connected"}
    
    try:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "database": "error", "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

