import pytest
from unittest.mock import MagicMock, AsyncMock, patch, Mock

from lcfs.db.models import Organization
from lcfs.db.models.compliance import ComplianceReport
from lcfs.db.models.compliance.CompliancePeriod import CompliancePeriod
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.db.models.user import UserProfile
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportBaseSchema,
)
from lcfs.web.exception.exceptions import ServiceException, DataNotFoundException


# get_all_compliance_periods
@pytest.mark.anyio
async def test_get_all_compliance_periods_success(compliance_report_service, mock_repo):
    mock_periods = [
        {"compliance_period_id": 1, "description": "2024 Compliance Period"},
        {"compliance_period_id": 2, "description": "2025 Compliance Period"},
    ]
    mock_repo.get_all_compliance_periods.return_value = mock_periods

    result = await compliance_report_service.get_all_compliance_periods()

    assert len(result) == 2
    assert result[0].compliance_period_id == 1
    assert result[0].description == "2024 Compliance Period"
    mock_repo.get_all_compliance_periods.assert_called_once()


@pytest.mark.anyio
async def test_get_all_compliance_periods_unexpected_error(
    compliance_report_service, mock_repo
):
    mock_repo.get_all_compliance_periods.side_effect = Exception("Unexpected error")

    with pytest.raises(ServiceException):
        await compliance_report_service.get_all_compliance_periods()

    mock_repo.get_all_compliance_periods.assert_called_once()


@pytest.mark.anyio
async def test_create_compliance_report_success(
    compliance_report_service,
    mock_repo,
    mock_org_repo,
    compliance_report_base_schema,
    compliance_report_create_schema,
    mock_snapshot_service,
):
    mock_user = MagicMock()
    mock_org_repo.get_organization.return_value = Mock(has_early_issuance=False)

    # Mock the compliance period
    mock_compliance_period = CompliancePeriod(
        compliance_period_id=1,
        description="2024",
    )
    mock_repo.get_compliance_period.return_value = mock_compliance_period

    # Mock the compliance report status
    mock_draft_status = ComplianceReportStatus(
        compliance_report_status_id=1, status="Draft"
    )
    mock_repo.get_compliance_report_status_by_desc.return_value = mock_draft_status

    # Mock the added compliance report
    mock_compliance_report = compliance_report_base_schema()

    mock_repo.create_compliance_report.return_value = mock_compliance_report

    result = await compliance_report_service.create_compliance_report(
        1, compliance_report_create_schema, mock_user
    )

    assert result == mock_compliance_report
    mock_repo.get_compliance_period.assert_called_once_with(
        compliance_report_create_schema.compliance_period
    )
    mock_repo.get_compliance_report_status_by_desc.assert_called_once_with(
        compliance_report_create_schema.status
    )
    mock_repo.create_compliance_report.assert_called_once()
    mock_snapshot_service.create_organization_snapshot.assert_called_once()

    saved_report = mock_repo.create_compliance_report.call_args[0][0]
    assert saved_report.reporting_frequency == ReportingFrequency.ANNUAL


# create_compliance_report
@pytest.mark.anyio
async def test_create_compliance_report_quarterly_success(
    compliance_report_service,
    mock_repo,
    mock_org_repo,
    compliance_report_base_schema,
    compliance_report_create_schema,
    mock_snapshot_service,
):
    mock_user = MagicMock()
    mock_org_repo.get_organization.return_value = Mock(has_early_issuance=True)

    # Mock the compliance period
    mock_compliance_period = CompliancePeriod(
        compliance_period_id=1,
        description="2024",
    )
    mock_repo.get_compliance_period.return_value = mock_compliance_period

    # Mock the compliance report status
    mock_draft_status = ComplianceReportStatus(
        compliance_report_status_id=1, status="Draft"
    )
    mock_repo.get_compliance_report_status_by_desc.return_value = mock_draft_status

    # Mock the added compliance report
    mock_compliance_report = compliance_report_base_schema()

    mock_repo.create_compliance_report.return_value = mock_compliance_report

    await compliance_report_service.create_compliance_report(
        1, compliance_report_create_schema, mock_user
    )

    saved_report = mock_repo.create_compliance_report.call_args[0][0]
    assert saved_report.reporting_frequency == ReportingFrequency.QUARTERLY


