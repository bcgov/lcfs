import logging
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def seed_prod(session: AsyncSession):
    """
    Function to seed the database with prod data.
    """
    pass


if __name__ == "__main__":
    asyncio.run(seed_prod())
