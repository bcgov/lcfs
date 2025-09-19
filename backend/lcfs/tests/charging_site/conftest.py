import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime

from lcfs.db.models.compliance.ChargingSite import ChargingSite
from lcfs.db.models.compliance.ChargingEquipment import ChargingEquipment
from lcfs.db.models.compliance.ChargingEquipmentStatus import ChargingEquipmentStatus
from lcfs.db.models.compliance.ChargingSiteStatus import ChargingSiteStatus
from lcfs.db.models.compliance.EndUserType import EndUserType
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.charging_site.schema import (
    BulkEquipmentStatusUpdateSchema,
    ChargingSiteCreateSchema,
)
from lcfs.web.api.fuel_code.schema import EndUserTypeSchema


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
    equipment.equipment_number = "EQ001"
    equipment.registration_number = "REG001"
    equipment.serial_number = "TEST-001"
    equipment.manufacturer = "Test Manufacturer"
    equipment.model = "Test Model"
    equipment.version = 1
    equipment.charging_site_id = 1
    equipment.status_id = 1
    equipment.notes = "Test equipment notes"
    equipment.charging_site = mock_charging_site
    equipment.status = mock_equipment_status
    equipment.level_of_equipment = MagicMock()
    equipment.level_of_equipment.name = "Level 2"
    equipment.allocating_organization = MagicMock()
    equipment.allocating_organization.name = "Test Org"
    equipment.intended_uses = []
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
    return BulkEquipmentStatusUpdateSchema(equipment_ids=[1, 2], new_status="InvalidStatus")


@pytest.fixture
def mock_clamav_service():
    """Mock ClamAV service for testing file scanning"""
    from lcfs.services.clamav.client import ClamAVService
    service = MagicMock(spec=ClamAVService)
    service.scan_file.return_value = None  # No virus found
    return service


@pytest.fixture
def mock_async_session():
    """Mock async database session for testing"""
    from sqlalchemy.ext.asyncio import AsyncSession
    from unittest.mock import AsyncMock
    
    session = AsyncMock(spec=AsyncSession)
    session.execute.return_value = MagicMock()
    session.scalar.return_value = None
    session.add.return_value = None
    session.merge.return_value = MagicMock()
    session.delete.return_value = None
    session.flush.return_value = None
    session.commit.return_value = None
    session.refresh.return_value = None
    session.begin.return_value.__aenter__ = AsyncMock()
    session.begin.return_value.__aexit__ = AsyncMock()
    
    return session


@pytest.fixture
def mock_equipment_with_draft_status():
    """Mock equipment that is in Draft status"""
    equipment = MagicMock(spec=ChargingEquipment)
    equipment.charging_equipment_id = 3
    equipment.serial_number = "TEST-003"
    equipment.status = MagicMock()
    equipment.status.status = "Draft"
    return equipment


@pytest.fixture
def mock_end_user_type():
    """Mock end user type for testing"""
    user_type = MagicMock(spec=EndUserType)
    user_type.end_user_type_id = 1
    user_type.type_name = "Public"
    user_type.intended_use = True
    return user_type


@pytest.fixture
def mock_user_profile():
    """Mock user profile for testing"""
    user = MagicMock(spec=UserProfile)
    user.user_profile_id = 1
    user.keycloak_username = "testuser"
    user.email = "test@example.com"
    user.first_name = "Test"
    user.last_name = "User"
    user.organization = MagicMock(spec=Organization)
    user.organization.organization_id = 1
    user.organization.name = "Test Organization"
    user.is_government = False
    return user


@pytest.fixture
def valid_charging_site_create_data():
    """Valid charging site create data for testing"""
    return ChargingSiteCreateSchema(
        organization_id=1,
        site_name="Test Charging Site",
        street_address="123 Test Street",
        city="Vancouver",
        postal_code="V6B 1A1",
        latitude=49.2827,
        longitude=-123.1207,
        intended_users=[EndUserTypeSchema(end_user_type_id=1, type_name="Public")],
        notes="Test charging site for unit tests"
    )


@pytest.fixture
def mock_charging_site_with_relationships(mock_organization, mock_charging_site_status, mock_end_user_type):
    """Mock charging site with all relationships loaded"""
    site = MagicMock(spec=ChargingSite)
    site.charging_site_id = 1
    site.organization_id = 1
    site.status_id = 1
    site.version = 1
    site.site_code = "TEST001"
    site.site_name = "Test Charging Site"
    site.street_address = "123 Test Street"
    site.city = "Vancouver"
    site.postal_code = "V6B 1A1"
    site.latitude = 49.2827
    site.longitude = -123.1207
    site.notes = "Test notes"
    site.create_date = datetime.now()
    site.update_date = datetime.now()
    site.create_user = "testuser"
    site.update_user = "testuser"
    
    # Relationships
    site.organization = mock_organization
    site.status = mock_charging_site_status
    site.intended_users = [mock_end_user_type]
    site.documents = []
    site.charging_equipment = []
    
    return site


@pytest.fixture
def mock_pagination_request():
    """Mock pagination request for testing"""
    from lcfs.web.api.base import PaginationRequestSchema
    return PaginationRequestSchema(
        page=1,
        size=10,
        filters=[],
        sort_orders=[]
    )


@pytest.fixture
def mock_redis_client():
    """Mock Redis client for testing"""
    from unittest.mock import AsyncMock
    redis = AsyncMock()
    redis.get.return_value = None
    redis.set.return_value = None
    return redis


@pytest.fixture
def mock_file_upload():
    """Mock file upload for testing"""
    from fastapi import UploadFile
    from io import BytesIO
    
    content = b"test file content for charging site import"
    file = UploadFile(filename="test_charging_sites.xlsx", file=BytesIO(content))
    file.content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return file


@pytest.fixture
def mock_spreadsheet_builder():
    """Mock spreadsheet builder for testing export functionality"""
    with patch('lcfs.web.api.charging_site.export.SpreadsheetBuilder') as mock_builder:
        mock_instance = MagicMock()
        mock_builder.return_value = mock_instance
        mock_instance.build_spreadsheet.return_value = b'mock_spreadsheet_content'
        yield mock_instance
