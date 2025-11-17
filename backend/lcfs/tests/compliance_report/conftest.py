import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from lcfs.db.models import Organization, CompliancePeriod, ComplianceReport
from lcfs.db.models.compliance.ComplianceReport import ReportingFrequency
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.compliance_report.constants import FORMATS
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportSummarySchema,
    ComplianceReportSummaryRowSchema,
    ComplianceReportListSchema,
    ComplianceReportCreateSchema,
)
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.summary_repo import (
    ComplianceReportSummaryRepository,
)
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
    ComplianceDataService,
)
from lcfs.web.api.compliance_report.update_service import (
    ComplianceReportUpdateService,
)
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.notional_transfer.services import NotionalTransferServices
from lcfs.web.api.organization_snapshot.services import OrganizationSnapshotService
from lcfs.web.api.final_supply_equipment.services import FinalSupplyEquipmentServices
from lcfs.web.api.organizations.repo import OrganizationsRepository
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.services.s3.client import DocumentService
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum


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
    # Add default mock for get_assessed_compliance_report_by_period
    repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def mock_org_repo():
    repo = AsyncMock(spec=OrganizationsRepository)
    return repo


@pytest.fixture
def mock_snapshot_service():
    return AsyncMock(spec=OrganizationSnapshotService)


@pytest.fixture
def mock_trxn_repo():
    repo = AsyncMock(spec=TransactionRepository)
    repo.calculate_available_balance_for_period = AsyncMock(return_value=2000)
    repo.delete_transaction = AsyncMock()
    return repo


@pytest.fixture
def mock_fuel_supply_repo():
    repo = AsyncMock(spec=FuelSupplyRepository)
    repo.get_effective_fuel_supplies = AsyncMock(return_value=[])
    return repo


@pytest.fixture
def mock_fuel_export_repo():
    return AsyncMock(spec=FuelExportRepository)


@pytest.fixture
def mock_fse_services():
    service = AsyncMock(spec=FinalSupplyEquipmentServices)
    service.copy_fse_to_new_report = AsyncMock()
    return service


@pytest.fixture
def mock_document_service():
    return AsyncMock(spec=DocumentService)


@pytest.fixture
def mock_other_uses_repo():
    mock_repo = MagicMock()
    mock_repo.get_effective_other_uses = AsyncMock(return_value=MagicMock())
    return mock_repo


@pytest.fixture
def mock_summary_repo():
    repo = AsyncMock(spec=ComplianceReportSummaryRepository)
    # Add default mock for get_assessed_compliance_report_by_period
    repo.get_assessed_compliance_report_by_period = AsyncMock(return_value=None)
    return repo


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
    mock_summary_repo,
    mock_trxn_repo,
    mock_notional_transfer_service,
    mock_fuel_supply_repo,
    mock_fuel_export_repo,
    mock_other_uses_repo,
    mock_compliance_data_service,
):
    service = ComplianceReportSummaryService()
    service.repo = mock_summary_repo
    service.cr_repo = mock_repo
    service.trxn_repo = mock_trxn_repo
    service.notional_transfer_service = mock_notional_transfer_service
    service.fuel_supply_repo = mock_fuel_supply_repo
    service.fuel_export_repo = mock_fuel_export_repo
    service.other_uses_repo = mock_other_uses_repo
    service.compliance_data_service = mock_compliance_data_service
    return service


@pytest.fixture
def mock_summary_service(
    mock_repo,
    mock_summary_repo,
    mock_trxn_repo,
    mock_notional_transfer_service,
    mock_fuel_supply_repo,
    mock_fuel_export_repo,
    mock_other_uses_repo,
    mock_compliance_data_service,
):
    mock_service = AsyncMock(spec=ComplianceReportSummaryService)
    return mock_service


@pytest.fixture
def mock_trx_service(mock_trxn_repo):
    """Mock TransactionsService with repo attribute."""
    service = AsyncMock()
    service.repo = mock_trxn_repo
    return service


@pytest.fixture
def mock_notfn_service():
    """Mock NotificationService."""
    service = AsyncMock()
    service.send_notification = AsyncMock()
    return service


@pytest.fixture
def compliance_report_update_service(
    mock_repo,
    mock_org_service,
    mock_summary_service,
    mock_summary_repo,
    mock_user_profile,
    mock_trx_service,
    mock_notfn_service,
):
    service = ComplianceReportUpdateService()
    service.repo = mock_repo
    service.summary_repo = mock_summary_repo
    service.summary_service = mock_summary_service
    service.request = MagicMock()
    service.request.user = mock_user_profile
    service.org_service = mock_org_service
    service.trx_service = mock_trx_service
    service.notfn_service = mock_notfn_service
    service._charging_equipment_repo = AsyncMock()
    service._charging_equipment_repo.auto_submit_draft_updated_fse_for_report = (
        AsyncMock(return_value=0)
    )
    return service


@pytest.fixture
def mock_org_service():
    mock_org_service = MagicMock()
    mock_org_service.adjust_balance = AsyncMock()  # Mock the adjust_balance method
    mock_org_service.calculate_available_balance = AsyncMock(return_value=1000)
    return mock_org_service


@pytest.fixture
def mock_internal_comment_service():
    service = MagicMock()
    service.copy_internal_comments = AsyncMock()
    return service


