"""
Async database connection pool management for Neon PostgreSQL.
"""
import asyncpg
import os
from typing import Optional
from contextlib import asynccontextmanager
from backend.utils.logger import setup_logging
from backend.config.constants import (
    DB_POOL_MIN_SIZE,
    DB_POOL_MAX_SIZE,
    DB_COMMAND_TIMEOUT
)

logger = setup_logging()

_pool: Optional[asyncpg.Pool] = None


def get_connection_string() -> str:
    """Get database connection string from environment."""
    conn_str = os.getenv("NEON_DATABASE_URL")
    if not conn_str:
        raise ValueError("NEON_DATABASE_URL environment variable not set")
    return conn_str


async def init_db_pool() -> None:
    """Initialize the database connection pool."""
    global _pool
    
    if _pool is not None:
        logger.warning("Database pool already initialized")
        return
    
    try:
        conn_str = get_connection_string()
        _pool = await asyncpg.create_pool(
            conn_str,
            min_size=DB_POOL_MIN_SIZE,
            max_size=DB_POOL_MAX_SIZE,
            command_timeout=DB_COMMAND_TIMEOUT
        )
        logger.info("Database connection pool initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database pool: {e}")
        raise


async def close_db_pool() -> None:
    """Close the database connection pool."""
    global _pool
    
    if _pool is None:
        return
    
    try:
        await _pool.close()
        _pool = None
        logger.info("Database connection pool closed")
    except Exception as e:
        logger.error(f"Error closing database pool: {e}")


def get_pool() -> Optional[asyncpg.Pool]:
    """Get the database connection pool."""
    return _pool


@asynccontextmanager
async def get_db_connection():
    """Get a database connection from the pool."""
    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database pool not initialized")
    
    async with pool.acquire() as conn:
        yield conn


@asynccontextmanager
async def get_db_transaction():
    """Get a database connection with transaction support."""
    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database pool not initialized")
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            yield conn

