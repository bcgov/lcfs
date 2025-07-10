import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from lcfs.web.api.fuel_supply.schema import FuelTypeOptionsSchema
from lcfs.web.api.calculator.schema import CreditsResultSchema
from lcfs.web.api.calculator.services import CalculatorService
from lcfs.web.exception.exceptions import ServiceException


@pytest.fixture
def mock_repo():
    mock = MagicMock()
    mock.get_compliance_periods = AsyncMock()
    mock.get_fuel_types = AsyncMock()
    mock.get_fuel_type_options = AsyncMock()
    return mock


@pytest.fixture
def mock_fs_service():
    mock = MagicMock()
    mock.fuel_type_row_mapper = MagicMock()
    return mock


@pytest.fixture
def mock_fuel_repo():
    mock = MagicMock()
    mock.get_standardized_fuel_data = AsyncMock()
    return mock


@pytest.fixture
def calculator_service(mock_repo, mock_fs_service, mock_fuel_repo):
    return CalculatorService(
        repo=mock_repo, fs_service=mock_fs_service, fuel_repo=mock_fuel_repo
    )


# Tests for get_compliance_periods
@pytest.mark.anyio
async def test_get_compliance_periods_success(calculator_service, mock_repo):
    # Mock data
    mock_periods = [
        {"compliance_period_id": 1, "description": "2024 Compliance Period"},
        {"compliance_period_id": 2, "description": "2025 Compliance Period"},
    ]
    mock_repo.get_compliance_periods.return_value = mock_periods

    # Call the service
    result = await calculator_service.get_compliance_periods()

    # Assertions
    assert len(result) == 2
    assert isinstance(result[0], CompliancePeriodBaseSchema)
    assert result[0].compliance_period_id == 1
    assert result[0].description == "2024 Compliance Period"
    assert result[1].compliance_period_id == 2
    assert result[1].description == "2025 Compliance Period"
    mock_repo.get_compliance_periods.assert_called_once()


@pytest.mark.anyio
async def test_get_compliance_periods_unexpected_error(calculator_service, mock_repo):
    # Mock an unexpected error
    mock_repo.get_compliance_periods.side_effect = Exception("Unexpected error")

    # Call the service and expect a ServiceException
    with pytest.raises(ServiceException):
        await calculator_service.get_compliance_periods()

    mock_repo.get_compliance_periods.assert_called_once()


# Tests for get_fuel_types
@pytest.mark.anyio
async def test_get_fuel_types_success(calculator_service, mock_repo):
    # Mock data for a modern compliance period
    mock_fuel_types = [
        {
            "fuelType": "Gasoline",
            "fuelTypeId": 1,
            "fuelCategory": "Gasoline",
            "fuelCategoryId": 1,
        },
        {
            "fuelType": "Diesel",
            "fuelTypeId": 2,
            "fuelCategory": "Diesel",
            "fuelCategoryId": 2,
        },
    ]
    mock_repo.get_fuel_types.return_value = mock_fuel_types

    # Call the service
    result = await calculator_service.get_fuel_types("2024", False, "Gasoline")

    # Assertions
    assert result == mock_fuel_types
    mock_repo.get_fuel_types.assert_called_once_with(False, "Gasoline", is_legacy=False)


@pytest.mark.anyio
async def test_get_fuel_types_legacy_period(calculator_service, mock_repo):
    # Mock data for a legacy compliance period
    mock_fuel_types = [
        {
            "fuelType": "Gasoline",
            "fuelTypeId": 1,
            "fuelCategory": "Gasoline",
            "fuelCategoryId": 1,
        }
    ]
    mock_repo.get_fuel_types.return_value = mock_fuel_types

    # Call the service with a legacy period
    result = await calculator_service.get_fuel_types("2023", False, "Gasoline")

    # Assertions
    assert result == mock_fuel_types
    mock_repo.get_fuel_types.assert_called_once_with(False, "Gasoline", is_legacy=True)


@pytest.mark.anyio
async def test_get_fuel_types_invalid_compliance_period(calculator_service):
    # Call the service with an invalid compliance period
    with pytest.raises(
        ValueError, match="Invalid compliance_period: 'invalid' must be an integer"
    ):
        await calculator_service.get_fuel_types("invalid", False, "Gasoline")


@pytest.mark.anyio
async def test_get_fuel_types_unexpected_error(calculator_service, mock_repo):
    # Mock an unexpected error
    mock_repo.get_fuel_types.side_effect = Exception("Unexpected error")

    # Call the service and expect a ServiceException
    with pytest.raises(ServiceException):
        await calculator_service.get_fuel_types("2024", False, "Gasoline")


