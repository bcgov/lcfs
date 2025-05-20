from unittest import mock
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from lcfs.db.models import UserProfile
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.db.models.transaction.Transaction import TransactionActionEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.compliance_report.conftest import mock_summary_repo
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportUpdateSchema,
    ComplianceReportSummaryRowSchema,
    ComplianceReportSummarySchema,
)
from lcfs.web.api.compliance_report.update_service import ComplianceReportUpdateService
from lcfs.web.api.notification.services import NotificationService
from lcfs.web.exception.exceptions import DataNotFoundException, ServiceException


# Mock for user_has_roles function
@pytest.fixture
def mock_user_has_roles():
    with patch("lcfs.web.api.compliance_report.update_service.user_has_roles") as mock:
        yield mock


@pytest.fixture
def mock_notification_service():
    mock_service = AsyncMock(spec=NotificationService)
    with patch(
        "lcfs.web.api.compliance_report.update_service.Depends",
        return_value=mock_service,
    ):
        yield mock_service


@pytest.fixture
def mock_environment_vars():
    with patch("lcfs.web.api.email.services.settings") as mock_settings:
        mock_settings.ches_auth_url = "http://mock_auth_url"
        mock_settings.ches_email_url = "http://mock_email_url"
        mock_settings.ches_client_id = "mock_client_id"
        mock_settings.ches_client_secret = "mock_client_secret"
        mock_settings.ches_sender_email = "noreply@gov.bc.ca"
        mock_settings.ches_sender_name = "Mock Notification System"
        yield mock_settings


