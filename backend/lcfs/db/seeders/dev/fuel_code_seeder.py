import logging
from sqlalchemy import select, func
from lcfs.db.models.FuelCode import FuelCode

logger = logging.getLogger(__name__)


async def seed_fuel_codes(session):
    fuel_codes_to_seed = [
        {
            "fuel_code_id": 1,
            "fuel_status_id": 1,
            "prefix_id": 1,
            "fuel_code": "1000.1",
            "company": "Company 1",
            "carbon_intensity": 123,
            "edrms": "edrms",
            "last_updated": func.now(),
            "application_date": func.now(),
            "fuel_type_id": 1,
            "feedstock": 'feedstock',
            "feedstock_location": "123 main street",
            "feedstock_misc": "misc data",
            "fuel_production_facility_location": "321 main street",
            "facility_nameplate_capacity": 123,
            "former_company": "ABC Company",
            "notes": "notes",
        },
        {
            "fuel_code_id": 2,
            "fuel_status_id": 1,
            "prefix_id": 1,
            "fuel_code": "1000.2",
            "company": "Company 1",
            "carbon_intensity": 123,
            "edrms": "edrms",
            "last_updated": func.now(),
            "application_date": func.now(),
            "fuel_type_id": 2,
            "feedstock": 'feedstock',
            "feedstock_location": "123 main street",
            "feedstock_misc": "misc data",
            "fuel_production_facility_location": "321 main street",
            "facility_nameplate_capacity": 123,
            "former_company": "ABC Company",
            "notes": "notes",
        },
        {
            "fuel_code_id": 3,
            "fuel_status_id": 1,
            "prefix_id": 1,
            "fuel_code": "2000.1",
            "company": "Company 2",
            "carbon_intensity": 123,
            "edrms": "edrms",
            "last_updated": func.now(),
            "application_date": func.now(),
            "fuel_type_id": 3,
            "feedstock": 'feedstock',
            "feedstock_location": "123 main street",
            "feedstock_misc": "misc data",
            "fuel_production_facility_location": "321 main street",
            "facility_nameplate_capacity": 123,
            "former_company": "ABC Company",
            "notes": "notes",
        },
        {
            "fuel_code_id": 4,
            "fuel_status_id": 1,
            "prefix_id": 1,
            "fuel_code": "2000.2",
            "company": "Company 2",
            "carbon_intensity": 123,
            "edrms": "edrms",
            "last_updated": func.now(),
            "application_date": func.now(),
            "fuel_type_id": 4,
            "feedstock": 'feedstock',
            "feedstock_location": "123 main street",
            "feedstock_misc": "misc data",
            "fuel_production_facility_location": "321 main street",
            "facility_nameplate_capacity": 123,
            "former_company": "ABC Company",
            "notes": "notes",
        },
        {
            "fuel_code_id": 5,
            "fuel_status_id": 1,
            "prefix_id": 1,
            "fuel_code": "2000.3",
            "company": "Company 2",
            "carbon_intensity": 123,
            "edrms": "edrms",
            "last_updated": func.now(),
            "application_date": func.now(),
            "fuel_type_id": 5,
            "feedstock": 'feedstock',
            "feedstock_location": "123 main street",
            "feedstock_misc": "misc data",
            "fuel_production_facility_location": "321 main street",
            "facility_nameplate_capacity": 123,
            "former_company": "ABC Company",
            "notes": "notes",
        },
        {
            "fuel_code_id": 6,
            "fuel_status_id": 1,
            "prefix_id": 1,
            "fuel_code": "3000.1",
            "company": "Company 3",
            "carbon_intensity": 123,
            "edrms": "edrms",
            "last_updated": func.now(),
            "application_date": func.now(),
            "fuel_type_id": 6,
            "feedstock": 'feedstock',
            "feedstock_location": "123 main street",
            "feedstock_misc": "misc data",
            "fuel_production_facility_location": "321 main street",
            "facility_nameplate_capacity": 123,
            "former_company": "ABC Company",
            "notes": "notes",
        },

    ]

    try:
        for fuel_code_data in fuel_codes_to_seed:
            exists = await session.execute(
                select(FuelCode).where(
                    FuelCode.fuel_code == fuel_code_data["fuel_code"],
                )
            )
            if not exists.scalars().first():
                fuel_code = FuelCode(**fuel_code_data)
                session.add(fuel_code)

        await session.commit()
    except Exception as e:
        logger.error("Error occurred while seeding fuel codes: %s", e)
        raise
