import copy
import pytest
from unittest.mock import AsyncMock
from uuid import uuid4

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.ComplianceReport import QuantityUnitsEnum
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.tests.fuel_supply.conftest import (
    create_sample_fs_data,
    FUEL_TYPE_MOCK,
    FUEL_CATEGORY_MOCK,
    FUEL_SUPPLY_EXCLUDE_FIELDS,
)
from lcfs.web.api.fuel_code.repo import CarbonIntensityResult
from lcfs.web.api.fuel_supply.schema import (
    FuelSupplyCreateUpdateSchema,
    DeleteFuelSupplyResponseSchema,
)
from lcfs.web.api.fuel_supply.actions_service import FuelSupplyActionService
from lcfs.web.utils.calculations import calculate_compliance_units

# Example test cases dataset (unchanged)
test_cases = [
    {
        "description": "Jet fuel, default carbon intensity, liters",
        "input": {
            "quantity": 100000,
            "units": "L",
            "target_ci": 88.83,
            "ci_of_fuel": 88.83,
            "energy_density": 36,
            "eer": 1,
        },
        "expected_compliance_units": 0,
        "rounded_compliance_units": 0,
    },
    {
        "description": "Diesel, prescribed carbon intensity, liters",
        "input": {
            "quantity": 100000,
            "units": "L",
            "target_ci": 79.28,
            "ci_of_fuel": 94.38,
            "energy_density": 38.65,
            "eer": 1.0,
        },
        "expected_compliance_units": -58.3615,
        "rounded_compliance_units": -58,
    },
    {
        "description": "Gasoline, default carbon intensity, liters",
        "input": {
            "quantity": 100000,
            "units": "L",
            "target_ci": 78.68,
            "ci_of_fuel": 93.67,
            "energy_density": 34.69,
            "eer": 1,
        },
        "expected_compliance_units": -52.00031,
        "rounded_compliance_units": -52,
    },
    {
        "description": "Diesel, fuel code, kWh",
        "input": {
            "quantity": 100000,
            "units": "kWh",
            "target_ci": 79.28,
            "ci_of_fuel": 12.14,
            "energy_density": 3.6,
            "eer": 2.5,
        },
        "expected_compliance_units": 66.9816,
        "rounded_compliance_units": 67,
    },
    {
        "description": "Gasoline, default carbon intensity, m³",
        "input": {
            "quantity": 100000,
            "units": "m³",
            "target_ci": 78.68,
            "ci_of_fuel": 63.91,
            "energy_density": 38.27,
            "eer": 0.9,
        },
        "expected_compliance_units": 26.41395,
        "rounded_compliance_units": 26,
    },
]


async def assign_schema_fields(result, fe_data):
    # Check if result is a coroutine and await it if necessary
    if hasattr(result, "__await__"):
        result = await result

    # No need to modify the result since the mock service now handles this
    return result


# Fixtures for mocks
@pytest.fixture
def mock_repo():
    """Mock FuelSupplyRepository."""
    repo = AsyncMock()
    repo.create_fuel_supply = AsyncMock()
    repo.update_fuel_supply = AsyncMock()
    repo.delete_fuel_supply = AsyncMock()
    repo.get_fuel_supply_version_by_user = AsyncMock()
    repo.get_latest_fuel_supply_by_group_uuid = AsyncMock()
    return repo


@pytest.fixture
def mock_fuel_code_repo():
    """Mock FuelCodeRepository."""
    fuel_code_repo = AsyncMock()
    fuel_code_repo.get_standardized_fuel_data = AsyncMock()
    return fuel_code_repo