# update_compliance_report
@pytest.mark.anyio
async def test_update_compliance_report_status_change(
    compliance_report_update_service, mock_repo, mock_notification_service
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.current_status = MagicMock(spec=ComplianceReportStatus)
    mock_report.current_status.status = ComplianceReportStatusEnum.Draft
    mock_report.compliance_period = MagicMock()
    mock_report.compliance_period.description = "2024"
    mock_report.transaction_id = 123

    new_status = MagicMock(spec=ComplianceReportStatus)
    new_status.status = ComplianceReportStatusEnum.Submitted

    report_data = ComplianceReportUpdateSchema(
        status="Submitted", supplemental_note="Test note"
    )

    # Set up mocks
    mock_repo.get_compliance_report_by_id.return_value = mock_report
    mock_repo.get_compliance_report_status_by_desc.return_value = new_status
    compliance_report_update_service.handle_status_change = AsyncMock()
    mock_repo.update_compliance_report.return_value = mock_report
    compliance_report_update_service._perform_notification_call = AsyncMock()

    # Call the method (updated to pass a user profile; in this test we use mock.ANY)
    updated_report = await compliance_report_update_service.update_compliance_report(
        report_id, report_data, mock.ANY
    )

    # Assertions
    assert updated_report == mock_report
    mock_repo.get_compliance_report_by_id.assert_called_once_with(report_id)
    mock_repo.get_compliance_report_status_by_desc.assert_called_once_with(
        report_data.status
    )
    compliance_report_update_service.handle_status_change.assert_called_once_with(
        mock_report, new_status.status, mock.ANY
    )
    mock_repo.add_compliance_report_history.assert_called_once_with(
        mock_report, UserProfile()
    )
    mock_repo.update_compliance_report.assert_called_once_with(mock_report)
    compliance_report_update_service._perform_notification_call.assert_called_once_with(
        mock_report, "Submitted", UserProfile()
    )


@pytest.mark.anyio
async def test_update_compliance_report_no_status_change(
    compliance_report_update_service, mock_repo
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.current_status = MagicMock(spec=ComplianceReportStatus)
    mock_report.current_status.status = ComplianceReportStatusEnum.Draft
    mock_report.compliance_period = MagicMock()
    mock_report.compliance_period.description = "2024"
    mock_report.transaction_id = 123

    # Status does not change
    report_data = ComplianceReportUpdateSchema(
        status="Draft", supplemental_note="Test note"
    )

    # Set up mocks
    mock_repo.get_compliance_report_by_id.return_value = mock_report
    mock_repo.get_compliance_report_status_by_desc.return_value = (
        mock_report.current_status
    )
    mock_repo.update_compliance_report.return_value = mock_report
    compliance_report_update_service._perform_notification_call = AsyncMock()

    # Call the method (now passing a UserProfile)
    updated_report = await compliance_report_update_service.update_compliance_report(
        report_id, report_data, UserProfile()
    )

    # Assertions
    assert updated_report == mock_report
    compliance_report_update_service._perform_notification_call.assert_called_once_with(
        mock_report, "Draft", mock.ANY
    )
    mock_repo.update_compliance_report.assert_called_once_with(mock_report)


@pytest.mark.anyio
async def test_update_compliance_report_not_found(
    compliance_report_update_service, mock_repo
):
    # Mock data
    report_id = 1
    report_data = ComplianceReportUpdateSchema(
        status="Submitted", supplemental_note="Test note"
    )

    # Set up mocks
    mock_repo.get_compliance_report_by_id.return_value = None

    # Call the method and check for exception (UserProfile now passed)
    with pytest.raises(DataNotFoundException):
        await compliance_report_update_service.update_compliance_report(
            report_id, report_data, UserProfile()
        )

    mock_repo.get_compliance_report_by_id.assert_called_once_with(report_id)


@pytest.mark.anyio
async def test_handle_submitted_status_insufficient_permissions(
    compliance_report_update_service, mock_user_has_roles
):
    # Mock data
    mock_report = MagicMock(spec=ComplianceReport)

    # Mock user roles (user doesn't have required roles)
    mock_user_has_roles.return_value = False
    compliance_report_update_service.request = MagicMock()
    compliance_report_update_service.request.user = MagicMock()

    # Call the method and check for exception
    with pytest.raises(HTTPException) as exc_info:
        await compliance_report_update_service.handle_submitted_status(
            mock_report, UserProfile()
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Forbidden."


# SUBMIT STATUS TESTS


@pytest.mark.anyio
async def test_handle_submitted_status_with_existing_summary(
    compliance_report_update_service,
    mock_repo,
    mock_summary_repo,
    mock_user_has_roles,
    mock_org_service,
    mock_summary_service,
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.organization_id = 123  # Mock organization ID
    mock_report.summary = MagicMock(spec=ComplianceReportSummary)
    mock_report.summary.line_20_surplus_deficit_units = 100  # Mock compliance units

    # Mock existing summary with user-edited values
    existing_summary = MagicMock(spec=ComplianceReportSummary)
    existing_summary.line_6_renewable_fuel_retained_gasoline = 1000
    existing_summary.line_7_previously_retained_diesel = 2000
    existing_summary.line_8_obligation_deferred_jet_fuel = 3000

    # Mock user roles (user has required roles)
    mock_user_has_roles.return_value = True
    compliance_report_update_service.request = MagicMock()
    compliance_report_update_service.request.user = MagicMock()

    # Mock calculated summary
    calculated_summary = ComplianceReportSummarySchema(
        summary_id=100,
        compliance_report_id=report_id,
        renewable_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line=6,
                field="renewable_fuel_retained",
                gasoline=0,
                diesel=0,
                jet_fuel=0,
            ),
            ComplianceReportSummaryRowSchema(
                line=7, field="previously_retained", gasoline=0, diesel=0, jet_fuel=0
            ),
            ComplianceReportSummaryRowSchema(
                line=8, field="obligation_deferred", gasoline=0, diesel=0, jet_fuel=0
            ),
        ],
        low_carbon_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line=12, field="low_carbon_fuel_required", value=0
            ),
        ],
        non_compliance_penalty_summary=[
            ComplianceReportSummaryRowSchema(
                line=21, field="non_compliance_penalty_payable", value=0
            ),
        ],
        can_sign=True,
    )

    # Set up mocks
    mock_summary_repo.get_summary_by_report_id.return_value = existing_summary
    mock_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )

    # Inject the mocked org_service into the service being tested
    compliance_report_update_service.org_service = mock_org_service

    # Mock the adjust_balance method to return a mocked transaction result
    mock_org_service.adjust_balance.return_value = MagicMock()

    # Call the method
    await compliance_report_update_service.handle_submitted_status(
        mock_report, UserProfile()
    )

    # Assertions
    mock_user_has_roles.assert_called_once_with(
        mock.ANY,
        [RoleEnum.SUPPLIER, RoleEnum.SIGNING_AUTHORITY],
    )
    mock_summary_repo.get_summary_by_report_id.assert_called_once_with(report_id)
    mock_summary_service.calculate_compliance_report_summary.assert_called_once_with(
        report_id
    )

    # Check if the summary is locked by verifying that the save call includes a UserProfile
    saved_summary = mock_summary_repo.save_compliance_report_summary.call_args[0][0]
    assert saved_summary.is_locked == True


