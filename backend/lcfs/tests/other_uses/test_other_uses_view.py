import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from unittest.mock import MagicMock, AsyncMock

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

@pytest.mark.anyio
async def test_get_table_options(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_other_uses_service,
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_table_options")

    mock_other_uses_service.get_table_options.return_value = {
        "allocationTransactionTypes": [],
        "fuelCategories": [],
        "fuelCodes": [],
        "fuelTypes": [],
        "unitsOfMeasure": [],
    }

    fastapi_app.dependency_overrides[OtherUsesServices] = lambda: mock_other_uses_service

    response = await client.get(url)

    assert response.status_code == 200
    data = response.json()
    assert "allocationTransactionTypes" in data
    assert "fuelCategories" in data
    assert "fuelCodes" in data
    assert "fuelTypes" in data
    assert "unitsOfMeasure" in data

@pytest.mark.anyio
async def test_get_other_uses(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_other_uses_service,
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_other_uses")
    payload = {"compliance_report_id": 1}

    mock_other_uses_service.get_other_uses.return_value = {"otherUses": []}

    fastapi_app.dependency_overrides[OtherUsesServices] = lambda: mock_other_uses_service

    response = await client.post(url, json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "otherUses" in data

@pytest.mark.anyio
async def test_get_other_uses_paginated(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_other_uses_service,
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_other_uses_paginated")
    payload = {
        "complianceReportId": 1,
        "page": 1,
        "size": 10,
        "sort_orders": [],
        "filters": [],
    }

    mock_other_uses_service.get_other_uses_paginated.return_value = {
        "pagination": {"total": 0, "page": 1, "size": 10, "totalPages": 1},
        "otherUses": [],
    }

    fastapi_app.dependency_overrides[OtherUsesServices] = lambda: mock_other_uses_service

    response = await client.post(url, json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "pagination" in data
    assert "otherUses" in data

@pytest.mark.anyio
async def test_save_other_uses_row_create(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_other_uses_service,
    mock_other_uses_validation,
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("save_other_uses_row")
    payload = {
        "compliance_report_id": 1,
        "quantity_supplied": 1000,
        "fuel_type": "Gasoline",
        "fuel_category": "Petroleum-based",
        "expected_use": "Transportation",
        "units": "L",
        "rationale": "Test rationale",
    }

    mock_other_uses_service.create_other_use.return_value = {
        "otherUsesId": 1,
        "complianceReportId": 1,
        "quantitySupplied": 1000,
        "fuelType": "Gasoline",
        "fuelCategory": "Petroleum-based",
        "expectedUse": "Transportation",
        "units": "L",
        "rationale": "Test rationale",
    }

    fastapi_app.dependency_overrides[OtherUsesServices] = lambda: mock_other_uses_service
    fastapi_app.dependency_overrides[OtherUsesValidation] = lambda: mock_other_uses_validation

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
    set_mock_user_roles,
    mock_other_uses_service,
    mock_other_uses_validation,
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("save_other_uses_row")
    payload = {
        "other_uses_id": 1,
        "compliance_report_id": 1,
        "quantity_supplied": 2000,
        "fuel_type": "Diesel",
        "fuel_category": "Petroleum-based",
        "expected_use": "Transportation",
        "units": "L",
        "rationale": "Updated rationale",
    }

    mock_other_uses_service.update_other_use.return_value = {
        "otherUsesId": 1,
        "complianceReportId": 1,
        "quantitySupplied": 2000,
        "fuelType": "Diesel",
        "fuelCategory": "Petroleum-based",
        "expectedUse": "Transportation",
        "units": "L",
        "rationale": "Updated rationale",
    }

    fastapi_app.dependency_overrides[OtherUsesServices] = lambda: mock_other_uses_service
    fastapi_app.dependency_overrides[OtherUsesValidation] = lambda: mock_other_uses_validation

    response = await client.post(url, json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["otherUsesId"] == 1
    assert data["quantitySupplied"] == 2000
    assert data["fuelType"] == "Diesel"

@pytest.mark.anyio
async def test_save_other_uses_row_delete(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user_roles,
    mock_other_uses_service,
    mock_other_uses_validation,
):
    set_mock_user_roles(fastapi_app, ["Supplier"])
    
    url = fastapi_app.url_path_for("save_other_uses_row")
    payload = {
        "other_uses_id": 1,
        "compliance_report_id": 1,
        "quantity_supplied": 0,
        "fuel_type": "",
        "fuel_category": "",
        "expected_use": "",
        "units": "",
        "rationale": "",
        "deleted": True,
    }

    # Mock the delete_other_use method to return None
    mock_other_uses_service.delete_other_use.return_value = None

    # Mock the validation methods to avoid any validation errors
    mock_other_uses_validation.validate_organization_access.return_value = None
    mock_other_uses_validation.validate_compliance_report_id.return_value = None

    fastapi_app.dependency_overrides[OtherUsesServices] = lambda: mock_other_uses_service
    fastapi_app.dependency_overrides[OtherUsesValidation] = lambda: mock_other_uses_validation

    response = await client.post(url, json=payload)

    assert response.status_code == 200, f"Unexpected status code: {response.status_code}. Response: {response.text}"
    data = response.json()
    assert data == {"message": "Other use deleted successfully"}

    # Verify that the delete_other_use method was called with the correct parameter
    mock_other_uses_service.delete_other_use.assert_called_once_with(1)

    # Verify that the validation methods were called
    mock_other_uses_validation.validate_organization_access.assert_called_once_with(1)
    mock_other_uses_validation.validate_compliance_report_id.assert_called_once()