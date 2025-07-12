import structlog
import uuid
from sqlalchemy import select
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.base import ActionTypeEnum

logger = structlog.get_logger(__name__)


async def seed_test_allocation_agreements(session):
    """
    Seeds the allocation agreement records into the database with comprehensive test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the allocation agreements to seed based on actual compliance report data
    allocation_agreements_to_seed = [
        # Compliance Report ID 1 allocation agreements
        {
            "allocation_agreement_id": 1,
            "compliance_report_id": 1,
            "transaction_partner": "Company 1",
            "postal_address": "123 street",
            "transaction_partner_email": "Co1@mail.com",
            "transaction_partner_phone": "555-555-5555",
            "fuel_type_id": 17,  # Gasoline
            "fuel_category_id": 1,  # Renewable fuel (Ethanol)
            "provision_of_the_act_id": 2,  # Fuel code provision
            "fuel_code_id": 9,  # BCLCF286.2 (Ethanol)
            "ci_of_fuel": 35.17,
            "quantity": 300000,
            "units": "Litres",
            "allocation_transaction_type_id": 1,  # Allocated from
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 2,
            "compliance_report_id": 1,
            "transaction_partner": "Company 2",
            "postal_address": "321 Street",
            "transaction_partner_email": "Co2@mail.com",
            "transaction_partner_phone": "555-555-5555",
            "fuel_type_id": 16,  # Diesel
            "fuel_category_id": 2,  # Renewable fuel (HDRD)
            "provision_of_the_act_id": 2,  # Fuel code provision
            "fuel_code_id": 11,  # BCLCF317.2 (HDRD)
            "ci_of_fuel": 17.36,
            "quantity": 1000000,
            "units": "Litres",
            "allocation_transaction_type_id": 1,  # Allocated from
            "display_order": 2,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 3,
            "compliance_report_id": 1,
            "transaction_partner": "Company 3",
            "postal_address": "213 Street",
            "transaction_partner_email": "Co3@mail.com",
            "transaction_partner_phone": "555-555-5555",
            "fuel_type_id": 16,  # Diesel
            "fuel_category_id": 2,  # Renewable fuel (Biodiesel)
            "provision_of_the_act_id": 2,  # Fuel code provision
            "fuel_code_id": 15,  # BCLCF362.1 (Biodiesel)
            "ci_of_fuel": -1.00,
            "quantity": 3000000,
            "units": "Litres",
            "allocation_transaction_type_id": 1,  # Allocated from
            "display_order": 3,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 4,
            "compliance_report_id": 1,
            "transaction_partner": "LCFS Org 3",
            "postal_address": "345 Radiant Road Solartown BC Canada V6M 2W8",
            "transaction_partner_email": "tfrs@gov.bc.ca",
            "transaction_partner_phone": "000-555-9101",
            "fuel_type_id": 17,  # Gasoline
            "fuel_category_id": 1,  # Renewable fuel (Ethanol)
            "provision_of_the_act_id": 2,  # Fuel code provision
            "fuel_code_id": 9,  # BCLCF286.2 (Ethanol)
            "ci_of_fuel": 35.17,
            "quantity": 100000,
            "units": "Litres",
            "allocation_transaction_type_id": 1,  # Allocated from
            "display_order": 4,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 5,
            "compliance_report_id": 1,
            "transaction_partner": "LCFS Org 3",
            "postal_address": "345 Radiant Road Solartown BC Canada V6M 2W8",
            "transaction_partner_email": "tfrs@gov.bc.ca",
            "transaction_partner_phone": "000-555-9101",
            "fuel_type_id": 16,  # Diesel
            "fuel_category_id": 2,  # Renewable fuel (Biodiesel)
            "provision_of_the_act_id": 2,  # Fuel code provision
            "fuel_code_id": 15,  # BCLCF362.1 (Biodiesel)
            "ci_of_fuel": -1.00,
            "quantity": 100000,
            "units": "Litres",
            "allocation_transaction_type_id": 2,  # Allocated to
            "display_order": 5,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        # Compliance Report ID 3 allocation agreements (existing)
        {
            "allocation_agreement_id": 6,
            "compliance_report_id": 3,
            "transaction_partner": "LCFS Org 1",
            "postal_address": "697 Burrard Street Vancouver BC Canada V6G 2P3",
            "transaction_partner_email": "tfrs@gov.bc.ca",
            "transaction_partner_phone": "604-567-8976",
            "fuel_type_id": 17,  # Gasoline
            "fuel_category_id": 1,  # Renewable fuel (Ethanol)
            "provision_of_the_act_id": 2,  # Fuel code provision
            "fuel_code_id": 9,  # BCLCF286.2 (Ethanol)
            "ci_of_fuel": 35.17,
            "quantity": 100000,
            "units": "Litres",
            "allocation_transaction_type_id": 2,  # Allocated to
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 7,
            "compliance_report_id": 3,
            "transaction_partner": "LCFS Org 1",
            "postal_address": "697 Burrard Street Vancouver BC Canada V6G 2P3",
            "transaction_partner_email": "tfrs@gov.bc.ca",
            "transaction_partner_phone": "604-567-8976",
            "fuel_type_id": 16,  # Diesel
            "fuel_category_id": 2,  # Renewable fuel (Biodiesel)
            "provision_of_the_act_id": 2,  # Fuel code provision
            "fuel_code_id": 15,  # BCLCF362.1 (Biodiesel)
            "ci_of_fuel": -1.00,
            "quantity": 100000,
            "units": "Litres",
            "allocation_transaction_type_id": 1,  # Allocated from
            "display_order": 2,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
    ]

    for allocation_data in allocation_agreements_to_seed:
        # Check if the allocation agreement already exists
        existing_allocation = await session.execute(
            select(AllocationAgreement).where(
                AllocationAgreement.allocation_agreement_id
                == allocation_data["allocation_agreement_id"]
            )
        )
        if existing_allocation.scalar():
            logger.info(
                f"Allocation agreement with ID {allocation_data['allocation_agreement_id']} already exists, skipping."
            )
            continue

        # Create and add the new allocation agreement
        allocation_agreement = AllocationAgreement(**allocation_data)
        session.add(allocation_agreement)

    await session.flush()
    logger.info(f"Seeded {len(allocation_agreements_to_seed)} allocation agreements.")