@pytest.mark.anyio
async def test_handle_submitted_status_without_existing_summary(
    compliance_report_update_service,
    mock_repo,
    mock_summary_repo,
    mock_user_has_roles,
    mock_org_service,
    mock_summary_service,
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.summary = None
    # Mock user roles (user has required roles)
    mock_user_has_roles.return_value = True
    compliance_report_update_service.request = MagicMock()
    compliance_report_update_service.request.user = MagicMock()
    # Mock calculated summary
    calculated_summary = ComplianceReportSummarySchema(
        compliance_report_id=report_id,
        renewable_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line=6,
                field="renewable_fuel_retained",
                gasoline=100,
                diesel=200,
                jet_fuel=300,
            ),
            ComplianceReportSummaryRowSchema(
                line=7,
                field="previously_retained",
                gasoline=400,
                diesel=500,
                jet_fuel=600,
            ),
            ComplianceReportSummaryRowSchema(
                line=8,
                field="obligation_deferred",
                gasoline=700,
                diesel=800,
                jet_fuel=900,
            ),
        ],
        low_carbon_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line=12, field="low_carbon_fuel_required", value=0
            ),
        ],
        non_compliance_penalty_summary=[
            ComplianceReportSummaryRowSchema(
                line=21, field="non_compliance_penalty_payable", value=0
            ),
        ],
        can_sign=True,
    )

    # Set up mocks
    mock_summary_repo.get_summary_by_report_id.return_value = None
    mock_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )
    # Inject the mocked org_service into the service being tested
    compliance_report_update_service.org_service = mock_org_service

    # Mock the adjust_balance method to return a mocked transaction result
    mock_org_service.adjust_balance.return_value = MagicMock()
    # Call the method
    await compliance_report_update_service.handle_submitted_status(
        mock_report, UserProfile()
    )

    # Assertions
    mock_summary_repo.get_summary_by_report_id.assert_called_once_with(report_id)
    mock_summary_service.calculate_compliance_report_summary.assert_called_once_with(
        report_id
    )

    # Check if a new summary is created
    mock_summary_repo.add_compliance_report_summary.assert_called_once_with(mock.ANY)
    new_summary = mock_summary_repo.add_compliance_report_summary.call_args[0][0]

    # Check if calculated values are used
    assert new_summary.renewable_fuel_target_summary[0].gasoline == 100  # line 6
    assert new_summary.renewable_fuel_target_summary[1].diesel == 500  # line 7
    assert new_summary.renewable_fuel_target_summary[2].jet_fuel == 900  # line 8

    # Check if summary is locked
    assert new_summary.is_locked == True

    # Check if report is updated with new summary
    mock_repo.update_compliance_report.assert_called_once_with(mock_report)


@pytest.mark.anyio
async def test_handle_submitted_status_partial_existing_values(
    compliance_report_update_service,
    mock_repo,
    mock_summary_repo,
    mock_user_has_roles,
    mock_org_service,
    mock_summary_service,
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.summary = MagicMock(spec=ComplianceReportSummary)
    mock_report.summary.summary_id = 100
    # Mock user roles (user has required roles)
    mock_user_has_roles.return_value = True
    compliance_report_update_service.request = MagicMock()
    compliance_report_update_service.request.user = MagicMock()
    # Mock existing summary with some user-edited values
    existing_summary = MagicMock(spec=ComplianceReportSummary)
    existing_summary.line_6_renewable_fuel_retained_gasoline = 1000
    existing_summary.line_7_previously_retained_diesel = None  # Not edited by user
    existing_summary.line_8_obligation_deferred_jet_fuel = 3000

    # Mock calculated summary
    calculated_summary = ComplianceReportSummarySchema(
        summary_id=100,
        compliance_report_id=report_id,
        renewable_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line=6,
                field="renewable_fuel_retained",
                gasoline=0,
                diesel=0,
                jet_fuel=0,
            ),
            ComplianceReportSummaryRowSchema(
                line=7,
                field="previously_retained",
                gasoline=0,
                diesel=2000,
                jet_fuel=0,
            ),
            ComplianceReportSummaryRowSchema(
                line=8, field="obligation_deferred", gasoline=0, diesel=0, jet_fuel=0
            ),
        ],
        low_carbon_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line=12, field="low_carbon_fuel_required", value=0
            ),
        ],
        non_compliance_penalty_summary=[
            ComplianceReportSummaryRowSchema(
                line=21, field="non_compliance_penalty_payable", value=0
            ),
        ],
        can_sign=True,
    )

    # Set up mocks
    mock_summary_repo.get_summary_by_report_id.return_value = existing_summary
    mock_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )
    # Inject the mocked org_service into the service being tested
    compliance_report_update_service.org_service = mock_org_service

    # Mock the adjust_balance method to return a mocked transaction result
    mock_org_service.adjust_balance.return_value = MagicMock()
    # Call the method
    await compliance_report_update_service.handle_submitted_status(
        mock_report, UserProfile()
    )

    # Assertions
    mock_summary_repo.save_compliance_report_summary.assert_called_once_with(mock.ANY)
    saved_summary = mock_summary_repo.save_compliance_report_summary.call_args[0][0]
    assert (
        saved_summary.renewable_fuel_target_summary[0].gasoline == 1000
    )  # Preserved user-edited value
    assert (
        saved_summary.renewable_fuel_target_summary[1].diesel == 2000
    )  # Used calculated value
    assert (
        saved_summary.renewable_fuel_target_summary[2].jet_fuel == 3000
    )  # Preserved user-edited value


