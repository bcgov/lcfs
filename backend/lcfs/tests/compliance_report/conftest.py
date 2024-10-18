import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.compliance_report.update_service import (
    ComplianceReportUpdateService,
)

from lcfs.web.api.compliance_report.schema import (
    ComplianceReportBaseSchema,
    CompliancePeriodSchema,
    ComplianceReportOrganizationSchema,
    SummarySchema,
    ComplianceReportStatusSchema,
    ComplianceReportHistorySchema,
    ComplianceReportUserSchema,
    ComplianceReportSummarySchema,
    ComplianceReportSummaryRowSchema,
    ComplianceReportListSchema,
    ComplianceReportCreateSchema,
)
from lcfs.web.api.notional_transfer.services import NotionalTransferServices
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_export.repo import FuelExportRepository


@pytest.fixture
def compliance_period_schema():
    return CompliancePeriodSchema(
        compliance_period_id=1,
        description="2024",
        effective_date=datetime(2024, 1, 1),
        expiration_date=datetime(2024, 3, 31),
        display_order=1,
    )


@pytest.fixture
def compliance_report_organization_schema():
    return ComplianceReportOrganizationSchema(
        organization_id=1, name="Acme Corporation"
    )


@pytest.fixture
def compliance_report_status_schema():
    return ComplianceReportStatusSchema(compliance_report_status_id=1, status="Draft")


@pytest.fixture
def summary_schema():
    return SummarySchema(summary_id=1, is_locked=False)


@pytest.fixture
def compliance_report_user_schema(compliance_report_organization_schema):
    return ComplianceReportUserSchema(
        first_name="John",
        last_name="Doe",
        organization=compliance_report_organization_schema,
    )


@pytest.fixture
def compliance_report_history_schema(
    compliance_report_status_schema, compliance_report_user_schema
):
    return ComplianceReportHistorySchema(
        compliance_report_history_id=1,
        compliance_report_id=1,
        status=compliance_report_status_schema,
        user_profile=compliance_report_user_schema,
        create_date=datetime(2024, 4, 1, 12, 0, 0),
    )


@pytest.fixture
def compliance_report_base_schema(
    compliance_period_schema,
    compliance_report_organization_schema,
    summary_schema,
    compliance_report_status_schema,
    compliance_report_history_schema,
):
    def _create_compliance_report_base_schema(
        compliance_report_id: int = 1,
        compliance_period_id: int = None,
        compliance_period: CompliancePeriodSchema = None,
        organization_id: int = None,
        organization: ComplianceReportOrganizationSchema = None,
        summary: SummarySchema = None,
        current_status_id: int = None,
        current_status: ComplianceReportStatusSchema = None,
        transaction_id: int = None,
        nickname: str = "Annual Compliance",
        supplemental_note: str = "Initial submission.",
        update_date: datetime = datetime(2024, 4, 1, 12, 0, 0),
        history: list = None,
    ):
        # Assign default values from dependent fixtures if not overridden
        compliance_period_id = (
            compliance_period_id or compliance_period_schema.compliance_period_id
        )
        compliance_period = compliance_period or compliance_period_schema
        organization_id = (
            organization_id or compliance_report_organization_schema.organization_id
        )
        organization = organization or compliance_report_organization_schema
        summary = summary or summary_schema
        current_status_id = (
            current_status_id
            or compliance_report_status_schema.compliance_report_status_id
        )
        current_status = current_status or compliance_report_status_schema
        history = history or [compliance_report_history_schema]

        return ComplianceReportBaseSchema(
            compliance_report_id=compliance_report_id,
            compliance_period_id=compliance_period_id,
            compliance_period=compliance_period,
            organization_id=organization_id,
            organization=organization,
            summary=summary,
            current_status_id=current_status_id,
            current_status=current_status,
            transaction_id=transaction_id,
            nickname=nickname,
            supplemental_note=supplemental_note,
            update_date=update_date,
            history=history,
        )

    return _create_compliance_report_base_schema


