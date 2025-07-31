import pytest
import json
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

from lcfs.db.models import UserProfile, FuelCode
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum, FuelCodeStatus
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import NotificationTypeEnum
from lcfs.web.api.fuel_code.services import FuelCodeServices
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_code.schema import FuelCodeStatusEnumSchema
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.api.notification.schema import (
    NotificationRequestSchema,
    NotificationMessageSchema,
    FUEL_CODE_STATUS_NOTIFICATION_MAPPER,
)
from lcfs.web.api.email.services import CHESEmailService
from lcfs.web.exception.exceptions import ServiceException


@pytest.fixture
def mock_user():
    """Create a mock user profile"""
    user = UserProfile(
        user_profile_id=1,
        keycloak_username="test_analyst",
        first_name="Test",
        last_name="Analyst",
        email="test.analyst@gov.bc.ca",
        is_active=True,
    )
    return user


@pytest.fixture
def mock_director_user():
    """Create a mock director user profile"""
    user = MagicMock(spec=UserProfile)
    user.user_profile_id = 2
    user.keycloak_username = "test_director"
    user.first_name = "Test"
    user.last_name = "Director"
    user.email = "test.director@gov.bc.ca"
    user.is_active = True
    user.role_names = [RoleEnum.DIRECTOR.name]
    return user


@pytest.fixture
def mock_fuel_code():
    """Create a mock fuel code"""
    # Create mock objects instead of using the actual SQLAlchemy model
    fuel_code = MagicMock(spec=FuelCode)
    fuel_code.fuel_code_id = 1
    fuel_code.fuel_code = "BCLCF001"
    fuel_code.company = "Test Company"
    fuel_code.carbon_intensity = 85.5
    fuel_code.fuel_status_id = 1
    fuel_code.version = 1
    fuel_code.group_uuid = "test-uuid-123"
    fuel_code.create_date = datetime.now()
    fuel_code.update_date = datetime.now()
    fuel_code.last_updated = datetime.now()
    fuel_code.fuel_suffix = "001"
    fuel_code.contact_name = "Test Contact"
    fuel_code.contact_email = "test@example.com"
    fuel_code.edrms = "EDRMS123"
    fuel_code.application_date = datetime.now().date()
    fuel_code.approval_date = None
    fuel_code.effective_date = None
    fuel_code.expiration_date = None
    fuel_code.feedstock = "Test Feedstock"
    fuel_code.feedstock_location = "Test Location"
    fuel_code.feedstock_misc = None
    fuel_code.fuel_production_facility_city = "Vancouver"
    fuel_code.fuel_production_facility_province_state = "BC"
    fuel_code.fuel_production_facility_country = "Canada"
    fuel_code.facility_nameplate_capacity = 100000
    fuel_code.facility_nameplate_capacity_unit = "L"
    fuel_code.former_company = None
    fuel_code.notes = None
    fuel_code.deleted = False
    fuel_code.action_type = "CREATE"
    fuel_code.history_records = []
    
    # Mock the prefix relationship
    fuel_code.fuel_code_prefix = MagicMock()
    fuel_code.fuel_code_prefix.prefix = "BCLCF"
    fuel_code.fuel_code_prefix.fuel_code_prefix_id = 1
    fuel_code.fuel_code_prefix.next_fuel_code = "BCLCF002"
    fuel_code.prefix_id = 1
    
    # Configure access to nested attributes as strings
    fuel_code.fuel_code_prefix.configure_mock(**{
        'nextFuelCode': 'BCLCF002'
    })
    
    # Mock the fuel type relationship
    fuel_code.fuel_type = MagicMock()
    fuel_code.fuel_type.fuel_type = "Biodiesel"
    fuel_code.fuel_type.fuel_type_id = 1
    fuel_code.fuel_type.units = "L"
    fuel_code.fuel_type.provision_1 = MagicMock()
    fuel_code.fuel_type.provision_1.name = "Provision 1"
    fuel_code.fuel_type.provision_2 = MagicMock()
    fuel_code.fuel_type.provision_2.name = "Provision 2"
    fuel_code.fuel_type_id = 1
    
    # Configure access to nested attributes as strings
    fuel_code.fuel_type.configure_mock(**{
        'fuelType': 'Biodiesel',
        'provision1.name': 'Provision 1', 
        'provision2.name': 'Provision 2'
    })
    
    # Mock the fuel code status relationship
    fuel_code.fuel_code_status = MagicMock()
    fuel_code.fuel_code_status.status = FuelCodeStatusEnum.Draft
    fuel_code.fuel_code_status.fuel_code_status_id = 1
    
    # Mock transport modes
    fuel_code.feedstock_fuel_transport_modes = []
    fuel_code.finished_fuel_transport_modes = []
    
    return fuel_code


