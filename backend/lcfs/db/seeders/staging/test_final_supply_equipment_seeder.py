import structlog
from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from lcfs.db.models.compliance.FinalSupplyEquipment import FinalSupplyEquipment
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.db.models.compliance.EndUserType import EndUserType

logger = structlog.get_logger(__name__)


async def seed_test_final_supply_equipment(session):
    """
    Seeds the final supply equipment (FSE) records into the database with comprehensive test data,
    if they do not already exist.

    Args:
        session: The database session for committing the new records.
    """

    # Define the FSE records to seed based on actual compliance report data
    fse_records_to_seed = [
        {
            "final_supply_equipment_id": 1,
            "compliance_report_id": 4,
            "supply_from_date": date(2024, 1, 1),
            "supply_to_date": date(2024, 12, 31),
            "kwh_usage": 60000.0,  # 600,000 kWh / 10 stations = 60,000 each
            "registration_nbr": "293J92719",
            "serial_nbr": "ChargeCo",
            "manufacturer": "Company A",
            "model": "Level 2 - High voltage, operating above level 1",
            "level_of_equipment_id": 2,  # Level 2
            "ports": "Single port",
            "street_address": "123 Street",
            "city": "Victoria",
            "postal_code": "V1V 1V1",
            "latitude": 90.0,
            "longitude": -123.0,
            "notes": "Battery bus charging station",
            "organization_name": "Company A",
        },
        {
            "final_supply_equipment_id": 2,
            "compliance_report_id": 4,
            "supply_from_date": date(2024, 1, 1),
            "supply_to_date": date(2024, 12, 31),
            "kwh_usage": 60000.0,
            "registration_nbr": "291hed012",
            "serial_nbr": "ChargeCo",
            "manufacturer": "Company A",
            "model": "Level 2 - High voltage, operating above level 1",
            "level_of_equipment_id": 2,  # Level 2
            "ports": "Single port",
            "street_address": "123 Street",
            "city": "Victoria",
            "postal_code": "V1V 1V1",
            "latitude": 90.0,
            "longitude": -123.0,
            "notes": "Battery bus charging station",
            "organization_name": "Company A",
        },
        {
            "final_supply_equipment_id": 3,
            "compliance_report_id": 4,
            "supply_from_date": date(2024, 1, 1),
            "supply_to_date": date(2024, 12, 31),
            "kwh_usage": 60000.0,
            "registration_nbr": "201918jdnd",
            "serial_nbr": "ChargeCo",
            "manufacturer": "Company A",
            "model": "Level 2 - High voltage, operating above level 1",
            "level_of_equipment_id": 2,  # Level 2
            "ports": "Single port",
            "street_address": "123 Street",
            "city": "Victoria",
            "postal_code": "V1V 1V1",
            "latitude": 90.0,
            "longitude": -123.0,
            "notes": "Battery bus charging station",
            "organization_name": "Company A",
        },
        {
            "final_supply_equipment_id": 4,
            "compliance_report_id": 4,
            "supply_from_date": date(2024, 1, 1),
            "supply_to_date": date(2024, 12, 31),
            "kwh_usage": 60000.0,
            "registration_nbr": "12910jswjms",
            "serial_nbr": "ChargeCo",
            "manufacturer": "Company A",
            "model": "Level 2 - High voltage, operating above level 1",
            "level_of_equipment_id": 2,  # Level 2
            "ports": "Single port",
            "street_address": "123 Street",
            "city": "Victoria",
            "postal_code": "V1V 1V1",
            "latitude": 90.0,
            "longitude": -123.0,
            "notes": "Battery bus charging station",
            "organization_name": "Company A",
        },
        {
            "final_supply_equipment_id": 5,
            "compliance_report_id": 4,
            "supply_from_date": date(2024, 1, 1),
            "supply_to_date": date(2024, 12, 31),
            "kwh_usage": 60000.0,
            "registration_nbr": "1219313ikand",
            "serial_nbr": "ChargeCo",
            "manufacturer": "Company A",
            "model": "Level 2 - High voltage, operating above level 1",
            "level_of_equipment_id": 2,  # Level 2
            "ports": "Single port",
            "street_address": "123 Street",
            "city": "Victoria",
            "postal_code": "V1V 1V1",
            "latitude": 90.0,
            "longitude": -123.0,
            "notes": "Battery bus charging station",
            "organization_name": "Company A",
        },
        {
            "final_supply_equipment_id": 6,
            "compliance_report_id": 4,
            "supply_from_date": date(2024, 1, 1),
            "supply_to_date": date(2024, 12, 31),
            "kwh_usage": 60000.0,
            "registration_nbr": "1212jwsw",
            "serial_nbr": "ChargeCo",
            "manufacturer": "Company A",
            "model": "Level 2 - High voltage, operating above level 1",
            "level_of_equipment_id": 2,  # Level 2
            "ports": "Single port",
            "street_address": "123 Street",
            "city": "Victoria",
            "postal_code": "V1V 1V1",
            "latitude": 90.0,
            "longitude": -123.0,
            "notes": "Battery bus charging station",
            "organization_name": "Company A",
        },
        {
            "final_supply_equipment_id": 7,
            "compliance_report_id": 4,
            "supply_from_date": date(2024, 1, 1),
            "supply_to_date": date(2024, 12, 31),
            "kwh_usage": 60000.0,
            "registration_nbr": "12gddsww",
            "serial_nbr": "ChargeCo",
            "manufacturer": "Company A",
            "model": "Level 2 - High voltage, operating above level 1",
            "level_of_equipment_id": 2,  # Level 2
            "ports": "Single port",
            "street_address": "123 Street",
            "city": "Victoria",
            "postal_code": "V1V 1V1",
            "latitude": 90.0,
            "longitude": -123.0,
            "notes": "Battery bus charging station",
            "organization_name": "Company A",
        },
        {
            "final_supply_equipment_id": 8,
            "compliance_report_id": 4,
            "supply_from_date": date(2024, 1, 1),
            "supply_to_date": date(2024, 12, 31),
            "kwh_usage": 60000.0,
            "registration_nbr": "13qwew4",
            "serial_nbr": "ChargeCo",
            "manufacturer": "Company A",
            "model": "Level 2 - High voltage, operating above level 1",
            "level_of_equipment_id": 2,  # Level 2
            "ports": "Single port",
            "street_address": "123 Street",
            "city": "Victoria",
            "postal_code": "V1V 1V1",
            "latitude": 90.0,
            "longitude": -123.0,
            "notes": "Battery bus charging station",
            "organization_name": "Company A",
        },
        {
            "final_supply_equipment_id": 9,
            "compliance_report_id": 4,
            "supply_from_date": date(2024, 1, 1),
            "supply_to_date": date(2024, 12, 31),
            "kwh_usage": 60000.0,
            "registration_nbr": "142342rfer",
            "serial_nbr": "ChargeCo",
            "manufacturer": "Company A",
            "model": "Level 2 - High voltage, operating above level 1",
            "level_of_equipment_id": 2,  # Level 2
            "ports": "Single port",
            "street_address": "123 Street",
            "city": "Victoria",
            "postal_code": "V1V 1V1",
            "latitude": 90.0,
            "longitude": -123.0,
            "notes": "Battery bus charging station",
            "organization_name": "Company A",
        },
        {
            "final_supply_equipment_id": 10,
            "compliance_report_id": 4,
            "supply_from_date": date(2024, 1, 1),
            "supply_to_date": date(2024, 12, 31),
            "kwh_usage": 60000.0,
            "registration_nbr": "12132edwsass",
            "serial_nbr": "Chargeco",
            "manufacturer": "Company B",
            "model": "Level 2 - High voltage, operating above level 1",
            "level_of_equipment_id": 2,  # Level 2
            "ports": "Dual port",
            "street_address": "222 Street",
            "city": "Victoria",
            "postal_code": "V1V 1V1",
            "latitude": 80.0,
            "longitude": -122.0,
            "notes": "Trolley bus charging station",
            "organization_name": "Company B",
        },
    ]

    # Create FSE records first
    for fse_data in fse_records_to_seed:
        # Check if the FSE record already exists
        existing_fse = await session.execute(
            select(FinalSupplyEquipment).where(
                FinalSupplyEquipment.final_supply_equipment_id
                == fse_data["final_supply_equipment_id"]
            )
        )
        if existing_fse.scalar():
            logger.info(
                f"FSE record with ID {fse_data['final_supply_equipment_id']} already exists, skipping."
            )
            continue

        # Create and add the new FSE record
        fse_record = FinalSupplyEquipment(**fse_data)
        session.add(fse_record)

    await session.flush()

    # Now add the relationships for intended use types and intended user types
    await _seed_fse_relationships(session)

    logger.info(f"Seeded {len(fse_records_to_seed)} final supply equipment records.")


