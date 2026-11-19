import json
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fakeredis import FakeServer, aioredis
from fastapi import UploadFile

from lcfs.services.clamav.client import ScanUnavailableException, VirusScanException
from lcfs.web.api.allocation_agreement import importer
from lcfs.tests.services.file_inspection.builders import xlsx_bytes


@pytest.fixture
def redis_server():
    return FakeServer()


async def run_import(redis_server, scan_error):
    """Run the background job against the test DB with a scanner that refuses the file."""
    user = MagicMock()
    user.keycloak_username = "testuser"
    upload = UploadFile(filename="aa.xlsx", file=BytesIO(xlsx_bytes()))

    clamav = MagicMock()
    clamav.scan_file_async = AsyncMock(side_effect=scan_error)
    delete_all = AsyncMock()

    with patch.object(importer.settings, "clamav_enabled", True), patch.object(
        importer, "ClamAVService", return_value=clamav
    ), patch.object(
        importer,
        "Redis",
        side_effect=lambda **kwargs: aioredis.FakeRedis(
            server=redis_server, decode_responses=True
        ),
    ), patch.object(
        importer.AllocationAgreementServices, "delete_all", delete_all
    ):
        await importer.import_async(
            compliance_report_id=1,
            user=user,
            file=upload,
            job_id="job-1",
            overwrite=True,
        )

    reader = aioredis.FakeRedis(server=redis_server, decode_responses=True)
    return json.loads(await reader.get("jobs/job-1")), delete_all


@pytest.mark.anyio
@pytest.mark.parametrize(
    "scan_error", [VirusScanException(), ScanUnavailableException()]
)
async def test_refused_file_fails_the_job_and_changes_nothing(
    dbsession, redis_server, scan_error
):
    status, delete_all = await run_import(redis_server, scan_error)

    assert status["progress"] == 100
    assert status["status"] == scan_error.detail
    assert status["errors"] == [scan_error.detail]
    # The scan runs before an overwrite deletes the existing rows
    delete_all.assert_not_awaited()
