import pytest
from unittest.mock import AsyncMock
from lcfs.web.api.fuel_code.services import FuelCodeServices
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.schema import (
    FuelCodeCreateSchema,
    FuelCodeSchema,
    PaginationResponseSchema,
)


@pytest.mark.asyncio
async def test_get_fuel_codes_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    mock_fuel_codes = [
        FuelCodeSchema(
            fuel_code_id=1,
            company="XYZ Corp",
            prefix_id=1,
            fuel_suffix="001.0",
            carbon_intensity=10.5,
            status="Draft",
            application_date="2023-10-01",
            last_updated="2023-10-01",
            fuel="Diesel",
            fuel_type_id=1,
            prefix="BCLCF",
            edrms="EDRMS-123",
            feedstock="Corn oil",
            feedstock_location="Canada",
        )
    ]
    repo_mock.get_fuel_codes_paginated.return_value = (mock_fuel_codes, 1)

    pagination = PaginationRequestSchema(page=1, size=10)

    # Act
    result = await service.get_fuel_codes(pagination)

    # Assert
    assert isinstance(result.pagination, PaginationResponseSchema)
    assert len(result.fuel_codes) == 1
    assert result.fuel_codes[0].company == "XYZ Corp"
    repo_mock.get_fuel_codes_paginated.assert_called_once_with(pagination)


@pytest.mark.asyncio
async def test_create_fuel_code_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    mock_fuel_code_data = FuelCodeCreateSchema(
        fuel_code_id=1,
        status="Draft",
        prefix="ABC",
        prefix_id=1001,
        fuel_suffix="001",
        carbon_intensity=20.5,
        company="XYZ Corp",
        fuel="Diesel",
        application_date="2023-10-01",
        edrms="EDRMS-123",
        feedstock="Corn oil",
        feedstock_location="Canada",
        fuel_production_facility_city="Victoria",
        fuel_production_facility_country="Canada",
        fuel_production_facility_province_state="BC",
    )

    repo_mock.create_fuel_code.return_value = mock_fuel_code_data

    # Act
    result = await service.create_fuel_code(mock_fuel_code_data)

    # Assert
    assert result.fuel_code_id == 1
    assert result.company == "XYZ Corp"
    repo_mock.create_fuel_code.assert_called_once()


@pytest.mark.asyncio
async def test_update_fuel_code_success():
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code_id = 1
    mock_fuel_code = FuelCodeCreateSchema(
        fuel_code_id=1,
        status="Draft",
        prefix="ABC",
        prefix_id=1001,
        fuel_suffix="001",
        carbon_intensity=20.5,
        company="XYZ Corp",
        fuel="Diesel",
        application_date="2023-10-01",
        edrms="EDRMS-123",
        feedstock="Corn oil",
        feedstock_location="Canada",
        fuel_production_facility_city="Victoria",
        fuel_production_facility_country="Canada",
        fuel_production_facility_province_state="BC",
        feedstock_fuel_transport_modes=[],
        finished_fuel_transport_modes=[]
    )

    repo_mock.get_fuel_code.return_value = mock_fuel_code
    repo_mock.update_fuel_code.return_value = mock_fuel_code

    # Act
    result = await service.update_fuel_code(fuel_code_id, mock_fuel_code)

    # Assert
    assert result.fuel_code_id == 1
    assert result.company == "XYZ Corp"
    repo_mock.get_fuel_code.assert_called_once_with(fuel_code_id)
    repo_mock.update_fuel_code.assert_called_once_with(mock_fuel_code)


@pytest.mark.asyncio
async def test_delete_fuel_code_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code_id = 1
    repo_mock.delete_fuel_code.return_value = True

    # Act
    result = await service.delete_fuel_code(fuel_code_id)

    # Assert
    assert result is True
    repo_mock.delete_fuel_code.assert_called_once_with(fuel_code_id)


@pytest.mark.asyncio
async def test_get_table_options_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    repo_mock.get_fuel_types.return_value = ["Diesel", "Electric"]
    repo_mock.get_transport_modes.return_value = ["Truck", "Ship"]
    repo_mock.get_fuel_code_prefixes.return_value = ["FC1", "FC2"]
    repo_mock.get_latest_fuel_codes.return_value = ["FC-2021-001"]
    repo_mock.get_fp_locations.return_value = ["USA", "Canada"]
    repo_mock.get_fuel_code_field_options.return_value = [
        {"some_field": "some_value"},
        {"another_field": "another_value"},
    ]

    # Act
    result = await service.get_table_options()

    # Assert
    assert isinstance(result, dict)
    assert "fuel_types" in result
    assert "transport_modes" in result
    assert result["fuel_types"][0] == "Diesel"
    assert result["transport_modes"][1] == "Ship"
