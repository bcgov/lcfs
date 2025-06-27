from datetime import date
from unittest.mock import patch

import pytest
from fastapi.exceptions import RequestValidationError
from httpx import AsyncClient
from starlette import status

from fastapi import FastAPI

from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.fuel_code.schema import (
    FuelCodeCreateUpdateSchema,
    TransportModeSchema,
    FuelCodeStatusSchema,
)
from lcfs.web.exception.exceptions import DataNotFoundException


# Fixtures for mock data
@pytest.fixture
def mock_table_options():
    return {
        "fuelTypes": ["Diesel", "Electric"],
        "transportModes": ["Road", "Rail"],
        "latestFuelCodes": ["FC-2021-001", "FC-2021-002"],
        "facilityNameplateCapacityUnits": ["kW", "MW"],
    }


@pytest.fixture
def mock_fuel_code_data():
    return {
        "fuel_code_id": 1,
        "company": "ABC Corp",
        "fuel_suffix": "001.0",
        "prefixId": 1,
        "carbonIntensity": 25.0,
        "edrms": "EDRMS-123",
        "lastUpdated": "2023-10-01",
        "applicationDate": "2023-09-15",
        "fuelTypeId": 2,
        "feedstock": "Corn",
        "feedstockLocation": "Canada",
    }


@pytest.fixture
def updated_fuel_code_data():
    return FuelCodeCreateUpdateSchema(
        fuel_code_id=1,
        prefix_id=1001,
        fuel_suffix="001.1",
        carbon_intensity=20.5,
        edrms="EDRMS-123",
        company="XYZ Energy Corp",
        contact_name="John Doe",
        contact_email="john.doe@example.com",
        application_date=date(2023, 9, 15),
        approval_date=date(2023, 10, 1),
        effective_date=date(2023, 10, 15),
        expiration_date=date(2024, 10, 15),
        fuel_type_id=2,
        feedstock="Corn",
        feedstock_location="USA",
        fuel_production_facility_city="Vancouver",
        fuel_production_facility_province_state="BC",
        fuel_production_facility_country="Canada",
        facility_nameplate_capacity=1000,
        facility_nameplate_capacity_unit="L",
        feedstock_fuel_transport_mode=["Truck", "Ship"],
        finished_fuel_transport_mode=["Truck"],
        is_valid=True,
        validation_msg="Validated successfully",
        deleted=False,
    )


@pytest.fixture
def request_fuel_code_data():
    return {
        "status": "Draft",
        "prefix": "ABC",
        "prefixId": 1001,
        "fuelSuffix": "001.0",
        "carbonIntensity": 20.5,
        "edrms": "EDRMS-123",
        "company": "XYZ Energy Corp",
        "lastUpdated": "2023-11-05T10:30:00",
        "contactName": "John Doe",
        "contactEmail": "john.doe@example.com",
        "applicationDate": "2023-09-15",
        "approvalDate": "2023-10-01",
        "effectiveDate": "2023-10-15",
        "expirationDate": "2024-10-15",
        "fuel": "Diesel",
        "fuelTypeId": 2,
        "feedstock": "Corn",
        "feedstockLocation": "USA",
        "fuelProductionFacilityCity": "Vancouver",
        "fuelProductionFacilityProvinceState": "BC",
        "fuelProductionFacilityCountry": "Canada",
        "facilityNameplateCapacity": 1000,
        "facilityNameplateCapacityUnit": "L",
        "feedstockFuelTransportMode": ["Truck", "Ship"],
        "finishedFuelTransportMode": ["Truck"],
        "isValid": True,
        "validationMsg": "Validated successfully",
        "deleted": False,
    }


@pytest.fixture
def valid_fuel_code_data():
    return {
        "fuel_code_id": 1,
        "prefix_id": 1,
        "fuel_suffix": "101.1",
        "carbon_intensity": 1.23,
        "edrms": "12345",
        "company": "Test Company",
        "contact_name": "John Doe",
        "contact_email": "johndoe@example.com",
        "application_date": date(2023, 1, 1),
        "approval_date": date(2023, 2, 1),
        "effective_date": date(2023, 3, 1),
        "expiration_date": date(2023, 12, 31),
        "fuel_type_id": 1,
        "feedstock": "Test Feedstock",
        "feedstock_location": "Location",
        "fuel_production_facility_city": "City",
        "fuel_production_facility_province_state": "Province",
        "fuel_production_facility_country": "Country",
    }


# Fixture to set user role
@pytest.fixture
def set_user_role(fastapi_app, set_mock_user):
    def _set_user_role(role):
        set_mock_user(fastapi_app, [role])

    return _set_user_role


