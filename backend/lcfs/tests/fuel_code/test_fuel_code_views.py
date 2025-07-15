from datetime import date
import unittest
from unittest.mock import patch, MagicMock

import pytest
from fastapi.exceptions import RequestValidationError
from httpx import AsyncClient
from starlette import status
from starlette.responses import StreamingResponse

from fastapi import FastAPI

from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.fuel_code.schema import (
    FuelCodeCreateUpdateSchema,
    TransportModeSchema,
    FuelCodeStatusSchema,
    FuelTypeSchema,
    FuelCodePrefixSchema,
    FieldOptions,
    FPLocationsSchema,
    TableOptionsSchema,
)
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.api.fuel_type.schema import FuelTypeQuantityUnitsEnumSchema


# Fixtures for mock data
@pytest.fixture
def mock_table_options():
    return TableOptionsSchema(
        fuel_types=[
            FuelTypeSchema(
                fuel_type_id=1,
                fuel_type="Diesel",
                fossil_derived=True,
                units=FuelTypeQuantityUnitsEnumSchema.Litres,
            ),
            FuelTypeSchema(
                fuel_type_id=2,
                fuel_type="Electric",
                fossil_derived=False,
                units=FuelTypeQuantityUnitsEnumSchema.Kilowatt_hour,
            ),
        ],
        transport_modes=[
            TransportModeSchema(transport_mode_id=1, transport_mode="Road"),
            TransportModeSchema(transport_mode_id=2, transport_mode="Rail"),
        ],
        fuel_code_prefixes=[
            FuelCodePrefixSchema(
                fuel_code_prefix_id=1, prefix="LCFS", next_fuel_code="LCFS001"
            )
        ],
        latest_fuel_codes=[],
        field_options=FieldOptions(
            company=["ABC Corp", "XYZ Corp"],
            feedstock=["Corn", "Wheat"],
            feedstock_location=["Canada", "USA"],
            feedstock_misc=["Misc1", "Misc2"],
            former_company=["Old Corp"],
            contact_name=["John Doe"],
            contact_email=["john@example.com"],
        ),
        fp_locations=[
            FPLocationsSchema(
                fuel_production_facility_city="Vancouver",
                fuel_production_facility_province_state="BC",
                fuel_production_facility_country="Canada",
            )
        ],
        facility_nameplate_capacity_units=[
            FuelTypeQuantityUnitsEnumSchema.Litres,
            FuelTypeQuantityUnitsEnumSchema.Kilowatt_hour,
        ],
    )


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


# FIXED: get_table_options test
@pytest.mark.anyio
async def test_get_table_options_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_mock_user,
    mock_table_options,
):
    set_mock_user(fastapi_app, [RoleEnum.GOVERNMENT])
    url = "/api/fuel-codes/table-options"
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.get_table_options"
    ) as mock_get_table_options:
        # Return the proper schema object, not a dict
        mock_get_table_options.return_value = mock_table_options
        response = await client.get(url)

        # Perform assertions
        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert isinstance(result, dict)
        assert "fuelTypes" in result
        assert "transportModes" in result
        assert "fuelCodePrefixes" in result
        assert "facilityNameplateCapacityUnits" in result
        mock_get_table_options.assert_called_once()


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


# FIXED: search_invalid_params test - should return 400, not 422
@pytest.mark.anyio
async def test_search_invalid_params(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.GOVERNMENT)
    url = "/api/fuel-codes/search"
    params = {"invalidParam": "invalid"}
    response = await client.get(url, params=params)

    # The endpoint should return 400 (ValueError) when no valid search params are provided
    assert response.status_code == status.HTTP_400_BAD_REQUEST


# search_table_options_strings
@pytest.mark.anyio
async def test_search_fuel_code_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.search_fuel_code"
    ) as mock_search_fuel_code:
        set_user_role(RoleEnum.GOVERNMENT)

        mock_search_fuel_code.return_value = {"fuelCodes": ["AB001"]}

        url = "/api/fuel-codes/search"
        params = {"fuelCode": "AB001"}
        response = await client.get(url, params=params)

        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert isinstance(result, dict)
        assert "fuelCodes" in result
        assert result["fuelCodes"] == ["AB001"]
        mock_search_fuel_code.assert_called_once_with("AB001", None, False)


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


