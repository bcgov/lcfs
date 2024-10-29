import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import HTTPException

from lcfs.db.models import (
    FuelType,
    EnergyEffectivenessRatio,
    EnergyDensity,
    FuelCategory,
)
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import (
    FuelSupplyCreateUpdateSchema,
    FuelTypeOptionsResponse,
    FuelSuppliesSchema,
    FuelSupplyResponseSchema,
    FuelTypeSchema,
    FuelCategoryResponseSchema,
)
from lcfs.db.models.compliance.FuelSupply import FuelSupply, ChangeType
from lcfs.web.api.fuel_supply.services import FuelSupplyServices


# Fixture to set up the FuelSupplyServices with mocked dependencies
# Mock common fuel type and fuel category for reuse
fuel_type = FuelTypeSchema(
    fuel_type_id=1,
    fuel_type="Diesel",
    fossil_derived=True,
    provision_1_id=None,
    provision_2_id=None,
    default_carbon_intensity=10.5,
    units="L",
)

fuel_category = FuelCategoryResponseSchema(
    fuel_category_id=1,
    category="Diesel",
)


@pytest.fixture
def fuel_supply_service():
    mock_repo = MagicMock(spec=FuelSupplyRepository)
    mock_fuel_code_repo = MagicMock(spec=FuelCodeRepository)
    service = FuelSupplyServices(
        repo=mock_repo,
        fuel_repo=mock_fuel_code_repo,
    )
    return service, mock_repo, mock_fuel_code_repo


# Asynchronous test for get_fuel_supply_options
@pytest.mark.anyio
async def test_get_fuel_supply_options(fuel_supply_service):
    service, mock_repo, mock_fuel_code_repo = (
        fuel_supply_service
    )
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
    service, mock_repo, mock_fuel_code_repo = (
        fuel_supply_service
    )
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


@pytest.mark.anyio
async def test_update_fuel_supply_success(fuel_supply_service):
    service, mock_repo, mock_fuel_code_repo = (
        fuel_supply_service
    )
    existing_fuel_supply = FuelSupply(
        fuel_supply_id=1,
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        quantity=1000,
        units="L",
        ci_of_fuel=10.0,
        energy_density=30.0,
        eer=1.0,
        energy=30000,
        compliance_units=100,
        fuel_type=fuel_type,
        fuel_category=fuel_category,
    )
    mock_fuel_code_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(spec=FuelType)
    )
    mock_fuel_code_repo.get_energy_effectiveness_ratio = AsyncMock(
        return_value=MagicMock(spec=EnergyEffectivenessRatio)
    )
    mock_density = MagicMock(spec=EnergyDensity)
    mock_density.density = 30.0
    mock_fuel_code_repo.get_energy_density = AsyncMock(return_value=mock_density)
    mock_repo.update_fuel_supply = AsyncMock(return_value=existing_fuel_supply)

    fs_data = FuelSupplyCreateUpdateSchema(
        fuel_supply_id=1,
        compliance_report_id=1,
        fuel_type_id=1,  # Assume this is a change
        fuel_category_id=1,
        provision_of_the_act_id=1,
        end_use_id=1,
        quantity=2000,
        units="L",
    )

    response = await service.update_fuel_supply(fs_data)

    assert isinstance(response, FuelSupplyResponseSchema)
    mock_fuel_code_repo.get_fuel_type_by_id.assert_awaited_once_with(
        fs_data.fuel_type_id
    )
    mock_fuel_code_repo.get_energy_effectiveness_ratio.assert_awaited_once()
    mock_fuel_code_repo.get_energy_density.assert_awaited_once()
    mock_repo.update_fuel_supply.assert_awaited_once()

    saved_fuel_supply = mock_repo.update_fuel_supply.mock_calls.pop().args[0]

    # Double supply, double energy
    assert saved_fuel_supply.energy == 60000


# Asynchronous test for create_fuel_supply
@pytest.mark.anyio
async def test_create_fuel_supply(fuel_supply_service):
    service, mock_repo, mock_fuel_code_repo = (
        fuel_supply_service
    )
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
    service, mock_repo, mock_fuel_code_repo = (
        fuel_supply_service
    )
    fuel_supply_id = 1
    mock_repo.delete_fuel_supply = AsyncMock(return_value="Deleted")

    response = await service.delete_fuel_supply(fuel_supply_id)

    assert response == "Deleted"
    mock_repo.delete_fuel_supply.assert_awaited_once_with(fuel_supply_id)
