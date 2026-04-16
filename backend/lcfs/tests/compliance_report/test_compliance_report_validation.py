import pytest
from unittest.mock import Mock, AsyncMock
from fastapi import HTTPException, Request

from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.user.Role import RoleEnum
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


def _make_validator_with_user(mock_repo, org_id=1, roles=None):
    """Build a ComplianceReportValidation instance for the given org/roles."""
    if roles is None:
        roles = []
    user = MockUser(organization_id=org_id, roles=roles)
    user.role_names = roles  # user_has_roles reads role_names
    request = MockRequest(user)
    return ComplianceReportValidation(request=request, repo=mock_repo)


@pytest.mark.anyio
class TestValidateOrganizationAccessByGroupUuid:
    """Tests for validate_organization_access_by_group_uuid."""

    async def test_no_reports_raises_404(self, mock_repo):
        """Returns 404 when the group UUID matches no reports."""
        mock_repo.get_compliance_report_chain.return_value = []
        validator = _make_validator_with_user(mock_repo)

        with pytest.raises(HTTPException) as exc_info:
            await validator.validate_organization_access_by_group_uuid("unknown-uuid")

        assert exc_info.value.status_code == 404

    async def test_supplier_same_org_passes(self, mock_repo):
        """Supplier belonging to the report's org passes without exception."""
        report = MockComplianceReport(ComplianceReportStatusEnum.Draft, organization_id=1)
        mock_repo.get_compliance_report_chain.return_value = [report]
        validator = _make_validator_with_user(mock_repo, org_id=1, roles=[])

        await validator.validate_organization_access_by_group_uuid("test-uuid")

    async def test_supplier_different_org_raises_403(self, mock_repo):
        """Supplier from a different org is rejected with 403."""
        report = MockComplianceReport(ComplianceReportStatusEnum.Draft, organization_id=1)
        mock_repo.get_compliance_report_chain.return_value = [report]
        validator = _make_validator_with_user(mock_repo, org_id=99, roles=[])

        with pytest.raises(HTTPException) as exc_info:
            await validator.validate_organization_access_by_group_uuid("test-uuid")

        assert exc_info.value.status_code == 403
        assert "does not have access" in exc_info.value.detail

    async def test_government_user_any_org_passes(self, mock_repo):
        """Government user can access reports from any organization."""
        report = MockComplianceReport(ComplianceReportStatusEnum.Draft, organization_id=42)
        mock_repo.get_compliance_report_chain.return_value = [report]

        user = MockUser(organization_id=1)
        user.role_names = [RoleEnum.GOVERNMENT]
        request = MockRequest(user)
        validator = ComplianceReportValidation(request=request, repo=mock_repo)

        await validator.validate_organization_access_by_group_uuid("test-uuid")

    async def test_supplier_no_organization_raises_403(self, mock_repo):
        """Supplier with no organization is denied access."""
        report = MockComplianceReport(ComplianceReportStatusEnum.Draft, organization_id=1)
        mock_repo.get_compliance_report_chain.return_value = [report]

        user = MockUser(organization_id=1)
        user.role_names = []
        user.organization = None
        request = MockRequest(user)
        validator = ComplianceReportValidation(request=request, repo=mock_repo)

        with pytest.raises(HTTPException) as exc_info:
            await validator.validate_organization_access_by_group_uuid("test-uuid")

        assert exc_info.value.status_code == 403
