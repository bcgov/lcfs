import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.compliance import CompliancePeriod
from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.calculator.schema import FuelTypeSchema
from lcfs.web.api.calculator.repo import CalculatorRepository
from lcfs.web.exception.exceptions import DatabaseException


@pytest.fixture
def mock_db():
    """Create a properly structured async db mock"""
    db = AsyncMock(spec=AsyncSession)
    return db


@pytest.fixture
def calculator_repo(mock_db):
    return CalculatorRepository(db=mock_db)


# Tests for get_compliance_periods
@pytest.mark.anyio
async def test_get_compliance_periods_success(calculator_repo, mock_db):
    # Create mock data
    mock_periods = [
        CompliancePeriod(compliance_period_id=1, description="2024"),
        CompliancePeriod(compliance_period_id=2, description="2023"),
    ]

    # Setup the db.execute to return a result object that supports method chaining
    # This is different from our previous approach - we're creating a proper chain
    result_mock = MagicMock()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = mock_periods
    result_mock.scalars.return_value = scalars_mock

    # Make mock_db.execute() return an awaitable that resolves to result_mock
    mock_db.execute.return_value = result_mock

    # Call the method
    result = await calculator_repo.get_compliance_periods()

    # Verify results
    assert result == mock_periods
    assert len(result) == 2
    assert result[0].description == "2024"
    assert result[1].description == "2023"

    # Verify query was executed
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_compliance_periods_empty(calculator_repo, mock_db):
    # Setup mock to return empty list with proper method chaining
    result_mock = MagicMock()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = []
    result_mock.scalars.return_value = scalars_mock

    mock_db.execute.return_value = result_mock

    # Call the method
    result = await calculator_repo.get_compliance_periods()

    # Verify results
    assert result == []
    mock_db.execute.assert_called_once()


# Tests for get_fuel_types
@pytest.mark.anyio
async def test_get_fuel_types_success(calculator_repo, mock_db):
    # Mock fuel types data
    mock_fuel_types = [
        (1, "Gasoline", True, False, False, "L", 1, "Gasoline"),
        (2, "Diesel", True, False, False, "L", 2, "Diesel"),
    ]

    # Setup proper method chaining with all()
    result_mock = MagicMock()
    result_mock.all.return_value = mock_fuel_types
    mock_db.execute.return_value = result_mock

    # Mock the FuelTypeSchema.model_validate to return expected objects
    with patch.object(FuelTypeSchema, "model_validate") as mock_validate:
        # Create mock schema objects that will be returned
        mock_schemas = [
            MagicMock(fuel_type_id=ft[0], fuel_type=ft[1], fossil_derived=ft[2])
            for ft in mock_fuel_types
        ]
        mock_validate.side_effect = mock_schemas

        # Call the method
        result = await calculator_repo.get_fuel_types(
            lcfs_only=False, fuel_category="Gasoline", is_legacy=False
        )

    # Verify the results
    assert len(result) == 2
    assert result[0].fuel_type_id == 1
    assert result[0].fuel_type == "Gasoline"
    assert result[1].fuel_type_id == 2

    # Verify query construction
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_fuel_types_with_filters(calculator_repo, mock_db):
    # Mock fuel types data
    mock_fuel_types = [(1, "Gasoline", True, False, False, "L", 1, "Gasoline")]

    # Setup proper method chaining
    result_mock = MagicMock()
    result_mock.all.return_value = mock_fuel_types
    mock_db.execute.return_value = result_mock

    # Mock the FuelTypeSchema.model_validate
    with patch.object(FuelTypeSchema, "model_validate") as mock_validate:
        mock_schema = MagicMock(
            fuel_type_id=1, fuel_type="Gasoline", fossil_derived=True
        )
        mock_validate.return_value = mock_schema

        # Call the method with lcfs_only=True
        result = await calculator_repo.get_fuel_types(
            lcfs_only=True, fuel_category="Gasoline", is_legacy=True
        )

    # Verify the results
    assert len(result) == 1
    assert result[0].fuel_type == "Gasoline"

    # Verify query was executed
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_fuel_types_empty(calculator_repo, mock_db):
    # Setup mock to return empty list
    result_mock = MagicMock()
    result_mock.all.return_value = []
    mock_db.execute.return_value = result_mock

    # Call the method
    result = await calculator_repo.get_fuel_types(
        lcfs_only=False, fuel_category="NonExistentCategory", is_legacy=False
    )

    # Verify the results
    assert result == []
    mock_db.execute.assert_called_once()