@pytest.fixture
def compliance_report_service(
    mock_user_profile,
    mock_repo,
    mock_org_repo,
    mock_snapshot_service,
    mock_fse_services,
    mock_document_service,
    mock_internal_comment_service,
    mock_trxn_repo,
):
    service = ComplianceReportServices(
        repo=mock_repo,
        org_repo=mock_org_repo,
        snapshot_services=mock_snapshot_service,
        fse_service=mock_fse_services,
        document_service=mock_document_service,
        transaction_repo=mock_trxn_repo,
        internal_comment_service=mock_internal_comment_service,
    )
    service.request = MagicMock()
    service.request.user = mock_user_profile
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


@pytest.fixture
def summary_repo(dbsession):
    # Create a mock for fuel_supply_repo
    fuel_supply_repo_mock = MagicMock()
    fuel_supply_repo_mock.get_effective_fuel_supplies = AsyncMock()

    # Create an instance of ComplianceReportRepository with the mock
    repo = ComplianceReportSummaryRepository(
        db=dbsession, fuel_supply_repo=fuel_supply_repo_mock
    )

    return repo


@pytest.fixture
async def organizations(dbsession):
    orgs = [
        Organization(
            organization_id=998,
            organization_code="o998",
            total_balance=0,
            reserved_balance=0,
            count_transfers_in_progress=0,
            name="org998",
        ),
        Organization(
            organization_id=999,
            organization_code="o999",
            total_balance=0,
            reserved_balance=0,
            count_transfers_in_progress=0,
            name="org999",
        ),
    ]
    dbsession.add_all(orgs)
    await dbsession.commit()
    for org in orgs:
        await dbsession.refresh(org)
    return orgs


@pytest.fixture
async def compliance_periods(dbsession):
    periods = [
        CompliancePeriod(compliance_period_id=998, description="998"),
        CompliancePeriod(compliance_period_id=999, description="999"),
    ]
    dbsession.add_all(periods)
    await dbsession.commit()
    for period in periods:
        await dbsession.refresh(period)
    return periods


@pytest.fixture
async def compliance_reports(
    dbsession, organizations, compliance_periods, compliance_report_statuses
):
    reports = [
        ComplianceReport(
            compliance_report_id=994,
            compliance_period_id=compliance_periods[0].compliance_period_id,
            organization_id=organizations[0].organization_id,
            nickname="test",
            reporting_frequency=ReportingFrequency.ANNUAL,
            current_status_id=compliance_report_statuses[0].compliance_report_status_id,
            compliance_report_group_uuid=str(uuid.uuid4()),
            version=1,
        ),
        ComplianceReport(
            compliance_report_id=995,
            compliance_period_id=compliance_periods[1].compliance_period_id,
            organization_id=organizations[1].organization_id,
            nickname="test",
            reporting_frequency=ReportingFrequency.ANNUAL,
            current_status_id=compliance_report_statuses[1].compliance_report_status_id,
            compliance_report_group_uuid=str(uuid.uuid4()),
            version=1,
        ),
    ]
    dbsession.add_all(reports)
    await dbsession.commit()
    for report in reports:
        await dbsession.refresh(report)
    return reports


# === Role Specific User Profiles ===
@pytest.fixture
def mock_user_profile_analyst(mock_user_profile):
    mock_user_profile.roles = [
        MagicMock(name=RoleEnum.GOVERNMENT),
        MagicMock(name=RoleEnum.ANALYST),
    ]
    return mock_user_profile


@pytest.fixture
def mock_user_profile_supplier(mock_user_profile):
    mock_user_profile.roles = [MagicMock(name=RoleEnum.SUPPLIER)]
    mock_user_profile.organization_id = 998
    return mock_user_profile


@pytest.fixture
def mock_user_profile_manager(mock_user_profile):
    mock_user_profile.roles = [
        MagicMock(name=RoleEnum.GOVERNMENT),
        MagicMock(name=RoleEnum.COMPLIANCE_MANAGER),
    ]
    return mock_user_profile


@pytest.fixture
def mock_user_profile_director(mock_user_profile):
    mock_user_profile.roles = [
        MagicMock(name=RoleEnum.GOVERNMENT),
        MagicMock(name=RoleEnum.DIRECTOR),
    ]
    return mock_user_profile


# === Compliance Reports with Specific Statuses ===
@pytest.fixture
def mock_compliance_report_draft(compliance_report_base_schema):
    report = compliance_report_base_schema()
    report.current_status.status = ComplianceReportStatusEnum.Draft
    report.compliance_report_id = 101
    report.version = 1
    return report


@pytest.fixture
def mock_compliance_report_submitted(compliance_report_base_schema):
    report = compliance_report_base_schema()
    report.current_status.status = ComplianceReportStatusEnum.Submitted
    report.compliance_report_id = 102
    report.version = 0
    return report


@pytest.fixture
def mock_compliance_report_recommended_analyst(compliance_report_base_schema):
    report = compliance_report_base_schema()
    report.current_status.status = ComplianceReportStatusEnum.Recommended_by_analyst
    report.compliance_report_id = 103
    report.version = 0
    return report


@pytest.fixture
def mock_compliance_report_recommended_manager(compliance_report_base_schema):
    report = compliance_report_base_schema()
    report.current_status.status = ComplianceReportStatusEnum.Recommended_by_manager
    report.compliance_report_id = 104
    report.version = 0
    return report


@pytest.fixture
def mock_compliance_report_assessed(compliance_report_base_schema):
    report = compliance_report_base_schema()
    report.current_status.status = ComplianceReportStatusEnum.Assessed
    report.compliance_report_id = 105
    report.version = 0
    return report


# === Role Specific Async Clients ===
@pytest.fixture
async def async_client_analyst(client, fastapi_app, set_mock_user):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
    return client


@pytest.fixture
async def async_client_supplier(client, fastapi_app, set_mock_user):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])
    return client
