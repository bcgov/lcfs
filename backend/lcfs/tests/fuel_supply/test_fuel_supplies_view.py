import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from unittest.mock import MagicMock, Mock, AsyncMock

from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.fuel_supply.services import FuelSupplyServices
from lcfs.web.api.fuel_supply.validation import FuelSupplyValidation


@pytest.fixture
def mock_fuel_supply_service():
    return MagicMock(spec=FuelSupplyServices)


@pytest.fixture
def mock_compliance_report_validation():
    validation = MagicMock(spec=ComplianceReportValidation)

    # Create a mock for the repo attribute
    mock_repo = MagicMock()

    # Mock the get_compliance_report method to return a valid report
    mock_repo.get_compliance_report.return_value = MagicMock(
        organization_id=1  # Set the expected organization ID
    )

    # Attach the mocked repo to the validation mock
    validation.repo = mock_repo

    # Mock request user organization
    validation.request = MagicMock()
    validation.request.user.organization.organization_id = (
        1  # Match the organization ID
    )
    return validation


@pytest.fixture
def mock_fuel_supply_validation():
    validation = Mock(spec=FuelSupplyValidation)

    validation.check_duplicate = AsyncMock(return_value=None)

    return validation


@pytest.mark.anyio
async def test_get_fs_table_options(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_service,
):
    set_mock_user(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_fs_table_options")
    params = {"compliancePeriod": "2023"}

    # Mock the service method
    mock_fuel_supply_service.get_fuel_supply_options.return_value = {
        "fuelTypes": [],
        "fuelInstances": [],
    }

    # Use dependency override
    fastapi_app.dependency_overrides[FuelSupplyServices] = (
        lambda: mock_fuel_supply_service
    )

    response = await client.get(url, params=params)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert "fuelTypes" in data
    assert isinstance(data["fuelTypes"], list)


@pytest.mark.anyio
async def test_get_fuel_supply_list(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_service,
):
    set_mock_user(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("get_fuel_supply")
    payload = {
        "compliance_report_id": 1,
        "page": 1,
        "size": 10,
        "sort_orders": [],
        "filters": [],
    }

    # Mock the service method
    mock_fuel_supply_service.get_fuel_supplies_paginated.return_value = {
        "pagination": {"total": 0, "page": 1, "size": 5, "totalPages": 1},
        "fuelSupplies": [],
    }

    # Use dependency override
    fastapi_app.dependency_overrides[FuelSupplyServices] = (
        lambda: mock_fuel_supply_service
    )

    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "pagination" in data
    assert "fuelSupplies" in data
    assert isinstance(data["fuelSupplies"], list)


@pytest.mark.anyio
async def test_save_fuel_supply_row_create(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_service,
    mock_compliance_report_validation,
    mock_fuel_supply_validation,
):
    set_mock_user(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("save_fuel_supply_row")
    payload = {
        "compliance_report_id": 1,
        "fuel_type_id": 1,
        "fuel_category_id": 1,
        "provision_of_the_act_id": 1,
        "quantity": 1000,
        "units": "L",
    }

    # Mock the service method
    mock_fuel_supply_service.create_fuel_supply.return_value = {
        "fuelSupplyId": 1,
        "complianceReportId": 1,
        "fuelTypeId": 1,
        "fuelType": {"fuelType": "Gasoline", "fuelTypeId": 1, "units": "L"},
        "units": "liters",
        "fuelCategory": {"category": "category"},
        "quantity": 1000,
    }

    # Use dependency override
    fastapi_app.dependency_overrides[ComplianceReportValidation] = (
        lambda: mock_compliance_report_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyValidation] = (
        lambda: mock_fuel_supply_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyServices] = (
        lambda: mock_fuel_supply_service
    )

    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()

    assert isinstance(data, dict)
    assert "fuelSupplyId" in data
    assert "complianceReportId" in data
    assert data["fuelType"]["fuelType"] == "Gasoline"
    assert data["quantity"] == 1000


@pytest.mark.anyio
async def test_save_fuel_supply_row_update(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_service,
    mock_compliance_report_validation,
    mock_fuel_supply_validation,
):
    set_mock_user(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("save_fuel_supply_row")
    print("URL ------------------", url)

    payload = {
        "compliance_report_id": 1,
        "fuel_supply_id": 123,  # ID For update
        "fuel_type_id": 1,
        "fuel_category_id": 1,
        "provision_of_the_act_id": 1,
        "quantity": 1000,
        "units": "L",
    }

    # Mock the service method
    mock_fuel_supply_service.update_fuel_supply.return_value = {
        "fuelSupplyId": 1,
        "complianceReportId": 1,
        "fuelTypeId": 1,
        "fuelType": {"fuelType": "Diesel", "fuelTypeId": 1, "units": "L"},
        "units": "liters",
        "fuelCategory": {"category": "category"},
        "quantity": 2000,
    }

    # Use dependency override
    fastapi_app.dependency_overrides[ComplianceReportValidation] = (
        lambda: mock_compliance_report_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyValidation] = (
        lambda: mock_fuel_supply_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyServices] = (
        lambda: mock_fuel_supply_service
    )

    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()

    assert "fuelSupplyId" in data
    assert "complianceReportId" in data
    assert data["fuelSupplyId"] == 1
    assert data["fuelType"]["fuelType"] == "Diesel"
    assert data["quantity"] == 2000


@pytest.mark.anyio
async def test_save_fuel_supply_row_delete(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_service,
    mock_compliance_report_validation,
    mock_fuel_supply_validation,
):
    set_mock_user(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("save_fuel_supply_row")
    payload = {
        "compliance_report_id": 1,
        "fuel_supply_id": 123,  # Existing ID for deletion
        "fuel_type_id": 1,
        "fuel_category_id": 1,
        "provision_of_the_act_id": 1,
        "quantity": 1000,
        "units": "L",
        "deleted": True,
    }

    # Mock the service method
    mock_fuel_supply_service.delete_fuel_supply.return_value = None

    # Use dependency override
    fastapi_app.dependency_overrides[ComplianceReportValidation] = (
        lambda: mock_compliance_report_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyValidation] = (
        lambda: mock_fuel_supply_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyServices] = (
        lambda: mock_fuel_supply_service
    )

    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data == {"success": True, "message": "fuel supply row deleted successfully"}


@pytest.mark.anyio
async def test_save_fuel_supply_row_duplicate(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_service,
    mock_fuel_supply_validation,
):
    set_mock_user(fastapi_app, ["Supplier"])
    url = fastapi_app.url_path_for("save_fuel_supply_row")
    payload = {
        "compliance_report_id": 1,
        "fuel_supply_id": None,
        "deleted": False,
    }

    # Mock the validation method to simulate a duplicate
    mock_fuel_supply_validation.check_duplicate = AsyncMock(return_value=True)
    # Use dependency override
    fastapi_app.dependency_overrides[FuelSupplyServices] = (
        lambda: mock_fuel_supply_service
    )
    fastapi_app.dependency_overrides[FuelSupplyValidation] = (
        lambda: mock_fuel_supply_validation
    )

    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = response.json()
    assert "Validation failed" in data["message"]
