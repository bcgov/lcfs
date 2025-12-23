import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from io import BytesIO
import json

from lcfs.web.api.charging_site.importer import (
    ChargingSiteImporter,
    _validate_row,
    _parse_row,
    _update_progress,
)
from lcfs.web.api.charging_site.repo import ChargingSiteRepository
from lcfs.web.api.charging_site.services import ChargingSiteService
from lcfs.web.api.charging_site.schema import ChargingSiteCreateSchema
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.services.clamav.client import ClamAVService


@pytest.fixture
def mock_repo():
    return AsyncMock(spec=ChargingSiteRepository)


@pytest.fixture
def mock_service():
    return AsyncMock(spec=ChargingSiteService)


@pytest.fixture
def mock_clamav():
    return MagicMock(spec=ClamAVService)


@pytest.fixture
def mock_redis():
    redis = AsyncMock()
    redis.get.return_value = None
    redis.set.return_value = None
    return redis


@pytest.fixture
def mock_executor():
    return MagicMock()


@pytest.fixture
def mock_user():
    user = MagicMock(spec=UserProfile)
    user.user_profile_id = 1
    user.keycloak_username = "testuser"
    return user


class MockUploadFile:
    """Mock class for UploadFile to handle content_type properly"""

    def __init__(self, filename, file, content_type):
        self.filename = filename
        self.file = file
        self._content_type = content_type

    @property
    def content_type(self):
        return self._content_type

    async def read(self):
        return self.file.read()


