import pytest
from unittest.mock import MagicMock

from lcfs.db.models.compliance.ChargingSite import ChargingSite
from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment
from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus
from lcfs.db.models.compliance.ChargingSiteStatus import ChargingSiteStatus
from lcfs.db.models.organization.Organization import Organization
from lcfs.web.api.charging_site.schema import BulkEquipmentStatusUpdateSchema


@pytest.fixture
def mock_organization():
    """Mock organization for testing"""
    org = MagicMock(spec=Organization)
    org.organization_id = 1
    org.name = "Test Organization"
    return org


@pytest.fixture
def mock_charging_site_status():
    """Mock charging site status for testing"""
    status = MagicMock(spec=ChargingSiteStatus)
    status.charging_site_status_id = 1
    status.status = "Draft"
    return status


@pytest.fixture
def mock_equipment_status():
    """Mock equipment status for testing"""
    status = MagicMock(spec=ChargingEquipmentStatus)
    status.charging_equipment_status_id = 1
    status.status = "Submitted"
    return status


@pytest.fixture
def mock_validated_status():
    """Mock validated equipment status for testing"""
    status = MagicMock(spec=ChargingEquipmentStatus)
    status.charging_equipment_status_id = 2
    status.status = "Validated"
    return status


@pytest.fixture
def mock_draft_status():
    """Mock draft equipment status for testing"""
    status = MagicMock(spec=ChargingEquipmentStatus)
    status.charging_equipment_status_id = 3
    status.status = "Draft"
    return status


@pytest.fixture
def mock_charging_site(mock_organization, mock_charging_site_status):
    """Mock charging site for testing"""
    site = MagicMock(spec=ChargingSite)
    site.charging_site_id = 1
    site.site_code = "TEST1"
    site.site_name = "Test Charging Site"
    site.organization_id = 1
    site.status_id = 1
    site.organization = mock_organization
    site.status = mock_charging_site_status
    return site


@pytest.fixture
def mock_charging_equipment(mock_charging_site, mock_equipment_status):
    """Mock charging equipment for testing"""
    equipment = MagicMock(spec=ChargingEquipment)
    equipment.charging_equipment_id = 1
    equipment.serial_number = "TEST-001"
    equipment.charging_site_id = 1
    equipment.status_id = 1
    equipment.charging_site = mock_charging_site
    equipment.status = mock_equipment_status
    return equipment


@pytest.fixture
def mock_equipment_list(mock_charging_equipment):
    """Mock list of charging equipment for testing"""
    # Create multiple equipment items with different IDs and statuses
    equipment_1 = MagicMock(spec=ChargingEquipment)
    equipment_1.charging_equipment_id = 1
    equipment_1.equipment_number = "EQ001"
    equipment_1.registration_number = "REG001"
    equipment_1.serial_number = "TEST-001"
    equipment_1.manufacturer = "Test Manufacturer"
    equipment_1.model = "Test Model"
    equipment_1.level_of_equipment = MagicMock()
    equipment_1.level_of_equipment.name = "Level 1"
    equipment_1.ports = MagicMock()
    equipment_1.ports.value = "2"
    equipment_1.version = 1
    equipment_1.status_id = 1
    equipment_1.status = MagicMock()
    equipment_1.status.status = "Submitted"
    equipment_1.status.charging_equipment_status_id = 1
    equipment_1.allocating_organization = MagicMock()
    equipment_1.allocating_organization.name = "Test Org"
    equipment_1.notes = "Equipment 1 notes"
    equipment_1.organization_name = "Test Org"

    equipment_2 = MagicMock(spec=ChargingEquipment)
    equipment_2.charging_equipment_id = 2
    equipment_2.equipment_number = "EQ002"
    equipment_2.registration_number = "REG002"
    equipment_2.serial_number = "TEST-002"
    equipment_2.manufacturer = "Test Manufacturer 2"
    equipment_2.model = "Test Model 2"
    equipment_2.level_of_equipment = MagicMock()
    equipment_2.level_of_equipment.name = "Level 2"
    equipment_2.ports = MagicMock()
    equipment_2.ports.value = "4"
    equipment_2.version = 1
    equipment_2.status_id = 1
    equipment_2.status = MagicMock()
    equipment_2.status.status = "Submitted"
    equipment_2.status.charging_equipment_status_id = 1
    equipment_2.allocating_organization = MagicMock()
    equipment_2.allocating_organization.name = "Test Org 2"
    equipment_2.notes = "Equipment 2 notes"
    equipment_2.organization_name = "Test Org 2"

    return [equipment_1, equipment_2]


@pytest.fixture
def bulk_update_schema():
    """Mock bulk update schema for testing"""
    return BulkEquipmentStatusUpdateSchema(equipment_ids=[1, 2], new_status="Validated")


@pytest.fixture
def bulk_update_to_draft_schema():
    """Mock bulk update schema for returning to draft"""
    return BulkEquipmentStatusUpdateSchema(equipment_ids=[1, 2], new_status="Draft")


@pytest.fixture
def bulk_update_invalid_schema():
    """Mock bulk update schema with invalid transition"""
    return BulkEquipmentStatusUpdateSchema(equipment_ids=[1, 2], new_status="Validated")


@pytest.fixture
def mock_equipment_with_draft_status():
    """Mock equipment that is in Draft status"""
    equipment = MagicMock(spec=ChargingEquipment)
    equipment.charging_equipment_id = 3
    equipment.serial_number = "TEST-003"
    equipment.status = MagicMock()
    equipment.status.status = "Draft"
    return equipment
