import logging
from sqlalchemy import select
from lcfs.db.models.OrganizationAddress import OrganizationAddress

logger = logging.getLogger(__name__)


async def seed_organization_addresses(session):
    """
    Seeds the organization addresses into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    organization_addresses_to_seed = [
        {
            "name": "LCFS1",
            "street_address": "123 Quantum Street",
            "address_other": "",
            "city": "Futurica",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V1X 2P3",
        },
        {
            "name": "LCFS2",
            "street_address": "789 Stellar Lane",
            "address_other": "Floor 10",
            "city": "Nebula Bay",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V2O 3P6",
        },
        {
            "name": "LCFS3",
            "street_address": "345 Radiant Road",
            "address_other": "",
            "city": "Solartown",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V6M 2W8",
        },
        {
            "name": "LCFS4",
            "street_address": "567 Skyward Way",
            "address_other": "",
            "city": "Aero City",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "T1W 8E9",
        },
        {
            "name": "LCFS5",
            "street_address": "890 Nature Lane",
            "address_other": "Building 987",
            "city": "BioVista",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "H1A 9B4",
        },
        {
            "name": "LCFS6",
            "street_address": "1234 Volt Street",
            "address_other": "Floor 567",
            "city": "Electropolis",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V3S 8K6",
        },
        {
            "name": "LCFS7",
            "street_address": "678 Combustion Road",
            "address_other": "",
            "city": "EnergySphere",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "T2E 5G7",
        },
        {
            "name": "LCFS8",
            "street_address": "910 Greenwave Boulevard",
            "address_other": "",
            "city": "RenewaPeak",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V6H 1Z1",
        },
        {
            "name": "LCFS9",
            "street_address": "1122 Fusion Avenue",
            "address_other": "Suite 1213",
            "city": "Astrumtown",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "M4L 3R9",
        },
        {
            "name": "LCFS10",
            "street_address": "1314 Power Lane",
            "address_other": "Unit 1415",
            "city": "Turbopolis",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "T3E 4X8",
        },
    ]

    try:
        for organization_address_data in organization_addresses_to_seed:
            # Check if the Organization already exists based on organization_address_id
            exists = await session.execute(
                select(OrganizationAddress).where(
                    OrganizationAddress.name == organization_address_data["name"],
                    OrganizationAddress.street_address
                    == organization_address_data["street_address"],
                    OrganizationAddress.address_other
                    == organization_address_data["address_other"],
                )
            )
            if not exists.scalars().first():
                organization_address = OrganizationAddress(**organization_address_data)
                session.add(organization_address)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding organization addresses: %s", e)
        raise