# get_table_options
@pytest.mark.anyio
async def test_get_table_options_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
):
    mock_table_options = {
        "fuelTypes": ["Diesel", "Electric"],
        "transportModes": ["Road", "Rail"],
        "latestFuelCodes": ["FC-2021-001", "FC-2021-002"],
        "facilityNameplateCapacityUnits": ["kW", "MW"],
    }
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = "/api/fuel-codes/table-options"
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.get_table_options"
    ) as mock_get_table_options:
        mock_get_table_options.return_value.status_code = status.HTTP_200_OK
        mock_get_table_options.return_value.json.return_value = mock_table_options
        response = await client.get(url)

        # Perform assertions
        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert isinstance(result, dict)
        assert "fuelTypes" in result
        assert "transportModes" in result
        assert "latestFuelCodes" in result
        assert "facilityNameplateCapacityUnits" in result


@pytest.mark.anyio
async def test_get_table_options_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.SUPPLIER)  # Incorrect role
    url = "/api/fuel-codes/table-options"
    response = await client.get(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


# search_table_options_strings
@pytest.mark.anyio
async def test_search_table_options_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.search_fuel_code"
    ) as mock_search_fuel_code:
        set_user_role(RoleEnum.GOVERNMENT)

        mock_search_fuel_code.return_value = {"fuel_codes": ["AB001"]}

        url = "/api/fuel-codes/search"
        params = {"fuelCode": "AB001"}
        response = await client.get(url, params=params)

        assert response.status_code == 200
        result = response.json()
        assert isinstance(result, dict)
        assert "fuelCodes" in result
        assert result["fuelCodes"] == ["AB001"]
        mock_search_fuel_code.assert_called_once_with("AB001", None, False)


@pytest.mark.anyio
async def test_search_table_options_invalid_params(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.GOVERNMENT)
    url = "/api/fuel-codes/search"
    params = {"invalidParam": "invalid"}
    response = await client.get(url, params=params)

    assert response.status_code == status.HTTP_400_BAD_REQUEST


# get_fuel_codes (POST /list)
@pytest.mark.anyio
async def test_get_fuel_codes_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
    pagination_request_schema,
):
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.search_fuel_codes"
    ) as mock_get_fuel_codes:
        set_user_role(RoleEnum.GOVERNMENT)

        mock_get_fuel_codes.return_value = {
            "fuel_codes": [
                {
                    "fuel_code_id": 1,
                    "company": "ABC Corp",
                    "fuelSuffix": "001.0",
                    "fuel_code_prefix_id": 1,
                    "prefix": "lcfs",
                    "fuel_code_status_id": 1,
                    "status": "Approved",
                    "carbonIntensity": 25.0,
                    "edrms": "EDRMS-123",
                    "lastUpdated": "2023-10-01",
                    "applicationDate": "2023-09-15",
                    "fuelTypeId": 2,
                    "fuelType": "Diesel",
                    "feedstock": "Corn",
                    "feedstockLocation": "Canada",
                }
            ],
            "pagination": {
                "total": 1,
                "page": 1,
                "size": 10,
                "total_pages": 1,
            },
        }

        url = "/api/fuel-codes/list"
        response = await client.post(
            url, json=pagination_request_schema.dict(by_alias=True)
        )

        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert isinstance(result, dict)
        assert "pagination" in result
        assert "fuelCodes" in result
        mock_get_fuel_codes.assert_called_once_with(pagination_request_schema)


# get_fuel_code by ID
@pytest.mark.anyio
async def test_get_fuel_code_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
    mock_fuel_code_data,
):
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.get_fuel_code"
    ) as mock_get_fuel_code:
        set_user_role(RoleEnum.GOVERNMENT)

        mock_get_fuel_code.return_value = mock_fuel_code_data
        url = "/api/fuel-codes/1"
        response = await client.get(url)

        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert isinstance(result, dict)
        assert result["fuelCodeId"] == 1
        assert result["company"] == "ABC Corp"
        mock_get_fuel_code.assert_called_once_with(1)


@pytest.mark.anyio
async def test_get_fuel_code_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.get_fuel_code"
    ) as mock_get_fuel_code:
        set_user_role(RoleEnum.GOVERNMENT)

        mock_get_fuel_code.side_effect = DataNotFoundException("Fuel code not found")
        url = "/api/fuel-codes/9999"
        response = await client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_update_fuel_code_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
    updated_fuel_code_data,
):
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.update_fuel_code"
    ) as mock_update_fuel_code:
        set_user_role(RoleEnum.ANALYST)

        mock_update_fuel_code.return_value = updated_fuel_code_data.model_dump(
            by_alias=True, mode="json"
        )
        url = "/api/fuel-codes"

        # Send the PUT request with the mock updated data
        response = await client.post(
            url, json=updated_fuel_code_data.model_dump(by_alias=True, mode="json")
        )
        # Assert the response status and data
        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert isinstance(result, dict)
        assert result["fuelCodeId"] == 1
        assert result["company"] == "XYZ Energy Corp"