async def _seed_fse_relationships(session):
    """
    Seeds the relationships between FSE records and their intended use types and user types.
    """

    # Get the end use types and user types we need
    battery_bus_use_type = await session.execute(
        select(EndUseType).where(EndUseType.type == "Battery bus")
    )
    battery_bus_use_type = battery_bus_use_type.scalar_one()

    trolley_bus_use_type = await session.execute(
        select(EndUseType).where(EndUseType.type == "Trolley bus")
    )
    trolley_bus_use_type = trolley_bus_use_type.scalar_one()

    multi_unit_user_type = await session.execute(
        select(EndUserType).where(
            EndUserType.type_name == "Multi-unit residential building"
        )
    )
    multi_unit_user_type = multi_unit_user_type.scalar_one()

    # Define the relationships for each FSE record
    fse_relationships = [
        # FSE 1-9: Battery bus use, Multi-unit residential users
        {
            "fse_id": 1,
            "use_type": battery_bus_use_type,
            "user_type": multi_unit_user_type,
        },
        {
            "fse_id": 2,
            "use_type": battery_bus_use_type,
            "user_type": multi_unit_user_type,
        },
        {
            "fse_id": 3,
            "use_type": battery_bus_use_type,
            "user_type": multi_unit_user_type,
        },
        {
            "fse_id": 4,
            "use_type": battery_bus_use_type,
            "user_type": multi_unit_user_type,
        },
        {
            "fse_id": 5,
            "use_type": battery_bus_use_type,
            "user_type": multi_unit_user_type,
        },
        {
            "fse_id": 6,
            "use_type": battery_bus_use_type,
            "user_type": multi_unit_user_type,
        },
        {
            "fse_id": 7,
            "use_type": battery_bus_use_type,
            "user_type": multi_unit_user_type,
        },
        {
            "fse_id": 8,
            "use_type": battery_bus_use_type,
            "user_type": multi_unit_user_type,
        },
        {
            "fse_id": 9,
            "use_type": battery_bus_use_type,
            "user_type": multi_unit_user_type,
        },
        # FSE 10: Trolley bus use, Multi-unit residential users
        {
            "fse_id": 10,
            "use_type": trolley_bus_use_type,
            "user_type": multi_unit_user_type,
        },
    ]

    # Apply the relationships
    for relationship in fse_relationships:
        # Get the FSE record with eager loading of relationships
        fse_result = await session.execute(
            select(FinalSupplyEquipment)
            .options(
                joinedload(FinalSupplyEquipment.intended_use_types),
                joinedload(FinalSupplyEquipment.intended_user_types),
            )
            .where(
                FinalSupplyEquipment.final_supply_equipment_id == relationship["fse_id"]
            )
        )
        fse_record = fse_result.unique().scalar_one_or_none()

        if fse_record:
            # Add intended use type if not already present
            use_type = relationship["use_type"]
            if use_type not in fse_record.intended_use_types:
                fse_record.intended_use_types.append(use_type)

            # Add intended user type if not already present
            user_type = relationship["user_type"]
            if user_type not in fse_record.intended_user_types:
                fse_record.intended_user_types.append(user_type)

    await session.flush()
    logger.info("Seeded FSE intended use and user type relationships.")
