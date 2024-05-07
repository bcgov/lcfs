import logging
from sqlalchemy import select
from lcfs.db.models.FuelType import FuelType

logger = logging.getLogger(__name__)


async def seed_fuel_types(session):
    """
    Seeds the fuel types into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    fuel_types_to_seed = [
        {
            "fuel_type": 'Biodiesel',
            "fossil_derived": False
        },
        {
            "fuel_type": 'CNG',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Electricity',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Ethanol',
            "fossil_derived": False
        },
        {
            "fuel_type": 'HDRD',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Hydrogen',
            "fossil_derived": False
        },
        {
            "fuel_type": 'LNG',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Other - gasoline category',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Other diesel fuel',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Other - diesel category',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Alternative jet fuel',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Other - jet fuel category',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Propane',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Renewable gasoline',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Renewable naphtha',
            "fossil_derived": False
        },
        {
            "fuel_type": 'Fossil-derived diesel',
            "fossil_derived": True
        },
        {
            "fuel_type": 'Fossil-derived gasoline',
            "fossil_derived": True
        },
        {
            "fuel_type": 'Fossil-derived jet fuel',
            "fossil_derived": True
        },
    ]

    try:
        for fuel_type_data in fuel_types_to_seed:
            exists = await session.execute(
                select(FuelType).where(FuelType.fuel_type ==
                                       fuel_type_data["fuel_type"])
            )
            if not exists.scalars().first():
                fuel_type = FuelType(**fuel_type_data)
                session.add(fuel_type)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding fuel types: %s", e)
        await session.rollback()  # Ensure to rollback in case of an error
        raise
