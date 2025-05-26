from datetime import datetime
import copy
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.web.api.compliance_report.dtos import (
    ChangelogAllocationAgreementsDTO,
    ChangelogFuelSuppliesDTO,
)
import pytest
from unittest.mock import MagicMock, AsyncMock, patch, Mock
from datetime import datetime

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

from lcfs.db.models.user.Role import Role, RoleEnum
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.db.models.compliance.ComplianceReport import SupplementalInitiatorType
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary


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
    mock_transaction_repo,
):
    """
    Test that when creating a supplemental report, the summary lines from
    the assessed report are properly included in the new report's summary.
    """
    # Inject the mock transaction repo into the service
    compliance_report_service.transaction_repo = mock_transaction_repo

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

    # Mock the transaction repo to return a balance as an async method
    mock_transaction_repo.calculate_line_17_available_balance_for_period = AsyncMock(
        return_value=2000
    )

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
    mock_repo.get_compliance_report_by_id.assert_called_once_with(996)
    mock_repo.delete_compliance_report.assert_called_once_with(996)


@pytest.mark.anyio
async def test_delete_compliance_report_not_found(compliance_report_service, mock_repo):
    """Test deletion fails when compliance report does not exist"""

    mock_user = MagicMock(organization_id=998)

    # Mock repo to return None
    mock_repo.get_compliance_report_by_id.return_value = None

    with pytest.raises(DataNotFoundException, match="Compliance report not found."):
        await compliance_report_service.delete_compliance_report(1000, mock_user)

    mock_repo.get_compliance_report_by_id.assert_called_once_with(1000)
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

    mock_repo.get_compliance_report_by_id.assert_called_once_with(996)
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

    mock_repo.get_compliance_report_by_id.assert_called_once_with(996)
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

    mock_repo.get_compliance_report_by_id.assert_called_once_with(996)
    mock_repo.delete_compliance_report.assert_not_called()


@pytest.mark.anyio
async def test_create_government_initiated_supplemental_report_success(
    compliance_report_service: ComplianceReportServices,
    mock_user_profile_analyst: MagicMock,  # Assume a fixture for an analyst user
    mock_compliance_report_submitted: MagicMock,  # Assume fixture for submitted report
    mock_repo: AsyncMock,
    mock_snapshot_service: AsyncMock,
    mock_fse_services: AsyncMock,
    mock_document_service: AsyncMock,
):
    """Test successful creation of a government-initiated supplemental report."""
    # Patch user_has_roles for this specific test
    with patch(
        "lcfs.web.api.compliance_report.services.user_has_roles", return_value=True
    ):
        # Arrange
        # Ensure the report status is correctly set for this test
        mock_compliance_report_submitted.current_status.status = (
            ComplianceReportStatusEnum.Submitted
        )
        existing_report_id = mock_compliance_report_submitted.compliance_report_id
        group_uuid = mock_compliance_report_submitted.compliance_report_group_uuid
        current_version = mock_compliance_report_submitted.version
        new_version = current_version + 1

        mock_repo.get_compliance_report_by_id = AsyncMock(
            return_value=mock_compliance_report_submitted
        )
        mock_repo.get_draft_report_by_group_uuid = AsyncMock(
            return_value=None  # No existing draft
        )
        mock_repo.get_latest_report_by_group_uuid = AsyncMock(
            return_value=mock_compliance_report_submitted  # Simplification, could be another report
        )
        # Mock status retrieval
        mock_draft_status = MagicMock()
        mock_draft_status.compliance_report_status_id = 2  # Example ID for Draft
        mock_draft_status.status = ComplianceReportStatusEnum.Draft
        # Ensure mock_draft_status looks like the schema for validation
        mock_draft_status.compliance_report_status_id = 2
        mock_draft_status.status = (
            ComplianceReportStatusEnum.Draft.value
        )  # Use enum value for schema
        mock_repo.get_compliance_report_status_by_desc = AsyncMock(
            return_value=mock_draft_status
        )

        # Mock the report object *returned* by create_compliance_report
        # Ensure it has attributes needed for ComplianceReportBaseSchema validation
        mock_new_report = MagicMock(spec=ComplianceReport)  # Use spec
        mock_new_report.compliance_report_id = 999
        mock_new_report.version = new_version
        mock_new_report.compliance_report_group_uuid = group_uuid
        mock_new_report.compliance_period = (
            mock_compliance_report_submitted.compliance_period
        )  # Pydantic schema
        mock_new_report.organization = (
            mock_compliance_report_submitted.organization
        )  # Pydantic schema
        mock_new_report.current_status = (
            mock_draft_status  # Mock configured like schema
        )
        mock_new_report.nickname = f"Supplemental Report {new_version}"
        mock_new_report.supplemental_initiator = (
            SupplementalInitiatorType.SUPPLIER_SUPPLEMENTAL.value
        )  # Enum value
        mock_new_report.reporting_frequency = (
            mock_compliance_report_submitted.reporting_frequency
        )  # Use value from mock
        mock_new_report.supplemental_note = None
        mock_new_report.assessment_statement = None
        mock_new_report.transaction_id = None
        # Set dummy create/update dates needed by BaseSchema
        mock_new_report.create_date = datetime.now()
        mock_new_report.update_date = datetime.now()
        mock_repo.create_compliance_report = AsyncMock(return_value=mock_new_report)

        # Act
        created_report_schema = await compliance_report_service.create_government_initiated_supplemental_report(
            existing_report_id, mock_user_profile_analyst
        )

        # Assert
        # Check repository calls
        mock_repo.get_compliance_report_by_id.assert_called_once_with(
            existing_report_id
        )
        mock_repo.get_draft_report_by_group_uuid.assert_called_once_with(group_uuid)
        mock_repo.get_latest_report_by_group_uuid.assert_called_once_with(group_uuid)
        mock_repo.get_compliance_report_status_by_desc.assert_called_once_with(
            ComplianceReportStatusEnum.Draft.value
        )
        mock_repo.create_compliance_report.assert_called_once()
        # Assert history was called with the object *after* ID was assigned
        # History uses the object *returned* by create_compliance_report
        mock_repo.add_compliance_report_history.assert_called_once_with(
            mock_new_report, mock_user_profile_analyst
        )

        # Check dependency service calls
        mock_snapshot_service.create_organization_snapshot.assert_called_once()
        mock_fse_services.copy_to_report.assert_called_once()
        # Assert copy_documents was called with the correct IDs
        # Copy docs uses the object *returned* by create_compliance_report
        mock_document_service.copy_documents.assert_called_once_with(
            existing_report_id, mock_new_report.compliance_report_id
        )

        # Check returned schema
        assert (
            created_report_schema.compliance_report_id
            == mock_new_report.compliance_report_id
        )
        assert created_report_schema.version == new_version
        assert created_report_schema.nickname == f"Supplemental Report {new_version}"
        # Check the create_compliance_report call arguments (more detailed)
        call_args = mock_repo.create_compliance_report.call_args[0][0]
        assert call_args.version == new_version
        assert (
            call_args.current_status_id == mock_draft_status.compliance_report_status_id
        )
        assert call_args.nickname == f"Supplemental Report {new_version}"
        assert (
            call_args.supplemental_initiator
            == SupplementalInitiatorType.SUPPLIER_SUPPLEMENTAL
        )


