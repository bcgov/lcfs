import logging
from sqlalchemy import select
from lcfs.db.models.fuel.ExpectedUseType import ExpectedUseType

logger = logging.getLogger(__name__)


async def seed_expected_use_types(session):
    """
    Seeds initial expected use types into the database, if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """

    expected_use_types_to_seed = [
        {"name": "Heating oil", "description": "Fuel used for heating purposes"},
        {"name": "Other", "description": "Other type of fuel description"},
    ]

    try:
        for expected_use_type_data in expected_use_types_to_seed:
            # Check if the expected use type already exists
            exists = await session.execute(
                select(ExpectedUseType).where(
                    ExpectedUseType.name == expected_use_type_data["name"]
                )
            )
            if not exists.scalars().first():
                expected_use_type = ExpectedUseType(**expected_use_type_data)
                session.add(expected_use_type)

    except Exception as e:
        logger.error("Error occurred while seeding expected use types: %s", e)
        raise
