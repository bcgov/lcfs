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
            "name": "LCFS Org 1",
            "operating_name": 'LCFS Org 1',
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1234",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 1,
            "organization_attorney_address_id": 1,
        },
        {
            "name": "LCFS Org 2",
            "operating_name": 'LCFS Org 2',
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-5678",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 2,
            "organization_attorney_address_id": 2,
        },
        {
            "name": "LCFS Org 3",
            "operating_name": 'LCFS Org 3',
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-9101",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 3,
            "organization_attorney_address_id": 3,
        },
        {
            "name": "LCFS Org 4",
            "operating_name": 'LCFS Org 4',
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1122",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 4,
            "organization_attorney_address_id": 4,
        },
        {
            "name": "LCFS Org 5",
            "operating_name": 'LCFS Org 5',
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1313",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 5,
            "organization_attorney_address_id": 5,
        },
        {
            "name": "LCFS Org 6",
            "operating_name": 'LCFS Org 6',
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1414",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 6,
            "organization_attorney_address_id": 6,
        },
        {
            "name": "LCFS Org 7",
            "operating_name": 'LCFS Org 7',
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1515",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 7,
            "organization_attorney_address_id": 7,
        },
        {
            "name": "LCFS Org 8",
            "operating_name": 'LCFS Org 8',
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1616",
            "edrms_record": "12345",
            "organization_status_id": 1,
            "organization_type_id": 2,
            "organization_address_id": 8,
            "organization_attorney_address_id": 8,
        },
        {
            "name": "LCFS Org 9",
            "operating_name": 'LCFS Org 9',
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1717",
            "edrms_record": "12345",
            "organization_status_id": 3,
            "organization_type_id": 3,
            "organization_address_id": 9,
            "organization_attorney_address_id": 9,
        },
        {
            "name": "LCFS Org 10",
            "operating_name": 'LCFS Org 10',
            "email": "tfrs@gov.bc.ca",
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
                    Organization.name == organization_data["name"],
                )
            )
            organization = exists.scalars().first()
            if not organization:
                organization = Organization(**organization_data)
                session.add(organization)
            else:
                organization.email = organization_data["email"]
                organization.phone = organization_data["phone"]
                organization.edrms_record = organization_data["edrms_record"]
                organization.organization_address_id = organization_data[
                    "organization_address_id"
                ]
                organization.organization_attorney_address_id = organization_data[
                    "organization_attorney_address_id"
                ]
                session.add(organization)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding organizations: %s", e)
        raise
