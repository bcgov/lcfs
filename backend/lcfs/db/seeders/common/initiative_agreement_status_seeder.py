import logging
from sqlalchemy import select
from lcfs.db.models.initiative_agreement.InitiativeAgreementStatus import InitiativeAgreementStatus, InitiativeAgreementStatusEnum

logger = logging.getLogger(__name__)


async def seed_initiative_agreement_statuses(session):
    """
    Seeds the initiative agreement statuses into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    initiative_agreement_statuses_to_seed = [
        {
            "initiative_agreement_status_id": 1,
            "status": InitiativeAgreementStatusEnum.Draft,
        },
        {
            "initiative_agreement_status_id": 2,
            "status": InitiativeAgreementStatusEnum.Recommended,
        },
        {
            "initiative_agreement_status_id": 3,
            "status": InitiativeAgreementStatusEnum.Approved,
        },
        {
            "initiative_agreement_status_id": 4,
            "status": InitiativeAgreementStatusEnum.Deleted,
        },
    ]

    try:
        for status_data in initiative_agreement_statuses_to_seed:
            exists = await session.execute(
                select(InitiativeAgreementStatus).where(
                    InitiativeAgreementStatus.status == status_data["status"])
            )
            if not exists.scalars().first():
                status = InitiativeAgreementStatus(**status_data)
                session.add(status)

    except Exception as e:
        logger.error(
            "Error occurred while seeding initiative agreement statuses: %s", e)
        raise
