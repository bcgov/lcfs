import logging
from lcfs.db.models.OrganizationType import OrganizationType, OrgTypeEnum

logger = logging.getLogger(__name__)

async def seed_organization_types(session):
    """
    Seeds the organization types into the database.

    Args:
        session: The database session for committing the new records.
    """

    org_types = [
        OrganizationType(
            organization_type_id=1,
            org_type=OrgTypeEnum.broker,
            description="Government"
        ),
    ]

    try:
        session.add_all(org_types)
        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding organization types: %s", e)
        raise