@pytest.mark.anyio
async def test_create_supplemental_report_uses_current_balance(
    compliance_report_service,
    mock_repo,
    mock_transaction_repo,
    compliance_report_base_schema,
):
    """Test that supplemental report creation uses current Line 17 balance calculation"""
    from datetime import datetime
    from lcfs.db.models.compliance.ComplianceReportSummary import (
        ComplianceReportSummary,
    )
    from lcfs.db.models.compliance.ComplianceReport import (
        ComplianceReport,
        SupplementalInitiatorType,
        ReportingFrequency,
    )
    from lcfs.db.models.compliance.ComplianceReportStatus import (
        ComplianceReportStatus,
        ComplianceReportStatusEnum,
    )

    # Mock current report
    mock_current_report = MagicMock(spec=ComplianceReport)
    mock_current_report.compliance_report_id = 1
    mock_current_report.organization_id = 123
    mock_current_report.compliance_period_id = 1
    mock_current_report.compliance_period.description = "2024"
    mock_current_report.compliance_report_group_uuid = "test-group-uuid"
    mock_current_report.version = 0
    mock_current_report.reporting_frequency = "Annual"

    # Mock assessed report with summary
    mock_assessed_summary = MagicMock(spec=ComplianceReportSummary)
    mock_assessed_summary.line_6_renewable_fuel_retained_gasoline = 100
    mock_assessed_summary.line_6_renewable_fuel_retained_diesel = 200
    mock_assessed_summary.line_6_renewable_fuel_retained_jet_fuel = 300
    mock_assessed_summary.line_7_previously_retained_gasoline = 50
    mock_assessed_summary.line_7_previously_retained_diesel = 75
    mock_assessed_summary.line_7_previously_retained_jet_fuel = 100
    mock_assessed_summary.line_8_obligation_deferred_gasoline = 25
    mock_assessed_summary.line_8_obligation_deferred_diesel = 35
    mock_assessed_summary.line_8_obligation_deferred_jet_fuel = 45
    mock_assessed_summary.line_9_obligation_added_gasoline = 10
    mock_assessed_summary.line_9_obligation_added_diesel = 15
    mock_assessed_summary.line_9_obligation_added_jet_fuel = 20

    # Mock assessed report
    mock_assessed_report = MagicMock()
    mock_assessed_report.summary = mock_assessed_summary

    # Mock the latest report
    mock_latest_report = MagicMock()
    mock_latest_report.version = 0

    # Mock user
    mock_user = MagicMock()
    mock_user.organization_id = 123
    mock_user.keycloak_username = "test_user"

    # Mock draft status
    mock_draft_status = MagicMock(spec=ComplianceReportStatus)
    mock_draft_status.compliance_report_status_id = 1

    # Mock the new report that will be created
    mock_new_report = MagicMock(spec=ComplianceReport)
    mock_new_report.compliance_report_id = 2
    mock_new_report.compliance_report_group_uuid = "test-group-uuid"
    mock_new_report.supplemental_initiator = (
        SupplementalInitiatorType.SUPPLIER_SUPPLEMENTAL
    )
    mock_new_report.compliance_period = mock_current_report.compliance_period
    mock_new_report.organization = MagicMock()
    mock_new_report.organization.organizationCode = "ORG123"
    mock_new_report.organization.name = "Test Organization"
    mock_new_report.current_status = MagicMock()
    mock_new_report.current_status.status = "Draft"
    mock_new_report.nickname = "Supplemental report 1"
    mock_new_report.supplemental_note = "Test supplemental note"
    mock_new_report.reporting_frequency = ReportingFrequency.ANNUAL
    mock_new_report.assessment_statement = "Test assessment statement"
    mock_repo.create_compliance_report.return_value = mock_new_report
    mock_repo.add_compliance_report_history = AsyncMock()

    # Setup repository mocks
    mock_repo.get_compliance_report_by_id.return_value = mock_current_report
    mock_repo.get_latest_report_by_group_uuid.return_value = mock_latest_report
    mock_repo.get_compliance_report_status_by_desc.return_value = mock_draft_status
    mock_repo.get_assessed_compliance_report_by_period.return_value = (
        mock_assessed_report
    )

    # Mock the transaction repo to return a specific balance for Line 17
    expected_line_17_balance = 2500
    mock_transaction_repo.calculate_line_17_available_balance_for_period = AsyncMock(
        return_value=expected_line_17_balance
    )

    # Mock other services
    compliance_report_service.snapshot_services.create_organization_snapshot = (
        AsyncMock()
    )
    compliance_report_service.final_supply_equipment_service.copy_to_report = (
        AsyncMock()
    )
    compliance_report_service.document_service.copy_documents = AsyncMock()
    compliance_report_service.internal_comment_service.copy_internal_comments = (
        AsyncMock()
    )

    # Call the method
    result = await compliance_report_service.create_supplemental_report(
        original_report_id=1, user=mock_user
    )

    # Verify the Line 17 calculation method was called with correct parameters
    mock_transaction_repo.calculate_line_17_available_balance_for_period.assert_called_once_with(
        123,  # organization_id
        2024,  # compliance_period
    )

    # Verify the new report was created with the Line 17 balance
    create_call_args = mock_repo.create_compliance_report.call_args[0][0]
    assert (
        create_call_args.summary.line_17_non_banked_units_used
        == expected_line_17_balance
    )

    # Verify other summary fields were copied from assessed report
    assert create_call_args.summary.line_6_renewable_fuel_retained_gasoline == 100
    assert create_call_args.summary.line_6_renewable_fuel_retained_diesel == 200
    assert create_call_args.summary.line_6_renewable_fuel_retained_jet_fuel == 300

    # Verify the result
    assert result == compliance_report_base_schema


@pytest.mark.anyio
async def test_create_supplemental_report_line_17_calculation_error_handling(
    compliance_report_service,
    mock_repo,
    mock_transaction_repo,
):
    """Test error handling when Line 17 calculation fails during supplemental report creation"""
    from lcfs.db.models.compliance.ComplianceReport import (
        ComplianceReport,
        ReportingFrequency,
    )
    from lcfs.db.models.compliance.ComplianceReportSummary import (
        ComplianceReportSummary,
    )

    # Mock current report
    mock_current_report = MagicMock(spec=ComplianceReport)
    mock_current_report.compliance_report_id = 1
    mock_current_report.organization_id = 123
    mock_current_report.compliance_period = MagicMock()
    mock_current_report.compliance_period.description = "2024"
    mock_current_report.compliance_report_group_uuid = "test-group-uuid"
    mock_current_report.version = 0
    mock_current_report.reporting_frequency = ReportingFrequency.ANNUAL
    mock_current_report.compliance_period_id = 1

    # Mock assessed report
    mock_assessed_report = MagicMock()
    mock_assessed_report.summary = MagicMock(spec=ComplianceReportSummary)

    # Mock user
    mock_user = MagicMock()
    mock_user.organization_id = 123

    # Setup repository mocks
    mock_repo.get_compliance_report_by_id.return_value = mock_current_report
    mock_repo.get_latest_report_by_group_uuid.return_value = MagicMock(version=0)
    mock_repo.get_compliance_report_status_by_desc.return_value = MagicMock(
        compliance_report_status_id=1
    )
    mock_repo.get_assessed_compliance_report_by_period.return_value = (
        mock_assessed_report
    )

    # Mock transaction repo to raise an exception
    mock_transaction_repo.calculate_line_17_available_balance_for_period = AsyncMock(
        side_effect=Exception("Database connection error")
    )

    # Test that the exception is properly propagated
    with pytest.raises(Exception, match="Database connection error"):
        await compliance_report_service.create_supplemental_report(
            original_report_id=1, user=mock_user
        )


