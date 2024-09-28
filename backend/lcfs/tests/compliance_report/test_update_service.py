import pytest
from unittest.mock import AsyncMock, MagicMock
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportUpdateSchema,
    ComplianceReportSummaryRowSchema,
    ComplianceReportSummarySchema,
)
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.web.exception.exceptions import DataNotFoundException


# update_compliance_report
@pytest.mark.anyio
async def test_update_compliance_report_status_change(
    compliance_report_update_service, mock_repo
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.current_status = MagicMock(spec=ComplianceReportStatus)
    mock_report.current_status.status = ComplianceReportStatusEnum.Draft

    new_status = MagicMock(spec=ComplianceReportStatus)
    new_status.status = ComplianceReportStatusEnum.Submitted

    report_data = ComplianceReportUpdateSchema(
        status="Submitted", supplemental_note="Test note"
    )

    # Set up mocks
    mock_repo.get_compliance_report.return_value = mock_report
    mock_repo.get_compliance_report_status_by_desc.return_value = new_status
    compliance_report_update_service.handle_status_change = AsyncMock()
    mock_repo.update_compliance_report.return_value = mock_report

    # Call the method
    updated_report = await compliance_report_update_service.update_compliance_report(
        report_id, report_data
    )

    # Assertions
    assert updated_report == mock_report
    mock_repo.get_compliance_report.assert_called_once_with(report_id)
    mock_repo.get_compliance_report_status_by_desc.assert_called_once_with(
        report_data.status
    )
    compliance_report_update_service.handle_status_change.assert_called_once_with(
        mock_report, new_status.status
    )
    mock_repo.add_compliance_report_history.assert_called_once_with(
        mock_report, compliance_report_update_service.request.user
    )
    mock_repo.update_compliance_report.assert_called_once_with(mock_report)

    assert mock_report.current_status == new_status
    assert mock_report.supplemental_note == report_data.supplemental_note


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

    report_data = ComplianceReportUpdateSchema(
        status="Draft", supplemental_note="Test note"
    )

    # Set up mocks
    mock_repo.get_compliance_report.return_value = mock_report
    mock_repo.get_compliance_report_status_by_desc.return_value = (
        mock_report.current_status
    )
    mock_repo.update_compliance_report.return_value = mock_report

    # Mock the handle_status_change method
    compliance_report_update_service.handle_status_change = AsyncMock()

    # Call the method
    updated_report = await compliance_report_update_service.update_compliance_report(
        report_id, report_data
    )

    # Assertions
    assert updated_report == mock_report
    mock_repo.get_compliance_report.assert_called_once_with(report_id)
    mock_repo.get_compliance_report_status_by_desc.assert_called_once_with(
        report_data.status
    )
    compliance_report_update_service.handle_status_change.assert_not_called()
    mock_repo.add_compliance_report_history.assert_not_called()
    mock_repo.update_compliance_report.assert_called_once_with(mock_report)

    assert mock_report.current_status == mock_report.current_status
    assert mock_report.supplemental_note == report_data.supplemental_note


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
    mock_repo.get_compliance_report.return_value = None

    # Call the method and check for exception
    with pytest.raises(DataNotFoundException):
        await compliance_report_update_service.update_compliance_report(
            report_id, report_data
        )

    mock_repo.get_compliance_report.assert_called_once_with(report_id)


# SUBMIT STATUS TESTS


@pytest.mark.anyio
async def test_handle_submitted_status_with_existing_summary(
    compliance_report_update_service, mock_repo, compliance_report_summary_service
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.summary = MagicMock(spec=ComplianceReportSummary)
    mock_report.summary.summary_id = 100

    # Mock existing summary with user-edited values
    existing_summary = MagicMock(spec=ComplianceReportSummary)
    existing_summary.line_6_renewable_fuel_retained_gasoline = 1000
    existing_summary.line_7_previously_retained_diesel = 2000
    existing_summary.line_8_obligation_deferred_jet_fuel = 3000

    # Mock calculated summary
    calculated_summary = ComplianceReportSummarySchema(
        summary_id=100,
        compliance_report_id=report_id,
        renewable_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line="6",
                field="renewable_fuel_retained",
                gasoline=0,
                diesel=0,
                jet_fuel=0,
            ),
            ComplianceReportSummaryRowSchema(
                line="7", field="previously_retained", gasoline=0, diesel=0, jet_fuel=0
            ),
            ComplianceReportSummaryRowSchema(
                line="8", field="obligation_deferred", gasoline=0, diesel=0, jet_fuel=0
            ),
        ],
        low_carbon_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line="12", field="low_carbon_fuel_required", value=0
            ),
        ],
        non_compliance_penalty_summary=[
            ComplianceReportSummaryRowSchema(
                line="21", field="non_compliance_penalty_payable", value=0
            ),
        ],
    )

    # Set up mocks
    mock_repo.get_summary_by_report_id.return_value = existing_summary
    compliance_report_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )

    # Call the method
    await compliance_report_update_service.handle_submitted_status(mock_report)

    # Assertions
    mock_repo.get_summary_by_report_id.assert_called_once_with(report_id)
    compliance_report_summary_service.calculate_compliance_report_summary.assert_called_once_with(
        report_id
    )

    # Check if user-edited values are preserved
    saved_summary = mock_repo.save_compliance_report_summary.call_args[0][1]
    assert saved_summary.renewable_fuel_target_summary[0].gasoline == 1000  # line 6
    assert saved_summary.renewable_fuel_target_summary[1].diesel == 2000  # line 7
    assert saved_summary.renewable_fuel_target_summary[2].jet_fuel == 3000  # line 8

    # Check if summary is locked
    assert saved_summary.is_locked == True


