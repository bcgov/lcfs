import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi import HTTPException, Request

from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.other_uses.schema import OtherUsesCreateSchema
from lcfs.web.api.other_uses.validation import OtherUsesValidation

@pytest.fixture
def other_uses_validation():
    mock_report_repo = MagicMock(spec=ComplianceReportRepository)
    request = MagicMock(spec=Request)
    validation = OtherUsesValidation(
        request=request, report_repo=mock_report_repo
    )
    return validation, mock_report_repo

@pytest.mark.anyio
async def test_validate_organization_access_success(other_uses_validation):
    validation, mock_report_repo = other_uses_validation
    compliance_report_id = 1
    mock_report_repo.get_compliance_report.return_value = MagicMock(organization_id=1)
    validation.request.user.organization.organization_id = 1

    await validation.validate_organization_access(compliance_report_id)

    mock_report_repo.get_compliance_report.assert_awaited_once_with(compliance_report_id)

@pytest.mark.anyio
async def test_validate_organization_access_failure(other_uses_validation):
    validation, mock_report_repo = other_uses_validation
    compliance_report_id = 1
    mock_report_repo.get_compliance_report.return_value = MagicMock(organization_id=1)
    validation.request.user.organization.organization_id = 2

    with pytest.raises(HTTPException) as exc_info:
        await validation.validate_organization_access(compliance_report_id)

    assert exc_info.value.status_code == 403
    assert "User does not have access to this compliance report" in str(exc_info.value.detail)

@pytest.mark.anyio
async def test_validate_compliance_report_id_success(other_uses_validation):
    validation, _ = other_uses_validation
    compliance_report_id = 1
    other_uses_data = [
        OtherUsesCreateSchema(
            compliance_report_id=compliance_report_id,
            quantity_supplied=1000,
            fuel_type="Gasoline",
            fuel_category="Petroleum-based",
            expected_use="Transportation",
            units="L",
            rationale="Test rationale",
        )
    ]

    await validation.validate_compliance_report_id(compliance_report_id, other_uses_data)

@pytest.mark.anyio
async def test_validate_compliance_report_id_failure(other_uses_validation):
    validation, _ = other_uses_validation
    compliance_report_id = 1
    other_uses_data = [
        OtherUsesCreateSchema(
            compliance_report_id=2,  # Different from the passed compliance_report_id
            quantity_supplied=1000,
            fuel_type="Gasoline",
            fuel_category="Petroleum-based",
            expected_use="Transportation",
            units="L",
            rationale="Test rationale",
        )
    ]

    with pytest.raises(HTTPException) as exc_info:
        await validation.validate_compliance_report_id(compliance_report_id, other_uses_data)

    assert exc_info.value.status_code == 400
    assert "Mismatch compliance_report_id" in str(exc_info.value.detail)