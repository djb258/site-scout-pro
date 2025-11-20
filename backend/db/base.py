"""
Base database operations and CRUD helpers.
"""
from typing import Optional, Dict, Any, List
from backend.db.connection import get_db_connection
import asyncpg


async def create_candidate(data: Dict[str, Any]) -> int:
    """Create a new site candidate and return its ID."""
    async with get_db_connection() as conn:
        candidate_id = await conn.fetchval(
            """
            INSERT INTO site_candidate (
                address, county, state, zipcode, acreage,
                traffic_count, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            """,
            data.get("address"),
            data.get("county"),
            data.get("state"),
            data.get("zipcode"),
            data.get("acreage"),
            data.get("traffic_count"),
            data.get("status", "pending")
        )
        return candidate_id


async def get_candidate(candidate_id: int) -> Optional[Dict[str, Any]]:
    """Get a candidate by ID."""
    async with get_db_connection() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM site_candidate WHERE id = $1",
            candidate_id
        )
        return dict(row) if row else None


async def update_candidate(candidate_id: int, data: Dict[str, Any]) -> bool:
    """Update a candidate with new data."""
    async with get_db_connection() as conn:
        # Build dynamic update query
        updates = []
        values = []
        param_num = 1
        
        for key, value in data.items():
            if value is not None:
                updates.append(f"{key} = ${param_num}")
                values.append(value)
                param_num += 1
        
        if not updates:
            return False
        
        values.append(candidate_id)
        query = f"""
            UPDATE site_candidate
            SET {', '.join(updates)}
            WHERE id = ${param_num}
        """
        
        result = await conn.execute(query, *values)
        return result == "UPDATE 1"


async def get_candidates_by_status(status: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Get candidates by status."""
    async with get_db_connection() as conn:
        rows = await conn.fetch(
            "SELECT * FROM site_candidate WHERE status = $1 LIMIT $2",
            status, limit
        )
        return [dict(row) for row in rows]

