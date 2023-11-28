import logging
from sqlalchemy import select
from lcfs.db.models.OrganizationStatus import OrganizationStatus, OrgStatusEnum

logger = logging.getLogger(__name__)

async def seed_organization_statuses(session):
    """
    Seeds the organization statuses into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    org_statuses_to_seed = [
        {"status": OrgStatusEnum.Unregistered, "description": "Unregistered"},
        {"status": OrgStatusEnum.Registered, "description": "Registered"},
        {"status": OrgStatusEnum.Suspended, "description": "Suspended"},
        {"status": OrgStatusEnum.Canceled, "description": "Canceled"}
    ]

    try:
        for org_status_data in org_statuses_to_seed:
            # Check if the OrganizationStatus already exists based on status
            exists = await session.execute(
                select(OrganizationStatus).where(OrganizationStatus.status == org_status_data["status"])
            )
            if not exists.scalars().first():
                org_status = OrganizationStatus(**org_status_data)
                session.add(org_status)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding organization statuses: %s", e)
        raise
