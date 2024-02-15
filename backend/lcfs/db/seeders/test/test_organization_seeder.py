import logging
from sqlalchemy import select
from lcfs.db.models.Organization import Organization
from faker import Faker

logger = logging.getLogger(__name__)

async def seed_test_organizations(session):
    """
    Seeds the organizations into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """
    fake = Faker()

    organizations_to_seed = [
        {
            "name": fake.company(),
            "organization_status_id": 2,
            "organization_type_id": 1
        },
        {
            "name": fake.company(),
            "organization_status_id": 2,
            "organization_type_id": 1
        },
        {
            "name": fake.company(),
            "organization_status_id": 2,
            "organization_type_id": 1
        },
        {
            "name": fake.company(),
            "organization_status_id": 2,
            "organization_type_id": 1
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

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding organizations: %s", e)
        raise
