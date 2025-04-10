import uuid
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

from lcfs.web.api.compliance_report.constants import FORMATS
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
    ComplianceDataService,
)
from lcfs.web.api.compliance_report.update_service import (
    ComplianceReportUpdateService,
)
from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportBaseSchema,
    ComplianceReportOrganizationSchema,
    ComplianceReportViewSchema,
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
from lcfs.web.api.organization_snapshot.services import OrganizationSnapshotService
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_export.repo import FuelExportRepository


@pytest.fixture
def compliance_period_schema():
    return CompliancePeriodBaseSchema(
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
    return SummarySchema(
        summary_id=1,
        is_locked=False,
        line_21_non_compliance_penalty_payable=0.0,
        line_11_fossil_derived_base_fuel_total=0.0,
    )


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
def compliance_report_schema(
    compliance_period_schema,
    compliance_report_organization_schema,
    compliance_report_status_schema,
):
    def _create_compliance_report_schema(
        compliance_report_id: int = 1,
        compliance_report_group_uuid: str = None,
        version: int = 0,
        compliance_period_id: int = None,
        compliance_period: CompliancePeriodBaseSchema = None,
        organization_id: int = None,
        organization: ComplianceReportOrganizationSchema = None,
        report_type: str = "Annual Compliance",
        report_status_id: int = None,
        report_status: str = "Submitted",
        update_date: datetime = datetime(2024, 4, 1, 12, 0, 0),
    ):
        compliance_period_id = (
            compliance_period_id or compliance_period_schema.compliance_period_id
        )
        compliance_period = compliance_period or compliance_period_schema
        if isinstance(compliance_period, CompliancePeriodBaseSchema):
            compliance_period = compliance_period.description
        organization_id = (
            organization_id or compliance_report_organization_schema.organization_id
        )
        organization = organization or compliance_report_organization_schema
        organization_name = organization.name if organization else "Default Org"
        compliance_report_group_uuid = compliance_report_group_uuid or str(uuid.uuid4())
        report_status_id = (
            report_status_id
            or compliance_report_status_schema.compliance_report_status_id
        )
        report_status = report_status or compliance_report_status_schema.status

        return ComplianceReportViewSchema(
            compliance_report_id=compliance_report_id,
            compliance_report_group_uuid=compliance_report_group_uuid,
            version=version,
            compliance_period_id=compliance_period_id,
            compliance_period=compliance_period,
            organization_id=organization_id,
            organization_name=organization_name,
            report_type=report_type,
            report_status_id=report_status_id,
            report_status=report_status,
            update_date=update_date,
        )

    return _create_compliance_report_schema


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
        compliance_period: CompliancePeriodBaseSchema = None,
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
        compliance_report_group_uuid: str = None,
        version: int = 0,
        supplemental_initiator: str = None,
        has_supplemental: bool = False,
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
        compliance_report_group_uuid = compliance_report_group_uuid or str(uuid.uuid4())
        supplemental_initiator = supplemental_initiator

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
            compliance_report_group_uuid=compliance_report_group_uuid,
            version=version,
            supplemental_initiator=supplemental_initiator,
            has_supplemental=has_supplemental,
        )

    return _create_compliance_report_base_schema


@pytest.fixture
def compliance_report_summary_row_schema():
    def _create_compliance_report_summary_row(
        line=None,
        description="",
        field="",
        gasoline=0,
        diesel=0,
        jet_fuel=0,
        value=0,
        total_value=0,
        format=FORMATS.NUMBER.value,
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
        version=1,
        is_locked=False,
        quarter=None,
        can_sign=False,
    ):

        return ComplianceReportSummarySchema(
            renewable_fuel_target_summary=renewable_fuel_target_summary,
            low_carbon_fuel_target_summary=low_carbon_fuel_target_summary,
            non_compliance_penalty_summary=non_compliance_penalty_summary,
            summary_id=summary_id,
            compliance_report_id=compliance_report_id,
            version=version,
            is_locked=is_locked,
            quarter=quarter,
            can_sign=can_sign,
        )

    return _create_compliance_report_summary


@pytest.fixture
def compliance_report_list_schema(compliance_report_schema):
    return ComplianceReportListSchema(
        pagination=PaginationResponseSchema(total=100, page=1, size=10, total_pages=10),
        reports=[
            compliance_report_schema(),
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
def mock_snapshot_service():
    service = AsyncMock(spec=OrganizationSnapshotService)
    return service


@pytest.fixture
def mock_trxn_repo():
    trxn_repo = AsyncMock(spec=TransactionRepository)
    return trxn_repo


@pytest.fixture
def mock_fuel_supply_repo():
    mock_repo = AsyncMock(spec=FuelSupplyRepository)
    mock_repo.get_effective_fuel_supplies = AsyncMock(return_value=[])
    return mock_repo


@pytest.fixture
def mock_fuel_export_repo():
    return AsyncMock(spec=FuelExportRepository)


@pytest.fixture
def mock_other_uses_repo():
    mock_repo = MagicMock()
    mock_repo.get_effective_other_uses = AsyncMock(return_value=MagicMock())
    return mock_repo


@pytest.fixture
def mock_compliance_data_service():
    """Mock the ComplianceDataService."""
    mock_service = MagicMock(spec=ComplianceDataService)
    mock_service.get_period.return_value = 2024
    mock_service.get_nickname.return_value = "Test Report"
    mock_service.is_legacy_year.return_value = False
    return mock_service


@pytest.fixture
def compliance_report_summary_service(
    mock_repo,
    mock_trxn_repo,
    mock_notional_transfer_service,
    mock_fuel_supply_repo,
    mock_fuel_export_repo,
    mock_other_uses_repo,
    mock_compliance_data_service,
):
    service = ComplianceReportSummaryService()
    service.repo = mock_repo
    service.trxn_repo = mock_trxn_repo
    service.notional_transfer_service = mock_notional_transfer_service
    service.fuel_supply_repo = mock_fuel_supply_repo
    service.fuel_export_repo = mock_fuel_export_repo
    service.other_uses_repo = mock_other_uses_repo
    service.compliance_data_service = mock_compliance_data_service
    return service


@pytest.fixture
def compliance_report_update_service(
    mock_repo, mock_org_service, compliance_report_summary_service, mock_user_profile
):
    service = ComplianceReportUpdateService()
    service.repo = mock_repo
    service.summary_service = compliance_report_summary_service
    service.request = MagicMock()
    service.request.user = mock_user_profile
    service.org_service = mock_org_service
    return service


@pytest.fixture
def compliance_report_service(
    mock_user_profile,
    mock_repo,
    mock_snapshot_service,
):
    service = ComplianceReportServices()
    service.repo = mock_repo
    service.request = MagicMock()
    service.request.user = mock_user_profile
    service.snapshot_services = mock_snapshot_service
    return service


@pytest.fixture
def mock_notional_transfer_service():
    return AsyncMock(spec=NotionalTransferServices)


@pytest.fixture
def compliance_report_repo(dbsession):
    # Create a mock for fuel_supply_repo
    fuel_supply_repo_mock = MagicMock()
    fuel_supply_repo_mock.get_effective_fuel_supplies = AsyncMock()

    # Create an instance of ComplianceReportRepository with the mock
    repo = ComplianceReportRepository(
        db=dbsession, fuel_supply_repo=fuel_supply_repo_mock
    )

    return repo