@pytest.mark.anyio
async def test_handle_submitted_status_no_user_edits(
    compliance_report_update_service,
    mock_repo,
    mock_summary_repo,
    mock_user_has_roles,
    mock_org_service,
    mock_summary_service,
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.summary = MagicMock(spec=ComplianceReportSummary)
    mock_report.summary.summary_id = 100
    # Mock user roles (user has required roles)
    mock_user_has_roles.return_value = True
    compliance_report_update_service.request = MagicMock()
    compliance_report_update_service.request.user = MagicMock()
    # Mock existing summary with no user-edited values
    existing_summary = MagicMock(spec=ComplianceReportSummary)
    existing_summary.line_6_renewable_fuel_retained_gasoline = None
    existing_summary.line_7_previously_retained_diesel = None
    existing_summary.line_8_obligation_deferred_jet_fuel = None

    # Mock calculated summary
    calculated_summary = ComplianceReportSummarySchema(
        summary_id=100,
        compliance_report_id=report_id,
        renewable_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line=6,
                field="renewable_fuel_retained",
                gasoline=100,
                diesel=200,
                jet_fuel=300,
            ),
            ComplianceReportSummaryRowSchema(
                line=7,
                field="previously_retained",
                gasoline=400,
                diesel=500,
                jet_fuel=600,
            ),
            ComplianceReportSummaryRowSchema(
                line=8,
                field="obligation_deferred",
                gasoline=700,
                diesel=800,
                jet_fuel=900,
            ),
        ],
        low_carbon_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line=12, field="low_carbon_fuel_required", value=0
            ),
        ],
        non_compliance_penalty_summary=[
            ComplianceReportSummaryRowSchema(
                line=21, field="non_compliance_penalty_payable", value=0
            ),
        ],
        can_sign=True,
    )

    # Set up mocks
    mock_summary_repo.get_summary_by_report_id.return_value = existing_summary
    mock_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )
    # Inject the mocked org_service into the service being tested
    compliance_report_update_service.org_service = mock_org_service

    # Mock the adjust_balance method to return a mocked transaction result
    mock_org_service.adjust_balance.return_value = MagicMock()
    # Call the method
    await compliance_report_update_service.handle_submitted_status(
        mock_report, UserProfile()
    )

    # Assertions
    mock_summary_repo.save_compliance_report_summary.assert_called_once_with(mock.ANY)
    saved_summary = mock_summary_repo.save_compliance_report_summary.call_args[0][0]
    assert (
        saved_summary.renewable_fuel_target_summary[0].gasoline == 100
    )  # Used calculated value
    assert (
        saved_summary.renewable_fuel_target_summary[1].diesel == 500
    )  # Used calculated value
    assert (
        saved_summary.renewable_fuel_target_summary[2].jet_fuel == 900
    )  # Used calculated value


@pytest.mark.anyio
async def test_handle_submitted_no_sign(
    compliance_report_update_service,
    mock_repo,
    mock_summary_repo,
    mock_user_has_roles,
    mock_org_service,
    mock_summary_service,
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.summary = MagicMock(spec=ComplianceReportSummary)
    mock_report.summary.summary_id = 100
    # Mock user roles (user has required roles)
    mock_user_has_roles.return_value = True
    compliance_report_update_service.request = MagicMock()
    compliance_report_update_service.request.user = MagicMock()
    # Mock existing summary with no user-edited values
    existing_summary = MagicMock(spec=ComplianceReportSummary)

    # Mock calculated summary
    calculated_summary = ComplianceReportSummarySchema(
        summary_id=100,
        compliance_report_id=report_id,
        renewable_fuel_target_summary=[],
        low_carbon_fuel_target_summary=[],
        non_compliance_penalty_summary=[],
        can_sign=False,
    )

    # Set up mocks
    mock_summary_repo.get_summary_by_report_id.return_value = existing_summary
    mock_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )
    # Inject the mocked org_service into the service being tested
    compliance_report_update_service.org_service = mock_org_service

    with pytest.raises(ServiceException):
        await compliance_report_update_service.handle_submitted_status(
            mock_report, UserProfile()
        )


