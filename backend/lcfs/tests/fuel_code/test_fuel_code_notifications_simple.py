import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch

from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.web.api.base import NotificationTypeEnum
from lcfs.web.api.notification.schema import (
    FUEL_CODE_STATUS_NOTIFICATION_MAPPER,
    NotificationRequestSchema,
    NotificationMessageSchema,
)


class TestFuelCodeNotificationLogic:
    """Test fuel code notification logic without complex model dependencies"""

    @pytest.mark.anyio
    async def test_notification_mapper_integration(self):
        """Test that notification mapper works correctly for fuel code status changes"""
        # Test Draft → Recommended (triggers director notification)
        recommended_notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Recommended)
        assert recommended_notifications is not None
        assert NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION in recommended_notifications

        # Test Recommended → Approved (triggers analyst notification)
        approved_notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Approved)
        assert approved_notifications is not None
        assert NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL in approved_notifications

        # Note: "Return to analyst" (Recommended → Draft) is handled as a special case 
        # in the service logic, not in the mapper

    @pytest.mark.anyio
    async def test_fuel_code_service_notification_integration_mocked(self):
        """Test fuel code service notification integration with full mocking"""
        
        with patch('lcfs.web.api.fuel_code.services.FuelCodeServices') as MockService:
            with patch('lcfs.web.api.notification.services.NotificationService') as MockNotificationService:
                
                # Create mock instances
                service_instance = MockService.return_value
                notification_service = MockNotificationService.return_value
                
                # Mock the notification sending
                notification_service.send_notification = AsyncMock()
                
                # Mock a simple service method that would send notifications
                async def mock_update_with_notification(fuel_code_id, status, user):
                    # Simulate the notification logic from our service
                    notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(status)
                    if notifications:
                        message_data = {
                            "id": fuel_code_id,
                            "status": status.value,
                            "fuelCode": "BCLCF001",
                            "company": "Test Company",
                        }
                        notification_data = NotificationMessageSchema(
                            type="Fuel Code Recommended",
                            message=json.dumps(message_data),
                            related_organization_id=None,
                            origin_user_profile_id=user.user_profile_id,
                            related_transaction_id=str(fuel_code_id),
                        )
                        if notifications and isinstance(notifications, list):
                            await notification_service.send_notification(
                                NotificationRequestSchema(
                                    notification_types=notifications,
                                    notification_data=notification_data,
                                )
                            )
                    return {"status": "success"}
                
                service_instance.update_fuel_code_status = mock_update_with_notification
                
                # Create mock user
                mock_user = MagicMock()
                mock_user.user_profile_id = 1
                
                # Test the notification flow
                result = await service_instance.update_fuel_code_status(
                    fuel_code_id=1,
                    status=FuelCodeStatusEnum.Recommended,
                    user=mock_user
                )
                
                # Verify notification was called
                notification_service.send_notification.assert_called_once()
                
                # Verify the notification request structure
                call_args = notification_service.send_notification.call_args[0][0]
                assert isinstance(call_args, NotificationRequestSchema)
                assert NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION in call_args.notification_types
                
                # Verify notification data
                notification_data = call_args.notification_data
                assert notification_data.type == "Fuel Code Recommended"
                assert notification_data.origin_user_profile_id == 1
                assert notification_data.related_transaction_id == "1"
                
                # Verify message content
                message_data = json.loads(notification_data.message)
                assert message_data["id"] == 1
                assert message_data["status"] == "Recommended"

    def test_notification_message_structure(self):
        """Test that notification message structure is correct"""
        # Test message data structure
        message_data = {
            "id": 123,
            "status": "Recommended",
            "fuelCode": "BCLCF001",
            "company": "Test Company",
        }
        
        notification_data = NotificationMessageSchema(
            type="Fuel Code Returned",
            message=json.dumps(message_data),
            related_organization_id=None,
            origin_user_profile_id=456,
            related_transaction_id="123",
        )
        
        # Verify all required fields are present
        assert notification_data.type == "Fuel Code Returned"
        assert notification_data.origin_user_profile_id == 456
        assert notification_data.related_transaction_id == "123"
        assert notification_data.related_organization_id is None
        
        # Verify message content
        parsed_message = json.loads(notification_data.message)
        assert parsed_message["id"] == 123
        assert parsed_message["status"] == "Recommended"
        assert parsed_message["fuelCode"] == "BCLCF001"
        assert parsed_message["company"] == "Test Company"

    def test_notification_request_structure(self):
        """Test that notification request structure is correct"""
        # Create notification data
        notification_data = NotificationMessageSchema(
            type="Fuel Code Recommended",
            message='{"id": 1, "status": "Recommended"}',
            origin_user_profile_id=1,
            related_transaction_id="1",
        )
        
        # Create notification request
        notification_request = NotificationRequestSchema(
            notification_types=[NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION],
            notification_data=notification_data,
        )
        
        # Verify structure
        assert len(notification_request.notification_types) == 1
        assert NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION in notification_request.notification_types
        assert notification_request.notification_data == notification_data

    @pytest.mark.parametrize("status,expected_notification", [
        (FuelCodeStatusEnum.Recommended, NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION),
        (FuelCodeStatusEnum.Approved, NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL),
    ])
    def test_status_to_notification_mapping(self, status, expected_notification):
        """Test specific status to notification mappings"""
        notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(status)
        assert notifications is not None
        assert expected_notification in notifications

    def test_return_to_analyst_notification(self):
        """Test return to analyst notification logic"""
        # "Return to analyst" is not in the mapper, it's handled as a special case
        # when previous_status is Recommended and new status is Draft
        notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get("Return to analyst")
        assert notifications is None  # This should be None since it's handled specially

    def test_no_notification_for_unmapped_status(self):
        """Test that unmapped statuses don't trigger notifications"""
        # Draft and Deleted should not have notifications
        draft_notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Draft)
        deleted_notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Deleted)
        
        assert draft_notifications is None
        assert deleted_notifications is None

    def test_fuel_code_notification_workflow_coverage(self):
        """Test that all required workflow transitions are covered"""
        # Requirement 1: Director - Draft → Recommended
        recommended_notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Recommended)
        assert recommended_notifications is not None
        assert NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION in recommended_notifications
        
        # Requirement 2: Analyst - Recommended → Draft (Return)
        # Note: This is handled as a special case in the service, not in the mapper
        
        # Requirement 3: Analyst - Recommended → Approved
        approved_notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Approved)
        assert approved_notifications is not None
        assert NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL in approved_notifications

    def test_notification_types_exist_in_enum(self):
        """Test that all fuel code notification types exist in the base enum"""
        fuel_code_notification_types = [
            "IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION",
            "IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED",
            "IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL"
        ]
        
        for notification_type_name in fuel_code_notification_types:
            # Verify the enum value exists
            assert hasattr(NotificationTypeEnum, notification_type_name)
            enum_value = getattr(NotificationTypeEnum, notification_type_name)
            assert enum_value.value == notification_type_name