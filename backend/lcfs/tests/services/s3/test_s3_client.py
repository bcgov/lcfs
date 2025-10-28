from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock
import os
import uuid
from io import BytesIO

import pytest
from fastapi import UploadFile, HTTPException
from starlette.responses import StreamingResponse
from botocore.exceptions import ClientError

from lcfs.db.models.admin_adjustment.AdminAdjustment import (
    admin_adjustment_document_association,
    AdminAdjustment,
)
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.initiative_agreement.InitiativeAgreement import (
    initiative_agreement_document_association,
    InitiativeAgreement,
)
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.compliance import ComplianceReport
from lcfs.db.models.document import Document
from lcfs.db.models.compliance.ComplianceReport import (
    compliance_report_document_association,
)
from lcfs.services.s3.client import DocumentService, MAX_FILE_SIZE_BYTES, BUCKET_NAME
from lcfs.services.clamav.client import ClamAVService


@pytest.fixture
def db_mock():
    db = AsyncMock()
    db.get = AsyncMock()
    db.get_one = AsyncMock()
    db.execute = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.delete = AsyncMock()
    return db


@pytest.fixture
def s3_client_mock():
    client = MagicMock()
    client.upload_fileobj = MagicMock()
    client.generate_presigned_url = MagicMock(return_value="https://example.com/file")
    client.delete_object = MagicMock()
    client.get_object = MagicMock(return_value={"Body": BytesIO(b"test content")})
    client.put_object = MagicMock()
    return client


@pytest.fixture
def clamav_service_mock():
    service = MagicMock(spec=ClamAVService)
    service.scan_file = MagicMock()
    return service


@pytest.fixture
def compliance_report_repo_mock():
    with patch(
        "lcfs.web.api.compliance_report.repo.ComplianceReportRepository"
    ) as mock:
        mock_instance = mock.return_value
        mock_instance.get_compliance_report_by_id = AsyncMock()
        mock_instance.get_related_compliance_report_ids = AsyncMock(return_value=[1])
        return mock_instance


@pytest.fixture
def fuel_supply_repo_mock():
    with patch("lcfs.web.api.fuel_supply.repo.FuelSupplyRepository") as mock:
        return mock.return_value


@pytest.fixture
def admin_adjustment_service_mock():
    with patch(
        "lcfs.web.api.admin_adjustment.services.AdminAdjustmentServices"
    ) as mock:
        mock_instance = mock.return_value
        mock_instance.get_admin_adjustment = AsyncMock()
        return mock_instance


@pytest.fixture
def initiative_agreement_service_mock():
    with patch(
        "lcfs.web.api.initiative_agreement.services.InitiativeAgreementServices"
    ) as mock:
        mock_instance = mock.return_value
        mock_instance.get_initiative_agreement = AsyncMock()
        return mock_instance


@pytest.fixture
def document_service(
    db_mock,
    clamav_service_mock,
    s3_client_mock,
    compliance_report_repo_mock,
    fuel_supply_repo_mock,
    admin_adjustment_service_mock,
    initiative_agreement_service_mock,
):
    return DocumentService(
        db=db_mock,
        clamav_service=clamav_service_mock,
        s3_client=s3_client_mock,
        compliance_report_repo=compliance_report_repo_mock,
        fuel_supply_repo=fuel_supply_repo_mock,
        admin_adjustment_service=admin_adjustment_service_mock,
        initiative_agreement_service=initiative_agreement_service_mock,
    )


@pytest.fixture
def mock_file():
    file = MagicMock(spec=UploadFile)
    file.filename = "test.pdf"
    file.content_type = "application/pdf"
    file.file = MagicMock()
    file.file.fileno = MagicMock(return_value=0)
    file.file.seek = MagicMock()
    file.file.read = MagicMock(return_value=b"file-bytes")
    return file


@pytest.fixture
def user_supplier():
    user = MagicMock()
    user.role_names = [RoleEnum.SUPPLIER]
    return user


@pytest.fixture
def user_government():
    user = MagicMock()
    user.role_names = [RoleEnum.GOVERNMENT]
    return user


@pytest.fixture
def compliance_report_mock():
    report = MagicMock(spec=ComplianceReport)
    status = MagicMock()
    status.status = ComplianceReportStatusEnum.Draft
    report.current_status = status
    report.compliance_report_id = 1
    return report


