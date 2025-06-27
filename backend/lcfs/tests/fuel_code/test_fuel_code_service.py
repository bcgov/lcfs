from unittest.mock import AsyncMock

import pytest

from lcfs.db.models import FuelCode
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.fuel_code.schema import (
    FuelCodeBaseSchema,
    FuelCodeCreateUpdateSchema,
    FuelCodeSchema,
    PaginationResponseSchema,
)
from lcfs.web.api.fuel_code.services import FuelCodeServices
from lcfs.web.exception.exceptions import ServiceException


@pytest.mark.anyio
async def test_get_fuel_codes_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    mock_fuel_codes = [
        FuelCodeBaseSchema(
            fuel_code_id=1,
            company="XYZ Corp",
            prefix_id=1,
            fuel_suffix="001.0",
            carbon_intensity=10.5,
            fuel_code_status_id=1,
            status="Draft",
            application_date="2023-10-01",
            last_updated="2023-10-01",
            fuel_type="Diesel",
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
    result = await service.search_fuel_codes(pagination)

    # Assert
    assert isinstance(result.pagination, PaginationResponseSchema)
    assert len(result.fuel_codes) == 1
    assert result.fuel_codes[0].company == "XYZ Corp"
    repo_mock.get_fuel_codes_paginated.assert_called_once_with(pagination)


@pytest.mark.anyio
async def test_create_fuel_code_success():
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    input_data = FuelCodeCreateUpdateSchema(
        fuel_code_id=1,
        fuel_type_id=1,
        status="Draft",
        prefix="ABC",
        prefix_id=1001,
        fuel_suffix="001",
        carbon_intensity=20.5,
        company="XYZ Corp",
        application_date="2023-10-01",
        approval_date="2023-10-02",
        effective_date="2023-10-03",
        expiration_date="2024-10-01",
        edrms="EDRMS-123",
        feedstock="Corn oil",
        feedstock_location="Canada",
        fuel_production_facility_city="Victoria",
        fuel_production_facility_country="Canada",
        fuel_production_facility_province_state="BC",
    )
    mock_fuel_code_data = FuelCodeSchema(
        fuel_code_id=1,
        status="Draft",
        prefix="ABC",
        prefix_id=1001,
        fuel_suffix="001",
        carbon_intensity=20.5,
        company="XYZ Corp",
        fuel="Diesel",
        fuel_type_id=1,
        application_date="2023-10-01",
        edrms="EDRMS-123",
        feedstock="Corn oil",
        feedstock_location="Canada",
        fuel_production_facility_city="Victoria",
        fuel_production_facility_country="Canada",
        fuel_production_facility_province_state="BC",
        last_updated="2023-10-01",
        feedstock_fuel_transport_modes=[],
        finished_fuel_transport_modes=[],
    )

    repo_mock.create_fuel_code.return_value = mock_fuel_code_data

    # Act
    result = await service.create_fuel_code(input_data)

    # Assert
    assert result.fuel_code_id == 1
    assert result.company == "XYZ Corp"
    repo_mock.create_fuel_code.assert_called_once()


@pytest.mark.anyio
async def test_update_fuel_code_success():
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code_id = 1
    mock_fuel_code = FuelCodeCreateUpdateSchema(
        fuel_code_id=1,
        fuel_type_id=1,
        status="Draft",
        prefix="ABC",
        prefix_id=1001,
        fuel_suffix="001",
        carbon_intensity=20.5,
        company="XYZ Corp",
        application_date="2023-10-01",
        approval_date="2023-10-02",
        effective_date="2023-10-03",
        expiration_date="2024-10-01",
        edrms="EDRMS-123",
        feedstock="Corn oil",
        feedstock_location="Canada",
        fuel_production_facility_city="Victoria",
        fuel_production_facility_country="Canada",
        fuel_production_facility_province_state="BC",
        feedstock_fuel_transport_modes=[],
        finished_fuel_transport_modes=[],
    )

    repo_mock.get_fuel_code.return_value = mock_fuel_code
    repo_mock.update_fuel_code.return_value = mock_fuel_code

    # Act
    result = await service.update_fuel_code(mock_fuel_code)

    # Assert
    assert result.fuel_code_id == 1
    assert result.company == "XYZ Corp"
    repo_mock.get_fuel_code.assert_called_once_with(fuel_code_id)
    repo_mock.update_fuel_code.assert_called_once_with(mock_fuel_code)


@pytest.mark.anyio
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


@pytest.mark.anyio
async def test_approve_fuel_code_success():
    """Test successful approval of a fuel code."""
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code_id = 1
    # Mock a fuel code in Draft status
    mock_fuel_code = FuelCode(fuel_code_status=AsyncMock())
    mock_fuel_code.fuel_code_status.status = FuelCodeStatusEnum.Draft
    repo_mock.get_fuel_code.return_value = mock_fuel_code

    # Mock the Approved status and update operation
    mock_approved_status = AsyncMock()
    mock_approved_status.status = FuelCodeStatusEnum.Approved
    repo_mock.get_fuel_code_status.return_value = mock_approved_status
    repo_mock.update_fuel_code.return_value = mock_fuel_code

    # Act
    result = await service.approve_fuel_code(fuel_code_id)

    # Assert
    assert result == mock_fuel_code
    repo_mock.get_fuel_code.assert_called_once_with(fuel_code_id)
    repo_mock.get_fuel_code_status.assert_called_once_with(FuelCodeStatusEnum.Approved)
    repo_mock.update_fuel_code.assert_called_once_with(mock_fuel_code)


@pytest.mark.anyio
async def test_approve_fuel_code_not_found():
    """Test approving a non-existent fuel code."""
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code_id = 9999
    repo_mock.get_fuel_code.return_value = None

    # Act & Assert
    with pytest.raises(ValueError, match="Fuel code not found"):
        await service.approve_fuel_code(fuel_code_id)
    repo_mock.get_fuel_code.assert_called_once_with(fuel_code_id)


@pytest.mark.anyio
async def test_approve_fuel_code_invalid_status():
    """Test approving a fuel code that is not in Draft status."""
    # Arrange
    repo_mock = AsyncMock()
    service = FuelCodeServices(repo=repo_mock)

    fuel_code_id = 1

    mock_fuel_code = FuelCode(fuel_code_status=AsyncMock())
    mock_fuel_code.fuel_code_status.status = FuelCodeStatusEnum.Approved
    repo_mock.get_fuel_code.return_value = mock_fuel_code

    # Act & Assert
    with pytest.raises(ValueError, match="Fuel code is not in Draft"):
        await service.approve_fuel_code(fuel_code_id)

    repo_mock.get_fuel_code.assert_called_once_with(fuel_code_id)