@pytest.mark.anyio
async def test_get_fuel_codes_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
    pagination_request_schema,
):
    set_user_role(RoleEnum.SUPPLIER)  # Incorrect role
    url = "/api/fuel-codes/list"
    response = await client.post(
        url, json=pagination_request_schema.dict(by_alias=True)
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


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
async def test_get_fuel_code_invalid_id(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.GOVERNMENT)
    url = "/api/fuel-codes/invalid_id"
    response = await client.get(url)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# FIXED: export_fuel_codes test
@pytest.mark.anyio
async def test_export_fuel_codes_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
    pagination_request_schema,
):
    """Test successful export of fuel codes."""
    set_user_role(RoleEnum.GOVERNMENT)
    url = "/api/fuel-codes/export"

    with patch("lcfs.web.api.fuel_code.export.FuelCodeExporter.export") as mock_export:
        # Create a proper StreamingResponse with all required attributes
        from starlette.responses import StreamingResponse

        def mock_generator():
            yield b"mock,csv,data"

        # Create a real StreamingResponse object instead of a mock
        mock_response = StreamingResponse(
            mock_generator(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=fuel_codes.csv"},
        )
        mock_export.return_value = mock_response

        response = await client.post(
            url,
            params={"format": "csv"},
            json=pagination_request_schema.dict(by_alias=True),
        )

    assert response.status_code == status.HTTP_200_OK
    mock_export.assert_called_once_with("csv", pagination_request_schema)


@pytest.mark.anyio
async def test_export_fuel_codes_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
    pagination_request_schema,
):
    """Test export with unauthorized role."""
    set_user_role(RoleEnum.SUPPLIER)  # Unauthorized role
    url = "/api/fuel-codes/export"

    response = await client.post(
        url,
        params={"format": "xlsx"},
        json=pagination_request_schema.dict(by_alias=True),
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


# save_fuel_code (POST /) - Create/Update
@pytest.mark.anyio
async def test_save_fuel_code_create_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
    request_fuel_code_data,
):
    """Test successful creation of a fuel code."""
    set_user_role(RoleEnum.ANALYST)
    url = "/api/fuel-codes"

    # Remove fuel_code_id to trigger create
    create_data = request_fuel_code_data.copy()
    create_data.pop("fuel_code_id", None)

    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.create_fuel_code"
    ) as mock_create_fuel_code:
        mock_create_fuel_code.return_value = request_fuel_code_data
        response = await client.post(url, json=create_data)

    assert response.status_code == status.HTTP_200_OK
    result = response.json()
    assert result["company"] == request_fuel_code_data["company"]
    assert result["fuelTypeId"] == request_fuel_code_data["fuelTypeId"]
    mock_create_fuel_code.assert_called_once()


@pytest.mark.anyio
async def test_save_fuel_code_update_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
    updated_fuel_code_data,
):
    """Test successful update of a fuel code."""
    set_user_role(RoleEnum.ANALYST)
    url = "/api/fuel-codes"

    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.update_fuel_code"
    ) as mock_update_fuel_code:
        mock_update_fuel_code.return_value = updated_fuel_code_data.model_dump(
            by_alias=True, mode="json"
        )
        response = await client.post(
            url, json=updated_fuel_code_data.model_dump(by_alias=True, mode="json")
        )

    assert response.status_code == status.HTTP_200_OK
    result = response.json()
    assert result["fuelCodeId"] == 1
    assert result["company"] == "XYZ Energy Corp"
    mock_update_fuel_code.assert_called_once()


@pytest.mark.anyio
async def test_save_fuel_code_invalid_data(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role
):
    """Test creation of a fuel code with invalid data."""
    set_user_role(RoleEnum.ANALYST)
    url = "/api/fuel-codes"
    invalid_data = {"invalidField": "Invalid"}

    response = await client.post(url, json=invalid_data)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.anyio
async def test_save_fuel_code_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role, request_fuel_code_data
):
    """Test creation of a fuel code with unauthorized user role."""
    set_user_role(RoleEnum.SUPPLIER)  # Unauthorized role
    url = "/api/fuel-codes"

    response = await client.post(url, json=request_fuel_code_data)

    assert response.status_code == status.HTTP_403_FORBIDDEN