@pytest.mark.anyio
async def test_create_compliance_report_unexpected_error(
    compliance_report_service, mock_repo
):
    mock_repo.create_compliance_report.side_effect = Exception(
        "Unexpected error occurred"
    )

    with pytest.raises(ServiceException):
        await compliance_report_service.create_compliance_report(
            1, {"compliance_period": 1, "status": "Draft"}
        )


# get_compliance_reports_paginated
@pytest.mark.anyio
async def test_get_compliance_reports_paginated_success(
    compliance_report_service, mock_repo, compliance_report_schema
):
    pagination_mock = AsyncMock()
    pagination_mock.page = 1
    pagination_mock.size = 10

    mock_compliance_report = compliance_report_schema()

    mock_repo.get_reports_paginated.return_value = ([mock_compliance_report], 1)

    result = await compliance_report_service.get_compliance_reports_paginated(
        pagination_mock, UserProfile()
    )

    assert result.pagination.total == 1
    assert result.reports == [mock_compliance_report]
    mock_repo.get_reports_paginated.assert_called_once()


@pytest.mark.anyio
async def test_get_compliance_reports_paginated_not_found(
    compliance_report_service, mock_repo
):
    # Arrange
    pagination_mock = AsyncMock()
    pagination_mock.page = 1
    pagination_mock.size = 10
    pagination_mock.filters = []
    pagination_mock.sort_orders = []

    # Mock the repository to return no records
    mock_repo.get_reports_paginated.return_value = ([], 0)

    # Act
    result = await compliance_report_service.get_compliance_reports_paginated(
        pagination_mock, UserProfile()
    )

    # Assert: Verify the service returns an empty list and correct pagination metadata
    assert result.reports == [], "Expected no compliance reports to be returned"
    assert result.pagination.total == 0, "Expected total=0 when there are no records"
    assert result.pagination.page == 1, "Page should match the requested page"
    assert result.pagination.size == 10, "Size should match the requested size"
    assert result.pagination.total_pages == 0, "0 records should yield 0 total_pages"

    # Also verify our repo was called exactly once
    mock_repo.get_reports_paginated.assert_called_once()


@pytest.mark.anyio
async def test_get_compliance_reports_paginated_unexpected_error(
    compliance_report_service, mock_repo
):
    mock_repo.get_reports_paginated.side_effect = Exception("Unexpected error occurred")

    with pytest.raises(ServiceException):
        await compliance_report_service.get_compliance_reports_paginated(
            AsyncMock(), UserProfile()
        )


# get_compliance_report_by_id
@pytest.mark.anyio
async def test_get_compliance_report_by_id_success(
    compliance_report_service, mock_repo, compliance_report_base_schema
):
    mock_compliance_report = compliance_report_base_schema()

    compliance_report_service._mask_report_status_for_history = MagicMock(
        return_value=mock_compliance_report
    )

    mock_repo.get_compliance_report_by_id.return_value = mock_compliance_report

    mock_user = UserProfile()
    result = await compliance_report_service.get_compliance_report_by_id(1, mock_user)

    assert result == mock_compliance_report
    mock_repo.get_compliance_report_by_id.assert_called_once_with(1)
    compliance_report_service._mask_report_status_for_history.assert_called_once_with(
        mock_compliance_report, mock_user
    )


@pytest.mark.anyio
async def test_get_compliance_report_by_id_not_found(
    compliance_report_service, mock_repo
):
    mock_repo.get_compliance_report_by_id.return_value = None

    with pytest.raises(DataNotFoundException):
        await compliance_report_service.get_compliance_report_by_id(999, UserProfile())


@pytest.mark.anyio
async def test_get_compliance_report_by_id_unexpected_error(
    compliance_report_service, mock_repo
):
    mock_repo.get_compliance_report_by_id.side_effect = Exception("Unexpected error")

    with pytest.raises(ServiceException):
        await compliance_report_service.get_compliance_report_by_id(1, UserProfile())


# get_all_org_reported_years
@pytest.mark.anyio
async def test_get_all_org_reported_years_success(
    compliance_report_service, mock_repo, compliance_period_schema
):

    mock_repo.get_all_org_reported_years.return_value = [compliance_period_schema]

    result = await compliance_report_service.get_all_org_reported_years(1)

    assert len(result) == 1
    assert result[0] == compliance_period_schema
    mock_repo.get_all_org_reported_years.assert_called_once_with(1)


