from http.client import HTTPException

import io
import pytest
from fastapi import UploadFile
from starlette import status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.initiative_agreement.validation import InitiativeAgreementValidation
from lcfs.web.api.admin_adjustment.validation import AdminAdjustmentValidation


class DummyDocument:
    def __init__(self, file_name: str, document_id: int, file_size: int):
        self.file_name = file_name
        self.document_id = document_id
        self.file_size = file_size


class FakeDocumentService:
    async def get_by_id_and_type(self, parent_id: int, parent_type: str):
        return [
            {
                "document_id": 1,
                "file_name": "test.pdf",
                "file_size": 123,
            }
        ]

    async def upload_file(
        self, file: UploadFile, parent_id: int, parent_type: str, user
    ):
        return {
            "document_id": 2,
            "file_name": "uploaded.pdf",
            "file_size": 456,
        }

    async def get_object(self, document_id: int):
        file = {
            "ContentLength": 789,
            # Wrap the bytes in a list so that iteration yields a bytes chunk.
            "Body": [b"streamed content"],
            "ContentType": "application/pdf",
        }
        document = DummyDocument("document.pdf", document_id=10, file_size=789)
        return file, document

    async def delete_file(self, document_id: int, parent_id: int, parent_type: str):
        return


class FakeComplianceReportValidation:
    async def validate_organization_access(self, parent_id: int):
        return


class FakeInitiativeAgreementValidation:
    async def validate_organization_access(self, parent_id: int):
        return


class FakeAdminAdjustmentValidation:
    async def validate_organization_access(self, parent_id: int):
        return


@pytest.fixture(autouse=True)
def override_dependencies(fastapi_app):
    fastapi_app.dependency_overrides[DocumentService] = lambda: FakeDocumentService()
    fastapi_app.dependency_overrides[ComplianceReportValidation] = (
        lambda: FakeComplianceReportValidation()
    )
    fastapi_app.dependency_overrides[InitiativeAgreementValidation] = (
        lambda: FakeInitiativeAgreementValidation()
    )
    fastapi_app.dependency_overrides[AdminAdjustmentValidation] = (
        lambda: FakeAdminAdjustmentValidation()
    )
    yield
    fastapi_app.dependency_overrides = {}


@pytest.fixture(autouse=True)
def mock_user(fastapi_app, set_mock_user):
    # Set the request user with the SUPPLIER role.
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER])


@pytest.mark.anyio
async def test_get_all_documents(fastapi_app, client):
    url = fastapi_app.url_path_for(
        "get_all_documents", parent_type="compliance_report", parent_id=1
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    doc = data[0]
    # Assert using alias keys as returned in JSON.
    assert doc["documentId"] == 1
    assert doc["fileName"] == "test.pdf"
    assert doc["fileSize"] == 123


@pytest.mark.anyio
async def test_upload_file_success(fastapi_app, client):
    url = fastapi_app.url_path_for(
        "upload_file", parent_type="compliance_report", parent_id=1
    )
    file_content = b"file content"
    files = {"file": ("test.txt", io.BytesIO(file_content), "text/plain")}
    response = await client.post(url, files=files)
    assert response.status_code == status.HTTP_201_CREATED

    data = response.json()
    assert data["documentId"] == 2
    assert data["fileName"] == "uploaded.pdf"
    assert data["fileSize"] == 456


@pytest.mark.anyio
async def test_upload_file_missing_file(fastapi_app, client):
    url = fastapi_app.url_path_for(
        "upload_file", parent_type="compliance_report", parent_id=1
    )
    # Not sending a file triggers a validation error.
    response = await client.post(url, data={})
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.anyio
async def test_stream_document_compliance_report(fastapi_app, client):
    url = fastapi_app.url_path_for(
        "stream_document", parent_type="compliance_report", parent_id=1, document_id=10
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK

    cd = response.headers.get("Content-Disposition")
    assert cd == 'attachment; filename="document.pdf"'
    cl = response.headers.get("content-length")
    assert cl == "789"

    body = await response.aread()
    assert body == b"streamed content"


@pytest.mark.anyio
async def test_stream_document_initiative_agreement(fastapi_app, client):
    url = fastapi_app.url_path_for(
        "stream_document",
        parent_type="initiativeAgreement",
        parent_id=2,
        document_id=20,
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK

    cd = response.headers.get("Content-Disposition")
    assert cd == 'attachment; filename="document.pdf"'
    cl = response.headers.get("content-length")
    assert cl == "789"

    body = await response.aread()
    assert body == b"streamed content"


@pytest.mark.anyio
async def test_stream_document_admin_adjustment(fastapi_app, client):
    url = fastapi_app.url_path_for(
        "stream_document", parent_type="adminAdjustment", parent_id=3, document_id=30
    )
    response = await client.get(url)
    assert response.status_code == status.HTTP_200_OK

    cd = response.headers.get("Content-Disposition")
    assert cd == 'attachment; filename="document.pdf"'
    cl = response.headers.get("content-length")
    assert cl == "789"

    body = await response.aread()
    assert body == b"streamed content"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "parent_type",
    ["compliance_report", "initiativeAgreement", "administrativeAdjustment"],
)
async def test_delete_file_valid(fastapi_app, client, parent_type):
    url = fastapi_app.url_path_for(
        "delete_file", parent_type=parent_type, parent_id=1, document_id=100
    )
    response = await client.delete(url)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["message"] == "File and metadata deleted successfully"


@pytest.mark.anyio
async def test_delete_file_invalid_parent_type(fastapi_app, client):
    url = fastapi_app.url_path_for(
        "delete_file", parent_type="invalid", parent_id=1, document_id=100
    )
    with pytest.raises(HTTPException) as exc_info:
        await client.delete(url)
    assert exc_info.value.args[0] == 403
    assert "Unable to verify authorization" in exc_info.value.args[1]