# Tests for get_fuel_type_options
@pytest.mark.anyio
async def test_get_fuel_type_options_success(
    calculator_service, mock_repo, mock_fs_service
):
    # Mock fuel type options
    mock_options = {
        "fuel_types": [
            {
                "fuelType": "Gasoline",
                "provisions": [{"id": 1, "name": "Provision 1"}],
                "fuelCodes": [{"id": 1, "fuelCode": "FC001"}],
                "eerRatios": [{"endUseType": {"type": "Type1", "endUseTypeId": 1}}],
                "unit": "liters",
                "energyDensity": {"value": 36.4, "unit": {"name": "MJ/L"}},
            }
        ]
    }
    mock_repo.get_fuel_type_options.return_value = mock_options

    # Mock a transformed fuel types list
    transformed_fuel_type = {
        "fuelType": "Gasoline",
        "provisions": [{"id": 1, "name": "Provision 1"}],
        "fuelCodes": [{"id": 1, "fuelCode": "FC001"}],
        "eerRatios": [{"endUseType": {"type": "Type1", "endUseTypeId": 1}}],
        "unit": "liters",
        "energyDensity": {"value": 36.4, "unit": {"name": "MJ/L"}},
    }

    # Set up the fs_service.fuel_type_row_mapper to add to fuel_types
    def mock_mapper(compliance_period, fuel_types, row):
        fuel_types.append(transformed_fuel_type)

    mock_fs_service.fuel_type_row_mapper.side_effect = mock_mapper

    # Mock validation
    with patch.object(
        FuelTypeOptionsSchema, "model_validate", return_value=transformed_fuel_type
    ):
        # Call the service
        result = await calculator_service.get_fuel_type_options("2024", 1, 1, False)

        # Assertions
        assert result == transformed_fuel_type
        mock_repo.get_fuel_type_options.assert_called_once_with(
            "2024", 1, 1, lcfs_only=False, include_legacy=False
        )
        mock_fs_service.fuel_type_row_mapper.assert_called_once()


@pytest.mark.anyio
async def test_get_fuel_type_options_legacy_period(
    calculator_service, mock_repo, mock_fs_service
):
    # Mock fuel type options
    mock_options = {
        "fuel_types": [
            {
                "fuelType": "Gasoline",
                "provisions": [{"id": 1, "name": "Provision 1"}],
                "fuelCodes": [{"id": 1, "fuelCode": "FC001"}],
                "unit": "liters",
                "energyDensity": {"value": 36.4, "unit": {"name": "MJ/L"}},
            }
        ]
    }
    mock_repo.get_fuel_type_options.return_value = mock_options

    # Mock a transformed fuel types list
    transformed_fuel_type = {
        "fuelType": "Gasoline",
        "provisions": [{"id": 1, "name": "Provision 1"}],
        "fuelCodes": [{"id": 1, "fuelCode": "FC001"}],
        "unit": "liters",
        "energyDensity": {"value": 36.4, "unit": {"name": "MJ/L"}},
    }

    # Set up the fs_service.fuel_type_row_mapper to add to fuel_types
    def mock_mapper(compliance_period, fuel_types, row):
        fuel_types.append(transformed_fuel_type)

    mock_fs_service.fuel_type_row_mapper.side_effect = mock_mapper

    # Mock validation
    with patch.object(
        FuelTypeOptionsSchema, "model_validate", return_value=transformed_fuel_type
    ):
        # Call the service with a legacy period
        result = await calculator_service.get_fuel_type_options("2023", 1, 1, False)

        # Assertions
        assert result == transformed_fuel_type
        mock_repo.get_fuel_type_options.assert_called_once_with(
            "2023", 1, 1, lcfs_only=False, include_legacy=True
        )
        mock_fs_service.fuel_type_row_mapper.assert_called_once()


@pytest.mark.anyio
async def test_get_fuel_type_options_no_fuel_types(
    calculator_service, mock_repo, mock_fs_service
):
    # Mock fuel type options with no fuel types
    mock_options = {"fuel_types": []}
    mock_repo.get_fuel_type_options.return_value = mock_options

    # Call the service
    result = await calculator_service.get_fuel_type_options("2024", 1, 1, False)

    # Assertions
    assert result == {}
    mock_repo.get_fuel_type_options.assert_called_once()
    # fs_service.fuel_type_row_mapper should not be called as there are no fuel types
    mock_fs_service.fuel_type_row_mapper.assert_not_called()


@pytest.mark.anyio
async def test_get_fuel_type_options_invalid_compliance_period(calculator_service):
    # Call the service with an invalid compliance period
    with pytest.raises(
        ValueError, match="Invalid compliance_period: 'invalid' must be an integer"
    ):
        await calculator_service.get_fuel_type_options("invalid", 1, 1)


@pytest.mark.anyio
async def test_get_fuel_type_options_unexpected_error(calculator_service, mock_repo):
    # Mock an unexpected error
    mock_repo.get_fuel_type_options.side_effect = Exception("Unexpected error")

    # Call the service and expect a ServiceException
    with pytest.raises(ServiceException):
        await calculator_service.get_fuel_type_options("2024", 1, 1)


