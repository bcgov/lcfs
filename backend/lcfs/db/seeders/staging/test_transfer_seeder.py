import structlog
from datetime import datetime
from sqlalchemy import select, text
from lcfs.db.models.transfer.Transfer import Transfer

logger = structlog.get_logger(__name__)


async def seed_test_transfers(session):
    """
    Seeds the transfers into the test database with comprehensive test data,
    if they do not already exist.
    Args:
        session: The database session for committing the new records.
    """
    # Define the transfers to seed based on actual test database
    transfers_to_seed = [
        {
            "transfer_id": 1,
            "from_organization_id": 5,
            "to_organization_id": 1,
            "from_transaction_id": 11,
            "to_transaction_id": 16,
            "quantity": 10000,
            "transfer_category_id": 2,
            "current_status_id": 6,
            "price_per_unit": 500.00,
        },
        {
            "transfer_id": 2,
            "from_organization_id": 5,
            "to_organization_id": 3,
            "from_transaction_id": 12,
            "quantity": 5000,
            "current_status_id": 9,
            "price_per_unit": 500.00,
        },
        {
            "transfer_id": 3,
            "from_organization_id": 2,
            "to_organization_id": 3,
            "from_transaction_id": 13,
            "quantity": 100,
            "current_status_id": 7,
            "price_per_unit": 235.00,
        },
        {
            "transfer_id": 4,
            "from_organization_id": 1,
            "to_organization_id": 5,
            "from_transaction_id": 14,
            "to_transaction_id": 15,
            "quantity": 1000,
            "transfer_category_id": 1,
            "current_status_id": 6,
            "price_per_unit": 250.00,
        },
    ]

    for transfer_data in transfers_to_seed:
        # Check if the transfer already exists
        existing_transfer = await session.execute(
            select(Transfer).where(Transfer.transfer_id == transfer_data["transfer_id"])
        )
        if existing_transfer.scalar():
            logger.info(
                f"Transfer with ID {transfer_data['transfer_id']} already exists, skipping."
            )
            continue

        # Create and add the new transfer
        transfer = Transfer(**transfer_data)
        session.add(transfer)

    await session.flush()
    logger.info(f"Seeded {len(transfers_to_seed)} transfers.")

    # Refresh the materialized view to include the new/updated transfers
    try:
        await session.execute(
            text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate")
        )
    except Exception as e:
        logger.warning(f"Could not refresh materialized view: {e}")
        # Try without CONCURRENTLY
        await session.execute(
            text("REFRESH MATERIALIZED VIEW mv_transaction_aggregate")
        )
