import pytest
from datetime import date

from lcfs.db.models import FinalSupplyEquipment, LevelOfEquipment
from lcfs.web.api.fuel_code.schema import EndUseTypeSchema, EndUserTypeSchema
from lcfs.web.api.final_supply_equipment.schema import (
    FinalSupplyEquipmentSchema,
    LevelOfEquipmentSchema,
    PortsEnum,
    FinalSupplyEquipmentCreateSchema,
)


@pytest.fixture
def valid_final_supply_equipment() -> FinalSupplyEquipment:
    return FinalSupplyEquipment(
        serial_nbr="SER123",
        final_supply_equipment_id=1,
        compliance_report_id=1,
        supply_from_date=date(2022, 1, 1),
        supply_to_date=date(2022, 1, 1),
        registration_nbr="TESTORG-A1A1A1-001",
        manufacturer="Manufacturer Inc",
        level_of_equipment=LevelOfEquipment(
            level_of_equipment_id=1, name="Name", display_order=1
        ),
        intended_use_types=[],
        intended_user_types=[],
        street_address="Street",
        city="City",
        postal_code="A1A 1A1",
        latitude=90.0,
        longitude=180.0,
        organization_name="Organization Name",
    )


@pytest.fixture
def valid_final_supply_equipment_schema() -> FinalSupplyEquipmentSchema:
    return FinalSupplyEquipmentSchema(
        final_supply_equipment_id=1,
        compliance_report_id=123,
        organization_name="Test Org",
        supply_from_date=date(2022, 1, 1),
        supply_to_date=date(2022, 12, 31),
        registration_nbr="TESTORG-A1A1A1-001",
        kwh_usage=100.0,
        serial_nbr="SER123",
        manufacturer="Manufacturer Inc",
        model="ModelX",
        level_of_equipment="Level 1",
        ports=PortsEnum.SINGLE,
        intended_use_types=["Public"],
        intended_user_types=["General"],
        street_address="123 Test St",
        city="Test City",
        postal_code="A1A 1A1",
        latitude=12.34,
        longitude=56.78,
        notes="Some notes",
    )


@pytest.fixture
def valid_final_supply_equipment_create_schema() -> FinalSupplyEquipmentCreateSchema:
    return FinalSupplyEquipmentCreateSchema(
        final_supply_equipment_id=1,
        compliance_report_id=123,
        organization_name="Test Org",
        supply_from_date=date(2022, 1, 1),
        supply_to_date=date(2022, 12, 31),
        kwh_usage=100.0,
        serial_nbr="SER123",
        manufacturer="Manufacturer Inc",
        model="ModelX",
        level_of_equipment="Level2",
        intended_use_types=[],
        intended_user_types=[],
        ports=PortsEnum.SINGLE,
        street_address="123 Test St",
        city="Test City",
        postal_code="A1A 1A1",
        latitude=12.34,
        longitude=56.78,
        notes="Some notes",
    )
