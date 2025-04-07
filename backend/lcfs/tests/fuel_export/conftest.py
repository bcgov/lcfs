import pytest
from datetime import datetime
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock

from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportHistorySchema,
    ComplianceReportOrganizationSchema,
    ComplianceReportStatusSchema,
    ComplianceReportUserSchema,
    SummarySchema,
)
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_export.actions_service import FuelExportActionService
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_export.services import FuelExportServices


@pytest.fixture(scope="function", autouse=True)
async def init_cache():
    """Initialize the cache for testing."""
    FastAPICache.init(InMemoryBackend(), prefix="test-cache")


@pytest.fixture
def mock_db():
    """Mock the AsyncSession for database interactions."""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def mock_repo(mock_db):
    """Mock FuelExportRepository."""
    repo = FuelExportRepository(db=mock_db)
    repo.get_fuel_export_table_options = AsyncMock()
    repo.get_fuel_export_list = AsyncMock()
    repo.get_fuel_exports_paginated = AsyncMock()
    repo.get_fuel_export_by_id = AsyncMock()
    repo.create_fuel_export = AsyncMock()
    repo.update_fuel_export = AsyncMock()
    repo.delete_fuel_export = AsyncMock()
    repo.get_effective_fuel_exports = AsyncMock()
    repo.get_latest_fuel_export_by_group_uuid = AsyncMock()
    return repo


@pytest.fixture
def mock_compliance_report_repo():
    """Mock ComplianceReportRepository."""
    repo = AsyncMock(spec=ComplianceReportRepository)
    return repo


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
        organization_id=1,
        organization_code="ACME123",
        name="Acme Corporation",
    )


@pytest.fixture
def summary_schema():
    return SummarySchema(
        summary_id=1,
        is_locked=False,
        line_11_fossil_derived_base_fuel_total=0,
        line_21_non_compliance_penalty_payable=0,
    )


@pytest.fixture
def compliance_report_status_schema():
    return ComplianceReportStatusSchema(compliance_report_status_id=1, status="Draft")


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
def mock_fuel_code_repo():
    """Mock FuelCodeRepository."""
    repo = AsyncMock(spec=FuelCodeRepository)
    repo.get_standardized_fuel_data = AsyncMock()
    return repo


@pytest.fixture
def fuel_export_repo(mock_db):
    repo = FuelExportRepository()
    repo.db = mock_db
    return repo


@pytest.fixture
def fuel_export_service(mock_repo, mock_compliance_report_repo):
    """Mock FuelExportServices."""
    service = FuelExportServices(
        repo=mock_repo,
        compliance_report_repo=mock_compliance_report_repo,
    )
    return service


@pytest.fixture
def fuel_export_action_service(mock_repo, mock_fuel_code_repo):
    """Mock FuelExportActionService."""
    service = FuelExportActionService(repo=mock_repo, fuel_repo=mock_fuel_code_repo)
    return service


@pytest.fixture
def mock_user_profile():
    """Mock user profile with minimal required attributes."""
    return MagicMock(id=1, organization_id=1, user_type="SUPPLIER")
