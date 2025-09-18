import structlog
from datetime import datetime

from sqlalchemy import select, func
from lcfs.db.models.fuel.FuelCode import FuelCode

logger = structlog.get_logger(__name__)

# Base template for the common fields
base_fuel_data = {
    "fuel_status_id": 2,
    "contact_name": "John Doe",
    "contact_email": "john.doe@lcfs.com",
    "edrms": "edrms",
    "last_updated": func.now(),
    "application_date": func.now(),
    "feedstock": "feedstock",
    "feedstock_location": "123 main street",
    "feedstock_misc": "misc data",
    "fuel_production_facility_city": "Vancouver",
    "fuel_production_facility_province_state": "British Columbia",
    "fuel_production_facility_country": "Canada",
    "former_company": "ABC Company",
    "notes": "notes",
}


# Function to create a fuel data entry by extending the base with specific values
def create_fuel_entry(
    fuel_suffix,
    company,
    carbon_intensity,
    effective_date,
    expiration_date,
    fuel_type_id,
    fuel_status_id=2,
    prefix_id=1,
):
    return {
        **base_fuel_data,  # Extend with the base fields
        "fuel_status_id": fuel_status_id,
        "prefix_id": prefix_id,  # Default to BCLCF prefix (1)
        "fuel_suffix": fuel_suffix,
        "company": company,
        "carbon_intensity": carbon_intensity,
        "effective_date": datetime(*effective_date),
        "expiration_date": datetime(*expiration_date),
        "fuel_type_id": fuel_type_id,
    }


