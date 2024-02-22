import logging
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from backend.lcfs.db.models.TransferCategory import TransferCategory

logger = logging.getLogger(__name__)

async def seed_transfer_categories(session: AsyncSession):
    """
    Seeds the transfer categories into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    category_data = [
        {'category': 'A', 'description': 'Reached within the last 6 months'},
        {'category': 'B', 'description': 'Reached between 6 months to 1 year ago'},
        {'category': 'C', 'description': 'Reached more than 1 year ago'},
        {'category': 'D', 'description': 'Override based on value of price per credit'},
    ]

    try:
        for data in category_data:
            # Check if the Category already exists based on category
            exists = await session.execute(
                select(TransferCategory).where(TransferCategory.category == data['category'])
            )
            if not exists.scalars().first():
                new_category = TransferCategory(**data)
                session.add(new_category)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding transfer categories: %s", e)
        await session.rollback()  # Rollback in case of an error
        raise