@pytest.mark.anyio
async def test_create_supplemental_report_line_17_zero_balance(
    compliance_report_service,
    mock_repo,
    mock_transaction_repo,
    compliance_report_base_schema,
):
    """Test supplemental report creation when Line 17 calculation returns zero balance"""
    from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
    from lcfs.db.models.compliance.ComplianceReportSummary import (
        ComplianceReportSummary,
    )

    # Mock current report
    mock_current_report = MagicMock(spec=ComplianceReport)
    mock_current_report.compliance_report_id = 1
    mock_current_report.organization_id = 123
    mock_current_report.compliance_period = MagicMock()
    mock_current_report.compliance_period.description = "2024"
    mock_current_report.compliance_report_group_uuid = "test-group-uuid"
    mock_current_report.version = 0
    mock_current_report.reporting_frequency = "Annual"

    # Mock assessed report with summary
    mock_assessed_summary = MagicMock(spec=ComplianceReportSummary)
    mock_assessed_summary.line_6_renewable_fuel_retained_gasoline = 100
    mock_assessed_summary.line_6_renewable_fuel_retained_diesel = 200
    mock_assessed_summary.line_6_renewable_fuel_retained_jet_fuel = 300
    mock_assessed_summary.line_7_previously_retained_gasoline = 50
    mock_assessed_summary.line_7_previously_retained_diesel = 75
    mock_assessed_summary.line_7_previously_retained_jet_fuel = 100
    mock_assessed_summary.line_8_obligation_deferred_gasoline = 25
    mock_assessed_summary.line_8_obligation_deferred_diesel = 35
    mock_assessed_summary.line_8_obligation_deferred_jet_fuel = 45
    mock_assessed_summary.line_9_obligation_added_gasoline = 10
    mock_assessed_summary.line_9_obligation_added_diesel = 15
    mock_assessed_summary.line_9_obligation_added_jet_fuel = 20

    # Mock assessed report
    mock_assessed_report = MagicMock()
    mock_assessed_report.summary = mock_assessed_summary

    # Mock user
    mock_user = MagicMock()
    mock_user.organization_id = 123
    mock_user.keycloak_username = "test_user"

    # Mock draft status
    mock_draft_status = MagicMock(spec=ComplianceReportStatus)
    mock_draft_status.compliance_report_status_id = 1

    # Mock the new report that will be created
    mock_new_report = MagicMock(spec=ComplianceReport)
    mock_new_report.compliance_report_id = 2
    mock_new_report.compliance_report_group_uuid = "test-group-uuid"
    mock_new_report.supplemental_initiator = (
        SupplementalInitiatorType.SUPPLIER_SUPPLEMENTAL
    )
    mock_new_report.compliance_period = mock_current_report.compliance_period
    mock_new_report.organization = MagicMock()
    mock_new_report.organization.organizationCode = "ORG123"
    mock_new_report.organization.name = "Test Organization"
    mock_new_report.current_status = MagicMock()
    mock_new_report.current_status.status = "Draft"
    mock_new_report.nickname = "Supplemental report 1"
    mock_new_report.supplemental_note = "Test supplemental note"
    mock_new_report.reporting_frequency = ReportingFrequency.ANNUAL
    mock_new_report.assessment_statement = "Test assessment statement"
    mock_repo.create_compliance_report.return_value = mock_new_report
    mock_repo.add_compliance_report_history = AsyncMock()

    # Setup repository mocks
    mock_repo.get_compliance_report_by_id.return_value = mock_current_report
    mock_repo.get_latest_report_by_group_uuid.return_value = MagicMock(version=0)
    mock_repo.get_compliance_report_status_by_desc.return_value = mock_draft_status
    mock_repo.get_assessed_compliance_report_by_period.return_value = (
        mock_assessed_report
    )

    # Mock the transaction repo to return zero balance
    mock_transaction_repo.calculate_line_17_available_balance_for_period = AsyncMock(
        return_value=0
    )

    # Mock other services
    compliance_report_service.snapshot_services.create_organization_snapshot = (
        AsyncMock()
    )
    compliance_report_service.final_supply_equipment_service.copy_to_report = (
        AsyncMock()
    )
    compliance_report_service.document_service.copy_documents = AsyncMock()
    compliance_report_service.internal_comment_service.copy_internal_comments = (
        AsyncMock()
    )

    # Call the method
    result = await compliance_report_service.create_supplemental_report(
        original_report_id=1, user=mock_user
    )

    # Verify Line 17 was set to 0
    create_call_args = mock_repo.create_compliance_report.call_args[0][0]
    assert create_call_args.summary.line_17_non_banked_units_used == 0

    # Verify the method was called
    mock_transaction_repo.calculate_line_17_available_balance_for_period.assert_called_once_with(
        123, 2024
    )

    assert result == compliance_report_base_schema


@pytest.mark.anyio
async def test_get_changelog_data_fuel_supplies_success(
    compliance_report_service, mock_repo
):
    """Test successful retrieval of fuel supplies changelog data"""

    # Create a simple data class to use instead of MagicMock
    class MockFuelSupply:
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)

    # Create the mock report
    mock_report = MagicMock()
    mock_report.nickname = "Report 1"
    mock_report.version = 1
    mock_report.compliance_report_id = 1

    # Create the fuel supply with all required attributes
    mock_fuel_supply = MockFuelSupply(
        fuel_supply_id=1,
        group_uuid="group-1",
        version=1,
        action_type="CREATE",
        create_date=datetime(2024, 1, 1),
        compliance_units=100.56,
        create_user="test_user",
        update_user="test_user",
        units="litres",
        fuel_type_other="",
        quantity=500.0,  # Adding the required quantity field
        compliance_report_id=1,  # Adding compliance_report_id (as complianceReportId in DTO)
        # Related objects
        fuel_category=MockFuelSupply(category="Gasoline"),
        fuel_code=MockFuelSupply(fuelCode="BCLCF100"),
        fuel_type=MockFuelSupply(fuelType="Ethanol"),
        provision_of_the_act=MockFuelSupply(name="Section 6(1)"),
        end_use_type=MockFuelSupply(type="Transportation"),
    )

    # Add any additional fields that might be required by the DTO
    for field in [
        "carbon_intensity",
        "carbon_intensity_limit",
        "carbon_intensity_difference",
        "energy_content",
        "energy_effectiveness_ratio",
        "effective_carbon_intensity",
        "effective_carbon_intensity_limit",
        "effective_carbon_intensity_difference",
    ]:
        setattr(mock_fuel_supply, field, 0.0)

    # Assign the fuel supplies list to the report
    mock_report.fuel_supplies = [mock_fuel_supply]

    # Mock repository to return the reports
    mock_repo.get_changelog_data.return_value = [mock_report]

    # Create a simpler mock for deepcopy that handles our custom objects
    def mock_deepcopy(obj):
        if isinstance(obj, MockFuelSupply):
            new_obj = MockFuelSupply()
            for key, value in obj.__dict__.items():
                if isinstance(value, MockFuelSupply):
                    setattr(new_obj, key, mock_deepcopy(value))
                else:
                    setattr(new_obj, key, value)
            return new_obj
        elif isinstance(obj, (int, float, str, bool)) or obj is None:
            return obj
        elif isinstance(obj, list):
            return [mock_deepcopy(item) for item in obj]
        elif isinstance(obj, dict):
            return {mock_deepcopy(k): mock_deepcopy(v) for k, v in obj.items()}
        else:
            # For other types, try to create a simple copy
            try:
                return type(obj)(obj)
            except:
                return obj  # Fall back to returning the original if copying fails

    # Patch the make_deep_copy function in the module
    with patch("copy.deepcopy", side_effect=mock_deepcopy):
        # Call the service method
        result = await compliance_report_service.get_changelog_data(
            "test-group-uuid", "fuel_supplies"
        )

    # Assertions
    assert len(result) == 2  # Should have 2 DTOs: Current State and Report 1
    assert result[0].nickname == "Current State"
    assert len(result[0].fuel_supplies) == 1
    assert result[0].fuel_supplies[0].fuel_supply_id == 1
    assert result[0].fuel_supplies[0].compliance_units == 101  # Rounded

    assert result[1].nickname == "Report 1"
    assert len(result[1].fuel_supplies) == 1

    # Verify repo was called with correct parameters
    mock_repo.get_changelog_data.assert_called_once()
    args = mock_repo.get_changelog_data.call_args[0]
    assert args[0] == "test-group-uuid"
    assert args[1]["model"] == FuelSupply
    assert args[1]["dto"] == ChangelogFuelSuppliesDTO
    assert args[1]["id_field"] == "fuel_supply_id"


