from unittest.mock import MagicMock, AsyncMock

import pytest
from fastapi import HTTPException
from types import SimpleNamespace

from lcfs.db.base import UserTypeEnum, ActionTypeEnum
from lcfs.db.models import (
    FuelType,
    EnergyEffectivenessRatio,
    EnergyDensity,
)
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.actions_service import FuelSupplyActionService
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import (
    FuelSupplyCreateUpdateSchema,
    FuelTypeOptionsResponse,
    FuelSuppliesSchema,
    FuelSupplyResponseSchema,
    FuelTypeSchema,
    FuelCategoryResponseSchema,
)
from lcfs.web.api.fuel_supply.services import FuelSupplyServices
from lcfs.db.models.user.Role import RoleEnum

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
def fuel_supply_action_service():
    mock_repo = MagicMock(spec=FuelSupplyRepository)
    mock_fuel_code_repo = MagicMock(spec=FuelCodeRepository)
    service = FuelSupplyActionService(
        repo=mock_repo,
        fuel_repo=mock_fuel_code_repo,
    )
    return service, mock_repo, mock_fuel_code_repo


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
    service, mock_repo, mock_fuel_code_repo = fuel_supply_service
    mock_repo.get_fuel_supply_table_options = AsyncMock(return_value={"fuel_types": []})
    compliance_period = "2023"

    response = await service.get_fuel_supply_options(compliance_period)

    assert isinstance(response, FuelTypeOptionsResponse)
    mock_repo.get_fuel_supply_table_options.assert_awaited_once_with(compliance_period)


@pytest.mark.anyio
async def test_get_fuel_supply_list(fuel_supply_service):
    service, mock_repo, _ = fuel_supply_service

    # Create a dummy request with a user that supports attribute access.
    dummy_user = SimpleNamespace(id=1, role_names=[RoleEnum.GOVERNMENT])
    dummy_request = MagicMock()
    dummy_request.user = dummy_user
    service.request = dummy_request

    # Build a valid fuel supply record (dictionary) that meets the Pydantic schema requirements.
    valid_fuel_supply = {
        "fuel_supply_id": 1,
        "complianceReportId": 1,
        "version": 0,
        "fuelTypeId": 1,
        "quantity": 100,
        "groupUuid": "some-uuid",
        "userType": "SUPPLIER",
        "actionType": "CREATE",
        "fuelType": {"fuel_type_id": 1, "fuelType": "Diesel", "units": "L"},
        "fuelCategory": {"fuel_category_id": 1, "category": "Diesel"},
        "endUseType": {"endUseTypeId": 1, "type": "Transport", "subType": "Personal"},
        "provisionOfTheAct": {"provisionOfTheActId": 1, "name": "Act Provision"},
        "compliancePeriod": "2024",
        "units": "L",
        "fuelCode": {
            "fuelStatus": {"status": "Approved"},
            "fuelCode": "FUEL123",
            "carbonIntensity": 15.0,
        },
        "fuelTypeOther": "Optional",
    }

    # Set the repository method to return the valid fuel supply record.
    mock_repo.get_fuel_supply_list = AsyncMock(return_value=[valid_fuel_supply])

    compliance_report_id = 1
    response = await service.get_fuel_supply_list(compliance_report_id)

    # Validate response structure.
    assert hasattr(response, "fuel_supplies")


@pytest.mark.anyio
async def test_update_fuel_supply_not_found(fuel_supply_action_service):
    service, mock_repo, mock_fuel_code_repo = fuel_supply_action_service
    mock_repo.get_fuel_supply_version_by_user = AsyncMock(return_value=None)

    fs_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
        group_uuid="some-uuid",
        version=0,
    )
    user_type = UserTypeEnum.SUPPLIER

    with pytest.raises(HTTPException) as exc_info:
        await service.update_fuel_supply(fs_data, user_type, "2024")

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Fuel supply record not found."


