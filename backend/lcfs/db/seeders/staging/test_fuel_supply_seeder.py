import structlog
from sqlalchemy import select
from lcfs.db.models.compliance.FuelSupply import FuelSupply

logger = structlog.get_logger(__name__)


async def seed_test_fuel_supplies(session):
    """
    Seeds the fuel supplies into the database with comprehensive test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the fuel supplies to seed based on actual test database
    fuel_supplies_to_seed = [
        {
            "fuel_supply_id": 1,
            "compliance_report_id": 1,
            "quantity": 800000000,
            "units": "Litres",
            "compliance_units": -466916.73600,
            "fuel_category_id": 2,
            "fuel_type_id": 16,
            "provision_of_the_act_id": 1,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 2,
            "compliance_report_id": 1,
            "quantity": 100000000,
            "units": "Litres",
            "compliance_units": 102603.18240,
            "fuel_category_id": 1,
            "fuel_code_id": 634,  # Ethanol 286.2 (matches original DEV seeder)
            "fuel_type_id": 4,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 3,
            "compliance_report_id": 1,
            "quantity": 75000000,
            "units": "Litres",
            "compliance_units": 0.00000,
            "fuel_category_id": 3,
            "fuel_type_id": 18,
            "provision_of_the_act_id": 1,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 4,
            "compliance_report_id": 1,
            "quantity": 20000000,
            "units": "Litres",
            "compliance_units": 56837.67360,
            "fuel_category_id": 2,
            "fuel_code_id": 504,  # Biodiesel 232.3 (CI: -1.00, matches original 362.1)
            "fuel_type_id": 1,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 5,
            "compliance_report_id": 1,
            "quantity": 20000000,
            "units": "Litres",
            "compliance_units": 66770.91360,
            "fuel_category_id": 2,
            "fuel_code_id": 504,  # Biodiesel 232.3
            "fuel_type_id": 1,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 6,
            "compliance_report_id": 1,
            "quantity": 1000000000,
            "units": "Litres",
            "compliance_units": -519905.96800,
            "fuel_category_id": 1,
            "fuel_type_id": 17,
            "provision_of_the_act_id": 1,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 7,
            "compliance_report_id": 1,
            "quantity": 150000000,
            "units": "Litres",
            "compliance_units": 351917.77320,
            "fuel_category_id": 2,
            "fuel_code_id": 17,  # HDRD 302.1 (representative, CI: 10.05)
            "fuel_type_id": 5,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 8,
            "compliance_report_id": 1,
            "quantity": 150000000,
            "units": "Litres",
            "compliance_units": 362659.58820,
            "fuel_category_id": 2,
            "fuel_code_id": 17,  # HDRD 302.1
            "fuel_type_id": 5,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 12,
            "compliance_report_id": 3,
            "quantity": 100000000,
            "units": "Litres",
            "compliance_units": -51990.59680,
            "fuel_category_id": 1,
            "fuel_type_id": 17,
            "provision_of_the_act_id": 1,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 13,
            "compliance_report_id": 3,
            "quantity": 100000000,
            "units": "Litres",
            "compliance_units": -58364.59200,
            "fuel_category_id": 2,
            "fuel_type_id": 16,
            "provision_of_the_act_id": 1,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 14,
            "compliance_report_id": 3,
            "quantity": 10000000,
            "units": "Litres",
            "compliance_units": 10260.31824,
            "fuel_category_id": 1,
            "fuel_code_id": 634,  # Ethanol 286.2 (matches fuel_type_id 4)
            "fuel_type_id": 4,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 15,
            "compliance_report_id": 3,
            "quantity": 10000000,
            "units": "Litres",
            "compliance_units": 28418.83680,
            "fuel_category_id": 2,
            "fuel_code_id": 504,  # Biodiesel 232.3 (matches fuel_type_id 1)
            "fuel_type_id": 1,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 16,
            "compliance_report_id": 3,
            "quantity": 10000000,
            "units": "Litres",
            "compliance_units": 33385.45680,
            "fuel_category_id": 2,
            "fuel_code_id": 504,  # Biodiesel 232.3 (matches fuel_type_id 1)
            "fuel_type_id": 1,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 17,
            "compliance_report_id": 3,
            "quantity": 100000,
            "units": "Litres",
            "compliance_units": 305.97551,
            "fuel_category_id": 1,
            "fuel_code_id": 918,  # Renewable gasoline 398.2 (matches fuel_type_id 14)
            "fuel_type_id": 14,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 18,
            "compliance_report_id": 3,
            "quantity": 10000,
            "units": "Litres",
            "compliance_units": 23.46118,
            "fuel_category_id": 2,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "fuel_type_id": 5,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        # New minimal supplies to drive summaries for LCFS1-10 scenarios
        # CR 101 (Org 1, Draft 2024)
        {
            "fuel_supply_id": 101,
            "compliance_report_id": 101,
            "quantity": 1000,
            "units": "Litres",
            "compliance_units": 20.0,
            "fuel_category_id": 2,  # renewable
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        # CR 102 (Org 2, Submitted 2024)
        {
            "fuel_supply_id": 102,
            "compliance_report_id": 102,
            "quantity": 800,
            "units": "Litres",
            "compliance_units": 16.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        # CR 103 (Org 3, Recommended 2024)
        {
            "fuel_supply_id": 103,
            "compliance_report_id": 103,
            "quantity": 600,
            "units": "Litres",
            "compliance_units": 12.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        # CR 104 (Org 4, Assessed 2024)
        {
            "fuel_supply_id": 104,
            "compliance_report_id": 104,
            "quantity": 700,
            "units": "Litres",
            "compliance_units": 14.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        # CR 105 (Org 5, Analyst Adj 2025)
        {
            "fuel_supply_id": 105,
            "compliance_report_id": 105,
            "quantity": 500,
            "units": "Litres",
            "compliance_units": 10.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        # CR 106 (Org 6, Supplemental 2025)
        {
            "fuel_supply_id": 106,
            "compliance_report_id": 106,
            "quantity": 900,
            "units": "Litres",
            "compliance_units": 18.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        # CR 107 (Org 7, Gov Supplemental 2025)
        {
            "fuel_supply_id": 107,
            "compliance_report_id": 107,
            "quantity": 400,
            "units": "Litres",
            "compliance_units": 8.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        # CR 108 (Org 8, Early Issuance Q 2025)
        {
            "fuel_supply_id": 108,
            "compliance_report_id": 108,
            "quantity": 300,
            "units": "Litres",
            "compliance_units": 6.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        # CR 109 (Org 9, Assessed 2023 baseline)
        {
            "fuel_supply_id": 109,
            "compliance_report_id": 109,
            "quantity": 650,
            "units": "Litres",
            "compliance_units": 13.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        # CR 110 (Org 10, Draft 2025 with baseline)
        {
            "fuel_supply_id": 110,
            "compliance_report_id": 110,
            "quantity": 350,
            "units": "Litres",
            "compliance_units": 7.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        # Chain org2 2025 v0-v2
        {
            "fuel_supply_id": 111,
            "compliance_report_id": 111,
            "quantity": 450,
            "units": "Litres",
            "compliance_units": 9.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 112,
            "compliance_report_id": 112,
            "quantity": 550,
            "units": "Litres",
            "compliance_units": 11.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 113,
            "compliance_report_id": 113,
            "quantity": 500,
            "units": "Litres",
            "compliance_units": 10.0,
            "fuel_category_id": 2,
            "fuel_type_id": 5,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 19,
            "compliance_report_id": 3,
            "quantity": 10000,
            "units": "Litres",
            "compliance_units": 24.17731,
            "fuel_category_id": 2,
            "fuel_code_id": 17,  # HDRD 302.1 (matches fuel_type_id 5)
            "fuel_type_id": 5,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 20,
            "compliance_report_id": 3,
            "quantity": 10000000,
            "units": "Litres",
            "compliance_units": 20123.74728,
            "fuel_category_id": 1,
            "fuel_code_id": 202,  # Renewable naphtha 585.1 (matches fuel_type_id 15)
            "fuel_type_id": 15,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 22,
            "compliance_report_id": 4,
            "quantity": 600000,
            "units": "Kilowatt_hour",
            "compliance_units": 568.61957,
            "fuel_category_id": 1,
            "fuel_type_id": 3,
            "provision_of_the_act_id": 3,
            "end_use_id": 1,
        },
        {
            "fuel_supply_id": 23,
            "compliance_report_id": 3,
            "quantity": 100000000,
            "units": "Litres",
            "compliance_units": 0.00000,
            "fuel_category_id": 3,
            "fuel_type_id": 18,
            "provision_of_the_act_id": 1,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 24,
            "compliance_report_id": 3,
            "quantity": 100000,
            "units": "Litres",
            "compliance_units": 174.45600,
            "fuel_category_id": 3,
            "fuel_code_id": 495,  # Alternative jet fuel 234.2 (matches fuel_type_id 11)
            "fuel_type_id": 11,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 25,
            "compliance_report_id": 6,
            "quantity": 1000000,
            "units": "Cubic_metres",
            "compliance_units": 1949.52271,
            "fuel_category_id": 2,
            "fuel_code_id": 848,  # CNG 678.1 (matches fuel_type_id 2)
            "fuel_type_id": 2,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 26,
            "compliance_report_id": 6,
            "quantity": 1000000,
            "units": "Cubic_metres",
            "compliance_units": 284.77771,
            "fuel_category_id": 2,
            "fuel_type_id": 2,
            "fuel_code_id": 848,  # CNG 678.1 (matches fuel_type_id 2)
            "provision_of_the_act_id": 3,
            "end_use_id": 24,
        },
        {
            "fuel_supply_id": 27,
            "compliance_report_id": 6,
            "quantity": 1000000,
            "units": "Kilowatt_hour",
            "compliance_units": 947.69928,
            "fuel_category_id": 1,
            "fuel_type_id": 3,
            "provision_of_the_act_id": 3,
            "end_use_id": 1,
        },
        {
            "fuel_supply_id": 30,
            "compliance_report_id": 6,
            "quantity": 100000,
            "units": "Litres",
            "compliance_units": 333.85457,
            "fuel_category_id": 2,
            "fuel_code_id": 504,  # Biodiesel 232.3 (matches fuel_type_id 1)
            "fuel_type_id": 1,
            "provision_of_the_act_id": 2,
            "end_use_id": 24,
        },
    ]

    # Query all existing fuel supplies at once to avoid autoflush issues
    result = await session.execute(select(FuelSupply))
    existing_supplies = result.scalars().all()
    existing_ids = {supply.fuel_supply_id for supply in existing_supplies}

    # Filter out fuel supplies that already exist
    supplies_to_add = []
    for fuel_supply_data in fuel_supplies_to_seed:
        if fuel_supply_data["fuel_supply_id"] not in existing_ids:
            supplies_to_add.append(FuelSupply(**fuel_supply_data))

    # Add all new fuel supplies at once
    if supplies_to_add:
        session.add_all(supplies_to_add)
        await session.flush()
        logger.info(f"Seeded {len(supplies_to_add)} fuel supplies.")
    else:
        logger.info("All fuel supplies already exist, skipping.")
