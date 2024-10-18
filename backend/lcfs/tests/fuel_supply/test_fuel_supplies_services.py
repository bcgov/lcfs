import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import HTTPException

from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import (
    FuelSupplyCreateUpdateSchema,
    FuelTypeOptionsResponse,
    FuelSuppliesSchema,
    FuelSupplyResponseSchema,
)
from lcfs.db.models.compliance.FuelSupply import FuelSupply, ChangeType
from lcfs.web.api.fuel_supply.services import FuelSupplyServices


# Fixture to set up the FuelSupplyServices with mocked dependencies
@pytest.fixture
def fuel_supply_service():
    mock_repo = MagicMock(spec=FuelSupplyRepository)
    mock_compliance_report_repo = MagicMock(spec=ComplianceReportRepository)
    service = FuelSupplyServices(
        repo=mock_repo, compliance_report_repo=mock_compliance_report_repo
    )
    return service, mock_repo, mock_compliance_report_repo


# Asynchronous test for get_fuel_supply_options
@pytest.mark.anyio
async def test_get_fuel_supply_options(fuel_supply_service):
    service, mock_repo, _ = fuel_supply_service
    mock_repo.get_fuel_supply_table_options = AsyncMock(
        return_value=[
            # Mocked data structure as expected from the database
        ]
    )
    compliance_period = "2023"

    response = await service.get_fuel_supply_options(compliance_period)

    assert isinstance(response, FuelTypeOptionsResponse)
    mock_repo.get_fuel_supply_table_options.assert_awaited_once_with(compliance_period)


# Asynchronous test for get_fuel_supply_list
@pytest.mark.anyio
async def test_get_fuel_supply_list(fuel_supply_service):
    service, mock_repo, _ = fuel_supply_service
    mock_repo.get_fuel_supply_list = AsyncMock(
        return_value=[
            # Mocked list of FuelSupply models
        ]
    )
    compliance_report_id = 1

    response = await service.get_fuel_supply_list(compliance_report_id)

    assert isinstance(response, FuelSuppliesSchema)
    mock_repo.get_fuel_supply_list.assert_awaited_once_with(compliance_report_id)


@pytest.mark.anyio
async def test_update_fuel_supply_not_found(fuel_supply_service):
    service, mock_repo, _ = fuel_supply_service
    mock_repo.get_fuel_supply_by_id = AsyncMock(return_value=None)
    fs_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_fuel_supply(fs_data)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Fuel supply not found"


# Asynchronous test for create_fuel_supply
@pytest.mark.anyio
async def test_create_fuel_supply(fuel_supply_service):
    service, mock_repo, _ = fuel_supply_service
    fs_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
    )
    mock_repo.create_fuel_supply = AsyncMock(return_value=FuelSupply())
    mock_repo.update_fuel_supply = AsyncMock(
        return_value=FuelSupply(
            compliance_report_id=1,
            fuel_type_id=1,
            provision_of_the_act_id=1,
            quantity=2000,
            fuel_supply_id=1,
            units="L",
            fuel_type={"fuelTypeId": 1, "fuelType": "fuelType", "units": "L"},
            fuel_category={"category": "category"},
        )
    )

    response = await service.create_fuel_supply(fs_data)

    assert isinstance(response, FuelSupplyResponseSchema)
    mock_repo.create_fuel_supply.assert_awaited_once()
    mock_repo.update_fuel_supply.assert_awaited_once()


@pytest.mark.anyio
async def test_delete_fuel_supply(fuel_supply_service):
    service, mock_repo, _ = fuel_supply_service
    fuel_supply_id = 1
    mock_repo.delete_fuel_supply = AsyncMock(return_value="Deleted")

    response = await service.delete_fuel_supply(fuel_supply_id)

    assert response == "Deleted"
    mock_repo.delete_fuel_supply.assert_awaited_once_with(fuel_supply_id)
