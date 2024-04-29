import logging
from sqlalchemy import select
from lcfs.db.models.FuelCodePrefix import FuelCodePrefix

logger = logging.getLogger(__name__)


async def seed_fuel_code_prefixes(session):
    """
    Seeds the fuel code prefixes into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    fuel_code_prefixes_to_seed = [
        {
            "prefix": 'BCLCF',
        },
    ]

    try:
        for fuel_code_prefix_data in fuel_code_prefixes_to_seed:
            exists = await session.execute(
                select(FuelCodePrefix).where(FuelCodePrefix.prefix ==
                                             fuel_code_prefix_data["prefix"])
            )
            if not exists.scalars().first():
                fuel_code_prefix = FuelCodePrefix(**fuel_code_prefix_data)
                session.add(fuel_code_prefix)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding fuel code prefixes: %s", e)
        await session.rollback()  # Ensure to rollback in case of an error
        raise