async def seed_fuel_codes(session):
    fuel_codes_to_seed = [
        create_fuel_entry(
            fuel_status_id=1,
            fuel_suffix="102.5",
            company="Neste Oil Singapore",
            carbon_intensity=37.21,
            effective_date=(2024, 5, 3),
            expiration_date=(2027, 5, 2),
            fuel_type_id=5,
        ),
        create_fuel_entry(
            fuel_status_id=1,
            fuel_suffix="124.4",
            company="Ag Processing Inc.",
            carbon_intensity=3.62,
            effective_date=(2024, 3, 20),
            expiration_date=(2027, 3, 19),
            fuel_type_id=1,
        ),
        create_fuel_entry(
            fuel_status_id=1,
            fuel_suffix="125.4",
            company="Archer Daniels Midland",
            carbon_intensity=-2.14,
            effective_date=(2024, 1, 1),
            expiration_date=(2026, 12, 31),
            fuel_type_id=1,
        ),
        create_fuel_entry(
            fuel_status_id=3,
            fuel_suffix="138.5",
            company="ADM Agri-Industries Company",
            carbon_intensity=4.26,
            effective_date=(2024, 1, 1),
            expiration_date=(2026, 12, 31),
            fuel_type_id=1,
        ),
        create_fuel_entry(
            fuel_status_id=3,
            fuel_suffix="143.4",
            company="Green Plains Otter Tail LLC",
            carbon_intensity=44.06,
            effective_date=(2024, 1, 1),
            expiration_date=(2026, 12, 31),
            fuel_type_id=4,
        ),
        create_fuel_entry(
            fuel_status_id=3,
            fuel_suffix="251.2",
            company="Incobrasa Industries, Ltd.",
            carbon_intensity=0.35,
            effective_date=(2023, 8, 7),
            expiration_date=(2026, 8, 7),
            fuel_type_id=1,
        ),
        create_fuel_entry(
            fuel_suffix="266.2",
            company="FortisBC Energy Inc.",
            carbon_intensity=20.41,
            effective_date=(2024, 1, 2),
            expiration_date=(2026, 12, 31),
            fuel_type_id=2,
        ),
        create_fuel_entry(
            fuel_suffix="274.2",
            company="Paseo Cargill Energy",
            carbon_intensity=-15.03,
            effective_date=(2024, 1, 25),
            expiration_date=(2027, 1, 24),
            fuel_type_id=1,
        ),
        create_fuel_entry(
            fuel_suffix="286.2",
            company="Bonanza Bioenergy",
            carbon_intensity=35.17,
            effective_date=(2023, 8, 1),
            expiration_date=(2026, 7, 31),
            fuel_type_id=4,
        ),
        create_fuel_entry(
            fuel_suffix="316.1",
            company="FortisBC Energy Inc.",
            carbon_intensity=65.34,
            effective_date=(2024, 1, 1),
            expiration_date=(2026, 12, 31),
            fuel_type_id=7,
        ),
        create_fuel_entry(
            fuel_suffix="317.2",
            company="REG Geismar, LLC",
            carbon_intensity=17.36,
            effective_date=(2024, 7, 1),
            expiration_date=(2027, 6, 30),
            fuel_type_id=5,
        ),
        create_fuel_entry(
            fuel_suffix="339.1",
            company="HTEC Hydrogen Technology & Energy Corp",
            carbon_intensity=21.45,
            effective_date=(2024, 3, 2),
            expiration_date=(2025, 3, 1),
            fuel_type_id=6,
        ),
        create_fuel_entry(
            fuel_suffix="353.2",
            company="Seaspan Ferries Corp",
            carbon_intensity=67.18,
            effective_date=(2024, 7, 1),
            expiration_date=(2027, 6, 30),
            fuel_type_id=7,
        ),
        create_fuel_entry(
            fuel_suffix="357.2",
            company="Superior Propane",
            carbon_intensity=71.21,
            effective_date=(2024, 3, 9),
            expiration_date=(2026, 3, 8),
            fuel_type_id=13,
        ),
        create_fuel_entry(
            fuel_suffix="362.1",
            company="ADM Agri-Industries Company",
            carbon_intensity=-1.00,
            effective_date=(2024, 1, 1),
            expiration_date=(2026, 12, 31),
            fuel_type_id=1,
        ),
        create_fuel_entry(
            fuel_suffix="405.1",
            company="Diamond Green Diesel LLC",
            carbon_intensity=20.37,
            effective_date=(2023, 10, 27),
            expiration_date=(2024, 10, 26),
            fuel_type_id=15,
        ),
        create_fuel_entry(
            fuel_suffix="423.1",
            company="Tidewater Renewables Ltd.",
            carbon_intensity=15.47,
            effective_date=(2024, 7, 1),
            expiration_date=(2025, 6, 30),
            fuel_type_id=5,
        ),
        create_fuel_entry(
            fuel_suffix="568.0",
            company="Montana Renewables LLC",
            carbon_intensity=40.37,
            effective_date=(2024, 3, 1),
            expiration_date=(2025, 2, 28),
            fuel_type_id=11,
        ),
        create_fuel_entry(
            fuel_suffix="595.0",
            company="Parkland Refining (BC)",
            carbon_intensity=-9.52,
            effective_date=(2024, 1, 1),
            expiration_date=(2025, 6, 30),
            fuel_type_id=14,
        ),
        create_fuel_entry(
            fuel_suffix="999.0",
            company="Wayne Enterprises Inc.",
            carbon_intensity=20.30,
            effective_date=(2024, 1, 1),
            expiration_date=(2025, 6, 30),
            fuel_type_id=3,
        ),
        create_fuel_entry(
            fuel_suffix="100.1",
            company="LCFS Test Provider",
            carbon_intensity=75.00,
            effective_date=(2025, 1, 1),
            expiration_date=(2030, 12, 31),
            fuel_type_id=13,  # Propane
            prefix_id=2,  # PROXY prefix
        ),
    ]

    try:
        for fuel_code_data in fuel_codes_to_seed:
            exists = await session.execute(
                select(FuelCode).where(
                    FuelCode.fuel_suffix == fuel_code_data["fuel_suffix"],
                )
            )
            if not exists.scalars().first():
                fuel_code = FuelCode(**fuel_code_data)
                session.add(fuel_code)

    except Exception as e:
        context = {
            "function": "seed_fuel_codes",
        }
        logger.error(
            "Error occurred while seeding fuel codes",
            error=str(e),
            exc_info=e,
            **context,
        )
        raise
