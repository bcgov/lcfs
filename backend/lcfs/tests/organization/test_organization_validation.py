import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi import HTTPException
from types import SimpleNamespace
from datetime import datetime

from lcfs.db.models.transfer.TransferStatus import TransferStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.transfer.schema import TransferCreateSchema
from lcfs.web.api.compliance_report.schema import ComplianceReportCreateSchema


@pytest.mark.anyio
async def test_check_available_balance_success(
    organization_validation, mock_transaction_repo
):
    mock_transaction_repo.calculate_available_balance.return_value = 100

    await organization_validation.check_available_balance(1, 1)

    mock_transaction_repo.calculate_available_balance.assert_called_once()
    pass


@pytest.mark.anyio
async def test_create_transfer_success(
    organization_validation, mock_orgs_repo, mock_request, mock_transaction_repo
):
    mock_orgs_repo.is_registered_for_transfer.return_value = True
    mock_request.user = MagicMock()
    mock_request.user.organization.org_status.organization_status_id = 2
    mock_transaction_repo.calculate_available_balance.return_value = 100

    await organization_validation.create_transfer(
        1,
        TransferCreateSchema(from_organization_id=1, to_organization_id=1, quantity=1),
    )

    mock_orgs_repo.is_registered_for_transfer.assert_called_once()
    mock_transaction_repo.calculate_available_balance.assert_called_once()
    pass

@pytest.mark.anyio
async def test_check_available_balance_excess_quantity(organization_validation):
    organization_validation.transaction_repo.calculate_available_balance.return_value = 500
    
    result = await organization_validation.check_available_balance(1, 1000)
    
    assert result["adjusted"] is True
    assert result["adjusted_quantity"] == 500

@pytest.mark.anyio
async def test_check_available_balance_valid_quantity(organization_validation):
    organization_validation.transaction_repo.calculate_available_balance.return_value = 1000
    
    result = await organization_validation.check_available_balance(1, 500)
    
    assert result["adjusted"] is False
    assert result["adjusted_quantity"] == 500

@pytest.mark.anyio
async def test_update_transfer_success(organization_validation, mock_transaction_repo):
    mock_transaction_repo.calculate_available_balance.return_value = 100
    await organization_validation.update_transfer(
        1,
        TransferCreateSchema(
            from_organization_id=1,
            to_organization_id=2,
            quantity=1,
            current_status=TransferStatusEnum.Draft,
        ),
    )


@pytest.mark.anyio
async def test_create_compliance_report_success(
    organization_validation, mock_report_repo
):
    # Mock the request object and its attributes
    mock_request = MagicMock()
    mock_request.user.organization.organization_id = 1
    organization_validation.request = mock_request

    # Mock the compliance period with proper attributes
    # The validation checks period.description for 2025/2026 restrictions
    mock_period = MagicMock()
    mock_period.description = "2024"
    mock_report_repo.get_compliance_period.return_value = mock_period
    mock_report_repo.get_compliance_report_by_period.return_value = False

    # Call the method under test
    await organization_validation.create_compliance_report(
        1,
        ComplianceReportCreateSchema(
            compliance_period="2024", organization_id=1, status="status"
        ),
    )

    # Assertions
    mock_report_repo.get_compliance_period.assert_called_once_with("2024")
    mock_report_repo.get_compliance_report_by_period.assert_called_once_with(1, "2024")
    organization_validation.report_opening_repo.ensure_year.assert_awaited_once_with(2024)


@pytest.mark.anyio
async def test_create_compliance_report_disabled_year(organization_validation, mock_report_repo):
    mock_request = MagicMock()
    mock_request.user.organization.organization_id = 1
    organization_validation.request = mock_request
    mock_period = MagicMock()
    mock_period.description = "2025"
    mock_report_repo.get_compliance_period.return_value = mock_period
    mock_report_repo.get_compliance_report_by_period.return_value = False

    disabled_config = MagicMock()
    disabled_config.compliance_reporting_enabled = False
    disabled_config.early_issuance_enabled = False
    organization_validation.report_opening_repo.ensure_year.return_value = disabled_config

    with pytest.raises(HTTPException) as exc:
        await organization_validation.create_compliance_report(
            1,
            ComplianceReportCreateSchema(
                compliance_period="2025", organization_id=1, status="Draft"
            ),
        )

    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_create_compliance_report_requires_early_issuance_current_year(
    organization_validation, mock_report_repo
):
    mock_request = MagicMock()
    mock_request.user.organization.organization_id = 1
    organization_validation.request = mock_request

    current_year = datetime.now().year
    mock_period = MagicMock()
    mock_period.description = str(current_year)
    mock_report_repo.get_compliance_period.return_value = mock_period
    mock_report_repo.get_compliance_report_by_period.return_value = False

    disabled_config = MagicMock()
    disabled_config.compliance_reporting_enabled = False
    disabled_config.early_issuance_enabled = True
    organization_validation.report_opening_repo.ensure_year.return_value = disabled_config
    organization_validation.org_repo.get_early_issuance_by_year = AsyncMock(
        return_value=None
    )

    with pytest.raises(HTTPException) as exc:
        await organization_validation.create_compliance_report(
            1,
            ComplianceReportCreateSchema(
                compliance_period=str(current_year), organization_id=1, status="Draft"
            ),
        )

    assert exc.value.status_code == 403
    organization_validation.org_repo.get_early_issuance_by_year.assert_awaited_once_with(
        1, str(current_year)
    )


@pytest.mark.anyio
async def test_create_compliance_report_current_year_with_early_issuance_allowed(
    organization_validation, mock_report_repo
):
    mock_request = MagicMock()
    mock_request.user.organization.organization_id = 1
    organization_validation.request = mock_request

    current_year = datetime.now().year
    mock_period = MagicMock()
    mock_period.description = str(current_year)
    mock_report_repo.get_compliance_period.return_value = mock_period
    mock_report_repo.get_compliance_report_by_period.return_value = False

    disabled_config = MagicMock()
    disabled_config.compliance_reporting_enabled = False
    disabled_config.early_issuance_enabled = True
    organization_validation.report_opening_repo.ensure_year.return_value = disabled_config
    organization_validation.org_repo.get_early_issuance_by_year = AsyncMock(
        return_value=SimpleNamespace(has_early_issuance=True)
    )

    await organization_validation.create_compliance_report(
        1,
        ComplianceReportCreateSchema(
            compliance_period=str(current_year), organization_id=1, status="Draft"
        ),
    )

    organization_validation.org_repo.get_early_issuance_by_year.assert_awaited_once_with(
        1, str(current_year)
    )
