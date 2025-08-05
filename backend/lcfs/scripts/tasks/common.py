
"""
Common Utility Tasks

This module contains common utility tasks that can be used
for testing, debugging, and general maintenance operations.

All functions in this module should:
- Accept a db_session parameter
- Return True for success, False for failure
- Use proper logging with structlog
- Handle exceptions gracefully
"""

import asyncio
from sqlalchemy import text
import structlog
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)


async def test_task(db_session: AsyncSession):
    """
    Simple test task for scheduler testing and validation.
    
    Args:
        db_session: Database session provided by the scheduler
        
    Returns:
        bool: True if successful, False if failed
    """
    logger.info("Test task started")
    
    try:
        # Test database connectivity
        result = await db_session.execute(text("SELECT 1 as test_value"))
        test_value = result.scalar()
        
        if test_value == 1:
            logger.info("Database connectivity test passed")
        else:
            logger.error("Database connectivity test failed")
            return False
        
        # Simulate some work
        await asyncio.sleep(1)
        
        logger.info("Test task completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Test task failed: {e}")
        return False