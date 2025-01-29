import structlog
from sqlalchemy import select, func
from lcfs.db.models.fuel.FeedstockFuelTransportMode import FeedstockFuelTransportMode

logger = structlog.get_logger(__name__)


async def seed_feedstock_fuel_transfer_modes(session):
    feedstock_fuel_transfer_modes_to_seed = [
        {
            "fuel_code_id": 1,
            "transport_mode_id": 5,
        },
        {
            "fuel_code_id": 1,
            "transport_mode_id": 4,
        },
        {
            "fuel_code_id": 2,
            "transport_mode_id": 3,
        },
        {
            "fuel_code_id": 2,
            "transport_mode_id": 2,
        },
        {
            "fuel_code_id": 3,
            "transport_mode_id": 1,
        },
        {
            "fuel_code_id": 3,
            "transport_mode_id": 5,
        },
        {
            "fuel_code_id": 4,
            "transport_mode_id": 4,
        },
        {
            "fuel_code_id": 4,
            "transport_mode_id": 3,
        },
        {
            "fuel_code_id": 5,
            "transport_mode_id": 2,
        },
        {
            "fuel_code_id": 5,
            "transport_mode_id": 1,
        },
        {
            "fuel_code_id": 6,
            "transport_mode_id": 5,
        },
        {
            "fuel_code_id": 6,
            "transport_mode_id": 4,
        },
    ]

    try:
        for feedstock_fuel_transferm_mode_data in feedstock_fuel_transfer_modes_to_seed:
            exists = await session.execute(
                select(FeedstockFuelTransportMode).where(
                    FeedstockFuelTransportMode.fuel_code_id
                    == feedstock_fuel_transferm_mode_data["fuel_code_id"],
                    FeedstockFuelTransportMode.transport_mode_id
                    == feedstock_fuel_transferm_mode_data["transport_mode_id"],
                )
            )
            if not exists.scalars().first():
                feedstock_fuel_transfer_mode = FeedstockFuelTransportMode(
                    **feedstock_fuel_transferm_mode_data
                )
                session.add(feedstock_fuel_transfer_mode)

    except Exception as e:
        context = {
            "function": "seed_feedstock_fuel_transfer_modes",
        }
        logger.error(
            "Error occurred while seeding feedstock fuel transfer modes",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
