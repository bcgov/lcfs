import structlog
from sqlalchemy import select
from lcfs.db.models.transfer.TransferHistory import TransferHistory

logger = structlog.get_logger(__name__)


async def seed_test_transfer_history(session):
    """
    Seeds transfer history records into the database based on actual test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the transfer history records to seed based on actual test database
    history_records_to_seed = [
        {
            "transfer_history_id": 1,
            "transfer_id": 1,
            "transfer_status_id": 3,
            "user_profile_id": 11,
            "display_name": "David Clark",
        },
        {
            "transfer_history_id": 2,
            "transfer_id": 2,
            "transfer_status_id": 3,
            "user_profile_id": 11,
            "display_name": "David Clark",
        },
        {
            "transfer_history_id": 3,
            "transfer_id": 2,
            "transfer_status_id": 9,
            "user_profile_id": 11,
            "display_name": "David Clark",
        },
        {
            "transfer_history_id": 4,
            "transfer_id": 3,
            "transfer_status_id": 3,
            "user_profile_id": 8,
            "display_name": "John Smith",
        },
        {
            "transfer_history_id": 5,
            "transfer_id": 4,
            "transfer_status_id": 3,
            "user_profile_id": 7,
            "display_name": "Jane Doe",
        },
        {
            "transfer_history_id": 6,
            "transfer_id": 3,
            "transfer_status_id": 4,
            "user_profile_id": 9,
            "display_name": "Alice Woo",
        },
        {
            "transfer_history_id": 7,
            "transfer_id": 4,
            "transfer_status_id": 4,
            "user_profile_id": 11,
            "display_name": "David Clark",
        },
        {
            "transfer_history_id": 8,
            "transfer_id": 1,
            "transfer_status_id": 4,
            "user_profile_id": 7,
            "display_name": "Jane Doe",
        },
        {
            "transfer_history_id": 9,
            "transfer_id": 1,
            "transfer_status_id": 5,
            "user_profile_id": 6,
            "display_name": "Lindsy Grunert",
        },
        {
            "transfer_history_id": 10,
            "transfer_id": 4,
            "transfer_status_id": 5,
            "user_profile_id": 6,
            "display_name": "Lindsy Grunert",
        },
        {
            "transfer_history_id": 11,
            "transfer_id": 3,
            "transfer_status_id": 5,
            "user_profile_id": 6,
            "display_name": "Lindsy Grunert",
        },
        {
            "transfer_history_id": 12,
            "transfer_id": 3,
            "transfer_status_id": 7,
            "user_profile_id": 18,
            "display_name": "Al Ring",
        },
        {
            "transfer_history_id": 13,
            "transfer_id": 4,
            "transfer_status_id": 6,
            "user_profile_id": 18,
            "display_name": "Al Ring",
        },
        {
            "transfer_history_id": 14,
            "transfer_id": 1,
            "transfer_status_id": 6,
            "user_profile_id": 18,
            "display_name": "Al Ring",
        },
    ]

    for history_data in history_records_to_seed:
        # Check if the history record already exists
        existing_history = await session.execute(
            select(TransferHistory).where(
                TransferHistory.transfer_history_id
                == history_data["transfer_history_id"]
            )
        )
        if existing_history.scalar():
            logger.info(
                f"Transfer history record with ID {history_data['transfer_history_id']} already exists, skipping."
            )
            continue

        # Create and add the new history record
        history_record = TransferHistory(**history_data)
        session.add(history_record)

    await session.flush()
    logger.info(f"Seeded {len(history_records_to_seed)} transfer history records.")
