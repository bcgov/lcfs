import pytest
from fastapi import FastAPI, status
from httpx import AsyncClient
from unittest.mock import MagicMock, AsyncMock

from lcfs.utils.constants import FUEL_CATEGORIES
from lcfs.web.api.calculator.services import CalculatorService


@pytest.fixture
def mock_calculator_service():
    service = MagicMock(spec=CalculatorService)
    # Update method names to match the new view function calls
    service.get_compliance_periods = AsyncMock()
    service.get_fuel_types = AsyncMock()
    service.get_fuel_type_options = AsyncMock()
    service.get_calculated_data = AsyncMock()
    service.get_quantity_from_compliance_units = AsyncMock()
    service.get_lookup_table_data = AsyncMock()
    return service


@pytest.mark.anyio
async def test_get_calculator_compliance_periods(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    # Mock data for compliance periods
    mock_compliance_periods = [
        {"description": "2023", "compliancePeriodId": 1},
        {"description": "2022", "compliancePeriodId": 2},
    ]
    # Use the updated method name
    mock_calculator_service.get_compliance_periods.return_value = (
        mock_compliance_periods
    )

    # Override dependencies
    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    # Call the endpoint
    url = fastapi_app.url_path_for("get_calculator_compliance_periods")
    response = await client.get(url)

    # Assertions
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) == 2
    assert data[0]["description"] == "2023"
    assert data[1]["description"] == "2022"

    # Verify the service method was called
    mock_calculator_service.get_compliance_periods.assert_called_once()


@pytest.mark.anyio
async def test_get_calculator_fuel_types_valid_category(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    # Mock data for fuel types
    mock_fuel_types = [
        {
            "fuelType": "Gasoline",
            "fuelTypeId": 1,
            "fuelCategory": "Gasoline",
            "fuelCategoryId": 1,
        },
        {
            "fuelType": "Diesel",
            "fuelTypeId": 2,
            "fuelCategory": "Diesel",
            "fuelCategoryId": 2,
        },
    ]
    # Use the updated method name
    mock_calculator_service.get_fuel_types.return_value = mock_fuel_types

    # Override dependencies
    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    # Call the endpoint with valid category
    compliance_period = 2023
    fuel_category = FUEL_CATEGORIES[0]  # First valid fuel category
    url = fastapi_app.url_path_for(
        "get_calculator_fuel_types", compliance_period=compliance_period
    )
    response = await client.get(f"{url}?fuel_category={fuel_category}&lcfs_only=false")

    # Assertions
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) == 2
    assert data[0]["fuelType"] == "Gasoline"
    assert data[1]["fuelType"] == "Diesel"

    # Verify the service method was called with expected parameters
    mock_calculator_service.get_fuel_types.assert_called_once_with(
        compliance_period, False, fuel_category
    )


