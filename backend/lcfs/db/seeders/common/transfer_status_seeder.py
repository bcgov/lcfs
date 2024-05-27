import logging
from sqlalchemy import select
from lcfs.db.models.transfer.TransferStatus import TransferStatus, TransferStatusEnum

logger = logging.getLogger(__name__)

async def seed_transfer_statuses(session):
    """
    Seeds the transfer statuses into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    transfer_statuses_to_seed = [
        {
            "status": TransferStatusEnum.Draft,
            "visible_to_transferor": True,
            "visible_to_transferee": False,
            "visible_to_government": False
        },
        {
            "status": TransferStatusEnum.Deleted,
            "visible_to_transferor": False,
            "visible_to_transferee": False,
            "visible_to_government": False
        },
        {
            "status": TransferStatusEnum.Sent,
            "visible_to_transferor": True,
            "visible_to_transferee": True,
            "visible_to_government": False
        },
        {
            "status": TransferStatusEnum.Submitted,
            "visible_to_transferor": True,
            "visible_to_transferee": True,
            "visible_to_government": True
        },
        {
            "status": TransferStatusEnum.Recommended,
            "visible_to_transferor": True,
            "visible_to_transferee": True,
            "visible_to_government": True
        },
        {
            "status": TransferStatusEnum.Recorded,
            "visible_to_transferor": True,
            "visible_to_transferee": True,
            "visible_to_government": True
        },
        {
            "status": TransferStatusEnum.Refused,
            "visible_to_transferor": True,
            "visible_to_transferee": True,
            "visible_to_government": True
        },
        {
            "status": TransferStatusEnum.Declined,
            "visible_to_transferor": True,
            "visible_to_transferee": True,
            "visible_to_government": False
        },
        {
            "status": TransferStatusEnum.Rescinded,
            "visible_to_transferor": True,
            "visible_to_transferee": True,
            "visible_to_government": True
        }
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
