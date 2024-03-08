import logging
from sqlalchemy import select
from lcfs.db.models.TransferRecommendationStatus import TransferRecommendationStatus, TransferRecommendationStatusEnum

logger = logging.getLogger(__name__)


async def seed_transfer_recommendation_statuses(session):
    """
    Seeds the transfer recommendation statuses into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    transfer_recommendation_statuses_to_seed = [
        {"status": TransferRecommendationStatusEnum.Record, "description": "Record"},
        {"status": TransferRecommendationStatusEnum.Refuse, "description": "Refuse"},
    ]

    try:
        for transfer_recommendation_status_data in transfer_recommendation_statuses_to_seed:
            # Check if the TransferRecommendationStatus already exists based on status
            exists = await session.execute(
                select(TransferRecommendationStatus).where(
                    TransferRecommendationStatus.status == transfer_recommendation_status_data["status"])
            )
            print(exists)
            if not exists.scalars().first():
                transfer_recommendation_status = TransferRecommendationStatus(
                    **transfer_recommendation_status_data)
                session.add(transfer_recommendation_status)

        await session.commit()
    except Exception as e:
        logger.error(
            "Error occurred while seeding transfer recommendation statuses: %s", e)
        await session.rollback()  # Ensure to rollback in case of an error
        raise
