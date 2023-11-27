import logging
from sqlalchemy import select
from lcfs.db.models.OrganizationType import OrganizationType, OrgTypeEnum

logger = logging.getLogger(__name__)

async def seed_organization_types(session):
    """
    Seeds the organization types into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    org_types_to_seed = [
        {"org_type": OrgTypeEnum.fuel_supplier, "description": "Fuel Supplier"},
        {"org_type": OrgTypeEnum.electricity_supplier, "description": "Electricity Supplier"},
        {"org_type": OrgTypeEnum.broker, "description": "Broker"},
        {"org_type": OrgTypeEnum.utilities, "description": "Utilities (local or public)"}
    ]

    try:
        for org_type_data in org_types_to_seed:
            # Check if the OrganizationType already exists based on org_type
            exists = await session.execute(
                select(OrganizationType).where(OrganizationType.org_type == org_type_data["org_type"])
            )
            if not exists.scalars().first():
                org_type = OrganizationType(**org_type_data)
                session.add(org_type)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding organization types: %s", e)
        raise