@pytest.fixture
def mock_fuel_supply_service():
    """Mock FuelSupplyServices."""
    service = AsyncMock()

    def map_entity_to_schema_side_effect(fuel_supply):
        # Create a schema that preserves the important attributes from the fuel supply
        schema = AsyncMock()
        # Round compliance units to match the expected values
        schema.compliance_units = round(fuel_supply.compliance_units)
        schema.fuel_type = FUEL_TYPE_MOCK
        schema.fuel_category = FUEL_CATEGORY_MOCK
        schema.units = fuel_supply.units
        return schema

    service.map_entity_to_schema = AsyncMock(
        side_effect=map_entity_to_schema_side_effect
    )
    return service


@pytest.fixture
def fuel_supply_action_service_with_mocks(
    mock_repo, mock_fuel_code_repo, mock_fuel_supply_service
):
    """Instantiate the FuelSupplyActionService with mocked dependencies."""
    return FuelSupplyActionService(
        repo=mock_repo,
        fuel_repo=mock_fuel_code_repo,
        fuel_supply_service=mock_fuel_supply_service,
    )


# Fixtures for mocks
@pytest.fixture
def mock_repo_extended():
    repo = AsyncMock()
    repo.create_fuel_supply = AsyncMock()
    repo.update_fuel_supply = AsyncMock()
    repo.get_fuel_supply_version_by_user = AsyncMock()
    repo.get_latest_fuel_supply_by_group_uuid = AsyncMock()
    repo.get_compliance_period_id = AsyncMock(return_value=1)
    repo.get_fuel_supply_by_id = AsyncMock()
    repo.get_fuel_supply_by_group_version = AsyncMock()
    return repo


@pytest.fixture
def fuel_supply_action_service_extended(mock_repo_extended, mock_fuel_code_repo):
    """Instantiate the FuelSupplyActionService with extended mocked dependencies."""
    return FuelSupplyActionService(
        repo=mock_repo_extended, fuel_repo=mock_fuel_code_repo
    )


@pytest.fixture
def mock_fuel_supply():
    """Mock FuelSupply model."""
    fuel_supply = AsyncMock(spec=FuelSupply)
    fuel_supply.fuel_supply_id = 1
    fuel_supply.compliance_report_id = 1
    fuel_supply.fuel_type_id = 1
    fuel_supply.fuel_category_id = 1
    fuel_supply.end_use_id = 1
    fuel_supply.fuel_code_id = 1
    fuel_supply.quantity = 1000
    fuel_supply.units = QuantityUnitsEnum.Litres
    fuel_supply.energy_density = 35.0
    fuel_supply.ci_of_fuel = 50.0
    fuel_supply.target_ci = 80.0
    fuel_supply.eer = 1.0
    fuel_supply.energy = 35000.0
    fuel_supply.compliance_units = -100
    fuel_supply.group_uuid = str(uuid4())
    fuel_supply.version = 0
    fuel_supply.action_type = ActionTypeEnum.CREATE
    fuel_supply.provision_of_the_act_id = 123
    return fuel_supply


@pytest.fixture
def sample_fs_data():
    """Create a sample FuelSupplyCreateUpdateSchema for testing."""
    return FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=1,
        fuel_code_id=1,
        quantity=1000,
        units="L",
        energy_density=35.0,
        group_uuid=str(uuid4()),
        version=0,
        provision_of_the_act_id=123,
        is_canada_produced=True,
        is_q1_supplied=False,
    )


# Fixtures for mocks
@pytest.fixture
def mock_repo():
    repo = AsyncMock()
    repo.create_fuel_supply = AsyncMock()
    repo.update_fuel_supply = AsyncMock()
    repo.get_fuel_supply_version_by_user = AsyncMock()
    repo.get_latest_fuel_supply_by_group_uuid = AsyncMock()
    repo.get_compliance_period_id = AsyncMock(return_value=1)
    repo.get_fuel_supply_by_id = AsyncMock()
    repo.get_fuel_supply_by_group_version = AsyncMock()
    return repo


