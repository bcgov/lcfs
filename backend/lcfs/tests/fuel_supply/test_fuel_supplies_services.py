import copy
import pytest
from fastapi import HTTPException
from types import SimpleNamespace
from unittest.mock import MagicMock, AsyncMock

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models import (
    FuelType,
    EnergyEffectivenessRatio,
    EnergyDensity,
)
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.actions_service import FuelSupplyActionService
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_supply.schema import (
    FuelSupplyCreateUpdateSchema,
    FuelTypeOptionsResponse,
    FuelSupplyResponseSchema,
    FuelTypeSchema,
    FuelCategoryResponseSchema,
)
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
def fuel_supply_action_service():
    mock_repo = MagicMock(spec=FuelSupplyRepository)
    mock_fuel_code_repo = MagicMock(spec=FuelCodeRepository)
    service = FuelSupplyActionService(
        repo=mock_repo,
        fuel_repo=mock_fuel_code_repo,
        fuel_supply_service=FuelSupplyServices(),
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
async def test_get_fuel_supply_list(fuel_supply_service, mock_fuel_supply):
    service, mock_repo, _ = fuel_supply_service

    # Create a dummy request with a user that supports attribute access.
    dummy_user = SimpleNamespace(id=1, role_names=[RoleEnum.GOVERNMENT])
    dummy_request = MagicMock()
    dummy_request.user = dummy_user
    service.request = dummy_request

    # Set the repository method to return the valid fuel supply record.
    mock_repo.get_fuel_supply_list = AsyncMock(return_value=[mock_fuel_supply])

    compliance_report_id = 1
    response = await service.get_fuel_supply_list(compliance_report_id)

    # Validate response structure.
    assert hasattr(response, "fuel_supplies")


@pytest.mark.anyio
async def test_update_fuel_supply_not_found(fuel_supply_action_service):
    service, mock_repo, mock_fuel_code_repo = fuel_supply_action_service
    mock_repo.get_fuel_supply_by_group_version = AsyncMock(return_value=None)

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
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_fuel_supply(fs_data, "2024")

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Fuel supply record not found."


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
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    # Create nested objects using SimpleNamespace
    fuel_type = SimpleNamespace(fuel_type_id=1, fuel_type="Diesel", units="L")
    fuel_category = SimpleNamespace(fuel_category_id=1, category="Diesel")
    fuel_code = SimpleNamespace(
        fuel_status=SimpleNamespace(status="Approved"),
        fuel_code="FUEL123",
        carbon_intensity=15.0,
    )
    provision_of_the_act = SimpleNamespace(
        provision_of_the_act_id=1, name="Act Provision"
    )
    end_use_type = SimpleNamespace(
        end_use_type_id=1, type="Transport", sub_type="Personal"
    )

    # Create the mock fuel supply object
    new_supply = MagicMock(
        fuel_supply_id=1,
        group_uuid="new-uuid",
        user_type="SUPPLIER",
        action_type="CREATE",
        fuel_type_other=None,
        fuel_type=fuel_type,
        fuel_category=fuel_category,
        fuel_code=fuel_code,
        provision_of_the_act=provision_of_the_act,
        end_use_type=end_use_type,
        units="L",
        compliance_period="2024",
        compliance_units=100.0,
        target_ci=10.0,
        version=1,
        energy_density=35.0,
        eer=1.0,
        uci=50.0,
        energy=1000.0,
    )

    # Set up the mocks with the created object
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

    response = await service.create_fuel_supply(fs_data, "2024")
    assert response is not None


@pytest.mark.anyio
async def test_update_fuel_supply_success(fuel_supply_action_service, mock_fuel_supply):
    service, mock_repo, mock_fuel_code_repo = fuel_supply_action_service

    # Mock the repository method to return the existing fuel supply
    mock_repo.get_fuel_supply_by_group_version.return_value = mock_fuel_supply

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
    updated_fuel_supply = copy.copy(mock_fuel_supply)
    updated_fuel_supply.quantity = 2000
    updated_fuel_supply.energy = 60000

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
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    # Call the service method
    response = await service.update_fuel_supply(fs_data, "2024")

    # Assertions
    assert isinstance(response, FuelSupplyResponseSchema)
    assert response.fuel_supply_id == updated_fuel_supply.fuel_supply_id
    assert response.quantity == updated_fuel_supply.quantity
    assert response.energy == updated_fuel_supply.energy
    assert response.compliance_units == updated_fuel_supply.compliance_units
    assert response.group_uuid == updated_fuel_supply.group_uuid

    # Ensure that the appropriate methods were called with correct arguments
    mock_repo.get_fuel_supply_by_group_version.assert_awaited_once_with(
        fs_data.group_uuid, fs_data.version
    )
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once_with(
        fuel_type_id=fs_data.fuel_type_id,
        fuel_category_id=fs_data.fuel_category_id,
        end_use_id=fs_data.end_use_id,
        fuel_code_id=fs_data.fuel_code_id,
        compliance_period="2024",
    )
    mock_repo.update_fuel_supply.assert_awaited_once_with(mock_fuel_supply)


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
        is_canada_produced=True,
        is_q1_supplied=False,
    )
    existing_fuel_supply = FuelSupply(
        compliance_report_id=1,
        fuel_supply_id=1,
        group_uuid="some-uuid",
        version=0,
        action_type=ActionTypeEnum.CREATE,
    )
    mock_repo.get_latest_fuel_supply_by_group_uuid = AsyncMock(
        return_value=existing_fuel_supply
    )
    mock_repo.create_fuel_supply = AsyncMock()

    response = await service.delete_fuel_supply(fs_data)

    assert response.success is True
    assert response.message == "Marked as deleted."
    mock_repo.get_latest_fuel_supply_by_group_uuid.assert_awaited_once_with("some-uuid")
    mock_repo.delete_fuel_supply.assert_awaited_once()


