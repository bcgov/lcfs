import pytest
from pathlib import Path
from lcfs.web.api.email.schema import TEMPLATE_MAPPING


class TestFuelCodeEmailTemplates:
    """Test fuel code email templates and template mapping"""

    def test_fuel_code_template_mapping_exists(self):
        """Test that fuel code notification types have template mappings"""
        expected_mappings = {
            "IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION": "idir_director__fuel_code__analyst_recommendation.html",
            "IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED": "idir_analyst__fuel_code__director_returned.html", 
            "IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL": "idir_analyst__fuel_code__director_approval.html"
        }
        
        for notification_type, template_name in expected_mappings.items():
            assert notification_type in TEMPLATE_MAPPING
            assert TEMPLATE_MAPPING[notification_type] == template_name

    def test_fuel_code_email_templates_exist(self):
        """Test that fuel code email template files exist"""
        template_dir = Path("lcfs/web/api/email/templates")
        
        expected_templates = [
            "idir_director__fuel_code__analyst_recommendation.html",
            "idir_analyst__fuel_code__director_returned.html",
            "idir_analyst__fuel_code__director_approval.html"
        ]
        
        for template_name in expected_templates:
            template_path = template_dir / template_name
            assert template_path.exists(), f"Template {template_name} should exist"

    def test_fuel_code_email_templates_content(self):
        """Test that fuel code email templates have correct content structure"""
        template_dir = Path("lcfs/web/api/email/templates")
        
        expected_templates = [
            "idir_director__fuel_code__analyst_recommendation.html",
            "idir_analyst__fuel_code__director_returned.html",
            "idir_analyst__fuel_code__director_approval.html"
        ]
        
        for template_name in expected_templates:
            template_path = template_dir / template_name
            
            if template_path.exists():
                content = template_path.read_text()
                
                # Verify templates extend the base template
                assert "{% extends 'notification_base.html' %}" in content
                
                # Verify notification_type is set to 'Fuel Code'
                assert "{% set notification_type = 'Fuel Code' %}" in content
                
                # Verify url_slug is set to 'fuel-codes'
                assert "{% set url_slug = 'fuel-codes' %}" in content

    def test_template_mapping_completeness(self):
        """Test that all fuel code notification types have template mappings"""
        from lcfs.web.api.base import NotificationTypeEnum
        
        # Get all fuel code related notification types
        fuel_code_notification_types = [
            NotificationTypeEnum.IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION,
            NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED,
            NotificationTypeEnum.IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL
        ]
        
        for notification_type in fuel_code_notification_types:
            assert notification_type.value in TEMPLATE_MAPPING, \
                f"Notification type {notification_type.value} should have a template mapping"

    def test_template_mapping_follows_naming_convention(self):
        """Test that template mappings follow the established naming convention"""
        fuel_code_mappings = {
            key: value for key, value in TEMPLATE_MAPPING.items() 
            if "FUEL_CODE" in key
        }
        
        for notification_type, template_name in fuel_code_mappings.items():
            # Template name should be lowercase version of notification type
            expected_template = notification_type.lower().replace("__", "__") + ".html"
            assert template_name == expected_template, \
                f"Template name {template_name} should match expected pattern {expected_template}"

    def test_fuel_code_templates_use_correct_base_variables(self):
        """Test that fuel code templates set the correct base template variables"""
        template_dir = Path("lcfs/web/api/email/templates")
        
        fuel_code_templates = [
            "idir_director__fuel_code__analyst_recommendation.html",
            "idir_analyst__fuel_code__director_returned.html", 
            "idir_analyst__fuel_code__director_approval.html"
        ]
        
        for template_name in fuel_code_templates:
            template_path = template_dir / template_name
            
            if template_path.exists():
                content = template_path.read_text()
                
                # All fuel code templates should:
                # 1. Extend the base template
                assert "{% extends 'notification_base.html' %}" in content
                
                # 2. Set notification_type to 'Fuel Code'
                assert "{% set notification_type = 'Fuel Code' %}" in content
                
                # 3. Set url_slug to 'fuel-codes' for proper linking
                assert "{% set url_slug = 'fuel-codes' %}" in content

    def test_template_mapping_consistency_with_other_modules(self):
        """Test that fuel code template mappings are consistent with other modules"""
        # Get all template mappings
        all_mappings = TEMPLATE_MAPPING
        
        # Find patterns in existing mappings
        transfer_mappings = {k: v for k, v in all_mappings.items() if "TRANSFER" in k}
        compliance_mappings = {k: v for k, v in all_mappings.items() if "COMPLIANCE_REPORT" in k}
        fuel_code_mappings = {k: v for k, v in all_mappings.items() if "FUEL_CODE" in k}
        
        # All categories should follow similar patterns
        assert len(fuel_code_mappings) > 0, "Should have fuel code mappings"
        assert len(transfer_mappings) > 0, "Should have transfer mappings for comparison"
        assert len(compliance_mappings) > 0, "Should have compliance report mappings for comparison"
        
        # Check that all fuel code mappings follow the same role-based pattern
        for notification_type in fuel_code_mappings.keys():
            # Should start with role identifier (IDIR_ANALYST, IDIR_DIRECTOR, etc.)
            assert any(notification_type.startswith(role) for role in [
                "IDIR_ANALYST", "IDIR_DIRECTOR", "IDIR_COMPLIANCE_MANAGER", "BCEID"
            ]), f"Notification type {notification_type} should start with a role identifier"
            
            # Should contain module identifier
            assert "FUEL_CODE" in notification_type, \
                f"Notification type {notification_type} should contain FUEL_CODE"

    def test_no_unexpected_duplicate_template_mappings(self):
        """Test that there are no unexpected duplicate template mappings.
        
        Some notification types intentionally share templates:
        - Government notifications (BCEID, IDIR_ANALYST, IDIR_COMPLIANCE_MANAGER, 
          IDIR_DIRECTOR) all use government_notification.html
        """
        # Templates that are intentionally reused across multiple notification types
        allowed_shared_templates = {
            "government_notification.html",  # Shared by all government notification types
        }
        
        # Filter out intentionally shared templates
        non_shared_templates = [
            name for name in TEMPLATE_MAPPING.values() 
            if name not in allowed_shared_templates
        ]
        unique_non_shared = set(non_shared_templates)
        
        assert len(non_shared_templates) == len(unique_non_shared), \
            "There should be no unexpected duplicate template mappings"

    def test_fuel_code_template_files_are_minimal_and_consistent(self):
        """Test that fuel code template files are minimal and follow the pattern"""
        template_dir = Path("lcfs/web/api/email/templates")
        
        fuel_code_templates = [
            "idir_director__fuel_code__analyst_recommendation.html",
            "idir_analyst__fuel_code__director_returned.html",
            "idir_analyst__fuel_code__director_approval.html"
        ]
        
        for template_name in fuel_code_templates:
            template_path = template_dir / template_name
            
            if template_path.exists():
                content = template_path.read_text().strip()
                
                # Templates should be minimal (just 3 lines as per our implementation)
                lines = content.split('\n')
                assert len(lines) == 3, f"Template {template_name} should have exactly 3 lines"
                
                # Verify exact content structure
                assert lines[0] == "{% extends 'notification_base.html' %}"
                assert lines[1] == "{% set notification_type = 'Fuel Code' %}"
                assert lines[2] == "{% set url_slug = 'fuel-codes' %}"

    @pytest.mark.parametrize("notification_type,expected_template", [
        ("IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION", "idir_director__fuel_code__analyst_recommendation.html"),
        ("IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED", "idir_analyst__fuel_code__director_returned.html"),
        ("IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL", "idir_analyst__fuel_code__director_approval.html"),
    ])
    def test_specific_template_mappings(self, notification_type, expected_template):
        """Test specific notification type to template mappings"""
        assert notification_type in TEMPLATE_MAPPING
        assert TEMPLATE_MAPPING[notification_type] == expected_template