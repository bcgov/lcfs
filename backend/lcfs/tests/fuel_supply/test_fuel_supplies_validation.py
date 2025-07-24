from unittest.mock import MagicMock, AsyncMock
import pytest
from fastapi.exceptions import RequestValidationError

from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.schema import FuelSupplyCreateUpdateSchema
from lcfs.web.api.fuel_supply.validation import FuelSupplyValidation


@pytest.fixture
def fuel_supply_validation():
    # Mock repositories
    mock_fs_repo = MagicMock(spec=FuelSupplyRepository)
    mock_fc_repo = MagicMock(spec=FuelCodeRepository)

    # Create the validation instance with mocked repositories
    validation = FuelSupplyValidation(
        fs_repo=mock_fs_repo,
        fc_repo=mock_fc_repo,
    )
    return validation, mock_fs_repo, mock_fc_repo


@pytest.mark.anyio
async def test_check_duplicate(fuel_supply_validation):
    validation, mock_fs_repo, _ = fuel_supply_validation
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
    )

    mock_fs_repo.check_duplicate = AsyncMock(return_value=True)

    result = await validation.check_duplicate(fuel_supply_data)

    assert result is True
    mock_fs_repo.check_duplicate.assert_awaited_once_with(fuel_supply_data)


@pytest.mark.anyio
async def test_validate_other_recognized_type(fuel_supply_validation):
    validation, _, mock_fc_repo = fuel_supply_validation
    # Mock a recognized fuel type (unrecognized = False)
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=False)
    )

    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,  # Some recognized type ID
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
    )

    # Should not raise any error as fuel_type_other is not needed for recognized type
    await validation.validate_other(fuel_supply_data)


@pytest.mark.anyio
async def test_validate_other_unrecognized_type_with_other(fuel_supply_validation):
    validation, _, mock_fc_repo = fuel_supply_validation
    # Mock an unrecognized fuel type
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=True)
    )

    # Provide fuel_type_other and energy_density since it's unrecognized
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=99,  # Assume 99 is unrecognized "Other" type
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
        fuel_type_other="Some other fuel",
        energy_density=38.5,  # Required for "Other" fuel type
    )

    # Should not raise an error since fuel_type_other is provided
    await validation.validate_other(fuel_supply_data)


@pytest.mark.anyio
async def test_validate_other_unrecognized_type_missing_other(fuel_supply_validation):
    validation, _, mock_fc_repo = fuel_supply_validation
    # Mock an unrecognized fuel type
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=True)
    )

    # Missing fuel_type_other
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=99,  # Assume 99 is unrecognized "Other" type
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
    )

    # Should raise RequestValidationError since fuel_type_other is required
    with pytest.raises(RequestValidationError) as exc:
        await validation.validate_other(fuel_supply_data)

    # Assert that the error message is as expected
    errors = exc.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("fuelTypeOther",)
    assert "required when using Other" in errors[0]["msg"]


@pytest.mark.anyio
async def test_validate_other_unrecognized_type_missing_energy_density(fuel_supply_validation):
    validation, _, mock_fc_repo = fuel_supply_validation
    # Mock an unrecognized fuel type
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=True)
    )

    # Provide fuel_type_other but no energy_density
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=99,  # Assume 99 is unrecognized "Other" type
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
        fuel_type_other="Some other fuel",
        # energy_density is None by default
    )

    # Should raise RequestValidationError since energy_density is required for Other fuel type
    with pytest.raises(RequestValidationError) as exc:
        await validation.validate_other(fuel_supply_data)

    # Assert that the error message is as expected
    errors = exc.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("energyDensity",)
    assert "Energy Density must be greater than zero when using Other fuel type" in errors[0]["msg"]


@pytest.mark.anyio
async def test_validate_other_unrecognized_type_zero_energy_density(fuel_supply_validation):
    validation, _, mock_fc_repo = fuel_supply_validation
    # Mock an unrecognized fuel type
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=True)
    )

    # Provide fuel_type_other but energy_density is zero
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=99,  # Assume 99 is unrecognized "Other" type
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
        fuel_type_other="Some other fuel",
        energy_density=0,  # Invalid: should be > 0
    )

    # Should raise RequestValidationError since energy_density must be > 0 for Other fuel type
    with pytest.raises(RequestValidationError) as exc:
        await validation.validate_other(fuel_supply_data)

    # Assert that the error message is as expected
    errors = exc.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("energyDensity",)
    assert "Energy Density must be greater than zero when using Other fuel type" in errors[0]["msg"]
