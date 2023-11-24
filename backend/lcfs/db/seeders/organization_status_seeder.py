import logging
from lcfs.db.models.OrganizationStatus import OrganizationStatus, OrgStatusEnum

logger = logging.getLogger(__name__)

async def seed_organization_statuses(session):
    """
    Seeds the organization statuses into the database.

    Args:
        session: The database session for committing the new records.
    """

    org_statuses = [
        OrganizationStatus(
            organization_status_id=1,
            status=OrgStatusEnum.Registered,
            description="Active"
        ),
    ]

    try:
        session.add_all(org_statuses)
        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding organization statuses: %s", e)
        raise
