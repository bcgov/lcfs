import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from unittest.mock import MagicMock, AsyncMock, patch

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.fuel_supply.validation import FuelSupplyValidation
from lcfs.web.api.fuel_supply.actions_service import FuelSupplyActionService


@pytest.fixture
def mock_fuel_supply_action_service():
    return MagicMock(spec=FuelSupplyActionService)


@pytest.fixture
def mock_compliance_report_validation():
    validation = MagicMock(spec=ComplianceReportValidation)
    mock_repo = MagicMock()
    mock_repo.get_compliance_report.return_value = MagicMock(organization_id=1)
    validation.repo = mock_repo
    validation.request = MagicMock()
    validation.request.user.organization.organization_id = 1
    return validation


@pytest.fixture
def mock_fuel_supply_validation():
    validation = MagicMock(spec=FuelSupplyValidation)
    validation.check_duplicate = AsyncMock(return_value=None)
    return validation


@pytest.mark.anyio
async def test_save_fuel_supply_row_create(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_action_service,
    mock_compliance_report_validation,
    mock_fuel_supply_validation,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
    url = fastapi_app.url_path_for("save_fuel_supply_row")
    payload = {
        "compliance_report_id": 1,
        "fuel_type_id": 1,
        "fuel_category_id": 1,
        "end_use_id": 24,
        "provision_of_the_act_id": 1,
        "quantity": 1000,
        "units": "L",
    }

    # Mock the create method with all required fields
    mock_fuel_supply_action_service.create_fuel_supply.return_value = {
        "fuelSupplyId": 1,
        "complianceReportId": 1,
        "fuelTypeId": 1,
        "fuelType": "Gasoline",
        "units": "liters",
        "fuelCategory": "category",
        "fuelCategoryId": 1,
        "endUseType": "endUseType",
        "endUseId": 1,
        "quantity": 1000,
        "groupUuid": "some-uuid",
        "version": 1,
        "userType": "SUPPLIER",
        "actionType": "CREATE",
        "provisionOfTheActId": 1,
    }

    # Override dependencies
    fastapi_app.dependency_overrides[ComplianceReportValidation] = (
        lambda: mock_compliance_report_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyValidation] = (
        lambda: mock_fuel_supply_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyActionService] = (
        lambda: mock_fuel_supply_action_service
    )

    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "fuelSupplyId" in data
    assert data["fuelType"] == "Gasoline"
    assert data["quantity"] == 1000


@pytest.mark.anyio
async def test_save_fuel_supply_row_update(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_action_service,
    mock_compliance_report_validation,
    mock_fuel_supply_validation,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
    url = fastapi_app.url_path_for("save_fuel_supply_row")

    payload = {
        "compliance_report_id": 1,
        "fuel_supply_id": 123,
        "fuel_type_id": 1,
        "fuel_category_id": 1,
        "end_use_id": 24,
        "provision_of_the_act_id": 1,
        "quantity": 1000,
        "units": "L",
    }

    # Mock the update method with all required fields
    mock_fuel_supply_action_service.update_fuel_supply.return_value = {
        "fuelSupplyId": 1,
        "complianceReportId": 1,
        "fuelTypeId": 1,
        "fuelType": "Diesel",
        "units": "liters",
        "fuelCategory": "category",
        "fuelCategoryId": 1,
        "endUseType": "endUseType",
        "endUseId": 1,
        "quantity": 2000,
        "groupUuid": "some-uuid",
        "version": 1,
        "userType": "SUPPLIER",
        "actionType": "UPDATE",
        "provisionOfTheActId": 1,
    }

    # Override dependencies
    fastapi_app.dependency_overrides[ComplianceReportValidation] = (
        lambda: mock_compliance_report_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyValidation] = (
        lambda: mock_fuel_supply_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyActionService] = (
        lambda: mock_fuel_supply_action_service
    )

    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "fuelSupplyId" in data
    assert data["fuelType"] == "Diesel"
    assert data["quantity"] == 2000


@pytest.mark.anyio
async def test_save_fuel_supply_row_delete(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_action_service,
    mock_compliance_report_validation,
    mock_fuel_supply_validation,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
    url = fastapi_app.url_path_for("save_fuel_supply_row")
    payload = {
        "compliance_report_id": 1,
        "fuel_supply_id": 123,
        "fuel_type_id": 1,
        "fuel_category_id": 1,
        "end_use_id": 24,
        "provision_of_the_act_id": 1,
        "quantity": 1000,
        "units": "L",
        "deleted": True,
    }

    # Mock the delete method with all required fields
    mock_fuel_supply_action_service.delete_fuel_supply.return_value = {
        "success": True,
        "message": "Fuel supply row deleted successfully",
        "groupUuid": "some-uuid",
        "version": 1,
        "userType": "SUPPLIER",
        "actionType": "DELETE",
    }

    # Override dependencies
    fastapi_app.dependency_overrides[ComplianceReportValidation] = (
        lambda: mock_compliance_report_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyValidation] = (
        lambda: mock_fuel_supply_validation
    )
    fastapi_app.dependency_overrides[FuelSupplyActionService] = (
        lambda: mock_fuel_supply_action_service
    )

    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data == {"success": True, "message": "Fuel supply row deleted successfully"}


@pytest.mark.anyio
async def test_save_fuel_supply_row_duplicate(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_fuel_supply_action_service,
    mock_fuel_supply_validation,
):
    set_mock_user(fastapi_app, [RoleEnum.SUPPLIER, RoleEnum.COMPLIANCE_REPORTING])
    url = fastapi_app.url_path_for("save_fuel_supply_row")
    payload = {
        "compliance_report_id": 1,
        "fuel_supply_id": None,
        "deleted": False,
    }

    # Mock the validation method to simulate a duplicate
    mock_fuel_supply_validation.check_duplicate = AsyncMock(return_value=True)

    # Override dependencies
    fastapi_app.dependency_overrides[FuelSupplyActionService] = (
        lambda: mock_fuel_supply_action_service
    )
    fastapi_app.dependency_overrides[FuelSupplyValidation] = (
        lambda: mock_fuel_supply_validation
    )

    response = await client.post(url, json=payload)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = response.json()
    assert "Validation failed" in data["message"]
