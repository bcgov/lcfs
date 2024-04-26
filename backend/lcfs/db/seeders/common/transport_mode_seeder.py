import logging
from sqlalchemy import select
from lcfs.db.models.TransportMode import TransportMode

logger = logging.getLogger(__name__)


async def seed_transport_modes(session):
    """
    Seeds the transport modes into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    transport_modes_to_seed = [
        {
            "transport_mode": 'Truck',
        },
        {
            "transport_mode": 'Rail',
        },
        {
            "transport_mode": 'Marine',
        },
        {
            "transport_mode": 'Adjacent',
        },
        {
            "transport_mode": 'Pipeline',
        },
    ]

    try:
        for transport_mode_data in transport_modes_to_seed:
            exists = await session.execute(
                select(TransportMode).where(TransportMode.transport_mode ==
                                            transport_mode_data["transport_mode"])
            )
            if not exists.scalars().first():
                transport_mode = TransportMode(**transport_mode_data)
                session.add(transport_mode)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding transport modes: %s", e)
        await session.rollback()  # Ensure to rollback in case of an error
        raise
