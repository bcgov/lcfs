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
            "fuel_code_id": 634,  # Ethanol 286.2 (matches original DEV seeder)
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
            "fuel_code_id": 17,  # HDRD 302.1 (representative, CI: 10.05)
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
            "fuel_code_id": 504,  # Biodiesel 232.3 (CI: -1.00, matches original 362.1)
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
            "fuel_code_id": 634,  # Ethanol 286.2
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
            "fuel_code_id": 504,  # Biodiesel 232.3
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
            "fuel_code_id": 634,  # Ethanol 286.2
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
            "fuel_code_id": 504,  # Biodiesel 232.3
            "ci_of_fuel": -1.00,
            "quantity": 100000,
            "units": "Litres",
            "allocation_transaction_type_id": 1,  # Allocated from
            "display_order": 2,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        # New minimal allocation agreements for LCFS1-10
        {
            "allocation_agreement_id": 101,
            "compliance_report_id": 101,
            "transaction_partner": "Partner A",
            "postal_address": "1 Partner Way",
            "transaction_partner_email": "partnerA@example.com",
            "transaction_partner_phone": "000-555-0101",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 50,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 102,
            "compliance_report_id": 102,
            "transaction_partner": "Partner B",
            "postal_address": "2 Partner Way",
            "transaction_partner_email": "partnerB@example.com",
            "transaction_partner_phone": "000-555-0102",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 40,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 103,
            "compliance_report_id": 103,
            "transaction_partner": "Partner C",
            "postal_address": "3 Partner Way",
            "transaction_partner_email": "partnerC@example.com",
            "transaction_partner_phone": "000-555-0103",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 30,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 104,
            "compliance_report_id": 104,
            "transaction_partner": "Partner D",
            "postal_address": "4 Partner Way",
            "transaction_partner_email": "partnerD@example.com",
            "transaction_partner_phone": "000-555-0104",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 35,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 105,
            "compliance_report_id": 105,
            "transaction_partner": "Partner E",
            "postal_address": "5 Partner Way",
            "transaction_partner_email": "partnerE@example.com",
            "transaction_partner_phone": "000-555-0105",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 25,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 106,
            "compliance_report_id": 106,
            "transaction_partner": "Partner F",
            "postal_address": "6 Partner Way",
            "transaction_partner_email": "partnerF@example.com",
            "transaction_partner_phone": "000-555-0106",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 45,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 107,
            "compliance_report_id": 107,
            "transaction_partner": "Partner G",
            "postal_address": "7 Partner Way",
            "transaction_partner_email": "partnerG@example.com",
            "transaction_partner_phone": "000-555-0107",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 20,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 108,
            "compliance_report_id": 108,
            "transaction_partner": "Partner H",
            "postal_address": "8 Partner Way",
            "transaction_partner_email": "partnerH@example.com",
            "transaction_partner_phone": "000-555-0108",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 15,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 109,
            "compliance_report_id": 109,
            "transaction_partner": "Partner I",
            "postal_address": "9 Partner Way",
            "transaction_partner_email": "partnerI@example.com",
            "transaction_partner_phone": "000-555-0109",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 32,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 110,
            "compliance_report_id": 110,
            "transaction_partner": "Partner J",
            "postal_address": "10 Partner Way",
            "transaction_partner_email": "partnerJ@example.com",
            "transaction_partner_phone": "000-555-0110",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 18,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 111,
            "compliance_report_id": 111,
            "transaction_partner": "Partner K",
            "postal_address": "11 Partner Way",
            "transaction_partner_email": "partnerK@example.com",
            "transaction_partner_phone": "000-555-0111",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 22,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 112,
            "compliance_report_id": 112,
            "transaction_partner": "Partner L",
            "postal_address": "12 Partner Way",
            "transaction_partner_email": "partnerL@example.com",
            "transaction_partner_phone": "000-555-0112",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 26,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
        {
            "allocation_agreement_id": 113,
            "compliance_report_id": 113,
            "transaction_partner": "Partner M",
            "postal_address": "13 Partner Way",
            "transaction_partner_email": "partnerM@example.com",
            "transaction_partner_phone": "000-555-0113",
            "fuel_type_id": 17,
            "fuel_category_id": 1,
            "provision_of_the_act_id": 2,
            "fuel_code_id": 634,  # Ethanol 286.2
            "ci_of_fuel": 35.0,
            "quantity": 24,
            "units": "Litres",
            "allocation_transaction_type_id": 1,
            "display_order": 1,
            "group_uuid": str(uuid.uuid4()),
            "version": 0,
            "action_type": ActionTypeEnum.CREATE,
        },
    ]

    # Query all existing allocation agreements at once to avoid autoflush issues
    result = await session.execute(select(AllocationAgreement))
    existing_agreements = result.scalars().all()
    existing_ids = {ag.allocation_agreement_id for ag in existing_agreements}

    # Filter out allocation agreements that already exist
    agreements_to_add = []
    for allocation_data in allocation_agreements_to_seed:
        if allocation_data["allocation_agreement_id"] not in existing_ids:
            agreements_to_add.append(AllocationAgreement(**allocation_data))

    # Add all new allocation agreements at once
    if agreements_to_add:
        session.add_all(agreements_to_add)
        await session.flush()
        logger.info(f"Seeded {len(agreements_to_add)} allocation agreements.")
    else:
        logger.info("All allocation agreements already exist, skipping.")
