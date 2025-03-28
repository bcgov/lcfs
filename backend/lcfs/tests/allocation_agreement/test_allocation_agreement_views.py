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