@pytest.mark.anyio
async def test_get_all_org_reported_years_unexpected_error(
    compliance_report_service, mock_repo
):
    mock_repo.get_all_org_reported_years.side_effect = Exception(
        "Unexpected error occurred"
    )

    with pytest.raises(ServiceException):
        await compliance_report_service.get_all_org_reported_years(1)


@pytest.mark.anyio
async def test_create_supplemental_report_includes_summary_lines(
    compliance_report_service,
    mock_repo,
):
    """
    Test that when creating a supplemental report, the summary lines from
    the assessed report are properly included in the new report's summary.
    """
    # Mock an existing compliance report with specific summary values
    mock_summary = MagicMock()
    mock_summary.line_6_renewable_fuel_retained_gasoline = 10
    mock_summary.line_6_renewable_fuel_retained_diesel = 20
    mock_summary.line_6_renewable_fuel_retained_jet_fuel = 30
    mock_summary.line_8_obligation_deferred_gasoline = 5
    mock_summary.line_8_obligation_deferred_diesel = 10
    mock_summary.line_8_obligation_deferred_jet_fuel = 15
    mock_summary.line_9_obligation_added_gasoline = 2
    mock_summary.line_9_obligation_added_diesel = 4
    mock_summary.line_9_obligation_added_jet_fuel = 6

    columns_mock = MagicMock()
    columns_mock.keys.return_value = [
        "line_6_renewable_fuel_retained_gasoline",
        "line_6_renewable_fuel_retained_diesel",
        "line_6_renewable_fuel_retained_jet_fuel",
        "line_8_obligation_deferred_gasoline",
        "line_8_obligation_deferred_diesel",
        "line_8_obligation_deferred_jet_fuel",
        "line_9_obligation_added_gasoline",
        "line_9_obligation_added_diesel",
        "line_9_obligation_added_jet_fuel",
    ]
    table_mock = MagicMock()
    table_mock.columns = columns_mock
    mock_summary.__table__ = table_mock

    mock_assessed_report = MagicMock()
    mock_assessed_report.summary = mock_summary
    mock_assessed_report.compliance_period_id = 1
    mock_assessed_report.organization_id = 1
    mock_assessed_report.compliance_report_group_uuid = "test-group-uuid"
    mock_assessed_report.compliance_period = MagicMock(description="2024")

    mock_current_report = MagicMock(spec=ComplianceReport)
    mock_current_report.compliance_period_id = 1
    mock_current_report.organization_id = 1
    mock_current_report.compliance_report_group_uuid = "test-group-uuid"
    mock_current_report.version = 0
    mock_current_report.reporting_frequency = "test_frequency"

    # Mock status
    mock_draft_status = MagicMock()
    mock_draft_status.compliance_report_status_id = 1

    # Set up mocks for repository calls
    mock_repo.get_compliance_report_by_id.return_value = mock_current_report
    mock_repo.get_compliance_report_status_by_desc.return_value = mock_draft_status
    mock_repo.get_assessed_compliance_report_by_period.return_value = (
        mock_assessed_report
    )

    mock_latest_report = MagicMock()
    mock_latest_report.version = 0
    mock_repo.get_latest_report_by_group_uuid.return_value = mock_latest_report

    # This is the key part - create a mock for the created report that will capture the summary
    created_report = MagicMock(compliance_report_id=2)
    mock_repo.create_compliance_report.return_value = created_report

    mock_schema = MagicMock()

    with patch.object(
        ComplianceReportBaseSchema, "model_validate", return_value=mock_schema
    ):
        # Call the service
        mock_user = MagicMock(spec=UserProfile, organization_id=1)
        result = await compliance_report_service.create_supplemental_report(
            1, mock_user
        )
        assert result is not None

        # Check that create_compliance_report was called
        mock_repo.create_compliance_report.assert_called_once()

        # Get the report object that was passed to create_compliance_report
        new_report = mock_repo.create_compliance_report.call_args[0][0]

        # Verify the summary values were copied correctly
        assert hasattr(new_report, "summary")
        new_summary = new_report.summary

        # Check the actual values
        assert new_summary.line_6_renewable_fuel_retained_gasoline == 10
        assert new_summary.line_6_renewable_fuel_retained_diesel == 20
        assert new_summary.line_6_renewable_fuel_retained_jet_fuel == 30
        assert new_summary.line_8_obligation_deferred_gasoline == 5
        assert new_summary.line_8_obligation_deferred_diesel == 10
        assert new_summary.line_8_obligation_deferred_jet_fuel == 15
        assert new_summary.line_9_obligation_added_gasoline == 2
        assert new_summary.line_9_obligation_added_diesel == 4
        assert new_summary.line_9_obligation_added_jet_fuel == 6
        compliance_report_service.final_supply_equipment_service.copy_to_report.assert_awaited_once()


