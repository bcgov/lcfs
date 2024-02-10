import logging
from sqlalchemy import select
from lcfs.db.models.TransferStatus import TransferStatus, TransferStatusEnum

logger = logging.getLogger(__name__)

async def seed_transfer_statuses(session):
    """
    Seeds the transfer statuses into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    transfer_statuses_to_seed = [
        {"status": TransferStatusEnum.draft, "description": "Draft"},
        {"status": TransferStatusEnum.deleted, "description": "Deleted"},
        {"status": TransferStatusEnum.sent, "description": "Sent"},
        {"status": TransferStatusEnum.submitted, "description": "Submitted"},
        {"status": TransferStatusEnum.recommended, "description": "Recommended"},
        {"status": TransferStatusEnum.recorded, "description": "Recorded"},
        {"status": TransferStatusEnum.refused, "description": "Refused"},
        {"status": TransferStatusEnum.declined, "description": "Declined"},
        {"status": TransferStatusEnum.rescinded, "description": "Rescinded"}
    ]

    try:
        for transfer_status_data in transfer_statuses_to_seed:
            # Check if the TransferStatus already exists based on status
            exists = await session.execute(
                select(TransferStatus).where(TransferStatus.status == transfer_status_data["status"])
            )
            if not exists.scalars().first():
                transfer_status = TransferStatus(**transfer_status_data)
                session.add(transfer_status)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding transfer statuses: %s", e)
        await session.rollback()  # Ensure to rollback in case of an error
        raise
