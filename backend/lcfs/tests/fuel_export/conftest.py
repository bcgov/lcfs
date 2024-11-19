import pytest
from unittest.mock import AsyncMock, MagicMock
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_export.services import FuelExportServices
from lcfs.web.api.fuel_export.actions_service import FuelExportActionService
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository


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
    repo.get_fuel_export_version_by_user = AsyncMock()
    repo.get_latest_fuel_export_by_group_uuid = AsyncMock()
    return repo


@pytest.fixture
def mock_compliance_report_repo():
    """Mock ComplianceReportRepository."""
    repo = AsyncMock(spec=ComplianceReportRepository)
    return repo


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
