import pytest
from unittest.mock import MagicMock, AsyncMock

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
    organization_validation, mock_report_repo, set_mock_user, fastapi_app
):
    # Mock user setup
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])

    # Mock the request object and its attributes
    mock_request = MagicMock()
    mock_request.user.organization.organization_id = 1
    organization_validation.request = mock_request

    # Mock the compliance period with proper attributes
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