@pytest.mark.anyio
async def test_delete_supplemental_report_success(compliance_report_service, mock_repo):
    """Test successful deletion of a supplemental compliance report"""

    mock_user = MagicMock(organization_id=998)
    mock_report = MagicMock(
        organization_id=998,
        current_status=MagicMock(status=ComplianceReportStatusEnum.Draft),
    )

    # Mock repository methods
    mock_repo.get_compliance_report_by_id.return_value = mock_report
    mock_repo.delete_compliance_report = AsyncMock(return_value=True)

    result = await compliance_report_service.delete_compliance_report(996, mock_user)

    assert result is True
    mock_repo.get_compliance_report_by_id.assert_called_once_with(996, is_model=True)
    mock_repo.delete_compliance_report.assert_called_once_with(996)


@pytest.mark.anyio
async def test_delete_compliance_report_not_found(compliance_report_service, mock_repo):
    """Test deletion fails when compliance report does not exist"""

    mock_user = MagicMock(organization_id=998)

    # Mock repo to return None
    mock_repo.get_compliance_report_by_id.return_value = None

    with pytest.raises(DataNotFoundException, match="Compliance report not found."):
        await compliance_report_service.delete_compliance_report(1000, mock_user)

    mock_repo.get_compliance_report_by_id.assert_called_once_with(1000, is_model=True)
    mock_repo.delete_compliance_report.assert_not_called()  # Ensure delete is not called


@pytest.mark.anyio
async def test_delete_compliance_report_supplier_no_permission(
    compliance_report_service, mock_repo
):
    """Test deletion fails when user does not have permission"""

    mock_user = MagicMock(organization_id=999)  # Different org
    mock_report = MagicMock(
        organization_id=998, current_status=MagicMock(status="Draft")
    )

    mock_repo.get_compliance_report_by_id.return_value = mock_report

    with pytest.raises(Exception) as exc:
        await compliance_report_service.delete_compliance_report(996, mock_user)
    assert exc.typename == "ServiceException"

    mock_repo.get_compliance_report_by_id.assert_called_once_with(996, is_model=True)
    mock_repo.delete_compliance_report.assert_not_called()


@pytest.mark.anyio
async def test_delete_compliance_report_idir_no_permission(
    compliance_report_service, mock_repo
):
    """Test deletion fails when IDIR user tries to delete Draft compliance report instead of Analyst_Adjustment/ in government re-assessement"""
    mock_user = MagicMock(organization_id=None)
    mock_report = MagicMock(
        organization_id=998, current_status=MagicMock(status="Draft")
    )

    mock_repo.get_compliance_report_by_id.return_value = mock_report

    with pytest.raises(Exception) as exc:
        await compliance_report_service.delete_compliance_report(996, mock_user)
    assert exc.typename == "ServiceException"

    mock_repo.get_compliance_report_by_id.assert_called_once_with(996, is_model=True)
    mock_repo.delete_compliance_report.assert_not_called()


@pytest.mark.anyio
async def test_delete_compliance_report_wrong_status(
    compliance_report_service, mock_repo
):
    """Test deletion fails when compliance report is not in 'Draft'/ status"""

    mock_user = MagicMock(organization_id=998)
    mock_report = MagicMock(
        organization_id=998, current_status=MagicMock(status="Assessed")  # Not Draft
    )

    mock_repo.get_compliance_report_by_id.return_value = mock_report

    with pytest.raises(Exception) as exc_info:
        await compliance_report_service.delete_compliance_report(996, mock_user)

    assert exc_info.typename == "ServiceException"

    mock_repo.get_compliance_report_by_id.assert_called_once_with(996, is_model=True)
    mock_repo.delete_compliance_report.assert_not_called()
