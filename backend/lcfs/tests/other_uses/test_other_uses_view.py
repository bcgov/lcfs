import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from unittest.mock import MagicMock, AsyncMock, patch

from lcfs.db.models import ComplianceReport
from lcfs.db.models.user.Role import RoleEnum
from lcfs.tests.compliance_report.conftest import compliance_report_base_schema
from lcfs.tests.other_uses.conftest import create_mock_schema
from lcfs.web.api.base import ComplianceReportRequestSchema
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.other_uses.schema import (
    PaginatedOtherUsesRequestSchema,
    OtherUsesSchema,
)
from lcfs.web.api.other_uses.services import OtherUsesServices
from lcfs.web.api.other_uses.validation import OtherUsesValidation


@pytest.fixture
def mock_other_uses_service():
    return MagicMock(spec=OtherUsesServices)


@pytest.fixture
def mock_other_uses_validation():
    validation = MagicMock(spec=OtherUsesValidation)
    validation.validate_organization_access = AsyncMock()
    validation.validate_compliance_report_id = AsyncMock()
    return validation


@pytest.fixture
def mock_report_validation():
    validation = MagicMock(spec=ComplianceReportValidation)
    validation.validate_organization_access.return_value = ComplianceReport()
    validation.validate_compliance_report_access = AsyncMock()
    return validation


@pytest.mark.anyio
async def test_get_table_options(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_other_uses_service,
):
    set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
    url = fastapi_app.url_path_for("get_table_options")

    mock_other_uses_service.get_table_options.return_value = {
        "allocationTransactionTypes": [],
        "fuelTypes": [],
    }

    fastapi_app.dependency_overrides[OtherUsesServices] = (
        lambda: mock_other_uses_service
    )

    response = await client.get(url + "?compliancePeriod=2024")

    assert response.status_code == 200
    data = response.json()
    assert "allocationTransactionTypes" in data
    assert "fuelTypes" in data


@pytest.mark.anyio
async def test_get_other_uses(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_other_uses_service,
    mock_report_validation,
):
    with patch(
        "lcfs.web.api.other_uses.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.notional_transfer.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access, patch(
        "lcfs.web.api.notional_transfer.views.NotionalTransferServices.get_compliance_report_by_id"
    ) as mock_get_compliance_report_by_id:

        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("get_other_uses")
        payload = ComplianceReportRequestSchema(compliance_report_id=1).model_dump()

        mock_validate_organization_access.return_value = ComplianceReport()

        mock_get_compliance_report_by_id.return_value = compliance_report_base_schema
        mock_validate_compliance_report_access.return_value = True

        mock_other_uses_service.get_other_uses.return_value = {"otherUses": []}

        fastapi_app.dependency_overrides[OtherUsesServices] = (
            lambda: mock_other_uses_service
        )

        response = await client.post(url, json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "otherUses" in data


@pytest.mark.anyio
async def test_get_other_uses_paginated(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_other_uses_service,
):
    with patch(
        "lcfs.web.api.other_uses.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.notional_transfer.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access:
        set_mock_user(fastapi_app, [RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("get_other_uses_paginated")
        payload = PaginatedOtherUsesRequestSchema(
            compliance_report_id=1,
            page=1,
            size=10,
            sort_orders=[],
            filters=[],
        ).model_dump()

        mock_validate_organization_access.return_value = ComplianceReport()
        mock_other_uses_service.get_other_uses_paginated.return_value = {
            "pagination": {"total": 0, "page": 1, "size": 10, "totalPages": 1},
            "otherUses": [],
        }

        fastapi_app.dependency_overrides[OtherUsesServices] = (
            lambda: mock_other_uses_service
        )

        response = await client.post(url, json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "pagination" in data
        assert "otherUses" in data


@pytest.mark.anyio
async def test_save_other_uses_row_create(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_other_uses_service,
    mock_other_uses_validation,
):
    with patch(
        "lcfs.web.api.other_uses.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.notional_transfer.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access:
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_other_uses_row")
        payload = create_mock_schema({}).model_dump()

        # Mock the service method to return a valid schema object
        mock_other_uses_service.create_other_use.return_value = OtherUsesSchema(
            **payload
        )

        mock_validate_organization_access.return_value = ComplianceReport()

        fastapi_app.dependency_overrides[OtherUsesServices] = (
            lambda: mock_other_uses_service
        )
        fastapi_app.dependency_overrides[OtherUsesValidation] = (
            lambda: mock_other_uses_validation
        )

        response = await client.post(url, json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "otherUsesId" in data
        assert data["quantitySupplied"] == 1000
        assert data["fuelType"] == "Gasoline"


@pytest.mark.anyio
async def test_save_other_uses_row_update(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_other_uses_service,
    mock_other_uses_validation,
):
    with patch(
        "lcfs.web.api.other_uses.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.notional_transfer.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access:
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_other_uses_row")
        payload = create_mock_schema(
            {
                "other_uses_id": 1,
                "quantity_supplied": 2000,
                "rationale": "Updated rationale",
            }
        ).model_dump()

        mock_other_uses_service.update_other_use.return_value = payload
        mock_validate_organization_access.return_value = ComplianceReport()

        fastapi_app.dependency_overrides[OtherUsesServices] = (
            lambda: mock_other_uses_service
        )
        fastapi_app.dependency_overrides[OtherUsesValidation] = (
            lambda: mock_other_uses_validation
        )

        response = await client.post(url, json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["other_uses_id"] == 1
        assert data["quantity_supplied"] == 2000
        assert data["fuel_type"] == "Gasoline"


@pytest.mark.anyio
async def test_save_other_uses_row_delete(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_other_uses_service,
    mock_other_uses_validation,
):
    with patch(
        "lcfs.web.api.other_uses.views.ComplianceReportValidation.validate_organization_access"
    ) as mock_validate_organization_access, patch(
        "lcfs.web.api.notional_transfer.views.ComplianceReportValidation.validate_compliance_report_access"
    ) as mock_validate_compliance_report_access:
        set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
        url = fastapi_app.url_path_for("save_other_uses_row")
        mock_schema = create_mock_schema(
            {
                "other_uses_id": 1,
                "deleted": True,
            }
        )

        mock_other_uses_service.delete_other_use.return_value = None
        mock_validate_organization_access.return_value = ComplianceReport()
        mock_other_uses_validation.validate_compliance_report_id.return_value = None

        fastapi_app.dependency_overrides[OtherUsesServices] = (
            lambda: mock_other_uses_service
        )
        fastapi_app.dependency_overrides[OtherUsesValidation] = (
            lambda: mock_other_uses_validation
        )

        response = await client.post(url, json=mock_schema.model_dump())

        assert response.status_code == 200
        data = response.json()
        assert data == {"message": "Other use deleted successfully"}

        mock_other_uses_service.delete_other_use.assert_called_once_with(mock_schema)
        mock_validate_organization_access.assert_called_once_with(1)
        mock_other_uses_validation.validate_compliance_report_id.assert_called_once()