@pytest.mark.anyio
async def test_get_changelog_data_fuel_supplies_update(
    compliance_report_service, mock_repo
):
    """Test changelog data with updates to fuel supplies"""

    # Create a simple data class to use instead of MagicMock
    class MockFuelSupply:
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)

    # Create the first report
    mock_report1 = MagicMock()
    mock_report1.nickname = "Report 1"
    mock_report1.version = 1
    mock_report1.compliance_report_id = 1

    # Create the original fuel supply record
    mock_fuel_supply1_v1 = MockFuelSupply(
        fuel_supply_id=1,
        group_uuid="group-1",
        version=1,
        action_type="CREATE",
        create_date=datetime(2024, 1, 1),
        compliance_units=100,
        quantity=50,
        compliance_report_id=1,
        create_user="test_user",
        update_user="test_user",
        units="litres",
        fuel_type_other="",
        # Required related objects
        fuel_category=MockFuelSupply(category="Gasoline"),
        fuel_code=MockFuelSupply(fuelCode="BCLCF100"),
        fuel_type=MockFuelSupply(fuelType="Ethanol"),
        provision_of_the_act=MockFuelSupply(name="Section 6(1)"),
        end_use_type=MockFuelSupply(type="Transportation"),
    )

    # Add required fields for DTO validation
    for field in [
        "carbon_intensity",
        "carbon_intensity_limit",
        "carbon_intensity_difference",
        "energy_content",
        "energy_effectiveness_ratio",
        "effective_carbon_intensity",
        "effective_carbon_intensity_limit",
        "effective_carbon_intensity_difference",
    ]:
        setattr(mock_fuel_supply1_v1, field, 0.0)

    mock_report1.fuel_supplies = [mock_fuel_supply1_v1]

    # Create the second report with updated fuel supply
    mock_report2 = MagicMock()
    mock_report2.nickname = "Report 2"
    mock_report2.version = 2
    mock_report2.compliance_report_id = 2

    # Create the updated fuel supply record with a different compliance_units value
    mock_fuel_supply1_v2 = MockFuelSupply(
        fuel_supply_id=1,
        group_uuid="group-1",
        version=2,
        action_type="UPDATE",
        create_date=datetime(2024, 1, 2),
        compliance_units=150,  # Changed value
        quantity=50,  # Same as before
        compliance_report_id=2,
        create_user="test_user",
        update_user="test_user",
        units="litres",
        fuel_type_other="",
        # Required related objects
        fuel_category=MockFuelSupply(category="Gasoline"),
        fuel_code=MockFuelSupply(fuelCode="BCLCF100"),
        fuel_type=MockFuelSupply(fuelType="Ethanol"),
        provision_of_the_act=MockFuelSupply(name="Section 6(1)"),
        end_use_type=MockFuelSupply(type="Transportation"),
    )

    # Add required fields for DTO validation
    for field in [
        "carbon_intensity",
        "carbon_intensity_limit",
        "carbon_intensity_difference",
        "energy_content",
        "energy_effectiveness_ratio",
        "effective_carbon_intensity",
        "effective_carbon_intensity_limit",
        "effective_carbon_intensity_difference",
    ]:
        setattr(mock_fuel_supply1_v2, field, 0.0)

    mock_report2.fuel_supplies = [mock_fuel_supply1_v2]

    # Mock repository to return the reports
    mock_repo.get_changelog_data.return_value = [mock_report2, mock_report1]

    # Create a custom deep copy function to handle our mock objects
    def mock_deepcopy(obj):
        if isinstance(obj, MockFuelSupply):
            new_obj = MockFuelSupply()
            for key, value in obj.__dict__.items():
                if isinstance(value, MockFuelSupply):
                    setattr(new_obj, key, mock_deepcopy(value))
                else:
                    setattr(new_obj, key, value)
            return new_obj
        elif isinstance(obj, (int, float, str, bool)) or obj is None:
            return obj
        elif isinstance(obj, list):
            return [mock_deepcopy(item) for item in obj]
        elif isinstance(obj, dict):
            return {mock_deepcopy(k): mock_deepcopy(v) for k, v in obj.items()}
        else:
            try:
                return type(obj)(obj)
            except:
                return obj

    # Patch the deep copy function
    with patch("copy.deepcopy", side_effect=mock_deepcopy):
        # Call the service method
        result = await compliance_report_service.get_changelog_data(
            "test-group-uuid", "fuel_supplies"
        )

    # Assertions
    assert len(result) == 3  # Should have 3 DTOs: Current State, Report 2, Report 1

    # Check current state
    assert result[0].nickname == "Current State"
    assert len(result[0].fuel_supplies) == 1
    assert result[0].fuel_supplies[0].compliance_units == 150

    # Check Report 2 (with update)
    assert result[1].nickname == "Report 2"
    assert len(result[1].fuel_supplies) >= 1  # Should have at least the current version

    # Find items with diff attribute
    diff_items = [fs for fs in result[1].fuel_supplies if hasattr(fs, "diff")]
    assert len(diff_items) > 0

    # Find items marked as updated
    updated_items = [
        fs for fs in result[1].fuel_supplies if hasattr(fs, "updated") and fs.updated
    ]

    # If we found updated items, check the diff contains the changed field
    if updated_items:
        assert any(
            "complianceUnits" in item.diff
            for item in updated_items
            if hasattr(item, "diff")
        )