@pytest.fixture
def mock_fuel_code_status():
    """Create mock fuel code statuses"""
    draft_status = MagicMock()
    draft_status.fuel_code_status_id = 1
    draft_status.status = FuelCodeStatusEnum.Draft
    draft_status.description = "Draft status"
    
    recommended_status = MagicMock()
    recommended_status.fuel_code_status_id = 2
    recommended_status.status = FuelCodeStatusEnum.Recommended
    recommended_status.description = "Recommended status"
    
    approved_status = MagicMock()
    approved_status.fuel_code_status_id = 3
    approved_status.status = FuelCodeStatusEnum.Approved
    approved_status.description = "Approved status"
    
    return {
        FuelCodeStatusEnum.Draft: draft_status,
        FuelCodeStatusEnum.Recommended: recommended_status,
        FuelCodeStatusEnum.Approved: approved_status,
    }


@pytest.fixture
def fuel_code_service_with_notifications():
    """Create FuelCodeServices with mocked dependencies"""
    # Mock repository
    mock_repo = MagicMock(spec=FuelCodeRepository)
    
    # Mock notification service
    mock_notification_service = MagicMock(spec=NotificationService)
    mock_notification_service.send_notification = AsyncMock()
    
    # Create service with mocked dependencies
    service = FuelCodeServices(
        repo=mock_repo,
        notification_service=mock_notification_service
    )
    
    return service, mock_repo, mock_notification_service