@pytest.mark.anyio
async def test_delete_fuel_code_success(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role
):
    """Test successful deletion of a fuel code."""
    set_user_role(RoleEnum.ANALYST)
    url = "/api/fuel-codes/1"
    mock_response = {"message": "Fuel code deleted successfully"}

    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.delete_fuel_code"
    ) as mock_delete_fuel_code:
        mock_delete_fuel_code.return_value = mock_response
        response = await client.delete(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == mock_response
    mock_delete_fuel_code.assert_called_once_with(1)


@pytest.mark.anyio
async def test_delete_fuel_code_not_found(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role
):
    """Test deletion of a non-existent fuel code."""
    set_user_role(RoleEnum.ANALYST)
    url = "/api/fuel-codes/9999"

    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.delete_fuel_code"
    ) as mock_delete_fuel_code:
        mock_delete_fuel_code.side_effect = DataNotFoundException("Fuel code not found")
        response = await client.delete(url)

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Not Found"


@pytest.mark.anyio
async def test_delete_fuel_code_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role
):
    """Test deletion of a fuel code with unauthorized user role."""
    set_user_role(RoleEnum.SUPPLIER)  # Unauthorized role
    url = "/api/fuel-codes/1"
    response = await client.delete(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_create_fuel_code_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
    request_fuel_code_data,
):
    """Test successful creation of a fuel code."""
    set_user_role(RoleEnum.ANALYST)
    url = "/api/fuel-codes"

    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.create_fuel_code"
    ) as mock_create_fuel_code:
        mock_create_fuel_code.return_value = request_fuel_code_data
        response = await client.post(url, json=request_fuel_code_data)

    assert response.status_code == status.HTTP_200_OK
    result = response.json()
    assert result["company"] == request_fuel_code_data["company"]
    assert result["fuelTypeId"] == request_fuel_code_data["fuelTypeId"]
    mock_create_fuel_code.assert_called_once_with(
        FuelCodeCreateUpdateSchema(**request_fuel_code_data)
    )


@pytest.mark.anyio
async def test_create_fuel_code_invalid_data(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role
):
    """Test creation of a fuel code with invalid data."""
    set_user_role(RoleEnum.ANALYST)
    url = "/api/fuel-codes"
    invalid_data = {"invalidField": "Invalid"}

    response = await client.post(url, json=invalid_data)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.anyio
async def test_create_fuel_code_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role, request_fuel_code_data
):
    """Test creation of a fuel code with unauthorized user role."""
    set_user_role(RoleEnum.SUPPLIER)  # Unauthorized role
    url = "/api/fuel-codes"

    response = await client.post(url, json=request_fuel_code_data)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_approve_fuel_code_success(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role
):
    """Test successful approval of a fuel code."""
    set_user_role(RoleEnum.GOVERNMENT)
    url = "/api/fuel-codes/1/approve"
    mock_response = {"message": "Fuel code approved successfully"}

    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.approve_fuel_code"
    ) as mock_approve_fuel_code:
        mock_approve_fuel_code.return_value = mock_response
        response = await client.post(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == mock_response
    mock_approve_fuel_code.assert_called_once_with(1)


@pytest.mark.anyio
async def test_approve_fuel_code_not_found(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role
):
    """Test approval of a non-existent fuel code."""
    set_user_role(RoleEnum.GOVERNMENT)
    url = "/api/fuel-codes/9999/approve"

    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.approve_fuel_code"
    ) as mock_approve_fuel_code:
        mock_approve_fuel_code.side_effect = DataNotFoundException(
            "Fuel code not found"
        )
        response = await client.post(url)

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Not Found"


@pytest.mark.anyio
async def test_approve_fuel_code_invalid_request(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role
):
    """Test approval of a fuel code with invalid data."""
    set_user_role(RoleEnum.GOVERNMENT)
    url = "/api/fuel-codes/invalid_id/approve"

    response = await client.post(url)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.anyio
