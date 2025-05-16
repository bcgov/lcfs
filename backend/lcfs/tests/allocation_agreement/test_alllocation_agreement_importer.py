import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
import concurrent.futures

from lcfs.web.api.allocation_agreement.importer import AllocationAgreementImporter
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.api.allocation_agreement.services import AllocationAgreementServices
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.services.clamav.client import ClamAVService
from redis.asyncio import Redis


@pytest.fixture
def mock_repo() -> AllocationAgreementRepository:
    repo = MagicMock(spec=AllocationAgreementRepository)
    return repo


@pytest.fixture
def mock_allocation_services() -> AllocationAgreementServices:
    service = MagicMock(spec=AllocationAgreementServices)
    return service


@pytest.fixture
def mock_compliance_service() -> ComplianceReportServices:
    service = MagicMock(spec=ComplianceReportServices)
    return service


@pytest.fixture
def mock_clamav() -> ClamAVService:
    clamav = MagicMock(spec=ClamAVService)
    return clamav


@pytest.fixture
def mock_redis() -> Redis:
    redis_client = MagicMock(spec=Redis)
    redis_client.set = AsyncMock()
    redis_client.get = AsyncMock()
    return redis_client


@pytest.fixture
def mock_executor():
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    yield executor
    executor.shutdown(wait=False)


@pytest.fixture
def importer_instance(
    mock_repo,
    mock_allocation_services,
    mock_compliance_service,
    mock_clamav,
    mock_redis,
    mock_executor,
):
    """
    Creates an AllocationAgreementImporter with mocked dependencies.
    """
    return AllocationAgreementImporter(
        repo=mock_repo,
        fuel_code_repo=mock_allocation_services,
        compliance_report_services=mock_compliance_service,
        clamav_service=mock_clamav,
        redis_client=mock_redis,
        executor=mock_executor,
    )


@pytest.mark.anyio
async def test_import_data_success(importer_instance, mock_redis):
    file_mock = MagicMock()
    file_mock.filename = "test.xlsx"
    file_mock.read = AsyncMock(return_value=b"fake-excel-contents")

    user_mock = MagicMock()
    user_mock.organization.organization_code = "TEST-ORG"
    org_code = "TEST-ORG"

    with patch(
        "lcfs.web.api.allocation_agreement.importer.import_async",
        new=AsyncMock(return_value=None),
    ) as mock_import_task:

        job_id = await importer_instance.import_data(
            compliance_report_id=123,
            user=user_mock,
            file=file_mock,
            overwrite=False,
        )

        assert isinstance(job_id, str)
        assert len(job_id) > 0

        # Check Redis progress was initialized
        mock_redis.set.assert_called()
        # Check our background task was scheduled
        mock_import_task.assert_called()


@pytest.mark.anyio
async def test_import_data_with_clamav(importer_instance, mock_clamav, mock_redis):
    with patch("lcfs.settings.settings.clamav_enabled", True):
        file_mock = MagicMock()
        file_mock.filename = "test.xlsx"
        file_mock.read = AsyncMock(return_value=b"excel-data")
        user_mock = MagicMock()
        org_code = "TEST-ORG"

        with patch(
            "lcfs.web.api.allocation_agreement.importer.import_async", new=AsyncMock()
        ) as mock_import_task:
            job_id = await importer_instance.import_data(
                compliance_report_id=999,
                user=user_mock,
                file=file_mock,
                overwrite=True,
            )

            assert job_id
            mock_import_task.assert_called()


@pytest.mark.anyio
async def test_get_status_no_job_found(importer_instance, mock_redis):
    """
    Tests that get_status returns a default response if redis has no record for job_id.
    """
    mock_redis.get = AsyncMock(return_value=None)

    result = await importer_instance.get_status("non-existent-id")

    assert result["progress"] == 0
    assert "No job found" in result["status"]


@pytest.mark.anyio
async def test_get_status_invalid_json(importer_instance, mock_redis):
    """
    Tests that get_status handles invalid JSON from redis gracefully.
    """
    mock_redis.get = AsyncMock(return_value=b"not-valid-json")

    result = await importer_instance.get_status("corrupt-id")
    assert result["progress"] == 0
    assert "Invalid status data found." in result["status"]


@pytest.mark.anyio
async def test_get_status_success(importer_instance, mock_redis):
    """
    Tests that get_status successfully returns job status data.
    """
    mock_redis.get = AsyncMock(
        return_value='{"progress": 75, "status": "Importing row 15", "created": 10, "rejected": 5, "errors": ["Error 1", "Error 2"]}'
    )

    result = await importer_instance.get_status("valid-job-id")
    assert result["progress"] == 75
    assert result["status"] == "Importing row 15"
    assert result["created"] == 10
    assert result["rejected"] == 5
    assert len(result["errors"]) == 2
