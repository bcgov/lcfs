import pytest
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock, PropertyMock

from lcfs.db.models.compliance import OtherUses
from lcfs.db.models.fuel import (
    DefaultCarbonIntensity,
    ExpectedUseType,
    FuelType,
    ProvisionOfTheAct,
    FuelCode,
)
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.tests.other_uses.conftest import create_mock_entity
from lcfs.web.api.other_uses.repo import OtherUsesRepository


@pytest.fixture
def mock_query_result():
    # Setup mock for database query result chain
    mock_result = AsyncMock()
    mock_result.unique = MagicMock(return_value=mock_result)
    mock_result.scalars = MagicMock(return_value=mock_result)
    mock_result.all = MagicMock(return_value=[MagicMock(spec=OtherUses)])
    return mock_result


@pytest.fixture
def mock_db_session(mock_query_result):
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=mock_query_result)
    return session


@pytest.fixture
def other_uses_repo(mock_db_session):
    repo = OtherUsesRepository(db=mock_db_session)
    repo.fuel_code_repo = MagicMock()
    repo.fuel_code_repo.get_fuel_categories = AsyncMock(return_value=[])
    repo.fuel_code_repo.get_fuel_types = AsyncMock(return_value=[])
    repo.fuel_code_repo.get_expected_use_types = AsyncMock(return_value=[])
    return repo


@pytest.mark.anyio
async def test_get_table_options(other_uses_repo, mock_db_session):
    """Test get_table_options with properly spec'd mocks"""

    # Create mock models with proper specs
    mock_fuel_category = MagicMock(spec=FuelCategory)
    mock_fuel_category.fuel_category_id = 1
    mock_fuel_category.category = "Petroleum-based"

    mock_fuel_code = MagicMock(spec=FuelCode)
    mock_fuel_code.fuel_code_id = 1
    mock_fuel_code.fuel_code = "FC123"
    mock_fuel_code.carbon_intensity = 10.5
    mock_fuel_code.effective_date = date.today() - timedelta(days=1)  # Past date
    mock_fuel_code.expiration_date = date.today() + timedelta(days=1)  # Future date

    mock_provision = MagicMock(spec=ProvisionOfTheAct)
    mock_provision.provision_of_the_act_id = 1
    mock_provision.name = "Provision A"
    mock_provision.is_legacy = False

    mock_expected_use = MagicMock(spec=ExpectedUseType)
    mock_expected_use.expected_use_id = 1
    mock_expected_use.name = "Transportation"

    mock_fuel_type = MagicMock(spec=FuelType)
    mock_fuel_type.fuel_type_id = 1
    mock_fuel_type.fuel_type = "Gasoline"
    mock_fuel_type.default_carbon_intensity = 12.34
    mock_fuel_type.units = "L"
    mock_fuel_type.unrecognized = False
    mock_fuel_type.other_uses_fossil_derived = True
    mock_fuel_type.is_legacy = False
    mock_fuel_type.fuel_instances = []
    mock_fuel_type.fuel_codes = [mock_fuel_code]
    mock_fuel_type.provision_1 = mock_provision
    mock_fuel_type.provision_2 = None

    # Configure mock database responses
    def mock_execute_side_effect(*args, **kwargs):
        query = args[0]
        query_str = str(query)

        # Default mock result setup
        mock_result = MagicMock()
        mock_result.unique.return_value = mock_result
        mock_result.scalars.return_value = mock_result

        if "select" in query_str.lower() and "fuel_type" in query_str.lower():
            mock_result.all.return_value = [mock_fuel_type]
        elif "provision_of_the_act" in query_str:
            mock_result.all.return_value = [mock_provision]
        elif "fuel_code" in query_str:
            mock_result.all.return_value = [mock_fuel_code]
        else:
            mock_result.all.return_value = []

        return mock_result

    mock_db_session.execute = AsyncMock(side_effect=mock_execute_side_effect)
    other_uses_repo.db = mock_db_session

    # Setup fuel code repo with direct mock responses
    mock_fuel_code_repo = MagicMock()
    mock_fuel_code_repo.get_fuel_categories = AsyncMock(
        return_value=[mock_fuel_category]
    )
    mock_fuel_code_repo.get_expected_use_types = AsyncMock(
        return_value=[mock_expected_use]
    )

    formatted_fuel_type = {
        "fuel_type_id": 1,
        "fuel_type": "Gasoline",
        "default_carbon_intensity": 12.34,
        "units": "L",
        "unrecognized": False,
        "fuel_categories": [
            {
                "fuel_category_id": mock_fuel_category.fuel_category_id,
                "category": mock_fuel_category.category,
            }
        ],
        "fuel_codes": [
            {
                "fuel_code_id": mock_fuel_code.fuel_code_id,
                "fuel_code": mock_fuel_code.fuel_code,
                "carbon_intensity": mock_fuel_code.carbon_intensity,
            }
        ],
    }

    mock_fuel_code_repo.get_formatted_fuel_types = AsyncMock(
        return_value=[formatted_fuel_type]
    )
    other_uses_repo.fuel_code_repo = mock_fuel_code_repo

    # Execute test
    result = await other_uses_repo.get_table_options("2024")

    # Verify content
    assert isinstance(result, dict)
    assert len(result["fuel_categories"]) == 1
    assert len(result["fuel_types"]) == 1
    assert len(result["provisions_of_the_act"]) == 1
    assert len(result["expected_uses"]) == 1

    # Verify specific values
    fuel_type = result["fuel_types"][0]
    assert fuel_type["fuel_type_id"] == 1
    assert fuel_type["fuel_type"] == "Gasoline"


