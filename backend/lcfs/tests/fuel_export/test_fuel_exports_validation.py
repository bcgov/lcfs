from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.exceptions import RequestValidationError

from lcfs.web.api.fuel_export.validation import FuelExportValidation
from lcfs.web.api.fuel_export.schema import FuelExportCreateUpdateSchema


@pytest.fixture
def fuel_export_validation(mock_fuel_code_repo):
    """
    Fixture to provide FuelExportValidation instance with mocked repositories
    """
    return FuelExportValidation(fc_repo=mock_fuel_code_repo), mock_fuel_code_repo


@pytest.mark.anyio
async def test_validate_other_recognized_type(fuel_export_validation):
    validation, mock_fc_repo = fuel_export_validation
    # Mock a recognized fuel type
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=False)
    )

    fuel_export_data = FuelExportCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=1,  # Assume 1 is a recognized type
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
    )

    # Should not raise an error since fuel type is recognized
    await validation.validate_other(fuel_export_data)


@pytest.mark.anyio
async def test_validate_other_unrecognized_type_with_other(fuel_export_validation):
    validation, mock_fc_repo = fuel_export_validation
    # Mock an unrecognized fuel type
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=True)
    )

    # Provide fuel_type_other and energy_density since it's unrecognized
    fuel_export_data = FuelExportCreateUpdateSchema(
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

    # Should not raise an error since fuel_type_other and energy_density are provided
    await validation.validate_other(fuel_export_data)


@pytest.mark.anyio
async def test_validate_other_unrecognized_type_missing_other(fuel_export_validation):
    validation, mock_fc_repo = fuel_export_validation
    # Mock an unrecognized fuel type
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=True)
    )

    fuel_export_data = FuelExportCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=99,  # Assume 99 is unrecognized "Other" type
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
        # fuel_type_other is missing
    )

    # Should raise RequestValidationError since fuel_type_other is required
    with pytest.raises(RequestValidationError) as exc:
        await validation.validate_other(fuel_export_data)

    # Assert that the error message is as expected
    errors = exc.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("fuelTypeOther",)
    assert "required when using Other" in errors[0]["msg"]


@pytest.mark.anyio
async def test_validate_other_unrecognized_type_missing_energy_density(fuel_export_validation):
    validation, mock_fc_repo = fuel_export_validation
    # Mock an unrecognized fuel type
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=True)
    )

    # Provide fuel_type_other but no energy_density
    fuel_export_data = FuelExportCreateUpdateSchema(
        compliance_report_id=1,
        fuel_type_id=99,  # Assume 99 is unrecognized "Other" type
        fuel_category_id=1,
        end_use_id=24,
        provision_of_the_act_id=1,
        quantity=2000,
        units="L",
        fuel_type_other="Some other fuel",
        # energy_density is 0 by default in schema
    )

    # Should raise RequestValidationError since energy_density is required for Other fuel type
    with pytest.raises(RequestValidationError) as exc:
        await validation.validate_other(fuel_export_data)

    # Assert that the error message is as expected
    errors = exc.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("energyDensity",)
    assert "Energy Density must be greater than zero when using Other fuel type" in errors[0]["msg"]


@pytest.mark.anyio
async def test_validate_other_unrecognized_type_zero_energy_density(fuel_export_validation):
    validation, mock_fc_repo = fuel_export_validation
    # Mock an unrecognized fuel type
    mock_fc_repo.get_fuel_type_by_id = AsyncMock(
        return_value=MagicMock(unrecognized=True)
    )

    # Provide fuel_type_other but energy_density is zero
    fuel_export_data = FuelExportCreateUpdateSchema(
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
        await validation.validate_other(fuel_export_data)

    # Assert that the error message is as expected
    errors = exc.value.errors()
    assert len(errors) == 1
    assert errors[0]["loc"] == ("energyDensity",)
    assert "Energy Density must be greater than zero when using Other fuel type" in errors[0]["msg"]