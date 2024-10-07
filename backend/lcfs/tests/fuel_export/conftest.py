import pytest
from unittest.mock import AsyncMock, MagicMock
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_export.services import FuelExportServices
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture(scope="function", autouse=True)
async def init_cache():
    FastAPICache.init(InMemoryBackend(), prefix="test-cache")


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def mock_repo():
    return AsyncMock(spec=FuelExportRepository())


@pytest.fixture
def fuel_export_service(mock_user_profile, mock_repo):
    service = FuelExportServices()
    service.repo = mock_repo
    service.request = MagicMock()
    service.request.user = mock_user_profile
    return service


@pytest.fixture
def fuel_export_repo(mock_db):
    repo = FuelExportRepository()
    repo.db = mock_db
    return repo