async def test_approve_fuel_code_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role
):
    set_user_role(RoleEnum.SUPPLIER)
    url = "/api/fuel-codes/1/approve"
    response = await client.post(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


# Tests for FuelCodeCreateUpdateSchema validation
@pytest.mark.anyio
def test_valid_dates(valid_fuel_code_data):
    # Valid input
    model = FuelCodeCreateUpdateSchema(**valid_fuel_code_data)
    assert model.application_date == date(2023, 1, 1)


@pytest.mark.anyio
def test_invalid_application_date_before_approval_date(valid_fuel_code_data):
    # Application Date is after Approval Date
    invalid_data = valid_fuel_code_data.copy()
    invalid_data["application_date"] = date(2023, 2, 2)
    invalid_data["approval_date"] = date(2023, 2, 1)
    with pytest.raises(RequestValidationError) as excinfo:
        FuelCodeCreateUpdateSchema(**invalid_data)
    assert "applicationDate" in str(excinfo.value)


@pytest.mark.anyio
def test_invalid_effective_date_before_application_date(valid_fuel_code_data):
    # Effective Date is before Application Date
    invalid_data = valid_fuel_code_data.copy()
    invalid_data["effective_date"] = date(2022, 12, 31)
    with pytest.raises(RequestValidationError) as excinfo:
        FuelCodeCreateUpdateSchema(**invalid_data)
    assert "effectiveDate" in str(excinfo.value)


@pytest.mark.anyio
def test_invalid_expiration_date_before_effective_date(valid_fuel_code_data):
    # Expiration Date is before Effective Date
    invalid_data = valid_fuel_code_data.copy()
    invalid_data["expiration_date"] = date(2023, 2, 28)
    with pytest.raises(RequestValidationError) as excinfo:
        FuelCodeCreateUpdateSchema(**invalid_data)
    assert "expirationDate" in str(excinfo.value)


@pytest.mark.anyio
def test_missing_capacity_unit(valid_fuel_code_data):
    # Facility capacity is provided but no unit
    invalid_data = valid_fuel_code_data.copy()
    invalid_data["facility_nameplate_capacity"] = 100
    invalid_data["facility_nameplate_capacity_unit"] = None
    with pytest.raises(RequestValidationError) as excinfo:
        FuelCodeCreateUpdateSchema(**invalid_data)
    assert "facilityNameplateCapacityUnit" in str(excinfo.value)


@pytest.mark.anyio
def test_valid_capacity_unit(valid_fuel_code_data):
    # Valid capacity and unit
    valid_data = valid_fuel_code_data.copy()
    valid_data["facility_nameplate_capacity"] = 100
    valid_data["facility_nameplate_capacity_unit"] = "Gallons"
    model = FuelCodeCreateUpdateSchema(**valid_data)
    assert model.facility_nameplate_capacity == 100


@pytest.mark.anyio
async def test_get_fuel_code_statuses_success(
    client: AsyncClient, fastapi_app: FastAPI
):
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.get_fuel_code_statuses"
    ) as mock_get_statuses:
        # Mock the return value of the service
        mock_get_statuses.return_value = [
            FuelCodeStatusSchema(
                fuel_code_status_id=1, status=FuelCodeStatusEnum.Draft
            ),
            FuelCodeStatusSchema(
                fuel_code_status_id=2, status=FuelCodeStatusEnum.Recommended
            ),
            FuelCodeStatusSchema(
                fuel_code_status_id=3, status=FuelCodeStatusEnum.Approved
            ),
        ]

        # Send GET request to the endpoint
        url = "/api/fuel-codes/statuses"
        response = await client.get(url)

        # Assertions
        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert isinstance(result, list)
        assert len(result) == 3
        assert result[0]["fuelCodeStatusId"] == 1
        assert result[0]["status"] == "Draft"
        assert result[1]["fuelCodeStatusId"] == 2
        assert result[1]["status"] == "Recommended"
        assert result[2]["fuelCodeStatusId"] == 3
        assert result[2]["status"] == "Approved"


@pytest.mark.anyio
async def test_get_transport_modes_success(client: AsyncClient, fastapi_app: FastAPI):
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.get_transport_modes"
    ) as mock_get_modes:
        # Mock the return value of the service
        mock_get_modes.return_value = [
            TransportModeSchema(transport_mode_id=1, transport_mode="Truck"),
            TransportModeSchema(transport_mode_id=2, transport_mode="Ship"),
        ]

        # Send GET request to the endpoint
        url = "/api/fuel-codes/transport-modes"
        response = await client.get(url)

        # Assertions
        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]["transportModeId"] == 1
        assert result[0]["transportMode"] == "Truck"
        assert result[1]["transportModeId"] == 2
        assert result[1]["transportMode"] == "Ship"