@pytest.fixture
def admin_adjustment_mock():
    adjustment = MagicMock(spec=AdminAdjustment)
    adjustment.admin_adjustment_id = 1
    return adjustment


@pytest.fixture
def initiative_agreement_mock():
    agreement = MagicMock(spec=InitiativeAgreement)
    agreement.initiative_agreement_id = 1
    return agreement


@pytest.fixture
def document_mock():
    document = MagicMock(spec=Document)
    document.document_id = 1
    document.file_key = "test/key"
    document.file_name = "test.pdf"
    document.file_size = 1024
    document.mime_type = "application/pdf"
    return document


@pytest.mark.anyio
@patch("os.fstat")
@patch("uuid.uuid4")
async def test_upload_file_compliance_report_success(
    mock_uuid,
    mock_fstat,
    document_service,
    mock_file,
    user_supplier,
    compliance_report_mock,
    db_mock,
):
    # Setup
    mock_uuid.return_value = "test-uuid"
    mock_stat = MagicMock()
    mock_stat.st_size = 1024  # 1KB
    mock_fstat.return_value = mock_stat

    document_service.compliance_report_repo.get_compliance_report_by_id.return_value = (
        compliance_report_mock
    )
    db_mock.get.return_value = compliance_report_mock

    # Set up the db refresh mock to simply return its input
    # This way when document_service.upload_file calls db.refresh(document)
    # it will just return the same document object
    db_mock.refresh = AsyncMock(side_effect=lambda x: x)

    # Execute
    result = await document_service.upload_file(
        mock_file, 1, "compliance_report", user_supplier
    )

    # Assert
    assert isinstance(result, Document)
    document_service.compliance_report_repo.get_compliance_report_by_id.assert_called_once_with(
        1
    )
    document_service.s3_client.upload_fileobj.assert_called_once()
    db_mock.add.assert_called_once()
    db_mock.flush.assert_called()
    db_mock.refresh.assert_called_once()


@pytest.mark.anyio
@patch("os.fstat")
@patch("uuid.uuid4")
async def test_upload_file_closed_seek_is_ignored(
    mock_uuid,
    mock_fstat,
    document_service,
    mock_file,
    user_supplier,
    compliance_report_mock,
    db_mock,
):
    mock_uuid.return_value = "test-uuid"
    mock_stat = MagicMock()
    mock_stat.st_size = 1024
    mock_fstat.return_value = mock_stat

    document_service.compliance_report_repo.get_compliance_report_by_id.return_value = (
        compliance_report_mock
    )
    db_mock.get.return_value = compliance_report_mock
    db_mock.refresh = AsyncMock(side_effect=lambda x: x)

    mock_file.file.seek.side_effect = [None, ValueError("seek of closed file")]

    result = await document_service.upload_file(
        mock_file, 1, "compliance_report", user_supplier
    )

    assert result.file_name == mock_file.filename
    assert mock_file.file.seek.call_count == 2


@pytest.mark.anyio
@patch("os.fstat")
@patch("uuid.uuid4")
async def test_upload_file_sha256_mismatch_fallback(
    mock_uuid,
    mock_fstat,
    document_service,
    mock_file,
    user_supplier,
    compliance_report_mock,
    db_mock,
):
    mock_uuid.return_value = "test-uuid"
    mock_stat = MagicMock()
    mock_stat.st_size = 1024
    mock_fstat.return_value = mock_stat

    document_service.compliance_report_repo.get_compliance_report_by_id.return_value = (
        compliance_report_mock
    )
    db_mock.get.return_value = compliance_report_mock
    db_mock.refresh = AsyncMock(side_effect=lambda x: x)

    error_response = {"Error": {"Code": "XAmzContentSHA256Mismatch", "Message": "mismatch"}}
    document_service.s3_client.upload_fileobj.side_effect = ClientError(
        error_response, "PutObject"
    )

    result = await document_service.upload_file(
        mock_file, 1, "compliance_report", user_supplier
    )

    assert result.file_name == mock_file.filename
    document_service.s3_client.put_object.assert_called_once()
    kwargs = document_service.s3_client.put_object.call_args.kwargs
    assert kwargs["Body"] == b"file-bytes"
    assert kwargs["Bucket"] == BUCKET_NAME
    assert kwargs["ContentType"] == mock_file.content_type
    document_service.s3_client.upload_fileobj.assert_called_once()
    assert mock_file.file.seek.call_count >= 2


