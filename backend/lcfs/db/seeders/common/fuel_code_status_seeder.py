import logging
from sqlalchemy import select
from lcfs.db.models.FuelCodeStatus import FuelCodeStatus, FuelCodeStatusEnum

logger = logging.getLogger(__name__)


async def seed_fuel_code_statuses(session):
    """
    Seeds the fuel code statuses into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    fuel_code_statuses_to_seed = [
        {
            "status": FuelCodeStatusEnum.Draft,
            "description": "Initial state of the fuel code",
            "display_order": 1,
        },
        {
            "status": FuelCodeStatusEnum.Approved,
            "description": "Fuel code has been approved",
            "display_order": 2,
        },
        {
            "status": FuelCodeStatusEnum.Deleted,
            "description": "Fuel code has been deleted",
            "display_order": 3,
        },
    ]

    try:
        for fuel_code_status_data in fuel_code_statuses_to_seed:
            exists = await session.execute(
                select(FuelCodeStatus).where(
                    FuelCodeStatus.status == fuel_code_status_data["status"])
            )
            if not exists.scalars().first():
                fuel_code_status = FuelCodeStatus(**fuel_code_status_data)
                session.add(fuel_code_status)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding fuel code statuses: %s", e)
        await session.rollback()  # Ensure to rollback in case of an error
        raise
