import logging
from sqlalchemy import select
from lcfs.db.models.Organization import Organization

logger = logging.getLogger(__name__)


async def seed_organizations(session):
    """
    Seeds the organizations into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    organizations_to_seed = [
        {
            "organization_id": 2,
            "name": "QuantumNova Fuels",
            "email": "info@quantumnova.com",
            "phone": "000-555-1234",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 1,
            "organization_attorney_address_id": 1,
        },
        {
            "organization_id": 3,
            "name": "NebulaWings Dynamics",
            "email": "contact@nebulawings.org",
            "phone": "000-555-5678",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 2,
            "organization_attorney_address_id": 2,
        },
        {
            "organization_id": 4,
            "name": "SolarFlare Innovations",
            "email": "admin@solarflare.net",
            "phone": "000-555-9101",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 3,
            "organization_attorney_address_id": 3,
        },
        {
            "organization_id": 5,
            "name": "SkySail Industries",
            "email": "info@skysail.com",
            "phone": "000-555-1122",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 4,
            "organization_attorney_address_id": 4,
        },
        {
            "organization_id": 6,
            "name": "BioVista Fuels",
            "email": "contact@biovista.org",
            "phone": "000-555-1313",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 5,
            "organization_attorney_address_id": 5,
        },
        {
            "organization_id": 7,
            "name": "ElectraSphere Innovations",
            "email": "admin@electrasphere.net",
            "phone": "000-555-1414",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 6,
            "organization_attorney_address_id": 6,
        },
        {
            "organization_id": 8,
            "name": "GasVortex Enterprises",
            "email": "info@gasvortex.com",
            "phone": "000-555-1515",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 7,
            "organization_attorney_address_id": 7,
        },
        {
            "organization_id": 9,
            "name": "EcoPulse Solutions",
            "email": "contact@ecopulse.org",
            "phone": "000-555-1616",
            "edrms_record": "12345",
            "organization_status_id": 1,
            "organization_type_id": 2,
            "organization_address_id": 8,
            "organization_attorney_address_id": 8,
        },
        {
            "organization_id": 10,
            "name": "FusionGalaxy Dynamics",
            "email": "admin@fusiongalaxy.net",
            "phone": "000-555-1717",
            "edrms_record": "12345",
            "organization_status_id": 3,
            "organization_type_id": 3,
            "organization_address_id": 9,
            "organization_attorney_address_id": 9,
        },
        {
            "organization_id": 11,
            "name": "TurboDrive Dynamics",
            "email": "info@turbodrive.com",
            "phone": "000-555-1818",
            "edrms_record": "12345",
            "organization_status_id": 4,
            "organization_type_id": 4,
            "organization_address_id": 10,
            "organization_attorney_address_id": 10,
        },
    ]

    try:
        for organization_data in organizations_to_seed:
            # Check if the Organization already exists based on organization_id
            exists = await session.execute(
                select(Organization).where(
                    Organization.organization_id
                    == organization_data["organization_id"],
                )
            )
            if not exists.scalars().first():
                organization = Organization(**organization_data)
                session.add(organization)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding organizations: %s", e)
        raise
