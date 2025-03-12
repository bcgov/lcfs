import pytest
from unittest.mock import AsyncMock
from uuid import uuid4

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.ComplianceReport import QuantityUnitsEnum
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.web.api.fuel_code.repo import CarbonIntensityResult
from lcfs.web.api.fuel_supply.actions_service import FuelSupplyActionService
from lcfs.web.api.fuel_supply.schema import (
    FuelSupplyCreateUpdateSchema,
    DeleteFuelSupplyResponseSchema,
)
from lcfs.web.utils.calculations import calculate_compliance_units

# Constants defining which fields to exclude during model operations
FUEL_SUPPLY_EXCLUDE_FIELDS = {
    "id",
    "fuel_supply_id",
    "deleted",
    "group_uuid",
    "version",
    "action_type",
    "units",
    "is_new_supplemental_entry",
}

# Example test cases from the dataset
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


# Fixtures for mocks
@pytest.fixture
def mock_repo():
    """Mock FuelSupplyRepository."""
    repo = AsyncMock()
    repo.create_fuel_supply = AsyncMock()
    repo.update_fuel_supply = AsyncMock()
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
def fuel_supply_action_service(mock_repo, mock_fuel_code_repo):
    """Instantiate the FuelSupplyActionService with mocked dependencies."""
    return FuelSupplyActionService(repo=mock_repo, fuel_repo=mock_fuel_code_repo)


# Helper function to create sample FuelSupplyCreateUpdateSchema
def create_sample_fs_data():
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
    )


