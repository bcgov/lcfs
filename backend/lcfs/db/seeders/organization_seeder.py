import logging
from lcfs.db.models.Organization import Organization

logger = logging.getLogger(__name__)

async def seed_organizations(session):
    """
    Seeds the organizations into the database.

    Args:
        session: The database session for committing the new records.
    """

    organizations = [
        Organization(
            organization_id=1,
            name="BC Government",
            organization_status_id=1,
            organization_type_id=1
        ),
    ]

    try:
        session.add_all(organizations)
        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding organizations: %s", e)
        raise
