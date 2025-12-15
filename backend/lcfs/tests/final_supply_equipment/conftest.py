import pytest
from datetime import date
from unittest.mock import MagicMock

from lcfs.db.models import FinalSupplyEquipment, LevelOfEquipment
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.db.models.compliance.EndUserType import EndUserType
from lcfs.web.api.fuel_code.schema import EndUseTypeSchema, EndUserTypeSchema
from lcfs.web.api.final_supply_equipment.schema import (
    FinalSupplyEquipmentSchema,
    LevelOfEquipmentSchema,
    PortsEnum,
    FinalSupplyEquipmentCreateSchema,
)


@pytest.fixture
def mock_end_use_type():
    """Mock EndUseType with required .type attribute"""
    mock = MagicMock(spec=EndUseType)
    mock.type = "Public"
    return mock


@pytest.fixture
def mock_end_user_type():
    """Mock EndUserType with required .type_name attribute"""
    mock = MagicMock(spec=EndUserType)
    mock.type_name = "General"
    return mock


@pytest.fixture
def valid_final_supply_equipment(mock_end_use_type, mock_end_user_type):
    """
    FinalSupplyEquipment model with valid intended use/user types.
    Uses mock objects to satisfy map_to_schema() requirements.
    """
    fse = MagicMock(spec=FinalSupplyEquipment)
    fse.final_supply_equipment_id = 1
    fse.compliance_report_id = 1
    fse.serial_nbr = "SER123"
    fse.supply_from_date = date(2022, 1, 1)
    fse.supply_to_date = date(2022, 1, 1)
    fse.registration_nbr = "TESTORG-A1A1A1-001"
    fse.manufacturer = "Manufacturer Inc"
    fse.model = "Model X"
    fse.kwh_usage = 100.0
    fse.ports = None
    fse.street_address = "Street"
    fse.city = "City"
    fse.postal_code = "A1A 1A1"
    fse.latitude = 90.0
    fse.longitude = 180.0
    fse.organization_name = "Organization Name"
    fse.notes = None
    # Level of equipment with required .name attribute
    level = MagicMock(spec=LevelOfEquipment)
    level.name = "Level2"
    fse.level_of_equipment = level
    # Required relationships with proper attributes for map_to_schema
    fse.intended_use_types = [mock_end_use_type]
    fse.intended_user_types = [mock_end_user_type]
    return fse


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
        intended_use_types=["Public"],
        intended_user_types=["General"],
        ports=PortsEnum.SINGLE,
        street_address="123 Test St",
        city="Test City",
        postal_code="A1A 1A1",
        latitude=12.34,
        longitude=56.78,
        notes="Some notes",
    )
