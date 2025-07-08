import pytest
from unittest.mock import MagicMock

from lcfs.web.api.compliance_report.schema import (
    AssignedAnalystSchema,
    ComplianceReportViewSchema,
    ComplianceReportBaseSchema,
)


class TestAssignedAnalystSchema:
    """Test cases for AssignedAnalystSchema"""

    def test_model_validate_with_analyst(self):
        """Test schema validation with valid analyst data"""
        # Arrange
        mock_analyst = MagicMock()
        mock_analyst.user_profile_id = 123
        mock_analyst.first_name = "John"
        mock_analyst.last_name = "Doe"

        # Act
        result = AssignedAnalystSchema.model_validate(mock_analyst)

        # Assert
        assert result.user_profile_id == 123
        assert result.first_name == "John"
        assert result.last_name == "Doe"
        assert result.initials == "JD"

    def test_model_validate_with_none(self):
        """Test schema validation with None analyst"""
        # Act
        result = AssignedAnalystSchema.model_validate(None)

        # Assert
        assert result is None

    def test_model_validate_empty_names(self):
        """Test schema validation with empty names"""
        # Arrange
        mock_analyst = MagicMock()
        mock_analyst.user_profile_id = 123
        mock_analyst.first_name = ""
        mock_analyst.last_name = ""

        # Act
        result = AssignedAnalystSchema.model_validate(mock_analyst)

        # Assert
        assert result.user_profile_id == 123
        assert result.first_name == ""
        assert result.last_name == ""
        assert result.initials == ""

    def test_model_validate_single_name(self):
        """Test schema validation with only first name"""
        # Arrange
        mock_analyst = MagicMock()
        mock_analyst.user_profile_id = 123
        mock_analyst.first_name = "John"
        mock_analyst.last_name = None

        # Act
        result = AssignedAnalystSchema.model_validate(mock_analyst)

        # Assert
        assert result.user_profile_id == 123
        assert result.first_name == "John"
        assert result.last_name == ""
        assert result.initials == "J"

    def test_initials_generation_logic(self):
        """Test various initials generation scenarios"""
        test_cases = [
            ("John", "Doe", "JD"),
            ("A", "B", "AB"),
            ("Alice", "Smith-Jones", "AS"),  # Should take first letter of last name
            ("", "Doe", "D"),
            ("John", "", "J"),
            ("", "", ""),
        ]

        for first_name, last_name, expected_initials in test_cases:
            mock_analyst = MagicMock()
            mock_analyst.user_profile_id = 123
            mock_analyst.first_name = first_name
            mock_analyst.last_name = last_name

            result = AssignedAnalystSchema.model_validate(mock_analyst)
            assert result.initials == expected_initials


