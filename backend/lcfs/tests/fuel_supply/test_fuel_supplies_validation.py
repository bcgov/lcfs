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
        is_canada_produced=True,
        is_q1_supplied=False,
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
        is_canada_produced=True,
        is_q1_supplied=False,
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
        is_canada_produced=True,
        is_q1_supplied=False,
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
        is_canada_produced=True,
        is_q1_supplied=False,
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
        is_canada_produced=True,
        is_q1_supplied=False,
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
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    # Should raise RequestValidationError since energy_density must be > 0 for Other fuel type
    with pytest.raises(RequestValidationError) as exc:
        await validation.validate_other(fuel_supply_data)

    # Assert that the error message is as expected
    errors = exc.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("energyDensity",)
    assert "Energy Density must be greater than zero when using Other fuel type" in errors[0]["msg"]


# End use validation tests for pre-2024 vs 2024+ compliance periods


@pytest.mark.anyio
async def test_validate_other_end_use_not_required_pre_2024(fuel_supply_validation):
    """End use is not required for compliance periods before 2024"""
    validation, _, mock_fc_repo = fuel_supply_validation
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=False)
    )

    # No end_use_id provided
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=None,  # No end use
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    # Should not raise error for pre-2024 compliance periods
    await validation.validate_other(fuel_supply_data, compliance_period_year=2023)
    await validation.validate_other(fuel_supply_data, compliance_period_year=2020)
    await validation.validate_other(fuel_supply_data, compliance_period_year=2010)


@pytest.mark.anyio
async def test_validate_other_end_use_required_2024_and_later(fuel_supply_validation):
    """End use is required for compliance periods 2024 and later"""
    validation, _, mock_fc_repo = fuel_supply_validation
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=False)
    )

    # No end_use_id provided
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=None,  # No end use - should fail for 2024+
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    # Should raise RequestValidationError for 2024 compliance period
    with pytest.raises(RequestValidationError) as exc:
        await validation.validate_other(fuel_supply_data, compliance_period_year=2024)

    errors = exc.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("endUseId",)
    assert "End use is required for compliance periods 2024 and later" in errors[0]["msg"]


@pytest.mark.anyio
async def test_validate_other_end_use_required_2025_and_later(fuel_supply_validation):
    """End use is required for compliance periods 2025 and beyond"""
    validation, _, mock_fc_repo = fuel_supply_validation
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=False)
    )

    # No end_use_id provided
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=None,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    # Should raise RequestValidationError for 2025 compliance period
    with pytest.raises(RequestValidationError) as exc:
        await validation.validate_other(fuel_supply_data, compliance_period_year=2025)

    errors = exc.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("endUseId",)
    assert "End use is required for compliance periods 2024 and later" in errors[0]["msg"]


@pytest.mark.anyio
async def test_validate_other_end_use_provided_2024(fuel_supply_validation):
    """End use validation passes when end_use_id is provided for 2024+"""
    validation, _, mock_fc_repo = fuel_supply_validation
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=False)
    )

    # end_use_id provided
    fuel_supply_data = FuelSupplyCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,
        fuel_category_id=1,
        end_use_id=24,  # End use provided
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
        is_canada_produced=True,
        is_q1_supplied=False,
    )

    # Should not raise error when end_use_id is provided
    await validation.validate_other(fuel_supply_data, compliance_period_year=2024)
    await validation.validate_other(fuel_supply_data, compliance_period_year=2025)
    await validation.validate_other(fuel_supply_data, compliance_period_year=2030)