@pytest.mark.anyio
async def test_create_gov_initiated_supplemental_fail_not_analyst(
    compliance_report_service: ComplianceReportServices,
    mock_user_profile_supplier: MagicMock,  # Assume a fixture for supplier user
    mock_compliance_report_submitted: MagicMock,
    mock_repo: AsyncMock,
):
    """Test failure when user is not an Analyst."""
    # Patch user_has_roles to simulate a non-analyst
    with patch(
        "lcfs.web.api.compliance_report.services.user_has_roles",
        return_value=False,
    ):
        with pytest.raises(ServiceException) as excinfo:
            await compliance_report_service.create_government_initiated_supplemental_report(
                mock_compliance_report_submitted.compliance_report_id,
                mock_user_profile_supplier,
            )

    mock_repo.create_compliance_report.assert_not_called()


@pytest.mark.anyio
async def test_create_gov_initiated_supplemental_fail_not_submitted(
    compliance_report_service: ComplianceReportServices,
    mock_user_profile_analyst: MagicMock,
    mock_compliance_report_draft: MagicMock,  # Assume fixture for draft report
    mock_repo: AsyncMock,
):
    """Test failure when the source report is not Submitted."""
    # Patch user_has_roles to ensure role check passes
    with patch(
        "lcfs.web.api.compliance_report.services.user_has_roles",
        return_value=True,
    ):
        # Arrange
        existing_report_id = mock_compliance_report_draft.compliance_report_id
        mock_repo.get_compliance_report_by_id = AsyncMock(
            return_value=mock_compliance_report_draft  # Use a draft report
        )

        # Act & Assert
        with pytest.raises(ServiceException) as excinfo:  # Check type only first
            # Run inside the patch context
            await compliance_report_service.create_government_initiated_supplemental_report(
                existing_report_id, mock_user_profile_analyst
            )

    mock_repo.create_compliance_report.assert_not_called()


@pytest.mark.anyio
async def test_create_gov_initiated_supplemental_fail_draft_exists(
    compliance_report_service: ComplianceReportServices,
    mock_user_profile_analyst: MagicMock,
    mock_compliance_report_submitted: MagicMock,
    mock_compliance_report_draft: MagicMock,  # Existing draft
    mock_repo: AsyncMock,
):
    """Test failure when a draft report already exists for the group."""
    # Patch user_has_roles to ensure role check passes
    with patch(
        "lcfs.web.api.compliance_report.services.user_has_roles", return_value=True
    ):
        # Arrange
        # Ensure the report status is correctly set for this test
        mock_compliance_report_submitted.current_status.status = (
            ComplianceReportStatusEnum.Submitted
        )
        existing_report_id = mock_compliance_report_submitted.compliance_report_id
        group_uuid = mock_compliance_report_submitted.compliance_report_group_uuid

        mock_repo.get_compliance_report_by_id = AsyncMock(
            return_value=mock_compliance_report_submitted
        )
        mock_repo.get_draft_report_by_group_uuid = AsyncMock(
            return_value=mock_compliance_report_draft  # Simulate existing draft
        )

        # Act & Assert
        with pytest.raises(ServiceException) as excinfo:  # Check type only first
            # Run inside the patch context
            await compliance_report_service.create_government_initiated_supplemental_report(
                existing_report_id, mock_user_profile_analyst
            )

    mock_repo.create_compliance_report.assert_not_called()


@pytest.mark.anyio
async def test_get_changelog_data_fuel_supplies_delete(
    compliance_report_service, mock_repo
):
    """Test changelog data with deleted fuel supplies"""

    # Create a simple class that actually holds attributes instead of using MagicMock
    class SimpleObject:
        pass

    # Create the first report with CREATE action
    mock_report1 = SimpleObject()
    mock_report1.nickname = "Report 1"
    mock_report1.version = 1
    mock_report1.compliance_report_id = 1

    # Create the first fuel supply
    mock_fuel_supply1 = SimpleObject()
    mock_fuel_supply1.fuel_supply_id = 1
    mock_fuel_supply1.group_uuid = "group-1"
    mock_fuel_supply1.version = 1
    mock_fuel_supply1.action_type = "CREATE"
    mock_fuel_supply1.create_date = datetime(2024, 1, 1)
    mock_fuel_supply1.compliance_units = 100
    mock_fuel_supply1.quantity = 50
    mock_fuel_supply1.compliance_report_id = 1
    mock_fuel_supply1.create_user = "test_user"
    mock_fuel_supply1.update_user = "test_user"
    mock_fuel_supply1.units = "litres"
    mock_fuel_supply1.fuel_type_other = ""

    # Add related objects
    mock_fuel_supply1.fuel_category = SimpleObject()
    mock_fuel_supply1.fuel_category.category = "Gasoline"

    mock_fuel_supply1.fuel_code = SimpleObject()
    mock_fuel_supply1.fuel_code.fuelCode = "BCLCF100"

    mock_fuel_supply1.fuel_type = SimpleObject()
    mock_fuel_supply1.fuel_type.fuelType = "Ethanol"

    mock_fuel_supply1.provision_of_the_act = SimpleObject()
    mock_fuel_supply1.provision_of_the_act.name = "Section 6(1)"

    mock_fuel_supply1.end_use_type = SimpleObject()
    mock_fuel_supply1.end_use_type.type = "Transportation"

    # Add required fields for DTO validation
    for field in [
        "carbon_intensity",
        "carbon_intensity_limit",
        "carbon_intensity_difference",
        "energy_content",
        "energy_effectiveness_ratio",
        "effective_carbon_intensity",
        "effective_carbon_intensity_limit",
        "effective_carbon_intensity_difference",
    ]:
        setattr(mock_fuel_supply1, field, 0.0)

    # Assign fuel supplies to report
    mock_report1.fuel_supplies = [mock_fuel_supply1]

    # Create the second report with DELETE action
    mock_report2 = SimpleObject()
    mock_report2.nickname = "Report 2"
    mock_report2.version = 2
    mock_report2.compliance_report_id = 2

    # Create the deleted fuel supply
    mock_fuel_supply2 = SimpleObject()
    mock_fuel_supply2.fuel_supply_id = 1
    mock_fuel_supply2.group_uuid = "group-1"
    mock_fuel_supply2.version = 2
    mock_fuel_supply2.action_type = "DELETE"
    mock_fuel_supply2.create_date = datetime(2024, 1, 2)
    mock_fuel_supply2.compliance_units = 100
    mock_fuel_supply2.quantity = 50
    mock_fuel_supply2.compliance_report_id = 2
    mock_fuel_supply2.create_user = "test_user"
    mock_fuel_supply2.update_user = "test_user"
    mock_fuel_supply2.units = "litres"
    mock_fuel_supply2.fuel_type_other = ""

    # Add related objects
    mock_fuel_supply2.fuel_category = SimpleObject()
    mock_fuel_supply2.fuel_category.category = "Gasoline"

    mock_fuel_supply2.fuel_code = SimpleObject()
    mock_fuel_supply2.fuel_code.fuelCode = "BCLCF100"

    mock_fuel_supply2.fuel_type = SimpleObject()
    mock_fuel_supply2.fuel_type.fuelType = "Ethanol"

    mock_fuel_supply2.provision_of_the_act = SimpleObject()
    mock_fuel_supply2.provision_of_the_act.name = "Section 6(1)"

    mock_fuel_supply2.end_use_type = SimpleObject()
    mock_fuel_supply2.end_use_type.type = "Transportation"

    # Add required fields for DTO validation
    for field in [
        "carbon_intensity",
        "carbon_intensity_limit",
        "carbon_intensity_difference",
        "energy_content",
        "energy_effectiveness_ratio",
        "effective_carbon_intensity",
        "effective_carbon_intensity_limit",
        "effective_carbon_intensity_difference",
    ]:
        setattr(mock_fuel_supply2, field, 0.0)

    # Assign fuel supplies to report
    mock_report2.fuel_supplies = [mock_fuel_supply2]

    # Mock repository to return the reports
    mock_repo.get_changelog_data.return_value = [mock_report2, mock_report1]

    # Call the service method
    result = await compliance_report_service.get_changelog_data(
        "test-group-uuid", "fuel_supplies"
    )

    # Assertions
    assert len(result) == 3  # Should have 3 DTOs: Current State, Report 2, Report 1

    # Current state should be empty since the item was deleted
    assert result[0].nickname == "Current State"
    assert len(result[0].fuel_supplies) == 0

    # Check Report 2 (with delete)
    assert result[1].nickname == "Report 2"
    assert len(result[1].fuel_supplies) == 1
    assert result[1].fuel_supplies[0].action_type == "DELETE"