@pytest.mark.anyio
async def test_delete_fuel_supply_changelog(fuel_supply_action_service):
    service, mock_repo, mock_fuel_code_repo = fuel_supply_action_service
    fs_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=2,
        group_uuid="some-uuid",
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=1000,
        units="L",
        is_canada_produced=True,
        is_q1_supplied=False,
    )
    existing_fuel_supply = FuelSupply(
        compliance_report_id=1,
        fuel_supply_id=1,
        group_uuid="some-uuid",
        version=0,
        action_type=ActionTypeEnum.CREATE,
    )
    mock_repo.get_latest_fuel_supply_by_group_uuid = AsyncMock(
        return_value=existing_fuel_supply
    )
    mock_repo.create_fuel_supply = AsyncMock()

    response = await service.delete_fuel_supply(fs_data)

    assert response.success is True
    assert response.message == "Marked as deleted."
    mock_repo.get_latest_fuel_supply_by_group_uuid.assert_awaited_once_with("some-uuid")
    mock_repo.create_fuel_supply.assert_awaited_once()


@pytest.mark.anyio
async def test_get_fuel_supply_list_with_total_compliance_units(fuel_supply_service):
    """Test that get_fuel_supply_list returns total compliance units correctly"""
    service, mock_repo, _ = fuel_supply_service

    # Create mock fuel supplies with compliance units
    mock_fs1 = MagicMock(spec=FuelSupply)
    mock_fs1.compliance_units = 1500.75
    mock_fs1.action_type = ActionTypeEnum.CREATE
    mock_fs1.fuel_supply_id = 1
    mock_fs1.compliance_report_id = 1
    mock_fs1.fuel_type = MagicMock(fuel_type="Diesel")
    mock_fs1.fuel_type_id = 1
    mock_fs1.fuel_category = MagicMock(category="Petroleum-based")
    mock_fs1.fuel_category_id = 1
    provision_mock1 = MagicMock()
    provision_mock1.name = "Default"
    mock_fs1.provision_of_the_act = provision_mock1
    mock_fs1.provision_of_the_act_id = 1
    mock_fs1.end_use_type = MagicMock(type="Transportation")
    mock_fs1.end_use_id = 1
    mock_fs1.fuel_code = None
    mock_fs1.fuel_code_id = None
    mock_fs1.fuel_type_other = None
    mock_fs1.group_uuid = "test-uuid-1"
    mock_fs1.version = 0
    mock_fs1.ci_of_fuel = None
    mock_fs1.target_ci = None
    mock_fs1.energy_density = None
    mock_fs1.eer = None
    mock_fs1.uci = None
    mock_fs1.units = "L"
    mock_fs1.quantity = 1000
    mock_fs1.q1_quantity = None
    mock_fs1.q2_quantity = None
    mock_fs1.q3_quantity = None
    mock_fs1.q4_quantity = None

    mock_fs2 = MagicMock(spec=FuelSupply)
    mock_fs2.compliance_units = -500.25
    mock_fs2.action_type = ActionTypeEnum.CREATE
    mock_fs2.fuel_supply_id = 2
    mock_fs2.compliance_report_id = 1
    mock_fs2.fuel_type = MagicMock(fuel_type="Gasoline")
    mock_fs2.fuel_type_id = 2
    mock_fs2.fuel_category = MagicMock(category="Petroleum-based")
    mock_fs2.fuel_category_id = 1
    provision_mock2 = MagicMock()
    provision_mock2.name = "Default"
    mock_fs2.provision_of_the_act = provision_mock2
    mock_fs2.provision_of_the_act_id = 1
    mock_fs2.end_use_type = MagicMock(type="Transportation")
    mock_fs2.end_use_id = 1
    mock_fs2.fuel_code = None
    mock_fs2.fuel_code_id = None
    mock_fs2.fuel_type_other = None
    mock_fs2.group_uuid = "test-uuid-2"
    mock_fs2.version = 0
    mock_fs2.ci_of_fuel = None
    mock_fs2.target_ci = None
    mock_fs2.energy_density = None
    mock_fs2.eer = None
    mock_fs2.uci = None
    mock_fs2.units = "L"
    mock_fs2.quantity = 500
    mock_fs2.q1_quantity = None
    mock_fs2.q2_quantity = None
    mock_fs2.q3_quantity = None
    mock_fs2.q4_quantity = None

    # Mock a deleted fuel supply (should be excluded from total)
    mock_fs3 = MagicMock(spec=FuelSupply)
    mock_fs3.compliance_units = 1000.0
    mock_fs3.action_type = ActionTypeEnum.DELETE
    mock_fs3.fuel_supply_id = 3
    mock_fs3.compliance_report_id = 1
    mock_fs3.fuel_type = MagicMock(fuel_type="Diesel")
    mock_fs3.fuel_type_id = 1
    mock_fs3.fuel_category = MagicMock(category="Petroleum-based")
    mock_fs3.fuel_category_id = 1
    provision_mock3 = MagicMock()
    provision_mock3.name = "Default"
    mock_fs3.provision_of_the_act = provision_mock3
    mock_fs3.provision_of_the_act_id = 1
    mock_fs3.end_use_type = MagicMock(type="Transportation")
    mock_fs3.end_use_id = 1
    mock_fs3.fuel_code = None
    mock_fs3.fuel_code_id = None
    mock_fs3.fuel_type_other = None
    mock_fs3.group_uuid = "test-uuid-3"
    mock_fs3.version = 0
    mock_fs3.ci_of_fuel = None
    mock_fs3.target_ci = None
    mock_fs3.energy_density = None
    mock_fs3.eer = None
    mock_fs3.uci = None
    mock_fs3.units = "L"
    mock_fs3.quantity = 1000
    mock_fs3.q1_quantity = None
    mock_fs3.q2_quantity = None
    mock_fs3.q3_quantity = None
    mock_fs3.q4_quantity = None

    mock_fuel_supplies = [mock_fs1, mock_fs2, mock_fs3]

    # Set the repository method to return the mock fuel supplies
    mock_repo.get_fuel_supply_list = AsyncMock(return_value=mock_fuel_supplies)

    compliance_report_id = 1
    response = await service.get_fuel_supply_list(compliance_report_id)

    # Validate response structure
    assert hasattr(response, "fuel_supplies")
    assert hasattr(response, "total_compliance_units")

    # Expected total: round(1500.75 + (-500.25)) = round(1000.5) = 1000
    # Deleted record (1000) should not be included
    # Note: Python uses banker's rounding, so 1000.5 rounds to 1000 (nearest even)
    assert response.total_compliance_units == 1000
    assert len(response.fuel_supplies) == 3