@pytest.mark.anyio
async def test_handle_submitted_status_no_credits(
    compliance_report_update_service,
    mock_repo,
    mock_user_has_roles,
    mock_org_service,
    mock_summary_service,
    mock_summary_repo,
):
    """
    Scenario: The report requires deficit units to be reserved (-100),
    but available_balance is 0, so no transaction is created.
    """
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.organization_id = 123
    # Deficit units is nonzero
    mock_report.summary = MagicMock(
        spec=ComplianceReportSummary, line_20_surplus_deficit_units=-100
    )
    # No existing transaction
    mock_report.transaction = None

    # Required roles are present
    mock_user_has_roles.return_value = True
    compliance_report_update_service.request = MagicMock()
    compliance_report_update_service.request.user = MagicMock()

    # Mock the summary so we skip deeper logic
    mock_summary_repo.get_summary_by_report_id.return_value = None

    # Pretend the final summary can_sign is True
    calculated_summary = ComplianceReportSummarySchema(
        can_sign=True,
        compliance_report_id=report_id,
        renewable_fuel_target_summary=[],
        low_carbon_fuel_target_summary=[],
        non_compliance_penalty_summary=[],
    )
    mock_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )

    # available_balance = 0
    mock_org_service.calculate_available_balance.return_value = 0
    # If adjust_balance is called, we'll see an assertion fail
    mock_org_service.adjust_balance = AsyncMock()

    # Execute
    await compliance_report_update_service.handle_submitted_status(
        mock_report, UserProfile()
    )

    # Assertions:
    # 1) We did NOT call adjust_balance, because balance = 0
    mock_org_service.adjust_balance.assert_not_awaited()
    # 2) No transaction is created
    assert mock_report.transaction is None


@pytest.mark.anyio
async def test_handle_submitted_status_insufficient_credits(
    compliance_report_update_service,
    mock_repo,
    mock_summary_repo,
    mock_user_has_roles,
    mock_org_service,
    mock_summary_service,
):
    """
    Scenario: The report requires deficit units of 100,
    but the org only has 50 credits available. We reserve partial (-50)
    to match the actual available balance.
    """
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.organization_id = 123
    # Need 100 credits, but only 50 are available
    mock_report.summary = MagicMock(spec=ComplianceReportSummary)
    mock_report.summary.line_20_surplus_deficit_units = -100
    mock_report.transaction = None

    mock_user_has_roles.return_value = True
    compliance_report_update_service.request = MagicMock()
    compliance_report_update_service.request.user = MagicMock()

    # Skip deeper summary logic
    mock_summary_repo.get_summary_by_report_id.return_value = None
    mock_summary_repo.save_compliance_report_summary = AsyncMock(
        return_value=mock_report.summary
    )
    mock_summary_repo.add_compliance_report_summary = AsyncMock(
        return_value=mock_report.summary
    )
    calculated_summary = ComplianceReportSummarySchema(
        can_sign=True,
        compliance_report_id=report_id,
        renewable_fuel_target_summary=[],
        low_carbon_fuel_target_summary=[],
        non_compliance_penalty_summary=[],
    )
    mock_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )

    # Org only has 50
    mock_org_service.calculate_available_balance = AsyncMock(return_value=50)
    # Mock the result of adjust_balance
    mock_transaction = MagicMock()
    mock_org_service.adjust_balance.return_value = mock_transaction

    # Execute
    await compliance_report_update_service.handle_submitted_status(
        mock_report, UserProfile()
    )

    # We should have called adjust_balance with -50 units (reserving partial)
    mock_org_service.adjust_balance.assert_awaited_once_with(
        transaction_action=TransactionActionEnum.Reserved,
        compliance_units=-50,
        organization_id=123,
    )
    # And a transaction object is assigned back to the report
    assert mock_report.transaction == mock_transaction


