import pytest
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.web.api.base import NotificationTypeEnum
from lcfs.web.api.notification.schema import FUEL_CODE_STATUS_NOTIFICATION_MAPPER


class TestFuelCodeNotificationSchema:
    """Test fuel code notification schema and mappings"""

    def test_fuel_code_status_notification_mapper_exists(self):
        """Test that the fuel code status notification mapper is defined"""
        assert FUEL_CODE_STATUS_NOTIFICATION_MAPPER is not None
        assert isinstance(FUEL_CODE_STATUS_NOTIFICATION_MAPPER, dict)

    def test_recommended_status_mapping(self):
        """Test that Recommended status maps to director notification"""
        notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Recommended)
        
        assert notifications is not None
        assert isinstance(notifications, list)
        assert len(notifications) == 1
        assert NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION in notifications

    def test_approved_status_mapping(self):
        """Test that Approved status maps to analyst notification"""
        notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Approved)
        
        assert notifications is not None
        assert isinstance(notifications, list)
        assert len(notifications) == 1
        assert NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL in notifications

    def test_director_returned_notification_type_exists(self):
        """Test that the director returned notification type exists in enum"""
        # The "return to analyst" logic is now handled in service layer
        # Here we just verify the notification type enum exists
        assert hasattr(NotificationTypeEnum, "IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED")
        enum_value = getattr(NotificationTypeEnum, "IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED")
        assert enum_value.value == "IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED"

    def test_draft_status_in_mapper_for_returned_notifications(self):
        """Test that Draft status is in the mapper for returned fuel codes (Recommended → Draft)"""
        notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Draft)
        assert notifications is not None
        assert NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED in notifications

    def test_deleted_status_not_in_mapper(self):
        """Test that Deleted status is not in the mapper (no notifications for deleted)"""
        notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Deleted)
        assert notifications is None

    def test_all_mapped_notification_types_exist_in_enum(self):
        """Test that all notification types referenced in mapper exist in the enum"""
        all_notification_types = set()
        
        for notifications in FUEL_CODE_STATUS_NOTIFICATION_MAPPER.values():
            for notification_type in notifications:
                all_notification_types.add(notification_type)
        
        # Verify all referenced types exist in the enum
        for notification_type in all_notification_types:
            assert hasattr(NotificationTypeEnum, notification_type.name)
            assert notification_type.value in [item.value for item in NotificationTypeEnum]

    def test_fuel_code_notification_types_follow_naming_convention(self):
        """Test that fuel code notification types follow the established naming convention"""
        expected_types = [
            "IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION",
            "IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED", 
            "IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL"
        ]
        
        for expected_type in expected_types:
            # Verify the enum value exists
            assert hasattr(NotificationTypeEnum, expected_type)
            enum_value = getattr(NotificationTypeEnum, expected_type)
            assert enum_value.value == expected_type

    def test_notification_coverage_for_required_workflow(self):
        """Test that all required workflow transitions have notification coverage"""
        # According to requirements:
        # 1. Director: Draft → Recommended (covered by Recommended mapping)
        # 2. Analyst: Recommended → Draft (handled in service layer transition detection)
        # 3. Analyst: Recommended → Approved (covered by Approved mapping)
        
        # Verify Draft → Recommended triggers director notification
        recommended_notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Recommended)
        assert NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION in recommended_notifications
        
        # Verify Recommended → Approved triggers analyst notification
        approved_notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(FuelCodeStatusEnum.Approved)
        assert NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL in approved_notifications
        
        # Verify that the director returned notification type exists for service layer logic
        assert hasattr(NotificationTypeEnum, "IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED")

    def test_notification_types_target_correct_roles(self):
        """Test that notification types target the correct user roles based on naming"""
        # Director notifications should target IDIR_DIRECTOR
        director_notifications = [
            NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION
        ]
        
        for notification in director_notifications:
            assert "IDIR_DIRECTOR" in notification.value
            assert "FUEL_CODE" in notification.value
        
        # Analyst notifications should target IDIR_ANALYST
        analyst_notifications = [
            NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED,
            NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL
        ]
        
        for notification in analyst_notifications:
            assert "IDIR_ANALYST" in notification.value
            assert "FUEL_CODE" in notification.value

    def test_mapper_consistency_with_other_mappers(self):
        """Test that fuel code mapper follows the same pattern as other notification mappers"""
        # Import other mappers for comparison
        from lcfs.web.api.notification.schema import (
            TRANSFER_STATUS_NOTIFICATION_MAPPER,
            COMPLIANCE_REPORT_STATUS_NOTIFICATION_MAPPER
        )
        
        # All mappers should be dictionaries
        assert isinstance(FUEL_CODE_STATUS_NOTIFICATION_MAPPER, dict)
        assert isinstance(TRANSFER_STATUS_NOTIFICATION_MAPPER, dict)
        assert isinstance(COMPLIANCE_REPORT_STATUS_NOTIFICATION_MAPPER, dict)
        
        # All mapper values should be lists of NotificationTypeEnum
        for notifications in FUEL_CODE_STATUS_NOTIFICATION_MAPPER.values():
            assert isinstance(notifications, list)
            for notification in notifications:
                assert isinstance(notification, NotificationTypeEnum)
        
        # Note: Fuel code mapper uses service-layer transition detection for "return to analyst"
        # while other mappers still use the string key approach
        assert "Return to analyst" in TRANSFER_STATUS_NOTIFICATION_MAPPER
        assert "Return to analyst" in COMPLIANCE_REPORT_STATUS_NOTIFICATION_MAPPER

    @pytest.mark.parametrize("status,expected_count", [
        (FuelCodeStatusEnum.Recommended, 1),
        (FuelCodeStatusEnum.Approved, 1),
        
    ])
    def test_notification_counts_per_status(self, status, expected_count):
        """Test that each status maps to the expected number of notifications"""
        notifications = FUEL_CODE_STATUS_NOTIFICATION_MAPPER.get(status)
        assert notifications is not None
        assert len(notifications) == expected_count