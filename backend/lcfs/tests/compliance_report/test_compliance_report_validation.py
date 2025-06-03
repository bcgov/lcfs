import pytest
from unittest.mock import Mock, AsyncMock
from fastapi import HTTPException, Request

from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository


class MockComplianceReport:
    def __init__(self, status, organization_id=1):
        self.current_status = Mock()
        self.current_status.status = status
        self.organization_id = organization_id


class MockUser:
    def __init__(self, organization_id=1, roles=None):
        self.organization = Mock()
        self.organization.organization_id = organization_id
        self.roles = roles or []


class MockRequest:
    def __init__(self, user):
        self.user = user


@pytest.fixture
def mock_repo():
    return AsyncMock(spec=ComplianceReportRepository)


@pytest.fixture
def validator(mock_repo):
    request = MockRequest(MockUser())
    return ComplianceReportValidation(request=request, repo=mock_repo)


@pytest.mark.anyio
class TestComplianceReportEditableValidation:
    """Tests for the validate_compliance_report_editable method"""

    async def test_validate_editable_with_draft_status(self, validator):
        """Test that Draft status allows editing"""
        report = MockComplianceReport(ComplianceReportStatusEnum.Draft)

        # Should not raise an exception
        await validator.validate_compliance_report_editable(report)

    async def test_validate_editable_with_analyst_adjustment_status(self, validator):
        """Test that Analyst_adjustment status allows editing"""
        report = MockComplianceReport(ComplianceReportStatusEnum.Analyst_adjustment)

        # Should not raise an exception
        await validator.validate_compliance_report_editable(report)

    async def test_validate_editable_with_submitted_status_raises_exception(
        self, validator
    ):
        """Test that Submitted status blocks editing"""
        report = MockComplianceReport(ComplianceReportStatusEnum.Submitted)

        with pytest.raises(HTTPException) as exc_info:
            await validator.validate_compliance_report_editable(report)

        assert exc_info.value.status_code == 403
        assert "cannot be edited" in exc_info.value.detail
        assert "Submitted" in exc_info.value.detail

    async def test_validate_editable_with_assessed_status_raises_exception(
        self, validator
    ):
        """Test that Assessed status blocks editing"""
        report = MockComplianceReport(ComplianceReportStatusEnum.Assessed)

        with pytest.raises(HTTPException) as exc_info:
            await validator.validate_compliance_report_editable(report)

        assert exc_info.value.status_code == 403
        assert "cannot be edited" in exc_info.value.detail
        assert "Assessed" in exc_info.value.detail

    async def test_validate_editable_with_rejected_status_raises_exception(
        self, validator
    ):
        """Test that Rejected status blocks editing"""
        report = MockComplianceReport(ComplianceReportStatusEnum.Rejected)

        with pytest.raises(HTTPException) as exc_info:
            await validator.validate_compliance_report_editable(report)

        assert exc_info.value.status_code == 403
        assert "cannot be edited" in exc_info.value.detail
        assert "Rejected" in exc_info.value.detail

    @pytest.mark.parametrize(
        "status",
        [
            ComplianceReportStatusEnum.Recommended_by_analyst,
            ComplianceReportStatusEnum.Recommended_by_manager,
            ComplianceReportStatusEnum.Not_recommended_by_analyst,
            ComplianceReportStatusEnum.Not_recommended_by_manager,
        ],
    )
    async def test_validate_editable_with_various_non_editable_statuses(
        self, validator, status
    ):
        """Test that various non-editable statuses block editing"""
        report = MockComplianceReport(status)

        with pytest.raises(HTTPException) as exc_info:
            await validator.validate_compliance_report_editable(report)

        assert exc_info.value.status_code == 403
        assert "cannot be edited" in exc_info.value.detail