@pytest.mark.anyio
async def test_handle_submitted_status_sufficient_credits(
    compliance_report_update_service,
    mock_repo,
    mock_summary_repo,
    mock_user_has_roles,
    mock_org_service,
    mock_summary_service,
):
    """
    Scenario: The report requires deficit units of -100,
    and the org has 200 credits available. We reserve all -100.
    """
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.organization_id = 123
    # Need 100 credits
    mock_report.summary = MagicMock(spec=ComplianceReportSummary)
    mock_report.summary.line_20_surplus_deficit_units = -100
    mock_report.transaction = None

    mock_user_has_roles.return_value = True
    compliance_report_update_service.request = MagicMock()
    compliance_report_update_service.request.user = MagicMock()

    # Skip deeper summary logic
    mock_summary_repo.get_summary_by_report_id.return_value = None
    mock_summary_repo.save_compliance_report_summary = AsyncMock(
        return_value=mock_report.summary
    )
    mock_summary_repo.add_compliance_report_summary = AsyncMock(
        return_value=mock_report.summary
    )
    calculated_summary = ComplianceReportSummarySchema(
        can_sign=True,
        compliance_report_id=report_id,
        renewable_fuel_target_summary=[],
        low_carbon_fuel_target_summary=[],
        non_compliance_penalty_summary=[],
    )
    mock_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )

    # Org has enough
    mock_org_service.calculate_available_balance.return_value = 200
    mock_transaction = MagicMock()
    mock_org_service.adjust_balance.return_value = mock_transaction

    # Execute
    await compliance_report_update_service.handle_submitted_status(
        mock_report, UserProfile()
    )

    # We should have called adjust_balance with the full -100
    mock_org_service.adjust_balance.assert_awaited_once_with(
        transaction_action=TransactionActionEnum.Reserved,
        compliance_units=-100,
        organization_id=123,
    )
    assert mock_report.transaction == mock_transaction


# Fixture to create a real instance of OrganizationsService with its actual adjust_balance logic.
@pytest.fixture
def org_service_instance():
    # Import the real OrganizationsService (adjust the import path as needed)
    from lcfs.web.api.organizations.services import OrganizationsService

    service = OrganizationsService()
    service.calculate_available_balance = AsyncMock(return_value=50)
    service.calculate_reserved_balance = AsyncMock(return_value=20)
    dummy_transaction = MagicMock()  # a dummy Transaction instance
    service.transaction_repo = MagicMock()
    service.transaction_repo.create_transaction = AsyncMock(
        return_value=dummy_transaction
    )
    service.redis_balance_service = MagicMock()
    service.redis_balance_service.populate_organization_redis_balance = AsyncMock()
    return service


@pytest.mark.anyio
async def test_adjust_balance_reserved_positive_allowed(org_service_instance):
    """
    Reserved transactions with a positive compliance_units should be allowed without checking available balance.
    Even if the positive value exceeds the available balance, the transaction should proceed.
    """
    compliance_units = 100  # positive value; exceeds available_balance (50)
    transaction = await org_service_instance.adjust_balance(
        transaction_action=TransactionActionEnum.Reserved,
        compliance_units=compliance_units,
        organization_id=1,
    )
    # Verify that the transaction repo's create_transaction method was called with the correct parameters.
    org_service_instance.transaction_repo.create_transaction.assert_called_once_with(
        TransactionActionEnum.Reserved, compliance_units, 1
    )
    assert transaction is not None


@pytest.mark.anyio
async def test_adjust_balance_reserved_negative_exceeds_balance(org_service_instance):
    """
    Reserved transactions with negative compliance_units must not exceed available balance.
    A negative value whose absolute exceeds the available balance should raise a ValueError.
    """
    compliance_units = -60  # negative value; abs(60) > available_balance (50)
    with pytest.raises(
        ValueError, match="Reserve amount cannot exceed available balance."
    ):
        await org_service_instance.adjust_balance(
            transaction_action=TransactionActionEnum.Reserved,
            compliance_units=compliance_units,
            organization_id=1,
        )


@pytest.mark.anyio
async def test_handle_recommended_by_analyst_status_not_superseded(
    compliance_report_update_service: ComplianceReportUpdateService,
    mock_repo: AsyncMock,
    mock_user_profile_analyst: MagicMock,
    mock_compliance_report_recommended_analyst: MagicMock,
):
    # Arrange
    mock_repo.get_draft_report_by_group_uuid = AsyncMock(return_value=None)
    # Patch user_has_roles directly for this test
    with patch(
        "lcfs.web.api.compliance_report.update_service.user_has_roles",
        return_value=True,
    ):
        # Act
        await compliance_report_update_service.handle_recommended_by_analyst_status(
            mock_compliance_report_recommended_analyst, mock_user_profile_analyst
        )

        # Assert
        mock_repo.get_draft_report_by_group_uuid.assert_called_once_with(
            mock_compliance_report_recommended_analyst.compliance_report_group_uuid
        )


