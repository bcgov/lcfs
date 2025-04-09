import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from unittest.mock import MagicMock, AsyncMock, patch

from lcfs.db.models import ComplianceReport
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.compliance_report.conftest import compliance_report_base_schema
from lcfs.tests.notional_transfer.conftest import create_mock_schema
from lcfs.web.api.base import ComplianceReportRequestSchema
from lcfs.web.api.notional_transfer.schema import NotionalTransferTableOptionsSchema
from lcfs.web.api.notional_transfer.schema import (
    PaginatedNotionalTransferRequestSchema,
    DeleteNotionalTransferResponseSchema,
)
from lcfs.web.api.notional_transfer.services import NotionalTransferServices
from lcfs.web.api.notional_transfer.validation import NotionalTransferValidation


@pytest.fixture
def mock_notional_transfer_service():
    return MagicMock(spec=NotionalTransferServices)


@pytest.fixture
def mock_notional_transfer_validation():
    validation = MagicMock(spec=NotionalTransferValidation)
    validation.validate_organization_access = AsyncMock()
    validation.validate_compliance_report_id = AsyncMock()
    return validation


@pytest.mark.anyio
async def test_get_table_options(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_notional_transfer_service,
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
    url = "/api/notional-transfers/table-options"

    # Mock the service's get_table_options method to return the expected schema instance
    mock_notional_transfer_service.get_table_options.return_value = (
        NotionalTransferTableOptionsSchema(
            fuel_categories=[],
            received_or_transferred=[],
        )
    )

    # Override the dependency
    fastapi_app.dependency_overrides[NotionalTransferServices] = (
        lambda: mock_notional_transfer_service
    )

    response = await client.get(url)

    assert response.status_code == 200
    data = response.json()
    assert "fuelCategories" in data
    assert "receivedOrTransferred" in data


@pytest.mark.anyio
async def test_get_notional_transfers(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_notional_transfer_service,
):
    with patch(
        "lcfs.web.api.notional_transfer.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.notional_transfer.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access, patch(
        "lcfs.web.api.notional_transfer.views.NotionalTransferServices.get_compliance_report_by_id"
    ) as mock_get_compliance_report_by_id:
        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("get_notional_transfers")
        payload = ComplianceReportRequestSchema(compliance_report_id=1).model_dump()

        mock_validate_organization_access.return_value = True

        mock_get_compliance_report_by_id.return_value = compliance_report_base_schema
        mock_validate_compliance_report_access.return_value = True

        mock_notional_transfer_service.get_notional_transfers.return_value = {
            "notionalTransfers": []
        }

        fastapi_app.dependency_overrides[NotionalTransferServices] = (
            lambda: mock_notional_transfer_service
        )

        response = await client.post(url, json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "notionalTransfers" in data


@pytest.mark.anyio
async def test_get_notional_transfers_paginated(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_notional_transfer_service,
):
    with patch(
        "lcfs.web.api.notional_transfer.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access:
        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("get_notional_transfers_paginated")
        payload = PaginatedNotionalTransferRequestSchema(
            compliance_report_id=1,
            page=1,
            size=10,
            sort_orders=[],
            filters=[],
        ).model_dump()

        mock_validate_organization_access.return_value = True
        mock_notional_transfer_service.get_notional_transfers_paginated.return_value = {
            "pagination": {"total": 0, "page": 1, "size": 10, "totalPages": 1},
            "notionalTransfers": [],
        }

        fastapi_app.dependency_overrides[NotionalTransferServices] = (
            lambda: mock_notional_transfer_service
        )

        response = await client.post(url, json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "pagination" in data
        assert "notionalTransfers" in data


@pytest.mark.anyio
async def test_save_notional_transfer_row_create(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_notional_transfer_service,
    mock_notional_transfer_validation,
):
    with patch(
        "lcfs.web.api.notional_transfer.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access:
        mock_validate_organization_access.return_value = ComplianceReport()
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_notional_transfer_row")
        payload = create_mock_schema({}).model_dump()

        mock_notional_transfer_service.create_notional_transfer.return_value = payload

        fastapi_app.dependency_overrides[NotionalTransferServices] = (
            lambda: mock_notional_transfer_service
        )
        fastapi_app.dependency_overrides[NotionalTransferValidation] = (
            lambda: mock_notional_transfer_validation
        )

        response = await client.post(url, json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "notionalTransferId" in data
        assert data["quantity"] == 1000
        assert data["fuelCategory"] == "Gasoline"


@pytest.mark.anyio
async def test_save_notional_transfer_row_update(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_notional_transfer_service,
    mock_notional_transfer_validation,
):
    with patch(
        "lcfs.web.api.notional_transfer.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access:
        mock_validate_organization_access.return_value = ComplianceReport()
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_notional_transfer_row")
        payload = create_mock_schema(
            {
                "notional_transfer_id": 1,
                "quantity": 2000,
                "legal_name": "Updated Legal Name",
            }
        ).model_dump()

        mock_notional_transfer_service.update_notional_transfer.return_value = payload

        fastapi_app.dependency_overrides[NotionalTransferServices] = (
            lambda: mock_notional_transfer_service
        )
        fastapi_app.dependency_overrides[NotionalTransferValidation] = (
            lambda: mock_notional_transfer_validation
        )

        response = await client.post(url, json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["notionalTransferId"] == 1
        assert data["quantity"] == 2000
        assert data["fuelCategory"] == "Gasoline"


@pytest.mark.anyio
async def test_save_notional_transfer_row_delete(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_notional_transfer_service,
    mock_notional_transfer_validation,
):
    with patch(
        "lcfs.web.api.notional_transfer.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.fuel_export.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access:
        mock_validate_organization_access.return_value = ComplianceReport()
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
        url = "/api/notional-transfers/save"
        mock_schema = create_mock_schema(
            {
                "notional_transfer_id": 1,
                "deleted": True,
                "compliance_report_id": 1,
            }
        )

        # Return an appropriate response object instead of None
        mock_notional_transfer_service.delete_notional_transfer.return_value = (
            DeleteNotionalTransferResponseSchema(
                message="Notional transfer deleted successfully"
            )
        )
        mock_notional_transfer_validation.validate_compliance_report_id.return_value = (
            None
        )

        fastapi_app.dependency_overrides[NotionalTransferServices] = (
            lambda: mock_notional_transfer_service
        )
        fastapi_app.dependency_overrides[NotionalTransferValidation] = (
            lambda: mock_notional_transfer_validation
        )

        response = await client.post(url, json=mock_schema.model_dump())

        assert response.status_code == 200
        data = response.json()
        assert data == {"message": "Notional transfer deleted successfully"}

        mock_notional_transfer_service.delete_notional_transfer.assert_called_once_with(
            mock_schema
        )
