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
            "organization_address_id": 1,
            "name": "QuantumNova Fuels",
            "street_address": "123 Quantum Street",
            "address_other": "",
            "city": "Futurica",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V1X 2P3",
        },
        {
            "organization_address_id": 2,
            "name": "NebulaWings Dynamics",
            "street_address": "789 Stellar Lane",
            "address_other": "Floor 10",
            "city": "Nebula Bay",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V2O 3P6",
        },
        {
            "organization_address_id": 3,
            "name": "SolarFlare Innovations",
            "street_address": "345 Radiant Road",
            "address_other": "",
            "city": "Solartown",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V6M 2W8",
        },
        {
            "organization_address_id": 4,
            "name": "SkySail Industries",
            "street_address": "567 Skyward Way",
            "address_other": "",
            "city": "Aero City",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "T1W 8E9",
        },
        {
            "organization_address_id": 5,
            "name": "BioVista Fuels",
            "street_address": "890 Nature Lane",
            "address_other": "Building 987",
            "city": "BioVista",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "H1A 9B4",
        },
        {
            "organization_address_id": 6,
            "name": "ElectraSphere Innovations",
            "street_address": "1234 Volt Street",
            "address_other": "Floor 567",
            "city": "Electropolis",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V3S 8K6",
        },
        {
            "organization_address_id": 7,
            "name": "GasVortex Enterprises",
            "street_address": "678 Combustion Road",
            "address_other": "",
            "city": "EnergySphere",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "T2E 5G7",
        },
        {
            "organization_address_id": 8,
            "name": "EcoPulse Solutions",
            "street_address": "910 Greenwave Boulevard",
            "address_other": "",
            "city": "RenewaPeak",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V6H 1Z1",
        },
        {
            "organization_address_id": 9,
            "name": "FusionGalaxy Dynamics",
            "street_address": "1122 Fusion Avenue",
            "address_other": "Suite 1213",
            "city": "Astrumtown",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "M4L 3R9",
        },
        {
            "organization_address_id": 10,
            "name": "TurboDrive Dynamics",
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
                    OrganizationAddress.organization_address_id
                    == organization_address_data["organization_address_id"],
                )
            )
            if not exists.scalars().first():
                organization_address = OrganizationAddress(**organization_address_data)
                session.add(organization_address)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding organization addresses: %s", e)
        raise