# Tests for get_fuel_type_options
@pytest.mark.anyio
async def test_get_fuel_type_options_success(calculator_repo, mock_db):
    # Mock fuel type options data
    mock_options = [
        # Create a tuple that matches all the fields selected in the query
        (
            1,
            1,
            1,
            "Gasoline",
            True,
            90.0,
            85.0,
            "Gasoline",
            1,
            "Section 6",
            1,
            36.4,
            "L",
            False,
            1,
            "Type1",
            "Subtype1",
            1,
            "MJ/L",
            1,
            1.0,
            1,
            90.0,
            10.0,
            1,
            "001",
            1,
            "BCLCF",
            80.0,
        )
    ]

    # Setup proper method chaining
    result_mock = MagicMock()
    result_mock.all.return_value = mock_options
    mock_db.execute.return_value = result_mock

    # Set up compliance period scalar subquery mocks
    with patch("lcfs.web.api.calculator.repo.select") as mock_select:
        # We need to mock select() and its chain to return scalar_subquery values
        mock_scalar = MagicMock()
        mock_scalar.scalar_subquery.return_value = 1
        mock_where = MagicMock()
        mock_where.return_value = mock_scalar
        mock_select.return_value.where = mock_where

        # Call the method
        result = await calculator_repo.get_fuel_type_options(
            compliance_period="2024",
            fuel_type_id=1,
            fuel_category_id=1,
            lcfs_only=False,
            include_legacy=False,
        )

    # Verify the results
    assert "fuel_types" in result
    assert len(result["fuel_types"]) == 1
    assert result["fuel_types"][0][3] == "Gasoline"  # fuel_type

    # Verify query construction
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_fuel_type_options_legacy_period(calculator_repo, mock_db):
    # Mock fuel type options data
    mock_options = [
        # Create a tuple for legacy options
        (
            1,
            1,
            1,
            "Gasoline",
            True,
            90.0,
            85.0,
            "Gasoline",
            1,
            "Section 6",
            1,
            36.4,
            "L",
            False,
            1,
            "Type1",
            "Subtype1",
            1,
            "MJ/L",
            1,
            1.0,
            1,
            90.0,
            10.0,
            1,
            "001",
            1,
            "BCLCF",
            80.0,
        )
    ]

    # Setup proper method chaining
    result_mock = MagicMock()
    result_mock.all.return_value = mock_options
    mock_db.execute.return_value = result_mock

    # Mock LEGISLATION_TRANSITION_YEAR
    with patch.object(LCFS_Constants, "LEGISLATION_TRANSITION_YEAR", "2024"), patch(
        "lcfs.web.api.calculator.repo.select"
    ) as mock_select:

        # Setup scalar subquery mocks
        mock_scalar = MagicMock()
        mock_scalar.scalar_subquery.return_value = 1
        mock_where = MagicMock()
        mock_where.return_value = mock_scalar
        mock_select.return_value.where = mock_where

        # Call the method with a legacy period
        result = await calculator_repo.get_fuel_type_options(
            compliance_period="2023",
            fuel_type_id=1,
            fuel_category_id=1,
            lcfs_only=False,
        )

    # Verify the results
    assert "fuel_types" in result
    assert len(result["fuel_types"]) == 1

    # Verify query was executed
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_fuel_type_options_with_filters(calculator_repo, mock_db):
    # Mock fuel type options data
    mock_options = [
        # Create a tuple for filtered options
        (
            1,
            1,
            1,
            "Gasoline",
            True,
            90.0,
            85.0,
            "Gasoline",
            1,
            "Section 6",
            1,
            36.4,
            "L",
            False,
            1,
            "Type1",
            "Subtype1",
            1,
            "MJ/L",
            1,
            1.0,
            1,
            90.0,
            10.0,
            1,
            "001",
            1,
            "BCLCF",
            80.0,
        )
    ]

    # Setup proper method chaining
    result_mock = MagicMock()
    result_mock.all.return_value = mock_options
    mock_db.execute.return_value = result_mock

    # Set up compliance period scalar subquery mocks
    with patch("lcfs.web.api.calculator.repo.select") as mock_select:
        # Setup scalar subquery mocks
        mock_scalar = MagicMock()
        mock_scalar.scalar_subquery.return_value = 1
        mock_where = MagicMock()
        mock_where.return_value = mock_scalar
        mock_select.return_value.where = mock_where

        # Call the method with lcfs_only=True
        result = await calculator_repo.get_fuel_type_options(
            compliance_period="2024",
            fuel_type_id=1,
            fuel_category_id=1,
            lcfs_only=True,
            include_legacy=False,
        )

    # Verify the results
    assert "fuel_types" in result
    assert len(result["fuel_types"]) == 1

    # Verify query was executed
    mock_db.execute.assert_called_once()


@pytest.mark.anyio
async def test_get_fuel_type_options_invalid_compliance_period(calculator_repo):
    # Call the method with an invalid compliance period
    # We need to catch DatabaseException which wraps ValueError
    with pytest.raises(DatabaseException):
        await calculator_repo.get_fuel_type_options(
            compliance_period="invalid", fuel_type_id=1, fuel_category_id=1
        )


@pytest.mark.anyio
async def test_get_fuel_type_options_empty(calculator_repo, mock_db):
    # Setup mock to return empty list
    result_mock = MagicMock()
    result_mock.all.return_value = []
    mock_db.execute.return_value = result_mock

    # Set up compliance period scalar subquery mocks
    with patch("lcfs.web.api.calculator.repo.select") as mock_select:
        # Setup scalar subquery mocks
        mock_scalar = MagicMock()
        mock_scalar.scalar_subquery.return_value = 1
        mock_where = MagicMock()
        mock_where.return_value = mock_scalar
        mock_select.return_value.where = mock_where

        # Call the method
        result = await calculator_repo.get_fuel_type_options(
            compliance_period="2024",
            fuel_type_id=999,  # Non-existent ID
            fuel_category_id=999,  # Non-existent ID
            lcfs_only=False,
            include_legacy=False,
        )

    # Verify the results
    assert "fuel_types" in result
    assert result["fuel_types"] == []

    # Verify query was executed
    mock_db.execute.assert_called_once()