class TestComplianceReportViewSchema:
    """Test cases for ComplianceReportViewSchema"""

    def test_model_validate_with_assigned_analyst(self):
        """Test view schema with assigned analyst"""
        # Arrange
        mock_obj = MagicMock()
        mock_obj.compliance_report_id = 1
        mock_obj.compliance_report_group_uuid = "test-uuid"
        mock_obj.version = 1
        mock_obj.compliance_period_id = 1
        mock_obj.compliance_period = "2024"
        mock_obj.organization_id = 1
        mock_obj.organization_name = "Test Org"
        mock_obj.report_type = "Original"
        mock_obj.report_status_id = 1
        mock_obj.report_status = "Draft"
        mock_obj.update_date = "2024-01-01"
        mock_obj.is_latest = True
        mock_obj.assigned_analyst_id = 123
        mock_obj.assigned_analyst_first_name = "John"
        mock_obj.assigned_analyst_last_name = "Doe"

        # Act
        result = ComplianceReportViewSchema.model_validate(mock_obj)

        # Assert
        assert result.compliance_report_id == 1
        assert result.assigned_analyst is not None
        assert result.assigned_analyst.user_profile_id == 123
        assert result.assigned_analyst.first_name == "John"
        assert result.assigned_analyst.last_name == "Doe"
        assert result.assigned_analyst.initials == "JD"

    def test_model_validate_without_assigned_analyst(self):
        """Test view schema without assigned analyst"""
        # Arrange
        mock_obj = MagicMock()
        mock_obj.compliance_report_id = 1
        mock_obj.compliance_report_group_uuid = "test-uuid"
        mock_obj.version = 1
        mock_obj.compliance_period_id = 1
        mock_obj.compliance_period = "2024"
        mock_obj.organization_id = 1
        mock_obj.organization_name = "Test Org"
        mock_obj.report_type = "Original"
        mock_obj.report_status_id = 1
        mock_obj.report_status = "Draft"
        mock_obj.update_date = "2024-01-01"
        mock_obj.is_latest = True
        mock_obj.assigned_analyst_id = None
        mock_obj.assigned_analyst_first_name = None
        mock_obj.assigned_analyst_last_name = None

        # Act
        result = ComplianceReportViewSchema.model_validate(mock_obj)

        # Assert
        assert result.compliance_report_id == 1
        assert result.assigned_analyst is None

    def test_model_validate_partial_analyst_data(self):
        """Test view schema with partial analyst data"""
        # Arrange
        mock_obj = MagicMock()
        mock_obj.compliance_report_id = 1
        mock_obj.compliance_report_group_uuid = "test-uuid"
        mock_obj.version = 1
        mock_obj.compliance_period_id = 1
        mock_obj.compliance_period = "2024"
        mock_obj.organization_id = 1
        mock_obj.organization_name = "Test Org"
        mock_obj.report_type = "Original"
        mock_obj.report_status_id = 1
        mock_obj.report_status = "Draft"
        mock_obj.update_date = "2024-01-01"
        mock_obj.is_latest = True
        mock_obj.assigned_analyst_id = 123
        mock_obj.assigned_analyst_first_name = "John"
        mock_obj.assigned_analyst_last_name = None  # Missing last name

        # Act
        result = ComplianceReportViewSchema.model_validate(mock_obj)

        # Assert
        assert result.compliance_report_id == 1
        assert result.assigned_analyst is not None
        assert result.assigned_analyst.user_profile_id == 123
        assert result.assigned_analyst.first_name == "John"
        assert result.assigned_analyst.last_name == ""
        assert result.assigned_analyst.initials == "J"


class TestComplianceReportBaseSchema:
    """Test cases for ComplianceReportBaseSchema"""

    def test_model_validate_with_assigned_analyst_relationship(self):
        """Test base schema with assigned analyst relationship"""
        # Arrange
        mock_obj = MagicMock()
        mock_obj.compliance_report_id = 1
        mock_obj.compliance_report_group_uuid = "test-uuid"
        mock_obj.version = 1
        mock_obj.compliance_period_id = 1
        mock_obj.organization_id = 1
        mock_obj.current_status_id = 1
        mock_obj.has_supplemental = False
        
        # Mock assigned analyst relationship
        mock_analyst = MagicMock()
        mock_analyst.user_profile_id = 123
        mock_analyst.first_name = "Jane"
        mock_analyst.last_name = "Smith"
        mock_obj.assigned_analyst = mock_analyst

        # Act
        result = ComplianceReportBaseSchema.model_validate(mock_obj)

        # Assert
        assert result.compliance_report_id == 1
        assert result.assigned_analyst is not None
        assert result.assigned_analyst.user_profile_id == 123
        assert result.assigned_analyst.first_name == "Jane"
        assert result.assigned_analyst.last_name == "Smith"
        assert result.assigned_analyst.initials == "JS"

    def test_model_validate_without_assigned_analyst_relationship(self):
        """Test base schema without assigned analyst relationship"""
        # Arrange
        mock_obj = MagicMock()
        mock_obj.compliance_report_id = 1
        mock_obj.compliance_report_group_uuid = "test-uuid"
        mock_obj.version = 1
        mock_obj.compliance_period_id = 1
        mock_obj.organization_id = 1
        mock_obj.current_status_id = 1
        mock_obj.has_supplemental = False
        mock_obj.assigned_analyst = None

        # Act
        result = ComplianceReportBaseSchema.model_validate(mock_obj)

        # Assert
        assert result.compliance_report_id == 1
        assert result.assigned_analyst is None