@pytest.mark.anyio
async def test_get_changelog_data_with_multiple_items(
    compliance_report_service, mock_repo
):
    """Test changelog with multiple fuel supplies"""

    # Create a simple class that actually holds attributes
    class SimpleObject:
        pass

    # Create the mock report
    mock_report = SimpleObject()
    mock_report.nickname = "Report 1"
    mock_report.version = 1
    mock_report.compliance_report_id = 1

    # Helper function to create a fuel supply with all required attributes
    def create_fuel_supply(fuel_id, group_id, create_date, compliance_units):
        fs = SimpleObject()
        fs.fuel_supply_id = fuel_id
        fs.group_uuid = group_id
        fs.version = 1
        fs.action_type = "CREATE"
        fs.create_date = create_date
        fs.compliance_units = compliance_units
        fs.quantity = 50
        fs.compliance_report_id = 1
        fs.create_user = "test_user"
        fs.update_user = "test_user"
        fs.units = "litres"
        fs.fuel_type_other = ""

        # Add related objects
        fs.fuel_category = SimpleObject()
        fs.fuel_category.category = "Gasoline"

        fs.fuel_code = SimpleObject()
        fs.fuel_code.fuelCode = "BCLCF100"

        fs.fuel_type = SimpleObject()
        fs.fuel_type.fuelType = "Ethanol"

        fs.provision_of_the_act = SimpleObject()
        fs.provision_of_the_act.name = "Section 6(1)"

        fs.end_use_type = SimpleObject()
        fs.end_use_type.type = "Transportation"

        # Add required fields for DTO validation
        for field in [
            "carbon_intensity",
            "carbon_intensity_limit",
            "carbon_intensity_difference",
            "energy_content",
            "energy_effectiveness_ratio",
            "effective_carbon_intensity",
            "effective_carbon_intensity_limit",
            "effective_carbon_intensity_difference",
        ]:
            setattr(fs, field, 0.0)

        return fs

    # Create two fuel supply entries
    mock_fuel_supply1 = create_fuel_supply(1, "group-1", datetime(2024, 1, 1), 100)
    mock_fuel_supply2 = create_fuel_supply(2, "group-2", datetime(2024, 1, 2), 200)

    # Assign fuel supplies to report
    mock_report.fuel_supplies = [mock_fuel_supply1, mock_fuel_supply2]

    # Mock repository to return the reports
    mock_repo.get_changelog_data.return_value = [mock_report]

    # Call the service method
    result = await compliance_report_service.get_changelog_data(
        "test-group-uuid", "fuel_supplies"
    )

    # Assertions
    assert len(result) == 2  # Should have 2 DTOs: Current State and Report 1

    # Check current state has both items
    assert result[0].nickname == "Current State"
    assert len(result[0].fuel_supplies) == 2

    # Items should be sorted by create_date
    fuel_supplies = result[0].fuel_supplies
    # Sort by fuel_supply_id to ensure consistent order
    fuel_supplies_sorted = sorted(fuel_supplies, key=lambda x: x.fuel_supply_id)
    assert fuel_supplies_sorted[0].fuel_supply_id == 1
    assert fuel_supplies_sorted[1].fuel_supply_id == 2


@pytest.mark.anyio
async def test_get_changelog_data_other_types(compliance_report_service, mock_repo):
    """Test changelog for other data types (allocation agreements, fuel exports, etc.)"""

    # Create a simple class that actually holds attributes
    class SimpleObject:
        pass

    # Create the mock report
    mock_report = SimpleObject()
    mock_report.nickname = "Report 1"
    mock_report.version = 1
    mock_report.compliance_report_id = 1

    # Create a mock allocation agreement with all required fields
    mock_agreement = SimpleObject()
    mock_agreement.allocation_agreement_id = 1
    mock_agreement.group_uuid = "group-1"
    mock_agreement.version = 1
    mock_agreement.action_type = "CREATE"
    mock_agreement.create_date = datetime(2024, 1, 1)

    # Add the additional required fields based on validation errors
    mock_agreement.create_user = "test_user"
    mock_agreement.update_user = "test_user"
    mock_agreement.compliance_report_id = 1
    mock_agreement.transaction_partner = "Partner Company"
    mock_agreement.postal_address = "123 Test St, Test City"
    mock_agreement.quantity = 100
    mock_agreement.units = "litres"

    # Add related objects
    mock_agreement.allocation_transaction_type = SimpleObject()
    mock_agreement.allocation_transaction_type.type = "Transfer"

    mock_agreement.fuel_category = SimpleObject()
    mock_agreement.fuel_category.category = "Gasoline"

    mock_agreement.fuel_code = SimpleObject()
    mock_agreement.fuel_code.fuelCode = "BCLCF100"

    mock_agreement.fuel_type = SimpleObject()
    mock_agreement.fuel_type.fuelType = "Ethanol"

    mock_agreement.provision_of_the_act = SimpleObject()
    mock_agreement.provision_of_the_act.name = "Section 6(1)"

    # Assign allocation agreements to report
    mock_report.allocation_agreements = [mock_agreement]

    # Mock repository to return the reports
    mock_repo.get_changelog_data.return_value = [mock_report]

    # Call the service method for allocation_agreements
    result = await compliance_report_service.get_changelog_data(
        "test-group-uuid", "allocation_agreements"
    )

    # Assertions
    assert len(result) == 2  # Should have 2 DTOs: Current State and Report 1
    assert result[0].nickname == "Current State"
    assert len(result[0].allocation_agreements) == 1

    # Verify correct DTO type was used
    assert isinstance(result[0], ChangelogAllocationAgreementsDTO)

    # Check repository was called with correct parameters
    mock_repo.get_changelog_data.assert_called_with(
        "test-group-uuid",
        {
            "model": AllocationAgreement,
            "dto": ChangelogAllocationAgreementsDTO,
            "id_field": "allocation_agreement_id",
            "relationships": [
                ("allocation_agreements", "allocation_transaction_type"),
                ("allocation_agreements", "fuel_type"),
                ("allocation_agreements", "fuel_category"),
                ("allocation_agreements", "fuel_code"),
                ("allocation_agreements", "provision_of_the_act"),
            ],
        },
    )