# Adjusted tests
@pytest.mark.anyio
async def test_create_fuel_supply_success(
    fuel_supply_action_service, mock_repo, mock_fuel_code_repo
):
    fe_data = create_sample_fs_data()

    mock_repo.get_compliance_period_id = AsyncMock(return_value=1)

    # Mock the response from get_standardized_fuel_data
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

    # Exclude invalid fields and set related objects
    fe_data_dict = fe_data.model_dump(exclude=FUEL_SUPPLY_EXCLUDE_FIELDS)

    # Mock the created fuel supply
    created_supply = FuelSupply(
        **fe_data_dict,
        fuel_supply_id=1,
        version=0,
        group_uuid="test_uuid",
        action_type=ActionTypeEnum.UPDATE,
    )
    created_supply.compliance_units = -100
    created_supply.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    created_supply.fuel_category = {"category": "Diesel"}
    created_supply.units = "Litres"
    mock_repo.create_fuel_supply.return_value = created_supply
    mock_repo.get_fuel_supply_by_id = AsyncMock(return_value=created_supply)

    # Call the method under test
    result = await fuel_supply_action_service.create_fuel_supply(fe_data, "2024")

    # Assign mocked related objects for schema validation
    result.fuel_type = {
        "fuel_type_id": fe_data.fuel_type_id,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    result.fuel_category = {"category": "Diesel"}
    result.units = fe_data.units

    # Assertions
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once_with(
        fuel_type_id=fe_data.fuel_type_id,
        fuel_category_id=fe_data.fuel_category_id,
        end_use_id=fe_data.end_use_id,
        fuel_code_id=fe_data.fuel_code_id,
        compliance_period="2024",
    )
    mock_repo.create_fuel_supply.assert_awaited_once()
    # Ensure compliance units were calculated correctly
    assert result.compliance_units < 0


@pytest.mark.anyio
async def test_update_fuel_supply_success_existing_report(
    fuel_supply_action_service, mock_repo, mock_fuel_code_repo
):
    fe_data = create_sample_fs_data()

    mock_repo.get_compliance_period_id = AsyncMock(return_value=1)

    # Exclude invalid fields
    fe_data_dict = fe_data.model_dump(exclude=FUEL_SUPPLY_EXCLUDE_FIELDS)

    # Mock existing supply with matching compliance_report_id
    existing_supply = FuelSupply(
        **fe_data_dict,
        fuel_supply_id=1,
        version=0,
        group_uuid="test_uuid",
        action_type=ActionTypeEnum.UPDATE,
    )
    existing_supply.compliance_units = -100
    existing_supply.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    existing_supply.fuel_category = {"category": "Diesel"}
    existing_supply.units = "Litres"
    mock_repo.get_fuel_supply_by_group_version.return_value = existing_supply

    # Mock the response from get_standardized_fuel_data
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=55.0,
        target_ci=85.0,
        eer=1.2,
        energy_density=36.0,
        uci=None,
    )

    # Mock the updated fuel supply
    updated_supply = FuelSupply(
        **fe_data_dict,
        fuel_supply_id=1,
        version=1,
        group_uuid="test_uuid",
        action_type=ActionTypeEnum.UPDATE,
    )
    updated_supply.compliance_units = -150
    updated_supply.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    updated_supply.fuel_category = {"category": "Diesel"}
    updated_supply.units = "Litres"
    mock_repo.update_fuel_supply.return_value = updated_supply

    mock_repo.get_fuel_supply_by_id = AsyncMock(return_value=updated_supply)

    # Call the method under test
    result = await fuel_supply_action_service.update_fuel_supply(fe_data, "2024")

    # Assign mocked related objects for schema validation
    result.fuel_type = {
        "fuel_type_id": fe_data.fuel_type_id,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    result.fuel_category = {"category": "Diesel"}
    result.units = fe_data.units

    # Assertions
    mock_repo.get_fuel_supply_by_group_version.assert_awaited_once_with(
        fe_data.group_uuid,
        fe_data.version,
    )
    mock_repo.update_fuel_supply.assert_awaited_once()
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once()
    # Ensure compliance units were updated correctly
    assert result.compliance_units == -150


@pytest.mark.anyio
async def test_update_fuel_supply_create_new_version(
    fuel_supply_action_service, mock_repo, mock_fuel_code_repo
):
    fe_data = create_sample_fs_data()
    fe_data.compliance_report_id = 2  # Different compliance report ID

    # Exclude invalid fields
    fe_data_dict = fe_data.model_dump(exclude=FUEL_SUPPLY_EXCLUDE_FIELDS)

    # Mock existing supply with different compliance_report_id
    existing_supply = FuelSupply(
        **fe_data_dict,
        fuel_supply_id=1,
        version=0,
        group_uuid="test_uuid",
        action_type=ActionTypeEnum.CREATE,
    )
    existing_supply.compliance_report_id = 1  # Original compliance_report_id
    existing_supply.compliance_units = -100
    existing_supply.version = 0
    existing_supply.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    existing_supply.fuel_category = {"category": "Diesel"}
    existing_supply.units = "Litres"

    # Mock the newly created supply (new version)
    new_supply = FuelSupply(
        **fe_data_dict,
        fuel_supply_id=2,
        version=existing_supply.version + 1,
        group_uuid="test_uuid",
        action_type=ActionTypeEnum.UPDATE,
    )
    new_supply.compliance_units = -150
    new_supply.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    new_supply.fuel_category = {"category": "Diesel"}
    new_supply.units = "Litres"

    mock_repo.get_fuel_supply_by_group_version.return_value = existing_supply
    mock_repo.get_compliance_period_id = AsyncMock(return_value=1)
    mock_repo.get_fuel_supply_by_id = AsyncMock(return_value=new_supply)

    # Mock the response from get_standardized_fuel_data
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=60.0,
        target_ci=90.0,
        eer=1.5,
        energy_density=37.0,
        uci=None,
    )
    mock_repo.create_fuel_supply.return_value = new_supply
    # Call the method under test
    result = await fuel_supply_action_service.update_fuel_supply(fe_data, "2024")

    # Assign mocked related objects for schema validation
    result.fuel_type = {
        "fuel_type_id": fe_data.fuel_type_id,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    result.fuel_category = {"category": "Diesel"}
    result.units = fe_data.units

    # Assertions
    mock_repo.get_fuel_supply_by_group_version.assert_awaited_once_with(
        fe_data.group_uuid, fe_data.version
    )
    mock_repo.create_fuel_supply.assert_awaited_once()
    mock_fuel_code_repo.get_standardized_fuel_data.assert_awaited_once()
    # Ensure compliance units were calculated correctly
    assert result.compliance_units == -150


@pytest.mark.anyio
async def test_delete_fuel_supply_success(
    fuel_supply_action_service, mock_repo, mock_fuel_code_repo
):
    fe_data = create_sample_fs_data()

    # Exclude invalid fields
    fe_data_dict = fe_data.model_dump(exclude=FUEL_SUPPLY_EXCLUDE_FIELDS)

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

    # Mock the deletion supply
    deleted_supply = FuelSupply(
        **fe_data_dict,
        fuel_supply_id=2,
        version=1,
        action_type=ActionTypeEnum.DELETE,
    )
    deleted_supply.compliance_units = 0
    deleted_supply.fuel_type = {
        "fuel_type_id": 3,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    deleted_supply.fuel_category = {"category": "Diesel"}
    deleted_supply.units = "Litres"
    mock_repo.create_fuel_supply.return_value = deleted_supply

    # Call the method under test
    result = await fuel_supply_action_service.delete_fuel_supply(fe_data)

    # Assertions
    assert isinstance(result, DeleteFuelSupplyResponseSchema)
    assert result.success is True
    assert result.message == "Marked as deleted."
    mock_repo.get_latest_fuel_supply_by_group_uuid.assert_awaited_once_with(
        fe_data.group_uuid
    )
    mock_repo.create_fuel_supply.assert_awaited_once()


@pytest.mark.anyio
async def test_populate_fuel_supply_fields(
    fuel_supply_action_service, mock_fuel_code_repo
):
    fe_data = create_sample_fs_data()

    # Exclude invalid fields
    fe_data_dict = fe_data.model_dump(exclude=FUEL_SUPPLY_EXCLUDE_FIELDS)

    # Create a FuelSupply instance without populated fields
    fuel_supply = FuelSupply(**fe_data_dict)

    # Mock standardized fuel data
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=50.0,
        target_ci=80.0,
        eer=1.0,
        energy_density=None,
        uci=None,
    )

    # Call the method under test
    populated_supply = await fuel_supply_action_service._populate_fuel_supply_fields(
        fuel_supply, fe_data, "2024"
    )

    # Assertions
    assert populated_supply.units == QuantityUnitsEnum(fe_data.units)
    assert populated_supply.ci_of_fuel == 50.0
    assert populated_supply.target_ci == 80.0
    assert populated_supply.eer == 1  # Default EER
    assert populated_supply.energy_density == fe_data.energy_density
    # Energy calculation
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
    case, fuel_supply_action_service, mock_repo, mock_fuel_code_repo
):
    fe_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=3,  # Adjusted to match the mock fuel_type
        fuel_category_id=2,  # Adjusted to match the mock fuel_category
        end_use_id=1,
        fuel_code_id=1,
        quantity=case["input"]["quantity"],
        units=case["input"]["units"],
        energy_density=case["input"]["energy_density"],
        group_uuid=str(uuid4()),
        version=0,
        provision_of_the_act_id=123,
    )

    # Mock standardized fuel data
    mock_fuel_code_repo.get_standardized_fuel_data.return_value = CarbonIntensityResult(
        effective_carbon_intensity=case["input"]["ci_of_fuel"],
        target_ci=case["input"]["target_ci"],
        eer=case["input"]["eer"],
        energy_density=case["input"]["energy_density"],
        uci=None,
    )

    # Mock the create_fuel_supply method to perform actual calculation
    async def create_fuel_supply_side_effect(fuel_supply):
        fuel_supply.fuel_supply_id = 1
        # Simulate the _populate_fuel_supply_fields logic
        fuel_supply.fuel_type = {
            "fuel_type_id": fuel_supply.fuel_type_id,
            "fuel_type": "Electricity",
            "units": "kWh",
        }
        fuel_supply.fuel_category = {"category": "Diesel"}
        fuel_supply.units = fe_data.units
        fuel_supply.group_uuid = str(uuid4())
        fuel_supply.action_type = ActionTypeEnum.CREATE
        fuel_supply.compliance_period = "2024"
        return fuel_supply

    mock_repo.get_fuel_supply_by_id = AsyncMock(
        return_value=FuelSupply(
            fuel_supply_id=1,
            compliance_report_id=1,
            group_uuid=str(uuid4()),
            version=0,
            action_type=ActionTypeEnum.CREATE,
            fuel_type_id=3,
            fuel_category_id=2,
            end_use_id=1,
            provision_of_the_act_id=123,
            quantity=case["input"]["quantity"],
            units=case["input"]["units"],
            energy_density=case["input"]["energy_density"],
            ci_of_fuel=case["input"]["ci_of_fuel"],
            target_ci=case["input"]["target_ci"],
            eer=case["input"]["eer"],
            compliance_units=case["expected_compliance_units"],
            fuel_type={
                "fuel_type_id": 3,
                "fuel_type": "Electricity",
                "units": "kWh",
            },
            fuel_category={"category": "Diesel"},
            provision_of_the_act={
                "provision_of_the_act_id": 123,
                "name": "Test Provision",
            },
        )
    )

    mock_repo.create_fuel_supply.side_effect = create_fuel_supply_side_effect

    # Call the service to create the fuel supply
    result = await fuel_supply_action_service.create_fuel_supply(fe_data, "2024")

    # Assign mocked related objects for schema validation
    result.fuel_type = {
        "fuel_type_id": fe_data.fuel_type_id,
        "fuel_type": "Electricity",
        "units": "kWh",
    }
    result.fuel_category = {"category": "Diesel"}
    result.units = fe_data.units

    # Assertions
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
    """
    Test the calculate_compliance_units function with various input scenarios.

    Args:
        case (dict): A dictionary containing the test case description, input parameters, and expected output.
    """
    # Extract input parameters
    quantity = case["input"]["quantity"]
    # Not used in calculation but included for context
    units = case["input"]["units"]
    target_ci = case["input"]["target_ci"]
    ci_of_fuel = case["input"]["ci_of_fuel"]
    energy_density = case["input"]["energy_density"]
    eer = case["input"]["eer"]

    # Constants not provided in test_cases
    UCI = 0  # Assuming Additional Carbon Intensity Attributable to Use is zero

    # Call the function under test
    result = calculate_compliance_units(
        TCI=target_ci,
        EER=eer,
        RCI=ci_of_fuel,
        UCI=UCI,
        Q=quantity,
        ED=energy_density,
    )

    # Assert that the result matches the expected compliance units
    assert (
        result == case["expected_compliance_units"]
    ), f"Failed {case['description']}. Expected {case['expected_compliance_units']}, got {result}"
