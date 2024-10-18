import logging
from sqlalchemy import select
from lcfs.db.models.fuel.FinishedFuelTransportMode import FinishedFuelTransportMode

logger = logging.getLogger(__name__)


async def seed_finished_fuel_transfer_modes(session):
    finished_fuel_transfer_modes_to_seed = [
        {
            "fuel_code_id": 1,
            "transport_mode_id": 1,
        },
        {
            "fuel_code_id": 1,
            "transport_mode_id": 2,
        },
        {
            "fuel_code_id": 2,
            "transport_mode_id": 3,
        },
        {
            "fuel_code_id": 2,
            "transport_mode_id": 4,
        },
        {
            "fuel_code_id": 3,
            "transport_mode_id": 5,
        },
        {
            "fuel_code_id": 3,
            "transport_mode_id": 1,
        },
        {
            "fuel_code_id": 4,
            "transport_mode_id": 2,
        },
        {
            "fuel_code_id": 4,
            "transport_mode_id": 3,
        },
        {
            "fuel_code_id": 5,
            "transport_mode_id": 4,
        },
        {
            "fuel_code_id": 5,
            "transport_mode_id": 5,
        },
        {
            "fuel_code_id": 6,
            "transport_mode_id": 1,
        },
        {
            "fuel_code_id": 6,
            "transport_mode_id": 2,
        },
    ]

    try:
        for finished_fuel_transferm_mode_data in finished_fuel_transfer_modes_to_seed:
            exists = await session.execute(
                select(FinishedFuelTransportMode).where(
                    FinishedFuelTransportMode.fuel_code_id
                    == finished_fuel_transferm_mode_data["fuel_code_id"],
                    FinishedFuelTransportMode.transport_mode_id
                    == finished_fuel_transferm_mode_data["transport_mode_id"],
                )
            )
            if not exists.scalars().first():
                finished_fuel_transfer_mode = FinishedFuelTransportMode(
                    **finished_fuel_transferm_mode_data
                )
                session.add(finished_fuel_transfer_mode)

    except Exception as e:
        logger.error("Error occurred while seeding finished fuel transfer modes: %s", e)
        raise