class TestFuelCodeNotificationIntegration:
    """Test integration between fuel code status changes and notifications"""

    @pytest.mark.anyio
    async def test_draft_to_recommended_sends_director_notification(
        self, 
        fuel_code_service_with_notifications, 
        mock_fuel_code, 
        mock_fuel_code_status,
        mock_user
    ):
        """Test that changing status from Draft to Recommended sends notification to Director"""
        service, mock_repo, mock_notification_service = fuel_code_service_with_notifications
        
        # Setup mocks
        mock_repo.get_fuel_code.return_value = mock_fuel_code
        mock_repo.get_fuel_code_status.return_value = mock_fuel_code_status[FuelCodeStatusEnum.Recommended]
        mock_repo.update_fuel_code.return_value = mock_fuel_code
        mock_repo.create_fuel_code_history = AsyncMock()
        
        # Execute status change
        await service.update_fuel_code_status(
            fuel_code_id=1,
            status=FuelCodeStatusEnumSchema.Recommended,
            user=mock_user
        )
        
        # Verify notification was sent
        mock_notification_service.send_notification.assert_called_once()
        
        # Verify notification details
        call_args = mock_notification_service.send_notification.call_args[0][0]
        assert isinstance(call_args, NotificationRequestSchema)
        assert NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION in call_args.notification_types
        
        # Verify notification data
        notification_data = call_args.notification_data
        assert notification_data.type == "Fuel Code Recommended"
        assert notification_data.origin_user_profile_id == mock_user.user_profile_id
        assert notification_data.related_transaction_id == "1"
        
        # Verify message content
        message_data = json.loads(notification_data.message)
        assert message_data["id"] == 1
        assert message_data["status"] == "Recommended"
        assert message_data["fuelCode"] == "BCLCF001"
        assert message_data["company"] == "Test Company"

    @pytest.mark.anyio
    async def test_recommended_to_approved_sends_analyst_notification(
        self,
        fuel_code_service_with_notifications,
        mock_fuel_code,
        mock_fuel_code_status,
        mock_director_user
    ):
        """Test that changing status from Recommended to Approved sends notification to Analyst"""
        service, mock_repo, mock_notification_service = fuel_code_service_with_notifications
        
        # Setup mocks
        mock_fuel_code.fuel_status_id = 2  # Currently Recommended
        mock_repo.get_fuel_code.return_value = mock_fuel_code
        mock_repo.get_fuel_code_status.return_value = mock_fuel_code_status[FuelCodeStatusEnum.Approved]
        mock_repo.update_fuel_code.return_value = mock_fuel_code
        mock_repo.create_fuel_code_history = AsyncMock()
        
        # Execute status change
        await service.update_fuel_code_status(
            fuel_code_id=1,
            status=FuelCodeStatusEnumSchema.Approved,
            user=mock_director_user
        )
        
        # Verify notification was sent
        mock_notification_service.send_notification.assert_called_once()
        
        # Verify notification type
        call_args = mock_notification_service.send_notification.call_args[0][0]
        assert NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL in call_args.notification_types

    @pytest.mark.anyio
    async def test_recommended_to_draft_sends_analyst_notification(
        self,
        fuel_code_service_with_notifications,
        mock_fuel_code,
        mock_fuel_code_status,
        mock_director_user
    ):
        """Test that returning fuel code to analyst (Recommended to Draft) sends notification"""
        service, mock_repo, mock_notification_service = fuel_code_service_with_notifications
        
        # Setup mocks - fuel code is currently Recommended
        mock_fuel_code.fuel_code_status = mock_fuel_code_status[FuelCodeStatusEnum.Recommended]
        mock_fuel_code.fuel_status_id = 2
        mock_repo.get_fuel_code.return_value = mock_fuel_code
        mock_repo.get_fuel_code_status.return_value = mock_fuel_code_status[FuelCodeStatusEnum.Draft]
        mock_repo.update_fuel_code.return_value = mock_fuel_code
        mock_repo.create_fuel_code_history = AsyncMock()
        
        # Update status from Recommended to Draft
        await service.update_fuel_code_status(1, FuelCodeStatusEnumSchema.Draft, mock_director_user)
        
        # Verify notification was sent
        mock_notification_service.send_notification.assert_called_once()
        
        # Verify notification type
        call_args = mock_notification_service.send_notification.call_args[0][0]
        assert NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED in call_args.notification_types

    @pytest.mark.anyio
    async def test_no_notification_for_draft_to_draft(
        self,
        fuel_code_service_with_notifications,
        mock_fuel_code,
        mock_fuel_code_status,
        mock_user
    ):
        """Test that no notification is sent for Draft to Draft status change"""
        service, mock_repo, mock_notification_service = fuel_code_service_with_notifications
        
        # Setup mocks
        mock_repo.get_fuel_code.return_value = mock_fuel_code
        mock_repo.get_fuel_code_status.return_value = mock_fuel_code_status[FuelCodeStatusEnum.Draft]
        mock_repo.update_fuel_code.return_value = mock_fuel_code
        mock_repo.create_fuel_code_history = AsyncMock()
        
        # Execute status change
        await service.update_fuel_code_status(
            fuel_code_id=1,
            status=FuelCodeStatusEnumSchema.Draft,
            user=mock_user
        )
        
        # Verify no notification was sent
        mock_notification_service.send_notification.assert_not_called()

    @pytest.mark.anyio
    async def test_notification_mapper_covers_all_required_statuses(self):
        """Test that the notification mapper covers all required status transitions"""
        # Verify the mapper has the expected entries
        assert FuelCodeStatusEnum.Recommended in FUEL_CODE_STATUS_NOTIFICATION_MAPPER
        assert FuelCodeStatusEnum.Approved in FUEL_CODE_STATUS_NOTIFICATION_MAPPER
        
        # Verify the notification types are correct
        recommended_notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER[FuelCodeStatusEnum.Recommended]
        assert NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION in recommended_notifications
        
        approved_notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER[FuelCodeStatusEnum.Approved]
        assert NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL in approved_notifications
        
        # Note: "Return to analyst" (Recommended → Draft) is handled as a special case in the service,
        # not in the mapper

    @pytest.mark.anyio
    async def test_notification_data_structure_is_correct(
        self,
        fuel_code_service_with_notifications,
        mock_fuel_code,
        mock_fuel_code_status,
        mock_user
    ):
        """Test that notification data structure matches expected format"""
        service, mock_repo, mock_notification_service = fuel_code_service_with_notifications
        
        # Setup mocks
        mock_repo.get_fuel_code.return_value = mock_fuel_code
        mock_repo.get_fuel_code_status.return_value = mock_fuel_code_status[FuelCodeStatusEnum.Recommended]
        mock_repo.update_fuel_code.return_value = mock_fuel_code
        mock_repo.create_fuel_code_history = AsyncMock()
        
        # Execute status change
        await service.update_fuel_code_status(
            fuel_code_id=1,
            status=FuelCodeStatusEnumSchema.Recommended,
            user=mock_user
        )
        
        # Get the notification request
        call_args = mock_notification_service.send_notification.call_args[0][0]
        notification_data = call_args.notification_data
        
        # Verify all required fields are present
        assert hasattr(notification_data, 'type')
        assert hasattr(notification_data, 'message')
        assert hasattr(notification_data, 'origin_user_profile_id')
        assert hasattr(notification_data, 'related_transaction_id')
        assert hasattr(notification_data, 'related_organization_id')
        
        # Verify notification type reflects the status
        assert notification_data.type == "Fuel Code Recommended"
        
        # Verify organization_id is None for fuel codes
        assert notification_data.related_organization_id is None
        
        # Verify message contains expected fuel code data
        message_data = json.loads(notification_data.message)
        expected_keys = ["id", "status", "fuelCode", "company"]
        for key in expected_keys:
            assert key in message_data

    @pytest.mark.anyio
    async def test_service_handles_missing_fuel_code_gracefully(
        self,
        fuel_code_service_with_notifications,
        mock_user
    ):
        """Test that service handles missing fuel code appropriately"""
        service, mock_repo, mock_notification_service = fuel_code_service_with_notifications
        
        # Setup mock to return None for fuel code
        mock_repo.get_fuel_code.return_value = None
        
        # Execute and expect ValueError
        with pytest.raises(ValueError, match="Fuel code not found"):
            await service.update_fuel_code_status(
                fuel_code_id=999,
                status=FuelCodeStatusEnumSchema.Recommended,
                user=mock_user
            )
        
        # Verify no notification was sent
        mock_notification_service.send_notification.assert_not_called()

    @pytest.mark.anyio
    async def test_notification_service_error_handling(
        self,
        fuel_code_service_with_notifications,
        mock_fuel_code,
        mock_fuel_code_status,
        mock_user
    ):
        """Test that fuel code update continues even if notification service fails"""
        service, mock_repo, mock_notification_service = fuel_code_service_with_notifications
        
        # Setup mocks
        mock_repo.get_fuel_code.return_value = mock_fuel_code
        mock_repo.get_fuel_code_status.return_value = mock_fuel_code_status[FuelCodeStatusEnum.Recommended]
        mock_repo.update_fuel_code.return_value = mock_fuel_code
        mock_repo.create_fuel_code_history = AsyncMock()
        
        # Make notification service fail
        mock_notification_service.send_notification.side_effect = Exception("Notification service error")
        
        # Execute status change - the service decorator will convert the exception
        # Note: In a real implementation, you might want to catch and log the error
        # rather than letting it propagate, depending on business requirements
        with pytest.raises(ServiceException):
            await service.update_fuel_code_status(
                fuel_code_id=1,
                status=FuelCodeStatusEnumSchema.Recommended,
                user=mock_user
            )
        
        # Verify the fuel code was still updated
        mock_repo.update_fuel_code.assert_called_once()
        mock_repo.create_fuel_code_history.assert_called_once()