import pytest
from unittest.mock import AsyncMock, MagicMock
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_export.services import FuelExportServices
from lcfs.web.api.fuel_export.actions_service import FuelExportActionService
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from sqlalchemy.ext.asyncio import AsyncSession
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository


@pytest.fixture(scope="function", autouse=True)
async def init_cache():
    FastAPICache.init(InMemoryBackend(), prefix="test-cache")


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def mock_repo():
    repo = AsyncMock(spec=FuelExportRepository())
    # Add specific async mock methods that need to be available
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
    return AsyncMock(spec=ComplianceReportRepository)


@pytest.fixture
def fuel_export_service(mock_user_profile, mock_repo, mock_compliance_report_repo):
    service = FuelExportServices()
    service.repo = mock_repo
    service.compliance_report_repo = mock_compliance_report_repo
    service.request = MagicMock()
    service.request.user = mock_user_profile
    return service


@pytest.fixture
def fuel_export_repo(mock_db):
    repo = FuelExportRepository()
    repo.db = mock_db
    return repo


@pytest.fixture
def mock_fuel_export_services():
    services = AsyncMock(spec=FuelExportServices)
    # Add specific methods that need to be available
    services.validate_and_calculate_compliance_units = AsyncMock()
    services.get_fuel_export_options = AsyncMock()
    return services


@pytest.fixture
def fuel_export_action_service(mock_repo, mock_fuel_export_services):
    service = FuelExportActionService(
        repo=mock_repo, fuel_export_services=mock_fuel_export_services
    )
    return service


@pytest.fixture
def mock_user_profile():
    """Mock user profile with minimal required attributes"""
    return MagicMock(id=1, organization_id=1, user_type="SUPPLIER")
