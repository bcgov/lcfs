import structlog
from sqlalchemy import select
from lcfs.db.models.compliance.OtherUses import OtherUses

logger = structlog.get_logger(__name__)


async def seed_test_other_uses(session):
    """
    Seeds the other uses records into the database with comprehensive test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the other uses to seed based on actual compliance report data
    other_uses_to_seed = [
        # Compliance Report ID 1 other uses
        {
            "other_uses_id": 1,
            "compliance_report_id": 1,
            "fuel_type_id": 17,  # Gasoline
            "fuel_category_id": 1,  # Fossil fuel
            "provision_of_the_act_id": 1,  # Prescribed carbon intensity
            "fuel_code_id": None,  # No fuel code for fossil fuel
            "ci_of_fuel": 93.67,
            "quantity_supplied": 15000,
            "units": "Litres",
            "expected_use_id": 1,  # Any
            "rationale": "Fossil-derived gasoline for other uses",
        },
        {
            "other_uses_id": 2,
            "compliance_report_id": 1,
            "fuel_type_id": 16,  # Diesel
            "fuel_category_id": 1,  # Fossil fuel
            "provision_of_the_act_id": 1,  # Prescribed carbon intensity
            "fuel_code_id": None,  # No fuel code for fossil fuel
            "ci_of_fuel": 94.38,
            "quantity_supplied": 9500000,
            "units": "Litres",
            "expected_use_id": 1,  # Any
            "rationale": "Fossil-derived diesel for other uses",
        },
        # Compliance Report ID 3 other uses (existing)
        {
            "other_uses_id": 3,
            "compliance_report_id": 3,
            "fuel_type_id": 16,  # Diesel
            "fuel_category_id": 2,  # Renewable fuel
            "provision_of_the_act_id": 2,  # Fuel code provision
            "fuel_code_id": 15,  # BCLCF362.1 (Biodiesel)
            "ci_of_fuel": -1.00,
            "quantity_supplied": 100000,
            "units": "Litres",
            "expected_use_id": 1,  # Heating oil
            "rationale": "Biodiesel used for heating oil applications",
        },
        {
            "other_uses_id": 4,
            "compliance_report_id": 3,
            "fuel_type_id": 16,  # Diesel
            "fuel_category_id": 1,  # Fossil fuel
            "provision_of_the_act_id": 1,  # Prescribed carbon intensity
            "fuel_code_id": None,  # No fuel code for fossil fuel
            "ci_of_fuel": 94.38,
            "quantity_supplied": 1000000,
            "units": "Litres",
            "expected_use_id": 1,  # Heating oil
            "rationale": "Fossil-derived diesel used for heating oil applications",
        },
        # New other uses for LCFS1-10 (small fossil quantities)
        {
            "other_uses_id": 101,
            "compliance_report_id": 101,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 100,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        {
            "other_uses_id": 102,
            "compliance_report_id": 102,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 80,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        {
            "other_uses_id": 103,
            "compliance_report_id": 103,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 60,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        {
            "other_uses_id": 104,
            "compliance_report_id": 104,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 70,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        {
            "other_uses_id": 105,
            "compliance_report_id": 105,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 50,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        {
            "other_uses_id": 106,
            "compliance_report_id": 106,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 90,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        {
            "other_uses_id": 107,
            "compliance_report_id": 107,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 40,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        {
            "other_uses_id": 108,
            "compliance_report_id": 108,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 30,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        {
            "other_uses_id": 109,
            "compliance_report_id": 109,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 65,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        {
            "other_uses_id": 110,
            "compliance_report_id": 110,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 35,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        # Chain org2 v0-v2
        {
            "other_uses_id": 111,
            "compliance_report_id": 111,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 45,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        {
            "other_uses_id": 112,
            "compliance_report_id": 112,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 55,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
        {
            "other_uses_id": 113,
            "compliance_report_id": 113,
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 1,
            "fuel_code_id": None,
            "ci_of_fuel": 90.0,
            "quantity_supplied": 50,
            "units": "Litres",
            "expected_use_id": 1,
            "rationale": "Test fossil gasoline use",
        },
    ]

    for other_uses_data in other_uses_to_seed:
        # Check if the other uses record already exists
        existing_other_uses = await session.execute(
            select(OtherUses).where(
                OtherUses.other_uses_id == other_uses_data["other_uses_id"]
            )
        )
        if existing_other_uses.scalar():
            logger.info(
                f"Other uses record with ID {other_uses_data['other_uses_id']} already exists, skipping."
            )
            continue

        # Create and add the new other uses record
        other_uses = OtherUses(**other_uses_data)
        session.add(other_uses)

    await session.flush()
    logger.info(f"Seeded {len(other_uses_to_seed)} other uses records.")