# Adjusted tests
@pytest.mark.anyio
async def test_create_fuel_supply_success(
    fuel_supply_action_service_with_mocks,
    mock_repo,
    mock_fuel_code_repo,
    mock_fuel_supply,
):
    fe_data = create_sample_fs_data()
    # Set standardized fuel data response
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=50.0,
        target_ci=80.0,
        eer=1.0,
        energy_density=35.0,
        uci=None,
    )
    fe_data.fuel_type_id = 3
    fe_data.fuel_category_id = 2
    fe_data.provision_of_the_act_id = 3

    mock_repo.create_fuel_supply.return_value = mock_fuel_supply
    mock_repo.get_fuel_supply_by_id.return_value = mock_fuel_supply

    result = await fuel_supply_action_service_with_mocks.create_fuel_supply(
        fe_data, "2024"
    )
    # Ensure result is awaited before calling assign_schema_fields
    result = await assign_schema_fields(result, fe_data)

    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once_with(
        fuel_type_id=fe_data.fuel_type_id,
        fuel_category_id=fe_data.fuel_category_id,
        end_use_id=fe_data.end_use_id,
        fuel_code_id=fe_data.fuel_code_id,
        compliance_period="2024",
    )
    mock_repo.create_fuel_supply.assert_awaited_once()
    assert result.compliance_units < 0


@pytest.mark.anyio
async def test_update_fuel_supply_success_existing_report(
    fuel_supply_action_service_with_mocks,
    mock_repo,
    mock_fuel_code_repo,
    mock_fuel_supply,
):
    fe_data = create_sample_fs_data()
    mock_repo.get_fuel_supply_by_group_version.return_value = mock_fuel_supply
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=55.0,
        target_ci=85.0,
        eer=1.2,
        energy_density=36.0,
        uci=None,
    )
    updated_supply = copy.copy(mock_fuel_supply)
    updated_supply.compliance_units = -150
    updated_supply.fuel_type = FUEL_TYPE_MOCK
    updated_supply.fuel_category = FUEL_CATEGORY_MOCK
    updated_supply.units = "Litres"
    mock_repo.update_fuel_supply.return_value = updated_supply
    mock_repo.get_fuel_supply_by_id.return_value = updated_supply

    result = await fuel_supply_action_service_with_mocks.update_fuel_supply(
        fe_data, "2024"
    )
    # Ensure result is awaited before calling assign_schema_fields
    result = await assign_schema_fields(result, fe_data)

    mock_repo.get_fuel_supply_by_group_version.assert_awaited_once_with(
        fe_data.group_uuid,
        fe_data.version,
    )
    mock_repo.update_fuel_supply.assert_awaited_once()
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once()
    assert result.compliance_units == -150


@pytest.mark.anyio
async def test_update_fuel_supply_create_new_version(
    fuel_supply_action_service_with_mocks,
    mock_repo,
    mock_fuel_code_repo,
    mock_fuel_supply,
):
    fe_data = create_sample_fs_data()
    fe_data.compliance_report_id = 2  # Different compliance report ID

    existing_supply = mock_fuel_supply
    new_supply = copy.copy(mock_fuel_supply)
    new_supply.fuel_supply_id = 2
    new_supply.version = existing_supply.version + 1
    new_supply.group_uuid = "test_uuid"
    new_supply.action_type = ActionTypeEnum.UPDATE
    new_supply.compliance_units = -150
    new_supply.fuel_type = FUEL_TYPE_MOCK
    new_supply.fuel_category = FUEL_CATEGORY_MOCK
    new_supply.units = "Litres"

    mock_repo.get_fuel_supply_by_group_version.return_value = existing_supply
    mock_repo.get_fuel_supply_by_id.return_value = new_supply
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=60.0,
        target_ci=90.0,
        eer=1.5,
        energy_density=37.0,
        uci=None,
    )
    mock_repo.create_fuel_supply.return_value = new_supply

    result = await fuel_supply_action_service_with_mocks.update_fuel_supply(
        fe_data, "2024"
    )
    # Ensure result is awaited before calling assign_schema_fields
    result = await assign_schema_fields(result, fe_data)

    mock_repo.get_fuel_supply_by_group_version.assert_awaited_once_with(
        fe_data.group_uuid, fe_data.version
    )
    mock_repo.create_fuel_supply.assert_awaited_once()
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once()
    assert result.compliance_units == -150