# delete_fuel_code
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


@pytest.mark.anyio
async def test_delete_fuel_code_unauthorized(
    client: AsyncClient, fastapi_app: FastAPI, set_user_role
):
    """Test deletion of a fuel code with unauthorized user role."""
    set_user_role(RoleEnum.SUPPLIER)  # Unauthorized role
    url = "/api/fuel-codes/1"
    response = await client.delete(url)

    assert response.status_code == status.HTTP_403_FORBIDDEN


# get_fuel_code_statuses
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


# get_transport_modes
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


# Tests for FuelCodeCreateUpdateSchema validation
@pytest.mark.anyio
def test_valid_dates(valid_fuel_code_data):
    # Valid input
    model = FuelCodeCreateUpdateSchema(**valid_fuel_code_data)
    assert model.application_date == date(2023, 1, 1)


@pytest.mark.anyio
def test_valid_capacity_unit(valid_fuel_code_data):
    # Valid capacity and unit
    valid_data = valid_fuel_code_data.copy()
    valid_data["facility_nameplate_capacity"] = 100
    valid_data["facility_nameplate_capacity_unit"] = "Gallons"
    model = FuelCodeCreateUpdateSchema(**valid_data)
    assert model.facility_nameplate_capacity == 100


# Additional edge case tests
@pytest.mark.anyio
async def test_search_with_multiple_facility_params(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    """Test search with multiple facility location parameters."""
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.search_fp_facility_location"
    ) as mock_search_facility:
        set_user_role(RoleEnum.GOVERNMENT)

        mock_search_facility.return_value = ["Vancouver, BC, Canada"]

        url = "/api/fuel-codes/search"
        params = {"fpCity": "Vancouver", "fpProvince": "BC", "fpCountry": "Canada"}
        response = await client.get(url, params=params)

        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert isinstance(result, list)
        mock_search_facility.assert_called_once_with("Vancouver", "BC", "Canada")


@pytest.mark.anyio
async def test_search_with_distinct_flag(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    """Test search with distinct flag enabled."""
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.search_fuel_code"
    ) as mock_search_fuel_code:
        set_user_role(RoleEnum.GOVERNMENT)

        mock_search_fuel_code.return_value = {"fuelCodes": ["AB001", "AB002"]}

        url = "/api/fuel-codes/search"
        params = {"fuelCode": "AB", "distinctSearch": "true"}
        response = await client.get(url, params=params)

        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert isinstance(result, dict)
        mock_search_fuel_code.assert_called_once_with("AB", None, True)


@pytest.mark.anyio
async def test_search_with_prefix_param(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    """Test search with prefix parameter."""
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.search_fuel_code"
    ) as mock_search_fuel_code:
        set_user_role(RoleEnum.GOVERNMENT)

        mock_search_fuel_code.return_value = {"fuelCodes": ["LCFS001"]}

        url = "/api/fuel-codes/search"
        params = {"fuelCode": "001", "prefix": "LCFS"}
        response = await client.get(url, params=params)

        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert isinstance(result, dict)
        mock_search_fuel_code.assert_called_once_with("001", "LCFS", False)


@pytest.mark.anyio
async def test_save_fuel_code_with_director_role(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
    request_fuel_code_data,
):
    """Test save fuel code with director role."""
    set_user_role(RoleEnum.DIRECTOR)
    url = "/api/fuel-codes"

    # Remove fuel_code_id to trigger create
    create_data = request_fuel_code_data.copy()
    create_data.pop("fuel_code_id", None)

    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.create_fuel_code"
    ) as mock_create_fuel_code:
        mock_create_fuel_code.return_value = request_fuel_code_data
        response = await client.post(url, json=create_data)

    assert response.status_code == status.HTTP_200_OK
    result = response.json()
    assert result["company"] == request_fuel_code_data["company"]