@pytest.mark.anyio
async def test_get_other_uses(other_uses_repo, mock_db_session):
    compliance_report_id = 1
    mock_compliance_report_uuid = "mock_group_uuid"

    # Mock the first db.execute call for fetching compliance report group UUID
    mock_first_execute = MagicMock()
    mock_first_execute.scalar.return_value = mock_compliance_report_uuid

    # Mock related entities for other uses
    mock_fuel_type = MagicMock()
    mock_fuel_type.fuel_type = "Gasoline"

    mock_fuel_category = MagicMock()
    mock_fuel_category.category = "Petroleum-based"

    mock_expected_use = MagicMock()
    mock_expected_use.name = "Transportation"

    mock_provision_of_the_act = MagicMock()
    mock_provision_of_the_act.name = "Provision A"

    mock_fuel_code = MagicMock()
    mock_fuel_code.fuel_code = "FuelCode123"

    # Mock an instance of OtherUses
    mock_other_use = MagicMock()
    mock_other_use.other_uses_id = 1
    mock_other_use.compliance_report_id = compliance_report_id
    mock_other_use.quantity_supplied = 1000
    mock_other_use.fuel_type = mock_fuel_type
    mock_other_use.fuel_category = mock_fuel_category
    mock_other_use.expected_use = mock_expected_use
    mock_other_use.provision_of_the_act = mock_provision_of_the_act
    mock_other_use.fuel_code = mock_fuel_code
    mock_other_use.units = "L"
    mock_other_use.ci_of_fuel = 10.5
    mock_other_use.rationale = "Test rationale"
    mock_other_use.group_uuid = mock_compliance_report_uuid
    mock_other_use.version = 1
    mock_other_use.action_type = "Create"

    mock_result_other_uses = [mock_other_use]

    # Mock the second db.execute call for fetching other uses
    mock_second_execute = MagicMock()
    mock_second_execute.unique.return_value.scalars.return_value.all.return_value = (
        mock_result_other_uses
    )

    # Assign side effects to return these mocked execute calls in sequence
    mock_db_session.execute = AsyncMock(
        side_effect=[mock_first_execute, mock_second_execute]
    )

    # Call the repository method
    result = await other_uses_repo.get_other_uses(compliance_report_id)

    # Assertions
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0].fuel_type == "Gasoline"
    assert result[0].fuel_category == "Petroleum-based"
    assert result[0].expected_use == "Transportation"
    assert result[0].provision_of_the_act == "Provision A"
    assert result[0].fuel_code == "FuelCode123"
    assert result[0].units == "L"
    assert result[0].ci_of_fuel == 10.5
    assert result[0].rationale == "Test rationale"


@pytest.mark.anyio
async def test_get_latest_other_uses_by_group_uuid(other_uses_repo, mock_db_session):
    group_uuid = "test-group-uuid"
    mock_other_use_gov = MagicMock(spec=OtherUses)
    mock_other_use_gov.version = 2

    # Setup mock result chain
    mock_result = AsyncMock()
    mock_result.unique = MagicMock(return_value=mock_result)
    mock_result.scalars = MagicMock(return_value=mock_result)
    mock_result.first = MagicMock(return_value=mock_other_use_gov)

    # Configure mock db session
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    other_uses_repo.db = mock_db_session

    result = await other_uses_repo.get_latest_other_uses_by_group_uuid(group_uuid)

    assert result.version == 2


@pytest.mark.anyio
async def test_update_other_use(other_uses_repo, mock_db_session):
    updated_other_use = create_mock_entity({})
    updated_other_use.quantity_supplied = 2000
    updated_other_use.fuel_type.fuel_type = "Diesel"
    updated_other_use.rationale = "Updated rationale"

    mock_db_session.flush = AsyncMock()
    mock_db_session.refresh = AsyncMock()
    mock_db_session.merge.return_value = updated_other_use

    result = await other_uses_repo.update_other_use(updated_other_use)

    # Assertions
    assert isinstance(result, OtherUses)
    assert mock_db_session.flush.call_count == 1


