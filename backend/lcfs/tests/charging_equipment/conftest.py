import pytest
from datetime import datetime
from unittest.mock import MagicMock

from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment, PortsEnum
from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus
from lcfs.db.models.compliance.ChargingSite import ChargingSite
from lcfs.db.models.compliance.LevelOfEquipment import LevelOfEquipment
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.fuel.EndUseType import EndUseType
from lcfs.web.api.charging_equipment.schema import (
    ChargingEquipmentBaseSchema,
    ChargingEquipmentCreateSchema,
    ChargingEquipmentUpdateSchema,
    ChargingEquipmentStatusEnum,
)


@pytest.fixture
def mock_charging_site():
    """Create a mock charging site."""
    site = MagicMock(spec=ChargingSite)
    site.charging_site_id = 1
    site.organization_id = 1
    site.site_code = "TEST1"
    site.site_name = "Test Charging Site"
    return site


@pytest.fixture
def mock_equipment_status():
    """Create a mock equipment status."""
    status = MagicMock(spec=ChargingEquipmentStatus)
    status.charging_equipment_status_id = 1
    status.status = "Draft"
    return status


@pytest.fixture
def mock_level_of_equipment():
    """Create a mock level of equipment."""
    level = MagicMock(spec=LevelOfEquipment)
    level.level_of_equipment_id = 1
    level.name = "Level 2"
    level.description = "Level 2 charging equipment"
    return level


@pytest.fixture
def mock_organization():
    """Create a mock organization."""
    org = MagicMock(spec=Organization)
    org.organization_id = 1
    org.name = "Test Organization"
    return org


@pytest.fixture
def mock_end_use_type():
    """Create a mock end use type."""
    end_use = MagicMock(spec=EndUseType)
    end_use.end_use_type_id = 1
    end_use.type = "Commercial"
    end_use.sub_type = "Fleet"
    return end_use


@pytest.fixture
def valid_charging_equipment(
    mock_charging_site, 
    mock_equipment_status, 
    mock_level_of_equipment,
    mock_organization,
    mock_end_use_type
):
    """Create a valid charging equipment instance."""
    equipment = ChargingEquipment(
        charging_equipment_id=1,
        charging_site_id=1,
        status_id=1,
        equipment_number="001",
        allocating_organization_id=1,
        serial_number="ABC123456",
        manufacturer="Tesla",
        model="Supercharger V3",
        level_of_equipment_id=1,
        ports=PortsEnum.DUAL_PORT,
        notes="Test equipment",
        version=1
    )
    
    # Set up relationships
    equipment.charging_site = mock_charging_site
    equipment.status = mock_equipment_status
    equipment.level_of_equipment = mock_level_of_equipment
    equipment.allocating_organization = mock_organization
    equipment.intended_uses = [mock_end_use_type]
    equipment.create_date = datetime(2024, 1, 1)
    equipment.update_date = datetime(2024, 1, 2)
    
    return equipment


@pytest.fixture
def valid_charging_equipment_create_schema():
    """Create a valid charging equipment creation schema."""
    return ChargingEquipmentCreateSchema(
        charging_site_id=1,
        allocating_organization_id=1,
        serial_number="ABC123456",
        manufacturer="Tesla",
        model="Supercharger V3",
        level_of_equipment_id=1,
        ports=PortsEnum.DUAL_PORT,
        notes="Test equipment",
        intended_use_ids=[1]
    )


@pytest.fixture
def valid_charging_equipment_update_schema():
    """Create a valid charging equipment update schema."""
    return ChargingEquipmentUpdateSchema(
        allocating_organization_id=2,
        serial_number="XYZ987654",
        manufacturer="ChargePoint",
        model="Express Plus",
        level_of_equipment_id=2,
        ports=PortsEnum.SINGLE_PORT,
        notes="Updated equipment",
        intended_use_ids=[1, 2]
    )


@pytest.fixture
def valid_charging_equipment_base_schema():
    """Create a valid charging equipment base schema."""
    return ChargingEquipmentBaseSchema(
        charging_equipment_id=1,
        charging_site_id=1,
        status=ChargingEquipmentStatusEnum.DRAFT,
        equipment_number="001",
        registration_number="TEST1-001",
        allocating_organization_id=1,
        allocating_organization_name="Test Organization",
        serial_number="ABC123456",
        manufacturer="Tesla",
        model="Supercharger V3",
        level_of_equipment_id=1,
        level_of_equipment_name="Level 2",
        ports=PortsEnum.DUAL_PORT,
        notes="Test equipment",
        intended_uses=[{
            "end_use_type_id": 1,
            "type": "Commercial",
            "description": "Fleet"
        }],
        version=1
    )