@pytest.mark.anyio
async def test_get_changelog_data_empty_results(compliance_report_service, mock_repo):
    """Test handling of empty changelog data"""

    # Mock repository to return empty list
    mock_repo.get_changelog_data.return_value = []

    # Call the service method
    result = await compliance_report_service.get_changelog_data(
        "test-group-uuid", "fuel_supplies"
    )

    # Assertions
    assert result == []
    mock_repo.get_changelog_data.assert_called_once()


@pytest.mark.anyio
async def test_get_changelog_data_invalid_type(compliance_report_service):
    """Test error handling for invalid data type"""

    # Call the service method with invalid data type
    with pytest.raises(ValueError) as exc:
        await compliance_report_service.get_changelog_data(
            "test-group-uuid", "invalid_type"
        )

    assert "Invalid data_type: invalid_type" in str(exc.value)


@pytest.mark.anyio
async def test_get_changelog_data_unexpected_error(
    compliance_report_service, mock_repo
):
    """Test handling of unexpected errors"""

    # Mock repository to raise exception
    mock_repo.get_changelog_data.side_effect = Exception("Unexpected error")

    # Call the service method
    with pytest.raises(ServiceException):
        await compliance_report_service.get_changelog_data(
            "test-group-uuid", "fuel_supplies"
        )


class TestMaskReportStatusForHistory:
    """
    Tests for the _mask_report_status_for_history method in ComplianceReportServices.
    """

    @pytest.fixture
    def service(self) -> ComplianceReportServices:
        """Provides a simple instance of ComplianceReportServices for testing this method."""
        # The _mask_report_status_for_history method is pure Python logic on its inputs,
        # so it doesn't need real dependencies for these tests.
        return ComplianceReportServices(
            repo=MagicMock(),
            org_repo=MagicMock(),
            snapshot_services=MagicMock(),
            final_supply_equipment_service=MagicMock(),
            document_service=MagicMock(),
            transaction_repo=MagicMock(),
        )

    def _create_mock_history_item(
        self,
        status_enum: ComplianceReportStatusEnum,
        creator_is_idir: bool,
        original_display_name: str = "Test User",
        creator_has_organization_explicitly: bool = None,  # True if creator has org, False if no org, None for default creator_is_idir logic
    ):
        item = MagicMock()
        item.status = MagicMock()
        item.status.status = status_enum.value

        item.user_profile = MagicMock()
        if creator_has_organization_explicitly is None:  # Default behavior
            item.user_profile.organization = None if creator_is_idir else "Supplier Org"
        else:
            item.user_profile.organization = (
                "Supplier Org" if creator_has_organization_explicitly else None
            )

        item.user_profile.display_name = original_display_name
        item.display_name = original_display_name  # This is what gets directly modified
        return item

    def _create_mock_report(self, history_items: list) -> MagicMock:
        report = MagicMock(spec=ComplianceReportBaseSchema)
        report.history = history_items
        return report

    def _configure_user_roles(
        self,
        mock_user_has_roles_patch: MagicMock,
        requesting_user: UserProfile,
        is_government: bool = False,
        is_analyst: bool = False,
    ):
        def side_effect(user_obj, roles_to_check):
            if user_obj == requesting_user:
                if RoleEnum.GOVERNMENT in roles_to_check:
                    return is_government
                if RoleEnum.ANALYST in roles_to_check:
                    return is_analyst
            # Fallback for any other user object or role check not configured for this test
            # This helps avoid TypeErrors if user_has_roles is called unexpectedly.
            # For strict tests, one might raise an error here.
            return False

        mock_user_has_roles_patch.side_effect = side_effect

    # --- Tests for Draft Status ---
    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_draft_by_idir_viewed_by_idir_is_visible(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=True
        )

        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Draft,
            creator_is_idir=True,
            original_display_name="IDIR Creator",
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)

        assert len(result_report.history) == 1
        assert result_report.history[0].display_name == "IDIR Creator"  # No masking

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_draft_by_idir_viewed_by_supplier_is_visible_and_masked(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=False  # Supplier
        )

        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Draft,
            creator_is_idir=True,
            original_display_name="IDIR Creator",
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)

        assert len(result_report.history) == 1
        assert result_report.history[0].display_name == "Government of British Columbia"

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_draft_by_supplier_viewed_by_idir_is_hidden(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=True
        )

        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Draft, creator_is_idir=False
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        assert len(result_report.history) == 0

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_draft_by_supplier_viewed_by_supplier_is_hidden(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=False  # Supplier
        )

        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Draft, creator_is_idir=False
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        assert len(result_report.history) == 0

    # --- Tests for BCeID Hidden Statuses ---
    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_bceid_hidden_status_viewed_by_idir_is_visible(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=True
        )

        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Recommended_by_analyst,
            creator_is_idir=True,
            original_display_name="Analyst",
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)

        assert len(result_report.history) == 1
        assert result_report.history[0].display_name == "Analyst"

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_bceid_hidden_status_viewed_by_supplier_is_hidden(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=False  # Supplier
        )
        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Recommended_by_manager, creator_is_idir=True
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        assert len(result_report.history) == 0

    # --- Tests for Non-Analyst Hidden Statuses ---
    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_non_analyst_hidden_status_viewed_by_analyst_is_visible(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=True, is_analyst=True
        )
        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Analyst_adjustment,
            creator_is_idir=True,
            original_display_name="Analyst",
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        assert len(result_report.history) == 1
        assert result_report.history[0].display_name == "Analyst"

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_non_analyst_hidden_status_viewed_by_idir_director_is_hidden(
        self, mock_user_has_roles, service
    ):  # Director is IDIR but not Analyst
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=True, is_analyst=False
        )
        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Analyst_adjustment, creator_is_idir=True
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        assert len(result_report.history) == 0

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_non_analyst_hidden_status_viewed_by_supplier_is_hidden(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles,
            requesting_user,
            is_government=False,
            is_analyst=False,  # Supplier
        )
        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Analyst_adjustment, creator_is_idir=True
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        assert len(result_report.history) == 0  # Hidden due to non-analyst rule

    # --- Tests for Standard Visible Statuses & Masking ---
    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_assessed_by_idir_viewed_by_idir_visible_not_masked(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=True
        )
        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Assessed,
            creator_is_idir=True,
            original_display_name="Gov Assessor",
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        assert len(result_report.history) == 1
        assert result_report.history[0].display_name == "Gov Assessor"

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_assessed_by_idir_viewed_by_supplier_visible_and_masked(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=False  # Supplier
        )
        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Assessed,
            creator_is_idir=True,
            original_display_name="Gov Assessor",
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        assert len(result_report.history) == 1
        assert result_report.history[0].display_name == "Government of British Columbia"

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_submitted_by_supplier_viewed_by_idir_visible_not_masked(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=True
        )
        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Submitted,
            creator_is_idir=False,
            original_display_name="Supplier User",
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        assert len(result_report.history) == 1
        assert result_report.history[0].display_name == "Supplier User"

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_submitted_by_supplier_viewed_by_supplier_visible_not_masked(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=False  # Supplier
        )
        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Submitted,
            creator_is_idir=False,
            original_display_name="Supplier User",
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        assert len(result_report.history) == 1
        assert result_report.history[0].display_name == "Supplier User"

    # --- Test for Masking Fallback Logic ---
    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_masking_fallback_idir_status_creator_with_org_viewed_by_supplier(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=False
        )  # Supplier viewer

        # Creator has an org (so primary is_idir check is false), but status is a gov status
        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Assessed,
            creator_is_idir=False,  # This will set org to "Supplier Org"
            original_display_name="User With Org Performing Gov Action",
            creator_has_organization_explicitly=True,  # Explicitly give them an org
        )
        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)

        assert len(result_report.history) == 1
        assert result_report.history[0].display_name == "Government of British Columbia"

    # --- Edge Cases ---
    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_empty_history(self, mock_user_has_roles, service):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=True
        )
        report = self._create_mock_report([])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        assert len(result_report.history) == 0

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_history_item_no_user_profile_draft_is_hidden(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=True
        )

        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Draft, creator_is_idir=False
        )
        history_item.user_profile = None  # No user profile

        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)
        # history_creator_is_idir will be false, so draft by non-idir is hidden
        assert len(result_report.history) == 0

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_history_item_no_user_profile_assessed_is_visible_no_masking(
        self, mock_user_has_roles, service
    ):
        requesting_user = MagicMock(spec=UserProfile)  # Supplier viewer
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=False
        )

        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Assessed,
            creator_is_idir=False,
            original_display_name="Unknown User",
        )
        history_item.user_profile = None  # No user profile

        report = self._create_mock_report([history_item])
        result_report = service._mask_report_status_for_history(report, requesting_user)

        assert len(result_report.history) == 1
        assert (
            result_report.history[0].display_name == "Unknown User"
        )  # No masking possible

    @patch("lcfs.web.api.compliance_report.services.user_has_roles")
    def test_multiple_history_items_mixed_scenarios(self, mock_user_has_roles, service):
        requesting_user = MagicMock(spec=UserProfile)  # Supplier viewer
        self._configure_user_roles(
            mock_user_has_roles, requesting_user, is_government=False, is_analyst=False
        )

        item1_draft_by_idir = self._create_mock_history_item(
            ComplianceReportStatusEnum.Draft,
            creator_is_idir=True,
            original_display_name="Gov Draft",
        )  # Visible, Masked
        item2_draft_by_supplier = self._create_mock_history_item(
            ComplianceReportStatusEnum.Draft, creator_is_idir=False
        )  # Hidden
        item3_recommended_by_analyst = self._create_mock_history_item(
            ComplianceReportStatusEnum.Recommended_by_analyst, creator_is_idir=True
        )  # Hidden for supplier
        item4_submitted_by_supplier = self._create_mock_history_item(
            ComplianceReportStatusEnum.Submitted,
            creator_is_idir=False,
            original_display_name="Supplier Submit",
        )  # Visible, Not Masked
        item5_assessed_by_idir = self._create_mock_history_item(
            ComplianceReportStatusEnum.Assessed,
            creator_is_idir=True,
            original_display_name="Gov Assess",
        )  # Visible, Masked

        history_items = [
            item1_draft_by_idir,
            item2_draft_by_supplier,
            item3_recommended_by_analyst,
            item4_submitted_by_supplier,
            item5_assessed_by_idir,
        ]
        report = self._create_mock_report(history_items)
        result_report = service._mask_report_status_for_history(report, requesting_user)

        assert len(result_report.history) == 3

        # Check item1 (Gov Draft, viewed by supplier)
        assert (
            result_report.history[0].status.status
            == ComplianceReportStatusEnum.Draft.value
        )
        assert result_report.history[0].display_name == "Government of British Columbia"

        # Check item4 (Supplier Submit, viewed by supplier)
        assert (
            result_report.history[1].status.status
            == ComplianceReportStatusEnum.Submitted.value
        )
        assert result_report.history[1].display_name == "Supplier Submit"

        # Check item5 (Gov Assess, viewed by supplier)
        assert (
            result_report.history[2].status.status
            == ComplianceReportStatusEnum.Assessed.value
        )
        assert result_report.history[2].display_name == "Government of British Columbia"