@pytest.mark.anyio
async def test_handle_recommended_by_analyst_status_superseded(
    compliance_report_update_service: ComplianceReportUpdateService,
    mock_repo: AsyncMock,
    mock_user_profile_analyst: MagicMock,
    mock_compliance_report_recommended_analyst: MagicMock,
    mock_compliance_report_draft: MagicMock,  # Newer draft
):
    """Test handle_recommended_by_analyst_status raises 409 if superseded."""
    # Arrange
    mock_compliance_report_draft.version = (
        mock_compliance_report_recommended_analyst.version + 1
    )  # Ensure draft is newer
    mock_repo.get_draft_report_by_group_uuid = AsyncMock(
        return_value=mock_compliance_report_draft
    )

    # Act & Assert
    with pytest.raises(HTTPException) as excinfo:
        await compliance_report_update_service.handle_recommended_by_analyst_status(
            mock_compliance_report_recommended_analyst, mock_user_profile_analyst
        )
    assert excinfo.value.status_code == 409
    assert "superseded by a draft" in excinfo.value.detail.lower()
    mock_repo.get_draft_report_by_group_uuid.assert_called_once()


@pytest.mark.anyio
async def test_handle_recommended_by_manager_status_not_superseded(
    compliance_report_update_service: ComplianceReportUpdateService,
    mock_repo: AsyncMock,
    mock_user_profile_manager: MagicMock,
    mock_compliance_report_recommended_manager: MagicMock,
):
    mock_repo.get_draft_report_by_group_uuid = AsyncMock(return_value=None)
    # Arrange user roles check to pass
    with patch(
        "lcfs.web.api.compliance_report.update_service.user_has_roles",
        return_value=True,
    ):
        # Act
        await compliance_report_update_service.handle_recommended_by_manager_status(
            mock_compliance_report_recommended_manager, mock_user_profile_manager
        )
    # Assert (after Act)
    mock_repo.get_draft_report_by_group_uuid.assert_called_once_with(
        mock_compliance_report_recommended_manager.compliance_report_group_uuid
    )


@pytest.mark.anyio
async def test_handle_recommended_by_manager_status_superseded(
    compliance_report_update_service: ComplianceReportUpdateService,
    mock_repo: AsyncMock,
    mock_user_profile_manager: MagicMock,
    mock_compliance_report_recommended_manager: MagicMock,
    mock_compliance_report_draft: MagicMock,  # Newer draft
):
    """Test handle_recommended_by_manager_status raises 409 if superseded."""
    # Arrange
    mock_compliance_report_draft.version = (
        mock_compliance_report_recommended_manager.version + 1
    )  # Ensure draft is newer
    mock_repo.get_draft_report_by_group_uuid = AsyncMock(
        return_value=mock_compliance_report_draft
    )

    # Act & Assert
    with pytest.raises(HTTPException) as excinfo:
        await compliance_report_update_service.handle_recommended_by_manager_status(
            mock_compliance_report_recommended_manager, mock_user_profile_manager
        )
    assert excinfo.value.status_code == 409
    assert "superseded by a draft" in excinfo.value.detail.lower()
    mock_repo.get_draft_report_by_group_uuid.assert_called_once()


@pytest.mark.anyio
async def test_handle_assessed_status_not_superseded(
    compliance_report_update_service: ComplianceReportUpdateService,
    mock_repo: AsyncMock,
    mock_user_profile_director: MagicMock,
    mock_compliance_report_assessed: MagicMock,
):
    # Arrange
    # Create a mock SQLAlchemy model object, not schema
    mock_report_model = MagicMock(spec=ComplianceReport)
    mock_report_model.compliance_report_id = (
        mock_compliance_report_assessed.compliance_report_id
    )
    mock_report_model.compliance_report_group_uuid = (
        mock_compliance_report_assessed.compliance_report_group_uuid
    )
    mock_report_model.version = mock_compliance_report_assessed.version
    # Set a mock transaction object on the model
    mock_report_model.transaction = MagicMock()

    mock_repo.get_draft_report_by_group_uuid = AsyncMock(return_value=None)
    compliance_report_update_service._calculate_and_lock_summary = AsyncMock(return_value=MagicMock(line_20_surplus_deficit_units=100))

    # Patch roles check to ensure it passes
    with patch(
        "lcfs.web.api.compliance_report.update_service.user_has_roles",
        return_value=True,
    ):
        # Act
        await compliance_report_update_service.handle_assessed_status(
            mock_report_model, mock_user_profile_director
        )

    # Assert
    mock_repo.get_draft_report_by_group_uuid.assert_called_once_with(
        mock_report_model.compliance_report_group_uuid
    )
    # Assert that the transaction attribute was accessed and modified
    assert (
        mock_report_model.transaction.transaction_action
        == TransactionActionEnum.Adjustment
    )
    assert (
        mock_report_model.transaction.update_user
        == mock_user_profile_director.keycloak_username
    )
    # Verify compliance units were set to the calculated value
    assert mock_report_model.transaction.compliance_units == 100
    mock_repo.update_compliance_report.assert_called_once_with(mock_report_model)