@pytest.mark.anyio
async def test_get_formatted_fuel_types_all_fuel_codes_invalid(
    other_uses_repo, mock_db_session
):
    """
    Test that get_formatted_fuel_types returns fuel_types with empty fuel_codes
    when all associated fuel_codes are either expired or not yet effective.
    """
    compliance_period = 2024
    compliance_period_start = date(compliance_period, 1, 1)
    compliance_period_end = date(compliance_period, 12, 31)

    past_date = compliance_period_start - timedelta(days=1)  # December 31, 2023
    future_date = compliance_period_end + timedelta(days=1)  # January 1, 2025

    # Create actual DefaultCarbonIntensity instance
    mock_default_ci = DefaultCarbonIntensity(
        default_carbon_intensity_id=1,
        compliance_period_id=2,
        fuel_type_id=1,
        default_carbon_intensity=10.0,
    )

    mock_fuel_type = MagicMock(spec=FuelType)
    mock_fuel_type.fuel_type_id = 1
    mock_fuel_type.fuel_type = "Hydrogen"
    mock_fuel_type.units = "Kg"
    mock_fuel_type.unrecognized = False
    mock_fuel_type.fuel_instances = []
    # Setup default_carbon_intensities relationship
    type(mock_fuel_type).default_carbon_intensities = PropertyMock(
        return_value=[mock_default_ci]
    )

    # Create expired and future fuel codes
    mock_fuel_code_expired = MagicMock(spec=FuelCode)
    mock_fuel_code_expired.fuel_code_id = 1
    mock_fuel_code_expired.fuel_status_id = 2
    mock_fuel_code_expired.fuel_code = "FC_EXPIRED"
    mock_fuel_code_expired.effective_date = None
    mock_fuel_code_expired.expiration_date = past_date
    mock_fuel_code_expired.carbon_intensity = 10.0

    mock_fuel_code_future = MagicMock(spec=FuelCode)
    mock_fuel_code_future.fuel_code_id = 2
    mock_fuel_code_future.fuel_status_id = 2
    mock_fuel_code_future.fuel_code = "FC_FUTURE"
    mock_fuel_code_future.effective_date = future_date
    mock_fuel_code_future.expiration_date = None
    mock_fuel_code_future.carbon_intensity = 12.0

    mock_fuel_category = MagicMock(spec=FuelCategory)
    mock_fuel_category.fuel_category_id = 1
    mock_fuel_category.category = "Alternative"

    # Set up relationships
    mock_fuel_type.fuel_codes = [mock_fuel_code_expired, mock_fuel_code_future]
    mock_fuel_type.fuel_categories = mock_fuel_category

    # Mock the SQLAlchemy Result objects
    class MockResult:
        def unique(self):
            return self

        def scalars(self):
            return self

        def all(self):
            return [mock_fuel_type]

        def scalar_one_or_none(self):
            return 2

    # Setup mock execute with different results
    async def mock_execute_side_effect(query):
        query_str = str(query).lower()
        if "compliance_period" in query_str:
            return MockResult()
        elif "fuel_code_status" in query_str:
            return MockResult()
        else:
            return MockResult()

    mock_db_session.execute = AsyncMock(side_effect=mock_execute_side_effect)
    other_uses_repo.db = mock_db_session

    result = await other_uses_repo.get_formatted_fuel_types(
        include_legacy=False, compliance_period=2024
    )

    assert isinstance(result, list), "Result should be a list"
    assert len(result) == 1, "Result should contain exactly one fuel type"

    returned_fuel_type = result[0]
    assert returned_fuel_type["fuel_type_id"] == mock_fuel_type.fuel_type_id
    assert returned_fuel_type["fuel_type"] == mock_fuel_type.fuel_type
    assert (
        returned_fuel_type["default_carbon_intensity"]
        == mock_default_ci.default_carbon_intensity
    )
    assert returned_fuel_type["units"] == mock_fuel_type.units
    assert returned_fuel_type["unrecognized"] == mock_fuel_type.unrecognized
    assert returned_fuel_type["fuel_categories"] == []  # Empty since no fuel instances
    assert returned_fuel_type["fuel_codes"] == []  # Empty since all codes are invalid

    assert not returned_fuel_type[
        "fuel_codes"
    ], "Fuel codes should be empty when all are invalid."


