import structlog
from sqlalchemy import select
from lcfs.db.models.organization.OrganizationAddress import OrganizationAddress

logger = structlog.get_logger(__name__)


async def seed_test_organization_addresses(session):
    """
    Seeds the organization addresses into the database based on actual test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    organization_addresses_to_seed = [
        {
            "organization_address_id": 1,
            "name": "LCFS Org 1",
            "street_address": "697 Burrard Street",
            "address_other": "",
            "city": "Vancouver",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V6G 2P3",
        },
        {
            "organization_address_id": 2,
            "name": "LCFS Org 2",
            "street_address": "789 164 Street",
            "address_other": "Floor 10",
            "city": "Surrey",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V2O 3P6",
        },
        {
            "organization_address_id": 3,
            "name": "LCFS Org 3",
            "street_address": "345 Radiant Road",
            "address_other": "",
            "city": "Kamloops",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V6M 2W8",
        },
        {
            "organization_address_id": 4,
            "name": "LCFS Org 4",
            "street_address": "567 Skyward Way",
            "address_other": "",
            "city": "North Vancouver",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V1W 8E9",
        },
        {
            "organization_address_id": 5,
            "name": "LCFS5",
            "street_address": "890 Nature Lane",
            "address_other": "Building 987",
            "city": "BioVista",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "H1A 9B4",
        },
        {
            "organization_address_id": 6,
            "name": "LCFS6",
            "street_address": "1234 Volt Street",
            "address_other": "Floor 567",
            "city": "Electropolis",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V3S 8K6",
        },
        {
            "organization_address_id": 7,
            "name": "LCFS7",
            "street_address": "678 Combustion Road",
            "address_other": "",
            "city": "EnergySphere",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "T2E 5G7",
        },
        {
            "organization_address_id": 8,
            "name": "LCFS Org 8",
            "street_address": "910 Greenwave Boulevard",
            "address_other": "",
            "city": "RenewaPeak",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V6H 1Z1",
        },
        {
            "organization_address_id": 9,
            "name": "LCFS Org 9",
            "street_address": "1122 Fusion Avenue",
            "address_other": "Suite 1213",
            "city": "Astrumtown",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "M4L 3R9",
        },
        {
            "organization_address_id": 10,
            "name": "LCFS Org 10",
            "street_address": "1314 Power Lane",
            "address_other": "Unit 1415",
            "city": "Turbopolis",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "T3E 4X8",
        },
    ]

    for organization_address_data in organization_addresses_to_seed:
        # Check if the organization address already exists
        existing_address = await session.execute(
            select(OrganizationAddress).where(
                OrganizationAddress.organization_address_id
                == organization_address_data["organization_address_id"]
            )
        )
        if existing_address.scalar():
            logger.info(
                f"Organization address with ID {organization_address_data['organization_address_id']} already exists, skipping."
            )
            continue

        # Create and add the new organization address
        organization_address = OrganizationAddress(**organization_address_data)
        session.add(organization_address)

    await session.flush()
    logger.info(f"Seeded {len(organization_addresses_to_seed)} organization addresses.")
