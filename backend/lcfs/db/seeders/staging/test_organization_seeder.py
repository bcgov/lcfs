import structlog
from sqlalchemy import select
from lcfs.db.models.organization.Organization import Organization

logger = structlog.get_logger(__name__)


async def seed_test_organizations(session):
    """
    Seeds the organizations into the database with comprehensive test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the organizations to seed based on actual test database
    organizations_to_seed = [
        {
            "organization_id": 1,
            "name": "LCFS Org 1",
            "operating_name": "LCFS Org 1",
            "email": "tfrs@gov.bc.ca",
            "phone": "604-567-8976",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 1,
            "organization_attorney_address_id": 1,
        },
        {
            "organization_id": 2,
            "name": "LCFS Org 2",
            "operating_name": "LCFS Org 2",
            "email": "tfrs@gov.bc.ca",
            "phone": "778-896-1198",
            "edrms_record": "897657",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 2,
            "organization_attorney_address_id": 2,
        },
        {
            "organization_id": 3,
            "name": "LCFS Org 3",
            "operating_name": "LCFS Org 3",
            "email": "tfrs@gov.bc.ca",
            "phone": "250-765-9901",
            "edrms_record": "87651",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 3,
            "organization_attorney_address_id": 3,
        },
        {
            "organization_id": 4,
            "name": "LCFS Org 4",
            "operating_name": "LCFS Org 4",
            "email": "tfrs@gov.bc.ca",
            "phone": "250-555-1122",
            "edrms_record": "14537",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 4,
            "organization_attorney_address_id": 4,
        },
        {
            "organization_id": 5,
            "name": "LCFS Org 5",
            "operating_name": "LCFS Org 5",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1313",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 5,
            "organization_attorney_address_id": 5,
        },
        {
            "organization_id": 6,
            "name": "LCFS Org 6",
            "operating_name": "LCFS Org 6",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1414",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 6,
            "organization_attorney_address_id": 6,
        },
        {
            "organization_id": 7,
            "name": "LCFS Org 7",
            "operating_name": "LCFS Org 7",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1515",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 7,
            "organization_attorney_address_id": 7,
        },
        {
            "organization_id": 8,
            "name": "LCFS Org 8",
            "operating_name": "LCFS Org 8",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1616",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 8,
            "organization_attorney_address_id": 8,
        },
        {
            "organization_id": 9,
            "name": "LCFS Org 9",
            "operating_name": "LCFS Org 9",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1717",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 9,
            "organization_attorney_address_id": 9,
        },
        {
            "organization_id": 10,
            "name": "LCFS Org 10",
            "operating_name": "LCFS Org 10",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1818",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 10,
            "organization_attorney_address_id": 10,
        },
    ]

    for organization_data in organizations_to_seed:
        # Check if the organization already exists
        existing_organization = await session.execute(
            select(Organization).where(
                Organization.organization_id == organization_data["organization_id"]
            )
        )
        if existing_organization.scalar():
            logger.info(
                f"Organization with ID {organization_data['organization_id']} already exists, skipping."
            )
            continue

        # Create and add the new organization
        organization = Organization(**organization_data)
        session.add(organization)

    await session.flush()
    logger.info(f"Seeded {len(organizations_to_seed)} organizations.")