@pytest.mark.anyio
async def test_get_formatted_fuel_types_mixed_fuel_codes(
    other_uses_repo, mock_db_session
):
    """Test get_formatted_fuel_types with mix of valid and invalid fuel codes"""
    today = date.today()
    past_date = date(2023, 12, 12)
    future_date = date(2025, 2, 2)

    # Create mock DefaultCarbonIntensity for the relationship
    mock_default_ci = MagicMock(spec=DefaultCarbonIntensity)
    mock_default_ci.compliance_period_id = 2
    mock_default_ci.default_carbon_intensity = 10.0
    mock_default_ci.fuel_type_id = 1

    mock_fuel_type = MagicMock(spec=FuelType)
    mock_fuel_type.fuel_type_id = 1
    mock_fuel_type.fuel_type = "Hydrogen"
    mock_fuel_type.units = "Kg"
    mock_fuel_type.unrecognized = False
    mock_fuel_type.fuel_instances = []
    # Setup default_carbon_intensities relationship
    mock_fuel_type.default_carbon_intensities = [mock_default_ci]

    # Create mix of valid and invalid fuel codes
    mock_fuel_code_expired = MagicMock(spec=FuelCode)
    mock_fuel_code_expired.fuel_code_id = 1
    mock_fuel_code_expired.fuel_status_id = 2
    mock_fuel_code_expired.fuel_code = "FC_EXPIRED"
    mock_fuel_code_expired.effective_date = None
    mock_fuel_code_expired.expiration_date = past_date
    mock_fuel_code_expired.carbon_intensity = 10.0

    mock_fuel_code_active = MagicMock(spec=FuelCode)
    mock_fuel_code_active.fuel_code_id = 2
    mock_fuel_code_active.fuel_status_id = 2
    mock_fuel_code_active.fuel_code = "FC_ACTIVE"
    mock_fuel_code_active.effective_date = None
    mock_fuel_code_active.expiration_date = None
    mock_fuel_code_active.carbon_intensity = 12.0

    mock_fuel_code_valid = MagicMock(spec=FuelCode)
    mock_fuel_code_valid.fuel_code_id = 3
    mock_fuel_code_valid.fuel_status_id = 2
    mock_fuel_code_valid.fuel_code = "FC_VALID"
    mock_fuel_code_valid.effective_date = date(2024, 1, 1)
    mock_fuel_code_valid.expiration_date = future_date
    mock_fuel_code_valid.carbon_intensity = 15.0

    mock_fuel_code_future = MagicMock(spec=FuelCode)
    mock_fuel_code_future.fuel_code_id = 4
    mock_fuel_code_future.fuel_status_id = 2
    mock_fuel_code_future.fuel_code = "FC_FUTURE"
    mock_fuel_code_future.effective_date = future_date
    mock_fuel_code_future.expiration_date = None
    mock_fuel_code_future.carbon_intensity = 18.0

    mock_fuel_category = MagicMock(spec=FuelCategory)
    mock_fuel_category.fuel_category_id = 1
    mock_fuel_category.category = "Alternative"

    # Set up relationships with all fuel codes
    mock_fuel_type.fuel_codes = [
        mock_fuel_code_expired,
        mock_fuel_code_active,
        mock_fuel_code_valid,
        mock_fuel_code_future,
    ]
    mock_fuel_type.fuel_categories = mock_fuel_category

    mock_query_result = MagicMock()
    mock_query_result.unique.return_value = mock_query_result
    mock_query_result.scalars.return_value = mock_query_result
    mock_query_result.scalar_one_or_none.return_value = 2
    mock_query_result.all.return_value = [mock_fuel_type]

    mock_db_session.execute = AsyncMock(return_value=mock_query_result)
    other_uses_repo.db = mock_db_session

    result = await other_uses_repo.get_formatted_fuel_types(
        include_legacy=False, compliance_period=2024
    )

    assert isinstance(result, list), "Result should be a list"
    assert len(result) == 1, "Result should contain exactly one fuel type"

    returned_fuel_type = result[0]
    assert returned_fuel_type["fuel_type_id"] == mock_fuel_type.fuel_type_id
    assert returned_fuel_type["fuel_type"] == mock_fuel_type.fuel_type
    assert (
        returned_fuel_type["default_carbon_intensity"]
        == mock_default_ci.default_carbon_intensity
    )
    assert returned_fuel_type["units"] == mock_fuel_type.units
    assert returned_fuel_type["unrecognized"] == mock_fuel_type.unrecognized

    # Verify valid fuel codes are included and invalid ones are filtered out
    valid_fuel_codes = returned_fuel_type["fuel_codes"]
    assert len(valid_fuel_codes) == 2, "Should have exactly 2 valid fuel codes"

    fuel_code_ids = [fc["fuel_code_id"] for fc in valid_fuel_codes]
    assert (
        mock_fuel_code_active.fuel_code_id in fuel_code_ids
    ), "Active fuel code should be included"
    assert (
        mock_fuel_code_valid.fuel_code_id in fuel_code_ids
    ), "Valid fuel code should be included"
    assert (
        mock_fuel_code_expired.fuel_code_id not in fuel_code_ids
    ), "Expired fuel code should be excluded"
    assert (
        mock_fuel_code_future.fuel_code_id not in fuel_code_ids
    ), "Future fuel code should be excluded"
