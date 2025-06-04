import structlog
from sqlalchemy import select
from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer

logger = structlog.get_logger(__name__)


async def seed_test_notional_transfers(session):
    """
    Seeds the notional transfers into the database with comprehensive test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the notional transfers to seed based on actual test database
    notional_transfers_to_seed = [
        {
            "notional_transfer_id": 1,
            "compliance_report_id": 1,
            "legal_name": "LCFS Org 3",
            "address_for_service": "345 Radiant Road Solartown BC Canada V6M 2W8",
            "fuel_category_id": 1,
            "received_or_transferred": "Transferred",
            "quantity": 5000000,
            "group_uuid": "4b7f4dce-eaf8-4e7a-b8de-773b1b009584",
            "version": 0,
        },
        {
            "notional_transfer_id": 2,
            "compliance_report_id": 3,
            "legal_name": "LCFS Org 1",
            "address_for_service": "697 Burrard Street Vancouver BC Canada V6G 2P3",
            "fuel_category_id": 1,
            "received_or_transferred": "Received",
            "quantity": 5000000,
            "group_uuid": "ef6e44e2-9b39-40d5-94c2-6ffc584fa1f2",
            "version": 0,
        },
        {
            "notional_transfer_id": 3,
            "compliance_report_id": 6,
            "legal_name": "LCFS Org 3",
            "address_for_service": "345 Radiant Road Kamloops BC Canada V6M 2W8",
            "fuel_category_id": 1,
            "received_or_transferred": "Received",
            "quantity": 10000,
            "group_uuid": "121147f0-73dd-4e16-826c-2739a03994d6",
            "version": 0,
        },
    ]

    for notional_transfer_data in notional_transfers_to_seed:
        # Check if the notional transfer already exists
        existing_notional_transfer = await session.execute(
            select(NotionalTransfer).where(
                NotionalTransfer.notional_transfer_id
                == notional_transfer_data["notional_transfer_id"]
            )
        )
        if existing_notional_transfer.scalar():
            logger.info(
                f"Notional transfer with ID {notional_transfer_data['notional_transfer_id']} already exists, skipping."
            )
            continue

        # Create and add the new notional transfer
        notional_transfer = NotionalTransfer(**notional_transfer_data)
        session.add(notional_transfer)

    await session.flush()
    logger.info(f"Seeded {len(notional_transfers_to_seed)} notional transfers.")