@pytest.mark.anyio
async def test_handle_submitted_status_without_existing_summary(
    compliance_report_update_service, mock_repo, compliance_report_summary_service
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.summary = None

    # Mock calculated summary
    calculated_summary = ComplianceReportSummarySchema(
        compliance_report_id=report_id,
        renewable_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line="6",
                field="renewable_fuel_retained",
                gasoline=100,
                diesel=200,
                jet_fuel=300,
            ),
            ComplianceReportSummaryRowSchema(
                line="7",
                field="previously_retained",
                gasoline=400,
                diesel=500,
                jet_fuel=600,
            ),
            ComplianceReportSummaryRowSchema(
                line="8",
                field="obligation_deferred",
                gasoline=700,
                diesel=800,
                jet_fuel=900,
            ),
        ],
        low_carbon_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line="12", field="low_carbon_fuel_required", value=0
            ),
        ],
        non_compliance_penalty_summary=[
            ComplianceReportSummaryRowSchema(
                line="21", field="non_compliance_penalty_payable", value=0
            ),
        ],
    )

    # Set up mocks
    mock_repo.get_summary_by_report_id.return_value = None
    compliance_report_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )

    # Call the method
    await compliance_report_update_service.handle_submitted_status(mock_report)

    # Assertions
    mock_repo.get_summary_by_report_id.assert_called_once_with(report_id)
    compliance_report_summary_service.calculate_compliance_report_summary.assert_called_once_with(
        report_id
    )

    # Check if a new summary is created
    mock_repo.add_compliance_report_summary.assert_called_once()
    new_summary = mock_repo.add_compliance_report_summary.call_args[0][0]

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
    compliance_report_update_service, mock_repo, compliance_report_summary_service
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.summary = MagicMock(spec=ComplianceReportSummary)
    mock_report.summary.summary_id = 100

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
                line="6",
                field="renewable_fuel_retained",
                gasoline=0,
                diesel=0,
                jet_fuel=0,
            ),
            ComplianceReportSummaryRowSchema(
                line="7",
                field="previously_retained",
                gasoline=0,
                diesel=2000,
                jet_fuel=0,
            ),
            ComplianceReportSummaryRowSchema(
                line="8", field="obligation_deferred", gasoline=0, diesel=0, jet_fuel=0
            ),
        ],
        low_carbon_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line="12", field="low_carbon_fuel_required", value=0
            ),
        ],
        non_compliance_penalty_summary=[
            ComplianceReportSummaryRowSchema(
                line="21", field="non_compliance_penalty_payable", value=0
            ),
        ],
    )

    # Set up mocks
    mock_repo.get_summary_by_report_id.return_value = existing_summary
    compliance_report_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )

    # Call the method
    await compliance_report_update_service.handle_submitted_status(mock_report)

    # Assertions
    saved_summary = mock_repo.save_compliance_report_summary.call_args[0][1]
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
    compliance_report_update_service, mock_repo, compliance_report_summary_service
):
    # Mock data
    report_id = 1
    mock_report = MagicMock(spec=ComplianceReport)
    mock_report.compliance_report_id = report_id
    mock_report.summary = MagicMock(spec=ComplianceReportSummary)
    mock_report.summary.summary_id = 100

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
                line="6",
                field="renewable_fuel_retained",
                gasoline=100,
                diesel=200,
                jet_fuel=300,
            ),
            ComplianceReportSummaryRowSchema(
                line="7",
                field="previously_retained",
                gasoline=400,
                diesel=500,
                jet_fuel=600,
            ),
            ComplianceReportSummaryRowSchema(
                line="8",
                field="obligation_deferred",
                gasoline=700,
                diesel=800,
                jet_fuel=900,
            ),
        ],
        low_carbon_fuel_target_summary=[
            ComplianceReportSummaryRowSchema(
                line="12", field="low_carbon_fuel_required", value=0
            ),
        ],
        non_compliance_penalty_summary=[
            ComplianceReportSummaryRowSchema(
                line="21", field="non_compliance_penalty_payable", value=0
            ),
        ],
    )

    # Set up mocks
    mock_repo.get_summary_by_report_id.return_value = existing_summary
    compliance_report_summary_service.calculate_compliance_report_summary = AsyncMock(
        return_value=calculated_summary
    )

    # Call the method
    await compliance_report_update_service.handle_submitted_status(mock_report)

    # Assertions
    saved_summary = mock_repo.save_compliance_report_summary.call_args[0][1]
    assert (
        saved_summary.renewable_fuel_target_summary[0].gasoline == 100
    )  # Used calculated value
    assert (
        saved_summary.renewable_fuel_target_summary[1].diesel == 500
    )  # Used calculated value
    assert (
        saved_summary.renewable_fuel_target_summary[2].jet_fuel == 900
    )  # Used calculated value
