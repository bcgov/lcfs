import structlog
from sqlalchemy import select, text
from lcfs.db.models.organization.Organization import Organization

logger = structlog.get_logger(__name__)


async def seed_pytest_organizations(session):
    """
    Seeds the organizations into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    organizations_to_seed = [
        {
            "name": "GreenLeaf Dynamics",
            "operating_name": "GreenLeaf Dynamics",
            "organization_status_id": 2,
            "organization_type_id": 1,
        },
        {
            "name": "PureEarth Ventures",
            "operating_name": "PureEarth Ventures",
            "organization_status_id": 2,
            "organization_type_id": 1,
        },
        {
            "name": "TerraNova Industries",
            "operating_name": "TerraNova Industries",
            "organization_status_id": 2,
            "organization_type_id": 1,
        },
    ]

    try:
        for org_data in organizations_to_seed:
            # Check if the Organization already exists based on its name
            exists = await session.execute(
                select(Organization).where(Organization.name == org_data["name"])
            )
            if not exists.scalars().first():
                organization = Organization(**org_data)
                session.add(organization)
        await session.execute(
            text(
                "SELECT setval('organization_attorney_address_organization_attorney_address_seq', (SELECT MAX(organization_attorney_address_id) FROM organization_attorney_address))"
            )
        )

    except Exception as e:
        context = {
            "function": "seed_pytest_organizations",
        }
        logger.error(
            "Error occurred while seeding organizations",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