@pytest.mark.anyio
async def test_get_calculator_fuel_types_invalid_category(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    # Override dependencies
    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    # Call the endpoint with invalid category
    compliance_period = 2023
    fuel_category = "InvalidCategory"
    url = fastapi_app.url_path_for(
        "get_calculator_fuel_types", compliance_period=compliance_period
    )
    response = await client.get(f"{url}?fuel_category={fuel_category}")

    # Assertions
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data == []

    # Verify the service method was not called
    mock_calculator_service.get_fuel_types.assert_not_called()


@pytest.mark.anyio
async def test_get_calculator_fuel_type_options(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    # Mock data for fuel type options
    mock_fuel_type_options = {
        "provisions": [
            {"provisionOfTheActId": 1, "name": "Provision 1"},
            {"provisionOfTheActId": 2, "name": "Provision 2"},
        ],
        "fuelCodes": [
            {"fuelCodeId": 1, "fuelCode": "FC001"},
            {"fuelCodeId": 2, "fuelCode": "FC002"},
        ],
        "eerRatios": [
            {"endUseType": {"type": "EndUse1", "endUseTypeId": 1}},
            {"endUseType": {"type": "EndUse2", "endUseTypeId": 2}},
        ],
        "unit": "liters",
        "energyDensity": {"unit": {"name": "MJ/L"}},
    }
    # Use the updated method name
    mock_calculator_service.get_fuel_type_options.return_value = mock_fuel_type_options

    # Override dependencies
    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    # Call the endpoint
    compliance_period = "2023"
    fuel_category_id = 1
    fuel_type_id = 1
    url = fastapi_app.url_path_for(
        "get_calculator_fuel_type_options", compliance_period=compliance_period
    )
    query_params = f"?fuel_category_id={fuel_category_id}&fuel_type_id={fuel_type_id}&lcfs_only=false"
    response = await client.get(f"{url}{query_params}")

    # Assertions
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data["provisions"]) == 2
    assert len(data["fuelCodes"]) == 2
    assert len(data["eerRatios"]) == 2
    assert data["unit"] == "liters"

    # Verify the service method was called with expected parameters
    mock_calculator_service.get_fuel_type_options.assert_called_once_with(
        compliance_period, fuel_type_id, fuel_category_id, False
    )


@pytest.mark.anyio
async def test_get_calculated_data(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    # Update the mock data to include the 'quantity' field which is required in the response schema
    mock_calculated_data = {
        "complianceUnits": 100,
        "tci": 80,
        "eer": 1.0,
        "rci": 75,
        "uci": 0,
        "energyContent": 10000,
        "energyDensity": 38.5,
        "quantity": 1000,  # Added this field to match CreditsResultSchema
    }
    mock_calculator_service.get_calculated_data.return_value = mock_calculated_data

    # Override dependencies
    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    # We need to use the correct aliases as defined in the CalculatorQueryParams schema
    compliance_period = "2023"

    # Use the correct query parameter names (with aliases)
    params = {
        "fuelTypeId": 1,
        "fuelCategoryId": 1,
        "endUseId": 1,
        "fuelCodeId": 2,
        "quantity": 1000,
    }

    url = fastapi_app.url_path_for(
        "get_calculated_data", compliance_period=compliance_period
    )

    # Test with the aliased query parameters
    response = await client.get(url, params=params)

    # Assertions
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["complianceUnits"] == 100
    assert data["tci"] == 80
    assert data["eer"] == 1.0
    assert data["energyContent"] == 10000
    assert data["quantity"] == 1000  # Verify the quantity field in the response

    # Verify the service method was called with expected parameters
    # Note that the service method expects snake_case, not camelCase
    mock_calculator_service.get_calculated_data.assert_called_once_with(
        compliance_period,
        params["fuelTypeId"],
        params["fuelCategoryId"],
        params["endUseId"],
        params["fuelCodeId"],
        params["quantity"],
        False,
        None,
    )


@pytest.mark.anyio
async def test_get_calculated_data_without_optional_params(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    # Mock data for calculated data, including the required 'quantity' field
    mock_calculated_data = {
        "complianceUnits": 100,
        "tci": 80,
        "eer": 1.0,
        "rci": 75,
        "uci": None,
        "energyContent": 10000,
        "energyDensity": 38.5,
        "quantity": 1000,  # Added this field to match CreditsResultSchema
    }
    mock_calculator_service.get_calculated_data.return_value = mock_calculated_data

    # Override dependencies
    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    # Only include required parameters with proper aliases
    compliance_period = "2023"

    # Set required fields with aliases but omit optional ones
    params = {
        "fuelTypeId": 1,
        "fuelCategoryId": 1,
        "quantity": 1000,
        # Omitting endUseId and fuelCodeId (optional parameters)
    }

    url = fastapi_app.url_path_for(
        "get_calculated_data", compliance_period=compliance_period
    )

    # Test with just the required parameters using the correct aliases
    response = await client.get(url, params=params)

    # Assertions
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["complianceUnits"] == 100
    assert data["uci"] is None
    assert data["quantity"] == 1000  # Verify the quantity field in the response

    # Verify the service method was called with None for optional parameters
    mock_calculator_service.get_calculated_data.assert_called_once_with(
        compliance_period,
        params["fuelTypeId"],
        params["fuelCategoryId"],
        None,  # end_use_id is None
        None,  # fuel_code_id is None
        params["quantity"],
        False,
        None,
    )


@pytest.mark.anyio
async def test_get_calculated_data_with_custom_ci(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    mock_calculated_data = {
        "complianceUnits": 100,
        "tci": 80,
        "eer": 1.0,
        "rci": 70,
        "uci": 0,
        "energyContent": 10000,
        "energyDensity": 38.5,
        "quantity": 1000,
    }
    mock_calculator_service.get_calculated_data.return_value = mock_calculated_data

    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    compliance_period = "2024"
    params = {
        "fuelTypeId": 1,
        "fuelCategoryId": 1,
        "quantity": 1000,
        "useCustomCi": True,
        "customCiValue": 68.5,
    }

    url = fastapi_app.url_path_for(
        "get_calculated_data", compliance_period=compliance_period
    )
    response = await client.get(url, params=params)

    assert response.status_code == status.HTTP_200_OK
    mock_calculator_service.get_calculated_data.assert_called_once_with(
        compliance_period,
        params["fuelTypeId"],
        params["fuelCategoryId"],
        None,
        None,
        params["quantity"],
        True,
        params["customCiValue"],
    )


@pytest.mark.anyio
async def test_get_calculated_data_missing_required_params(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    # Override dependencies
    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    # Call the endpoint without required parameters
    compliance_period = "2023"

    # Only include partial parameters, missing required ones
    params = {
        "quantity": 1000
        # Missing required fuelTypeId and fuelCategoryId
    }

    url = fastapi_app.url_path_for(
        "get_calculated_data", compliance_period=compliance_period
    )
    response = await client.get(url, params=params)

    # Assertions - should get validation error as required parameters are missing
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    error_data = response.json()

    # The error format is different than expected - adjust assertions
    assert "details" in error_data  # Validation errors include details
    assert "message" in error_data
    assert error_data["message"] == "Validation failed"

    # Check that required field errors are included
    field_errors = [
        err["loc"][1] for err in error_data["details"] if len(err["loc"]) > 1
    ]
    assert "fuelTypeId" in field_errors or any(
        "fuelTypeId" in field["fields"]
        for field in error_data["details"]
        if "fields" in field
    )
    assert "fuelCategoryId" in field_errors or any(
        "fuelCategoryId" in field["fields"]
        for field in error_data["details"]
        if "fields" in field
    )

    # Verify the service method was not called
    mock_calculator_service.get_calculated_data.assert_not_called()


@pytest.mark.anyio
async def test_get_quantity_from_compliance_units(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    mock_quantity_data = {
        "complianceUnits": 150,
        "tci": 80,
        "eer": 1.0,
        "rci": 75,
        "uci": 5,
        "energyContent": 7500,
        "energyDensity": 38.5,
        "quantity": 194.81,
    }
    mock_calculator_service.get_quantity_from_compliance_units.return_value = (
        mock_quantity_data
    )

    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    compliance_period = "2024"
    params = {
        "fuelTypeId": 1,
        "fuelCategoryId": 1,
        "endUseId": 1,
        "fuelCodeId": 2,
        "complianceUnits": 150,
    }

    url = fastapi_app.url_path_for(
        "get_quantity_from_compliance_units", compliance_period=compliance_period
    )
    response = await client.get(url, params=params)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["quantity"] == pytest.approx(194.81)
    assert data["complianceUnits"] == 150

    mock_calculator_service.get_quantity_from_compliance_units.assert_called_once_with(
        compliance_period,
        params["fuelTypeId"],
        params["fuelCategoryId"],
        params["endUseId"],
        params["fuelCodeId"],
        params["complianceUnits"],
        False,
        None,
    )


@pytest.mark.anyio
async def test_get_quantity_from_compliance_units_without_optional_params(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    mock_quantity_data = {
        "complianceUnits": 90,
        "tci": 80,
        "eer": 1.0,
        "rci": 75,
        "uci": None,
        "energyContent": 4500,
        "energyDensity": 38.5,
        "quantity": 116.88,
    }
    mock_calculator_service.get_quantity_from_compliance_units.return_value = (
        mock_quantity_data
    )

    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    compliance_period = "2024"
    params = {
        "fuelTypeId": 1,
        "fuelCategoryId": 1,
        "complianceUnits": 90,
    }

    url = fastapi_app.url_path_for(
        "get_quantity_from_compliance_units", compliance_period=compliance_period
    )
    response = await client.get(url, params=params)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["quantity"] == pytest.approx(116.88)

    mock_calculator_service.get_quantity_from_compliance_units.assert_called_once_with(
        compliance_period,
        params["fuelTypeId"],
        params["fuelCategoryId"],
        None,
        None,
        params["complianceUnits"],
        False,
        None,
    )


@pytest.mark.anyio
async def test_get_quantity_from_compliance_units_with_custom_ci(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    mock_quantity_data = {
        "complianceUnits": 150,
        "tci": 80,
        "eer": 1.0,
        "rci": 70,
        "uci": 5,
        "energyContent": 7500,
        "energyDensity": 38.5,
        "quantity": 194.81,
    }
    mock_calculator_service.get_quantity_from_compliance_units.return_value = (
        mock_quantity_data
    )

    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    compliance_period = "2024"
    params = {
        "fuelTypeId": 1,
        "fuelCategoryId": 1,
        "complianceUnits": 150,
        "useCustomCi": True,
        "customCiValue": 60.5,
    }

    url = fastapi_app.url_path_for(
        "get_quantity_from_compliance_units", compliance_period=compliance_period
    )
    response = await client.get(url, params=params)

    assert response.status_code == status.HTTP_200_OK
    mock_calculator_service.get_quantity_from_compliance_units.assert_called_once_with(
        compliance_period,
        params["fuelTypeId"],
        params["fuelCategoryId"],
        None,
        None,
        params["complianceUnits"],
        True,
        params["customCiValue"],
    )


@pytest.mark.anyio
async def test_get_quantity_from_compliance_units_missing_required_params(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    compliance_period = "2024"
    params = {
        "complianceUnits": 50
    }

    url = fastapi_app.url_path_for(
        "get_quantity_from_compliance_units", compliance_period=compliance_period
    )
    response = await client.get(url, params=params)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    mock_calculator_service.get_quantity_from_compliance_units.assert_not_called()


@pytest.mark.anyio
async def test_get_lookup_table_data(
    client: AsyncClient,
    fastapi_app: FastAPI,
    mock_calculator_service,
):
    mock_lookup_table_data = {
        "compliance_year": 2025,
        "data": [
            {
                "fuel_category": "Diesel",
                "fuel_type": "Fossil-derived diesel",
                "end_use": "Any",
                "determining_carbon_intensity": "Default carbon intensity",
                "target_ci": 79.28,
                "ci_of_fuel": 94.38,
                "uci": None,
                "energy_density": 38.65,
                "energy_density_unit": "MJ/L",
                "eer": 1.0,
            }
        ],
    }
    mock_calculator_service.get_lookup_table_data.return_value = (
        mock_lookup_table_data
    )

    fastapi_app.dependency_overrides[CalculatorService] = (
        lambda: mock_calculator_service
    )

    compliance_year = 2025
    url = fastapi_app.url_path_for(
        "get_lookup_table_data", compliance_year=compliance_year
    )
    response = await client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["complianceYear"] == 2025
    assert len(data["data"]) == 1
    assert data["data"][0]["fuelCategory"] == "Diesel"
    assert data["data"][0]["fuelType"] == "Fossil-derived diesel"
    assert data["data"][0]["endUse"] == "Any"
    assert data["data"][0]["energyDensityUnit"] == "MJ/L"

    mock_calculator_service.get_lookup_table_data.assert_called_once_with(
        compliance_year
    )