@pytest.mark.anyio
@patch("os.fstat")
async def test_upload_file_size_exceeded(
    mock_fstat, document_service, mock_file, user_supplier, compliance_report_mock
):
    # Setup
    # Configure the compliance report mock to be in Draft status
    document_service.compliance_report_repo.get_compliance_report_by_id.return_value = (
        compliance_report_mock
    )

    mock_stat = MagicMock()
    mock_stat.st_size = MAX_FILE_SIZE_BYTES + 1  # Exceed max size
    mock_fstat.return_value = mock_stat

    # Execute and Assert
    with pytest.raises(HTTPException) as exc_info:
        await document_service.upload_file(
            mock_file, 1, "compliance_report", user_supplier
        )

    assert exc_info.value.status_code == 400
    assert "File size exceeds" in exc_info.value.detail


@pytest.mark.anyio
async def test_verify_compliance_report_access_not_found(
    document_service, user_supplier
):
    # Setup
    document_service.compliance_report_repo.get_compliance_report_by_id.return_value = (
        None
    )

    # Execute and Assert
    with pytest.raises(HTTPException) as exc_info:
        await document_service._verify_compliance_report_access(1, user_supplier)

    assert exc_info.value.status_code == 404
    assert "not found" in exc_info.value.detail


@pytest.mark.anyio
async def test_verify_compliance_report_access_supplier_not_draft(
    document_service, user_supplier, compliance_report_mock
):
    # Setup
    compliance_report_mock.current_status.status = ComplianceReportStatusEnum.Submitted
    document_service.compliance_report_repo.get_compliance_report_by_id.return_value = (
        compliance_report_mock
    )

    # Execute and Assert
    with pytest.raises(HTTPException) as exc_info:
        await document_service._verify_compliance_report_access(1, user_supplier)

    assert exc_info.value.status_code == 400
    assert "Suppliers can only upload" in exc_info.value.detail


@pytest.mark.anyio
async def test_verify_admin_adjustment_access_government_success(
    document_service, user_government, admin_adjustment_mock
):
    # Setup
    document_service.admin_adjustment_service.get_admin_adjustment.return_value = (
        admin_adjustment_mock
    )

    # Execute
    await document_service._verify_administrative_adjustment_access(1, user_government)

    # Assert - No exception raised
    document_service.admin_adjustment_service.get_admin_adjustment.assert_called_once_with(
        1
    )


@pytest.mark.anyio
async def test_verify_admin_adjustment_access_supplier_failure(
    document_service, user_supplier, admin_adjustment_mock
):
    # Setup
    document_service.admin_adjustment_service.get_admin_adjustment.return_value = (
        admin_adjustment_mock
    )

    # Execute and Assert
    with pytest.raises(HTTPException) as exc_info:
        await document_service._verify_administrative_adjustment_access(
            1, user_supplier
        )

    assert exc_info.value.status_code == 400
    assert "Only Government Staff" in exc_info.value.detail


@pytest.mark.anyio
async def test_verify_initiative_agreement_access_government_success(
    document_service, user_government, initiative_agreement_mock
):
    # Setup
    document_service.initiative_agreement_service.get_initiative_agreement.return_value = (
        initiative_agreement_mock
    )

    # Execute
    await document_service._verify_initiative_agreement_access(1, user_government)

    # Assert - No exception raised
    document_service.initiative_agreement_service.get_initiative_agreement.assert_called_once_with(
        1
    )


@pytest.mark.anyio
async def test_verify_initiative_agreement_access_supplier_failure(
    document_service, user_supplier, initiative_agreement_mock
):
    # Setup
    document_service.initiative_agreement_service.get_initiative_agreement.return_value = (
        initiative_agreement_mock
    )

    # Execute and Assert
    with pytest.raises(HTTPException) as exc_info:
        await document_service._verify_initiative_agreement_access(1, user_supplier)

    assert exc_info.value.status_code == 400
    assert "Only Government Staff" in exc_info.value.detail


