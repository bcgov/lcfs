import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.allocation_agreement.conftest import (
    create_mock_delete_schema,
    create_mock_schema,
    create_mock_response_schema,
    create_mock_update_response_schema,
    create_mock_update_schema,
)
from lcfs.web.api.allocation_agreement.services import AllocationAgreementServices
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from starlette.status import HTTP_200_OK, HTTP_400_BAD_REQUEST
from lcfs.web.api.allocation_agreement.importer import AllocationAgreementImporter
from lcfs.web.api.allocation_agreement.export import AllocationAgreementExporter
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from starlette.responses import StreamingResponse
import io
from lcfs.db.models import ComplianceReport, Organization
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.web.api.allocation_agreement.schema import AllocationAgreementSchema


@pytest.fixture
def mock_allocation_agreement_service():
    return MagicMock(spec=AllocationAgreementServices)


@pytest.fixture
def mock_allocation_agreement_validation():
    validation = MagicMock(spec=ComplianceReportValidation)
    validation.validate_organization_access = AsyncMock()
    validation.validate_compliance_report_id = AsyncMock()
    return validation


@pytest.mark.anyio
async def test_save_allocation_agreement_create(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_allocation_agreement_service,
    mock_allocation_agreement_validation,
):
    with patch(
        "lcfs.web.api.allocation_agreement.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access:
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_allocation_agreements_row")
        payload = create_mock_schema({}).model_dump()

        # Mock the service method to return a valid schema object
        mock_allocation_agreement_service.create_allocation_agreement.return_value = (
            create_mock_response_schema({})
        )

        mock_validate_organization_access.return_value = True

        fastapi_app.dependency_overrides[AllocationAgreementServices] = (
            lambda: mock_allocation_agreement_service
        )
        fastapi_app.dependency_overrides[ComplianceReportValidation] = (
            lambda: mock_allocation_agreement_validation
        )

        response = await client.post(url, json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "allocationAgreementId" in data
        assert data["quantity"] == 100
        assert data["fuelType"]["fuelType"] == "Biodiesel"


@pytest.mark.anyio
async def test_save_allocation_agreement_update(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_allocation_agreement_service,
    mock_allocation_agreement_validation,
):
    with patch(
        "lcfs.web.api.allocation_agreement.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access:
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_allocation_agreements_row")
        payload = create_mock_update_schema({}).model_dump()

        mock_allocation_agreement_service.update_allocation_agreement.return_value = (
            create_mock_update_response_schema({})
        )

        mock_validate_organization_access.return_value = True

        fastapi_app.dependency_overrides[AllocationAgreementServices] = (
            lambda: mock_allocation_agreement_service
        )
        fastapi_app.dependency_overrides[ComplianceReportValidation] = (
            lambda: mock_allocation_agreement_validation
        )

        response = await client.post(
            url,
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["version"] == 1
        assert data["actionType"] == ActionTypeEnum.UPDATE.value


@pytest.mark.anyio
async def test_save_allocation_agreement_delete(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_allocation_agreement_service,
    mock_allocation_agreement_validation,
):
    with patch(
        "lcfs.web.api.allocation_agreement.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access:
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_allocation_agreements_row")
        payload = create_mock_delete_schema({}).model_dump()

        mock_allocation_agreement_service.delete_allocation_agreement.return_value = (
            create_mock_update_response_schema({})
        )

        mock_validate_organization_access.return_value = True

        fastapi_app.dependency_overrides[AllocationAgreementServices] = (
            lambda: mock_allocation_agreement_service
        )
        fastapi_app.dependency_overrides[ComplianceReportValidation] = (
            lambda: mock_allocation_agreement_validation
        )
        response = await client.post(
            url,
            json=payload,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Allocation agreement deleted successfully"


async def test_export_allocation_agreements_view(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    with patch.object(
        ComplianceReportValidation,
        "validate_organization_access",
        new=AsyncMock(return_value=True),
    ), patch.object(
        AllocationAgreementExporter,
        "export",
        new=AsyncMock(
            return_value=StreamingResponse(
                io.BytesIO(b"fake content"), media_type="application/octet-stream"
            )
        ),
    ) as mock_export:
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])

        url = fastapi_app.url_path_for("export_allocation_agreements", report_id=1)
        response = await client.get(url)

        assert response.status_code == 200
        mock_export.assert_awaited_once()


@pytest.mark.anyio
async def test_import_allocation_agreements_view(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

    with patch.object(
        ComplianceReportValidation,
        "validate_organization_access",
        new=AsyncMock(return_value=True),
    ), patch.object(
        ComplianceReportServices, "get_compliance_report_by_id", new=AsyncMock()
    ) as mock_get_report, patch.object(
        ComplianceReportValidation,
        "validate_compliance_report_editable",
        new=AsyncMock(return_value=None),
    ), patch.object(
        AllocationAgreementRepository,
        "get_allocation_agreements",
        new=AsyncMock(return_value=[]),
    ), patch.object(
        AllocationAgreementImporter,
        "import_data",
        new=AsyncMock(return_value="fake-job-id"),
    ) as mock_import:
        # Create a properly mocked compliance report with version
        mock_report = MagicMock()
        mock_report.version = 0
        mock_report.current_status = MagicMock()
        mock_report.current_status.status = ComplianceReportStatusEnum.Draft
        mock_get_report.return_value = mock_report

        url = fastapi_app.url_path_for("import_allocation_agreements", report_id=999)

        file_content = b"fake-excel-content"
        files = {
            "file": (
                "test.xlsx",
                file_content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        }
        data = {"overwrite": "true"}

        response = await client.post(url, files=files, data=data)
        assert response.status_code == HTTP_200_OK
        assert "jobId" in response.json()
        mock_import.assert_called_once()


@pytest.mark.anyio
async def test_import_allocation_agreements_overwrite_not_allowed(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

    with patch.object(
        ComplianceReportValidation,
        "validate_organization_access",
        new=AsyncMock(return_value=True),
    ), patch.object(
        ComplianceReportServices, "get_compliance_report_by_id", new=AsyncMock()
    ) as mock_get_report, patch.object(
        ComplianceReportValidation,
        "validate_compliance_report_editable",
        new=AsyncMock(return_value=None),
    ), patch.object(
        AllocationAgreementRepository,
        "get_allocation_agreements",
        new=AsyncMock(return_value=[{"fake": "data"}]),  # Existing data
    ):
        # Create a properly mocked compliance report with version > 0
        mock_report = MagicMock()
        mock_report.version = 1  # Non-initial report
        mock_report.current_status = MagicMock()
        mock_report.current_status.status = ComplianceReportStatusEnum.Draft
        mock_get_report.return_value = mock_report

        url = fastapi_app.url_path_for("import_allocation_agreements", report_id=999)

        file_content = b"fake-excel-content"
        files = {
            "file": (
                "test.xlsx",
                file_content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        }
        data = {"overwrite": "true"}

        response = await client.post(url, files=files, data=data)
        assert response.status_code == HTTP_400_BAD_REQUEST
        assert (
            "Overwrite not allowed: this is a non-initial report with existing data"
            in response.json()["detail"]
        )


async def test_get_allocation_agreement_template(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

    with patch.object(
        ComplianceReportValidation,
        "validate_organization_access",
        new=AsyncMock(return_value=True),
    ), patch.object(
        AllocationAgreementExporter,
        "export",
        new=AsyncMock(
            return_value=StreamingResponse(
                io.BytesIO(b"fake template"), media_type="application/octet-stream"
            )
        ),
    ) as mock_export:
        url = fastapi_app.url_path_for("get_allocation_agreement_template", report_id=1)
        response = await client.get(url)
        assert response.status_code == 200
        mock_export.assert_awaited_once()


@pytest.mark.anyio
async def test_get_allocation_agreement_import_status(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])

    with patch.object(
        AllocationAgreementImporter,
        "get_status",
        new=AsyncMock(return_value={"progress": 42}),
    ) as mock_status:
        # For this route, we don't actually check compliance_report_id,
        # so no patch needed for validate_organization_access
        url = fastapi_app.url_path_for(
            "get_allocation_agreement_import_status", job_id="abc123"
        )
        response = await client.get(url)
        assert response.status_code == HTTP_200_OK
        data = response.json()
        assert data["progress"] == 42
        mock_status.assert_awaited_once_with("abc123")


# Tests for editable validation
@pytest.mark.anyio
async def test_save_allocation_agreement_draft_status_allowed(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test that saving is allowed when compliance report is in Draft status"""
    mock_report = ComplianceReport(organization=Organization())
    mock_report.current_status = MagicMock()
    mock_report.current_status.status = ComplianceReportStatusEnum.Draft

    with patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_org, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_access, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_editable"
    ) as mock_validate_editable, patch(
        "lcfs.web.api.allocation_agreement.services.AllocationAgreementServices.create_allocation_agreement"
    ) as mock_create, patch(
        "lcfs.web.api.allocation_agreement.validation.AllocationAgreementValidation.validate_compliance_report_id"
    ) as mock_validate_id:

        mock_validate_org.return_value = mock_report
        mock_validate_access.return_value = None
        mock_validate_editable.return_value = None  # Should not raise exception
        mock_validate_id.return_value = None
        mock_create.return_value = AllocationAgreementSchema(
            allocation_agreement_id=1,
            compliance_report_id=1,
            allocation_transaction_type="Allocated from",
            transaction_partner="Test Partner",
            postal_address="123 Test St",
            transaction_partner_email="test@example.com",
            transaction_partner_phone="555-1234",
            fuel_type="Biodiesel",
            fuel_category="Diesel",
            provision_of_the_act="Default carbon intensity - section 19 (b) (ii)",
            quantity=1000,
            units="L",
            group_uuid="test-uuid",
            version=1,
            action_type="CREATE",
        )

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_allocation_agreements_row")
        payload = {
            "compliance_report_id": 1,
            "allocation_transaction_type": "Allocated from",
            "transaction_partner": "Test Partner",
            "postal_address": "123 Test St",
            "transaction_partner_email": "test@example.com",
            "transaction_partner_phone": "555-1234",
            "fuel_type": "Biodiesel",
            "fuel_category": "Diesel",
            "provision_of_the_act": "Default carbon intensity - section 19 (b) (ii)",
            "quantity": 1000,
            "units": "L",
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 200
        mock_validate_editable.assert_called_once()


@pytest.mark.anyio
async def test_save_allocation_agreement_submitted_status_blocked(
    client: AsyncClient, fastapi_app: FastAPI, set_mock_user
):
    """Test that saving is blocked when compliance report is in Submitted status"""
    from fastapi import HTTPException

    mock_report = ComplianceReport(organization=Organization())
    mock_report.current_status = MagicMock()
    mock_report.current_status.status = ComplianceReportStatusEnum.Submitted

    with patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_org, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_access, patch(
        "lcfs.web.api.compliance_report.validation.ComplianceReportValidation.validate_compliance_report_editable"
    ) as mock_validate_editable:

        mock_validate_org.return_value = mock_report
        mock_validate_access.return_value = None
        mock_validate_editable.side_effect = HTTPException(
            status_code=403,
            detail="Forbidden resource",
        )

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_allocation_agreements_row")
        payload = {
            "compliance_report_id": 1,
            "allocation_transaction_type": "Allocated from",
            "transaction_partner": "Test Partner",
            "postal_address": "123 Test St",
            "transaction_partner_email": "test@example.com",
            "transaction_partner_phone": "555-1234",
            "fuel_type": "Biodiesel",
            "fuel_category": "Diesel",
            "provision_of_the_act": "Default carbon intensity - section 19 (b) (ii)",
            "quantity": 1000,
            "units": "L",
        }
        response = await client.post(url, json=payload)
        assert response.status_code == 403
        assert "Forbidden resource" in response.json()["detail"]
        mock_validate_editable.assert_called_once()