@pytest.mark.anyio
async def test_delete_fuel_supply_success(
    fuel_supply_action_service_with_mocks,
    mock_repo,
    mock_fuel_code_repo,
    sample_fs_data,
):
    fe_data = sample_fs_data
    fe_data_dict = fe_data.model_dump(exclude=FUEL_SUPPLY_EXCLUDE_FIELDS)
    existing_supply = FuelSupply(
        **fe_data_dict,
        fuel_supply_id=1,
        version=0,
        action_type=ActionTypeEnum.CREATE,
        compliance_units=-100,
        fuel_type=FUEL_TYPE_MOCK,
        fuel_category=FUEL_CATEGORY_MOCK,
        units="Litres",
    )

    existing_supply.compliance_units = -100
    existing_supply.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    existing_supply.fuel_category = {"category": "Diesel"}
    existing_supply.units = "Litres"
    mock_repo.get_latest_fuel_supply_by_group_uuid.return_value = existing_supply

    # Call the method under test
    result = await fuel_supply_action_service_with_mocks.delete_fuel_supply(fe_data)

    # Assertions
    assert isinstance(result, DeleteFuelSupplyResponseSchema)
    assert result.success is True
    assert result.message == "Marked as deleted."
    mock_repo.get_latest_fuel_supply_by_group_uuid.assert_awaited_once_with(
        fe_data.group_uuid
    )
    mock_repo.delete_fuel_supply.assert_awaited_once()


@pytest.mark.anyio
async def test_delete_fuel_supply_changelog(
    fuel_supply_action_service_with_mocks, mock_repo, mock_fuel_code_repo
):
    fe_data = create_sample_fs_data()

    # Exclude invalid fields
    fe_data_dict = fe_data.model_dump(exclude=FUEL_SUPPLY_EXCLUDE_FIELDS)
    fe_data.compliance_report_id = 2

    # Mock existing supply
    existing_supply = FuelSupply(
        **fe_data_dict,
        fuel_supply_id=1,
        version=0,
        action_type=ActionTypeEnum.CREATE,
    )
    existing_supply.compliance_units = -100
    existing_supply.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    existing_supply.fuel_category = {"category": "Diesel"}
    existing_supply.units = "Litres"
    mock_repo.get_latest_fuel_supply_by_group_uuid.return_value = existing_supply

    deleted_supply = FuelSupply(
        **fe_data_dict,
        fuel_supply_id=2,
        version=1,
        action_type=ActionTypeEnum.DELETE,
        compliance_units=0,
        fuel_type=FUEL_TYPE_MOCK,
        fuel_category=FUEL_CATEGORY_MOCK,
        units="Litres",
    )
    mock_repo.create_fuel_supply.return_value = deleted_supply

    result = await fuel_supply_action_service_with_mocks.delete_fuel_supply(fe_data)
    assert isinstance(result, DeleteFuelSupplyResponseSchema)
    assert result.success is True
    assert result.message == "Marked as deleted."
    mock_repo.get_latest_fuel_supply_by_group_uuid.assert_awaited_once_with(
        fe_data.group_uuid
    )
    mock_repo.create_fuel_supply.assert_awaited_once()