@pytest.fixture
def mock_upload_file():
    content = b"test file content"
    return MockUploadFile(
        filename="test.xlsx",
        file=BytesIO(content),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@pytest.fixture
def importer(mock_repo, mock_service, mock_clamav, mock_redis, mock_executor):
    return ChargingSiteImporter(
        repo=mock_repo,
        cs_service=mock_service,
        clamav_service=mock_clamav,
        redis_client=mock_redis,
        executor=mock_executor,
    )


class TestChargingSiteImporter:

    @pytest.mark.anyio
    async def test_import_data_success(self, importer, mock_user, mock_upload_file):
        """Test successful import data initiation"""
        with patch(
            "lcfs.web.api.charging_site.importer.uuid.uuid4"
        ) as mock_uuid, patch(
            "lcfs.web.api.charging_site.importer.asyncio.create_task"
        ) as mock_create_task:

            mock_uuid.return_value = MagicMock()
            mock_uuid.return_value.__str__ = MagicMock(return_value="test-job-id")

            # Mock create_task to prevent actual background task from running
            # Close the coroutine to prevent "never awaited" warning
            def close_coroutine(coro):
                coro.close()
                return MagicMock()

            mock_create_task.side_effect = close_coroutine

            job_id = await importer.import_data(
                1, mock_user, "ORG001", mock_upload_file, False
            )

            assert job_id == "test-job-id"
            importer.redis_client.set.assert_called()
            mock_create_task.assert_called_once()

    @pytest.mark.anyio
    async def test_import_data_file_too_large(self, importer, mock_user):
        """Test import with file too large"""
        # Use a more reasonable size for testing - 51MB (just over the 50MB limit)
        large_content = b"x" * (51 * 1024 * 1024)  # 51 MB
        large_file = MockUploadFile(
            filename="large.xlsx",
            file=BytesIO(large_content),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await importer.import_data(1, mock_user, "ORG001", large_file, False)

        assert exc_info.value.status_code == 400
        assert "exceeds the maximum limit" in str(exc_info.value.detail)

    @pytest.mark.anyio
    async def test_get_status_success(self, importer):
        """Test successful status retrieval"""
        status_data = {
            "progress": 50,
            "status": "Processing...",
            "created": 10,
            "rejected": 2,
            "errors": ["Error 1"],
        }
        importer.redis_client.get.return_value = json.dumps(status_data)

        result = await importer.get_status("test-job-id")

        assert result["progress"] == 50
        assert result["status"] == "Processing..."
        assert result["created"] == 10
        assert result["rejected"] == 2
        assert len(result["errors"]) == 1

    @pytest.mark.anyio
    async def test_get_status_no_job_found(self, importer):
        """Test status retrieval when job not found"""
        importer.redis_client.get.return_value = None

        result = await importer.get_status("nonexistent-job-id")

        assert result["progress"] == 0
        assert "No job found" in result["status"]

    @pytest.mark.anyio
    async def test_get_status_invalid_json(self, importer):
        """Test status retrieval with invalid JSON"""
        importer.redis_client.get.return_value = "invalid json"

        result = await importer.get_status("test-job-id")

        assert result["progress"] == 0
        assert "Invalid status data" in result["status"]


class TestValidateRow:

    def test_validate_row_success(self):
        """Test successful row validation"""
        valid_row = (
            "Test Site",  # site_name
            "123 Main St",  # street_address
            "Vancouver",  # city
            "V6B 1A1",  # postal_code
            49.2827,  # latitude
            -123.1207,  # longitude
            "Org 1",  # allocating_org_name
            "Notes",  # notes
        )
        valid_org_names = {"Org 1", "Org 2"}

        result = _validate_row(valid_row, 2, valid_org_names)

        assert result is None

    def test_validate_row_missing_required_fields(self):
        """Test validation with missing required fields"""
        invalid_row = (
            None,  # site_name - MISSING
            None,  # street_address - MISSING
            "Vancouver",  # city
            "V6B 1A1",  # postal_code
            49.2827,  # latitude
            -123.1207,  # longitude
            None,  # allocating_org_name
            "Notes",  # notes
        )
        valid_org_names = {"Org 1", "Org 2"}

        result = _validate_row(invalid_row, 2, valid_org_names)

        assert result is not None
        assert "Missing required fields" in result
        assert "Site Name" in result
        assert "Street Address" in result

    def test_validate_row_invalid_postal_code(self):
        """Test validation with invalid postal code"""
        invalid_row = (
            "Test Site",  # site_name
            "123 Main St",  # street_address
            "Vancouver",  # city
            "INVALID",  # postal_code - INVALID FORMAT
            49.2827,  # latitude
            -123.1207,  # longitude
            None,  # allocating_org_name
            "Notes",  # notes
        )
        valid_org_names = {"Org 1", "Org 2"}

        result = _validate_row(invalid_row, 2, valid_org_names)

        assert result is not None
        assert "Invalid postal code" in result


class TestParseRow:

    def test_parse_row_success(self):
        """Test successful row parsing"""
        valid_row = (
            "Test Site",  # site_name
            "123 Main St",  # street_address
            "Vancouver",  # city
            "V6B 1A1",  # postal_code
            49.2827,  # latitude
            -123.1207,  # longitude
            "Org 1",  # allocating_org_name
            "Notes",  # notes
        )
        allocating_org_map = {"Org 1": 10, "Org 2": 20}

        result = _parse_row(valid_row, 1, allocating_org_map)

        assert isinstance(result, ChargingSiteCreateSchema)
        assert result.organization_id == 1
        assert result.allocating_organization_id == 10
        assert result.site_name == "Test Site"
        assert result.street_address == "123 Main St"
        assert result.city == "Vancouver"
        assert result.postal_code == "V6B 1A1"
        assert result.latitude == 49.2827
        assert result.longitude == -123.1207
        assert result.current_status == "Draft"
        assert result.notes == "Notes"

    def test_parse_row_with_none_values(self):
        """Test parsing row with None values"""
        row_with_nones = (
            "Test Site",  # site_name
            "123 Main St",  # street_address
            "Vancouver",  # city
            "V6B 1A1",  # postal_code
            None,  # latitude
            None,  # longitude
            None,  # allocating_org_name
            None,  # notes
        )
        allocating_org_map = {"Org 1": 10}

        result = _parse_row(row_with_nones, 1, allocating_org_map)

        assert isinstance(result, ChargingSiteCreateSchema)
        assert result.allocating_organization_id is None
        assert result.latitude == 0.0
        assert result.longitude == 0.0
        assert result.current_status == "Draft"
        assert result.notes == ""


class TestUpdateProgress:

    @pytest.mark.anyio
    async def test_update_progress_success(self):
        """Test successful progress update"""
        mock_redis = AsyncMock()

        await _update_progress(
            mock_redis,
            "test-job-id",
            50.0,
            "Processing...",
            created=10,
            rejected=2,
            errors=["Error 1"],
        )

        mock_redis.set.assert_called_once()
        call_args = mock_redis.set.call_args

        # Verify the key
        assert call_args[0][0] == "jobs/test-job-id"

        # Verify the data structure
        data = json.loads(call_args[0][1])
        assert data["progress"] == 50.0
        assert data["status"] == "Processing..."
        assert data["created"] == 10
        assert data["rejected"] == 2
        assert data["errors"] == ["Error 1"]

    @pytest.mark.anyio
    async def test_update_progress_with_defaults(self):
        """Test progress update with default values"""
        mock_redis = AsyncMock()

        await _update_progress(mock_redis, "test-job-id", 25.0, "Starting...")

        mock_redis.set.assert_called_once()
        call_args = mock_redis.set.call_args

        data = json.loads(call_args[0][1])
        assert data["progress"] == 25.0
        assert data["status"] == "Starting..."
        assert data["created"] == 0
        assert data["rejected"] == 0
        assert data["errors"] == []