@pytest.mark.anyio
async def test_handle_assessed_status_government_adjustment_no_transaction(
    compliance_report_update_service: ComplianceReportUpdateService,
    mock_repo: AsyncMock,
    mock_user_profile_director: MagicMock,
    mock_summary_repo: AsyncMock,
    mock_summary_service: AsyncMock,
    mock_org_service: AsyncMock,
):
    """
    Test that a transaction is created when assessing a government adjustment report
    that doesn't already have a transaction.
    This verifies the fix for the bug where government adjustment reports weren't 
    creating transactions when assessed.
    """
    # Arrange
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = 123
    mock_report.compliance_report_group_uuid = "test-uuid"
    mock_report.organization_id = 456
    mock_report.version = 1
    mock_report.transaction = None  # No existing transaction - the key bug case
    
    # Set up supplemental initiator to indicate it's a government adjustment
    from lcfs.db.models.compliance.ComplianceReport import SupplementalInitiatorType
    mock_report.supplemental_initiator = SupplementalInitiatorType.GOVERNMENT_REASSESSMENT
    
    # Mock the summary that will be calculated during assessment
    mock_summary = MagicMock()
    mock_summary.line_20_surplus_deficit_units = 500  # Credit change amount
    
    mock_repo.get_draft_report_by_group_uuid = AsyncMock(return_value=None)
    compliance_report_update_service._calculate_and_lock_summary = AsyncMock(return_value=mock_summary)
    
    # Mock the new transaction that will be created
    mock_transaction = MagicMock()
    compliance_report_update_service._create_or_update_reserve_transaction = AsyncMock()
    
    # This is needed to simulate the transaction being created
    def side_effect_create_transaction(credit_change, report):
        report.transaction = mock_transaction
        return mock_transaction
    
    compliance_report_update_service._create_or_update_reserve_transaction.side_effect = side_effect_create_transaction
    
    # Patch roles check to ensure it passes
    with patch(
        "lcfs.web.api.compliance_report.update_service.user_has_roles",
        return_value=True,
    ):
        # Act
        await compliance_report_update_service.handle_assessed_status(
            mock_report, mock_user_profile_director
        )
    
    # Assert
    # Verify we called necessary preliminary checks
    mock_repo.get_draft_report_by_group_uuid.assert_called_once_with(
        mock_report.compliance_report_group_uuid
    )
    
    # Verify we calculated the summary
    compliance_report_update_service._calculate_and_lock_summary.assert_called_once_with(
        mock_report, mock_user_profile_director
    )
    
    # Verify we attempted to create a transaction with the correct credit change
    compliance_report_update_service._create_or_update_reserve_transaction.assert_called_once_with(
        500, mock_report
    )
    
    # Verify the transaction was marked as an adjustment and attributed to the director
    assert mock_report.transaction.transaction_action == TransactionActionEnum.Adjustment
    assert mock_report.transaction.update_user == mock_user_profile_director.keycloak_username
    
    # Verify the report was updated
    mock_repo.update_compliance_report.assert_called_once_with(mock_report)


@pytest.mark.anyio
async def test_handle_assessed_status_superseded(
    compliance_report_update_service: ComplianceReportUpdateService,
    mock_repo: AsyncMock,
    mock_user_profile_director: MagicMock,
    mock_compliance_report_assessed: MagicMock,
    mock_compliance_report_draft: MagicMock,  # Newer draft
):
    """Test handle_assessed_status raises 409 if superseded."""
    # Arrange
    mock_compliance_report_draft.version = (
        mock_compliance_report_assessed.version + 1
    )  # Ensure draft is newer
    mock_repo.get_draft_report_by_group_uuid = AsyncMock(
        return_value=mock_compliance_report_draft
    )

    # Act & Assert
    with pytest.raises(HTTPException) as excinfo:
        await compliance_report_update_service.handle_assessed_status(
            mock_compliance_report_assessed, mock_user_profile_director
        )
    assert excinfo.value.status_code == 409
    assert "superseded by a draft" in excinfo.value.detail.lower()
    mock_repo.get_draft_report_by_group_uuid.assert_called_once()