@pytest.mark.anyio
async def test_generate_presigned_url_success(document_service, document_mock, db_mock):
    # Setup
    db_mock.get_one.return_value = document_mock

    # Execute
    result = await document_service.generate_presigned_url(1)

    # Assert
    assert result == "https://example.com/file"
    db_mock.get_one.assert_called_once_with(Document, 1)
    document_service.s3_client.generate_presigned_url.assert_called_once()


@pytest.mark.anyio
async def test_generate_presigned_url_document_not_found(document_service, db_mock):
    # Setup
    db_mock.get_one.return_value = None

    # Execute and Assert
    with pytest.raises(Exception) as exc_info:
        await document_service.generate_presigned_url(1)

    assert "DatabaseException" in str(exc_info.typename)


@pytest.mark.anyio
async def test_delete_file_last_link(document_service, document_mock, db_mock):
    # Setup
    db_mock.get_one.return_value = document_mock

    # Create a proper mock for the execute result
    # Looking at the code, it appears the pattern is (await db.execute()).all()
    execute_result = MagicMock()
    execute_result.all.return_value = [MagicMock()]  # One link
    db_mock.execute = AsyncMock(return_value=execute_result)

    # Execute
    await document_service.delete_file(1, 1, "compliance_report")

    # Assert
    document_service.s3_client.delete_object.assert_called_once()
    db_mock.delete.assert_called_once_with(document_mock)
    db_mock.flush.assert_called_once()


@pytest.mark.anyio
async def test_delete_file_multiple_links(document_service, document_mock, db_mock):
    # Setup
    db_mock.get_one.return_value = document_mock

    # Mock for execute - make sure it's not an AsyncMock but a regular MagicMock with the .all method
    execute_result = MagicMock()
    execute_result.all.return_value = [MagicMock(), MagicMock()]  # Multiple links

    # Replace the execute method completely with an AsyncMock that returns our result object
    db_mock.execute = AsyncMock(return_value=execute_result)

    # Execute
    await document_service.delete_file(1, 1, "compliance_report")

    # Assert
    document_service.s3_client.delete_object.assert_not_called()
    db_mock.delete.assert_not_called()


@pytest.mark.anyio
async def test_get_by_id_and_type_compliance_report(document_service, db_mock):
    # Setup
    # Create a mock result with scalars and all methods
    result_mock = MagicMock()

    # Create a mock for the scalars() method
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = [MagicMock(spec=Document)]

    # Configure result.scalars() to return the scalars_mock
    result_mock.scalars.return_value = scalars_mock

    # Set up db_mock.execute to be an AsyncMock that returns result_mock
    db_mock.execute = AsyncMock(return_value=result_mock)

    # Execute
    documents = await document_service.get_by_id_and_type(1, "compliance_report")

    # Assert
    assert len(documents) == 1
    db_mock.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_by_id_and_type_invalid_type(document_service):
    # Execute and Assert - just check that any exception is raised
    with pytest.raises(Exception):
        await document_service.get_by_id_and_type(1, "invalid_type")


@pytest.mark.anyio
async def test_get_object_success(document_service, document_mock, db_mock):
    # Setup
    db_mock.get_one.return_value = document_mock

    # Execute
    response, document = await document_service.get_object(1)

    # Assert
    assert document == document_mock
    db_mock.get_one.assert_called_once_with(Document, 1)
    document_service.s3_client.get_object.assert_called_once()


@pytest.mark.anyio
async def test_get_object_document_not_found(document_service, db_mock):
    # Setup
    db_mock.get_one.return_value = None

    # Execute and Assert
    with pytest.raises(Exception) as exc_info:
        await document_service.get_object(1)

    assert "DatabaseException" in str(exc_info.typename)


@pytest.mark.anyio
async def test_copy_documents(document_service, db_mock):
    # Setup
    doc1 = MagicMock()
    doc1.document_id = 1
    doc2 = MagicMock()
    doc2.document_id = 2

    # Create a mock result object that can be iterated over
    result_mock = MagicMock()
    result_mock.all.return_value = [doc1, doc2]

    # Make db_mock.execute return our result_mock
    db_mock.execute = AsyncMock(return_value=result_mock)

    # Execute
    await document_service.copy_documents(1, 2)

    # Assert
    # We expect at least two calls (once for select, and at least once for insert)
    assert db_mock.execute.call_count >= 2