@pytest.mark.anyio
async def test_update_fuel_supply_success(fuel_supply_action_service):
    service, mock_repo, mock_fuel_code_repo = fuel_supply_action_service

    # Setup existing fuel supply record
    existing_fuel_supply = FuelSupply(
        fuel_supply_id=1,
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        end_use_id=1,
        quantity=1000,
        units="L",
        ci_of_fuel=10.5,
        energy_density=30.0,
        eer=1.0,
        energy=30000,
        compliance_units=100,
        group_uuid="some-uuid",
        version=0,
        user_type=UserTypeEnum.SUPPLIER,
        action_type=ActionTypeEnum.CREATE,
    )

    # Mock the repository method to return the existing fuel supply
    mock_repo.get_fuel_supply_version_by_user = AsyncMock(
        return_value=existing_fuel_supply
    )

    # Mock the FuelCodeRepository methods
    # get_fuel_type_by_id
    mock_fuel_code_repo.get_fuel_type_by_id = AsyncMock(
        return_value=FuelType(
            fuel_type_id=1,
            fuel_type="Diesel",
            unrecognized=False,
            default_carbon_intensity=10.5,
            units="L",
            fossil_derived=True,
            provision_1_id=None,
            provision_2_id=None,
        )
    )

    # get_energy_effectiveness_ratio
    mock_fuel_code_repo.get_energy_effectiveness_ratio = AsyncMock(
        return_value=EnergyEffectivenessRatio(
            fuel_type_id=1,
            fuel_category_id=1,
            end_use_type_id=1,
            ratio=1.0,
        )
    )

    # get_energy_density
    mock_fuel_code_repo.get_energy_density = AsyncMock(
        return_value=EnergyDensity(
            fuel_type_id=1,
            density=30.0,
        )
    )

    # Prepare the updated fuel supply that the update_fuel_supply method should return
    updated_fuel_supply = FuelSupply(
        fuel_supply_id=1,
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        end_use_id=1,
        quantity=2000,  # Updated quantity
        units="L",
        fuel_type_other=None,
        ci_of_fuel=10.5,
        energy_density=30.0,
        eer=1.0,
        energy=60000,  # Updated energy
        compliance_units=200,
        group_uuid="some-uuid",
        version=0,
        user_type=UserTypeEnum.SUPPLIER,
        action_type=ActionTypeEnum.CREATE,
        fuel_type=fuel_type,
        fuel_category=fuel_category,
    )

    # Mock the update_fuel_supply method to return the updated fuel supply
    mock_repo.update_fuel_supply = AsyncMock(return_value=updated_fuel_supply)

    mock_repo.get_compliance_period_id = AsyncMock(return_value=1)
    mock_repo.get_fuel_supply_by_id = AsyncMock(return_value=updated_fuel_supply)

    # Prepare the input data for updating the fuel supply
    fs_data = FuelSupplyCreateUpdateSchema(
        fuel_supply_id=1,
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        end_use_id=1,
        quantity=2000,  # Updated quantity
        units="L",
        group_uuid="some-uuid",
        version=0,
    )
    user_type = UserTypeEnum.SUPPLIER

    # Call the service method
    response = await service.update_fuel_supply(fs_data, user_type, "2024")

    # Assertions
    assert isinstance(response, FuelSupplyResponseSchema)
    assert response.fuel_supply_id == updated_fuel_supply.fuel_supply_id
    assert response.quantity == updated_fuel_supply.quantity
    assert response.energy == updated_fuel_supply.energy
    assert response.compliance_units == updated_fuel_supply.compliance_units
    assert response.group_uuid == updated_fuel_supply.group_uuid

    # Ensure that the appropriate methods were called with correct arguments
    mock_repo.get_fuel_supply_version_by_user.assert_awaited_once_with(
        fs_data.group_uuid, fs_data.version, user_type
    )
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once_with(
        fuel_type_id=fs_data.fuel_type_id,
        fuel_category_id=fs_data.fuel_category_id,
        end_use_id=fs_data.end_use_id,
        fuel_code_id=fs_data.fuel_code_id,
        compliance_period="2024",
    )
    mock_repo.update_fuel_supply.assert_awaited_once_with(existing_fuel_supply)


@pytest.mark.anyio
async def test_create_fuel_supply(fuel_supply_action_service):
    service, mock_repo, mock_fuel_code_repo = fuel_supply_action_service
    fs_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=1,
        provision_of_the_act_id=1,
        quantity=2000,
        fuel_type_other=None,
        units="L",
    )
    new_supply = FuelSupply(
        fuel_supply_id=1,
        compliance_report_id=1,
        group_uuid="new-uuid",
        version=0,
        user_type=UserTypeEnum.SUPPLIER,
        action_type=ActionTypeEnum.CREATE,
        fuel_type_id=1,
        fuel_category_id=1,
        provision_of_the_act_id=1,
        end_use_id=1,
        quantity=2000,
        units="L",
        ci_of_fuel=10.5,
        energy_density=30.0,
        eer=1.0,
        energy=60000,
        compliance_units=200,
        fuel_type=fuel_type,
        fuel_category=fuel_category,
    )

    mock_repo.get_compliance_period_id = AsyncMock(return_value=1)
    mock_repo.create_fuel_supply = AsyncMock(return_value=new_supply)
    mock_repo.get_fuel_supply_by_id = AsyncMock(return_value=new_supply)
    mock_fuel_code_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(
            spec=FuelType, unrecognized=False, default_carbon_intensity=10.5
        )
    )
    mock_fuel_code_repo.get_energy_effectiveness_ratio = AsyncMock(
        return_value=MagicMock(spec=EnergyEffectivenessRatio, ratio=1.0)
    )
    mock_density = MagicMock(spec=EnergyDensity)
    mock_density.density = 30.0
    mock_fuel_code_repo.get_energy_density = AsyncMock(return_value=mock_density)

    user_type = UserTypeEnum.SUPPLIER

    response = await service.create_fuel_supply(fs_data, user_type, "2024")

    assert isinstance(response, FuelSupplyResponseSchema)
    mock_repo.create_fuel_supply.assert_awaited_once()
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once_with(
        fuel_type_id=fs_data.fuel_type_id,
        fuel_category_id=fs_data.fuel_category_id,
        end_use_id=fs_data.end_use_id,
        fuel_code_id=fs_data.fuel_code_id,
        compliance_period="2024",
    )


@pytest.mark.anyio
async def test_delete_fuel_supply(fuel_supply_action_service):
    service, mock_repo, mock_fuel_code_repo = fuel_supply_action_service
    fs_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        group_uuid="some-uuid",
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=1000,
        units="L",
    )
    existing_fuel_supply = FuelSupply(
        compliance_report_id=1,
        fuel_supply_id=1,
        group_uuid="some-uuid",
        version=0,
        action_type=ActionTypeEnum.CREATE,
        user_type=UserTypeEnum.SUPPLIER,
    )
    mock_repo.get_latest_fuel_supply_by_group_uuid = AsyncMock(
        return_value=existing_fuel_supply
    )
    mock_repo.create_fuel_supply = AsyncMock()

    user_type = UserTypeEnum.SUPPLIER

    response = await service.delete_fuel_supply(fs_data, user_type)

    assert response.success is True
    assert response.message == "Marked as deleted."
    mock_repo.get_latest_fuel_supply_by_group_uuid.assert_awaited_once_with("some-uuid")
    mock_repo.create_fuel_supply.assert_awaited_once()