class TestIsSupplementalRequestedByGovUser:
    """Test cases for the is_supplemental_requested_by_gov_user method"""

    @pytest.fixture
    def service(self) -> ComplianceReportServices:
        """Provides a simple instance of ComplianceReportServices for testing this method."""
        return ComplianceReportServices(
            repo=MagicMock(),
            org_repo=MagicMock(),
            snapshot_services=MagicMock(),
            final_supply_equipment_service=MagicMock(),
            document_service=MagicMock(),
            transaction_repo=MagicMock(),
            internal_comment_service=MagicMock(),
        )

    def _create_mock_history_item(
        self,
        status: ComplianceReportStatusEnum,
        user_has_organization: bool = True,
        organization_value=None,
    ):
        """Helper to create a mock history item"""
        history_item = MagicMock()
        history_item.status = MagicMock()
        history_item.status.status = status.value

        history_item.user_profile = MagicMock()
        if organization_value is not None:
            history_item.user_profile.organization = organization_value
        elif not user_has_organization:
            history_item.user_profile.organization = None
        else:
            history_item.user_profile.organization = "Some Organization"

        return history_item

    def _create_mock_chained_report(self, history_items: list = None):
        """Helper to create a mock chained report"""
        chained_report = MagicMock()
        chained_report.history = history_items or []
        return chained_report

    def test_returns_true_when_draft_status_created_by_gov_user(self, service):
        """Test returns True when history contains Draft status created by government user (no organization)"""
        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Draft,
            user_has_organization=False,  # Government user has no organization
        )

        chained_report = self._create_mock_chained_report([history_item])

        result = service.is_supplemental_requested_by_gov_user(chained_report)

        assert result is True

    def test_returns_false_when_draft_status_created_by_supplier_user(self, service):
        """Test returns False when history contains Draft status created by supplier user (has organization)"""
        history_item = self._create_mock_history_item(
            ComplianceReportStatusEnum.Draft,
            user_has_organization=True,  # Supplier user has organization
        )

        chained_report = self._create_mock_chained_report([history_item])

        result = service.is_supplemental_requested_by_gov_user(chained_report)

        assert result is False

    def test_returns_false_when_no_draft_status_in_history(self, service):
        """Test returns False when history contains no Draft status items"""
        history_items = [
            self._create_mock_history_item(
                ComplianceReportStatusEnum.Submitted, user_has_organization=False
            ),
            self._create_mock_history_item(
                ComplianceReportStatusEnum.Assessed, user_has_organization=False
            ),
        ]

        chained_report = self._create_mock_chained_report(history_items)

        result = service.is_supplemental_requested_by_gov_user(chained_report)

        assert result is False

    def test_returns_false_when_history_is_empty(self, service):
        """Test returns False when history is empty"""
        chained_report = self._create_mock_chained_report([])

        result = service.is_supplemental_requested_by_gov_user(chained_report)

        assert result is False
