import logging
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.db.models.transfer.TransferCategory import (
    TransferCategory,
    TransferCategoryEnum,
)

logger = logging.getLogger(__name__)


async def seed_transfer_categories(session: AsyncSession):
    """
    Seeds the transfer categories into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    category_data = [
        {"transfer_category_id": 1, "category": TransferCategoryEnum.A},
        {"transfer_category_id": 2, "category": TransferCategoryEnum.B},
        {"transfer_category_id": 3, "category": TransferCategoryEnum.C},
        {"transfer_category_id": 4, "category": TransferCategoryEnum.D},
    ]

    try:
        for data in category_data:
            # Check if the Category already exists based on category
            exists = await session.execute(
                select(TransferCategory).where(
                    TransferCategory.category == data["category"]
                )
            )
            if not exists.scalars().first():
                new_category = TransferCategory(**data)
                session.add(new_category)

    except Exception as e:
        logger.error("Error occurred while seeding transfer categories: %s", e)
        raise