@pytest.fixture
def compliance_report_summary_row_schema():
    def _create_compliance_report_summary_row(
        line="",
        description="",
        field="",
        gasoline=0,
        diesel=0,
        jet_fuel=0,
        value=0,
        total_value=0,
        format="",
    ):
        return ComplianceReportSummaryRowSchema(
            line=line,
            description=description,
            field=field,
            gasoline=gasoline,
            diesel=diesel,
            jet_fuel=jet_fuel,
            value=value,
            total_value=total_value,
            format=format,
        )

    return _create_compliance_report_summary_row


@pytest.fixture
def compliance_report_summary_schema(
    summary_schema, compliance_report_base_schema, compliance_report_summary_row_schema
):
    mock_renewable_fuel_target_summary = [compliance_report_summary_row_schema()]
    mock_low_carbon_fuel_target_summary = [compliance_report_summary_row_schema()]
    mock_non_compliance_penalty_summary = [compliance_report_summary_row_schema()]

    def _create_compliance_report_summary(
        renewable_fuel_target_summary=mock_renewable_fuel_target_summary,
        low_carbon_fuel_target_summary=mock_low_carbon_fuel_target_summary,
        non_compliance_penalty_summary=mock_non_compliance_penalty_summary,
        summary_id=summary_schema.summary_id,
        compliance_report_id=compliance_report_base_schema().compliance_report_id,
        supplemental_report_id=None,
        version=1,
        is_locked=False,
        quarter=None,
    ):

        return ComplianceReportSummarySchema(
            renewable_fuel_target_summary=renewable_fuel_target_summary,
            low_carbon_fuel_target_summary=low_carbon_fuel_target_summary,
            non_compliance_penalty_summary=non_compliance_penalty_summary,
            summary_id=summary_id,
            compliance_report_id=compliance_report_id,
            supplemental_report_id=supplemental_report_id,
            version=version,
            is_locked=is_locked,
            quarter=quarter,
        )

    return _create_compliance_report_summary


@pytest.fixture
def compliance_report_list_schema(compliance_report_base_schema):
    return ComplianceReportListSchema(
        pagination=PaginationResponseSchema(total=100, page=1, size=10, total_pages=10),
        reports=[
            compliance_report_base_schema(),
            # Add more ComplianceReportBaseSchema instances if needed
        ],
    )


@pytest.fixture
def compliance_report_create_schema():
    return ComplianceReportCreateSchema(
        compliance_period="2024", organization_id=1, status="Draft"
    )


@pytest.fixture
def mock_repo():
    repo = AsyncMock(spec=ComplianceReportRepository)
    return repo


@pytest.fixture
def mock_trxn_repo():
    trxn_repo = AsyncMock(spec=TransactionRepository)
    return trxn_repo


@pytest.fixture
def mock_fuel_supply_repo():
    return AsyncMock(spec=FuelSupplyRepository)


@pytest.fixture
def mock_fuel_export_repo():
    return AsyncMock(spec=FuelExportRepository)


@pytest.fixture
def compliance_report_summary_service(
    mock_repo,
    mock_trxn_repo,
    mock_notional_transfer_service,
    mock_fuel_supply_repo,
    mock_fuel_export_repo,
):
    service = ComplianceReportSummaryService()
    service.repo = mock_repo
    service.trxn_repo = mock_trxn_repo
    service.notional_transfer_service = mock_notional_transfer_service
    service.fuel_supply_repo = mock_fuel_supply_repo
    service.fuel_export_repo = mock_fuel_export_repo
    return service


@pytest.fixture
def compliance_report_update_service(
    mock_repo, compliance_report_summary_service, mock_user_profile
):
    service = ComplianceReportUpdateService()
    service.repo = mock_repo
    service.summary_service = compliance_report_summary_service
    service.request = MagicMock()
    service.request.user = mock_user_profile
    return service


@pytest.fixture
def compliance_report_service(mock_user_profile, mock_repo):
    service = ComplianceReportServices()
    service.repo = mock_repo
    service.request = MagicMock()
    service.request.user = mock_user_profile
    return service


@pytest.fixture
def mock_notional_transfer_service():
    return AsyncMock(spec=NotionalTransferServices)


@pytest.fixture
def compliance_report_repo(dbsession):
    repo = ComplianceReportRepository()
    repo.db = dbsession
    return repo
