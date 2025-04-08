import structlog
from sqlalchemy import select, text
from lcfs.db.models.organization.Organization import Organization

logger = structlog.get_logger(__name__)


async def seed_organizations(session):
    """
    Seeds the organizations into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    organizations_to_seed = [
        {
            "organization_id": 1,
            "organization_code": "7QEV",
            "name": "LCFS Org 1",
            "operating_name": "LCFS Org 1",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1234",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 1,
            "organization_attorney_address_id": 1,
            "has_early_issuance": False,
        },
        {
            "organization_id": 2,
            "organization_code": "DI8C",
            "name": "LCFS Org 2",
            "operating_name": "LCFS Org 2",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-5678",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 2,
            "organization_attorney_address_id": 2,
            "has_early_issuance": False,
        },
        {
            "organization_id": 3,
            "organization_code": "QBE4",
            "name": "LCFS Org 3",
            "operating_name": "LCFS Org 3",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-9101",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 3,
            "organization_attorney_address_id": 3,
            "has_early_issuance": False,
        },
        {
            "organization_id": 4,
            "organization_code": "NC12",
            "name": "LCFS Org 4",
            "operating_name": "LCFS Org 4",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1122",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 1,
            "organization_address_id": 4,
            "organization_attorney_address_id": 4,
            "has_early_issuance": True,
        },
        {
            "organization_id": 5,
            "organization_code": "PQ9T",
            "name": "LCFS Org 5",
            "operating_name": "LCFS Org 5",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1313",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 5,
            "organization_attorney_address_id": 5,
            "has_early_issuance": False,
        },
        {
            "organization_id": 6,
            "organization_code": "5LJR",
            "name": "LCFS Org 6",
            "operating_name": "LCFS Org 6",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1414",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 6,
            "organization_attorney_address_id": 6,
            "has_early_issuance": False,
        },
        {
            "organization_id": 7,
            "organization_code": "W3UI",
            "name": "LCFS Org 7",
            "operating_name": "LCFS Org 7",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1515",
            "edrms_record": "12345",
            "organization_status_id": 2,
            "organization_type_id": 2,
            "organization_address_id": 7,
            "organization_attorney_address_id": 7,
            "has_early_issuance": False,
        },
        {
            "organization_id": 8,
            "organization_code": "MLPR",
            "name": "LCFS Org 8",
            "operating_name": "LCFS Org 8",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1616",
            "edrms_record": "12345",
            "organization_status_id": 1,
            "organization_type_id": 2,
            "organization_address_id": 8,
            "organization_attorney_address_id": 8,
            "has_early_issuance": False,
        },
        {
            "organization_id": 9,
            "organization_code": "076Q",
            "name": "LCFS Org 9",
            "operating_name": "LCFS Org 9",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1717",
            "edrms_record": "12345",
            "organization_status_id": 3,
            "organization_type_id": 3,
            "organization_address_id": 9,
            "organization_attorney_address_id": 9,
            "has_early_issuance": False,
        },
        {
            "organization_id": 10,
            "organization_code": "GJI7",
            "name": "LCFS Org 10",
            "operating_name": "LCFS Org 10",
            "email": "tfrs@gov.bc.ca",
            "phone": "000-555-1818",
            "edrms_record": "12345",
            "organization_status_id": 4,
            "organization_type_id": 4,
            "organization_address_id": 10,
            "organization_attorney_address_id": 10,
            "has_early_issuance": False,
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
        # reset the sequence to latest value
        await session.execute(
            text(
                "SELECT setval('organization_attorney_address_organization_attorney_address_seq', (SELECT MAX(organization_attorney_address_id) FROM organization_attorney_address))"
            )
        )
    except Exception as e:
        context = {
            "function": "seed_organizations",
        }
        logger.error(
            "Error occurred while seeding organizations",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