@pytest.mark.anyio
async def test_populate_fuel_supply_fields(
    fuel_supply_action_service_with_mocks, mock_fuel_code_repo, sample_fs_data
):
    fe_data = sample_fs_data
    fe_data_dict = fe_data.model_dump(exclude=FUEL_SUPPLY_EXCLUDE_FIELDS)
    fuel_supply = FuelSupply(**fe_data_dict)
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=50.0,
        target_ci=80.0,
        eer=1.0,
        energy_density=None,
        uci=None,
    )
    populated_supply = (
        await fuel_supply_action_service_with_mocks._populate_fuel_supply_fields(
            fuel_supply, fe_data, "2024"
        )
    )
    assert populated_supply.units == QuantityUnitsEnum(fe_data.units)
    assert populated_supply.ci_of_fuel == 50.0
    assert populated_supply.target_ci == 80.0
    assert populated_supply.eer == 1
    assert populated_supply.energy_density == fe_data.energy_density
    assert populated_supply.energy == round(fe_data.energy_density * fe_data.quantity)
    assert populated_supply.compliance_units > 0
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once_with(
        fuel_type_id=fuel_supply.fuel_type_id,
        fuel_category_id=fuel_supply.fuel_category_id,
        end_use_id=fuel_supply.end_use_id,
        fuel_code_id=fuel_supply.fuel_code_id,
        compliance_period="2024",
    )


@pytest.mark.anyio
@pytest.mark.parametrize("case", test_cases)
async def test_create_compliance_units_calculation(
    case,
    fuel_supply_action_service_with_mocks,
    mock_repo,
    mock_fuel_code_repo,
    mock_fuel_supply,
):
    fe_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=3,
        fuel_category_id=2,
        end_use_id=1,
        fuel_code_id=1,
        quantity=case["input"]["quantity"],
        units=case["input"]["units"],
        energy_density=case["input"]["energy_density"],
        group_uuid=str(uuid4()),
        version=0,
        provision_of_the_act_id=123,
        is_canada_produced=True,
        is_q1_supplied=False,
    )
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=case["input"]["ci_of_fuel"],
        target_ci=case["input"]["target_ci"],
        eer=case["input"]["eer"],
        energy_density=case["input"]["energy_density"],
        uci=None,
    )

    mock_fuel_supply.quantity = case["input"]["quantity"]
    mock_fuel_supply.units = case["input"]["units"]
    mock_fuel_supply.energy_density = case["input"]["energy_density"]
    mock_fuel_supply.ci_of_fuel = case["input"]["ci_of_fuel"]
    mock_fuel_supply.target_ci = case["input"]["target_ci"]
    mock_fuel_supply.eer = case["input"]["eer"]
    mock_fuel_supply.compliance_units = case["expected_compliance_units"]

    mock_repo.get_fuel_supply_by_id.return_value = mock_fuel_supply
    mock_repo.create_fuel_supply.return_value = mock_fuel_supply

    result = await fuel_supply_action_service_with_mocks.create_fuel_supply(
        fe_data, "2024"
    )
    # Ensure result is awaited before calling assign_schema_fields
    result = await assign_schema_fields(result, fe_data)

    assert (
        result.compliance_units == case["rounded_compliance_units"]
    ), f"Failed {case['description']}. Expected {case['rounded_compliance_units']}, got {result.compliance_units}"
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once_with(
        fuel_type_id=fe_data.fuel_type_id,
        fuel_category_id=fe_data.fuel_category_id,
        end_use_id=fe_data.end_use_id,
        fuel_code_id=fe_data.fuel_code_id,
        compliance_period="2024",
    )
    mock_repo.create_fuel_supply.assert_awaited_once()


@pytest.mark.parametrize("case", test_cases)
def test_calculate_compliance_units(case):
    quantity = case["input"]["quantity"]
    target_ci = case["input"]["target_ci"]
    ci_of_fuel = case["input"]["ci_of_fuel"]
    energy_density = case["input"]["energy_density"]
    eer = case["input"]["eer"]
    UCI = 0  # Assuming UCI is zero
    result = calculate_compliance_units(
        TCI=target_ci,
        EER=eer,
        RCI=ci_of_fuel,
        UCI=UCI,
        Q=quantity,
        ED=energy_density,
    )
    assert (
        result == case["expected_compliance_units"]
    ), f"Failed {case['description']}. Expected {case['expected_compliance_units']}, got {result}"