# Tests for get_calculated_data
@pytest.mark.anyio
async def test_get_calculated_data_modern_period(calculator_service, mock_fuel_repo):
    # Set up LEGISLATION_TRANSITION_YEAR
    with patch.object(LCFS_Constants, "LEGISLATION_TRANSITION_YEAR", "2024"):
        # Mock standardized fuel data
        mock_fuel_data = MagicMock()
        mock_fuel_data.target_ci = 90.0
        mock_fuel_data.eer = 1.0
        mock_fuel_data.effective_carbon_intensity = 75.0
        mock_fuel_data.uci = 5.0
        mock_fuel_data.energy_density = 38.5
        mock_fuel_repo.get_standardized_fuel_data.return_value = mock_fuel_data

        # Mock calculate_compliance_units function
        with patch(
            "lcfs.web.api.calculator.services.calculate_compliance_units",
            return_value=100,
        ):
            # Call the service
            result = await calculator_service.get_calculated_data(
                "2024", 1, 1, 1, 1, 1000
            )

            # Assertions
            assert isinstance(result, CreditsResultSchema)
            assert result.rci == 75.0
            assert result.tci == 90.0
            assert result.eer == 1.0
            assert result.energy_density == 38.5
            assert result.uci == 5.0
            assert result.quantity == 1000
            assert result.energy_content == 1000 * 38.5
            assert result.compliance_units == 100

            # Verify the correct calculation function was called
            from lcfs.web.api.calculator.services import calculate_compliance_units

            calculate_compliance_units.assert_called_once_with(
                TCI=90.0, EER=1.0, RCI=75.0, UCI=5.0, Q=1000, ED=38.5
            )


@pytest.mark.anyio
async def test_get_calculated_data_legacy_period(calculator_service, mock_fuel_repo):
    # Set up LEGISLATION_TRANSITION_YEAR
    with patch.object(LCFS_Constants, "LEGISLATION_TRANSITION_YEAR", "2024"):
        # Mock standardized fuel data
        mock_fuel_data = MagicMock()
        mock_fuel_data.target_ci = 90.0
        mock_fuel_data.eer = 1.0
        mock_fuel_data.effective_carbon_intensity = 75.0
        mock_fuel_data.uci = None
        mock_fuel_data.energy_density = 38.5
        mock_fuel_repo.get_standardized_fuel_data.return_value = mock_fuel_data

        # Mock calculate_legacy_compliance_units function
        with patch(
            "lcfs.web.api.calculator.services.calculate_legacy_compliance_units",
            return_value=100,
        ):
            # Call the service with a legacy period
            result = await calculator_service.get_calculated_data(
                "2023", 1, 1, 1, 1, 1000
            )

            # Assertions
            assert isinstance(result, CreditsResultSchema)
            assert result.rci == 75.0
            assert result.tci == 90.0
            assert result.eer == 1.0
            assert result.energy_density == 38.5
            assert result.uci is None
            assert result.quantity == 1000
            assert result.energy_content == 1000 * 38.5
            assert result.compliance_units == 100

            # Verify the correct calculation function was called
            from lcfs.web.api.calculator.services import (
                calculate_legacy_compliance_units,
            )

            calculate_legacy_compliance_units.assert_called_once_with(
                TCI=90.0, EER=1.0, RCI=75.0, Q=1000, ED=38.5
            )


@pytest.mark.anyio
async def test_get_calculated_data_rounds_values_correctly(
    calculator_service, mock_fuel_repo
):
    # Mock standardized fuel data with values that need rounding
    mock_fuel_data = MagicMock()
    mock_fuel_data.target_ci = 90.12345
    mock_fuel_data.eer = 1.12345
    mock_fuel_data.effective_carbon_intensity = 75.12345
    mock_fuel_data.uci = 5.12345
    mock_fuel_data.energy_density = 38.12345
    mock_fuel_repo.get_standardized_fuel_data.return_value = mock_fuel_data

    # Mock calculate_compliance_units function
    with patch(
        "lcfs.web.api.calculator.services.calculate_compliance_units",
        return_value=100.6,
    ):
        # Call the service
        result = await calculator_service.get_calculated_data("2024", 1, 1, 1, 1, 1000)

        # Assertions for rounded values
        assert result.rci == 75.12  # rounded to 2 decimal places
        assert result.tci == 90.12345  # rounded to 2 decimal places
        assert result.eer == 1.12  # rounded to 2 decimal places
        assert result.energy_density == 38.12  # rounded to 2 decimal places
        assert result.energy_content == 1000 * 38.12345  # not rounded in calculation
        assert result.compliance_units == 101  # rounded to integer


@pytest.mark.anyio
async def test_get_calculated_data_unexpected_error(calculator_service, mock_fuel_repo):
    # Mock an unexpected error in get_standardized_fuel_data
    mock_fuel_repo.get_standardized_fuel_data.side_effect = Exception(
        "Unexpected error"
    )

    # Call the service and expect a ServiceException
    with pytest.raises(ServiceException):
        await calculator_service.get_calculated_data("2024", 1, 1, 1, 1, 1000)
