import logging
from sqlalchemy import select
from lcfs.db.models.OrganizationAttorneyAddress import OrganizationAttorneyAddress

logger = logging.getLogger(__name__)


async def seed_organization_attorney_addresses(session):
    """
    Seeds the organization attorney addresses into the database, if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    organization_attorney_addresses_to_seed = [
        {
            "organization_attorney_address_id": 1,
            "name": "QuantumNova Fuels",
            "street_address": "456 Nexus Avenue",
            "address_other": "Suite 101",
            "city": "Cosmos City",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V8X 1Y9",
        },
        {
            "organization_attorney_address_id": 2,
            "name": "NebulaWings Dynamics",
            "street_address": "101 Celestial Road",
            "address_other": "Floor 5, Unit B",
            "city": "Astralville",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V4X 4Z7",
        },
        {
            "organization_attorney_address_id": 3,
            "name": "SolarFlare Innovations",
            "street_address": "345 Radiant Road",
            "address_other": "",
            "city": "Solartown",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V6M 2W8",
        },
        {
            "organization_attorney_address_id": 4,
            "name": "SkySail Industries",
            "street_address": "678 Breeze Boulevard",
            "address_other": "Unit 3A",
            "city": "Windhaven",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "S7K 5T1",
        },
        {
            "organization_attorney_address_id": 5,
            "name": "BioVista Fuels",
            "street_address": "890 Nature Lane",
            "address_other": "Building 987",
            "city": "BioVista",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "H1A 9B4",
        },
        {
            "organization_attorney_address_id": 6,
            "name": "ElectraSphere Innovations",
            "street_address": "1234 Volt Street",
            "address_other": "Floor 567",
            "city": "Electropolis",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "V3S 8K6",
        },
        {
            "organization_attorney_address_id": 7,
            "name": "GasVortex Enterprises",
            "street_address": "678 Combustion Road",
            "address_other": "",
            "city": "EnergySphere",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "T2E 5G7",
        },
        {
            "organization_attorney_address_id": 8,
            "name": "EcoPulse Solutions",
            "street_address": "1011 Eco Drive",
            "address_other": "",
            "city": "Greenfield",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "R1N 7L3",
        },
        {
            "organization_attorney_address_id": 9,
            "name": "FusionGalaxy Dynamics",
            "street_address": "1122 Fusion Avenue",
            "address_other": "Suite 1213",
            "city": "Astrumtown",
            "province_state": "BC",
            "country": "Canada",
            "postalCode_zipCode": "M4L 3R9",
        },
        {
            "organization_attorney_address_id": 10,
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
        for (
            organization_attorney_address_data
        ) in organization_attorney_addresses_to_seed:
            # Check if the Organization already exists based on organization_attorney_address_id
            exists = await session.execute(
                select(OrganizationAttorneyAddress).where(
                    OrganizationAttorneyAddress.organization_attorney_address_id
                    == organization_attorney_address_data[
                        "organization_attorney_address_id"
                    ],
                )
            )
            if not exists.scalars().first():
                organization_attorney_address = OrganizationAttorneyAddress(
                    **organization_attorney_address_data
                )
                session.add(organization_attorney_address)

        await session.commit()
    except Exception as e:
        logger.error(
            "Error occurred while seeding organization attorney addresses: %s", e
        )
        raise