# update_fuel_code_status (PUT /{fuel_code_id})
@pytest.mark.anyio
async def test_update_fuel_code_status_success(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.update_fuel_code_status"
    ) as mock_update_status:
        set_user_role(RoleEnum.GOVERNMENT)

        mock_update_status.return_value = {"message": "Status updated successfully"}
        url = "/api/fuel-codes/1"
        data = {"fuelCodeStatusId": 2, "status": "Approved"}

        response = await client.put(url, json=data)

        assert response.status_code == status.HTTP_200_OK
        result = response.json()
        assert result["message"] == "Status updated successfully"
        # Verify the service was called with correct parameters
        call_args = mock_update_status.call_args
        assert call_args[0][0] == 1  # fuel_code_id
        assert call_args[0][1].value == "Approved"  # status enum
        # Third parameter is the user object from request.user


@pytest.mark.anyio
async def test_update_fuel_code_status_forbidden(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    set_user_role(RoleEnum.SUPPLIER)  # Incorrect role
    url = "/api/fuel-codes/1"
    data = {"fuelCodeStatusId": 2, "status": "Approved"}

    response = await client.put(url, json=data)

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_update_fuel_code_status_not_found(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    """Test update fuel code status for non-existent fuel code."""
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.update_fuel_code_status"
    ) as mock_update_status:
        set_user_role(RoleEnum.GOVERNMENT)

        mock_update_status.side_effect = DataNotFoundException("Fuel code not found")
        url = "/api/fuel-codes/9999"
        data = {"fuelCodeStatusId": 2, "status": "Approved"}

        response = await client.put(url, json=data)

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.anyio
async def test_update_fuel_code_status_invalid_id(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    """Test update fuel code status with invalid ID."""
    set_user_role(RoleEnum.GOVERNMENT)
    url = "/api/fuel-codes/invalid_id"
    data = {"fuelCodeStatusId": 2, "status": "Approved"}

    response = await client.put(url, json=data)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.anyio
async def test_update_fuel_code_status_invalid_data(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    """Test update fuel code status with invalid data."""
    set_user_role(RoleEnum.GOVERNMENT)
    url = "/api/fuel-codes/1"
    data = {"invalidField": "invalid"}

    response = await client.put(url, json=data)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.anyio
async def test_delete_fuel_code_invalid_id(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    """Test delete fuel code with invalid ID."""
    set_user_role(RoleEnum.ANALYST)
    url = "/api/fuel-codes/invalid_id"

    response = await client.delete(url)

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# Additional schema validation tests
@pytest.mark.anyio
def test_fuel_code_schema_with_empty_transport_modes(valid_fuel_code_data):
    """Test fuel code schema with empty transport mode arrays."""
    valid_data = valid_fuel_code_data.copy()
    valid_data["feedstock_fuel_transport_mode"] = []
    valid_data["finished_fuel_transport_mode"] = []

    model = FuelCodeCreateUpdateSchema(**valid_data)
    assert model.feedstock_fuel_transport_mode == []
    assert model.finished_fuel_transport_mode == []


@pytest.mark.anyio
def test_fuel_code_schema_with_negative_carbon_intensity(valid_fuel_code_data):
    """Test fuel code schema with negative carbon intensity."""
    valid_data = valid_fuel_code_data.copy()
    valid_data["carbon_intensity"] = -5.5

    model = FuelCodeCreateUpdateSchema(**valid_data)
    assert model.carbon_intensity == -5.5


@pytest.mark.anyio
def test_fuel_code_schema_with_very_long_strings(valid_fuel_code_data):
    """Test fuel code schema with very long string values."""
    valid_data = valid_fuel_code_data.copy()
    long_string = "A" * 1000
    valid_data["company"] = long_string
    valid_data["feedstock"] = long_string

    model = FuelCodeCreateUpdateSchema(**valid_data)
    assert model.company == long_string
    assert model.feedstock == long_string


# Error handling tests
@pytest.mark.anyio
async def test_service_error_handling(
    client: AsyncClient,
    fastapi_app: FastAPI,
    set_user_role,
):
    """Test service error handling."""
    with patch(
        "lcfs.web.api.fuel_code.services.FuelCodeServices.get_table_options"
    ) as mock_service:
        set_user_role(RoleEnum.GOVERNMENT)

        # Simulate a service error
        mock_service.side_effect = Exception("Database connection failed")

        url = "/api/fuel-codes/table-options"
        response = await client.get(url)

        # Should return 500 Internal Server Error
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
